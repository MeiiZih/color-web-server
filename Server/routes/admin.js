const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const TestRecord = require('../models/TestRecord');
const { originalRecordsOnly } = require('../services/legacyRecordImport');
const TestQuestion = require('../models/TestQuestion');
const Feedback = require('../models/Feedback');

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
require('../services/passwordReset').attachPasswordReset(router, 'admin');

// 管理員登入路由
router.post('/login', require('../services/loginLimit')('admin'), async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminEmail = require('../services/emailVerification').normalizeEmail(email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || typeof password !== 'string' || !password) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }

        // 查找管理員
        const admin = await Admin.findOne({ email: adminEmail });

        if (!admin) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }

        // 驗證密碼
        const isMatch = await admin.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }

        // 生成 JWT token
        const token = admin.generateToken();

        // 返回管理員信息和 token
        res.json({
            token,
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: 'admin',
                department: admin.department
            }
        });
    } catch (error) {
        console.error('❌ 管理員登入錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 驗證管理員Token中間件
const adminProtect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            if (decoded.role !== 'admin') return res.status(403).json({ message: '僅管理員可使用' });
            // 查找管理員
            const admin = await Admin.findById(decoded.id).select('-password');
            if (!admin) {
                return res.status(403).json({ message: '無權限訪問，僅管理員可使用' });
            }
            req.user = admin;
            if (!require('../services/sessionVersion')(decoded, admin, 'admin')) return res.status(401).json({ message: '登入已失效，請重新登入。' });
            next();
        } catch (error) {
            return res.status(401).json({ message: '未授權，token無效' });
        }
    } else {
        return res.status(401).json({ message: '未授權，沒有token' });
    }
};

// 獲取所有用戶列表 (僅限管理員)
router.get('/users', adminProtect, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('❌ 獲取用戶列表錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 刪除用戶 (僅限管理員)
router.delete('/users/:id', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: '找不到用戶' });
        }
        
        // 防止刪除管理員
        if (user.role === 'admin') {
            return res.status(403).json({ message: '無法刪除管理員帳號' });
        }
        
        // 使用findByIdAndDelete替代舊的remove方法
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: '用戶已成功刪除' });
    } catch (error) {
        console.error('❌ 刪除用戶錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 更新管理員個人資料
router.put('/update-profile', adminProtect, async (req, res) => {
    try {
        res.json(await require('../services/adminProfile')(req.user, req.body));
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : '伺服器錯誤，請稍後再試' });
    }
});

