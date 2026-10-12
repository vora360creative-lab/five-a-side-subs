/*
 * Offline support.
 * - Every app file is cached on install and always served from the cache, so the
 *   app opens instantly with no signal.
 * - Each time the app is opened with the server reachable, all files are
 *   re-downloaded in the background and swapped in together (only if every file
 *   arrived), so edits show up on the NEXT launch without mixing old and new files.
 */
const VERSION = "v5";
const CACHE = `subs5-${VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./logic.js",
  "./sounds.js",
  "./sounds/whistle.mp3",
  "./templates.js",
  "./squad.js",
  "./manifest.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("subs5-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === "navigate";
  event.respondWith(fromCache(req, isPage));
  if (isPage) event.waitUntil(refreshAll());
});

async function fromCache(req, isPage) {
  // ignoreSearch so "?speed=20" still loads offline
  const hit = await caches.match(isPage ? "./index.html" : req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    return (isPage && (await caches.match("./index.html"))) || Response.error();
  }
}

async function refreshAll() {
  try {
    const responses = await Promise.all(ASSETS.map((url) => fetch(url, { cache: "no-store" })));
    if (!responses.every((r) => r.ok)) return;
    const bodies = await Promise.all(responses.map((r) => r.blob()));
    const cache = await caches.open(CACHE);
    await Promise.all(bodies.map((body, i) =>
      cache.put(ASSETS[i], new Response(body, { headers: responses[i].headers }))));
  } catch (e) {
    // Offline or server not running: keep the cached copy.
  }
}
