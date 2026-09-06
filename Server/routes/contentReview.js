const express=require('express');
const mongoose=require('mongoose');
const crypto=require('node:crypto');
const service=require('../services/contentReview');
const safe=fn=>async(req,res,next)=>{try{res.set('Cache-Control','no-store');await fn(req,res);}catch(e){if(e.status)return res.status(e.status).json({message:e.message});console.error('Content review failed:',e.name);res.status(503).json({message:'待審資料暫時無法處理，沒有確認發布；請重新載入查看狀態。'});}};
// This credential can ONLY enqueue drafts. It never grants approval or account access.
const ingestion=express.Router();
ingestion.use((req,res,next)=>{
 const expected=process.env.CONTENT_REVIEW_INGEST_KEY||'',provided=req.get('X-Content-Review-Key')||'';
 if(expected.length<32||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return res.status(401).json({message:'同步授權無效。'});
 next();
});
ingestion.post('/',safe(async(req,res)=>res.json(await service.ingest(mongoose.connection,req.body))));
ingestion.get('/status/:week',safe(async(req,res)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(req.params.week))return res.sendStatus(400);const batch=await mongoose.connection.db.collection('content_review_batches').findOne({_id:req.params.week});res.json(batch?{weekStart:batch._id,count:batch.count,status:'synced'}:{status:'not-synced'});}));
function adminRouter(){
 const router=express.Router();
 router.get('/current',safe(async(req,res)=>res.json(await mongoose.connection.db.collection('homepages').find({archivedAt:{$exists:false}}).sort({createdAt:-1}).toArray())));
 router.get('/current/:id',safe(async(req,res)=>{if(!/^[a-f\d]{24}$/i.test(req.params.id))return res.sendStatus(400);const item=await mongoose.connection.db.collection('homepages').findOne({_id:new mongoose.Types.ObjectId(req.params.id),archivedAt:{$exists:false}});if(!item)return res.status(404).json({message:'資訊不存在或已下架。'});res.json(item);}));
 router.get('/',safe(async(req,res)=>{
  const status=['pending','approved','rejected','restored'].includes(req.query.status)?req.query.status:'pending';
  const db=mongoose.connection.db;
  const items=await db.collection('content_review_items').find({status}).sort({createdAt:-1}).limit(200).toArray();
  const batches=await db.collection('content_review_batches').find().sort({_id:-1}).limit(8).toArray();
  const pending=await db.collection('content_review_items').countDocuments({status:'pending'});
  res.json({items,batches,pending});
 }));
 router.post('/import',safe(async(req,res)=>res.json(await service.ingest(mongoose.connection,req.body))));
 router.post('/decide',safe(async(req,res)=>res.json(await service.decide(mongoose.connection,req.body.ids,req.body.decision,req.user._id))));
 router.post('/:id/restore',safe(async(req,res)=>res.json(await service.restore(mongoose.connection,req.params.id,req.user._id))));
 return router;
}
module.exports={ingestion,adminRouter};
