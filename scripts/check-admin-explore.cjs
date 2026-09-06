// Browser-local mock roundtrip; never submits to real accounts or databases.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const survey={id:'111111111111111111111111',version:'v1',title:'管理員自用測驗',description:'本機測試',resultType:'receipt',category:'探索',color:'blue',questions:[{question:'今天的步調？',options:['慢慢來','很有活力']} ]};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
   const adminToken='qa.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.local-only';
   let records=[],saved=0,deleted=0,userProfileRequests=0; const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(token=>sessionStorage.setItem('adminToken',token),adminToken);
   await page.route('**/api/explore/**',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.pathname.endsWith('/catalog'))return route.fulfill({json:[survey]});
    assert.equal(request.headers().authorization,'Bearer '+adminToken);
    if(url.pathname.endsWith('/me'))return route.fulfill({json:{id:'222222222222222222222222',role:'admin',name:'測試管理員',email:'qa@example.invalid'}});
    if(method==='POST'){const body=request.postDataJSON();assert.equal(body.surveyId,survey.id);assert.deepEqual(body.answers,[0]);saved++;records=[{...body,id:'333333333333333333333333',date:new Date().toISOString(),survey,cloud:true}];return route.fulfill({status:201,json:records[0]});}
    if(method==='DELETE'){deleted++;records=[];return route.fulfill({json:{deleted:true}});}
    return route.fulfill({json:records});
   });
   await page.route('**/api/homepage',route=>route.fulfill({json:[]}));
   await page.route('**/api/user/profile',route=>{userProfileRequests++;return route.fulfill({status:403,json:{message:'Not a member'}});});
   await page.goto('http://127.0.0.1:4180/app/#me');
   await page.getByRole('heading',{name:'嗨，測試管理員'}).waitFor();
   assert.equal(await page.locator('.verification-panel').count(),0);
   assert.match(await page.locator('.profile-page').innerText(),/管理員自己的紀錄/);
   await page.evaluate(id=>{location.hash='test/'+id;},survey.id);
   await page.locator('.option').first().click();await page.locator('#next-question').click();
   await page.getByRole('heading',{name:'問卷已完成'}).waitFor();assert.equal(saved,1);
   assert.match(await page.locator('main').innerText(),/已儲存至你的帳號/);
   assert(await page.evaluate(()=>Object.keys(localStorage).includes('colorlab-app-v1:admin:222222222222222222222222')));
   await page.evaluate(()=>{location.hash='history';});await page.locator('[data-delete-record]').click();
   await page.locator('[data-confirm-delete]').click();
   await page.getByRole('heading',{name:'第一頁，等你來寫。'}).waitFor();assert.equal(deleted,1);
   assert.equal(userProfileRequests,0);assert.deepEqual(errors,[]);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log(`PASS ${width}: admin identity, cloud save/list/delete, isolated storage, no member verification/overflow/errors`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
