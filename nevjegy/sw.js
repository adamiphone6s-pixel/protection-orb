/* Service worker: a névjegy internet nélkül is megnyílik (pl. QR-kód mutatásához). */
const CACHE = "nevjegy-v1";
const SHELL = [
  "./", "index.html", "nevjegy.css?v=1", "nevjegy.js?v=1", "adatok.js?v=1", "vendor/qrcode.js",
  "manifest.webmanifest", "img/icon.svg", "img/icon-192.png",
  "../assets/css/fonts.css", "../assets/fonts/Unbounded-normal-latin.woff2", "../assets/fonts/Manrope-normal-latin.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("nevjegy-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Hálózat előbb, hogy az adatok módosítása azonnal látsszon; offline a gyorsítótár.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" })));
});
