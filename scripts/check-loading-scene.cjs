const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const css=await fs.readFile('color-web/app/motion.css','utf8');
 const html=await fs.readFile('color-web/app/index.html','utf8');
 const scene=html.match(/<div class="exploration-loading"[\s\S]*?<\/main>/)[0].replace('</main>','');
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.setContent(`<style>${css}</style><header>ColorLab</header><main>${scene}</main>`);
  const rect=await page.locator('.loading-scene').boundingBox();
  assert(Math.abs(rect.x+rect.width/2-width/2)<2);assert(Math.abs(rect.y+rect.height/2-462)<2);
  assert.equal(await page.locator('.loading-colors i').count(),4);
  assert.equal(await page.locator('.loading-colors').evaluate(e=>e.getAnimations({subtree:true}).length),4);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`tmp/loading-scene-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.loading-colors').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await page.evaluate(()=>{document.querySelector('main').innerHTML='<h1>已準備好的內容</h1>';});
  assert.equal(await page.locator('.loading-scene').count(),0);
  console.log(JSON.stringify({width,centered:true,reducedMotion:true,removedOnReady:true}));await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
