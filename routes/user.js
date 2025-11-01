const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Feedback = require('../models/Feedback');

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
router.put('/update-profile', async (req, res) => {
    try {
        const { userId, email, name, gender, birthDate, occupation, phone } = req.body;
        
        // 優先使用email查找用戶，如果沒有則使用userId
        let user;
        if (email) {
            user = await User.findOne({ email });
        } else if (userId) {
            user = await User.findById(userId);
        }
        
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
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            res.status(401).json({ message: '未授權，token無效' });
        }
    }
    if (!token) {
        res.status(401).json({ message: '未授權，沒有token' });
    }
};

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
