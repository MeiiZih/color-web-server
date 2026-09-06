const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const jwt=require('jsonwebtoken');
const User=require('../models/User');
const Admin=require('../models/Admin');
const Record=require('../models/TestRecord');
const Rate=require('../models/EmailRateLimit');
const user={_id:'1'.repeat(24),email:'member@example.invalid',name:'Test',save:async()=>{}};
const original={user:User.findById,admin:Admin.findById,record:Record.findById,rate:Rate.findOneAndUpdate};
let server,base;
before(async()=>{
  Rate.findOneAndUpdate=async()=>({count:1});
  User.findById=id=>({select:async()=>String(id)===user._id?user:null});
  Admin.findById=id=>({select:async()=>String(id)==='2'.repeat(24)?{_id:id,name:'Admin'}:null});
  Record.findById=()=>({lean:async()=>({_id:'3'.repeat(24),testType:'Test',answers:[]})});
  const app=express();app.use(express.json());app.use('/api/user',require('../routes/user'));app.use('/api/admin',require('../routes/admin'));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;
});
after(()=>{server?.close();User.findById=original.user;Admin.findById=original.admin;Record.findById=original.record;Rate.findOneAndUpdate=original.rate;});
const headers=role=>({'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:role==='admin'?'2'.repeat(24):user._id,role},process.env.JWT_SECRET||'your-secret-key',{expiresIn:'1m'})});
test('member update requires login and edits only the verified member',async()=>{
  const url=base+'/api/user/update-profile';
  assert.equal((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  assert.equal((await fetch(url,{method:'PUT',headers:headers('admin'),body:'{}'})).status,403);
  const response=await fetch(url,{method:'PUT',headers:headers('user'),body:JSON.stringify({email:'other@example.invalid',userId:'9'.repeat(24),name:'Updated'})});
  assert.equal(response.status,200);assert.equal((await response.json()).user.email,user.email);assert.equal(user.name,'Updated');
});
test('management records, stats and feedback are not public or accessible with a member token',async()=>{
  for(const path of ['/test-records','/test-types','/data-stats','/feedbacks','/records/'+'3'.repeat(24)]){
    assert.equal((await fetch(base+'/api/admin'+path)).status,401,path);
    assert.equal((await fetch(base+'/api/admin'+path,{headers:headers('user')})).status,403,path);
  }
});
test('administrator can read a full record; malformed IDs are rejected',async()=>{
  assert.equal((await fetch(base+'/api/admin/records/'+'3'.repeat(24),{headers:headers('admin')})).status,200);
  assert.equal((await fetch(base+'/api/admin/records/invalid',{headers:headers('admin')})).status,400);
});
test('administrator login accepts normalized email but rejects the removed admin alias',async()=>{
  const findOne=Admin.findOne;let lookups=0;
  Admin.findOne=async({email})=>{lookups++;assert.equal(email,'yehpty@gmail.com');return {_id:'2'.repeat(24),email,matchPassword:async password=>password==='fixture-only',generateToken:Admin.prototype.generateToken};};
  try {
    const login=email=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'fixture-only'})});
    assert.equal((await login('admin')).status,401);assert.equal(lookups,0);
    const response=await login(' YEHpTy@gmail.com ');assert.equal(response.status,200);
    assert.equal((await response.json()).user.role,'admin');assert.equal(lookups,1);
  } finally {Admin.findOne=findOne;}
});
