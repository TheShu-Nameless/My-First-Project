import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import routes from '../src/routes/index.js';
import { pool } from '../src/db/pool.js';
import { __securityTestUtils } from '../src/middleware/security.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'auth-integration-test-request-id';
    next();
  });
  app.use('/api', routes);
  app.use((err, _req, res, _next) => {
    res.status(Number(err?.status || 500)).json({
      ok: false,
      message: String(err?.message || 'error'),
    });
  });
  return app;
}

test('POST /api/auth/login with missing credentials returns 400', async () => {
  __securityTestUtils.resetBuckets();
  const app = createApp();
  const res = await request(app).post('/api/auth/login').send({ username: '', password: '' });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.message || ''), /请输入账号密码/);
});

test('POST /api/auth/login unknown user eventually gets rate limited', async (t) => {
  __securityTestUtils.resetBuckets();
  const app = createApp();
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql) => {
    const text = String(sql || '');
    if (text.includes('FROM users WHERE username = ?')) return [[], []];
    if (text.includes('INSERT INTO audit_log')) return [{ insertId: 1 }, []];
    return [[], []];
  };
  t.after(() => {
    pool.query = originalQuery;
    __securityTestUtils.resetBuckets();
  });

  for (let i = 0; i < 5; i += 1) {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
    assert.equal(res.statusCode, 401);
  }

  const blocked = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body?.ok, false);
  assert.match(String(blocked.body?.message || ''), /登录尝试过于频繁/);
});

test('POST /api/auth/register duplicate username returns 400', async (t) => {
  __securityTestUtils.resetBuckets();
  const app = createApp();
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql) => {
    const text = String(sql || '');
    if (text.includes('SELECT id FROM users WHERE username = ?')) return [[{ id: 88 }], []];
    return [[], []];
  };
  t.after(() => {
    pool.query = originalQuery;
  });

  const res = await request(app).post('/api/auth/register').send({
    username: 'existing_user',
    password: 'password123',
    name: 'demo',
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.message || ''), /用户名已存在/);
});

test('POST /api/auth/register validation failures eventually get rate limited', async () => {
  __securityTestUtils.resetBuckets();
  const app = createApp();

  for (let i = 0; i < 8; i += 1) {
    const res = await request(app).post('/api/auth/register').send({});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.ok, false);
  }

  const blocked = await request(app).post('/api/auth/register').send({});
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body?.ok, false);
  assert.match(String(blocked.body?.message || ''), /注册请求过于频繁/);
});

test('POST /api/auth/forgot-password validation failures eventually get rate limited', async () => {
  __securityTestUtils.resetBuckets();
  const app = createApp();

  for (let i = 0; i < 6; i += 1) {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.ok, false);
  }

  const blocked = await request(app).post('/api/auth/forgot-password').send({});
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body?.ok, false);
  assert.match(String(blocked.body?.message || ''), /重置密码尝试过于频繁/);
});
