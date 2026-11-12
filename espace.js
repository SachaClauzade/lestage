/* ============================================================
   Ton espace : la connexion par code, les dix jours, la vidéo.

   Le site est statique et son dépôt est public : aucune vidéo ni
   aucun contenu ne vit ici. Tout vient de Supabase, qui décide lui-même,
   avec son horloge, si un jour est ouvert (outils/espace.sql).

   Une seule page : espace.html (le parcours), espace.html?jour=3 (un jour).

   En local sans Supabase configuré, un mode démo remplace le serveur :
     code 123456 · une adresse contenant « refus » n'est pas inscrite
     ?le=2026-11-18T08:00:00%2B01:00   voir la page à cette date
     ?plein                            des jours remplis
     ?staff                            la vue de Sacha
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CFG = (typeof SITE_DATA !== "undefined" && SITE_DATA.espace) || {};
  const DISCORD = CFG.discord || {};
  /* Le logo Discord, devant chaque bouton qui ouvre un salon. Il prend la couleur du texte du bouton. */
  const ICONE_DISCORD = '<svg class="ico-dc" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
  const vue = $("#vue");
  const TZ = "Europe/Paris";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const track = (n, d) => { if (window.stageTrack) window.stageTrack(n, d); };
  const burst = (x, y, o) => { if (window.stageBurst) window.stageBurst(x, y, o); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const memoire = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };

  /* ---------- l'heure : celle du serveur, affichée à l'heure de Paris ---- */
  let decalage = 0;
  const maintenant = () => Date.now() + decalage;
  const caler = (iso) => { const t = Date.parse(iso); if (!isNaN(t)) decalage = t - Date.now(); };
  const fLong = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const fCourt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
  const fJourSeul = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" });
  const fHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const fCle = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
  const heure = (t) => { const [h, m] = fHeure.format(t).split(":"); return +h + " h" + (m === "00" ? "" : " " + m); };
  const long = (t) => fLong.format(t);
  const court = (t) => fCourt.format(t);
  const memeJour = (a, b) => fCle.format(a) === fCle.format(b);
  const ms = (j) => Date.parse(j.ouvre_le);

  /* ---------- le serveur ------------------------------------------------- */
  class Refus extends Error { constructor(code) { super(code); this.code = code; } }

  function apiSupabase() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseCle, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "stage.espace.auth" },
    });
    const traduire = (e) => {
      const m = `${e.code || ""} ${e.message || ""}`;
      if (/pas_inscrit/.test(m)) return new Refus("pas_inscrit");
      if (/jour_inconnu/.test(m)) return new Refus("jour_inconnu");
      if (e.status === 429 || /rate.?limit/i.test(m)) return new Refus("trop_vite");
      if (/otp_expired|expired|invalid/i.test(m) && /otp|token/i.test(m)) return new Refus("code_invalide");
      if (/JWT|PGRST30/i.test(m) || e.status === 401) return new Refus("session");
      if (/fetch|network/i.test(m) || e.status === 0) return new Refus("reseau");
      console.error(e);
      return new Refus("inconnu");
    };
    const rpc = async (nom, args) => { const { data, error } = await sb.rpc(nom, args); if (error) throw traduire(error); return data; };
    return {
      async session() { const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
      async envoyerCode(email) { const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw traduire(error); },
      async verifierCode(email, token) { const { error } = await sb.auth.verifyOtp({ email, token, type: "email" }); if (error) throw traduire(error); },
      espace: () => rpc("espace"),
      jour: (n) => rpc("espace_jour", { n }),
      dossier: () => rpc("dossier"),
      enregistrerDossier: (champs) => rpc("dossier_enregistrer", { champs }),
      async deconnexion() { await sb.auth.signOut(); },
    };
  }

  function apiDemo() {
    const q = new URLSearchParams(location.search);
    if (q.get("le")) memoire.set("demo.le", q.get("le"));
    if (q.has("plein")) memoire.set("demo.plein", 1);
    if (q.has("staff")) memoire.set("demo.staff", 1);
    const le = Date.parse(memoire.get("demo.le") || ""), t0 = Date.now();
    const horloge = () => (isNaN(le) ? Date.now() : le + (Date.now() - t0));
    const plein = !!memoire.get("demo.plein"), staff = !!memoire.get("demo.staff");
    const dates = ["11-16", "11-17", "11-18", "11-19", "11-20", "11-23", "11-24", "11-25", "11-26", "11-27"];
    const titre = (n) => (plein ? `Le titre du jour ${n}, écrit par Sacha` : null);
    const jours = () => dates.map((d, i) => { const ouvre_le = `2026-${d}T06:00:00+01:00`; return { numero: i + 1, titre: titre(i + 1), ouvre_le, ouvert: Date.parse(ouvre_le) <= horloge() }; });
    const attendre = (d = 350) => new Promise((r) => setTimeout(r, d));
    return {
      async session() { const m = memoire.get("demo.session"); return m ? { email: m } : null; },
      async envoyerCode(email) { await attendre(); if (/refus/.test(email)) throw new Refus("pas_inscrit"); },
      async verifierCode(email, code) { await attendre(700); if (code !== "123456") throw new Refus("code_invalide"); memoire.set("demo.session", email); },
      async espace() { await attendre(120); return { prenom: "Sacha", staff, maintenant: new Date(horloge()).toISOString(), coaching: "https://calendly.com/", jours: jours() }; },
      async jour(n) {
        await attendre(120);
        const j = jours().find((x) => x.numero === n);
        if (!j) throw new Refus("jour_inconnu");
        const m = new Date(horloge()).toISOString();
        if (!j.ouvert && !staff) return { numero: j.numero, titre: j.titre, ouvre_le: j.ouvre_le, ouvert: false, maintenant: m };
        return { ...j, maintenant: m, apercu: !j.ouvert,
          objectif: plein ? "Une phrase qui dit ce que tu auras fait ce soir." : null,
          video: plein ? "https://youtu.be/aqz-KE-bpKQ" : null,
          taches: plein ? "Regarder la vidéo en entier\nÉcrire 5 idées de posts\nPublier ton premier post" : null,
          ressources: plein ? "Le Sheet du jour | https://docs.google.com/\nLes prompts (PDF) | https://example.com/prompts.pdf" : null,
          encart: plein ? "À savoir\n**Une règle en gras**, puis la suite de la phrase.\nUn second paragraphe, plus court." : null,
          prompts: plein ? [
            { titre: "Tes mots-clés, depuis ta cible", quand: "Pour ta liste de départ.", texte: "Tu es un expert TikTok.\n\nMA CIBLE\n- Qui elle est : {{profil|[profil]}}\n- Son objectif n°1 : {{envie_objectif|[envie]}}\n\nMa cible en entier :\n{{cible|[colle ta cible]}}\n\nDonne-moi 15 recherches TikTok, une par ligne.", apres: "Garde celles qui sonnent comme ta cible." },
            { titre: "Ton app, tenue en main", texte: "Crée une photo ultra-réaliste, au format vertical.\nLa scène se déroule [LIEU].", outil: "image" },
          ] : null };
      },
      async dossier() { await attendre(120); return { donnees: memoire.get("demo.dossier") || {}, modifie_le: null, exemples: memoire.get("demo.exemples"), checklist: memoire.get("demo.checklist"), cle_kit: "0123456789abcdef0123456789abcdef", kit_hooks: memoire.get("demo.kit") }; },
      async enregistrerDossier(champs) { await attendre(300); memoire.set("demo.dossier", { ...(memoire.get("demo.dossier") || {}), ...champs }); return { modifie_le: new Date().toISOString() }; },
      async deconnexion() { memoire.del("demo.session"); },
    };
  }

  const pret = !!(CFG.supabaseUrl && CFG.supabaseCle && window.supabase);
  const api = pret ? apiSupabase() : local ? apiDemo() : null;

  const MESSAGES = {
    pas_inscrit: "Cette adresse n'est pas sur la liste de la promo. Utilise celle de ton paiement, ou réponds au mail de ton invitation.",
    trop_vite: "Attends une minute avant de redemander un code.",
    code_invalide: "Ce code ne marche pas. Vérifie-le, ou redemande-en un.",
    reseau: "Pas de connexion. Vérifie ton réseau et réessaie.",
    inconnu: "Ça n'a pas marché. Réessaie dans un instant.",
  };
  const message = (e) => MESSAGES[e && e.code] || MESSAGES.inconnu;

  /* ---------- petits morceaux -------------------------------------------- */
  const point = '<span class="px-dot" aria-hidden="true"></span>';
  const lien = (href, cls, txt) => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${txt}</a>`;
  const lignes = (s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const pad = (n) => String(n).padStart(2, "0");
  const sep = '<i class="cd-sep" aria-hidden="true"><u></u><u></u></i>';
  const compte = (cible, cls = "") => `<div class="cd ${cls}" role="timer" data-cible="${cible}"><span class="cd-j" hidden></span><b data-u="h">00</b>${sep}<b data-u="m">00</b>${sep}<b data-u="s">00</b></div>`;
  const avancement = (n) => store.get(`stage.espace.j${n}`, []);
  const fini = (n) => { const c = avancement(n); return c.length > 0 && c.every(Boolean); };

  function majComptes() {
    $$(".cd").forEach((el) => {
      const s = Math.ceil(Math.max(0, +el.dataset.cible - maintenant()) / 1000);
      const j = Math.floor(s / 86400), jEl = $(".cd-j", el);
      jEl.hidden = j === 0;
      if (j) jEl.innerHTML = `${j}<small>j</small>`;
      $('[data-u="h"]', el).textContent = pad(Math.floor((s % 86400) / 3600));
      $('[data-u="m"]', el).textContent = pad(Math.floor((s % 3600) / 60));
      $('[data-u="s"]', el).textContent = pad(s % 60);
    });
  }

  /* Tourne chaque seconde tant que la vue reste affichée. Quand l'échéance
     tombe, on redemande au serveur : c'est lui qui décide. */
  let ticker = 0;
  function battre(echeance) {
    clearInterval(ticker);
    majComptes();
    if (!echeance) { if ($(".cd")) ticker = setInterval(majComptes, 1000); return; }
    ticker = setInterval(() => {
      majComptes();
      if (maintenant() >= echeance + 800) {
        clearInterval(ticker);
        if (!reduced) burst(innerWidth / 2, innerHeight / 3, { n: 44, r: 240, sizes: [5, 11], dur: [900, 1600] });
        route();
      }
    }, 1000);
  }

  function aller(href) { history.pushState(null, "", href); route(); scrollTo(0, 0); }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-go]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); aller(a.getAttribute("href"));
  });
  addEventListener("popstate", () => route());

  const sortir = $("#sortir");
  sortir.addEventListener("click", async () => { await api.deconnexion(); track("espace_deconnexion"); aller("espace.html"); });

  /* ---------- connexion : le mail ---------------------------------------- */
  const ATTENTE = "stage.espace.attente";
  const rang = `<div class="ac-rang" aria-hidden="true">${"<i></i>".repeat(10)}</div>`;

  function vueConnexion() {
    clearInterval(ticker);
    sortir.hidden = true;
    const a = memoire.get(ATTENTE);
    if (a && a.email) return etapeCode(a.email, a.t);
    etapeMail("");
  }

  function etapeMail(prerempli, err) {
    clearInterval(ticker);
    vue.innerHTML = `<section class="ac"><div class="ac-in">${rang}
      <h1 class="h2">Ton espace${point}</h1>
      <p class="p">Entre l'adresse de ton paiement. Je t'envoie un code.</p>
      <form id="fMail" novalidate>
        <label class="champ"><span>Ton mail</span><input id="mail" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="toi@exemple.com" value="${esc(prerempli)}"></label>
        <p class="ac-err" id="err" role="alert" hidden></p>
        <button class="btn btn-ink btn-xl" id="go" type="submit">Recevoir mon code</button>
      </form>
      <p class="ac-pied mono">Une seule fois par appareil.</p>
    </div></section>`;
    const input = $("#mail"), errEl = $("#err"), go = $("#go");
    const dire = (t) => { errEl.textContent = t; errEl.hidden = !t; };
    if (err) dire(err);
    input.focus();
    $("#fMail").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { dire("Cette adresse a l'air incomplète."); input.focus(); return; }
      dire(""); go.disabled = true; go.textContent = "Envoi…";
      try {
        await api.envoyerCode(email);
        const t = Date.now();
        memoire.set(ATTENTE, { email, t });
        track("espace_code_demande");
        etapeCode(email, t);
      } catch (x) {
        dire(message(x)); go.disabled = false; go.textContent = "Recevoir mon code"; track("espace_code_refuse", { raison: x.code || "inconnu" });
      }
    });
  }

  /* ---------- connexion : le code ---------------------------------------- */
  function etapeCode(email, t0) {
    clearInterval(ticker);
    const cases = Array.from({ length: 6 }, (_, k) => `<div class="code-c" style="--k:${k}"><span></span></div>`).join("");
    vue.innerHTML = `<section class="ac"><div class="ac-in">${rang}
      <h1 class="h2">Regarde tes mails${point}</h1>
      <p class="p">Code envoyé à <b>${esc(email)}</b>. Pense aux spams.</p>
      <div class="code" id="code">${cases}<i class="code-px" aria-hidden="true"></i>
        <input id="codeIn" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" aria-label="Code à six chiffres">
      </div>
      <p class="ac-err" id="err" role="alert" hidden></p>
      <div class="ac-liens mono"><button id="renvoi" type="button" disabled></button><button id="changer" type="button">Changer d'adresse</button></div>
    </div></section>`;
    const box = $("#code"), input = $("#codeIn"), errEl = $("#err"), renvoi = $("#renvoi"), cels = $$(".code-c", box);
    const dire = (t) => { errEl.textContent = t; errEl.hidden = !t; };
    let occupe = false, depart = t0 || Date.now();

    function peindre() {
      const v = input.value;
      cels.forEach((c, k) => {
        const plein = k < v.length, sp = c.firstChild;
        if (sp.textContent !== (v[k] || "")) sp.textContent = v[k] || "";
        c.classList.toggle("is-plein", plein);
        c.classList.toggle("is-actif", k === Math.min(v.length, 5));
      });
      box.style.setProperty("--i", Math.min(v.length, 5));
    }
    async function verifier() {
      if (occupe) return;
      occupe = true; dire(""); box.classList.add("is-busy"); input.blur(); input.readOnly = true;
      try {
        await api.verifierCode(email, input.value);
        memoire.del(ATTENTE);
        track("espace_connecte");
        box.classList.remove("is-busy"); box.classList.add("is-ok");
        const r = box.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { n: 34, r: 180, sizes: [4, 9] });
        setTimeout(route, reduced ? 0 : 520);
      } catch (x) {
        occupe = false; box.classList.remove("is-busy"); box.classList.remove("is-err"); void box.offsetWidth; box.classList.add("is-err");
        input.readOnly = false; input.value = ""; peindre(); dire(message(x)); input.focus();
        track("espace_code_refuse", { raison: x.code || "inconnu" });
      }
    }
    input.addEventListener("input", () => {
      if (occupe) return;
      box.classList.remove("is-err");
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      peindre();
      if (input.value.length === 6) verifier();
    });
    input.addEventListener("focus", () => box.classList.add("is-focus"));
    input.addEventListener("blur", () => box.classList.remove("is-focus"));

    const majRenvoi = () => {
      const reste = Math.ceil(60 - (Date.now() - depart) / 1000);
      renvoi.disabled = reste > 0;
      renvoi.textContent = reste > 0 ? `Renvoyer dans ${reste} s` : "Renvoyer le code";
    };
    majRenvoi();
    ticker = setInterval(majRenvoi, 1000);
    renvoi.addEventListener("click", async () => {
      renvoi.disabled = true;
      try { await api.envoyerCode(email); depart = Date.now(); memoire.set(ATTENTE, { email, t: depart }); dire(""); majRenvoi(); input.focus(); }
      catch (x) { dire(message(x)); majRenvoi(); }
    });
    $("#changer").addEventListener("click", () => { memoire.del(ATTENTE); etapeMail(email); });
    peindre();
    input.focus();
  }

  /* ---------- le parcours ------------------------------------------------ */
  function caseJour(j, d, auj) {
    const accessible = j.ouvert || d.staff;
    const etat = !accessible ? "is-lock" : fini(j.numero) ? "is-fini" : auj && auj.numero === j.numero ? "is-auj" : "";
    const corps = `<span class="j-date">${esc(court(ms(j)))}</span><span class="j-n">${j.numero}</span>${j.titre ? `<span class="j-t">${esc(j.titre)}</span>` : ""}<i class="j-s" aria-hidden="true"></i>`;
    const nom = `Jour ${j.numero}, ${long(ms(j))}${accessible ? "" : ", pas encore ouvert"}`;
    return `<li>${accessible
      ? `<a class="j ${etat}" style="--i:${j.numero - 1}" href="espace.html?jour=${j.numero}" data-go aria-label="${esc(nom)}">${corps}</a>`
      : `<div class="j ${etat}" style="--i:${j.numero - 1}" aria-label="${esc(nom)}" title="S'ouvre ${esc(long(ms(j)))} à ${esc(heure(ms(j)))}">${corps}</div>`}</li>`;
  }

  async function vueParcours(id) {
    const [d, dr] = await Promise.all([api.espace(), api.dossier().catch(() => null)]);
    if (id !== routeId) return;
    caler(d.maintenant);
    const etapes = etapesDe(d), faits = dr ? remplis(dr.donnees || {}, etapes) : 0;
    const carte = dr ? `<a class="dos-carte" href="espace.html?dossier" data-go>
        <span class="dos-carte-t">Mon dossier</span>
        <span class="dos-carte-p">Ton app, ta cible, tes mots-clés. De nouvelles parties s'ajoutent au fil des jours, et tes prompts s'en servent.</span>
        <span class="dos-carte-n mono">${faits} / ${etapes.length}${faits === etapes.length ? " · complet" : ""}</span>
      </a>` : "";
    const coaching = d.coaching ? lien(d.coaching, "dos-carte", `
        <span class="dos-carte-t">Coaching one-to-one</span>
        <span class="dos-carte-p">On regarde ton app, tes chiffres, ton onboarding et ton paywall. Réserve ton appel quand tu veux.</span>
        <span class="dos-carte-n mono">Réserver ↗</span>`) : "";
    const ouverts = d.jours.filter((j) => j.ouvert);
    const dernier = ouverts[ouverts.length - 1];
    const suivant = d.jours.find((j) => !j.ouvert);
    const salut = d.prenom ? `Bienvenue, ${d.prenom}` : "Bienvenue";
    let une;
    if (!dernier) {
      const premier = d.jours[0];
      une = `<section class="une"><div class="une-main">
        <p class="eyebrow mono">${esc(salut)} · première vidéo ${esc(long(ms(premier)))} à ${esc(heure(ms(premier)))}</p>
        ${compte(ms(premier), "cd-xl")}
      </div></section>`;
    } else {
      const auj = memeJour(ms(dernier), maintenant());
      const bas = suivant
        ? `<div class="une-bas"><span>Jour ${suivant.numero} · ${esc(fJourSeul.format(ms(suivant)))} à ${esc(heure(ms(suivant)))}</span>${compte(ms(suivant))}</div>`
        : `<div class="une-bas"><span>Les ${d.jours.length} jours sont ouverts. Reviens-y quand tu veux.</span></div>`;
      une = `<section class="une">
        <a class="une-main" href="espace.html?jour=${dernier.numero}" data-go>
          <p class="eyebrow mono">${auj ? "Aujourd'hui" : "Dernière vidéo"} · ${esc(long(ms(dernier)))}</p>
          <div class="une-rang">
            <h1 class="une-h">Jour ${dernier.numero}<span class="px-dot" aria-hidden="true"></span></h1>
            <span class="btn btn-ink btn-lg">Regarder <span class="arrow">→</span></span>
          </div>
          ${dernier.titre ? `<p class="une-t">${esc(dernier.titre)}</p>` : ""}
        </a>${bas}
      </section>`;
    }
    const aujCase = dernier && memeJour(ms(dernier), maintenant()) ? dernier : null;
    const sall = [DISCORD.general && lien(DISCORD.general, "btn", `${ICONE_DISCORD}#général`), DISCORD.contenu && lien(DISCORD.contenu, "btn", `${ICONE_DISCORD}#montre-ton-contenu`)].filter(Boolean).join("");
    vue.innerHTML = `<div class="esp-w">${une}
      <ul class="cal">${d.jours.map((j) => caseJour(j, d, aujCase)).join("")}</ul>
      ${carte}
      ${coaching}
      ${sall ? `<section class="dsc"><p>Sur le Discord</p>${sall}</section>` : ""}
    </div>`;
    document.title = "Ton espace · Le Stage";
    battre(suivant ? ms(suivant) : 0);
  }

  /* ---------- un jour ---------------------------------------------------- */
  function adresseVideo(url) {
    const raw = String(url || "").trim();
    let m;
    if ((m = raw.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i))) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`;
    if ((m = raw.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{20,})/i))) return `https://www.loom.com/embed/${m[1]}?hideEmbedTopBar=true&hide_owner=true&hide_share=true&hide_title=true`;
    if ((m = raw.match(/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i))) return `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}?autoplay=false&preload=true`;
    return "";
  }
  function pixelPlay() {
    const L = [1, 3, 5, 7, 9, 7, 5, 3, 1];
    return `<div class="px-play" aria-hidden="true">${L.map((w) => Array.from({ length: 9 }, (_, x) => (x < w ? `<i style="--x:${x}"></i>` : "<s></s>")).join("")).join("")}</div>`;
  }
  function rail(d, n) {
    const p = d.jours.map((x) => {
      const ok = x.ouvert || d.staff, cls = [x.numero === n && "is-on", ok && "is-open", fini(x.numero) && "is-fini"].filter(Boolean).join(" ");
      return ok ? `<a class="${cls}" href="espace.html?jour=${x.numero}" data-go title="Jour ${x.numero}" aria-label="Jour ${x.numero}"></a>`
                : `<span class="${cls}" title="Jour ${x.numero} · ${esc(court(ms(x)))}"></span>`;
    }).join("");
    return `<nav class="rail" aria-label="Les jours">${p}<a class="rail-tout" href="espace.html" data-go>Les ${d.jours.length} jours</a></nav>`;
  }
  function blocEncart(s) {
    const [titre, ...corps] = lignes(s);
    if (!titre) return "";
    const gras = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return `<section class="encart"><h2>${esc(titre)}</h2>${corps.map((l) => `<p>${gras(l)}</p>`).join("")}</section>`;
  }
  /* Les prompts : le texte se remplit sur place, puis part dans le presse-papiers ou dans Claude. */
  /* Dans un prompt, {{cle|texte de repli}} prend la valeur du dossier, ou le repli s'il est vide. */
  function ciblePour(d) {
    const L = [["Profil", d.profil], ["Son objectif n°1", d.envie_objectif], ["Ce qu'elle n'arrive pas à obtenir seule", d.envie_seule],
      ["Ce qui la bloque le plus", d.douleur_blocage], ["Sa plus grande peur", d.douleur_peur], ["Ce qu'elle a déjà essayé", d.douleur_essaye]]
      .filter((x) => String(x[1] ?? "").trim());
    return L.length >= 3 ? L.map(([a, b]) => `- ${a} : ${String(b).trim()}`).join("\n") : "";
  }
  /* Les phrases de la cible, copiées mot pour mot : [{ t: la phrase }, …] */
  const phrasesDe = (d) => (Array.isArray(d.phrases) ? d.phrases : []).filter((p) => p && String(p.t ?? "").trim());
  const CALCULS = {
    cible: ciblePour,
    phrases: (d) => phrasesDe(d).map((p) => String(p.t).trim()).join("\n"),
    angle1: (d) => lignes(d.angles)[0] || "",
  };
  const remplir = (t, d) => String(t).replace(/\{\{(\w+)\|([^}]*)\}\}/g, (_, k, repli) => (CALCULS[k] ? CALCULS[k](d) : String(d[k] ?? "").trim()) || repli);
  const promptsDe = (liste, dos) => (Array.isArray(liste) ? liste : []).filter((p) => p && p.texte).map((p) => ({ ...p, texte: remplir(p.texte, dos || {}) }));
  const brouillon = (n, i, base) => { const b = store.get(`stage.espace.p${n}`, {})[i]; return b && b.b === base && typeof b.v === "string" ? b.v : base; };

  function blocPrompts(liste, n, dos) {
    const ps = promptsDe(liste, dos);
    if (!ps.length) return "";
    return `<section class="prompts"><h2 class="jb-t">Les prompts du jour</h2><p class="prompts-aide">Ils reprennent ce que tu as écrit dans <a href="espace.html?dossier" data-go>ton dossier</a>. Ce qui reste entre [crochets], complète-le là-bas ou ici. Un prompt propose, c'est toi qui choisis.</p>${ps.map((p, i) => {
      const texte = brouillon(n, i, p.texte);
      return `<article class="prompt" data-i="${i}">
        <h3>${esc(p.titre || `Prompt ${i + 1}`)}</h3>
        ${p.quand ? `<p class="prompt-q"><b>Quand</b> ${esc(p.quand)}</p>` : ""}
        <textarea spellcheck="false" aria-label="${esc(p.titre || "Prompt")}" rows="${Math.min(14, Math.max(5, Math.ceil(texte.length / 70)))}">${esc(texte)}</textarea>
        <div class="prompt-b">
          <button type="button" class="btn btn-ink" data-copier>Copier</button>
          ${p.outil === "image" ? '<span class="prompt-n">À coller dans un outil qui génère des images, avec ta capture en pièce jointe.</span>' : '<button type="button" class="btn" data-claude>Ouvrir dans Claude ↗</button>'}
          <button type="button" class="prompt-r" data-reset ${texte === p.texte ? "hidden" : ""}>Revenir au texte d'origine</button>
        </div>
        ${p.apres ? `<p class="prompt-a"><b>Avec la réponse</b> ${esc(p.apres)}</p>` : ""}
      </article>`;
    }).join("")}</section>`;
  }
  function brancherPrompts(liste, n, dos) {
    const ps = promptsDe(liste, dos);
    $$(".prompt").forEach((el) => {
      const i = +el.dataset.i, p = ps[i], zone = $("textarea", el), reset = $("[data-reset]", el);
      if (!p || !zone) return;
      const garder = () => {
        const b = store.get(`stage.espace.p${n}`, {});
        if (zone.value === p.texte) delete b[i]; else b[i] = { b: p.texte, v: zone.value };
        store.set(`stage.espace.p${n}`, b);
        reset.hidden = zone.value === p.texte;
      };
      zone.addEventListener("input", garder);
      reset.addEventListener("click", () => { zone.value = p.texte; garder(); });
      $("[data-copier]", el).addEventListener("click", async (e) => {
        const b = e.currentTarget;
        try { await navigator.clipboard.writeText(zone.value); }
        catch { zone.select(); try { document.execCommand("copy"); } catch {} }
        b.textContent = "Copié";
        setTimeout(() => { b.textContent = "Copier"; }, 1600);
        track("espace_prompt", { jour: n, prompt: i, action: "copier" });
      });
      $("[data-claude]", el)?.addEventListener("click", () => {
        window.open(`https://claude.ai/new?q=${encodeURIComponent(zone.value)}`, "_blank", "noopener");
        track("espace_prompt", { jour: n, prompt: i, action: "claude" });
      });
    });
  }
  function ressource(l) {
    const k = l.lastIndexOf("|");
    const texte = (k > 0 ? l.slice(0, k) : l).trim(), url = (k > 0 ? l.slice(k + 1) : l).trim();
    if (!/^https?:\/\//i.test(url)) return "";
    return `<li>${lien(url, "", `<span>${esc(k > 0 ? texte : url.replace(/^https?:\/\//, ""))}</span><span class="ext">↗</span>`)}</li>`;
  }

  async function vueJour(n, id) {
    const [d, j, dr] = await Promise.all([api.espace(), api.jour(n), api.dossier().catch(() => null)]);
    if (id !== routeId) return;
    const dos = (dr && dr.donnees) || {};
    caler(j.maintenant);
    const quand = ms(j), total = d.jours.length;
    document.title = `Jour ${n} · Le Stage`;

    if (!j.ouvert && !j.apercu) {
      vue.innerHTML = `<div class="esp-w">${rail(d, n)}<section class="lock">
        <p class="eyebrow mono">Jour ${n} sur ${total}</p>
        <h1 class="h2">Ce jour s'ouvre ${esc(long(quand))} à ${esc(heure(quand))}${point}</h1>
        ${compte(quand, "cd-xl")}
        <div><a class="btn" href="espace.html" data-go>Retour au parcours</a></div>
      </section></div>`;
      battre(quand);
      return;
    }

    const src = adresseVideo(j.video);
    const player = src
      ? `<iframe src="${esc(src)}" title="La vidéo du jour ${n}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
      : `<div class="player-vide">${pixelPlay()}<p>La vidéo arrive.</p></div>`;
    const taches = lignes(j.taches), res = lignes(j.ressources).map(ressource).filter(Boolean);
    const coches = avancement(n);
    const plan = taches.length ? `<section><h2 class="jb-t">Plan d'action</h2><ul class="plan">${taches.map((t, i) => `<li><label><input type="checkbox" data-i="${i}" ${coches[i] ? "checked" : ""}><span class="box" aria-hidden="true"></span><span class="txt">${esc(t)}</span></label></li>`).join("")}</ul><p class="plan-note" id="note"></p></section>` : "";
    const cta = [DISCORD.jours && DISCORD.jours[n] && lien(DISCORD.jours[n], "btn btn-ink", `${ICONE_DISCORD}Discuter dans #jour-${n}`), DISCORD.contenu && lien(DISCORD.contenu, "btn", `${ICONE_DISCORD}Montrer mon contenu`), '<a class="btn" href="espace.html?dossier" data-go>Mon dossier</a>', d.coaching && lien(d.coaching, "btn", "Réserver un coaching")].filter(Boolean).join("");
    const cote = res.length || cta ? `<aside>${res.length ? `<h2 class="jb-t">Ressources</h2><ul class="res">${res.join("")}</ul>` : ""}${cta ? `<div class="jb-cta">${cta}</div>` : ""}</aside>` : "";
    const encart = blocEncart(j.encart), gauche = plan || encart ? `<div>${plan}${encart}</div>` : "";
    const avant = d.jours[n - 2], apres = d.jours[n];
    const accessible = (x) => x && (x.ouvert || d.staff);
    const pager = `<nav class="pager">${accessible(avant) ? `<a href="espace.html?jour=${n - 1}" data-go>← Jour ${n - 1}</a>` : "<i></i>"}${accessible(apres) ? `<a href="espace.html?jour=${n + 1}" data-go>Jour ${n + 1} →</a>` : apres ? `<span>Jour ${n + 1} · ${esc(court(ms(apres)))} à ${esc(heure(ms(apres)))}</span>` : "<i></i>"}</nav>`;

    vue.innerHTML = `<div class="esp-w">${rail(d, n)}
      <header class="jh">
        <p class="eyebrow mono">Jour ${n} sur ${total} · ${esc(long(quand))}</p>
        <h1 class="h2">${esc(j.titre || `Jour ${n}`)}${point}</h1>
        ${j.objectif ? `<p class="p">${esc(j.objectif)}</p>` : ""}
        ${j.apercu ? `<p class="apercu">Aperçu : s'ouvre pour la promo ${esc(court(quand))} à ${esc(heure(quand))}</p>` : ""}
      </header>
      <div class="player">${player}</div>
      ${gauche || cote ? `<div class="jb ${gauche && cote ? "" : "is-seul"}">${gauche}${cote}</div>` : ""}
      ${blocPrompts(j.prompts, n, dos)}
      ${pager}
    </div>`;
    track("espace_jour", { jour: n });
    brancherPlan(n, taches.length);
    brancherPrompts(j.prompts, n, dos);
    const prochain = apres && !apres.ouvert ? ms(apres) : 0;
    battre(prochain && !d.staff ? prochain : 0);
  }

  function brancherPlan(n, total) {
    if (!total) return;
    const note = $("#note"), boites = $$(".plan input");
    const maj = () => {
      const faits = boites.filter((b) => b.checked).length;
      note.textContent = faits === total ? "Tout est fait. On se voit sur le Discord." : `${faits} / ${total}`;
      return faits;
    };
    maj();
    boites.forEach((b) => b.addEventListener("change", () => {
      store.set(`stage.espace.j${n}`, boites.map((x) => x.checked));
      const faits = maj(), r = b.getBoundingClientRect();
      if (b.checked) burst(r.left + 10, r.top + 12, faits === total ? { n: 44, r: 240, sizes: [5, 11], dur: [900, 1600] } : { n: 10, r: 44, sizes: [3, 6] });
      if (faits === total) track("espace_jour_fini", { jour: n });
      $(".rail .is-on")?.classList.toggle("is-fini", faits === total);
    }));
  }

  /* ---------- le dossier ------------------------------------------------- */
  /* Tout ce que l'élève remplit vit ici : plus aucun Google Sheet à copier.
     g : un intertitre au-dessus du champ · court : une ligne · rows : hauteur de départ
     · liste : une case par entrée, avec ce bouton pour en ajouter · objectif : le nombre d'entrées visé
     · prompt : le prompt du jour (titre qui contient ces mots) à lancer depuis ce champ, rempli au moment du clic
     · nom : comment on désigne le champ quand il manque au prompt
     · checklist : le champ devient la checklist « Feature TikTokable » quand Supabase la fournit (sinon une simple liste).
     Les exemples affichés sous chaque question viennent de Supabase (reglages.dossier_exemples). */
  const DOSSIER = [
    { titre: "Ton app", jour: 1, champs: [
      { k: "app_nom", l: "Son nom", court: true },
      { k: "app_fait", l: "Ce qu'elle fait, en 2 phrases" },
      { k: "app_probleme", l: "Le problème qu'elle règle, en une phrase" },
      { k: "feature", l: "Tes features, passées à la checklist « Feature TikTokable »", aide: "Celles qui ont eu 5 ou 6 oui à la checklist « Feature TikTokable ».", liste: "Ajouter une feature", min: 2, max: 300, checklist: true },
    ] },
    { titre: "Ta cible", jour: 1, intro: "Une personne qu'on pourrait croiser dans la rue, pas « les gens qui veulent… ».", champs: [
      { k: "profil", g: "Son profil", l: "Qui est-ce ?", nom: "son profil", aide: "Prénom, âge, situation, débutante ou pas dans le sujet, métier, journée type.", rows: 2 },
      { k: "envie_objectif", g: "Ses envies", l: "Son objectif n°1" },
      { k: "envie_seule", l: "Ce qu'elle veut, mais n'arrive pas à avoir seule" },
      { k: "douleur_blocage", g: "Ses douleurs", l: "Ce qui la bloque le plus" },
      { k: "douleur_peur", l: "Sa plus grande peur" },
      { k: "douleur_essaye", l: "Ce qu'elle a déjà essayé" },
      { k: "sous_niche", g: "Ta sous-niche et ta phrase", l: "Ta sous-niche", aide: "La plus petite audience qui a ce problème tous les jours.", court: true },
      { k: "phrase", l: "Ta phrase", ph: "Mon app aide les … à …, …" },
    ] },
    { titre: "Tes mots-clés", jour: 1, intro: "Ce que ta cible tape dans la recherche TikTok, avec ses mots à elle.", champs: [
      { k: "mots_cles", l: "10 à 15 recherches, une par case", liste: "Ajouter un mot-clé", objectif: 10, prompt: "mots-clés" },
    ] },
  ];
  const ANGLES = { k: "angles", l: "Tes angles, ton angle n°1 dans la case 1", aide: "Entre 3 et 6. Avec le prompt des angles, colle son bloc de code dans la première case : chaque angle va dans sa case. Renomme ceux qui ne te parlent pas.", liste: "Ajouter un angle", min: 4, max: 120 };
  const HOOKS = { k: "hooks", l: "Les hooks que tu gardes, réécrits à ta manière", aide: "Vise 12 : 3 par type de post.", liste: "Ajouter un hook", min: 4, max: 300 };
  const N_PHRASES = 30, N_VIRAL = 20, N_HOOKS = 12, PAR_TYPE = 5;
  const TYPES = ["POV", "Storytelling", "Avant / Après", "Tips & conseils"];
  const rempli = (d, k) => !!String(d[k] ?? "").trim();
  /* La Viral Bank : [{ u: le lien, n: ce qui inspire, y: le type de post (jour 3) }, …] */
  const viralDe = (d) => (Array.isArray(d.viral) ? d.viral : []).filter((v) => v && (String(v.u ?? "").trim() || String(v.n ?? "").trim()));
  const parType = (d, t) => viralDe(d).filter((v) => v.y === t).length;
  const hooksOk = (d) => lignes(d.hooks).length >= N_HOOKS;
  /* Ce qui compte dans l'avancement, chaque étape rattachée au jour où sa partie apparaît. */
  const ETAPES = [
    ...DOSSIER.flatMap((s) => s.champs.map((c) => ({ jour: s.jour, ok: (d) => rempli(d, c.k) }))),
    { jour: 2, ok: (d) => viralDe(d).length >= N_VIRAL },
    { jour: 2, ok: (d) => phrasesDe(d).length >= N_PHRASES },
    { jour: 3, ok: (d) => TYPES.every((t) => parType(d, t) >= PAR_TYPE) },
    { jour: 3, ok: (d) => lignes(d.angles).length >= 3 },
    { jour: 3, ok: hooksOk },
  ];
  /* Une partie du dossier n'apparaît qu'une fois son jour ouvert (le staff voit tout, en aperçu). */
  const jourOuvert = (e, n) => { const j = e.jours.find((x) => x.numero === n); return !j || j.ouvert || !!e.staff; };
  const etapesDe = (e) => ETAPES.filter((x) => jourOuvert(e, x.jour));
  const remplis = (d, liste = ETAPES) => liste.filter((x) => x.ok(d)).length;
  let viderDossier = null;
  addEventListener("visibilitychange", () => { if (document.hidden && viderDossier) viderDossier(); });

  async function vueDossier(id) {
    const [e, r, j1] = await Promise.all([api.espace(), api.dossier(), api.jour(1).catch(() => null)]);
    if (id !== routeId) return;
    caler(e.maintenant);
    const d = { ...(r.donnees || {}) }, ex = r.exemples || {};
    const ck = r.checklist && Array.isArray(r.checklist.questions) && r.checklist.questions.length ? r.checklist : null;
    document.title = "Mon dossier · Le Stage";
    const ouvert = (n) => jourOuvert(e, n);
    const apercu = e.staff && e.jours.some((j) => j.numero <= 3 && !j.ouvert);
    /* L'en-tête d'un bloc : son jour (et, pour le staff, quand il s'ouvrira), son titre, son avancement. */
    const tete = (titre, sid, n, etiquette) => {
      const j = e.jours.find((x) => x.numero === n), plusTard = j && !j.ouvert;
      return `<p class="eyebrow dos-j">${esc(etiquette || `Jour ${n}`)}${plusTard ? ` · aperçu, s'ouvre le ${esc(court(ms(j)))} à ${esc(heure(ms(j)))}` : ""}</p>
        <div class="dos-st"><h2 class="jb-t">${esc(titre)}</h2><span class="dos-prog" data-prog="${sid}"></span></div>`;
    };
    const exemple = (k) => (ex[k] ? `<p class="dos-i dos-ex"><b class="mono">Ex.</b>${esc(ex[k])}</p>` : "");
    /* Un prompt du jour lancé depuis le dossier : il se remplit au moment du clic, avec ce qui est écrit à cet instant. */
    const TOUS = DOSSIER.flatMap((x) => x.champs);
    const NOMS = { cible: "ta cible", ...Object.fromEntries(TOUS.map((c) => [c.k, c.nom || c.l.charAt(0).toLowerCase() + c.l.slice(1)])) };
    const promptDe = (c) => (c && c.prompt ? (j1 && Array.isArray(j1.prompts) ? j1.prompts : []).find((p) => p && p.texte && String(p.titre || "").toLowerCase().includes(c.prompt)) : null);
    const manquants = (p) => [...new Set([...p.texte.matchAll(/\{\{(\w+)\|/g)].map((m) => m[1]))]
      .filter((k) => !String((CALCULS[k] ? CALCULS[k](d) : d[k]) ?? "").trim()).map((k) => NOMS[k] || k);
    const enListe = (l) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : l[0] || "");
    const blocPrompt = (c) => (promptDe(c) ? `<div class="dos-pr" data-pr="${c.k}">
        <p class="dos-pr-t"><b>Le prompt des ${esc(c.prompt)}</b> · il reprend ce que tu as écrit dans ton dossier.</p>
        <p class="dos-pr-m" data-manque></p>
        <div class="prompt-b"><button type="button" class="btn btn-ink" data-copier>Copier le prompt</button><button type="button" class="btn" data-claude>Ouvrir dans Claude ↗</button></div>
        <details class="dos-pr-v"><summary>Voir le prompt</summary><pre data-texte></pre></details>
        <p class="dos-pr-a">Avec la réponse : garde celles qui sonnent comme ta cible, et colle-les dans la première case. Elles se rangent une par case.</p>
      </div>` : "");
    const champ = (c) => {
      if (c.checklist && ck) return `<div class="champ dos-c">
        <span class="dos-l sans-px">${esc(c.l)}</span>
        <small>Une carte par feature. Coche chaque oui : à partir de ${+ck.seuil || ck.questions.length - 1}, elle est ${esc(ck.oui || "TikTokable")}.</small>
        ${ex[c.k] ? `<small class="dos-ex"><b class="mono">Ex.</b>${esc(ex[c.k])}</small>` : ""}
        <div class="fx" id="fx"></div>
        <button class="btn btn-sm lst-plus" type="button" id="fxPlus">+ ${esc(c.liste)}</button>
        ${ck.non ? `<small class="fx-r">${esc(ck.non)}</small>` : ""}
        ${ck.retenir ? `<small class="fx-r"><b>À retenir.</b> ${esc(ck.retenir)}</small>` : ""}
      </div>`;
      if (c.liste) return `${c.g ? `<p class="dos-g mono">${esc(c.g)}</p>` : ""}<div class="champ dos-c">
        <span class="dos-l sans-px">${esc(c.l)}</span>
        ${c.aide ? `<small>${esc(c.aide)}</small>` : ""}
        ${ex[c.k] ? `<small class="dos-ex"><b class="mono">Ex.</b>${esc(ex[c.k])}</small>` : ""}
        ${blocPrompt(c)}
        <div class="lst" id="l_${c.k}"></div></div>`;
      const v = String(d[c.k] ?? ""), ph = c.ph ? ` placeholder="${esc(c.ph)}"` : "";
      const boite = c.court
        ? `<input name="${c.k}" type="text" autocomplete="off"${ph} maxlength="300" value="${esc(v)}">`
        : `<textarea name="${c.k}" rows="${c.rows || 1}"${ph} maxlength="4000" data-grow>${esc(v)}</textarea>`;
      return `${c.g ? `<p class="dos-g mono">${esc(c.g)}</p>` : ""}<label class="champ dos-c${v.trim() ? " is-ok" : ""}">
        <span class="dos-l">${esc(c.l)}</span>
        ${c.aide ? `<small>${esc(c.aide)}</small>` : ""}
        ${ex[c.k] ? `<small class="dos-ex"><b class="mono">Ex.</b>${esc(ex[c.k])}</small>` : ""}
        ${boite}</label>`;
    };
    const avecJ2 = ouvert(2), avecJ3 = ouvert(3);
    vue.innerHTML = `<div class="esp-w dos">
      <header class="jh">
        <p class="eyebrow mono"><a href="espace.html" data-go>← Les jours</a></p>
        <h1 class="h2">Mon dossier${point}</h1>
        <p class="p">Réponds avec tes mots, même court. Tes prompts s'en servent, et tout s'enregistre tout seul.</p>
        ${apercu ? `<p class="apercu">Aperçu staff : tu vois toutes les parties. Un élève ne voit que celles des jours déjà ouverts.</p>` : ""}
      </header>
      <form id="fDos" novalidate>${DOSSIER.map((s, i) => `<section class="dos-s">
        ${tete(s.titre, `s${i}`, s.jour)}
        ${s.intro ? `<p class="dos-i">${esc(s.intro)}</p>` : ""}
        ${s.champs.map(champ).join("")}
      </section>`).join("")}
      ${avecJ2 ? `<section class="dos-s">
        ${tete("Ta Viral Bank", "viral", 2)}
        <p class="dos-i">Les vidéos de ta niche à plus de 10 000 vues qui t'inspirent, aussi rangées dans ta collection TikTok « Viral Bank ». Vise au moins ${N_VIRAL}, et ajoutes-en dès que tu en trouves d'autres.${avecJ3 ? ` Au jour 3, range-les dans les 4 types de posts : ${PAR_TYPE} par type.` : ""}</p>
        ${exemple("viral")}
        ${avecJ3 ? `<div class="vt" id="vt"></div>` : ""}
        <div class="lst" id="lViral"></div>
      </section>
      <section class="dos-s">
        ${tete("Tes phrases", "phrases", 2)}
        <p class="dos-i">${N_PHRASES} phrases de ta cible, copiées mot pour mot : les hooks de ta Viral Bank, leurs commentaires, Reddit, les avis App Store. Tu peux en coller plusieurs d'un coup.</p>
        ${exemple("phrases")}
        <div class="lst" id="lPhrases"></div>
      </section>` : ""}
      ${avecJ3 ? `<section class="dos-s">
        ${tete("Tes angles et tes hooks", "angles", 3)}
        ${champ(ANGLES)}
        ${r.cle_kit ? `<div class="kit">
          <p class="kit-t"><b>Le moteur à hooks</b> · un kit Claude Code qui part de ton dossier et de 52 000 hooks qui ont marché sur TikTok, et t'écrit 10 hooks par angle.</p>
          <p class="kit-a">Ce sont des pistes, pas tes hooks. Choisis, réécris à ta manière, avec les mots de ta cible. Le risque, c'est de te laisser porter.</p>
          <div class="prompt-b">
            ${r.kit_hooks ? `<a class="btn btn-ink" href="${esc(r.kit_hooks)}" download>Télécharger le kit ↓</a>` : ""}
            <button type="button" class="btn" id="kitCle">Copier ma clé</button>
            <span class="kit-c mono">${esc(r.cle_kit.slice(0, 4))}…${esc(r.cle_kit.slice(-4))}</span>
          </div>
          <p class="kit-n">Dans le kit, tape /installer et colle ta clé. Elle ouvre ton dossier : ne la partage pas.</p>
        </div>` : ""}
        ${champ(HOOKS)}
      </section>` : ""}
      </form>
      <p class="dos-etat mono" id="dEtat" role="status" aria-live="polite"></p>
    </div>`;

    const etat = $("#dEtat"), ici = () => id === routeId;
    let cache = 0;
    const dire = (t, rate) => {
      if (!ici()) return;
      clearTimeout(cache);
      etat.textContent = t;
      etat.classList.toggle("is-rate", !!rate);
      etat.classList.add("is-on");
      if (t === "Enregistré") cache = setTimeout(() => etat.classList.remove("is-on"), 1600);
    };
    const grandir = (t) => { t.style.height = "auto"; t.style.height = `${t.scrollHeight + 2}px`; };
    $$("textarea[data-grow]").forEach(grandir);

    /* L'avancement de chaque bloc : un pixel par étape, ou un compteur pour les longues listes. */
    const SECTIONS = [
      ...DOSSIER.map((s, i) => {
        const liste = s.champs.length === 1 && s.champs[0].objectif ? s.champs[0] : null;
        return liste
          ? { id: `s${i}`, total: liste.objectif, n: () => Math.min(lignes(d[liste.k]).length, liste.objectif) }
          : { id: `s${i}`, total: s.champs.length, n: () => s.champs.filter((c) => rempli(d, c.k)).length };
      }),
      { id: "viral", total: N_VIRAL, n: () => viralDe(d).length },
      { id: "phrases", total: N_PHRASES, n: () => phrasesDe(d).length },
      { id: "angles", total: 2, n: () => (lignes(d.angles).length >= 3 ? 1 : 0) + (hooksOk(d) ? 1 : 0) },
    ];
    const compter = () => {
      for (const s of SECTIONS) {
        const el = $(`[data-prog="${s.id}"]`);
        if (!el) continue;
        const n = s.n();
        el.classList.toggle("is-fini", n >= s.total);
        el.setAttribute("aria-label", `${n} sur ${s.total}`);
        el.innerHTML = (s.total <= 8 ? Array.from({ length: s.total }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("") : "") + `<b class="mono">${n} / ${s.total}</b>`;
      }
      const vt = $("#vt");
      if (vt) vt.innerHTML = TYPES.map((t) => { const n = parType(d, t); return `<span${n >= PAR_TYPE ? ' class="is-ok"' : ""}>${esc(t)}<b class="mono">${n} / ${PAR_TYPE}</b></span>`; }).join("");
      for (const el of $$("[data-pr]")) {
        const p = promptDe(TOUS.find((c) => c.k === el.dataset.pr)), m = manquants(p), ligne = $("[data-manque]", el);
        ligne.textContent = m.length ? `Il manque encore ${enListe(m)}. Le prompt marche quand même, mais il sera moins précis.` : "Ta cible est complète : le prompt est prêt.";
        ligne.classList.toggle("is-pret", !m.length);
        if ($("details", el).open) $("[data-texte]", el).textContent = remplir(p.texte, d);
      }
    };
    let attente = {}, minuteur = 0, encours = false;
    const envoyer = async () => {
      clearTimeout(minuteur); minuteur = 0;
      if (encours || !Object.keys(attente).length) return;
      const lot = attente; attente = {}; encours = true;
      dire("Enregistrement…");
      try {
        await api.enregistrerDossier(lot);
        dire(Object.keys(attente).length ? "Enregistrement…" : "Enregistré");
      } catch (err) {
        attente = { ...lot, ...attente };
        dire(err.code === "reseau" ? "Pas de connexion. Je réessaie." : "Pas enregistré. Je réessaie.", true);
        if (ici()) minuteur = setTimeout(envoyer, 5000);
        encours = false;
        return;
      }
      encours = false;
      if (Object.keys(attente).length) envoyer();
    };
    viderDossier = envoyer;
    const noter = () => { compter(); clearTimeout(minuteur); minuteur = setTimeout(envoyer, 900); };

    /* Une liste de lignes (Viral Bank, phrases) : au moins `min` lignes, toujours 2 lignes vides
       sous la dernière remplie, et un bouton pour en ajouter une si on veut. Coller plusieurs lignes d'un coup remplit les suivantes
       (depuis un tableur, les colonnes séparées par des tabulations vont dans les colonnes suivantes). */
    const liste = (el, cle, cols, min, ajouter, enTexte) => {
      if (!el) return;
      const textes = cols.filter((c) => !c.options).map((c) => c.f);
      const plein = (x) => textes.some((f) => String(x[f] ?? "").trim());
      const vide = () => Object.fromEntries(cols.map((c) => [c.f, ""]));
      const depart = typeof d[cle] === "string" ? lignes(d[cle]).map((t) => ({ [cols[0].f]: t })) : Array.isArray(d[cle]) ? d[cle] : [];
      const L = depart.filter((x) => x && plein(x)).map((x) => Object.fromEntries(cols.map((c) => [c.f, String(x[c.f] ?? "")])));
      const gabarit = `22px ${cols.map((c) => c.w || "minmax(0, 1fr)").join(" ")}`;
      const completer = () => { let fin = 0; L.forEach((x, i) => { if (plein(x)) fin = i + 1; }); while (L.length < Math.max(min, fin + 2)) L.push(vide()); };
      const ligne = (x, i) => `<div class="lst-l" data-i="${i}" style="--cols: ${gabarit}"><span class="lst-n mono">${i + 1}</span>${cols.map((c) => (c.options
        ? `<select data-f="${c.f}" aria-label="${esc(c.l)}, ligne ${i + 1}"><option value="">${esc(c.ph || "—")}</option>${c.options.map((o) => `<option${o === x[c.f] ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : `<input data-f="${c.f}" type="text" autocomplete="off" aria-label="${esc(c.l)}, ligne ${i + 1}"${c.ph ? ` placeholder="${esc(c.ph)}"` : ""} maxlength="${c.max || 300}" value="${esc(x[c.f])}">`)).join("")}</div>`;
      const peindre = () => {
        completer();
        el.innerHTML = (cols.length > 1 ? `<div class="lst-t mono" aria-hidden="true" style="--cols: ${gabarit}"><span></span>${cols.map((c) => `<span>${esc(c.l)}</span>`).join("")}</div>` : "") + L.map(ligne).join("");
      };
      const garder = () => {
        const propres = L.filter(plein).map((x) => Object.fromEntries(cols.map((c) => [c.f, String(x[c.f]).trim()])));
        d[cle] = attente[cle] = enTexte ? propres.map((x) => x[cols[0].f]).join("\n") : propres;
        noter();
      };
      peindre();
      if (ajouter) {
        el.insertAdjacentHTML("afterend", `<button class="btn btn-sm lst-plus" type="button">+ ${esc(ajouter)}</button>`);
        /* Le bouton mène à la première ligne libre sous la dernière remplie, et en crée une s'il n'y en a plus. */
        el.nextElementSibling.addEventListener("click", () => {
          let fin = 0;
          L.forEach((x, i) => { if (plein(x)) fin = i + 1; });
          if (fin >= L.length) { L.push(vide()); el.insertAdjacentHTML("beforeend", ligne(L[fin], fin)); }
          const champ = el.querySelector(`.lst-l[data-i="${fin}"] input`);
          champ.focus();
          champ.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
        });
      }
      el.addEventListener("input", (ev) => {
        const l = ev.target.closest(".lst-l"), f = ev.target.dataset.f;
        if (!l || !f) return;
        ev.stopPropagation();
        const i = +l.dataset.i;
        L[i][f] = ev.target.value;
        if (i >= L.length - 2 && plein(L[i])) { const avant = L.length; completer(); el.insertAdjacentHTML("beforeend", L.slice(avant).map((x, k) => ligne(x, avant + k)).join("")); }
        garder();
      });
      el.addEventListener("paste", (ev) => {
        const l = ev.target.closest(".lst-l"), debut = textes.indexOf(ev.target.dataset.f), texte = (ev.clipboardData || window.clipboardData).getData("text");
        if (!l || debut < 0 || !/\n/.test(texte.trim())) return;
        ev.preventDefault();
        let i = +l.dataset.i;
        for (const c of texte.split(/\r?\n/).map((x) => x.split("\t")).filter((c) => c.some((v) => v.trim()))) {
          while (L.length <= i) L.push(vide());
          c.forEach((v, k) => { const f = textes[debut + k]; if (f) L[i][f] = v.trim().slice(0, 600); });
          i++;
        }
        peindre(); garder();
      });
    };
    liste($("#lViral"), "viral", [
      { f: "u", l: "Le lien de la vidéo", ph: "https://www.tiktok.com/…" },
      { f: "n", l: "Ce qui t'inspire", ph: "le hook, l'image, le format", w: "minmax(0, 1.3fr)" },
      ...(avecJ3 ? [{ f: "y", l: "Type de post", ph: "Type…", options: TYPES, w: "160px" }] : []),
    ], 5, "Ajouter une vidéo");
    liste($("#lPhrases"), "phrases", [{ f: "t", l: "La phrase, mot pour mot", max: 600 }], 10);
    /* Les champs du dossier en liste (features, mots-clés, angles, hooks) restent enregistrés en texte, une entrée par ligne :
       le prompt des hooks et le moteur à hooks lisent les angles ainsi, l'angle n°1 en premier. */
    for (const c of [...DOSSIER.flatMap((x) => x.champs), ANGLES, HOOKS].filter((x) => x.liste && !(x.checklist && ck))) liste($(`#l_${c.k}`), c.k, [{ f: "t", l: c.l, ph: c.ph, max: c.max || 120 }], c.min || 5, c.liste, true);
    compter();

    /* La checklist « Feature TikTokable » : une carte par feature, ses oui cochés, son score.
       d.features_check garde toutes les cartes ; d.feature ne garde que les noms TikTokables, un par ligne. */
    /* Le moteur à hooks : copier la clé du dossier, à coller dans le kit Claude Code. */
    const kitCle = $("#kitCle");
    if (kitCle) kitCle.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(r.cle_kit); }
      catch { const t = document.createElement("textarea"); t.value = r.cle_kit; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
      kitCle.textContent = "Clé copiée";
      setTimeout(() => { kitCle.textContent = "Copier ma clé"; }, 1600);
      track("espace_kit_hooks", { action: "cle" });
    });
    const fx = $("#fx");
    if (fx && ck) {
      const NQ = ck.questions.length, seuil = +ck.seuil || NQ - 1;
      const net = (x) => ({ n: String(x.n ?? ""), o: Array.from({ length: NQ }, (_, i) => !!(x.o || [])[i]) });
      const F = Array.isArray(d.features_check) ? d.features_check.map(net) : lignes(d.feature).map((n) => net({ n }));
      if (!F.length) F.push(net({}));
      const score = (x) => x.o.filter(Boolean).length;
      const plein = (x) => !!(x.n.trim() || score(x));
      const carte = (x, i) => `<div class="fx-c" data-i="${i}">
          <div class="fx-h"><span class="fx-n mono">${i + 1}</span><input data-f="n" type="text" autocomplete="off" maxlength="200" placeholder="Le nom de la feature" aria-label="Le nom de la feature ${i + 1}" value="${esc(x.n)}"><span class="fx-s mono"></span></div>
          <div class="fx-q">${ck.questions.map((qq, k) => `<label class="fx-o"><input type="checkbox" data-o="${k}"${x.o[k] ? " checked" : ""}><span class="box" aria-hidden="true"></span><span>${esc(qq.q)}${qq.note ? `<small>${esc(qq.note)}</small>` : ""}</span></label>`).join("")}</div>
          <p class="fx-v mono">${esc(ck.oui || "TikTokable")}</p>
        </div>`;
      const verdicts = () => $$(".fx-c", fx).forEach((el) => {
        const s = score(F[+el.dataset.i]);
        $(".fx-s", el).textContent = `${s} / ${NQ}`;
        el.classList.toggle("is-ok", s >= seuil);
      });
      const garder = () => {
        const propres = F.filter(plein).map((x) => ({ n: x.n.trim(), o: x.o.map((b) => (b ? 1 : 0)) }));
        d.features_check = attente.features_check = propres;
        d.feature = attente.feature = propres.filter((x) => x.n && x.o.filter(Boolean).length >= seuil).map((x) => x.n).join("\n");
        verdicts();
        noter();
      };
      fx.innerHTML = F.map(carte).join("");
      verdicts();
      fx.addEventListener("input", (ev) => {
        const c = ev.target.closest(".fx-c");
        if (!c) return;
        ev.stopPropagation();
        const x = F[+c.dataset.i];
        if (ev.target.dataset.f === "n") x.n = ev.target.value;
        else if (ev.target.dataset.o != null) x.o[+ev.target.dataset.o] = ev.target.checked;
        garder();
      });
      $("#fxPlus").addEventListener("click", () => {
        let i = F.findIndex((x) => !plein(x));
        if (i < 0) { F.push(net({})); i = F.length - 1; fx.insertAdjacentHTML("beforeend", carte(F[i], i)); verdicts(); }
        const champ = $(`.fx-c[data-i="${i}"] input[data-f="n"]`, fx);
        champ.focus();
        champ.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      });
    }
    for (const el of $$("[data-pr]")) {
      const p = promptDe(TOUS.find((c) => c.k === el.dataset.pr)), texte = () => remplir(p.texte, d);
      $("details", el).addEventListener("toggle", () => { $("[data-texte]", el).textContent = texte(); });
      $("[data-copier]", el).addEventListener("click", async (ev) => {
        const b = ev.currentTarget;
        try { await navigator.clipboard.writeText(texte()); }
        catch { const t = document.createElement("textarea"); t.value = texte(); document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
        b.textContent = "Copié";
        setTimeout(() => { b.textContent = "Copier le prompt"; }, 1600);
        track("espace_dossier_prompt", { champ: el.dataset.pr, action: "copier" });
      });
      $("[data-claude]", el).addEventListener("click", () => {
        window.open(`https://claude.ai/new?q=${encodeURIComponent(texte())}`, "_blank", "noopener");
        track("espace_dossier_prompt", { champ: el.dataset.pr, action: "claude" });
      });
    }
    $("#fDos").addEventListener("submit", (ev) => ev.preventDefault());
    $("#fDos").addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.matches("textarea[data-grow]")) grandir(el);
      if (!el.name) return;
      d[el.name] = attente[el.name] = el.value;
      const lab = el.closest(".dos-c");
      if (lab) lab.classList.toggle("is-ok", !!el.value.trim());
      noter();
    });
    $("#fDos").addEventListener("focusout", () => { if (Object.keys(attente).length) envoyer(); });
    track("espace_dossier", { remplis: remplis(d, etapesDe(e)) });
  }

  /* ---------- messages --------------------------------------------------- */
  function vueMessage(titre, texte, bouton) {
    clearInterval(ticker);
    vue.innerHTML = `<div class="esp-w"><section class="msg"><h1 class="h2">${esc(titre)}${point}</h1><p class="p">${esc(texte)}</p>${bouton || ""}</section></div>`;
  }

  /* ---------- l'aiguillage ----------------------------------------------- */
  let routeId = 0;
  async function route() {
    const id = ++routeId;
    clearInterval(ticker);
    if (!api) return vueMessage("Bientôt", "Ton espace ouvre avec la promo. Le lien arrive sur le Discord.");
    const session = await api.session();
    if (id !== routeId) return;
    if (!session) return vueConnexion();
    sortir.hidden = false;
    if (!vue.firstElementChild || vue.querySelector(".ac")) vue.innerHTML = '<div class="esp-load" aria-label="Chargement"><i></i><i></i><i></i></div>';
    const q = new URLSearchParams(location.search), n = parseInt(q.get("jour"), 10);
    if (viderDossier) { viderDossier(); viderDossier = null; }
    try {
      if (q.has("dossier")) await vueDossier(id);
      else if (n >= 1) await vueJour(n, id);
      else await vueParcours(id);
    } catch (e) {
      if (id !== routeId) return;
      if (e.code === "session") { await api.deconnexion(); return vueConnexion(); }
      if (e.code === "jour_inconnu") return aller("espace.html");
      if (e.code === "pas_inscrit") {
        vueMessage("Cette adresse n'est pas inscrite", `Tu es connecté avec ${session.email}, qui n'est pas sur la liste de la promo. Reconnecte-toi avec l'adresse de ton paiement.`, '<button class="btn" id="autre" type="button">Changer d\'adresse</button>');
        $("#autre").addEventListener("click", async () => { await api.deconnexion(); route(); });
        return;
      }
      vueMessage("Ça n'a pas chargé", message(e), '<button class="btn" id="encore" type="button">Réessayer</button>');
      $("#encore").addEventListener("click", route);
    }
  }
  route();
})();
