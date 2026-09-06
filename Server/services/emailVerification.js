const crypto = require('node:crypto');
const User = require('../models/User');
const Verification = require('../models/EmailVerification');
const Rate = require('../models/EmailRateLimit');
const HOURS_24 = 86400000;
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const needsVerification = user => user.emailVerificationRequired === true && !user.emailVerifiedAt;
const configured = () => Boolean(process.env.BREVO_API_KEY && validEmail(process.env.BREVO_SENDER_EMAIL || ''));
const failure = (status, message) => Object.assign(new Error(message), { status });

// Shared, persistent limits survive restarts and concurrent requests. Store no IP address.
async function consume(key, maximum, period) {
  const bucket = Math.floor(Date.now() / period);
  const counter = await Rate.findOneAndUpdate({ _id: hash(key) + ':' + bucket },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * period) } },
    { upsert: true, new: true });
  if (counter.count > maximum) throw failure(429, '操作次數較多，請稍後再試。');
}
async function limitRequest(req, res, next) {
  try {
    // Identity-based limits avoid treating all visitors behind Render's proxy as one IP.
    const identity = req.user?._id || normalizeEmail(req.body.email) || (typeof req.body.token === 'string' ? req.body.token : 'invalid');
    await consume('request:' + identity, 30, 15 * 60000);
    await consume('request-global', 1000, 15 * 60000);
    next();
  }
  catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '暫時無法驗證，請稍後再試。' }); }
}
async function sendVerification(user) {
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  if (!configured()) throw failure(503, '驗證信服務尚未準備好，請稍後再試。');
  const now = new Date();
  const claimed = await User.findOneAndUpdate({ _id: user._id, emailVerifiedAt: null,
    $or: [{ emailSendAfter: { $exists: false } }, { emailSendAfter: { $lte: now } }] },
    { $set: { emailSendAfter: new Date(now.getTime() + 60000) } }, { new: true });
  if (!claimed) throw failure(429, '請等候 60 秒後再寄送驗證信。');
  await consume('user:' + user._id, 5, HOURS_24);
  await consume('colorlab-send', 100, HOURS_24);
  const token = crypto.randomBytes(32).toString('hex');
  await Verification.findOneAndUpdate({ userId: user._id }, { $set: {
    tokenHash: hash(token), expiresAt: new Date(now.getTime() + HOURS_24)
  } }, { upsert: true });
  // Fixed first-party destination, never derived from an untrusted Host header.
  const url = 'https://colorlab-start.onrender.com/app/account.html#verify/' + token;
  let response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'ColorLab', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: user.email }], subject: 'ColorLab｜確認你的電子郵件',
        textContent: `請開啟以下連結並輸入你的 ColorLab 密碼，確認電子郵件：\n${url}\n\n連結有效 24 小時，重新寄送後舊連結即失效。若不是你申請，請忽略此信。ColorLab 不會要求你回覆密碼。`,
        htmlContent: `<div style="background:#fcf8f4;padding:32px;font-family:Arial,sans-serif;color:#40383c"><h1>ColorLab</h1><p>每一面，都是你。</p><h2>確認你的電子郵件</h2><p>開啟下方連結，並輸入你的 ColorLab 密碼完成驗證。</p><p><a style="display:inline-block;background:#a34665;color:white;padding:14px 22px;border-radius:12px;text-decoration:none" href="${url}">驗證我的 Email</a></p><p>連結有效 24 小時；重新寄送後，請使用最新一封信。</p><p>若不是你申請，請忽略此信。我們不會要求你回覆密碼。</p></div>`,
        tags: ['colorlab-email-verification']
      })
    });
  } catch { throw failure(503, '暫時無法確認寄信結果，請稍後查看信箱，或等候 60 秒再重寄。'); }
  // Do not log provider payloads, credentials, verification links or user addresses.
  if (!response.ok) throw failure(503, '驗證信暫時無法寄出，請稍後重試；帳號仍保留。');
  return { mailSent: true, retryAfter: 60 };
}
async function confirmVerification(token, password) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string') throw failure(400, '驗證連結無效，請重新寄送。');
  const tokenHash = hash(token);
  const record = await Verification.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!record) throw failure(400, '連結已失效或已使用，請登入或重新寄送驗證信。');
  const user = await User.findById(record.userId);
  if (!user || !(await user.matchPassword(password))) throw failure(401, '密碼不正確，請輸入註冊時設定的密碼。');
  // Atomic consumption: a resend, expiry, or simultaneous confirmation cannot reuse this token.
  const consumed = await Verification.findOneAndDelete({ _id: record._id, tokenHash, expiresAt: { $gt: new Date() } });
  if (!consumed) throw failure(400, '連結已失效或已使用，請登入或重新寄送驗證信。');
  await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() } });
  return { verified: true, message: 'Email 已驗證，現在可以登入 ColorLab。' };
}
module.exports = { normalizeEmail, validEmail, needsVerification, configured, limitRequest, sendVerification, confirmVerification, consume };
