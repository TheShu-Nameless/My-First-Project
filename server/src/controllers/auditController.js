import { pool } from '../db/pool.js';

export async function listAuditLogs(req, res) {
  const action = String(req.query.action || '').trim();
  const status = String(req.query.status || '').trim();
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.status, a.detail, a.ip, a.request_id, a.created_at,
            u.username AS actor_username, u.name AS actor_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE (? = '' OR a.action = ?)
       AND (? = '' OR a.status = ?)
     ORDER BY a.id DESC
     LIMIT 200`,
    [action, action, status, status],
  );
  res.json({ ok: true, list: rows });
}
