const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  await page.goto('http://127.0.0.1:4185/app/#home');
  const panel=page.locator('.mood-panel'),welcome=page.locator('.mood-welcome');
  await panel.scrollIntoViewIfNeeded();await welcome.locator('[src]').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.mood-welcome')?.hasAttribute('data-entered'));
  await welcome.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  const geometry=await panel.evaluate(el=>{const scene=el.querySelector('.mood-scene').getBoundingClientRect();return{scene:{left:scene.left,right:scene.right,top:scene.top,bottom:scene.bottom},images:[...el.querySelectorAll('.mood-welcome img')].map(img=>{const r=img.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,loaded:img.complete&&img.naturalWidth>0};})};});
  assert.equal(geometry.images.length,4);
  for(const image of geometry.images){assert.ok(image.loaded);assert.ok(image.left>=geometry.scene.left-.5&&image.right<=geometry.scene.right+.5);assert.ok(image.top>=geometry.scene.top&&image.bottom<=geometry.scene.bottom);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.match(await panel.evaluate(el=>getComputedStyle(el,'::before').backgroundImage),/crayon-b.webp/);
  await panel.screenshot({path:`tmp/mood-stage-${width}.png`});
  for(const label of ['有精神','想慢一點','想安靜一下','還說不上來']){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.mood-vignette img').count(),1);}
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await panel.scrollIntoViewIfNeeded();
  assert.equal(await welcome.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  console.log('PASS stage containment, original art, B texture, choices, reduced motion',width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
