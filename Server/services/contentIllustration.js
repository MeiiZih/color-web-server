const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const registry = require('../data/contentIllustrations.json');
const assets = path.resolve(__dirname, '../../color-web');
function assertIllustration(content) {
 const entry = registry.find(i => i.imageUrl === content?.imageUrl && i.reviewed === true && i.generator && i.prompt);
 const file = entry && /^\/assets\/images\/posts\/[a-z0-9-]+\.webp$/.test(entry.imageUrl) && path.join(assets, entry.imageUrl);
 if (!file || !fs.existsSync(file) || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== entry.sha256) {
  throw Object.assign(new Error('發布前請先生成、檢查並部署此篇貼文的插圖；通用預設圖不能發布。'), {status:400});
 }
 return entry;
}
function assertUniqueIllustrations(contents) {
 const seen = new Set();
 for (const content of contents) {
  const art = assertIllustration(content);
  if (seen.has(art.sha256)) throw Object.assign(new Error('每篇貼文需使用獨立生成的插圖，清單不可重複使用相同圖片。'), {status:400});
  seen.add(art.sha256);
 }
}
// Keep ownership after archival/deletion, so an old illustration is never recycled.
async function claimIllustration(db, content, owner, session) {
 const art = assertIllustration(content), ownerId = String(owner);
 const reused = () => Object.assign(new Error('此插圖已用於其他貼文，請為這篇內容生成新的插圖。'), {status:409});
 const aliases = registry.filter(i => i.sha256 === art.sha256).map(i => i.imageUrl);
 if (await db.collection('homepages').findOne({_id:{$ne:owner},imageUrl:{$in:aliases}}, {session})) throw reused();
 const claims = db.collection('content_illustration_owners');
 try {
  await claims.updateOne({_id:art.sha256}, {$setOnInsert:{ownerId,imageUrl:art.imageUrl,createdAt:new Date()}}, {upsert:true,session});
 } catch (error) { if (error.code === 11000) throw reused(); throw error; }
 if ((await claims.findOne({_id:art.sha256}, {session})).ownerId !== ownerId) throw reused();
 return art;
}
module.exports = {assertIllustration, assertUniqueIllustrations, claimIllustration};
