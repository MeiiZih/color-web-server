const { createHash } = require('node:crypto');
const User = require('../models/User');
const Record = require('../models/TestRecord');
const originalRecordsOnly = { sourceRecordId: null };
const storedFields = ['testType','userName','result','details','exploration','mbtiResult','colorResult','answers','scores','timestamp'];
const id = value => String(value);
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const snapshotValues = source => Object.fromEntries(storedFields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));

async function loadCandidates(admin) {
  const email = String(admin.email || '').trim().toLowerCase();
  if (!email || !admin._id) fail(403, '請重新登入管理員帳號。');
  const users = await User.find({ email }).select('_id').lean();
  // Email alone never overrides a different member's explicit ownership.
  const sources = await Record.find({ email, adminId: null, ...originalRecordsOnly,
    $or: [{ userId: { $in: users.map(user => user._id) } }, { userId: null }] }).sort({ timestamp: -1, _id: 1 }).limit(201).lean();
  if (sources.length > 200) fail(409, '舊紀錄超過本次同步上限，請聯絡管理者分批處理。');
  const copies = await Record.find({ adminId: admin._id, sourceRecordId: { $in: sources.map(source => source._id) } }).select('sourceRecordId').lean();
  const imported = new Set(copies.map(copy => id(copy.sourceRecordId)));
  const snapshot = createHash('sha256').update(JSON.stringify([id(admin._id), email,
    sources.map(source => [id(source._id), source.userId ? id(source.userId) : null, snapshotValues(source)])])).digest('hex');
  return { sources, imported, snapshot };
}

async function previewLegacyRecords(admin) {
  const { sources, imported, snapshot } = await loadCandidates(admin);
  return { candidates: sources.map(source => ({ sourceRecordId: id(source._id), title: source.testType,
    date: source.timestamp, result: source.result || source.mbtiResult || '已完成', alreadyImported: imported.has(id(source._id)) })),
    total: sources.length, pendingCount: sources.length - imported.size, snapshot };
}

async function importLegacyRecords(admin, body = {}) {
  const selected = body.sourceRecordIds;
  if (body.confirm !== true || !Array.isArray(selected) || !selected.length || selected.length > 200 ||
      selected.some(value => typeof value !== 'string' || !/^[a-f\d]{24}$/.test(value)) || new Set(selected).size !== selected.length) fail(400, '請先選取舊紀錄並確認同步。');
  const { sources, imported, snapshot } = await loadCandidates(admin);
  if (body.snapshot !== snapshot) fail(409, '舊紀錄已變更，請重新查看清單再確認。');
  const byId = new Map(sources.map(source => [id(source._id), source]));
  if (selected.some(sourceId => !byId.has(sourceId))) fail(403, '只能同步此管理員信箱下、歸屬已確認的舊紀錄。');
  let created = 0, skipped = 0;
  for (const sourceId of selected) {
    if (imported.has(sourceId)) { skipped++; continue; }
    const source = byId.get(sourceId);
    // Stable ids remain race-safe even before a new database index finishes building.
    const copyId = createHash('sha256').update(`legacy-admin-copy:${id(admin._id)}:${sourceId}`).digest('hex').slice(0, 24);
    try {
      await Record.create({ ...snapshotValues(source), _id: copyId, adminId: admin._id,
        sourceRecordId: source._id, legacyImportedAt: new Date() });
      created++;
    } catch (error) {
      if (error.code !== 11000 || !await Record.exists({ _id: copyId, adminId: admin._id, sourceRecordId: source._id })) throw error;
      skipped++;
    }
  }
  return { imported: created, alreadyImported: skipped, totalSelected: selected.length };
}

module.exports = { previewLegacyRecords, importLegacyRecords, originalRecordsOnly };
