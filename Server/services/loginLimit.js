const verification = require('./emailVerification');

// Persistent counters share the existing database across instances and restarts.
module.exports = role => async (req, res, next) => {
  try {
    const identity = verification.normalizeEmail(req.body?.email) || 'invalid';
    await verification.consume(`login:${role}:${identity}`, 10, 15 * 60000);
    await verification.consume('login-global', 1000, 15 * 60000);
    next();
  } catch (error) {
    res.status(error.status === 429 ? 429 : 503).json({ message: error.status === 429 ? '登入嘗試次數較多，請稍後再試。' : '登入服務暫時無法使用，請稍後再試。' });
  }
};
