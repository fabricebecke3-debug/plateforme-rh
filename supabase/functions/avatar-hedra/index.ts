// Fonction Supabase « avatar-hedra » — Assistant RH : votre image + votre voix → vidéo parlante avec gestes (Hedra)
// Réservée au propriétaire. Secrets :
//   HEDRA_API_KEY   : clé Hedra (compte à votre nom)
//   HEDRA_MODEL_ID  : (facultatif) identifiant du modèle. Par défaut : Hedra Avatar.
//                     Pour des gestes du corps plus marqués, Hedra Omnia : son identifiant est sur la page
//                     « API » de Hedra (à copier dans ce secret).
// Actions :
//   setup_voice { path }  : clone votre voix à partir de votre enregistrement (avatars/<id>/source/voix.webm)
//   speak { text }        : fabrique la voix (texte → audio), puis la vidéo ; renvoie generation_id
//   status { id }         : état de la vidéo ; renvoie url quand elle est prête

import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_UID = "6283a8a4-88e5-4006-ae21-0baa89d0ad96";
const OWNER_EMAIL = "fabricebecke3@gmail.com";
const HB = "https://api.hedra.com/web-app/public";
const MODEL = Deno.env.get("HEDRA_MODEL_ID") || "26f0fc66-152b-40ab-abed-76c43df99bc8";
const PROMPT = "Présentation naturelle et chaleureuse, expressions du visage vivantes, gestes ouverts des mains, regard vers la caméra.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function hb(path: string, key: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(HB + path, { ...init, headers: { "X-API-Key": key, ...((init.headers as Record<string, string>) || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Hedra ${path} : HTTP ${r.status}`);
  return j;
}

// Envoie un fichier du stockage vers Hedra et renvoie l'identifiant de l'élément
async function envoyer(admin: any, key: string, path: string, type: "audio" | "image", mime: string): Promise<string> {
  const { data: file, error } = await admin.storage.from("avatars").download(path);
  if (error || !file) throw new Error(type === "image" ? "Photo introuvable : ajoutez une photo avec 📷 Ma photo ou 🖼 Galerie dans l'assistant, puis réessayez." : "Voix introuvable : enregistrez votre voix avec 🎙 Ma voix.");
  const nom = path.split("/").pop() || "fichier";
  const a = await hb("/assets", key, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nom, type }),
  });
  const id = a.id || a.asset_id;
  const fd = new FormData();
  fd.append("file", new File([file], nom, { type: mime }));
  await hb(`/assets/${id}/upload`, key, { method: "POST", body: fd });
  return id;
}

async function attendre(key: string, id: string, ms: number): Promise<any> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await hb(`/generations/${id}/status`, key);
    if (s.status === "complete" || s.status === "completed") return s;
    if (s.status === "error" || s.status === "failed") throw new Error(s.error_message || "génération échouée");
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("délai dépassé côté Hedra");
}

async function lire(admin: any, cle: string): Promise<string | null> {
  const { data } = await admin.from("parametres").select("valeur").eq("cle", cle).is("entreprise_id", null).maybeSingle();
  return data?.valeur || null;
}
async function ecrire(admin: any, cle: string, valeur: string) {
  await admin.from("parametres").delete().eq("cle", cle).is("entreprise_id", null);
  await admin.from("parametres").insert({ cle, valeur, entreprise_id: null, updated_at: new Date().toISOString() });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");

    const userDb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return json({ error: "Connexion requise" }, 401);
    if (user.id !== OWNER_UID && (user.email || "").toLowerCase() !== OWNER_EMAIL) {
      return json({ error: "Réservé au propriétaire de la plateforme" }, 403);
    }

    const key = Deno.env.get("HEDRA_API_KEY");
    if (!key) return json({ error: "Service vidéo non configuré" }, 503);
    const admin = createClient(url, svc);
    const body = await req.json().catch(() => ({}));

    if (body.action === "setup_voice") {
      const path = String(body.path || `${OWNER_UID}/source/voix.webm`);
      const audio = await envoyer(admin, key, path, "audio", "audio/webm");
      const clone = await hb("/generations", key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "voice_clone", audio_id: audio, name: "Voix de l'Assistant RH" }),
      });
      const s = await attendre(key, clone.id, 120000);
      const voiceId = s.asset_id;
      if (!voiceId) throw new Error("clonage terminé sans identifiant de voix");
      await ecrire(admin, "hedra_voice", voiceId);
      return json({ ok: true, voice_id: voiceId });
    }

    if (body.action === "setup_image") {
      const path = String(body.path || `${OWNER_UID}/source/visage.jpg`);
      const mime = String(body.mime || "image/jpeg");
      const image = await envoyer(admin, key, path, "image", mime);
      await ecrire(admin, "hedra_image", image);
      return json({ ok: true, image_id: image });
    }

    if (body.action === "speak") {
      const text = String(body.text || "").trim().slice(0, 800);
      if (text.length < 2) return json({ error: "Texte vide" }, 400);
      const voice = await lire(admin, "hedra_voice");
      if (!voice) return json({ error: "Votre voix n'est pas encore enregistrée" }, 412);

      let image = await lire(admin, "hedra_image");
      if (!image) {
        // Photo dédiée à l'avatar si elle existe, sinon la photo de profil (sans la modifier)
        try { image = await envoyer(admin, key, `${OWNER_UID}/source/visage.jpg`, "image", "image/jpeg"); }
        catch { image = await envoyer(admin, key, `${OWNER_UID}/avatar.jpg`, "image", "image/jpeg"); }
        await ecrire(admin, "hedra_image", image);
      }

      // 1) texte → parole avec votre voix
      const tts = await hb("/generations", key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text_to_speech", voice_id: voice, text }),
      });
      const t = await attendre(key, tts.id, 90000);
      const audio = t.asset_id;

      // 2) image + parole → vidéo avec gestes
      const video = await hb("/generations", key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "video",
          ai_model_id: MODEL,
          start_keyframe_id: image,
          audio_id: audio,
          generated_video_inputs: { text_prompt: PROMPT, resolution: "720p", aspect_ratio: "9:16" },
        }),
      });
      return json({ generation_id: video.id });
    }

    if (body.action === "status") {
      const s = await hb(`/generations/${encodeURIComponent(String(body.id || ""))}/status`, key);
      let urlVideo = s.url || s.video_url || null;
      if (!urlVideo && s.asset_id && (s.status === "complete" || s.status === "completed")) {
        const a = await hb(`/assets/${s.asset_id}`, key).catch(() => ({}));
        urlVideo = a?.asset?.url || a?.url || null;
      }
      return json({ status: s.status || "inconnu", url: urlVideo, error: s.error_message || null });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("avatar-hedra :", (e as Error)?.message || e);
    return json({ error: (e as Error)?.message || "Erreur du service vidéo" }, 500);
  }
});
