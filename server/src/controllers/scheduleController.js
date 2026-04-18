import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';

export async function listSchedules(req, res) {
  const date = req.query.date ? String(req.query.date) : null;
  const departmentId = Number(req.query.department_id || 0);
  const doctorId = Number(req.query.doctor_id || 0);

  const [rows] = await pool.query(
    `SELECT s.id, s.schedule_date, s.start_time, s.end_time, s.total_quota, s.used_quota, s.status,
            d.id AS doctor_id, d.title, d.specialty,
            u.name AS doctor_name,
            dp.id AS department_id, dp.name AS department_name
     FROM schedule s
     JOIN doctor d ON d.id = s.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN department dp ON dp.id = d.department_id
     WHERE (? IS NULL OR s.schedule_date = ?)
       AND (? = 0 OR d.department_id = ?)
       AND (? = 0 OR d.id = ?)
     ORDER BY s.schedule_date ASC, s.start_time ASC`,
    [date, date, departmentId, departmentId, doctorId, doctorId],
  );

  res.json({ ok: true, list: rows });
}

export async function createSchedule(req, res) {
  const { doctor_id, schedule_date, start_time, end_time, total_quota, status } = req.body || {};
  if (!doctor_id || !schedule_date || !start_time || !end_time) {
    return res.status(400).json({ ok: false, message: '请填写医生、日期和时间段' });
  }
  const [r] = await pool.query(
    `INSERT INTO schedule (doctor_id, schedule_date, start_time, end_time, total_quota, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(doctor_id),
      schedule_date,
      start_time,
      end_time,
      Number(total_quota || 20),
      status || 'published',
      req.user.id,
    ],
  );
  await writeAuditLog(pool, req, {
    action: 'schedule.create',
    status: 'ok',
    targetType: 'schedule',
    targetId: String(r.insertId),
    detail: `${schedule_date} ${start_time}-${end_time}`,
  });
  res.json({ ok: true, id: Number(r.insertId) });
}

export async function updateSchedule(req, res) {
  const id = Number(req.params.id);
  const { schedule_date, start_time, end_time, total_quota, status } = req.body || {};
  await pool.query(
    `UPDATE schedule
     SET schedule_date = ?, start_time = ?, end_time = ?, total_quota = ?, status = ?
     WHERE id = ?`,
    [schedule_date, start_time, end_time, Number(total_quota || 20), status || 'published', id],
  );
  await writeAuditLog(pool, req, {
    action: 'schedule.update',
    status: 'ok',
    targetType: 'schedule',
    targetId: String(id),
    detail: `${schedule_date} ${start_time}-${end_time}`,
  });
  res.json({ ok: true });
}

export async function deleteSchedule(req, res) {
  const id = Number(req.params.id);
  await pool.query('DELETE FROM schedule WHERE id = ?', [id]);
  await writeAuditLog(pool, req, {
    action: 'schedule.delete',
    status: 'ok',
    targetType: 'schedule',
    targetId: String(id),
    detail: '',
  });
  res.json({ ok: true });
}
