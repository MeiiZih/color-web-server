const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const feed=require('../Server/data/publicMentalHealth20260906.json');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/homepage',r=>r.fulfill({json:feed.map(a=>({...a,expiresAt:null}))}));
  await page.addInitScript(()=>sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid'));
  await page.route('**/api/explore/me',r=>r.fulfill({json:{role:'admin',name:'Admin',email:'qa@example.invalid'}}));
  await page.goto('http://127.0.0.1:4180/app/#home');await page.locator('.first-use-link').waitFor();
  assert(await page.locator('.first-use-link').evaluate(e=>{const a=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return Math.abs(a.x+a.width/2-p.x-p.width/2)<2;}));
  assert.equal(await page.locator('.footer-companions img').count(),4);
  assert(await page.locator('.source-note>span').count()>4);
  const wrapped=await page.locator('.source-note>span').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().height>parseFloat(getComputedStyle(x).lineHeight)+1).map(x=>({text:x.textContent,width:x.clientWidth,height:x.clientHeight})));
  assert.deepEqual(wrapped,[],'metadata each fits a line');
  await page.locator('.first-use-link').screenshot({path:`tmp/first-use-refined-${width}.png`});
  await page.locator('.article-card').first().screenshot({path:`tmp/source-refined-${width}.png`});
  await page.evaluate(()=>location.hash='me');await page.locator('[data-logout]').waitFor();
  assert(await page.locator('[data-logout]').evaluate(e=>{const a=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return Math.abs(a.x+a.width/2-p.x-p.width/2)<2;}));
  await page.goto('http://127.0.0.1:4180/app/account.html#users');await page.locator('.refresh-view').waitFor();
  assert(await page.locator('.refresh-view').evaluate(e=>{const a=e.getBoundingClientRect(),h=e.parentElement.querySelector('h1').getBoundingClientRect();return a.height>=44&&(a.left>=h.right||a.top>=h.bottom);}));
  await page.locator('.page-intro').screenshot({path:`tmp/refresh-refined-${width}.png`});
  await page.locator('.refresh-view').click();await page.locator('.refresh-view').waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  console.log('PASS',width,'centered help/logout, separate metadata lines, original footer art, accessible refresh placement/action');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
