const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [320,390,1280]){
 const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',reducedMotion:'reduce'});let writes=0;
 await context.addInitScript(()=>{if(localStorage.getItem('qa-signout-seeded'))return;localStorage.setItem('qa-signout-seeded','true');for(const store of [sessionStorage,localStorage]){store.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid');store.setItem('adminEmail','admin@example.test');}localStorage.setItem('colorlab-app-v1:admin:qa','preserve my draft');});
 await context.route('**/api/**',route=>{if(route.request().method()!=='GET'){writes++;return route.abort();}return route.fulfill({contentType:'application/json',body:'{}'});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4180/app/account.html#admin');await page.getByRole('heading',{name:'照顧每一次探索。'}).waitFor();
 const header=page.locator('[data-header-signout]');assert(await header.isVisible());assert.equal(await header.getAttribute('aria-label'),'登出管理帳號');
 const box=await header.boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.y<80);
 const brand=await page.locator('.brand').boundingBox();if(width<960){const menu=await page.locator('#menu-toggle').boundingBox();assert(brand.x+brand.width<=menu.x);assert(!await page.locator('#studio-nav').isVisible());await page.locator('#menu-toggle').click();}
 assert(await page.locator('#studio-nav [data-signout]').isVisible());
 await page.screenshot({path:`tmp/admin-signout-${width}.png`});
 await page.goto('http://127.0.0.1:4180/app/account.html#content-edit/new');await page.locator('#content-form').waitFor();await page.locator('[name=title]').fill('未儲存測試');
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-header-signout]').click();assert(await page.evaluate(()=>!!sessionStorage.getItem('adminToken')));assert.equal(await page.locator('[name=title]').inputValue(),'未儲存測試');
 page.once('dialog',dialog=>dialog.accept());await page.locator('[data-header-signout]').click();await page.locator('#login-form').waitFor();
 assert.equal(await page.locator('[data-header-signout]').count(),0);
 assert(await page.evaluate(()=>!sessionStorage.getItem('adminToken')&&!localStorage.getItem('adminToken')&&!localStorage.getItem('adminEmail')));
 assert.equal(await page.evaluate(()=>localStorage.getItem('colorlab-app-v1:admin:qa')),'preserve my draft');assert.equal(writes,0);assert.deepEqual(errors,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log(`PASS ${width}: visible header/menu signout, dirty cancel preserves auth, confirm clears session only, login destination, no writes/errors`);await context.close();
}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
