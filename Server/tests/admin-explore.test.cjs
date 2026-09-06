// Disposable local MongoDB only. No production credentials or account writes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { MongoMemoryServer } = require('../../tmp/review-qa/node_modules/mongodb-memory-server');
const User = require('../models/User'), Admin = require('../models/Admin');
const Record = require('../models/TestRecord'), Question = require('../models/TestQuestion');
let mongo, server, base, user, admin, otherAdmin, survey;
const token = (owner, role) => jwt.sign({ id: String(owner._id), role }, process.env.JWT_SECRET, { expiresIn: '1m' });
const call = (path, owner, role, method = 'GET', body) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: `Bearer ${token(owner, role)}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});
const submission = () => ({ surveyId: survey.id, version: survey.version, answers: [0], key: randomUUID() });
before(async () => {
  process.env.JWT_SECRET = 'admin-explore-isolated-test-only';
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'colorlab_admin_explore_isolated' });
  user = await User.create({ email: 'same@example.invalid', password: 'test-only-password', name: 'Member' });
  // Same email AND same id across collections must never merge role ownership.
  admin = await Admin.create({ _id: user._id, email: user.email, password: 'test-only-password', name: 'Administrator' });
  otherAdmin = await Admin.create({ email: 'other@example.invalid', password: 'test-only-password' });
  const question = await Question.create({ testType: 'Isolated survey', totalQuestions: 1, questions: [{ questionNumber: 1, question: 'Choose', options: ['A', 'B'] }] });
  survey = require('../services/explore').catalogEntry(question.toObject());
  const app = express(); app.use(express.json()); app.use('/api/explore', require('../routes/explore'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/explore`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});
test('me verifies Admin existence and returns role without member verification workflow', async () => {
  const r = await call('/me', admin, 'admin'); assert.equal(r.status, 200);
  const body = await r.json(); assert.equal(body.role, 'admin'); assert.equal(body.email, admin.email);
  assert.equal('emailVerificationRequired' in body, false);
  assert.equal((await call('/me', { _id: new mongoose.Types.ObjectId() }, 'admin')).status, 403);
  assert.equal((await call('/me', admin, 'guest')).status, 403);
  assert.equal((await call('/me')).status, 401);
});
test('admin save/list/delete roundtrip is idempotent and owned independently', async () => {
  const body = submission();
  const r = await call('/records', admin, 'admin', 'POST', body); assert.equal(r.status, 201);
  const saved = await r.json(); assert.equal(saved.cloud, true);
  const db = await Record.findById(saved.id).lean();
  assert.equal(String(db.adminId), String(admin._id)); assert.equal(db.userId, undefined); assert.equal(db.email, undefined);
  const again = await call('/records', admin, 'admin', 'POST', body); assert.equal(again.status, 200);
  assert.equal((await again.json()).id, saved.id);
  const userSave = await call('/records', user, 'user', 'POST', body); assert.equal(userSave.status, 201);
  const memberRecord = await userSave.json(); assert.notEqual(memberRecord.id, saved.id);
  const list = await (await call('/records', admin, 'admin')).json();
  assert.deepEqual(list.map(x => x.id), [saved.id]);
  assert.equal((await (await call('/records', user, 'user')).json()).some(x => x.id === saved.id), false);
  assert.deepEqual(await (await call('/records', otherAdmin, 'admin')).json(), []);
  assert.equal((await call('/records/' + saved.id, user, 'user', 'DELETE')).status, 404);
  assert.equal((await call('/records/' + saved.id, otherAdmin, 'admin', 'DELETE')).status, 404);
  assert.equal((await call('/records/' + memberRecord.id, admin, 'admin', 'DELETE')).status, 404);
  assert.equal((await call('/records/' + saved.id, admin, 'admin', 'DELETE')).status, 200);
  assert.equal((await call('/records/' + saved.id, admin, 'admin', 'DELETE')).status, 404);
  assert.ok(await Record.findById(memberRecord.id));
});
test('cursor pagination passes 200 without duplicates and preserves owner boundaries', async () => {
  const timestamp=new Date('2025-01-01');
  const inserted=await Record.insertMany(Array.from({length:205},()=>({adminId:otherAdmin._id,testType:'Page fixture',timestamp})));
  const first=await (await call('/records',otherAdmin,'admin')).json();assert.equal(first.length,200);
  const last=first.at(-1), query='/records?'+new URLSearchParams({before:last.date,beforeId:last.id});
  const second=await (await call(query,otherAdmin,'admin')).json();assert.equal(second.length,5);
  assert.equal(new Set([...first,...second].map(r=>r.id)).size,205);
  const ownerList=await (await call(query,admin,'admin')).json();assert(!ownerList.some(r=>inserted.some(i=>i.id===r.id)));
  assert.equal((await call('/records?before=invalid&beforeId=bad',otherAdmin,'admin')).status,400);
  await Record.deleteMany({_id:{$in:inserted.map(r=>r._id)}});
});
test('legacy same-email records stay with member only; spoofed owners cannot redirect save', async () => {
  const legacy = await Record.create({ email: user.email, testType: 'Legacy fixture' });
  const memberList = await (await call('/records', user, 'user')).json();
  assert.ok(memberList.some(r => r.id === legacy.id));
  const adminList = await (await call('/records', admin, 'admin')).json();
  assert.equal(adminList.some(r => r.id === legacy.id), false);
  assert.equal((await call('/records/' + legacy.id, admin, 'admin', 'DELETE')).status, 404);
  const response = await call('/records', admin, 'admin', 'POST', { ...submission(), adminId: otherAdmin.id, userId: user.id, email: user.email });
  assert.equal(response.status, 201);
  const saved = await Record.findById((await response.json()).id).lean();
  assert.equal(String(saved.adminId), admin.id); assert.equal(saved.userId, undefined); assert.equal(saved.email, undefined);
  assert.equal((await call('/records/' + legacy.id, user, 'user', 'DELETE')).status, 200);
});
test('unverified new member is still blocked; admin duplicate different answers rejected', async () => {
  const pending = await User.create({ email: 'pending@example.invalid', password: 'test-only-password', emailVerificationRequired: true });
  assert.equal((await call('/records', pending, 'user')).status, 403);
  const body = submission(); assert.equal((await call('/records', admin, 'admin', 'POST', body)).status, 201);
  assert.equal((await call('/records', admin, 'admin', 'POST', { ...body, answers: [1] })).status, 409);
  assert.equal((await call('/records', admin, 'admin', 'POST', { ...body, key: randomUUID(), version: 'stale' })).status, 409);
  await assert.rejects(Record.create({ adminId: admin._id, email: user.email, testType: 'Mixed fixture' }), /獨立身分/);
});
test('parallel retries create exactly one administrator record', async () => {
  const body = submission();
  const responses = await Promise.all([call('/records', admin, 'admin', 'POST', body), call('/records', admin, 'admin', 'POST', body)]);
  assert(responses.every(r => [200, 201].includes(r.status)));
  const [first, second] = await Promise.all(responses.map(r => r.json()));
  assert.equal(first.id, second.id);
  assert.equal(await Record.countDocuments({ _id: first.id, adminId: admin._id }), 1);
});