// 獲取系統統計資訊 (僅限管理員)
router.get('/stats', adminProtect, async (req, res) => {
    try {
        // 計算用戶數量
        const userCount = await User.countDocuments({ role: 'user' });
        const adminCount = await User.countDocuments({ role: 'admin' });
        
        // 最近註冊的10名用戶
        const recentUsers = await User.find({ role: 'user' })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('-password');
        
        res.json({
            stats: {
                userCount,
                adminCount,
                totalUsers: userCount + adminCount
            },
            recentUsers
        });
    } catch (error) {
        console.error('❌ 獲取統計資訊錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
    }
});

// 取得目前登入管理員的個人資料
router.get('/profile', adminProtect, async (req, res) => {
    try {
        const admin = await Admin.findById(req.user._id || req.user.id).select('-password');
        if (!admin) return res.status(404).json({ message: '找不到管理員' });
        res.json({ user: admin });
    } catch (err) {
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 查詢單一 user
router.get('/user/:id', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: '查無此用戶' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 查詢該 user 的所有 testrecords
router.get('/user/:id/records', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('email');
        if (!user) return res.status(404).json({ message: '找不到用戶' });
        const records = await TestRecord.find({ $or: [{ userId: req.params.id }, { userId: null, email: user.email }] });
        res.json({ records });
    } catch (err) {
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 取得所有測驗紀錄（用於數據管理頁面） (暫時移除權限驗證)
router.get('/test-records', adminProtect, async (req, res) => {
    try {
        const { testType, mbtiResult, colorResult, page = 1, limit = 50 } = req.query;
        
        let query = { ...originalRecordsOnly };
        if (testType && testType !== 'ALL') {
            query.testType = testType;
        }
        if (mbtiResult && mbtiResult !== 'ALL') {
            query.mbtiResult = mbtiResult;
        }
        if (colorResult && colorResult !== 'ALL') {
            query.colorResult = colorResult;
        }

        const skip = (page - 1) * limit;
        const records = await TestRecord.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'email name')
            .lean();

        const total = await TestRecord.countDocuments(query);

        // 格式化資料
        const formattedRecords = records.map((record, index) => ({
            id: record._id,
            serialNumber: skip + index + 1,
            email: record.email || (record.userId ? record.userId.email : '訪客'),
            userName: record.userId ? record.userId.name : '未知',
            mbtiResult: record.mbtiResult || '未完成',
            colorResult: record.colorResult && Array.isArray(record.colorResult.primary) ? record.colorResult.primary.join('/') : (record.colorResult && record.colorResult.primary) ? record.colorResult.primary : record.colorResult || '未完成',
            testType: record.testType,
            timestamp: record.timestamp
        }));

        res.json({
            records: formattedRecords,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('取得測驗紀錄失敗:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 測試 API 是否正常工作
router.get('/test', (req, res) => {
    res.json({ message: 'Admin API 正常工作', timestamp: new Date() });
});

// 取得所有問卷類型 (暫時移除權限驗證以便測試)
router.get('/test-types', adminProtect, async (req, res) => {
    try {
        console.log('正在取得問卷類型...');
        console.log('MongoDB 連接狀態:', mongoose.connection.readyState);
        
        const testTypes = await TestQuestion.find({}, 'testType').sort({ createdAt: -1 });
        console.log('找到的問卷類型:', testTypes);
        const types = testTypes.map(item => item.testType);
        res.json({ testTypes: types });
    } catch (error) {
        console.error('取得問卷類型失敗:', error);
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 取得數據統計 (暫時移除權限驗證)
router.get('/result-feedback-stats', adminProtect, async(_req,res)=>{
    try {res.set('Cache-Control','no-store').json(await require('../services/resultFeedback').statistics());}
    catch {res.status(500).json({message:'無法讀取結果回饋統計。'});}
});
router.get('/data-stats', adminProtect, async (req, res) => {
    try {
        console.log('正在取得數據統計...');
        // 總測驗人數 - 計算不重複的使用者
        const totalParticipants = await TestRecord.aggregate([
            { $match: originalRecordsOnly },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $and: [{ $ne: ["$email", null] }, { $ne: ["$email", ""] }] },
                            then: "$email",
                            else: "$guestId"
                        }
                    }
                }
            },
            { $count: "total" }
        ]);
        
        const totalCount = totalParticipants.length > 0 ? totalParticipants[0].total : 0;
        
        // 建立基礎篩選條件
        let baseMatch = { ...originalRecordsOnly };
        if (req.query.testType && req.query.testType !== 'ALL') {
            baseMatch.testType = req.query.testType;
        }

        // MBTI 統計 - 修正篩選邏輯
        let mbtiMatch = { ...baseMatch, mbtiResult: { $exists: true, $ne: null } };
        
        const mbtiStats = await TestRecord.aggregate([
            { $match: mbtiMatch },
            { $group: { _id: '$mbtiResult', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // 如果有特定的 MBTI 篩選條件，在前端過濾結果
        let filteredMbtiStats = mbtiStats;
        if (req.query.mbtiResult && req.query.mbtiResult !== 'ALL') {
            filteredMbtiStats = mbtiStats.filter(stat => stat._id === req.query.mbtiResult);
        }

        // 顏色統計 - 處理 colorResult 可能是物件的情況
        let colorMatch = { ...baseMatch, colorResult: { $exists: true, $ne: null } };
        
        const colorStats = await TestRecord.aggregate([
            { $match: colorMatch },
            {
                $addFields: {
                    colorPrimaries: {
                        $cond: {
                            if: { $and: [ { $ne: [{$type: "$colorResult.primary"}, "missing"] }, { $isArray: "$colorResult.primary" } ] },
                            then: "$colorResult.primary",
                            else: [ "$colorResult.primary" ]
                        }
                    }
                }
            },
            { $unwind: "$colorPrimaries" },
            { $match: { colorPrimaries: { $exists: true, $ne: null } } },
            { $group: { _id: "$colorPrimaries", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // 問卷類型統計
        const testTypeStats = await TestRecord.aggregate([
            { $match: originalRecordsOnly },
            { $group: { _id: '$testType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('統計資料準備完成:', {
            totalParticipants: totalCount,
            mbtiStats: filteredMbtiStats,
            colorStats,
            testTypeStats
        });
        
        res.json({
            totalParticipants: totalCount,
            mbtiStats: filteredMbtiStats,
            colorStats,
            testTypeStats
        });
    } catch (error) {
        console.error('取得統計資料失敗:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
});

// 取得所有 user feedback（分頁）
router.get('/feedbacks', adminProtect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalRecords = await Feedback.countDocuments();
        const totalPages = Math.ceil(totalRecords / limit);
        const records = await Feedback.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({ records, totalRecords, totalPages, page, limit });
    } catch (err) {
        res.status(500).json({ message: '讀取反饋失敗' });
    }
});

router.get('/records/:id', adminProtect, async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: '紀錄識別碼不正確' });
    try {
        const record = await TestRecord.findById(req.params.id).lean();
        if (!record) return res.status(404).json({ message: '找不到紀錄' });
        res.json(record);
    } catch { res.status(500).json({ message: '無法讀取紀錄' }); }
});
router.use('/content-review', adminProtect, require('./contentReview').adminRouter());
module.exports = router;
