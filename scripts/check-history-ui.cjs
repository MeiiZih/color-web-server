const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const records=Array.from({length:251},(_,i)=>({id:(1000+i).toString(16).padStart(24,'0'),date:new Date(Date.UTC(2026,8,7-i)).toISOString(),cloud:true,legacy:true,title:'日期測試 '+i,result:'ISFP',mbtiResult:'ISFP',colorResult:{primary:['green']},answers:[]}));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],reads=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid'));
  await page.route('**/api/explore/me',r=>r.fulfill({json:{id:'qa-admin',role:'admin',email:'admin@example.invalid',name:'Admin'}}));
  await page.route('**/api/explore/records*',r=>{const u=new URL(r.request().url());reads.push(u.search);return r.fulfill({json:u.search?records.slice(200):records.slice(0,200)});});
  await page.goto('http://127.0.0.1:4180/app/#history');await page.locator('.history-heading').filter({hasText:'251 份'}).waitFor();
  assert.equal(reads.length,2);assert.equal(await page.locator('[data-legacy-import]').count(),0);
  assert.equal(await page.locator('.history-entry').count(),20);
  await page.locator('[name=size]').selectOption('50');assert.equal(await page.locator('.history-entry').count(),50);
  await page.getByRole('button',{name:'下一頁',exact:true}).click();assert.match(await page.locator('.history-pagination').innerText(),/第 2/);
  await page.locator('.history-card').nth(3).scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await page.locator('.history-card').nth(3).click();await page.locator('.result-section').waitFor();
  await page.locator('main>a,main .text-button').filter({hasText:'測驗紀錄'}).first().click();await page.locator('.history-pagination').waitFor();
  assert.match(await page.locator('.history-pagination').innerText(),/第 2/);assert.equal(reads.length,2);
  assert(Math.abs(await page.evaluate(()=>scrollY)-scroll)<100,'return restores scroll');
  await page.locator('[name=size]').selectOption('all');assert.equal(await page.locator('.history-entry').count(),251);
  await page.locator('[name=range]').selectOption('custom');await page.locator('[name=from]').fill('2026-09-05');await page.locator('[name=from]').blur();await page.locator('[name=to]').fill('2026-09-07');await page.locator('[name=to]').blur();
  assert.equal(await page.locator('.history-entry').count(),3);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`tmp/history-new-${width}.png`,fullPage:true});
  await page.goto('http://127.0.0.1:4180/app/#home');await page.locator('.first-use-link').waitFor();
  assert.equal(await page.locator('.first-visit').count(),0);assert.equal(await page.locator('.organized-footer>div,.organized-footer>nav').count(),3);
  await page.locator('.organized-footer').screenshot({path:`tmp/footer-new-${width}.png`});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: 251 records, sizes, months, dates, retained filters/page/scroll, no refetch, footer/help`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
