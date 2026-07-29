// Server/server.js
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

// 你自己的模組
const connectDB = require('./config/db');
const userRoutes = require('./routes/user');
const testRoutes = require('./routes/test');
const surveyRoutes = require('./routes/survey');
const adminRoutes = require('./routes/admin');
const homepageRoutes = require('./routes/homepage');
const seedDefaultContent = require('./services/seedDefaultContent');

// ---- 環境/基礎設定 ----
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`運行環境: ${isDevelopment ? '開發環境' : '生產環境'}`);

const app = express();
app.disable('x-powered-by');
app.use(compression());

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
const REPORTS_DIR = path.join(STATIC_DIR, 'test', 'detailed-reports');
const VALID_MBTI_TYPES = new Set([
  'ENFJ', 'ENFP', 'ENTJ', 'ENTP',
  'ESFJ', 'ESFP', 'ESTJ', 'ESTP',
  'INFJ', 'INFP', 'INTJ', 'INTP',
  'ISFJ', 'ISFP', 'ISTJ', 'ISTP'
]);
const VALID_REPORT_COLORS = new Set([
  'blue', 'green', 'red', 'yellow',
  'blue-green', 'blue-red', 'blue-yellow',
  'green-red', 'green-yellow', 'red-yellow',
  'blue-green-red', 'blue-green-yellow', 'blue-red-yellow',
  'green-red-yellow', 'blue-green-red-yellow'
]);
const staticOptions = {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.html' || filePath.endsWith('service-worker.js') || extension === '.webmanifest') {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.woff', '.woff2'].includes(extension)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (extension === '.css' || extension === '.js') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
};
app.use(express.static(STATIC_DIR, staticOptions));          // 直接提供整個 color-web
app.use('/main', express.static(path.join(STATIC_DIR, 'main'), staticOptions));

// 上傳檔（如果有）
app.use(
  '/uploads/homepage',
  express.static(path.join(__dirname, 'uploads', 'homepage'), { maxAge: '1d', etag: true })
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

// Download the original complete report that matches the user's MBTI and color result.
app.get('/api/reports/download/:mbti/:colors', (req, res, next) => {
  const mbti = String(req.params.mbti || '').toUpperCase();
  const colors = String(req.params.colors || '').toLowerCase();

  if (!VALID_MBTI_TYPES.has(mbti) || !VALID_REPORT_COLORS.has(colors)) {
    return res.status(400).json({ message: 'Invalid report selection.' });
  }

  const reportPath = path.join(REPORTS_DIR, `${mbti}-${colors}.pdf`);
  const downloadName = `ColorLab-${mbti}-${colors}-full-report.pdf`;

  res.download(reportPath, downloadName, {
    headers: {
      'Cache-Control': 'private, no-store'
    }
  }, (error) => {
    if (!error) return;
    if (res.headersSent) return next(error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'Report not found.' });
    }
    return next(error);
  });
});

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

async function startServer() {
  await connectDB();
  await seedDefaultContent();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving static files from: ${STATIC_DIR}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
