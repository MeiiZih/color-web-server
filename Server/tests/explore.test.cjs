const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { catalogEntry, recordView, submissionId } = require('../services/explore');
const questions = require('../data/finalSurveyQuestions');
const doc = { _id: '111111111111111111111111', testType: '我在色彩學中的MBTI', questions };

test('catalog identifies only the original 20 x 4 color questionnaire', () => {
  assert.equal(catalogEntry(doc).resultType, 'color-mbti');
  assert.equal(catalogEntry({ ...doc, testType: '自訂問卷' }).resultType, 'receipt');
  assert.equal(catalogEntry({ ...doc, questions: questions.slice(0, 3) }).resultType, 'receipt');
  assert.equal(catalogEntry({ ...doc, questions: [] }), null);
});
test('question revisions change with options, not image/description edits', () => {
  const first = catalogEntry(doc);
  assert.equal(first.version, catalogEntry({ ...doc, description: 'new' }).version);
  const modified = structuredClone(doc); modified.questions[0].options[0] += '!';
  assert.notEqual(first.version, catalogEntry(modified).version);
});
test('record view retains original snapshot and legacy answers', () => {
  const survey = catalogEntry(doc);
  assert.equal(recordView({ _id: 'a', exploration: { survey }, timestamp: new Date() }).survey.version, survey.version);
  assert.equal(recordView({ _id: 'b', testType: 'Old', answers: [] }).legacy, true);
});
test('submission IDs are stable per member, distinct between members', () => {
  const key = 'a'.repeat(36);
  assert.equal(submissionId('one', key), submissionId('one', key));
  assert.notEqual(submissionId('one', key), submissionId('two', key));
  assert.throws(() => submissionId('one', 'bad'));
});

const User = require('../models/User');
const Admin = require('../models/Admin');
const Question = require('../models/TestQuestion');
const Record = require('../models/TestRecord');
const jwt = require('jsonwebtoken');
const express = require('express');
let server, base;
const saved = new Map();
const originals = { user: User.findById, admin: Admin.findById, question: Question.findById, find: Question.find, one: Record.findOne, create: Record.create, records: Record.find };
const member = { _id: '222222222222222222222222', email: 'member@example.invalid', name: 'Test' };
let lastFilter;
before(async () => {
  User.findById = () => ({ select: () => ({ lean: async () => member }) });
  Admin.findById = () => ({ select: () => ({ lean: async () => null }) });
  Question.findById = () => ({ lean: async () => doc });
  Question.find = () => ({ sort: () => ({ lean: async () => [doc] }) });
  Record.findOne = filter => ({ lean: async () => saved.get(filter._id) || null });
  Record.create = async value => { const result = { ...value, timestamp: new Date() }; saved.set(value._id, result); return { toObject: () => result }; };
  Record.find = filter => { lastFilter = filter; return { sort: () => ({ limit: () => ({ lean: async () => [] }) }) }; };
  const app = express(); app.use(express.json()); app.use('/api/explore', require('../routes/explore'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/explore`;
});
after(() => {
  server?.close();
  User.findById = originals.user; Admin.findById = originals.admin; Question.findById = originals.question; Question.find = originals.find;
  Record.findOne = originals.one; Record.create = originals.create; Record.find = originals.records;
});
function headers(role = 'user') {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: member._id, role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1m' })}` };
}
test('catalog is public, records reject unauthenticated and nonexistent admin requests', async () => {
  assert.equal((await fetch(base + '/catalog')).status, 200);
  assert.equal((await fetch(base + '/records')).status, 401);
  assert.equal((await fetch(base + '/records', { headers: headers('admin') })).status, 403);
});
test('record ownership comes from the verified member, not email query parameters', async () => {
  assert.equal((await fetch(base + '/records?email=other@example.invalid', { headers: headers() })).status, 200);
  assert.equal(lastFilter.$or[0].userId, member._id);
  assert.equal(lastFilter.$or[1].email, member.email);
  assert.equal(lastFilter.adminId, null);
});
test('me returns current verification facts without treating legacy members as verified', async () => {
  let data = await (await fetch(base + '/me', { headers: headers() })).json();
  assert.equal(data.emailVerifiedAt, null);
  assert.equal(data.emailVerificationRequired, false);
  member.emailVerifiedAt = '2026-09-06T06:00:00.000Z';
  data = await (await fetch(base + '/me', { headers: headers() })).json();
  assert.equal(data.emailVerifiedAt, member.emailVerifiedAt);
  delete member.emailVerifiedAt;
});
test('submit rejects incomplete/version mismatch and deduplicates repeated submission', async () => {
  const survey = catalogEntry(doc);
  const body = { surveyId: survey.id, version: survey.version, answers: Array(20).fill(0), key: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' };
  const post = value => fetch(base + '/records', { method: 'POST', headers: headers(), body: JSON.stringify(value) });
  assert.equal((await post({ ...body, answers: [0] })).status, 400);
  assert.equal((await post({ ...body, version: 'old' })).status, 409);
  const first = await post(body); assert.equal(first.status, 201);
  const result = await first.json(); assert.equal(result.survey.questions.length, 20);
  assert.equal((await post(body)).status, 200);
  assert.equal(saved.size, 1);
  assert.equal((await post({ ...body, answers: Array(20).fill(1) })).status, 409);
});
