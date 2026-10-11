// Edge Function "ai-chat" — UNIQUEMENT des modèles open source (poids ouverts) sur offres GRATUITES.
// Du plus puissant au plus léger ; repli automatique (quota, erreur, délai). Les modèles légers relisent et améliorent leur réponse.
// Clés = Supabase Secrets. Plusieurs clés par fournisseur : NOM, NOM_2, NOM_3 … (rotation automatique au quota).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };

type P = { name: string; url: string; env: string; model: string; strong: boolean };
const OA = (u: string) => u + "/chat/completions";
// strong = grand modèle (≥ 70B) : réponse envoyée directement. Sinon : brouillon → critique → version améliorée.
const STATIC: P[] = [
  { name: "gpt-oss-120b (Cerebras)",  url: OA("https://api.cerebras.ai/v1"),        env: "CEREBRAS_API_KEY",  model: "gpt-oss-120b", strong: true },
  { name: "gpt-oss-120b (Groq)",      url: OA("https://api.groq.com/openai/v1"),    env: "GROQ_API_KEY",      model: "openai/gpt-oss-120b", strong: true },
  { name: "DeepSeek (SambaNova)",     url: OA("https://api.sambanova.ai/v1"),       env: "SAMBANOVA_API_KEY", model: "DeepSeek-V3-0324", strong: true },
  { name: "Llama 3.3 70B (Groq)",     url: OA("https://api.groq.com/openai/v1"),    env: "GROQ_API_KEY",      model: "llama-3.3-70b-versatile", strong: true },
  { name: "Llama 3.3 70B (SambaNova)", url: OA("https://api.sambanova.ai/v1"),      env: "SAMBANOVA_API_KEY", model: "Meta-Llama-3.3-70B-Instruct", strong: true },
  { name: "Llama 3.3 70B (NVIDIA)",   url: OA("https://integrate.api.nvidia.com/v1"), env: "NVIDIA_API_KEY", model: "meta/llama-3.3-70b-instruct", strong: true },
  { name: "Llama 3.3 70B (GitHub)",   url: OA("https://models.github.ai/inference"), env: "GITHUB_TOKEN_AI",  model: "meta/Llama-3.3-70B-Instruct", strong: true },
];
const LIGHT: P[] = [
  { name: "gpt-oss-20b (Groq)",       url: OA("https://api.groq.com/openai/v1"),    env: "GROQ_API_KEY",      model: "openai/gpt-oss-20b", strong: false },
  { name: "Mistral Small (open)",     url: OA("https://api.mistral.ai/v1"),         env: "MISTRAL_API_KEY",   model: "mistral-small-latest", strong: false },
  { name: "Llama 3.1 8B (Groq)",      url: OA("https://api.groq.com/openai/v1"),    env: "GROQ_API_KEY",      model: "llama-3.1-8b-instant", strong: false },
  { name: "Llama 3.3 70B (Hugging Face)", url: OA("https://router.huggingface.co/v1"), env: "HF_API_KEY",     model: "meta-llama/Llama-3.3-70B-Instruct", strong: false },
];
const OPEN_RE = /llama|qwen|deepseek|gpt-oss|gemma|mistral|glm|kimi|nemotron|phi-|olmo/i;

// OpenRouter : on découvre à chaque démarrage les modèles ":free" open source (la liste change souvent).
let orCache: { t: number; list: P[] } = { t: 0, list: [] };
async function openrouterFree(): Promise<P[]> {
  if (!keysOf("OPENROUTER_API_KEY").length) return [];
  if (Date.now() - orCache.t < 3600_000) return orCache.list;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const ids: { id: string; ctx: number }[] = (j.data || []).filter((m: any) => String(m.id).endsWith(":free") && OPEN_RE.test(m.id)).map((m: any) => ({ id: m.id, ctx: m.context_length || 0 }));
    ids.sort((a, b) => (/\b(120b|235b|70b|72b|671b|405b)/i.test(b.id) ? 1 : 0) - (/\b(120b|235b|70b|72b|671b|405b)/i.test(a.id) ? 1 : 0) || b.ctx - a.ctx);
    orCache = { t: Date.now(), list: ids.slice(0, 6).map(m => ({ name: m.id, url: OA("https://openrouter.ai/api/v1"), env: "OPENROUTER_API_KEY", model: m.id, strong: /\b(120b|235b|70b|72b|671b|405b)/i.test(m.id) })) };
  } catch { /* garde le cache */ }
  return orCache.list;
}

