const fs = require('node:fs/promises');
const path = require('node:path');
const { buildDigest, sendDigest } = require('../Server/services/weeklyDigest');
const folder = path.resolve(__dirname, '../tmp/content-review');
(async () => {
  const week = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week || '') || process.argv.slice(3).some(a => a !== '--dry-run')) throw new Error('請指定週一日期，可加 --dry-run 預覽，不會寄信。');
  const report = JSON.parse(await fs.readFile(path.join(folder, week + '.json'), 'utf8'));
  if (report.weekStart !== week) throw new Error('檔名與清單週別不同。');
  try {
    const receipt=JSON.parse(await fs.readFile(path.join(folder,week+'.sync.json'),'utf8'));
    report.reviewReady=receipt.status==='synced'&&receipt.reportHash===require('node:crypto').createHash('sha256').update(JSON.stringify(report)).digest('hex');
  } catch { report.reviewReady=false; }
  if(!report.reviewReady&&!process.argv.includes('--dry-run'))throw new Error('請先將本週清單同步至後台，未同步不寄摘要信。');
  if (process.argv.includes('--dry-run')) {
    const content = buildDigest(report);
    console.log('預覽模式，沒有寄信。\n' + content.textContent);
  } else {
    const result = await sendDigest(report, { stateDir:folder });
    console.log(result.status === 'accepted' ? '寄信平台已接受本週摘要，尚不代表已送達收件匣。' : '本週摘要先前已獲平台接受，沒有重寄。');
  }
})().catch(error => { console.error(error.code === 'ENOENT' ? '尚未找到本週審核清單，沒有寄信。' : error.message); process.exitCode = 1; });
