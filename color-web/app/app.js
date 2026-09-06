import { colors, scoreAnswers, finishSurvey } from './model.mjs';
import { request, readLocal, saveRecord, safeUrl, isCurrentContent } from './client.mjs';
import { restoreSession, clearSession } from './auth.mjs';
import { verificationStatus, bindVerificationStatus } from './verification-status.mjs';
import { mediaFor, contentMedia } from './content-media.mjs';
import { character, characterCast, motionToggle, bindCharacterMotion } from './character-art.mjs';
import { sourceHelp } from './source-help.mjs';
restoreSession();

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const nav = document.querySelector('#navigation');
let previewStorage;
try { previewStorage = window.localStorage; } catch { /* Private mode may block storage. */ }
let state;
let catalog = [];
let activeSurvey;
let questions = [];
let hue = 0;
let noticeTimer;
let FEATURED_SURVEY;
let member = null;
let storageKey;
let historyError = '';
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  test: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
  history: '<path d="M4 7a9 9 0 1 1-1 9M3 3v5h5M12 7v5l3 2"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  external: '<path d="M13 3h8v8m0-8L10 14M9 4H4v16h16v-5"/>',
  leaf: '<path d="M20 3C7 2 2 8 5 15s15 5 15-12ZM5 20l9-10"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const draft = () => state.drafts[activeSurvey.id];
const answered = (id = activeSurvey.id) => state.drafts[id]?.answers.filter(a => a !== null).length || 0;
const dateLabel = value => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

function notify(message) {
  const el = document.querySelector('#notice');
  clearTimeout(noticeTimer);
  el.textContent = message;
  el.classList.add('visible');
  noticeTimer = setTimeout(() => el.classList.remove('visible'), 4500);
}
function persist() {
  try { previewStorage.setItem(storageKey, JSON.stringify({ drafts: state.drafts, records: state.records.filter(r => !r.cloud) })); }
  catch { notify('瀏覽器無法儲存進度，關閉這個分頁前請先完成測驗。'); }
}
function shape(key, extra = '') {
  const art = {
    red: '<g fill="currentColor"><ellipse cx="80" cy="50" rx="23" ry="39"/><ellipse cx="80" cy="110" rx="23" ry="39"/><ellipse cx="50" cy="80" rx="39" ry="23"/><ellipse cx="110" cy="80" rx="39" ry="23"/></g><circle cx="80" cy="80" r="18" fill="#fcf8f4"/>',
    yellow: '<g stroke="currentColor" stroke-width="9"><path d="M80 5v25m0 100v25M5 80h25m100 0h25M27 27l18 18m70 70 18 18M27 133l18-18m70-70 18-18"/></g><circle cx="80" cy="80" r="36" fill="currentColor"/>',
    green: '<path d="M80 140V38" stroke="currentColor" stroke-width="6"/><path d="M80 88C25 88 20 48 25 24c39 0 55 29 55 64Zm0 34c53 0 66-42 57-68-41 2-57 27-57 68Z" fill="currentColor"/>',
    blue: '<ellipse cx="80" cy="80" rx="67" ry="33" fill="none" stroke="currentColor" stroke-width="7" transform="rotate(-40 80 80)"/><circle cx="80" cy="80" r="31" fill="currentColor"/><circle cx="121" cy="32" r="10" fill="#fcf8f4" stroke="currentColor" stroke-width="5"/>'
  };
  return `<svg class="color-shape ${extra}" viewBox="0 0 160 160" aria-hidden="true">${art[key]}</svg>`;
}

let articles = [];
let resources = [];

