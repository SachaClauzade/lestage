/* ============================================================
   Le Stage · interactions
   Ressorts maison, boops, tilt 3D, particules, étincelles, sons
   synthétisés, œil qui suit, courbe RevenueCat, vidéos TikTok.
   Tout respecte prefers-reduced-motion.
   ============================================================ */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const DATA = (typeof SITE_DATA !== "undefined" && SITE_DATA) || { videos: [], revenue: { series: [], stats: [] } };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const root = document.documentElement;
  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const COLORS = () => [cssVar("--px"), cssVar("--px"), cssVar("--c1"), cssVar("--c2"), cssVar("--c3"), cssVar("--c4"), cssVar("--ink")];
  const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  /* ---------- spring: a tiny physics integrator ------------------- */
  function makeSpring({ tension = 300, friction = 10, mass = 1 } = {}) {
    return function step(s) {
      const dt = 1 / 60;
      const force = -tension * (s.value - s.target);
      const damping = -friction * s.velocity;
      s.velocity += ((force + damping) / mass) * dt;
      s.value += s.velocity * dt;
      if (Math.abs(s.velocity) < 0.01 && Math.abs(s.value - s.target) < 0.01) { s.value = s.target; s.velocity = 0; s.done = true; }
      else s.done = false;
      return s;
    };
  }

  /* ---------- sound: off. The snd.* calls stay as no-ops so the
     interactions keep their hooks if the sounds ever come back. ----- */
  const noop = () => {};
  const snd = { click: noop, tick: noop, pop: noop, on: noop, off: noop, win: noop, boom: noop, whoosh: noop, coin: noop };
  const soundBtn = $("#soundToggle");
  if (soundBtn) soundBtn.remove();

  /* ---------- theme ---------------------------------------------- */
  const themeBtn = $("#themeToggle");
  const savedTheme = store.get("stage.theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  function isDark() { return root.getAttribute("data-theme") !== "light"; }
  function renderTheme() { if (themeBtn) themeBtn.setAttribute("aria-label", isDark() ? "Activer le mode clair" : "Activer le mode sombre"); }
  renderTheme();
  if (themeBtn) themeBtn.addEventListener("click", (e) => {
    root.setAttribute("data-theme", isDark() ? "light" : "dark"); store.set("stage.theme", root.getAttribute("data-theme")); renderTheme();
    snd.pop(); burst(e.clientX || innerWidth / 2, e.clientY || 40, { n: 12, r: 60 });
  });

  /* ---------- boop ----------------------------------------------- */
  const boopSpring = makeSpring({ tension: 300, friction: 10 });
  function parseBoop(str) {
    const o = { x: 0, y: 0, rotate: 0, scale: 1 };
    (str || "").split(";").forEach((kv) => { const [k, v] = kv.split(":"); if (k && v !== undefined) o[k.trim()] = parseFloat(v); });
    return o;
  }
  function setupBoop(el) {
    const target = parseBoop(el.dataset.boop);
    const s = { value: 0, velocity: 0, target: 0, done: true };
    let raf = 0, timer = 0;
    function frame() {
      boopSpring(s);
      const t = s.value;
      el.style.transform = `translate(${target.x * t}px, ${target.y * t}px) rotate(${target.rotate * t}deg) scale(${1 + (target.scale - 1) * t})`;
      if (!s.done) raf = requestAnimationFrame(frame); else { el.style.transform = ""; raf = 0; }
    }
    function trigger() {
      if (reduced) return;
      s.target = 1; if (!raf) raf = requestAnimationFrame(frame);
      clearTimeout(timer);
      timer = setTimeout(() => { s.target = 0; if (!raf) raf = requestAnimationFrame(frame); }, 150);
    }
    el.addEventListener("mouseenter", trigger);
    el.addEventListener("focus", trigger);
    el.addEventListener("touchstart", trigger, { passive: true });
  }
  $$(".boop").forEach(setupBoop);

  /* ---------- tilt: cards lean toward the cursor, spring back ------- */
  const tiltSpring = makeSpring({ tension: 170, friction: 14 });
  function setupTilt(el) {
    if (reduced || !window.matchMedia("(hover: hover)").matches) return;
    const rx = { value: 0, velocity: 0, target: 0, done: true }, ry = { value: 0, velocity: 0, target: 0, done: true };
    let raf = 0;
    const max = parseFloat(el.dataset.tilt || "6");
    function frame() {
      tiltSpring(rx); tiltSpring(ry);
      el.style.transform = `perspective(900px) rotateX(${rx.value}deg) rotateY(${ry.value}deg)`;
      if (!rx.done || !ry.done) raf = requestAnimationFrame(frame); else { raf = 0; if (rx.target === 0 && ry.target === 0) el.style.transform = ""; }
    }
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
      ry.target = px * max * 2; rx.target = -py * max * 2;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    el.addEventListener("pointerleave", () => { rx.target = 0; ry.target = 0; if (!raf) raf = requestAnimationFrame(frame); });
  }
  $$(".tilt").forEach(setupTilt);

  /* ---------- particles ------------------------------------------ */
  const layer = $("#particles");
  function burst(x, y, { n = 14, r = 80, colors, sizes = [4, 8], dur = [700, 1100] } = {}) {
    if (reduced) return;
    const palette = colors || COLORS();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.className = "pt";
      p.style.setProperty("--x", x + "px"); p.style.setProperty("--y", y + "px");
      p.style.setProperty("--a", (i / n) * 360 + rand(-14, 14) + "deg");
      p.style.setProperty("--r", rand(r * 0.5, r * 1.3) + "px");
      p.style.setProperty("--rot", rand(-180, 180) + "deg");
      p.style.setProperty("--s", Math.round(rand(sizes[0], sizes[1])) + "px");
      p.style.setProperty("--d", Math.round(rand(dur[0], dur[1])) + "ms");
      p.style.setProperty("--c", palette[i % palette.length]);
      p.addEventListener("animationend", () => p.remove(), { once: true });
      frag.appendChild(p);
    }
    layer.appendChild(frag);
  }
  function confetti(x, y) {
    burst(x, y, { n: 44, r: 240, sizes: [5, 11], dur: [900, 1600] });
    setTimeout(() => burst(x + rand(-60, 60), y + rand(-30, 30), { n: 26, r: 170, sizes: [4, 8] }), 120);
  }

  /* ---------- sparkles: a wand trail in the hero ------------------- */
  const hero = $("#hero");
  let lastSpark = 0;
  if (!reduced && hero) hero.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastSpark < 70) return;
    lastSpark = now;
    const s = document.createElement("i");
    s.className = "spark";
    s.style.setProperty("--x", e.clientX + rand(-8, 8) + "px");
    s.style.setProperty("--y", e.clientY + rand(-8, 8) + "px");
    s.style.setProperty("--c", pick(COLORS()));
    s.addEventListener("animationend", () => s.remove(), { once: true });
    layer.appendChild(s);
  }, { passive: true });

  /* ---------- hero title: words spring in one by one ------------- */
  const heroTitle = $("#heroTitle");
  if (heroTitle && !reduced && document.visibilityState === "visible") {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement("span"); w.className = "w"; w.textContent = part;
            frag.appendChild(w);
            w.animate(
              [{ opacity: 0, transform: "translateY(18px) rotate(-3deg)" }, { opacity: 1, transform: "translateY(0) rotate(0)" }],
              { duration: 700, delay: 950 + i++ * 55, easing: "cubic-bezier(.2,1.6,.4,1)", fill: "backwards" }
            );
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(heroTitle);
  }

  /* ---------- mascot: eyes follow the cursor, squash on click ------ */
  // Works for any #mascot SVG with .pupil elements (rect x/y or circle cx/cy).
  // data-range on #mascot = how far a pupil may travel, in viewBox units.
  const mascotWrap = $("#mascotWrap"), mascot = $("#mascot");
  const pupils = mascot ? $$(".pupil", mascot) : [], sparkle = $("#sparkle"), mouth = $("#mouth");
  const eyeSpring = makeSpring({ tension: 180, friction: 14 });
  const ex = { value: 0, velocity: 0, target: 0, done: true }, ey = { value: 0, velocity: 0, target: 0, done: true };
  let eyeRaf = 0;
  const eyeRange = mascot ? parseFloat(mascot.dataset.range || "0.6") : 0;
  pupils.forEach((p) => {
    const circle = p.hasAttribute("cx");
    p.dataset.ax = circle ? "cx" : "x"; p.dataset.ay = circle ? "cy" : "y";
    p.dataset.bx = p.getAttribute(p.dataset.ax); p.dataset.by = p.getAttribute(p.dataset.ay);
  });
  function eyeFrame() {
    eyeSpring(ex); eyeSpring(ey);
    pupils.forEach((p) => {
      p.setAttribute(p.dataset.ax, (parseFloat(p.dataset.bx) + ex.value * eyeRange).toFixed(2));
      p.setAttribute(p.dataset.ay, (parseFloat(p.dataset.by) + ey.value * eyeRange).toFixed(2));
    });
    if (!ex.done || !ey.done) eyeRaf = requestAnimationFrame(eyeFrame); else eyeRaf = 0;
  }
  function lookAt(cx, cy) {
    const b = mascot.getBoundingClientRect();
    const dx = cx - (b.left + b.width / 2), dy = cy - (b.top + b.height * 0.36);
    const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 260);
    ex.target = (dx / dist) * k; ey.target = (dy / dist) * k;
    if (!eyeRaf) eyeRaf = requestAnimationFrame(eyeFrame);
  }
  if (mascotWrap && mascot && !reduced) {
    mascotWrap.classList.add("is-idle");
    window.addEventListener("pointermove", (e) => lookAt(e.clientX, e.clientY), { passive: true });
    window.addEventListener("scroll", () => { ey.target = 0.7; ex.target = 0; if (!eyeRaf) eyeRaf = requestAnimationFrame(eyeFrame); }, { passive: true });
  }
  const MOUTH_SMILE = '<rect x="6" y="13" width="1" height="1" fill="var(--paper)"/><rect x="7" y="14" width="2" height="1" fill="var(--paper)"/><rect x="9" y="13" width="1" height="1" fill="var(--paper)"/>';
  const MOUTH_BIG = '<rect x="5" y="13" width="1" height="1" fill="var(--paper)"/><rect x="6" y="14" width="4" height="1" fill="var(--pink)"/><rect x="10" y="13" width="1" height="1" fill="var(--paper)"/>';
  let happy = 0, happyTimer = 0;
  if (mascotWrap && mascot) mascotWrap.addEventListener("click", (e) => {
    snd.pop();
    const b = mascot.getBoundingClientRect();
    burst(b.left + b.width / 2, b.top + b.height * 0.45, { n: 20, r: 120 });
    const pixel = mascot.hasAttribute("shape-rendering");
    mascot.animate(
      [{ transform: "scale(1,1)" }, { transform: "scale(1.18,0.82)" }, { transform: "scale(0.92,1.1)" }, { transform: "scale(1.04,0.98)" }, { transform: "scale(1,1)" }],
      { duration: 520, easing: pixel ? "steps(4, jump-none)" : "cubic-bezier(.3,1.6,.5,1)" }
    );
    mascotWrap.classList.add("is-happy");
    if (sparkle) sparkle.setAttribute("opacity", "1");
    if (mouth) mouth.innerHTML = MOUTH_BIG;
    clearTimeout(happyTimer);
    happyTimer = setTimeout(() => { mascotWrap.classList.remove("is-happy"); if (sparkle) sparkle.setAttribute("opacity", "0"); if (mouth) mouth.innerHTML = MOUTH_SMILE; }, 900);
    happy++;
    if (happy === 7) { toast("ok ok, tu m'as eu. ❤"); snd.win(); confetti(e.clientX, e.clientY); happy = 0; }
  });

  /* ---------- the pixel: one square, alive -------------------------- */
  const pixel = $("#pixel");
  if (pixel && !reduced) {
    const home = () => { const r = pixel.getBoundingClientRect(); return { x: 0, y: 0 }; };
    const sx = { value: 0, velocity: 0, target: 0, done: true }, sy = { value: 0, velocity: 0, target: 0, done: true };
    const jump = makeSpring({ tension: 220, friction: 12 });
    let raf = 0, away = false, restTimer = 0;
    function frame() {
      jump(sx); jump(sy);
      pixel.style.transform = `translate(${sx.value}px, ${sy.value}px)`;
      if (!sx.done || !sy.done) raf = requestAnimationFrame(frame); else raf = 0;
    }
    function go(x, y) { sx.target = x; sy.target = y; if (!raf) raf = requestAnimationFrame(frame); }
    // land: drop in from above after the intro, with a little burst
    pixel.style.transform = "translate(0, -140px)"; sy.value = -140;
    setTimeout(() => { go(0, 0); setTimeout(() => { const r = pixel.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 10, r: 46, sizes: [3, 6] }); snd.coin(); }, 260); }, 1250);
    // hop onto any [data-pixel-target] on hover, come back on leave
    $$("[data-pixel-target]").forEach((t) => {
      t.addEventListener("mouseenter", () => {
        const a = pixel.getBoundingClientRect(), b = t.getBoundingClientRect();
        const base = { x: a.left - sx.value, y: a.top - sy.value };
        go(b.right - base.x - a.width - 10, b.top - base.y + 10); away = true; snd.tick();
      });
      t.addEventListener("mouseleave", () => { go(0, 0); away = false; });
    });
    // idle: a blink every few seconds, a tiny hop when clicked
    setInterval(() => { if (!away && Math.random() < 0.6) pixel.classList.add("blink"); setTimeout(() => pixel.classList.remove("blink"), 180); }, 2800);
    pixel.addEventListener("click", (e) => { go(0, -26); setTimeout(() => go(0, 0), 120); burst(e.clientX, e.clientY, { n: 8, r: 36, sizes: [3, 5] }); snd.pop(); });
  }

  /* ---------- hype layer: letters, trail, magnets, the talking bubble --- */
  if (heroTitle && !reduced) setTimeout(() => {
    $$(".w", heroTitle).forEach((w) => {
      if (w.querySelector(".l")) return;
      w.innerHTML = w.textContent.split("").map((ch) => `<span class="l">${ch}</span>`).join("");
    });
    const cols = ["--px", "--c1", "--c2", "--c3", "--c4"];
    $$(".l", heroTitle).forEach((l) => l.addEventListener("mouseenter", () => {
      l.style.setProperty("--hit", cssVar(pick(cols))); l.classList.add("is-hit");
      l.animate([{ transform: "translateY(0) rotate(0)" }, { transform: `translateY(-14px) rotate(${rand(-8, 8)}deg)` }, { transform: "translateY(0) rotate(0)" }], { duration: 480, easing: "cubic-bezier(.3,1.6,.5,1)" });
      snd.tick(); setTimeout(() => l.classList.remove("is-hit"), 500);
    }));
  }, 2200);
  if (pixel && !reduced) {
    let last = { x: 0, y: 0 };
    setInterval(() => {
      const r = pixel.getBoundingClientRect();
      if (Math.hypot(r.left - last.x, r.top - last.y) > 10 && last.x) {
        const g = document.createElement("i"); g.className = "px-ghost";
        g.style.left = r.left + "px"; g.style.top = r.top + "px"; g.style.width = r.width + "px"; g.style.height = r.height + "px";
        g.style.background = cssVar(pick(["--px", "--c1", "--c2"]));
        g.addEventListener("animationend", () => g.remove(), { once: true });
        layer.appendChild(g);
      }
      last = { x: r.left, y: r.top };
    }, 40);
  }
  if (!reduced && window.matchMedia("(hover: hover)").matches) $$(".magnet").forEach((b) => {
    b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`; });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });
  const sayText = $("#sayText");
  if (sayText) {
    const lines = ["Salut, moi c'est Sacha.", "Ma première app ? 200 vues par post, pendant deux mois.", "BellySafe : 6 200 € par mois, zéro pub.", "Je lis chaque candidature moi-même.", "Si ton app n'est pas prête, je te le dis."];
    let li = 0;
    function type(text, done) {
      let k = 0; sayText.textContent = "";
      (function step() { if (k <= text.length) { sayText.textContent = text.slice(0, k++); if (k % 3 === 0) snd.tick(); setTimeout(step, 28 + rand(0, 30)); } else setTimeout(done, 2200); })();
    }
    function erase(done) { (function step() { const t = sayText.textContent; if (t.length) { sayText.textContent = t.slice(0, -2); setTimeout(step, 14); } else done(); })(); }
    function loop() { type(lines[li], () => erase(() => { li = (li + 1) % lines.length; loop(); })); }
    if (reduced) sayText.textContent = lines[0]; else setTimeout(loop, 1600);
    const bubble = $("#bubble");
    if (bubble) bubble.addEventListener("click", (e) => { burst(e.clientX, e.clientY, { n: 16, r: 90 }); snd.pop(); });
  }

  /* ---------- method list: each title plays its own animation ---------- */
  const pls = $$(".pl");
  if (pls.length && !reduced) {
    function play(li) {
      li.classList.remove("play"); void li.offsetWidth; li.classList.add("play");
      if (li.dataset.fx === "burst") { const kw = li.querySelector(".kw"), r = kw.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 16, r: 70, sizes: [3, 6] }); }
    }
    pls.forEach((li) => li.addEventListener("mouseenter", () => play(li)));
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting || en.target.dataset.seen) return;
      en.target.dataset.seen = "1";
      setTimeout(() => play(en.target), 350);
      io.unobserve(en.target);
    }), { threshold: 0.8 });
    pls.forEach((li) => io.observe(li));
  }
  const field = $("#fieldPx");
  if (field && !reduced) {
    const cols = ["--px", "--c1", "--c2", "--c3", "--c4", "--paper"];
    field.innerHTML = Array.from({ length: 36 }, () => `<i style="--x:${rand(0, 100).toFixed(1)}%; --s:${Math.round(rand(4, 10))}px; --c:${cssVar(pick(cols))}; --d:${rand(7, 14).toFixed(1)}s; --delay:-${rand(0, 14).toFixed(1)}s"></i>`).join("");
  }

  /* ---------- manifeste: words light up as you scroll ------------------ */
  const wordsBox = $("#words");
  if (wordsBox) {
    $$("p", wordsBox).forEach((p) => {
      const walk = (node) => Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
            else { const w = document.createElement("span"); w.className = "wd"; w.textContent = part; frag.appendChild(w); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
      walk(p);
    });
    const all = $$(".wd", wordsBox);
    let lit = -1;
    function update() {
      const r = wordsBox.getBoundingClientRect();
      // 0 when the block's top is 80% down the screen, 1 when its bottom reaches 35%
      const start = innerHeight * 0.8, end = innerHeight * 0.35;
      const p = Math.min(1, Math.max(0, (start - r.top) / (r.height + start - end)));
      const n = reduced ? all.length : Math.floor(p * (all.length + 6));
      if (n === lit) return;
      all.forEach((w, i) => { w.classList.toggle("on", i < n); w.classList.toggle("hot", i === n - 1 && n < all.length); });
      lit = n;
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- views chart ---------------------------------------- */
  const chart = $("#viewsChart"), counter = $("#chartCounter");
  function countUp(el, to, ms, format) {
    const t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(to * e);
      if (k < 1) requestAnimationFrame(f); else el.textContent = format(to);
    })(t0);
  }
  if (chart) new IntersectionObserver((entries, io) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    chart.classList.add("is-in"); io.disconnect();
    if (!reduced) { countUp(counter, 10000, 1600, (n) => fmtNum(n) + " vues"); [0, 150, 300].forEach((d) => setTimeout(snd.tick, d + 200)); }
    else counter.textContent = "10 000 vues";
  }), { threshold: 0.4 }).observe(chart);

  /* ---------- live demo ------------------------------------------ */
  const slides = $$(".slide"), notes = $$(".note");
  slides.forEach((s) => s.addEventListener("click", () => {
    slides.forEach((x) => x.classList.toggle("is-active", x === s));
    notes.forEach((nt) => {
      const show = nt.dataset.for === s.dataset.slide; nt.hidden = !show;
      if (show) { const p = nt.querySelector("p:not(.note-head)"); p.style.animation = "none"; void p.offsetWidth; p.style.animation = ""; }
    });
    snd.click();
  }));

  /* ---------- rainbow dividers ------------------------------------ */
  $$(".rainbow").forEach((w) => w.addEventListener("click", (e) => {
    w.classList.toggle("is-spun"); snd.whoosh();
    burst(e.clientX, e.clientY, { n: 12, r: 50, sizes: [3, 6], dur: [400, 700] });
  }));

  /* ---------- kit icons: stagger index per rect ---------------------- */
  $$(".kcard svg").forEach((svg) => $$("rect", svg).forEach((r, i) => r.style.setProperty("--i", i)));
  $$(".kcard").forEach((k) => k.addEventListener("mouseenter", snd.tick));

  /* ---------- accordion + click sounds ------------------------------ */
  $$("details").forEach((d) => d.addEventListener("toggle", () => (d.open ? snd.click() : snd.tick())));
  $$(".btn, .icon-btn").forEach((b) => b.addEventListener("pointerdown", () => snd.click()));

  /* ---------- stats tiles (RevenueCat) ---------------------------- */
  const statsEl = $("#stats");
  if (statsEl && DATA.revenue && DATA.revenue.stats) {
    statsEl.innerHTML = DATA.revenue.stats.map((s, i) => `
      <div class="stat px tilt reveal" style="--d:${i * 90}ms">
        <b data-to="${s.valeur}" data-suffix="${s.suffixe || ""}">0${s.suffixe || ""}</b>
        <span>${s.label}</span>
        <small>${s.sub || ""}</small>
      </div>`).join("");
    $$(".stat", statsEl).forEach(setupTilt);
    new IntersectionObserver((entries, io) => entries.forEach((en) => {
      if (!en.isIntersecting) return; io.disconnect();
      $$("b[data-to]", statsEl).forEach((b, i) => {
        const to = parseFloat(b.dataset.to), suf = b.dataset.suffix;
        if (reduced) { b.textContent = fmtNum(to) + suf; return; }
        setTimeout(() => { countUp(b, to, 1200, (n) => fmtNum(n) + suf); snd.coin(); }, i * 120);
      });
    }), { threshold: 0.5 }).observe(statsEl);
  }

  /* ---------- RevenueCat curve ------------------------------------ */
  const rc = $("#rcChart"), rcBody = $("#rcBody"), rcRange = $("#rcRange");
  function monthLabel(m) {
    const [y, mo] = m.split("-").map(Number);
    return ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][mo - 1] + " " + String(y).slice(2);
  }
  function drawRc(series, ghost = false) {
    const W = 800, H = 260, padL = 54, padR = 20, padT = 20, padB = 34;
    const max = Math.max(...series.map((p) => p.revenu)) * 1.15 || 1;
    const x = (i) => padL + (i / Math.max(1, series.length - 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - v / max) * (H - padT - padB);
    const pts = series.map((p, i) => [x(i), y(p.revenu)]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z`;
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(max * k));
    const grid = ticks.map((t) => `<line class="rc-grid" x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="rc-axis" x="${padL - 8}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${fmtNum(t)}</text>`).join("");
    const step = Math.ceil(series.length / 8);
    const xl = series.map((p, i) => (i % step === 0 || i === series.length - 1) ? `<text class="rc-axis" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${monthLabel(p.mois)}</text>` : "").join("");
    const ti = series.findIndex((p) => p.tiktok);
    const mark = ti >= 0 ? `<line class="rc-mark" x1="${x(ti).toFixed(1)}" x2="${x(ti).toFixed(1)}" y1="${padT}" y2="${y(0)}"/><text class="rc-mark-label" x="${(x(ti) + 6).toFixed(1)}" y="${padT + 10}">PREMIERS POSTS TIKTOK</text>` : "";
    const dots = pts.map((p, i) => `<circle class="rc-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" style="animation-delay:${1.2 + i * 0.05}s; transform-origin:${p[0].toFixed(1)}px ${p[1].toFixed(1)}px"/>`).join("");
    const last = series[series.length - 1];
    const lastLabel = `<text class="rc-axis" x="${(pts[pts.length - 1][0] - 6).toFixed(1)}" y="${(pts[pts.length - 1][1] - 12).toFixed(1)}" text-anchor="end" style="fill:var(--pink);font-size:11px">${fmtNum(last.revenu)} €</text>`;
    const cursor = ghost ? "" : `<line class="rc-cursor" x1="0" x2="0" y1="${padT}" y2="${y(0)}"/><circle class="rc-cursor-dot" r="6" cx="0" cy="0"/>`;
    const svg = `<svg viewBox="0 0 ${W} ${H}" class="${ghost ? "rc-ghost" : ""}" aria-hidden="${ghost}">${grid}${mark}<path class="rc-area" d="${area}"/><path class="rc-line" d="${path}" style="--len:${len.toFixed(0)}"/>${dots}${xl}${ghost ? "" : lastLabel}${cursor}</svg>`;
    return ghost ? svg : { svg, pts, W, H, padL, padR };
  }
  // hover: reconstituted views and the account that carried the month
  function setupRcHover(series, geo) {
    const svg = rcBody.querySelector("svg"), cur = svg.querySelector(".rc-cursor"), dot = svg.querySelector(".rc-cursor-dot");
    const tip = document.createElement("div"); tip.className = "rc-tip"; tip.hidden = true; rcBody.appendChild(tip);
    const comptes = DATA.comptes || [];
    let current = -1;
    function render(i) {
      const p = series[i];
      const rows = comptes.map((c) => ({ nom: c.nom, vues: (c.vues && c.vues[p.mois]) || 0 })).filter((r) => r.vues > 0).sort((a, b) => b.vues - a.vues);
      const total = rows.reduce((n, r) => n + r.vues, 0);
      const top = rows[0];
      let html = `<div class="rc-tip-head"><b>${monthLabel(p.mois)}</b><span>${fmtNum(p.revenu)} €</span></div>`;
      if (total) {
        html += `<div class="rc-tip-total">${fmtViews(total)} vues reconstituées</div><ul>` + rows.map((r, k) => {
          const share = r.vues / total, est = p.revenu * share;
          return `<li class="${k === 0 ? "is-top" : ""}"><span class="rc-tip-name">${r.nom}${k === 0 ? ' <i>a performé</i>' : ""}</span><span class="rc-tip-bar"><i style="width:${(share * 100).toFixed(0)}%"></i></span><span class="rc-tip-num">${fmtViews(r.vues)} · ≈ ${fmtNum(est)} €</span></li>`;
        }).join("") + `</ul><div class="rc-tip-foot">revenu estimé au prorata des vues</div>`;
      } else {
        html += `<div class="rc-tip-foot">pas encore de vues renseignées pour ce mois</div>`;
      }
      tip.innerHTML = html;
    }
    function move(e) {
      const b = svg.getBoundingClientRect();
      const xs = (e.clientX - b.left) / b.width * geo.W;
      let i = 0, best = Infinity;
      geo.pts.forEach((pt, k) => { const d = Math.abs(pt[0] - xs); if (d < best) { best = d; i = k; } });
      const [px, py] = geo.pts[i];
      cur.setAttribute("x1", px); cur.setAttribute("x2", px); dot.setAttribute("cx", px); dot.setAttribute("cy", py);
      svg.classList.add("is-hover"); tip.hidden = false;
      const left = (px / geo.W) * b.width;
      tip.style.left = Math.min(Math.max(left, 150), b.width - 150) + "px";
      tip.classList.toggle("is-left", left > b.width * 0.6);
      if (i !== current) { current = i; render(i); if (!reduced) snd.tick(); }
    }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerenter", move);
    svg.addEventListener("pointerleave", () => { svg.classList.remove("is-hover"); tip.hidden = true; current = -1; });
  }
  if (rc && rcBody) {
    const series = (DATA.revenue && DATA.revenue.series) || [];
    if (series.length >= 2) {
      const drawn = drawRc(series);
      rcBody.innerHTML = drawn.svg;
      setupRcHover(series, drawn);
      rcRange.textContent = monthLabel(series[0].mois) + " → " + monthLabel(series[series.length - 1].mois);
    } else {
      // placeholder: a ghost curve + a clear note, until the real export is in data.js
      const ghost = Array.from({ length: 12 }, (_, i) => ({ mois: `2026-${String(i + 1).padStart(2, "0")}`, revenu: Math.round(60 * Math.pow(1.45, i)), tiktok: i === 2 }));
      rcBody.innerHTML = drawRc(ghost, true) + `<div class="rc-empty"><p><b>La courbe arrive.</b>Elle se branche sur ton export RevenueCat, un point par mois, dans <code>data.js</code>.</p></div>`;
      rcRange.textContent = "export en cours";
    }
    new IntersectionObserver((entries, io) => entries.forEach((en) => { if (en.isIntersecting) { rc.classList.add("is-in"); io.disconnect(); if (!reduced) setTimeout(snd.whoosh, 200); } }), { threshold: 0.4 }).observe(rc);
  }

  /* ---------- TikTok videos ---------------------------------------- */
  const vgrid = $("#vgrid");
  const modal = $("#videoModal"), modalFrame = $("#modalFrame");
  function tiktokId(url) { const m = String(url || "").match(/\/(?:video|photo)\/(\d+)/); return m ? m[1] : null; }
  const isPhoto = (url) => /\/photo\//.test(String(url || ""));
  function fmtViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(".", ",") + " M";
    if (n >= 1e3) return Math.round(n / 1e3) + " k";
    return String(n);
  }
  function openVideo(url) {
    const id = tiktokId(url);
    if (!id || isPhoto(url)) { window.open(url, "_blank", "noopener"); snd.click(); return; }
    modalFrame.innerHTML = `<iframe src="https://www.tiktok.com/embed/v2/${id}" allow="autoplay; encrypted-media; fullscreen" title="Vidéo TikTok"></iframe>`;
    modal.hidden = false; snd.pop(); document.body.style.overflow = "hidden";
  }
  function closeVideo() { modal.hidden = true; modalFrame.innerHTML = ""; document.body.style.overflow = ""; snd.tick(); }
  if (modal) { $$("[data-close]", modal).forEach((b) => b.addEventListener("click", closeVideo)); window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeVideo(); }); }
  if (vgrid) {
    const vids = (DATA.videos || []).slice().sort((a, b) => (b.vues || 0) - (a.vues || 0));
    if (vids.length) {
      vgrid.innerHTML = vids.map((v, i) => `
        <button class="vcard px tilt reveal" data-url="${v.url}" style="--d:${i * 90}ms" aria-label="Voir la vidéo : ${(v.hook || "").replace(/"/g, "&quot;")}">
          <div class="vshot"><span class="rank">0${i + 1}</span>${v.image ? `<img src="${v.image}" alt="${(v.hook || "").replace(/"/g, "&quot;")}" loading="lazy">` : `<div class="vghost"></div><span class="vhook">${v.hook || ""}</span>`}<span class="vplay"></span></div>
          <div class="vmeta">${v.vues ? `<span class="vviews">${fmtViews(v.vues)}<small>vues</small></span>` : `<span class="vviews vviews-na">${v.note || "voir sur TikTok"}</span>`}<span class="vformat">${v.format || "TikTok"}</span></div>
        </button>`).join("");
      $$(".vcard", vgrid).forEach((c) => { setupTilt(c); c.addEventListener("click", () => openVideo(c.dataset.url)); });
    } else {
      // ghost cards until the links are in data.js
      const ghosts = [["POV", "+ 10 000 vues"], ["Problème → Solution", "le breakout"], ["Avant/Après", "ta feature à l'écran"], ["Démo live", "l'app en payoff"]];
      vgrid.innerHTML = ghosts.map((g, i) => `
        <div class="vcard px tilt is-ghost reveal" style="--d:${i * 90}ms">
          <div class="vshot"><div class="vghost"></div><span class="vhook">${g[1]}</span><span class="vplay"></span></div>
          <div class="vmeta"><span class="vviews">—<small>lien à venir</small></span><span class="vformat">${g[0]}</span></div>
        </div>`).join("");
      $$(".vcard", vgrid).forEach(setupTilt);
    }
  }

  /* ---------- price: slot machine, confetti on buy ------------------- */
  const buyBtn = $("#buyBtn"), priceNum = $("#priceNum"), priceCard = $("#priceCard");
  if (priceCard) new IntersectionObserver((entries, io) => entries.forEach((en) => {
    if (!en.isIntersecting) return; io.disconnect();
    if (reduced) return;
    const t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / 900);
      if (k < 1) { priceNum.textContent = String(Math.floor(rand(100, 999))); requestAnimationFrame(f); }
      else { priceNum.textContent = "490"; snd.coin(); }
    })(t0);
  }), { threshold: 0.5 }).observe(priceCard);
  [buyBtn, $("#finalBtn"), $("#heroCta")].forEach((b) => b && b.addEventListener("click", (e) => { confetti(e.clientX, e.clientY); snd.win(); }));

  /* ---------- like button ------------------------------------------ */
  const likeBtn = $("#likeBtn"), likeCount = $("#likeCount");
  let likes = store.get("stage.likes", 0);
  if (likeCount) likeCount.textContent = likes;
  if (likes > 0 && likeBtn) likeBtn.classList.add("is-liked");
  if (likeBtn) likeBtn.addEventListener("click", () => {
    likes++; store.set("stage.likes", likes); likeCount.textContent = likes; likeBtn.classList.add("is-liked");
    const r = likeBtn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { n: 10 + Math.min(likes, 30), r: 70 + Math.min(likes * 4, 120), colors: [cssVar("--pink"), cssVar("--pink"), cssVar("--yellow")] });
    snd.pop();
    likeCount.animate([{ transform: "scale(1)" }, { transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 300, easing: "steps(3)" });
    if (likes === 10) toast("10 likes. Je t'envoie la facture.");
    if (likes === 50) { toast("50 ! Mode chaos débloqué : ↑↑↓↓←→←→BA"); snd.win(); }
  });

  /* ---------- toast ------------------------------------------------ */
  const toastEl = $("#toast"); let toastTimer = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), 2600); }

  /* ---------- konami: chaos mode ------------------------------------ */
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  window.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      const on = document.body.classList.toggle("chaos");
      if (on) { snd.boom(); toast("MODE CHAOS. Ça aussi, c'est de l'organique."); confetti(innerWidth / 2, innerHeight / 2); }
      else { snd.off(); toast("Retour au calme."); }
    }
  });

  /* ---------- intro + reveal on scroll ---------------------------- */
  const intro = $("#intro");
  const GROUPS = ".hero-copy, .phases, .kit-grid, .quotes, .stats, .vgrid, .acc, .live-facts, .grid-2, .about-in, .price-wrap, .final-in, .about-facts, .list-x, .cta-row";
  // tag: direct children of each section's wrap arrive one by one; grids stagger their children
  $$(".section > .wrap, .hero > .wrap").forEach((wrap) => {
    $$(":scope > *", wrap).forEach((el) => {
      if (el.matches(".words")) return;
      if (el.matches(GROUPS)) $$(":scope > *", el).forEach((c, i) => { c.classList.add("reveal"); c.style.setProperty("--d", i * 90 + "ms"); });
      else el.classList.add("reveal");
    });
  });
  $$(".hero-copy > .reveal").forEach((el, i) => el.style.setProperty("--d", 120 + i * 110 + "ms"));
  $$(".cta-row > .reveal").forEach((el, i) => el.style.setProperty("--d", 520 + i * 90 + "ms"));
  const heroArt = $(".hero-art"); if (heroArt) { heroArt.classList.add("reveal", "pop"); heroArt.style.setProperty("--d", "260ms"); }
  const revealIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); revealIO.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  function armReveal(scope) {
    $$(".reveal:not(.is-in)", scope).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.94 && r.bottom > 0) el.classList.add("is-in");
      else revealIO.observe(el);
    });
  }
  function finishIntro() {
    if (!intro) return;
    intro.classList.add("is-done");
    intro.addEventListener("animationend", () => intro.remove(), { once: true });
    setTimeout(() => intro.remove(), 900);
  }
  if (!intro || reduced || document.visibilityState !== "visible") {
    if (intro) intro.remove();
    armReveal(document);
  } else {
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      snd.tick();
      finishIntro();
      document.body.style.overflow = "";
      setTimeout(() => { armReveal(document); snd.coin(); }, 120);
    }, 820);
  }
  // elements rendered later (stats, videos) get observed too
  setTimeout(() => armReveal(document), 1500);

  window.stageFx = { burst, confetti, snd, toast };

  /* ---------- scroll progress + active nav link --------------------- */
  const progress = $("#progress");
  const navLinks = $$(".links a");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  function onScroll() {
    if (!progress) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.setProperty("--p", max > 0 ? (scrollY / max).toFixed(3) : 0);
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const io3 = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach((s) => io3.observe(s));
})();
