import { pool } from '../db/pool.js';

export async function listDepartments(_req, res) {
  const [rows] = await pool.query(
    `SELECT id, name, description, created_at
     FROM department
     ORDER BY id ASC`,
  );
  res.json({ ok: true, list: rows });
}

export async function createDepartment(req, res) {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: '请填写科室名称' });
  const [r] = await pool.query('INSERT INTO department (name, description) VALUES (?, ?)', [
    String(name).trim(),
    description || null,
  ]);
  res.json({ ok: true, id: Number(r.insertId) });
}

export async function updateDepartment(req, res) {
  const id = Number(req.params.id);
  const { name, description } = req.body || {};
  await pool.query('UPDATE department SET name = ?, description = ? WHERE id = ?', [
    name,
    description || null,
    id,
  ]);
  res.json({ ok: true });
}

export async function deleteDepartment(req, res) {
  const id = Number(req.params.id);
  await pool.query('DELETE FROM department WHERE id = ?', [id]);
  res.json({ ok: true });
}
