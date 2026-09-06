const crypto = require('node:crypto');
const {ObjectId} = require('mongoose').mongo;
const {buildDigest} = require('./weeklyDigest');
const FIELDS = ['type','title','description','link','imageUrl','sourceName','contentKind','registrationUrl','sourcePublishedAt','sourceCheckedAt','expiresAt'];
const SOURCES = ['1980.org.tw','life1995.org.tw','1995.org.tw','lifeline.org.tw','twtcpa.org.tw','tpcpa.org.tw','tpa-tw.org','tpa.org.tw','psychology.org.tw','tcpa.org.tw','clinicalpsychology.org.tw','mohw.gov.tw','gov.tw','gov.taipei','nature.com','pubmed.ncbi.nlm.nih.gov','doi.org','sciencedirect.com','jamanetwork.com','thelancet.com','apa.org'];
const fail = (message, status=400) => Object.assign(new Error(message),{status});
function url(value, official=false) {
 let u; try {u=new URL(value);} catch {throw fail('請提供完整來源網址。');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) throw fail('來源必須是公開 HTTPS 網址。');
 if(official&&!SOURCES.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))) throw fail('來源不在官方來源清單，請先確認單位。');
 u.hash='';return u.href;
}
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(doc) {return Object.fromEntries(FIELDS.map(k=>[k,doc?.[k] instanceof Date?doc[k].toISOString():doc?.[k]??null]));}
function version(doc) {return hash({...snapshot(doc),updatedAt:doc?.updatedAt??null,archivedAt:doc?.archivedAt??null});}
function content(value, checkedAt) {
 if(!value||!['news','common'].includes(value.type)||!['workshop','lecture','article','paper','resource'].includes(value.contentKind)) throw fail('需填寫資訊分類與內容種類。');
 const out={};for(const k of ['title','description','sourceName']) {if(typeof value[k]!=='string'||!value[k].trim()||value[k].length>(k==='description'?3000:200))throw fail('標題、摘要與來源名稱不完整。');out[k]=value[k].trim();}
 if(/臺?中科技大學|台中科大|本校學生|僅限.*學生/.test(out.title+' '+out.description+' '+out.sourceName))throw fail('不收錄校園學生限定資訊。');
 out.type=value.type;out.contentKind=value.contentKind;out.link=url(value.link,true);out.sourceCheckedAt=checkedAt;
 out.imageUrl=value.imageUrl? (/^\/assets\/[a-z\d/_-]+\.(png|jpg|jpeg|webp|svg)$/i.test(value.imageUrl)?value.imageUrl:url(value.imageUrl)):'/assets/images/colorlab-support.svg';
 if(value.registrationUrl)out.registrationUrl=url(value.registrationUrl);
 if(value.sourcePublishedAt){if(!/^\d{4}-\d{2}-\d{2}$/.test(value.sourcePublishedAt)||!Number.isFinite(Date.parse(value.sourcePublishedAt)))throw fail('來源發布日期格式不正確。');out.sourcePublishedAt=value.sourcePublishedAt;}
 if(value.expiresAt){const d=new Date(value.expiresAt);if(!Number.isFinite(+d))throw fail('截止日期格式不正確。');out.expiresAt=d;}
 if(['workshop','lecture'].includes(out.contentKind)&&!out.expiresAt)throw fail('活動需明確設定報名截止或開課下架時間。');
 return out;
}
function normalize(report) {
 try {buildDigest(report);} catch(e) {throw fail(e.message);}
 const checkedAt=report.checkedAt;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt||'')||!Number.isFinite(Date.parse(checkedAt)))throw fail('請填寫實際查核日期。');
 const items=report.items.map(i=>{
  const p={action:i.action,title:i.title,reason:i.reason,sourceName:i.sourceName,sourceUrl:url(i.sourceUrl,true),checkedAt};
  if(i.action!=='add'){if(!/^[a-f\d]{24}$/i.test(i.targetId||''))throw fail('更正或下架需指定原資訊。');p.targetId=i.targetId;}
  if(i.action!=='remove') {p.content=content(i.content,checkedAt);if(p.content.link!==p.sourceUrl||p.content.title!==p.title||p.content.sourceName!==p.sourceName)throw fail('待審標題、來源與刊登內容必須一致。');}
  p.key=hash({action:p.action,target:p.targetId||p.sourceUrl,content:p.content?{...p.content,sourceCheckedAt:null}:null});
  return p;
 });
 if(new Set(items.map(i=>i.key)).size!==items.length)throw fail('同一份清單不可含重複建議。');
 return {weekStart:report.weekStart,checkedAt,sourceFailures:report.sourceFailures||[],items};
}
async function indexes(db) {
 await db.collection('content_review_items').createIndex({key:1},{unique:true});
 await db.collection('content_review_items').createIndex({status:1,createdAt:-1});
}
async function ingest(connection, report) {
 const batch=normalize(report),db=connection.db;await indexes(db);
 const digest=hash(batch);let result;
 await connection.transaction(async session=>{
  const old=await db.collection('content_review_batches').findOne({_id:batch.weekStart},{session});
  if(old){if(old.digest!==digest)throw fail('本週已同步另一份清單，請保留原始紀錄並人工處理。',409);result={weekStart:batch.weekStart,count:old.count,status:'already-synced'};return;}
  let count=0;
  for(const item of batch.items){
   let before=null;
   if(item.targetId){before=await db.collection('homepages').findOne({_id:new ObjectId(item.targetId)},{session});if(!before||before.archivedAt)throw fail('原資訊已不存在或已下架，請重新查核。',409);}
   else if(await db.collection('homepages').findOne({link:item.content.link,archivedAt:{$exists:false}},{session}))continue;
   const key=before?hash({proposal:item.key,beforeVersion:version(before)}):item.key;
   if(await db.collection('content_review_items').findOne({key},{session}))continue;
   await db.collection('content_review_items').insertOne({...item,key,before,beforeVersion:before?version(before):null,weekStart:batch.weekStart,status:'pending',createdAt:new Date()},{session});count++;
  }
  await db.collection('content_review_batches').insertOne({_id:batch.weekStart,digest,count,sourceFailures:batch.sourceFailures,checkedAt:batch.checkedAt,createdAt:new Date()},{session});
  result={weekStart:batch.weekStart,count,status:'synced'};
 });
 return result;
}
async function decide(connection, ids, decision, actor) {
 if(!Array.isArray(ids)||!ids.length||ids.length>60||new Set(ids).size!==ids.length||ids.some(id=>!/^[a-f\d]{24}$/i.test(id))||!['approve','reject'].includes(decision))throw fail('請勾選有效待審項目並選擇核准或略過。');
 const db=connection.db;let result;
 await connection.transaction(async session=>{
  const queue=db.collection('content_review_items');const items=await queue.find({_id:{$in:ids.map(id=>new ObjectId(id))}},{session}).toArray();
  if(items.length!==ids.length)throw fail('部分待審項目不存在。',409);
  const targetStatus=decision==='approve'?'approved':'rejected';let changed=0;
  for(const item of items){
   if(item.status===targetStatus)continue;
   if(item.status!=='pending')throw fail('選取項目已由其他操作處理，請重新載入。',409);
   const now=new Date();let publishedId;
   if(decision==='approve'){
    if(item.action==='add'){
     if(await db.collection('homepages').findOne({link:item.content.link,archivedAt:{$exists:false}},{session}))throw fail('相同來源已刊登，請略過重複建議。',409);
     if(item.content.expiresAt&&+new Date(item.content.expiresAt)<=+now)throw fail('選取活動已過截止時間，請略過或重新蒐集。',409);
     publishedId=new ObjectId(item._id.toString());
     await db.collection('homepages').insertOne({...item.content,_id:publishedId,createdAt:now,updatedAt:now},{session});
    }else{
     const target=await db.collection('homepages').findOne({_id:new ObjectId(item.targetId)},{session});
     if(!target||version(target)!==item.beforeVersion)throw fail('原資訊在蒐集後被修改，未覆蓋。請重新查核。',409);
     if(item.action==='update'&&item.content.expiresAt&&+new Date(item.content.expiresAt)<=+now)throw fail('更正後的活動已過期，未發布。',409);
     await db.collection('content_review_archives').insertOne({reviewId:item._id,original:target,action:item.action,actor:String(actor),createdAt:now},{session});
     const update=item.action==='remove'?{$set:{archivedAt:now,updatedAt:now}}:{$set:{...Object.fromEntries(FIELDS.map(k=>[k,item.content[k]??null])),updatedAt:now}};
     await db.collection('homepages').updateOne({_id:target._id},update,{session});publishedId=target._id;
    }
   }
   await queue.updateOne({_id:item._id,status:'pending'},{$set:{status:targetStatus,reviewedAt:now,reviewedBy:String(actor),...(publishedId?{publishedId}:{})}},{session});changed++;
  }
  result={status:targetStatus,changed};
 });return result;
}
async function restore(connection,id,actor){
 if(!/^[a-f\d]{24}$/i.test(id))throw fail('下架紀錄不正確。');
 const db=connection.db;
 await connection.transaction(async session=>{
  const entry=await db.collection('content_review_items').findOne({_id:new ObjectId(id),action:'remove',status:'approved'},{session});
  if(!entry)throw fail('找不到可恢復的下架紀錄。',409);
  const target=await db.collection('homepages').findOne({_id:entry.publishedId},{session});
  if(!target?.archivedAt)throw fail('資訊已恢復或不存在。',409);
  await db.collection('homepages').updateOne({_id:target._id},{$unset:{archivedAt:''},$set:{updatedAt:new Date()}},{session});
  await db.collection('content_review_items').updateOne({_id:entry._id},{$set:{status:'restored',restoredAt:new Date(),restoredBy:String(actor)}},{session});
 });return {status:'restored'};
}
module.exports={normalize,content,version,ingest,decide,restore,indexes};
