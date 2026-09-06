const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// Mock-only admin contract tests. Every API mutation is aborted, never sent.
const fixtures=[
 {_id:'qa-hotline',title:'1925 安心專線',description:'管理圖片測試',type:'common',imageUrl:'/colorlab-support.svg',link:'https://dep.mohw.gov.tw/DOMHAOH/fp-4906-54077-107.html',sourceName:'衛生福利部'},
 {_id:'qa-official',title:'健康界線',description:'官方原圖優先',type:'news',imageUrl:'/colorlab-discovery.svg',link:'https://www.1980.org.tw/news_show.php?news_id=830',sourceName:'張老師'},
 {_id:'qa-missing',title:'未知文章',description:'失敗不共用無關插圖',type:'news',imageUrl:'/missing-source.png',link:'https://example.org/no-mapping'}
];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});let writes=0;const errors=[];
 await context.addInitScript(()=>{sessionStorage.setItem('adminToken','qa.'+btoa(JSON.stringify({exp:4102444800})) +'.invalid');});
 await context.route('**/api/**',route=>{const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'){writes++;return route.abort();}let body={};
  if(u.pathname==='/api/admin/content-review/current')body=fixtures;
  else if(u.pathname.startsWith('/api/admin/content-review/current/'))body=fixtures.find(x=>x._id===u.pathname.split('/').pop())||{};
  else if(u.pathname==='/api/admin/content-review')body={batches:[],pending:1,items:[{_id:'qa-review',action:'update',title:'待審圖片',reason:'圖片顯示測試',sourceName:'官方來源',sourceUrl:fixtures[1].link,checkedAt:'2026-09-06',weekStart:'2026-08-31',status:'pending',before:fixtures[0],content:fixtures[1]}]};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await context.route('**/missing-source.png',route=>route.abort());
 await context.route('https://www.1980.org.tw/userfiles/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#cddbd0"/><text x="50" y="200" font-size="40">Official source fixture</text></svg>'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4180/app/account.html#content');await page.locator('.management-card').first().waitFor();
 const cards=page.locator('.management-card');assert.equal(await cards.count(),3);
 await cards.nth(0).locator('.topic-illustration').evaluate(img=>img.decode());
 assert.match(await cards.nth(0).locator('.topic-illustration').getAttribute('src'),/hotline-1925-20260906/);
 await cards.nth(1).locator('.image-ready').waitFor();assert.match(await cards.nth(1).locator('.source-thumbnail').getAttribute('src'),/1980.org.tw\/userfiles/);
 await page.waitForFunction(()=>document.querySelectorAll('.management-card')[2].textContent.includes('圖片暫時無法載入'));
 assert.equal(await cards.nth(2).locator('img').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`tmp/admin-content-list-${width}.png`,fullPage:true});
 await page.locator('[name=category]').selectOption('common');assert.equal(await cards.count(),1);assert.match(await cards.first().locator('.topic-illustration').getAttribute('src'),/hotline-1925/);
 await page.goto('http://127.0.0.1:4180/app/account.html#content-edit/qa-hotline');await page.locator('#content-form').waitFor();
 assert.equal(await page.locator('[name=imageUrl]').inputValue(),'/colorlab-support.svg');assert.match(await page.locator('[data-content-preview] .topic-illustration').getAttribute('src'),/hotline-1925/);
 await page.locator('[name=imageUrl]').fill('/assets/images/posts/teacher-1980-20260906.webp');
 await page.locator('[data-content-preview] .image-ready').waitFor();assert.match(await page.locator('[data-content-preview] .source-thumbnail').getAttribute('src'),/teacher-1980/);
 assert.equal(await page.locator('[name=imageUrl]').inputValue(),'/assets/images/posts/teacher-1980-20260906.webp');
 await page.locator('[name=imageUrl]').fill('/missing-source.png');await page.waitForFunction(()=>document.querySelector('[data-content-preview]').textContent.includes('原圖暫時無法載入'));
 assert.match(await page.locator('[data-content-preview] .topic-illustration').getAttribute('src'),/hotline-1925/);assert.equal(writes,0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`tmp/admin-content-editor-${width}.png`,fullPage:true});
 await page.close();const review=await context.newPage();review.on('pageerror',e=>errors.push(e.message));
 await review.goto('http://127.0.0.1:4180/app/account.html#content-review');await review.locator('.review-item').waitFor();await review.locator('.review-item summary').click();
 const comparison=review.locator('.review-comparison');assert.equal(await comparison.locator('.admin-content-media').count(),2);
 await comparison.locator('.image-ready').waitFor();assert.match(await comparison.locator('.topic-illustration').first().getAttribute('src'),/hotline-1925/);
 assert.match(await comparison.locator('.source-thumbnail').getAttribute('src'),/1980.org.tw\/userfiles/);assert(await review.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await review.screenshot({path:`tmp/admin-content-review-${width}.png`,fullPage:true});assert.equal(writes,0);assert.deepEqual(errors,[]);
 console.log(`PASS ${width}: list/filter, raw URL preserved, editor immediate preview, dedicated fallback, source priority, unknown failure UI, review comparison, no writes/errors/overflow`);await context.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
