// Isolated database and intercepted Brevo transport: never sends real email or reads live accounts.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose=require('mongoose'),express=require('express'),jwt=require('jsonwebtoken'),crypto=require('node:crypto');
const {MongoMemoryServer}=require('../../tmp/review-qa/node_modules/mongodb-memory-server');
const User=require('../models/User'),Admin=require('../models/Admin'),Rate=require('../models/EmailRateLimit');
const reset=require('../services/passwordReset');
const realFetch=global.fetch,hash=t=>crypto.createHash('sha256').update(t).digest('hex');
let mongo,server,base,user,admin,unverified,deliveries=[],mailFailure=false;
const post=(role,path,body)=>realFetch(base+'/api/'+role+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const authenticated=(path,token,method='GET')=>realFetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
const sentToken=role=>deliveries.filter(x=>x.subject.includes(role==='admin'?'管理員':'會員')).at(-1).textContent.match(/reset-password\/([a-f0-9]{64})/)[1];
before(async()=>{
  process.env.JWT_SECRET='reset-isolated-fixture-only';process.env.BREVO_API_KEY='not-a-real-key';process.env.BREVO_SENDER_EMAIL='sender@example.invalid';
  mongo=await MongoMemoryServer.create({binary:{version:'7.0.14'}});await mongoose.connect(mongo.getUri(),{dbName:'colorlab_password_reset_isolated'});
  await Promise.all([User.init(),Admin.init()]);
  global.fetch=async(url,options)=>{if(url==='https://api.brevo.com/v3/smtp/email'){deliveries.push(JSON.parse(options.body));return{ok:!mailFailure};}return realFetch(url,options);};
  const app=express();app.use(express.json());app.use('/api/user',require('../routes/user'));app.use('/api/admin',require('../routes/admin'));app.use('/api/explore',require('../routes/explore'));app.use('/api/survey',require('../routes/survey'));app.use('/api/homepage',require('../routes/homepage'));app.use('/api/review',require('../middleware/adminProtect'),require('../routes/contentReview').adminRouter());
  app.use((_error,_req,res,_next)=>res.status(500).json({message:'isolated error'}));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{
  await Promise.all([User.deleteMany({}),Admin.deleteMany({}),Rate.deleteMany({})]);deliveries=[];mailFailure=false;
  user=await User.create({email:'same@example.invalid',password:'original-password',emailVerifiedAt:new Date()});
  admin=await Admin.create({email:user.email,password:'original-password'});
  unverified=await User.create({email:'unverified@example.invalid',password:'original-password'});
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));global.fetch=realFetch;await mongoose.disconnect();if(mongo)await mongo.stop();});

