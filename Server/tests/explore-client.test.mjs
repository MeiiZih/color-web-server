import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocal, request, saveRecord } from '../../color-web/app/client.mjs';
const survey = { id: 'one', version: 'v1', resultType: 'receipt', questions: [{ question: 'A', options: ['one', 'two'] }] };
const record = { id: 'abc', surveyId: 'one', date: new Date().toISOString(), answers: [0], survey };
const storage = value => ({ getItem: () => JSON.stringify(value) });
test('completed history survives deleted/revised questionnaires', () => {
  assert.equal(readLocal(storage({ records: [record] }), 'key', []).records.length, 1);
  assert.equal(readLocal(storage({ records: [record] }), 'key', [{ ...survey, version: 'v2' }]).records[0].survey.version, 'v1');
});
test('question revision invalidates draft but leaves history intact', () => {
  const result = readLocal(storage({ drafts: { one: { version: 'v1', answers: [0], index: 0 } }, records: [record] }), 'key', [{ ...survey, version: 'v2' }]);
  assert.deepEqual(result.drafts, {}); assert.equal(result.records.length, 1);
});
test('invalid answers and inaccessible storage are safely rejected', () => {
  assert.equal(readLocal(storage({ records: [{ ...record, answers: [99] }] }), 'key', []).records.length, 0);
  assert.deepEqual(readLocal({ getItem: () => { throw Error(); } }, 'key', []), { drafts: {}, records: [] });
});

test('admin token is scoped to explore; member token wins and guests stay local', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.sessionStorage;
  const values = { adminToken: 'admin-test' }; let received, calls = 0;
  globalThis.sessionStorage = { getItem: key => values[key] || null };
  globalThis.fetch = async (_path, options) => { calls++; received = options.headers; return { ok: true, json: async () => ({ saved: true }) }; };
  try {
    await request('/api/explore/me'); assert.equal(received.Authorization, 'Bearer admin-test');
    await request('/api/user/profile'); assert.equal(received.Authorization, undefined);
    values.userToken = 'member-test';
    await request('/api/explore/records'); assert.equal(received.Authorization, 'Bearer member-test');
    delete values.userToken;
    assert.deepEqual(await saveRecord(survey, { answers: [0], key: 'local-test' }, { role: 'admin' }), { saved: true });
    assert.equal(received.Authorization, 'Bearer admin-test');
    const before = calls; const guest = await saveRecord(survey, { answers: [0], key: 'guest-test' }, null);
    assert.equal(calls, before); assert.equal(guest.id, 'guest-test');
  } finally { globalThis.fetch = previousFetch; globalThis.sessionStorage = previousStorage; }
});
