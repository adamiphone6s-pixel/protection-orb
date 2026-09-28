/* Service worker: offline váz + friss adatok (network-first a /data alatt). */
const CACHE = "vk-v1";
const SHELL = [
  "./", "index.html", "about.html", "services.html", "news.html", "join.html", "contact.html", "login.html", "portal.html", "privacy.html",
  "assets/css/style.css", "assets/js/i18n.js", "assets/js/app.js", "assets/js/portal.js", "assets/img/icon.svg", "manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Tagi adatokat nem cache-elünk; a nyilvános híreket hálózatról, offline esetén cache-ből.
  if (url.pathname.includes("/data/companies/") || url.pathname.endsWith("/data/members.json")) return;
  const networkFirst = url.pathname.includes("/data/") || e.request.mode === "navigate";
  if (networkFirst) {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
