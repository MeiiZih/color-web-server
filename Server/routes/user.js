const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Feedback = require('../models/Feedback');
const TestRecord = require('../models/TestRecord');
const emailVerification = require('../services/emailVerification');

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
require('../services/passwordReset').attachPasswordReset(router, 'user');
router.post('/email-verification/confirm', emailVerification.limitRequest, async (req, res) => {
    try { res.json(await emailVerification.confirmVerification(req.body.token, req.body.password)); }
    catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '驗證未完成，請稍後重試。' }); }
});
router.post('/email-verification/resend', emailVerification.limitRequest, async (req, res) => {
    try {
        const email = emailVerification.normalizeEmail(req.body.email);
        const user = await User.findOne({ email });
        if (!user || typeof req.body.password !== 'string' || !(await user.matchPassword(req.body.password))) return res.status(401).json({ message: '帳號或密碼錯誤' });
        res.json(await emailVerification.sendVerification(user));
    } catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '暫時無法寄送，請稍後再試。' }); }
});
router.post('/email-verification/request', protect, emailVerification.limitRequest, async (req, res) => {
    try { res.json(await emailVerification.sendVerification(req.user)); }
    catch (error) { res.status(error.status || 503).json({ message: error.status ? error.message : '暫時無法寄送，請稍後再試。' }); }
});

