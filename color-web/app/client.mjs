export async function request(path, options = {}) {
  const publicRead = (!options.method || options.method === 'GET') && ['/api/explore/catalog','/api/homepage'].includes(path);
  const token = publicRead ? null : sessionStorage.getItem('userToken') || (path.startsWith('/api/explore/') ? sessionStorage.getItem('adminToken') : null);
  const response = await fetch(path, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, signal: options.signal || AbortSignal.timeout(20000) });
  let body;
  try { body = await response.json(); } catch { throw new Error('服務尚未準備好，請稍後重試；你的答案仍保留。'); }
  if (!response.ok) throw new Error(body.message || '連線未完成，請稍後重試。');
  return body;
}

export function isCurrentContent(item, now = Date.now()) {
  // These six imported activity posters were already classified as historical archives.
  if (item.type === 'news' && /^\/assets\/images\/act[1-6]\./.test(item.imageUrl || '')) return false;
  return !item.expiresAt || new Date(item.expiresAt).getTime() > now;
}

export function safeUrl(value, fallback = '/colorlab-mark.svg') {
  try {
    const url = new URL(value || fallback, location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return fallback;
    if (url.origin === location.origin && url.pathname.startsWith('/uploads/')) return (window.COLORLAB_API_ORIGIN || '') + url.pathname;
    return url.href;
  } catch { return fallback; }
}

export function readLocal(storage, key, catalog) {
  const empty = { drafts: {}, records: [] };
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (!saved) return empty;
    for (const survey of catalog) {
      const draft = saved.drafts?.[survey.id];
      if (draft?.version !== survey.version || !Array.isArray(draft.answers) || draft.answers.length !== survey.questions.length) continue;
      if (!draft.answers.every((a, i) => a === null || (Number.isInteger(a) && a >= 0 && a < survey.questions[i].options.length))) continue;
      empty.drafts[survey.id] = { ...draft, index: Math.min(survey.questions.length - 1, Math.max(0, Number.isInteger(draft.index) ? draft.index : 0)) };
    }
    // Completed records carry their own question snapshot, independent of the live catalog.
    empty.records = (Array.isArray(saved.records) ? saved.records : []).filter(r =>
      r && /^[a-z\d-]+$/i.test(r.id) && Number.isFinite(new Date(r.date).getTime()) && r.survey?.questions?.length
      && Array.isArray(r.answers) && r.answers.length === r.survey.questions.length
      && r.answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < r.survey.questions[i].options.length)).slice(0, 100);
    return empty;
  } catch { return empty; }
}

export async function saveRecord(survey, draft, member) {
  if (!member) return { id: draft.key, date: new Date().toISOString(), surveyId: survey.id, version: survey.version, answers: [...draft.answers], survey };
  return request('/api/explore/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyId: survey.id, version: survey.version, answers: draft.answers, key: draft.key }) });
}
