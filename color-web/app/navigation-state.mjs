// Only navigation metadata is persisted. Records and rendered private pages stay in memory.
import { restoreSession } from './auth.mjs';
const REVISION = 'colorlab:data-revision:v1';
export function dataRevision() { return localStorage.getItem(REVISION) || ''; }
export function markDataChanged() {
  localStorage.setItem(REVISION, Date.now() + ':' + Math.random());
  window.dispatchEvent(new Event('colorlab:data-changed'));
}
export function sessionIdentity() {
  const role = restoreSession();
  return role ? role + ':' + sessionStorage.getItem(role === 'admin' ? 'adminToken' : 'userToken') : 'guest';
}
export function pdfHref(file, { admin = false } = {}) {
  const query = new URLSearchParams({ file, returnTo: location.pathname + location.search + location.hash });
  if (admin) query.set('from', 'admin');
  return '/app/pdf.html?' + query;
}
export function accountHref(route) {
  return '/app/account.html?' + new URLSearchParams({returnTo:location.pathname+location.search+location.hash}) + '#' + route;
}
export function bindAppReturn(anchor) {
  if (!anchor || !new URLSearchParams(location.search).has('returnTo')) return;
  bindPdfReturn(anchor);
}
export function bindPdfReturn(anchor) {
  const query = new URLSearchParams(location.search);
  const fallback = query.get('from') === 'admin' ? '/app/account.html#records' : '/app/#history';
  let target;
  try {
    target = new URL(query.get('returnTo') || fallback, location.origin);
    if (target.origin !== location.origin || !['/app/', '/app/index.html', '/app/account.html'].includes(target.pathname)) throw new Error();
  } catch { target = new URL(fallback, location.origin); }
  anchor.href = target.href;
  anchor.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    let previous;
    try { previous = new URL(document.referrer); } catch { return; }
    if (history.length > 1 && previous.origin === location.origin && previous.pathname === target.pathname) {
      event.preventDefault(); history.back();
    }
  });
}
