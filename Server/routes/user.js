const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Feedback = require('../models/Feedback');
const TestRecord = require('../models/TestRecord');

const router = express.Router();

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
router.post('/register', async (req, res) => {
    try {
        const { name, gender, birthDate, email, phone, password, occupation } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: '請填寫所有必要欄位' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '此電子郵件已被註冊' });
        }

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
            email, 
            password,
            name: name || email.split('@')[0], // 使用提供的名稱或郵箱前綴
            gender: processedGender,
            birthDate: birthDate || new Date(),
            phone: phone || '',
            occupation: occupation || '未設定'
        });
        await newUser.save();

        // 生成 JWT Token
        const token = newUser.generateToken();

        res.status(201).json({ 
            message: '註冊成功',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                gender: newUser.gender,
                birthDate: newUser.birthDate,
                phone: newUser.phone,
                occupation: newUser.occupation
            }
        });

    } catch (error) {
        console.error('❌ 註冊錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 登入
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: '請填寫所有必要欄位' });
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }

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
