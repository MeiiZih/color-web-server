(function setupColorLabPwa() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    } catch (error) {
      console.warn('ColorLab PWA registration failed:', error);
    }
  });

  let installPrompt = null;
  let installButton = null;

  function removeInstallButton() {
    if (installButton) installButton.remove();
    installButton = null;
  }

  function createInstallButton() {
    if (installButton || window.matchMedia('(display-mode: standalone)').matches) return;

    installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.textContent = '安裝 ColorLab';
    installButton.setAttribute('aria-label', '將 ColorLab 安裝到裝置');
    installButton.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:10000',
      'border:0',
      'border-radius:999px',
      'padding:12px 18px',
      'background:#ef7183',
      'color:#fff',
      'font:700 14px/1.2 "Microsoft JhengHei",sans-serif',
      'box-shadow:0 10px 28px rgba(109,70,82,.24)',
      'cursor:pointer'
    ].join(';');

    installButton.addEventListener('click', async () => {
      if (!installPrompt) return;
      installButton.disabled = true;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      removeInstallButton();
    });

    document.body.appendChild(installButton);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    removeInstallButton();
  });
})();
