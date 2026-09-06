import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificationStatus } from '../../color-web/app/verification-status.mjs';
test('unknown, optional, required and verified states are distinct', () => {
  assert.match(verificationStatus({ name: 'Old response' }), /正在確認驗證狀態/);
  assert.match(verificationStatus({ emailVerifiedAt: null, emailVerificationRequired: false }), /既有會員可自由選擇/);
  assert.match(verificationStatus({ emailVerifiedAt: null, emailVerificationRequired: true }), /完成信箱驗證後即可登入/);
  const verified = verificationStatus({ emailVerifiedAt: '2026-09-06T06:00:00Z' });
  assert.match(verified, /✓ 已驗證/);
  assert.match(verified, /驗證完成/);
  assert.doesNotMatch(verified, /尚未驗證|既有會員/);
});
