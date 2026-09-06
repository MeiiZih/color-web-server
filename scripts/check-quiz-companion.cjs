const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.COLORLAB_QA_URL||'http://127.0.0.1:4180';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [320,390,768,1280]) {
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Guest-only isolated context: no account cookies or production write requests.
   await page.goto(base+'/app/');
   await page.locator('.hero-cta').click();
   const companion=page.locator('.quiz-companion:visible');
   await companion.waitFor();
   assert.equal(await companion.count(),1);
   assert.equal(await companion.locator('img').count(),4);
   await companion.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
   for(const key of ['red','yellow','green','blue']) assert.equal(await companion.locator(`img[src$="${key}.webp"]`).count(),1);
   for(let i=0;i<6;i++) {
    await page.locator('.option').nth(i%4).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.quiz-companion .is-active img')].some(img=>getComputedStyle(img).animationName==='companion-nod'));
    assert.match(await companion.locator('[data-companion-message]').textContent(),/準備好再按下一題/);
    assert.equal(await page.locator('input[name=answer]:checked').getAttribute('value'),String(i%4));
    await page.locator('#next-question').click();
   }
   assert.match(await companion.locator('.is-active img').getAttribute('src'),/yellow.webp/);
   await page.locator('[data-previous]').click();
   assert.equal(await page.locator('input[name=answer]:checked').getAttribute('value'),'1');
   assert.equal(await page.locator('legend').evaluate(el=>el===document.activeElement),true);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const region=await companion.boundingBox(),choice=await page.locator('.options').boundingBox();
   assert(region.x+region.width<=choice.x || region.y+region.height<=choice.y || choice.x+choice.width<=region.x,'companion does not overlap choices');
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await companion.locator('.is-active img').evaluate(i=>getComputedStyle(i).animationName),'none');
   await page.screenshot({path:`tmp/quiz-companion-${width}.png`,fullPage:true});
   await page.reload();await companion.waitFor();
   assert.match(await page.locator('.question-number').textContent(),/06/);
   assert.equal(await page.locator('input[name=answer]:checked').getAttribute('value'),'1');
   assert.deepEqual(errors,[]);
   console.log(`PASS ${base} ${width}: four characters, progress rotation, answer feedback, back/reload, focus, reduced motion, no overlap`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
