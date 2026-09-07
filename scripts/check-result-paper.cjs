const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {catalogEntry}=require('../Server/services/explore');
const survey=catalogEntry({_id:'111111111111111111111111',testType:'我在色彩學中的MBTI',questions:require('../Server/data/finalSurveyQuestions')});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const record={id:'paper-preview',survey,answers:[...Array(6).fill(0),...Array(6).fill(1),...Array(5).fill(2),...Array(3).fill(3)],date:new Date().toISOString()};
  await page.addInitScript(record=>localStorage.setItem('colorlab-app-v1:guest',JSON.stringify({records:[record],drafts:{}})),record);
  await page.route('**/api/**',route=>route.fulfill(new URL(route.request().url()).pathname.endsWith('/catalog')?{json:[survey]}:{status:401,json:{message:'guest'}}));
  await page.goto('http://127.0.0.1:4180/app/#result/paper-preview');await page.locator('.result-color-wash').waitFor({state:'attached'});
  await page.locator('.brand-entry').waitFor({state:'hidden'});
  await page.locator('.result-hero').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  assert.equal(await page.locator('.result-hero h1').textContent(),'紅色、黃色共同呈現');assert.equal(await page.locator('.result-intro').count(),2);
  const widths=await page.locator('.result-color-wash').evaluate(el=>[...el.children].map(c=>c.getBoundingClientRect().width/el.getBoundingClientRect().width));
  widths.forEach((n,i)=>assert.ok(Math.abs(n-[.3,.3,.25,.15][i])<.005));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.result-hero').screenshot({path:`tmp/result-paper-${width}.png`});
  await page.locator('[data-choice="other"]').click();await page.locator('.reflection-other textarea').fill('我想多認識自己一點。');
  await page.locator('[data-reflection]').screenshot({path:`tmp/result-other-${width}.png`});
  console.log('PASS result paper / tied colors / proportional widths / other form',width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
