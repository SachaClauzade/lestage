#!/usr/bin/env node
/* ============================================================
   Installe l'espace vidéos sur ton projet Supabase, en une commande :
     node outils/installer-espace.mjs

   Il applique outils/espace.sql, règle la connexion par code, branche
   l'envoi des mails sur Resend, écrit l'adresse et la clé publique dans
   data.js, et affiche les enregistrements DNS à poser chez IONOS.
   On peut le relancer sans risque. Il lit ses clés dans .env.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const fichier = (p) => new URL(`../${p}`, import.meta.url);
const DOMAINE = "sachaclauzade.me";
const EXPEDITEUR = `acces@${DOMAINE}`;
const SITE = "https://stage.sachaclauzade.me/espace.html";
const SUJET = "{{ .Token }} est ton code pour Le Stage";

async function lireEnv() {
  let texte = "";
  try { texte = await readFile(fichier(".env"), "utf8"); }
  catch { arreter("Fichier .env introuvable. Copie .env.exemple en .env et remplis-le."); }
  const env = {};
  for (const l of texte.split("\n")) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
function arreter(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

const env = await lireEnv();
for (const k of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"]) {
  if (!env[k]) arreter(`${k} est vide dans .env.`);
}

async function appel(base, jeton, methode, chemin, corps) {
  const r = await fetch(base + chemin, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json", "User-Agent": "le-stage-installation" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await r.text();
  let json = null;
  try { json = texte ? JSON.parse(texte) : null; } catch {}
  if (!r.ok) { const e = new Error(`${methode} ${chemin} : ${r.status} ${texte.slice(0, 400)}`); e.status = r.status; throw e; }
  return json;
}
const projet = `/v1/projects/${env.SUPABASE_PROJECT_REF}`;
const supabase = (m, c, b) => appel("https://api.supabase.com", env.SUPABASE_ACCESS_TOKEN, m, c, b);
const resend = (m, c, b) => appel("https://api.resend.com", env.RESEND_API_KEY, m, c, b);

try {
  console.log("1/5  La base : tables, fonctions, calendrier");
  await supabase("POST", `${projet}/database/query`, { query: await readFile(fichier("outils/espace.sql"), "utf8") });

  console.log("2/5  La connexion par code et l'envoi des mails");
  await supabase("PATCH", `${projet}/config/auth`, {
    site_url: SITE,
    external_email_enabled: true,
    mailer_otp_exp: 600,
    mailer_otp_length: 6,
  });
  if (env.RESEND_API_KEY) {
    await supabase("PATCH", `${projet}/config/auth`, {
      smtp_admin_email: EXPEDITEUR,
      smtp_sender_name: "Le Stage",
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: env.RESEND_API_KEY,
      smtp_max_frequency: 60,
      rate_limit_email_sent: 100,
    });
  } else {
    console.log("     Pas de clé Resend : envoi de test de Supabase, 2 mails par heure, vers ton adresse seulement.");
  }
  const gabarit = await readFile(fichier("outils/mail-code.html"), "utf8");
  try {
    await supabase("PATCH", `${projet}/config/auth`, {
      mailer_subjects_magic_link: SUJET,
      mailer_templates_magic_link_content: gabarit,
      mailer_subjects_confirmation: SUJET,
      mailer_templates_confirmation_content: gabarit,
    });
  } catch (e) {
    if (env.RESEND_API_KEY) throw e;
    console.warn(`     ⚠ Modèle de mail non appliqué sans Resend (${e.message}).`);
  }

  console.log("3/5  La liste : seules les adresses inscrites reçoivent un code");
  try {
    await supabase("PATCH", `${projet}/config/auth`, {
      hook_before_user_created_enabled: true,
      hook_before_user_created_uri: "pg-functions://postgres/public/hook_avant_inscription",
    });
  } catch (e) {
    console.warn(`     ⚠ Filtre non activé (${e.message}).\n     Les vidéos restent protégées, mais une adresse hors liste pourrait recevoir un code.`);
  }

  console.log("4/5  L'adresse et la clé publique dans data.js");
  const cles = await supabase("GET", `${projet}/api-keys`);
  const publique = cles.find((k) => k.type === "publishable") || cles.find((k) => k.name === "anon");
  if (!publique || !publique.api_key) arreter("Clé publique introuvable sur ce projet.");
  let data = await readFile(fichier("data.js"), "utf8");
  data = data
    .replace(/supabaseUrl: ".*?"/, () => `supabaseUrl: "https://${env.SUPABASE_PROJECT_REF}.supabase.co"`)
    .replace(/supabaseCle: ".*?"/, () => `supabaseCle: "${publique.api_key}"`);
  await writeFile(fichier("data.js"), data);

  if (!env.RESEND_API_KEY) {
    console.log("5/5  Resend : pas encore de clé, étape passée");
    console.log("\n✓ Supabase est prêt. Ajoute RESEND_API_KEY dans .env et relance pour envoyer les codes à toute la promo.\n");
    process.exit(0);
  }
  console.log("5/5  Le domaine d'envoi chez Resend");
  let liste;
  try {
    liste = await resend("GET", "/domains");
  } catch (e) {
    if (e.status !== 401 || !/restricted/.test(e.message)) throw e;
    console.log(`\n✓ Supabase est prêt. Ta clé Resend sert seulement à envoyer : vérifie que ${DOMAINE} est bien « Verified » sur resend.com/domains.\n`);
    process.exit(0);
  }
  let domaine = (liste.data || []).find((d) => d.name === DOMAINE);
  domaine = domaine ? await resend("GET", `/domains/${domaine.id}`) : await resend("POST", "/domains", { name: DOMAINE });
  if (domaine.status === "verified") {
    console.log(`\n✓ Terminé. Les mails partent de ${EXPEDITEUR}.\n`);
  } else {
    await resend("POST", `/domains/${domaine.id}/verify`).catch(() => {});
    console.log(`\n✓ Supabase est prêt. Il reste à poser ces enregistrements DNS chez IONOS pour ${DOMAINE} :\n`);
    for (const r of domaine.records || []) {
      console.log(`  ${String(r.type).padEnd(4)}  ${r.name}\n        ${r.value}${r.priority !== undefined ? `\n        priorité ${r.priority}` : ""}\n`);
    }
    console.log("Puis relance ce script : il confirmera quand le domaine sera validé.\n");
  }
} catch (e) {
  arreter(e.message);
}
