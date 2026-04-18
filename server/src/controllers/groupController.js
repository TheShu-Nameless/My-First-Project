import { pool } from '../db/pool.js';

export async function listGroups(_req, res) {
  const [rows] = await pool.query(
    `SELECT g.*, u.username AS leader_username, u.display_name AS leader_display
     FROM \`groups\` g
     LEFT JOIN users u ON u.id = g.leader_id
     ORDER BY g.id ASC`,
  );
  res.json({ ok: true, list: rows });
}

export async function createGroup(req, res) {
  const { name, topic, leader_id } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: '请填写分组名称' });
  const [r] = await pool.query(
    'INSERT INTO `groups` (name, topic, leader_id) VALUES (?, ?, ?)',
    [name, topic || null, leader_id || null],
  );
  res.json({ ok: true, id: r.insertId });
}

export async function updateGroup(req, res) {
  const id = Number(req.params.id);
  const { name, topic, leader_id } = req.body || {};
  const fields = [];
  const params = [];
  if (name != null) {
    fields.push('name = ?');
    params.push(name);
  }
  if (topic !== undefined) {
    fields.push('topic = ?');
    params.push(topic);
  }
  if (leader_id !== undefined) {
    fields.push('leader_id = ?');
    params.push(leader_id || null);
    if (leader_id) {
      await pool.query("UPDATE users SET role = 'leader', group_id = ? WHERE id = ?", [id, leader_id]);
    }
  }
  if (!fields.length) return res.json({ ok: true });
  params.push(id);
  await pool.query(`UPDATE \`groups\` SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
}

export async function deleteGroup(req, res) {
  const id = Number(req.params.id);
  const [users] = await pool.query('SELECT id FROM users WHERE group_id = ? LIMIT 1', [id]);
  if (users.length) {
    return res.status(400).json({ ok: false, message: '分组下仍有成员，请先调整用户分组' });
  }
  await pool.query('DELETE FROM `groups` WHERE id = ?', [id]);
  res.json({ ok: true });
}

/** 批量将用户划入某组（管理员） */
export async function assignMembers(req, res) {
  const groupId = Number(req.params.id);
  const { user_ids } = req.body || {};
  if (!Array.isArray(user_ids)) return res.status(400).json({ ok: false, message: 'user_ids 须为数组' });
  const [g] = await pool.query('SELECT id FROM `groups` WHERE id = ?', [groupId]);
  if (!g.length) return res.status(404).json({ ok: false, message: '分组不存在' });
  for (const uid of user_ids) {
    await pool.query('UPDATE users SET group_id = ? WHERE id = ?', [groupId, Number(uid)]);
  }
  res.json({ ok: true });
}