function home() {
  const featured = catalog.find(s => s.id === FEATURED_SURVEY) || catalog[0];
  if (!featured) return '<div class="empty-state"><h1>新的探索，正在準備中</h1><p>目前沒有開放的問卷，過去的紀錄仍可查看。</p><a class="button primary" href="#history">查看測驗紀錄</a></div>';
  const count = answered(featured.id);
  return `<div class="home-page page-width">
    <section class="hero" aria-labelledby="home-heading">
      <div class="hero-copy"><div class="eyebrow"><span class="tiny-flower">✳</span> A LITTLE CLOSER TO YOU</div>
        <h1 id="home-heading">你的每一面，<br>都有自己的<span class="rose-word">顏色。</span></h1>
        <p class="hero-description">留一點時間給自己。<br>從 ${featured.questions.length} 個日常選擇，遇見更真實的你。</p>
        <div class="test-facts"><span>${icon('test')}${featured.questions.length} 道題目</span><span>${icon('clock')}約 ${featured.minutes} 分鐘</span></div>
        <a class="button primary hero-cta" href="#test/${featured.id}">${count ? `繼續測驗 · 第 ${state.drafts[featured.id].index + 1} 題` : featured.resultType === 'color-mbti' ? '開始我的色彩探索' : '開始探索'}${icon('arrow')}</a>
        <p class="microcopy">${count ? `已完成 ${count} / ${featured.questions.length} 題，進度保留在這個瀏覽器。` : '沒有標準答案，選最像你的就好。'}</p>
        <a class="text-button all-surveys-link" href="#surveys">探索全部測驗${icon('arrow')}</a>
      </div>
      <div class="color-studio"><div class="studio-top"><span>THE COLORS OF YOU</span><span>01 — 04</span></div>
        <div class="color-deck" aria-label="探索四種性格色彩">${colors.map((c, i) => `<button class="swatch ${i === hue ? 'selected' : ''}" data-hue="${i}" aria-pressed="${i === hue}" aria-label="${c.name}色：${c.title}" style="--swatch:${c.light};--color:${c.ink};--rotate:${[-12, -4, 5, 13][i]}deg;--order:${i}"><span class="swatch-number">0${i + 1}</span>${character(c.key)}<span class="swatch-word">${c.word}</span><span class="swatch-english">${c.en.toUpperCase()}</span></button>`).join('')}</div>
        <p class="color-caption" aria-live="polite"><strong>${colors[hue].name}色 · ${colors[hue].title}</strong><span>輕點色卡，先認識不同的自己</span></p>${motionToggle()}
      </div>
    </section>
    <section class="gentle-note"><span class="note-symbol">↳</span><p>不急著定義自己，<strong>先好好認識自己。</strong></p><span class="note-end">YOUR OWN PACE</span></section>
    <section class="editorial-section" aria-labelledby="news-heading"><div class="section-heading"><div><span class="eyebrow">SOMETHING TO EXPLORE</span><h2 id="news-heading">最近，值得留意的事</h2></div><span class="section-meta">最新資訊<span>滑動看看</span></span></div>
      <div class="horizontal-list" tabindex="0" aria-label="最新資訊，可左右滑動或使用方向鍵">${articles.map((a, i) => `<button class="article-card" data-article="${i}"><div class="article-image">${contentMedia(a)}<span class="tag">${escape(a.tag)}</span></div><div class="article-copy"><h3>${escape(a.title)}</h3><p>${escape(a.description)}</p><p class="source-note">${escape(a.sourceNote)}</p><span class="read-link">查看資訊 ${icon('arrow')}</span></div></button>`).join('')}</div>
      <p class="archive-note">活動日期與參加方式，請以主辦單位公告為準。</p>
    </section>
    <section class="editorial-section resources" aria-labelledby="resources-heading"><div class="section-heading"><div><span class="eyebrow">A MOMENT FOR YOURSELF</span><h2 id="resources-heading">給心一點空間</h2></div><span class="section-meta">一般資訊<span>滑動看看</span></span></div>
      <div class="horizontal-list" tabindex="0" aria-label="一般資訊，可左右滑動或使用方向鍵">${resources.map((a, i) => `<button class="resource-card" data-resource="${i}">${contentMedia(a, 'compact')}<span class="resource-copy"><small>${escape(a.tag)}</small><h3>${escape(a.title)}</h3><p>${escape(a.description)}</p><p class="source-note">${escape(a.sourceNote)}</p></span>${icon('arrow')}</button>`).join('')}</div>
    </section>
    <footer class="page-footer"><span>ColorLab<span class="brand-dot">.</span></span><p>每一種顏色，都有值得被理解的地方。</p><p><a href="/app/account.html#about">關於我們</a> · <a href="/app/account.html#privacy">隱私與資料</a> · <a href="/app/account.html#contact">意見回饋</a></p><small>ColorLab · 自我探索與心理健康資訊</small></footer>
  </div>`;
}

