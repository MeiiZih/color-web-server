const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const User = require('../models/User');
const Verification = require('../models/EmailVerification');
const Rate = require('../models/EmailRateLimit');
const service = require('../services/emailVerification');
const realFetch = global.fetch;
const originals = { save: User.prototype.save, match: User.prototype.matchPassword, find: User.findOne, byId: User.findById, claim: User.findOneAndUpdate, update: User.updateOne, vupdate: Verification.findOneAndUpdate, vfind: Verification.findOne, vdelete: Verification.findOneAndDelete, rate: Rate.findOneAndUpdate };
const users = new Map(), records = new Map(), counters = new Map();
let server, base, delivery = [], mailFailure = false;
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
before(async () => {
  process.env.BREVO_API_KEY = 'fixture-not-a-real-key'; process.env.BREVO_SENDER_EMAIL = 'sender@example.invalid';
  User.prototype.save = async function () { await this.validate(); users.set(String(this._id), this); return this; };
  User.prototype.matchPassword = async function (password) { return password === this.password; };
  User.findOne = async ({ email }) => [...users.values()].find(u => u.email === email);
  User.findById = id => { const user = users.get(String(id)); return { then: resolve => Promise.resolve(resolve(user)), select: async () => user }; };
  User.findOneAndUpdate = async (query, update) => {
    const user = users.get(String(query._id));
    if (!user || user.emailVerifiedAt || user.emailSendAfter > new Date()) return null;
    Object.assign(user, update.$set); return user;
  };
  User.updateOne = async (query, update) => { Object.assign(users.get(String(query._id)), update.$set); return { modifiedCount: 1 }; };
  Rate.findOneAndUpdate = async query => { const count = (counters.get(query._id) || 0) + 1; counters.set(query._id, count); return { count }; };
  Verification.findOneAndUpdate = async (query, update) => { records.set(String(query.userId), { _id: String(query.userId), userId: query.userId, ...update.$set }); };
  Verification.findOne = async query => [...records.values()].find(r => r.tokenHash === query.tokenHash && r.expiresAt > query.expiresAt.$gt);
  Verification.findOneAndDelete = async query => { const r = records.get(String(query._id)); if (r && r.tokenHash === query.tokenHash && r.expiresAt > query.expiresAt.$gt) { records.delete(String(query._id)); return r; } return null; };
  global.fetch = async (url, options) => {
    if (url === 'https://api.brevo.com/v3/smtp/email') { delivery.push(JSON.parse(options.body)); return { ok: !mailFailure }; }
    return realFetch(url, options);
  };
  const app = express(); app.use(express.json()); app.use('/api/user', require('../routes/user'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = 'http://127.0.0.1:' + server.address().port;
});
after(() => {
  server?.close(); global.fetch = realFetch;
  Object.assign(User, { findOne: originals.find, findById: originals.byId, findOneAndUpdate: originals.claim, updateOne: originals.update });
  User.prototype.save = originals.save; User.prototype.matchPassword = originals.match;
  Object.assign(Verification, { findOneAndUpdate: originals.vupdate, findOne: originals.vfind, findOneAndDelete: originals.vdelete }); Rate.findOneAndUpdate = originals.rate;
});
const post = (path, body) => realFetch(base + '/api/user' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const member = email => [...users.values()].find(u => u.email === email);
const mailToken = () => delivery.at(-1).textContent.match(/#verify\/([a-f0-9]{64})/)[1];
test('existing members remain optional and new registrations cannot opt out or obtain a session', async () => {
  const legacy = new User({ email: 'legacy@example.invalid', password: 'fixture-password' }); await legacy.save();
  assert.equal(service.needsVerification(legacy), false); assert.ok(legacy.generateToken());
  const r = await post('/register', { email: ' NEW@example.invalid ', password: 'fixture-password', emailVerificationRequired: false, emailVerifiedAt: new Date() });
  assert.equal(r.status, 202); const data = await r.json(); assert.equal(data.mailSent, true); assert.equal(data.token, undefined);
  const user = member('new@example.invalid'); assert.equal(service.needsVerification(user), true); assert.throws(() => user.generateToken());
  assert.equal((await post('/login', { email: user.email, password: user.password })).status, 403);
  assert.equal((await post('/login', { email: legacy.email, password: legacy.password })).status, 200);
  assert.equal(delivery.at(-1).to[0].email, user.email); assert.equal(records.get(String(user._id)).tokenHash, digest(mailToken()));
  assert.equal(JSON.stringify([...records.values()]).includes(mailToken()), false);
});
test('verification needs password, expires in 24 hours and is consumed once', async () => {
  const token = mailToken(); const user = member('new@example.invalid');
  assert.equal((await post('/email-verification/confirm', { token, password: 'wrong' })).status, 401);
  assert.ok(records.get(String(user._id)));
  const r = await post('/email-verification/confirm', { token, password: user.password });
  assert.equal(r.status, 200); assert.equal((await r.json()).verified, true); assert.equal(service.needsVerification(user), false);
  assert.equal((await post('/email-verification/confirm', { token, password: user.password })).status, 400);
  assert.equal((await post('/login', { email: user.email, password: user.password })).status, 200);
});
test('resend requires ownership, keeps the existing password, and invalidates prior links', async () => {
  const user = member('legacy@example.invalid');
  assert.equal((await post('/email-verification/resend', { email: user.email, password: 'wrong' })).status, 401);
  assert.equal((await post('/email-verification/resend', { email: user.email, password: user.password })).status, 200);
  const oldToken = mailToken();
  assert.equal((await post('/email-verification/resend', { email: user.email, password: user.password })).status, 429);
  user.emailSendAfter = new Date(0);
  await service.sendVerification(user); const token = mailToken(); assert.notEqual(token, oldToken);
  assert.equal((await post('/email-verification/confirm', { token: oldToken, password: user.password })).status, 400);
  records.get(String(user._id)).expiresAt = new Date(0);
  assert.equal((await post('/email-verification/confirm', { token, password: user.password })).status, 400);
  assert.equal(user.password, 'fixture-password'); assert.equal(user.emailVerificationRequired, false);
});
test('provider failure retains a pending account; missing configuration creates no account', async () => {
  mailFailure = true;
  const r = await post('/register', { email: 'failed@example.invalid', password: 'fixture-password' });
  assert.equal(r.status, 202); assert.equal((await r.json()).mailSent, false);
  assert.equal(service.needsVerification(member('failed@example.invalid')), true);
  assert.equal((await post('/login', { email: 'failed@example.invalid', password: 'fixture-password' })).status, 403);
  delete process.env.BREVO_API_KEY;
  assert.equal((await post('/register', { email: 'unavailable@example.invalid', password: 'fixture-password' })).status, 503);
  assert.equal(member('unavailable@example.invalid'), undefined);
  process.env.BREVO_API_KEY = 'fixture-not-a-real-key'; mailFailure = false;
});
test('simultaneous confirmation succeeds only once and malformed links never authenticate', async () => {
  const user = member('failed@example.invalid'); user.emailSendAfter = new Date(0); await service.sendVerification(user);
  const token = mailToken(); const results = await Promise.all([1,2].map(() => post('/email-verification/confirm', { token, password: user.password })));
  assert.deepEqual(results.map(r => r.status).sort(), [200,400]);
  assert.equal((await post('/email-verification/confirm', { token: 'invalid', password: user.password })).status, 400);
});
test('persistent counters enforce daily per-member limits without storing raw IPs', async () => {
  const user = member('legacy@example.invalid');
  for (let i=0;i<3;i++) { user.emailSendAfter = new Date(0); await service.sendVerification(user); }
  user.emailSendAfter = new Date(0); await assert.rejects(service.sendVerification(user), e => e.status === 429);
  assert.equal([...counters.keys()].some(key => key.includes('127.0.0.1')), false);
});
