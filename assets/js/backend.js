/* ==========================================================================
   Védőkör — adatréteg
   Éles módban Supabase (belépés, adatbázis, dokumentumtár), különben demó mód
   a helyi JSON fájlokkal. A felület kódja csak ezt az API-t hívja.
   ========================================================================== */
(function () {
  "use strict";
  const cfg = window.VK_CONFIG || {};
  const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const domain = cfg.memberEmailDomain || "tag.vedokor.local";
  let client = null;
  let loading = null;

  // A Supabase könyvtárat csak éles módban, igény szerint töltjük be
  function ready() {
    if (!live) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const make = () => {
        client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          // sessionStorage: a böngésző bezárásakor kilép (közös gépeken biztonságosabb)
          auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        resolve(client);
      };
      if (window.supabase && window.supabase.createClient) return make();
      const s = document.createElement("script");
      s.src = "assets/vendor/supabase.min.js";
      s.onload = make;
      s.onerror = () => reject(new Error("A háttérrendszer nem tölthető be."));
      document.head.appendChild(s);
    });
    return loading;
  }

  const codeToEmail = (code) => String(code).trim().toLowerCase() + "@" + domain;
  const unwrap = ({ data, error }) => { if (error) throw error; return data; };

  async function login(code, password) {
    const sb = await ready();
    const { error } = await sb.auth.signInWithPassword({ email: codeToEmail(code), password });
    if (error) throw new Error("auth");
    const m = await currentMember();
    if (!m) { await sb.auth.signOut(); throw new Error("auth"); }
    return m;
  }

  async function currentMember() {
    const sb = await ready();
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) return null;
    const uid = data.session.user.id;
    return unwrap(await sb.from("members").select("user_id, code, name, company_id, role, must_change_password").eq("user_id", uid).maybeSingle());
  }

  async function logout() {
    const sb = await ready();
    if (sb) await sb.auth.signOut();
  }

  async function changePassword(pw) {
    const sb = await ready();
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw error;
    unwrap(await sb.rpc("password_changed"));
  }

  // Vállalati tartalom + aláírt (1 órás) letöltőlinkek a privát dokumentumokhoz
  async function loadCompany(id) {
    const sb = await ready();
    const row = unwrap(await sb.from("companies").select("id, name, content, updated_at").eq("id", id).maybeSingle());
    if (!row) throw new Error("company");
    const c = Object.assign({ news: [], documents: [], contacts: [], events: [], wages: { bands: [], benefits: [] }, highlight: { title: "", text: "" } }, row.content || {});
    c.id = row.id;
    c.name = row.name;
    c.updated = c.updated || String(row.updated_at || "").slice(0, 10);
    const paths = (c.documents || []).filter((d) => d.path).map((d) => d.path);
    if (paths.length) {
      const signed = unwrap(await sb.storage.from("documents").createSignedUrls(paths, 3600)) || [];
      const map = {};
      signed.forEach((s) => { if (s && s.signedUrl) map[s.path] = s.signedUrl; });
      c.documents.forEach((d) => { if (d.path) d.url = map[d.path] || "#"; });
    }
    return c;
  }

  async function loadNews() {
    if (!live) {
      const d = await fetch("data/news.json", { cache: "no-cache" }).then((r) => r.json());
      return d.items;
    }
    const sb = await ready();
    return unwrap(await sb.from("news").select("id, date, category, title, excerpt, body, art").eq("published", true).order("date", { ascending: false }));
  }

  async function submit(kind, data) {
    if (!live) return { demo: true };
    const sb = await ready();
    const row = { kind, name: data.name, email: data.email, phone: data.phone || null, company: data.company || null, position: data.position || null, message: data.message || null };
    unwrap(await sb.from("submissions").insert(row));
    return { ok: true };
  }

  // Admin: szerveroldali függvény hívása a saját access tokennel
  async function adminApi(body) {
    const sb = await ready();
    const { data } = await sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Szerverhiba (" + res.status + ")");
    return out;
  }

  window.VKB = { live, ready, login, logout, currentMember, changePassword, loadCompany, loadNews, submit, adminApi, codeToEmail, unwrap };
})();