function quizCompanion(index, total, variant) {
  const active = Math.min(3, Math.floor(index * 4 / total));
  return `<div class="quiz-companion companion-${variant}" aria-label="四色角色陪你作答"><div class="companion-cast" aria-hidden="true">${colors.map((c, i) => `<span class="companion-member ${i === active ? 'is-active' : ''}">${character(c.key)}</span>`).join('')}</div><div class="companion-copy"><strong>我們陪你，慢慢來。</strong><p data-companion-message>${index === total - 1 ? '最後一題了，依照自己的感受完成就好。' : '沒有標準答案，選最貼近自己的就好。'}</p><small>照自己的步調就好，角色不評判答案。</small></div>${motionToggle()}</div>`;
}

function test() {
  questions = activeSurvey.questions;
  if (!draft()) { state.drafts[activeSurvey.id] = { answers: Array(questions.length).fill(null), index: 0, version: activeSurvey.version, key: crypto.randomUUID() }; persist(); }
  const { index, answers } = draft();
  const q = questions[index];
  const count = answered();
  const sections = activeSurvey.sections || [activeSurvey.title];
  const sectionIndex = Math.min(sections.length - 1, Math.floor(index * sections.length / questions.length));
  return `<div class="test-page page-width"><div class="test-topline"><a href="#surveys" class="text-button">${icon('back')}暫存並離開</a><span class="saved-state">${icon('check')}進度自動儲存</span></div><p class="survey-context">${escape(activeSurvey.title)}</p>
    <div class="test-layout"><aside class="test-sidebar"><span class="eyebrow">YOUR COLOR JOURNEY</span><h1>慢慢選，<br>選出你的樣子。</h1><p>想想平常的自己，<br>讓第一直覺帶你找到答案。</p><ol>${sections.map((s, i) => `<li class="${sectionIndex === i ? 'current' : ''}"><span>${i + 1}</span>${escape(s)}</li>`).join('')}</ol>${quizCompanion(index, questions.length, 'desktop')}</aside>
    <section class="question-area" aria-labelledby="question-heading">${quizCompanion(index, questions.length, 'mobile')}<div class="question-progress"><span>${escape(sections[sectionIndex])}</span><strong><span id="answer-count">${count}</span><small> / ${questions.length} 已完成</small></strong></div><progress value="${count}" max="${questions.length}" aria-label="已完成的題數">${count} / ${questions.length}</progress>
      <form id="question-form"><fieldset ${draft().pending ? 'disabled' : ''}><legend id="question-heading" tabindex="-1"><span class="question-number">QUESTION ${String(index + 1).padStart(2, '0')} <small>/ ${questions.length}</small></span><span class="question-text">${escape(q.question)}</span></legend><p class="question-helper">選擇最符合你的一項。</p>
        <div class="options">${q.options.map((o, i) => `<label class="option"><input type="radio" name="answer" value="${i}" ${answers[index] === i ? 'checked' : ''}><span class="option-letter">${i < 26 ? String.fromCharCode(65 + i) : i + 1}</span><span class="option-copy">${escape(o.replace(/^[A-Z]\.\s*/, ''))}</span><span class="option-check">${icon('check')}</span></label>`).join('')}</div>
      </fieldset><div class="question-actions"><button class="button secondary" type="button" data-previous ${index === 0 || draft().pending ? 'disabled' : ''}>${icon('back')}上一題</button><button class="button primary" id="next-question" type="submit" ${answers[index] === null ? 'disabled' : ''}>${index === questions.length - 1 ? (activeSurvey.resultType === 'receipt' ? '完成問卷' : '看我的結果') : '下一題'}${icon('arrow')}</button></div>
      <p class="question-bottom" id="selection-status" role="status">${answers[index] === null ? '選好答案後，再往下一步。' : '已選好，你也可以隨時更改。'}</p></form>
    </section></div></div>`;
}

