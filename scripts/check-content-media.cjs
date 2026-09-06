const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const items=[...require('../Server/data/publicMentalHealth20260906.json'),...require('../Server/data/officialContent20260906.json')];
const base=process.env.COLORLAB_QA_URL||'http://127.0.0.1:4180';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [390,1280]) {
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
   if(base.includes('127.0.0.1')) await page.route('**/api/homepage',r=>r.fulfill({json:items}));
   await page.goto(base+'/app/');
   await page.locator('.article-card').first().waitFor();
   await page.locator('.article-card').first().scrollIntoViewIfNeeded();
   assert(await page.locator('.article-image .tag').first().evaluate(t=>t.getBoundingClientRect().height<40));
   const results=[];
   for(const card of await page.locator('.article-card,.resource-card').all()) {
    await card.scrollIntoViewIfNeeded();
    const img=card.locator('.source-thumbnail');
    if(await img.count()) {
     await img.evaluate(i=>i.decode().catch(()=>{}));
     results.push(await card.evaluate(c=>({title:c.querySelector('h3').textContent,loaded:c.querySelector('.source-thumbnail')?.naturalWidth||0})));
     assert.equal(await card.locator('.media-cover').isVisible(),false,'loaded official picture hides cover text');
    }
    assert(await card.locator('.content-media').evaluate(c=>c.getBoundingClientRect().height>50));
   }
   console.log(width,JSON.stringify(results));
   await page.locator('.article-card').first().scrollIntoViewIfNeeded();
   await page.locator('.editorial-section').first().screenshot({path:`tmp/content-media-${width}.png`});
   await page.getByRole('button',{name:/健康關係不靠打分數/}).click();
   await page.locator('.media-poster .source-thumbnail').evaluate(i=>i.decode().catch(()=>{}));
   await page.screenshot({path:`tmp/content-poster-${width}.png`,fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.keyboard.press('Escape');
   // Isolated browser only: emulate a missing official image, never alter production records.
   await page.route('**/userfiles/**',r=>r.abort());
   await page.reload();
   await page.getByRole('button',{name:/健康關係不靠打分數/}).click();
   await page.locator('.media-poster .media-credit').filter({hasText:'原圖暫時無法載入'}).waitFor();
   assert.equal(await page.locator('.media-poster .media-cover').isVisible(),true);
   assert.equal(await page.locator('.media-poster .source-thumbnail').count(),0);
   await page.locator('.media-poster .topic-illustration').evaluate(i=>i.decode());
   assert.match(await page.locator('.media-poster .topic-illustration').getAttribute('src'),/content-reading.webp/);
   await page.close();
   console.log(`PASS ${base} ${width}: official images, editorial covers, complete poster, failed-image fallback`);
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
