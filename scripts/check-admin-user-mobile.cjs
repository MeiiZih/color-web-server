// Local, read-only API fixtures; no real account deletion or PDF navigation.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const origin='http://127.0.0.1:4180';
const user={_id:'222222222222222222222222',name:'手機版排版測試會員',email:'very-long-member-account-name-for-layout-check@example.invalid',occupation:'需要換行的職業資料'.repeat(6),gender:'unknown',createdAt:'2026-01-01T00:00:00Z'};
const record={_id:'333333333333333333333333',email:user.email,testType:'色彩與自我探索的完整測驗紀錄',timestamp:'2026-01-01T00:00:00Z',mbtiResult:'ENFP',colorResult:{primary:['yellow']},answers:Array.from({length:20},(_,i)=>({question:`${i+1}${['.','、','．'][i%3]} 這是需要完整呈現而且不能橫向溢出的測驗題目`,answer:'這是當時的作答內容與想法。'}))};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [320,390,1280]){
   const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<700,serviceWorkers:'block',reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(token=>sessionStorage.setItem('adminToken',token),'qa.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.invalid');
   for(const file of ['account.mjs','account.css','ui.mjs'])await page.route('**/app/'+file,async route=>route.fulfill({body:await fs.readFile(path.resolve('color-web/app',file),'utf8'),contentType:file.endsWith('.css')?'text/css':'text/javascript'}));
   await page.route('**/api/**',route=>{
    const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin);assert.equal(req.method(),'GET');
    const endpoints={'/api/admin/users':[user],['/api/admin/user/'+user._id]:{user},['/api/admin/user/'+user._id+'/records']:{records:[record]},['/api/admin/records/'+record._id]:record};
    return route.fulfill({json:endpoints[url.pathname]??{}});
   });
   await page.goto(origin+'/app/account.html#users',{waitUntil:'domcontentloaded'});
   await page.locator('a[href="#user/'+user._id+'"]').waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Account list overflow');
   await page.locator('a[href="#user/'+user._id+'"]').click();
   await page.locator('.definition-list').waitFor();
   await page.screenshot({path:`tmp/admin-user-${width}.png`,fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'User details overflow');
   const recordButton=page.locator('[data-record]');
   if(width<700)assert.equal(await page.locator('.panel .data-list td').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1,'Nested card labels must not squeeze values into a narrow second column');
   const box=await recordButton.boundingBox();assert(box.width>=44&&box.height>=44);
   if(width<700)await recordButton.tap();else await recordButton.click();await page.locator('dialog[open]').waitFor();
   const dialog=page.locator('dialog');
   assert.equal(await dialog.locator('.record-answer').count(),20);
   assert.deepEqual(await dialog.locator('.record-answer h3').allTextContents(),Array.from({length:20},(_,i)=>`${i+1}. 這是需要完整呈現而且不能橫向溢出的測驗題目`));
   assert.equal(await dialog.locator('.record-result strong').innerText(),'ENFP');
   assert.equal(await dialog.locator('.record-color').innerText(),'黃色');
   assert.equal(await dialog.locator('.record-meta dd').first().innerText(),user.email);
   assert.equal(await dialog.locator('.record-summary .actions .button').count(),2);
   await page.screenshot({path:`tmp/admin-record-${width}.png`});
   assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'Record dialog overflow');
   const close=dialog.getByRole('button',{name:'關閉',exact:true}),closeBox=await close.boundingBox();
   assert(closeBox.width>=44&&closeBox.width<=48&&closeBox.height>=44&&closeBox.height<=48,'Close target is compact and accessible');
   assert.equal(await close.evaluate(e=>getComputedStyle(e).outlineStyle),'none','Pointer auto-focus must not add a red circle');
   assert.equal(await close.evaluate(e=>getComputedStyle(e).color),'rgb(168, 65, 97)','X itself carries berry feedback');
   await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
   assert(await close.evaluate(e=>e===document.activeElement));
   assert.equal(await close.evaluate(e=>getComputedStyle(e).outlineWidth),'2px','Keyboard retains a fine visible focus outline');
   for(const link of await dialog.locator('.actions .button').all()){
    const r=await link.boundingBox();assert(r.width>=44&&r.height>=44&&r.width<=width-48,'PDF action target fits');
   }
   await dialog.locator('.record-answer').last().scrollIntoViewIfNeeded();
   assert(await dialog.locator('.record-answer').last().isVisible());
   await close.click();assert.equal(await page.locator('dialog[open]').count(),0);
   await recordButton.focus();await page.keyboard.press('Enter');await page.locator('dialog[open]').waitFor();
   assert.equal(await close.evaluate(e=>getComputedStyle(e).outlineWidth),'2px','Keyboard-opened modal keeps visible focus');
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   assert.deepEqual(errors,[]);await page.close();
   console.log(`PASS ${width}: users → user details → 20-answer modal, no overflow, close and PDF button sizes, read-only fixtures`);
  }
  for(const width of [320,390,1280])for(const canShare of [true,false]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
   await page.addInitScript(available=>{
    Object.defineProperty(navigator,'canShare',{value:()=>available});
    Object.defineProperty(navigator,'share',{value:async payload=>{window.qaShare=payload.files.map(f=>({name:f.name,type:f.type}));}});
   },canShare);
   for(const file of ['pdf.html','pdf.css','pdf.mjs'])await page.route('**/app/'+file+'*',async route=>route.fulfill({body:await fs.readFile(path.resolve('color-web/app',file),'utf8'),contentType:file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/javascript'}));
   await page.route('**/test/detailed-reports/*.pdf',route=>route.fulfill({body:'%PDF-local-layout-fixture',contentType:'application/pdf'}));
   await page.route('**/vendor/pdfjs/pdf.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export const GlobalWorkerOptions={};export function getDocument(){return {promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>({promise:Promise.resolve()}),cleanup(){}})})}}'}));
   await page.goto(origin+'/app/pdf.html?from=admin&file='+encodeURIComponent('/test/detailed-reports/ENFP-yellow.pdf'));
   await page.waitForFunction(()=>document.querySelector('#pdf-status').textContent.includes('共 2 頁'));
   assert.equal(await page.locator('#share').isVisible(),canShare);
   const actions=page.locator('.pdf-toolbar .button:visible'),boxes=[];
   assert.equal(await actions.count(),canShare?3:2);
   for(const action of await actions.all()){
    const r=await action.boundingBox();assert(r.height>=44&&r.x>=0&&r.x+r.width<=width);boxes.push(r);
   }
   if(width<600&&canShare){assert(boxes[0].y<boxes[1].y);assert.equal(boxes[1].y,boxes[2].y);assert(Math.abs(boxes[1].width-boxes[2].width)<1);}
   if(width>600)assert(boxes.every(r=>r.y===boxes[0].y&&r.height===boxes[0].height));
   assert.equal(await page.locator('#download').getAttribute('download'),'ColorLab-ENFP-yellow.pdf');
   assert.equal(await page.locator('#original').getAttribute('href'),'/test/detailed-reports/ENFP-yellow.pdf');
   assert.equal(await page.locator('#original').getAttribute('target'),'_blank');
   assert.equal(await page.locator('.text-button').getAttribute('href'),'/app/account.html#records');
   if(canShare){await page.locator('#share').click();assert.deepEqual(await page.evaluate(()=>window.qaShare),[{name:'ColorLab-ENFP-yellow.pdf',type:'application/pdf'}]);await page.screenshot({path:`tmp/admin-pdf-${width}.png`});}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.close();console.log(`PASS PDF ${width} share=${canShare}: preserved actions, aligned layout, original/download/share contracts`);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
