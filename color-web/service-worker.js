// Retired backend UI: migrate installed navigation to the independent new frontend.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('colorlab-')).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(Promise.resolve(Response.redirect('https://colorlab-start.onrender.com' + url.pathname + url.search, 302)));
  }
});
