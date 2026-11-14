// The offline service worker. The build fills in CACHE, named after the
// build's contents, and PRECACHE, every file the build wrote, relative to
// the worker. A new build is a new worker, which caches the new files and
// takes over; the page shows it on its next load.

// A module, so `self` can be declared as the service worker's global.
export {};
declare const self: ServiceWorkerGlobalScope;
declare const CACHE: string;
declare const PRECACHE: readonly string[];

const prefix = 'fman-';
const start = new URL('./', self.registration.scope).href;
const precached = new Set(PRECACHE.map(path => new URL(path, start).href));

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll([...precached]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith(prefix) && key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * A page other than the game's, such as the clip debugger at `clips.html`
 * or `clips`, left uncached: the game is its folder or `index.html`.
 */
const otherPage = (url: URL) =>
  !url.pathname.endsWith('/') && !url.pathname.endsWith('/index.html');

// Every page load is the game's page, unless it names another page;
// built files come from the cache. Anything else goes to the network.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  url.hash = '';
  url.search = '';
  const key = request.mode === 'navigate' && !otherPage(url) ? start : url.href;
  if (!precached.has(key)) {
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then(cache => cache.match(key))
      .then(cached => cached ?? fetch(request))
  );
});
