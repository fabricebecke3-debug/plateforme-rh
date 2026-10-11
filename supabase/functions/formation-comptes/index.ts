// Edge Function "ai-chat" — cascade multi-fournisseurs gratuits, du plus puissant au plus léger.
// Clés = Supabase Secrets (jamais dans le code). Plusieurs clés par fournisseur possibles : GROQ_API_KEY, GROQ_API_KEY_2, ...
// Entrée : {messages, context, user_first, max_tokens, raw, lang}  Sortie : {text, provider}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };

type P = { name: string; url: string; env: string; model: string; strong: boolean; extra?: Record<string,string> };
// Ordre = priorité. strong=true : réponse envoyée telle quelle. strong=false : brouillon -> critique -> version améliorée.
const PROVIDERS: P[] = [
  { name: "Gemini 2.5 Pro",       url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", env: "GEMINI_API_KEY",     model: "gemini-2.5-pro",   strong: true },
  { name: "Gemini 2.5 Flash",     url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", env: "GEMINI_API_KEY",     model: "gemini-2.5-flash", strong: true },
  { name: "Groq Llama 3.3 70B",   url: "https://api.groq.com/openai/v1/chat/completions",                          env: "GROQ_API_KEY",       model: "llama-3.3-70b-versatile", strong: true },
  { name: "Cerebras Llama 3.3 70B", url: "https://api.cerebras.ai/v1/chat/completions",                            env: "CEREBRAS_API_KEY",   model: "llama-3.3-70b",    strong: true },
  { name: "SambaNova Llama 3.3 70B", url: "https://api.sambanova.ai/v1/chat/completions",                          env: "SAMBANOVA_API_KEY",  model: "Meta-Llama-3.3-70B-Instruct", strong: true },
  { name: "Mistral Large",        url: "https://api.mistral.ai/v1/chat/completions",                               env: "MISTRAL_API_KEY",    model: "mistral-large-latest", strong: true },
  { name: "GitHub Models GPT-4.1", url: "https://models.github.ai/inference/chat/completions",                     env: "GITHUB_TOKEN_AI",    model: "openai/gpt-4.1",   strong: true },
  { name: "OpenRouter (free)",    url: "https://openrouter.ai/api/v1/chat/completions",                            env: "OPENROUTER_API_KEY", model: "deepseek/deepseek-chat-v3-0324:free", strong: false },
  { name: "OpenRouter Llama (free)", url: "https://openrouter.ai/api/v1/chat/completions",                         env: "OPENROUTER_API_KEY", model: "meta-llama/llama-3.3-70b-instruct:free", strong: false },
  { name: "Groq Llama 3.1 8B",    url: "https://api.groq.com/openai/v1/chat/completions",                          env: "GROQ_API_KEY",       model: "llama-3.1-8b-instant", strong: false },
  { name: "Mistral Small",        url: "https://api.mistral.ai/v1/chat/completions",                               env: "MISTRAL_API_KEY",    model: "mistral-small-latest", strong: false },
  { name: "HuggingFace",          url: "https://router.huggingface.co/v1/chat/completions",                        env: "HF_API_KEY",         model: "meta-llama/Llama-3.3-70B-Instruct", strong: false },
];

// Toutes les clés d'un fournisseur : NOM, NOM_2, NOM_3...
const keysOf = (env: string) => { const k: string[] = []; for (const n of [env, ...Array.from({ length: 8 }, (_, i) => `${env}_${i + 2}`)]) { const v = Deno.env.get(n); if (v) k.push(v); } return k; };
const cool = new Map<string, number>(); // clé -> timestamp de fin de pause (quota)

async function call(p: P, key: string, messages: any[], max: number, timeoutMs = 45000): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(p.url, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: p.model, messages, max_tokens: max, temperature: 0.4 }) });
    if (!r.ok) { const b = (await r.text()).slice(0, 200); if (r.status === 429 || r.status === 402 || r.status === 403) cool.set(key, Date.now() + 60000); throw new Error(`HTTP ${r.status} ${b}`); }
    const j = await r.json(); const txt = j?.choices?.[0]?.message?.content?.trim();
    if (!txt) throw new Error("réponse vide"); return txt;
  } finally { clearTimeout(t); }
}

// Auto-relecture pour les modèles plus légers : critique puis réécriture.
async function refine(p: P, key: string, messages: any[], draft: string, max: number): Promise<string> {
  try {
    const q = messages.filter(m => m.role !== "system").slice(-1)[0]?.content ?? "";
    const crit = await call(p, key, [
      { role: "system", content: "Tu es un relecteur exigeant. Liste brièvement (puces) les erreurs, oublis, passages vagues ou inventés, et fautes de langue de la réponse. Si elle est parfaite, réponds OK." },
      { role: "user", content: `Question :\n${q}\n\nRéponse à vérifier :\n${draft}` }], 700, 25000);
    if (/^\s*ok\b/i.test(crit)) return draft;
    const better = await call(p, key, [
      ...messages,
      { role: "assistant", content: draft },
      { role: "user", content: `Relecture critique de ta réponse :\n${crit}\n\nRéécris maintenant la réponse finale corrigée et améliorée, complète, sans mentionner cette relecture.` }], max, 40000);
    return better.length > 20 ? better : draft;
  } catch { return draft; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { messages = [], context = "", user_first = "", max_tokens = 4000, raw = false, lang = "fr" } = await req.json();
    const sys = raw ? [] : [{ role: "system", content: `${lang === "en" ? "Answer in English." : "Réponds en français."} Tu es l'assistant RH de la plateforme. ${user_first ? "Utilisateur : " + user_first + "." : ""} ${context}` }];
    const msgs = [...sys, ...messages];
    const max = Math.min(Number(max_tokens) || 4000, 8000);
    const details: { provider: string; problem: string }[] = [];
    for (const p of PROVIDERS) {
      const keys = keysOf(p.env);
      if (!keys.length) { details.push({ provider: p.name, problem: `clé ${p.env} absente` }); continue; }
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
