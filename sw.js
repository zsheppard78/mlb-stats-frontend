// Service worker: lets the site install as an app and show the last data you saw when offline.
// Strategy: network first (always fresh when online), fall back to the cached copy when offline.
const CACHE = "mlb-stats-v1";
const SHELL = ["./", "index.html", "style.css", "script.js", "extras.js", "favorites.html", "favorites.js",
               "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    const cacheable = url.origin === location.origin
        || url.hostname === "statsapi.mlb.com"
        || url.hostname.endsWith("mlbstatic.com")
        || url.hostname.endsWith("onrender.com");
    if (!cacheable) return;

    event.respondWith(
        fetch(req)
            .then(res => {
                if (res.ok || res.type === "opaque") {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req, { ignoreSearch: url.origin === location.origin }))
    );
});
