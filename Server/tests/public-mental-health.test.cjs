const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Homepage = require('../models/Homepage');
const TestQuestion = require('../models/TestQuestion');
const publish = require('../services/publishPublicMentalHealth');
const items = require('../data/publicMentalHealth20260906.json');

test('public content carries primary sources, checked events and an actual journal DOI', () => {
  assert.equal(items.length, 6);
  const hosts = new Set(['www.1980.org.tw', 'www.twtcpa.org.tw', 'www.gov.tw', 'www.nature.com']);
  for (const item of items) {
    assert(hosts.has(new URL(item.link).hostname));
    assert(item.sourceName && item.description && item.contentKind);
    assert.doesNotMatch(item.title + item.description, /臺中科技大學|台中科大|本校學生/);
    if (item.contentKind === 'workshop') {
      assert(item.registrationUrl.startsWith('https://'));
      assert(item.expiresAt && Date.parse(item.expiresAt) > Date.parse('2026-09-06'));
      assert.match(item.description, /名額.*主辦確認/);
    }
    if (item.contentKind === 'paper') assert.match(item.description, /DOI：10\./);
  }
});

test('archive precedes deletion, exact school copy is replaced, retries preserve manual changes', async () => {
  const original = [Homepage.db.collection, Homepage.find, Homepage.deleteOne, Homepage.updateOne, TestQuestion.updateMany];
  const events = [], rows = new Map(); let marker, remaining = [{ _id: 'old1', updatedAt: new Date(0), title: '舊活動' }];
  Homepage.db.collection = name => name === 'site_migrations'
    ? { findOne: async () => marker, updateOne: async (_q, u) => { marker = u.$set; } }
    : { updateOne: async (_q, u) => { assert.equal(u.$set.original.title, '舊活動'); events.push('backup'); } };
  Homepage.find = query => { assert(query.imageUrl.test('/assets/images/act6.jpg')); assert.equal(query.type, 'news'); return { lean: async () => remaining }; };
  Homepage.deleteOne = async query => { assert.deepEqual(query.updatedAt, new Date(0)); assert.equal(events.at(-1), 'backup'); events.push('delete'); remaining = []; return { deletedCount: 1 }; };
  Homepage.updateOne = async (q, u) => { if (!rows.has(q._id)) rows.set(q._id, u.$setOnInsert); };
  TestQuestion.updateMany = async (q, u) => { assert(q.description.startsWith('我們是國立臺中科技大學')); assert.deepEqual(Object.keys(u.$set), ['description']); };
  try {
    await publish(); assert.deepEqual(events, ['backup', 'delete']); assert.equal(rows.size, 6);
    const first = rows.values().next().value; first.title = '手動修改';
    marker = null; await publish(); assert.equal(first.title, '手動修改'); assert.equal(rows.size, 6);
    rows.delete(rows.keys().next().value); await publish(); assert.equal(rows.size, 5);
    marker = null; remaining = [{ _id: 'old1', updatedAt: new Date(0), title: '舊活動' }];
    Homepage.db.collection = name => name === 'site_migrations' ? { findOne: async () => null } : { updateOne: async () => { throw new Error('backup failed'); } };
    const deletes = events.filter(e => e === 'delete').length;
    await assert.rejects(publish(), /backup failed/);
    assert.equal(events.filter(e => e === 'delete').length, deletes);
  } finally { [Homepage.db.collection, Homepage.find, Homepage.deleteOne, Homepage.updateOne, TestQuestion.updateMany] = original; }
});

test('current public app no longer presents school affiliation or seeds campus posters', () => {
  for (const file of ['color-web/app/app.js', 'color-web/app/account.mjs', 'color-web/app/account.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), /國立臺中科技大學|臺中科技大學|台中科大/);
  }
  assert.match(fs.readFileSync(path.join(__dirname, '../services/seedDefaultContent.js'), 'utf8'), /const defaultNews = \[\]/);
});
