// Disposable MongoDB only; no live credentials, historical answers or production writes.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('../../tmp/review-qa/node_modules/mongodb-memory-server');
const User = require('../models/User'), Admin = require('../models/Admin'), Record = require('../models/TestRecord');
const { previewLegacyRecords, importLegacyRecords } = require('../services/legacyRecordImport');
let mongo, server, origin, member, otherMember, admin, otherAdmin, sources;
const token = (who,role) => jwt.sign({id:String(who._id),role},process.env.JWT_SECRET,{expiresIn:'2m'});
const call = (route,who=admin,role='admin',method='GET',body) => fetch(origin+route,{method,
  headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+token(who,role)}:{})},...(body?{body:JSON.stringify(body)}:{})});
const confirmed = preview => ({confirm:true,snapshot:preview.snapshot,sourceRecordIds:preview.candidates.map(item=>item.sourceRecordId)});
before(async()=>{
  process.env.JWT_SECRET='legacy-import-isolated-test-only';
  mongo=await MongoMemoryServer.create({binary:{version:'7.0.14'}});
  await mongoose.connect(mongo.getUri(),{dbName:'colorlab_legacy_import_isolated'});
  [member,otherMember]=await User.create([{email:'own@example.invalid',password:'fixture-password'},{email:'other@example.invalid',password:'fixture-password'}]);
  [admin,otherAdmin]=await Admin.create([{email:member.email,password:'fixture-password'},{email:otherMember.email,password:'fixture-password'}]);
  await Record.init();
  const app=express();app.use(express.json());app.use('/api/explore',require('../routes/explore'));app.use('/api/admin',require('../routes/admin'));
  app.use((error,_req,res,_next)=>res.status(500).json({message:'isolated error'}));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
  await Record.deleteMany({});
  const base={email:member.email,testType:'Historical fixture',timestamp:new Date('2020-01-02T03:04:05Z'),result:'ENFP',mbtiResult:'ENFP',details:'original details',answers:[{questionId:1,question:'Original question',answer:'Original answer'}],scores:{E:3,I:2,red:4},colorResult:{primary:['red']}};
  sources=await Record.create([{...base,userId:member._id},{...base,userId:null,timestamp:new Date('2019-01-02T03:04:05Z')}]);
  await Record.create([{...base,userId:otherMember._id},{...base,email:otherMember.email,userId:member._id},
    {adminId:admin._id,testType:'Current admin fixture'},{...base,email:otherMember.email,userId:otherMember._id}]);
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();if(mongo)await mongo.stop();});

