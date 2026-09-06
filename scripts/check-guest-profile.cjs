// Local fixtures only; requires preview-static.cjs on 127.0.0.1:4180.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = 'http://127.0.0.1:4180';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    for (const width of [390,1280]) for (const role of ['guest','admin','user']) {
      const page = await browser.newPage({ viewport:{width,height:844}, serviceWorkers:'block', reducedMotion:'reduce' });
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      const token='qa.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.invalid';
      if(role!=='guest') await page.addInitScript(({token,role})=>{
        if(!sessionStorage.getItem('qa-seeded')) {
          sessionStorage.setItem(role==='admin'?'adminToken':'userToken',token);
          sessionStorage.setItem('qa-seeded','true');
        }
      },{token,role});
      for(const file of ['app.js','experience.css']) await page.route('**/app/'+file,async route=>route.fulfill({
        body:await fs.readFile(path.resolve('color-web/app',file),'utf8'),contentType:file.endsWith('.css')?'text/css':'text/javascript'
      }));
      await page.route('**/api/**',async route=>{
        const url=new URL(route.request().url());
        assert.equal(url.origin,origin,'Never contact production');
        assert.equal(route.request().method(),'GET','No account or record writes');
        const user={id:'222222222222222222222222',role,name:'本機帳號',email:'fixture@example.invalid',emailVerifiedAt:'2026-01-01T00:00:00Z'};
        const data={
          '/api/homepage':[], '/api/explore/catalog':[{id:'111111111111111111111111',title:'本機問卷',questions:[]}],
          '/api/explore/me':user, '/api/explore/records':[], '/api/user/profile':user
        };
        return route.fulfill({json:data[url.pathname]??{}});
      });
      await page.goto(origin+'/app/#me',{waitUntil:'domcontentloaded'});
      await page.locator('.profile-card').waitFor();
      const card=page.locator('.guest-account');
      assert.equal(await card.count(),role==='guest'?1:0);
      if(role==='guest') {
        assert.equal(await card.getByRole('link',{name:'登入',exact:true}).getAttribute('href'),'/app/account.html#login');
        assert.equal(await card.getByRole('link',{name:'建立帳號',exact:true}).getAttribute('href'),'/app/account.html#register');
        assert.match(await card.innerText(),/訪客紀錄只保存在這個瀏覽器，不會自動合併/);
        assert.equal(await page.getByRole('link',{name:'登入／註冊會員',exact:true}).count(),0);
        assert(await card.evaluate(el=>Boolean(document.querySelector('.profile-card').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(el.compareDocumentPosition(document.querySelector('.profile-row'))&Node.DOCUMENT_POSITION_FOLLOWING)));
        for(const action of await card.locator('.button').all()) {
          const box=await action.boundingBox();assert(box.height>=44&&box.width>=44);
        }
        await page.screenshot({path:`tmp/guest-profile-${width}.png`,fullPage:true});
        await page.locator('.profile-row[href="#surveys"]').click();
        await page.waitForURL(origin+'/app/#surveys');
      } else {
        assert.equal(await page.locator('[data-logout]').count(),1);
        assert.equal(await page.locator('a[href="/app/account.html#admin"]').count(),role==='admin'?1:0);
        await page.locator('[data-logout]').click();
        await page.waitForURL(origin+'/app/');
        assert(await page.evaluate(()=>!sessionStorage.getItem('adminToken')&&!sessionStorage.getItem('userToken')));
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`PASS ${width} ${role}: guest CTA placement, role isolation, logout, no overflow/API writes`);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
