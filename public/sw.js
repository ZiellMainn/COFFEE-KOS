// Service worker Coffee Kos: supaya website bisa dipasang seperti aplikasi.
// Data pembayaran (/api) TIDAK pernah disimpan di HP, selalu diambil langsung dari server.
const CACHE = "coffee-kos-v1";
const SHELL = ["/", "/logo.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Halaman: ambil versi terbaru dulu, pakai salinan hanya kalau sedang offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/", copy)); return r; })
      .catch(() => caches.match("/")));
    return;
  }
  // Ikon & file statis: pakai salinan, sambil diperbarui di belakang layar.
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
