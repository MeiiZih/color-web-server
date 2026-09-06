const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});let writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>{if(route.request().method()!=='GET')writes++;return route.abort();});
 await page.goto('http://127.0.0.1:4180/app/account.html#login');await page.locator('#login-form').waitFor();
 assert.equal(await page.locator('#login-form [type=submit]').innerText(),'登入會員帳號');assert.equal(await page.locator('a[href="#verification"]').count(),0);
 const help=page.locator('.auth-help a');assert.equal(await help.getAttribute('href'),'#forgot-password');assert(!await help.evaluate(el=>el.classList.contains('button')));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`tmp/login-actions-${width}.png`,fullPage:true});
 await help.click();await page.locator('#forgot-password-form').waitFor();
 await page.goto('http://127.0.0.1:4180/app/account.html#admin-login');await page.locator('#login-form').waitFor();assert.equal(await page.locator('#login-form [type=submit]').innerText(),'登入管理工作室');assert.equal(await page.locator('a[href="#verification"]').count(),0);assert.equal(await page.locator('.auth-help a').getAttribute('href'),'#admin-forgot-password');
 assert.equal(writes,0);assert.deepEqual(errors,[]);console.log(`PASS ${width}: separate login labels, no resend link, correct recovery routes, no writes/errors/overflow`);await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
