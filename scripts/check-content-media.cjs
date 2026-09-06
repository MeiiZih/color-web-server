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
   const contract = await page.evaluate(async records => {
    const {mediaFor,contentMedia} = await import('/app/content-media.mjs');
    const {canonicalContentKey} = await import('/app/content-illustrations.mjs');
    const media = records.map(mediaFor);
    const custom = mediaFor({...records[0],imageUrl:'/custom/admin-cover.png'});
    const own = mediaFor({...records[0],imageUrl:'/assets/images/posts/own-article.webp'});
    const legacy = {title:'Legacy source',link:'https://www.lifeline.org.tw/',imageUrl:'/assets/images/台北生命協會.png'};
    const node = document.createElement('div');
    node.innerHTML = contentMedia({...legacy,media:mediaFor(legacy)});
    document.body.append(node);
    node.querySelector('.source-thumbnail').dispatchEvent(new Event('error'));
    const neutral = !node.querySelector('img') && !node.textContent.includes('AI') && node.textContent.includes('仍可查看原文');
    node.remove();
    return {illustrations:media.map(m=>m.illustration),custom:custom.imageUrl,own:own.illustration,neutral,key:canonicalContentKey('https://www.life1995.org.tw/?page_name=detail&iid=169&utm_source=test&aid=301#section')};
   }, items);
   assert.equal(contract.illustrations.length,14);
   assert.equal(new Set(contract.illustrations).size,14,'every legacy article owns a distinct illustration');
   assert(contract.illustrations.every(src=>/^\/assets\/images\/posts\/[a-z0-9-]+\.webp$/.test(src)));
   assert.equal(contract.custom,'/custom/admin-cover.png','admin image wins');
   assert.equal(contract.own,'/assets/images/posts/own-article.webp','generated primary falls back only to itself');
   assert.equal(contract.neutral,true,'legacy source failure must not display unrelated AI art');
   assert.equal(contract.key,'life1995.org.tw/?aid=301&iid=169&page_name=detail');
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
    for(const illustration of await card.locator('.topic-illustration').all()) await illustration.evaluate(i=>i.decode());
    assert(await card.locator('.content-media').evaluate(c=>c.getBoundingClientRect().height>50));
   }
   console.log(width,JSON.stringify(results));
   await page.locator('.article-card').first().scrollIntoViewIfNeeded();
   await page.locator('.editorial-section').first().screenshot({path:`tmp/content-media-${width}.png`});
   await page.locator('.resources .horizontal-list').evaluate(rail=>{rail.scrollLeft=0;});
   await page.locator('.resources').screenshot({path:`tmp/content-resources-${width}.png`});
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
   assert.match(await page.locator('.media-poster .topic-illustration').getAttribute('src'),/posts\/healthy-boundaries-20260906\.webp$/);
   // A missing generated file must not silently substitute another article's picture.
   await page.locator('.media-poster .topic-illustration').evaluate(i=>i.dispatchEvent(new Event('error')));
   assert.equal(await page.locator('.media-poster img').count(),0);
   assert.match(await page.locator('.media-poster .media-cover').textContent(),/仍可查看原文/);
   await page.close();
   console.log(`PASS ${base} ${width}: official images, editorial covers, complete poster, failed-image fallback`);
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
