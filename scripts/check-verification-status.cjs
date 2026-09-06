const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const items = require('../Server/data/officialContent20260906.json');
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport:{width,height:844}, serviceWorkers:'block' });
      // Fixture session is invalid on production; requests stay on the local mock server.
      await context.addInitScript(() => {
        const token = 'qa.' + btoa(JSON.stringify({exp:4102444800})) + '.invalid';
        sessionStorage.setItem('userToken',token);
      });
      const page = await context.newPage(); const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      let verified = false, failed = false;
      const profile = () => ({id:'222222222222222222222222',name:'測試會員',email:'qa@example.invalid',emailVerifiedAt:verified?'2026-09-06T06:00:00Z':null,emailVerificationRequired:false});
      await page.route('**/api/user/profile',r=>r.fulfill({status:failed?503:200,json:failed?{message:'offline'}:profile()}));
      await page.route('**/api/explore/me',r=>r.fulfill({json:profile()}));
      await page.route('**/api/explore/records',r=>r.fulfill({json:[]}));
      await page.route('**/api/homepage',r=>r.fulfill({json:items.map(i=>({...i,sourceCheckedAt:'2026-09-06'}))}));
      await page.goto('http://127.0.0.1:4180/app/account.html#profile');
      await page.locator('[data-check-verification]').waitFor();
      await page.locator('[name=name]').fill('尚未儲存的修改');
      verified=true;
      await page.waitForTimeout(2100);
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.getByText('✓ 已驗證',{exact:true}).waitFor();
      assert.equal(await page.locator('[name=name]').inputValue(),'尚未儲存的修改');
      assert.equal(await page.locator('[data-verification-request]').isVisible(),false);
      failed=true;
      await page.locator('[data-check-verification]').click();
      await page.getByText(/目前無法確認最新狀態/).waitFor();
      assert.equal(await page.locator('[name=name]').inputValue(),'尚未儲存的修改');
      assert.equal(await page.getByText('✓ 已驗證',{exact:true}).count(),1);
      failed=false;
      page.on('dialog',d=>d.accept());
      await page.goto('http://127.0.0.1:4180/app/#me');
      await page.getByText('✓ 已驗證',{exact:true}).waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`tmp/verification-me-${width}.png`,fullPage:true,animations:'disabled'});
      await page.goto('http://127.0.0.1:4180/app/#home');
      await page.locator('.article-card').first().waitFor();
      assert.equal(await page.locator('.article-card').count(),3);
      assert.equal(await page.locator('.resource-card').count(),5);
      await page.locator('.article-card').first().click();
      await page.getByRole('link',{name:'查看官方原文'}).waitFor();
      assert.match(await page.locator('#dialog-content').textContent(),/查核 2026-09-06/);
      await page.keyboard.press('Escape');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`tmp/official-content-${width}.png`,fullPage:true,animations:'disabled'});
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px: verification refresh preserves draft, hides resend, failure is explicit; 8 official cards and source dialog`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
