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
    if (getSession()) location.replace("portal.html");
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
      try {
        const [hash, db] = await Promise.all([
          sha256(c + ":" + pw.value),
          fetch("data/members.json", { cache: "no-cache" }).then((r) => r.json())
        ]);
        const m = db.members.find((x) => x.code === c && x.hash === hash);
        if (!m) throw new Error("auth");
        setSession({ code: m.code, name: m.name, company: m.company });
        location.href = "portal.html";
      } catch (ex) {
        err.hidden = false;
        form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      }
    });
  }

  /* ---------- Portal ---------- */
  const root = document.querySelector("[data-portal]");
  if (!root) return;
  const session = getSession();
  if (!session) { location.replace("login.html"); return; }

  let company = null;
  let active = (location.hash || "#overview").slice(1);
  const TABS = ["overview", "news", "wages", "docs", "contacts", "events"];
  if (!TABS.includes(active)) active = "overview";

  const fmtDate = (iso) => window.VK_FORMAT_DATE(iso);
  function dateBox(iso) {
    const d = new Date(iso);
    const mon = new Intl.DateTimeFormat(VK.getLang() === "hu" ? "hu-HU" : "en-GB", { month: "short" }).format(d).replace(".", "");
    return '<div class="date"><b>' + d.getDate() + "</b><span>" + esc(mon) + "</span></div>";
  }
  function initials(name) { return name.split(" ").map((p) => p[0]).slice(0, 2).join(""); }

  function panelOverview(c) {
    const next = (c.events || []).filter((e) => e.date >= new Date().toISOString().slice(0, 10))[0];
    return '<div class="p-grid">' +
      '<article class="p-card p-card--wide p-card--ink"><small>' + t("portal.highlight") + '</small><h2 class="h-m" style="margin-top:8px">' + esc(tr(c.highlight.title)) + "</h2><p>" + esc(tr(c.highlight.text)) + "</p></article>" +
      '<article class="p-card p-card--accent"><small>' + t("portal.wage.increase") + '</small><div class="kpi">' + esc(c.wages.increase) + "</div><p>" + esc(tr(c.wages.note)) + "</p></article>" +
      '<article class="p-card"><small>' + t("portal.company") + '</small><div class="kpi">' + new Intl.NumberFormat(VK.getLang() === "hu" ? "hu-HU" : "en-GB").format(c.memberCount) + "</div><p>" + t("portal.members") + "</p></article>" +
      '<article class="p-card p-card--wide"><small>' + t("portal.nextEvent") + "</small>" +
      (next ? '<h3 class="h-s" style="margin-top:8px">' + esc(tr(next.title)) + "</h3><p>" + fmtDate(next.date) + " · " + esc(tr(next.text)) + "</p>" : "<p>" + t("portal.events.none") + "</p>") +
      "</article>" +
      '<div class="p-card--full"><h3 class="h-s" style="margin:16px 0">' + t("portal.tab.news") + "</h3>" + newsList(c.news.slice(0, 2)) + "</div>" +
      "</div>";
  }
  function newsList(items) {
    return '<div class="p-list">' + items.map((n) =>
      '<article class="p-item">' + dateBox(n.date) + "<div><h3>" + esc(tr(n.title)) + "</h3><p>" + esc(tr(n.text)) + "</p></div></article>").join("") + "</div>";
  }
  function panelWages(c) {
    const w = c.wages;
    return '<div class="p-grid">' +
      '<article class="p-card p-card--accent"><small>' + t("portal.wage.increase") + '</small><div class="kpi">' + esc(w.increase) + "</div><p>" + esc(tr(w.note)) + "</p></article>" +
      '<article class="p-card p-card--wide"><small>' + t("portal.tab.wages") + "</small>" +
      w.bands.map((b) => '<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;font-weight:700"><span>' + esc(tr(b.label)) + "</span><span>" + esc(b.value) + '</span></div><div class="bar"><i data-w="' + b.pct + '"></i></div></div>').join("") +
      "</article>" +
      '<article class="p-card p-card--full"><small>' + t("portal.wage.bonus") + '</small><table class="wage-table"><tbody>' +
      w.benefits.map((b) => "<tr><td>" + esc(tr(b.label)) + "</td><td><b>" + esc(tr(b.value)) + "</b></td></tr>").join("") +
      "</tbody></table></article></div>";
  }
  function panelDocs(c) {
    return '<div class="p-list">' + c.documents.map((d) =>
      '<article class="p-item"><span class="doc-ico">' + esc(d.type) + "</span><div><h3>" + esc(tr(d.title)) + "</h3><p>" + esc(tr(d.meta)) + '</p></div><a class="btn btn--sm btn--ghost" href="' + esc(d.url) + '">' + icon("download", ' width="18" height="18"') + "<span>" + t("portal.docs.download") + "</span></a></article>").join("") + "</div>";
  }
  function panelContacts(c) {
    return '<div class="people">' + c.contacts.map((p) =>
      '<article class="person-card"><div class="top"><span class="av">' + esc(initials(p.name)) + '</span><div><b>' + esc(p.name) + '</b><p class="muted" style="font-size:14px">' + esc(tr(p.role)) + "</p></div></div>" +
      '<div class="actions"><a class="btn btn--sm" href="tel:' + esc(p.phone.replace(/\s/g, "")) + '">' + icon("call", ' width="16" height="16"') + "<span>" + t("portal.contacts.call") + '</span></a><a class="btn btn--sm btn--ghost" href="mailto:' + esc(p.email) + '">' + icon("mail", ' width="16" height="16"') + "<span>" + t("portal.contacts.mail") + "</span></a></div></article>").join("") + "</div>";
  }
  function panelEvents(c) {
    return c.events.length ? newsList(c.events) : '<p class="empty">' + t("portal.events.none") + "</p>";
  }

  function render() {
    if (!company) return;
    const c = company;
    document.documentElement.style.setProperty("--accent", c.accent);
    root.innerHTML =
      '<header class="portal-head">' +
      '<span class="company-badge">' + esc(c.short) + "</span>" +
      "<div><h1>" + t("portal.hello") + " " + esc(session.name) + "!</h1>" +
      '<div class="meta"><span>' + t("portal.company") + ": <b style=\"color:var(--on-ink)\">" + esc(c.name) + '</b></span><span class="pill">' + t("portal.updated") + ": " + fmtDate(c.updated) + "</span></div></div>" +
      '<button class="btn btn--sm btn--ghost" type="button" data-logout>' + t("portal.logout") + "</button>" +
      "</header>" +
      '<div class="tabs" role="tablist">' + TABS.map((k) =>
        '<button class="tab" role="tab" id="tab-' + k + '" aria-controls="panel-' + k + '" aria-selected="' + (k === active) + '" tabindex="' + (k === active ? 0 : -1) + '" data-tab="' + k + '">' + t("portal.tab." + k) + "</button>").join("") + "</div>" +
      TABS.map((k) => '<section class="panel' + (k === active ? " is-active" : "") + '" role="tabpanel" id="panel-' + k + '" aria-labelledby="tab-' + k + '"></section>').join("") +
      '<p class="demo-note">' + t("portal.demoNote") + "</p>";
    const builders = { overview: panelOverview, news: (x) => newsList(x.news), wages: panelWages, docs: panelDocs, contacts: panelContacts, events: panelEvents };
    TABS.forEach((k) => { root.querySelector("#panel-" + k).innerHTML = builders[k](c); });
    animateBars();
  }
  function animateBars() {
    requestAnimationFrame(() => root.querySelectorAll(".panel.is-active .bar i").forEach((i) => (i.style.width = i.dataset.w + "%")));
  }
  function selectTab(k, focus) {
    active = k;
    history.replaceState(null, "", "#" + k);
    root.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === k;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) { b.focus(); b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }
    });
    root.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.id === "panel-" + k));
    animateBars();
  }

  root.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) selectTab(tab.dataset.tab);
    if (e.target.closest("[data-logout]")) { setSession(null); location.href = "login.html"; }
  });
  root.addEventListener("keydown", (e) => {
    if (!e.target.matches(".tab")) return;
    const i = TABS.indexOf(active);
    if (e.key === "ArrowRight") selectTab(TABS[(i + 1) % TABS.length], true);
    if (e.key === "ArrowLeft") selectTab(TABS[(i - 1 + TABS.length) % TABS.length], true);
  });
  document.addEventListener("langchange", render);

  fetch("data/companies/" + encodeURIComponent(session.company) + ".json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((c) => { company = c; render(); })
    .catch(() => { setSession(null); location.replace("login.html"); });
})();
