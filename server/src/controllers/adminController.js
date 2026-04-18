import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';

const MANAGED_ROLES = ['staff', 'patient'];

export async function listUsers(_req, res) {
  const [rows] = await pool.query(
    `SELECT id, username, name, role, phone, student_no, gender, created_at
     FROM users
     ORDER BY id DESC`,
  );
  res.json({ ok: true, list: rows });
}

export async function createUser(req, res) {
  const { username, password, name, role, phone, student_no, gender } = req.body || {};
  if (!username || !password || !name || !MANAGED_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, message: '请填写完整用户信息（仅可创建 staff/patient）' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: '密码至少需要 8 位' });
  }
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    `INSERT INTO users (username, password, name, role, phone, student_no, gender)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, hash, name, role, phone || null, student_no || null, gender || 'unknown'],
  );
  await writeAuditLog(pool, req, {
    action: 'admin.create_user',
    status: 'ok',
    targetType: 'user',
    targetId: String(r.insertId),
    detail: `username=${username},role=${role}`,
  });
  res.json({ ok: true, id: Number(r.insertId) });
}

export async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { name, phone, gender } = req.body || {};
  await pool.query('UPDATE users SET name = ?, phone = ?, gender = ? WHERE id = ?', [
    name,
    phone || null,
    gender || 'unknown',
    id,
  ]);
  await writeAuditLog(pool, req, {
    action: 'admin.update_user',
    status: 'ok',
    targetType: 'user',
    targetId: String(id),
    detail: `name=${name || ''}`,
  });
  res.json({ ok: true });
}

export async function listAnnouncements(_req, res) {
  const [rows] = await pool.query(
    `SELECT id, title, content, is_active, created_at
     FROM announcement
     ORDER BY id DESC`,
  );
  res.json({ ok: true, list: rows });
}

export async function createAnnouncement(req, res) {
  const { title, content, is_active } = req.body || {};
  if (!title || !content) return res.status(400).json({ ok: false, message: '请填写公告标题和内容' });
  const [r] = await pool.query(
    'INSERT INTO announcement (title, content, is_active, created_by) VALUES (?, ?, ?, ?)',
    [title, content, is_active ? 1 : 0, req.user.id],
  );
  await writeAuditLog(pool, req, {
    action: 'admin.create_announcement',
    status: 'ok',
    targetType: 'announcement',
    targetId: String(r.insertId),
    detail: title,
  });
  res.json({ ok: true, id: Number(r.insertId) });
}
