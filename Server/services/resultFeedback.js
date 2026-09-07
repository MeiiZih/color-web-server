const { createHash } = require('node:crypto');
const GuestFeedback = require('../models/ResultFeedback');
const TestRecord = require('../models/TestRecord');
const choices = ['red','yellow','green','blue','none','other'];
function parse(body) {
  if(!choices.includes(body?.choice))return null;
  if(body.choice!=='other')return body.text===undefined?{choice:body.choice,text:''}:null;
  if(typeof body.text!=='string'||!body.text.trim()||body.text.trim().length>500)return null;
  return {choice:'other',text:body.text.trim()};
}
const attempts = new Map();
function limit(req,res,next) {
  const now=Date.now();
  for(const [key,value] of attempts) if(value.until<=now) attempts.delete(key);
  const key=req.ip, entry=attempts.get(key)||{count:0,until:now+600000};
  if(entry.count>=40 || (!attempts.has(key)&&attempts.size>=10000)) return res.status(429).json({message:'回饋送出太頻繁，請稍後再試。'});
  entry.count++;attempts.set(key,entry);next();
}
const hashKey=key=>createHash('sha256').update(key.toLowerCase()).digest('hex');
async function statistics() {
  const accounts=await TestRecord.aggregate([
    {$match:{'reflection.choice':{$in:choices}}},{$sort:{'reflection.updatedAt':-1}},
    {$group:{_id:{$ifNull:['$sourceRecordId','$_id']},choice:{$first:'$reflection.choice'}}},
    {$group:{_id:'$choice',count:{$sum:1}}}
  ]);
  const guests=await GuestFeedback.aggregate([{$group:{_id:'$choice',count:{$sum:1}}}]);
  const accountComments=await TestRecord.aggregate([
    {$match:{'reflection.choice':{$in:choices}}},{$sort:{'reflection.updatedAt':-1}},
    {$group:{_id:{$ifNull:['$sourceRecordId','$_id']},reflection:{$first:'$reflection'}}},
    {$match:{'reflection.choice':'other'}},{$sort:{'reflection.updatedAt':-1}},{$limit:50},
    {$project:{_id:0,text:'$reflection.text',date:'$reflection.updatedAt',source:{$literal:'account'}}}
  ]);
  const guestComments=await GuestFeedback.find({choice:'other'}).sort({updatedAt:-1}).limit(50).select('text updatedAt -_id').lean();
  const comments=[...accountComments,...guestComments.map(r=>({text:r.text,date:r.updatedAt,source:'guest'}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50);
  return {accounts,guests,comments};
}
module.exports={choices,parse,limit,hashKey,statistics};
