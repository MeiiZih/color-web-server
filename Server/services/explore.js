const { createHash } = require('node:crypto');
const colorTitles = new Set(['色彩性格測驗', '我在色彩學中的MBTI']);

function catalogEntry(doc) {
  const questions = (doc.questions || []).map(q => ({ questionNumber: q.questionNumber, question: q.question, options: [...q.options] }));
  if (!questions.length || questions.some(q => typeof q.question !== 'string' || !q.options.length || q.options.some(o => typeof o !== 'string'))) return null;
  const color = colorTitles.has(doc.testType.replace(/[\s\u3000]/g, '')) && questions.length === 20 && questions.every(q => q.options.length === 4);
  const version = createHash('sha256').update(JSON.stringify([doc.testType, questions, color])).digest('hex').slice(0, 16);
  return { id: String(doc._id), version, title: doc.testType, description: doc.description || '留一點時間，認識不同面向的自己。',
    category: color ? '色彩性格' : '探索問卷', featured: color, minutes: Math.max(1, Math.ceil(questions.length * .3)),
    color: color ? 'red' : 'blue', resultType: color ? 'color-mbti' : 'receipt', questions };
}

function recordView(record) {
  if (record.exploration) return { ...record.exploration, id: String(record._id), date: record.timestamp, cloud: true };
  // Old records keep their stored answers and result, never reinterpret them with today's questions.
  return { id: String(record._id), date: record.timestamp, legacy: true, cloud: true, title: record.testType,
    result: record.result || record.mbtiResult || '已完成', mbtiResult: record.mbtiResult, colorResult: record.colorResult, answers: record.answers || [] };
}

function submissionId(userId, key) {
  if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key)) throw new Error('提交識別碼不正確');
  return createHash('sha256').update(`${userId}:${key}`).digest('hex').slice(0, 24);
}

module.exports = { catalogEntry, recordView, submissionId };
