import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://plateforme-rh.netlify.app")
  .split(",").map((s) => s.trim()).filter(Boolean);

/* ---------- CORS (tolérant : prod, previews Netlify, localhost) ---------- */
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  const ok =
    ORIGINS.includes(o) ||
    /^https:\/\/([a-z0-9-]+--)?plateforme-rh\.netlify\.app$/.test(o) ||
    /^http:\/\/localhost(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": req.headers.get("Access-Control-Request-Headers") ?? "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_ADMIN_RECIPIENTS = 20;
const DEFAULT_JOURS = 30; // même valeur par défaut que l'application (onglet Alertes)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (list: string[]) =>
  [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];

/* ---------- Envoi via un fournisseur ---------- */
type SendResult = { ok: boolean; status: number | string; provider: string; error?: string };
type Sender = (to: string, subject: string, html: string) => Promise<SendResult>;

const parseFrom = (from: string, fallbackName = "TERH Alertes") => {
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { name: m[1].trim() || fallbackName, email: m[2].trim() } : { name: fallbackName, email: from.trim() };
};

async function sendViaBrevo(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) return { ok: false, status: "no-key", provider: "brevo", error: "BREVO_API_KEY absente" };
  const sender = parseFrom(Deno.env.get("BREVO_FROM") || "TERH Alertes <fabricebecke3@gmail.com>");
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key, "Accept": "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
    });
    if (r.ok) return { ok: true, status: 200, provider: "brevo" };
    return { ok: false, status: r.status, provider: "brevo", error: (await r.text()).slice(0, 200) };
  } catch (e) {
    return { ok: false, status: "error", provider: "brevo", error: (e as Error).message };
  }
}

