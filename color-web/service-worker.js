const CACHE_VERSION = 'colorlab-v17';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/wake.html',
  '/colorlab-mark.svg',
  '/main/common.html',
  '/main/about.html',
  '/main/privacy.html',
  '/test/test.html',
  '/test/report-preview.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/js/pwa.js',
  '/css/common.css',
  '/css/mobile.css',
  '/css/report-preview.css?v=14',
  '/css/ux.css',
  '/assets/images/logo.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/maskable-192.png',
  '/assets/icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('colorlab-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    const isPwaEntry = url.pathname === '/'
      || url.pathname === '/index.html'
      || url.pathname === '/wake.html'
      || (url.pathname === '/main/common.html' && url.searchParams.get('source') === 'pwa');

    if (isPwaEntry) {
      event.respondWith(cachedWakePage(request));
      return;
    }
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cachedWakePage(request) {
  const cached = await caches.match('/wake.html', { ignoreSearch: true });
  if (cached) return cached;
  return networkFirstPage(request);
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok && !new URL(request.url).pathname.startsWith('/main/admin/')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    return (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match('/offline.html'));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async response => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || network;
}
