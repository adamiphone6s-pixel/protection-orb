/* ==========================================================================
   Védőkör — közös motor: layout, nyelv, mozgás, hírek, űrlapok, PWA
   Külső függőségek (opcionálisak, helyben kiszolgálva): GSAP + ScrollTrigger, Lenis.
   Nélkülük is minden működik, csak egyszerűbb animációkkal.
   ========================================================================== */
(function () {
  "use strict";

  const LANG_KEY = "vk-lang";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  const page = document.body.dataset.page;

  function store(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  const ss = {
    get: (k) => store(() => sessionStorage.getItem(k), null),
    set: (k, v) => store(() => sessionStorage.setItem(k, v)),
    del: (k) => store(() => sessionStorage.removeItem(k))
  };

  /* ================= Nyelv ================= */
  function detectLang() {
    const url = new URLSearchParams(location.search).get("lang");
    if (url === "hu" || url === "en") return url;
    const saved = store(() => localStorage.getItem(LANG_KEY), null);
    return saved === "hu" || saved === "en" ? saved : "hu";
  }
  let lang = detectLang();
  function t(key) {
    const dict = window.I18N[lang] || {};
    return key in dict ? dict[key] : (window.I18N.hu[key] || key);
  }
  function tr(v) {
    if (v && typeof v === "object") return v[lang] || v.hu || "";
    return v == null ? "" : String(v);
  }
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t(el.dataset.i18n);
      el.textContent = v;
      el.setAttribute("data-t", v);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }
  function setLang(next) {
    lang = next;
    store(() => localStorage.setItem(LANG_KEY, next));
    document.documentElement.lang = next;
    applyI18n();
    splitAll();
    initManifesto();
    const titleKey = document.body.dataset.titleKey;
    document.title = (titleKey ? t(titleKey).replace(/<[^>]+>/g, "") + " · " : "") + t("brand.name") + " " + t("brand.tag");
    document.querySelectorAll(".lang-toggle").forEach((b) => {
      b.classList.toggle("is-en", next === "en");
      b.querySelectorAll("span").forEach((s) => s.classList.toggle("is-active", s.dataset.lang === next));
    });
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: next } }));
    if (hasGSAP) requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  /* ================= Ikonok ================= */
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
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
  const ARROW = icon("arrow", ' class="arrow" width="18" height="18"');
  const roll = (key) => '<span class="roll"><span data-i18n="' + key + '"></span></span>';

  const LOGO_MARK =
    '<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">' +
    '<defs><radialGradient id="lg" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#8d8a85"/><stop offset=".45" stop-color="#26262a"/><stop offset="1" stop-color="#0c0c0e"/></radialGradient></defs>' +
    '<circle cx="20" cy="20" r="14" fill="url(#lg)" stroke="currentColor" stroke-opacity=".18"/>' +
    '<ellipse cx="20" cy="20" rx="19" ry="7" fill="none" stroke="#ff4a1c" stroke-width="1.8" transform="rotate(-24 20 20)"/></svg>';

  /* ================= Layout ================= */
  const NAV = [
    { href: "index.html", key: "nav.home", page: "home" },
    { href: "about.html", key: "nav.about", page: "about" },
    { href: "services.html", key: "nav.services", page: "services" },
    { href: "news.html", key: "nav.news", page: "news" },
    { href: "join.html", key: "nav.join", page: "join" },
    { href: "contact.html", key: "nav.contact", page: "contact" }
  ];
  let lenis = null;

  function renderHeader() {
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="container header-inner">' +
      '<a class="logo" href="index.html" aria-label="Védőkör">' + LOGO_MARK + '<span><span data-i18n="brand.name"></span><small data-i18n="brand.tag"></small></span></a>' +
      '<nav class="main-nav" aria-label="Fő navigáció"><ul>' +
      NAV.filter((n) => n.page !== "home").map((n) =>
        '<li><a href="' + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + ">" + roll(n.key) + "</a></li>").join("") +
      "</ul></nav>" +
      '<div class="header-actions">' +
      '<button class="lang-toggle" type="button" data-i18n-attr="aria-label:lang.switch"><span data-lang="hu">HU</span><span data-lang="en">EN</span></button>' +
      '<a class="btn btn--volt btn--sm" href="login.html" data-magnetic>' + roll("nav.members") + ARROW + "</a>" +
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
      '<nav aria-label="Mobil navigáció"><ul>' +
      NAV.map((n, i) => '<li><a class="mm-link" href="' + n.href + '"' + (n.page === page ? ' aria-current="page"' : "") + "><small>0" + (i + 1) + '</small><span data-i18n="' + n.key + '"></span></a></li>').join("") +
      "</ul></nav>" +
      '<div class="mm-foot"><a class="btn btn--volt btn--block" href="login.html"><span data-i18n="nav.members"></span>' + ARROW + "</a>" +
      '<div class="mm-contact"><a href="mailto:info@vedokor.hu">info@vedokor.hu</a><a href="tel:+3610000000">+36 1 000 0000</a></div></div>';

    document.body.prepend(menu);
    document.body.prepend(header);
    document.body.prepend(skip);

    header.querySelector(".lang-toggle").addEventListener("click", () => setLang(lang === "hu" ? "en" : "hu"));

    const burger = header.querySelector(".burger");
    function toggleMenu(open) {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", t(open ? "nav.close" : "nav.menu"));
      menu.inert = !open;
      if (lenis) open ? lenis.stop() : lenis.start();
    }
    menu.inert = true;
    burger.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) toggleMenu(false); });

    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 24);
      if (!document.body.classList.contains("menu-open")) {
        if (y > 400 && y > lastY + 4) header.classList.add("is-hidden");
        else if (y < lastY - 4 || y < 400) header.classList.remove("is-hidden");
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
    footer.innerHTML =
      '<div class="container"><div class="footer-grid">' +
      '<div><a class="logo" href="index.html">' + LOGO_MARK + '<span><span data-i18n="brand.name"></span><small data-i18n="brand.tag"></small></span></a>' +
      '<p data-i18n="footer.about"></p>' +
      '<div class="socials"><a href="#" aria-label="Facebook" data-magnetic>' + icon("fb") + '</a><a href="#" aria-label="Instagram" data-magnetic>' + icon("ig") + '</a><a href="#" aria-label="YouTube" data-magnetic>' + icon("yt") + "</a></div></div>" +
      '<div><h4 data-i18n="footer.nav"></h4><ul>' + NAV.map((n) => '<li><a href="' + n.href + '">' + roll(n.key) + "</a></li>").join("") + "</ul></div>" +
      '<div><h4 data-i18n="nav.members"></h4><ul>' +
      '<li><a href="login.html">' + roll("login.title") + "</a></li>" +
      '<li><a href="join.html">' + roll("nav.join") + "</a></li>" +
      '<li><a href="privacy.html">' + roll("footer.privacy") + "</a></li></ul></div>" +
      '<div><h4 data-i18n="footer.contact"></h4><ul>' +
      '<li><a href="mailto:info@vedokor.hu">info@vedokor.hu</a></li>' +
      '<li><a href="tel:+3610000000">+36 1 000 0000</a></li>' +
      '<li><span class="muted" data-i18n="contact.address"></span></li></ul></div>' +
      "</div>" +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' <span data-i18n="brand.name"></span> <span data-i18n="brand.tag"></span>. <span data-i18n="footer.rights"></span></span>' +
      '<button type="button" class="install-link" hidden data-i18n="footer.install"></button>' +
      '<a href="#main" class="to-top" data-top>' + icon("arrowUp", ' width="16" height="16"') + '<span class="roll"><span data-i18n="footer.top"></span></span></a></div></div>' +
      '<div class="footer-word" aria-hidden="true">' + "Védőkör".split("").map((c, i) => '<span style="--i:' + i + '">' + c + "</span>").join("") + "</div>";
    document.body.appendChild(footer);
    footer.querySelector("[data-top]").addEventListener("click", (e) => {
      e.preventDefault();
      lenis ? lenis.scrollTo(0, { duration: 1.8 }) : window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ================= Szövegfelbontás ================= */
  function splitEl(el) {
    const mode = el.dataset.split === "chars" ? "chars" : "words";
    let i = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            if (mode === "chars") {
              Array.from(part).forEach((ch) => {
                const c = document.createElement("span");
                c.className = "c";
                c.style.setProperty("--i", i++);
                c.textContent = ch;
                w.appendChild(c);
              });
            } else {
              const wi = document.createElement("span");
              wi.className = "wi";
              wi.style.setProperty("--i", i++);
              wi.textContent = part;
              w.appendChild(wi);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.classList.contains("w")) {
          walk(child);
        }
      });
    })(el);
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    }
    el.querySelectorAll(".w").forEach((w) => w.setAttribute("aria-hidden", "true"));
  }
  function splitAll() {
    document.querySelectorAll("[data-split]").forEach((el) => {
      if (el.querySelector(".w")) {
        // nyelvváltás után az i18n újraírta a tartalmat → ha még van .w, nem kell újra
        return;
      }
      el.removeAttribute("aria-label");
      splitEl(el);
    });
  }

  /* ================= Kiáltvány: szavankénti kivilágítás ================= */
  let manifestoWords = [];
  function initManifesto() {
    const el = document.querySelector("[data-manifesto]");
    if (!el) return;
    el.innerHTML = el.textContent.split(/\s+/).map((w) => '<span class="mw">' + w + "</span>").join(" ");
    manifestoWords = Array.from(el.querySelectorAll(".mw"));
    updateManifesto();
  }
  function updateManifesto() {
    if (!manifestoWords.length) return;
    const el = manifestoWords[0].parentElement;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)));
    const n = reduceMotion ? manifestoWords.length : Math.round(p * manifestoWords.length);
    manifestoWords.forEach((w, i) => w.classList.toggle("on", i < n));
  }

  /* ================= WebGL gömb + 2D fallback ================= */
  function Orb2D(canvas, opts) {
    opts = Object.assign({ count: 900 }, opts || {});
    const ctx = canvas.getContext("2d");
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < opts.count; i++) {
      const y = 1 - (i / (opts.count - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]);
    }
    let w = 0, h = 0, running = false, raf = 0, visible = true;
    let rotX = -0.35, rotY = 0, tx = -0.35, ty = 0;
    const t0 = performance.now();
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }
    function draw(now) {
      const time = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
      rotX += (tx - rotX) * 0.04; rotY += (ty - rotY) * 0.04;
      const ay = time * 0.15 + rotY, cY = Math.cos(ay), sY = Math.sin(ay), cX = Math.cos(rotX), sX = Math.sin(rotX);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], br = 1 + Math.sin(time * 1.2 + p[3] * 6.28) * 0.02;
        const x = p[0] * br, y = p[1] * br, z = p[2] * br;
        const x1 = x * cY - z * sY, z1 = x * sY + z * cY, y1 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
        const persp = 2.4 / (2.4 - z2), depth = (z2 + 1) / 2, mix = (y1 + 1) / 2;
        let r, g, b;
        if (mix < 0.5) { const k = mix / 0.5; r = 242 - 90 * k; g = 239 - 92 * k; b = 233 - 95 * k; }
        else { const k = (mix - 0.5) / 0.5; r = 152 + 103 * k; g = 147 - 73 * k; b = 138 - 110 * k; }
        ctx.fillStyle = "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + (0.1 + depth * 0.9).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(cx + x1 * R * persp, cy + y1 * R * persp, 0.5 + depth * 1.8, 0, 6.2832); ctx.fill();
      }
    }
    function loop(now) { if (!running) return; draw(now); raf = requestAnimationFrame(loop); }
    function start() { if (running || reduceMotion || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    if (!reduceMotion) window.addEventListener("pointermove", (e) => { ty = (e.clientX / innerWidth - 0.5) * 1.1; tx = -0.35 + (e.clientY / innerHeight - 0.5) * 0.7; }, { passive: true });
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas); else addEventListener("resize", resize);
    resize(); start();
    return { setScroll() {}, setHover() {} };
  }
  const orbs = [];
  function initOrbs() {
    document.querySelectorAll("canvas[data-gl-orb]").forEach((c) => {
      const inst = (window.VKOrbGL && window.VKOrbGL(c)) || Orb2D(c);
      inst.el = c;
      orbs.push(inst);
    });
    document.querySelectorAll("canvas[data-orb]").forEach((c) => Orb2D(c, { count: Number(c.dataset.count) || 900 }));
  }

  /* ================= Sima görgetés (Lenis) ================= */
  function initSmoothScroll() {
    if (!window.Lenis || reduceMotion) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -90 } });
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ================= Görgetéshez kötött effektek ================= */
  let velocity = 0, lastScroll = window.scrollY;
  function scrollTick() {
    const y = window.scrollY;
    const v = lenis ? lenis.velocity : y - lastScroll;
    velocity += (v - velocity) * 0.2;
    lastScroll = y;
    updateManifesto();
    const hero = document.querySelector(".hero");
    if (hero && orbs[0]) {
      const p = Math.min(1, Math.max(0, y / (hero.offsetHeight || 1)));
      orbs[0].setScroll(p);
    }
  }

  function initGSAPScenes() {
    const mm = hasGSAP && !reduceMotion ? gsap.matchMedia() : null;

    // Vízszintes szolgáltatás-szekció
    document.querySelectorAll("[data-hs]").forEach((section) => {
      const track = section.querySelector(".hs-track");
      const bar = section.querySelector(".hs-progress i");
      if (!mm) { section.classList.add("hs-native"); return; }
      mm.add("(min-width: 900px)", () => {
        section.classList.remove("hs-native");
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: {
            trigger: section, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true,
            onUpdate: (s) => { if (bar) bar.style.transform = "scaleX(" + s.progress + ")"; }
          }
        });
        return () => tween.kill();
      });
      mm.add("(max-width: 899px)", () => { section.classList.add("hs-native"); });
    });

    if (!mm) return;

    // Hero: a cím lassan elúszik, a gömb torzul
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) {
      gsap.to(heroTitle, { yPercent: 28, opacity: 0.15, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero-gl", { scale: 1.25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    }

    // Egymásra csúszó lépéskártyák
    const cards = gsap.utils.toArray(".stack-card");
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.92 + i * 0.02, ease: "none",
        scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top " + (100 + (i + 1) * 28) + "px", scrub: true }
      });
    });

    // Parallax
    gsap.utils.toArray("[data-speed]").forEach((el) => {
      const s = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { yPercent: s * 20 }, { yPercent: -s * 20, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Telefon a tagi felület-kártyán
    const phone = document.querySelector(".phone");
    if (phone) {
      gsap.fromTo(phone, { rotate: 8, y: 80 }, { rotate: -4, y: -40, ease: "none", scrollTrigger: { trigger: ".teaser", start: "top bottom", end: "bottom top", scrub: true } });
    }

    // Belső oldalak hero gömbje
    gsap.utils.toArray(".ph-orb").forEach((el) => {
      gsap.to(el, { yPercent: 25, scale: 1.15, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top top", end: "bottom top", scrub: true } });
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ================= Megjelenési animációk ================= */
  let io = null;
  const proxyOf = new WeakMap();
  function observeAll() {
    const sel = ".reveal, .reveal-clip, [data-split]:not([data-split-manual]), [data-inview], .footer-word";
    const els = document.querySelectorAll(sel);
    if (!("IntersectionObserver" in window) || reduceMotion) { els.forEach((e) => e.classList.add("in")); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (proxyOf.get(e.target) || [e.target]).forEach((el) => el.classList.add("in"));
          io.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    }
    els.forEach((e) => {
      if (e.classList.contains("in")) return;
      // A clip-path-tal teljesen elrejtett elemet a Chrome nem látja metszőnek → a szülőt figyeljük
      if (e.classList.contains("reveal-clip") && e.parentElement) {
        const list = proxyOf.get(e.parentElement) || [];
        list.push(e);
        proxyOf.set(e.parentElement, list);
        io.observe(e.parentElement);
      } else io.observe(e);
    });
  }

  function initCounters() {
    const els = document.querySelectorAll("[data-count]");
    const fmt = () => new Intl.NumberFormat(lang === "hu" ? "hu-HU" : "en-GB");
    const final = (el) => fmt().format(Number(el.dataset.count)) + (el.dataset.suffix || "");
    function run(el) {
      if (reduceMotion) { el.textContent = final(el); return; }
      const target = Number(el.dataset.count), dur = 2200, s = performance.now();
      (function step(now) {
        const p = Math.min((now - s) / dur, 1), e = 1 - Math.pow(1 - p, 5);
        el.textContent = fmt().format(Math.round(target * e)) + (el.dataset.suffix || "");
        if (p < 1) requestAnimationFrame(step);
      })(s);
    }
    els.forEach((el) => { el.textContent = "0"; });
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach((el) => cio.observe(el));
    document.addEventListener("langchange", () => els.forEach((el) => { if (el.textContent !== "0") el.textContent = final(el); }));
  }

  /* ================= Kurzor, mágnes, dőlés ================= */
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    const ring = document.createElement("div");
    ring.className = "cursor";
    ring.innerHTML = "<i></i><b></b>";
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    document.body.append(ring, dot);
    const label = ring.querySelector("b");
    let mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; document.documentElement.classList.add("has-cursor"); }
      const target = e.target.closest ? e.target : null;
      const lab = target && target.closest("[data-cursor]");
      const link = target && target.closest("a, button, summary, label, [role=tab], select");
      const field = target && target.closest("input, textarea, select");
      ring.classList.toggle("is-label", !!lab);
      ring.classList.toggle("is-link", !lab && !!link);
      ring.classList.toggle("is-hidden", !!field);
      dot.classList.toggle("is-hidden", !!field);
      if (lab) label.textContent = t(lab.dataset.cursor);
    }, { passive: true });
    addEventListener("pointerdown", () => ring.classList.add("is-down"));
    addEventListener("pointerup", () => ring.classList.remove("is-down"));
    document.addEventListener("pointerleave", () => { ring.style.opacity = "0"; dot.style.opacity = "0"; });
    document.addEventListener("pointerenter", () => { ring.style.opacity = ""; dot.style.opacity = ""; });
    (function tick() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      requestAnimationFrame(tick);
    })();
  }

  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    document.addEventListener("pointermove", (e) => {
      document.querySelectorAll("[data-magnetic].is-mag").forEach((el) => {
        if (el.contains(e.target)) return;
        el.classList.remove("is-mag");
        el.style.transition = "transform .8s cubic-bezier(.16,1,.3,1)";
        el.style.transform = "";
      });
      const el = e.target.closest && e.target.closest("[data-magnetic]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      const k = Number(el.dataset.magnetic) || 0.3;
      el.classList.add("is-mag");
      el.style.transition = "transform .25s cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translate3d(" + x * k + "px," + y * k + "px,0)";
    }, { passive: true });
  }

  function initCardFx() {
    if (!finePointer || reduceMotion) return;
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest && e.target.closest(".card, .tile");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      card.style.setProperty("--mx", px + "px");
      card.style.setProperty("--my", py + "px");
      if (card.hasAttribute("data-tilt")) {
        const rx = (py / r.height - 0.5) * -8, ry = (px / r.width - 0.5) * 8;
        card.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateZ(0)";
      }
    }, { passive: true });
    document.querySelectorAll("[data-tilt]").forEach((c) => c.addEventListener("pointerleave", () => { c.style.transform = ""; }));
  }

  /* ================= Betöltő + oldalváltás ================= */
  const curtain = document.createElement("div");
  curtain.className = "curtain";
  curtain.setAttribute("aria-hidden", "true");

  function whenReady(fn) {
    if (document.documentElement.dataset.ready) fn();
    else document.addEventListener("vk:ready", fn, { once: true });
  }
  function fireReady() {
    document.documentElement.dataset.ready = "1";
    document.dispatchEvent(new Event("vk:ready"));
  }

  function runLoader() {
    const loader = document.createElement("div");
    loader.className = "loader";
    loader.setAttribute("role", "status");
    loader.innerHTML =
      '<div class="loader-ring"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="48"/><circle class="bar" cx="50" cy="50" r="48" pathLength="1"/></svg>' +
      '<span class="loader-num">0</span></div><div class="loader-label">' + t("loader.label") + "</div>";
    document.body.appendChild(loader);
    const num = loader.querySelector(".loader-num"), bar = loader.querySelector(".bar");
    let loaded = false;
    const assets = Promise.all([
      new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true }))),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]);
    assets.then(() => (loaded = true));
    setTimeout(() => (loaded = true), 3500);
    let p = 0, prog = 0, last = performance.now();
    const s = last;
    (function step(now) {
      // Időalapú haladás: ~1,4 mp alatt 100%, de betöltés előtt 86%-nál megáll
      prog = Math.min(1, prog + (now - last) / 1400);
      last = now;
      const eased = 1 - Math.pow(1 - prog, 3);
      p = loaded ? eased : Math.min(eased, 0.86);
      if (now - s > 5000) p = 1;
      num.textContent = Math.round(p * 100);
      bar.style.strokeDashoffset = String(1 - p);
      if (p < 1) { requestAnimationFrame(step); return; }
      setTimeout(() => {
        loader.classList.add("is-done");
        setTimeout(fireReady, 350);
        setTimeout(() => loader.remove(), 1400);
      }, 200);
    })(s);
  }

  function initTransitions() {
    document.body.appendChild(curtain);
    const fromNav = ss.get("vk-curtain") === "1";
    ss.del("vk-curtain");
    const firstVisit = !ss.get("vk-seen");
    ss.set("vk-seen", "1");

    if (fromNav && !reduceMotion) {
      curtain.classList.add("is-in", "no-anim");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        curtain.classList.remove("no-anim");
        curtain.classList.add("is-out");
        setTimeout(fireReady, 250);
        setTimeout(() => { curtain.classList.add("no-anim"); curtain.classList.remove("is-in", "is-out"); }, 1100);
      }));
    } else if (page === "home" && firstVisit && !reduceMotion) {
      runLoader();
    } else {
      requestAnimationFrame(fireReady);
    }

    if (reduceMotion) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      curtain.style.setProperty("--cx", e.clientX + "px");
      curtain.style.setProperty("--cy", e.clientY + "px");
      curtain.classList.remove("no-anim", "is-out");
      curtain.classList.add("is-in");
      ss.set("vk-curtain", "1");
      setTimeout(() => { location.href = url.href; }, 780);
    });
    addEventListener("pageshow", (e) => {
      if (e.persisted) { curtain.classList.add("no-anim"); curtain.classList.remove("is-in", "is-out"); ss.del("vk-curtain"); }
    });
  }

  /* ================= Hírek ================= */
  const ART = [["#0c0c0e", "#ff4a1c"], ["#e2ded5", "#0c0c0e"], ["#ff4a1c", "#0c0c0e"], ["#232327", "#c9c4b9"], ["#c9c4b9", "#ff4a1c"], ["#161619", "#efece6"]];
  function newsArt(i) {
    const [a, b] = ART[i % ART.length];
    const shapes = [
      '<circle cx="280" cy="170" r="150" fill="' + b + '"/><circle cx="110" cy="90" r="56" fill="#efece6" opacity=".92"/>',
      '<rect x="-40" y="170" width="480" height="240" rx="120" fill="' + b + '" transform="rotate(-8 200 150)"/><circle cx="300" cy="84" r="48" fill="#efece6"/>',
      '<circle cx="200" cy="150" r="120" fill="none" stroke="' + b + '" stroke-width="26"/><circle cx="200" cy="150" r="46" fill="' + b + '"/><ellipse cx="200" cy="150" rx="190" ry="54" fill="none" stroke="#efece6" stroke-width="3" transform="rotate(-20 200 150)"/>',
      '<path d="M0 300 C 80 60 180 60 240 180 S 360 280 400 120 V 300 Z" fill="' + b + '"/>'
    ];
    return '<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="300" fill="' + a + '"/>' + shapes[i % shapes.length] + "</svg>";
  }
  function formatDate(iso) {
    return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : "en-GB", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  }
  let newsCache = null;
  function loadNews() {
    if (newsCache) return Promise.resolve(newsCache);
    return fetch("data/news.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => (newsCache = d.items.sort((a, b) => b.date.localeCompare(a.date))));
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function newsCardHTML(item, i, lead) {
    return '<article class="news-card reveal' + (lead ? " news-card--lead" : "") + '" style="--d:' + (i % 3) * 0.1 + 's">' +
      '<a href="#" data-news="' + esc(item.id) + '" class="news-thumb" data-cursor="cursor.read" tabindex="-1" aria-hidden="true">' + newsArt(item.art != null ? item.art : i) + '<span class="tag">' + t("news.cat." + item.category) + "</span></a>" +
      '<div class="news-meta">' + formatDate(item.date) + "</div>" +
      '<h3><a href="#" data-news="' + esc(item.id) + '">' + esc(tr(item.title)) + "</a></h3>" +
      "<p>" + esc(tr(item.excerpt)) + "</p></article>";
  }
  let lastFocus = null;
  function openNews(item) {
    let modal = document.querySelector(".modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = '<div class="modal-panel" data-lenis-prevent><button class="modal-close" type="button">' + icon("close", ' width="20" height="20"') + '</button><div class="modal-body"></div></div>';
      document.body.appendChild(modal);
      const close = () => {
        if (!modal.classList.contains("is-open")) return;
        modal.classList.remove("is-open");
        document.body.style.overflow = "";
        if (lenis) lenis.start();
        if (lastFocus) lastFocus.focus();
      };
      modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest(".modal-close")) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    lastFocus = document.activeElement;
    modal.querySelector(".modal-close").setAttribute("aria-label", t("nav.close"));
    modal.querySelector(".modal-body").innerHTML =
      '<div><span class="tag" style="background:var(--ink);color:var(--accent)">' + t("news.cat." + item.category) + "</span></div>" +
      '<div class="news-meta">' + formatDate(item.date) + "</div>" +
      '<h2 class="h-m">' + esc(tr(item.title)) + "</h2>" +
      tr(item.body).split("\n\n").map((p) => "<p>" + esc(p) + "</p>").join("");
    modal.setAttribute("aria-label", tr(item.title));
    requestAnimationFrame(() => modal.classList.add("is-open"));
    document.body.style.overflow = "hidden";
    if (lenis) lenis.stop();
    modal.querySelector(".modal-close").focus();
  }
  function initNews() {
    const home = document.querySelector("[data-news-latest]");
    const list = document.querySelector("[data-news-list]");
    if (!home && !list) return;
    let filter = "all";
    function render() {
      loadNews().then((items) => {
        if (home) home.innerHTML = items.slice(0, 3).map((it, i) => newsCardHTML(it, i, i === 0)).join("");
        if (list) {
          const chips = document.querySelector("[data-news-chips]");
          const cats = ["all"].concat([...new Set(items.map((i) => i.category))]);
          chips.innerHTML = cats.map((c) => '<button class="chip" type="button" data-cat="' + c + '" aria-pressed="' + (c === filter) + '">' + (c === "all" ? t("news.filter.all") : t("news.cat." + c)) + "</button>").join("");
          const shown = items.filter((i) => filter === "all" || i.category === filter);
          list.innerHTML = shown.length ? shown.map((it, i) => newsCardHTML(it, i, false)).join("") : '<p class="empty">' + t("news.empty") + "</p>";
        }
        observeAll();
        if (hasGSAP) ScrollTrigger.refresh();
      }).catch(() => {
        (home || list).innerHTML = '<p class="empty">Hírek betöltése sikertelen.</p>';
      });
    }
    document.addEventListener("click", (e) => {
      const chip = e.target.closest && e.target.closest("[data-cat]");
      if (chip) { filter = chip.dataset.cat; render(); return; }
      const link = e.target.closest && e.target.closest("[data-news]");
      if (link) {
        e.preventDefault();
        loadNews().then((items) => { const it = items.find((x) => x.id === link.dataset.news); if (it) openNews(it); });
      }
    });
    document.addEventListener("langchange", render);
    render();
  }

  /* ================= Űrlapok (demó) ================= */
  function initForms() {
    document.querySelectorAll("form[data-demo-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const box = form.querySelector("[data-form-status]");
        box.hidden = false;
        box.className = "alert alert--ok";
        box.textContent = t(form.dataset.okKey);
        form.reset();
      });
    });
  }

  /* ================= PWA ================= */
  function initPWA() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
    let deferred = null;
    addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      document.querySelectorAll(".install-link").forEach((b) => (b.hidden = false));
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".install-link") && deferred) { deferred.prompt(); deferred = null; }
    });
  }

  /* ================= Indítás ================= */
  document.documentElement.classList.remove("no-js");
  const grain = document.createElement("div");
  grain.className = "grain";
  grain.setAttribute("aria-hidden", "true");
  document.body.appendChild(grain);

  const isApp = document.body.hasAttribute("data-app");
  if (!isApp) { renderHeader(); renderFooter(); }
  setLang(lang);
  initSmoothScroll();
  initOrbs();
  initGSAPScenes();
  observeAll();
  initCounters();
  initCursor();
  initMagnetic();
  initCardFx();
  initNews();
  initForms();
  initPWA();
  initTransitions();

  // Hero intro a betöltés / oldalváltás után
  whenReady(() => {
    document.querySelectorAll("[data-split-manual], .hero-intro").forEach((el) => el.classList.add("in"));
  });

  if (hasGSAP) gsap.ticker.add(scrollTick);
  else (function loop() { scrollTick(); requestAnimationFrame(loop); })();

  window.VK = { t, tr, setLang, getLang: () => lang, icon, formatDate, observeAll, logo: LOGO_MARK };
  window.VK_FORMAT_DATE = formatDate;
})();
