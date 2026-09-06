const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildDigest, sendDigest } = require('../services/weeklyDigest');
const report = () => ({ weekStart:'2026-08-31', collectionComplete:true, items:[{ action:'add', title:'<測試>', reason:'測試 & 說明', sourceName:'測試來源', sourceUrl:'https://example.org/article' }] });
const env = { BREVO_API_KEY:'synthetic-test-key', BREVO_SENDER_EMAIL:'test@example.org' };
async function directory(t) { const p = await fs.mkdtemp(path.join(os.tmpdir(), 'colorlab-mail-test-')); t.after(() => fs.rm(p, { recursive:true, force:true })); return p; }
test('safe content, fixed memo subject, rejects incomplete or unsafe sources', () => {
  assert.match(buildDigest(report()).htmlContent, /&lt;測試&gt;/);
  assert.throws(() => buildDigest({ ...report(), collectionComplete:false }));
  assert.throws(() => buildDigest({ ...report(), weekStart:'2026-09-01' }));
  const r = report(); r.items[0].sourceUrl = 'javascript:alert(1)'; assert.throws(() => buildDigest(r));
});
test('requires credentials without sending', async t => {
  let calls=0; await assert.rejects(sendDigest(report(), { stateDir:await directory(t), env:{}, transport:async()=>{calls++;} })); assert.equal(calls,0);
});
test('acceptance is persisted; same week is never resent even if edited', async t => {
  const stateDir = await directory(t); let calls=0;
  const transport = async (_, request) => { calls++; const body=JSON.parse(request.body); assert.equal(body.to.length,1); assert.equal(body.to[0].email,'yehpty@gmail.com'); assert.ok(body.headers['Idempotency-Key']); return {ok:true,json:async()=>({messageId:'test-receipt'})}; };
  assert.equal((await sendDigest(report(), {stateDir,env,transport})).status,'accepted');
  const changed = report(); changed.items[0].title='改過';
  assert.equal((await sendDigest(changed, {stateDir,env,transport})).status,'already-accepted'); assert.equal(calls,1);
});
test('timeout leaves uncertain receipt and refuses automatic resend', async t => {
  const stateDir=await directory(t); let calls=0;
  const transport=async()=>{calls++;throw new Error('sensitive provider error');};
  await assert.rejects(sendDigest(report(),{stateDir,env,transport}),/尚未確認/);
  await assert.rejects(sendDigest(report(),{stateDir,env,transport}),/上次寄信結果/); assert.equal(calls,1);
});
test('concurrent requests cannot double-send', async t => {
  const stateDir=await directory(t); let calls=0;
  const transport=async()=>{calls++;await new Promise(r=>setTimeout(r,30));return{ok:true,json:async()=>({messageId:'test'})};};
  const results=await Promise.allSettled([sendDigest(report(),{stateDir,env,transport}),sendDigest(report(),{stateDir,env,transport})]);
  assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('rejected request waits a day; server error and missing receipt stay uncertain', async t => {
  const stateDir=await directory(t);const transport=async()=>({ok:false,status:401});
  await assert.rejects(sendDigest(report(),{stateDir,env,transport}));
  await assert.rejects(sendDigest(report(),{stateDir,env,transport}),/隔日/);
  for(const response of [{ok:false,status:500},{ok:true,json:async()=>({})}]) {
    const dir=await directory(t);await assert.rejects(sendDigest(report(),{stateDir:dir,env,transport:async()=>response}));
    assert.equal(JSON.parse(await fs.readFile(path.join(dir,'2026-08-31.mail.json'),'utf8')).status,'uncertain');
  }
});
