/* Loaded first only in the independent static build. Never navigates to the sleeping origin. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const backend = window.COLORLAB_API_ORIGIN;
  function reportPath(input) {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (![location.origin, backend].includes(url.origin)) return null;
    const match = url.pathname.match(/^\/api\/reports\/(?:preview|download)\/([EI][NS][FT][JP])\/((?:blue|green|red|yellow)(?:-(?:blue|green|red|yellow))*)$/);
    return match ? `/test/detailed-reports/${match[1]}-${match[2]}.pdf` : null;
  }
  function endpoint(input) {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const service = /^\/(api\/|health(?:$|\/))/.test(url.pathname);
    return service && [location.origin, backend].includes(url.origin) ? backend + url.pathname + url.search : null;
  }
  const ready = (async () => {
    try {
      const response = await nativeFetch(backend + '/health', { cache: 'no-store', signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.text()).trim() === 'OK') return;
    } catch { /* A cold service uses the locally delivered ColorLab experience. */ }
    if (!document.body) await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    await new Promise(resolve => {
      const frame = document.createElement('iframe');
      frame.src = '/wake.html?embedded=1';
      frame.title = 'ColorLab 正在準備：互動色彩空間';
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100dvh;border:0;background:#fff8f6;z-index:2147483647';
      const previousFocus = document.activeElement;
      const siblings = [...document.body.children].filter(el => !el.inert);
      siblings.forEach(el => { el.inert = true; });
      const onReady = event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'colorlab:ready') return;
        window.removeEventListener('message', onReady);
        // Release API requests now, but keep the painted wake screen until the app can replace it.
        let revealing = false;
        const main = document.querySelector('#main');
        const observer = new MutationObserver(checkContent);
        const fallback = window.setTimeout(reveal, 8000);
        function reveal() {
          if (revealing) return;
          revealing = true;
          observer.disconnect();
          window.clearTimeout(fallback);
          const finish = () => {
            frame.remove();
            siblings.forEach(el => { if (el.isConnected) el.inert = false; });
            const focusTarget = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : main;
            focusTarget?.focus?.({ preventScroll: true });
          };
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
          // One compositor fade; no full-screen blur, second curtain, or scale jump.
          frame.style.transition = 'opacity 280ms cubic-bezier(.2,0,0,1)';
          requestAnimationFrame(() => requestAnimationFrame(() => { frame.style.opacity = '0'; }));
          window.setTimeout(finish, 350);
        }
        function checkContent() {
          if (main?.querySelector('h1,h2,form')) reveal();
        }
        if (main) observer.observe(main, { childList: true, subtree: true });
        resolve();
        checkContent();
        if (!main) window.setTimeout(reveal, 400); // Legacy static pages have no application root.
      };
      window.addEventListener('message', onReady);
      document.body.append(frame);
      frame.focus();
    });
  })();
  window.ColorLabConnection = { ready };
  window.fetch = async (input, init) => {
    const report = reportPath(input);
    if (report && (!init?.method || init.method === 'GET') && (!(input instanceof Request) || input.method === 'GET')) return nativeFetch(report, init);
    const target = endpoint(input);
    if (!target) return nativeFetch(input, init);
    await ready;
    if (input instanceof Request) {
      const source = new Request(input, init);
      return nativeFetch(target, { method: source.method, headers: source.headers,
        body: ['GET', 'HEAD'].includes(source.method) ? undefined : await source.arrayBuffer(),
        signal: source.signal, cache: source.cache, credentials: 'omit', mode: 'cors' });
    }
    return nativeFetch(target, { ...init, mode: 'cors', credentials: 'omit' });
  };
  // Legacy report page images use img.src rather than fetch().
  const mapImages = root => root.querySelectorAll('img[src]').forEach(img => {
    const url = new URL(img.getAttribute('src'), location.href);
    if (url.origin === location.origin && /^\/(uploads\/|api\/reports\/)/.test(url.pathname)) img.src = backend + url.pathname + url.search;
  });
  document.addEventListener('DOMContentLoaded', () => {
    mapImages(document);
    new MutationObserver(() => mapImages(document)).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  }, { once: true });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    const report = link && reportPath(link.href);
    if (report) link.href = report;
  }, true);
})();
