// In-memory model stubs only: no database connection, real account, or email transport.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const Admin = require('../models/Admin'), User = require('../models/User'), Rate = require('../models/EmailRateLimit');
const original = { adminId: Admin.findById, adminOne: Admin.findOne, update: Admin.findOneAndUpdate, userOne: User.findOne, rate: Rate.findOneAndUpdate };
const priorSecret = process.env.JWT_SECRET;
const id = 'a'.repeat(24), email = 'admin@example.invalid';
let server, base, state, counters, lookups, writes, databaseFailure, race;
const publicState = () => { const result = { ...state }; delete result.password; return result; };
const account = () => new Admin({ ...state });
const request = (role, route, body, token) => fetch(base + '/api/' + role + route, {
  method: route === '/update-profile' ? 'PUT' : 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body)
});
const login = (role = 'admin', loginEmail = email, password = 'original-fixture-password') => request(role, '/login', { email: loginEmail, password });
const profile = body => request('admin', '/update-profile', body, account().generateToken());
before(async () => {
  process.env.JWT_SECRET = 'auth-hardening-isolated-fixture-only';
  Admin.findById = () => { const result = Promise.resolve(account()); result.select = async () => publicState(); return result; };
  Admin.findOne = async query => { lookups++; return query.email === state.email ? account() : null; };
  User.findOne = async () => { lookups++; return null; };
  Rate.findOneAndUpdate = async query => {
    if (databaseFailure) throw new Error('isolated storage unavailable');
    const count = (counters.get(query._id) || 0) + 1; counters.set(query._id, count); return { count };
  };
  Admin.findOneAndUpdate = (query, update, options) => ({ select: async projection => {
    writes++; assert.equal(projection, '-password'); assert.equal(options.new, true); assert.equal(options.runValidators, true);
    if (race) { const change = race; race = null; await change(); }
    if (query.$expr.$eq[1] !== (state.sessionVersion || 0) || (query.password && query.password !== state.password)) return null;
    Object.assign(state, update.$set);
    if (update.$inc) state.sessionVersion = (state.sessionVersion || 0) + update.$inc.sessionVersion;
    for (const key of Object.keys(update.$unset || {})) delete state[key];
    return publicState();
  } });
  const app = express(); app.use(express.json()); app.use('/api/admin', require('../routes/admin')); app.use('/api/user', require('../routes/user'));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  state = { _id: id, email, name: 'Fixture', department: 'Testing', password: await bcrypt.hash('original-fixture-password', 4), sessionVersion: 4,
    passwordResetTokenHash: 'hash-fixture', passwordResetExpiresAt: new Date(), passwordResetEmail: email };
  counters = new Map(); lookups = writes = 0; databaseFailure = false; race = null;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  Admin.findById = original.adminId; Admin.findOne = original.adminOne; Admin.findOneAndUpdate = original.update; User.findOne = original.userOne; Rate.findOneAndUpdate = original.rate;
  if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret;
});

