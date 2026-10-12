// Supabase Edge Function : ai-chat  (v3 — RAPIDE + RAISONNEMENT + RECHERCHE EN LIGNE)
// - Course entre fournisseurs : on lance le 1er ; s'il n'a pas répondu en 3,5 s (ou s'il échoue)
//   on lance le suivant, jusqu'à 3 en parallèle. Le premier qui répond gagne, les autres sont annulés.
// - Pour un calcul, une analyse ou le mode formation : les modèles les plus capables passent d'abord,
//   avec un effort de raisonnement plus élevé (la rapidité ne doit pas remplacer le raisonnement).
// - Recherche en ligne (Tavily, puis Brave) quand la question porte sur le droit, un chiffre ou un fait récent,
//   ou quand le mode formation est ouvert. Sans clé de recherche, rien ne change.
// - La relecture (refine) est désactivée par défaut (envoyez refine:true pour l'activer).
// Réservé aux utilisateurs connectés. Clés API : Supabase → Edge Functions → Secrets.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Message = { role: "system" | "user" | "assistant"; content: string };
type Provider = {
  name: string; url: string; env: string; model: string;
  modelEnv?: string; strong: boolean; extra?: Record<string, string>;
  body?: Record<string, unknown>;
};
type Cand = { p: Provider; key: string };
type Diag = { provider: string; problem: string };
type Source = { titre: string; url: string; extrait: string };

const ALLOWED_ROLES = ["super_owner", "admin", "editeur", "lecteur"];
const ADMIN_ROLES = ["super_owner", "admin"];
const TOTAL_BUDGET_MS = 22_000;    // le navigateur attend 26 s
const CALL_TIMEOUT_MS = 15_000;    // délai max par fournisseur
const STAGGER_MS = 3_500;          // on lance le suivant si pas de réponse après ce délai
const MAX_PARALLEL = 3;            // appels simultanés maximum
const SEARCH_TIMEOUT_MS = 6_000;   // délai max pour la recherche en ligne
const RATE_MAX_USER = 60;          // requêtes / 10 min / utilisateur (hors admin)
const RATE_WINDOW_MS = 10 * 60_000;

// ---------------------------------------------------------------- CORS / JSON
function corsHeaders(req: Request): Headers {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Vary", "Origin");
  const origin = req.headers.get("Origin");
  const cfg = Deno.env.get("APP_ALLOWED_ORIGINS");
  if (!cfg?.trim()) { h.set("Access-Control-Allow-Origin", "*"); return h; }
  if (origin && cfg.split(",").map((v) => v.trim()).includes(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}
const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });

function originAllowed(req: Request): boolean {
  const cfg = Deno.env.get("APP_ALLOWED_ORIGINS");
  const origin = req.headers.get("Origin");
  if (!cfg?.trim() || !origin) return true;
  return cfg.split(",").map((v) => v.trim()).filter(Boolean).includes(origin);
}

// ---------------------------------------------------------------- FOURNISSEURS
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const OR_EXTRA = { "HTTP-Referer": "https://openrouter.ai", "X-Title": "Application GRH" };

const NV = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `NVIDIA ${n}`, url: NVIDIA_URL, env: "NVIDIA_API_KEY", model, strong });
const GE = (n: string, model: string, strong: boolean): Provider =>
  ({ name: n, url: GEMINI_URL, env: "GEMINI_API_KEY", model, strong });
const GQ = (n: string, model: string, strong: boolean, body?: Record<string, unknown>): Provider =>
  ({ name: `Groq ${n}`, url: GROQ_URL, env: "GROQ_API_KEY", model, strong, body });
const MI = (n: string, model: string, strong: boolean): Provider =>
  ({ name: n, url: MISTRAL_URL, env: "MISTRAL_API_KEY", model, strong });
const OR = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `OpenRouter ${n}`, url: OPENROUTER_URL, env: "OPENROUTER_API_KEY", model, strong, extra: OR_EXTRA });
const HF = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `Hugging Face ${n}`, url: HF_URL, env: "HF_API_KEY", model, strong });

