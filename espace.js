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
          ressources: plein ? "Le Sheet du jour | https://docs.google.com/\nLes prompts (PDF) | https://example.com/prompts.pdf" : null };
      },
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
    const d = await api.espace();
    if (id !== routeId) return;
    caler(d.maintenant);
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
  function ressource(l) {
    const k = l.lastIndexOf("|");
    const texte = (k > 0 ? l.slice(0, k) : l).trim(), url = (k > 0 ? l.slice(k + 1) : l).trim();
    if (!/^https?:\/\//i.test(url)) return "";
    return `<li>${lien(url, "", `<span>${esc(k > 0 ? texte : url.replace(/^https?:\/\//, ""))}</span><span class="ext">↗</span>`)}</li>`;
  }

  async function vueJour(n, id) {
    const [d, j] = await Promise.all([api.espace(), api.jour(n)]);
    if (id !== routeId) return;
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
    const cta = [DISCORD.jours && DISCORD.jours[n] && lien(DISCORD.jours[n], "btn btn-ink", `Discuter dans #jour-${n}`), DISCORD.contenu && lien(DISCORD.contenu, "btn", "Montrer mon contenu")].filter(Boolean).join("");
    const cote = res.length || cta ? `<aside>${res.length ? `<h2 class="jb-t">Ressources</h2><ul class="res">${res.join("")}</ul>` : ""}${cta ? `<div class="jb-cta">${cta}</div>` : ""}</aside>` : "";
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
      ${plan || cote ? `<div class="jb ${plan && cote ? "" : "is-seul"}">${plan}${cote}</div>` : ""}
      ${pager}
    </div>`;
    track("espace_jour", { jour: n });
    brancherPlan(n, taches.length);
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
    const n = parseInt(new URLSearchParams(location.search).get("jour"), 10);
    try {
      if (n >= 1) await vueJour(n, id);
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
