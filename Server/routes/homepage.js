const express = require('express');
const Homepage = require('../models/Homepage');
const Admin = require('../models/Admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const jwt = require('jsonwebtoken');

// 管理員權限驗證中間件
const adminProtect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const admin = await Admin.findById(decoded.id).select('-password');
            if (!admin) return res.status(403).json({ message: '無權限訪問' });
            req.user = admin;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'token無效' });
        }
    } else {
        return res.status(401).json({ message: '沒有token' });
    }
};

// 確保上傳目錄存在
const uploadsDir = path.join(__dirname, '../uploads/homepage');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ 已建立上傳目錄:', uploadsDir);
}

// 檔案儲存設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 取得最新/一般資訊（可分類type/news/common）
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        const filter = type ? { type } : {};
        const homepage = await Homepage.find(filter).sort({ createdAt: -1 });
        res.json(homepage);
    } catch (error) {
        res.status(500).json({ message: '獲取資料失敗' });
    }
});

// 取得指定筆資訊
router.get('/:id', async (req, res) => {
    try {
        const item = await Homepage.findById(req.params.id);
        if (!item) return res.status(404).json({ message: '找不到內容' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: '讀取失敗' });
    }
});

// 新增首頁資訊（管理員）
router.post('/', adminProtect, async (req, res) => {
    try {
        const { type, title, imageUrl, link, description } = req.body;
        const created = await Homepage.create({ type, title, imageUrl, link, description });
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ message: '新增失敗' });
    }
});

// 修改首頁資訊（管理員）
router.put('/:id', adminProtect, async (req, res) => {
    try {
        const { type, title, imageUrl, link, description } = req.body;
        const updated = await Homepage.findByIdAndUpdate(req.params.id, { type, title, imageUrl, link, description, updatedAt: Date.now() }, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: '修改失敗' });
    }
});

// 刪除首頁資訊（管理員）
router.delete('/:id', adminProtect, async (req, res) => {
    try {
        await Homepage.findByIdAndDelete(req.params.id);
        res.json({ message: '已刪除' });
    } catch (error) {
        res.status(500).json({ message: '刪除失敗' });
    }
});

// 圖片上傳API（管理員）
router.post('/upload-image', adminProtect, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: '未收到圖片' });
    // 回傳服務器上的路徑
    const filePath = '/uploads/homepage/' + req.file.filename;
    res.json({ imageUrl: filePath });
});

module.exports = router;
