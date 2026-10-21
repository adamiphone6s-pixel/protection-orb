/* ==========================================================================
   A NÉVJEGY ADATAI — csak ezt a fájlt kell átírni.
   Üresen hagyott mező ("") nem jelenik meg sem az oldalon, sem a névjegyben.
   ========================================================================== */
window.NEVJEGY = {
  vezeteknev: "Minta",
  keresztnev: "Ádám",
  titulus: "Webfejlesztő",
  ceg: "Saját vállalkozás",
  bemutatkozas: "Telepíthető weboldalakat és appokat készítek kis- és középvállalkozásoknak.",

  telefon: "+36 30 123 4567",
  email: "pelda@example.com",
  web: "https://example.com",
  cim: "Budapest",

  // WhatsApp-hoz a telefonszám kell nemzetközi formában, szóköz nélkül (pl. 36301234567)
  whatsapp: "",

  // Profilkép: tedd a képet a nevjegy/img mappába, és írd ide a nevét (pl. "img/foto.jpg").
  // Ha üres, a monogram jelenik meg.
  foto: "",

  // Közösségi linkek — bármennyi; a "nev" jelenik meg a gombon.
  linkek: [
    { nev: "LinkedIn", url: "https://www.linkedin.com/" },
    { nev: "Instagram", url: "https://www.instagram.com/" },
    { nev: "Facebook", url: "https://www.facebook.com/" }
  ],

  // A névjegy állandó címe (erre mutat a QR-kód és az NFC-matrica).
  // Üresen hagyva az oldal saját címét használja — közzététel után érdemes beírni a végleges címet.
  link: ""
};
