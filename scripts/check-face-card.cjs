// Local fixtures only: no production requests or account writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4180/app/#home');
   const card=page.locator('[data-hue]').first();await card.waitFor();
   for(let n=0;n<3;n++){
    await card.click();await page.locator('.color-detail-dialog[open]').waitFor();
    assert.equal(await card.evaluate(e=>getComputedStyle(e).visibility),'hidden');
    assert.equal(await page.locator('dialog').evaluate(e=>getComputedStyle(e).opacity),'1');
    await page.screenshot({path:`tmp/card-repair-${width}.png`});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-hue]')).visibility==='visible');
    assert.equal(await card.evaluate(e=>e===document.activeElement),true);
   }
   await page.emulateMedia({reducedMotion:'reduce'});await card.click();
   await page.locator('dialog[open]').waitFor();
   assert.equal(await page.locator('dialog').evaluate(e=>getComputedStyle(e).animationName),'none');
   await page.goto('http://127.0.0.1:4180/wake.html?preview=1');
   assert.equal(await page.locator('#characterMotion').count(),0);
   await page.locator('[data-color="sun"]').click();
   assert.equal(await page.locator('[data-color="sun"]').getAttribute('aria-pressed'),'true');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.goto('http://127.0.0.1:4182/face.html');
   assert.equal(await page.locator('svg image').count(),1);
   const before=await page.locator('#eye-left').getAttribute('d');
   await page.locator('#smile').click();await page.waitForTimeout(450);
   assert.notEqual(await page.locator('#eye-left').getAttribute('d'),before);
   await page.screenshot({path:`tmp/face-repair-${width}.png`});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>document.querySelector('#eye-left').getAttribute('d')==='M166 139 Q166 129 166 139');
   const eye=await page.locator('#eye-left').getAttribute('d');await page.waitForTimeout(350);
   assert.equal(await page.locator('#eye-left').getAttribute('d'),eye);
   assert.deepEqual(errors,[]);console.log(`PASS ${width}: card reopen/Escape/focus/opacity, wake controls, face response and reduced motion`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
