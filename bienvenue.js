/* ============================================================
   Page d'acceptation : lit le candidat dans le fragment de l'URL
   (#prenom=…&email=…&app=…&mot=…&jusqu=…), remplit la page, et envoie vers
   le Payment Link Stripe avec le mail pré-rempli et une référence.
   Le fragment n'est jamais envoyé au serveur ni aux statistiques.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const CFG = (typeof SITE_DATA !== "undefined" && SITE_DATA.stripe) || {};
  const track = (n, d) => { if (window.stageTrack) window.stageTrack(n, d); };

  /* ---------- lecture du lien ------------------------------------- */
  function decode(h) {
    try {
      const b64 = h.replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { return null; }
  }
  function readHash(h) {
    if (!h) return null;
    if (h.includes("=")) {
      const q = new URLSearchParams(h);
      return { p: q.get("prenom") || "", e: q.get("email") || "", a: q.get("app") || "", m: q.get("mot") || "", d: q.get("jusqu") || "" };
    }
    return decode(h); // anciens liens, encodés
  }
  const data = readHash(location.hash.slice(1));
  if (!data || !data.p) { document.body.classList.add("is-generic"); track("acceptation_vue", { etat: "lien incomplet" }); return; }

  /* ---------- remplissage ------------------------------------------ */
  const prenom = String(data.p).trim(), email = String(data.e || "").trim(), app = String(data.a || "").trim();
  $("#prenom").textContent = prenom;
  $("#rApp").textContent = app || "—";
  $("#rEmail").textContent = email || "—";
  if (app) $("#welcomeIntro").textContent = `J'ai lu ta candidature pour ${app}, et c'est oui. Il te reste une chose à faire : réserver ta place.`;
  if (data.m) $("#sideMsg").textContent = data.m;
  document.title = `${prenom}, ta place · Le Stage`;

  const deadline = data.d ? new Date(data.d) : null;
  const fmt = (dt) => dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + " à " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const expired = deadline && !isNaN(deadline) && Date.now() > deadline.getTime();
  $("#rDeadline").textContent = deadline && !isNaN(deadline) ? (expired ? "délai passé" : "jusqu'au " + fmt(deadline)) : "quelques jours";
  if (expired) document.body.classList.add("is-expired");

  /* ---------- Stripe ----------------------------------------------- */
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
  const btn = $("#payBtn");
  if (!CFG.paymentLink) document.body.classList.add("is-nolink");
  else {
    const u = new URL(CFG.paymentLink);
    if (email) u.searchParams.set("prefilled_email", email);
    u.searchParams.set("client_reference_id", slug(prenom + (app ? "-" + app : "")) || "candidat");
    btn.href = u.toString();
    btn.addEventListener("click", () => track("paiement_clic", { app: app || "—" }));
  }
  track("acceptation_vue", { etat: expired ? "délai passé" : "ok" });
})();