function result(record) {
  if (record.legacy) return legacyResult(record);
  const survey = record.survey;
  if (survey.resultType !== 'color-mbti') return receipt(record, survey);
  const r = scoreAnswers(record.answers);
  const c = colors[r.primary];
  const matched = colors.filter((_, i) => r.counts[i] === Math.max(...r.counts));
  const report = `/test/detailed-reports/${r.mbti}-${matched.map(c => c.key).sort().join('-')}.pdf`;
  return `<div class="result-page narrow-width"><a href="#history" class="text-button">${icon('back')}測驗紀錄</a><section class="result-hero" style="--result-light:${c.light};--result-ink:${c.ink}"><div class="eyebrow">A LITTLE MORE YOU</div><p class="result-kicker">你的色彩探索完成了</p><div class="result-characters">${matched.map(c => character(c.key)).join('')}</div><h1>${c.title}</h1><p class="result-type">${c.name}色性格 <span>×</span> ${r.mbti}</p><p class="result-intro">${c.description}</p><div class="result-stamp">${icon('check')}20 題完成 · ${dateLabel(record.date)}</div></section>
    <section class="result-section"><div class="section-heading"><h2>你的四色比例</h2><span class="muted">每個選擇，都是你的一部分</span></div><div class="color-bars">${colors.map((color, i) => `<div class="color-bar"><span class="bar-label"><i style="background:${color.fill}"></i>${color.name}色</span><span class="bar-track"><span style="width:${r.counts[i] * 5}%;background:${color.fill}"></span></span><strong>${r.counts[i] * 5}%</strong></div>`).join('')}</div>${matched.length > 1 ? `<p class="muted">${matched.map(c => c.name + '色').join('、')}同為最高分；摘要排序沿用原站規則。</p>` : ''}</section>
    <section class="result-section"><h2>多認識自己一點</h2>${colors.filter((_, i) => r.counts[i] > 0).sort((a, b) => r.counts[colors.indexOf(b)] - r.counts[colors.indexOf(a)]).map(color => `<details class="insight"><summary><span><i style="background:${color.fill}"></i>${color.name}色 · ${color.title}</span><span class="expand-symbol">＋</span></summary><p>${color.description}</p></details>`).join('')}</section>
    <section class="report-panel"><div class="report-heading">${icon('test')}<div><h2>把這份認識，留給自己</h2><p>完整報告書 · ${r.mbti} / ${matched.map(c => c.name).join('、')}色</p></div></div><div class="report-actions"><button class="button secondary" data-pdf="${report}">${icon('eye')}預覽 PDF</button><a class="button primary" href="${report}" download="ColorLab-${r.mbti}.pdf">${icon('download')}下載 PDF</a></div></section>
    <p class="preview-note">${record.cloud ? '已儲存至你的會員帳號。' : '訪客紀錄保存在此瀏覽器，清除網站資料後將無法恢復。'}<br>本測驗用於自我探索，不是心理或醫療診斷。</p><a class="text-button centered" href="#home">回到首頁${icon('arrow')}</a>
  </div>`;
}

function historyCard(record) {
  if (record.legacy) return `<a class="history-card" href="#result/${record.id}"><div class="history-art">${icon('history')}</div><div><time>${dateLabel(record.date)}</time><h3>${escape(record.title)}</h3><p>${escape(record.result)} · 歷史紀錄</p></div>${icon('arrow')}</a>`;
  const survey = record.survey;
  const scored = survey.resultType === 'color-mbti' ? scoreAnswers(record.answers) : null;
  const color = scored ? colors[scored.primary] : (colors.find(c => c.key === survey.color) || colors[3]);
  return `<a class="history-card" href="#result/${record.id}"><div class="history-art" style="background:${color.light};color:${color.ink}">${shape(color.key)}</div><div><time datetime="${escape(record.date)}">${dateLabel(record.date)}</time><h3>${escape(survey.title)}</h3><p>${scored ? `${color.title} · ${scored.mbti}` : `${record.answers.length} 題已完成 · 一般問卷`}</p></div>${icon('arrow')}</a>`;
}