test('preview is admin-only and strict same-email plus actual member/null ownership, never shared automatically',async()=>{
  assert.equal((await call('/api/explore/records/legacy-import',null)).status,401);
  assert.equal((await call('/api/explore/records/legacy-import',member,'user')).status,403);
  const response=await call('/api/explore/records/legacy-import');assert.equal(response.status,200);
  const preview=await response.json();assert.equal(preview.total,2);assert.equal(preview.pendingCount,2);
  assert.deepEqual(new Set(preview.candidates.map(x=>x.sourceRecordId)),new Set(sources.map(x=>x.id)));
  assert(preview.candidates.every(item=>!('answers' in item)&&!('email' in item)));
  const personal=await(await call('/api/explore/records')).json();assert.equal(personal.length,1);
});
test('explicit import copies historical values unchanged; retries are idempotent, originals byte-for-byte retained',async()=>{
  const before=await Record.find({_id:{$in:sources.map(x=>x._id)}}).sort({_id:1}).lean();
  const preview=await previewLegacyRecords(admin),body=confirmed(preview);
  const response=await call('/api/explore/records/legacy-import',admin,'admin','POST',body);assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{imported:2,alreadyImported:0,totalSelected:2});
  const copies=await Record.find({adminId:admin._id,sourceRecordId:{$ne:null}}).lean();assert.equal(copies.length,2);
  for(const copy of copies){const source=before.find(s=>String(s._id)===String(copy.sourceRecordId));for(const key of ['testType','timestamp','result','details','answers','scores','colorResult'])assert.deepEqual(copy[key],source[key]);assert.equal(copy.email,undefined);assert.equal(copy.userId,undefined);assert.equal(copy.guestId,undefined);}
  assert.deepEqual(await Record.find({_id:{$in:sources.map(x=>x._id)}}).sort({_id:1}).lean(),before);
  assert.deepEqual(await importLegacyRecords(admin,body),{imported:0,alreadyImported:2,totalSelected:2});
  assert.equal((await previewLegacyRecords(admin)).pendingCount,0);
  const personal=await(await call('/api/explore/records')).json();assert.equal(personal.length,3);
});
test('foreign IDs, forged owner fields, stale snapshots and absent confirmation cannot migrate records',async()=>{
  const preview=await previewLegacyRecords(admin),body=confirmed(preview);
  await assert.rejects(importLegacyRecords(admin,{...body,confirm:false}),{status:400});
  await assert.rejects(importLegacyRecords(admin,{...body,sourceRecordIds:[body.sourceRecordIds[0],body.sourceRecordIds[0]]}),{status:400});
  const foreign=await Record.findOne({userId:otherMember._id,email:member.email}).lean();
  await assert.rejects(importLegacyRecords(admin,{...body,sourceRecordIds:[String(foreign._id)],adminId:otherAdmin.id,email:otherAdmin.email}),{status:403});
  await Record.updateOne({_id:sources[0]._id},{$set:{result:'Changed original'}});
  await assert.rejects(importLegacyRecords(admin,body),{status:409});assert.equal(await Record.countDocuments({sourceRecordId:{$ne:null}}),0);
});
test('concurrent imports and partial server failures never duplicate or falsely finish',async()=>{
  const body=confirmed(await previewLegacyRecords(admin));
  const results=await Promise.all([importLegacyRecords(admin,body),importLegacyRecords(admin,body)]);
  assert.equal(results.reduce((sum,x)=>sum+x.imported,0),2);assert.equal(await Record.countDocuments({sourceRecordId:{$ne:null}}),2);
  await Record.deleteMany({sourceRecordId:{$ne:null}});const originalCreate=Record.create;let calls=0;
  Record.create=function(...args){if(++calls===2)return Promise.reject(new Error('isolated write interruption'));return originalCreate.apply(this,args);};
  try{await assert.rejects(importLegacyRecords(admin,body),/interruption/);}finally{Record.create=originalCreate;}
  assert.deepEqual(await importLegacyRecords(admin,body),{imported:1,alreadyImported:1,totalSelected:2});
});
test('import preserves modern saved survey snapshots without rescoring current questions',async()=>{
  const exploration={surveyId:'012345678901234567890123',version:'old-version',answers:[1],survey:{title:'Old immutable survey',questions:[{question:'Old',options:['A','B']}]}};
  await Record.updateOne({_id:sources[0]._id},{$set:{exploration}});
  await importLegacyRecords(admin,confirmed(await previewLegacyRecords(admin)));
  const copy=await Record.findOne({sourceRecordId:sources[0]._id}).lean();assert.deepEqual(copy.exploration,exploration);
});
test('selected subset remains tied to signed-in admin; schema enforces provenance ownership and uniqueness',async()=>{
  const body=confirmed(await previewLegacyRecords(admin));body.sourceRecordIds=body.sourceRecordIds.slice(0,1);
  assert.deepEqual(await importLegacyRecords(admin,{...body,adminId:otherAdmin.id,email:otherAdmin.email,userId:otherMember.id}),{imported:1,alreadyImported:0,totalSelected:1});
  const copy=await Record.findOne({sourceRecordId:body.sourceRecordIds[0]}).lean();assert.equal(String(copy.adminId),admin.id);
  assert.equal((await previewLegacyRecords(admin)).pendingCount,1);
  const otherBody=confirmed(await previewLegacyRecords(otherAdmin));
  await assert.rejects(importLegacyRecords(otherAdmin,{...otherBody,sourceRecordIds:body.sourceRecordIds}),{status:403});
  await assert.rejects(Record.create({email:member.email,sourceRecordId:sources[0]._id,testType:'Invalid source ownership'}),/必須屬於管理員/);
  await assert.rejects(Record.create({adminId:admin._id,sourceRecordId:copy.sourceRecordId,testType:'Duplicate copy'}),{code:11000});
});
test('all-site lists and all statistics exclude copies, and deleting personal copy leaves original intact',async()=>{
  const beforeList=await(await call('/api/admin/test-records')).json();
  const beforeStats=await(await call('/api/admin/data-stats')).json();
  await importLegacyRecords(admin,confirmed(await previewLegacyRecords(admin)));
  assert.deepEqual(await(await call('/api/admin/test-records')).json(),beforeList);
  assert.deepEqual(await(await call('/api/admin/data-stats')).json(),beforeStats);
  const copy=await Record.findOne({sourceRecordId:sources[0]._id}).lean();
  assert.equal((await call('/api/explore/records/'+copy._id,otherAdmin,'admin','DELETE')).status,404);
  assert.equal((await call('/api/explore/records/'+copy._id,member,'user','DELETE')).status,404);
  assert.equal((await call('/api/explore/records/'+copy._id,admin,'admin','DELETE')).status,200);
  assert(await Record.exists({_id:sources[0]._id}));
});
