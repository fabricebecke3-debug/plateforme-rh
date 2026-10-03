// Supabase Edge Function : ai-chat
// Cascade multi-fournisseurs IA, quotas gérés, salutation selon l'heure locale.
// Accepte : JWT utilisateur (privilèges complets) OU clé anon (mode invité, restreint).
// Clés API : Supabase → Edge Functions → Secrets.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Message = { role: "system" | "user" | "assistant"; content: string };
type Provider = {
  name: string; url: string; env: string; model: string;
  modelEnv?: string; strong: boolean; extra?: Record<string, string>;
};

const ALLOWED_ROLES = ["super_owner", "admin", "editeur", "lecteur"];
const ADMIN_ROLES = ["super_owner", "admin"];
const TOTAL_BUDGET_MS = 100_000;   // le navigateur attend 120 s
const DEFAULT_TIMEOUT_MS = 35_000;
const RATE_MAX_USER = 60;          // requêtes / 10 min / utilisateur (hors admin)
const RATE_MAX_GUEST = 10;         // requêtes / 10 min / adresse IP (invité)
const GUEST_GLOBAL_MAX = 200;      // plafond global invités / 10 min (par instance)
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
const GQ = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `Groq ${n}`, url: GROQ_URL, env: "GROQ_API_KEY", model, strong });
const MI = (n: string, model: string, strong: boolean): Provider =>
  ({ name: n, url: MISTRAL_URL, env: "MISTRAL_API_KEY", model, strong });
const OR = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `OpenRouter ${n}`, url: OPENROUTER_URL, env: "OPENROUTER_API_KEY", model, strong, extra: OR_EXTRA });
const HF = (n: string, model: string, strong: boolean): Provider =>
  ({ name: `Hugging Face ${n}`, url: HF_URL, env: "HF_API_KEY", model, strong });

const PROVIDERS: Provider[] = [
  // NVIDIA — modèles puissants
  NV("Llama 3.1 405B", "meta/llama-3.1-405b-instruct", true),
  NV("Nemotron 3 Ultra 550B", "nvidia/nemotron-3-ultra-550b-a55b", true),
  NV("DeepSeek V4 Pro", "deepseek-ai/deepseek-v4-pro", true),
  NV("DeepSeek V4 Flash", "deepseek-ai/deepseek-v4-flash", true),
  NV("Kimi K3", "moonshotai/kimi-k3", true),
  NV("Kimi K2.6", "moonshotai/kimi-k2.6", true),
  NV("Nemotron 3 Super 120B", "nvidia/nemotron-3-super-120b-a12b", true),
  NV("Mistral Medium 3.5 128B", "mistralai/mistral-medium-3.5-128b", true),
  NV("GLM 5.3", "z-ai/glm-5.3", true),
  NV("Qwen3.5 397B", "qwen/qwen3.5-397b-a17b", true),
  NV("Qwen3.5 122B", "qwen/qwen3.5-122b-a10b", true),
  NV("MiniMax M3", "minimaxai/minimax-m3", true),
  // NVIDIA — modèles légers
  NV("Step 3.7 Flash", "stepfun-ai/step-3.7-flash", false),
  NV("Nemotron 3.5 Lightning 30B", "nvidia/nemotron-3.5-lightning-30b-a3b", false),
  NV("Nemotron 3 Nano 30B", "nvidia/nemotron-3-nano-30b-a3b", false),
  NV("Llama 4 Maverick 17B", "meta/llama-4-maverick-17b-128e-instruct", false),
  NV("Llama 3.1 8B", "meta/llama-3.1-8b-instruct", false),
  NV("Gemma 4 31B", "google/gemma-4-31b-it", false),
  NV("GPT-OSS 120B", "openai/gpt-oss-120b", false),
  NV("GPT-OSS 20B", "openai/gpt-oss-20b", false),
  NV("Phi-4 Mini", "microsoft/phi-4-mini-instruct", false),
  NV("Granite 3.3 8B", "ibm/granite-3.3-8b-instruct", false),
  NV("Jamba 1.5 Mini", "ai21labs/jamba-1.5-mini-instruct", false),
  // Gemini
  GE("Gemini 3.8 Flash", "gemini-3.8-flash", true),
  GE("Gemini 3.7 Flash", "gemini-3.7-flash", true),
  GE("Gemini 2.5 Flash", "gemini-2.5-flash", true),
  GE("Gemini 2.5 Flash-Lite", "gemini-2.5-flash-lite", false),
  // Groq
  GQ("GPT-OSS 120B", "openai/gpt-oss-120b", true),
  GQ("GPT-OSS 20B", "openai/gpt-oss-20b", false),
  // Mistral
  MI("Mistral Large", "mistral-large-latest", true),
  MI("Mistral Medium 3.5", "mistral-medium-2508", true),
  MI("Mistral Small", "mistral-small-latest", false),
  MI("Mistral Codestral", "codestral-latest", false),
  MI("Mistral 7B", "open-mistral-7b", false),
  MI("Mixtral 8x7B", "open-mixtral-8x7b", false),
  MI("Mistral Nemo", "open-mistral-nemo", false),
  // OpenRouter (gratuit)
  OR("Qwen3.6 Plus", "qwen/qwen3.6-plus:free", true),
  OR("Qwen3 Coder 480B", "qwen/qwen3-coder:free", false),
  OR("MiniMax M2.5", "minimax/minimax-m2.5:free", true),
  OR("Llama 3.3 70B", "meta-llama/llama-3.3-70b-instruct:free", false),
  OR("Nemotron 3 Super", "nvidia/nemotron-3-super-120b-a12b:free", true),
  OR("GPT-OSS 120B", "openai/gpt-oss-120b:free", false),
  // Hugging Face
  HF("Qwen3.8 27B", "Qwen/Qwen3.8-27B", true),
  HF("GLM-5.3-Flash", "zai-org/GLM-5.3-Flash", false),
  HF("GPT-OSS 120B", "openai/gpt-oss-120b", false),
];

