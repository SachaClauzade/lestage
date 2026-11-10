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
      async espace() { await attendre(120); return { prenom: "Sacha", staff, maintenant: new Date(horloge()).toISOString(), jours: jours() }; },
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
      async dossier() { await attendre(120); return { donnees: memoire.get("demo.dossier") || {}, modifie_le: null }; },
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
    const faits = dr ? remplis(dr.donnees || {}) : 0;
    const carte = dr ? `<a class="dos-carte" href="espace.html?dossier" data-go>
        <span class="dos-carte-t">Mon dossier</span>
        <span class="dos-carte-p">Ton app, ta cible, tes mots-clés, tes phrases, tes angles, tes hooks. Tu le remplis au fil des jours, tes prompts s'en servent.</span>
        <span class="dos-carte-n mono">${faits} / ${CHAMPS.length}${faits === CHAMPS.length ? " · complet" : ""}</span>
      </a>` : "";
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
    const sall = [DISCORD.general && lien(DISCORD.general, "btn", "#général"), DISCORD.contenu && lien(DISCORD.contenu, "btn", "#montre-ton-contenu")].filter(Boolean).join("");
    vue.innerHTML = `<div class="esp-w">${une}
      <ul class="cal">${d.jours.map((j) => caseJour(j, d, aujCase)).join("")}</ul>
      ${carte}
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
  /* Les phrases de la cible : [{ t: la phrase, s: la source, l: les likes, a: l'angle }, …] */
  const phrasesDe = (d) => (Array.isArray(d.phrases) ? d.phrases : []).filter((p) => p && String(p.t ?? "").trim());
  const lignePhrase = (p) => `${String(p.t).trim()}${+p.l > 0 ? ` (${+p.l} likes)` : ""}`;
  function anglesDe(d) {
    const m = new Map();
    for (const p of phrasesDe(d)) {
      const nom = String(p.a ?? "").trim();
      if (!nom) continue;
      const cle = nom.toLowerCase(), a = m.get(cle) || { nom, n: 0, likes: 0, phrases: [] };
      a.n++; a.likes += +p.l > 0 ? +p.l : 0; a.phrases.push(p);
      m.set(cle, a);
    }
    return [...m.values()].sort((x, y) => y.likes - x.likes || y.n - x.n);
  }
  const CALCULS = {
    cible: ciblePour,
    phrases: (d) => phrasesDe(d).map(lignePhrase).join("\n"),
    angle1: (d) => { const a = anglesDe(d)[0]; return a ? `Angle : ${a.nom}\n${a.phrases.map(lignePhrase).join("\n")}` : ""; },
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
    const cta = [DISCORD.jours && DISCORD.jours[n] && lien(DISCORD.jours[n], "btn btn-ink", `Discuter dans #jour-${n}`), DISCORD.contenu && lien(DISCORD.contenu, "btn", "Montrer mon contenu"), '<a class="btn" href="espace.html?dossier" data-go>Mon dossier</a>'].filter(Boolean).join("");
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
  const DOSSIER = [
    { titre: "Ton app", jour: 1, champs: [
      { k: "app_nom", l: "Le nom de ton app", ph: "BellySafe" },
      { k: "app_fait", l: "Ce qu'elle fait, en 2 phrases", long: 3 },
      { k: "app_probleme", l: "Le problème qu'elle règle, en une phrase", long: 2 },
      { k: "feature", l: "La feature que tu montres", aide: "Celle qui a passé la checklist « Feature TikTokable »." },
    ] },
    { titre: "Ta cible", jour: 1, intro: "Une personne qu'on pourrait croiser dans la rue, pas « les gens qui veulent… ».", champs: [
      { k: "profil", l: "Son profil", aide: "Prénom, âge, situation, débutante ou expérimentée dans le sujet, métier, journée type.", long: 3 },
      { k: "envie_objectif", l: "Son objectif n°1", long: 2 },
      { k: "envie_seule", l: "Ce qu'elle veut obtenir mais n'arrive pas à avoir seule", long: 2 },
      { k: "douleur_blocage", l: "Ce qui la bloque le plus", long: 2 },
      { k: "douleur_peur", l: "Sa plus grande peur", long: 2 },
      { k: "douleur_essaye", l: "Ce qu'elle a déjà essayé", long: 2 },
      { k: "sous_niche", l: "Ta sous-niche", ph: "femmes enceintes, première grossesse", aide: "La plus petite audience qui a ce problème tous les jours." },
      { k: "phrase", l: "Ta phrase", ph: "Mon app aide les … à …, …", long: 2 },
    ] },
    { titre: "Tes mots-clés", jour: 1, intro: "Les recherches que ta cible tape dans TikTok, avec ses mots à elle.", champs: [
      { k: "mots_cles", l: "10 à 15 recherches, une par ligne", long: 8, lignes: true },
    ] },
  ];
  const HOOKS = { k: "hooks", l: "Les hooks que tu gardes, un par ligne", aide: "Vise 12 : 3 par type de post.", long: 8, lignes: true };
  const SOURCES = ["TikTok", "Reddit", "App Store", "Autre"];
  const N_PHRASES = 30, N_HOOKS = 12;
  /* Ce qui compte dans l'avancement : chaque champ, plus les phrases, les angles et les hooks. */
  const ETAPES = [
    ...DOSSIER.flatMap((s) => s.champs).map((c) => (d) => !!String(d[c.k] ?? "").trim()),
    (d) => phrasesDe(d).length >= N_PHRASES,
    (d) => phrasesDe(d).length > 0 && phrasesDe(d).every((p) => String(p.a ?? "").trim()),
    (d) => lignes(d.hooks).length >= N_HOOKS,
  ];
  const CHAMPS = ETAPES;
  const remplis = (d) => ETAPES.filter((f) => f(d)).length;
  let viderDossier = null;
  addEventListener("visibilitychange", () => { if (document.hidden && viderDossier) viderDossier(); });

  async function vueDossier(id) {
    const r = await api.dossier();
    if (id !== routeId) return;
    const d = { ...(r.donnees || {}) };
    document.title = "Mon dossier · Le Stage";
    const champ = (c) => {
      const v = esc(d[c.k] ?? ""), ph = c.ph ? ` placeholder="${esc(c.ph)}"` : "";
      return `<label class="champ dos-c"><span>${esc(c.l)}${c.lignes ? ' <i class="dos-nb" data-nb></i>' : ""}</span>${c.aide ? `<small>${esc(c.aide)}</small>` : ""}${c.long
        ? `<textarea name="${c.k}" rows="${c.long}"${ph} maxlength="4000">${v}</textarea>`
        : `<input name="${c.k}" type="text" autocomplete="off"${ph} maxlength="300" value="${v}">`}</label>`;
    };
    vue.innerHTML = `<div class="esp-w dos">
      <header class="jh">
        <p class="eyebrow mono"><a href="espace.html" data-go>← Les jours</a></p>
        <h1 class="h2">Mon dossier${point}</h1>
        <p class="p">Tout ce que tu sais de ton app et de ta cible, au même endroit. Tu le remplis au fil des jours, et tes prompts se remplissent avec.</p>
        <p class="dos-etat mono"><span id="dNb"></span><span id="dEtat" role="status"></span></p>
      </header>
      <form id="fDos" novalidate>${DOSSIER.map((s) => `<section class="dos-s">
        <div class="dos-st"><h2 class="jb-t">${esc(s.titre)}</h2><span class="mono">Jour ${s.jour}</span></div>
        ${s.intro ? `<p class="dos-i">${esc(s.intro)}</p>` : ""}
        ${s.champs.map(champ).join("")}
      </section>`).join("")}
      <section class="dos-s">
        <div class="dos-st"><h2 class="jb-t">Tes phrases</h2><span class="mono">Jour 2 · <b id="pNb"></b></span></div>
        <p class="dos-i">${N_PHRASES} phrases de ta cible, copiées mot pour mot : les hooks de ta Viral Bank, leurs commentaires, Reddit, les avis App Store. Tu peux coller plusieurs lignes d'un coup dans une case, depuis un tableur aussi.</p>
        <div class="phr" id="phr"></div>
        <button class="btn btn-sm" id="pPlus" type="button">Ajouter 10 lignes</button>
      </section>
      <section class="dos-s">
        <div class="dos-st"><h2 class="jb-t">Tes angles et tes hooks</h2><span class="mono">Jour 3</span></div>
        <p class="dos-i">Un angle, c'est le problème ou l'envie dont parle une phrase. Lance le prompt des angles du jour 3, puis colle ici son 2e bloc de code : la colonne Angle de tes phrases se remplit dans l'ordre.</p>
        <label class="champ dos-c"><span>Les angles, un par ligne, dans l'ordre de tes phrases</span><textarea id="aColle" rows="4" placeholder="La peur de mal faire&#10;Les infos contradictoires&#10;…"></textarea></label>
        <div class="dos-a"><button class="btn btn-sm" id="aGo" type="button">Remplir la colonne Angle</button><span class="mono" id="aNote" role="status"></span></div>
        <div id="aTab"></div>
        ${champ(HOOKS)}
      </section></form>
    </div>`;

    const nb = $("#dNb"), etat = $("#dEtat"), ici = () => id === routeId;
    const dire = (t, rate) => { if (ici()) { etat.textContent = t; etat.classList.toggle("is-rate", !!rate); } };
    const compter = () => {
      nb.textContent = `${remplis(d)} / ${CHAMPS.length} étapes`;
      $$("[data-nb]").forEach((el) => { const n = lignes(el.closest("label").querySelector("textarea").value).length; el.textContent = n ? `· ${n}` : ""; });
    };
    compter();
    let attente = {}, minuteur = 0, encours = false;
    const envoyer = async () => {
      clearTimeout(minuteur); minuteur = 0;
      if (encours || !Object.keys(attente).length) return;
      const lot = attente; attente = {}; encours = true;
      dire("Enregistrement…");
      try {
        await api.enregistrerDossier(lot);
        dire(Object.keys(attente).length ? "Enregistrement…" : "Enregistré");
      } catch (e) {
        attente = { ...lot, ...attente };
        dire(e.code === "reseau" ? "Pas de connexion. Je réessaie." : "Pas enregistré. Je réessaie.", true);
        if (ici()) minuteur = setTimeout(envoyer, 5000);
        encours = false;
        return;
      }
      encours = false;
      if (Object.keys(attente).length) envoyer();
    };
    viderDossier = envoyer;
    const noter = () => { compter(); dire("…"); clearTimeout(minuteur); minuteur = setTimeout(envoyer, 900); };

    /* Les phrases : un tableau de lignes, toujours au moins N_PHRASES à l'écran. */
    const phr = $("#phr");
    let P = phrasesDe(d).map((p) => ({ t: String(p.t), s: SOURCES.includes(p.s) ? p.s : SOURCES[0], l: +p.l > 0 ? Math.round(+p.l) : "", a: String(p.a ?? "") }));
    const vide = () => ({ t: "", s: SOURCES[0], l: "", a: "" });
    const completer = (n) => { while (P.length < n) P.push(vide()); };
    const peindrePhrases = () => {
      completer(N_PHRASES);
      const noms = anglesDe({ phrases: P }).map((a) => a.nom);
      phr.innerHTML = `<div class="phr-t mono" aria-hidden="true"><span></span><span>La phrase, mot pour mot</span><span>Source</span><span>Likes</span><span>Angle</span></div>${P.map((p, i) => `<div class="phr-l" data-i="${i}">
        <span class="phr-n mono">${i + 1}</span>
        <input data-f="t" type="text" aria-label="Phrase ${i + 1}" maxlength="600" value="${esc(p.t)}">
        <select data-f="s" aria-label="Source de la phrase ${i + 1}">${SOURCES.map((s) => `<option${s === p.s ? " selected" : ""}>${s}</option>`).join("")}</select>
        <input data-f="l" type="text" inputmode="numeric" aria-label="Likes de la phrase ${i + 1}" maxlength="9" value="${esc(p.l)}">
        <input data-f="a" type="text" list="aNoms" aria-label="Angle de la phrase ${i + 1}" maxlength="80" value="${esc(p.a)}">
      </div>`).join("")}<datalist id="aNoms">${noms.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;
    };
    const peindreAngles = () => {
      const A = anglesDe({ phrases: P }), sans = phrasesDe({ phrases: P }).filter((p) => !p.a.trim()).length;
      $("#pNb").textContent = `${phrasesDe({ phrases: P }).length} / ${N_PHRASES}`;
      $("#aTab").innerHTML = A.length ? `<table class="ang"><thead><tr><th>Angle</th><th>Phrases</th><th>Likes</th></tr></thead><tbody>${A.map((a, i) => `<tr${i ? "" : ' class="is-1"'}><td>${esc(a.nom)}${i ? "" : " <i>ton angle n°1</i>"}</td><td>${a.n}</td><td>${a.likes || "—"}</td></tr>`).join("")}</tbody></table>${sans ? `<p class="dos-i">${sans} phrase${sans > 1 ? "s" : ""} sans angle.</p>` : ""}` : "";
    };
    const garderPhrases = () => {
      d.phrases = attente.phrases = phrasesDe({ phrases: P }).map((p) => ({ t: p.t.trim(), s: p.s, l: +p.l > 0 ? Math.round(+p.l) : 0, a: p.a.trim() }));
      peindreAngles();
      noter();
    };
    peindrePhrases(); peindreAngles();
    phr.addEventListener("input", (e) => {
      const l = e.target.closest(".phr-l"), f = e.target.dataset.f;
      if (!l || !f) return;
      e.stopPropagation();
      if (f === "l") e.target.value = e.target.value.replace(/\D/g, "");
      P[+l.dataset.i][f] = e.target.value;
      garderPhrases();
    });
    phr.addEventListener("paste", (e) => {
      const l = e.target.closest(".phr-l"), texte = (e.clipboardData || window.clipboardData).getData("text");
      if (!l || e.target.dataset.f !== "t" || !/\n/.test(texte.trim())) return;
      e.preventDefault();
      const recues = texte.split(/\r?\n/).map((x) => x.split("\t")).filter((c) => c[0] && c[0].trim());
      let i = +l.dataset.i;
      completer(i + recues.length);
      for (const c of recues) {
        const likes = (c[1] || "").replace(/\D/g, "");
        P[i] = { ...P[i], t: c[0].trim().slice(0, 600), l: likes ? +likes : P[i].l };
        i++;
      }
      peindrePhrases(); garderPhrases();
    });
    $("#pPlus").addEventListener("click", () => { completer(P.length + 10); peindrePhrases(); });
    $("#aGo").addEventListener("click", () => {
      const noms = lignes($("#aColle").value).map((x) => x.replace(/^[-*\d.\s]+/, "").slice(0, 80)), cibles = P.filter((p) => p.t.trim());
      const note = $("#aNote");
      if (!noms.length) { note.textContent = "Colle d'abord les angles."; return; }
      if (noms.length !== cibles.length) { note.textContent = `Tu as ${cibles.length} phrase${cibles.length > 1 ? "s" : ""} et ${noms.length} angle${noms.length > 1 ? "s" : ""} : il en faut autant.`; return; }
      cibles.forEach((p, i) => { p.a = noms[i]; });
      $("#aColle").value = ""; note.textContent = "Colonne remplie.";
      peindrePhrases(); garderPhrases();
    });

    $("#fDos").addEventListener("submit", (e) => e.preventDefault());
    $("#fDos").addEventListener("input", (e) => {
      const el = e.target;
      if (!el.name) return;
      d[el.name] = attente[el.name] = el.value;
      noter();
    });
    $("#fDos").addEventListener("focusout", () => { if (Object.keys(attente).length) envoyer(); });
    track("espace_dossier", { remplis: remplis(d) });
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
