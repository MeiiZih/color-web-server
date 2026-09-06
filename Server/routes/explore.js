const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TestQuestion = require('../models/TestQuestion');
const TestRecord = require('../models/TestRecord');
const { catalogEntry, recordView, submissionId } = require('../services/explore');
const router = express.Router();
const model = import('../../color-web/app/model.mjs');
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get('/catalog', handle(async (_req, res) => {
  const docs = await TestQuestion.find().sort({ createdAt: 1 }).lean();
  res.json(docs.map(catalogEntry).filter(Boolean));
}));

router.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (payload.role !== 'user') return res.status(403).json({ message: '請使用會員帳號作答；管理員可從「我的」進入後台。' });
    req.member = await User.findById(payload.id).select('_id email name').lean();
    if (!req.member) return res.status(401).json({ message: '請重新登入會員。' });
    next();
  } catch { res.status(401).json({ message: '登入已過期，請重新登入；作答進度仍會保留。' }); }
});

router.get('/me', (req, res) => res.json({ id: String(req.member._id), email: req.member.email, name: req.member.name }));
router.get('/records', handle(async (req, res) => {
  const records = await TestRecord.find({ $or: [{ userId: req.member._id }, { userId: null, email: req.member.email }] }).sort({ timestamp: -1 }).limit(200).lean();
  res.json(records.map(recordView));
}));

router.post('/records', handle(async (req, res) => {
  const { surveyId, version, answers, key } = req.body;
  if (!/^[a-f\d]{24}$/i.test(surveyId || '')) return res.status(400).json({ message: '問卷識別碼不正確。' });
  let id;
  try { id = submissionId(req.member._id, key); } catch (error) { return res.status(400).json({ message: error.message }); }
  const existing = await TestRecord.findOne({ _id: id, userId: req.member._id }).lean();
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
    _id: id, userId: req.member._id, email: req.member.email, userName: req.member.name, testType: survey.title,
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
    const saved = await TestRecord.findOne({ _id: id, userId: req.member._id }).lean();
    if (!saved) throw error;
    res.json(recordView(saved));
  }
}));
module.exports = router;
