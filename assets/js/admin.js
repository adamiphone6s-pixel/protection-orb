/* ==========================================================================
   Védőkör — admin felület
   Hírek, vállalati tagi tartalmak (dokumentumfeltöltéssel), tagkezelés és
   beérkezett űrlapok. Csak éles (Supabase) módban működik; a jogosultságot
   az adatbázis RLS szabályai és a szerveroldali /api/admin függvény érvényesítik.
   ========================================================================== */
(function () {
  "use strict";
  const B = window.VKB;
  const root = document.querySelector("[data-admin]");
  if (!root) return;

  /* ---------- Segédek ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const I = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>',
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5.5"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6l2-8Z"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'
  };
  const ic = (n, sz) => '<svg width="' + (sz || 18) + '" height="' + (sz || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + "</svg>";
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split(".");
    let cur = o;
    ks.slice(0, -1).forEach((k, i) => {
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      cur = cur[k];
    });
    cur[ks[ks.length - 1]] = v;
  }
  const i18nVal = (v) => (v && typeof v === "object" ? { hu: v.hu || "", en: v.en || "" } : { hu: v == null ? "" : String(v), en: "" });
  const CAT = { berek: "Bérek", jog: "Jog", kozosseg: "Közösség", munkavedelem: "Munkavédelem" };

  /* ---------- Toast / megerősítés ---------- */
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  let toastT = 0;
  function notify(msg, isErr) {
    toast.innerHTML = '<i style="' + (isErr ? "background:#a3361c;color:#fff" : "") + '">' + ic(isErr ? "close" : "check", 14) + "</i>" + esc(msg);
    toast.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("is-on"), isErr ? 5000 : 2600);
  }
  const fail = (e) => notify((e && e.message) || "Hiba történt.", true);
  const confirmDo = (msg) => window.confirm(msg);

  /* ---------- Drawer ---------- */
  const drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.innerHTML = '<div class="drawer-panel" data-lenis-prevent></div>';
  document.body.appendChild(drawer);
  const panel = drawer.querySelector(".drawer-panel");
  let drawerDirty = false;
  function openDrawer(html) {
    panel.innerHTML = html;
    drawer.classList.add("is-open");
    drawerDirty = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => { const f = panel.querySelector("input, textarea, select"); if (f) f.focus(); }, 60);
  }
  function closeDrawer(force) {
    if (!force && drawerDirty && !confirmDo("Van mentetlen módosítás. Biztosan bezárod?")) return;
    drawer.classList.remove("is-open");
    document.body.style.overflow = "";
  }
  drawer.addEventListener("click", (e) => { if (e.target === drawer || e.target.closest("[data-close]")) closeDrawer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer(); });
  panel.addEventListener("input", () => (drawerDirty = true));

  /* ---------- Űrlapmezők (sémából) ---------- */
  function field(f, value, path) {
    const lbl = f.l ? "<span>" + esc(f.l) + "</span>" : "";
    const full = f.full || f.t === "i18n" || f.t === "i18n-area" || f.t === "list" ? " full" : "";
    if (f.t === "i18n" || f.t === "i18n-area") {
      const v = i18nVal(value);
      const tag = f.t === "i18n" ? "input" : "textarea";
      const cls = "in" + (f.tall ? " tall" : "");
      const one = (lang) => '<div class="in-wrap" data-lang="' + lang.toUpperCase() + '">' +
        (tag === "input"
          ? '<input class="' + cls + '" data-path="' + path + "." + lang + '" value="' + esc(v[lang]) + '"' + (lang === "hu" && f.req ? " required" : "") + ">"
          : '<textarea class="' + cls + '" data-path="' + path + "." + lang + '">' + esc(v[lang]) + "</textarea>") + "</div>";
      return '<label class="fld' + full + '">' + lbl + '<div class="pair">' + one("hu") + one("en") + "</div></label>";
    }
    if (f.t === "select") {
      return '<label class="fld' + full + '">' + lbl + '<select class="in" data-path="' + path + '">' +
        f.opts.map((o) => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(val) + '"' + (String(value) === String(val) ? " selected" : "") + ">" + esc(txt) + "</option>"; }).join("") + "</select></label>";
    }
    if (f.t === "switch") {
      return '<label class="switch' + full + '"><input type="checkbox" data-path="' + path + '" data-type="bool"' + (value ? " checked" : "") + "><i></i>" + esc(f.l) + "</label>";
    }
    if (f.t === "file") {
      return '<div class="fld full">' + lbl + '<div class="file-row">' +
        '<label class="mini-btn" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' + ic("upload", 15) + " Fájl feltöltése" +
        '<input type="file" data-upload="' + path + '" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" hidden></label>' +
        '<span class="fname">' + (value ? esc(String(value).split("/").pop()) : "Nincs feltöltött fájl") + "</span></div></div>";
    }
    if (f.t === "list") {
      const arr = Array.isArray(value) ? value : [];
      return '<div class="fld full">' + lbl + '<div class="rep">' +
        arr.map((it, i) =>
          '<div class="rep-item"><span class="rep-num">' + String(i + 1).padStart(2, "0") + '</span><div class="rep-actions">' +
          '<button type="button" data-move="' + path + "." + i + '" data-dir="-1" aria-label="Fel">' + ic("up", 15) + "</button>" +
          '<button type="button" data-move="' + path + "." + i + '" data-dir="1" aria-label="Le">' + ic("down", 15) + "</button>" +
          '<button type="button" class="del" data-del="' + path + "." + i + '" aria-label="Törlés">' + ic("trash", 15) + "</button></div>" +
          '<div class="fgrid">' + f.item.map((sf) => field(sf, it[sf.k], path + "." + i + "." + sf.k)).join("") + "</div></div>").join("") +
        '<button type="button" class="add-btn" data-add="' + path + '">' + ic("plus", 16) + " " + esc(f.addLabel || "Új elem") + "</button></div></div>";
    }
    if (f.t === "color" && !value) value = "#c9a45c";
    const type = f.t === "number" ? "number" : f.t === "date" ? "date" : f.t === "color" ? "color" : f.t === "email" ? "email" : "text";
    return '<label class="fld' + full + '">' + lbl + '<input class="in" type="' + type + '" data-path="' + path + '"' + (type === "number" ? ' data-type="num"' : "") +
      ' value="' + esc(value == null ? "" : value) + '"' + (f.req ? " required" : "") + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : "") + "></label>";
  }
  function bindState(container, state, rerender) {
    container.addEventListener("input", (e) => {
      const el = e.target;
      if (!el.dataset || !el.dataset.path) return;
      let v = el.dataset.type === "bool" ? el.checked : el.value;
      if (el.dataset.type === "num") v = el.value === "" ? null : Number(el.value);
      setPath(state, el.dataset.path, v);
    });
    container.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset && el.dataset.type === "bool") { setPath(state, el.dataset.path, el.checked); drawerDirty = true; }
    });
    container.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]"), del = e.target.closest("[data-del]"), mv = e.target.closest("[data-move]");
      if (!add && !del && !mv) return;
      e.preventDefault();
      drawerDirty = true;
      if (add) {
        const arr = getPath(state, add.dataset.add) || [];
        arr.push(add.dataset.add.endsWith("news") || add.dataset.add.endsWith("events") ? { date: today() } : {});
        setPath(state, add.dataset.add, arr);
      } else {
        const p = (del || mv).dataset[del ? "del" : "move"];
        const parent = p.slice(0, p.lastIndexOf(".")), idx = Number(p.slice(p.lastIndexOf(".") + 1));
        const arr = getPath(state, parent);
        if (del) {
          if (!confirmDo("Biztosan törlöd ezt az elemet?")) return;
          const [removed] = arr.splice(idx, 1);
          if (removed && removed.path) state.__removedFiles = (state.__removedFiles || []).concat(removed.path);
        } else {
          const j = idx + Number(mv.dataset.dir);
          if (j < 0 || j >= arr.length) return;
          [arr[idx], arr[j]] = [arr[j], arr[idx]];
        }
      }
      const y = panel.scrollTop;
      rerender();
      panel.scrollTop = y;
    });
  }

  /* ---------- Keret ---------- */
  const VIEWS = [["overview", "Áttekintés", "grid"], ["news", "Hírek", "news"], ["companies", "Vállalatok", "building"], ["members", "Tagok", "users"], ["inbox", "Beérkezett", "inbox"]];
  let view = (location.hash || "#overview").slice(1);
  if (!VIEWS.some((v) => v[0] === view)) view = "overview";
  let me = null;
  let companies = [];

  function shell() {
    root.innerHTML =
      '<aside class="app-side" aria-label="Admin menü"><a class="logo" href="index.html">' + (window.VK && VK.logo ? VK.logo : "") + '<span><span>Védőkör</span><small>Admin</small></span></a>' +
      '<div class="app-side-label">Kezelés</div><nav class="app-nav"><span class="ind" aria-hidden="true"></span>' +
      VIEWS.map(([k, l, i]) => '<a href="#' + k + '" data-view="' + k + '"' + (k === view ? ' aria-current="page"' : "") + ">" + ic(i, 20) + "<span>" + l + '</span><span class="count" data-count="' + k + '" hidden></span></a>').join("") +
      '</nav><div class="app-me"><div class="row"><span class="badge" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--accent);color:var(--ink);font-weight:800">' + esc((me.name || "A").slice(0, 1)) + "</span><div><b>" + esc(me.name) + "</b><small>" + esc(me.code) + " · admin</small></div></div>" +
      '<button class="logout" type="button" data-logout>' + ic("logout", 16) + "Kilépés</button></div></aside>" +
      '<main class="app-main" id="main"><div data-view-root></div></main>' +
      '<nav class="app-tabbar" aria-label="Admin menü" style="grid-template-columns:repeat(5,1fr)">' +
      VIEWS.map(([k, l, i]) => '<a href="#' + k + '" data-view="' + k + '"' + (k === view ? ' aria-current="page"' : "") + ">" + ic(i, 21) + "<span>" + l + "</span></a>").join("") + "</nav>";
    requestAnimationFrame(moveInd);
    render();
  }
  function moveInd() {
    const a = root.querySelector('.app-nav a[aria-current="page"]'), ind = root.querySelector(".app-nav .ind");
    if (a && ind) { ind.style.transform = "translateY(" + a.offsetTop + "px)"; ind.style.height = a.offsetHeight + "px"; }
  }
  function go(k) {
    view = k;
    history.replaceState(null, "", "#" + k);
    root.querySelectorAll(".app-nav a, .app-tabbar a").forEach((a) => {
      if (a.dataset.view === k) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    moveInd();
    render();
    window.scrollTo(0, 0);
  }
  const main = () => root.querySelector("[data-view-root]");
  const head = (title, sub, actions) =>
    '<div class="view-head"><div><h1>' + title + "</h1>" + (sub ? '<p style="margin-top:14px">' + sub + "</p>" : "") + "</div>" + (actions || "") + "</div>";

  async function render() {
    const el = main();
    el.innerHTML = '<p class="muted" style="padding:40px 0">Betöltés…</p>';
    try {
      if (view === "overview") await vOverview(el);
      else if (view === "news") await vNews(el);
      else if (view === "companies") await vCompanies(el);
      else if (view === "members") await vMembers(el);
      else if (view === "inbox") await vInbox(el);
    } catch (e) {
      el.innerHTML = '<div class="note">Hiba a betöltéskor: ' + esc(e.message || e) + "</div>";
    }
    refreshCounts();
  }
  async function refreshCounts() {
    try {
      const sb = await B.ready();
      const subs = B.unwrap(await sb.from("submissions").select("id").eq("handled", false)) || [];
      const c = root.querySelector('[data-count="inbox"]');
      if (c) { c.textContent = subs.length; c.hidden = !subs.length; }
    } catch (e) { /* nem kritikus */ }
  }
  async function loadCompanies() {
    const sb = await B.ready();
    companies = B.unwrap(await sb.from("companies").select("id, name, content, updated_at").order("name", { ascending: true })) || [];
    return companies;
  }
  const coName = (id) => { const c = companies.find((x) => x.id === id); return c ? c.name : id || "—"; };

  /* ---------- Áttekintés ---------- */
  async function vOverview(el) {
    const sb = await B.ready();
    const [mem, news, subs] = await Promise.all([
      sb.from("members").select("user_id, role").then(B.unwrap),
      sb.from("news").select("id, published").then(B.unwrap),
      sb.from("submissions").select("id, handled").then(B.unwrap)
    ]);
    await loadCompanies();
    const tile = (n, l, v, cls) => '<button class="tile ' + (cls || "") + ' s-3" style="text-align:left;min-height:180px" data-view="' + v + '"><small>' + l + '</small><div class="kpi" style="margin-top:auto;font-size:clamp(48px,5vw,72px)">' + n + "</div></button>";
    el.innerHTML = head("Szia, <em>" + esc(me.name) + ".</em>", "Innen kezeled a weboldal és a tagi felület tartalmát.") +
      '<div class="tiles">' +
      tile(mem.filter((m) => m.role === "member").length, "Tag", "members", "tile--accent") +
      tile(companies.length, "Vállalat", "companies") +
      tile(news.filter((n) => n.published).length, "Publikus hír", "news") +
      tile(subs.filter((s) => !s.handled).length, "Kezeletlen üzenet", "inbox", "tile--bone") +
      "</div>" +
      '<div class="note" style="margin-top:24px">Havi frissítés: <b>Vállalatok</b> → válaszd ki a céget → frissítsd a béreket, híreket, eseményeket, dokumentumokat → <b>Mentés</b>. A tagok azonnal a frissített tartalmat látják.</div>';
  }

  /* ---------- Hírek ---------- */
  const NEWS_SCHEMA = [
    { k: "date", l: "Dátum", t: "date", req: true },
    { k: "category", l: "Kategória", t: "select", opts: Object.entries(CAT) },
    { k: "art", l: "Borítókép stílusa", t: "select", opts: [["", "Automatikus"], ["0", "1 — kör"], ["1", "2 — hullám"], ["2", "3 — gyűrű"], ["3", "4 — domb"], ["4", "5 — kör, világos"], ["5", "6 — sötét"]] },
    { k: "published", l: "Publikus (megjelenik a weboldalon)", t: "switch" },
    { k: "title", l: "Cím", t: "i18n", req: true },
    { k: "excerpt", l: "Rövid összefoglaló (a kártyán)", t: "i18n-area" },
    { k: "body", l: "Teljes szöveg (bekezdések között üres sor)", t: "i18n-area", tall: true }
  ];
  async function vNews(el) {
    const sb = await B.ready();
    const rows = B.unwrap(await sb.from("news").select("*").order("date", { ascending: false })) || [];
    el.innerHTML = head("Hírek", "A weboldal nyilvános hírei. Csak a publikusra állított hírek jelennek meg.", '<button class="btn btn--volt btn--sm" data-news-new>' + ic("plus", 16) + "<span>Új hír</span></button>") +
      (rows.length
        ? '<div class="table-wrap"><table class="adm-table"><thead><tr><th>Dátum</th><th>Cím</th><th>Kategória</th><th>Állapot</th><th></th></tr></thead><tbody>' +
          rows.map((n) => "<tr><td class=\"mono\">" + esc(n.date) + "</td><td><b>" + esc(i18nVal(n.title).hu) + "</b></td><td>" + esc(CAT[n.category] || n.category) + "</td><td>" +
            (n.published ? '<span class="badge badge--accent">Publikus</span>' : '<span class="badge badge--muted">Piszkozat</span>') +
            '</td><td class="act"><button class="mini-btn" data-news-edit="' + n.id + '">Szerkesztés</button></td></tr>').join("") + "</tbody></table></div>"
        : '<p class="empty-dark">Még nincs hír. Hozd létre az elsőt!</p>');
    el.onclick = (e) => {
      if (e.target.closest("[data-news-new]")) newsEditor({ date: today(), category: "kozosseg", published: false, title: { hu: "", en: "" }, excerpt: { hu: "", en: "" }, body: { hu: "", en: "" } });
      const ed = e.target.closest("[data-news-edit]");
      if (ed) newsEditor(JSON.parse(JSON.stringify(rows.find((r) => r.id === ed.dataset.newsEdit))));
    };
  }
  function newsEditor(item) {
    const state = item;
    if (state.art != null) state.art = String(state.art);
    const draw = () => {
      openDrawer('<div class="drawer-head"><h2>' + (state.id ? "Hír szerkesztése" : "Új hír") + '</h2><button class="icon-btn" data-close aria-label="Bezárás">' + ic("close") + "</button></div>" +
        '<form class="fgrid" data-form novalidate>' + NEWS_SCHEMA.map((f) => field(f, state[f.k], f.k)).join("") + "</form>" +
        '<div class="drawer-foot">' + (state.id ? '<button class="mini-btn danger" data-news-del>' + "Hír törlése</button>" : "<span></span>") +
        '<button class="btn btn--volt btn--sm" data-news-save>' + ic("check", 16) + "<span>Mentés</span></button></div>");
      const form = panel.querySelector("[data-form]");
      bindState(form, state, draw);
    };
    draw();
    panel.onclick = async (e) => {
      if (e.target.closest("[data-news-save]")) {
        if (!state.title || !i18nVal(state.title).hu.trim()) return notify("A magyar cím kötelező.", true);
        const sb = await B.ready();
        const row = { date: state.date || today(), category: state.category || "kozosseg", published: !!state.published, title: i18nVal(state.title), excerpt: i18nVal(state.excerpt), body: i18nVal(state.body), art: state.art === "" || state.art == null ? null : Number(state.art) };
        try {
          B.unwrap(state.id ? await sb.from("news").update(row).eq("id", state.id) : await sb.from("news").insert(row));
          closeDrawer(true); notify("Hír elmentve"); render();
        } catch (err) { fail(err); }
      }
      if (e.target.closest("[data-news-del]")) {
        if (!confirmDo("Biztosan törlöd ezt a hírt? Ez nem vonható vissza.")) return;
        try { const sb = await B.ready(); B.unwrap(await sb.from("news").delete().eq("id", state.id)); closeDrawer(true); notify("Hír törölve"); render(); } catch (err) { fail(err); }
      }
    };
  }

  /* ---------- Vállalatok ---------- */
  const DATED = [{ k: "date", l: "Dátum", t: "date" }, { k: "title", l: "Cím", t: "i18n" }, { k: "text", l: "Szöveg", t: "i18n-area" }];
  const COMPANY_SCHEMA = [
    { s: "Alapadatok", f: [{ k: "__name", l: "Vállalat neve", t: "text", req: true }, { k: "short", l: "Rövidítés (2–3 betű, pl. MP)", t: "text" }, { k: "accent", l: "Kiemelőszín", t: "color" }, { k: "memberCount", l: "Taglétszám (a tagi felületen)", t: "number" }] },
    { s: "A hónap kiemelt híre", f: [{ k: "highlight.title", l: "Cím", t: "i18n" }, { k: "highlight.text", l: "Szöveg", t: "i18n-area" }] },
    { s: "Bérek és juttatások", f: [
      { k: "wages.increase", l: "Átlagos béremelés (pl. +9,5%)", t: "text" }, { k: "wages.note", l: "Megjegyzés", t: "i18n" },
      { k: "wages.bands", l: "Emelés munkakörönként", t: "list", addLabel: "Új munkakör", item: [{ k: "label", l: "Munkakör", t: "i18n" }, { k: "value", l: "Érték (pl. +11,0%)", t: "text" }, { k: "pct", l: "Sáv hossza (0–100)", t: "number" }] },
      { k: "wages.benefits", l: "Juttatások", t: "list", addLabel: "Új juttatás", item: [{ k: "label", l: "Megnevezés", t: "i18n" }, { k: "value", l: "Érték", t: "i18n" }] }] },
    { s: "Vállalati hírek", f: [{ k: "news", t: "list", addLabel: "Új vállalati hír", item: DATED }] },
    { s: "Események", f: [{ k: "events", t: "list", addLabel: "Új esemény", item: DATED }] },
    { s: "Bizalmik", f: [{ k: "contacts", t: "list", addLabel: "Új bizalmi", item: [{ k: "name", l: "Név", t: "text" }, { k: "role", l: "Szerep", t: "i18n" }, { k: "phone", l: "Telefon", t: "text" }, { k: "email", l: "E-mail", t: "email" }] }] },
    { s: "Dokumentumok", f: [{ k: "documents", t: "list", addLabel: "Új dokumentum", item: [{ k: "type", l: "Típus", t: "select", opts: ["PDF", "DOC", "XLS", "KÉP"] }, { k: "title", l: "Cím", t: "i18n" }, { k: "meta", l: "Megjegyzés (pl. Hatályos: 2026. jan. 1.)", t: "i18n" }, { k: "path", l: "Fájl", t: "file" }] }] }
  ];
  async function vCompanies(el) {
    await loadCompanies();
    el.innerHTML = head("Vállalatok", "Vállalatonként ezt a tartalmat látják a tagok a tagi felületen. Havonta itt frissítsd.", '<button class="btn btn--volt btn--sm" data-co-new>' + ic("plus", 16) + "<span>Új vállalat</span></button>") +
      (companies.length
        ? '<div class="co-list">' + companies.map((c) => {
            const ct = c.content || {};
            return '<button class="co-card" data-co="' + esc(c.id) + '"><span class="badge-co" style="background:' + esc(ct.accent || "var(--accent)") + '">' + esc(ct.short || c.name.slice(0, 2).toUpperCase()) + "</span><b>" + esc(c.name) + '</b><small class="mono">' + esc(c.id) + "</small><small>Frissítve: " + esc(ct.updated || String(c.updated_at || "").slice(0, 10)) + "</small></button>";
          }).join("") + "</div>"
        : '<p class="empty-dark">Még nincs vállalat. Add hozzá az elsőt!</p>');
    el.onclick = async (e) => {
      const b = e.target.closest("[data-co]");
      if (b) companyEditor(companies.find((c) => c.id === b.dataset.co));
      if (e.target.closest("[data-co-new]")) {
        const name = prompt("A vállalat neve:");
        if (!name) return;
        const suggested = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
        const id = prompt("Egyedi azonosító (kisbetű, szám, kötőjel; később nem módosítható):", suggested);
        if (!id) return;
        if (!/^[a-z0-9-]{2,60}$/.test(id)) return notify("Hibás azonosító: csak kisbetű, szám és kötőjel.", true);
        const short = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        const content = { short, accent: "#c9a45c", updated: today(), memberCount: 0, highlight: { title: { hu: "", en: "" }, text: { hu: "", en: "" } }, wages: { increase: "", note: { hu: "", en: "" }, bands: [], benefits: [] }, news: [], events: [], contacts: [], documents: [] };
        try {
          const sb = await B.ready();
          B.unwrap(await sb.from("companies").insert({ id, name, content }));
          notify("Vállalat létrehozva");
          await loadCompanies();
          companyEditor(companies.find((c) => c.id === id));
          render();
        } catch (err) { fail(err); }
      }
    };
  }
  function companyEditor(co) {
    const state = JSON.parse(JSON.stringify(co.content || {}));
    state.__name = co.name;
    state.__removedFiles = [];
    const draw = () => {
      openDrawer('<div class="drawer-head"><h2>' + esc(co.name) + '</h2><button class="icon-btn" data-close aria-label="Bezárás">' + ic("close") + "</button></div>" +
        '<div data-form>' + COMPANY_SCHEMA.map((sec) => '<section class="adm-section"><h2>' + esc(sec.s) + '</h2><div class="fgrid">' + sec.f.map((f) => field(f, getPath(state, f.k), f.k)).join("") + "</div></section>").join("") + "</div>" +
        '<div class="drawer-foot"><button class="mini-btn danger" data-co-del>Vállalat törlése</button><button class="btn btn--volt btn--sm" data-co-save>' + ic("check", 16) + "<span>Mentés és közzététel</span></button></div>");
      bindState(panel.querySelector("[data-form]"), state, draw);
    };
    draw();
    panel.onchange = async (e) => {
      const up = e.target.closest("[data-upload]");
      if (!up || !up.files || !up.files[0]) return;
      const file = up.files[0];
      if (file.size > 25 * 1024 * 1024) return notify("A fájl legfeljebb 25 MB lehet.", true);
      const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80);
      const path = co.id + "/" + Date.now() + "-" + safe;
      try {
        notify("Feltöltés…");
        const sb = await B.ready();
        B.unwrap(await sb.storage.from("documents").upload(path, file, { upsert: false, contentType: file.type || undefined }));
        const old = getPath(state, up.dataset.upload);
        if (old) state.__removedFiles.push(old);
        setPath(state, up.dataset.upload, path);
        drawerDirty = true;
        const y = panel.scrollTop; draw(); drawerDirty = true; panel.scrollTop = y;
        notify("Fájl feltöltve — ne felejtsd el menteni");
      } catch (err) { fail(err); }
    };
    panel.onclick = async (e) => {
      if (e.target.closest("[data-co-save]")) {
        const name = String(state.__name || "").trim();
        if (!name) return notify("A vállalat neve kötelező.", true);
        const removed = state.__removedFiles || [];
        const content = JSON.parse(JSON.stringify(state));
        delete content.__name; delete content.__removedFiles;
        content.updated = today();
        (content.documents || []).forEach((d) => { delete d.url; });
        try {
          const sb = await B.ready();
          B.unwrap(await sb.from("companies").update({ name, content }).eq("id", co.id));
          const stillUsed = new Set((content.documents || []).map((d) => d.path).filter(Boolean));
          const toRemove = removed.filter((p) => !stillUsed.has(p));
          if (toRemove.length) await sb.storage.from("documents").remove(toRemove);
          closeDrawer(true); notify("Mentve — a tagok már a friss tartalmat látják"); render();
        } catch (err) { fail(err); }
      }
      if (e.target.closest("[data-co-del]")) {
        if (!confirmDo("Biztosan törlöd a(z) " + co.name + " vállalatot? Csak akkor lehetséges, ha nincs hozzá tag.")) return;
        try {
          const sb = await B.ready();
          B.unwrap(await sb.from("companies").delete().eq("id", co.id));
          closeDrawer(true); notify("Vállalat törölve"); render();
        } catch (err) { fail({ message: /foreign key|violates/i.test(err.message || "") ? "Nem törölhető: még vannak tagjai." : err.message }); }
      }
    };
  }

  /* ---------- Tagok ---------- */
  let memFilter = { co: "", q: "" };
  function csvDownload(filename, rows) {
    // Excel-képletinjekció ellen: =, +, @ kezdetű cellák elé aposztróf
    const cell = (c) => { let v = String(c == null ? "" : c); if (/^[=+@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const csv = "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function credCard(m) {
    return '<div class="cred"><small>Add át a tagnak biztonságosan (személyesen vagy külön csatornán). A jelszót csak most látod!</small>' +
      "<div>Név: <b>" + esc(m.name || "") + "</b></div>" +
      '<div>Tagi kód: <span class="mono">' + esc(m.code) + '</span></div><div>Ideiglenes jelszó: <span class="mono">' + esc(m.password) + "</span></div>" +
      '<div style="display:flex;gap:8px;margin-top:6px"><button class="mini-btn" style="color:var(--ink)" data-copy-cred="' + esc(m.code + " / " + m.password) + '">' + "Másolás</button></div></div>";
  }
  async function vMembers(el) {
    const sb = await B.ready();
    await loadCompanies();
    const rows = B.unwrap(await sb.from("members").select("user_id, code, name, company_id, role, must_change_password, created_at").order("code", { ascending: true })) || [];
    const q = memFilter.q.toLowerCase();
    const shown = rows.filter((m) => (!memFilter.co || m.company_id === memFilter.co) && (!q || (m.name + " " + m.code).toLowerCase().includes(q)));
    const coOpts = companies.map((c) => '<option value="' + esc(c.id) + '"' + (memFilter.co === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>").join("");
    el.innerHTML = head("Tagok", "Minden tag saját kódot és jelszót kap, és csak a saját vállalata tartalmát látja. Első belépéskor jelszót kell cserélnie.",
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--line btn--sm" data-mem-import>' + ic("upload", 16) + '<span>Tömeges import</span></button><button class="btn btn--volt btn--sm" data-mem-new>' + ic("plus", 16) + "<span>Új tag</span></button></div>") +
      '<div class="adm-toolbar"><select class="in" style="max-width:260px" data-mem-co><option value="">Minden vállalat</option>' + coOpts + '</select><input class="in grow" style="max-width:320px" type="search" placeholder="Keresés névre vagy kódra" value="' + esc(memFilter.q) + '" data-mem-q><span class="muted" style="font-size:14px">' + shown.length + " tag</span>" +
      '<span class="grow"></span><button class="mini-btn" data-mem-export>' + "Lista letöltése (CSV)</button></div>" +
      (shown.length
        ? '<div class="table-wrap"><table class="adm-table"><thead><tr><th>Kód</th><th>Név</th><th>Vállalat</th><th>Szerep</th><th>Állapot</th><th></th></tr></thead><tbody>' +
          shown.map((m) => '<tr><td class="mono">' + esc(m.code) + "</td><td><b>" + esc(m.name) + "</b></td><td>" + esc(coName(m.company_id)) + "</td><td>" +
            (m.role === "admin" ? '<span class="badge badge--accent">Admin</span>' : '<span class="badge">Tag</span>') + "</td><td>" +
            (m.must_change_password ? '<span class="badge badge--muted">Még nem lépett be</span>' : '<span class="badge badge--muted" style="color:var(--on-ink)">Aktív</span>') +
            '</td><td class="act"><button class="mini-btn" data-mem-reset="' + m.user_id + '">Új jelszó</button> ' +
            (m.user_id !== me.user_id ? '<button class="mini-btn danger" data-mem-del="' + m.user_id + '">Törlés</button>' : "") + "</td></tr>").join("") + "</tbody></table></div>"
        : '<p class="empty-dark">Nincs a szűrésnek megfelelő tag.</p>');

    el.oninput = (e) => {
      if (e.target.matches("[data-mem-q]")) { memFilter.q = e.target.value; clearTimeout(el.__t); el.__t = setTimeout(() => { render().then(() => { const i = main().querySelector("[data-mem-q]"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 250); }
    };
    el.onchange = (e) => { if (e.target.matches("[data-mem-co]")) { memFilter.co = e.target.value; render(); } };
    el.onclick = async (e) => {
      if (e.target.closest("[data-mem-export]")) {
        csvDownload("vedokor-tagok-" + today() + ".csv", [["Tagi kód", "Név", "Vállalat", "Szerep", "Állapot"]].concat(shown.map((m) => [m.code, m.name, coName(m.company_id), m.role, m.must_change_password ? "még nem lépett be" : "aktív"])));
      }
      if (e.target.closest("[data-mem-new]")) memberNew();
      if (e.target.closest("[data-mem-import]")) memberImport();
      const rs = e.target.closest("[data-mem-reset]");
      if (rs) {
        const m = rows.find((x) => x.user_id === rs.dataset.memReset);
        if (!confirmDo("Új ideiglenes jelszót generálsz " + m.name + " (" + m.code + ") részére? A régi jelszó azonnal érvényét veszti.")) return;
        try {
          const out = await B.adminApi({ action: "reset_password", user_id: m.user_id });
          openDrawer('<div class="drawer-head"><h2>Új jelszó</h2><button class="icon-btn" data-close aria-label="Bezárás">' + ic("close") + "</button></div>" + credCard({ ...out.member, name: m.name }));
          render();
        } catch (err) { fail(err); }
      }
      const dl = e.target.closest("[data-mem-del]");
      if (dl) {
        const m = rows.find((x) => x.user_id === dl.dataset.memDel);
        if (!confirmDo("Biztosan törlöd " + m.name + " (" + m.code + ") tagot? A belépése azonnal megszűnik.")) return;
        try { await B.adminApi({ action: "delete_member", user_id: m.user_id }); notify("Tag törölve"); render(); } catch (err) { fail(err); }
      }
    };
  }
  function memberNew() {
    const state = { name: "", company_id: companies[0] ? companies[0].id : "", role: "member", code: "" };
    openDrawer('<div class="drawer-head"><h2>Új tag</h2><button class="icon-btn" data-close aria-label="Bezárás">' + ic("close") + "</button></div>" +
      '<form class="fgrid" data-form novalidate>' +
      field({ k: "name", l: "Teljes név", t: "text", req: true, full: true }, "", "name") +
      field({ k: "company_id", l: "Vállalat", t: "select", opts: companies.map((c) => [c.id, c.name]).concat([["", "— nincs (csak adminnak)"]]) }, state.company_id, "company_id") +
      field({ k: "role", l: "Szerep", t: "select", opts: [["member", "Tag"], ["admin", "Admin"]] }, "member", "role") +
      field({ k: "code", l: "Tagi kód (üresen hagyva automatikus)", t: "text", ph: "pl. MP-1234", full: true }, "", "code") +
      '</form><div data-result></div><div class="drawer-foot"><span></span><button class="btn btn--volt btn--sm" data-go>' + ic("check", 16) + "<span>Tag létrehozása</span></button></div>");
    bindState(panel.querySelector("[data-form]"), state, () => {});
    panel.onclick = async (e) => {
      if (!e.target.closest("[data-go]")) return;
      if (!state.name.trim()) return notify("A név kötelező.", true);
      const btn = e.target.closest("[data-go]");
      btn.disabled = true;
      try {
        const out = await B.adminApi({ action: "create_member", name: state.name, company_id: state.company_id || null, role: state.role, code: state.code || undefined });
        panel.querySelector("[data-result]").innerHTML = credCard(out.member);
        panel.querySelector("[data-form]").remove();
        btn.remove();
        drawerDirty = false;
        notify("Tag létrehozva");
        render();
      } catch (err) { btn.disabled = false; fail(err); }
    };
  }
  function parseCsv(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = [";", "\t", ","].find((d) => lines[0].includes(d)) || ";";
    const out = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
    // fejléc kihagyása, ha van
    if (out[0] && /n[eé]v|name/i.test(out[0][0])) out.shift();
    return out.map(([name, company_id, code]) => ({ name, company_id, code: code || undefined })).filter((r) => r.name);
  }
  function memberImport() {
    openDrawer('<div class="drawer-head"><h2>Tömeges import</h2><button class="icon-btn" data-close aria-label="Bezárás">' + ic("close") + "</button></div>" +
      '<div class="note">Soronként egy tag: <span class="mono">Név;vállalat-azonosító;tagi kód</span> (a kód elhagyható — akkor automatikus). Excelből: mentés „CSV (pontosvesszővel tagolt)” formátumban.<br>Vállalat-azonosítók: ' +
      companies.map((c) => '<span class="mono">' + esc(c.id) + "</span>").join(", ") + "</div>" +
      '<label class="mini-btn" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;justify-self:start">' + ic("upload", 15) + ' CSV fájl választása<input type="file" accept=".csv,.txt" data-csv hidden></label>' +
      '<textarea class="in tall" data-csv-text placeholder="Kiss Anna;minta-pharma&#10;Nagy Béla;minta-pharma;MP-2001"></textarea>' +
      '<p class="muted" data-csv-info style="font-size:14px"></p><div data-result></div>' +
      '<div class="drawer-foot"><span></span><button class="btn btn--volt btn--sm" data-go>' + ic("check", 16) + "<span>Importálás</span></button></div>");
    const ta = panel.querySelector("[data-csv-text]"), info = panel.querySelector("[data-csv-info]");
    const upd = () => {
      const rows = parseCsv(ta.value);
      const bad = rows.filter((r) => !companies.some((c) => c.id === r.company_id));
      info.textContent = rows.length ? rows.length + " tag felismerve" + (bad.length ? " — " + bad.length + " sorban ismeretlen vállalat-azonosító" : "") : "";
    };
    ta.addEventListener("input", upd);
    panel.onchange = (e) => {
      const f = e.target.closest("[data-csv]");
      if (f && f.files[0]) { const r = new FileReader(); r.onload = () => { ta.value = r.result; upd(); }; r.readAsText(f.files[0], "utf-8"); }
    };
    panel.onclick = async (e) => {
      const dlb = e.target.closest("[data-dl]");
      if (dlb) { csvDownload("vedokor-uj-tagok-" + today() + ".csv", JSON.parse(dlb.dataset.dl)); return; }
      if (!e.target.closest("[data-go]")) return;
      const rows = parseCsv(ta.value);
      if (!rows.length) return notify("Nincs importálható sor.", true);
      if (!confirmDo(rows.length + " tag létrehozása. Folytatod?")) return;
      const btn = e.target.closest("[data-go]");
      btn.disabled = true;
      try {
        const out = await B.adminApi({ action: "import_members", rows });
        const ok = out.results.filter((r) => r.ok), bad = out.results.filter((r) => !r.ok);
        const csvRows = [["Tagi kód", "Név", "Vállalat", "Ideiglenes jelszó"]].concat(ok.map((r) => [r.code, r.name, coName(r.company_id), r.password]));
        panel.querySelector("[data-result]").innerHTML =
          '<div class="cred"><b>' + ok.length + " tag létrehozva" + (bad.length ? ", " + bad.length + " sikertelen" : "") + "</b>" +
          "<small>Töltsd le most a belépési adatokat — a jelszavak később nem kérhetők le. A fájlt biztonságosan kezeld, kiosztás után töröld.</small>" +
          "<button class=\"btn btn--sm\" style=\"justify-self:start\" data-dl='" + esc(JSON.stringify(csvRows)) + "'>" + ic("download", 16) + "<span>Belépési adatok letöltése (CSV)</span></button>" +
          (bad.length ? '<div style="margin-top:8px"><b>Hibás sorok:</b><ul style="margin:6px 0 0 18px">' + bad.map((r) => "<li>" + esc(r.name || "—") + ": " + esc(r.error) + "</li>").join("") + "</ul></div>" : "") + "</div>";
        btn.remove();
        drawerDirty = false;
        render();
      } catch (err) { btn.disabled = false; fail(err); }
    };
  }

  /* ---------- Beérkezett űrlapok ---------- */
  async function vInbox(el) {
    const sb = await B.ready();
    const rows = B.unwrap(await sb.from("submissions").select("*").order("created_at", { ascending: false })) || [];
    el.innerHTML = head("Beérkezett", "A weboldal csatlakozási és kapcsolatfelvételi űrlapjain beküldött üzenetek.") +
      (rows.length
        ? '<div style="display:grid;gap:12px">' + rows.map((s) =>
            '<article class="sub-card' + (s.handled ? " is-handled" : "") + '"><div class="meta"><span class="badge ' + (s.kind === "join" ? "badge--accent" : "") + '">' + (s.kind === "join" ? "Csatlakozás" : "Üzenet") + "</span><span>" + esc(new Date(s.created_at).toLocaleString("hu-HU")) + "</span></div>" +
            '<h3 style="font-size:20px;letter-spacing:-0.02em">' + esc(s.name) + '</h3><div class="meta"><a href="mailto:' + esc(s.email) + '" style="color:var(--accent)">' + esc(s.email) + "</a>" + (s.phone ? "<span>" + esc(s.phone) + "</span>" : "") + (s.company ? "<span>" + esc(s.company) + "</span>" : "") + (s.position ? "<span>" + esc(s.position) + "</span>" : "") + "</div>" +
            (s.message ? '<p class="msg">' + esc(s.message) + "</p>" : "") +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mini-btn" data-sub-toggle="' + s.id + '" data-v="' + (!s.handled) + '">' + (s.handled ? "Visszaállítás kezeletlenre" : "Kezeltnek jelöl") + '</button><button class="mini-btn danger" data-sub-del="' + s.id + '">Törlés</button></div></article>').join("") + "</div>"
        : '<p class="empty-dark">Még nem érkezett üzenet.</p>');
    el.onclick = async (e) => {
      const tg = e.target.closest("[data-sub-toggle]"), dl = e.target.closest("[data-sub-del]");
      try {
        if (tg) { B.unwrap(await sb.from("submissions").update({ handled: tg.dataset.v === "true" }).eq("id", tg.dataset.subToggle)); render(); }
        if (dl && confirmDo("Biztosan törlöd ezt az üzenetet?")) { B.unwrap(await sb.from("submissions").delete().eq("id", dl.dataset.subDel)); notify("Törölve"); render(); }
      } catch (err) { fail(err); }
    };
  }

  /* ---------- Belépés / indítás ---------- */
  function setupScreen() {
    root.innerHTML = '<main class="adm-login" id="main"><div class="adm-card"><h1>Admin</h1>' +
      "<p>Az admin felület éles háttérrendszert igényel, ami még nincs beállítva. A weboldal addig demó módban fut.</p>" +
      "<ol><li>Supabase projekt létrehozása (EU régió)</li><li>A <span class=\"mono\">supabase/schema.sql</span> lefuttatása</li><li>Kulcsok beírása a <span class=\"mono\">assets/js/config.js</span> fájlba és a Vercel környezeti változóiba</li><li>Első admin létrehozása</li></ol>" +
      '<p>Részletes útmutató: <span class="mono">docs/SETUP.md</span></p><a class="btn btn--line btn--sm" href="index.html" style="justify-self:start">Vissza a weboldalra</a></div></main>';
  }
  function loginScreen(msg) {
    root.innerHTML = '<main class="adm-login" id="main"><form class="adm-card" data-admin-login novalidate><h1>Admin belépés</h1><p>Lépj be az admin tagi kódoddal.</p>' +
      '<label class="fld"><span>Tagi kód</span><input class="in" name="code" autocomplete="username" autocapitalize="characters" required></label>' +
      '<label class="fld"><span>Jelszó</span><input class="in" name="pw" type="password" autocomplete="current-password" required></label>' +
      '<p class="alert alert--err" ' + (msg ? "" : "hidden ") + 'role="alert">' + esc(msg || "") + "</p>" +
      '<button class="btn btn--volt btn--block" type="submit">Belépés</button></form></main>';
    const f = root.querySelector("[data-admin-login]");
    setTimeout(() => f.code.focus(), 50);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = f.querySelector("button"); btn.disabled = true;
      try {
        const m = await B.login(f.code.value.trim().toUpperCase(), f.pw.value);
        if (m.role !== "admin") { await B.logout(); throw new Error("Ehhez a felülethez admin jogosultság kell."); }
        start();
      } catch (err) {
        btn.disabled = false;
        loginScreen(err.message === "auth" ? "Hibás tagi kód vagy jelszó." : err.message);
      }
    });
  }
  async function start() {
    if (!B || !B.live) return setupScreen();
    try {
      me = await B.currentMember();
      if (!me) return loginScreen();
      if (me.role !== "admin") { await B.logout(); return loginScreen("Ehhez a felülethez admin jogosultság kell."); }
      shell();
    } catch (e) { loginScreen(); }
  }

  root.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-view]");
    if (v && root.contains(v) && (v.tagName === "A" || v.classList.contains("tile"))) { e.preventDefault(); go(v.dataset.view); }
    if (e.target.closest("[data-logout]")) { await B.logout(); location.href = "login.html"; }
  });
  document.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-copy-cred]");
    if (cp && drawer.contains(cp) && navigator.clipboard) { navigator.clipboard.writeText(cp.dataset.copyCred); notify("Vágólapra másolva"); }
  });
  addEventListener("resize", moveInd);
  start();
})();
