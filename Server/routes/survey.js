const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 驗證 Token 中間件
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user || decoded.role !== 'user') return res.status(401).json({ message: '請重新登入會員。' });
            if (require('../services/emailVerification').needsVerification(req.user)) return res.status(403).json({ message: '請先驗證 Email。' });
            next();
        } catch (error) {
            res.status(401).json({ message: '未授權，token無效' });
        }
    }
    if (!token) {
        res.status(401).json({ message: '未授權，沒有token' });
    }
};

// 定義 Schema 和 Model
const answerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mbti: String, // 儲存 MBTI 資料
    answers: [String], // 儲存問卷回答
    timestamp: { type: Date, default: Date.now }
});

const Answer = mongoose.model('Answer', answerSchema);

// 提交答案的 API
router.post('/submit-answer', protect, async (req, res) => {
    try {
        const { answers, mbti } = req.body;
        if (!answers || !mbti) {
            return res.status(400).json({ message: '缺少完整 MBTI 資料' });
        }

        // 建立新的回應資料
        const newAnswer = new Answer({ 
            userId: req.user._id,
            answers, 
            mbti 
        });
        
        // 儲存資料到資料庫
        await newAnswer.save();
        console.log('成功儲存問卷回答:', newAnswer);

        res.json({ message: '問卷已提交成功！感謝您的填寫！' });
    } catch (err) {
        console.error('儲存問卷回答失敗:', err);
        res.status(500).json({ message: '提交失敗' });
    }
});

// 獲取用戶的問卷歷史
router.get('/history', protect, async (req, res) => {
    try {
        const answers = await Answer.find({ userId: req.user._id })
            .sort({ timestamp: -1 });
        res.json(answers);
    } catch (err) {
        console.error('獲取問卷歷史失敗:', err);
        res.status(500).json({ message: '獲取歷史記錄失敗' });
    }
});

module.exports = router;