test('request is generic for known, unknown and unverified accounts; only verified member receives reset',async()=>{
  const known=await post('user','/forgot-password',{email:user.email});assert.equal(known.status,202);const body=await known.json();
  for(const email of ['missing@example.invalid',unverified.email]){const response=await post('user','/forgot-password',{email});assert.equal(response.status,202);assert.deepEqual(await response.json(),body);}
  for(let i=0;i<100&&deliveries.length<1;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(deliveries.length,1);assert.equal(deliveries[0].to[0].email,user.email);assert(!JSON.stringify(body).includes('token'));
  const token=sentToken('user'),stored=await User.findById(user._id).select('+passwordResetTokenHash +passwordResetExpiresAt +passwordResetEmail');
  assert.equal(token.length,64);assert.equal(stored.passwordResetTokenHash,hash(token));assert.notEqual(stored.passwordResetTokenHash,token);
  assert(stored.passwordResetExpiresAt-Date.now()<=30*60000);assert.equal(stored.passwordResetEmail,user.email);
  const visible=await User.findById(user._id).lean();assert.equal(visible.passwordResetTokenHash,undefined);
});
test('unverified legacy/new members never gain reset and configured admin email gets its own role URL',async()=>{
  await reset.sendReset('user',unverified.email);assert.equal(deliveries.length,0);
  await User.updateOne({_id:unverified._id},{$set:{emailVerificationRequired:true}});
  await reset.sendReset('user',unverified.email);assert.equal(deliveries.length,0);
  await reset.sendReset('admin',admin.email);assert.equal(deliveries.length,1);
  assert(deliveries[0].textContent.includes('/app/account.html#admin-reset-password/'));
  assert.equal((await post('user','/reset-password',{token:sentToken('admin'),password:'new-password'})).status,400);
  assert(await(await User.findById(user._id)).matchPassword('original-password'));
});
test('successful member reset is atomic, role-isolated and revokes all member JWT guard paths',async()=>{
  const old=user.generateToken(),oldLegacy=jwt.sign({id:user.id,role:'user'},process.env.JWT_SECRET),adminToken=admin.generateToken();
  await reset.sendReset('user',user.email);const token=sentToken('user');
  const response=await post('user','/reset-password',{token,password:'new-safe-password'});assert.equal(response.status,200);assert.equal((await response.json()).reset,true);
  const changed=await User.findById(user._id).select('+passwordResetTokenHash');assert(await changed.matchPassword('new-safe-password'));assert(!await changed.matchPassword('original-password'));assert.equal(changed.passwordResetTokenHash,undefined);assert.equal(changed.sessionVersion,1);
  for(const route of ['/api/user/profile','/api/survey/history','/api/explore/me'])for(const token of [old,oldLegacy])assert.equal((await authenticated(route,token)).status,401,route);
  assert.equal((await authenticated('/api/explore/me',changed.generateToken())).status,200);
  assert.equal((await authenticated('/api/explore/me',adminToken)).status,200);
  assert.equal((await post('user','/reset-password',{token,password:'another-password'})).status,400);
});
test('admin reset revokes every admin guard while preserving same-email member account',async()=>{
  const old=admin.generateToken(),memberToken=user.generateToken();await reset.sendReset('admin',admin.email);
  const response=await post('admin','/reset-password',{token:sentToken('admin'),password:'new-admin-password'});assert.equal(response.status,200);
  for(const [route,method]of[['/api/admin/users','GET'],['/api/homepage','POST'],['/api/review/current','GET'],['/api/explore/me','GET']])assert.equal((await authenticated(route,old,method)).status,401,route);
  const changed=await Admin.findById(admin._id);assert(await changed.matchPassword('new-admin-password'));assert.equal((await authenticated('/api/admin/users',changed.generateToken())).status,200);
  const login=await post('admin','/login',{email:admin.email,password:'new-admin-password'});assert.equal(login.status,200);
  const freshToken=(await login.json()).token;assert.equal(jwt.verify(freshToken,process.env.JWT_SECRET).sessionVersion,1);assert.equal((await authenticated('/api/admin/users',freshToken)).status,200);
  assert.equal((await authenticated('/api/user/profile',memberToken)).status,200);assert(await(await User.findById(user._id)).matchPassword('original-password'));
});
test('expiry, superseded token, changed email and overlong bcrypt password cannot reset',async()=>{
  await reset.sendReset('user',user.email);const first=sentToken('user');
  assert.equal((await post('user','/reset-password',{token:first,password:'x'.repeat(73)})).status,400);
  assert.equal((await post('user','/reset-password',{token:first,password:'中'.repeat(25)})).status,400);
  await User.updateOne({_id:user._id},{$set:{passwordResetSendAfter:new Date(0)}});await reset.sendReset('user',user.email);const second=sentToken('user');assert.notEqual(first,second);
  await assert.rejects(reset.confirmReset('user',first,'new-password'),{status:400});
  await User.updateOne({_id:user._id},{$set:{passwordResetExpiresAt:new Date(0)}});await assert.rejects(reset.confirmReset('user',second,'new-password'),{status:400});
  await User.updateOne({_id:user._id},{$set:{passwordResetExpiresAt:new Date(Date.now()+60000),email:'changed@example.invalid'}});await assert.rejects(reset.confirmReset('user',second,'new-password'),{status:400});
});
test('concurrent consumption changes exactly once; failed database update leaves token usable',async()=>{
  await reset.sendReset('user',user.email);const token=sentToken('user'),original=User.findOneAndUpdate;
  User.findOneAndUpdate=()=>{throw new Error('isolated database failure');};
  try{await assert.rejects(reset.confirmReset('user',token,'new-password'),/database failure/);}finally{User.findOneAndUpdate=original;}
  const results=await Promise.allSettled([reset.confirmReset('user',token,'new-password'),reset.confirmReset('user',token,'new-password')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await User.findById(user._id)).sessionVersion,1);
});
test('request limits persist for nonexistent identities, provider failures never change password',async()=>{
  for(let i=0;i<5;i++)assert.equal((await post('user','/forgot-password',{email:'none@example.invalid'})).status,202);
  assert.equal((await post('user','/forgot-password',{email:'none@example.invalid'})).status,429);
  mailFailure=true;await assert.rejects(reset.sendReset('user',user.email),/not accepted/);assert(await(await User.findById(user._id)).matchPassword('original-password'));
});

test('admin profile CAS uses real MongoDB and does not overwrite a concurrent reset',async()=>{
  const old=admin.generateToken();
  const updateProfile=body=>realFetch(base+'/api/admin/update-profile',{method:'PUT',headers:{Authorization:'Bearer '+admin.generateToken(),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const ordinary=await updateProfile({name:'Profile only',password:''});assert.equal(ordinary.status,200);assert.equal((await ordinary.json()).passwordChanged,false);
  assert.equal((await Admin.findById(admin._id)).sessionVersion,0);
  const change=await updateProfile({password:'changed-admin-password',currentPassword:'original-password'});assert.equal(change.status,200);assert.equal((await change.json()).passwordChanged,true);
  admin=await Admin.findById(admin._id);assert.equal(admin.sessionVersion,1);assert(await admin.matchPassword('changed-admin-password'));
  for(const [route,method]of[['/api/admin/users','GET'],['/api/homepage','POST'],['/api/review/current','GET'],['/api/explore/me','GET']])assert.equal((await authenticated(route,old,method)).status,401,route);
  const login=await post('admin','/login',{email:admin.email,password:'changed-admin-password'});assert.equal(login.status,200);assert.equal((await authenticated('/api/admin/users',(await login.json()).token)).status,200);
  await reset.sendReset('admin',admin.email);const token=sentToken('admin'),original=Admin.findOneAndUpdate;
  Admin.findOneAndUpdate=function(query,...args){
    if(query.password){return{select:async()=>{Admin.findOneAndUpdate=original;await reset.confirmReset('admin',token,'reset-wins-password');return original.call(Admin,query,...args).select('-password');}};}
    return original.call(Admin,query,...args);
  };
  try{assert.equal((await updateProfile({password:'stale-password-change',currentPassword:'changed-admin-password'})).status,409);}finally{Admin.findOneAndUpdate=original;}
  const after=await Admin.findById(admin._id);assert.equal(after.sessionVersion,2);assert(await after.matchPassword('reset-wins-password'));
});
