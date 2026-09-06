import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentContent } from '../../color-web/app/client.mjs';

test('expired content and imported historical news are hidden, timeless resources remain', () => {
  const now = Date.parse('2026-09-06T08:00:00Z');
  assert.equal(isCurrentContent({ expiresAt: '2026-09-06T07:59:59Z' }, now), false);
  assert.equal(isCurrentContent({ expiresAt: '2026-09-06T08:00:00Z' }, now), false);
  assert.equal(isCurrentContent({ expiresAt: '2026-09-06T08:00:01Z' }, now), true);
  assert.equal(isCurrentContent({ expiresAt: 'invalid' }, now), false);
  assert.equal(isCurrentContent({ type: 'common', sourcePublishedAt: '2020-01-01' }, now), true);
  assert.equal(isCurrentContent({ expiresAt: null }, now), true);
  for (let n = 1; n <= 6; n++) assert.equal(isCurrentContent({ type: 'news', imageUrl: `/assets/images/act${n}.jpg` }, now), false);
  assert.equal(isCurrentContent({ type: 'news', imageUrl: '/assets/images/act7.jpg' }, now), true);
});
