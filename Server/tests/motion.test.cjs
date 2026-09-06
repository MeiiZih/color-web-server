const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '../../color-web/app', file), 'utf8');

test('shared motion is delivered to app, account and PDF without an animation dependency', () => {
  for (const file of ['index.html', 'account.html', 'pdf.html']) assert.match(read(file), /href="\/app\/motion.css"/);
  assert.doesNotMatch(read('motion.css'), /@import|https?:|infinite|will-change|pointer-events/);
});
test('motion is progressive enhancement and reduced motion keeps all information visible', () => {
  const css = read('motion.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important; transition: none !important/);
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/);
  assert.match(css, /\.test-page \.question-area \{ animation: none/);
  assert.doesNotMatch(css, /\.hero-copy\s*\{\s*animation:|\.result-hero\s*\{\s*animation:/);
  for (const file of ['app.js','account.mjs']) assert.match(read(file), /createNavigationMotion/);
  assert.match(read('navigation-motion.mjs'), /!changed \|\| restored \|\| reduced.matches/);
});
test('question direction is added without waiting or changing saved-answer ordering', () => {
  const app = read('app.js');
  assert.match(app, /draft\(\)\.index--; persist\(\); render\('previous'\)/);
  assert.match(app, /draft\(\)\.index\+\+; persist\(\); render\('next'\)/);
  assert.match(app, /direction === 'next' \|\| direction === 'previous' \? direction : 'page'/);
  assert.doesNotMatch(app, /animationend|transitionend/);
});