// ORDRE = RAPIDITÉ D'ABORD. Les modèles dont le nom n'est pas confirmé sont placés à la fin :
// un nom invalide renvoie 404 et le modèle est mis de côté, sans bloquer la réponse.
const PROVIDERS: Provider[] = [
  // 1) Très rapides
  GQ("GPT-OSS 120B", "openai/gpt-oss-120b", true, { reasoning_effort: "low" }),
  GQ("GPT-OSS 20B", "openai/gpt-oss-20b", false, { reasoning_effort: "low" }),
  GE("Gemini 2.5 Flash", "gemini-2.5-flash", true),
  GE("Gemini 2.5 Flash-Lite", "gemini-2.5-flash-lite", false),
  MI("Mistral Small", "mistral-small-latest", false),
  MI("Mistral Large", "mistral-large-latest", true),
  MI("Mistral Medium 3.5", "mistral-medium-2508", true),
  // 2) OpenRouter (gratuit)
  OR("Llama 3.3 70B", "meta-llama/llama-3.3-70b-instruct:free", false),
  OR("GPT-OSS 120B", "openai/gpt-oss-120b:free", false),
  OR("Nemotron 3 Super", "nvidia/nemotron-3-super-120b-a12b:free", true),
  OR("Qwen3.6 Plus", "qwen/qwen3.6-plus:free", true),
  OR("MiniMax M2.5", "minimax/minimax-m2.5:free", true),
  OR("Qwen3 Coder 480B", "qwen/qwen3-coder:free", false),
  // 3) NVIDIA — modèles légers (rapides)
  NV("Llama 3.1 8B", "meta/llama-3.1-8b-instruct", false),
  NV("Llama 4 Maverick 17B", "meta/llama-4-maverick-17b-128e-instruct", false),
  NV("GPT-OSS 20B", "openai/gpt-oss-20b", false),
  NV("GPT-OSS 120B", "openai/gpt-oss-120b", false),
  NV("Gemma 4 31B", "google/gemma-4-31b-it", false),
  NV("Phi-4 Mini", "microsoft/phi-4-mini-instruct", false),
  NV("Granite 3.3 8B", "ibm/granite-3.3-8b-instruct", false),
  NV("Nemotron 3 Nano 30B", "nvidia/nemotron-3-nano-30b-a3b", false),
  NV("Nemotron 3.5 Lightning 30B", "nvidia/nemotron-3.5-lightning-30b-a3b", false),
  NV("Step 3.7 Flash", "stepfun-ai/step-3.7-flash", false),
  NV("Jamba 1.5 Mini", "ai21labs/jamba-1.5-mini-instruct", false),
  // 4) Mistral anciens
  MI("Mistral Nemo", "open-mistral-nemo", false),
  MI("Mixtral 8x7B", "open-mixtral-8x7b", false),
  MI("Mistral 7B", "open-mistral-7b", false),
  MI("Mistral Codestral", "codestral-latest", false),
  // 5) Hugging Face
  HF("Qwen3.8 27B", "Qwen/Qwen3.8-27B", true),
  HF("GLM-5.3-Flash", "zai-org/GLM-5.3-Flash", false),
  HF("GPT-OSS 120B", "openai/gpt-oss-120b", false),
  // 6) Gros modèles NVIDIA (lents / en file d'attente) et noms récents à confirmer : en dernier recours
  GE("Gemini 3.8 Flash", "gemini-3.8-flash", true),
  GE("Gemini 3.7 Flash", "gemini-3.7-flash", true),
  NV("Llama 3.1 405B", "meta/llama-3.1-405b-instruct", true),
  NV("DeepSeek V4 Flash", "deepseek-ai/deepseek-v4-flash", true),
  NV("DeepSeek V4 Pro", "deepseek-ai/deepseek-v4-pro", true),
  NV("Nemotron 3 Super 120B", "nvidia/nemotron-3-super-120b-a12b", true),
  NV("Mistral Medium 3.5 128B", "mistralai/mistral-medium-3.5-128b", true),
  NV("Qwen3.5 122B", "qwen/qwen3.5-122b-a10b", true),
  NV("Qwen3.5 397B", "qwen/qwen3.5-397b-a17b", true),
  NV("Kimi K2.6", "moonshotai/kimi-k2.6", true),
  NV("Kimi K3", "moonshotai/kimi-k3", true),
  NV("GLM 5.3", "z-ai/glm-5.3", true),
  NV("MiniMax M3", "minimaxai/minimax-m3", true),
  NV("Nemotron 3 Ultra 550B", "nvidia/nemotron-3-ultra-550b-a55b", true),
];

