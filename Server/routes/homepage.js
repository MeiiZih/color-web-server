const express = require('express');
const Homepage = require('../models/Homepage');
const Admin = require('../models/Admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {claimIllustration} = require('../services/contentIllustration');
function metadata(body) {
 const result={};
 for(const key of ['sourceName','contentKind','registrationUrl','sourcePublishedAt','sourceCheckedAt']) if(typeof body[key]==='string')result[key]=body[key].slice(0,2000);
 if(body.expiresAt!==undefined){result.expiresAt=body.expiresAt?new Date(body.expiresAt+'T23:59:59+08:00'):null;if(result.expiresAt&&!Number.isFinite(+result.expiresAt))throw new Error('截止日期不正確');}
 return result;
}

// 管理員權限驗證中間件
const adminProtect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            if(decoded.role!=='admin')return res.status(403).json({message:'僅管理員可使用'});
            const admin = await Admin.findById(decoded.id).select('-password');
            if (!admin) return res.status(403).json({ message: '無權限訪問' });
            if (!require('../services/sessionVersion')(decoded, admin, 'admin')) return res.status(401).json({ message: '登入已失效，請重新登入。' });
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
        res.set('Cache-Control', 'no-store');
        const { type } = req.query;
        const filter = { ...(type ? { type } : {}), archivedAt: { $exists: false }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
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
        if (!item || item.archivedAt || (item.expiresAt && item.expiresAt <= new Date())) return res.status(404).json({ message: '找不到內容或已下架' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: '讀取失敗' });
    }
});

// 新增首頁資訊（管理員）
router.post('/', adminProtect, async (req, res) => {
    try {
        const { type, title, imageUrl, link, description } = req.body;
        const created = new Homepage({ type, title, imageUrl, link, description, ...metadata(req.body) });
        await Homepage.db.transaction(async session => {
            await claimIllustration(Homepage.db.db, req.body, created._id, session);
            await created.save({session});
        });
        res.status(201).json(created);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : '新增失敗' });
    }
});

// 修改首頁資訊（管理員）
router.put('/:id', adminProtect, async (req, res) => {
    try {
        const { type, title, imageUrl, link, description } = req.body;
        let updated;
        await Homepage.db.transaction(async session => {
            const current = await Homepage.findById(req.params.id).session(session);
            if (!current) throw Object.assign(new Error('找不到內容'), {status:404});
            await claimIllustration(Homepage.db.db, req.body, current._id, session);
            updated = await Homepage.findByIdAndUpdate(req.params.id, { type, title, imageUrl, link, description, ...metadata(req.body), updatedAt: Date.now() }, { new: true, runValidators: true, session });
        });
        res.json(updated);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : '修改失敗' });
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
