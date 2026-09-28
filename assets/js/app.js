/* ==========================================================================
   Védőkör — közös funkciók: layout, nyelvváltás, animációk, hírek, űrlapok, PWA
   ========================================================================== */
(function () {
  "use strict";

  const LANG_KEY = "vk-lang";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nyelv ---------- */
  function storage(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }
  function detectLang() {
    const url = new URLSearchParams(location.search).get("lang");
    if (url === "hu" || url === "en") return url;
    const saved = storage(() => localStorage.getItem(LANG_KEY), null);
    if (saved === "hu" || saved === "en") return saved;
    return "hu";
  }
  let lang = detectLang();

  function t(key) {
    const dict = window.I18N[lang] || {};
    return key in dict ? dict[key] : (window.I18N.hu[key] || key);
  }
  // Kétnyelvű JSON-mező: { hu: "...", en: "..." } vagy sima szöveg
  function tr(value) {
    if (value && typeof value === "object") return value[lang] || value.hu || "";
    return value == null ? "" : String(value);
  }

  function applyI18n(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    (root || document).querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function setLang(next) {
    lang = next;
    storage(() => localStorage.setItem(LANG_KEY, next));
    document.documentElement.lang = next;
    applyI18n();
    const titleKey = document.body.dataset.titleKey;
    document.title = (titleKey ? t(titleKey) + " · " : "") + t("brand.name") + " " + t("brand.tag");
    document.querySelectorAll(".lang-toggle span").forEach((s) => s.classList.toggle("is-active", s.dataset.lang === next));
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: next } }));
  }

  /* ---------- Ikonok ---------- */
  const ICONS = {
    scale: '<path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0L7 8Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    spark: '<path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4L12 3Z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8Z"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    yt: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/>'
  };
  function icon(name, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + (ICONS[name] || "") + "</svg>";
  }
  window.VK_ICON = icon;

  const LOGO_MARK =
    '<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">' +
    '<defs><radialGradient id="lg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#c8ff2e"/><stop offset=".55" stop-color="#7b5cff"/><stop offset="1" stop-color="#2a1f7a"/></radialGradient></defs>' +
    '<circle cx="20" cy="20" r="14" fill="url(#lg)"/>' +
    '<ellipse cx="20" cy="20" rx="19" ry="7" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-24 20 20)" opacity=".9"/>' +
    "</svg>";

  /* ---------- Layout ---------- */
  const NAV = [
    { href: "index.html", key: "nav.home", page: "home" },
    { href: "about.html", key: "nav.about", page: "about" },
    { href: "services.html", key: "nav.services", page: "services" },
    { href: "news.html", key: "nav.news", page: "news" },
    { href: "join.html", key: "nav.join", page: "join" },
    { href: "contact.html", key: "nav.contact", page: "contact" }
  ];
  const page = document.body.dataset.page;

  function renderHeader() {
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="container header-inner">' +
      '<a class="logo" href="index.html">' + LOGO_MARK + '<span><span data-i18n="brand.name"></span><small data-i18n="brand.tag"></small></span></a>' +
      '<nav class="main-nav" aria-label="Fő navigáció"><ul>' +
      NAV.filter((n) => n.page !== "home").map((n) =>
        '<li><a href="' + n.href + '" data-i18n="' + n.key + '"' + (n.page === page ? ' aria-current="page"' : "") + "></a></li>").join("") +
      "</ul></nav>" +
      '<div class="header-actions">' +
      '<button class="lang-toggle" type="button" data-i18n-attr="aria-label:lang.switch"><span data-lang="hu">HU</span><span data-lang="en">EN</span></button>' +
      '<a class="btn btn--volt btn--sm" href="login.html"><span data-i18n="nav.members"></span>' + icon("arrow", ' class="arrow" width="18" height="18"') + "</a>" +
      '<button class="burger" type="button" aria-expanded="false" aria-controls="mobile-menu" data-i18n-attr="aria-label:nav.menu"><span></span><span></span></button>' +
      "</div></div>";

    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#main";
    skip.dataset.i18n = "nav.skip";

    const menu = document.createElement("div");
    menu.className = "mobile-menu";
    menu.id = "mobile-menu";
    menu.innerHTML =
      "<nav aria-label=\"Mobil navigáció\"><ul>" +
      NAV.map((n, i) =>
        '<li><a class="mm-link" href="' + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + "><small>0" + (i + 1) + '</small><span data-i18n="' + n.key + '"></span></a></li>').join("") +
      "</ul></nav>" +
      '<div class="mm-foot"><a class="btn btn--volt btn--block" href="login.html"><span data-i18n="nav.members"></span>' + icon("arrow", ' class="arrow" width="18" height="18"') + "</a></div>";

    document.body.prepend(menu);
    document.body.prepend(header);
    document.body.prepend(skip);

    header.querySelector(".lang-toggle").addEventListener("click", () => setLang(lang === "hu" ? "en" : "hu"));

    const burger = header.querySelector(".burger");
    function toggleMenu(open) {
      document.documentElement.classList.toggle("menu-open", open);
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", t(open ? "nav.close" : "nav.menu"));
      menu.inert = !open;
    }
    menu.inert = true;
    burger.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

    // Scroll állapot: háttér + elrejtés lefelé görgetéskor
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 24);
      if (!document.body.classList.contains("menu-open")) {
        header.classList.toggle("is-hidden", y > 400 && y > lastY + 4);
        if (y < lastY - 4) header.classList.remove("is-hidden");
      }
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function renderFooter() {
    if (document.body.dataset.noFooter !== undefined) return;
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    const year = new Date().getFullYear();
    footer.innerHTML =
      '<div class="container">' +
      '<div class="footer-grid">' +
      '<div><a class="logo" href="index.html">' + LOGO_MARK + '<span><span data-i18n="brand.name"></span><small data-i18n="brand.tag"></small></span></a>' +
      '<p data-i18n="footer.about"></p>' +
      '<div class="socials"><a href="#" aria-label="Facebook">' + icon("fb") + '</a><a href="#" aria-label="Instagram">' + icon("ig") + '</a><a href="#" aria-label="YouTube">' + icon("yt") + "</a></div></div>" +
      '<div><h4 data-i18n="footer.nav"></h4><ul>' +
      NAV.map((n) => '<li><a href="' + n.href + '" data-i18n="' + n.key + '"></a></li>').join("") + "</ul></div>" +
      '<div><h4 data-i18n="nav.members"></h4><ul>' +
      '<li><a href="login.html" data-i18n="login.title"></a></li>' +
      '<li><a href="join.html" data-i18n="nav.join"></a></li>' +
      '<li><a href="privacy.html" data-i18n="footer.privacy"></a></li></ul></div>' +
      '<div><h4 data-i18n="footer.contact"></h4><ul>' +
      '<li><a href="mailto:info@vedokor.hu">info@vedokor.hu</a></li>' +
      '<li><a href="tel:+3610000000">+36 1 000 0000</a></li>' +
      '<li><span class="muted" data-i18n="contact.address"></span></li></ul></div>' +
      "</div>" +
      '<div class="footer-bottom"><span>© ' + year + ' <span data-i18n="brand.name"></span> <span data-i18n="brand.tag"></span>. <span data-i18n="footer.rights"></span></span>' +
      '<button type="button" class="install-link" hidden data-i18n="footer.install"></button></div>' +
      '</div><div class="footer-word" aria-hidden="true">Védőkör</div>';
    document.body.appendChild(footer);
  }

  /* ---------- Animált védőgömb (canvas) ---------- */
  function Orb(canvas, opts) {
    opts = Object.assign({ count: 1100, rings: true, interactive: true }, opts || {});
    const ctx = canvas.getContext("2d");
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < opts.count; i++) {
      const y = 1 - (i / (opts.count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]);
    }
    let w = 0, h = 0, dpr = 1, running = false, visible = true, raf = 0;
    let rotX = -0.35, rotY = 0, targetX = -0.35, targetY = 0, t0 = performance.now();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(now) {
      const time = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
      rotX += (targetX - rotX) * 0.04;
      rotY += (targetY - rotY) * 0.04;
      const ay = time * 0.18 + rotY, ax = rotX;
      const cosY = Math.cos(ay), sinY = Math.sin(ay), cosX = Math.cos(ax), sinX = Math.sin(ax);

      // Belső izzás
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.25);
      g.addColorStop(0, "rgba(200,255,46,0.22)");
      g.addColorStop(0.45, "rgba(123,92,255,0.18)");
      g.addColorStop(1, "rgba(11,10,26,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2); ctx.fill();

      // Pontfelhő: „pulzáló” gömb
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const breathe = 1 + Math.sin(time * 1.2 + p[3] * 6.28) * 0.018;
        let x = p[0] * breathe, y = p[1] * breathe, z = p[2] * breathe;
        let x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
        let y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
        const persp = 2.4 / (2.4 - z2);
        const sx = cx + x1 * R * persp, sy = cy + y1 * R * persp;
        const depth = (z2 + 1) / 2; // 0 hátul, 1 elöl
        const size = (0.5 + depth * 1.9) * (w > 600 ? 1 : 0.8);
        // szín: volt (fent-elöl) → violet → coral (lent)
        const mix = (y1 + 1) / 2;
        let r, gg, b;
        if (mix < 0.5) { const k = mix / 0.5; r = 200 + (123 - 200) * k; gg = 255 + (92 - 255) * k; b = 46 + (255 - 46) * k; }
        else { const k = (mix - 0.5) / 0.5; r = 123 + (255 - 123) * k; gg = 92 + (106 - 92) * k; b = 255 + (61 - 255) * k; }
        ctx.fillStyle = "rgba(" + (r | 0) + "," + (gg | 0) + "," + (b | 0) + "," + (0.12 + depth * 0.88).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
      }

      // Védő gyűrűk (orbit)
      if (opts.rings) {
        for (let k = 0; k < 3; k++) {
          const tilt = -0.42 + k * 0.5 + Math.sin(time * 0.3 + k) * 0.05;
          const rr = R * (1.28 + k * 0.16);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(tilt);
          ctx.scale(1, 0.26 + k * 0.05);
          ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2);
          ctx.restore();
          ctx.strokeStyle = k === 0 ? "rgba(200,255,46,0.55)" : "rgba(239,237,248," + (0.18 - k * 0.04) + ")";
          ctx.lineWidth = k === 0 ? 1.4 : 1;
          ctx.stroke();
          // Keringő „szatellit”
          const a = time * (0.6 - k * 0.15) + k * 2;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * (0.26 + k * 0.05);
          const sx = cx + px * Math.cos(tilt) - py * Math.sin(tilt);
          const sy = cy + px * Math.sin(tilt) + py * Math.cos(tilt);
          ctx.fillStyle = k === 0 ? "#c8ff2e" : k === 1 ? "#ff6a3d" : "#5ce1ff";
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(sx, sy, k === 0 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    function loop(now) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running || reduceMotion || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    if (opts.interactive && !reduceMotion) {
      window.addEventListener("pointermove", (e) => {
        targetY = (e.clientX / window.innerWidth - 0.5) * 1.1;
        targetX = -0.35 + (e.clientY / window.innerHeight - 0.5) * 0.7;
      }, { passive: true });
    }
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener("resize", resize);
    resize();
    start();
  }

  /* ---------- Scroll-animációk ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
  }
  window.VK_REVEAL = initReveal;

  function initCardGlow() {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest && e.target.closest(".card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    }, { passive: true });
  }

  function initCounters() {
    const els = document.querySelectorAll("[data-count]");
    const fmt = () => new Intl.NumberFormat(lang === "hu" ? "hu-HU" : "en-GB");
    function run(el) {
      const target = Number(el.dataset.count), suffix = el.dataset.suffix || "";
      if (reduceMotion) { el.textContent = fmt().format(target) + suffix; return; }
      const dur = 1800, s = performance.now();
      (function step(now) {
        const p = Math.min((now - s) / dur, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt().format(Math.round(target * e)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(s);
    }
    els.forEach((el) => { el.textContent = "0"; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    });
    els.forEach((el) => io.observe(el));
    document.addEventListener("langchange", () => els.forEach((el) => { el.textContent = fmt().format(Number(el.dataset.count)) + (el.dataset.suffix || ""); }));
  }

  /* ---------- Hírek ---------- */
  const ART = [
    ["#7b5cff", "#c8ff2e"], ["#ff6a3d", "#7b5cff"], ["#0b0a1a", "#5ce1ff"], ["#c8ff2e", "#ff6a3d"], ["#5ce1ff", "#7b5cff"], ["#15132e", "#ff6a3d"]
  ];
  function newsArt(i) {
    const [a, b] = ART[i % ART.length];
    const shapes = [
      '<circle cx="70%" cy="55%" r="38%" fill="' + b + '"/><circle cx="28%" cy="30%" r="14%" fill="#f4f1ea" opacity=".9"/>',
      '<rect x="-10%" y="55%" width="120%" height="60%" rx="40" fill="' + b + '" transform="rotate(-8)"/><circle cx="75%" cy="28%" r="12%" fill="#f4f1ea"/>',
      '<circle cx="50%" cy="50%" r="34%" fill="none" stroke="' + b + '" stroke-width="22"/><circle cx="50%" cy="50%" r="12%" fill="' + b + '"/>',
      '<path d="M0 100 Q 30 20 60 60 T 120 30 V 120 H 0Z" fill="' + b + '" transform="scale(4)"/>'
    ];
    return '<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100%" height="100%" fill="' + a + '"/>' + shapes[i % shapes.length] + "</svg>";
  }
  function formatDate(iso) {
    return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : "en-GB", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  }
  window.VK_FORMAT_DATE = formatDate;

  let newsCache = null;
  function loadNews() {
    if (newsCache) return Promise.resolve(newsCache);
    return fetch("data/news.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => (newsCache = d.items.sort((a, b) => b.date.localeCompare(a.date))));
  }

  function newsCardHTML(item, i, lead) {
    return '<article class="news-card reveal' + (lead ? " news-card--lead" : "") + '" style="--d:' + (i * 0.08) + 's">' +
      '<a href="#" data-news="' + item.id + '" class="news-thumb">' + newsArt(item.art != null ? item.art : i) + '<span class="tag">' + t("news.cat." + item.category) + "</span></a>" +
      '<div class="news-meta">' + formatDate(item.date) + "</div>" +
      '<h3><a href="#" data-news="' + item.id + '">' + tr(item.title) + "</a></h3>" +
      "<p>" + tr(item.excerpt) + "</p></article>";
  }

  function openNews(item) {
    let modal = document.querySelector(".modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = '<div class="modal-panel"><button class="modal-close" type="button">' + icon("close", ' width="20" height="20"') + '</button><div class="modal-body"></div></div>';
      document.body.appendChild(modal);
      const close = () => { modal.classList.remove("is-open"); document.body.style.overflow = ""; };
      modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest(".modal-close")) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    modal.querySelector(".modal-close").setAttribute("aria-label", t("nav.close"));
    modal.querySelector(".modal-body").innerHTML =
      '<div><span class="tag" style="background:var(--ink);color:var(--volt)">' + t("news.cat." + item.category) + '</span></div>' +
      '<div class="news-meta">' + formatDate(item.date) + "</div>" +
      '<h2 class="h-m">' + tr(item.title) + "</h2>" +
      tr(item.body).split("\n\n").map((p) => "<p>" + p + "</p>").join("");
    modal.setAttribute("aria-label", tr(item.title));
    requestAnimationFrame(() => modal.classList.add("is-open"));
    document.body.style.overflow = "hidden";
    modal.querySelector(".modal-close").focus();
  }

  function initNews() {
    const home = document.querySelector("[data-news-latest]");
    const list = document.querySelector("[data-news-list]");
    if (!home && !list) return;
    let filter = "all";

    function render() {
      loadNews().then((items) => {
        if (home) {
          home.innerHTML = items.slice(0, 3).map((it, i) => newsCardHTML(it, i, i === 0)).join("");
        }
        if (list) {
          const chips = document.querySelector("[data-news-chips]");
          const cats = ["all"].concat([...new Set(items.map((i) => i.category))]);
          chips.innerHTML = cats.map((c) => '<button class="chip" type="button" data-cat="' + c + '" aria-pressed="' + (c === filter) + '">' + (c === "all" ? t("news.filter.all") : t("news.cat." + c)) + "</button>").join("");
          const shown = items.filter((i) => filter === "all" || i.category === filter);
          list.innerHTML = shown.length ? shown.map((it, i) => newsCardHTML(it, i, false)).join("") : '<p class="empty">' + t("news.empty") + "</p>";
        }
        initReveal();
      }).catch(() => {
        const target = home || list;
        target.innerHTML = '<p class="empty">Hírek betöltése sikertelen. Futtasd az oldalt webszerverről (lásd README).</p>';
      });
    }

    document.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (chip) { filter = chip.dataset.cat; render(); return; }
      const link = e.target.closest("[data-news]");
      if (link) {
        e.preventDefault();
        loadNews().then((items) => { const it = items.find((x) => x.id === link.dataset.news); if (it) openNews(it); });
      }
    });
    document.addEventListener("langchange", render);
    render();
  }

  /* ---------- Űrlapok (demó) ---------- */
  function initForms() {
    document.querySelectorAll("form[data-demo-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const box = form.querySelector("[data-form-status]");
        box.hidden = false;
        box.className = "alert alert--ok";
        box.textContent = t(form.dataset.okKey);
        form.querySelectorAll("input:not([type=checkbox]), textarea").forEach((i) => (i.value = ""));
      });
    });
  }

  /* ---------- PWA: service worker + telepítés ---------- */
  function initPWA() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      document.querySelectorAll(".install-link").forEach((b) => (b.hidden = false));
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest(".install-link") && deferred) { deferred.prompt(); deferred = null; }
    });
  }

  /* ---------- Indítás ---------- */
  document.documentElement.classList.remove("no-js");
  renderHeader();
  renderFooter();
  setLang(lang);
  document.querySelectorAll("canvas[data-orb]").forEach((c) => Orb(c, { rings: c.dataset.orb !== "plain", count: Number(c.dataset.count) || 1100 }));
  initReveal();
  initCardGlow();
  initCounters();
  initNews();
  initForms();
  initPWA();

  window.VK = { t, tr, setLang, getLang: () => lang, icon };
})();
