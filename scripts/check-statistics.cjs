// Local fixture-only layout QA, never queries or publishes administrator data.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const root=path.resolve(__dirname,'../color-web/app');
  const {statisticsView}=await import(pathToFileURL(path.join(root,'statistics-view.mjs')));
  const styles=(await Promise.all(['style.css','account.css','statistics.css'].map(file=>fs.readFile(path.join(root,file),'utf8')))).join('\n');
  const stats={totalParticipants:13,mbtiStats:['ISFP','ESFP','ISFJ','INTP','INFP','ENFJ','ISTJ','ISTP','ENTJ'].map((_id,i)=>({_id,count:[10,5,3,2,2,2,1,1,1][i]})),colorStats:['green','yellow','blue','red'].map((_id,i)=>({_id,count:[12,11,3,1][i]})),testTypeStats:[{_id:'我在色彩學中的MBTI',count:27}]};
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [320,390,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.setContent(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body class="account-app"><main><div class="page-intro"><h1>測驗統計</h1></div>${statisticsView(stats)}</main></body></html>`);
    assert.equal(await page.locator('meter').count(),14);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
    for(const item of await page.locator('.statistics-bar-label').all()){
      const bounds=await item.evaluate(el=>{const label=el.firstElementChild.getBoundingClientRect(),value=el.lastElementChild.getBoundingClientRect();return {right:label.right,left:value.left,font:parseFloat(getComputedStyle(el).fontSize)};});
      assert(bounds.right<=bounds.left,'label and number must not overlap');assert(bounds.font>=14,'readable chart labels');
    }
    const heights=await page.locator('.statistics-chart').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect()));
    if(width<760)assert(heights[1].y>=heights[0].bottom,'mobile charts stack');
    if(width===390)await page.screenshot({path:path.resolve(__dirname,'../test-results/statistics-mobile.png'),fullPage:true});
    console.log(JSON.stringify({width,meters:14,overflow:false,labels:'readable'}));await page.close();
  }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
