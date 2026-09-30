/* ==========================================================================
   Védőkör — admin API (Vercel serverless függvény, függőség nélkül)

   Csak bejelentkezett ADMIN hívhatja. Feladata a tagok (Supabase auth
   felhasználók) létrehozása, törlése és jelszavuk visszaállítása — ehhez a
   service role kulcs kell, ami SOHA nem kerülhet a böngészőbe.

   Környezeti változók (Vercel → Project → Settings → Environment Variables):
     SUPABASE_URL               pl. https://abcd.supabase.co
     SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API → service_role
     MEMBER_EMAIL_DOMAIN        (opcionális) alapértelmezés: tag.vedokor.local
   ========================================================================== */
"use strict";

const crypto = require("crypto");

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EMAIL_DOMAIN = process.env.MEMBER_EMAIL_DOMAIN || "tag.vedokor.local";
const MAX_IMPORT = 2000;

const CODE_RE = /^[A-Z0-9-]{3,20}$/;
const COMPANY_RE = /^[a-z0-9-]{2,60}$/;

function codeToEmail(code) {
  return code.toLowerCase() + "@" + EMAIL_DOMAIN;
}

// Könnyen átadható, de erős jelszó (összetéveszthető karakterek nélkül)
function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function sb(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(URL_BASE + path, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ("HTTP " + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// A hívó azonosítása a saját access tokenje alapján, majd admin-jog ellenőrzése
async function requireAdmin(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw Object.assign(new Error("Hiányzó bejelentkezés."), { status: 401 });
  const res = await fetch(URL_BASE + "/auth/v1/user", { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + token } });
  if (!res.ok) throw Object.assign(new Error("Érvénytelen vagy lejárt bejelentkezés."), { status: 401 });
  const user = await res.json();
  const rows = await sb("/rest/v1/members?select=role&user_id=eq." + encodeURIComponent(user.id));
  if (!rows || !rows[0] || rows[0].role !== "admin") throw Object.assign(new Error("Nincs admin jogosultság."), { status: 403 });
  return user;
}

async function companyPrefix(companyId) {
  if (!companyId) return "ADM";
  const rows = await sb("/rest/v1/companies?select=content,name&id=eq." + encodeURIComponent(companyId));
  if (!rows || !rows[0]) throw Object.assign(new Error("Ismeretlen vállalat: " + companyId), { status: 400 });
  const short = rows[0].content && rows[0].content.short;
  const base = (short || rows[0].name || companyId).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (base || "TAG").slice(0, 4);
}

async function codeExists(code) {
  const rows = await sb("/rest/v1/members?select=code&code=eq." + encodeURIComponent(code));
  return rows && rows.length > 0;
}

async function uniqueCode(prefix) {
  for (let i = 0; i < 20; i++) {
    const n = crypto.randomInt(1000, 10000);
    const code = prefix + "-" + n;
    if (!(await codeExists(code))) return code;
  }
  throw new Error("Nem sikerült egyedi tagi kódot generálni.");
}

async function createMember({ name, company_id, code, role }) {
  name = String(name || "").trim();
  company_id = company_id ? String(company_id).trim() : null;
  role = role === "admin" ? "admin" : "member";
  if (!name || name.length > 200) throw Object.assign(new Error("Hiányzó vagy túl hosszú név."), { status: 400 });
  if (role === "member" && !company_id) throw Object.assign(new Error("A taghoz vállalat szükséges."), { status: 400 });
  if (company_id && !COMPANY_RE.test(company_id)) throw Object.assign(new Error("Hibás vállalat-azonosító."), { status: 400 });

  if (code) {
    code = String(code).trim().toUpperCase();
    if (!CODE_RE.test(code)) throw Object.assign(new Error("Hibás tagi kód: " + code), { status: 400 });
    if (await codeExists(code)) throw Object.assign(new Error("Ez a tagi kód már foglalt: " + code), { status: 409 });
  } else {
    code = await uniqueCode(await companyPrefix(company_id));
  }
  if (company_id) await companyPrefix(company_id); // létezés-ellenőrzés

  const password = generatePassword();
  const user = await sb("/auth/v1/admin/users", {
    method: "POST",
    body: { email: codeToEmail(code), password, email_confirm: true, user_metadata: { code } }
  });
  try {
    await sb("/rest/v1/members", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: { user_id: user.id, code, name, company_id, role, must_change_password: true }
    });
  } catch (e) {
    // visszagörgetés: ne maradjon árva auth felhasználó
    await sb("/auth/v1/admin/users/" + user.id, { method: "DELETE" }).catch(() => {});
    throw e;
  }
  return { user_id: user.id, code, name, company_id, role, password };
}

async function resetPassword({ user_id }) {
  if (!/^[0-9a-f-]{36}$/i.test(String(user_id || ""))) throw Object.assign(new Error("Hibás azonosító."), { status: 400 });
  const rows = await sb("/rest/v1/members?select=code&user_id=eq." + user_id);
  if (!rows || !rows[0]) throw Object.assign(new Error("Nincs ilyen tag."), { status: 404 });
  const password = generatePassword();
  await sb("/auth/v1/admin/users/" + user_id, { method: "PUT", body: { password } });
  await sb("/rest/v1/members?user_id=eq." + user_id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { must_change_password: true } });
  return { user_id, code: rows[0].code, password };
}

async function deleteMember({ user_id }, caller) {
  if (!/^[0-9a-f-]{36}$/i.test(String(user_id || ""))) throw Object.assign(new Error("Hibás azonosító."), { status: 400 });
  if (user_id === caller.id) throw Object.assign(new Error("Saját magadat nem törölheted."), { status: 400 });
  await sb("/auth/v1/admin/users/" + user_id, { method: "DELETE" }); // a members sor kaszkádolva törlődik
  return { user_id, deleted: true };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Csak POST kérés engedélyezett." });
  if (!URL_BASE || !SERVICE_KEY) return send(res, 500, { error: "A szerver nincs beállítva (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." });
  try {
    const caller = await requireAdmin(req);
    const body = await readBody(req);
    switch (body.action) {
      case "create_member":
        return send(res, 200, { member: await createMember(body) });
      case "import_members": {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (!rows.length) return send(res, 400, { error: "Üres import." });
        if (rows.length > MAX_IMPORT) return send(res, 400, { error: "Egyszerre legfeljebb " + MAX_IMPORT + " tag importálható." });
        const results = [];
        for (const r of rows) {
          try { results.push({ ok: true, ...(await createMember({ ...r, role: "member" })) }); }
          catch (e) { results.push({ ok: false, name: r.name, company_id: r.company_id, code: r.code, error: e.message }); }
        }
        return send(res, 200, { results });
      }
      case "reset_password":
        return send(res, 200, { member: await resetPassword(body) });
      case "delete_member":
        return send(res, 200, await deleteMember(body, caller));
      default:
        return send(res, 400, { error: "Ismeretlen művelet." });
    }
  } catch (e) {
    return send(res, e.status && e.status < 600 ? e.status : 500, { error: e.message || "Szerverhiba." });
  }
};

module.exports._test = { generatePassword, codeToEmail };
