import { esc, date } from './ui.mjs';

export function verificationStatus(user) {
  const known = user && ('emailVerifiedAt' in user || 'emailVerificationRequired' in user);
  const verified = Boolean(user?.emailVerifiedAt);
  return `<h2>Email 驗證</h2><p class="verification-badge ${verified ? 'is-verified' : ''}">${!known ? '正在確認驗證狀態…' : verified ? '✓ 已驗證' : '尚未驗證'}</p><p data-verification-message role="status">${!known ? '正在向伺服器取得最新狀態。' : verified ? `驗證完成：${esc(date(user.emailVerifiedAt))}` : user.emailVerificationRequired ? '完成信箱驗證後即可登入。' : '既有會員可自由選擇驗證，不影響登入與測驗紀錄。'}</p><button type="button" class="button secondary" data-check-verification>重新確認狀態</button>`;
}

let dispose = () => {};
// Update this small status region only; never re-render an edited profile form.
export function bindVerificationStatus(root, load, onChange = () => {}) {
  dispose();
  if (!root) return;
  let active = true, busy = false, lastChecked = 0;
  const refresh = async () => {
    if (!active || !root.isConnected || busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    root.querySelector('button').disabled = true;
    try {
      const user = await load();
      if (active && root.isConnected) { root.innerHTML = verificationStatus(user); onChange(user); }
    } catch {
      if (active && root.isConnected) {
        if (root.querySelector('.verification-badge').textContent.includes('正在確認')) root.querySelector('.verification-badge').textContent = '狀態待確認';
        root.querySelector('[data-verification-message]').textContent = '目前無法確認最新狀態，請重新確認；若登入已過期，請先重新登入。';
      }
    } finally {
      busy = false; lastChecked = Date.now();
      if (active && root.isConnected) { root.removeAttribute('aria-busy'); root.querySelector('button').disabled = false; }
    }
  };
  const resume = () => { if (!document.hidden && Date.now() - lastChecked > 2000) refresh(); };
  const click = event => { if (event.target.closest('[data-check-verification]')) refresh(); };
  root.addEventListener('click', click);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', resume);
  dispose = () => { active = false; root.removeEventListener('click', click); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  refresh();
}
