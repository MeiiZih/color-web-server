// Read-only navigation measurements; admin routes use localhost fixtures, never production credentials.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.NAV_BASE || 'http://127.0.0.1:4180';
const baseline = process.argv.includes('--baseline');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
 try {
  for (const width of [390,1280]) {
   const page = await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}), errors=[], calls=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(r.url().includes('/api/'))calls.push({path:new URL(r.url()).pathname,at:Date.now()});});
   const started=Date.now();
   await page.goto(base+'/app/#home',{waitUntil:'domcontentloaded'});
   await page.locator('.home-page').waitFor();
   await page.evaluate(()=>{window.homeNode=document.querySelector('.home-page');});
   console.log(JSON.stringify({width,page:'initial home',ms:Date.now()-started,api:calls.map(c=>({...c,at:c.at-started}))}));
   for(const route of ['surveys','me','history','news','resources','home']) {
    const before=calls.length, then=Date.now();
    await page.evaluate(hash=>{location.hash=hash;},route);
    await page.waitForFunction(r=>document.body.dataset.page===r,route);
    console.log(JSON.stringify({width,page:route,ms:Date.now()-then,newAPIs:calls.length-before}));
    assert(!(await page.locator('main').innerText()).includes('正在準備你的色彩探索'));
   }
   if(!baseline)assert(await page.evaluate(()=>document.querySelector('.home-page')===window.homeNode),'unchanged home retains DOM');
   await page.goto(base+'/app/account.html#install',{waitUntil:'domcontentloaded'});
   await page.locator('.first-use-guide').waitFor();
   for(const route of ['about','privacy','contact','login','register','install']) {
    const then=Date.now();await page.evaluate(hash=>{location.hash=hash;},route);
    await page.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy'));
    console.log(JSON.stringify({width,page:route,ms:Date.now()-then}));
   }
   assert.deepEqual(errors,[]);await page.close();
   if(!base.includes('127.0.0.1'))continue;
   const admin=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
   const adminCalls=[];admin.on('request',r=>{if(r.url().includes('/api/'))adminCalls.push(r.url());});
   await admin.addInitScript(()=>sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid'));
   await admin.goto(base+'/app/account.html#admin');await admin.getByRole('heading',{name:'照顧每一次探索。'}).waitFor();
   for(const route of ['users','surveys','statistics','records','feedbacks','admin-profile','admin']) {
    const then=Date.now();await admin.evaluate(hash=>{location.hash=hash;},route);
    await admin.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy')&&!document.querySelector('main').textContent.includes('正在準備內容'));
    await admin.locator('main h1').waitFor();
    console.log(JSON.stringify({width,page:'admin/'+route,ms:Date.now()-then}));
   }
   // Return restores the exact list node, its search input, and scroll without another query.
   await admin.evaluate(()=>{location.hash='users';});await admin.locator('#users-list').waitFor();
   await admin.locator('[name=search]').fill('member3');
   await admin.evaluate(()=>{window.retainedList=document.querySelector('#users-list');document.querySelector('#users-list a').addEventListener('click',()=>{window.retainedTop=scrollY;},{once:true});});
   await admin.locator('#users-list a').first().click();await admin.getByRole('heading',{name:'本機測試會員',exact:true}).waitFor();
   const beforeReturn=adminCalls.length;
   await admin.locator('.back-link').click();await admin.locator('#users-list').waitFor();
   assert.equal(adminCalls.length,beforeReturn,'return skips duplicate API reads');
   assert.equal(await admin.locator('[name=search]').inputValue(),'member3');
   assert(await admin.evaluate(()=>document.querySelector('#users-list')===window.retainedList),'retains bound DOM');
   assert(await admin.evaluate(()=>Math.abs(scrollY-window.retainedTop)<2),'restores list scroll');
   // A successful write clears private views; next visit must obtain fresh data.
   await admin.evaluate(async()=>{const {api,json}=await import('/app/auth.mjs');await api('/api/user/update-profile',json('PUT',{name:'本機測試會員'}));location.hash='admin';});
   await admin.getByRole('heading',{name:'照顧每一次探索。'}).waitFor();
   const beforeFresh=adminCalls.filter(u=>u.endsWith('/api/admin/users')).length;
   await admin.evaluate(()=>{location.hash='users';});await admin.locator('#users-list').waitFor();
   assert.equal(adminCalls.filter(u=>u.endsWith('/api/admin/users')).length,beforeFresh+1,'write invalidates views');
   await admin.evaluate(()=>{location.hash='admin';});await admin.getByRole('heading',{name:'照顧每一次探索。'}).waitFor();
   await admin.evaluate(async()=>{(await import('/app/navigation-state.mjs')).markDataChanged();});
   // Slow destination and out-of-order responses must never blank or replace a newer page.
   let release;const hold=new Promise(r=>release=r);
   await admin.route('**/api/admin/users',async r=>{await hold;await r.continue();});
   await admin.evaluate(()=>{location.hash='users';});await admin.waitForTimeout(100);
   if(!baseline)assert.match(await admin.locator('main').innerText(),/照顧每一次探索/);
   await admin.evaluate(()=>{location.hash='surveys';});await admin.getByRole('heading',{name:'問卷管理',exact:true}).waitFor();
   release();await admin.waitForTimeout(200);
   assert(await admin.getByRole('heading',{name:'問卷管理',exact:true}).isVisible());
   await admin.evaluate(async()=>{(await import('/app/auth.mjs')).clearSession();location.hash='users';});
   await admin.locator('#login-form').waitFor();
   assert.equal(await admin.locator('#users-list').count(),0,'logout cannot restore a private cached list');
   await admin.close();
   if(!baseline) {
    const pdfContext=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),pdfBack=await pdfContext.newPage();let privateReads=0;
    // Production static documents allow bfcache; the fixture server otherwise sends no-store globally.
    await pdfBack.route('**/app/account.html',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'cache-control':'public, max-age=0, s-maxage=300'}});});
    pdfBack.on('request',r=>{if(r.url().includes('/api/admin/'))privateReads++;});
    await pdfBack.addInitScript(()=>sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid'));
    await pdfBack.goto(base+'/app/account.html#records');await pdfBack.locator('[data-record]').first().click();await pdfBack.locator('dialog[open]').waitFor();
    const firstDetailReads=privateReads;
    await pdfBack.locator('dialog .dialog-close').click();await pdfBack.locator('[data-record]').first().click();await pdfBack.locator('dialog[open]').waitFor();
    assert.equal(privateReads,firstDetailReads,'reopening unchanged record uses memory snapshot');
    await pdfBack.evaluate(()=>{window.nativeRecordPage=true;});const readsBeforePDF=privateReads;
    await pdfBack.getByRole('link',{name:'預覽 PDF',exact:true}).click();await pdfBack.locator('.pdf-shell').waitFor();
    await pdfBack.locator('.text-button').click();await pdfBack.locator('dialog[open]').waitFor({timeout:5000});
    assert(await pdfBack.evaluate(()=>window.nativeRecordPage),'native PDF return restores document');
    assert.equal(privateReads,readsBeforePDF,'PDF back skips private reload');
    await pdfBack.goto(base+'/app/pdf.html?returnTo=https%3A%2F%2Fevil.invalid%2F&from=admin');
    assert.equal(await pdfBack.locator('.text-button').getAttribute('href'),base+'/app/account.html#records','untrusted return target falls back locally');
    await pdfBack.goto(base+'/app/account.html#users');await pdfBack.locator('#users-list').waitFor();
    await pdfBack.evaluate(()=>localStorage.setItem('adminToken',sessionStorage.getItem('adminToken')));
    const peer=await pdfBack.context().newPage();await peer.goto(base+'/app/account.html#about');
    await peer.evaluate(async()=>{(await import('/app/auth.mjs')).clearSession();});
    await pdfBack.locator('#login-form').waitFor();
    assert.equal(await pdfBack.locator('#users-list').count(),0,'other-tab logout clears visible private view');await peer.close();
    await pdfContext.close();
   }
   if(!baseline) {
    const slow=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}), starts=[];
    await slow.addInitScript(()=>sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid'));
    await slow.route('**/api/**',async r=>{starts.push({path:new URL(r.request().url()).pathname,time:Date.now(),auth:r.request().headers().authorization});await new Promise(resolve=>setTimeout(resolve,400));await r.continue();});
    await slow.goto(base+'/app/#home');await slow.locator('.home-page').waitFor();
    assert.equal(starts.length,4);assert(starts.at(-1).time-starts[0].time<150,'independent requests start together');
    assert(starts.filter(r=>['/api/homepage','/api/explore/catalog'].includes(r.path)).every(r=>!r.auth),'public reads skip preflight-triggering auth');
    assert(starts.filter(r=>['/api/explore/me','/api/explore/records'].includes(r.path)).every(r=>r.auth),'private reads still authenticate');
    await slow.close();
    const guide=await browser.newPage({serviceWorkers:'block'});let health=0;
    await guide.route('**/health**',r=>{health++;return r.fulfill({status:503,body:'Sleeping'});});
    await guide.goto(base+'/app/account.html#install');await guide.locator('.first-use-guide').waitFor();
    await guide.waitForTimeout(1600);assert.equal(health,0,'public guide does not wake backend');assert.equal(await guide.locator('iframe').count(),0);
    await guide.close();
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
