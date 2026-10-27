/* ============================================================
   Avis des anciens : note, texte, autorisations. Envoi via Web3Forms,
   mail pré-rempli en secours.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const FORM = (typeof SITE_DATA !== "undefined" && SITE_DATA.form) || {};
  const TO = FORM.to || "sacha.clauzade@gmail.com";

  /* ---------- stars --------------------------------------------- */
  const stars = $("#stars");
  const setLit = (n) => { stars.className = "stars" + (n ? " lit-" + n : ""); };
  $$("input", stars).forEach((r) => r.addEventListener("change", () => { setLit(+r.value); if (window.stageFx) { const b = r.parentElement.getBoundingClientRect(); window.stageFx.burst(b.left + 17, b.top + 17, { n: 8, r: 40 }); } }));
  $$("label", stars).forEach((l, i) => { l.addEventListener("mouseenter", () => setLit(i + 1)); l.addEventListener("mouseleave", () => setLit(+(val("note") || 0))); });

  /* ---------- counter ------------------------------------------- */
  const review = $("#review"), count = $("#count");
  review.addEventListener("input", () => { count.textContent = `${review.value.length} / 600`; });

  /* ---------- helpers ------------------------------------------- */
  const val = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const v = (id) => $(id).value.trim();
  const yn = (id) => ($(id).checked ? "oui" : "non");
  function shake(el, msg) {
    el.closest(".field, .stars")?.classList.add("is-error");
    el.animate([{ translate: "0 0" }, { translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 300 });
    el.focus(); if (msg) toast(msg);
    setTimeout(() => el.closest(".field, .stars")?.classList.remove("is-error"), 1200);
  }
  const toastEl = $("#toast"); let tt = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => (toastEl.hidden = true), 2800); }

  function answers() {
    const perms = [["okReview", "avis"], ["okName", "prénom"], ["okAvatar", "photo Discord"], ["okApp", "app + TikTok"], ["okResult", "chiffre"]];
    return {
      prenom: v("#firstName"), discord: v("#discord"), app: v("#app"), tiktok: v("#tiktok"),
      note: val("note") ? `${val("note")} / 5` : "—", avis: v("#review") || "—", chiffre: v("#result") || "—",
      autorise: perms.filter(([id]) => $("#" + id).checked).map(([, l]) => l).join(", ") || "rien",
      ok_avis: yn("#okReview"), ok_prenom: yn("#okName"), ok_photo: yn("#okAvatar"), ok_app: yn("#okApp"), ok_chiffre: yn("#okResult"),
    };
  }
  function mailto(a) {
    const body = [`Avis sur le Stage`, ``, `Prénom : ${a.prenom}`, `Discord : ${a.discord}`, `App : ${a.app}`, `TikTok : ${a.tiktok}`, `Note : ${a.note}`, ``, `Avis :`, a.avis, ``, `Chiffre : ${a.chiffre}`, ``, `Autorise : ${a.autorise}`].join("\n");
    return `mailto:${TO}?subject=${encodeURIComponent("Avis sur le Stage · " + a.prenom)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- send ---------------------------------------------- */
  const btn = $("#sendBtn");
  btn.addEventListener("click", async (e) => {
    if (!v("#firstName")) return shake($("#firstName"), "Ton prénom, au moins.");
    if (!v("#review")) return shake($("#review"), "Quelques lignes d'avis, même courtes.");
    if (btn.dataset.busy) return;
    const a = answers();
    if (!FORM.web3formsKey) { window.location.href = mailto(a); return; }
    btn.dataset.busy = "1"; btn.textContent = "Envoi…";
    try {
      const res = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({
        access_key: FORM.web3formsKey, subject: "Avis sur le Stage · " + a.prenom + (a.app ? " · " + a.app : ""), from_name: a.prenom || "Avis", botcheck: "", ...a,
      }) });
      const out = await res.json();
      if (!res.ok || !out.success) throw new Error(out.message || "envoi refusé");
      if (window.stageFx) window.stageFx.confetti(e.clientX, e.clientY);
      document.body.classList.add("is-sent");
      if (window.stageTrack) window.stageTrack("avis_envoye", { note: a.note });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      btn.textContent = "Envoyer mon avis"; delete btn.dataset.busy;
      toast("L'envoi direct a échoué, j'ouvre ton mail à la place.");
      setTimeout(() => { window.location.href = mailto(a); }, 900);
    }
  });
})();
