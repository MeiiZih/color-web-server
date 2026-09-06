const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');
const { catalogEntry, recordView, submissionId } = require('../services/explore');
const { previewLegacyRecords, importLegacyRecords } = require('../services/legacyRecordImport');
const router = express.Router();
const model = import('../../color-web/app/model.mjs');
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const ownerQuery = req => req.memberRole === 'admin' ? { adminId: req.member._id } : { adminId: null, $or: [{ userId: req.member._id }, { userId: null, email: req.member.email }] };

router.get('/catalog', handle(async (_req, res) => {
  const docs = await TestQuestion.find().sort({ createdAt: 1 }).lean();
  res.json(docs.map(catalogEntry).filter(Boolean));
}));

router.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!['user', 'admin'].includes(payload.role)) return res.status(403).json({ message: '請使用會員或管理員帳號作答。' });
    req.memberRole = payload.role;
    if (payload.role === 'admin') {
      req.member = await Admin.findById(payload.id).select('_id email name role sessionVersion').lean();
      if (!req.member || req.member.role !== 'admin') return res.status(403).json({ message: '管理員身分不存在，請重新登入。' });
      if (!require('../services/sessionVersion')(payload, req.member, 'admin')) return res.status(401).json({ message: '登入已失效，請重新登入。' });
      return next();
    }
    req.member = await User.findById(payload.id).select('_id email name emailVerificationRequired emailVerifiedAt sessionVersion').lean();
    if (!req.member) return res.status(401).json({ message: '請重新登入會員。' });
    if (!require('../services/sessionVersion')(payload, req.member, 'user')) return res.status(401).json({ message: '登入已失效，請重新登入。' });
    if (require('../services/emailVerification').needsVerification(req.member)) return res.status(403).json({ message: '請先驗證 Email，再使用會員功能。' });
    next();
  } catch { res.status(401).json({ message: '登入已過期，請重新登入；作答進度仍會保留。' }); }
});

router.get('/me', (req, res) => res.json({ id: String(req.member._id), role: req.memberRole, email: req.member.email, name: req.member.name, ...(req.memberRole === 'user' ? { emailVerifiedAt: req.member.emailVerifiedAt || null, emailVerificationRequired: req.member.emailVerificationRequired === true } : {}) }));
router.route('/records/legacy-import').all((req, res, next) => {
  if (req.memberRole !== 'admin') return res.status(403).json({ message: '請使用管理員帳號同步舊紀錄。' });
  next();
}).get(handle(async (req, res) => {
  try { res.json(await previewLegacyRecords(req.member)); }
  catch (error) { if (!error.status) throw error; res.status(error.status).json({ message: error.message }); }
})).post(handle(async (req, res) => {
  try { res.json(await importLegacyRecords(req.member, req.body)); }
  catch (error) { if (!error.status) throw error; res.status(error.status).json({ message: error.message }); }
}));
router.get('/records', handle(async (req, res) => {
  const records = await TestRecord.find(ownerQuery(req)).sort({ timestamp: -1 }).limit(200).lean();
  res.json(records.map(recordView));
}));

router.delete('/records/:id', handle(async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: '紀錄識別碼不正確。' });
  const result = await TestRecord.deleteOne({ _id: req.params.id, ...ownerQuery(req) });
  if (!result.deletedCount) return res.status(404).json({ message: '找不到你的這筆紀錄，請重新載入確認。' });
  res.json({ deleted: true });
}));

router.post('/records', handle(async (req, res) => {
  const { surveyId, version, answers, key } = req.body;
  if (!/^[a-f\d]{24}$/i.test(surveyId || '')) return res.status(400).json({ message: '問卷識別碼不正確。' });
  let id;
  try { id = submissionId(req.memberRole === 'admin' ? `admin:${req.member._id}` : req.member._id, key); } catch (error) { return res.status(400).json({ message: error.message }); }
  const existing = await TestRecord.findOne({ _id: id, ...ownerQuery(req) }).lean();
  if (existing) {
    if (existing.exploration.surveyId !== surveyId || JSON.stringify(existing.exploration.answers) !== JSON.stringify(answers)) return res.status(409).json({ message: '這次作答已儲存，請重新載入測驗紀錄查看。' });
    return res.json(recordView(existing));
  }
  const doc = await TestQuestion.findById(surveyId).lean();
  const survey = doc && catalogEntry(doc);
  if (!survey) return res.status(404).json({ message: '這份問卷已下架，答案仍保留在此裝置。' });
  if (survey.version !== version) return res.status(409).json({ message: '題目已更新，請回到測驗列表重新載入後作答。' });
  const { finishSurvey, colors } = await model;
  let scored;
  try { scored = finishSurvey(survey, answers); } catch (error) { return res.status(400).json({ message: error.message }); }
  const values = {
    _id: id, ...(req.memberRole === 'admin' ? { adminId: req.member._id } : { userId: req.member._id, email: req.member.email }), userName: req.member.name, testType: survey.title,
    result: scored.mbti || '問卷已完成', mbtiResult: scored.mbti,
    answers: answers.map((a, i) => ({ questionId: i + 1, question: survey.questions[i].question, answer: survey.questions[i].options[a] })),
    exploration: { surveyId, version, answers, survey },
  };
  if (scored.counts) {
    values.scores = Object.fromEntries(colors.map((c, i) => [c.key, scored.counts[i]]));
    [['E', 'I'], ['N', 'S'], ['F', 'T'], ['J', 'P']].forEach(([first, second], group) => {
      const count = answers.slice(group * 5, group * 5 + 5).filter(a => a < 2).length;
      values.scores[first] = count; values.scores[second] = 5 - count;
    });
    const ranks = [...new Set(scored.counts)].sort((a, b) => b - a);
    values.colorResult = Object.fromEntries(['primary', 'secondary', 'third', 'fourth'].map((rank, i) => [rank, colors.filter((_, c) => scored.counts[c] === ranks[i]).map(c => c.key)]));
  }
  try { const saved = await TestRecord.create(values); res.status(201).json(recordView(saved.toObject())); }
  catch (error) {
    if (error.code !== 11000) throw error;
    const saved = await TestRecord.findOne({ _id: id, ...ownerQuery(req) }).lean();
    if (!saved) throw error;
    res.json(recordView(saved));
  }
}));
module.exports = router;
