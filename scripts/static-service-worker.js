// Independent frontend: cache public shell only, never tokens, records, APIs or Render wake HTML.
const CACHE = 'colorlab-static-shell-v1';
const SHELL = ['/app/', '/app/app.js', '/app/model.mjs', '/app/client.mjs', '/app/style.css', '/js/navbar.js', '/js/static-connection.js', '/colorlab-mark.svg', '/wake.html'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('colorlab-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok && !response.redirected) {
      const copy = response.clone();
      if (!url.pathname.endsWith('.html') && url.pathname !== '/app/' || (await copy.text()).includes('ColorLab')) {
        const cache = await caches.open(CACHE); await cache.put(event.request, response.clone());
      }
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