// ---------------------------------------------------------------- CLÉS / PAUSES
function keysOf(env: string): string[] {
  const names = [env, ...Array.from({ length: 8 }, (_, i) => `${env}_${i + 2}`)];
  return [...new Set(names.map((n) => Deno.env.get(n)?.trim()).filter((v): v is string => Boolean(v)))];
}

// Pauses gardées en mémoire (valables tant que l'instance de la fonction reste active).
const cooldowns = new Map<string, number>();
const keyScope = (p: Provider, k: string) => `key|${p.env}|${k}`;
const modelScope = (p: Provider, k: string) => `model|${p.name}|${k}`;
const pause = (scope: string, ms: number) => cooldowns.set(scope, Date.now() + ms);
function paused(scope: string): boolean {
  const until = cooldowns.get(scope) ?? 0;
  if (until <= Date.now()) { cooldowns.delete(scope); return false; }
  return true;
}
const modelFor = (p: Provider) => (p.modelEnv && Deno.env.get(p.modelEnv)?.trim()) || p.model;

function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((x) => typeof x === "string" ? x : (x && typeof x.text === "string" ? x.text : ""))
      .filter(Boolean).join("\n").trim();
  }
  return "";
}

// ---------------------------------------------------------------- SALUTATION
function salutationFor(hour: number, en: boolean): string {
  if (en) return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
  return hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir";
}
const cleanName = (v: unknown) =>
  String(v || "").trim().slice(0, 40).replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ'\- ]/g, "").replace(/\s+/g, " ").trim();

function stripLeadingGreeting(text: string): string {
  return text
    .replace(/^\s*(bonjour|bonsoir|bon\s+apr[eé]s[- ]?midi|salut|hello|hi|hey|coucou|good\s+(morning|afternoon|evening))[^.!?\n]*[.!?]\s*/i, "")
    .replace(/^\s*(je suis (l['’]|votre )assistant[^.!?\n]*[.!?]|comment puis[- ]je[^.!?\n]*[.!?]|i['’]?m (the|your) (hr )?assistant[^.!?\n]*[.!?]|how can i help[^.!?\n]*[.!?])\s*/i, "")
    .trim();
}

// ---------------------------------------------------------------- RECHERCHE EN LIGNE
// Quand chercher : droit du travail, chiffres, faits récents, ou mode formation ouvert.
const MOTS_ACTUELS = /\b(20\d\d|actuel|actuelle|actuellement|aujourd|dernier|derni[eè]re|nouveau|nouvelle|bar[eè]me|taux|cotisation|montant|en vigueur|mise à jour|officiel)\b/i;
const MOTS_JURIDIQUES = /code du travail|cnps|irpp|cgi|convention|d[ée]cret|arr[êe]t[ée]|\bloi\b|article|jurisprudence|smig|taux|bar[eè]me|combien|montant|calcul/i;
// Raisonnement approfondi : calcul, analyse, explication, ou mode formation
const MOTS_RAISONNEMENT = /\d|combien|montant|calcul|analys|pourquoi|expliqu|comment/i;

function besoinWeb(question: string, mode?: string): boolean {
  return mode === "formation" || MOTS_ACTUELS.test(question) || MOTS_JURIDIQUES.test(question);
}
function besoinRaisonnement(question: string, mode?: string): boolean {
  return mode === "formation" || MOTS_RAISONNEMENT.test(question);
}

async function rechercherTavily(question: string): Promise<Source[]> {
  const cle = Deno.env.get("TAVILY_API_KEY");
  if (!cle) return [];
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: ac.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: cle, query: question.slice(0, 300), max_results: 4, search_depth: "basic" }),
    });
    clearTimeout(to);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).slice(0, 4).map((x: { title?: string; url?: string; content?: string }) => ({
      titre: String(x.title || "").slice(0, 160),
      url: String(x.url || ""),
      extrait: String(x.content || "").slice(0, 600),
    }));
  } catch {
    return [];
  }
}

