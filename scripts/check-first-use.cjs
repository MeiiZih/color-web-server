const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// First-use guidance stays public; test both browser and installed-app modes.
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [390,1280])for(const standalone of [false,true]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(value=>Object.defineProperty(navigator,'standalone',{value,configurable:true}),standalone);
  await page.goto('http://127.0.0.1:4180/app/account.html#install');
  await page.getByRole('heading',{name:'初次使用 ColorLab'}).waitFor();
  assert.equal(await page.locator('.guide-step').count(),4);
  assert.equal(await page.locator('.guide-devices details').count(),3);
  assert.match(await page.locator('.guide-mode').innerText(),standalone?/獨立 App 模式/:/瀏覽器模式/);
  for(const detail of await page.locator('.guide-devices details').all()){
   await detail.locator('summary').focus();await page.keyboard.press('Enter');assert(await detail.evaluate(d=>d.open));
   assert(await detail.locator('ol').isVisible());
  }
  assert.equal(await page.getByRole('link',{name:'查看全部測驗',exact:true}).getAttribute('href'),'/app/#surveys');
  assert.equal(await page.getByRole('link',{name:'查看我的紀錄',exact:true}).getAttribute('href'),'/app/#history');
  assert.equal(await page.getByRole('link',{name:'回到首頁',exact:true}).getAttribute('href'),'/app/#home');
  assert.equal(await page.getByRole('link',{name:/新版入口|開啟 ColorLab 網站/}).count(),0);
  assert.match(await page.locator('.first-use-guide').innerText(),/訪客紀錄不會在登入後自動搬到帳號/);
  assert.match(await page.locator('.first-use-guide').innerText(),/未完成的進度不會跨裝置同步/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:`tmp/first-use-${width}-${standalone}.png`,fullPage:true});
  console.log(`PASS ${width} standalone=${standalone}: four-step guide, three keyboard device panels, role/storage copy, links, mode, no old entry/overflow/errors`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
