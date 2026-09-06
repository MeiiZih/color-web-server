const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const code=await fs.readFile(path.resolve(__dirname,'../color-web/app/quiz-feedback.mjs'),'utf8');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});
    await page.setContent('<form><label class="option"><input type="radio" name="answer" value="0">選項 A<span class="option-check">✓</span></label><label class="option"><input type="radio" name="answer" value="1">選項 B<span class="option-check">✓</span></label><button type="button" id="previous">上一題</button><button id="next">下一題</button></form>');
    await page.evaluate(async code=>{
      const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const {createQuizFeedback}=await import(url);URL.revokeObjectURL(url);
      window.soundStarts=0;window.saves=0;
      class Audio extends AudioContext{createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{soundStarts++;return start(...args);};return node;}}
      window.feedback=createQuizFeedback({AudioContext:Audio,performance,navigator,matchMedia:window.matchMedia.bind(window)});
      document.querySelector('form').onchange=e=>{saves++;feedback.play('answer',e,e.target.closest('.option'));};
      document.querySelector('form').onsubmit=e=>{e.preventDefault();saves++;feedback.play('next',e,document.querySelector('#next'));};
      document.querySelector('#previous').onclick=e=>{saves++;feedback.play('previous',e,e.target);};
    },code);
    assert.equal(await page.evaluate(()=>soundStarts),0,'render never starts audio');
    await page.locator('input[value="0"]').check();await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>soundStarts),1,'trusted answer gesture starts one short tone');
    await page.locator('input[value="0"]').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>soundStarts),2,'keyboard answer change works');
    await page.locator('#next').focus();await page.keyboard.press('Enter');await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>soundStarts),3,'keyboard next works');
    await page.locator('#previous').click();await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>soundStarts),4,'previous click works');
    await page.evaluate(()=>document.querySelector('input').dispatchEvent(new Event('change',{bubbles:true})));
    assert.equal(await page.evaluate(()=>soundStarts),4,'synthetic state change stays silent');
    assert.equal(await page.evaluate(()=>saves),5,'feedback does not replace state handling');
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#next').click();
    assert.equal(await page.locator('#next').evaluate(el=>el.getAnimations().length),0,'reduced motion skips local pulse');
    await page.evaluate(()=>feedback.dispose());await page.close();
    console.log(JSON.stringify({width,gestureAudio:'passed',keyboard:'passed',synthetic:'silent',reducedMotion:'static'}));
  }
  // Exercise the actual app handlers too, without completing or submitting a record.
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.soundStarts=0;
    const Audio=window.AudioContext;
    window.AudioContext=class extends Audio{createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{window.soundStarts++;return start(...args);};return node;}};
  });
  await page.route('**/api/**',async route=>{
    if(route.request().method()!=='GET')throw Error('Unexpected backend write during feedback test');
    await route.continue();
  });
  await page.goto(process.env.COLORLAB_QA_URL||'http://127.0.0.1:4180/app/');
  await page.locator('.hero-cta').click();await page.locator('#question-form').waitFor();
  assert.equal(await page.evaluate(()=>soundStarts),0);
  await page.locator('.option').first().click();await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>soundStarts),1);
  await page.locator('#next-question').click();await page.waitForTimeout(180);
  assert.match(await page.locator('.question-number').textContent(),/02/);
  assert.equal(await page.evaluate(()=>soundStarts),2);
  await page.locator('[data-previous]').click();await page.waitForTimeout(180);
  assert.match(await page.locator('.question-number').textContent(),/01/);
  assert.equal(await page.locator('input[name="answer"]:checked').count(),1);
  assert.equal(await page.evaluate(()=>soundStarts),3);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS actual guest quiz selection, next, previous, saved choice and gesture audio');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