function surveyList() {
  return `<div class="narrow-width survey-list-page"><span class="eyebrow">FIND YOUR NEXT DISCOVERY</span><h1>這次，想探索哪一面？</h1><p class="muted">每一份問卷，都是一次認識自己的機會。</p><div class="survey-catalog">${catalog.map(survey => {
    const count = answered(survey.id);
    const color = colors.find(c => c.key === survey.color) || colors[0];
    return `<article class="survey-card ${survey.resultType === 'color-mbti' ? 'has-character-cover' : ''}">${survey.resultType === 'color-mbti' ? `<div class="survey-cover"><span class="eyebrow">四種色彩，一起出發</span>${characterCast()}${motionToggle()}</div>` : `<div class="survey-art" style="color:${color.ink};background:${color.light}">${shape(color.key)}</div>`}<div class="survey-card-copy"><span class="survey-badge">${survey.id === FEATURED_SURVEY ? '主打測驗' : escape(survey.category)}</span><h2>${escape(survey.title)}</h2><p>${escape(survey.description)}</p><div class="test-facts"><span>${icon('test')}${survey.questions.length} 題</span><span>${icon('clock')}約 ${survey.minutes} 分鐘</span></div>${count ? `<p class="draft-note">已完成 ${count} / ${survey.questions.length} 題 · 進度已保留</p>` : ''}<a class="button ${survey.id === FEATURED_SURVEY ? 'primary' : 'secondary'}" href="#test/${survey.id}">${count ? '繼續作答' : '開始測驗'}${icon('arrow')}</a></div></article>`;
  }).join('')}</div></div>`;
}

function receipt(record, survey) {
  return `<div class="narrow-width"><a class="text-button" href="#history">${icon('back')}測驗紀錄</a><section class="empty-state"><span class="eyebrow">ALL DONE</span><h1>問卷已完成</h1><p>${escape(survey.title)} · ${record.answers.length} 題<br>${dateLabel(record.date)}</p><p>這份問卷不計性格分數，以下是你的作答。</p></section><section class="receipt-answers"><h2>我的作答</h2>${survey.questions.map((q, i) => `<div class="receipt-answer"><h3>${i + 1}. ${escape(q.question)}</h3><p>${escape(q.options[record.answers[i]])}</p></div>`).join('')}</section><a class="button primary" href="#surveys">探索其他測驗${icon('arrow')}</a><p class="preview-note">${record.cloud ? '已儲存至你的會員帳號。' : '訪客紀錄僅保存在此瀏覽器。'}</p></div>`;
}