async function rechercherBrave(question: string): Promise<Source[]> {
  const cle = Deno.env.get("BRAVE_API_KEY");
  if (!cle) return [];
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
    const url = "https://api.search.brave.com/res/v1/web/search?count=4&q=" + encodeURIComponent(question.slice(0, 300));
    const r = await fetch(url, { signal: ac.signal, headers: { "Accept": "application/json", "X-Subscription-Token": cle } });
    clearTimeout(to);
    if (!r.ok) return [];
    const j = await r.json();
    const res = (j.web && j.web.results) || [];
    return res.slice(0, 4).map((x: { title?: string; url?: string; description?: string }) => ({
      titre: String(x.title || "").slice(0, 160),
      url: String(x.url || ""),
      extrait: String(x.description || "").slice(0, 600),
    }));
  } catch {
    return [];
  }
}

async function rechercherWeb(question: string): Promise<Source[]> {
  const t = await rechercherTavily(question);
  if (t.length) return t;
  return await rechercherBrave(question);
}

// ---------------------------------------------------------------- APPEL D'UN FOURNISSEUR
async function call(
  p: Provider, key: string, messages: Message[], maxTokens: number, timeoutMs: number, ctrl: AbortController,
  heavy = false,
): Promise<string> {
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  try {
    // Pour un calcul ou une analyse, on relève l'effort de raisonnement des modèles qui le permettent
    const effort = heavy && p.body && "reasoning_effort" in p.body ? { reasoning_effort: "medium" } : {};
    const res = await fetch(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...p.extra },
      body: JSON.stringify({
        model: modelFor(p), messages, max_tokens: maxTokens, temperature: 0.3, stream: false, ...p.body, ...effort,
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const s = res.status;
      if (s === 401 || s === 402 || s === 403) pause(keyScope(p, key), 5 * 60_000);          // toute la clé
      else if (s === 429) pause(modelScope(p, key), 60_000);
      else if (s === 404) pause(modelScope(p, key), 30 * 60_000);                              // modèle inexistant
      else if (s === 400 || s === 422) pause(modelScope(p, key), 5 * 60_000);
      else if (s >= 500) pause(modelScope(p, key), 30_000);
      throw new Error(`HTTP ${s}: ${body || "erreur fournisseur"}`);
    }
    const out = extractText((await res.json())?.choices?.[0]?.message?.content);
    if (!out) throw new Error("Réponse vide.");
    return out;
  } catch (e) {
    if (ctrl.signal.aborted) {
      if (ctrl.signal.reason === "timeout") {
        pause(modelScope(p, key), 2 * 60_000);
        throw new Error(`Délai d'attente dépassé (${Math.round(timeoutMs / 1000)} s).`);
      }
      throw new Error("Annulé (un autre fournisseur a répondu plus vite).");   // sans pause : ce n'est pas une panne
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- COURSE ENTRE FOURNISSEURS
function race(
  cands: Cand[], messages: Message[], maxTokens: number, deadline: number, diagnostics: Diag[], heavy = false,
): Promise<{ text: string; p: Provider } | null> {
  if (!cands.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ctrls = new Set<AbortController>();
    let next = 0, running = 0, finished = false;
    let stagger: ReturnType<typeof setInterval> | undefined;
    let hard: ReturnType<typeof setTimeout> | undefined;

    const finish = (r: { text: string; p: Provider } | null) => {
      if (finished) return;
      finished = true;
      clearInterval(stagger);
      clearTimeout(hard);
      for (const c of ctrls) c.abort("lost");   // annule les perdants
      resolve(r);
    };

    const launch = () => {
      if (finished || next >= cands.length) return;
      const left = deadline - Date.now();
      if (left < 1500) { finish(null); return; }
      const { p, key } = cands[next++];
      const ctrl = new AbortController();
      ctrls.add(ctrl);
      running++;
      call(p, key, messages, maxTokens, Math.min(CALL_TIMEOUT_MS, left), ctrl, heavy)
        .then((text) => finish({ text, p }))
        .catch((e) => {
          if (!finished) diagnostics.push({ provider: p.name, problem: (e instanceof Error ? e.message : "Erreur inconnue").slice(0, 180) });
        })
        .finally(() => {
          running--;
          ctrls.delete(ctrl);
          if (finished) return;
          if (next < cands.length) launch();            // échec : on passe tout de suite au suivant
          else if (running === 0) finish(null);         // plus personne en course
        });
    };

    hard = setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
    stagger = setInterval(() => { if (running < MAX_PARALLEL) launch(); }, STAGGER_MS);
    launch();
  });
}

// ---------------------------------------------------------------- RELECTURE (optionnelle : refine:true)
async function refine(p: Provider, key: string, messages: Message[], draft: string, maxTokens: number, left: number): Promise<string> {
  if (left < 15_000) return draft;
  try {
    const q = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const critique = await call(p, key, [
      { role: "system", content: "Tu es un relecteur exigeant. Repère les erreurs factuelles, oublis, contradictions et fautes de langue. N'invente pas de faits. Si la réponse est satisfaisante, réponds uniquement OK." },
      { role: "user", content: `Question :\n${q}\n\nRéponse à vérifier :\n${draft}` },
    ], 500, 8_000, new AbortController());
    if (/^\s*OK\b/i.test(critique)) return draft;
    const improved = await call(p, key, [
      ...messages,
      { role: "assistant", content: draft },
      { role: "user", content: `Améliore ta réponse en tenant compte des observations suivantes :\n${critique}\n\nFournis directement la version finale, dans la même langue. Ne présente pas comme vérifié ce qui ne l'est pas.` },
    ], maxTokens, 12_000, new AbortController());
    return improved.length > 20 ? improved : draft;
  } catch {
    return draft;
  }
}

// ---------------------------------------------------------------- LIMITES
const hits = new Map<string, number[]>();
function rateLimited(id: string, max: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((x) => now - x < RATE_WINDOW_MS)) hits.delete(k);
    if (hits.size > 5000) hits.clear();
  }
  const list = (hits.get(id) ?? []).filter((x) => now - x < RATE_WINDOW_MS);
  list.push(now);
  hits.set(id, list);
  return list.length > max;
}

// ---------------------------------------------------------------- AUTHENTIFICATION
type Who =
  | { kind: "user"; userId: string; isAdmin: boolean }
  | { kind: "forbidden" }
  | { kind: "invalid" };

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// Clé publique (ancienne clé JWT « anon » ou nouvelle clé « sb_publishable_… ») : refusée, il faut un vrai compte.
function isAnonToken(token: string): boolean {
  const known = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    ...(Deno.env.get("PUBLIC_KEYS") ?? "").split(","),
  ].map((v) => v?.trim()).filter(Boolean);
  if (known.includes(token)) return true;
  if (token.startsWith("sb_publishable_")) return true;
  return jwtPayload(token)?.role === "anon";
}

