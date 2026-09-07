let cleanup;
export function showBrandEntry() {
  const el = document.createElement('div');
  el.className = 'brand-entry';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<img src="/colorlab-mark.svg" width="64" height="64" alt=""><span>ColorLab<span class="brand-dot">.</span></span>';
  document.body.append(el);
  setTimeout(() => el.remove(), 650);
}
export function showCompletion(kind, next) {
  cleanup?.();
  const el = document.createElement('div');
  el.className = 'completion-feedback';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="completion-content"><span class="completion-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="m13 24 7 7 15-16"/></svg><i></i><i></i><i></i><i></i></span><strong></strong><small></small></div>';
  el.querySelector('strong').textContent = kind === 'registration' ? '帳號建立成功' : '測驗已完成';
  el.querySelector('small').textContent = kind === 'registration' ? '接下來，請完成 Email 驗證' : '這一次的探索，已為你保存';
  const siblings = [...document.body.children].filter(node => !node.inert);
  siblings.forEach(node => { node.inert = true; });
  document.body.append(el);
  const destination = location.hash;
  let committed = false, timer;
  const onNavigate = () => { if (!committed && location.hash !== destination) remove(); };
  const remove = () => {
    clearTimeout(timer); el.remove();
    siblings.forEach(node => { if (node.isConnected) node.inert = false; });
    window.removeEventListener('hashchange', onNavigate); window.removeEventListener('pagehide', remove);
    if (committed) document.querySelector('main')?.focus({preventScroll:true});
  };
  timer = setTimeout(() => {
    if (!el.isConnected || location.hash !== destination) { remove(); return; }
    committed = true; next?.();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.classList.add('is-leaving'); timer = setTimeout(remove, 140);
    }));
  }, 600);
  window.addEventListener('hashchange', onNavigate);
  window.addEventListener('pagehide', remove, { once: true });
  cleanup = remove;
}
