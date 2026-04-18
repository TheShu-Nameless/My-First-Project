/**
 * 模拟浏览器：经 Vite(11999) 代理 POST /api/auth/login，
 * 使用与前端相同的 axios，确认请求体包含 username、password（等同 F12 Request Payload）。
 * 运行前请保持：npm run dev（11999）+ 后端（11888）。
 */
import axios from 'axios';

const baseURL = process.env.VERIFY_BASE || 'http://127.0.0.1:11999';
const instance = axios.create({ baseURL, timeout: 15000 });

const body = { username: 'admin', password: 'yagoo@110' };

instance.interceptors.request.use((config) => {
  const data = config.data;
  const serialized =
    typeof data === 'string' ? data : data != null ? JSON.stringify(data) : '';
  console.log('--- 等同于 F12 → Network → Payload ---');
  console.log('URL:', (config.baseURL || '') + (config.url || ''));
  console.log('Content-Type:', config.headers['Content-Type'] || config.headers['content-type']);
  console.log('Request Payload (JSON 字符串):', serialized);
  const parsed = typeof data === 'object' && data ? data : JSON.parse(serialized || '{}');
  const hasUser = Object.prototype.hasOwnProperty.call(parsed, 'username');
  const hasPass = Object.prototype.hasOwnProperty.call(parsed, 'password');
  console.log('包含字段 username:', hasUser, '值:', parsed.username);
  console.log('包含字段 password:', hasPass, '长度:', String(parsed.password || '').length);
  if (!hasUser || !hasPass) process.exitCode = 1;
  return config;
});

try {
  const { data, status } = await instance.post('/api/auth/login', body);
  console.log('--- 响应 ---');
  console.log('HTTP', status, 'ok:', data?.ok, 'role:', data?.user?.role);
} catch (e) {
  console.error('请求失败:', e.response?.data || e.message);
  process.exit(1);
}