// deno-lint-ignore no-explicit-any
async function safe<T = any>(f: PromiseLike<T>, fallback: T): Promise<T> {
  try { return await f; } catch { return fallback; }
}

async function identify(_req: Request, authHeader: string | null): Promise<Who> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { kind: "invalid" };
  if (isAnonToken(token)) return { kind: "invalid" };   // pas de compte = pas d'accès

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "https://cbaepeugbemwmclgfnxz.supabase.co";
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const supa = createClient(url, key || token, { global: { headers: { Authorization: authHeader! } } });
    const sub = String(jwtPayload(token)?.sub ?? "");

    // Les 4 vérifications partent EN MÊME TEMPS (avant : l'une après l'autre).
    // Le jeton est vérifié par getUser(); les requêtes de rôles passent de toute façon par les droits (RLS) de l'utilisateur.
    // deno-lint-ignore no-explicit-any
    const empty: any = { data: null };
    const [userRes, whoRes, rolesRes, entRes] = await Promise.all([
      supa.auth.getUser(token),
      safe(supa.rpc("whoami"), empty),
      sub ? safe(supa.from("user_roles").select("role").eq("user_id", sub), empty) : Promise.resolve(empty),
      sub ? safe(supa.from("user_entreprises").select("role").eq("user_id", sub), empty) : Promise.resolve(empty),
    ]);
    const user = userRes?.data?.user;
    if (!user || (sub && user.id !== sub)) return { kind: "invalid" };

    const roles: string[] = [];
    const w = whoRes?.data;
    if (w?.role) roles.push(String(w.role));
    if (w?.is_platform_owner === true) roles.push("super_owner");
    (rolesRes?.data ?? []).forEach((r: { role: string }) => roles.push(r.role));
    (entRes?.data ?? []).forEach((r: { role: string }) => roles.push(r.role));

    if (!roles.some((r) => ALLOWED_ROLES.includes(r))) return { kind: "forbidden" };
    return { kind: "user", userId: user.id, isAdmin: roles.some((r) => ADMIN_ROLES.includes(r)) };
  } catch (e) {
    console.error("identify error", e);
    return { kind: "invalid" };
  }
}

