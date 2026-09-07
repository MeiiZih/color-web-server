const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const source=await fs.readFile(path.resolve(__dirname,'../color-web/app/navigation-motion.mjs'),'utf8');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});
    await page.setContent('<!doctype html><style>body{margin:0}main{min-height:1400px;transform:translateX(3px)}.question-actions{position:fixed;bottom:0;left:0;padding:12px}</style><main tabindex="-1"><h1>已準備的頁面</h1><button>選擇</button></main>');
    await page.evaluate(async code=>{const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const {createNavigationMotion}=await import(url);URL.revokeObjectURL(url);window.motion=createNavigationMotion(document.querySelector('main'));},source);
    assert(await page.evaluate(()=>motion.commit('#home')===null),'initial render is not an extra transition');
    const first=await page.evaluate(()=>{const main=document.querySelector('main');main.focus({preventScroll:true});scrollTo(0,100);window.beforeTop=scrollY;window.first=motion.commit('#surveys');return {frames:first.effect.getKeyframes(),duration:first.effect.getTiming().duration,focused:document.activeElement===main,top:scrollY,style:main.getAttribute('style')};});
    assert.equal(first.duration,width<768?360:320);assert.equal(first.focused,true);assert.equal(first.top,100);assert.equal(first.style,null);
    assert(first.frames[0].transform.includes('matrix(1, 0, 0, 1, 3, 0)'),'preserves existing transform');
    assert.equal(Number(first.frames[0].opacity),width<768?.72:.86);
    const cancel=await page.evaluate(()=>{window.second=motion.commit('#me');return first.playState;});assert.equal(cancel,'idle','rapid nav cancels old animation');
    assert(await page.evaluate(()=>{const next=motion.commit('#me');return next===null&&second.playState==='idle';}),'same-route refresh never replays');
    const retained=await page.evaluate(()=>{const animation=motion.commit('#home',{restored:true});return animation?animation.effect.getKeyframes()[0].transform:null;});
    if(width<768)assert.match(retained,/translateX\(-32px\)/,'cached mobile tab returns with reverse movement');else assert.match(retained,/translateY\(14px\)/,'cached desktop tabs retain entrance');
    assert(await page.evaluate(()=>motion.commit('#surveys',{restored:true})!==null),'home to cached survey list always animates');
    const quiz=await page.evaluate(()=>{motion.cancel();const main=document.querySelector('main');main.style.transform='none';main.innerHTML='<div class="test-topline">作答頁</div><div class="quiz-companion">原稿角色</div><form id="question-form">第一題</form><div class="question-actions">下一題</div>';const controls=document.querySelector('.question-actions');const before=controls.getBoundingClientRect().bottom;const animation=motion.commit('#test/color');return {target:animation.effect.target.className,bottom:controls.getBoundingClientRect().bottom,before,mainAnimation:main.getAnimations().length,cast:document.querySelector('.quiz-companion').getAnimations().length};});
    assert.equal(quiz.target,'test-topline');assert.equal(quiz.bottom,quiz.before);assert.equal(quiz.mainAnimation,0);assert.equal(quiz.cast,0);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert(await page.evaluate(()=>motion.commit('#history')===null),'reduced motion stays static');
    await page.emulateMedia({reducedMotion:'no-preference'});
    const finish=await page.evaluate(async()=>{const main=document.querySelector('main');const animation=motion.commit('#statistics');await animation.finished;return {transform:getComputedStyle(main).transform,opacity:getComputedStyle(main).opacity};});
    assert.deepEqual(finish,{transform:'none',opacity:'1'});
    await page.evaluate(()=>motion.destroy());await page.close();
    const integrated=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});let reads=0;
    integrated.on('request',r=>{if(r.url().includes('/api/'))reads++;});
    await integrated.goto('http://127.0.0.1:4185/app/#home');await integrated.locator('.hero-cta').waitFor();await integrated.waitForTimeout(800);
    const initialReads=reads;
    for(const route of ['surveys','home','surveys','home']){
      await integrated.locator(`nav a[href="#${route}"]`).click();
      await integrated.waitForFunction(expected=>document.body.dataset.page===expected,route);
      assert(await integrated.locator('main').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),`${route} has a real page entrance, including cached returns`);
      await integrated.waitForTimeout(400);
    }
    assert.equal(reads,initialReads,'repeated home/survey navigation does not refetch data');await integrated.close();
    console.log(JSON.stringify({width,initial:'static',retained:width<768?'directional':'settle',refresh:'static',quickNav:'cancels',quizFixedControls:'unchanged',reducedMotion:'static',homeSurveys:'all animate without refetch'}));
  }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
