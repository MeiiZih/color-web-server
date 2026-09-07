const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {catalogEntry}=require('../Server/services/explore');
const survey=catalogEntry({_id:'111111111111111111111111',testType:'我在色彩學中的MBTI',questions:require('../Server/data/finalSurveyQuestions')});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const record={id:'motion-preview',survey,answers:[0,1,2,3,0,1,2,3,0,1,2,3,0,1,2,3,0,1,2,3],date:new Date().toISOString()};
  await page.addInitScript(r=>localStorage.setItem('colorlab-app-v1:guest',JSON.stringify({records:[r],drafts:{}})),record);
  await page.route('**/api/**',r=>r.fulfill(new URL(r.request().url()).pathname.endsWith('/catalog')?{json:[survey]}:{status:401,json:{message:'guest'}}));
  await page.goto('http://127.0.0.1:4180/app/#result/motion-preview');await page.locator('.result-character-action').first().waitFor();await page.locator('.brand-entry').waitFor({state:'hidden'});
  for(const key of ['red','yellow','green','blue']){
   const button=page.locator(`[data-result-character="${key}"]`),art=button.locator('.character-art');
   assert.equal(await art.evaluate(el=>getComputedStyle(el).animationName),'none');
   await button.click();
   const timing=await art.evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=420;return{duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes().map(f=>({transform:f.transform,easing:f.easing,offset:f.offset})),matrix:getComputedStyle(el).transform};});
   assert.equal(timing.duration,1000);assert.equal(timing.frames.length,3);assert.equal(timing.frames[1].offset,.42);assert.equal(timing.frames[0].easing,'ease-in-out');assert.notEqual(timing.matrix,'none');
   await button.evaluate(el=>{el.click();el.click();});assert.equal(await art.evaluate(el=>el.getAnimations().length),1,'rapid taps do not stack');
   await art.evaluate(el=>{const a=el.getAnimations()[0];a.finish();return a.finished;});await page.waitForFunction(()=>!document.querySelector('.result-characters').dataset.playing);
   assert.equal(await art.evaluate(el=>getComputedStyle(el).transform),'none');
  }
  const button=page.locator('.result-character-action').first();await button.focus();await page.keyboard.press('Enter');assert.equal(await button.locator('.character-art').evaluate(el=>el.getAnimations().length),1);
  await button.locator('.character-art').evaluate(el=>{const a=el.getAnimations()[0];a.finish();return a.finished;});await page.waitForFunction(()=>!document.querySelector('.result-characters').dataset.playing);
  await page.emulateMedia({reducedMotion:'reduce'});await button.click();
  assert.ok(await button.locator('.character-art').evaluate(el=>el.getAnimations().every(a=>a.effect.getTiming().duration===180&&a.effect.getKeyframes().every(f=>!f.transform))));
  assert.deepEqual(errors,[]);console.log('PASS gentle single gesture / no idle overlap / repeated taps / keyboard / reduced motion',width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
