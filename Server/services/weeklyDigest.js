const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const RECIPIENT = 'yehpty@gmail.com';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
function sourceUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function buildDigest(report) {
  const week = report?.weekStart;
  const date = new Date(week + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week || '') || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== week || date.getUTCDay() !== 1) throw new Error('清單週別必須是當週星期一日期。');
  if (report.collectionComplete !== true || !Array.isArray(report.items) || report.items.length > 60) throw new Error('請先完成並保存本週清單，最多 60 筆。');
  const actions = { add:'建議新增', update:'建議更正', remove:'建議下架' };
  for (const item of report.items) {
    if (!item || !actions[item.action] || !text(item.title, 200) || !text(item.reason, 1500) || !text(item.sourceName, 200) || !text(item.sourceUrl, 2000) || !sourceUrl(item.sourceUrl)) throw new Error('每筆清單需有有效的分類、標題、理由與原始來源。');
  }
  if (report.sourceFailures !== undefined && (!Array.isArray(report.sourceFailures) || report.sourceFailures.length > 40 || report.sourceFailures.some(s => !text(s, 300)))) throw new Error('來源查核限制格式不正確。');
  const counts = Object.entries(actions).map(([key, label]) => `${label} ${report.items.filter(i => i.action === key).length} 筆`).join('／');
  const note = report.reviewReady ? '清單已同步至管理後台。這是待審建議，不代表已發布或下架；登入後勾選並確認核准才會套用。\nhttps://colorlab-start.onrender.com/app/account.html#content-review' : '這是待審建議，不代表已發布或下架。清單尚未確認同步至後台；請勿將信件當成核准紀錄。';
  const limitations = (report.sourceFailures || []).length ? '\n未能完整查核的來源：\n' + report.sourceFailures.join('\n') : '';
  const lines = report.items.map(i => `[${actions[i.action]}] ${i.title}\n理由：${i.reason}\n來源：${i.sourceName}\n${i.sourceUrl}`).join('\n\n');
  const subject = `ColorLab 每週資訊 memo｜${week}`;
  const textContent = `${subject}\n${counts}\n\n${note}\n\n${lines || '本週沒有新增、更正或下架建議。'}${limitations}`;
  const htmlContent = `<div style="background:#fcf8f4;padding:28px;color:#40383c;font:16px/1.7 Arial,sans-serif"><h1>ColorLab</h1><h2>${escape(subject)}</h2><p>${escape(counts)}</p><p>${escape(note)}</p>${report.items.map(i => `<section style="background:white;padding:20px;margin:16px 0;border-radius:12px"><small>${actions[i.action]}</small><h3>${escape(i.title)}</h3><p>${escape(i.reason)}</p><p>${escape(i.sourceName)} · <a href="${escape(i.sourceUrl)}">查看原始來源</a></p></section>`).join('') || '<p>本週沒有新增、更正或下架建議。</p>'}<p style="white-space:pre-wrap">${escape(limitations)}</p></div>`;
  return { subject, textContent, htmlContent:htmlContent.replace('</h2>', '</h2>'+(report.reviewReady?'<p><a href="https://colorlab-start.onrender.com/app/account.html#content-review" style="background:#9d4565;color:white;padding:12px 18px;border-radius:10px;display:inline-block">進入後台審核清單</a></p>':'')) };
}

async function sendDigest(report, { stateDir, env = process.env, transport = fetch, now = () => new Date() } = {}) {
  const content = buildDigest(report);
  if (!env.BREVO_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BREVO_SENDER_EMAIL || '')) throw new Error('尚未設定本機寄信憑證；沒有寄出信件。');
  if (!stateDir) throw new Error('未指定寄信紀錄位置。');
  await fs.mkdir(stateDir, { recursive: true });
  const key = crypto.createHash('sha256').update(report.weekStart + ':' + RECIPIENT).digest('hex');
  const stateFile = path.join(stateDir, report.weekStart + '.mail.json');
  const lockFile = stateFile + '.lock';
  let lock;
  try { lock = await fs.open(lockFile, 'wx'); } catch (e) {
    if (e.code === 'EEXIST') throw new Error('另一個寄信程序可能仍在執行；請先查核，勿重寄。');
    throw e;
  }
  const save = state => fs.writeFile(stateFile, JSON.stringify({ weekStart:report.weekStart, recipient:RECIPIENT, updatedAt:now().toISOString(), ...state }, null, 2));
  try {
    let old;
    try { old = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('寄信紀錄無法讀取，為避免重複寄信已停止。'); }
    if (old?.status === 'accepted') return { status:'already-accepted' };
    if (old && old.status !== 'rejected') throw new Error('上次寄信結果尚未確認；請先查核寄信平台，不自動重寄。');
    if (old?.status === 'rejected' && +now() - Date.parse(old.updatedAt) < 86400000) throw new Error('本日寄信曾被拒絕，請修正設定後隔日再試。');
    // Persist before the external write: timeout/crash must never trigger blind retries.
    await save({ status:'sending', idempotencyKey:key });
    let response;
    try {
      response = await transport('https://api.brevo.com/v3/smtp/email', {
        method:'POST', signal:AbortSignal.timeout(15000),
        headers:{ 'api-key':env.BREVO_API_KEY, 'Content-Type':'application/json', Accept:'application/json' },
        body:JSON.stringify({ sender:{ name:env.BREVO_SENDER_NAME || 'ColorLab', email:env.BREVO_SENDER_EMAIL }, to:[{ email:RECIPIENT }], ...content, headers:{ 'Idempotency-Key':key }, tags:['colorlab-weekly-digest'] })
      });
      if (!response.ok) {
        await save({ status: [400,401,402,403,404,413,422,429].includes(response.status) ? 'rejected' : 'uncertain', httpStatus:response.status, idempotencyKey:key });
        throw new Error('寄信平台未確認接受本週摘要；沒有標記寄送成功。');
      }
      const receipt = await response.json();
      if (typeof receipt.messageId !== 'string' || !receipt.messageId) throw new Error('寄信回覆缺少確認紀錄。');
      await save({ status:'accepted', messageId:receipt.messageId, idempotencyKey:key });
      return { status:'accepted' };
    } catch (e) {
      const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      if (state.status === 'sending') await save({ status:'uncertain', idempotencyKey:key });
      // Never echo provider payloads or credentials.
      throw new Error('本週摘要尚未確認寄出；請查閱寄信紀錄，勿盲目重寄。');
    }
  } finally { await lock.close(); await fs.unlink(lockFile); }
}
module.exports = { buildDigest, sendDigest };
