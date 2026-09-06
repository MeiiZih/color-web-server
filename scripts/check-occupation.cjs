const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(() => sessionStorage.setItem('userToken', 'qa.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.invalid'));
      const page = await context.newPage(), errors = [], saves = [];
      page.on('pageerror', error => errors.push(error.message));
      let user = { id: '222222222222222222222222', name: '測試會員', email: 'qa@example.invalid', gender: 'unknown', occupation: '未設定', emailVerifiedAt: null, emailVerificationRequired: false };
      await page.route('**/api/user/profile', route => route.fulfill({ json: user }));
      await page.route('**/api/user/update-profile', route => {
        const values = route.request().postDataJSON(); saves.push(values);
        user = { ...user, ...values };
        return route.fulfill({ json: { success: true, user } });
      });
      await page.goto('http://127.0.0.1:4180/app/account.html#profile');
      const choice = page.getByRole('combobox', { name: '職業（選填）', exact: true });
      const custom = page.getByRole('textbox', { name: '其他職業', exact: true });
      await choice.waitFor();
      assert.equal(await choice.inputValue(), '');
      assert.equal(await custom.isVisible(), false);
      await choice.selectOption('學生');
      await page.getByRole('button', { name: '儲存資料', exact: true }).click();
      await page.getByText('資料已儲存。', { exact: true }).waitFor();
      assert.equal(saves.at(-1).occupation, '學生');
      assert.equal('occupation-choice' in saves.at(-1), false);
      await choice.selectOption('__other');
      await custom.waitFor();
      assert.equal(await custom.evaluate(el => el === document.activeElement), true);
      await custom.fill('   ');
      assert.equal(await custom.evaluate(el => el.checkValidity()), false);
      await custom.fill('插畫工作者');
      await page.getByRole('button', { name: '儲存資料', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-occupation] select')?.value === '__other' && !document.querySelector('#profile-form')?.hasAttribute('aria-busy'));
      assert.equal(saves.at(-1).occupation, '插畫工作者');
      await page.reload();
      await custom.waitFor();
      assert.equal(await choice.inputValue(), '__other');
      assert.equal(await custom.inputValue(), '插畫工作者');
      await choice.selectOption('退休');
      assert.equal(await custom.isVisible(), false);
      await page.getByRole('button', { name: '取消修改', exact: true }).click();
      await custom.waitFor();
      assert.equal(await choice.inputValue(), '__other');
      assert.equal(await custom.inputValue(), '插畫工作者');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `tmp/occupation-${width}.png`, fullPage: true });
      await choice.selectOption('');
      await page.getByRole('button', { name: '儲存資料', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-occupation] select')?.value === '' && !document.querySelector('#profile-form')?.hasAttribute('aria-busy'));
      assert.equal(saves.at(-1).occupation, '');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: preset/custom/optional save, legacy value reload, whitespace validation, focus, reset and no overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