test('actual admin login issues the current session version after resets', async () => {
  const response = await login('admin', ' ADMIN@EXAMPLE.INVALID '); assert.equal(response.status, 200);
  const data = await response.json(), payload = jwt.verify(data.token, process.env.JWT_SECRET);
  assert.equal(payload.sessionVersion, 4); assert.equal(payload.role, 'admin'); assert.equal(payload.id, id);
  assert.equal(data.user.password, undefined);
});
test('new password requires correct current password and reset-compatible bounds', async () => {
  for (const [body, status] of [
    [{ password: 'new-fixture-password' }, 400], [{ password: 'new-fixture-password', currentPassword: 'wrong' }, 401],
    ...[null, false, 0, [], {}, 'short', 'x'.repeat(73), '中'.repeat(25)].map(password => [{ password, currentPassword: 'original-fixture-password' }, 400])
  ]) { assert.equal((await profile(body)).status, status, JSON.stringify(body)); }
  assert.equal(writes, 0); assert.equal(state.sessionVersion, 4);
});
test('ordinary profile and empty password update preserve credentials and version', async () => {
  const password = state.password;
  for (const body of [{ name: 'Updated' }, { password: '', name: 'Updated again', sessionVersion: 0, passwordResetTokenHash: 'injected' }]) {
    const response = await profile(body); assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.passwordChanged, false); assert.equal(data.user.password, undefined);
    assert.equal(state.password, password); assert.equal(state.sessionVersion, 4); assert.equal(state.passwordResetTokenHash, 'hash-fixture');
  }
});
test('password change atomically revokes old JWT and permits actual fresh login', async () => {
  const old = account().generateToken();
  const response = await profile({ password: 'new-fixture-password', currentPassword: 'original-fixture-password', name: 'Changed' });
  assert.equal(response.status, 200); assert.equal((await response.json()).passwordChanged, true);
  assert(await bcrypt.compare('new-fixture-password', state.password)); assert.equal(state.sessionVersion, 5); assert.equal(state.passwordResetTokenHash, undefined);
  assert.equal((await request('admin', '/update-profile', { name: 'Stale' }, old)).status, 401);
  const fresh = await login('admin', email, 'new-fixture-password'); assert.equal(fresh.status, 200);
  assert.equal(jwt.verify((await fresh.json()).token, process.env.JWT_SECRET).sessionVersion, 5);
});
test('concurrent reset wins over password and ordinary profile updates', async () => {
  for (const body of [{ password: 'new-fixture-password', currentPassword: 'original-fixture-password' }, { name: 'Stale profile', password: '' }]) {
    race = async () => { state.password = await bcrypt.hash('reset-wins-password', 4); state.sessionVersion++; };
    const response = await profile(body); assert.equal(response.status, 409);
    assert(await bcrypt.compare('reset-wins-password', state.password)); assert.equal(state.name, 'Fixture');
    state.password = await bcrypt.hash('original-fixture-password', 4);
  }
});
test('legacy version zero matches without a stored version field', async () => {
  delete state.sessionVersion;
  const response = await profile({ password: 'new-fixture-password', currentPassword: 'original-fixture-password' });
  assert.equal(response.status, 200); assert.equal(state.sessionVersion, 1);
});
test('both login routes limit normalized identities before lookup and keep role buckets distinct', async () => {
  for (const role of ['admin', 'user']) {
    for (let i = 0; i < 10; i++) assert.equal((await login(role, i % 2 ? ' ADMIN@EXAMPLE.INVALID ' : email, 'wrong')).status, 401);
    const previous = lookups; assert.equal((await login(role)).status, 429); assert.equal(lookups, previous);
  }
  assert.equal(lookups, 20);
});
test('shared global limit and unavailable persistent storage fail closed before lookup', async () => {
  const prefix = crypto.createHash('sha256').update('login-global').digest('hex');
  counters.set(prefix + ':' + Math.floor(Date.now() / (15 * 60000)), 1000);
  assert.equal((await login()).status, 429); assert.equal(lookups, 0);
  databaseFailure = true;
  for (const role of ['admin', 'user']) assert.equal((await login(role)).status, 503);
  assert.equal(lookups, 0);
});
test('malformed login passwords never reach account lookup and admin failures use one response', async () => {
  for (const role of ['admin', 'user']) for (const password of [null, [], {}, false]) {
    assert.equal((await login(role, email, password)).status, role === 'admin' ? 401 : 400);
  }
  assert.equal(lookups, 0);
  const unknown = await login('admin', 'unknown@example.invalid');
  const wrong = await login('admin', email, 'wrong');
  assert.equal(unknown.status, 401); assert.equal(wrong.status, 401); assert.deepEqual(await unknown.json(), await wrong.json());
});
test('admin form contains current-password field and clears session only on passwordChanged response', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../color-web/app/account.mjs'), 'utf8');
  assert(source.includes("password('currentPassword','目前密碼','')"));
  assert.match(source, /if\(admin&&result.passwordChanged\)\{dirty=false;clearSession\(\);location.assign\('\/app\/account.html#admin-login'\);return;\}updateSessionUser/);
});
