import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, message: '未登录' });
  }
  try {
    const p = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: Number(p.id),
      username: p.username,
      role: p.role,
    };
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: '登录已失效' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, message: '未登录' });
    if (!roles.flat().includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: '权限不足' });
    }
    return next();
  };
}
