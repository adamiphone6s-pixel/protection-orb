# Éles tagi rendszer beállítása (Supabase + Vercel)

Amíg ez nincs beállítva, az oldal **demó módban** fut (helyi JSON adatok, demó belépés).
A beállítás kb. 20–30 perc, programozás nem kell hozzá.

## 1. Supabase projekt létrehozása

1. Regisztrálj: <https://supabase.com> → **New project**.
2. **Region: Central EU (Frankfurt)** — a szakszervezeti tagság különleges személyes adat, EU-ban kell tárolni.
3. Adj erős adatbázis-jelszót (jelszókezelőbe mentsd).

## 2. Adatbázis-séma

1. Supabase → **SQL Editor** → **New query**.
2. Másold be a [`supabase/schema.sql`](../supabase/schema.sql) teljes tartalmát → **Run**.

Ez létrehozza a táblákat (vállalatok, tagok, hírek, beérkezett üzenetek), a privát dokumentumtárat és a jogosultsági szabályokat (egy tag csak a saját vállalatát látja).

## 3. Belépési beállítások (fontos!)

Supabase → **Authentication** → **Sign In / Providers** (vagy *Settings*):

- **Allow new users to sign up: KI** — tagot csak az admin hozhat létre.
- **Email** provider: bekapcsolva; **Confirm email: KI** (a tagok kóddal lépnek be, nem kapnak e-mailt).
- Jelszó minimális hossza: **10**.

## 4. Kulcsok beírása

Supabase → **Project Settings** → **API**. Két kulcs kell:

| Kulcs | Hova kerül | Titkos? |
|---|---|---|
| `Project URL` + `anon public` | `assets/js/config.js` | Nem — a böngészőbe szánt kulcs |
| `service_role` | **csak** Vercel környezeti változó | **IGEN — soha ne kerüljön a kódba!** |

`assets/js/config.js`:

```js
window.VK_CONFIG = {
  supabaseUrl: "https://XXXX.supabase.co",
  supabaseAnonKey: "eyJ...anon...",
  memberEmailDomain: "tag.vedokor.local"
};
```

Vercel → Project → **Settings → Environment Variables** (Production + Preview):

| Név | Érték |
|---|---|
| `SUPABASE_URL` | `https://XXXX.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | a `service_role` kulcs |
| `MEMBER_EMAIL_DOMAIN` | `tag.vedokor.local` (egyezzen a config.js-sel) |

Utána: commit + push (vagy Vercel → **Redeploy**), hogy a változók életbe lépjenek.

## 5. Első admin létrehozása

1. Supabase → **Authentication → Users → Add user → Create new user**
   - Email: `adm-001@tag.vedokor.local` (a tagi kód kisbetűvel + `@` + a domain)
   - Password: erős jelszó
   - **Auto Confirm User: BE**
2. SQL Editor → futtasd:

```sql
insert into public.members (user_id, code, name, role, must_change_password)
select id, 'ADM-001', 'Ádám', 'admin', false
from auth.users where email = 'adm-001@tag.vedokor.local';
```

3. Nyisd meg: `https://<domain>/admin.html` → belépés `ADM-001` kóddal.

## 6. Tartalom feltöltése az admin felületen

1. **Vállalatok** → *Új vállalat* → töltsd ki: bérek, hírek, események, bizalmik, dokumentumok (PDF feltöltés) → **Mentés és közzététel**.
2. **Tagok** → *Új tag* vagy *Tömeges import* (CSV: `Név;vállalat-azonosító;tagi kód`). A belépési adatokat (kód + ideiglenes jelszó) **egyszer** mutatja/tölti le — biztonságosan add át, majd a fájlt töröld.
3. **Hírek** → a weboldal nyilvános hírei (csak a „Publikus” jelölésűek jelennek meg).
4. **Beérkezett** → a weboldal csatlakozási és kapcsolati űrlapjainak üzenetei.

A tagok első belépéskor kötelezően saját jelszót állítanak be. Elfelejtett jelszó: admin → Tagok → **Új jelszó**.

## 7. Ellenőrzőlista élesítés előtt

- [ ] Sign up kikapcsolva (3. lépés)
- [ ] `service_role` kulcs **csak** a Vercelben van, a kódban nincs
- [ ] Adatkezelési tájékoztató szövege a `privacy.html`-ben (a szakszervezettől)
- [ ] A demó fájlok törölhetők: `data/members.json`, `data/companies/*.json`
- [ ] Saját domain beállítva a Vercelben

## Költségek (tájékoztató)

- **Supabase Free**: induláshoz elég, de 1 hét inaktivitás után szünetel → éles üzemre a **Pro** (kb. 25 USD/hó) ajánlott.
- **Vercel**: a Hobby csomag nem kereskedelmi célra szól; ügyféloldalhoz **Pro** (kb. 20 USD/hó), vagy költöztethető Netlify / Cloudflare Pages-re (a `/api/admin` függvényt ekkor át kell tenni).
- Domain (`.hu`): néhány ezer Ft/év.

## Hogyan működik (röviden)

- **Belépés:** a tagi kódból a rendszer technikai e-mail címet képez (`ph-1001@tag.vedokor.local`), ezzel lép be a Supabase-be. A munkamenet a böngésző bezárásáig tart.
- **Jogosultság:** az adatbázis soronkénti szabályai (RLS) döntenek — a tag a szervertől is csak a saját vállalata sorát és dokumentumait kapja meg.
- **Dokumentumok:** privát tárhely, vállalatonként külön mappa, a letöltőlink 1 óráig érvényes.
- **Tagkezelés:** az `/api/admin` szerveroldali függvény végzi (service role kulccsal), és csak bejelentkezett admint szolgál ki.
