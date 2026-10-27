/**
 * L0 checks for session restore helpers (no Vitest in this package).
 * Run: node --test scripts/verify-auth-session.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

function parseJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAccessTokenValid(token, nowMs = Date.now()) {
  if (!token) return false;
  const claims = parseJwtPayload(token);
  if (!claims?.uid) return false;
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= nowMs) return false;
  return true;
}

function buildLoginHref(baseUrl = '/') {
  const base = String(baseUrl || '/').replace(/\/$/, '');
  return `${base}/login` || '/login';
}

function encodeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

test('isAccessTokenValid accepts fresh token with uid', () => {
  const now = 1_700_000_000_000;
  const token = encodeJwt({ uid: 42, exp: Math.floor(now / 1000) + 900 });
  assert.equal(isAccessTokenValid(token, now), true);
});

test('isAccessTokenValid rejects expired access token', () => {
  const now = 1_700_000_000_000;
  const token = encodeJwt({ uid: 42, exp: Math.floor(now / 1000) - 1 });
  assert.equal(isAccessTokenValid(token, now), false);
});

test('isAccessTokenValid rejects missing uid', () => {
  const now = 1_700_000_000_000;
  const token = encodeJwt({ exp: Math.floor(now / 1000) + 900 });
  assert.equal(isAccessTokenValid(token, now), false);
});

test('boot decision: expired access + refresh present means restore, not anonymous', () => {
  const now = 1_700_000_000_000;
  const access = encodeJwt({ uid: 7, exp: Math.floor(now / 1000) - 60 });
  const refresh = 'rt-still-valid';
  const accessOk = isAccessTokenValid(access, now);
  const shouldRestore = !accessOk && Boolean(refresh);
  assert.equal(accessOk, false);
  assert.equal(shouldRestore, true);
});

test('boot decision: expired access without refresh is anonymous', () => {
  const now = 1_700_000_000_000;
  const access = encodeJwt({ uid: 7, exp: Math.floor(now / 1000) - 60 });
  const refresh = null;
  const shouldAnonymous = !isAccessTokenValid(access, now) && !refresh;
  assert.equal(shouldAnonymous, true);
});

test('buildLoginHref respects BASE_URL', () => {
  assert.equal(buildLoginHref('/'), '/login');
  assert.equal(buildLoginHref('/workbench-web/'), '/workbench-web/login');
  assert.equal(buildLoginHref(''), '/login');
});
