#!/usr/bin/env node
/* ============================================================
   Branche l'annonce de 6 h sur Discord, en une commande :
     node outils/brancher-annonces.mjs

   Il applique outils/annonces.sql, range le jeton du bot dans le coffre
   de Supabase, et associe chaque jour à son salon (lu dans data.js).
   On peut le relancer, et il faut le relancer après un Reset Token du bot.
   Il lit ses clés dans .env.
   ============================================================ */
import { readFile } from "node:fs/promises";

const fichier = (p) => new URL(`../${p}`, import.meta.url);
function arreter(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

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

const env = await lireEnv();
for (const k of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN", "DISCORD_BOT_TOKEN"]) {
  if (!env[k]) arreter(`${k} est vide dans .env.`);
}
const JETON = env.DISCORD_BOT_TOKEN;
if (!/^[\w.-]+$/.test(JETON)) arreter("DISCORD_BOT_TOKEN a une forme inattendue dans .env.");

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", "User-Agent": "le-stage-installation" },
    body: JSON.stringify({ query }),
  });
  const texte = await r.text();
  if (!r.ok) arreter(`Supabase : ${r.status} ${texte.replaceAll(JETON, "***").slice(0, 400)}`);
  return texte ? JSON.parse(texte) : null;
}

const data = await readFile(fichier("data.js"), "utf8");
const ligne = data.match(/discord: (\{.*\}),/);
const salons = ligne ? JSON.parse(ligne[1]).jours : null;
if (!salons || !Object.keys(salons).length) arreter("Aucun salon dans data.js : lance d'abord outils/creer-discord.mjs.");

console.log("1/3  Le cron : chaque minute, Supabase regarde si un jour vient d'ouvrir");
await sql(await readFile(fichier("outils/annonces.sql"), "utf8"));

console.log("2/3  Le jeton du bot, dans le coffre de Supabase");
await sql(`do $do$
declare s uuid;
begin
  select id into s from vault.secrets where name = 'discord_bot_token';
  if s is null then
    perform vault.create_secret($jeton$${JETON}$jeton$, 'discord_bot_token', 'Jeton du bot Discord');
  else
    perform vault.update_secret(s, $jeton$${JETON}$jeton$);
  end if;
end $do$;`);

console.log("3/3  Chaque jour et son salon");
const mises = Object.entries(salons).map(([n, url]) => {
  const id = url.split("/").pop();
  if (!/^\d+$/.test(n) || !/^\d+$/.test(id)) arreter(`Salon illisible dans data.js pour le jour ${n}.`);
  return `update public.jours set salon = '${id}' where numero = ${n};`;
});
await sql(mises.join("\n"));

const [etat] = await sql(`select count(*) filter (where salon is not null) as branches,
  to_char(min(ouvre_le) filter (where annonce_le is null and ouvre_le > now()) at time zone 'Europe/Paris', 'DD/MM à HH24"h"MI') as prochaine
  from public.jours`);
console.log(`\n✓ Terminé. ${etat.branches} jours branchés. Prochaine annonce : ${etat.prochaine || "aucune"}.\n`);