/* NOUVEAU : Mailjet (API v3.1). Secrets : MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM */
async function sendViaMailjet(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get("MAILJET_API_KEY"), secret = Deno.env.get("MAILJET_SECRET_KEY");
  if (!key || !secret) return { ok: false, status: "no-key", provider: "mailjet", error: "MAILJET_API_KEY / MAILJET_SECRET_KEY absente" };
  const f = parseFrom(Deno.env.get("MAILJET_FROM") || Deno.env.get("BREVO_FROM") || "TERH Alertes <fabricebecke3@gmail.com>");
  try {
    const r = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${key}:${secret}`) },
      body: JSON.stringify({ Messages: [{ From: { Email: f.email, Name: f.name }, To: [{ Email: to }], Subject: subject, HTMLPart: html }] }),
    });
    const txt = await r.text();
    if (r.ok) {
      let st = "success";
      try { st = JSON.parse(txt)?.Messages?.[0]?.Status ?? "success"; } catch { /* ignore */ }
      if (st === "success") return { ok: true, status: 200, provider: "mailjet" };
      return { ok: false, status: st, provider: "mailjet", error: txt.slice(0, 200) };
    }
    return { ok: false, status: r.status, provider: "mailjet", error: txt.slice(0, 200) };
  } catch (e) {
    return { ok: false, status: "error", provider: "mailjet", error: (e as Error).message };
  }
}

/* NOUVEAU : SMTP2GO (API v3). Secrets : SMTP2GO_API_KEY, SMTP2GO_FROM (adresse d'expéditeur vérifiée chez SMTP2GO) */
async function sendViaSmtp2go(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get("SMTP2GO_API_KEY");
  if (!key) return { ok: false, status: "no-key", provider: "smtp2go", error: "SMTP2GO_API_KEY absente" };
  const f = parseFrom(Deno.env.get("SMTP2GO_FROM") || Deno.env.get("BREVO_FROM") || "TERH Alertes <fabricebecke3@gmail.com>");
  try {
    const r = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": key, Accept: "application/json" },
      body: JSON.stringify({ sender: `${f.name} <${f.email}>`, to: [to], subject, html_body: html }),
    });
    const txt = await r.text();
    if (r.ok) {
      let ok = true;
      try { const d = JSON.parse(txt)?.data; if (d && typeof d.succeeded === "number") ok = d.succeeded > 0; } catch { /* ignore */ }
      if (ok) return { ok: true, status: 200, provider: "smtp2go" };
    }
    return { ok: false, status: r.status, provider: "smtp2go", error: txt.slice(0, 200) };
  } catch (e) {
    return { ok: false, status: "error", provider: "smtp2go", error: (e as Error).message };
  }
}

/* NOUVEAU : Postmark. Secrets : POSTMARK_SERVER_TOKEN, POSTMARK_FROM (adresse « Sender Signature » confirmée chez Postmark) */
async function sendViaPostmark(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get("POSTMARK_SERVER_TOKEN");
  if (!key) return { ok: false, status: "no-key", provider: "postmark", error: "POSTMARK_SERVER_TOKEN absente" };
  const f = parseFrom(Deno.env.get("POSTMARK_FROM") || Deno.env.get("BREVO_FROM") || "TERH Alertes <fabricebecke3@gmail.com>");
  try {
    const r = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Postmark-Server-Token": key },
      body: JSON.stringify({ From: `${f.name} <${f.email}>`, To: to, Subject: subject, HtmlBody: html, MessageStream: "outbound" }),
    });
    const txt = await r.text();
    if (r.ok) {
      let code = 0;
      try { code = JSON.parse(txt)?.ErrorCode ?? 0; } catch { /* ignore */ }
      if (code === 0) return { ok: true, status: 200, provider: "postmark" };
    }
    return { ok: false, status: r.status, provider: "postmark", error: txt.slice(0, 200) };
  } catch (e) {
    return { ok: false, status: "error", provider: "postmark", error: (e as Error).message };
  }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, status: "no-key", provider: "resend", error: "RESEND_API_KEY absente" };
  // Sans domaine vérifié chez Resend, « onboarding@resend.dev » n'envoie qu'à l'adresse du compte Resend.
  const from = Deno.env.get("RESEND_FROM") || "TERH Alertes <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (r.ok) return { ok: true, status: 200, provider: "resend" };
    return { ok: false, status: r.status, provider: "resend", error: (await r.text()).slice(0, 200) };
  } catch (e) {
    return { ok: false, status: "error", provider: "resend", error: (e as Error).message };
  }
}

const PROVIDERS: Record<string, Sender> = { brevo: sendViaBrevo, mailjet: sendViaMailjet, smtp2go: sendViaSmtp2go, postmark: sendViaPostmark, resend: sendViaResend };
// Ordre d'essai (modifiable sans toucher au code : secret EMAIL_ORDER, ex. « mailjet,brevo,smtp2go »). Resend en dernier : sans domaine vérifié il n'envoie qu'au propriétaire du compte.
const ORDER = (Deno.env.get("EMAIL_ORDER") || "brevo,mailjet,smtp2go,postmark,resend")
  .split(",").map((s) => s.trim().toLowerCase()).filter((s) => s in PROVIDERS);
const configured = () => ({
  brevo: !!Deno.env.get("BREVO_API_KEY"),
  mailjet: !!(Deno.env.get("MAILJET_API_KEY") && Deno.env.get("MAILJET_SECRET_KEY")),
  smtp2go: !!Deno.env.get("SMTP2GO_API_KEY"),
  postmark: !!Deno.env.get("POSTMARK_SERVER_TOKEN"),
  resend: !!Deno.env.get("RESEND_API_KEY"),
});

/* ---------- Envoi avec fallback automatique (tous les fournisseurs, dans l'ordre) ---------- */
async function sendEmailWithFallback(to: string, subject: string, html: string) {
  const attempts: SendResult[] = [];
  for (const name of ORDER) {
    const res = await PROVIDERS[name](to, subject, html);
    attempts.push(res);
    if (res.ok) return { ok: true, provider: name, attempts };
    if (res.status !== "no-key") console.log(`[fallback] ${name} a échoué pour ${to} (${res.status}) → fournisseur suivant`);
  }
  return { ok: false, provider: "aucun", attempts };
}

/* ---------- Envoi à une liste de destinataires ---------- */
async function sendAll(recipients: string[], subject: string, html: string) {
  const by: Record<string, number> = Object.fromEntries(Object.keys(PROVIDERS).map((k) => [k, 0]));
  let failed = 0;
  const erreurs: string[] = [];
  const details: { email: string; provider: string; status: number | string; attempts: number }[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    if (i > 0) await sleep(400);
    const res = await sendEmailWithFallback(to, subject, html);
    const last = res.attempts[res.attempts.length - 1];
    details.push({ email: to, provider: res.provider, status: res.ok ? 200 : (last?.status ?? "n/a"), attempts: res.attempts.length });
    if (res.ok) by[res.provider]++;
    else {
      failed++;
      const why = res.attempts.filter((a) => a.status !== "no-key").map((a) => `${a.provider} ${a.status}${a.error ? " " + a.error : ""}`).join(" | ");
      erreurs.push(`${to} : échec (${why || "aucun fournisseur configuré"})`.slice(0, 300));
    }
  }
  return { sent: Object.values(by).reduce((a, b) => a + b, 0), by, failed, erreurs, details };
}

/* ---------- Construction du rapport (contrats + CNPS) ---------- */
// deno-lint-ignore no-explicit-any
async function buildReport(supaAdmin: any, targetEntreprise: string | null, bodyJours: unknown, scopeLabel: string) {
  let empQ = supaAdmin.from("employes")
    .select("nom,poste,type_contrat,debut,fin,date_arret,cnps,telephone,entreprise_id");
  if (targetEntreprise) empQ = empQ.eq("entreprise_id", targetEntreprise);
  const { data: employes } = await empQ;

  let parQ = supaAdmin.from("parametres")
    .select("cle,valeur,entreprise_id")
    .in("cle", ["soc", "client", "alert_jours"]);
  if (targetEntreprise) parQ = parQ.eq("entreprise_id", targetEntreprise);
  const { data: params } = await parQ;
  const p: Record<string, string> = {};
  (params || []).forEach((x: { cle: string; valeur: string }) => {
    if (!(x.cle in p)) p[x.cle] = x.valeur;
  });

  const jours = Math.min(Math.max(Number(bodyJours) || Number(p.alert_jours) || DEFAULT_JOURS, 1), 365);
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 86400000;
  const toMs = (d: string) => Date.parse(d + "T00:00:00Z");
  // Comme l'application : « ENCOURS » / « EN COURS » = N° CNPS pas encore obtenu
  const cnpsMissing = (v: unknown) => {
    const s = String(v ?? "").trim().toUpperCase();
    return !s || s === "ENCOURS" || s === "EN COURS";
  };

  // deno-lint-ignore no-explicit-any
  const contrats = (employes || []).filter((e: any) =>
    e.type_contrat !== "CDI" && !e.date_arret && e.fin &&
    Math.round((toMs(e.fin) - todayMs) / dayMs) <= jours
  // deno-lint-ignore no-explicit-any
  ).sort((a: any, b: any) => a.fin.localeCompare(b.fin));

  // deno-lint-ignore no-explicit-any
  const cnpsLate = (employes || []).filter((e: any) =>
    e.debut && !e.date_arret && cnpsMissing(e.cnps) &&
    Math.round((todayMs - toMs(e.debut)) / dayMs) > 8
  );

  const totalPoints = contrats.length + cnpsLate.length;

  const html = `<!doctype html><html><body style="font-family:Arial;color:#222;max-width:900px">
      <h2 style="color:#1f5fbf">⚠️ Alerte RH — ${esc(p.soc || "TOTAL EMPLOI RH")} / ${esc(p.client || "")}${esc(scopeLabel)}</h2>
      <p>Rapport du ${now.toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" })} — <b>${totalPoints} point(s) à traiter</b>.</p>
      <h3>📄 Contrats expirant sous ${jours} jours (${contrats.length})</h3>
      <table border="1" cellpadding="5" style="border-collapse:collapse;font-size:12px;width:100%">
        <tr style="background:#1f5fbf;color:#fff"><th>Nom</th><th>Poste</th><th>Type</th><th>Fin</th><th>Téléphone</th></tr>
        ${
    // deno-lint-ignore no-explicit-any
    contrats.map((c: any) => {
      const jr = Math.round((toMs(c.fin) - todayMs) / dayMs);
      return `<tr><td>${esc(c.nom)}</td><td>${esc(c.poste || "")}</td><td>${esc(c.type_contrat)}</td><td>${esc(c.fin)} (${jr} j)</td><td>${esc(c.telephone || "")}</td></tr>`;
    }).join("") || '<tr><td colspan="5">Aucun</td></tr>'}
      </table>
      <h3>🔴 CNPS en retard (${cnpsLate.length})</h3>
      <table border="1" cellpadding="5" style="border-collapse:collapse;font-size:12px;width:100%">
        <tr style="background:#c62f2f;color:#fff"><th>Nom</th><th>Poste</th><th>Embauche</th><th>Téléphone</th></tr>
        ${
    // deno-lint-ignore no-explicit-any
    cnpsLate.map((c: any) => `<tr><td>${esc(c.nom)}</td><td>${esc(c.poste || "")}</td><td>${esc(c.debut)}</td><td>${esc(c.telephone || "")}</td></tr>`).join("") || '<tr><td colspan="4">Aucun</td></tr>'}
      </table>
      <p style="font-size:11px;color:#666;margin-top:20px">Message automatique généré par la plateforme TOTAL EMPLOI RH. Ne pas répondre à cet email.</p>
    </body></html>`;

  return { html, totalPoints, contrats: contrats.length, cnps: cnpsLate.length, jours, soc: p.soc || "", client: p.client || "" };
}

/* ---------- Mode planifié (cron) : une alerte par entreprise, une fois par jour ---------- */
// deno-lint-ignore no-explicit-any
async function runCron(supaAdmin: any, body: any) {
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10); // date du jour à Douala (UTC+1)
  const dry = body?.dry_run === true;

  const { data: ents, error: eErr } = await supaAdmin.from("entreprises").select("id,nom,actif");
  if (eErr) return { status: 500, body: { error: "Lecture des entreprises : " + eErr.message } };
  const { data: pars, error: pErr } = await supaAdmin.from("parametres")
    .select("entreprise_id,cle,valeur").in("cle", ["alert_mails", "last_mail"]);
  if (pErr) return { status: 500, body: { error: "Lecture des paramètres : " + pErr.message } };

  const byEnt: Record<string, Record<string, string>> = {};
  // deno-lint-ignore no-explicit-any
  (pars || []).forEach((x: any) => {
    if (!x.entreprise_id) return;
    (byEnt[x.entreprise_id] ||= {})[x.cle] = x.valeur;
  });

  const resultats: Record<string, unknown>[] = [];
  // deno-lint-ignore no-explicit-any
  for (const ent of (ents || []) as any[]) {
    if (ent.actif === false) continue;
    const pe = byEnt[ent.id] || {};
    const recipients = clean(String(pe.alert_mails || "").split(",")).slice(0, MAX_ADMIN_RECIPIENTS);
    if (!recipients.length) { resultats.push({ entreprise: ent.nom, ignoree: "aucun destinataire" }); continue; }
    if (pe.last_mail === today) { resultats.push({ entreprise: ent.nom, ignoree: "déjà envoyé aujourd'hui" }); continue; }

    const rep = await buildReport(supaAdmin, ent.id, null, "");
    if (rep.totalPoints === 0) { resultats.push({ entreprise: ent.nom, ignoree: "rien à signaler" }); continue; }
    if (dry) { resultats.push({ entreprise: ent.nom, a_envoyer: recipients, points: rep.totalPoints }); continue; }

    const r = await sendAll(recipients, `⚠️ Alerte RH ${ent.nom} — ${rep.totalPoints} point(s) à traiter`, rep.html);
    // On ne marque « envoyé aujourd'hui » que si TOUS les destinataires l'ont reçu : sinon le prochain passage réessaie.
    if (r.sent > 0 && r.failed === 0) {
      await supaAdmin.from("parametres").upsert(
        { cle: "last_mail", valeur: today, entreprise_id: ent.id, updated_at: new Date().toISOString() },
        { onConflict: "entreprise_id,cle" },
      );
    }
    resultats.push({
      entreprise: ent.nom, points: rep.totalPoints, envoyes: r.sent,
      echecs: r.failed, erreurs: r.erreurs.length ? r.erreurs : undefined,
    });
  }
  console.log(JSON.stringify({ evt: "alertes-email-cron", dry, date: today, resultats }));
  return { status: 200, body: { cron: true, dry_run: dry, date: today, resultats } };
}

serve(async (req) => {
  const CH = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CH, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CH });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const supaAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    /* ---- Appel planifié : authentifié par un secret, sans utilisateur ---- */
    const givenSecret = req.headers.get("x-cron-secret");
    if (givenSecret) {
      const expected = Deno.env.get("CRON_SECRET");
      if (!expected || givenSecret !== expected) return json({ error: "Secret invalide" }, 401);
      const b = await req.json().catch(() => ({}));
      const out = await runCron(supaAdmin, b);
      return json(out.body, out.status);
    }

    /* ---- Appel depuis l'application : utilisateur connecté ---- */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non authentifié" }, 401);
    const jwt = authHeader.slice(7);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser(jwt);
    if (!user) return json({ error: "Non authentifié" }, 401);

    const { data: roleData } = await userClient.rpc("my_role");
    const role: string = (roleData as string) || "lecteur";
    const isSuperOwner = role === "super_owner";
    const isAdmin = role === "admin" || isSuperOwner;
    const isEditor = role === "editeur";
    if (!isAdmin && !isEditor) return json({ error: "Accès non autorisé" }, 403);

    const body = await req.json().catch(() => ({}));

    /* ---- Test de connexion (bouton Diagnostic) : n'envoie AUCUN e-mail ---- */
    if (body.ping === true) return json({ ok: true, ping: true, fournisseurs_configures: configured(), ordre: ORDER });

    const { data: entrepriseId } = await userClient.rpc("my_entreprise");

    let targetEntreprise: string | null = null;
    if (isSuperOwner) {
      targetEntreprise = typeof body.entreprise_id === "string" ? body.entreprise_id : null;
    } else {
      if (!entrepriseId) return json({ error: "Aucune entreprise associée à votre compte." }, 400);
      targetEntreprise = entrepriseId as string;
    }

    const asked: string[] = Array.isArray(body.to)
      ? body.to.map(String)
      : typeof body.to === "string" ? body.to.split(",") : [];

    let recipients: string[] = [];
    if (isAdmin && asked.length) {
      recipients = clean(asked).slice(0, MAX_ADMIN_RECIPIENTS);
    } else {
      let q = supaAdmin.from("parametres").select("valeur").eq("cle", "alert_mails");
      if (targetEntreprise) q = q.eq("entreprise_id", targetEntreprise);
      const { data: paramRows, error } = await q;
      if (error) return json({ error: "Lecture des destinataires : " + error.message }, 500);
      const raw = (paramRows || []).map((r: { valeur: string }) => r.valeur).join(",");
      recipients = clean(raw.split(",")).slice(0, MAX_ADMIN_RECIPIENTS);
    }
    if (recipients.length === 0) {
      return json({
        error: isAdmin
          ? "Aucun destinataire valide. Sélectionnez-en dans Paramètres → Destinataires."
          : "Aucun destinataire enregistré. Demandez à un administrateur de les définir.",
      }, 400);
    }

    const scopeLabel = isSuperOwner && !targetEntreprise ? " — TOUTES les entreprises" : "";
    const rep = await buildReport(supaAdmin, targetEntreprise, body.jours, scopeLabel);
    const r = await sendAll(recipients, `⚠️ Alerte RH — ${rep.totalPoints} point(s) à traiter`, rep.html);

    console.log(JSON.stringify({
      evt: "alertes-email", by: user.email, role, entreprise: targetEntreprise,
      by_provider: r.by, failed: r.failed, total: recipients.length, points: rep.totalPoints,
    }));

    return json({
      sent: r.sent,
      total: recipients.length,
      partiel: r.sent > 0 && r.failed > 0,
      points: rep.totalPoints,
      contrats: rep.contrats,
      cnps: rep.cnps,
      providers: { ...r.by, failed: r.failed },
      destinataires: recipients,
      details: r.details,
      erreurs: r.erreurs.length ? r.erreurs : undefined,
    });
  } catch (e) {
    console.error("alertes-email", e);
    return json({ error: "Erreur interne : " + (e as Error).message }, 500);
  }
});

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
