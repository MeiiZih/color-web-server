// Local-only acceptance playground. No database, email client, or API proxy.
const express = require('../Server/node_modules/express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { catalogEntry } = require('../Server/services/explore');
const app = express(), port = 4185, base = `http://127.0.0.1:${port}`;
const root = path.resolve(__dirname, '../static-dist');
const survey = catalogEntry({_id:'111111111111111111111111',testType:'我在色彩學中的MBTI',questions:require('../Server/data/finalSurveyQuestions')});
const member = {id:'review-member',name:'本機驗收範例',email:'review@example.invalid',role:'user'};
const records = [
  {id:'review-new',cloud:true,survey,surveyId:survey.id,date:'2026-09-07T00:40:00Z',answers:Array(20).fill(2)},
  {id:'review-old',cloud:true,legacy:true,title:survey.title,date:'2026-08-16T06:28:00Z',result:'ISFP - green',mbtiResult:'ISFP',colorResult:{primary:['green']},answers:survey.questions.map((q,i)=>({question:q.question,answer:q.options[2]}))}
];
app.use(express.json());
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.get('/',(req,res)=>res.type('html').send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ColorLab 本機驗收</title><style>body{max-width:760px;margin:48px auto;padding:24px;background:#fcf8f4;color:#393435;font:17px/1.8 system-ui}a{display:block;padding:16px;margin:12px 0;border:1px solid #ded7d3;border-radius:12px;color:#9d4564;text-decoration:none}small{color:#746d70}</style><h1>ColorLab｜這次一起驗收</h1><p>全部是假資料，僅在這台電腦操作，不連正式帳號、不寄信。</p><a href="/app/#history">① 新舊紀錄統一顯示、月份與類別篩選</a><a href="/app/#home">② 首頁心情回應、重新開啟的 Logo 入場</a><a href="/app/#test/${survey.id}">③ 測驗完成動畫（已準備好最後一題）</a><a href="/app/account.html#register">④ 註冊完成動畫（填寫範例資料即可，不寄信）</a><p>點進任一結果，可試「哪一句，讓你想到自己？」；驗收後回到這頁，可重新準備完成動畫範例。</p><small>舊紀錄保留 ISFP，新紀錄依範例答案顯示 ISTP；統一的是版面，不是改寫原始結果。</small><script>sessionStorage.setItem('userToken','qa.'+btoa(JSON.stringify({exp:4102444800}))+'.invalid');localStorage.setItem('colorlab-app-v1:review-member',JSON.stringify({records:[],drafts:{[${JSON.stringify(survey.id)}]:{version:${JSON.stringify(survey.version)},answers:Array(20).fill(2),index:19,key:'11111111-1111-4111-8111-111111111111'}}}));</script></html>`));
app.get('/health',(_req,res)=>res.send('OK'));
app.get('/api/explore/catalog',(_req,res)=>res.json([survey]));
app.get('/api/explore/me',(_req,res)=>res.json(member));
app.get('/api/user/profile',(_req,res)=>res.json(member));
app.get('/api/homepage',(_req,res)=>res.json([]));
app.get('/api/explore/records',(_req,res)=>res.json(records));
app.put('/api/explore/records/:id/reflection',(req,res)=>{const record=records.find(r=>r.id===req.params.id);if(!record)return res.status(404).json({message:'找不到範例紀錄'});record.reflection={choice:req.body.choice,...(req.body.choice==='other'?{text:req.body.text}:{})};res.json(record.reflection);});
const guestFeedback=new Map();
app.post('/api/explore/guest-result-feedback',(req,res)=>{const value={choice:req.body.choice,...(req.body.choice==='other'?{text:req.body.text}:{})};guestFeedback.set(req.body.key,value);res.json(value);});
app.post('/api/explore/records',(req,res)=>{const r={...records[0],id:'review-saved-'+Date.now(),date:new Date().toISOString(),answers:req.body.answers};records.unshift(r);res.json(r);});
app.delete('/api/explore/records/:id',(req,res)=>{const index=records.findIndex(r=>r.id===req.params.id);if(index>=0)records.splice(index,1);res.json({deleted:true});});
app.post('/api/user/register',(req,res)=>res.json({verificationRequired:true,email:req.body.email,message:'本機範例：帳號建立成功，未寄出信件。'}));
app.use('/api',(_req,res)=>res.status(404).json({message:'本機驗收不開放這項操作，沒有連到正式服務。'}));
app.use(async(req,res,next)=>{
  const relative=req.path.endsWith('/')?req.path+'index.html':req.path;
  if(!relative.endsWith('.html'))return next();
  const file=path.resolve(root,'.'+relative);
  if(!file.startsWith(root+path.sep))return res.sendStatus(403);
  try{const source=await fs.readFile(file,'utf8');res.type('html').send(source.replaceAll('https://color-web-server-jprj.onrender.com',base).replace('<body>','<body><div style="text-align:center;padding:4px;background:#f5e5e8;font:12px system-ui">本機驗收・假資料・不寄信 <a href="/">返回驗收入口</a></div>'));}catch{next();}
});
app.use(express.static(root));
fs.readFile(path.resolve(__dirname,'../tmp/record-experience-state.json'),'utf8').then(raw=>{const saved=JSON.parse(raw);if(Array.isArray(saved))records.splice(0,records.length,...saved);}).catch(()=>{}).then(()=>app.listen(port,'127.0.0.1',()=>console.log(`Local acceptance: ${base}`)));
