// Local mock server only; no production data is submitted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
      await page.route('**/api/homepage', route => route.fulfill({json:['news','common'].map(type=>({_id:type,type,title:'貼文關閉鍵測試',description:'僅供本機測試',link:'https://example.org',imageUrl:'/colorlab-mark.svg'}))}));
      await page.goto('http://127.0.0.1:4180/app/#home');
      const card = page.locator('[data-hue]').first();
      await card.tap();
      const dialog = page.locator('dialog[open]');
      await dialog.waitFor();
      assert.equal(await dialog.locator('.dialog-close').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), width < 768 ? 'color-mobile-open' : 'color-unfold');
      await dialog.locator('.dialog-close').tap();
      assert.equal(await card.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('[data-pointer-focus]').count(), 0);
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      for (const selector of ['[data-article]', '[data-resource]']) {
        const post = page.locator(selector).first();
        await post.tap();
        const close = dialog.locator('.dialog-close');
        await dialog.waitFor();
        assert.equal(await close.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        assert.equal(await close.evaluate(el => getComputedStyle(el).color), 'rgb(168, 65, 97)');
        await close.tap();
        await post.focus();
        await page.keyboard.press('Enter');
        await dialog.waitFor();
        assert.equal(await close.evaluate(el => getComputedStyle(el).outlineWidth), '2px');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.matches('[data-article], [data-resource]')), true);
      }
      const help = page.locator('.first-use-link');
      assert.equal(await page.locator('.first-visit').count(), 0);
      assert(await help.evaluate(el=>!!el.closest('.hero-copy')));
      assert.match(await help.innerText(), /初次使用 ColorLab/);
      assert.equal(new URL(await help.getAttribute('href'), 'http://127.0.0.1:4180').hash, '#install');
      assert.equal(new URL(await help.getAttribute('href'), 'http://127.0.0.1:4180').searchParams.get('returnTo'), '/app/#home');
      await help.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tmp/first-visit-${width}.png` });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await card.tap();
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none');
      console.log(`PASS ${width}: touch has no ring, keyboard focus retained, panel motion/reduced motion, first-use card`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
