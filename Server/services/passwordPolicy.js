module.exports = function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw Object.assign(new Error('新密碼請使用 6 至 128 個字元。'), { status: 400 });
  if (Buffer.byteLength(password, 'utf8') > 72) throw Object.assign(new Error('密碼過長，請縮短後再試（最多 72 個英數字元；中文或表情符號可用字數較少）。'), { status: 400 });
};
