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
// Read-only fixtures; QA credentials are deliberately invalid outside this localhost server.
const qaSurvey = { _id: '111111111111111111111111', testType: '我在色彩學中的MBTI', totalQuestions: 20, questions: require('../Server/data/finalSurveyQuestions'), createdAt: '2026-07-01', updatedAt: '2026-09-06' };
app.get('/qa/review', (_req, res) => res.type('html').send(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>ColorLab 整合驗證</title><style>body{margin:0;background:#ede6e1;font:14px system-ui}header{padding:12px;display:flex;gap:12px;flex-wrap:wrap}button,select{padding:8px}iframe{display:block;width:390px;max-width:100%;height:850px;margin:auto;border:0;background:#fcf8f4}</style></head><body><header>本機測試資料・禁止寫入正式系統 <select id="page" aria-label="頁面"><option value="/main/admin/account-manage.html">帳號管理</option><option value="/main/admin/admin.html">管理總覽</option><option value="/main/admin/survey.html">問卷管理</option><option value="/main/admin/EditSurvey.html?id=111111111111111111111111">編輯問卷</option><option value="/main/admin/EditCommon.html">首頁資訊</option><option value="/main/admin/data.html">資料管理</option><option value="/main/user/profile.html">會員資料</option><option value="/main/login-user.html">登入</option><option value="/main/user/register.html">註冊</option></select><button id="phone">手機 390</button><button id="small">手機 320</button><button id="desktop">桌面</button></header><iframe title="整合頁面" id="frame"></iframe><script>
const token = 'qa.' + btoa(JSON.stringify({exp:4102444800})) + '.invalid';
for(const storage of [sessionStorage,localStorage]) for(const [key,value] of Object.entries({adminToken:token,adminName:'測試管理員',adminEmail:'qa@example.invalid'})) storage.setItem(key,value);
for(const [key,value] of Object.entries({token,userToken:token,userName:'測試會員',userEmail:'member@example.invalid',user:JSON.stringify({name:'測試會員',email:'member@example.invalid',gender:'不願透露'})})) sessionStorage.setItem(key,value);
const frame=document.getElementById('frame'),page=document.getElementById('page');frame.src=page.value;page.onchange=()=>frame.src=page.value;document.getElementById('phone').onclick=()=>frame.style.width='390px';document.getElementById('small').onclick=()=>frame.style.width='320px';document.getElementById('desktop').onclick=()=>frame.style.width='100%';
</script></body></html>`));
app.get('/api/admin/users', (_req, res) => res.json(Array.from({ length: 7 }, (_, index) => ({ _id: String(index).padStart(24, '0'), name: '測試會員 ' + (index + 1), email: 'member' + (index + 1) + '@example.invalid', role: 'user', lastLogin: '2026-09-06T02:00:00Z' }))));
app.get('/api/test/surveys', (_req, res) => res.json([qaSurvey]));
app.get('/api/test/surveys/:id', (_req, res) => res.json(qaSurvey));
app.get('/api/admin/test-types', (_req, res) => res.json([qaSurvey.testType]));
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
