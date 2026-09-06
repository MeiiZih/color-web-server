const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { normalizeEmail, validEmail, configured, consume } = require('./emailVerification');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const genericMessage = '若此信箱符合帳號重設條件，我們會寄出重設連結。未綁定或尚未驗證的會員，請聯絡管理員協助。';
const invalid = () => Object.assign(new Error('重設連結無效、已過期或已使用，請重新申請。'), { status: 400 });
const accounts = { user: User, admin: Admin };

async function sendReset(role, email) {
  const Account = accounts[role], now = new Date();
  const token = crypto.randomBytes(32).toString('hex');
  const account = await Account.findOneAndUpdate({ email,
    ...(role === 'user' ? { emailVerifiedAt: { $ne: null } } : {}),
    $or: [{ passwordResetSendAfter: null }, { passwordResetSendAfter: { $lte: now } }] }, {
    $set: { passwordResetTokenHash: hash(token), passwordResetEmail: email,
      passwordResetExpiresAt: new Date(+now + 30 * 60000), passwordResetSendAfter: new Date(+now + 60000) }
  }, { new: true }).select('_id email');
  if (!account) return;
  await consume('colorlab-send', 100, 86400000); // Shared with account verification, not a new paid sender.
  const url = `https://colorlab-start.onrender.com/app/account.html#${role === 'admin' ? 'admin-' : ''}reset-password/${token}`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: process.env.BREVO_SENDER_NAME || 'ColorLab', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: account.email }], subject: `ColorLab｜${role === 'admin' ? '管理員' : '會員'}密碼重設`,
      textContent: `請開啟以下連結設定新的 ColorLab 密碼：\n${url}\n\n連結有效 30 分鐘，只能使用一次。成功後所有舊登入將失效。若不是你申請，請忽略，不需要回覆密碼或驗證碼。`,
      htmlContent: `<div style="background:#fcf8f4;padding:32px;font-family:Arial,sans-serif;color:#40383c"><h1>ColorLab</h1><h2>重新設定密碼</h2><p>點下方連結設定新密碼，連結有效 30 分鐘，只能使用一次。</p><p><a href="${url}" style="display:inline-block;background:#a34665;color:white;padding:14px 22px;border-radius:12px;text-decoration:none">設定新密碼</a></p><p>成功後所有舊登入將失效。若不是你申請，請忽略此信。我們不會要求你回覆密碼或驗證碼。</p></div>`, tags: ['colorlab-password-reset'] })
  });
  if (!response.ok) throw new Error('Password reset delivery not accepted');
}

async function confirmReset(role, token, password) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalid();
  require('./passwordPolicy')(password);
  const query = { passwordResetTokenHash: hash(token), passwordResetExpiresAt: { $gt: new Date() },
    $expr: { $eq: ['$email', '$passwordResetEmail'] }, ...(role === 'user' ? { emailVerifiedAt: { $ne: null } } : {}) };
  if (!await accounts[role].exists(query)) throw invalid();
  const passwordHash = await bcrypt.hash(password, 10);
  // Password update, JWT revocation and one-time token consumption happen atomically on one document.
  const changed = await accounts[role].findOneAndUpdate({ ...query, passwordResetExpiresAt: { $gt: new Date() } }, {
    $set: { password: passwordHash }, $inc: { sessionVersion: 1 },
    $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '', passwordResetEmail: '' }
  }).select('_id');
  if (!changed) throw invalid();
  return { reset: true, message: '密碼已更新，請重新登入。' };
}

function attachPasswordReset(router, role) {
  if (!accounts[role]) throw new Error('Unsupported reset role');
  router.post('/forgot-password', async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!validEmail(email)) return res.status(400).json({ message: '請輸入有效的電子郵件。' });
      if (!configured()) return res.status(503).json({ message: '重設信服務暫時無法使用，請稍後再試。' });
      await consume(`reset-request:${role}:${email}`, 5, 3600000);
      await consume('reset-request-global', 1000, 15 * 60000);
      res.status(202).json({ message: genericMessage });
      // Lookup and delivery follow the same public response, preventing account-existence timing leaks.
      setImmediate(() => { sendReset(role, email).catch(() => { console.warn('Password reset delivery could not be confirmed.'); }); });
    } catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '暫時無法處理，請稍後再試。' }); }
  });
  router.post('/reset-password', async (req, res) => {
    try {
      const token = req.body?.token;
      await consume(`reset-confirm:${role}:${typeof token === 'string' ? token : 'invalid'}`, 30, 15 * 60000);
      await consume('reset-confirm-global', 1000, 15 * 60000);
      res.json(await confirmReset(role, token, req.body?.password));
    } catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '密碼尚未更新，請稍後再試。' }); }
  });
}
module.exports = { attachPasswordReset, sendReset, confirmReset };
