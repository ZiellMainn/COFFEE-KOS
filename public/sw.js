// Service worker sederhana supaya website bisa dipasang sebagai aplikasi.
// Data (/api) TIDAK pernah disimpan di cache, jadi status pembayaran selalu terbaru.
const CACHE = "kos-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (e.request.mode === "navigate") {
    // Halaman: ambil versi terbaru dari internet, pakai cache hanya kalau offline
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/", copy)); return r; }).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/icons/")) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
