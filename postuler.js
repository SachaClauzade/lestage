/* ============================================================
   Candidature : App Store (iTunes Search, en JSONP), étapes, récap.
   Pas de serveur : l'envoi ouvre un mail pré-rempli.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TO = "sacha.clauzade@gmail.com";

  const state = { app: null, notLive: false, link: "" };

  /* ---------- App Store lookup (JSONP, no key needed) --------------- */
  const q = $("#appQuery"), stateEl = $("#appState"), results = $("#appResults"), card = $("#appCard");
  let timer = 0, seq = 0;
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "itunes_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const s = document.createElement("script");
      window[cb] = (data) => { resolve(data); delete window[cb]; s.remove(); };
      s.onerror = () => { reject(new Error("itunes")); delete window[cb]; s.remove(); };
      s.src = url + "&callback=" + cb;
      document.head.appendChild(s);
    });
  }
  async function search(term) {
    const my = ++seq;
    stateEl.textContent = "recherche…";
    try {
      const data = await jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=fr&limit=6`);
      if (my !== seq) return;
      const items = (data.results || []);
      stateEl.textContent = items.length ? `${items.length} résultat${items.length > 1 ? "s" : ""}` : "rien trouvé";
      results.innerHTML = items.map((a, i) => `<li data-i="${i}"><img src="${a.artworkUrl100}" alt=""><div><b>${esc(a.trackName)}</b><span>${esc(a.sellerName || a.artistName || "")} · ${a.averageUserRating ? a.averageUserRating.toFixed(1) + " ★" : "pas encore noté"}</span></div></li>`).join("");
      results.hidden = items.length === 0;
      $$("li", results).forEach((li) => li.addEventListener("click", () => pick(items[+li.dataset.i])));
    } catch { if (my === seq) stateEl.textContent = "App Store injoignable"; }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function pick(a) {
    state.app = { id: a.trackId, name: a.trackName, dev: a.sellerName || a.artistName, icon: a.artworkUrl100, rating: a.averageUserRating, count: a.userRatingCount, price: a.formattedPrice, url: a.trackViewUrl, genre: a.primaryGenreName };
    $("#appIcon").src = state.app.icon; $("#appName").textContent = state.app.name; $("#appDev").textContent = state.app.dev;
    $("#appFacts").textContent = [state.app.genre, state.app.rating ? `${state.app.rating.toFixed(1)} ★ (${state.app.count || 0})` : "pas encore noté", state.app.price].filter(Boolean).join(" · ");
    card.hidden = false; results.hidden = true; q.parentElement.parentElement.hidden = true;
    if (window.stageFx) { const r = card.getBoundingClientRect(); window.stageFx.burst(r.left + 40, r.top + 40, { n: 12, r: 60 }); window.stageFx.snd.coin(); }
  }
  if (q) {
    q.addEventListener("input", () => { clearTimeout(timer); const v = q.value.trim(); if (v.length < 2) { results.hidden = true; stateEl.textContent = ""; return; } timer = setTimeout(() => search(v), 320); });
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const first = results.querySelector("li"); if (first) first.click(); } });
  }
  $("#appChange").addEventListener("click", () => { state.app = null; card.hidden = true; q.parentElement.parentElement.hidden = false; q.value = ""; q.focus(); });
  $("#appNotLive").addEventListener("change", (e) => { state.notLive = e.target.checked; $("#appLinkField").hidden = !state.notLive; });

  /* ---------- steps ---------------------------------------------- */
  const steps = $$(".step"), dots = $$("#steps li");
  let cur = 1;
  function show(n) {
    cur = n;
    steps.forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
    dots.forEach((d) => { const k = +d.dataset.step; d.classList.toggle("is-current", k === n); d.classList.toggle("is-done", k < n); });
    if (n === 5) dots.forEach((d) => { d.classList.add("is-done"); d.classList.remove("is-current"); });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (n === 4) recap();
    if (window.stageFx) window.stageFx.snd.click();
  }
  function validate(n) {
    if (n === 1) {
      if (!state.app && !state.notLive) { shake(q); toast("Cherche ton app, ou coche « pas encore en ligne »."); return false; }
    }
    if (n === 2) {
      const fn = $("#firstName"), em = $("#email");
      if (!fn.value.trim()) { shake(fn); return false; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())) { shake(em); toast("Un email valide, pour que je puisse te répondre."); return false; }
    }
    return true;
  }
  function shake(el) { el.closest(".field, .search")?.classList.add("is-error"); el.animate([{ translate: "0 0" }, { translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 300 }); el.focus(); setTimeout(() => el.closest(".field, .search")?.classList.remove("is-error"), 1200); }
  $$("[data-next]").forEach((b) => b.addEventListener("click", () => { if (validate(cur)) show(cur + 1); }));
  $$("[data-prev]").forEach((b) => b.addEventListener("click", () => show(cur - 1)));

  /* ---------- recap + mail ---------------------------------------- */
  const labels = {
    role: { solo: "Dev solo", duo: "À deux", studio: "Un studio", nocode: "No-code" },
    tiktok: { jamais: "Jamais posté", moins1: "Poste depuis moins d'un mois", plus1: "Poste depuis plus d'un mois", marche: "Ça marche déjà un peu" },
    goal: { premiers: "Mes premiers téléchargements", "1000": "1 000 € par mois", structurer: "Structurer ce qui marche déjà" },
    time: { "2h": "2 h par semaine", "5h": "5 h par semaine", "10h": "10 h ou plus par semaine" },
  };
  const val = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
  function answers() {
    return {
      app: state.app ? `${state.app.name} (${state.app.dev}) · ${state.app.url}` : (state.notLive ? `Pas encore en ligne · ${$("#appLink").value.trim() || "pas de lien"}` : "—"),
      prenom: $("#firstName").value.trim(), email: $("#email").value.trim(),
      role: labels.role[val("role")], tiktok: labels.tiktok[val("tiktok")], handle: $("#tiktokHandle").value.trim(),
      objectif: labels.goal[val("goal")], temps: labels.time[val("time")], pourquoi: $("#why").value.trim(),
    };
  }
  function recap() {
    const a = answers();
    const appHtml = state.app ? `<span class="app"><img src="${state.app.icon}" alt="">${esc(state.app.name)} <span class="dim">· ${esc(state.app.dev)}</span></span>` : esc(a.app);
    $("#recap").innerHTML = `<dl>
      <div><dt>L'app</dt><dd>${appHtml}</dd></div>
      <div><dt>Toi</dt><dd>${esc(a.prenom)} · ${esc(a.email)} · ${esc(a.role)}</dd></div>
      <div><dt>TikTok</dt><dd>${esc(a.tiktok)}${a.handle ? " · " + esc(a.handle) : ""}</dd></div>
      <div><dt>Objectif</dt><dd>${esc(a.objectif)} · ${esc(a.temps)}</dd></div>
      <div><dt>Pourquoi</dt><dd>${a.pourquoi ? esc(a.pourquoi) : '<span class="dim">rien d\'écrit, c\'est ok</span>'}</dd></div>
    </dl>`;
    const body = [`Candidature au Stage`, ``, `App : ${a.app}`, `Prénom : ${a.prenom}`, `Email : ${a.email}`, `Profil : ${a.role}`, `TikTok : ${a.tiktok}${a.handle ? " · " + a.handle : ""}`, `Objectif : ${a.objectif}`, `Temps : ${a.temps}`, ``, `Pourquoi moi, pourquoi maintenant :`, a.pourquoi || "—"].join("\n");
    $("#sendBtn").href = `mailto:${TO}?subject=${encodeURIComponent("Candidature au Stage · " + (state.app ? state.app.name : a.prenom))}&body=${encodeURIComponent(body)}`;
  }
  const FORM = (typeof SITE_DATA !== "undefined" && SITE_DATA.form) || {};
  const sendBtn = $("#sendBtn");
  sendBtn.addEventListener("click", async (e) => {
    if (!FORM.web3formsKey) { if (window.stageFx) window.stageFx.confetti(e.clientX, e.clientY); toast("Ton mail s'ouvre avec ta candidature."); return; }
    e.preventDefault();
    if (sendBtn.dataset.busy) return;
    sendBtn.dataset.busy = "1"; sendBtn.textContent = "Envoi…";
    const a = answers();
    try {
      const res = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        access_key: FORM.web3formsKey, subject: "Candidature au Stage · " + (state.app ? state.app.name : a.prenom), from_name: a.prenom || "Candidature", replyto: a.email,
        app: a.app, prenom: a.prenom, email: a.email, profil: a.role, tiktok: a.tiktok + (a.handle ? " · " + a.handle : ""), objectif: a.objectif, temps: a.temps, pourquoi: a.pourquoi || "—", botcheck: "",
      }) });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "envoi refusé");
      if (window.stageFx) window.stageFx.confetti(e.clientX, e.clientY);
      show(5);
    } catch (err) {
      sendBtn.textContent = "Envoyer ma candidature"; delete sendBtn.dataset.busy;
      toast("L'envoi direct a échoué, j'ouvre ton mail à la place.");
      setTimeout(() => { window.location.href = sendBtn.href; }, 900);
    }
  });

  const toastEl = $("#toast"); let tt = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => (toastEl.hidden = true), 2800); }
})();