// ---------------------------------------------------------------- POINT D'ENTRÉE
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Méthode non autorisée." }, 405);
  if (!originAllowed(req)) return json(req, { error: "Origine non autorisée." }, 403);

  try {
    const t0 = Date.now();

    // ----- 1. Qui appelle ? (compte obligatoire)
    const who = await identify(req, req.headers.get("Authorization"));
    if (who.kind === "invalid") return json(req, { error: "Non authentifié." }, 401);
    if (who.kind === "forbidden") return json(req, { error: "Accès non autorisé." }, 403);

    const isAdmin = who.isAdmin;
    if (!isAdmin && rateLimited(`u:${who.userId}`, RATE_MAX_USER)) {
      return json(req, { error: "Trop de demandes. Réessayez dans quelques minutes." }, 429);
    }

    // ----- 2. Entrées
    if (Number(req.headers.get("content-length") ?? "0") > 1_000_000) {
      return json(req, { error: "La requête dépasse la taille maximale autorisée." }, 413);
    }
    const body = await req.json();

    // Diagnostic (admin) : quels secrets sont présents ? — aucune valeur n'est renvoyée.
    if (isAdmin && body?.diag === true) {
      const envs = [...new Set(PROVIDERS.map((p) => p.env))];
      return json(req, {
        diag: true,
        secrets: envs.map((e) => ({ env: e, keys: keysOf(e).length })),
        models_usable: PROVIDERS.filter((p) => keysOf(p.env).length > 0).length,
        paused: [...cooldowns.keys()].filter((k) => paused(k)).length,
        recherche_web: { tavily: !!Deno.env.get("TAVILY_API_KEY"), brave: !!Deno.env.get("BRAVE_API_KEY") },
      });
    }

    const { messages = [], user_first = "", client_hour, max_tokens = 4000, lang = "fr" } = body;
    const context = String(body?.context ?? "");
    const raw = isAdmin && body.raw === true;                     // mode « brut » réservé aux admins
    const doRefine = body?.refine === true && !raw;               // relecture : désactivée par défaut (lente)
    const en = lang === "en";

    if (!Array.isArray(messages) || messages.length === 0) return json(req, { error: "Le tableau messages est obligatoire." }, 400);
    if (messages.length > 40) return json(req, { error: "Trop de messages dans la requête." }, 400);

    const valid = new Set(["system", "user", "assistant"]);
    const normalized: Message[] = [];
    for (const m of messages) {
      if (!m || typeof m !== "object" || !valid.has(m.role) || typeof m.content !== "string") {
        return json(req, { error: "Format de message invalide." }, 400);
      }
      if (m.content.length > 100_000) return json(req, { error: "Un message dépasse la taille autorisée." }, 400);
      normalized.push({ role: m.role, content: m.content });
    }
    if (!normalized.some((m) => m.role === "user")) return json(req, { error: "Message vide." }, 400);

    const reqTokens = Number(max_tokens);
    const max = Number.isFinite(reqTokens) ? Math.max(100, Math.min(Math.floor(reqTokens), 8000)) : 4000;

    // ----- 3. Salutation personnalisée
    const h = Number(client_hour);
    const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? Math.floor(h) : (new Date().getUTCHours() + 1) % 24; // repli : Cameroun (UTC+1)
    const salutation = salutationFor(hour, en);
    const nom = cleanName(user_first);
    const isFirstTurn = normalized.filter((m) => m.role === "user").length === 1;

    // ----- 4. Recherche en ligne (si la question le demande) et raisonnement approfondi
    const question = [...normalized].reverse().find((m) => m.role === "user")?.content ?? "";
    const mode = typeof body?.mode === "string" ? body.mode : undefined;
    const heavy = besoinRaisonnement(question, mode);
    let web: Source[] = [];
    if (besoinWeb(question, mode)) web = await rechercherWeb(question);
    const blocWeb = web.length
      ? "\n\nRésultats de recherche web (à citer, à vérifier à la source officielle) :\n" +
        web.map((x) => "- " + x.titre + " — " + x.url + "\n  " + x.extrait).join("\n")
      : (besoinWeb(question, mode) ? "\n\nAucune source en ligne n'a pu être consultée pour cette question : dis-le, et ne présente pas de chiffre ou de texte comme certain." : "");

    const system: Message = {
      role: "system",
      content:
        (en
          ? "Answer in English. "
          : "Réponds dans la langue utilisée par l'utilisateur dans son dernier message (français par défaut). ") +
        "Tu es l'assistant RH de la plateforme. Réponds clairement et n'invente jamais de chiffre, de date ou de texte de loi. " +
        "Si tu ne sais pas, dis-le clairement et indique où vérifier : « je ne suis pas certain » vaut mieux qu'une réponse fausse. " +
        "Pour les questions de droit du travail, distingue les faits établis (texte cité avec son article) des points à confirmer (taux, barème, décret, convention). " +
        "Pour un calcul ou une analyse, raisonne étape par étape : formule, hypothèses, calcul avec les chiffres donnés, vérification du résultat, puis ce qui reste à confirmer. " +
        "Pour une question simple, reste bref. " +
        (isFirstTurn
          ? "NE METS PAS de salutation ni de présentation au début de ta réponse (elle est ajoutée automatiquement) : commence directement par la réponse. "
          : "Suite de conversation : réponds directement, sans salutation. ") +
        (nom ? `Prénom de l'utilisateur : ${nom}. ` : "") +
        context.slice(0, 20_000) +
        blocWeb,
    };
    const finalMessages = raw ? normalized : [system, ...normalized];

    // ----- 5. Liste des candidats (fournisseurs ayant une clé et non mis en pause)
    const diagnostics: Diag[] = [];
    const missing = new Set<string>();
    const cands: Cand[] = [];
    for (const p of PROVIDERS) {
      const keys = keysOf(p.env);
      if (!keys.length) {
        if (!missing.has(p.env)) { missing.add(p.env); diagnostics.push({ provider: p.env, problem: "Secret absent." }); }
        continue;
      }
      for (const key of keys) {
        if (paused(keyScope(p, key)) || paused(modelScope(p, key))) continue;   // en pause : ignoré sans attendre
        cands.push({ p, key });
      }
    }
    // Calcul / analyse : les modèles capables de raisonner passent en premier (la rapidité ne doit pas tout décider)
    if (heavy) cands.sort((a, b) => Number(b.p.strong) - Number(a.p.strong));

    // ----- 6. Course entre fournisseurs
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const win = await race(cands, finalMessages, max, deadline, diagnostics, heavy);

    if (win) {
      let answer = win.text;
      if (doRefine && !win.p.strong) {
        const k = cands.find((c) => c.p === win.p)?.key;
        if (k) answer = await refine(win.p, k, finalMessages, answer, max, deadline - Date.now());
      }
      let text = answer;
      if (isFirstTurn && !raw) {
        const hello = nom ? `${salutation} ${nom} !` : `${salutation} !`;
        const cleaned = stripLeadingGreeting(answer);
        text = cleaned ? `${hello}\n\n${cleaned}` : hello;
      }
      // Le nom du moteur et la durée ne sont renvoyés qu'aux administrateurs.
      const sources = web.map((x) => x.url);
      return json(req, isAdmin ? { text, provider: win.p.name, ms: Date.now() - t0, sources } : { text, sources });
    }

    console.error("ai-chat : aucun fournisseur disponible", JSON.stringify(diagnostics));
    return json(req, {
      error: cands.length
        ? "Aucun fournisseur IA n'a répondu à temps. Réessayez dans quelques instants."
        : "Aucun fournisseur IA disponible pour le moment.",
      ...(isAdmin ? { details: diagnostics.slice(-12) } : {}),
    }, 503);
  } catch (e) {
    console.error("ai-chat : erreur de traitement", e);
    return json(req, { error: "Impossible de traiter la demande. Vérifiez le format de la requête." }, 500);
  }
});