const keysOf = (env: string) => { const k: string[] = []; for (const n of [env, ...Array.from({ length: 8 }, (_, i) => `${env}_${i + 2}`)]) { const v = Deno.env.get(n); if (v) k.push(v); } return k; };
const cool = new Map<string, number>();       // clé -> fin de pause (quota)
const deadModel = new Map<string, number>();  // fournisseur|modèle -> fin de pause (404 / modèle retiré)

async function call(p: P, key: string, messages: any[], max: number, timeoutMs = 40000): Promise<string> {
  const r = await fetch(p.url, { method: "POST", signal: AbortSignal.timeout(timeoutMs), headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: p.model, messages, max_tokens: max, temperature: 0.4 }) });
  if (!r.ok) {
    const b = (await r.text()).slice(0, 200);
    if ([429, 402, 403, 401].includes(r.status)) cool.set(key, Date.now() + (r.status === 429 ? 60_000 : 600_000));
    if (r.status === 404 || r.status === 400) deadModel.set(p.env + "|" + p.model, Date.now() + 3600_000);
    throw new Error(`HTTP ${r.status} ${b}`);
  }
  const j = await r.json(); const txt = (j?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!txt) throw new Error("réponse vide"); return txt;
}

async function refine(p: P, key: string, messages: any[], draft: string, max: number): Promise<string> {
  try {
    const q = messages.filter(m => m.role === "user").slice(-1)[0]?.content ?? "";
    const crit = await call(p, key, [
      { role: "system", content: "Tu es un relecteur exigeant. Liste brièvement (puces) les erreurs, oublis, passages vagues ou inventés, questions de clarification inutiles et fautes de langue. Si la réponse est parfaite, réponds seulement OK." },
      { role: "user", content: `Question :\n${q}\n\nRéponse à vérifier :\n${draft}` }], 600, 20000);
    if (/^\s*ok\b/i.test(crit)) return draft;
    const better = await call(p, key, [...messages, { role: "assistant", content: draft },
      { role: "user", content: `Relecture critique de ta réponse :\n${crit}\n\nRéécris la réponse finale corrigée et améliorée, complète et directe, sans mentionner cette relecture.` }], max, 35000);
    return better.length > 20 ? better : draft;
  } catch { return draft; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const all = [...STATIC, ...(await openrouterFree()), ...LIGHT];
    if (body.diag) {
      const envs = [...new Set([...all.map(p => p.env), "OPENROUTER_API_KEY"])];
      return new Response(JSON.stringify({ secrets: envs.map(env => ({ env, keys: keysOf(env).length })), models_usable: all.filter(p => keysOf(p.env).length).length }), { headers: CORS });
    }
    const { messages = [], context = "", user_first = "", max_tokens = 4000, raw = false, lang = "fr" } = body;
    const sys = raw ? [] : [{ role: "system", content: `${lang === "en" ? "Answer in English." : "Réponds en français."} Tu es l'assistant RH de la plateforme.${user_first ? " Utilisateur : " + user_first + "." : ""} Réponds directement et complètement, sans poser de question de clarification inutile. ${context}` }];
    const msgs = [...sys, ...messages];
    const max = Math.min(Number(max_tokens) || 4000, 8000);
    const details: { provider: string; problem: string }[] = [];
    for (const p of all) {
      const keys = keysOf(p.env);
      if (!keys.length) { if (!details.some(d => d.provider === p.env)) details.push({ provider: p.env, problem: "clé absente" }); continue; }
      if ((deadModel.get(p.env + "|" + p.model) ?? 0) > Date.now()) continue;
      for (const k of keys) {
        if ((cool.get(k) ?? 0) > Date.now()) { details.push({ provider: p.name, problem: "quota atteint (pause)" }); continue; }
        try {
          let text = await call(p, k, msgs, max);
          if (!p.strong && !raw) text = await refine(p, k, msgs, text, max);
          return new Response(JSON.stringify({ text, provider: p.name + (p.strong ? "" : " + relecture") }), { headers: CORS });
        } catch (e) { details.push({ provider: p.name, problem: String((e as Error).message).slice(0, 160) }); }
      }
    }
    return new Response(JSON.stringify({ error: "Aucun fournisseur IA disponible", details }), { status: 503, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: CORS });
  }
});
