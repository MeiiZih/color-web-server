const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

module.exports = async function adminProtect(req, res, next) {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
        return res.status(401).json({ message: '缺少管理員登入憑證' });
    }

    try {
        const token = authorization.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const admin = await Admin.findById(decoded.id).select('-password');

        if (!admin) {
            return res.status(403).json({ message: '找不到管理員帳號' });
        }

        req.user = admin;
        return next();
    } catch (_error) {
        return res.status(401).json({ message: '管理員登入已失效，請重新登入' });
    }
};
