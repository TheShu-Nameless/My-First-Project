import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __securityTestUtils,
  clearLoginRateLimit,
  forgotPasswordRateLimit,
  loginRateLimit,
  markLoginFailure,
  registerRateLimit,
} from '../src/middleware/security.js';

function createReq({
  ip = '127.0.0.1',
  username = '',
  requestId = 'test-request-id',
} = {}) {
  return {
    headers: {},
    socket: { remoteAddress: ip },
    ip,
    body: {
      username,
    },
    requestId,
  };
}

function createRes() {
  const out = {
    statusCode: 200,
    headers: {},
    body: null,
  };
  return {
    setHeader(name, value) {
      out.headers[name] = value;
    },
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
    out,
  };
}

test('loginRateLimit reaches threshold then blocks', () => {
  __securityTestUtils.resetBuckets();
  const req = createReq({ ip: '10.0.0.2', username: 'demo' });

  for (let i = 0; i < 5; i += 1) {
    const res = createRes();
    let nextCalled = false;
    loginRateLimit(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    markLoginFailure(req, 'demo');
  }

  const blockedRes = createRes();
  let nextCalled = false;
  loginRateLimit(req, blockedRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blockedRes.out.statusCode, 429);
  assert.equal(blockedRes.out.body?.ok, false);
  assert.match(String(blockedRes.out.body?.message || ''), /登录尝试过于频繁/);
  clearLoginRateLimit(req, 'demo');
});

test('registerRateLimit blocks after burst requests', () => {
  __securityTestUtils.resetBuckets();
  const req = createReq({ ip: '10.0.0.3' });

  for (let i = 0; i < 8; i += 1) {
    const res = createRes();
    let nextCalled = false;
    registerRateLimit(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const blockedRes = createRes();
  let nextCalled = false;
  registerRateLimit(req, blockedRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blockedRes.out.statusCode, 429);
  assert.equal(blockedRes.out.body?.ok, false);
  assert.match(String(blockedRes.out.body?.message || ''), /注册请求过于频繁/);
});

test('forgotPasswordRateLimit blocks after threshold', () => {
  __securityTestUtils.resetBuckets();
  const req = createReq({ ip: '10.0.0.4', username: 'recover' });

  for (let i = 0; i < 6; i += 1) {
    const res = createRes();
    let nextCalled = false;
    forgotPasswordRateLimit(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const blockedRes = createRes();
  let nextCalled = false;
  forgotPasswordRateLimit(req, blockedRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blockedRes.out.statusCode, 429);
  assert.equal(blockedRes.out.body?.ok, false);
  assert.match(String(blockedRes.out.body?.message || ''), /重置密码尝试过于频繁/);
});
