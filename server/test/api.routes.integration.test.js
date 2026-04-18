import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import routes from '../src/routes/index.js';
import { pool } from '../src/db/pool.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'integration-test-request-id';
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

test('GET /api/public/upload-policy returns upload policy', async () => {
  const app = createApp();
  const res = await request(app).get('/api/public/upload-policy');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(typeof res.body?.policy?.max_files, 'number');
  assert.equal(typeof res.body?.policy?.max_file_size_mb, 'number');
  assert.equal(Array.isArray(res.body?.policy?.allowed_extensions), true);
});

test('GET /api/auth/me without token returns 401', async () => {
  const app = createApp();
  const res = await request(app).get('/api/auth/me');

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.message || ''), /未登录/);
});

test('GET /api/public/health returns db status using pool query', async (t) => {
  const app = createApp();
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql) => {
    const text = String(sql || '');
    if (text.includes('SELECT 1')) return [[{ '1': 1 }], []];
    if (text.includes('COUNT(*) AS c FROM department')) return [[{ c: 11 }], []];
    return [[], []];
  };
  t.after(() => {
    pool.query = originalQuery;
  });

  const res = await request(app).get('/api/public/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.mysql, true);
  assert.equal(res.body?.departmentCount, 11);
});
