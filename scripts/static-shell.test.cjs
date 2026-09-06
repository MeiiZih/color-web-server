const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../static-dist');
test('all existing main forms keep their controls and receive the isolated shared shell', () => {
  const source = path.resolve(__dirname, '../color-web/main');
  for (const file of fs.readdirSync(source, { recursive: true }).filter(file => file.endsWith('.html') && file !== 'common.html')) {
    const original = fs.readFileSync(path.join(source, file), 'utf8');
    const built = fs.readFileSync(path.join(output, 'main', file), 'utf8');
    assert.match(built, /class="cl-integrated/);
    assert.equal((built.match(/src="\/js\/integrated-shell.js"/g) || []).length, 1);
    assert.deepEqual([...built.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]), [...original.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]), file);
    assert.ok(built.indexOf('/css/integrated-shell.css') > built.lastIndexOf('/css/mobile.css'));
    assert.ok(built.indexOf('/js/static-connection.js') < built.indexOf('/js/integrated-shell.js'));
  }
});
test('new application and PDF keep their independent styles; mock routes are not published', () => {
  for (const file of ['index.html', 'app/index.html', 'app/pdf.html']) assert.doesNotMatch(fs.readFileSync(path.join(output, file), 'utf8'), /integrated-shell/);
  assert.equal(fs.existsSync(path.join(output, 'qa')), false);
  assert.equal(fs.existsSync(path.join(output, 'scripts/preview-static.cjs')), false);
});
