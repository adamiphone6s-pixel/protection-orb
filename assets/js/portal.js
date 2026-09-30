/* ==========================================================================
   Tagi belépés + vállalati tagi felület
   FIGYELEM: ez kliensoldali DEMÓ. Éles üzemben a hitelesítés és a vállalati
   adatok kiszolgálása szerveroldalon történik (lásd docs/PROJEKT.md).
   ========================================================================== */
(function () {
  "use strict";
  const { t, tr, icon } = window.VK;
  const SESSION_KEY = "vk-session";

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(s) {
    try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(bytes);
  }
  // crypto.subtle csak HTTPS-en / localhoston érhető el; helyi hálózati teszthez tartalék.
  function sha256Fallback(bytes) {
    const K = [];
    const H = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2, found = 0; found < 64; n++) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (found < 8) H[found] = frac(Math.sqrt(n));
      K[found++] = frac(Math.cbrt(n));
    }
    const len = bytes.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[len] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(total - 4, len * 8);
    view.setUint32(total - 8, Math.floor(len / 536870912));
    const w = new Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Login ---------- */
  const form = document.querySelector("[data-login]");
  if (form) {
    const B = window.VKB;
    if (B && B.live) {
      // Éles mód: nincs demó-hozzáférés; ha már be van lépve, továbbengedjük
      const demo = document.querySelector(".demo-box");
      if (demo) demo.remove();
      B.currentMember().then((m) => { if (m) location.replace(m.company_id ? "portal.html" : "admin.html"); }).catch(() => {});
    } else if (getSession()) location.replace("portal.html");
    const err = form.querySelector("[data-login-error]");
    const code = form.querySelector("#code");
    const pw = form.querySelector("#password");

    form.querySelector(".pw-toggle").addEventListener("click", (e) => {
      const show = pw.type === "password";
      pw.type = show ? "text" : "password";
      e.currentTarget.setAttribute("aria-pressed", String(show));
    });
    form.querySelectorAll("[data-demo-code]").forEach((b) =>
      b.addEventListener("click", () => { code.value = b.dataset.demoCode; pw.value = "demo1234"; pw.focus(); }));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const c = code.value.trim().toUpperCase();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        let target = "portal.html";
        if (B && B.live) {
          const m = await B.login(c, pw.value);
          setSession({ code: m.code, name: m.name, company: m.company_id });
          if (!m.company_id) target = "admin.html";
        } else {
          const [hash, db] = await Promise.all([
            sha256(c + ":" + pw.value),
            fetch("data/members.json", { cache: "no-cache" }).then((r) => r.json())
          ]);
          const m = db.members.find((x) => x.code === c && x.hash === hash);
          if (!m) throw new Error("auth");
          setSession({ code: m.code, name: m.name, company: m.company });
        }
        // Siker: pipa a gombon, majd függönyös átmenet a tagi felületre
        form.classList.add("is-success");
        const lbl = form.querySelector('button[type="submit"] [data-i18n]');
        if (lbl) lbl.textContent = t("login.success");
        const curtain = document.querySelector(".curtain");
        setTimeout(() => {
          if (curtain && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            curtain.style.setProperty("--cx", "75%");
            curtain.style.setProperty("--cy", "60%");
            curtain.classList.remove("no-anim", "is-out");
            curtain.classList.add("is-in");
            try { sessionStorage.setItem("vk-curtain", "1"); } catch (x) {}
            setTimeout(() => (location.href = target), 780);
          } else location.href = target;
        }, 650);
      } catch (ex) {
        btn.disabled = false;
        err.hidden = false;
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      }
    });
  }

  /* ---------- Tagi app ---------- */
  const root = document.querySelector("[data-portal]");
  if (!root) return;
  const B = window.VKB;
  let session = getSession();
  if (!(B && B.live) && !session) { location.replace("login.html"); return; }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const VIEWS = ["overview", "news", "wages", "docs", "contacts", "events"];
  const VIEW_ICON = { overview: "grid", news: "news", wages: "chart", docs: "file", contacts: "users", events: "calendar" };
  let view = (location.hash || "#overview").slice(1);
  if (!VIEWS.includes(view)) view = "overview";
  let company = null;
  let docFilter = "";
  let cdTimer = 0;

  const I = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    calPlus: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    scale: '<path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0L7 8Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const ic = (n, cls) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : "") + ">" + I[n] + "</svg>";
  const L = () => (VK.getLang() === "hu" ? "hu-HU" : "en-GB");
  const fmtDate = (iso) => window.VK_FORMAT_DATE(iso);
  const nf = (n) => new Intl.NumberFormat(L()).format(n);
  const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const upcoming = (c) => (c.events || []).filter((e) => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
  function dayMon(iso) {
    const d = new Date(iso);
    const mon = new Intl.DateTimeFormat(L(), { month: "short" }).format(d).replace(".", "");
    return '<div class="d"><b>' + d.getDate() + "</b><span>" + esc(mon) + "</span></div>";
  }
  function daysLeft(iso) {
    const ms = new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00");
    const n = Math.round(ms / 86400000);
    if (n <= 0) return t("portal.today");
    return VK.getLang() === "hu" ? n + " " + t("portal.days") + " " + t("portal.in") : n + " " + t("portal.days") + " " + t("portal.in");
  }
  function greet() {
    const h = new Date().getHours();
    return t(h >= 5 && h < 10 ? "portal.greet.morning" : h >= 10 && h < 18 ? "portal.greet.day" : "portal.greet.evening");
  }
  // „+9,5%” → { pre:"+", num:9.5, dec:1, post:"%" } a számlálóhoz
  function parseKpi(str) {
    const m = String(str).match(/^([^\d]*)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    const dec = (m[2].split(/[.,]/)[1] || "").length;
    return { pre: m[1], num: parseFloat(m[2].replace(",", ".")), dec, post: m[3] };
  }
  function countUp(el) {
    const k = parseKpi(el.dataset.kpi);
    if (!k) return;
    const fmt = (v) => k.pre + new Intl.NumberFormat(L(), { minimumFractionDigits: k.dec, maximumFractionDigits: k.dec }).format(v) + k.post;
    if (reduce) { el.textContent = fmt(k.num); return; }
    const s = performance.now(), dur = 1600;
    (function step(now) {
      const p = Math.min((now - s) / dur, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(k.num * e);
      if (p < 1) requestAnimationFrame(step);
    })(s);
  }

  /* --- Toast --- */
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  let toastT = 0;
  function notify(msg) {
    toast.innerHTML = "<i>" + ic("check") + "</i>" + esc(msg);
    toast.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("is-on"), 2600);
  }

  /* --- Naptár (.ics) --- */
  function downloadIcs(ev) {
    const d = ev.date.replace(/-/g, "");
    const next = new Date(ev.date + "T00:00:00");
    next.setDate(next.getDate() + 1);
    const d2 = next.toISOString().slice(0, 10).replace(/-/g, "");
    const clean = (s) => String(s).replace(/[,;\\]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vedokor//Tagi felulet//HU", "BEGIN:VEVENT",
      "UID:" + d + "-" + Math.random().toString(36).slice(2) + "@vedokor.hu",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + d2,
      "SUMMARY:" + clean(tr(ev.title)), "DESCRIPTION:" + clean(tr(ev.text) + " — " + company.name),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vedokor-" + ev.date + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(t("portal.ics.ok"));
  }

  /* --- Nézetek --- */
  function vOverview(c) {
    const next = upcoming(c)[0];
    const firstContact = c.contacts[0];
    const firstDoc = c.documents[0];
    const kpi = c.wages.increase;
    const bars = c.wages.bands.map((b, i) => '<i style="--i:' + i + '" data-h="' + b.pct + '"></i>').join("");
    const faces = c.contacts.slice(0, 4).map((p, i) => '<span style="background:' + ["var(--accent)", "var(--mist)", "var(--paper)", "var(--stone)"][i % 4] + '">' + esc(initials(p.name)) + "</span>").join("");
    return '<div class="app-hello">' +
      "<div>" +
      '<div class="date rise" style="--i:0"><span>' + esc(new Intl.DateTimeFormat(L(), { weekday: "long", month: "long", day: "numeric" }).format(new Date())) + '</span><span class="live">' + t("portal.updated") + ": " + fmtDate(c.updated) + "</span></div>" +
      '<h1 class="rise" style="--i:1">' + esc(greet()) + "<br><em>" + esc(session.name) + ".</em></h1>" +
      "</div>" +
      '<div class="orb" aria-hidden="true"><canvas data-app-orb></canvas></div>' +
      "</div>" +
      '<div class="tiles">' +
      // KPI
      '<article class="tile tile--accent s-5 rise" style="--i:2"><div class="top"><small>' + t("portal.wage.increase") + '</small><a href="#wages" data-view="wages" class="corner stretched" aria-label="' + t("portal.tab.wages") + '">' + ic("arrowUR") + "</a></div>" +
      '<div class="kpi" data-kpi="' + esc(kpi) + '">' + esc(kpi) + "</div>" +
      '<div class="foot"><p style="max-width:26ch">' + esc(tr(c.wages.note)) + '</p><div class="spark" style="width:140px">' + bars + "</div></div></article>" +
      // Visszaszámlálás
      '<article class="tile s-4 rise" style="--i:3"><div class="top"><small>' + t("portal.nextEvent") + "</small></div>" +
      (next
        ? "<h3>" + esc(tr(next.title)) + "</h3><p>" + fmtDate(next.date) + " · " + esc(tr(next.text)) + "</p>" +
          '<div class="foot"><div class="cd" data-cd="' + next.date + '"></div><button class="icon-btn" type="button" data-ics="0" aria-label="' + t("portal.ics") + '" title="' + t("portal.ics") + '">' + ic("calPlus") + "</button></div>"
        : "<p>" + t("portal.events.none") + "</p>") +
      "</article>" +
      // Tagok
      '<article class="tile s-3 rise" style="--i:4"><small>' + t("portal.company") + '</small><div class="kpi" style="font-size:clamp(44px,4.4vw,68px)" data-kpi="' + c.memberCount + '">' + nf(c.memberCount) + "</div><p>" + t("portal.members") + '</p><div class="foot"><div class="faces">' + faces + "</div></div></article>" +
      // Kiemelt hír
      '<article class="tile tile--bone s-7 rise" style="--i:5"><div class="top"><small>' + t("portal.highlight") + '</small><a href="#news" data-view="news" class="corner stretched" aria-label="' + t("portal.allnews") + '">' + ic("arrowUR") + "</a></div>" +
      '<h2 style="font-size:clamp(28px,3vw,44px);max-width:18ch;margin-top:auto">' + esc(tr(c.highlight.title)) + '</h2><p style="max-width:56ch">' + esc(tr(c.highlight.text)) + "</p></article>" +
      // Gyors elérés
      '<article class="tile s-5 rise" style="--i:6"><small>' + t("portal.quick") + '</small><div class="quick">' +
      (firstContact ? '<a href="tel:' + esc(firstContact.phone.replace(/\s/g, "")) + '">' + ic("phone") + "<span>" + t("portal.quick.call") + '</span><span class="go">' + ic("arrow") + "</span></a>" : "") +
      (firstDoc ? '<a href="#docs" data-view="docs">' + ic("file") + "<span>" + t("portal.quick.doc") + '</span><span class="go">' + ic("arrow") + "</span></a>" : "") +
      '<a href="tel:+3610000001">' + ic("scale") + "<span>" + t("portal.quick.legal") + '</span><span class="go">' + ic("arrow") + "</span></a>" +
      "</div></article>" +
      // Friss hírek
      '<article class="tile s-12 rise" style="--i:7;min-height:0"><div class="top"><small>' + t("portal.tab.news") + '</small><a href="#news" data-view="news" class="link-arrow" style="font-size:14px">' + t("portal.allnews") + " →</a></div>" +
      '<div class="feed">' + c.news.slice(0, 2).map((n) => "<article>" + dayMon(n.date) + "<div><h3>" + esc(tr(n.title)) + "</h3><p>" + esc(tr(n.text)) + "</p></div></article>").join("") + "</div></article>" +
      "</div>";
  }
  function head(key, extra) {
    return '<div class="view-head"><h1 class="rise" style="--i:0">' + t(key) + "</h1>" + (extra || "") + "</div>";
  }
  function vNews(c) {
    return head("portal.head.news") +
      '<div class="feed">' + c.news.map((n, i) =>
        '<article class="rise" style="--i:' + (i + 1) + '">' + dayMon(n.date) + "<div><h3>" + esc(tr(n.title)) + "</h3><p>" + esc(tr(n.text)) + "</p></div>" +
        (i === 0 ? '<span class="live new">' + t("portal.new") + "</span>" : "") + "</article>").join("") + "</div>";
  }
  function vWages(c) {
    const w = c.wages;
    return head("portal.head.wages") +
      '<div class="tiles">' +
      '<article class="tile tile--accent s-5 rise" style="--i:1;min-height:340px"><small>' + t("portal.wage.increase") + '</small><div class="kpi" style="margin-top:auto;font-size:clamp(64px,6.6vw,116px)" data-kpi="' + esc(w.increase) + '">' + esc(w.increase) + "</div><p>" + esc(tr(w.note)) + "</p></article>" +
      '<article class="tile s-7 rise" style="--i:2"><small>' + t("portal.bands") + '</small><div style="margin-top:auto">' +
      w.bands.map((b, i) => '<div class="hbar"><span>' + esc(tr(b.label)) + '</span><div class="track"><i style="--i:' + i + '" data-w="' + b.pct + '"></i></div><b>' + esc(b.value) + "</b></div>").join("") +
      "</div></article>" +
      '<article class="tile tile--bone s-12 rise" style="--i:3;min-height:0"><small>' + t("portal.wage.bonus") + '</small><div style="margin-top:12px">' +
      w.benefits.map((b) => '<div class="ben"><span>' + esc(tr(b.label)) + "</span><i></i><b>" + esc(tr(b.value)) + "</b></div>").join("") +
      "</div></article></div>";
  }
  function docCards(c) {
    const q = docFilter.trim().toLowerCase();
    const list = c.documents.filter((d) => !q || (tr(d.title) + " " + tr(d.meta) + " " + d.type).toLowerCase().includes(q));
    if (!list.length) return '<p class="empty-dark">' + t("portal.docs.none") + "</p>";
    return '<div class="docs">' + list.map((d, i) =>
      '<article class="doc rise" style="--i:' + (i + 1) + '"><span class="type">' + esc(d.type) + "</span><h3>" + esc(tr(d.title)) + "</h3><p>" + esc(tr(d.meta)) + '</p><a class="open" href="' + esc(d.url) + '">' + t("portal.docs.download") + " " + ic("arrowUR").replace("<svg", '<svg width="16" height="16"') + "</a></article>").join("") + "</div>";
  }
  function vDocs(c) {
    return head("portal.head.docs", '<label class="field-dark rise" style="--i:1">' + ic("search") + '<input type="search" data-doc-filter value="' + esc(docFilter) + '" placeholder="' + t("portal.docs.filter") + '" aria-label="' + t("portal.docs.filter") + '"></label>') +
      '<div data-doc-list>' + docCards(c) + "</div>";
  }
  function vContacts(c) {
    return head("portal.head.contacts") +
      '<div class="people-app">' + c.contacts.map((p, i) =>
        '<article class="pc rise" style="--i:' + (i + 1) + '"><div class="av" style="--p:' + (55 + (i * 17) % 40) + '%">' + esc(initials(p.name)) + "</div>" +
        "<div><h3>" + esc(p.name) + "</h3><p>" + esc(tr(p.role)) + "</p></div>" +
        '<div class="contact"><span>' + esc(p.phone) + "</span><span>" + esc(p.email) + "</span></div>" +
        '<div class="actions"><a class="btn btn--volt btn--sm" href="tel:' + esc(p.phone.replace(/\s/g, "")) + '">' + ic("phone").replace("<svg", '<svg width="16" height="16"') + "<span>" + t("portal.contacts.call") + "</span></a>" +
        '<a class="icon-btn" href="mailto:' + esc(p.email) + '" aria-label="' + t("portal.contacts.mail") + '" title="' + t("portal.contacts.mail") + '">' + ic("mail") + "</a>" +
        '<button class="icon-btn" type="button" data-copy="' + esc(p.email) + '" aria-label="' + t("portal.copy") + '" title="' + t("portal.copy") + '">' + ic("copy") + "</button></div></article>").join("") + "</div>";
  }
  function vEvents(c) {
    const list = upcoming(c);
    if (!list.length) return head("portal.head.events") + '<p class="empty-dark">' + t("portal.events.none") + "</p>";
    return head("portal.head.events") +
      '<div class="tl-app">' + list.map((e, i) =>
        '<article class="ev rise" style="--i:' + (i + 1) + '">' + dayMon(e.date) +
        "<div><h3>" + esc(tr(e.title)) + "</h3><p>" + esc(tr(e.text)) + '</p><span class="chip-left">' + esc(daysLeft(e.date)) + "</span></div>" +
        '<button class="btn btn--line btn--sm" type="button" data-ics-date="' + e.date + '">' + ic("calPlus").replace("<svg", '<svg width="16" height="16"') + "<span>" + t("portal.ics") + "</span></button></article>").join("") + "</div>";
  }
  const BUILD = { overview: vOverview, news: vNews, wages: vWages, docs: vDocs, contacts: vContacts, events: vEvents };

  /* --- Keret --- */
  function navLinks(cls) {
    const counts = { news: company.news.length, docs: company.documents.length, events: upcoming(company).length };
    return VIEWS.map((k) =>
      '<a href="#' + k + '" data-view="' + k + '"' + (k === view ? ' aria-current="page"' : "") + (cls ? ' class="' + cls + '"' : "") + ">" + ic(VIEW_ICON[k]) + "<span>" + t("portal.tab." + k) + "</span>" +
      (!cls && counts[k] ? '<span class="count">' + counts[k] + "</span>" : "") + "</a>").join("");
  }
  function renderShell() {
    const c = company;
    document.documentElement.style.setProperty("--accent-c", c.accent);
    const logo = VK.logo || "";
    root.innerHTML =
      '<aside class="app-side" aria-label="' + t("portal.menu") + '">' +
      '<a class="logo" href="index.html">' + logo + '<span><span>Védőkör</span><small data-i18n="brand.tag">' + t("brand.tag") + "</small></span></a>" +
      '<div class="app-side-label">' + t("portal.menu") + "</div>" +
      '<nav class="app-nav"><span class="ind" aria-hidden="true"></span>' + navLinks() + "</nav>" +
      '<div class="app-me"><div class="row"><span class="badge">' + esc(c.short) + "</span><div><b>" + esc(c.name) + "</b><small>" + t("portal.code") + ": " + esc(session.code) + "</small></div></div>" +
      '<button class="logout" type="button" data-logout>' + ic("logout").replace("<svg", '<svg width="16" height="16"') + t("portal.logout") + "</button></div>" +
      "</aside>" +
      '<main class="app-main" id="main">' +
      '<div class="app-top">' +
      '<a class="logo" href="index.html" aria-label="Védőkör">' + logo + "<span></span></a>" +
      '<div class="crumb"><span>' + esc(c.name) + '</span><i></i><b data-crumb>' + t("portal.tab." + view) + "</b></div>" +
      '<div class="spacer"></div>' +
      '<button class="search-btn" type="button" data-cmdk>' + ic("search") + "<span>" + t("portal.search") + "</span><kbd>" + (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K") + "</kbd></button>" +
      '<button class="lang-toggle' + (VK.getLang() === "en" ? " is-en" : "") + '" type="button" aria-label="' + t("lang.switch") + '"><span data-lang="hu"' + (VK.getLang() === "hu" ? ' class="is-active"' : "") + '>HU</span><span data-lang="en"' + (VK.getLang() === "en" ? ' class="is-active"' : "") + ">EN</span></button>" +
      "</div>" +
      VIEWS.map((k) => '<section class="app-view' + (k === view ? " is-active" : "") + '" data-v="' + k + '" aria-label="' + t("portal.tab." + k) + '"></section>').join("") +
      '<p class="demo-note--dark">' + t("portal.demoNote") + "</p>" +
      "</main>" +
      '<nav class="app-tabbar" aria-label="' + t("portal.menu") + '">' + navLinks("tb") + "</nav>";
    renderView(view, false);
    root.querySelector(".lang-toggle").addEventListener("click", () => VK.setLang(VK.getLang() === "hu" ? "en" : "hu"));
    requestAnimationFrame(moveIndicator);
  }
  function moveIndicator() {
    const nav = root.querySelector(".app-nav");
    const a = nav && nav.querySelector('a[aria-current="page"]');
    const ind = nav && nav.querySelector(".ind");
    if (!a || !ind) return;
    ind.style.transform = "translateY(" + a.offsetTop + "px)";
    ind.style.height = a.offsetHeight + "px";
  }
  function renderView(k, animate) {
    const sec = root.querySelector('[data-v="' + k + '"]');
    sec.innerHTML = BUILD[k](company);
    if (!animate) sec.querySelectorAll(".rise").forEach((el) => (el.style.animationDelay = "calc(var(--i, 0) * 70ms + 150ms)"));
    afterRender(sec);
  }
  function afterRender(sec) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sec.querySelectorAll(".spark i").forEach((i) => (i.style.height = i.dataset.h + "%"));
      sec.querySelectorAll(".hbar .track i").forEach((i) => (i.style.width = i.dataset.w + "%"));
    }));
    sec.querySelectorAll("[data-kpi]").forEach(countUp);
    const orb = sec.querySelector("canvas[data-app-orb]");
    if (orb && !orb.dataset.init) { orb.dataset.init = "1"; if (window.VKOrbGL) window.VKOrbGL(orb, { quality: 0.9 }); }
    startCountdown(sec);
  }
  function startCountdown(sec) {
    clearInterval(cdTimer);
    const el = sec.querySelector("[data-cd]");
    if (!el) return;
    const target = new Date(el.dataset.cd + "T09:00:00");
    const units = [["d", 86400], ["h", 3600], ["m", 60], ["s", 1]];
    function tick() {
      let s = Math.max(0, Math.floor((target - new Date()) / 1000));
      el.innerHTML = units.map(([u, sec]) => { const v = Math.floor(s / sec); s -= v * sec; return "<div><b>" + String(v).padStart(2, "0") + "</b><span>" + t("portal.cd." + u) + "</span></div>"; }).join("");
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }
  function go(k, push) {
    if (!VIEWS.includes(k) || k === view) { if (k === view) window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); return; }
    view = k;
    history[push ? "pushState" : "replaceState"](null, "", "#" + k);
    root.querySelectorAll(".app-nav a, .app-tabbar a").forEach((a) => { if (a.dataset.view === k) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    root.querySelectorAll(".app-view").forEach((s) => s.classList.toggle("is-active", s.dataset.v === k));
    const crumb = root.querySelector("[data-crumb]");
    if (crumb) crumb.textContent = t("portal.tab." + k);
    renderView(k, true);
    moveIndicator();
    window.scrollTo({ top: 0, behavior: "auto" });
    const h = root.querySelector('[data-v="' + k + '"] h1');
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  /* --- Parancspaletta --- */
  const cmdk = document.createElement("div");
  cmdk.className = "cmdk";
  cmdk.setAttribute("role", "dialog");
  cmdk.setAttribute("aria-modal", "true");
  cmdk.innerHTML = '<div class="cmdk-panel"><label class="cmdk-in">' + ic("search") + '<input type="text" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></label><div class="cmdk-list" role="listbox" data-lenis-prevent></div><div class="cmdk-foot"></div></div>';
  document.body.appendChild(cmdk);
  const cIn = cmdk.querySelector("input");
  const cList = cmdk.querySelector(".cmdk-list");
  let cItems = [], cIdx = 0, lastFocus = null;
  function cmdkData() {
    const c = company;
    return [
      { g: "portal.search.views", items: VIEWS.map((k) => ({ icon: VIEW_ICON[k], label: t("portal.tab." + k), run: () => go(k, true) })) },
      { g: "portal.search.docs", items: c.documents.map((d) => ({ icon: "file", label: tr(d.title), sub: tr(d.meta), run: () => { docFilter = tr(d.title); go("docs", true); renderView("docs", true); } })) },
      { g: "portal.search.people", items: c.contacts.map((p) => ({ icon: "users", label: p.name, sub: tr(p.role), run: () => go("contacts", true) })) },
      { g: "portal.search.events", items: upcoming(c).map((e) => ({ icon: "calendar", label: tr(e.title), sub: fmtDate(e.date), run: () => go("events", true) })) }
    ];
  }
  function cmdkRender() {
    const q = cIn.value.trim().toLowerCase();
    cItems = [];
    let html = "";
    cmdkData().forEach((grp) => {
      const hits = grp.items.filter((it) => !q || (it.label + " " + (it.sub || "")).toLowerCase().includes(q));
      if (!hits.length) return;
      html += '<div class="cmdk-group">' + t(grp.g) + "</div>";
      hits.forEach((it) => {
        const i = cItems.length;
        cItems.push(it);
        html += '<button class="cmdk-item" type="button" role="option" data-i="' + i + '">' + ic(it.icon) + "<span>" + esc(it.label) + "</span>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</button>";
      });
    });
    cList.innerHTML = html || '<p class="cmdk-empty">' + t("portal.search.empty") + " „" + esc(cIn.value) + "”</p>";
    cIdx = 0;
    cmdkMark();
  }
  function cmdkMark() {
    cList.querySelectorAll(".cmdk-item").forEach((b) => {
      const on = Number(b.dataset.i) === cIdx;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
      if (on) b.scrollIntoView({ block: "nearest" });
    });
  }
  function cmdkOpen() {
    lastFocus = document.activeElement;
    cIn.placeholder = t("portal.search.ph");
    cmdk.querySelector(".cmdk-foot").innerHTML = "<span><kbd>↑↓</kbd>" + t("portal.search.nav") + "</span><span><kbd>↵</kbd>" + t("portal.search.open") + "</span><span><kbd>Esc</kbd>" + t("portal.search.close") + "</span>";
    cIn.value = "";
    cmdkRender();
    cmdk.classList.add("is-open");
    setTimeout(() => cIn.focus(), 30);
  }
  function cmdkClose() {
    if (!cmdk.classList.contains("is-open")) return;
    cmdk.classList.remove("is-open");
    if (lastFocus) lastFocus.focus();
  }
  function cmdkRun(i) {
    const it = cItems[i];
    if (!it) return;
    cmdkClose();
    it.run();
  }
  cIn.addEventListener("input", cmdkRender);
  cIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); cIdx = Math.min(cItems.length - 1, cIdx + 1); cmdkMark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cIdx = Math.max(0, cIdx - 1); cmdkMark(); }
    else if (e.key === "Enter") { e.preventDefault(); cmdkRun(cIdx); }
  });
  cmdk.addEventListener("click", (e) => {
    if (e.target === cmdk) return cmdkClose();
    const b = e.target.closest(".cmdk-item");
    if (b) cmdkRun(Number(b.dataset.i));
  });
  cList.addEventListener("pointermove", (e) => {
    const b = e.target.closest(".cmdk-item");
    if (b && Number(b.dataset.i) !== cIdx) { cIdx = Number(b.dataset.i); cmdkMark(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdk.classList.contains("is-open") ? cmdkClose() : company && cmdkOpen(); }
    else if (e.key === "Escape") cmdkClose();
  });

  /* --- Események --- */
  root.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]");
    if (v) { e.preventDefault(); go(v.dataset.view, true); return; }
    if (e.target.closest("[data-logout]")) {
      setSession(null);
      Promise.resolve(B && B.live ? B.logout() : null).finally(() => (location.href = "login.html"));
      return;
    }
    if (e.target.closest("[data-cmdk]")) { cmdkOpen(); return; }
    const ics = e.target.closest("[data-ics], [data-ics-date]");
    if (ics) {
      const ev = ics.dataset.icsDate ? company.events.find((x) => x.date === ics.dataset.icsDate) : upcoming(company)[0];
      if (ev) downloadIcs(ev);
      return;
    }
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const txt = cp.dataset.copy;
      const done = () => notify(t("portal.copied"));
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
    }
  });
  root.addEventListener("input", (e) => {
    if (!e.target.matches("[data-doc-filter]")) return;
    docFilter = e.target.value;
    const list = root.querySelector("[data-doc-list]");
    list.innerHTML = docCards(company);
    list.querySelectorAll(".rise").forEach((el) => (el.style.animation = "none"));
  });
  window.addEventListener("popstate", () => {
    const k = (location.hash || "#overview").slice(1);
    if (VIEWS.includes(k) && k !== view) go(k, false);
  });
  window.addEventListener("resize", moveIndicator);
  document.addEventListener("langchange", () => { if (company) renderShell(); });

  /* --- Első belépés: kötelező jelszócsere (éles mód) --- */
  function askNewPassword() {
    const m = document.createElement("div");
    m.className = "cmdk is-open pw-modal";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.innerHTML =
      '<form class="cmdk-panel" style="padding:clamp(24px,4vw,40px);gap:16px" novalidate>' +
      '<h2 style="font-size:clamp(26px,3vw,36px);letter-spacing:-0.04em">' + t("portal.pw.title") + "</h2>" +
      '<p style="color:var(--on-ink-muted)">' + t("portal.pw.lead") + "</p>" +
      '<label class="field-dark" style="max-width:none">' + ic("lock") + '<input type="password" name="p1" autocomplete="new-password" placeholder="' + t("portal.pw.new") + '" aria-label="' + t("portal.pw.new") + '" required minlength="10"></label>' +
      '<label class="field-dark" style="max-width:none">' + ic("lock") + '<input type="password" name="p2" autocomplete="new-password" placeholder="' + t("portal.pw.confirm") + '" aria-label="' + t("portal.pw.confirm") + '" required minlength="10"></label>' +
      '<p class="alert alert--err" hidden role="alert"></p>' +
      '<button class="btn btn--volt btn--block" type="submit">' + t("portal.pw.save") + "</button></form>";
    document.body.appendChild(m);
    const f = m.querySelector("form"), er = m.querySelector(".alert");
    setTimeout(() => f.p1.focus(), 50);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      er.hidden = true;
      const p1 = f.p1.value, p2 = f.p2.value;
      const fail = (k) => { er.textContent = t(k); er.hidden = false; };
      if (p1.length < 10) return fail("portal.pw.short");
      if (p1 !== p2) return fail("portal.pw.mismatch");
      f.querySelector("button").disabled = true;
      try {
        await B.changePassword(p1);
        m.remove();
        notify(t("portal.pw.ok"));
      } catch (ex) {
        f.querySelector("button").disabled = false;
        fail("portal.pw.error");
      }
    });
  }

  (async () => {
    try {
      if (B && B.live) {
        const m = await B.currentMember();
        if (!m) throw new Error("nosession");
        if (!m.company_id) { location.replace("admin.html"); return; }
        session = { code: m.code, name: m.name, company: m.company_id };
        company = await B.loadCompany(m.company_id);
        renderShell();
        if (m.must_change_password) askNewPassword();
      } else {
        const r = await fetch("data/companies/" + encodeURIComponent(session.company) + ".json", { cache: "no-cache" });
        if (!r.ok) throw new Error("company");
        company = await r.json();
        renderShell();
      }
    } catch (e) {
      setSession(null);
      location.replace("login.html");
    }
  })();

})();
