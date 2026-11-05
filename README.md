# Chinoin VDSZ Szakszervezet — weboldal

Kétnyelvű (HU/EN), mobilra optimalizált, telepíthető (PWA) szakszervezeti weboldal nyilvános résszel és vállalatonként szétválasztott **tagi felülettel**.

> A Chinoin Vegyipari Dolgozók Szakszervezete oldala. A hiányzó tartalmak listája: [docs/TARTALOM.md](docs/TARTALOM.md).

## Futtatás helyben

A tartalom JSON-ból töltődik, ezért webszerver kell (dupla kattintással `file://`-ként nem megy):

```bash
npx serve .          # vagy: python3 -m http.server 8080
```

Majd: <http://localhost:3000> (ill. 8080).

**Demó tagi belépés** (`login.html`): `CH-1001`, `EA-2001`, `OC-3001`, `OH-4001` vagy `SA-5001`, jelszó: `demo1234` — mindegyik más vállalat felületét mutatja.

## Éles tagi rendszer és admin felület

- **Admin felület:** `admin.html` — hírek, vállalati tartalmak (fájlfeltöltéssel), tagkezelés (egyenként / CSV import, jelszó-visszaállítás), beérkezett űrlapok.
- **Háttér:** Supabase (EU) — belépés, adatbázis soronkénti jogosultsággal, privát dokumentumtár; `api/admin.js` Vercel-függvény a tagok létrehozásához.
- **Beállítás:** [docs/SETUP.md](docs/SETUP.md). Amíg nincs beállítva, az oldal demó módban fut.

## Közzététel (Vercel)

Build nem kell, a `vercel.json` már be van állítva.

1. <https://vercel.com/new> → **Import Git Repository** → `protection-orb`.
2. Framework Preset: **Other**, minden más maradhat alapértelmezett → **Deploy**.
3. Ezután minden `git push` automatikusan frissíti az oldalt (a nem-main ágak előnézeti linket kapnak).

## Élmény és technika

- **Színrendszer:** sötét türkizkék alap (`--ink: #0e2a33`), menta papír (`--paper: #eef8f4`) és türkiz kiemelő (`--accent: #52bfa5`; világos háttéren a mélyebb `--accent-deep: #1f7a66` az olvashatóságért), a „Tartozz közénk!” plakátból. Minden szín az `assets/css/style.css` elején lévő tokenekben állítható.

- **WebGL „védőgömb”** (`assets/js/orb-gl.js`): raymarcholt, zajjal torzított gömb, egérre és görgetésre reagál; WebGL nélkül 2D részecske-gömb a tartalék.
- **Mozgás:** első látogatáskor betöltő animáció, körbe nyíló oldalváltás, sima görgetés (Lenis), szavanként/betűnként beúszó címek, görgetésre kivilágosodó kiáltvány, vízszintesen görgetett szolgáltatás-kártyák, egymásra csúszó lépések, mágneses gombok, egyedi kurzor (GSAP + ScrollTrigger).
- **Hozzáférhetőség:** „csökkentett mozgás” beállításnál minden animáció kikapcsol; billentyűzettel teljesen bejárható; képernyőolvasók a teljes címszöveget kapják.
- **Teljesítmény / adatvédelem:** betűtípusok és könyvtárak helyben kiszolgálva (nincs Google Fonts / CDN kérés), a WebGL csak látható állapotban renderel.
- **SEO:** oldalankénti meta leírás, Open Graph kép, `sitemap.xml`, `robots.txt`, szervezeti strukturált adat, egyedi 404 oldal.

## Szerkezet

| Útvonal | Tartalom |
|---|---|
| `index.html` | Kezdőlap (hero, előnyök, szolgáltatások, csatlakozás, hírek, GYIK) |
| `about.html`, `services.html`, `news.html`, `join.html`, `contact.html`, `privacy.html` | Nyilvános aloldalak |
| `login.html`, `portal.html` | Tagi belépés és vállalati tagi app (oldalsáv / mobil fülsáv, áttekintés, hírek, bérek, dokumentumok, bizalmik, események; ⌘K kereső, naptárba mentés) |
| `assets/css/style.css` | Teljes design-rendszer; a márkaszínek/betűk a `:root` tokenekben |
| `assets/js/i18n.js` | Minden felületi szöveg magyarul és angolul |
| `assets/js/app.js` | Fejléc/lábléc, nyelvváltás, animációk, hírek, PWA |
| `assets/js/portal.js` | Belépés és tagi felület |
| `assets/js/orb-gl.js` | WebGL gömb shader |
| `assets/vendor/`, `assets/fonts/` | GSAP, ScrollTrigger, Lenis; önállóan kiszolgált betűtípusok |
| `data/news.json` | Nyilvános hírek (kétnyelvű) |
| `data/companies/*.json` | Vállalatonkénti tagi tartalom (havi frissítés) |
| `data/members.json` | **Csak demó** tagkódok (éles módban nem használt) |
| `admin.html`, `assets/js/admin.js` | Admin felület |
| `assets/js/config.js`, `assets/js/backend.js` | Éles háttér beállítása és adatréteg (demó/éles) |
| `api/admin.js` | Szerveroldali tagkezelés (service role) |
| `supabase/schema.sql` | Adatbázis-séma és jogosultsági szabályok |
| `manifest.webmanifest`, `sw.js` | Telepíthető „app” + offline működés |

## Havi frissítés

- **Hír:** új elem a `data/news.json`-ba (`hu` / `en` mezőkkel).
- **Vállalati infó:** a `data/companies/<vállalat>.json` szerkesztése, `updated` dátum átírása.
- **Új vállalat:** új JSON a `data/companies/` alá (egy meglévő másolata), és a hozzá tartozó tagok.

Élesben ezt egy admin felület (CMS) váltja ki — lásd [docs/PROJEKT.md](docs/PROJEKT.md).

## ⚠️ Biztonság

A jelenlegi tagi belépés **kliensoldali demó**: a vállalati JSON-ok és a tagkód-lista nyilvánosan letölthetők. Éles indulás előtt szerveroldali hitelesítés kell — a terv a `docs/PROJEKT.md`-ben.
