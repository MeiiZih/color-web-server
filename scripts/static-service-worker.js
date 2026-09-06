// Independent frontend: cache public shell only, never tokens, records, APIs or Render wake HTML.
const CACHE = 'colorlab-static-shell-v16';
const SHELL = ['/app/', '/app/app.js', '/app/model.mjs', '/app/client.mjs', '/app/auth.mjs', '/app/ui.mjs', '/app/account.html', '/app/account.mjs', '/app/account.css', '/app/style.css', '/app/motion.css', '/js/static-connection.js', '/colorlab-mark.svg', '/wake.html'];
SHELL.push('/app/verification-status.mjs', '/app/verification-status.css');
SHELL.push('/app/character-art.mjs');
SHELL.push('/assets/images/survey-color-cover-20260906.webp');
SHELL.push('/app/companion-interaction.mjs', '/app/content-illustrations.mjs', '/app/legacy-import.mjs');
SHELL.push('/app/source-help.mjs');
SHELL.push('/app/quiz-feedback.mjs', '/app/navigation-motion.mjs', '/app/statistics-view.mjs', '/app/statistics.css');
SHELL.push('/app/content-review.mjs','/app/content-review.css');
SHELL.push('/app/experience.css','/app/color-details.mjs');
SHELL.push(...['hotline-1925','lifeline-1995','teacher-1980','care-guide','psychology-columns','public-lectures','digital-research','inner-child','psychology-knowledge','youth-text','healthy-boundaries','relationship-pause','social-emotional-ai','counseling'].map(slug => `/assets/images/posts/${slug}-20260906.webp`));
SHELL.push('/app/characters.css', '/app/content-media.mjs', '/app/content-media.css', ...['red','yellow','green','blue'].map(color => `/assets/characters/${color}.webp`));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('colorlab-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  // Published artwork is refreshed with each shell version, not downloaded on every tab switch.
  if (/\.(?:webp|png|svg)$/.test(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const stored = await cache.match(event.request);
      if (stored) return stored;
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) await cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then(async response => {
    if (response.ok && !response.redirected) {
      const copy = response.clone();
      if (!url.pathname.endsWith('.html') && url.pathname !== '/app/' || (await copy.text()).includes('ColorLab')) {
        const cache = await caches.open(CACHE); await cache.put(event.request, response.clone());
      }
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
