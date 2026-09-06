const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const items = require('../Server/data/publicMentalHealth20260906.json');
const base = process.env.COLORLAB_QA_URL || 'http://127.0.0.1:4180';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (base.includes('127.0.0.1')) await page.route('**/api/homepage', r => r.fulfill({ json: items.map(item => ({ ...item, expiresAt: null, sourceCheckedAt: '2026-09-06' })) }));
      await page.goto(base + '/app/#home');
      await page.locator('.article-card').first().waitFor();
      assert.doesNotMatch(await page.locator('main').innerText(), /國立臺中科技大學|歷史活動存檔|人際成長團體 ACE|苗栗賽夏族/);
      await page.getByRole('button', { name: /自我照顧工作坊：與內在孩童相遇/ }).click();
      assert.equal(await page.getByRole('link', { name: '主辦報名表' }).getAttribute('href'), 'https://reurl.cc/Xax72j');
      assert.equal(await page.getByRole('link', { name: '查看官方原文' }).getAttribute('href'), items[0].link);
      assert.match(await page.locator('#dialog-content').innerText(), /名額.*主辦確認/);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /2026 研究：一次性的數位心理介入/ }).click();
      assert.equal(await page.getByRole('link', { name: '查看期刊原文／DOI' }).getAttribute('href'), items[2].link);
      assert.match(await page.locator('#dialog-content').innerText(), /DOI：10\.1038/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.keyboard.press('Escape');
      await page.goto(base + '/app/account.html#about');
      await page.getByRole('heading', { name: '為誰而設計？' }).waitFor();
      assert.doesNotMatch(await page.locator('body').innerText(), /國立臺中科技大學|台中科大/);
      assert.match(await page.locator('main').innerText(), /一般|每一個人/);
      assert.deepEqual(errors, []);
      console.log(`PASS ${base} ${width}px: public audience, removed campus content, source and registration links, paper DOI, no overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
