const { createHash } = require('node:crypto');
const Homepage = require('../models/Homepage');
const items = require('../data/officialContent20260906.json');
const publication = 'official-content-2026-09-06';

module.exports = async function publishOfficialContent() {
  const migrations = Homepage.db.collection('site_migrations');
  if ((await migrations.findOne({ _id: publication }))?.completedAt) return;
  for (const item of items) {
    // Stable IDs make retries safe; setOnInsert preserves subsequent manual edits.
    const id = createHash('sha256').update(publication + item.type + item.link).digest('hex').slice(0, 24);
    await Homepage.updateOne({ _id: id }, { $setOnInsert: {
      ...item, sourceCheckedAt: '2026-09-06', createdAt: new Date('2026-09-06T06:00:00Z'), updatedAt: new Date(),
    } }, { upsert: true });
  }
  await migrations.updateOne({ _id: publication }, { $set: { completedAt: new Date(), count: items.length } }, { upsert: true });
  console.log(`Official content published: ${items.length} items (${publication})`);
};
