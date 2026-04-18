/**
 * Express 4 对 async 处理器未自动捕获 Promise 拒绝，统一包装后交给错误处理中间件。
 */
export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
