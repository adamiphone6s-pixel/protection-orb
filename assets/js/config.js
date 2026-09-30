/*
 * Éles háttérrendszer beállítása (Supabase).
 * Amíg üres, az oldal DEMÓ módban fut (helyi JSON adatokkal).
 * Az anon kulcs nyilvános, a böngészőbe szánt kulcs — a service_role kulcsot SOHA ne írd ide!
 * Lépések: docs/SETUP.md
 */
window.VK_CONFIG = {
  supabaseUrl: "",       // pl. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",   // Supabase → Project Settings → API → anon public
  memberEmailDomain: "tag.vedokor.local" // egyezzen a Vercel MEMBER_EMAIL_DOMAIN értékével
};
