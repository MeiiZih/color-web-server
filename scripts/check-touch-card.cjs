// Local mock server only; no production data is submitted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
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
      const help = page.locator('.first-visit a');
      assert.equal(await page.locator('.home-page > :first-child').getAttribute('class'), 'first-visit');
      assert.match(await help.innerText(), /初次使用 ColorLab/);
      assert.equal(await help.getAttribute('href'), '/app/account.html#install');
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
