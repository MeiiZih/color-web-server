const { frontendTarget } = require('./frontendRoutes');

// The backend retains API/files only; browser page entrypoints belong to the static frontend.
function backendPageTarget(method, pathname, search = '') {
  if (!['GET', 'HEAD'].includes(method)) return null;
  let page;
  try { page = decodeURIComponent(pathname); } catch { return null; }
  if (/^\/(?:api|health|uploads|assets|vendor|test\/detailed-reports)(?:\/|$)/i.test(page)) return null;
  const known = frontendTarget(page, search);
  if (known) return known;
  const query = search ? '?' + search.replace(/^\?/, '') : '';
  if (page === '/app' || page === '/app/') return '/app/' + query;
  if (page.startsWith('/app/') && /\.html?$/i.test(page)) return page + query;
  if (/\.html?$/i.test(page) || /^\/(?:main|test)\/?$/i.test(page)) return '/app/';
  return null; // Scripts, styles, fonts, PDF files, icons, manifests and service workers stay usable.
}

module.exports = { backendPageTarget };
