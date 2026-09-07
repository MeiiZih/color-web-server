// Isolated wake/renderer contract test; no production requests or account data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const backend = 'https://color-web-server-jprj.onrender.com';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><html><body><button id="before">Existing focus</button><aside inert>Already inert</aside><main id="main" tabindex="-1"><p>Loading</p></main><script>document.querySelector('#before').focus();window.COLORLAB_API_ORIGIN=${JSON.stringify(backend)};</script><script src="/js/static-connection.js"></script><script>ColorLabConnection.ready.then(async()=>{window.gateReleased=true;try{await fetch('/api/catalog');window.apiFinished=true;}catch{window.apiFailed=true;}});</script></body></html>`);
  }
  const file = url.pathname === '/wake.html' ? 'launcher-site/index.html' : 'color-web' + url.pathname;
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) { res.statusCode = 204; return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  res.end(fs.readFileSync(absolute));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const mode of ['mobile', 'desktop', 'reduced-error', 'fallback', 'warm']) {
      const context = await browser.newContext({ viewport: { width: mode === 'desktop' ? 1440 : 390, height: 844 }, reducedMotion: mode === 'reduced-error' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let healthCalls = 0, releaseHealth;
      const healthReady = new Promise(resolve => { releaseHealth = resolve; });
      await page.route(backend + '/health**', async route => {
        healthCalls++;
        if (mode !== 'warm' && healthCalls === 1) return route.fulfill({status:503,body:'Waking',headers:{'Access-Control-Allow-Origin':'*'}});
        await healthReady;
        await route.fulfill({body:'OK',headers:{'Access-Control-Allow-Origin':'*'}});
      });
      await page.route(backend + '/api/**', route => mode === 'reduced-error' ? route.abort() : route.fulfill({json:[],headers:{'Access-Control-Allow-Origin':'*'}}));
      if (mode === 'warm') releaseHealth();
      await page.goto(base);
      if (mode !== 'warm') {
        await page.locator('iframe').waitFor();
        // Forged parent message must not open the API gate.
        await page.evaluate(() => window.postMessage({type:'colorlab:ready'}, location.origin));
        assert.equal(await page.evaluate(() => !!window.gateReleased), false);
        assert.equal(await page.locator('#main').evaluate(el => el.inert), true);
        releaseHealth();
      }
      await page.waitForFunction(() => window.gateReleased);
      if (mode !== 'warm') {
        await page.waitForFunction(() => window.apiFinished || window.apiFailed);
        assert.equal(await page.locator('iframe').count(), 1, 'wake screen must stay while app data is not rendered');
        const frame = page.frames().find(f => f.url().includes('wake.html'));
        assert.equal(await frame.locator('#readyCurtain').evaluate(el => el.classList.contains('show')), true, 'cold launch shows the completion logo while the app prepares');
        if (mode !== 'fallback') await page.evaluate(error => { document.querySelector('#main').innerHTML = error ? '<h1>Unable to load</h1><button>Retry</button>' : '<h1>Content ready</h1>'; }, mode === 'reduced-error');
        await page.locator('iframe').waitFor({state:'detached',timeout:10000});
        assert.equal(await page.locator('#main').evaluate(el => el.inert), false);
        assert.equal(await page.locator('aside').evaluate(el => el.inert), true, 'preserve pre-existing inert');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'before', 'restore focus');
      } else assert.equal(await page.locator('iframe').count(), 0);
      assert.deepEqual(errors, []);
      console.log('PASS', mode);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
