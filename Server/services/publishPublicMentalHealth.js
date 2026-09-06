const { createHash } = require('node:crypto');
const Homepage = require('../models/Homepage');
const TestQuestion = require('../models/TestQuestion');
const items = require('../data/publicMentalHealth20260906.json');
const publication = 'public-mental-health-2026-09-06';
const legacyDescription = '我們是國立臺中科技大學資訊管理系的學生。此份問卷主要想探討 MBTI 與色彩學之間的聯繫。整份問卷共有 20 道題目，約需 6 分鐘，請依第一直覺作答。';
const description = '從日常選擇探索個性與色彩的連結。共 20 題，約需 6 分鐘，請依第一直覺作答。本測驗僅供自我探索，不能取代心理師或醫師的專業評估。';

module.exports = async function publishPublicMentalHealth() {
  const migrations = Homepage.db.collection('site_migrations');
  if ((await migrations.findOne({ _id: publication }))?.completedAt) return;
  const archives = Homepage.db.collection('homepage_archives');
  const old = await Homepage.find({ type: 'news', imageUrl: /^\/assets\/images\/act[1-6]\./ }).lean();
  for (const item of old) {
    // Back up each exact record before removal; never remove a concurrent administrator edit.
    await archives.updateOne({ _id: item._id }, { $set: { original: item, reason: publication, archivedAt: new Date() } }, { upsert: true });
    const result = await Homepage.deleteOne({ _id: item._id, updatedAt: item.updatedAt });
    if (result.deletedCount !== 1) throw new Error('Historical content changed during archiving; retry publication.');
  }
  for (const item of items) {
    const id = createHash('sha256').update(publication + item.type + item.link).digest('hex').slice(0, 24);
    await Homepage.updateOne({ _id: id }, { $setOnInsert: { ...item, sourceCheckedAt: '2026-09-06', createdAt: new Date('2026-09-06T07:30:00Z'), updatedAt: new Date() } }, { upsert: true });
  }
  await TestQuestion.updateMany({ testType: { $in: ['我在色彩學中的MBTI', '色彩性格測驗'] }, description: legacyDescription }, { $set: { description } });
  await migrations.updateOne({ _id: publication }, { $set: { completedAt: new Date(), count: items.length, archivedCount: old.length } }, { upsert: true });
  console.log(`Public mental health published: ${items.length} new items; ${old.length} historical activities archived`);
};
