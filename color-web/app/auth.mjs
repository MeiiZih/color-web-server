const USER_KEY = 'colorlab:user-session:v1';
function changed() {
  localStorage.setItem('colorlab:data-revision:v1', Date.now() + ':' + Math.random());
  globalThis.window?.dispatchEvent(new Event('colorlab:data-changed'));
}
globalThis.window?.addEventListener('storage', event => {
  if (event.key !== null && !['adminToken',USER_KEY].includes(event.key)) return;
  for (const key of ['adminToken','adminEmail','adminName','admin','userToken','token','user','userId','userEmail','userName']) sessionStorage.removeItem(key);
  window.dispatchEvent(new Event('colorlab:session-changed'));
});
export function validToken(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 > Date.now(); } catch { return false; }
}
export function restoreSession() {
  try {
    const admin = [sessionStorage.getItem('adminToken'), localStorage.getItem('adminToken')].find(validToken);
    if (validToken(admin)) {
      sessionStorage.setItem('adminToken', admin);
      for (const key of ['adminToken', 'adminEmail', 'adminName', 'admin']) if (!sessionStorage.getItem(key) && localStorage.getItem(key)) sessionStorage.setItem(key, localStorage.getItem(key));
      return 'admin';
    }
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (saved && validToken(saved.token) && sessionStorage.getItem('isGuest') !== 'true') {
      for (const [key, value] of Object.entries({ token: saved.token, userToken: saved.token, userEmail: saved.email, userName: saved.name, userId: saved.userId || saved.user?.id || saved.user?._id || '', user: JSON.stringify(saved.user || {}) })) sessionStorage.setItem(key, value);
    }
    return validToken(sessionStorage.getItem('userToken')) ? 'user' : null;
  } catch { return null; }
}
export function clearSession() {
  for (const store of [sessionStorage, localStorage]) {
    for (const key of ['adminToken', 'adminEmail', 'adminName', 'admin', 'userToken', 'token', 'user', 'userId', 'userEmail', 'userName', 'isGuest', 'guestId', USER_KEY]) store.removeItem(key);
  }
  changed();
}
export function saveSession(data, role) {
  clearSession();
  const u = data.user;
  if (role === 'admin') {
    for (const store of [sessionStorage, localStorage]) for (const [key, value] of Object.entries({ adminToken: data.token, adminEmail: u.email, adminName: u.name, admin: JSON.stringify(u) })) store.setItem(key, value);
  } else {
    localStorage.setItem(USER_KEY, JSON.stringify({ token: data.token, user: u, name: u.name, email: u.email, userId: u.id || u._id }));
    restoreSession();
  }
}
export function updateSessionUser(user, role = 'user') {
  saveSession({ user, token: sessionStorage.getItem(role === 'admin' ? 'adminToken' : 'userToken') }, role);
}
export async function api(path, { role = 'user', ...options } = {}) {
  await window.ColorLabConnection?.ready;
  const token = sessionStorage.getItem(role === 'admin' ? 'adminToken' : 'userToken');
  const response = await fetch(path, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, signal: options.signal || AbortSignal.timeout(25000) });
  const data = await response.json().catch(() => ({ message: '服務尚未準備好，請稍後重試。' }));
  if (!response.ok) { const error = new Error(data.message || '操作未完成，請稍後重試。'); error.status = response.status; error.code = data.code; throw error; }
  if (!['GET','HEAD'].includes((options.method || 'GET').toUpperCase())) changed();
  return data;
}
export const json = (method, value, role) => ({ method, role, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
