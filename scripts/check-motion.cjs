// Local, isolated browser QA only. Run with Playwright available through NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.route('**/api/homepage', route => route.fulfill({json:require('../Server/data/publicMentalHealth20260906.json')}));
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:4180/app/#home');
      await page.locator('.swatch').last().waitFor();
      await page.locator('.swatch').nth(2).click();
      assert.equal(await page.locator('.swatch').nth(2).getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('.color-caption strong').textContent(), /綠色/);
      await page.screenshot({ path: path.resolve(__dirname, `../tmp/motion-home-${width}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'home overflow');
      await page.locator('.hero-cta').click();
      await page.locator('#question-form').waitFor();
      await page.locator('.option').nth(1).click();
      await page.locator('#next-question').click();
      assert.equal(await page.locator('#main').getAttribute('data-step-motion'), 'next');
      assert.match(await page.locator('.question-number').textContent(), /02/);
      await page.locator('[data-previous]').click();
      assert.equal(await page.locator('#main').getAttribute('data-step-motion'), 'previous');
      assert.equal(await page.locator('input[name=answer]:checked').getAttribute('value'), '1');
      assert.equal(await page.locator('legend').evaluate(el => el === document.activeElement), true);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'test overflow');
      await page.screenshot({ path: path.resolve(__dirname, `../tmp/motion-test-${width}.png`), fullPage: true });
      // Complete the 20-question color survey as a local-only guest.
      for (let i = 0; i < 20; i++) {
        await page.locator('.option').nth(i % 4).click();
        await page.locator('#next-question').click();
      }
      await page.locator('.result-hero').waitFor();
      assert.equal(await page.locator('.result-characters img').count(), 4, 'tied result preserves all four characters');
      await page.locator('.result-characters img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
      await page.locator('.result-hero').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
      assert.equal(await page.locator('.color-bar strong').allTextContents().then(v => v.reduce((sum, n) => sum + parseInt(n), 0)), 100);
      await page.screenshot({ path: path.resolve(__dirname, `../tmp/motion-result-${width}.png`), fullPage: true });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('http://127.0.0.1:4180/app/#home');
      await page.locator('.swatch').last().waitFor();
      assert.equal(await page.locator('.hero-copy').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.equal(await page.locator('.swatch').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      await page.locator('.article-card').first().click();
      await page.locator('dialog[open]').waitFor();
      assert.equal(await page.locator('dialog').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.locator('.article-card').first().evaluate(el => el === document.activeElement), true);
      await page.goto('http://127.0.0.1:4180/app/account.html#login');
      await page.locator('#login-form').waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'login overflow');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: card, next/back/persist/focus, 20 answers/result, reduced motion, dialog/Escape, login`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
