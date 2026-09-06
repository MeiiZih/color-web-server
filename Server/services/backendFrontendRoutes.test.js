const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { backendPageTarget } = require('./backendFrontendRoutes');

test('known legacy page and report preview retain intended frontend destinations', () => {
  assert.equal(backendPageTarget('GET', '/main/common.html'), '/app/#home');
  assert.equal(backendPageTarget('GET', '/main/login-user.html', 'mode=admin'), '/app/account.html#admin-login');
  assert.equal(backendPageTarget('GET', '/test/report-preview.html', 'mbti=ENFJ&colors=yellow-red'), '/app/pdf.html?file=%2Ftest%2Fdetailed-reports%2FENFJ-red-yellow.pdf');
});
test('app entrypoints preserve queries while unknown legacy HTML never renders old UI', () => {
  assert.equal(backendPageTarget('GET', '/app'), '/app/');
  assert.equal(backendPageTarget('HEAD', '/app/account.html', 'next=profile'), '/app/account.html?next=profile');
  assert.equal(backendPageTarget('GET', '/app/pdf.html', 'file=report.pdf'), '/app/pdf.html?file=report.pdf');
  for (const page of ['/main/forgotten.html', '/wake.html', '/other.HTML', '/main/register%2ehtml', '/test/', '/main']) assert.equal(backendPageTarget('GET', page), '/app/');
});
test('API, reports and assets retain backend compatibility, including HEAD and non-GET', () => {
  for (const page of ['/api/test/surveys','/api/custom.html','/health','/uploads/homepage/file.html','/assets/help.html','/vendor/pdfjs/pdf.mjs','/test/detailed-reports/ENFJ-red.pdf','/app/app.js','/app/style.css','/app/companion-interaction.mjs','/service-worker.js','/manifest.webmanifest','/colorlab-mark.svg','/test/report.pdf']) {
    assert.equal(backendPageTarget('GET', page), null, page);
    assert.equal(backendPageTarget('HEAD', page), null, page);
  }
  assert.equal(backendPageTarget('POST', '/main/login-user.html'), null);
  assert.equal(backendPageTarget('GET', '/invalid%ZZ.html'), null);
});
test('middleware redirects pages only and preserves real backend response contract', async () => {
  const app = express();
  app.use((req,res,next) => {
    const target = backendPageTarget(req.method,req.path,req.url.split('?')[1] || '');
    if (target) return res.redirect(302,'https://colorlab-start.onrender.com'+target);
    next();
  });
  app.use((_req,res) => res.status(200).send('backend response'));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const page of ['/main/common.html','/unknown.html','/wake.html','/app/account.html']) {
      const response=await fetch(origin+page,{redirect:'manual'});
      assert.equal(response.status,302);assert(response.headers.get('location').startsWith('https://colorlab-start.onrender.com/app/'));
    }
    for (const page of ['/api/homepage','/health','/uploads/homepage/example.webp','/test/detailed-reports/ENFJ-red.pdf','/service-worker.js','/app/style.css']) {
      const response=await fetch(origin+page,{redirect:'manual'});
      assert.equal(response.status,200);assert.equal(await response.text(),'backend response');
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
