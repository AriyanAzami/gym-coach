/* Service worker: the shell is cached so the app opens in a basement gym with
   no signal. Data is never cached — requests to Supabase go to the network or
   fail, and store.js queues the writes that could not land.

   Bump VERSION on every deploy so installed phones take the new shell. */

const VERSION = 'v9';
const SHELL = `shell-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './vendor/supabase.js',
  './schema/rules.schema.json',
  './js/app.js',
  './js/charts.js',
  './js/config.js',
  './js/engine.js',
  './js/nav.js',
  './js/outbox.js',
  './js/rules-check.js',
  './js/screens-block.js',
  './js/screens-coach.js',
  './js/screens-health.js',
  './js/screens-journal.js',
  './js/screens-progress.js',
  './js/screens-settings.js',
  './js/screens-today.js',
  './js/screens-workout.js',
  './js/store.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // The backend is never cached: a stale session or a stale set is worse than
  // an error the app can queue around.
  if (url.hostname.endsWith('supabase.co')) return;

  if (url.origin !== location.origin) return;

  // Cache first, refresh in the background, so the app opens instantly and
  // still picks up a new deploy on the next load.
  event.respondWith(
    caches.match(event.request).then((hit) => {
      const fetching = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || fetching;
    }),
  );
});
