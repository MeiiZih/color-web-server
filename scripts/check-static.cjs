const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../static-dist');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
assert(read('index.html').includes('/app/app.js'));
assert(read('app/index.html').includes('/js/static-connection.js'));
assert(!read('app/app.js').includes('interface-demo'));
assert(!read('app/pdf.html').includes('static-connection.js'));
assert(read('wake.html').includes('window.parent.postMessage'));
assert(read('wake.html').includes('const destination = new URL(safePath, location.origin).href;'));
assert(!read('wake.html').includes('static-connection.js'));
assert.equal(JSON.parse(read('manifest.webmanifest')).start_url, '/app/');
for (const file of ['Server', 'design-preview', 'tmp', '.env']) assert(!fs.existsSync(path.join(root, file)));
for (const file of ['wake.html', 'app/index.html', 'main/login-user.html']) {
  for (const match of read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if (match[1].trim()) new vm.Script(match[1], { filename: file });
}
for (const file of ['vendor/pdfjs/pdf.mjs', 'vendor/pdfjs/pdf.worker.mjs', 'test/detailed-reports/ENFJ-red.pdf', 'assets/icons/icon-192.png']) assert(fs.statSync(path.join(root, file)).size > 0);
console.log('Static build checks passed: entry, isolated wake, inline syntax, PWA, PDF assets, no server/test files.');
