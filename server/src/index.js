import express from 'express';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { bootstrapDatabase } from './db/bootstrap.js';
import routes from './routes/index.js';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const app = express();
app.set('trust proxy', config.security.trustProxy);

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req._startAt = Date.now();
  res.setHeader('x-request-id', req.requestId);
  res.on('finish', () => {
    const ms = Date.now() - (req._startAt || Date.now());
    if (ms >= 1500) {
      console.log(`[slow-api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms rid=${req.requestId}`);
    }
  });
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.security.corsAllowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const normalized = `${parsed.protocol}//${parsed.host}`;
    if (config.security.corsAllowedOrigins.includes(normalized)) return true;
  } catch {
    // ignore invalid origin
  }
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    if (origin === 'http://localhost:11999' || origin === 'http://127.0.0.1:11999') return true;
    if (/^https?:\/\/[\w-]+\.trycloudflare\.com$/i.test(origin)) return true;
    if (/^https?:\/\/(10\.\d+\.\d+\.\d+|127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return true;
    if (/^https?:\/\/(192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin)) {
      return true;
    }
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: config.security.apiRateLimitWindowMs,
  max: config.security.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/public/health',
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      message: '请求过于频繁，请稍后重试',
      request_id: req.requestId,
    });
  },
});
app.use('/api', apiLimiter);

app.use('/api', routes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const requestId = _req?.requestId || '';
  const status = Number(err.status || err.statusCode || 500);
  const errType = String(err.type || '');
  const errCode = String(err.code || '');
  let message = err.message || '服务器错误';
  if (err.code === 'ECONNREFUSED') {
    message = '无法连接 MySQL，请确认服务已启动且 .env 中端口/账号正确';
  } else if (String(err.code || '').startsWith('ER_')) {
    message = `数据库错误（${err.code}）：${err.sqlMessage || err.message}。请确认已执行 database/schema.sql`;
  } else if (errType === 'entity.too.large' || status === 413) {
    message = '上传或提交内容过大，请压缩后重试';
  } else if (errCode === 'LIMIT_FILE_SIZE') {
    message = '单个文件超出大小限制，请压缩后重试';
  } else if (errCode === 'LIMIT_FILE_COUNT') {
    message = '上传文件数量超过限制';
  } else if (errCode === 'LIMIT_UNEXPECTED_FILE') {
    message = '上传字段不合法，请使用系统上传入口';
  }
  res.status(status || 500).json({ ok: false, message, request_id: requestId });
});

let shuttingDown = false;
let httpServer = null;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, closing services...`);
  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await pool.end();
    console.log('[shutdown] graceful shutdown completed');
    process.exit(0);
  } catch (e) {
    console.error('[shutdown] graceful shutdown failed:', e?.message || e);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

async function main() {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('MySQL 连接失败，请确认已创建库并执行 database/schema.sql，且 .env 配置正确。');
    console.error(e.message);
    process.exit(1);
  }
  try {
    await bootstrapDatabase();
  } catch (e) {
    console.error('数据库初始化失败（若首次运行请先导入 schema）：', e.message);
    process.exit(1);
  }
  httpServer = app.listen(config.port, () => {
    console.log(`Clinic AI API listening on http://localhost:${config.port}`);
  });
}

main();
