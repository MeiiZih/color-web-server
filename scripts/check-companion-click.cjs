// Local fixture regression. Run with scripts/preview-static.cjs listening on 4180.
// Source overrides test current edits without deploying or writing account data.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width,height] of [[390,844],[1280,844],[320,667]]) {
      const page = await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      for(const file of ['app.js','characters.css','character-art.mjs','companion-interaction.mjs','history-view.mjs']) {
        await page.route('**/app/'+file, async route=>route.fulfill({body:await fs.readFile(path.resolve('color-web/app',file),'utf8'),contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
      }
      await page.goto('http://127.0.0.1:4180/app/#test/111111111111111111111111', {waitUntil:'domcontentloaded'});
      const stage=page.locator(width<768?'.companion-mobile':'.companion-desktop');
      await stage.locator('[data-companion]').first().waitFor();
      assert.equal(await stage.locator('.companion-flame-burst').count(),0);
      assert.equal(await stage.locator('[data-companion="yellow"] svg>ellipse, [data-companion="yellow"] .character-arm, [data-companion="yellow"] mask').count(),0);
      assert.equal(await stage.locator('[data-companion="yellow"] image').count(),1);
      assert.equal(await stage.locator('[data-companion="yellow"] image').getAttribute('href'),'/assets/characters/yellow.webp');
      assert.equal(await stage.locator('filter').count(),0);
      await page.screenshot({path:`tmp/companion-${width}-idle.png`});
      await page.evaluate(()=>window.castBefore=[...document.querySelectorAll('[data-companion]')]);
      for(const key of ['red','yellow','green','blue']) {
        const button=stage.locator(`[data-companion="${key}"]`);
        const box=await button.boundingBox();assert(box.width>=44&&box.height>=44);
        const answerBefore=await page.locator('input[name="answer"]:checked').count();
        const questionBefore=await page.locator('.question-area').evaluate(e=>({top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight}));
        await button.click();
        assert(await button.evaluate(e=>e.classList.contains('is-greeting')));
        await page.waitForTimeout(650);
        const bubble=await stage.locator('.companion-reply').boundingBox();
        assert(bubble.x>=0&&bubble.x+bubble.width<=width, 'reply stays on screen');
        const selectedBox=await button.boundingBox();
        assert(bubble.y+bubble.height<=selectedBox.y, 'reply sits above the selected character');
        const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
        for(const peer of await stage.locator('[data-companion]').all()) assert(!overlaps(bubble,await peer.boundingBox()),'reply does not overlap another character');
        for(const control of await page.locator('.question-text,.option,.question-actions').all()) assert(!overlaps(bubble,await control.boundingBox()),'reply does not cover a question or action');
        assert.deepEqual(await page.locator('.question-area').evaluate(e=>({top:e.getBoundingClientRect().top+scrollY,height:e.offsetHeight})),questionBefore,'greeting does not shift the page');
        await page.screenshot({path:`tmp/companion-${width}-${key}.png`});
        assert.notEqual(await button.locator('.report-character').evaluate(e=>getComputedStyle(e).transform),'none');
        await button.evaluate(e=>e.click());
        assert.equal(await stage.locator('.is-greeting').count(),1);
        await page.waitForTimeout(1450);
        assert.equal(await stage.locator('.is-greeting').count(),0);
        assert.equal(await page.locator('input[name="answer"]:checked').count(),answerBefore);
      }
      await stage.locator('[data-companion="red"]').click();
      await stage.locator('[data-companion="red"] .report-character').evaluate(e=>window.greetBefore=e.getAnimations()[0]);
      await page.locator('.option').first().click();
      await page.locator('#next-question').click();
      assert(await page.evaluate(()=>window.castBefore.every((e,i)=>e===document.querySelectorAll('[data-companion]')[i])));
      assert(await stage.locator('[data-companion="red"] .report-character').evaluate(e=>e.getAnimations()[0]===window.greetBefore));
      await page.waitForTimeout(2100);
      await stage.locator('[data-companion="yellow"]').focus();await page.keyboard.press('Enter');
      assert.equal(await stage.locator('.is-greeting').count(),1);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(100);
      assert.equal(await stage.locator('.is-greeting').count(),0);
      await stage.locator('[data-companion="blue"]').click();
      assert(await stage.locator('.companion-reply').innerText());
      assert.equal(await stage.locator('[data-companion="blue"] .report-character').evaluate(e=>e.getAnimations().length),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.goto('http://127.0.0.1:4180/app/#home', {waitUntil:'domcontentloaded'});
      await page.locator('[data-hue]').first().waitFor();
      assert.equal(await page.locator('.character-motion-toggle,[data-character-toggle]').count(),0);
      assert.equal(await page.locator('.character-art').first().evaluate(e=>getComputedStyle(e).animationName),'none');
      await page.goto('http://127.0.0.1:4180/wake.html?preview=1', {waitUntil:'domcontentloaded'});
      await page.locator('.mix-stage').waitFor();
      assert.equal(await page.locator('#characterMotion,[data-character-toggle]').count(),0);
      assert.equal(await page.getByRole('button',{name:/暫停.*動畫/}).count(),0);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}: original artwork without synthetic limbs/flames, anchored replies without overlap/layout shift, 4 click actions, no stacking, 44px targets, keyboard, next-question animation retained, reduced motion, no answer changes/errors/overflow; home/wake pause buttons absent`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
