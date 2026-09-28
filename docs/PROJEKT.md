# Projektterv — szakszervezeti weboldal

## Igények (Móni levele alapján)

| Igény | Megoldás |
|---|---|
| vdsz.hu mintájára, de dizájnosabb, fiatalosabb | Saját design-rendszer (sötét/világos szekciók, élénk akcentszínek, animált „védőgömb”, mikroanimációk). A vdsz.hu fő tartalmi egységei lefedve: rólunk, szolgáltatások (jogsegély, KSZ, bértárgyalás, munkavédelem, segélyek), hírek, belépés, kapcsolat. |
| Csatolt dizájn | A márkaszínek és betűtípusok a `assets/css/style.css` elején lévő tokenekben egy helyen cserélhetők. **A csatolt dizájnfájl még nem érkezett meg a repóba — ha megvan, ahhoz igazítjuk.** |
| Mobilon is elérhető | Mobile-first, reszponzív; mobilmenü, érintésbarát elemek. |
| Applikáció? | **PWA**: telefonon „Hozzáadás a kezdőképernyőhöz” után saját ikonnal, teljes képernyőn, appként fut, offline is megnyílik — app store nélkül. Ha később kell, ugyanerre a backendre natív (App Store / Google Play) app is építhető (pl. Capacitor-csomagolással), ez külön tétel. |
| Magyar + angol | Teljes kétnyelvűség, a választás megmarad; a hírek és a tagi tartalmak is kétnyelvűek. |
| Nyilvános oldal + tagi rész kóddal/jelszóval | `login.html` → `portal.html`. |
| Több vállalat, mindenki csak a sajátját látja | A tag a saját vállalatához van rendelve, csak annak adatait kapja meg. |
| Havi frissítés | Tartalom adatfájlokban elkülönítve a kódtól; élesben admin felületről. |

## Jelenlegi állapot (1. mérföldkő — front-end prototípus)

- Kész: összes nyilvános oldal, kétnyelvűség, PWA, tagi felület (áttekintés, vállalati hírek, bérek és juttatások, dokumentumok, bizalmik, események) 3 minta vállalattal.
- Demó: az űrlapok nincsenek szerverhez kötve; a belépés kliensoldali.

## Javasolt éles architektúra (2. mérföldkő)

1. **Hosting:** statikus front-end (Netlify / Vercel / Cloudflare Pages), HTTPS, saját domain.
2. **Hitelesítés + adatok:** pl. Supabase (EU régió) vagy saját kis Node.js API:
   - tagok táblája: tagkód, jelszó-hash (bcrypt/argon2), vállalat, nyelv;
   - vállalati tartalom sorszintű jogosultsággal (RLS): a tag *csak* a saját vállalata sorait kapja meg a szervertől;
   - első belépéskor kötelező jelszócsere, elfelejtett jelszó e-mailben, belépési kísérletek korlátozása.
3. **Admin / CMS:** egyszerű szerkesztőfelület (pl. Supabase Studio vagy Directus/Strapi), ahol a szakszervezet munkatársai havonta frissítik a híreket és a vállalati adatokat, dokumentumokat töltenek fel — fejlesztő nélkül.
4. **Űrlapok:** belépési nyilatkozat és kapcsolatfelvétel e-mail értesítéssel + adatbázisba mentve.
5. **GDPR:** a szakszervezeti tagság különleges személyes adat — adatkezelési tájékoztató, adatfeldolgozói szerződés, EU-s adattárolás, minimális adatgyűjtés, naplózás.

## Tőletek szükséges

- Végleges név, logó, dizájnfájl (színek, betűk).
- Szövegek: bemutatkozás, történet, vezetőség (fotók), szolgáltatások, tagdíj, elérhetőségek.
- Vállalatok listája; vállalatonként: bizalmik, KSZ, bérmegállapodás, dokumentumok, események.
- Ki frissíti havonta a tartalmat (ő kap admin hozzáférést)?
- Domain név.
