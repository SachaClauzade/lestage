#!/usr/bin/env node
/* ============================================================
   Crée les salons du Discord de la promo, en une commande :
     node outils/creer-discord.mjs

   1. Crée ton serveur dans Discord (« Créer le mien »).
   2. discord.com/developers/applications > New Application > Bot >
      Reset Token, et colle-le dans .env (DISCORD_BOT_TOKEN).
   3. Lance le script : il affiche un lien pour inviter le bot sur le serveur.
   4. Relance-le : il crée les salons et écrit leurs adresses dans data.js.
   5. node outils/brancher-annonces.mjs : le lien de chaque jour sera posté
      dans son salon à 6 h, le matin même. Ce script-ci n'en poste aucun.

   Pour ajouter un salon plus tard : ajoute-le à STRUCTURE et relance.
   Ce qui existe déjà n'est ni recréé ni reposté.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const fichier = (p) => new URL(`../${p}`, import.meta.url);
const SITE = "https://stage.sachaclauzade.me/espace.html";
const API = "https://discord.com/api/v10";
const NB_JOURS = 10;

/* Les jours de live (lundis et jeudis : jours 1, 4, 6 et 9) ont un point rouge dans leur nom. */
const JOURS_LIVE = [1, 4, 6, 9];
const jour = (n) => ({
  nom: JOURS_LIVE.includes(n) ? `jour-${n}-🔴-live` : `jour-${n}`,
  sujet: `La vidéo du jour ${n} tombe ici à 6 h. Tes questions, c'est ici aussi.`,
  cle: n,
});
const STRUCTURE = [
  {
    categorie: "Le Stage",
    salons: [
      { nom: "général", sujet: `Tes vidéos : ${SITE}`, cle: "general",
        message: `**Bienvenue dans Le Stage.**\nUne vidéo par jour, à 6 h : <${SITE}>\nConnecte-toi avec le mail de ton paiement, tu reçois un code.` },
      { nom: "montre-ton-contenu", sujet: "Tes posts, tes hooks, ce que tu veux qu'on regarde.", cle: "contenu",
        message: "**Montre ton contenu.**\nPoste ici le lien de ton post, ton hook, et ce que tu veux qu'on regarde." },
    ],
  },
  { categorie: "Les 10 jours", salons: Array.from({ length: NB_JOURS }, (_, i) => jour(i + 1)) },
];

/* voir, gérer les salons, écrire, lire l'historique, épingler */
const PERMISSIONS = (1n << 10n | 1n << 4n | 1n << 11n | 1n << 16n | 1n << 51n).toString();
const TEXTE = 0, CATEGORIE = 4;

function arreter(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

async function lireJeton() {
  let texte = "";
  try { texte = await readFile(fichier(".env"), "utf8"); }
  catch { arreter("Fichier .env introuvable. Copie .env.exemple en .env et remplis-le."); }
  const m = texte.match(/^\s*DISCORD_BOT_TOKEN\s*=\s*["']?([^"'\s]+)/m);
  if (!m) arreter("DISCORD_BOT_TOKEN est vide dans .env.");
  return m[1];
}
const JETON = await lireJeton();

async function discord(methode, chemin, corps) {
  for (;;) {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { Authorization: `Bot ${JETON}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (https://stage.sachaclauzade.me, 1.0)" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    if (r.status === 429) {
      const { retry_after = 1 } = await r.json().catch(() => ({}));
      await new Promise((ok) => setTimeout(ok, (retry_after + 0.25) * 1000));
      continue;
    }
    const texte = await r.text();
    if (!r.ok) {
      if (r.status === 401) arreter("Discord refuse ce jeton. Refais un Reset Token et recolle-le dans .env.");
      if (r.status === 403) arreter(`Le bot n'a pas le droit de faire ça (${methode} ${chemin}). Réinvite-le avec le lien affiché par ce script.`);
      arreter(`${methode} ${chemin} : ${r.status} ${texte.slice(0, 300)}`);
    }
    return texte ? JSON.parse(texte) : null;
  }
}

const bot = await discord("GET", "/users/@me");
const serveurs = await discord("GET", "/users/@me/guilds");
if (!serveurs.length) {
  console.log(`\nInvite le bot sur ton serveur avec ce lien, puis relance le script :\n\nhttps://discord.com/oauth2/authorize?client_id=${bot.id}&scope=bot&permissions=${PERMISSIONS}\n`);
  process.exit(0);
}
if (serveurs.length > 1) arreter(`Le bot est sur ${serveurs.length} serveurs (${serveurs.map((s) => s.name).join(", ")}). Retire-le de ceux qui ne sont pas la promo.`);
const serveur = serveurs[0];
console.log(`Serveur : ${serveur.name}\n`);

const salons = await discord("GET", `/guilds/${serveur.id}/channels`);
const liens = { jours: {} };
const url = (id) => `https://discord.com/channels/${serveur.id}/${id}`;

for (const [iCat, groupe] of STRUCTURE.entries()) {
  let cat = salons.find((c) => c.type === CATEGORIE && c.name.toLowerCase() === groupe.categorie.toLowerCase());
  if (!cat) {
    cat = await discord("POST", `/guilds/${serveur.id}/channels`, { name: groupe.categorie, type: CATEGORIE, position: iCat });
    console.log(`+ catégorie ${groupe.categorie}`);
  }
  for (const [i, s] of groupe.salons.entries()) {
    let salon = salons.find((c) => c.type === TEXTE && c.name === s.nom);
    if (!salon) {
      salon = await discord("POST", `/guilds/${serveur.id}/channels`, { name: s.nom, type: TEXTE, parent_id: cat.id, topic: s.sujet, position: i });
      console.log(`+ #${s.nom}`);
    } else if (salon.parent_id !== cat.id || !salon.topic) {
      /* #général existe déjà sur un serveur neuf : on le range au bon endroit */
      salon = await discord("PATCH", `/channels/${salon.id}`, { parent_id: cat.id, topic: salon.topic || s.sujet, position: i });
      console.log(`~ #${s.nom} rangé dans ${groupe.categorie}`);
    }
    if (s.message) {
      const derniers = await discord("GET", `/channels/${salon.id}/messages?limit=50`);
      /* type 0 = un vrai message : « Pixel vient d'arriver » ne compte pas */
      if (!derniers.some((m) => m.author.id === bot.id && m.type === 0)) {
        const msg = await discord("POST", `/channels/${salon.id}/messages`, { content: s.message });
        await discord("PUT", `/channels/${salon.id}/pins/${msg.id}`);
        console.log(`  message épinglé dans #${s.nom}`);
      }
    }
    if (typeof s.cle === "number") liens.jours[s.cle] = url(salon.id);
    else liens[s.cle] = url(salon.id);
  }
}

const data = await readFile(fichier("data.js"), "utf8");
if (!/discord: \{.*\},/.test(data)) arreter("La ligne discord de data.js est introuvable.");
await writeFile(fichier("data.js"), data.replace(/discord: \{.*\},/, () => `discord: ${JSON.stringify(liens)},`));
console.log("\n✓ Terminé. Les adresses des salons sont dans data.js.\n");
