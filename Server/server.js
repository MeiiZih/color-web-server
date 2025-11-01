// Server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// 你自己的模組
const connectDB = require('./config/db');
const userRoutes = require('./routes/user');
const testRoutes = require('./routes/test');
const surveyRoutes = require('./routes/survey');
const adminRoutes = require('./routes/admin');
const homepageRoutes = require('./routes/homepage');

// ---- 環境/基礎設定 ----
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`運行環境: ${isDevelopment ? '開發環境' : '生產環境'}`);

const app = express();

// 先連 DB（會讀取 MONGODB_URI）
connectDB();

// CORS（如需鎖網域可改成陣列白名單）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 解析 JSON
app.use(express.json());

// ---- 靜態檔與頁面路由 ----
// color-web 放在 Server 的上一層目錄
const STATIC_DIR = path.join(__dirname, '..', 'color-web');
app.use(express.static(STATIC_DIR));                         // 直接提供整個 color-web
app.use('/main', express.static(path.join(STATIC_DIR, 'main')));

// 上傳檔（如果有）
app.use(
  '/uploads/homepage',
  express.static(path.join(__dirname, 'uploads', 'homepage'))
);

// 首頁（/ 直接丟 color-web/index.html）
app.get('/', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// 讓 /login-admin.html 重新導向舊路徑（若前端仍有舊連結）
app.get('/login-admin.html', (_req, res) => {
  res.redirect('/main/login-admin.html');
});

// 允許以 /main/xxx.html 直接存取（例如 /main/register.html）
app.get('/main/:page', (req, res, next) => {
  const file = path.join(STATIC_DIR, 'main', req.params.page);
  res.sendFile(file, (err) => (err ? next() : null));
});

// 健康檢查（雲端監測、你自己也可測）
app.get('/health', (_req, res) => res.send('OK'));

// ---- API 路由（保持你原本的）----
app.use('/api/survey', surveyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/test', testRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/homepage', homepageRoutes);

// ---- 錯誤處理 ----
app.use((err, _req, res, _next) => {
  console.error('伺服器錯誤:', err.stack);
  res.status(500).json({ message: '伺服器內部錯誤' });
});

// ---- 啟動 ----
const PORT = process.env.PORT || 3000;          // Render 會提供 PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from: ${STATIC_DIR}`);
});
