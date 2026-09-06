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
module.exports = {assertIllustration};
