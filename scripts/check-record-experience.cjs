// Isolated fixtures: no production accounts, database writes, or real email.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {catalogEntry}=require('../Server/services/explore');
const survey=catalogEntry({_id:'111111111111111111111111',testType:'我在色彩學中的MBTI',questions:require('../Server/data/finalSurveyQuestions')});
const old={id:'old1',legacy:true,cloud:true,title:survey.title,result:'ISFP - green',mbtiResult:'ISFP',colorResult:{primary:['green']},date:'2026-08-16T06:28:00Z',answers:[{question:'1. 舊題目',answer:'C. 原始答案'}]};
const recent={id:'new1',cloud:true,survey,surveyId:survey.id,date:'2026-09-07T00:40:00Z',answers:Array(20).fill(2)};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({survey})=>{sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid');localStorage.setItem('colorlab-app-v1:admin:qa',JSON.stringify({records:[],drafts:{[survey.id]:{version:survey.version,answers:Array(20).fill(2),index:19,key:'11111111-1111-4111-8111-111111111111'}}}));},{survey});
  let failSave=true;
  await page.route('**/api/**',route=>{const req=route.request(),path=new URL(req.url()).pathname;if(req.method()!=='GET')writes.push(path);
   if(path==='/api/explore/catalog')return route.fulfill({json:[survey]});
   if(path==='/api/explore/me')return route.fulfill({json:{id:'qa',role:'admin',name:'QA'}});
   if(path==='/api/explore/records')return route.fulfill(req.method()==='GET'?{json:[recent,old]}:failSave?{status:503,json:{message:'模擬儲存失敗'}}:{json:{...recent,id:'saved'}});
   if(path==='/api/user/register')return route.fulfill({json:{verificationRequired:true,email:'qa@example.invalid',message:'請驗證信箱'}});
   if(path.endsWith('/reflection'))return route.fulfill({json:{choice:req.postDataJSON().choice}});
   return route.fulfill({json:[]});
  });
  await page.goto('http://127.0.0.1:4180/app/#history');await page.locator('.history-entry').first().waitFor();
  assert.equal(await page.locator('.history-art').count(),0);assert.equal(await page.locator('.history-card-unified').count(),2);
  assert.match(await page.locator('[href="#result/old1"]').textContent(),/ISFP/);assert.doesNotMatch(await page.locator('[href="#result/old1"]').textContent(),/歷史紀錄/);
  assert.equal(await page.locator('.record-comparison,[data-compare]').count(),0,'comparison removed; records remain');
  await page.waitForTimeout(850);await page.locator('.history-entry').first().screenshot({path:`tmp/history-card-redesign-${width}.png`});
  assert.equal(await page.locator('.history-portraits img').count(),2);
  await page.locator('[href="#result/old1"]').click();await page.locator('.result-hero').waitFor();assert.match(await page.locator('.result-type').innerText(),/綠色性格.*ISFP/);
  assert.match(await page.locator('.receipt-answer').innerText(),/1. 舊題目/);assert.doesNotMatch(await page.locator('.receipt-answer').innerText(),/1. 1./);
  await page.locator('[data-reflection] button').first().click();await page.locator('[data-reflection] [aria-pressed=true]').waitFor();assert.equal(writes.length,1);writes.length=0;
  assert.equal(await page.locator('.reflection-reply').count(),0);
  assert.equal(await page.locator('.completion-feedback').count(),0,'opening history never celebrates');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`tmp/record-result-${width}.png`,fullPage:true});
  await page.locator('nav a[href="#home"]').click();await page.locator('[data-reflection]').waitFor();await page.getByRole('button',{name:'想慢一點',exact:true}).click();assert.equal(await page.locator('.reflection-reply').count(),0);assert.equal(writes.length,0);
  for(const [label,key] of [['有精神','yellow'],['想慢一點','green'],['想安靜一下','blue'],['還說不上來','red']]){
   await page.getByRole('button',{name:label,exact:true}).click();assert.match(await page.locator('.mood-vignette img').getAttribute('src'),new RegExp(key));
   assert.equal(await page.locator('.mood-vignette').count(),1);assert(await page.locator('.mood-vignette img').evaluate(el=>getComputedStyle(el).animationName!=='none'));
  }
  await page.locator('.mood-scene').screenshot({path:`tmp/mood-scene-${width}.png`});
  assert.equal(await page.locator('[data-mood="3"]').evaluate(el=>getComputedStyle(el).outlineStyle),'none','pointer selection has no heavy focus ring');
  await page.locator('.mood-panel').screenshot({path:`tmp/mood-panel-revised-${width}.png`});
  await page.getByRole('button',{name:'有精神',exact:true}).click();assert.equal(await page.locator('.mood-vignette img').evaluate(el=>getComputedStyle(el).animationName),'mood-lift');
  await page.getByRole('button',{name:'還說不上來',exact:true}).click();assert.equal(await page.locator('.mood-vignette img').evaluate(el=>getComputedStyle(el).animationName),'mood-ponder');
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'有精神',exact:true}).click();assert.equal(await page.locator('.mood-vignette').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(writes.length,0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.hero-cta').click();await page.locator('#next-question').click();await page.getByRole('button',{name:'重新儲存',exact:true}).waitFor();assert.equal(await page.locator('.completion-feedback').count(),0,'failed save never celebrates');
  failSave=false;await page.getByRole('button',{name:'重新儲存',exact:true}).click();await page.locator('.completion-feedback').waitFor();assert.match(await page.locator('.completion-feedback').innerText(),/測驗已完成/);
  assert.match(page.url(),/#test/,'completion precedes result navigation');assert.equal(await page.locator('.result-hero').count(),0);
  assert.equal(await page.locator('.completion-feedback').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(252, 248, 244)');await page.waitForTimeout(280);await page.screenshot({path:`tmp/completion-${width}.png`});
  await page.waitForTimeout(650);assert.equal(await page.locator('.completion-feedback').count(),0);assert.match(page.url(),/#result\/saved/);assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  await page.goto('http://127.0.0.1:4180/app/account.html#register');await page.locator('#register-form').waitFor();
  for(const [name,value] of Object.entries({name:'測試',birthDate:'2000-01-01',email:'qa@example.invalid',password:'test-only-123',confirmPassword:'test-only-123'}))await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name=gender]').selectOption('unknown');await page.locator('[name=consent]').check();await page.locator('#register-form button[type=submit]').click();
  await page.locator('.completion-feedback').waitFor();assert.match(await page.locator('.completion-feedback').innerText(),/帳號建立成功/);assert.match(await page.locator('.completion-feedback').innerText(),/請完成 Email 驗證/);
  assert.match(page.url(),/#register/,'registration completion precedes verification navigation');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.completion-feedback').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.waitForTimeout(850);assert.match(page.url(),/#verification/);assert.equal(await page.locator('.completion-feedback').count(),0);assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  assert.deepEqual(errors,[]);console.log('PASS',width,'unified results, no comparison, reflections, save failure/success, registration, reduced motion');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
