const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const validatePassword = require('./passwordPolicy');
const failure = (status, message) => Object.assign(new Error(message), { status });

module.exports = async function updateAdminProfile(authenticated, body) {
  const changes = {};
  for (const key of ['name', 'department', 'phone']) if (body[key]) changes[key] = body[key];
  const passwordChanged = body.password !== undefined && body.password !== '';
  const query = { _id: authenticated._id, $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, authenticated.sessionVersion || 0] } };
  let update = { $set: changes };
  if (passwordChanged) {
    validatePassword(body.password);
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) throw failure(400, '修改密碼時請輸入目前密碼。');
    const account = await Admin.findById(authenticated._id);
    if (!account || !(await account.matchPassword(body.currentPassword))) throw failure(401, '目前密碼不正確。');
    query.password = account.password;
    update = { $set: { ...changes, password: await bcrypt.hash(body.password, 10) }, $inc: { sessionVersion: 1 },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '', passwordResetEmail: '' } };
  }
  // Never save a stale document over a concurrent reset or another password change.
  const user = await Admin.findOneAndUpdate(query, update, { new: true, runValidators: true }).select('-password');
  if (!user) throw failure(409, '帳號狀態已變更，請重新登入後再試。');
  return { message: passwordChanged ? '密碼已更新，請重新登入。' : '個人資料更新成功', user, passwordChanged };
};
