const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const official = require('../Server/data/officialContent20260906.json');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 768, 1280, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: width < 768 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const items = [0, 1, 2].flatMap(n => official.map(a => ({ ...a, title: `${a.title} ${n}`, expiresAt: null })));
      items.push(...Array.from({ length: 6 }, (_, i) => ({ type: 'news', title: '歷史活動', imageUrl: `/assets/images/act${i + 1}.jpg` })));
      items.push(...['news', 'common'].map(type => ({ type, title: '已過期', expiresAt: '2000-01-01' })));
      await page.route('**/api/homepage', r => r.fulfill({ json: items }));
      await page.goto('http://127.0.0.1:4180/app/#home');
      const cards = page.locator('.article-card');
      await cards.first().waitFor();
      assert.equal(await cards.count(), 9);
      assert.equal(await page.locator('.resource-card').count(), 15);
      assert.equal(await page.getByText('歷史活動', { exact: true }).count(), 0);
      assert.equal(await page.getByText('已過期', { exact: true }).count(), 0);
      for (const selector of ['.article-card', '.resource-card']) {
        const size = await page.locator(selector).first().boundingBox();
        assert(size.width >= (width >= 768 ? 280 : 210), `${width}px ${selector} is squeezed: ${size.width}`);
      }
      if (width >= 768) {
        const tops = await cards.evaluateAll(nodes => nodes.map(el => el.querySelector('.article-image').getBoundingClientRect().top));
        assert(tops.every(top => Math.abs(top - tops[0]) < 2));
      }
      for (const list of await page.locator('.horizontal-list').all()) {
        await list.focus(); await list.press('ArrowRight');
        await page.waitForFunction(el => el.scrollLeft > 20, await list.elementHandle());
      }
      await cards.first().click();
      await page.getByRole('link', { name: '查看官方原文' }).waitFor();
      assert((await page.locator('#dialog-content').textContent()).includes(items.find(a => a.type === 'news').description));
      await page.keyboard.press('Escape');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.locator('.editorial-section').first().screenshot({ path: `tmp/homepage-news-${width}.png` });
      await page.route('**/api/homepage', r => r.fulfill({ json: [{ type: 'news', title: '已過期', expiresAt: '2000-01-01' }] }));
      await page.reload();
      await page.locator('.horizontal-list').first().waitFor();
      await page.locator('.horizontal-list').first().focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await cards.count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: wide cards, horizontal keyboard scrolling, aligned images, full detail, expired/archive filtering and empty feed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