function historyPage() {
  return `<div class="narrow-width history-page"><div class="eyebrow">YOUR COLOR DIARY</div><h1>每一次，都更認識自己。</h1><p class="muted">收藏不同問卷的作答與結果。</p><div class="history-heading"><h2>我的測驗紀錄</h2><span>${state.records.length} 份紀錄</span></div>${state.records.length ? state.records.map(historyCard).join('') : `<div class="empty-state">${shape('green')}<h2>第一頁，等你來寫。</h2><p>完成測驗後，你的紀錄就會出現在這裡。</p><a href="#surveys" class="button primary">選擇測驗${icon('arrow')}</a></div>`}<p class="preview-note">${escape(historyError || (member ? '顯示最近 200 份會員紀錄。' : '訪客紀錄僅在此瀏覽器可用。'))}</p></div>`;
}
function legacyResult(record) {
  const primary = Array.isArray(record.colorResult?.primary) ? record.colorResult.primary : [record.colorResult?.primary];
  const reportColors = [...new Set(primary)].filter(key => colors.some(c => c.key === key)).sort();
  const report = /^[EI][NS][FT][JP]$/.test(record.mbtiResult || '') && reportColors.length ? `/test/detailed-reports/${record.mbtiResult}-${reportColors.join('-')}.pdf` : null;
  return `<div class="narrow-width"><a href="#history" class="text-button">${icon('back')}測驗紀錄</a><section class="result-section"><h1>${escape(record.title)}</h1><p>${dateLabel(record.date)}</p><h2>${escape(record.result)}</h2><div class="result-characters">${reportColors.map(character).join('')}</div><p class="muted">保留原始測驗結果與作答，不以更新後的題目重新計分。</p>${report ? `<div class="report-actions"><button class="button secondary" data-pdf="${report}">${icon('eye')}預覽 PDF</button><a class="button primary" href="${report}" download>${icon('download')}下載 PDF</a></div>` : ''}${record.answers.map((a, i) => `<div class="receipt-answer"><h3>${i + 1}. ${escape(a.question || '原始題目')}</h3><p>${escape(a.answer || '未記錄')}</p></div>`).join('')}</section></div>`;
}

function me() {
  const admin = sessionStorage.getItem('adminToken');
  return `<div class="narrow-width profile-page"><span class="eyebrow">YOUR LITTLE SPACE</span><h1>給自己的一個角落。</h1><div class="profile-card"><img src="/colorlab-mark.svg" alt="" width="72" height="72"><div><h2>嗨，${escape(member?.name || (admin ? '管理員' : '探索中的你'))}</h2><p>${member ? escape(member.email) : admin ? '管理員模式' : '目前以訪客身分探索'}</p></div></div><a class="profile-row" href="#history">${icon('history')}我的測驗紀錄<span>${state.records.length} 份 ${icon('arrow')}</span></a><a class="profile-row" href="#surveys">${icon('test')}全部測驗與未完成的問卷${icon('arrow')}</a>${admin ? '<a class="button primary" href="/app/account.html#admin">進入管理後台</a>' : member ? '<a class="profile-row" href="/app/account.html#profile">編輯會員資料</a><button class="button secondary" data-logout>登出</button>' : '<a class="button primary" href="/app/account.html#login">登入／註冊會員</a><p class="preview-note">登入後，完成的測驗會儲存到帳號；訪客紀錄不會自動合併。</p>'}</div>`;
}

function openDialog(content) {
  document.querySelector('#dialog-content').innerHTML = content;
  dialog.showModal();
}
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { document.querySelector('#dialog-content').replaceChildren(); });

function render(direction = 'page') {
  if (!state) return;
  if (dialog.open) dialog.close();
  const [rawRoute, id] = location.hash.slice(1).split('/');
  const route = rawRoute || 'home';
  const active = route === 'result' ? 'history' : route === 'test' ? 'surveys' : route;
  activeSurvey = catalog.find(s => s.id === (id || FEATURED_SURVEY)) || catalog[0];
  nav.innerHTML = [['home', '首頁'], ['surveys', '測驗'], ['history', '紀錄'], ['me', '我的']].map(([key, label]) => `<a href="#${key}" ${key === active ? 'aria-current="page"' : ''}>${icon(key === 'surveys' ? 'test' : key)}<span>${label}</span></a>`).join('');
  const record = state.records.find(r => r.id === id);
  main.innerHTML = route === 'surveys' ? (catalog.length ? surveyList() : home()) : route === 'test' ? (!activeSurvey || id && !catalog.some(s => s.id === id) ? '<div class="empty-state"><h1>找不到這份問卷</h1><a href="#surveys" class="button primary">返回全部測驗</a></div>' : test()) : route === 'history' ? historyPage() : route === 'me' ? me() : route === 'result' && record ? result(record) : home();
  document.body.dataset.page = route;
  main.dataset.stepMotion = direction === 'next' || direction === 'previous' ? direction : 'page';
  document.title = `ColorLab｜${({ home: '發現你的本色', surveys: '全部測驗', test: activeSurvey?.title || '測驗', history: '測驗紀錄', result: '測驗結果', me: '我的空間' })[route] || '首頁'}`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  main.focus({ preventScroll: true });
  bindPage();
}

