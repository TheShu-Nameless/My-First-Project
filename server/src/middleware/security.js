import { config } from '../config.js';

const loginBuckets = new Map();
const WINDOW_MS = Number(config.security?.authRateLimit?.loginWindowMs || 60 * 1000);
const MAX_ATTEMPTS = Number(config.security?.authRateLimit?.loginMaxAttempts || 5);
const resetPwdBuckets = new Map();
const RESET_WINDOW_MS = Number(config.security?.authRateLimit?.forgotPasswordWindowMs || 10 * 60 * 1000);
const RESET_MAX_ATTEMPTS = Number(config.security?.authRateLimit?.forgotPasswordMaxAttempts || 6);
const registerBuckets = new Map();
const REGISTER_WINDOW_MS = Number(config.security?.authRateLimit?.registerWindowMs || 10 * 60 * 1000);
const REGISTER_MAX_ATTEMPTS = Number(config.security?.authRateLimit?.registerMaxAttempts || 8);

function now() {
  return Date.now();
}

function readClientIp(req) {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string' && x.length) return x.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function cleanupExpired() {
  const t = now();
  for (const [k, v] of loginBuckets.entries()) {
    if (t - v.firstSeen > WINDOW_MS) loginBuckets.delete(k);
  }
}

function cleanupExpiredBuckets(bucketMap, maxWindowMs) {
  const t = now();
  for (const [k, v] of bucketMap.entries()) {
    if (t - v.firstSeen > maxWindowMs) bucketMap.delete(k);
  }
}

export function loginRateLimit(req, res, next) {
  cleanupExpired();
  const ip = readClientIp(req);
  const username = String(req.body?.username || '').trim().toLowerCase();
  const key = `${ip}::${username || '-'}`;
  const t = now();
  const item = loginBuckets.get(key);
  if (item && t - item.firstSeen <= WINDOW_MS && item.count >= MAX_ATTEMPTS) {
    const waitSeconds = Math.max(1, Math.ceil((WINDOW_MS - (t - item.firstSeen)) / 1000));
    res.setHeader('Retry-After', String(waitSeconds));
    return res.status(429).json({
      ok: false,
      message: `登录尝试过于频繁，请 ${waitSeconds} 秒后重试`,
      request_id: req.requestId,
    });
  }
  return next();
}

export function forgotPasswordRateLimit(req, res, next) {
  cleanupExpiredBuckets(resetPwdBuckets, RESET_WINDOW_MS);
  const ip = readClientIp(req);
  const username = String(req.body?.username || '').trim().toLowerCase();
  const key = `${ip}::${username || '-'}`;
  const t = now();
  const item = resetPwdBuckets.get(key);
  if (item && t - item.firstSeen <= RESET_WINDOW_MS && item.count >= RESET_MAX_ATTEMPTS) {
    const waitSeconds = Math.max(1, Math.ceil((RESET_WINDOW_MS - (t - item.firstSeen)) / 1000));
    res.setHeader('Retry-After', String(waitSeconds));
    return res.status(429).json({
      ok: false,
      message: `重置密码尝试过于频繁，请 ${waitSeconds} 秒后重试`,
      request_id: req.requestId,
    });
  }
  const nextItem = item || { count: 0, firstSeen: t };
  if (t - nextItem.firstSeen > RESET_WINDOW_MS) {
    nextItem.count = 0;
    nextItem.firstSeen = t;
  }
  nextItem.count += 1;
  resetPwdBuckets.set(key, nextItem);
  return next();
}

export function registerRateLimit(req, res, next) {
  cleanupExpiredBuckets(registerBuckets, REGISTER_WINDOW_MS);
  const ip = readClientIp(req);
  const key = ip;
  const t = now();
  const item = registerBuckets.get(key);
  if (item && t - item.firstSeen <= REGISTER_WINDOW_MS && item.count >= REGISTER_MAX_ATTEMPTS) {
    const waitSeconds = Math.max(1, Math.ceil((REGISTER_WINDOW_MS - (t - item.firstSeen)) / 1000));
    res.setHeader('Retry-After', String(waitSeconds));
    return res.status(429).json({
      ok: false,
      message: `注册请求过于频繁，请 ${waitSeconds} 秒后重试`,
      request_id: req.requestId,
    });
  }
  const nextItem = item || { count: 0, firstSeen: t };
  if (t - nextItem.firstSeen > REGISTER_WINDOW_MS) {
    nextItem.count = 0;
    nextItem.firstSeen = t;
  }
  nextItem.count += 1;
  registerBuckets.set(key, nextItem);
  return next();
}

export const __securityTestUtils = {
  resetBuckets() {
    loginBuckets.clear();
    resetPwdBuckets.clear();
    registerBuckets.clear();
  },
};

export function clearLoginRateLimit(req, username = '') {
  const ip = readClientIp(req);
  const normalized = String(username || '').trim().toLowerCase();
  if (normalized) loginBuckets.delete(`${ip}::${normalized}`);
  loginBuckets.delete(`${ip}::-`);
}

export function markLoginFailure(req, username = '') {
  cleanupExpired();
  const ip = readClientIp(req);
  const normalized = String(username || '').trim().toLowerCase();
  const key = `${ip}::${normalized || '-'}`;
  const t = now();
  const item = loginBuckets.get(key) || { count: 0, firstSeen: t };
  if (t - item.firstSeen > WINDOW_MS) {
    item.count = 0;
    item.firstSeen = t;
  }
  item.count += 1;
  loginBuckets.set(key, item);
  const remaining = Math.max(0, MAX_ATTEMPTS - item.count);
  const waitSeconds = Math.max(1, Math.ceil((WINDOW_MS - (t - item.firstSeen)) / 1000));
  return {
    count: item.count,
    remaining,
    waitSeconds,
    maxAttempts: MAX_ATTEMPTS,
  };
}

export async function writeAuditLog(pool, req, payload) {
  try {
    const {
      action = 'unknown',
      targetType = null,
      targetId = null,
      status = 'ok',
      detail = '',
    } = payload || {};
    const uid = Number(req.user?.id);
    const actorUserId = Number.isFinite(uid) ? uid : null;
    const ip = readClientIp(req);
    await pool.query(
      `INSERT INTO audit_log
      (actor_user_id, action, target_type, target_id, status, detail, ip, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorUserId,
        String(action).slice(0, 80),
        targetType ? String(targetType).slice(0, 60) : null,
        targetId != null ? String(targetId).slice(0, 80) : null,
        String(status).slice(0, 20),
        String(detail || '').slice(0, 1000),
        String(ip || '').slice(0, 64),
        String(req.requestId || '').slice(0, 64),
      ],
    );
  } catch {
    // 审计日志失败不阻断主流程
  }
}
