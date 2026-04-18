import { pool } from '../db/pool.js';

export async function assertProjectVisible(user, projectId) {
  const [rows] = await pool.query(
    `SELECT p.*, g.leader_id AS group_leader_id, g.name AS group_name
     FROM projects p
     JOIN \`groups\` g ON g.id = p.group_id
     WHERE p.id = ?`,
    [projectId],
  );
  if (!rows.length) return { ok: false, status: 404, message: '项目不存在', project: null };
  const p = rows[0];
  if (user.role === 'admin') return { ok: true, project: p };
  if (user.role === 'member' && p.user_id === user.id) return { ok: true, project: p };
  if (user.role === 'leader' && user.group_id && p.group_id === user.group_id) {
    if (Number(p.group_leader_id) === Number(user.id)) return { ok: true, project: p };
  }
  return { ok: false, status: 403, message: '无权访问该项目', project: null };
}

export function projectListWhereClause(user) {
  if (user.role === 'admin') return { sql: '1=1', params: [] };
  if (user.role === 'leader' && user.group_id) {
    return { sql: 'p.group_id = ?', params: [user.group_id] };
  }
  return { sql: 'p.user_id = ?', params: [user.id] };
}
