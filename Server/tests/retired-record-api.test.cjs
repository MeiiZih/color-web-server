const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Record=require('../models/TestRecord');
const Question=require('../models/TestQuestion');
let server,base,recordCalls=0;
const originals={};
before(async()=>{
  for(const method of ['find','findOne','findById','create','updateMany','aggregate']){
    originals[method]=Record[method];Record[method]=()=>{recordCalls++;throw Error('Retired API touched private records');};
  }
  originals.distinct=Question.distinct;Question.distinct=async()=>['fixture-survey'];
  const app=express();app.use(express.json());app.use('/api/test',require('../routes/test'));app.use('/api/user',require('../routes/user'));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;
});
after(()=>{server?.close();for(const [method,value] of Object.entries(originals)){if(method==='distinct')Question.distinct=value;else Record[method]=value;}});
test('all retired private endpoints stop before authentication or record I/O',async()=>{
  const paths=['/test/user-stats/fixture','/test/user-records/fixture/survey','/test/records','/test/recordByInfo','/test/saveRecord','/user/sync-guest-records'];
  for(const path of paths)for(const method of ['GET','POST','HEAD','PUT','DELETE'])for(const suffix of ['', '/?userId[$ne]=&email=fixture@example.invalid']){
    const response=await fetch(base+'/api'+path+suffix,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer deliberately-invalid'},...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify({guestId:{$ne:null},newEmail:'fixture@example.invalid',userId:'fixture'})})});
    assert.equal(response.status,410,method+' '+path+suffix);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  assert.equal(recordCalls,0);
});
test('case variants and anonymous calls cannot bypass retirement',async()=>{
  for(const path of ['/api/TEST/RECORDS','/api/test/recordByInfo','/api/user/SYNC-GUEST-RECORDS'])assert.equal((await fetch(base+path)).status,410);
  assert.equal(recordCalls,0);
});
test('public questionnaire catalog remains available',async()=>{
  const response=await fetch(base+'/api/test/types');assert.equal(response.status,200);assert.deepEqual(await response.json(),['fixture-survey']);
});
