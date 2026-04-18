import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const insecureDefaultSet = new Set(['123123', '@Szx312288', 'TheShu', 'dev-jwt-secret-tcm']);
const toNumberOr = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const parseCsv = (v) =>
  String(v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function assertSecureConfig(conf) {
  const errors = [];
  const warnings = [];

  if (!conf.jwtSecret || conf.jwtSecret.length < 16 || insecureDefaultSet.has(conf.jwtSecret)) {
    errors.push('JWT_SECRET 过弱，请设置长度 >= 16 的随机字符串');
  }

  if (!conf.admin.username || !conf.admin.password) {
    errors.push('请配置 ADMIN_USERNAME 和 ADMIN_PASSWORD');
  }

  if (insecureDefaultSet.has(conf.admin.username) || insecureDefaultSet.has(conf.admin.password)) {
    errors.push('管理员账号或密码仍为默认值，请修改后再启动');
  }

  if (!conf.mysql.password) {
    warnings.push('MYSQL_PASSWORD 为空，建议为数据库账户设置强密码');
  }

  if (insecureDefaultSet.has(conf.mysql.password)) {
    warnings.push('MYSQL_PASSWORD 看起来仍是默认值，建议尽快修改');
  }

  if (isProduction && errors.length) {
    const detail = errors.map((x) => `- ${x}`).join('\n');
    throw new Error(`安全配置校验失败：\n${detail}`);
  }

  if (!isProduction && errors.length) {
    const detail = errors.map((x) => `- ${x}`).join('\n');
    console.warn(`[config-warning] 发现高风险配置（开发环境允许继续运行）：\n${detail}`);
  }
  if (warnings.length) {
    const detail = warnings.map((x) => `- ${x}`).join('\n');
    console.warn(`[config-warning] ${detail}`);
  }
}

const tokenExpiresIn = String(process.env.JWT_EXPIRES_IN || '24h').trim();

export const config = {
  port: Number(process.env.PORT || 11888),
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-tcm',
  jwtExpiresIn: tokenExpiresIn || '24h',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 1111),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123123',
    database: process.env.MYSQL_DATABASE || 'tcm_ai_review',
    waitForConnections: true,
    connectionLimit: 20,
    enableKeepAlive: true,
  },
  ai: {
    baseUrl: (
      process.env.AI_API_BASE ||
      (process.env.AI_API_KEY ? 'https://api.deepseek.com/v1' : 'http://127.0.0.1:11434/v1')
    ).replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || (process.env.AI_API_KEY ? 'deepseek-chat' : 'qwen2.5:7b'),
    hostHeader: process.env.AI_HOST_HEADER || '',
  },
  tts: {
    apiUrl: process.env.TTS_API_URL || '',
    apiKey: process.env.TTS_API_KEY || '',
    model: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
    voiceMandarin: process.env.TTS_VOICE_MANDARIN || 'alloy',
    voiceXiangshan: process.env.TTS_VOICE_XIANGSHAN || 'alloy',
  },
  weights: {
    ai: Number(process.env.SCORE_WEIGHT_AI || 0.5),
    leader: Number(process.env.SCORE_WEIGHT_LEADER || 0.3),
    admin: Number(process.env.SCORE_WEIGHT_ADMIN || 0.2),
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'TheShu',
    password: process.env.ADMIN_PASSWORD || '@Szx312288',
  },
  upload: {
    maxFiles: Number(process.env.UPLOAD_MAX_FILES || 10),
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_FILE_MB || 20),
    allowedExtensions: String(
      process.env.UPLOAD_ALLOWED_EXT || '.pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md',
    )
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  },
  security: {
    trustProxy: toNumberOr(process.env.TRUST_PROXY, 1),
    corsAllowedOrigins: parseCsv(process.env.CORS_ALLOWED_ORIGINS),
    apiRateLimitWindowMs: toNumberOr(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    apiRateLimitMax: toNumberOr(process.env.API_RATE_LIMIT_MAX, 180),
    authRateLimit: {
      loginWindowMs: toNumberOr(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      loginMaxAttempts: toNumberOr(process.env.LOGIN_RATE_LIMIT_MAX, 5),
      registerWindowMs: toNumberOr(process.env.REGISTER_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
      registerMaxAttempts: toNumberOr(process.env.REGISTER_RATE_LIMIT_MAX, 8),
      forgotPasswordWindowMs: toNumberOr(process.env.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
      forgotPasswordMaxAttempts: toNumberOr(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX, 6),
    },
  },
  uploadDir: path.join(__dirname, '..', 'uploads'),
};

assertSecureConfig(config);
