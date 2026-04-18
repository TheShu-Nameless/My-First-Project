import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import router from '@/router';

const http = axios.create({
  baseURL: '/api',
  timeout: 25000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err.config || {};
    const method = String(cfg.method || 'get').toLowerCase();
    const canRetry = method === 'get' && !cfg.__retried;
    const status = err.response?.status;
    const shouldRetry = canRetry && (!status || status >= 500 || err.code === 'ECONNABORTED');
    if (shouldRetry) {
      cfg.__retried = true;
      return http(cfg);
    }

    const rid = err.response?.data?.request_id;
    const statusTextMap = {
      400: '请求参数有误',
      401: '登录已失效，请重新登录',
      403: '暂无权限执行该操作',
      404: '资源不存在或已删除',
      409: '数据冲突，请刷新后重试',
      413: '提交内容过大，请压缩后重试',
      429: '操作过于频繁，请稍后重试',
      500: '服务器开小差了，请稍后重试',
    };
    let msg = err.response?.data?.message || err.message || '请求失败';
    if (!err.response?.data?.message && statusTextMap[status]) {
      msg = statusTextMap[status];
    }
    if (err.code === 'ECONNABORTED') msg = '请求超时，请检查网络后重试';
    if (!err.response && err.message?.includes('Network Error')) msg = '网络异常，暂时无法连接服务器';
    if (rid) msg = `${msg}（请求号 ${rid}）`;

    if (err.response?.status === 401) {
      const auth = useAuthStore();
      auth.clear();
      if (router.currentRoute.value.path !== '/login') {
        router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
      }
    }
    if (!cfg.skipErrorToast) {
      ElMessage.error(msg);
    }
    return Promise.reject(err);
  },
);

export default http;
