const { test } = require('node:test');
const assert = require('node:assert/strict');
const Homepage = require('../models/Homepage');
const publish = require('../services/publishOfficialContent');
const items = require('../data/officialContent20260906.json');
test('approved batch uses local art and official sources only', () => {
  assert.equal(items.length, 8);
  const allowed = new Set(['1980.org.tw', 'www.life1995.org.tw', 'dep.mohw.gov.tw', 'www.mohw.gov.tw', 'www.tpa-tw.org']);
  for (const item of items) {
    assert(allowed.has(new URL(item.link).hostname));
    assert.match(item.imageUrl, /^\/assets\/images\/colorlab-/);
    if (item.expiresAt) assert(Number.isFinite(Date.parse(item.expiresAt)));
  }
});
test('publication retries are idempotent and later edits/deletions are not overwritten', async () => {
  const originalCollection = Homepage.db.collection, originalUpdate = Homepage.updateOne;
  const rows = new Map(); let marker, calls = 0;
  Homepage.db.collection = () => ({ findOne: async () => marker, updateOne: async (_q, update) => { marker = update.$set; } });
  Homepage.updateOne = async (query, update) => { calls++; if (!rows.has(query._id)) rows.set(query._id, { ...update.$setOnInsert }); };
  try {
    await publish(); assert.equal(rows.size, 8);
    const first = rows.values().next().value; first.title = '管理員自訂標題';
    marker = null; await publish(); assert.equal(rows.size, 8); assert.equal(first.title, '管理員自訂標題');
    rows.delete(rows.keys().next().value);
    const prior = calls; await publish(); assert.equal(calls, prior); assert.equal(rows.size, 7);
  } finally { Homepage.db.collection = originalCollection; Homepage.updateOne = originalUpdate; }
});
