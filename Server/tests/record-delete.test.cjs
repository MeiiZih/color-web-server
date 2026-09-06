// Isolated temporary database only; no production credentials are loaded.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('../../tmp/review-qa/node_modules/mongodb-memory-server');
const User = require('../models/User'), Record = require('../models/TestRecord');
let mongo, server, base, member, other;
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'colorlab_delete_isolated' });
  process.env.JWT_SECRET = 'record-delete-isolated-test-only';
  [member, other] = await User.create([
    { email: 'owner@example.invalid', password: 'test-only-password', name: 'Owner' },
    { email: 'other@example.invalid', password: 'test-only-password', name: 'Other' },
  ]);
  const app = express(); app.use(express.json()); app.use('/api/explore', require('../routes/explore'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/explore/records/`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});
const headers = (role = 'user') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: String(member._id), role }, process.env.JWT_SECRET, { expiresIn: '1m' })}` });
const record = values => Record.create({ email: member.email, testType: 'Isolated fixture', ...values });
const remove = (id, options = {}) => fetch(base + id, { method: 'DELETE', headers: headers(), ...options });
test('owner can delete own record; repeat deletion returns 404', async () => {
  const own = await record({ userId: member._id });
  const result = await remove(own.id);
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { deleted: true });
  assert.equal(await Record.findById(own.id), null);
  assert.equal((await remove(own.id)).status, 404);
});
test('another owner cannot be deleted even with matching email or forged body', async () => {
  const target = await record({ userId: other._id });
  assert.equal((await remove(target.id, { body: JSON.stringify({ userId: other.id, email: other.email }) })).status, 404);
  assert.ok(await Record.findById(target.id));
});
test('legacy records belong only to the authenticated matching email', async () => {
  const own = await record({ userId: null });
  const target = await record({ userId: null, email: other.email });
  assert.equal((await remove(own.id)).status, 200);
  assert.equal((await remove(target.id + '?email=' + other.email)).status, 404);
  assert.ok(await Record.findById(target.id));
});
test('unauthenticated, admin and invalid id attempts do not delete', async () => {
  const own = await record({ userId: member._id });
  assert.equal((await remove(own.id, { headers: {} })).status, 401);
  assert.equal((await remove(own.id, { headers: headers('admin') })).status, 403);
  assert.equal((await remove('invalid-id')).status, 400);
  assert.ok(await Record.findById(own.id));
});