// 檢查電子郵件是否已註冊
router.get('/check-email', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ message: '請提供電子郵件' });
        }

        const existingUser = await User.findOne({ email });
        return res.json({ exists: !!existingUser });
    } catch (error) {
        console.error('❌ 檢查電子郵件錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 註冊
router.post('/register', emailVerification.limitRequest, async (req, res) => {
    try {
        const { name, gender, birthDate, phone, password, occupation } = req.body;
        const email = emailVerification.normalizeEmail(req.body.email);

        const birthday = typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(birthDate) : new Date(NaN);
        if (typeof name !== 'string' || !name.trim() || !['男', '女', 'unknown', 'male', 'female'].includes(gender) || !Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0, 10) !== birthDate || birthDate > new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) {
            return res.status(400).json({ message: '請填寫姓名、選擇性別，並填寫有效的出生日期；電話可留空。' });
        }
        if (!emailVerification.validEmail(email) || typeof password !== 'string' || password.length < 6 || password.length > 128) {
            return res.status(400).json({ message: '請填寫所有必要欄位' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '此電子郵件已被註冊；若尚未驗證，請使用「重新寄送驗證信」。' });
        }
        if (!emailVerification.configured()) return res.status(503).json({ message: '驗證信服務尚未準備好，請稍後再註冊。' });

        // 處理性別值的轉換
        let processedGender = 'unknown';
        if (gender) {
            if (gender === 'male') {
                processedGender = '男';
            } else if (gender === 'female') {
                processedGender = '女';
            } else if (gender === '男' || gender === '女') {
                processedGender = gender;
            }
        }

        const newUser = new User({ 
            emailVerificationRequired: true,
            email, 
            password,
            name: name.trim(),
            gender: processedGender,
            birthDate,
            phone: phone || '',
            occupation: occupation || '未設定'
        });
        await newUser.save();

        try {
            const sent = await emailVerification.sendVerification(newUser);
            res.status(202).json({ ...sent, verificationRequired: true, email, message: '驗證信已寄出，請完成驗證後再登入。' });
        } catch {
            res.status(202).json({ verificationRequired: true, mailSent: false, email, message: '帳號已保留，但驗證信尚未成功寄出。請等候 60 秒後重新寄送。' });
        }

    } catch (error) {
        console.error('Registration failed:', error.name);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 登入
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        const email = emailVerification.normalizeEmail(req.body.email);

        if (!email || !password) {
            return res.status(400).json({ message: '請填寫所有必要欄位' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }

        if (emailVerification.needsVerification(user)) return res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', message: '請先驗證 Email，再登入；可使用「重新寄送驗證信」。' });
        // 更新最後登入時間
        user.lastLogin = new Date();
        await user.save();

        // 生成 JWT Token
        const token = user.generateToken();

        res.json({
            message: '登入成功',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                gender: user.gender,
                birthDate: user.birthDate,
                phone: user.phone,
                occupation: user.occupation
            }
        });

    } catch (error) {
        console.error('❌ 登入錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 更新用戶資料
router.put('/update-profile', protect, async (req, res) => {
    try {
        const { name, gender, birthDate, occupation, phone } = req.body;
        // Ownership is derived only from the verified member token.
        const user = req.user;
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: '找不到用戶' 
            });
        }
        
        // 更新用戶資料
        if (name !== undefined) user.name = name;
        if (gender !== undefined) {
            // 處理性別值的轉換
            if (gender === 'male') {
                user.gender = '男';
            } else if (gender === 'female') {
                user.gender = '女';
            } else if (gender === '男' || gender === '女' || gender === 'unknown') {
                user.gender = gender;
            } else {
                user.gender = 'unknown';
            }
        }
        if (birthDate !== undefined) user.birthDate = birthDate;
        if (occupation !== undefined) user.occupation = occupation;
        if (phone !== undefined) user.phone = phone;
        
        await user.save();
        
        res.json({
            success: true,
            message: '資料更新成功',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                gender: user.gender,
                birthDate: user.birthDate,
                phone: user.phone,
                occupation: user.occupation
            }
        });
    } catch (error) {
        console.error('❌ 更新用戶資料錯誤:', error);
        res.status(500).json({ 
            success: false,
            message: '伺服器錯誤，請稍後再試' 
        });
    }
});

// 用戶意見反饋提交
router.post('/feedback', async (req, res) => {
    try {
        const { description, name, email } = req.body;
        if (!description || typeof description !== 'string' || !description.trim()) {
            return res.status(400).json({ message: '請填寫建議內容' });
        }
        const feedback = new Feedback({ description: description.trim(), name: name || '', email: email || '' });
        await feedback.save();
        res.status(201).json({ message: '已收到您的寶貴意見！' });
    } catch (error) {
        res.status(500).json({ message: '儲存意見失敗' });
    }
});

// 驗證 Token 中間件
async function protect(req, res, next) {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            if (decoded.role !== 'user') return res.status(403).json({ message: '請使用會員帳號' });
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) return res.status(401).json({ message: '請重新登入' });
            if (!require('../services/sessionVersion')(decoded, req.user, 'user')) return res.status(401).json({ message: '登入已失效，請重新登入。' });
            if (emailVerification.needsVerification(req.user)) return res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', message: '請先驗證 Email。' });
            next();
        } catch (error) {
            res.status(401).json({ message: '未授權，token無效' });
        }
    }
    if (!token) {
        res.status(401).json({ message: '未授權，沒有token' });
    }
};

// 將同一瀏覽器中的訪客測驗紀錄轉入剛建立的正式帳號
router.post('/sync-guest-records', protect, async (req, res) => {
    try {
        const { guestId, newEmail } = req.body || {};

        if (!guestId || !newEmail) {
            return res.status(400).json({ message: '缺少訪客編號或電子郵件' });
        }

        if (!req.user || req.user.email !== newEmail) {
            return res.status(403).json({ message: '只能同步到目前登入的帳號' });
        }

        const result = await TestRecord.updateMany(
            { guestId },
            {
                $set: { email: newEmail, userId: req.user._id },
                $unset: { guestId: '' }
            }
        );

        return res.json({ success: true, synced: result.modifiedCount });
    } catch (error) {
        console.error('同步訪客測驗紀錄失敗:', error);
        return res.status(500).json({ message: '同步訪客測驗紀錄失敗' });
    }
});

// 獲取用戶資料
router.get('/profile', protect, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('獲取用戶資料錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

module.exports = router;
