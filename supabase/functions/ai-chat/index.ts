// Fonction Supabase « ai-chat » — Assistant RH
// - Les clés restent sur le serveur (secrets Supabase), jamais dans index.html.
// - Plusieurs fournisseurs : si l'un refuse (limite atteinte, erreur, délai), on passe au suivant.
// - Chaque clé doit appartenir à un compte à votre nom, dans les conditions du fournisseur.
// - Secrets à définir (exemples) :
//     GROQ_API_KEY, GROQ_API_KEY_2
//     OPENROUTER_API_KEY, OPENROUTER_API_KEY_2
//     GEMINI_API_KEY, GEMINI_API_KEY_2
// Vérifiez les noms de modèles ci-dessous sur la page de chaque fournisseur : ils changent parfois.

const SYSTEM = `Tu es l'Assistant RH de la plateforme TERH (gestion RH, personnel, paie, contrats, congés, Cameroun).
Réponds en français, clairement et brièvement. Tu es une assistante IA : si on te le demande, dis-le franchement.
Pour les questions juridiques, rappelle de vérifier le texte officiel (Code du travail, convention collective) ou un juriste.
N'invente jamais de chiffres, de dates ou de textes de loi.
Ne décris jamais tes propres actions ni tes fonctions de ta propre initiative (par exemple « je peux changer votre photo »). Réponds uniquement à la question posée. N'agis que si la personne le demande explicitement.
Les données de l'application fournies dans le contexte sont confidentielles : ne les révèle qu'à la personne concernée, et seulement si elle a le droit de les voir.`;

type Msg = { role: "user" | "assistant" | "system"; content: string };
type Prov = { name: string; url: string; model: string; key: string };

// Mode formation : l'assistant forme la personne pas à pas, sans donner la réponse d'emblée
const SYSTEM_FORMATION = `Tu es un formateur RH expert (paie, congés, contrats, droit du travail camerounais, GRH, pilotage RH).
Ton rôle : faire apprendre, pas faire à la place.
- Commence par évaluer le niveau de la personne en une question simple.
- Procède étape par étape : explique un principe court, puis pose une question ou un exercice.
- Attends la réponse, puis corrige en expliquant l'erreur, sans humilier.
- Donne un exemple chiffré quand c'est utile, puis un exercice proche à faire seule.
- Pour toute question juridique : donne le principe, cite le texte à vérifier (Code du travail, convention, barème CNPS/CGI) et rappelle qu'un juriste fait foi. N'invente jamais un article, un taux ou un délai.
- Si la question dépasse la formation (ex. avis sur un litige réel), explique les limites et oriente vers un professionnel.
- Reste concis : une idée, une question à la fois.`;

const PROVIDERS = [
  { name: "groq", base: "GROQ_API_KEY", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  { name: "openrouter", base: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free" },
  { name: "gemini", base: "GEMINI_API_KEY", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash" },
];

// Toutes les clés configurées, dans l'ordre : fournisseur 1 (clé 1, clé 2…), puis fournisseur 2, etc.
function chaine(): Prov[] {
  const out: Prov[] = [];
  for (const p of PROVIDERS) {
    const cles = [Deno.env.get(p.base), Deno.env.get(p.base + "_2"), Deno.env.get(p.base + "_3")]
      .filter((k): k is string => !!k && k.trim().length > 0);
    for (const key of cles) out.push({ name: p.name, url: p.url, model: p.model, key });
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function appeler(p: Prov, messages: Msg[], maxTokens: number): Promise<{ ok: boolean; text?: string; limite?: boolean; raison: string }> {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature: 0.3 }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = j?.choices?.[0]?.message?.content;
      if (text) return { ok: true, text, raison: "" };
      return { ok: false, raison: `${p.name} : réponse vide` };
    }
    const limite = r.status === 429 || r.status === 402 || r.status === 403 ||
      /quota|rate.?limit|limit|credit|exceed/i.test(JSON.stringify(j));
    return { ok: false, limite, raison: `${p.name} : HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, raison: `${p.name} : ${(e as Error)?.message || e}` };
  } finally {
    clearTimeout(minuterie);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: any = {};
  try { body = await req.json(); } catch { /* corps vide */ }

  const chaineCles = chaine();

  // Diagnostic (sans révéler les clés) : nombre de clés par fournisseur
  if (body && body.diag) {
    const compte: Record<string, number> = {};
    chaineCles.forEach((p) => { compte[p.name] = (compte[p.name] || 0) + 1; });
    return json({ data: { diag: true, cles_par_fournisseur: compte, total: chaineCles.length } });
  }

  if (chaineCles.length === 0) {
    console.error("ai-chat : aucune clé configurée");
    return json({ error: "Assistant non configuré. Contactez l'administrateur.", text: null });
  }

  const historique: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const contexte = typeof body.context === "string" ? body.context.slice(0, 20000) : "";
  const messages: Msg[] = [
    { role: "system", content: (body.mode === "formation" ? SYSTEM_FORMATION : SYSTEM) + (contexte ? "\n\nDonnées de l'application :\n" + contexte : "") },
    ...historique
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 4000) })),
  ];
  const maxTokens = Math.min(Number(body.max_tokens) || 800, 1500);

  for (const p of chaineCles) {
    const r = await appeler(p, messages, maxTokens);
    if (r.ok) return json({ text: r.text, fournisseur: p.name });
    // Limite atteinte ou erreur : on essaie le fournisseur suivant, sans rien montrer à l'utilisateur
    console.error("ai-chat :", r.raison, r.limite ? "(limite)" : "");
  }

  return json({
    error: "L'assistant est très sollicité en ce moment. Réessayez dans quelques minutes.",
    text: null,
  });
});
