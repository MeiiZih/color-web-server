// Local integration review. Mock data never enters the deployable directory or MongoDB.
const express = require('../Server/node_modules/express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { catalogEntry } = require('../Server/services/explore');
const app = express();
const root = path.resolve(__dirname, '../static-dist');
let coldResponses = 0;
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/qa/cold', (_req, res) => { coldResponses = 3; res.redirect('/app/'); });
app.get('/health', (_req, res) => coldResponses-- > 0 ? res.status(503).send('Render application loading') : res.send('OK'));
app.get('/api/explore/catalog', (_req, res) => res.json([
  catalogEntry({ _id: '111111111111111111111111', testType: '我在色彩學中的MBTI', questions: require('../Server/data/finalSurveyQuestions') }),
  catalogEntry({ _id: '222222222222222222222222', testType: '整合驗證問卷（僅本機）', questions: [
    { questionNumber: 1, question: '選擇此刻的心情', options: ['平靜', '期待', '放鬆'] },
    { questionNumber: 2, question: '想用哪種步調探索？', options: ['慢慢來', '試試新事物'] },
    { questionNumber: 3, question: '挑選喜歡的色彩', options: ['紅', '黃', '綠', '藍'] }
  ] })
]));
app.get('/api/homepage', (_req, res) => res.json([{ type: 'news', title: '社會劇工作坊', description: '原有活動海報', imageUrl: '/assets/images/act1.png', link: '/assets/images/act1.png' }, { type: 'common', title: 'tree.fm 森林聲音', description: '給自己一點空間', imageUrl: '/assets/images/tree.fm.jpg', link: 'https://www.tree.fm/' }]));
app.use('/api', (_req, res) => res.status(401).json({ message: '本機整合驗證不連接正式帳號。' }));
app.use(async (req, res, next) => {
  const relative = req.path.endsWith('/') ? req.path + 'index.html' : req.path;
  if (!relative.endsWith('.html')) return next();
  const file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) return res.sendStatus(403);
  try {
    let html = await fs.readFile(file, 'utf8');
    html = html.replaceAll('https://color-web-server-jprj.onrender.com', 'http://127.0.0.1:4180');
    html = html.replace('<body>', '<body><div style="background:#f5e5e8;padding:6px;text-align:center;font:12px system-ui">本機整合驗證 · 不連接正式帳號</div>');
    res.type('html').send(html);
  } catch { next(); }
});
app.use(express.static(root));
app.listen(4180, '127.0.0.1', () => console.log('Integration review: http://127.0.0.1:4180/app/'));
