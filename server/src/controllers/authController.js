import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { clearLoginRateLimit, markLoginFailure, writeAuditLog } from '../middleware/security.js';

function clientIp(req) {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string' && x.length) return x.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

function num(v) {
  if (v == null) return null;
  if (typeof v === 'bigint') return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: '请输入账号密码' });
  }
  const [rows] = await pool.query(
    'SELECT id, username, password, name, role, phone, student_no FROM users WHERE username = ?',
    [username],
  );
  if (!rows.length) {
    const fail = markLoginFailure(req, username);
    await writeAuditLog(pool, req, {
      action: 'auth.login',
      status: 'fail',
      targetType: 'user',
      targetId: String(username),
      detail: 'username_not_found',
    });
    return res.status(401).json({
      ok: false,
      message: `账号或密码错误${fail?.remaining > 0 ? `（剩余 ${fail.remaining} 次）` : '，请稍后重试'}`,
    });
  }
  const row = rows[0];
  const hash = row.password;
  let okPass;
  try {
    okPass = Boolean(hash) && (await bcrypt.compare(password, String(hash)));
  } catch {
    okPass = false;
  }
  if (!okPass) {
    const fail = markLoginFailure(req, username);
    await writeAuditLog(pool, req, {
      action: 'auth.login',
      status: 'fail',
      targetType: 'user',
      targetId: String(username),
      detail: 'invalid_password',
    });
    return res.status(401).json({
      ok: false,
      message: `账号或密码错误${fail?.remaining > 0 ? `（剩余 ${fail.remaining} 次）` : '，请稍后重试'}`,
    });
  }
  const u = { ...row, id: num(row.id) };
  clearLoginRateLimit(req, u.username);
  const ip = clientIp(req);
  await pool.query('UPDATE users SET last_login_ip = ? WHERE id = ?', [ip, u.id]);
  await writeAuditLog(pool, req, {
    action: 'auth.login',
    status: 'ok',
    targetType: 'user',
    targetId: String(u.id),
    detail: `role=${u.role}`,
  });
  const token = jwt.sign(
    {
      id: u.id,
      username: u.username,
      role: u.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '24h' },
  );
  return res.json({
    ok: true,
    token,
    user: {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      phone: u.phone,
      student_no: u.student_no,
    },
  });
}

export async function register(req, res) {
  const { username, password, name, phone, student_no, gender } = req.body || {};
  if (!username || !password || !name) {
    return res.status(400).json({ ok: false, message: '请填写账号、密码、姓名' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: '密码至少需要 8 位' });
  }
  const [exist] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (exist.length) return res.status(400).json({ ok: false, message: '用户名已存在' });
  if (student_no) {
    const [studentExist] = await pool.query('SELECT id FROM users WHERE student_no = ? LIMIT 1', [student_no]);
    if (studentExist.length) return res.status(400).json({ ok: false, message: '学号已存在' });
  }
  const hash = await bcrypt.hash(password, 10);
  const ip = clientIp(req);
  const [r] = await pool.query(
    `INSERT INTO users (username, password, name, role, phone, student_no, gender, register_ip)
     VALUES (?, ?, ?, 'patient', ?, ?, ?, ?)`,
    [username, hash, name, phone || null, student_no || null, gender || 'unknown', ip],
  );
  await writeAuditLog(pool, req, {
    action: 'auth.register',
    status: 'ok',
    targetType: 'user',
    targetId: String(r.insertId),
    detail: `username=${username}`,
  });
  return res.json({ ok: true, id: r.insertId });
}

export async function forgotPassword(req, res) {
  const { username, name, phone, new_password, confirm_password } = req.body || {};
  const account = String(username || '').trim();
  const realName = String(name || '').trim();
  const inputPhone = String(phone || '').trim();
  const newPassword = String(new_password || '');
  const confirmPassword = String(confirm_password || '');

  if (!account || !realName || !newPassword || !confirmPassword) {
    return res.status(400).json({ ok: false, message: '请填写账号、姓名、新密码、确认密码' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ ok: false, message: '两次输入的新密码不一致' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, message: '新密码至少需要 8 位' });
  }

  const [rows] = await pool.query(
    'SELECT id, username, name, phone, role FROM users WHERE username = ? LIMIT 1',
    [account],
  );
  if (!rows.length) {
    await writeAuditLog(pool, req, {
      action: 'auth.forgot_password',
      status: 'fail',
      targetType: 'user',
      targetId: account,
      detail: 'username_not_found',
    });
    return res.status(400).json({ ok: false, message: '账号信息校验失败，请检查后重试' });
  }

  const user = rows[0];
  const dbName = String(user.name || '').trim();
  if (dbName !== realName) {
    await writeAuditLog(pool, req, {
      action: 'auth.forgot_password',
      status: 'fail',
      targetType: 'user',
      targetId: String(user.id),
      detail: 'name_mismatch',
    });
    return res.status(400).json({ ok: false, message: '账号信息校验失败，请检查后重试' });
  }

  const dbPhone = String(user.phone || '').trim();
  if (dbPhone) {
    if (!inputPhone || inputPhone !== dbPhone) {
      await writeAuditLog(pool, req, {
        action: 'auth.forgot_password',
        status: 'fail',
        targetType: 'user',
        targetId: String(user.id),
        detail: 'phone_mismatch',
      });
      return res.status(400).json({ ok: false, message: '手机号校验失败，请填写账号绑定手机号' });
    }
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, Number(user.id)]);
  clearLoginRateLimit(req, account);
  await writeAuditLog(pool, req, {
    action: 'auth.forgot_password',
    status: 'ok',
    targetType: 'user',
    targetId: String(user.id),
    detail: 'password_reset',
  });
  return res.json({ ok: true, message: '密码已重置，请使用新密码登录' });
}

export async function me(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.name, u.role, u.phone, u.student_no, u.gender,
            u.register_ip, u.last_login_ip
     FROM users u
     WHERE u.id = ?`,
    [req.user.id],
  );
  if (!rows.length) return res.status(404).json({ ok: false, message: '用户不存在' });
  return res.json({ ok: true, user: rows[0] });
}
