// Local integration review. Mock data never enters the deployable directory or MongoDB.
const express = require('../Server/node_modules/express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { catalogEntry } = require('../Server/services/explore');
const app = express();
app.use(express.json());
const root = path.resolve(__dirname, '../static-dist');
let coldResponses = 0;
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/qa/cold', (_req, res) => { coldResponses = 3; res.redirect('/app/'); });
app.get('/health', (_req, res) => coldResponses-- > 0 ? res.status(503).send('Render application loading') : res.send('OK'));
// Local fixtures; QA credentials are deliberately invalid outside this localhost server.
const qaSurvey = { _id: '111111111111111111111111', testType: '我在色彩學中的MBTI', totalQuestions: 20, questions: require('../Server/data/finalSurveyQuestions'), createdAt: '2026-07-01', updatedAt: '2026-09-06' };
const qaMember = { _id:'444444444444444444444444',id:'444444444444444444444444',name:'本機測試會員',email:'member@example.invalid',gender:'unknown',birthDate:'2000-01-01',phone:'',occupation:'' };
const qaContents = [{_id:'333333333333333333333333',type:'news',title:'本機測試資訊',description:'這些內容不會發布',imageUrl:'/assets/images/act1.png',link:''}];
const qaSurveys = [qaSurvey];
const qaRecord = {_id:'555555555555555555555555',email:qaMember.email,testType:qaSurvey.testType,mbtiResult:'ENFJ',colorResult:{primary:['red']},timestamp:'2026-09-06T02:00:00Z',answers:[{question:'本機驗證題目',answer:'測試答案'}]};
app.get('/api/user/profile',(_req,res)=>res.json(qaMember));
app.get('/api/explore/me',(_req,res)=>res.json(qaMember));
app.get('/api/explore/records',(_req,res)=>res.json([]));
app.get('/api/admin/profile',(_req,res)=>res.json({user:{_id:'666666666666666666666666',name:'本機測試管理員',email:'admin@example.invalid',department:'ColorLab'}}));
app.get('/api/admin/user/:id',(_req,res)=>res.json({user:qaMember}));
app.get('/api/admin/user/:id/records',(_req,res)=>res.json({records:[qaRecord]}));
app.get('/api/admin/records/:id',(_req,res)=>res.json(qaRecord));
app.get('/api/admin/test-records',(_req,res)=>res.json({records:[{...qaRecord,id:qaRecord._id}],total:1,totalPages:1}));
app.get('/api/admin/feedbacks',(_req,res)=>res.json({records:[{name:'本機測試',email:'',description:'測試手機操作',timestamp:qaRecord.timestamp}],totalPages:1,totalRecords:1}));
app.get('/api/homepage/:id',(req,res)=>res.json(qaContents.find(item=>item._id===req.params.id)||qaContents[0]));
// In-memory writes ONLY: this process has no MongoDB connection and never proxies APIs.
app.put('/api/user/update-profile',(req,res)=>{Object.assign(qaMember,req.body);res.json({user:qaMember});});
app.post('/api/test/surveys',(req,res)=>{const survey={...req.body,_id:'777777777777777777777777',createdAt:new Date(),updatedAt:new Date()};qaSurveys.push(survey);res.json({survey});});
app.put('/api/test/surveys/:id',(req,res)=>{const survey=qaSurveys.find(s=>s._id===req.params.id);Object.assign(survey,req.body);res.json({survey});});
app.put('/api/homepage/:id',(req,res)=>{const item=qaContents.find(i=>i._id===req.params.id);Object.assign(item,req.body);res.json(item);});
app.post('/api/homepage',(req,res)=>{const item={...req.body,_id:'888888888888888888888888'};qaContents.push(item);res.json(item);});
app.get('/qa/review', (_req, res) => res.type('html').send(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>ColorLab 整合驗證</title><style>body{margin:0;background:#ede6e1;font:14px system-ui}header{padding:12px;display:flex;gap:12px;flex-wrap:wrap}button,select{padding:8px}iframe{display:block;width:390px;max-width:100%;height:calc(100vh - 70px);margin:auto;border:0;background:#fcf8f4}</style></head><body><header>本機測試資料・禁止寫入正式系統 <select id="page" aria-label="頁面"><option value="/main/admin/account-manage.html">帳號管理</option><option value="/main/admin/admin.html">管理總覽</option><option value="/main/admin/survey.html">問卷管理</option><option value="/main/admin/EditSurvey.html?id=111111111111111111111111">編輯問卷</option><option value="/main/admin/EditCommon.html">首頁資訊</option><option value="/main/admin/data.html">資料管理</option><option value="/main/user/profile.html">會員資料</option><option value="/main/login-user.html">登入</option><option value="/main/user/register.html">註冊</option></select><button id="phone">手機 390</button><button id="small">手機 320</button><button id="desktop">桌面</button></header><iframe title="整合頁面" id="frame"></iframe><script>
const token = 'qa.' + btoa(JSON.stringify({exp:4102444800})) + '.invalid';
for(const storage of [sessionStorage,localStorage]) for(const [key,value] of Object.entries({adminToken:token,adminName:'測試管理員',adminEmail:'qa@example.invalid'})) storage.setItem(key,value);
for(const [key,value] of Object.entries({token,userToken:token,userName:'測試會員',userEmail:'member@example.invalid',user:JSON.stringify({name:'測試會員',email:'member@example.invalid',gender:'不願透露'})})) sessionStorage.setItem(key,value);
const frame=document.getElementById('frame'),page=document.getElementById('page');frame.src=page.value;page.onchange=()=>{if(page.value.includes('/user/profile')){sessionStorage.removeItem('adminToken');localStorage.removeItem('adminToken');}else if(page.value.includes('/admin/')){sessionStorage.setItem('adminToken',token);localStorage.setItem('adminToken',token);}frame.src=page.value;};document.getElementById('phone').onclick=()=>frame.style.width='390px';document.getElementById('small').onclick=()=>frame.style.width='320px';document.getElementById('desktop').onclick=()=>frame.style.width='100%';
</script></body></html>`));
app.get('/api/admin/users', (_req, res) => res.json(Array.from({ length: 7 }, (_, index) => ({ _id: String(index).padStart(24, '0'), name: '測試會員 ' + (index + 1), email: 'member' + (index + 1) + '@example.invalid', role: 'user', lastLogin: '2026-09-06T02:00:00Z' }))));
app.get('/api/test/surveys', (_req, res) => res.json(qaSurveys));
app.get('/api/test/surveys/:id', (req, res) => res.json(qaSurveys.find(s=>s._id===req.params.id)));
app.get('/api/admin/test-types', (_req, res) => res.json([qaSurvey.testType]));
app.get('/api/admin/data-stats',(_req,res)=>res.json({totalParticipants:1,mbtiStats:[{_id:'ENFJ',count:1}],colorStats:[{_id:'red',count:1}],testTypeStats:[{_id:qaSurvey.testType,count:1}]}));
app.get('/api/explore/catalog', (_req, res) => res.json([
  catalogEntry({ _id: '111111111111111111111111', testType: '我在色彩學中的MBTI', questions: require('../Server/data/finalSurveyQuestions') }),
  catalogEntry({ _id: '222222222222222222222222', testType: '整合驗證問卷（僅本機）', questions: [
    { questionNumber: 1, question: '選擇此刻的心情', options: ['平靜', '期待', '放鬆'] },
    { questionNumber: 2, question: '想用哪種步調探索？', options: ['慢慢來', '試試新事物'] },
    { questionNumber: 3, question: '挑選喜歡的色彩', options: ['紅', '黃', '綠', '藍'] }
  ] })
]));
app.get('/api/homepage', (_req, res) => res.json(qaContents));
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
