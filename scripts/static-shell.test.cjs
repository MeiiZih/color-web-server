const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../static-dist');
test('every old main and test HTML is replaced by a compatibility redirect, not a reskinned page', () => {
  for (const folder of ['main','test']) {
    const source = path.resolve(__dirname, '../color-web',folder);
    for (const file of fs.readdirSync(source, { recursive: true }).filter(file => file.endsWith('.html'))) {
      const built = fs.readFileSync(path.join(output,folder,file),'utf8');
      assert.match(built,/data-legacy-redirect/,file);
      assert.doesNotMatch(built, /stylesheet|navbar\.js|integrated-shell|loginForm/, file);
    }
  }
});
test('new application and PDF keep their independent styles; mock routes are not published', () => {
  for (const file of ['index.html', 'app/index.html', 'app/account.html', 'app/pdf.html']) assert.doesNotMatch(fs.readFileSync(path.join(output, file), 'utf8'), /integrated-shell|navbar\.js|\/css\/common|\/css\/mobile/);
  assert.equal(fs.existsSync(path.join(output, 'qa')), false);
  assert.equal(fs.existsSync(path.join(output, 'scripts/preview-static.cjs')), false);
});
const { frontendTarget } = require('../Server/services/frontendRoutes');
test('legacy route mapping preserves questionnaire IDs and report parameters without forwarding tokens', () => {
  const id='a'.repeat(24);
  assert.equal(frontendTarget('/test/color-test-intro.html','?id='+id),'/app/#test/'+id);
  assert.equal(frontendTarget('/main/admin/EditSurvey.html','?id='+id),'/app/account.html#survey/'+id);
  assert.equal(frontendTarget('/main/login-user.html','?mode=admin&token=secret'),'/app/account.html#admin-login');
  assert.equal(frontendTarget('/test/report-preview.html','?mbti=ENFJ&colors=red-blue'),'/app/pdf.html?file='+encodeURIComponent('/test/detailed-reports/ENFJ-blue-red.pdf'));
  assert.equal(frontendTarget('/api/test/surveys'),null);
});
test('new app links never enter old main/test HTML', () => {
  for (const file of ['app/app.js','app/account.mjs']) assert.doesNotMatch(fs.readFileSync(path.join(output,file),'utf8'), /(?:href|assign|replace)[^\n]{0,30}\/main\//);
});
