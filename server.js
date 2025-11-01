const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user');
const testRoutes = require('./routes/test');
const surveyRoutes = require('./routes/survey');
const adminRoutes = require('./routes/admin');
const homepageRoutes = require('./routes/homepage');

// 設置環境變數
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`運行環境: ${isDevelopment ? '開發環境' : '生產環境'}`);

const app = express();

// 連接資料庫
connectDB();

// 啟用 CORS 設定
app.use(cors({
    origin: '*',  // 允許所有來源
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 啟用 JSON 格式的請求數據
app.use(express.json());

// 設定靜態文件目錄
const publicPath = path.join(__dirname, '../color-web');
app.use(express.static(publicPath));
console.log('靜態文件目錄:', publicPath);

// API 路由
app.use('/api/survey', surveyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/test', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/uploads/homepage', express.static(path.join(__dirname, 'uploads/homepage')));

// 重定向 /login-admin.html 到 /main/login-admin.html
app.get('/login-admin.html', (req, res) => {
    res.redirect('/main/login-admin.html');
});

// 處理所有其他請求，返回對應的HTML文件
app.get('/main/*', (req, res) => {
    const filePath = path.join(publicPath, req.path);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('文件發送錯誤:', err);
            res.status(404).send('找不到頁面');
        }
    });
});

// 首頁路由
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err.stack);
    res.status(500).json({ message: '伺服器內部錯誤' });
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
    console.log(`靜態文件目錄: ${publicPath}`);
    console.log('可以訪問以下頁面:');
    console.log(`- 首頁: http://localhost:${PORT}`);
    console.log(`- 註冊頁: http://localhost:${PORT}/main/register.html`);
    console.log(`- 登入頁: http://localhost:${PORT}/main/login-user.html`);
    console.log(`- 管理員登入頁: http://localhost:${PORT}/main/login-admin.html`);
});
