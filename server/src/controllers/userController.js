import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

export async function listUsers(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.role, u.group_id, u.register_ip, u.last_login_ip, u.created_at,
            g.name AS group_name
     FROM users u
     LEFT JOIN \`groups\` g ON g.id = u.group_id
     ORDER BY u.id ASC`,
  );
  res.json({ ok: true, list: rows });
}

export async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { display_name, role, group_id, password, leader_of_group_id } = req.body || {};
  const [cur] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
  if (!cur.length) return res.status(404).json({ ok: false, message: '用户不存在' });
  if (cur[0].role === 'admin' && role && role !== 'admin' && id === req.user.id) {
    return res.status(400).json({ ok: false, message: '不能取消自己的管理员角色' });
  }
  const fields = [];
  const params = [];
  if (display_name != null) {
    fields.push('display_name = ?');
    params.push(display_name);
  }
  if (role != null) {
    fields.push('role = ?');
    params.push(role);
  }
  if (group_id !== undefined) {
    fields.push('group_id = ?');
    params.push(group_id || null);
  }
  if (password) {
    fields.push('password = ?');
    params.push(await bcrypt.hash(password, 10));
  }
  if (!fields.length) return res.json({ ok: true });
  params.push(id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

  if (leader_of_group_id != null) {
    const gid = Number(leader_of_group_id);
    if (gid) {
      await pool.query('UPDATE `groups` SET leader_id = ? WHERE id = ?', [id, gid]);
      await pool.query("UPDATE users SET role = 'leader', group_id = ? WHERE id = ?", [gid, id]);
    }
  }
  res.json({ ok: true });
}

export async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ ok: false, message: '不能删除自己' });
  const [cur] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
  if (!cur.length) return res.status(404).json({ ok: false, message: '用户不存在' });
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true });
}