// ---------------------------------------------------------------- CLÉS / PAUSES
function keysOf(env: string): string[] {
  const names = [env, ...Array.from({ length: 8 }, (_, i) => `${env}_${i + 2}`)];
  return [...new Set(names.map((n) => Deno.env.get(n)?.trim()).filter((v): v is string => Boolean(v)))];
}

// Deux niveaux de pause : "clé" (toute la clé est refusée : 401/402/403)
// ou "modèle" (429, 404, délai dépassé, 5xx : seul ce modèle est mis de côté).
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

// ---------------------------------------------------------------- APPEL FOURNISSEUR
async function call(p: Provider, key: string, messages: Message[], maxTokens: number, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...p.extra },
      body: JSON.stringify({ model: modelFor(p), messages, max_tokens: maxTokens, temperature: 0.3, stream: false }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const s = res.status;
      if (s === 401 || s === 402 || s === 403) pause(keyScope(p, key), 5 * 60_000);   // toute la clé
      else if (s === 429) pause(modelScope(p, key), 60_000);
      else if (s === 404 || s === 400 || s === 422) pause(modelScope(p, key), 30 * 60_000); // modèle inexistant / refusé
      else if (s >= 500) pause(modelScope(p, key), 30_000);
      throw new Error(`HTTP ${s}: ${body || "erreur fournisseur"}`);
    }
    const out = extractText((await res.json())?.choices?.[0]?.message?.content);
    if (!out) throw new Error("Réponse vide.");
    return out;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      pause(modelScope(p, key), 2 * 60_000);
      throw new Error("Délai d'attente dépassé.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- RELECTURE (modèles légers)
async function refine(p: Provider, key: string, messages: Message[], draft: string, maxTokens: number, left: number): Promise<string> {
  if (left < 45_000) return draft;   // pas assez de temps : on garde le brouillon
  try {
    const q = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const critique = await call(p, key, [
      { role: "system", content: "Tu es un relecteur exigeant. Repère les erreurs factuelles, oublis, contradictions et fautes de langue. N'invente pas de faits. Si la réponse est satisfaisante, réponds uniquement OK." },
      { role: "user", content: `Question :\n${q}\n\nRéponse à vérifier :\n${draft}` },
    ], 500, 20_000);
    if (/^\s*OK\b/i.test(critique)) return draft;
    const improved = await call(p, key, [
      ...messages,
      { role: "assistant", content: draft },
      { role: "user", content: `Améliore ta réponse en tenant compte des observations suivantes :\n${critique}\n\nFournis directement la version finale, dans la même langue. Ne présente pas comme vérifié ce qui ne l'est pas.` },
    ], maxTokens, 30_000);
    return improved.length > 20 ? improved : draft;
  } catch {
    return draft;
  }
}

// ---------------------------------------------------------------- LIMITES
const hits = new Map<string, number[]>();
function rateLimited(id: string, max: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) {   // nettoyage : évite de saturer la mémoire
    for (const [k, v] of hits) if (!v.some((x) => now - x < RATE_WINDOW_MS)) hits.delete(k);
    if (hits.size > 5000) hits.clear();
  }
  const list = (hits.get(id) ?? []).filter((x) => now - x < RATE_WINDOW_MS);
  list.push(now);
  hits.set(id, list);
  return list.length > max;
}
// cf-connecting-ip est posé par l'infrastructure ; le début de x-forwarded-for peut être falsifié par le client.
function ipOf(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || xff[xff.length - 1] || "unknown";
}

