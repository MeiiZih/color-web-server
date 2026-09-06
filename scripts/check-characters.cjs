const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.COLORLAB_QA_URL || 'http://127.0.0.1:4180';
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const width of [320,390,1280]) {
      const page = await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
      const errors=[]; page.on('pageerror', e=>errors.push(e.message));
      await page.goto(base+'/app/');
      await page.locator('.swatch .report-character img').last().waitFor();
      for (const [i,key] of ['red','yellow','green','blue'].entries()) {
        const card=page.locator('[data-hue]').nth(i);
        await card.click();
        assert.equal(await card.getAttribute('aria-pressed'),'true');
        await page.waitForFunction(key=>{const img=document.querySelector(`img[src="/assets/characters/${key}.webp"]`);return img?.naturalWidth>0},key);
        assert.equal(await card.locator('img').evaluate(i=>getComputedStyle(i).animationName),'character-greet');
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`tmp/characters-home-${width}.png`,fullPage:true});
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.selected .report-character img').evaluate(i=>getComputedStyle(i).animationName),'none');
      await page.goto(base+'/wake.html?preview=1');
      await page.locator('#wakeCharacter').waitFor();
      assert(await page.locator('#wakeCharacter').evaluate(i=>{const a=i.getBoundingClientRect(),b=i.closest('.mix-stage').getBoundingClientRect();return a.right<=b.right&&a.bottom<=b.bottom&&a.left>=b.left&&a.top>=b.top;}),'wake character fully contained');
      await page.locator('[data-color="leaf"]').click();
      assert.match(await page.locator('#wakeCharacter').getAttribute('src'),/green.webp/);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.locator('#characterMotion').click();
      assert.equal(await page.locator('#wakeCharacter').evaluate(i=>getComputedStyle(i).animationName),'none');
      await page.locator('#characterMotion').click();
      assert.equal(await page.locator('#wakeCharacter').evaluate(i=>getComputedStyle(i).animationName),'character-breathe');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`tmp/characters-wake-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      await page.close(); console.log(`PASS ${base} ${width}: original characters, selection, motion, reduced motion, wake and pause`);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
