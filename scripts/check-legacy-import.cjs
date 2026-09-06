// Local browser fixtures only. Requires preview-static.cjs on 127.0.0.1:4180.
// No real credentials, old records, production API calls or database writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:4180';
const survey = {id:'111111111111111111111111',version:'v1',title:'本機問卷',resultType:'receipt',questions:[{question:'測試題目',options:['一','二']}]};
const candidates = Array.from({length:11},(_,i)=>({sourceRecordId:String(i+1).padStart(24,'0'),title:'舊測驗 '+(i+1),date:'2025-11-01T00:00:00Z',result:'原始結果',alreadyImported:i===0}));
const snapshot = 'local-fixture-snapshot-not-a-secret';

async function fixture(browser, width, role) {
  const page = await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const token='qa.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.invalid';
  const state={previewGets:0,posts:[],recordGets:0,records:[],getMode:'normal',postMode:'ok',holdPost:false,releasePost:null,failRefresh:false,errors:[]};
  page.on('pageerror',e=>state.errors.push(e.message));
  if(role!=='guest')await page.addInitScript(({token,role})=>sessionStorage.setItem(role==='admin'?'adminToken':'userToken',token),{token,role});
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    assert.equal(url.origin,origin,'Tests must never call a production API');
    if(url.pathname==='/api/homepage')return route.fulfill({json:[]});
    if(url.pathname==='/api/explore/catalog')return route.fulfill({json:[survey]});
    if(url.pathname.startsWith('/api/explore/'))assert.equal(req.headers().authorization,'Bearer '+token);
    if(url.pathname==='/api/explore/me')return route.fulfill({json:{id:'222222222222222222222222',role,name:'本機帳號',email:'fixture@example.invalid'}});
    if(url.pathname==='/api/explore/records/legacy-import'){
      if(req.method()==='GET'){
        state.previewGets++;
        if(state.getMode==='error')return route.fulfill({status:503,json:{message:'本機預覽暫時失敗'}});
        const list=state.getMode==='empty'?[]:candidates;
        return route.fulfill({json:{snapshot,total:list.length,pendingCount:list.filter(r=>!r.alreadyImported).length,candidates:list}});
      }
      assert.equal(req.method(),'POST');
      const body=req.postDataJSON();state.posts.push(body);
      if(state.holdPost)await new Promise(resolve=>{state.releasePost=resolve;});
      if(state.postMode==='error')return route.fulfill({status:409,json:{message:'本機舊資料已變更'}});
      state.records=body.sourceRecordIds.map((id,i)=>({id:'9'+String(i+1).padStart(23,'0'),cloud:true,legacy:true,date:'2025-11-01T00:00:00Z',title:'已同步舊測驗 '+id,result:'原始結果',answers:[]}));
      return route.fulfill({json:{imported:body.sourceRecordIds.length,alreadyImported:0}});
    }
    if(url.pathname==='/api/explore/records'){
      assert.equal(req.method(),'GET');state.recordGets++;
      if(state.failRefresh&&state.records.length){state.failRefresh=false;return route.fulfill({status:503,json:{message:'本機清單更新失敗'}});}
      return route.fulfill({json:state.records});
    }
    assert(['GET','HEAD','OPTIONS'].includes(req.method()),'Unexpected write blocked');
    return route.fulfill({status:404,json:{message:'Unconfigured local fixture'}});
  });
  await page.goto(origin+'/app/#history',{waitUntil:'domcontentloaded'});
  await page.locator('.history-heading').waitFor();
  return {page,state};
}

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [390,1280]){
   const {page,state}=await fixture(browser,width,'admin');
   const panel=page.locator('[data-legacy-import]'),preview=panel.locator('[data-preview]'),status=panel.locator('[data-status]');
   assert.equal(await panel.count(),1);assert.equal(state.previewGets,0);assert.equal(state.posts.length,0);
   await preview.click();await panel.locator('form').waitFor();
   assert.equal(state.previewGets,1);assert.equal(state.posts.length,0);
   assert.equal(await panel.locator('input[name="record"]').count(),11);
   assert.equal(await panel.locator('input:disabled').count(),1);
   assert.equal(await panel.locator('input:checked').count(),10);
   assert.match(await status.innerText(),/11.*10/);
   for(const input of await panel.locator('input:not(:disabled)').all())await input.uncheck();
   await panel.locator('button[type="submit"]').click();assert.match(await status.innerText(),/至少一份/);assert.equal(state.posts.length,0);
   await panel.locator('input').nth(2).check();await panel.locator('input').nth(4).check();
   state.holdPost=true;
   await panel.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
   await page.waitForFunction(()=>document.querySelector('[data-legacy-import] button[type="submit"]').disabled);
   const requestDeadline=Date.now()+5000;
   while(!state.releasePost&&Date.now()<requestDeadline)await page.waitForTimeout(10);
   assert(state.releasePost,'Explicit submit must reach the local POST fixture');
   assert.equal(state.posts.length,1);
   assert.deepEqual(state.posts[0],{sourceRecordIds:[candidates[2].sourceRecordId,candidates[4].sourceRecordId],snapshot,confirm:true});
   assert(await preview.isDisabled());state.holdPost=false;state.releasePost();
   await page.waitForFunction(()=>document.querySelectorAll('.history-card').length===2);
   assert.equal(state.recordGets,2);assert.equal(await panel.locator('form').count(),0);
   state.getMode='empty';await preview.click();await page.waitForFunction(()=>document.querySelector('[data-legacy-import] [data-status]').textContent.includes('沒有尚未同步'));
   assert.equal(await panel.locator('form').count(),0);assert(!(await preview.isDisabled()));
   state.getMode='error';await preview.click();await page.waitForFunction(()=>document.querySelector('[data-legacy-import] [data-status]').textContent.includes('預覽暫時失敗'));
   assert(!(await preview.isDisabled()));
   state.getMode='normal';await preview.click();await panel.locator('form').waitFor();
   state.postMode='error';await panel.locator('button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-legacy-import] [data-status]').textContent.includes('資料已變更'));
   assert(!(await panel.locator('button[type="submit"]').isDisabled()));assert(!(await preview.isDisabled()));
   state.postMode='ok';state.failRefresh=true;
   await panel.locator('button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-legacy-import] [data-status]').textContent.includes('清單更新失敗'));
   assert.match(await status.innerText(),/已保存/);assert(!(await preview.isDisabled()));
   const postCount=state.posts.length;
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.history-card').first().waitFor();
   assert.equal(await page.locator('.history-card').count(),10);assert.equal(state.posts.length,postCount);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(state.errors,[]);
   await page.close();
   for(const role of ['user','guest']){
    const other=await fixture(browser,width,role);
    assert.equal(await other.page.locator('[data-legacy-import]').count(),0);
    assert.equal(other.state.previewGets,0);assert.equal(other.state.posts.length,0);assert.deepEqual(other.state.errors,[]);
    await other.page.close();
   }
   console.log('PASS '+width+': explicit preview, 11 candidates/disabled imported, exact selected IDs+snapshot+confirm, empty selection, no double POST, empty/GET/POST errors, refresh failure+reload retry, success refresh, member/guest hidden');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
