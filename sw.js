const CACHE_NAME = "liaocao-workbench-v2";
const APP_SHELL = [
  "",
  "english/",
  "design/",
  "sport/",
  "reading/",
  "notebook/",
  "learning/",
  "records/",
  "news/",
  "review/",
  "manifest.webmanifest",
  "favicon.svg"
];

const scopedUrl = (path) => new URL(path, self.registration.scope).toString();

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.allSettled(
    APP_SHELL.map(async (path) => {
      const url = scopedUrl(path);
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    })
  );

  const home = await cache.match(scopedUrl(""));
  if (!home) return;

  const html = await home.clone().text();
  const assetUrls = [...html.matchAll(/(?:href|src)=["']([^"']+\.(?:css|js))["']/g)]
    .map((match) => new URL(match[1], self.registration.scope).toString());

  await Promise.allSettled(
    assetUrls.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(scopedUrl("")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    })
  );
});