// ---------------------------------------------------------------- AUTHENTIFICATION
type Who =
  | { kind: "user"; userId: string; isAdmin: boolean }
  | { kind: "guest"; ip: string }
  | { kind: "forbidden" }
  | { kind: "invalid" };

// Clé anon (ancienne clé JWT « anon » ou nouvelle clé « sb_publishable_… »).
function isAnonToken(token: string): boolean {
  const known = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    ...(Deno.env.get("GUEST_KEYS") ?? "").split(","),
  ].map((v) => v?.trim()).filter(Boolean);
  if (known.includes(token)) return true;
  if (token.startsWith("sb_publishable_")) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "anon";   // le rôle « anon » n'ouvre que le mode invité
  } catch {
    return false;
  }
}

async function identify(req: Request, authHeader: string | null): Promise<Who> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { kind: "invalid" };
  if (isAnonToken(token)) return { kind: "guest", ip: ipOf(req) };

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "https://cbaepeugbemwmclgfnxz.supabase.co";
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const supa = createClient(url, key || token, { global: { headers: { Authorization: authHeader! } } });
    const { data: { user } } = await supa.auth.getUser(token);
    if (!user) return { kind: "invalid" };

    // Même logique que l'application : whoami() (propriétaire), puis user_roles, puis user_entreprises.
    const roles: string[] = [];
    try {
      const { data: w } = await supa.rpc("whoami");
      if (w?.role) roles.push(String(w.role));
      if (w?.is_platform_owner === true) roles.push("super_owner");
    } catch (_) { /* whoami absente : on continue */ }
    const { data: rr } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    (rr ?? []).forEach((r: { role: string }) => roles.push(r.role));
    try {
      const { data: er } = await supa.from("user_entreprises").select("role").eq("user_id", user.id);
      (er ?? []).forEach((r: { role: string }) => roles.push(r.role));
    } catch (_) { /* table absente : on continue */ }

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
    // ----- 1. Qui appelle ?
    const who = await identify(req, req.headers.get("Authorization"));
    if (who.kind === "invalid") return json(req, { error: "Non authentifié." }, 401);
    if (who.kind === "forbidden") return json(req, { error: "Accès non autorisé." }, 403);

    const isGuest = who.kind === "guest";
    const isAdmin = who.kind === "user" && who.isAdmin;
    if (who.kind === "user" && !isAdmin && rateLimited(`u:${who.userId}`, RATE_MAX_USER)) {
      return json(req, { error: "Trop de demandes. Réessayez dans quelques minutes." }, 429);
    }
    if (who.kind === "guest" && (rateLimited(`g:${who.ip}`, RATE_MAX_GUEST) || rateLimited("g:*", GUEST_GLOBAL_MAX))) {
      return json(req, { error: "Trop de demandes. Réessayez dans quelques minutes." }, 429);
    }

    // ----- 2. Entrées
    if (Number(req.headers.get("content-length") ?? "0") > 1_000_000) {
      return json(req, { error: "La requête dépasse la taille maximale autorisée." }, 413);
    }
    const body = await req.json();
    const { messages = [], user_first = "", client_hour, max_tokens = 4000, lang = "fr" } = body;
    const context = isGuest ? "" : String(body?.context ?? "");   // jamais de données d'entreprise pour un invité
    const raw = isAdmin && body.raw === true;                     // mode « brut » réservé aux admins
    const en = lang === "en";

    if (!Array.isArray(messages) || messages.length === 0) return json(req, { error: "Le tableau messages est obligatoire." }, 400);
    if (messages.length > 40) return json(req, { error: "Trop de messages dans la requête." }, 400);

    const valid = new Set(["system", "user", "assistant"]);
    let normalized: Message[] = [];
    for (const m of messages) {
      if (!m || typeof m !== "object" || !valid.has(m.role) || typeof m.content !== "string") {
        return json(req, { error: "Format de message invalide." }, 400);
      }
      if (m.content.length > 100_000) return json(req, { error: "Un message dépasse la taille autorisée." }, 400);
      normalized.push({ role: m.role, content: m.content });
    }
    if (isGuest) {   // invité : pas de consigne système imposée par le client, historique et taille réduits
      normalized = normalized.filter((m) => m.role !== "system").slice(-4)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    }
    if (!normalized.some((m) => m.role === "user")) return json(req, { error: "Message vide." }, 400);

    const reqTokens = Number(max_tokens);
    const cap = isGuest ? 800 : 8000;
    const max = Number.isFinite(reqTokens) ? Math.max(100, Math.min(Math.floor(reqTokens), cap)) : Math.min(4000, cap);

    // ----- 3. Salutation personnalisée
    const h = Number(client_hour);
    const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? Math.floor(h) : (new Date().getUTCHours() + 1) % 24; // repli : Cameroun (UTC+1)
    const salutation = salutationFor(hour, en);
    const nom = cleanName(user_first);
    const isFirstTurn = normalized.filter((m) => m.role === "user").length === 1;

    const system: Message = {
      role: "system",
      content:
        (en
          ? "Answer in English. "
          : "Réponds dans la langue utilisée par l'utilisateur dans son dernier message (français par défaut). ") +
        "Tu es l'assistant RH de la plateforme. Réponds clairement et n'invente pas d'informations. " +
        "Pour les questions de droit du travail, distingue les faits vérifiés des points qui nécessitent une vérification. " +
        (isGuest
          ? "Mode démonstration : tu présentes la plateforme RH et réponds uniquement aux questions de ressources humaines, de paie, de droit du travail camerounais et de fonctionnement de la plateforme ; pour tout autre sujet, décline poliment en une phrase. "
          : "") +
        (isFirstTurn
          ? "NE METS PAS de salutation ni de présentation au début de ta réponse (elle est ajoutée automatiquement) : commence directement par la réponse. "
          : "Suite de conversation : réponds directement, sans salutation. ") +
        (nom ? `Prénom de l'utilisateur : ${nom}. ` : "") +
        context.slice(0, 20_000),
    };
    const finalMessages = raw ? normalized : [system, ...normalized];

    // ----- 4. Cascade avec échéance globale
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const diagnostics: { provider: string; problem: string }[] = [];

    for (const p of PROVIDERS) {
      const keys = keysOf(p.env);
      if (!keys.length) { diagnostics.push({ provider: p.name, problem: `Secret ${p.env} absent.` }); continue; }

      for (const key of keys) {
        const left = deadline - Date.now();
        if (left < 3000) break;
        if (paused(keyScope(p, key)) || paused(modelScope(p, key))) {
          diagnostics.push({ provider: p.name, problem: "En pause (quota, clé ou modèle refusé)." });
          continue;
        }
        try {
          let answer = await call(p, key, finalMessages, max, Math.min(DEFAULT_TIMEOUT_MS, left));
          if (!p.strong && !raw && !isGuest) answer = await refine(p, key, finalMessages, answer, max, deadline - Date.now());

          let text = answer;
          if (isFirstTurn && !raw) {
            const hello = nom ? `${salutation} ${nom} !` : `${salutation} !`;
            const cleaned = stripLeadingGreeting(answer);
            text = cleaned ? `${hello}\n\n${cleaned}` : hello;
          }
          // Le nom du moteur n'est renvoyé qu'aux administrateurs (jamais aux invités).
          return json(req, isAdmin ? { text, provider: p.name } : { text });
        } catch (e) {
          diagnostics.push({ provider: p.name, problem: (e instanceof Error ? e.message : "Erreur inconnue").slice(0, 180) });
        }
      }
      if (deadline - Date.now() < 3000) break;
    }

    console.error("ai-chat : aucun fournisseur disponible", JSON.stringify(diagnostics));
    return json(req, {
      error: "Aucun fournisseur IA disponible pour le moment. Réessayez dans quelques minutes.",
      ...(isAdmin ? { details: diagnostics.slice(-12) } : {}),
    }, 503);
  } catch (e) {
    console.error("ai-chat : erreur de traitement", e);
    return json(req, { error: "Impossible de traiter la demande. Vérifiez le format de la requête." }, 500);
  }
});
