const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.COLORLAB_QA_URL||'http://127.0.0.1:4180';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [320,390,768,1280]) {
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
   await page.goto(base+'/app/#surveys');
   const cover=page.locator('.survey-cover').first();await cover.waitFor();
   assert.equal(await cover.locator('.character-art').count(),4);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const dimensions=await cover.locator('.character-art').evaluateAll(xs=>xs.map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})));
   assert(dimensions.every(d=>Math.abs(d.width-dimensions[0].width)<1&&Math.abs(d.height-dimensions[0].height)<1));
   assert(await page.locator('.survey-card').first().getByRole('link',{name:/開始測驗|繼續作答/}).isVisible());
   assert.equal(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content'),'yes');
   await page.screenshot({path:`tmp/character-cover-${width}.png`,fullPage:true});
   // Inspect a complete loop without waiting in real time; no production data is touched.
   await page.emulateMedia({reducedMotion:'no-preference'});
   const moving=cover.locator('.character-head,.character-arm');
   const frames=await moving.evaluateAll(xs=>xs.map(x=>{const a=x.getAnimations()[0];a.pause();a.effect.updateTiming({delay:0});a.currentTime=900;return getComputedStyle(x).transform;}));
   assert(frames.every(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'));
   await page.close();console.log(`PASS ${width}: cover, equal character scale, limb loops, PWA metadata`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