function bindPage() {
  bindCharacterMotion(main);
  const profile = document.querySelector('.profile-page');
  if (profile && !member) profile.querySelector('.profile-card').insertAdjacentHTML('afterend', `<p class="muted">${sessionStorage.getItem('adminToken') ? '目前使用管理員身分；會員 Email 驗證不適用於管理員帳號。' : '登入會員後，可在這裡查看 Email 驗證狀態。'}</p>`);
  if (profile && member) profile.querySelector('.profile-card').insertAdjacentHTML('afterend', `<section class="verification-panel"><div data-verification-status>${verificationStatus(member)}</div><a class="text-button" href="/app/account.html#profile">管理 Email 驗證${icon('arrow')}</a></section>`);
  bindVerificationStatus(document.querySelector('[data-verification-status]'), () => request('/api/user/profile'), user => { member = { ...member, emailVerifiedAt: user.emailVerifiedAt || null, emailVerificationRequired: user.emailVerificationRequired === true }; });
  if (document.body.dataset.page === 'test' && draft()?.pending) {
    document.querySelector('#selection-status').textContent = '上次儲存尚未確認，請重新儲存相同答案，避免產生重複紀錄。';
  }
  document.querySelector('[data-logout]')?.addEventListener('click', () => {
    clearSession();
    location.replace('/app/');
  });
  document.querySelectorAll('.horizontal-list').forEach(list => list.addEventListener('keydown', event => {
    if (event.target !== list || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (!list.firstElementChild) return;
    const distance = list.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(list).gap);
    list.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }));
  document.querySelectorAll('[data-hue]').forEach(button => button.addEventListener('click', () => {
    hue = Number(button.dataset.hue);
    document.querySelectorAll('[data-hue]').forEach(el => { const selected = Number(el.dataset.hue) === hue; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected); });
    document.querySelector('.color-caption strong').textContent = `${colors[hue].name}色 · ${colors[hue].title}`;
  }));
  document.querySelectorAll('[data-article], [data-resource]').forEach(button => button.addEventListener('click', () => {
    const isResource = button.hasAttribute('data-resource');
    const a = isResource ? resources[Number(button.dataset.resource)] : articles[Number(button.dataset.article)];
    openDialog(`<span class="eyebrow">${escape(a.tag)}</span><h2 id="dialog-title">${escape(a.title)}</h2><p>${escape(a.description)}</p><p class="source-note">${escape(a.sourceNote)}</p>${contentMedia(a, 'poster')}${a.registrationUrl ? `<a class="button secondary" href="${escape(a.registrationUrl)}" target="_blank" rel="noopener noreferrer">主辦報名表${icon('external')}</a> ` : ''}${a.url ? `<a class="button primary" href="${escape(a.url)}" target="_blank" rel="noopener noreferrer">${a.tag === '研究論文' ? '查看期刊原文／DOI' : a.sourceNote ? '查看官方原文' : '前往網站'}${icon('external')}</a>` : '<p class="preview-note">此為原站活動存檔，日期與報名方式請參考海報。</p>'}${sourceHelp(a.url)}`);
  }));
  document.querySelector('[data-previous]')?.addEventListener('click', () => { if (draft().index > 0) { draft().index--; persist(); render('previous'); document.querySelector('legend').focus({ preventScroll: true }); } });
  document.querySelector('#question-form')?.addEventListener('change', event => {
    if (event.target.name !== 'answer') return;
    draft().answers[draft().index] = Number(event.target.value);
    persist();
    document.querySelector('#next-question').disabled = false;
    document.querySelector('#answer-count').textContent = answered();
    document.querySelector('progress').value = answered();
    document.querySelector('#selection-status').textContent = '已選好，你也可以隨時更改。';
    document.querySelectorAll('[data-companion-message]').forEach(el => { el.textContent = '選好囉，也可以再想一想。準備好再按下一題。'; });
  });
  document.querySelector('#question-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (draft().answers[draft().index] === null) return;
    if (draft().index < questions.length - 1) { draft().index++; persist(); render('next'); document.querySelector('legend').focus({ preventScroll: true }); }
    else {
      const missing = draft().answers.indexOf(null);
      if (missing !== -1) { draft().index = missing; persist(); render(); return; }
      try { finishSurvey(activeSurvey, draft().answers); } catch (error) { notify(error.message); return; }
      const survey = activeSurvey;
      const currentDraft = draft();
      currentDraft.key ||= crypto.randomUUID();
      currentDraft.pending = true;
      persist();
      document.querySelector('#question-form fieldset').disabled = true;
      document.querySelector('[data-previous]').disabled = true;
      const button = document.querySelector('#next-question');
      button.disabled = true;
      button.textContent = '正在儲存…';
      try {
        const record = await saveRecord(survey, currentDraft, member);
        state.records = [record, ...state.records.filter(r => r.id !== record.id)];
        delete state.drafts[survey.id];
        persist();
        location.hash = `result/${record.id}`;
      } catch (error) { notify(error.message); button.disabled = false; button.textContent = '重新儲存'; }
    }
  });
  document.querySelector('[data-pdf]')?.addEventListener('click', event => {
    const url = event.currentTarget.dataset.pdf;
    location.href = '/app/pdf.html?file=' + encodeURIComponent(url);

  });
}

