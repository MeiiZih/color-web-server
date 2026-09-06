const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {normalize}=require('../Server/services/contentReview');
const {assertIllustration}=require('../Server/services/contentIllustration');
const folder=path.resolve(__dirname,'../tmp/content-review');
async function sync(week,{env=process.env,transport=fetch}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week||''))throw new Error('需指定週一日期。');
 const report=JSON.parse(await fs.readFile(path.join(folder,week+'.json'),'utf8'));normalize(report);
 if(report.weekStart!==week)throw new Error('清單與檔名週別不同。');
 for(const item of report.items.filter(i=>i.action!=='remove')) {
  const art=assertIllustration(item.content);
  const image=await transport('https://colorlab-start.onrender.com'+art.imageUrl,{signal:AbortSignal.timeout(20000)});
  if(!image.ok||!image.headers.get('content-type')?.startsWith('image/')||crypto.createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex')!==art.sha256)throw new Error('插圖尚未成功部署；未同步待審清單。');
 }
 if(!env.CONTENT_REVIEW_INGEST_KEY)throw new Error('尚未設定本機待審同步授權。');
 const response=await transport('https://color-web-server-jprj.onrender.com/api/content-review-ingest',{
  method:'POST',headers:{'Content-Type':'application/json','X-Content-Review-Key':env.CONTENT_REVIEW_INGEST_KEY},body:JSON.stringify(report),signal:AbortSignal.timeout(90000)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||!['synced','already-synced'].includes(data?.status))throw new Error(data?.message||'未確認同步成功；保留清單，下次重試同一份內容。');
 const receipt={weekStart:week,status:'synced',count:data.count,reportHash:crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'),syncedAt:new Date().toISOString()};
 await fs.writeFile(path.join(folder,week+'.sync.json'),JSON.stringify(receipt,null,2));
 return receipt;
}
if(require.main===module)sync(process.argv[2]).then(r=>console.log(`本週清單已同步至管理後台，共 ${r.count} 筆新待審。沒有改動公開資訊。`)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={sync};
