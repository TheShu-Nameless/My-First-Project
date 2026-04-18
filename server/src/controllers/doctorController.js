import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

export async function listDoctors(req, res) {
  const departmentId = Number(req.query.department_id || 0);
  const sql = `SELECT d.id, d.department_id, d.title, d.specialty, d.intro, d.is_active,
                      u.id AS user_id, u.name, u.phone,
                      dp.name AS department_name
               FROM doctor d
               JOIN users u ON u.id = d.user_id
               JOIN department dp ON dp.id = d.department_id
               WHERE (? = 0 OR d.department_id = ?)
               ORDER BY d.id ASC`;
  const [rows] = await pool.query(sql, [departmentId, departmentId]);
  res.json({ ok: true, list: rows });
}

export async function createDoctor(req, res) {
  const { username, password, name, phone, department_id, title, specialty, intro } = req.body || {};
  if (!username || !password || !name || !department_id) {
    return res.status(400).json({ ok: false, message: '请填写医生账号、密码、姓名和科室' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [exists] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (exists.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '账号已存在' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users (username, password, name, role, phone)
       VALUES (?, ?, ?, 'doctor', ?)`,
      [username, hash, name, phone || null],
    );
    const userId = Number(userResult.insertId);
    const [doctorResult] = await conn.query(
      `INSERT INTO doctor (user_id, department_id, title, specialty, intro)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, Number(department_id), title || null, specialty || null, intro || null],
    );
    await conn.commit();
    return res.json({ ok: true, id: Number(doctorResult.insertId) });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateDoctor(req, res) {
  const id = Number(req.params.id);
  const { department_id, title, specialty, intro, is_active, phone, name } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT user_id FROM doctor WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '医生不存在' });
    }
    const userId = Number(rows[0].user_id);
    await conn.query(
      `UPDATE doctor
       SET department_id = ?, title = ?, specialty = ?, intro = ?, is_active = ?
       WHERE id = ?`,
      [department_id, title || null, specialty || null, intro || null, is_active ? 1 : 0, id],
    );
    await conn.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, userId]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