window.addEventListener('hashchange', render);
try {
  await window.ColorLabConnection?.ready;
  catalog = await request('/api/explore/catalog');
  if (!Array.isArray(catalog)) throw new Error('題庫暫時無法讀取，請稍後重試。');
  FEATURED_SURVEY = (catalog.find(s => s.featured) || catalog[0])?.id;
  questions = catalog[0]?.questions || [];
  if (sessionStorage.getItem('userToken')) member = await request('/api/explore/me');
  storageKey = `colorlab-app-v1:${member?.id || 'guest'}`;
  state = readLocal(previewStorage, storageKey, catalog);
  if (member) {
    try { state.records = await request('/api/explore/records'); }
    catch (error) { historyError = error.message; }
  }
  try {
    const feed = await request('/api/homepage');
    const mapItem = a => ({ tag: ({ workshop:'工作坊', lecture:'講座', article:'心理健康文章', paper:'研究論文', resource:'資源指南' })[a.contentKind] || (a.type === 'news' ? '最新資訊' : '一般資訊'), title: a.title, description: a.description, sourceName: a.sourceName, media: { ...mediaFor(a), imageUrl: mediaFor(a).imageUrl ? safeUrl(mediaFor(a).imageUrl, '') : '' }, registrationUrl: a.registrationUrl ? safeUrl(a.registrationUrl, '') : '', url: safeUrl(a.link, ''), sourceNote: a.sourceName ? [a.sourceName, a.sourcePublishedAt && `發布 ${a.sourcePublishedAt}`, a.sourceCheckedAt && `查核 ${a.sourceCheckedAt}`].filter(Boolean).join(' · ') : '' });
    const currentFeed = feed.filter(a => isCurrentContent(a));
    articles = currentFeed.filter(a => a.type === 'news').map(mapItem);
    resources = currentFeed.filter(a => a.type === 'common').map(mapItem);
  } catch { articles = []; resources = []; }
  render();
  if ('serviceWorker' in navigator && window.COLORLAB_STATIC) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
} catch (error) {
  main.innerHTML = `<div class="empty-state"><h1>還差一小步</h1><p>${escape(error.message)}</p><button class="button primary" id="retry">重新載入</button><a class="button secondary" href="/app/account.html#login">重新登入</a></div>`;
  document.querySelector('#retry').addEventListener('click', () => location.reload());
}
