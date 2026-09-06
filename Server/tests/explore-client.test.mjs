import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocal } from '../../color-web/app/client.mjs';
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
