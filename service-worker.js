const CACHE_NAME = "plukakang-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

// Install: simpan hanya app shell dan ikon. Tidak menyimpan data katalog/API.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("plukakang-shell-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Jangan pernah cache data dinamis, publish/API, atau request non-GET.
  if (request.method !== "GET" ||
      url.origin !== self.location.origin ||
      /(^|\/)(data\.json|version\.json)$/i.test(url.pathname) ||
      url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigasi: utamakan versi online; gunakan shell cache hanya saat offline.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: "no-store" });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put("/index.html", fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (error) {
        return (await caches.match("/index.html")) ||
               (await caches.match("/")) ||
               new Response("Plukakang sedang offline. Sambungkan internet lalu coba lagi.", {
                 status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
               });
      }
    })());
    return;
  }

  // App shell statis/ikon: cache-first. Data katalog tidak masuk jalur ini.
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone()).catch(() => {});
      }
      return fresh;
    })());
  }
});
