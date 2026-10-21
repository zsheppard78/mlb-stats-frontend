// Service worker: lets the site install as an app and show the last data you saw when offline.
// Strategy: network first (always fresh when online), fall back to the cached copy when offline.
const CACHE = "statdugout-v5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
               "css/base.css", "css/layout.css", "css/home.css", "css/windows.css", "css/team.css", "css/player.css", "css/compare.css", "css/games.css", "css/leaders.css", "css/find-player.css", "css/charts.css", "css/account.css",
               "js/account.js", "js/api.js", "js/app.js", "js/career.js", "js/charts.js", "js/compare.js", "js/find-player.js", "js/games.js", "js/leaders.js", "js/menu.js", "js/modals.js", "js/player.js", "js/pwa.js", "js/search.js", "js/share.js", "js/standings.js", "js/state.js", "js/team-postseason.js", "js/team.js", "js/theme.js", "js/upcoming.js", "js/util.js", "js/world-series.js"];

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
    // Never store account data (sign-in, favorites) on the device
    if (req.headers.has("Authorization") || /^\/api\/(auth|me|favorites)/.test(url.pathname)) return;

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
