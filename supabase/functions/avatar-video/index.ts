// Fonction Supabase « avatar-video » — vidéo parlante de l'Assistant RH (HeyGen)
// Réservée au propriétaire de la plateforme.
// Secrets à définir :
//   HEYGEN_API_KEY    : clé HeyGen (compte à votre nom)
//   HEYGEN_VOICE_ID   : identifiant d'une voix française (voir l'action « voices »)
// Les variables SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournies par Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_UID = "6283a8a4-88e5-4006-ae21-0baa89d0ad96";
const OWNER_EMAIL = "fabricebecke3@gmail.com";
const HG = "https://api.heygen.com";
const HG_UP = "https://upload.heygen.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Photo parlante : envoyée une seule fois à HeyGen, son identifiant est gardé dans la base
async function talkingPhotoId(admin: any, key: string): Promise<string> {
  const { data: row } = await admin.from("parametres").select("valeur")
    .eq("cle", "heygen_talking_photo").is("entreprise_id", null).maybeSingle();
  if (row?.valeur) return row.valeur;

  const { data: file, error } = await admin.storage.from("avatars").download(`${OWNER_UID}/avatar.jpg`);
  if (error || !file) throw new Error("Photo de profil introuvable : enregistrez d'abord votre photo.");

  const r = await fetch(`${HG_UP}/v1/talking_photo`, {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "image/jpeg" },
    body: file,
  });
  const j = await r.json().catch(() => ({}));
  const id = j?.data?.talking_photo_id;
  if (!r.ok || !id) throw new Error("Envoi de la photo à HeyGen refusé.");

  await admin.from("parametres").insert({ cle: "heygen_talking_photo", valeur: id, entreprise_id: null, updated_at: new Date().toISOString() });
  return id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");

    // Qui appelle ? Il faut être connecté et être le propriétaire
    const userDb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return json({ error: "Connexion requise" }, 401);
    if (user.id !== OWNER_UID && (user.email || "").toLowerCase() !== OWNER_EMAIL) {
      return json({ error: "Réservé au propriétaire de la plateforme" }, 403);
    }

    const key = Deno.env.get("HEYGEN_API_KEY");
    if (!key) return json({ error: "Service vidéo non configuré" }, 503);
    const admin = createClient(url, svc);
    const body = await req.json().catch(() => ({}));
    const api = (path: string) => ({ "X-Api-Key": key, "Content-Type": "application/json" });

    if (body.action === "voices") {
      const r = await fetch(`${HG}/v2/voices`, { headers: api("") });
      return json(await r.json().catch(() => ({})));
    }

    if (body.action === "status") {
      const r = await fetch(`${HG}/v1/video_status.get?video_id=${encodeURIComponent(String(body.video_id || ""))}`, { headers: api("") });
      const j = await r.json().catch(() => ({}));
      const d = j?.data || {};
      return json({ status: d.status || "inconnu", url: d.video_url || null, error: d.error || null });
    }

    if (body.action === "create") {
      const text = String(body.text || "").trim().slice(0, 1000);
      if (text.length < 2) return json({ error: "Texte vide" }, 400);
      const voice = Deno.env.get("HEYGEN_VOICE_ID");
      if (!voice) return json({ error: "Voix non configurée" }, 503);

      const tp = await talkingPhotoId(admin, key);
      const r = await fetch(`${HG}/v2/video/generate`, {
        method: "POST",
        headers: api(""),
        body: JSON.stringify({
          video_inputs: [{
            character: { type: "talking_photo", talking_photo_id: tp },
            voice: { type: "text", input_text: text, voice_id: voice },
          }],
          dimension: { width: 720, height: 720 },
        }),
      });
      const j = await r.json().catch(() => ({}));
      const id = j?.data?.video_id;
      if (!r.ok || !id) return json({ error: "Génération refusée par le service vidéo" }, 502);
      return json({ video_id: id });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("avatar-video :", (e as Error)?.message || e);
    return json({ error: "Erreur du service vidéo" }, 500);
  }
});
