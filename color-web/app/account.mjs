import { api, json, restoreSession, saveSession, clearSession, updateSessionUser } from './auth.mjs';
import { esc, icon, date, button, link, field, area, select, table } from './ui.mjs';
import { safeUrl } from './client.mjs';
import { verificationStatus, bindVerificationStatus } from './verification-status.mjs';
import {reviewPage,bindReview,adminContentMedia} from './content-review.mjs';
import { pdfHref, bindAppReturn, sessionIdentity, dataRevision } from './navigation-state.mjs';

const main = document.querySelector('main');
const modal = document.querySelector('dialog');
const navigation = document.querySelector('#navigation');
const studio = document.querySelector('#studio-nav');
const menu = document.querySelector('#menu-toggle');
const adminRoutes = new Set(['admin', 'users', 'user', 'surveys', 'survey', 'content', 'content-edit', 'records', 'statistics', 'feedbacks', 'admin-profile']);
const sections = [['admin', '管理總覽', 'home'], ['users', '帳號管理', 'me'], ['surveys', '問卷管理', 'test'], ['content', '首頁資訊', 'news'], ['records', '測驗紀錄', 'history'], ['feedbacks', '使用者回饋', 'news'], ['admin-profile', '管理員資料', 'me']];
adminRoutes.add('content-review');
sections.splice(4,0,['content-review','每週資訊待審','news']);
sections.splice(5,0,['statistics','測驗統計','test']);
let revision = 0, recordsRevision = 0, current = '', page = 1, dirty = false, pendingSave = false, timer;
let survey, contentItems = [], currentRecords = [], userItems = [];
let verificationToken = '';
let recoveryToken = null;
const retainedViews = new Map(), retainedRoutes = new Set(['admin','users','user','surveys','content','records','statistics','feedbacks','about','privacy','install']);
const retainedRecords = new Map();
let mountedKey = '', retainedIdentity = sessionIdentity(), retainedRevision = dataRevision();
function invalidateViews() { retainedViews.clear(); retainedRecords.clear(); mountedKey = ''; }
async function recordDetail(id) {
  if(sessionIdentity()!==retainedIdentity||dataRevision()!==retainedRevision)invalidateViews();
  const previous=retainedRecords.get(id);
  if(previous&&Date.now()-previous.at<5*60*1000)return previous.value;
  const value=await adminAPI('/api/admin/records/'+encodeURIComponent(id));
  retainedRecords.set(id,{value,at:Date.now()});
  if(retainedRecords.size>20)retainedRecords.delete(retainedRecords.keys().next().value);
  return value;
}
function saveView() {
  if (!mountedKey || !retainedRoutes.has(mountedKey.split('/')[0]) || dirty || pendingSave) return;
  const previous = retainedViews.get(mountedKey);
  retainedViews.set(mountedKey, { nodes:[...main.childNodes], title:document.title, top:scrollY, page, survey, contentItems, currentRecords, userItems, at:previous?.at || Date.now() });
  if (retainedViews.size > 8) retainedViews.delete(retainedViews.keys().next().value);
}
window.addEventListener('colorlab:data-changed', invalidateViews);
window.addEventListener('colorlab:session-changed', () => { invalidateViews(); main.replaceChildren(); render(); });
const leaveWarning = event => { event.preventDefault(); event.returnValue = ''; };
function updateLeaveWarning() { window.removeEventListener('beforeunload', leaveWarning); if (dirty || pendingSave) window.addEventListener('beforeunload', leaveWarning); }
document.addEventListener('input', () => queueMicrotask(updateLeaveWarning));
document.addEventListener('click', () => queueMicrotask(updateLeaveWarning));
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  if (sessionIdentity() !== retainedIdentity || dataRevision() !== retainedRevision) { invalidateViews(); main.replaceChildren(); render(); }
});
function verificationPage(confirm = false) {
  return `<div class="form-width">${back('#login','回到登入')}${intro(confirm ? '確認這個 Email 屬於你' : '到信箱完成最後一步', confirm ? '請輸入你的 ColorLab 密碼，完成電子郵件驗證。' : '新會員驗證後即可登入。既有會員可自由選擇驗證，不影響原本的使用。')}<section class="panel form-stack"><div class="color-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${confirm ? `<form id="verify-form" class="form-stack">${password()}${status}${submit('確認並驗證 Email')}</form>` : `<p>驗證連結有效 24 小時。若沒有收到，請先查看垃圾郵件；重新寄送後請使用最新一封信。</p><form id="resend-form" class="form-stack">${field('email','註冊的電子郵件',sessionStorage.getItem('colorlab:pending-email')||'','type="email" autocomplete="username" required')}${password()}${status}${submit('重發驗證信')}</form>`}<div class="actions">${link('#login','我已驗證，前往登入')}${confirm ? link('#verification','重發驗證信') : ''}</div><p class="hint">若不是你申請的帳號，請勿驗證。</p></section></div>`;
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
  finally { pendingSave = false; submitter.disabled = false; submitter.innerHTML = text; form.removeAttribute('aria-busy'); updateLeaveWarning(); }
}
let dialogPointer = false;
document.addEventListener('pointerdown', () => { dialogPointer = true; modal.setAttribute('data-pointer-focus',''); }, true);
document.addEventListener('keydown', () => { dialogPointer = false; modal.removeAttribute('data-pointer-focus'); }, true);
function showDialog(title, html) { document.querySelector('#dialog-content').innerHTML = `<h2 id="dialog-title">${esc(title)}</h2>${html}`; modal.classList.toggle('record-dialog',Boolean(modal.querySelector('.record-summary'))); modal.toggleAttribute('data-pointer-focus',dialogPointer); modal.showModal(); }
modal.querySelector('.dialog-close').onclick = () => { if (!pendingSave) modal.close(); };
modal.addEventListener('cancel', event => { if (pendingSave) event.preventDefault(); });
function confirmAction(title, description, task) {
  showDialog(title, `<p>${esc(description)}</p><form id="confirm-action">${status}<div class="actions">${button('取消', 'data-cancel') }<button type="submit" class="button danger">確認刪除</button></div></form>`);
  modal.querySelector('[data-cancel]').onclick = () => modal.close();
  modal.querySelector('form').onsubmit = event => { event.preventDefault(); saveForm(event.currentTarget, async () => { await task(); modal.close(); await render(); notify('已刪除。'); }); };
}
function frame(isAdmin) {
  document.body.dataset.studio = String(isAdmin);
  document.querySelector('[data-header-signout]')?.remove();
  if(isAdmin)menu.insertAdjacentHTML('afterend','<button type="button" class="button secondary header-signout" data-header-signout data-signout aria-label="登出管理帳號">登出</button>');
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
  if (event.target.closest('[data-signout]')) {
    if(pendingSave||(dirty&&!confirm('尚有未儲存的變更。確定登出？')))return;
    dirty=false;clearSession();location.assign('/app/account.html#login');
  }
});
function authPage(admin = false) {
  return `<div class="auth-layout"><section class="auth-story"><span class="eyebrow">A LITTLE CLOSER TO YOU</span><h1>每一面，<br>都值得被理解。</h1><p>留一點時間給自己。<br>從一場色彩探索，重新認識你的模樣。</p><div class="color-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div></section><section class="panel auth-panel">
    ${back('/app/#me', '回到我的帳號')}
    <nav class="auth-role-nav" aria-label="選擇登入身分"><a href="#login" ${admin?'':'aria-current="page"'}>會員登入</a><a href="#admin-login" ${admin?'aria-current="page"':''}>管理員登入</a></nav>
    <h2>${admin ? '登入管理員帳號' : '歡迎回來'}</h2><p class="hint">${admin ? '登入後可從「我的」進入管理後台或查看個人紀錄。' : '登入帳號，接續你的探索紀錄。'}</p>
    <form id="login-form" class="form-stack">${field('email', admin ? '管理員電子郵件' : '會員電子郵件', '', 'type="email" autocomplete="username" required')}${password()}<p class="auth-help auth-password-help"><a href="#${admin?'admin-forgot-password':'forgot-password'}">忘記密碼？</a></p>${status}${submit(admin ? '登入管理員帳號' : '登入會員帳號')}</form><div data-login-guidance></div>
    ${admin ? '' : '<p class="auth-register">還沒有帳號？ <a href="#register">建立帳號</a></p><div class="auth-guest"><span>想先看看？</span><a href="/app/#surveys">先以訪客探索 '+icon('arrow')+'</a></div>'}
  </section></div>`;
}
function recoveryPage(admin=false,reset=false){
  const role=admin?'admin':'user',login=admin?'admin-login':'login',forgot=admin?'admin-forgot-password':'forgot-password';
  const usable=recoveryToken?.role===role&&/^[a-f0-9]{64}$/.test(recoveryToken.token);
  return `<div class="form-width recovery-page">${back('#'+login,admin?'回到管理員登入':'回到會員登入')}${intro(reset?'設定新密碼':admin?'找回管理員密碼':'找回會員密碼',reset?'設定完成後，請用新密碼重新登入。':'我們會透過帳號信箱協助你重新設定密碼。')}<section class="panel form-stack">${reset?(usable?`<form id="reset-password-form" data-recovery-role="${role}" class="form-stack">${password('password','新密碼','required minlength="6" maxlength="128"','new-password')}${password('confirmPassword','確認新密碼','required minlength="6" maxlength="128"','new-password')}<p class="hint">請設定至少 6 個字元的密碼。最多 72 個英數字元；中文或表情符號可用字數較少。完成後，其他裝置也需重新登入。</p>${status}${submit('更新密碼')}</form><p class="auth-help"><a href="#${forgot}">連結過期或不能使用？重新申請</a></p>`:`<p role="alert">這個重設連結無法使用。請從信件重新開啟完整連結，或重新申請。</p>${link('#'+forgot,'重新申請重設連結','primary')}`):`<form id="forgot-password-form" data-recovery-role="${role}" class="form-stack">${field('email',admin?'管理員電子郵件':'會員電子郵件','','type="email" autocomplete="email" required maxlength="254"')}${status}${submit('寄送重設連結')}</form><div class="recovery-help"><h2>收不到信，或沒有可用的信箱？</h2><p>請先查看垃圾郵件。未綁定信箱、無法開啟信箱，或會員尚未完成 Email 驗證時，請聯絡管理員協助確認身分；我們不會在此顯示帳號是否存在。</p><a href="#contact">聯絡管理員</a></div>`}</section></div>`;
}
function registerPage() {
  return `<div class="form-width">${back('#login','回到登入')}${intro('建立你的探索空間','電話選填，其餘欄位皆須填寫。登入後的測驗紀錄會保存在帳號中，訪客紀錄不會自動合併。')}<form id="register-form" class="panel form-stack"><div class="form-grid">${field('name','姓名','','autocomplete="name" required')}${select('gender','性別',[['','請選擇'],['unknown','不願透露'],['男','男'],['女','女']]).replace('<select ','<select required ')}${field('birthDate','出生日期','','type="date" required max="'+new Date(Date.now()+8*3600000).toISOString().slice(0,10)+'"')}${field('phone','電話（選填）','','type="tel" autocomplete="tel"')}</div>${field('email','電子郵件','','type="email" autocomplete="email" required')}${password('password','密碼','required minlength="6"','new-password')}${password('confirmPassword','確認密碼','required minlength="6"','new-password')}<p class="hint">密碼至少 6 個字元。下一步將寄送驗證信，新會員須完成 Email 驗證後才能登入。</p><label class="check-label"><input type="checkbox" name="consent" required><span>我已閱讀並同意 <a href="#privacy" target="_blank">隱私與資料說明</a>。</span></label>${status}${submit('建立帳號並寄送驗證信')}</form></div>`;
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
function contentCards(items) { return `<div class="cards">${items.map(item=>`<article class="management-card">${adminContentMedia(item)}<span class="hint">${item.type==='news'?'最新資訊':'一般資訊'}</span><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p><div class="actions">${link('#content-edit/'+item._id,'編輯','secondary','edit')}${button('刪除',`data-delete-content="${esc(item._id)}"`,'danger','trash')}</div></article>`).join('')}</div>`; }
function contentEditor(item = {}) { return `${back('#content','首頁資訊')}${intro(item._id?'編輯資訊':'新增資訊')}<form id="content-form" class="panel form-stack">${select('type','顯示區域',[['news','最新資訊'],['common','一般資訊']],item.type||'news')}${field('title','標題',item.title,'required')}${area('description','內容說明',item.description,'required')}${field('link','外部連結（選填）',item.link)}${contentMetadata(item)}${field('imageUrl','圖片網址',item.imageUrl,'required')}<section class="content-editor-preview" aria-labelledby="content-preview-heading"><h2 id="content-preview-heading">圖片預覽</h2><div data-content-preview>${adminContentMedia(item)}</div><p class="hint">預覽與首頁相同。修改只在此頁顯示，按「儲存資訊」才會套用；圖片能顯示不代表已通過發布檢查。</p></section><p class="hint">發布前需先生成並部署專屬插圖。請填入已登錄的 /assets/images/posts/ 圖片路徑；每週自動清單會先備妥圖片供審核，未完成插圖將無法儲存發布。</p>${status}<div class="actions form-actions">${submit('儲存資訊')}${link('#content','取消')}</div></form>`; }
function contentMetadata(item) { return `<div class="form-grid">${field('sourceName','來源單位',item.sourceName)}${select('contentKind','內容種類',[['resource','服務資源'],['article','文章'],['workshop','工作坊'],['lecture','講座'],['paper','研究論文']],item.contentKind||'resource')}${field('sourcePublishedAt','來源發布日期',item.sourcePublishedAt,'type="date"')}${field('sourceCheckedAt','查核日期',item.sourceCheckedAt,'type="date"')}${field('expiresAt','截止／下架日期（當日結束）',item.expiresAt?.slice(0,10),'type="date"')}${field('registrationUrl','主辦報名連結',item.registrationUrl,'type="url"')}</div>`; }
function recordRows(records) { return table(['帳號','測驗','結果','完成時間','操作'],records.map(r=>[esc(r.email || '訪客'),esc(r.testType),esc(r.mbtiResult || '一般問卷'),date(r.timestamp),button('查看',`data-record="${esc(r.id||r._id)}"`,'secondary','eye')])); }
function details(user) { return `<dl class="definition-list">${[['姓名',user.name],['帳號',user.email],['性別',user.gender==='unknown'?'不願透露':user.gender],['生日',user.birthDate?.slice(0,10)],['電話',user.phone],['職業',user.occupation],['註冊時間',date(user.createdAt)]].map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b||'未填寫')}</dd>`).join('')}</dl>`; }
function information(route) {
  if(route==='install') {
    const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
    const sketch=(device,steps)=>`<figure class="install-sketch"><figcaption>${device} 操作示意・非實際截圖</figcaption><div class="install-frames">${steps.map(([title,screen,caption],i)=>`<div class="install-frame"><div class="install-window ${device==='電腦'?'is-desktop':''}" aria-hidden="true"><div class="install-address"><span>ColorLab</span><span>···</span></div>${screen}</div><p class="install-caption"><b>${i+1}</b><span><strong>${title}</strong>${caption}</span></p></div>`).join('')}</div><p class="hint">圖中標示僅用來辨認操作位置；請在你自己的瀏覽器操作，實際選單會依版本不同。</p></figure>`;
    const appTile='<div class="install-app-tile"><img src="/colorlab-mark.svg" alt=""><span>ColorLab</span></div>';
    const iosSketch=sketch('iPhone／iPad',[
      ['找到分享選單',`<div class="install-page">${appTile}</div><div class="install-browser-bar"><span>‹</span><span class="install-highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 9H5v12h14V9h-3M12 15V2m-4 4 4-4 4 4"/></svg> 分享</span><span>↻</span></div>`,'Safari 可直接點分享；精簡版工具列先點「更多」，再點分享。'],
      ['選擇加入主畫面','<div class="install-sheet"><span class="install-sheet-handle"></span><span>分享選單</span><span class="install-menu-row">拷貝</span><span class="install-menu-row install-highlight">＋ 加入主畫面</span></div>','在分享選單往下找這個項目。'],
      ['開啟網頁 App 並加入',`<div class="install-sheet"><span class="install-sheet-title">加入主畫面 <b>加入</b></span>${appTile}<span class="install-menu-row">以網頁 App 開啟 <i class="install-toggle"></i></span></div>`,'若有此開關請開啟；加入後點主畫面圖示。']
    ]);
    const androidSketch=sketch('Android',[
      ['開啟 Chrome 選單',`<div class="install-page">${appTile}<span class="install-menu-cue">右上角 <b>⋮</b></span></div>`,'在網址列旁點「更多」。'],
      ['找到安裝選項','<div class="install-sheet"><span class="install-menu-row">分享…</span><span class="install-menu-row install-highlight">安裝並建立捷徑 ›</span><span class="install-menu-row">安裝</span></div>','選單名稱可能不同，繼續選「安裝」。'],
      ['確認安裝',`<div class="install-sheet">${appTile}<span class="install-dialog-title">要安裝 ColorLab 嗎？</span><span class="install-confirm">安裝</span></div>`,'確認後，從 ColorLab 圖示開啟。']
    ]);
    const desktopSketch=sketch('電腦',[
      ['開啟更多選單',`<div class="install-page">${appTile}<span class="install-menu-cue">右上角 <b>⋮</b></span></div>`,'使用 Chrome，點右上角「更多」。'],
      ['選擇安裝頁面','<div class="install-sheet"><span class="install-menu-row">投放、儲存及分享 ›</span><span class="install-menu-row install-highlight">將頁面安裝為應用程式</span></div>','也可使用網址列出現的安裝圖示。'],
      ['開啟獨立視窗',`<div class="install-page install-app-open">${appTile}<span>你的 ColorLab 空間</span></div>`,'確認安裝後，從應用程式圖示開啟。']
    ]);
    return `<article class="prose first-use-guide">${back('/app/#home','回到首頁')}${intro('初次使用 ColorLab','先了解怎麼開始、紀錄存在哪裡，再決定要不要放到主畫面。')}
      <section class="guide-step" aria-labelledby="guide-start"><span class="guide-number" aria-hidden="true">01</span><div><h2 id="guide-start">開始，或接著上次的進度</h2><p>首頁可以快速開始主打色彩測驗；想試其他問卷，就點「測驗」查看全部。每題選好答案後按「下一題」，也可以按「上一題」修改。</p><p>還沒做完時，點「暫存並離開」。之後在<strong>同一個裝置、瀏覽器與登入身分</strong>開啟，可接著作答。未完成的進度不會跨裝置同步；題目更新時也可能需要重新開始。</p><div class="actions">${link('/app/#surveys','查看全部測驗','secondary','test')}</div></div></section>
      <section class="guide-step" aria-labelledby="guide-save"><span class="guide-number" aria-hidden="true">02</span><div><h2 id="guide-save">先決定紀錄要存在哪裡</h2><p>想換手機或電腦仍看得到<strong>已完成</strong>的紀錄，請先登入，再開始作答。</p><dl class="guide-saving"><div><dt>會員登入</dt><dd>完成並儲存成功後，紀錄會存到會員帳號。新註冊會員需先完成 Email 驗證。</dd></div><div><dt>管理員登入</dt><dd>也可以親自作答，完成後的紀錄儲存在管理員自己的帳號，與會員資料分開。已完成移轉的歷史紀錄會保留，不需要重複同步。</dd></div><div><dt>訪客使用</dt><dd>不用登入也能作答，但紀錄只留在目前瀏覽器。清除網站資料、換裝置或換瀏覽器，可能就看不到了。</dd></div></dl><p class="guide-caution">訪客紀錄不會在登入後自動搬到帳號。未完成的草稿也只存在目前裝置，請不要把「進度自動儲存」當成雲端備份。</p><div class="actions">${link('#login','登入或建立帳號','secondary','me')}</div></div></section>
      <section class="guide-step" aria-labelledby="guide-history"><span class="guide-number" aria-hidden="true">03</span><div><h2 id="guide-history">查看你的測驗紀錄</h2><p>點導覽列的「紀錄」，或從「我的」進入「我的測驗紀錄」。點日期卡片即可看當次結果與作答；有完整報告的測驗，也能預覽或下載 PDF。</p><p>紀錄按年月由新到舊排列，可篩選時間、選擇每頁筆數或全部顯示。較早紀錄會分批讀取，不限最近 200 份。想刪除某一筆，可點該筆的「刪除紀錄」並再次確認；刪除後無法從此頁復原。</p><div class="actions">${link('/app/#history','查看我的紀錄','secondary','history')}</div></div></section>
      <section class="guide-step" aria-labelledby="guide-install"><span class="guide-number" aria-hidden="true">04</span><div><h2 id="guide-install">推薦加入主畫面，完整體驗 ColorLab</h2><p>想讓 ColorLab 更像隨手可開的小空間，建議加入主畫面：從圖示進入獨立 App 模式，不必每次尋找網址，畫面也少了瀏覽器工具列。這是選用功能，<strong>不安裝也能使用 ColorLab</strong>。登入、載入題庫與儲存帳號紀錄仍需要網路。</p><div class="guide-mode" role="status"><strong>${standalone?'目前以獨立 App 模式開啟':'目前以瀏覽器模式開啟'}</strong><p>${standalone?'已偵測到獨立模式。時間、電量與底部操作指示仍由手機系統顯示，不是網站邊框。':'目前可能看得到網址列與瀏覽器工具列，網站不能自行隱藏。請依裝置安裝後，從主畫面的圖示重新開啟，再回來確認。'}</p></div>
        <div class="guide-devices">
          <details><summary>iPhone／iPad：從 Safari 加入</summary>${iosSketch}<ol><li>先用 Safari 開啟 ColorLab；若現在在其他 App 裡，請先選擇在 Safari 開啟。</li><li>在 Safari 點「分享」；若使用精簡版工具列，先點「更多」再點「分享」。往下找「加入主畫面」，找不到時可在「編輯動作」加入。</li><li>若出現「以網頁 App 開啟／Open as Web App」，保持開啟，再按「加入」。</li><li>回到主畫面，點 ColorLab 圖示開啟，再到本頁確認是否顯示「獨立 App 模式」。</li></ol><a href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios" target="_blank" rel="noopener noreferrer">Apple 官方安裝說明 ↗</a></details>
          <details><summary>Android：從 Chrome 安裝</summary>${androidSketch}<ol><li>用 Chrome 開啟 ColorLab 網站。</li><li>點網址列右側「更多」選單，找「安裝並建立捷徑」或「加入主畫面」。</li><li>依畫面選「安裝」並確認，完成後從 ColorLab 圖示開啟。</li></ol><p class="hint">選單名稱會隨 Chrome 版本不同；只建立捷徑不一定會以獨立視窗開啟。</p><a href="https://support.google.com/chrome/answer/9658361?hl=zh-Hant&amp;co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener noreferrer">Google 官方 Android 安裝說明 ↗</a></details>
          <details><summary>電腦：從 Chrome 安裝</summary>${desktopSketch}<ol><li>在 Windows 或 Mac 的 Chrome 開啟 ColorLab。</li><li>打開右上角「更多」，選「投放、儲存及分享」→「將頁面安裝為應用程式」；也可以使用網址列出現的安裝圖示。</li><li>依畫面確認安裝，再從應用程式圖示開啟 ColorLab。</li></ol><a href="https://support.google.com/chrome/answer/9658361?hl=zh-Hant&amp;co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">Google 官方電腦安裝說明 ↗</a></details>
        </div><p class="guide-caution">已有舊捷徑時，先確認現在的圖示能正常開啟，再自行移除舊捷徑。不要為了重新安裝而清除網站資料，以免遺失訪客紀錄或草稿；不同入口可能需要重新登入。</p>
      </div></section><aside class="guide-gentle-note" aria-labelledby="guide-note-title"><span class="eyebrow">A SMALL REMINDER</span><h2 id="guide-note-title">探索自己，不急著替自己下定義。</h2><p>把測驗結果當成認識自己的起點，留意哪些描述貼近此刻的你，也保留改變的空間。</p><p class="guide-note-scope">ColorLab 提供自我探索與心理健康資訊，<strong>不是心理或醫療診斷</strong>，也不能取代專業評估。</p></aside></article>`;
  }
  if (route === 'contact') return `<div class="form-width">${back('/app/#me','我的空間')}${intro('想告訴我們什麼？','無論是操作問題、建議或資料需求，都可以在這裡留下訊息。')}<form id="contact-form" class="panel form-stack">${area('description','你的訊息','','required maxlength="5000"')}${field('name','稱呼（選填）')}${field('email','電子郵件（選填，供後續聯絡）','','type="email"')}${status}${submit('送出回饋')}</form></div>`;
  if (route === 'about') return `<article class="prose">${back('/app/#home','回到首頁')}${intro('每一面，都是你。','關於 ColorLab')}<section class="panel"><h2>用色彩，開啟自我探索</h2><p>ColorLab 面向想認識自己、照顧心理健康的每一個人。我們從日常選擇出發，探索 MBTI 與色彩之間的連結，讓認識自己成為一件容易開始的事。</p></section><section><h2>為誰而設計？</h2><p>給想更認識自己的你，並彙整心理師公會、張老師、生命線、政府及研究期刊的可查證資訊。本測驗並非經臨床驗證的診斷工具，不能取代專業評估。</p></section><section><h2>我們的團隊</h2><p>余旻諺、蔡美姿、呂依潔、陳湘儒、張嘉哲</p></section><div class="actions">${link('/app/#surveys','開始探索','primary','arrow')}${link('#contact','聯絡我們')}</div></article>`;
  return `<article class="prose">${back('/app/#me','我的空間')}${intro('隱私與資料說明','了解 ColorLab 如何處理你的資料。')}<section><h2>一般帳號</h2><p>電子郵件與密碼用於登入；姓名、生日、性別、電話與職業用於個人資料及研究統計。電話與職業為選填。密碼以雜湊方式保存。</p></section><section><h2>電子郵件驗證</h2><p>新會員須驗證 Email；既有會員可選擇補上驗證。驗證信由 Brevo 代為寄送，會處理收件 Email 與驗證連結，不包含你的測驗答案或結果。連結有效 24 小時，可在驗證頁重新寄送。</p></section><section><h2>訪客與會員紀錄</h2><p>新版訪客測驗答案與結果只保存在目前瀏覽器，清除網站資料後可能遺失，不會自動併入會員帳號。登入會員後完成的測驗會儲存至帳號，並保留完成時的題目快照。</p></section><section><h2>瀏覽器與圖片服務</h2><p>網站在裝置保存登入狀態、公開頁面快取與測驗草稿。登出清除登入狀態，但不主動刪除測驗紀錄。管理員上傳的圖片會傳送至本網站原有的 Cloudinary 圖片空間。</p></section><section><h2>測驗與回饋資料</h2><p>測驗答案、結果與完成時間用於產生報告及研究統計。回饋的姓名與電子郵件為選填，供必要的後續聯絡。測驗僅供自我探索與教學研究，不構成心理或醫療診斷。</p></section><section><h2>查詢、更正與刪除</h2><p>你可以在會員資料頁更正個人資料。如需查詢或刪除資料，請透過意見回饋說明需求並留下聯絡方式。</p>${link('#contact','提出資料需求')}</section></article>`;
}

async function render() {
  const seq = ++revision;
  const identity = sessionIdentity(), version = dataRevision();
  if (identity !== retainedIdentity || version !== retainedRevision) invalidateViews();
  else saveView();
  retainedIdentity = identity; retainedRevision = version;
  if (modal.open && !pendingSave) modal.close();
  const [route = 'login', rawId] = location.hash.slice(1).split('/');
  const routeKey = location.hash.slice(1) || 'login';
  // Explicit renders (save, retry, pagination) refresh; route returns restore the existing DOM.
  const retained = mountedKey !== routeKey ? retainedViews.get(routeKey) : null;
  if (mountedKey === routeKey) retainedViews.delete(routeKey);
  if (current !== route) page = 1;
  current = route || 'login'; const id = rawId ? decodeURIComponent(rawId) : '';
  if (current === 'verify' && id) { verificationToken = id; history.replaceState(null,'',location.pathname+'#verify'); }
  if(['reset-password','admin-reset-password'].includes(current)){
    if(id){recoveryToken={role:current==='admin-reset-password'?'admin':'user',token:id};history.replaceState(null,'',location.pathname+'#'+current);}
  }else recoveryToken=null;
  const role = restoreSession(), isAdmin = adminRoutes.has(current);
  if (isAdmin && role !== 'admin') { location.replace('#admin-login'); return; }
  if (current === 'profile' && role !== 'user') { location.replace('#login'); return; }
  frame(isAdmin); dirty = false;
  updateLeaveWarning();
  if (retained && Date.now() - retained.at < 5 * 60 * 1000) {
    main.replaceChildren(...retained.nodes); document.title=retained.title;
    ({page,survey,contentItems,currentRecords,userItems}=retained); mountedKey=routeKey;
    main.inert=false; main.removeAttribute('aria-busy');
    const notice=document.querySelector('#route-status');if(notice)notice.hidden=true;
    window.scrollTo({top:retained.top,behavior:'instant'}); return;
  }
  // Leave the previous page painted, but disable its actions until the destination is ready.
  main.setAttribute('aria-busy', 'true'); main.inert = true;
  let loading = document.querySelector('#route-status');
  if (!loading) { loading = document.createElement('div'); loading.id = 'route-status'; loading.setAttribute('role','status'); main.before(loading); }
  loading.textContent = '正在準備下一頁…'; loading.hidden = false;
  let html, loaded;
  try {
    if (current === 'login' || current === 'admin-login') html = authPage(current === 'admin-login');
    else if(['forgot-password','admin-forgot-password','reset-password','admin-reset-password'].includes(current))html=recoveryPage(current.startsWith('admin-'),current.includes('reset-password'));
    else if (current === 'register') html = registerPage();
    else if (current === 'verification' || current === 'verify') html = verificationPage(current === 'verify');
    else if (['about','privacy','contact','install'].includes(current)) html = information(current);
    else if (current === 'profile' || current === 'admin-profile') { loaded = current==='profile' ? await api('/api/user/profile') : (await adminAPI('/api/admin/profile')).user; html = profilePage(loaded,isAdmin); }
    else if (current === 'admin') html = `${intro('照顧每一次探索。','問卷、內容與帳號，都在這裡有條理地管理。')}<div class="cards">${sections.slice(1).map(([r,t,i])=>`<article class="management-card"><div class="card-symbol">${icon(i)}</div><h2>${t}</h2><p>${({users:'搜尋與查看會員資料。',surveys:'建立新問卷、維護題目與選項。','content-review':'查核每週建議、勾選核准或略過。',content:'整理首頁的最新資訊與一般資訊。',records:'篩選、查看與匯出測驗紀錄。',statistics:'查看問卷、MBTI 與色彩的整體分布。',feedbacks:'閱讀使用者的建議與問題。','admin-profile':'更新個人資料與登入密碼。'})[r]}</p>${link('#'+r,'開啟'+t,'secondary','arrow')}</article>`).join('')}</div>`;
    else if (current === 'users') { loaded = await adminAPI('/api/admin/users'); if(seq!==revision)return; userItems=loaded; html = `${intro('帳號管理','搜尋、查看會員與測驗紀錄。')}<div class="toolbar">${field('search','搜尋帳號或姓名','','type="search" placeholder="輸入姓名、Email 或電話"')}</div><div id="users-list">${usersView()}</div>`; }
    else if (current === 'user') { const [u,r] = await Promise.all([adminAPI('/api/admin/user/'+encodeURIComponent(id)),adminAPI('/api/admin/user/'+encodeURIComponent(id)+'/records')]); loaded=u.user; html=`${back('#users','帳號管理')}${intro(loaded.name||'會員資料',loaded.email)}<section class="panel">${details(loaded)}</section><section class="panel"><h2>測驗紀錄</h2>${recordRows(r.records)}</section>`; }
    else if (current === 'surveys') { loaded = await adminAPI('/api/test/surveys'); html=`${intro('問卷管理','保留主打測驗，也為下一次探索留出空間。')}<div class="toolbar">${link('#survey/new','建立問卷','primary','plus')}</div>${surveyCards(loaded)}`; }
    else if (current === 'survey') { loaded = id && id!=='new' ? await adminAPI('/api/test/surveys/'+encodeURIComponent(id)) : {testType:'',description:'',imgUrl:'',questions:[{question:'',options:['','']}]}; if(seq!==revision)return; survey=loaded; html=surveyEditor(); }
    else if (current === 'content') { loaded=await adminAPI('/api/admin/content-review/current'); if(seq!==revision)return; contentItems=loaded; html=`${intro('首頁資訊','以清楚的圖片與內容，陪伴每一次探索。')}<div class="toolbar">${select('category','資訊類型',[['','全部資訊'],['news','最新資訊'],['common','一般資訊']])}${link('#content-edit/new','新增資訊','primary','plus')}</div><div id="content-list">${contentCards(contentItems)}</div>`; }
    else if (current === 'content-edit') { loaded = id && id!=='new' ? await adminAPI('/api/admin/content-review/current/'+encodeURIComponent(id)) : {}; html=contentEditor(loaded); }
    else if (current === 'content-review') html=await reviewPage();
    else if (current === 'statistics') {
      const stats=await adminAPI('/api/admin/data-stats');
      const group=(title,rows,labels={})=>`<section class="panel"><h2>${title}</h2>${table(['分類','份數'],rows.map(r=>[esc(labels[r._id]||r._id||'未分類'),esc(r.count)]))}</section>`;
      html=`${intro('測驗統計','全站已保存的研究紀錄，不含僅存於裝置的訪客紀錄。')}<p>歷來參與識別數：${esc(stats.totalParticipants)}（依帳號／訪客識別去重，並非即時在線人數）</p>${group('MBTI 結果',stats.mbtiStats)}${group('主要色彩',stats.colorStats,{red:'紅色',yellow:'黃色',green:'綠色',blue:'藍色'})}${group('問卷分布',stats.testTypeStats)}<div class="actions editor-tools">${link('#records','篩選與查看原始紀錄','secondary','history')}</div>`;
    }
    else if (current === 'records') {
      const [types, records] = await Promise.all([adminAPI('/api/admin/test-types'),adminAPI('/api/admin/test-records?page='+page+'&limit=20')]);
      if(seq!==revision)return; currentRecords=records.records;
      html=`${intro('測驗紀錄','依問卷與結果篩選，查看完整作答。')}<form id="record-filter" class="toolbar">${select('testType','問卷',[['','全部問卷'],...(types.testTypes||types).map(t=>[t,t])])}${select('mbtiResult','MBTI',[['','全部結果'],...['ENFJ','ENFP','ENTJ','ENTP','ESFJ','ESFP','ESTJ','ESTP','INFJ','INFP','INTJ','INTP','ISFJ','ISFP','ISTJ','ISTP'].map(t=>[t,t])])}${submit('套用篩選')}${button('匯出本頁 CSV','data-export','secondary','download')}</form><div id="records-list"><p class="hint">共 ${records.total} 份紀錄</p>${recordRows(records.records)}${pagination(records.totalPages)}</div>`;
    } else if (current === 'feedbacks') { loaded = await adminAPI('/api/admin/feedbacks?page='+page+'&limit=10'); html=`${intro('使用者回饋','聽見問題，也找到讓 ColorLab 更好的方向。')}${table(['稱呼','Email','回饋內容','時間'],loaded.records.map(r=>[esc(r.name||'未留名'),esc(r.email||'未提供'),esc(r.description),date(r.timestamp)]))}${pagination(loaded.totalPages)}`; }
    else html=`${intro('找不到這個頁面')}${link('/app/#home','回到首頁','primary')}`;
    if (seq !== revision) return;
    main.innerHTML=html; document.title='ColorLab｜'+(main.querySelector('h1,h2')?.textContent||'我的空間');
    main.inert = false; main.focus({preventScroll:true}); window.scrollTo(0,0); bind(loaded);
    if(!['login','admin-login','register'].includes(current))bindAppReturn(main.querySelector('.back-link[href^="/app/#"]'));
    mountedKey=routeKey;
    if (retainedRoutes.has(current) && isAdmin) main.querySelector('.page-intro')?.insertAdjacentHTML('beforeend','<button type="button" class="text-button" data-refresh-view>更新資料</button>');
    if (current==='content-review') await bindReview(main,{showDialog,modal,notify,setBusy:value=>{pendingSave=value;}});
  } catch(error) {
    if(seq!==revision)return;
    mountedKey='';
    main.innerHTML=`${intro('暫時無法開啟',error.message)}<div class="actions">${button('重新載入','data-retry','primary')}${link(isAdmin?'#admin-login':'#login','重新登入')}</div>`;
    main.querySelector('[data-retry]').onclick=render;
  } finally {
    if(seq===revision) { main.inert=false; main.removeAttribute('aria-busy'); loading.hidden=true; }
  }
}
async function loadRecords() {
  const query = new URLSearchParams(data(document.querySelector('#record-filter'))); query.set('page',page); query.set('limit','20');
  const list = document.querySelector('#records-list'); const seq=revision, request=++recordsRevision;
  list.setAttribute('aria-busy','true'); list.inert=true;
  const exportButton=document.querySelector('[data-export]'); if(exportButton)exportButton.disabled=true;
  try { const result=await adminAPI('/api/admin/test-records?'+query); if(seq!==revision||request!==recordsRevision)return; currentRecords=result.records; list.innerHTML=`<p class="hint">共 ${result.total} 份紀錄</p>${recordRows(result.records)}${pagination(result.totalPages)}`; }
  catch(error) { if(seq===revision&&request===recordsRevision){ currentRecords=[]; list.innerHTML=`<p role="alert">${esc(error.message)}</p>`; } }
  finally { if(seq===revision&&request===recordsRevision){list.removeAttribute('aria-busy');list.inert=false;if(exportButton)exportButton.disabled=false;} }
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
  const forgot=main.querySelector('#forgot-password-form');
  if(forgot)forgot.onsubmit=event=>{event.preventDefault();saveForm(forgot,async()=>{
    await api('/api/'+forgot.dataset.recoveryRole+'/forgot-password',json('POST',{email:data(forgot).email}));
    forgot.innerHTML='<div class="recovery-success" role="status"><h2>請查看你的信箱</h2><p>若此信箱符合帳號重設條件，我們會寄出重設連結。請查看收件匣與垃圾郵件；未綁定或尚未驗證的會員，請聯絡管理員協助。</p></div>';
  });};
  const reset=main.querySelector('#reset-password-form');
  if(reset)reset.onsubmit=event=>{event.preventDefault();saveForm(reset,async()=>{
    const values=data(reset),role=reset.dataset.recoveryRole;
    if(values.password!==values.confirmPassword)throw new Error('兩次新密碼不同，請再確認。');
    if(new TextEncoder().encode(values.password).length>72)throw new Error('密碼過長，請縮短後再試（最多72個英數字元；中文或表情符號可用字數較少）。');
    if(recoveryToken?.role!==role)throw new Error('重設連結無法使用，請重新申請。');
    await api('/api/'+role+'/reset-password',json('POST',{token:recoveryToken.token,password:values.password}));
    recoveryToken=null;clearSession();reset.innerHTML=`<div class="recovery-success" role="status"><h2>密碼已更新</h2><p>請用新密碼重新登入；其他裝置的舊登入也已失效。</p></div>${link(role==='admin'?'#admin-login':'#login','前往登入','primary')}`;
  });};
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
    const values=data(login),role=current==='admin-login'?'admin':'user';let result;
    main.querySelector('[data-login-guidance]').replaceChildren();
    try {result=await api('/api/'+role+'/login',json('POST',values));}
    catch(error){if(role==='user'&&error.code==='EMAIL_VERIFICATION_REQUIRED'){sessionStorage.setItem('colorlab:pending-email',values.email);main.querySelector('[data-login-guidance]').innerHTML='<p class="auth-help">完成 Email 驗證後即可登入。<a href="#verification">前往驗證協助</a></p>';}throw error;}
    saveSession(result,role);location.assign('/app/#me');
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
  contentForm?.addEventListener('input',event=>{if(['imageUrl','link','sourceName','contentKind','title'].includes(event.target.name))contentForm.querySelector('[data-content-preview]').innerHTML=adminContentMedia(data(contentForm));});
  if(contentForm)contentForm.onsubmit=event=>{event.preventDefault();saveForm(contentForm,async()=>{const values=data(contentForm);for(const key of ['link','imageUrl'])if(values[key]&&!safeUrl(values[key],''))throw new Error('請填寫有效的圖片或網站網址。');await adminAPI('/api/homepage'+(loaded._id?'/'+loaded._id:''),json(loaded._id?'PUT':'POST',values));dirty=false;location.hash='content';notify('首頁資訊已儲存。');});};
  main.querySelector('[data-upload]')?.addEventListener('change',event=>upload(event.target));
  const filter=main.querySelector('#record-filter');if(filter)filter.onsubmit=event=>{event.preventDefault();page=1;loadRecords();};
}
main.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el||el.disabled)return;
  if(el.hasAttribute('data-refresh-view')){invalidateViews();await render();return;}
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
    try {const seq=revision, identity=sessionIdentity();const r=await recordDetail(el.dataset.record);if(seq!==revision||identity!==sessionIdentity())return;const snapshot=r.exploration?.survey;const answers=snapshot?snapshot.questions.map((q,i)=>({question:q.question,answer:q.options[r.exploration.answers?.[i]??r.answers?.[i]]})):r.answers||[];const primary=Array.isArray(r.colorResult?.primary)?r.colorResult.primary:[r.colorResult?.primary];const colors=primary.filter(c=>['red','yellow','green','blue'].includes(c)).sort();const report=/^[EI][NS][FT][JP]$/.test(r.mbtiResult||'')&&colors.length?`/test/detailed-reports/${r.mbtiResult}-${colors.join('-')}.pdf`:null;showDialog(r.testType||'測驗紀錄',`<section class="record-summary" aria-label="本次測驗摘要"><dl class="record-meta"><div><dt>作答身分</dt><dd>${esc(r.email||'訪客')}</dd></div><div><dt>完成時間</dt><dd>${date(r.timestamp)}</dd></div></dl><div class="record-result"><span>${r.mbtiResult?'MBTI 結果':'測驗類型'}</span><strong>${esc(r.mbtiResult||'一般問卷')}</strong>${colors.length?`<span class="record-color-label">主要色彩</span>${colors.map(c=>`<span class="record-color" data-color="${c}">${({red:'紅色',yellow:'黃色',green:'綠色',blue:'藍色'})[c]}</span>`).join('')}`:''}</div>${report?`<div class="actions">${link(pdfHref(report,{admin:true}),'預覽 PDF','secondary','eye')}${`<a class="button primary" href="${esc(report)}" download>${icon('download')}<span>下載 PDF</span></a>`}</div>`:''}</section>${answers.map((a,i)=>`<section class="record-answer"><h3>${i+1}. ${esc(String(a.question||'原始題目').replace(/^\s*\d+[.、．]\s*/,''))}</h3><p>${esc(a.answer??'未記錄')}</p></section>`).join('')}`);}catch(error){notify(error.message);}
  }
  if(el.hasAttribute('data-export')){
    const rows=[['帳號','測驗','結果','完成時間'],...currentRecords.map(r=>[r.email,r.testType,r.mbtiResult,r.timestamp])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ColorLab-測驗紀錄-本頁.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
window.addEventListener('hashchange',render);
await render();
