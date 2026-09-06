// Presentation-only bridge: existing forms, IDs, API calls and page handlers remain intact.
(() => {
  'use strict';
  const page = location.pathname.split('/').pop();
  const admin = location.pathname.startsWith('/main/admin/');
  const memberLinks = [
    ['/app/#home', '首頁', 'home'], ['/app/#surveys', '測驗', 'test'],
    ['/app/#history', '紀錄', 'history'], ['/app/#me', '我的', 'user']
  ];
  const adminLinks = [
    ['admin.html', '管理總覽', 'home'], ['account-manage.html', '帳號管理', 'user'],
    ['survey.html', '問卷管理', 'test'], ['EditCommon.html', '首頁資訊', 'news'],
    ['data.html', '測驗與回饋', 'history'], ['profile-admin.html', '管理員資料', 'settings']
  ];
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    test: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
    history: '<path d="M4 7a9 9 0 1 1-1 8M3 3v5h5M12 7v6l4 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v5H7zM14 8h3M14 12h3M7 16h10"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  const parentPage = ({ 'EditSurvey.html': 'survey.html', 'user-profile.html': 'account-manage.html', 'user-test.html': 'account-manage.html', 'feedback.html': 'data.html' })[page] || page;
  const links = (items, isAdmin = false) => items.map(([href, label, symbol]) => {
    const active = isAdmin ? href === parentPage : symbol === 'user' && /profile|login|register/.test(page);
    return `<a href="${isAdmin ? '/main/admin/' : ''}${href}"${active ? ' aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'cl-header';
  header.innerHTML = `<a class="cl-brand" href="/app/#home"><img src="/colorlab-mark.svg" alt="" width="32" height="32">ColorLab<span>${admin ? '管理工作室' : '每一面，都是你'}</span></a>${admin ? '<button class="cl-menu" type="button" aria-expanded="false" aria-controls="cl-admin-nav">選單 <span aria-hidden="true">☰</span></button>' : `<nav class="cl-desktop-nav" aria-label="主要導覽">${links(memberLinks)}</nav>`}`;
  document.body.prepend(header);
  const main = document.querySelector('main, .main-content, .main-container, body > .profile-container');
  if (main) {
    main.id ||= 'cl-content';
    if (main.tagName !== 'MAIN') main.setAttribute('role', 'main');
    main.setAttribute('tabindex', '-1');
    const skip = document.createElement('a');
    skip.className = 'cl-skip'; skip.href = `#${main.id}`; skip.textContent = '跳至主要內容';
    document.body.prepend(skip);
  }
  if (admin) {
    const navigation = document.createElement('nav');
    navigation.id = 'cl-admin-nav'; navigation.className = 'cl-admin-nav'; navigation.setAttribute('aria-label', '管理導覽');
    navigation.innerHTML = `<p class="cl-nav-caption">COLORLAB STUDIO</p>${links(adminLinks, true)}<div class="cl-nav-end"><a href="/app/#home">← 返回使用者首頁</a><button type="button" id="cl-signout">登出管理帳號</button></div>`;
    header.after(navigation);
    const menu = header.querySelector('.cl-menu');
    const close = () => { menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('is-open'); };
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && navigation.classList.contains('is-open')) { close(); menu.focus(); } });
    document.addEventListener('click', event => { if (!navigation.contains(event.target) && !menu.contains(event.target)) close(); });
    document.querySelector('#cl-signout').addEventListener('click', () => {
      // Clear both stores: legacy pages otherwise restore the old admin token immediately.
      for (const storage of [sessionStorage, localStorage]) {
        for (const key of ['adminToken', 'admin', 'adminName', 'adminEmail']) storage.removeItem(key);
      }
      location.assign('/main/login-user.html?mode=admin');
    });
    const title = adminLinks.find(([href]) => href === parentPage)?.[1] || '管理工作室';
    if (main && !main.querySelector('h1, .profile-title, .page-title')) {
      const heading = document.createElement('div'); heading.className = 'cl-page-intro';
      const h1 = document.createElement('h1'); h1.textContent = title;
      const description = document.createElement('p'); description.textContent = page === 'admin.html' ? '讓每一次探索，都有細心照顧。' : '在這裡整理、查看與管理 ColorLab 的內容。';
      heading.append(h1, description); main.prepend(heading);
    }
  } else {
    const bottom = document.createElement('nav'); bottom.className = 'cl-bottom-nav'; bottom.setAttribute('aria-label', '手機主要導覽');
    bottom.innerHTML = links(memberLinks); document.body.append(bottom);
  }
  if (page === 'login-user.html') {
    const welcome = document.createElement('aside'); welcome.className = 'cl-welcome';
    welcome.innerHTML = '<span class="cl-eyebrow">A LITTLE CLOSER TO YOURSELF</span><h2>每一面，<br>都值得被理解。</h2><p>留一點時間給自己。<br>從一場色彩探索，重新認識你的模樣。</p><div class="cl-colors" aria-hidden="true"><i></i><i></i><i></i><i></i></div><a href="/app/#surveys">先看看有哪些測驗 →</a>';
    document.querySelector('.login-container')?.before(welcome);
    document.querySelectorAll('.guest-notice-modal .notice-content p').forEach((paragraph, index) => {
      if (index === 0) paragraph.textContent = '你可以先以訪客身分探索，無需建立帳號。新版測驗的訪客紀錄保存在目前瀏覽器，清除網站資料後可能遺失，不會自動併入會員帳號。';
      else if (index === 1) paragraph.textContent = '新版測驗的訪客紀錄保存在目前瀏覽器，清除網站資料後可能遺失，不會自動併入會員帳號。';
    });
  }
  // Existing profile rows use visual text instead of associated labels.
  document.querySelectorAll('.form-row').forEach(row => {
    const label = row.querySelector('.form-label');
    row.querySelectorAll('input, select, textarea').forEach(input => {
      if (label && !input.labels?.length && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', label.textContent.trim());
    });
  });
  // Legacy survey cards are clickable divs. Keep their original click handlers.
  const enhanceCards = () => document.querySelectorAll('.survey-card:not([tabindex])').forEach(card => {
    card.tabIndex = 0; card.setAttribute('role', 'link');
    card.addEventListener('keydown', event => { if (event.key === 'Enter') card.click(); });
  });
  const surveyGrid = document.querySelector('#surveyGrid');
  if (surveyGrid) { enhanceCards(); new MutationObserver(enhanceCards).observe(surveyGrid, { childList: true }); }
})();
