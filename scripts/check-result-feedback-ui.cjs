const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {catalogEntry}=require('../Server/services/explore');
const survey=catalogEntry({_id:'111111111111111111111111',testType:'我在色彩學中的MBTI',questions:require('../Server/data/finalSurveyQuestions')});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const cloud of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const record={id:'111111111111111111111112',survey,surveyId:survey.id,cloud,answers:Array(20).fill(2),date:new Date().toISOString()};
  let failing=true,bodies=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({record,cloud})=>{
   if(cloud)sessionStorage.setItem('userToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid');
   if(!localStorage.getItem('colorlab-app-v1:guest'))localStorage.setItem('colorlab-app-v1:guest',JSON.stringify({records:[record],drafts:{}}));
  },{record,cloud});
  await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path.endsWith('/catalog'))return route.fulfill({json:[survey]});
   if(path.endsWith('/me'))return route.fulfill(cloud?{json:{id:'qa',role:'user'}}:{status:401,json:{message:'guest'}});
   if(path.endsWith('/records'))return route.fulfill({json:cloud?[record]:[]});
   if(path.endsWith('/reflection')||path.endsWith('/guest-result-feedback')){
    const body=req.postDataJSON();bodies.push(body);
    if(failing)return route.fulfill({status:503,json:{message:'回饋未儲存，請再試一次。'}});
    record.reflection={choice:body.choice,...(body.choice==='other'?{text:body.text}:{})};return route.fulfill({json:record.reflection});
   }
   return route.fulfill({json:[]});
  });
  await page.goto('http://127.0.0.1:4180/app/#result/'+record.id);
  const option=page.locator('[data-choice="green"]');await option.waitFor();await option.click();
  await page.locator('.reflection-error').waitFor();assert.equal(await option.getAttribute('aria-pressed'),'false');
  failing=false;await option.click();await page.locator('[data-choice="green"][aria-pressed=true]').waitFor();assert.equal(await page.locator('.reflection-error,.reflection-reply').count(),0);
  if(!cloud){assert.deepEqual(Object.keys(bodies[1]).sort(),['choice','key','surveyId']);assert.equal(bodies[0].key,bodies[1].key);assert.match(bodies[1].key,/^[a-f0-9]{64}$/);}
  else assert.deepEqual(bodies[1],{choice:'green'});
  await page.reload();await page.locator('[data-choice="green"][aria-pressed=true]').waitFor();
  await page.locator('[data-choice="none"]').click();await page.locator('[data-choice="none"][aria-pressed=true]').waitFor();
  if(!cloud)assert.equal(bodies[2].key,bodies[1].key);
  const before=bodies.length;await page.locator('[data-choice="other"]').click();
  const text='<img src=x onerror=alert(1)> 我想慢慢認識自己';
  await page.locator('.reflection-other textarea').fill(text);assert.equal(bodies.length,before,'typing does not transmit text');
  await page.getByRole('button',{name:'送出回覆'}).click();await page.locator('[data-choice="other"][aria-pressed=true]').waitFor();
  assert.equal(bodies.length,before+1);assert.equal(bodies.at(-1).text,text);
  await page.reload();await page.locator('[data-choice="other"][aria-pressed=true]').waitFor();
  assert.equal(await page.locator('.reflection-other textarea').inputValue(),text);assert.equal(await page.locator('.reflection-other img').count(),0);
  await page.locator('.reflection-other textarea').fill('   ');await page.getByRole('button',{name:'送出回覆'}).click();assert.equal(bodies.length,before+1);
  assert.deepEqual(errors,[]);console.log('PASS',cloud?'account':'guest','failed save, retry, minimal payload, retained choice, replacement');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
