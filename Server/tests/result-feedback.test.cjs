const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose'),express=require('express'),jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('../../tmp/review-qa/node_modules/mongodb-memory-server');
const User=require('../models/User'),Record=require('../models/TestRecord'),Question=require('../models/TestQuestion'),Guest=require('../models/ResultFeedback');
const {statistics}=require('../services/resultFeedback');
let mongo,server,base,owner,other,record,survey;
before(async()=>{
 mongo=await MongoMemoryServer.create({binary:{version:'7.0.14'}});await mongoose.connect(mongo.getUri(),{dbName:'isolated_result_feedback'});await Guest.init();
 process.env.JWT_SECRET='isolated-feedback-test';
 [owner,other]=await User.create([{email:'a@example.invalid',password:'test-only-password',name:'A'},{email:'b@example.invalid',password:'test-only-password',name:'B'}]);
 survey=await Question.create({testType:'我在色彩學中的MBTI',totalQuestions:20,questions:require('../data/finalSurveyQuestions')});
 record=await Record.create({userId:owner._id,email:owner.email,testType:survey.testType,mbtiResult:'ISFP',colorResult:{primary:['green']}});
 const app=express();app.use(express.json());app.use('/api/explore',require('../routes/explore'));app.use('/api/admin',require('../routes/admin'));
 await new Promise(r=>{server=app.listen(0,'127.0.0.1',r)});base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));await mongoose.disconnect();if(mongo)await mongo.stop();});
const headers=user=>({'Content-Type':'application/json',...(user?{Authorization:`Bearer ${jwt.sign({id:user.id,role:'user'},process.env.JWT_SECRET,{expiresIn:'1m'})}`}:{})});
const send=(path,body,user,method='POST')=>fetch(base+path,{method,headers:headers(user),body:JSON.stringify(body)});
test('authenticated feedback enforces ownership, available choice, and no extra data',async()=>{
 const path=`/api/explore/records/${record.id}/reflection`;
 assert.equal((await send(path,{choice:'green'},null,'PUT')).status,401);
 assert.equal((await send(path,{choice:'green'},other,'PUT')).status,404);
 assert.equal((await send(path,{choice:'red'},owner,'PUT')).status,400);
 assert.equal((await send(path,{choice:'green',email:'x'},owner,'PUT')).status,400);
 assert.equal((await send(path,{choice:'green'},owner,'PUT')).status,200);
 assert.equal((await send(path,{choice:'none'},owner,'PUT')).status,200);
 assert.equal((await Record.findById(record.id)).reflection.choice,'none');
 assert.equal(await Record.countDocuments(),1);
 const listed=await fetch(base+'/api/explore/records',{headers:headers(owner)}).then(r=>r.json());assert.equal(listed[0].reflection.choice,'none');
});
test('guest selection updates once per secret and stores neither answers nor raw key',async()=>{
 const body={surveyId:survey.id,key:'b'.repeat(64),choice:'yellow'};
 const path='/api/explore/guest-result-feedback';
 assert.equal((await send(path,body)).status,200);assert.equal((await send(path,{...body,choice:'green'})).status,200);
 assert.equal(await Guest.countDocuments(),1);const doc=await Guest.findOne().lean();assert.equal(doc.choice,'green');assert.notEqual(doc.keyHash,body.key);assert.equal(doc.key,undefined);assert.equal(doc.answers,undefined);
 for(const invalid of [{...body,key:'short'},{...body,choice:'arbitrary'},{...body,answers:[1]},{...body,surveyId:[survey.id]}])assert.equal((await send(path,invalid)).status,400);
 const stats=await statistics();assert.deepEqual(stats.accounts,[{_id:'none',count:1}]);assert.deepEqual(stats.guests,[{_id:'green',count:1}]);
 assert.equal((await fetch(base+'/api/admin/result-feedback-stats')).status,401);
 await Record.create({adminId:new mongoose.Types.ObjectId(),sourceRecordId:record._id,testType:survey.testType,reflection:{choice:'green',updatedAt:new Date(Date.now()+1000)}});
 const imported=await statistics();assert.deepEqual(imported.accounts,[{_id:'green',count:1}],'imported copy and original do not count twice');
});
test('other text validates and survives save, read, statistics, and replacement',async()=>{
 const path=`/api/explore/records/${record.id}/reflection`,guest='/api/explore/guest-result-feedback';
 const text='<img src=x onerror=alert(1)> 我的想法\n第二行';
 for(const invalid of [{choice:'other'},{choice:'other',text:'  '},{choice:'other',text:'x'.repeat(501)},{choice:'other',text:{$gt:''}},{choice:'green',text:'unexpected'}]){
  assert.equal((await send(path,invalid,owner,'PUT')).status,400);
  assert.equal((await send(guest,{surveyId:survey.id,key:'b'.repeat(64),...invalid})).status,400);
 }
 const saved=await send(path,{choice:'other',text:'  '+text+'  '},owner,'PUT');assert.equal(saved.status,200);assert.equal((await saved.json()).text,text);
 assert.equal((await send(guest,{surveyId:survey.id,key:'b'.repeat(64),choice:'other',text})).status,200);
 const rows=await fetch(base+'/api/explore/records',{headers:headers(owner)}).then(r=>r.json());assert.equal(rows[0].reflection.text,text);
 const stats=await statistics();assert.equal(stats.comments.find(r=>r.source==='guest').text,text);
 // The original can be older than its imported copy, but both are still one aggregate result.
 assert.equal(stats.accounts.reduce((sum,r)=>sum+r.count,0),1);
 assert.equal((await send(path,{choice:'none'},owner,'PUT')).status,200);assert.equal((await Record.findById(record.id)).reflection.text,'');
 assert.equal((await send(guest,{surveyId:survey.id,key:'b'.repeat(64),choice:'none'})).status,200);assert.equal((await Guest.findOne()).text,'');
});
test('public endpoint limits repeated requests without adding feedback rows',async()=>{
 let status;for(let i=0;i<45;i++)status=(await send('/api/explore/guest-result-feedback',{surveyId:survey.id,key:'b'.repeat(64),choice:'green'})).status;
 assert.equal(status,429);assert.equal(await Guest.countDocuments(),1);
});
