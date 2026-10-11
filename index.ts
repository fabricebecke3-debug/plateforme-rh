// Fonction Supabase « formation-comptes » — gestion des comptes d'apprenants.
// Actions :
//   inviter   { email, nom, entreprise_id? } → envoie une invitation par e-mail. Sans entreprise_id : apprenant indépendant (propriétaire seulement).
//             Avec entreprise_id : propriétaire ou administrateur de cette société.
//   lister    { entreprise_id }               → liste des apprenants (propriétaire ou admin de la société)
//   suspendre { id } / reactiver { id }       → bloque ou rétablit l'accès (propriétaire ou admin de la société)
//   progres   { module, score, termine }      → enregistre la progression de l'apprenant connecté
// Secrets : fournis par Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
// Ne jamais exposer la clé « service role » dans le navigateur.

import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_UID = "6283a8a4-88e5-4006-ae21-0baa89d0ad96";
const OWNER_EMAIL = "fabricebecke3@gmail.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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
    const admin = createClient(url, svc);
    const body = await req.json().catch(() => ({}));

    // Droit : propriétaire, ou administrateur de la société concernée
    const estProprio = user.id === OWNER_UID || (user.email || "").toLowerCase() === OWNER_EMAIL;
    async function peutGerer(eid: string | null): Promise<boolean> {
      if (estProprio) return true;
      if (!eid) return false;
      const { data } = await admin.from("user_entreprises").select("role")
        .eq("user_id", user!.id).eq("entreprise_id", eid).maybeSingle();
      return data?.role === "admin";
    }

    if (body.action === "progres") {
      const module = String(body.module || "").slice(0, 80);
      if (!module) return json({ error: "Module manquant" }, 400);
      const score = body.score === undefined ? null : Number(body.score);
      const { error } = await admin.from("formation_progres").upsert({
        apprenant_user_id: user.id, module, score,
        termine: !!body.termine, mis_a_jour: new Date().toISOString(),
      }, { onConflict: "apprenant_user_id,module" });
      if (error) return json({ error: "Enregistrement impossible" }, 500);
      return json({ ok: true });
    }

    if (body.action === "inviter") {
      const email = String(body.email || "").trim().toLowerCase();
      const nom = String(body.nom || "").trim().slice(0, 120);
      const eid = body.entreprise_id ? String(body.entreprise_id) : null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || nom.length < 2) return json({ error: "E-mail ou nom invalide" }, 400);
      if (!(await peutGerer(eid))) return json({ error: "Droit insuffisant pour cette société" }, 403);
      const inv = await admin.auth.admin.inviteUserByEmail(email, { data: { role: "apprenant", nom } });
      if (inv.error) return json({ error: "Invitation impossible : " + inv.error.message }, 400);
      const { error } = await admin.from("formation_apprenants").insert({
        user_id: inv.data.user?.id || null, email, nom, entreprise_id: eid, statut: "invite", cree_par: user.id,
      });
      if (error) return json({ error: "Enregistrement de l'apprenant impossible" }, 500);
      return json({ ok: true });
    }

    if (body.action === "lister") {
      const eid = body.entreprise_id ? String(body.entreprise_id) : null;
      if (!(await peutGerer(eid))) return json({ error: "Droit insuffisant" }, 403);
      let q = admin.from("formation_apprenants").select("id,email,nom,statut,cree_le,entreprise_id").order("cree_le", { ascending: false });
      if (!estProprio) q = q.eq("entreprise_id", eid);
      const { data, error } = await q;
      if (error) return json({ error: "Lecture impossible" }, 500);
      return json({ data });
    }

    if (body.action === "suspendre" || body.action === "reactiver") {
      const { data: a } = await admin.from("formation_apprenants").select("id,user_id,entreprise_id").eq("id", body.id).maybeSingle();
      if (!a) return json({ error: "Apprenant introuvable" }, 404);
      if (!(await peutGerer(a.entreprise_id))) return json({ error: "Droit insuffisant" }, 403);
      const suspendu = body.action === "suspendre";
      if (a.user_id) {
        const r = await admin.auth.admin.updateUserById(a.user_id, { ban_duration: suspendu ? "876000h" : "none" });
        if (r.error) return json({ error: "Mise à jour du compte impossible" }, 400);
      }
      await admin.from("formation_apprenants").update({ statut: suspendu ? "suspendu" : "actif" }).eq("id", a.id);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("formation-comptes :", (e as Error)?.message || e);
    return json({ error: "Erreur du service de formation" }, 500);
  }
});
