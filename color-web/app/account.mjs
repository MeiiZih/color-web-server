import { api, json, restoreSession, saveSession, clearSession, updateSessionUser } from './auth.mjs';
import { esc, icon, date, button, link, field, area, select, table } from './ui.mjs';
import { safeUrl } from './client.mjs';
import { verificationStatus, bindVerificationStatus } from './verification-status.mjs';

const main = document.querySelector('main');
const modal = document.querySelector('dialog');
const navigation = document.querySelector('#navigation');
const studio = document.querySelector('#studio-nav');
const menu = document.querySelector('#menu-toggle');
const adminRoutes = new Set(['admin', 'users', 'user', 'surveys', 'survey', 'content', 'content-edit', 'records', 'statistics', 'feedbacks', 'admin-profile']);
const sections = [['admin', '管理總覽', 'home'], ['users', '帳號管理', 'me'], ['surveys', '問卷管理', 'test'], ['content', '首頁資訊', 'news'], ['records', '測驗紀錄', 'history'], ['feedbacks', '使用者回饋', 'news'], ['admin-profile', '管理員資料', 'me']];
sections.splice(5,0,['statistics','測驗統計','test']);
let revision = 0, recordsRevision = 0, current = '', page = 1, dirty = false, pendingSave = false, timer;
let survey, contentItems = [], currentRecords = [], userItems = [];
let verificationToken = '';
function verificationPage(confirm = false) {
  return `<div class="form-width">${back('#login','回到登入')}${intro(confirm ? '確認這個 Email 屬於你' : '到信箱完成最後一步', confirm ? '請輸入你的 ColorLab 密碼，完成電子郵件驗證。' : '新會員驗證後即可登入。既有會員可自由選擇驗證，不影響原本的使用。')}<section class="panel form-stack"><div class="color-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${confirm ? `<form id="verify-form" class="form-stack">${password()}${status}${submit('確認並驗證 Email')}</form>` : `<p>驗證連結有效 24 小時。若沒有收到，請先查看垃圾郵件；重新寄送後請使用最新一封信。</p><form id="resend-form" class="form-stack">${field('email','註冊的電子郵件',sessionStorage.getItem('colorlab:pending-email')||'','type="email" autocomplete="username" required')}${password()}${status}${submit('重新寄送驗證信')}</form>`}<div class="actions">${link('#login','我已驗證，前往登入')}${confirm ? link('#verification','重新寄送驗證信') : ''}</div><p class="hint">若不是你申請的帳號，請勿驗證。</p></section></div>`;
}
function verificationProfile(user) {
  return `<section class="panel form-stack"><div data-verification-status>${verificationStatus(user)}</div><div data-verification-request ${user.emailVerifiedAt ? 'hidden' : ''}><form id="request-verification-form" class="form-stack">${status}${submit('寄送驗證信')}</form><p class="hint">寄送至帳號中的 Email；連結有效 24 小時。</p></div></section>`;
}
const adminAPI = (path, options = {}) => api(path, { ...options, role: 'admin' });
const status = '<p class="form-status" role="alert"></p>';
const back = (href, title) => `<a class="back-link" href="${esc(href)}">${icon('back')}<span>${esc(title)}</span></a>`;
const intro = (title, description = '') => `<div class="page-intro"><span class="eyebrow">COLORLAB / ${adminRoutes.has(current) ? 'STUDIO' : 'YOUR SPACE'}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`;
const submit = text => `<button class="button primary" type="submit"><span>${text}</span></button>`;
const password = (name = 'password', label = '密碼', required = 'required', autocomplete = 'current-password') => `<div class="field"><label for="${name}">${label}</label><span class="password-box"><input id="${name}" type="password" name="${name}" autocomplete="${autocomplete}" ${required}><button class="password-toggle" type="button" data-password aria-label="顯示${label}" aria-pressed="false">${icon('eye')}</button></span></div>`;
function notify(text) { const el = document.querySelector('#notice'); el.textContent = text; el.classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('visible'), 5000); }
function data(form) { return Object.fromEntries(new FormData(form)); }
function formError(form, error) { form.querySelector('.form-status').textContent = error.message || error; }
async function saveForm(form, task) {
  const submitter = form.querySelector('[type=submit]');
  if (pendingSave) return;
  pendingSave = true; submitter.disabled = true; form.setAttribute('aria-busy', 'true');
  const text = submitter.innerHTML; submitter.textContent = '正在儲存…'; formError(form, '');
  try { await task(); dirty = false; } catch (error) { formError(form, error); }
  finally { pendingSave = false; submitter.disabled = false; submitter.innerHTML = text; form.removeAttribute('aria-busy'); }
}
function showDialog(title, html) { document.querySelector('#dialog-content').innerHTML = `<h2 id="dialog-title">${esc(title)}</h2>${html}`; modal.showModal(); }
modal.querySelector('.dialog-close').onclick = () => { if (!pendingSave) modal.close(); };
modal.addEventListener('cancel', event => { if (pendingSave) event.preventDefault(); });
function confirmAction(title, description, task) {
  showDialog(title, `<p>${esc(description)}</p><form id="confirm-action">${status}<div class="actions">${button('取消', 'data-cancel') }<button type="submit" class="button danger">確認刪除</button></div></form>`);
  modal.querySelector('[data-cancel]').onclick = () => modal.close();
  modal.querySelector('form').onsubmit = event => { event.preventDefault(); saveForm(event.currentTarget, async () => { await task(); modal.close(); await render(); notify('已刪除。'); }); };
}
function frame(isAdmin) {
  document.body.dataset.studio = String(isAdmin);
  const links = [['home', '首頁', 'home'], ['surveys', '測驗', 'test'], ['history', '紀錄', 'history'], ['me', '我的', 'me']];
  navigation.innerHTML = links.map(([route, text, symbol]) => `<a href="/app/#${route}"${route === 'me' ? ' aria-current="page"' : ''}>${icon(symbol)}<span>${text}</span></a>`).join('');
  studio.hidden = !isAdmin;
  if (isAdmin) studio.innerHTML = `<p class="studio-caption">COLORLAB 管理工作室</p>${sections.map(([route, text, symbol]) => `<a href="#${route}"${(current === route || ({ user:'users', survey:'surveys', 'content-edit':'content' })[current] === route) ? ' aria-current="page"' : ''}>${icon(symbol)}${text}</a>`).join('')}<div class="studio-end"><a href="/app/#home">${icon('back')}回到使用者首頁</a><button type="button" data-signout>登出管理帳號</button></div>`;
  menu.setAttribute('aria-expanded', 'false'); studio.classList.remove('is-open');
}
menu.onclick = () => { const open = !studio.classList.contains('is-open'); studio.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open)); };
document.addEventListener('keydown', event => { if (event.key === 'Escape' && studio.classList.contains('is-open')) { studio.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); } });
document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) { event.preventDefault(); main.focus(); return; }
  if (!studio.contains(event.target) && !menu.contains(event.target)) { studio.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); }
  const anchor = event.target.closest('a[href]');
  if (anchor && (dirty || pendingSave) && !anchor.target) {
    if (pendingSave || !confirm('尚有未儲存的變更。確定離開這個頁面？')) event.preventDefault(); else dirty = false;
  }
  if (event.target.closest('[data-signout]')) { clearSession(); location.assign('/app/account.html#login'); }
});
window.addEventListener('beforeunload', event => { if (dirty || pendingSave) { event.preventDefault(); event.returnValue = ''; } });
function authPage(admin = false) {
  return `<div class="auth-layout"><section class="auth-story"><span class="eyebrow">A LITTLE CLOSER TO YOU</span><h1>每一面，<br>都值得被理解。</h1><p>留一點時間給自己。<br>從一場色彩探索，重新認識你的模樣。</p><div class="color-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div></section><section class="panel auth-panel">${back('/app/#home', '回到首頁')}<h2>${admin ? '管理員登入' : '歡迎回來'}</h2><p class="hint">${admin ? '使用管理員電子郵件進入管理工作室。' : '登入後，讓每一次探索都有跡可循。'}</p><form id="login-form" class="form-stack">${field('email', admin ? '管理員電子郵件' : '電子郵件', '', 'type="email" autocomplete="username" required')}${password()}${status}${admin ? '' : link('#verification','重新寄送驗證信')}${submit(admin ? '登入管理工作室' : '登入')}</form>${admin ? '<a class="auth-switch" href="#login">回到會員登入</a>' : `<div class="auth-links">${link('/app/#surveys', '先以訪客探索')}${link('#register', '建立帳號')}</div><a class="auth-switch" href="#admin-login">管理員登入</a>`}</section></div>`;
}
function registerPage() {
  return `<div class="form-width">${back('#login','回到登入')}${intro('建立你的探索空間','登入後的測驗紀錄會保存在帳號中，訪客紀錄不會自動合併。')}<form id="register-form" class="panel form-stack"><div class="form-grid">${field('name','姓名','','autocomplete="name" required')}${select('gender','性別',[['unknown','不願透露'],['男','男'],['女','女']])}${field('birthDate','出生日期','','type="date" required max="'+new Date().toISOString().slice(0,10)+'"')}${field('phone','電話（選填）','','type="tel" autocomplete="tel"')}</div>${field('email','電子郵件','','type="email" autocomplete="email" required')}${password('password','密碼','required minlength="6"','new-password')}${password('confirmPassword','確認密碼','required minlength="6"','new-password')}<p class="hint">密碼至少 6 個字元。新會員須完成 Email 驗證後才能登入。</p><label class="check-label"><input type="checkbox" name="consent" required><span>我已閱讀並同意 <a href="#privacy" target="_blank">隱私與資料說明</a>。</span></label>${link('#verification','已註冊但沒有收到驗證信？')}${status}${submit('建立帳號並寄送驗證信')}</form></div>`;
}
function occupationField(value = '') {
  const choices = ['學生','軍公教','資訊科技','醫療照護','服務業','金融商業','製造業','自由工作者','家管','退休','待業／求職中'];
  const saved = value === '未設定' ? '' : (value || '');
  const custom = Boolean(saved && !choices.includes(saved));
  return `<div class="form-stack" data-occupation>${select('occupation-choice','職業（選填）',[['','請選擇（可不填）'],...choices.map(v=>[v,v]),['__other','其他（自行填寫）']],custom ? '__other' : saved)}<div data-occupation-other ${custom ? '' : 'hidden'}>${field('occupation','其他職業',custom ? saved : '',custom ? 'required' : 'disabled')}</div></div>`;
}
function bindOccupation(form) {
  const group = form?.querySelector('[data-occupation]');
  if (!group) return;
  const choice = group.querySelector('select'), box = group.querySelector('[data-occupation-other]'), input = box.querySelector('input');
  const validate = () => input.setCustomValidity(!input.disabled && !input.value.trim() ? '請填寫其他職業，或選擇「請選擇（可不填）」。' : '');
  const sync = () => {
    const other = choice.value === '__other';
    box.hidden = !other; input.disabled = !other; input.required = other;
    choice.name = other ? '' : 'occupation'; // Submit exactly one occupation string to the existing API.
    validate();
  };
  choice.addEventListener('change', () => { sync(); if (!box.hidden) input.focus(); });
  input.addEventListener('input', validate);
  form.addEventListener('reset', () => queueMicrotask(sync));
  sync();
}
function profilePage(user, isAdmin = false) {
  return `<div class="form-width">${back(isAdmin ? '#admin' : '/app/#me', isAdmin ? '管理總覽' : '我的空間')}${intro(isAdmin ? '管理員資料' : '我的個人資料','確認內容後按下儲存，變更才會生效。')}<form id="profile-form" class="panel form-stack"><div class="form-grid">${field('name','姓名',user.name,'required autocomplete="name"')}${field('email','電子郵件',user.email,'readonly')}${isAdmin ? field('department','處室',user.department,'required') : select('gender','性別',[['unknown','不願透露'],['男','男'],['女','女']],user.gender)}${field('phone','電話（選填）',user.phone,'type="tel" autocomplete="tel"')}${isAdmin ? '' : field('birthDate','出生日期',user.birthDate?.slice(0,10),'type="date"') + occupationField(user.occupation)}</div>${isAdmin ? `<details><summary>修改管理員密碼</summary><div class="form-stack">${password('password','新密碼','minlength="6"','new-password')}${password('confirmPassword','確認新密碼','','new-password')}<p class="hint">不修改密碼時請留空。</p></div></details>` : ''}${status}<div class="actions form-actions">${submit('儲存資料')}${button('取消修改','data-reset')}</div></form>${isAdmin ? '' : verificationProfile(user)}</div>`;
}
function pagination(total, prefix = '') { return `<div class="pagination">${button('上一頁', `data-page="${page-1}" ${page <= 1 ? 'disabled' : ''}`, 'secondary','back')}<span>${prefix}第 ${page} / ${Math.max(1,total)} 頁</span>${button('下一頁', `data-page="${page+1}" ${page >= total ? 'disabled' : ''}`, 'secondary','arrow')}</div>`; }
function usersView(filter = '') {
  const filtered = userItems.filter(u => [u.name,u.email,u.phone].some(v => String(v || '').toLowerCase().includes(filter.toLowerCase())));
  page = Math.min(page,Math.max(1,Math.ceil(filtered.length / 10)));
  return `<p class="hint">${filtered.length} 個帳號</p>${table(['姓名','帳號','最近登入','操作'], filtered.slice((page-1)*10,page*10).map(u => [esc(u.name),esc(u.email),date(u.lastLogin),`<div class="actions">${link('#user/'+u._id,'查看','secondary','eye')}${button('刪除',`data-delete-user="${esc(u._id)}"`,'danger','trash')}</div>`]))}${pagination(Math.ceil(filtered.length/10))}`;
}
function surveyCards(items) { return `<div class="cards">${items.map(s => `<article class="management-card"><div class="card-symbol">${icon('test')}</div><h2>${esc(s.testType)}</h2><p>${s.totalQuestions} 題 · 更新於 ${date(s.updatedAt)}</p><p>${esc(s.description || '尚未填寫說明')}</p><div class="actions">${link('#survey/'+s._id,'編輯問卷','secondary','edit')}${link('/app/#test/'+s._id,'查看測驗','secondary','eye')}</div></article>`).join('')}</div>`; }
function questionFields() {
  return survey.questions.map((q,i) => `<section class="question-editor"><div class="question-heading"><h2>第 ${i+1} 題</h2><div class="actions">${button('上移',`data-move="${i}" ${i===0?'disabled':''}`)}${button('刪除題目',`data-remove-question="${i}"`,'danger')}</div></div>${area('question-'+i,'題目',q.question,'required')}${q.options.map((o,j) => `<div class="option-editor">${field(`option-${i}-${j}`,`選項 ${j+1}`,o,'required')}${button('移除',`data-remove-option="${i}:${j}" ${q.options.length<=2?'disabled':''}`,'secondary','close')}</div>`).join('')}<div class="editor-tools">${button('新增選項',`data-add-option="${i}"`,'secondary','plus')}</div></section>`).join('');
}
function surveyEditor() {
  return `${back('#surveys','問卷管理')}${intro(survey._id ? '編輯問卷' : '建立新問卷','可建立不同題數的單選問卷。原色彩測驗使用既有 20 題計分；其他問卷提供作答紀錄。')}<form id="survey-form"><section class="panel form-stack">${field('testType','問卷名稱',survey.testType,'required')}${area('description','問卷說明',survey.description)}${field('imgUrl','封面圖片網址（選填）',survey.imgUrl)}${mediaInput()}${status}</section><div id="question-editor">${questionFields()}</div><div class="actions editor-tools">${button('新增題目','data-add-question','secondary','plus')}<span class="hint" id="question-count">${survey.questions.length} 題</span></div><div class="actions form-actions">${submit(survey._id?'儲存問卷':'建立問卷')}${link('#surveys','取消')}${survey._id ? button('刪除問卷','data-delete-survey','danger','trash') : ''}</div><p class="hint">修改題目可能使未完成的草稿需要重新作答；已完成的紀錄保留原結果。</p></form>`;
}
function mediaInput() { return `<label class="field"><span>或上傳圖片（JPG、PNG、WebP，最多 10MB）</span><input type="file" accept="image/jpeg,image/png,image/webp" data-upload></label><p class="hint" data-upload-status role="status">圖片使用原網站的 Cloudinary 圖片空間。</p><img class="media-preview" data-media-preview alt="封面预覽" hidden>`; }
function contentCards(items) { return `<div class="cards">${items.map(item=>`<article class="management-card"><img src="${esc(safeUrl(item.imageUrl))}" alt="${esc(item.title)}"><span class="hint">${item.type==='news'?'最新資訊':'一般資訊'}</span><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p><div class="actions">${link('#content-edit/'+item._id,'編輯','secondary','edit')}${button('刪除',`data-delete-content="${esc(item._id)}"`,'danger','trash')}</div></article>`).join('')}</div>`; }
function contentEditor(item = {}) { return `${back('#content','首頁資訊')}${intro(item._id?'編輯資訊':'新增資訊')}<form id="content-form" class="panel form-stack">${select('type','顯示區域',[['news','最新資訊'],['common','一般資訊']],item.type||'news')}${field('title','標題',item.title,'required')}${area('description','內容說明',item.description,'required')}${field('link','外部連結（選填）',item.link)}${field('imageUrl','圖片網址',item.imageUrl,'required')}${mediaInput()}${status}<div class="actions form-actions">${submit('儲存資訊')}${link('#content','取消')}</div></form>`; }
function recordRows(records) { return table(['帳號','測驗','結果','完成時間','操作'],records.map(r=>[esc(r.email || '訪客'),esc(r.testType),esc(r.mbtiResult || '一般問卷'),date(r.timestamp),button('查看',`data-record="${esc(r.id||r._id)}"`,'secondary','eye')])); }
function details(user) { return `<dl class="definition-list">${[['姓名',user.name],['帳號',user.email],['性別',user.gender==='unknown'?'不願透露':user.gender],['生日',user.birthDate?.slice(0,10)],['電話',user.phone],['職業',user.occupation],['註冊時間',date(user.createdAt)]].map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b||'未填寫')}</dd>`).join('')}</dl>`; }
function information(route) {
  if (route === 'contact') return `<div class="form-width">${back('/app/#me','我的空間')}${intro('想告訴我們什麼？','無論是操作問題、建議或資料需求，都可以在這裡留下訊息。')}<form id="contact-form" class="panel form-stack">${area('description','你的訊息','','required maxlength="5000"')}${field('name','稱呼（選填）')}${field('email','電子郵件（選填，供後續聯絡）','','type="email"')}${status}${submit('送出回饋')}</form></div>`;
  if (route === 'about') return `<article class="prose">${back('/app/#home','回到首頁')}${intro('每一面，都是你。','關於 ColorLab')}<section class="panel"><h2>用色彩，開啟自我探索</h2><p>ColorLab 面向想認識自己、照顧心理健康的每一個人。我們從日常選擇出發，探索 MBTI 與色彩之間的連結，讓認識自己成為一件容易開始的事。</p></section><section><h2>為誰而設計？</h2><p>給想更認識自己的你，並彙整心理師公會、張老師、生命線、政府及研究期刊的可查證資訊。本測驗並非經臨床驗證的診斷工具，不能取代專業評估。</p></section><section><h2>我們的團隊</h2><p>余旻諺、蔡美姿、呂依潔、陳湘儒、張嘉哲</p></section><div class="actions">${link('/app/#surveys','開始探索','primary','arrow')}${link('#contact','聯絡我們')}</div></article>`;
  return `<article class="prose">${back('/app/#me','我的空間')}${intro('隱私與資料說明','了解 ColorLab 如何處理你的資料。')}<section><h2>一般帳號</h2><p>電子郵件與密碼用於登入；姓名、生日、性別、電話與職業用於個人資料及研究統計。電話與職業為選填。密碼以雜湊方式保存。</p></section><section><h2>電子郵件驗證</h2><p>新會員須驗證 Email；既有會員可選擇補上驗證。驗證信由 Brevo 代為寄送，會處理收件 Email 與驗證連結，不包含你的測驗答案或結果。連結有效 24 小時，可在驗證頁重新寄送。</p></section><section><h2>訪客與會員紀錄</h2><p>新版訪客測驗答案與結果只保存在目前瀏覽器，清除網站資料後可能遺失，不會自動併入會員帳號。登入會員後完成的測驗會儲存至帳號，並保留完成時的題目快照。</p></section><section><h2>瀏覽器與圖片服務</h2><p>網站在裝置保存登入狀態、公開頁面快取與測驗草稿。登出清除登入狀態，但不主動刪除測驗紀錄。管理員上傳的圖片會傳送至本網站原有的 Cloudinary 圖片空間。</p></section><section><h2>測驗與回饋資料</h2><p>測驗答案、結果與完成時間用於產生報告及研究統計。回饋的姓名與電子郵件為選填，供必要的後續聯絡。測驗僅供自我探索與教學研究，不構成心理或醫療診斷。</p></section><section><h2>查詢、更正與刪除</h2><p>你可以在會員資料頁更正個人資料。如需查詢或刪除資料，請透過意見回饋說明需求並留下聯絡方式。</p>${link('#contact','提出資料需求')}</section></article>`;
}

async function render() {
  const seq = ++revision;
  if (modal.open && !pendingSave) modal.close();
  const [route = 'login', rawId] = location.hash.slice(1).split('/');
  if (current !== route) page = 1;
  current = route || 'login'; const id = rawId ? decodeURIComponent(rawId) : '';
  if (current === 'verify' && id) { verificationToken = id; history.replaceState(null,'',location.pathname+'#verify'); }
  const role = restoreSession(), isAdmin = adminRoutes.has(current);
  if (isAdmin && role !== 'admin') { location.replace('#admin-login'); return; }
  if (current === 'profile' && role !== 'user') { location.replace('#login'); return; }
  frame(isAdmin); dirty = false;
  main.innerHTML = '<div class="quiet-empty" role="status">正在準備內容…</div>';
  let html, loaded;
  try {
    if (current === 'login' || current === 'admin-login') html = authPage(current === 'admin-login');
    else if (current === 'register') html = registerPage();
    else if (current === 'verification' || current === 'verify') html = verificationPage(current === 'verify');
    else if (['about','privacy','contact'].includes(current)) html = information(current);
    else if (current === 'profile' || current === 'admin-profile') { loaded = current==='profile' ? await api('/api/user/profile') : (await adminAPI('/api/admin/profile')).user; html = profilePage(loaded,isAdmin); }
    else if (current === 'admin') html = `${intro('照顧每一次探索。','問卷、內容與帳號，都在這裡有條理地管理。')}<div class="cards">${sections.slice(1).map(([r,t,i])=>`<article class="management-card"><div class="card-symbol">${icon(i)}</div><h2>${t}</h2><p>${({users:'搜尋與查看會員資料。',surveys:'建立新問卷、維護題目與選項。',content:'整理首頁的最新資訊與一般資訊。',records:'篩選、查看與匯出測驗紀錄。',statistics:'查看問卷、MBTI 與色彩的整體分布。',feedbacks:'閱讀使用者的建議與問題。','admin-profile':'更新個人資料與登入密碼。'})[r]}</p>${link('#'+r,'開啟'+t,'secondary','arrow')}</article>`).join('')}</div>`;
    else if (current === 'users') { userItems = await adminAPI('/api/admin/users'); html = `${intro('帳號管理','搜尋、查看會員與測驗紀錄。')}<div class="toolbar">${field('search','搜尋帳號或姓名','','type="search" placeholder="輸入姓名、Email 或電話"')}</div><div id="users-list">${usersView()}</div>`; }
    else if (current === 'user') { const [u,r] = await Promise.all([adminAPI('/api/admin/user/'+encodeURIComponent(id)),adminAPI('/api/admin/user/'+encodeURIComponent(id)+'/records')]); loaded=u.user; html=`${back('#users','帳號管理')}${intro(loaded.name||'會員資料',loaded.email)}<section class="panel">${details(loaded)}</section><section class="panel"><h2>測驗紀錄</h2>${recordRows(r.records)}</section>`; }
    else if (current === 'surveys') { loaded = await adminAPI('/api/test/surveys'); html=`${intro('問卷管理','保留主打測驗，也為下一次探索留出空間。')}<div class="toolbar">${link('#survey/new','建立問卷','primary','plus')}</div>${surveyCards(loaded)}`; }
    else if (current === 'survey') { survey = id && id!=='new' ? await adminAPI('/api/test/surveys/'+encodeURIComponent(id)) : {testType:'',description:'',imgUrl:'',questions:[{question:'',options:['','']}]}; html=surveyEditor(); }
    else if (current === 'content') { contentItems=await adminAPI('/api/homepage'); html=`${intro('首頁資訊','以清楚的圖片與內容，陪伴每一次探索。')}<div class="toolbar">${select('category','資訊類型',[['','全部資訊'],['news','最新資訊'],['common','一般資訊']])}${link('#content-edit/new','新增資訊','primary','plus')}</div><div id="content-list">${contentCards(contentItems)}</div>`; }
    else if (current === 'content-edit') { loaded = id && id!=='new' ? await adminAPI('/api/homepage/'+encodeURIComponent(id)) : {}; html=contentEditor(loaded); }
    else if (current === 'statistics') {
      const stats=await adminAPI('/api/admin/data-stats');
      const group=(title,rows,labels={})=>`<section class="panel"><h2>${title}</h2>${table(['分類','份數'],rows.map(r=>[esc(labels[r._id]||r._id||'未分類'),esc(r.count)]))}</section>`;
      html=`${intro('測驗統計','全站已保存的研究紀錄，不含僅存於裝置的訪客紀錄。')}<p>歷來參與識別數：${esc(stats.totalParticipants)}（依帳號／訪客識別去重，並非即時在線人數）</p>${group('MBTI 結果',stats.mbtiStats)}${group('主要色彩',stats.colorStats,{red:'紅色',yellow:'黃色',green:'綠色',blue:'藍色'})}${group('問卷分布',stats.testTypeStats)}<div class="actions editor-tools">${link('#records','篩選與查看原始紀錄','secondary','history')}</div>`;
    }
    else if (current === 'records') {
      const types = await adminAPI('/api/admin/test-types');
      html=`${intro('測驗紀錄','依問卷與結果篩選，查看完整作答。')}<form id="record-filter" class="toolbar">${select('testType','問卷',[['','全部問卷'],...(types.testTypes||types).map(t=>[t,t])])}${select('mbtiResult','MBTI',[['','全部結果'],...['ENFJ','ENFP','ENTJ','ENTP','ESFJ','ESFP','ESTJ','ESTP','INFJ','INFP','INTJ','INTP','ISFJ','ISFP','ISTJ','ISTP'].map(t=>[t,t])])}${submit('套用篩選')}${button('匯出本頁 CSV','data-export','secondary','download')}</form><div id="records-list"></div>`;
    } else if (current === 'feedbacks') { loaded = await adminAPI('/api/admin/feedbacks?page='+page+'&limit=10'); html=`${intro('使用者回饋','聽見問題，也找到讓 ColorLab 更好的方向。')}${table(['稱呼','Email','回饋內容','時間'],loaded.records.map(r=>[esc(r.name||'未留名'),esc(r.email||'未提供'),esc(r.description),date(r.timestamp)]))}${pagination(loaded.totalPages)}`; }
    else html=`${intro('找不到這個頁面')}${link('/app/#home','回到首頁','primary')}`;
    if (seq !== revision) return;
    main.innerHTML=html; document.title='ColorLab｜'+(main.querySelector('h1,h2')?.textContent||'我的空間');
    main.focus({preventScroll:true}); window.scrollTo(0,0); bind(loaded);
    if (current==='records') await loadRecords();
  } catch(error) {
    if(seq!==revision)return;
    main.innerHTML=`${intro('暫時無法開啟',error.message)}<div class="actions">${button('重新載入','data-retry','primary')}${link(isAdmin?'#admin-login':'#login','重新登入')}</div>`;
    main.querySelector('[data-retry]').onclick=render;
  }
}
async function loadRecords() {
  const query = new URLSearchParams(data(document.querySelector('#record-filter'))); query.set('page',page); query.set('limit','20');
  const list = document.querySelector('#records-list'); const seq=revision, request=++recordsRevision;
  currentRecords=[]; list.innerHTML='<p role="status">正在載入紀錄…</p>';
  try { const result=await adminAPI('/api/admin/test-records?'+query); if(seq!==revision||request!==recordsRevision)return; currentRecords=result.records; list.innerHTML=`<p class="hint">共 ${result.total} 份紀錄</p>${recordRows(result.records)}${pagination(result.totalPages)}`; }
  catch(error) { if(seq===revision&&request===recordsRevision){ currentRecords=[]; list.innerHTML=`<p role="alert">${esc(error.message)}</p>`; } }
}
function syncSurvey() {
  const form=document.querySelector('#survey-form'); const values=data(form);
  survey.testType=values.testType; survey.description=values.description; survey.imgUrl=values.imgUrl;
  survey.questions.forEach((q,i)=>{q.question=values['question-'+i];q.options=q.options.map((_,j)=>values[`option-${i}-${j}`]);});
}
function drawQuestions() { document.querySelector('#question-editor').innerHTML=questionFields(); document.querySelector('#question-count').textContent=survey.questions.length+' 題'; dirty=true; }
async function upload(input) {
  const file=input.files[0]; if(!file)return;
  const form=input.closest('form'), note=form.querySelector('[data-upload-status]'), target=form.elements.imgUrl||form.elements.imageUrl;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024) { note.textContent='請選擇 10MB 以下的 JPG、PNG 或 WebP 圖片。'; return; }
  const payload=new FormData(); payload.append('file',file); payload.append('upload_preset','color-web-homepage');payload.append('folder','homepage');
  input.disabled=true; form.querySelector('[type=submit]').disabled=true; note.textContent='正在上傳圖片…';
  try { const res=await fetch('https://api.cloudinary.com/v1_1/dgsj2css3/image/upload',{method:'POST',body:payload,signal:AbortSignal.timeout(60000)});const result=await res.json();if(!res.ok||!result.secure_url)throw new Error('圖片上傳失敗，請重試。');target.value=result.secure_url; const img=form.querySelector('[data-media-preview]');img.src=result.secure_url;img.hidden=false;dirty=true;note.textContent='圖片已上傳，請儲存表單以套用。'; }
  catch(error){note.textContent=error.message;}finally{input.disabled=false;form.querySelector('[type=submit]').disabled=false;}
}
function bind(loaded) {
  bindVerificationStatus(main.querySelector('[data-verification-status]'), () => api('/api/user/profile'), user => { main.querySelector('[data-verification-request]').hidden = Boolean(user.emailVerifiedAt); });
  const verify = main.querySelector('#verify-form');
  if (verify) verify.onsubmit = event => { event.preventDefault(); saveForm(verify, async () => {
    const result = await api('/api/user/email-verification/confirm',json('POST',{token:verificationToken,password:data(verify).password}));
    verificationToken=''; sessionStorage.removeItem('colorlab:pending-email');
    verify.innerHTML=`<p role="status">${esc(result.message)}</p>${link('#login','前往登入','primary')}`;
  }); };
  const resend = main.querySelector('#resend-form');
  if (resend) resend.onsubmit = event => { event.preventDefault(); saveForm(resend, async () => {
    const result = await api('/api/user/email-verification/resend',json('POST',data(resend)));
    resend.elements.password.value=''; formError(resend,result.alreadyVerified ? '這個 Email 已驗證，請回到登入頁。' : '驗證信已寄出。請查看信箱；如需重寄，請等候 60 秒。');
  }); };
  const requestVerification = main.querySelector('#request-verification-form');
  if (requestVerification) requestVerification.onsubmit = event => { event.preventDefault(); saveForm(requestVerification,async()=>{
    const result=await api('/api/user/email-verification/request',json('POST',{}));
    formError(requestVerification,result.alreadyVerified ? 'Email 已驗證，重新整理即可查看狀態。' : '驗證信已寄出，請查看信箱。60 秒後可以重新寄送。');
  }); };
  main.querySelectorAll('[data-password]').forEach(toggle=>toggle.onclick=()=>{const input=toggle.previousElementSibling;const show=input.type==='password';input.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',show?'隱藏密碼':'顯示密碼');});
  main.querySelectorAll('form:not(#login-form):not(#record-filter)').forEach(form=>form.addEventListener('input',()=>dirty=true));
  const login=main.querySelector('#login-form');
  if(login)login.onsubmit=event=>{event.preventDefault();saveForm(login,async()=>{
    const values=data(login); const isAdmin=current==='admin-login'; let result,role;
    try { result=await api('/api/admin/login',json('POST',values));role='admin'; }
    catch(error){if(isAdmin||error.status!==401)throw error;result=await api('/api/user/login',json('POST',values));role='user';}
    saveSession(result,role);location.assign(role==='admin'?'/app/account.html#admin':'/app/#me');
  });};
  const registration=main.querySelector('#register-form');
  if(registration)registration.onsubmit=event=>{event.preventDefault();saveForm(registration,async()=>{const values=data(registration);if(values.password!==values.confirmPassword)throw new Error('兩次密碼不同，請再確認。');const result=await api('/api/user/register',json('POST',values));if(result.verificationRequired){sessionStorage.setItem('colorlab:pending-email',result.email);dirty=false;location.hash='verification';notify(result.message);return;}throw new Error('請重新整理後再試，註冊服務正在更新。');});};
  const profile=main.querySelector('#profile-form');
  bindOccupation(profile);
  if(profile){profile.querySelector('[data-reset]').onclick=()=>{profile.reset();dirty=false;};profile.onsubmit=event=>{event.preventDefault();saveForm(profile,async()=>{const values=data(profile);if(values.password!==undefined&&values.password!==values.confirmPassword)throw new Error('兩次新密碼不同。');const admin=current==='admin-profile';const result=await api('/api/'+(admin?'admin':'user')+'/update-profile',json('PUT',values,admin?'admin':'user'));updateSessionUser(result.user,admin?'admin':'user');await render();notify('資料已儲存。');});};}
  const contact=main.querySelector('#contact-form');
  if(contact)contact.onsubmit=event=>{event.preventDefault();saveForm(contact,async()=>{await api('/api/user/feedback',json('POST',data(contact)));contact.reset();notify('謝謝你的回饋，我們已收到。');});};
  main.querySelector('[name=search]')?.addEventListener('input',event=>{page=1;document.querySelector('#users-list').innerHTML=usersView(event.target.value);});
  main.querySelector('[name=category]')?.addEventListener('change',event=>{document.querySelector('#content-list').innerHTML=contentCards(contentItems.filter(i=>!event.target.value||i.type===event.target.value));});
  const surveyForm=main.querySelector('#survey-form');
  if(surveyForm)surveyForm.onsubmit=event=>{event.preventDefault();saveForm(surveyForm,async()=>{syncSurvey();if(!survey.questions.length)throw new Error('請至少新增一道題目。');const payload={testType:survey.testType.trim(),description:survey.description,imgUrl:survey.imgUrl,totalQuestions:survey.questions.length,questions:survey.questions.map((q,i)=>({questionNumber:i+1,question:q.question.trim(),options:q.options.map(o=>o.trim())}))};const result=await adminAPI('/api/test/surveys'+(survey._id?'/'+survey._id:''),json(survey._id?'PUT':'POST',payload));dirty=false;survey=result.survey;location.hash='survey/'+survey._id;notify('問卷已儲存。');});};
  const contentForm=main.querySelector('#content-form');
  if(contentForm)contentForm.onsubmit=event=>{event.preventDefault();saveForm(contentForm,async()=>{const values=data(contentForm);for(const key of ['link','imageUrl'])if(values[key]&&!safeUrl(values[key],''))throw new Error('請填寫有效的圖片或網站網址。');await adminAPI('/api/homepage'+(loaded._id?'/'+loaded._id:''),json(loaded._id?'PUT':'POST',values));dirty=false;location.hash='content';notify('首頁資訊已儲存。');});};
  main.querySelector('[data-upload]')?.addEventListener('change',event=>upload(event.target));
  const filter=main.querySelector('#record-filter');if(filter)filter.onsubmit=event=>{event.preventDefault();page=1;loadRecords();};
}
main.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el||el.disabled)return;
  if(el.hasAttribute('data-page')){page=Number(el.dataset.page);if(current==='users')document.querySelector('#users-list').innerHTML=usersView(document.querySelector('[name=search]').value);else if(current==='records')await loadRecords();else await render();}
  if(el.hasAttribute('data-delete-user')){const u=userItems.find(u=>u._id===el.dataset.deleteUser);confirmAction('刪除會員帳號',`確定刪除 ${u.email}？帳號刪除後無法復原，既有研究紀錄不會在此操作中刪除。`,()=>adminAPI('/api/admin/users/'+u._id,{method:'DELETE'}));}
  if(el.hasAttribute('data-delete-content'))confirmAction('刪除首頁資訊','這筆資訊將從首頁移除，無法復原。',()=>adminAPI('/api/homepage/'+el.dataset.deleteContent,{method:'DELETE'}));
  if(el.hasAttribute('data-delete-survey'))confirmAction('刪除問卷','這份問卷將停止提供作答；已完成紀錄與原結果會保留。刪除的問卷無法復原。',async()=>{await adminAPI('/api/test/surveys/'+survey._id,{method:'DELETE'});dirty=false;location.hash='surveys';});
  if(['addQuestion','removeQuestion','move','addOption','removeOption'].some(k=>k in el.dataset)){
    syncSurvey();if('addQuestion'in el.dataset)survey.questions.push({question:'',options:['','']});
    if('removeQuestion'in el.dataset){if(!confirm('移除這道題目？儲存問卷後才會生效。'))return;survey.questions.splice(Number(el.dataset.removeQuestion),1);}
    if('move'in el.dataset){const i=Number(el.dataset.move);[survey.questions[i-1],survey.questions[i]]=[survey.questions[i],survey.questions[i-1]];}
    if('addOption'in el.dataset)survey.questions[Number(el.dataset.addOption)].options.push('');
    if('removeOption'in el.dataset){const [i,j]=el.dataset.removeOption.split(':').map(Number);survey.questions[i].options.splice(j,1);}
    drawQuestions();
  }
  if(el.hasAttribute('data-record')){
    try {const r=await adminAPI('/api/admin/records/'+encodeURIComponent(el.dataset.record));const snapshot=r.exploration?.survey;const answers=snapshot?snapshot.questions.map((q,i)=>({question:q.question,answer:q.options[r.exploration.answers?.[i]??r.answers?.[i]]})):r.answers||[];const primary=Array.isArray(r.colorResult?.primary)?r.colorResult.primary:[r.colorResult?.primary];const colors=primary.filter(c=>['red','yellow','green','blue'].includes(c)).sort();const report=/^[EI][NS][FT][JP]$/.test(r.mbtiResult||'')&&colors.length?`/test/detailed-reports/${r.mbtiResult}-${colors.join('-')}.pdf`:null;showDialog(r.testType||'測驗紀錄',`<p>${esc(r.email||'訪客')} · ${date(r.timestamp)}</p><h3>${esc(r.mbtiResult||'一般問卷')}</h3>${report?`<div class="actions">${link('/app/pdf.html?from=admin&file='+encodeURIComponent(report),'預覽 PDF','secondary','eye')}${`<a class="button primary" href="${esc(report)}" download>${icon('download')}<span>下載 PDF</span></a>`}</div>`:''}${answers.map((a,i)=>`<section class="record-answer"><h3>${i+1}. ${esc(a.question||'原始題目')}</h3><p>${esc(a.answer??'未記錄')}</p></section>`).join('')}`);}catch(error){notify(error.message);}
  }
  if(el.hasAttribute('data-export')){
    const rows=[['帳號','測驗','結果','完成時間'],...currentRecords.map(r=>[r.email,r.testType,r.mbtiResult,r.timestamp])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ColorLab-測驗紀錄-本頁.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
window.addEventListener('hashchange',render);
await render();
