(function setupColorLabExperience() {
  'use strict';

  const APP_NAME = 'ColorLab';
  const originalAlert = typeof window.alert === 'function' ? window.alert.bind(window) : null;
  let installPrompt = null;
  let toastRegion = null;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_error) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_error) { /* storage may be unavailable */ }
  }

  function ensureToastRegion() {
    if (toastRegion?.isConnected) return toastRegion;
    if (!document.body) return null;

    toastRegion = document.createElement('div');
    toastRegion.className = 'ux-toast-region';
    toastRegion.setAttribute('role', 'region');
    toastRegion.setAttribute('aria-label', '系統通知');
    toastRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastRegion);
    return toastRegion;
  }

  function inferToastType(message) {
    const value = String(message || '');
    if (/失敗|錯誤|無法|找不到|過期/.test(value)) return 'error';
    if (/請先|請選擇|請輸入|請填寫|注意|尚未/.test(value)) return 'warning';
    if (/成功|完成|已收到|已儲存|已更新/.test(value)) return 'success';
    return 'info';
  }

  function showToast(message, type = inferToastType(message), duration = 4200) {
    document.querySelectorAll?.('.ux-submit-loading').forEach(submit => {
      submit.classList.remove('ux-submit-loading');
      submit.removeAttribute('aria-busy');
    });
    const region = ensureToastRegion();
    if (!region) {
      if (originalAlert) originalAlert(String(message));
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'ux-toast';
    toast.dataset.type = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
    toast.innerHTML = `
      <span class="ux-toast-icon" aria-hidden="true">${icons[type] || 'i'}</span>
      <span class="ux-toast-message"></span>
      <button type="button" class="ux-toast-close" aria-label="關閉通知">×</button>
    `;
    toast.querySelector('.ux-toast-message').textContent = String(message || '');

    const remove = () => {
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 210);
    };

    toast.querySelector('.ux-toast-close').addEventListener('click', remove);
    region.appendChild(toast);
    if (duration > 0) window.setTimeout(remove, duration);
    return toast;
  }

  window.alert = message => showToast(message);
  window.ColorLabUX = Object.freeze({ toast: showToast });

  function markPageType() {
    const path = window.location.pathname.toLowerCase();
    if (path === '/' || path.endsWith('/index.html')) document.body.classList.add('page-landing');
    if (path.includes('login-user')) document.body.classList.add('page-login');
    if (path.includes('/main/admin/')) document.body.classList.add('page-admin');
    if (path.includes('color-test-new')) document.body.classList.add('page-questionnaire');
    if (path.endsWith('/result.html')) document.body.classList.add('page-result');
  }

  function normalizeBrandAndLanguage() {
    document.title = document.title.replaceAll('ColorMind Lab', APP_NAME);
    document.querySelectorAll('.site-title').forEach(element => {
      if ((element.textContent || '').includes('ColorMind Lab')) element.textContent = APP_NAME;
    });
    document.querySelectorAll('img[alt="Logo"], img[alt="網站Logo"]').forEach(image => {
      image.alt = `${APP_NAME} 標誌`;
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) continue;
      if ((walker.currentNode.nodeValue || '').includes('後臺')) textNodes.push(walker.currentNode);
    }
    textNodes.forEach(node => { node.nodeValue = node.nodeValue.replaceAll('後臺', '後台'); });
  }

  function enhanceLandmarksAndHeadings() {
    const nav = document.querySelector('.nav-header, nav');
    if (nav && !nav.getAttribute('aria-label')) nav.setAttribute('aria-label', '主要導覽');

    if (!document.querySelector('main')) {
      const mainCandidate = document.querySelector('.main-container, .main-content, .profile-container, .feedback-container');
      if (mainCandidate) mainCandidate.setAttribute('role', 'main');
    }

    if (!document.querySelector('h1')) {
      const firstHeading = document.querySelector('h2, .page-title, .section-title');
      if (firstHeading) {
        firstHeading.setAttribute('role', 'heading');
        firstHeading.setAttribute('aria-level', '1');
      }
    }

    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    document.querySelectorAll('.nav-link[href]').forEach(link => {
      const linkPath = new URL(link.href, window.location.href).pathname;
      const matches = linkPath === path ||
        (linkPath.includes('/main/common') && (path === '/' || path.includes('/main/common'))) ||
        (linkPath.includes('/test/test') && path.includes('/test/')) ||
        (linkPath.includes('/main/about') && path.includes('/main/about'));
      if (matches) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function enhanceForms() {
    const labelsById = {
      email: '電子郵件', username: '電子郵件', password: '密碼',
      regName: '姓名', regEmail: '電子郵件', regPhone: '行動電話',
      regPassword: '密碼', regConfirmPassword: '確認密碼',
      year: '出生年份', month: '出生月份', day: '出生日期',
      testTypeFilter: '測驗名稱', mbtiFilter: 'MBTI 類型'
    };

    document.querySelectorAll('input, select, textarea').forEach(field => {
      const id = field.id || '';
      const hasLabel = Boolean(field.labels?.length);
      if (!hasLabel && !field.getAttribute('aria-label')) {
        const label = labelsById[id] || field.placeholder || field.name;
        if (label) field.setAttribute('aria-label', label);
      }

      const identity = `${id} ${field.name || ''}`.toLowerCase();
      if (!field.autocomplete) {
        if (identity.includes('email') || identity.includes('username')) field.autocomplete = 'email';
        else if (identity.includes('name')) field.autocomplete = 'name';
        else if (identity.includes('phone')) field.autocomplete = 'tel';
        else if (field.type === 'password') {
          field.autocomplete = identity.includes('confirm') || identity.includes('reg') ? 'new-password' : 'current-password';
        }
      }
      if (identity.includes('phone')) field.inputMode = 'tel';
      if (identity.includes('email')) field.inputMode = 'email';
    });

    document.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.closest('.ux-password-field')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'ux-password-field';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ux-password-toggle';
      toggle.textContent = '顯示';
      toggle.setAttribute('aria-label', '顯示密碼');
      toggle.addEventListener('click', () => {
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        toggle.textContent = reveal ? '隱藏' : '顯示';
        toggle.setAttribute('aria-label', reveal ? '隱藏密碼' : '顯示密碼');
      });
      wrapper.appendChild(toggle);

      if ((input.id || '').toLowerCase().includes('regpassword')) {
        input.minLength = Math.max(input.minLength || 0, 6);
        const hint = document.createElement('span');
        hint.className = 'ux-field-hint';
        hint.textContent = '至少 6 個字元，建議混合英文、數字與符號。';
        wrapper.insertAdjacentElement('afterend', hint);
      }
    });

    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', () => {
        if (!form.checkValidity()) return;
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (!submit || submit.classList.contains('ux-submit-loading')) return;
        submit.dataset.uxOriginalLabel = submit.textContent || submit.value || '';
        submit.classList.add('ux-submit-loading');
        submit.setAttribute('aria-busy', 'true');
        window.setTimeout(() => {
          submit.classList.remove('ux-submit-loading');
          submit.removeAttribute('aria-busy');
        }, 9000);
      });

      const messageNodes = form.querySelectorAll('.error-message, .success-message, [role="alert"], [role="status"]');
      if (messageNodes.length) {
        const releaseSubmit = () => {
          const hasMessage = [...messageNodes].some(node => node.textContent.trim() && getComputedStyle(node).display !== 'none');
          if (!hasMessage) return;
          form.querySelectorAll('.ux-submit-loading').forEach(submit => {
            submit.classList.remove('ux-submit-loading');
            submit.removeAttribute('aria-busy');
          });
        };
        const observer = new MutationObserver(releaseSubmit);
        messageNodes.forEach(node => observer.observe(node, { childList: true, subtree: true, attributes: true }));
      }
    });
  }

  function enhanceLinksAndFooter() {
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      link.rel = 'noopener noreferrer';
      const label = (link.textContent || link.getAttribute('aria-label') || '').trim();
      if (label && !link.title) link.title = `${label}（另開新分頁）`;
    });

    const footer = document.querySelector('footer, .footer');
    if (footer && !footer.querySelector('.ux-privacy-link')) {
      const separator = document.createTextNode(' · ');
      const privacy = document.createElement('a');
      privacy.href = '/main/privacy.html';
      privacy.className = 'ux-privacy-link';
      privacy.textContent = '隱私與資料說明';
      footer.append(separator, privacy);
    }
  }

  function enhanceBackButtons() {
    document.querySelectorAll('.back-button[aria-label="返回"]').forEach(button => {
      button.setAttribute('aria-label', '返回上一頁');
    });
  }

  function enhanceCarousel() {
    const newsCarousel = document.querySelector('.single-carousel-container');
    if (!newsCarousel) return;

    document.querySelectorAll('.carousel-arrow').forEach((arrow, index) => {
      arrow.setAttribute('role', 'button');
      arrow.tabIndex = 0;
      arrow.setAttribute('aria-label', index === 0 ? '上一則資訊' : '下一則資訊');
      if (arrow.tagName !== 'BUTTON') {
        arrow.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            arrow.click();
          }
        });
      }
    });

    document.querySelectorAll('.info-carousel-arrow').forEach(arrow => {
      arrow.setAttribute('aria-label', arrow.classList.contains('left') ? '上一則一般資訊' : '下一則一般資訊');
    });

    let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pauseButton = document.createElement('button');
    pauseButton.type = 'button';
    pauseButton.className = 'ux-carousel-toggle';
    pauseButton.textContent = paused ? '播放輪播' : '暫停輪播';
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      if (paused && typeof window.stopNewsAutoPlay === 'function') window.stopNewsAutoPlay();
      if (!paused && typeof window.startNewsAutoPlay === 'function') window.startNewsAutoPlay();
      pauseButton.textContent = paused ? '播放輪播' : '暫停輪播';
      pauseButton.setAttribute('aria-pressed', String(paused));
    });
    newsCarousel.appendChild(pauseButton);

    if (paused) window.setTimeout(() => window.stopNewsAutoPlay?.(), 0);

    let startX = null;
    newsCarousel.addEventListener('pointerdown', event => { startX = event.clientX; }, { passive: true });
    newsCarousel.addEventListener('pointerup', event => {
      if (startX === null) return;
      const delta = event.clientX - startX;
      startX = null;
      if (Math.abs(delta) >= 55 && typeof window.moveNewsSlide === 'function') {
        window.moveNewsSlide(delta > 0 ? -1 : 1);
      }
    }, { passive: true });
  }

  function enhanceResponsiveTables(root = document) {
    const selector = '.account-table table, .history-table table, .table-container table, .data-table table';
    root.querySelectorAll?.(selector).forEach(table => {
      table.classList.add('ux-card-table');
      const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = [...row.children].filter(cell => cell.tagName === 'TD');
        const isEmpty = cells.every(cell => !cell.textContent.replace(/\u00a0/g, '').trim());
        row.classList.toggle('ux-empty-row', isEmpty);
        cells.forEach((cell, index) => {
          if (!cell.hasAttribute('colspan')) cell.dataset.label = headers[index] || `欄位 ${index + 1}`;
        });
      });
    });
  }

  function watchDynamicTables() {
    enhanceResponsiveTables();
    const observer = new MutationObserver(records => {
      if (records.some(record => record.addedNodes.length)) enhanceResponsiveTables();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function enhanceAdminSearch() {
    if (!window.location.pathname.includes('/main/admin/account-manage')) return;
    const table = document.querySelector('.account-table');
    if (!table || document.querySelector('.ux-admin-tools')) return;

    const tools = document.createElement('div');
    tools.className = 'ux-admin-tools';
    tools.innerHTML = '<label class="ux-visually-hidden" for="uxAccountSearch">搜尋帳號</label><input id="uxAccountSearch" class="ux-admin-search" type="search" placeholder="搜尋目前頁面的帳號或日期" autocomplete="off">';
    table.insertAdjacentElement('beforebegin', tools);

    const input = tools.querySelector('input');
    const applyFilter = () => {
      const query = input.value.trim().toLowerCase();
      document.querySelectorAll('#userTableBody tr').forEach(row => {
        if (row.querySelector('[colspan]')) return;
        row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
      });
    };
    input.addEventListener('input', applyFilter);
    new MutationObserver(applyFilter).observe(document.getElementById('userTableBody'), { childList: true });
  }

  function enhanceAdminDraftSaving() {
    if (!window.location.pathname.includes('/main/admin/EditSurvey')) return;
    let timer = null;
    let dirty = false;

    const status = document.createElement('div');
    status.className = 'ux-draft-status';
    status.textContent = '所有變更皆已儲存';
    status.setAttribute('role', 'status');
    document.body.appendChild(status);

    document.addEventListener('input', event => {
      if (!event.target.matches('input, textarea, select')) return;
      dirty = true;
      status.textContent = '正在儲存變更…';
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const saveDraft = typeof window.persistSurvey === 'function'
          ? () => window.persistSurvey(true)
          : (typeof window.saveQuestionnaire === 'function' ? () => window.saveQuestionnaire(true) : null);
        if (!saveDraft) {
          status.textContent = '請按下儲存以保留變更';
          return;
        }
        try {
          document.activeElement?.dispatchEvent(new Event('change', { bubbles: true }));
          const saved = await saveDraft();
          if (saved === false) throw new Error('save failed');
          dirty = false;
          status.textContent = '變更已自動儲存';
        } catch (_error) {
          status.textContent = '自動儲存失敗，請手動儲存';
        }
      }, 1800);
    });

    window.addEventListener('beforeunload', event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function showSignedInHint() {
    if (!document.body.classList.contains('page-login')) return;
    window.setTimeout(() => {
      const identity = document.querySelector('.user-icon:not([style*="display: none"])');
      const login = document.querySelector('.login-container');
      if (!identity || !login || document.querySelector('.ux-auth-status')) return;
      const isAdmin = /管理員/.test(identity.textContent || '');
      const status = document.createElement('div');
      status.className = 'ux-auth-status';
      status.innerHTML = `你目前已登入。<a href="${isAdmin ? '/main/admin/admin.html' : '/main/common.html'}">返回${isAdmin ? '管理後台' : '首頁'}</a>，或使用下方表單切換帳號。`;
      login.insertAdjacentElement('beforebegin', status);
    }, 350);
  }

  function handleLanding() {
    if (!document.body.classList.contains('landing-page')) return;
    const params = new URLSearchParams(window.location.search);
    const welcomed = storageGet('colorlab-welcomed') === 'true';
    if (welcomed && !params.has('welcome')) {
      window.location.replace('/main/common.html');
      return;
    }
    document.querySelector('.first-btn')?.addEventListener('click', () => storageSet('colorlab-welcomed', 'true'));
  }

  function setupNetworkState() {
    let banner = null;
    const showOffline = () => {
      if (banner?.isConnected) return;
      banner = document.createElement('div');
      banner.className = 'ux-network-banner';
      banner.setAttribute('role', 'status');
      banner.textContent = '目前離線，已載入的內容仍可瀏覽；連線恢復後會自動同步。';
      document.body.appendChild(banner);
    };
    const showOnline = () => {
      banner?.remove();
      banner = null;
      showToast('網路已恢復連線', 'success', 2600);
    };
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);
    if (!navigator.onLine) showOffline();
  }

  function removeInstallBanner() {
    document.querySelector('.ux-install-banner')?.remove();
  }

  function createInstallBanner() {
    if (!installPrompt || document.querySelector('.ux-install-banner')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (storageGet('colorlab-install-dismissed') === 'true') return;

    const banner = document.createElement('aside');
    banner.className = 'ux-install-banner';
    banner.setAttribute('aria-label', `安裝 ${APP_NAME}`);
    banner.innerHTML = `
      <img class="ux-install-icon" src="/assets/icons/icon-192.png" alt="">
      <div class="ux-install-copy"><strong>安裝 ${APP_NAME}</strong><span>下次可從主畫面快速開啟，並支援離線基本頁面。</span></div>
      <div class="ux-install-actions"><button type="button" class="ux-install-action">安裝</button><button type="button" class="ux-install-dismiss" aria-label="暫時不要">×</button></div>
    `;
    banner.querySelector('.ux-install-action').addEventListener('click', async () => {
      const promptEvent = installPrompt;
      installPrompt = null;
      await promptEvent.prompt();
      await promptEvent.userChoice;
      removeInstallBanner();
    });
    banner.querySelector('.ux-install-dismiss').addEventListener('click', () => {
      storageSet('colorlab-install-dismissed', 'true');
      removeInstallBanner();
    });
    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const isEngaged = storageGet('colorlab-engaged') === 'true';
    const highIntentPage = /result|history/.test(window.location.pathname);
    if (isEngaged || highIntentPage) window.setTimeout(createInstallBanner, 900);
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    removeInstallBanner();
    storageSet('colorlab-installed', 'true');
    showToast(`${APP_NAME} 已安裝完成`, 'success');
  });

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(error => {
      console.warn(`${APP_NAME} PWA registration failed:`, error);
    });
  }

  function initialize() {
    markPageType();
    normalizeBrandAndLanguage();
    enhanceLandmarksAndHeadings();
    enhanceForms();
    enhanceLinksAndFooter();
    enhanceBackButtons();
    enhanceCarousel();
    watchDynamicTables();
    enhanceAdminSearch();
    enhanceAdminDraftSaving();
    showSignedInHint();
    handleLanding();
    setupNetworkState();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
