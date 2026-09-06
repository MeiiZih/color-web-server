// One route map is shared by Express redirects and static compatibility entrypoints.
function frontendTarget(pathname, search = '') {
  const params = new URLSearchParams(search);
  const id = params.get('id') || params.get('userId') || '';
  const suffix = /^[a-f\d]{24}$/i.test(id) ? '/' + id : '';
  const routes = {
    '/': '/app/', '/index.html': '/app/', '/main/common.html': '/app/#home',
    '/main/login-user.html': '/app/account.html#' + (params.get('mode') === 'admin' ? 'admin-login' : 'login'),
    '/main/login-admin.html': '/app/account.html#admin-login', '/login-admin.html': '/app/account.html#admin-login',
    '/main/user/register.html': '/app/account.html#register', '/main/user/profile.html': '/app/account.html#profile',
    '/main/about.html': '/app/account.html#about', '/main/privacy.html': '/app/account.html#privacy',
    '/main/news/all.html': '/app/#home', '/main/news/events.html': '/app/#home',
    '/main/admin/admin.html': '/app/account.html#admin', '/main/admin/account-manage.html': '/app/account.html#users',
    '/main/admin/survey.html': '/app/account.html#surveys', '/main/admin/EditSurvey.html': '/app/account.html#survey' + (suffix || '/new'),
    '/main/admin/EditCommon.html': '/app/account.html#content', '/main/admin/data.html': '/app/account.html#records',
    '/main/admin/feedback.html': '/app/account.html#feedbacks', '/main/admin/profile-admin.html': '/app/account.html#admin-profile',
    '/main/admin/user-profile.html': '/app/account.html#' + (suffix ? 'user' + suffix : 'users'),
    '/main/admin/user-test.html': '/app/account.html#' + (suffix ? 'user' + suffix : 'users'),
    '/test/test.html': '/app/#surveys', '/test/select.html': '/app/#surveys', '/test/history.html': '/app/#history',
    '/test/color-test-intro.html': '/app/#test' + suffix, '/test/color-test.html': '/app/#test' + suffix,
    '/test/color-test-new.html': '/app/#test' + suffix, '/test/result.html': '/app/#history',
    '/test/information.html': '/app/account.html#contact', '/offline.html': '/app/'
  };
  if (pathname === '/test/report-preview.html') {
    const mbti = (params.get('mbti') || '').toUpperCase();
    const colors = (params.get('colors') || '').toLowerCase().split('-').sort().join('-');
    if (/^[EI][NS][FT][JP]$/.test(mbti) && /^(?:blue|green|red|yellow)(?:-(?:blue|green|red|yellow))*$/.test(colors)) return '/app/pdf.html?file=' + encodeURIComponent('/test/detailed-reports/' + mbti + '-' + colors + '.pdf');
    return '/app/#history';
  }
  return routes[pathname] || null;
}
module.exports = { frontendTarget };
