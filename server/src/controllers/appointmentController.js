import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';

function canManage(role) {
  return role === 'admin' || role === 'staff';
}

export async function listAppointments(req, res) {
  const scopeUserId = canManage(req.user.role) ? Number(req.query.user_id || 0) : req.user.id;
  const status = req.query.status ? String(req.query.status) : '';

  const [rows] = await pool.query(
    `SELECT a.id, a.user_id, a.schedule_id, a.symptom, a.status, a.cancel_reason, a.created_at,
            p.name AS patient_name, p.phone AS patient_phone,
            s.schedule_date, s.start_time, s.end_time,
            d.id AS doctor_id, u.name AS doctor_name,
            dp.name AS department_name
     FROM appointment a
     JOIN users p ON p.id = a.user_id
     JOIN schedule s ON s.id = a.schedule_id
     JOIN doctor d ON d.id = s.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN department dp ON dp.id = d.department_id
     WHERE (? = 0 OR a.user_id = ?)
       AND (? = '' OR a.status = ?)
     ORDER BY a.created_at DESC`,
    [scopeUserId, scopeUserId, status, status],
  );
  res.json({ ok: true, list: rows });
}

export async function createAppointment(req, res) {
  const { schedule_id, symptom } = req.body || {};
  if (!schedule_id) return res.status(400).json({ ok: false, message: '请选择排班时段' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [scheduleRows] = await conn.query(
      `SELECT s.id, s.doctor_id, s.schedule_date, s.start_time, s.end_time, s.total_quota, s.used_quota, s.status
       FROM schedule s
       WHERE s.id = ?
       FOR UPDATE`,
      [Number(schedule_id)],
    );
    if (!scheduleRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '排班不存在' });
    }
    const schedule = scheduleRows[0];
    if (schedule.status !== 'published') {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '该排班未开放预约' });
    }
    if (Number(schedule.used_quota) >= Number(schedule.total_quota)) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '号源已满，请选择其他时段' });
    }

    const [dupRows] = await conn.query(
      `SELECT id FROM appointment
       WHERE user_id = ? AND schedule_id = ? AND status IN ('booked', 'checked_in')
       LIMIT 1`,
      [req.user.id, Number(schedule_id)],
    );
    if (dupRows.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '该时段已预约，无需重复提交' });
    }

    const [conflictRows] = await conn.query(
      `SELECT a.id
       FROM appointment a
       JOIN schedule s ON s.id = a.schedule_id
       WHERE a.user_id = ?
         AND a.status IN ('booked', 'checked_in')
         AND s.schedule_date = ?
         AND NOT (s.end_time <= ? OR s.start_time >= ?)
       LIMIT 1`,
      [req.user.id, schedule.schedule_date, schedule.start_time, schedule.end_time],
    );
    if (conflictRows.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '该时间段已存在其他预约，请避免冲突' });
    }

    const [r] = await conn.query(
      'INSERT INTO appointment (user_id, schedule_id, symptom, status) VALUES (?, ?, ?, "booked")',
      [req.user.id, Number(schedule_id), symptom || null],
    );
    await conn.query('UPDATE schedule SET used_quota = used_quota + 1 WHERE id = ?', [Number(schedule_id)]);
    await conn.commit();
    await writeAuditLog(pool, req, {
      action: 'appointment.create',
      status: 'ok',
      targetType: 'appointment',
      targetId: String(r.insertId),
      detail: `schedule=${schedule_id}`,
    });
    return res.json({ ok: true, id: Number(r.insertId) });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function cancelAppointment(req, res) {
  const id = Number(req.params.id);
  const { reason } = req.body || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, user_id, schedule_id, status
       FROM appointment
       WHERE id = ?
       FOR UPDATE`,
      [id],
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '预约不存在' });
    }
    const row = rows[0];
    if (!canManage(req.user.role) && Number(row.user_id) !== req.user.id) {
      await conn.rollback();
      return res.status(403).json({ ok: false, message: '无权取消该预约' });
    }
    if (row.status === 'cancelled') {
      await conn.rollback();
      return res.json({ ok: true });
    }
    await conn.query('UPDATE appointment SET status = "cancelled", cancel_reason = ? WHERE id = ?', [
      reason || '主动取消',
      id,
    ]);
    await conn.query('UPDATE schedule SET used_quota = GREATEST(used_quota - 1, 0) WHERE id = ?', [
      Number(row.schedule_id),
    ]);
    await conn.commit();
    await writeAuditLog(pool, req, {
      action: 'appointment.cancel',
      status: 'ok',
      targetType: 'appointment',
      targetId: String(id),
      detail: String(reason || '主动取消').slice(0, 200),
    });
    return res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function rescheduleAppointment(req, res) {
  const id = Number(req.params.id);
  const { schedule_id } = req.body || {};
  if (!schedule_id) return res.status(400).json({ ok: false, message: '请选择新的排班时段' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [appointmentRows] = await conn.query(
      'SELECT id, user_id, schedule_id, status FROM appointment WHERE id = ? FOR UPDATE',
      [id],
    );
    if (!appointmentRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '预约不存在' });
    }
    const appointment = appointmentRows[0];
    if (!canManage(req.user.role) && Number(appointment.user_id) !== req.user.id) {
      await conn.rollback();
      return res.status(403).json({ ok: false, message: '无权改约该预约' });
    }
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '该预约状态不支持改约' });
    }

    const [newScheduleRows] = await conn.query(
      `SELECT id, schedule_date, start_time, end_time, total_quota, used_quota, status
       FROM schedule WHERE id = ? FOR UPDATE`,
      [Number(schedule_id)],
    );
    if (!newScheduleRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '目标排班不存在' });
    }
    const newSchedule = newScheduleRows[0];
    if (newSchedule.status !== 'published') {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '目标排班未开放预约' });
    }
    if (Number(newSchedule.used_quota) >= Number(newSchedule.total_quota)) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '目标时段号源已满' });
    }

    await conn.query('UPDATE appointment SET schedule_id = ?, status = "booked" WHERE id = ?', [
      Number(schedule_id),
      id,
    ]);
    await conn.query('UPDATE schedule SET used_quota = GREATEST(used_quota - 1, 0) WHERE id = ?', [
      Number(appointment.schedule_id),
    ]);
    await conn.query('UPDATE schedule SET used_quota = used_quota + 1 WHERE id = ?', [Number(schedule_id)]);
    await conn.commit();
    await writeAuditLog(pool, req, {
      action: 'appointment.reschedule',
      status: 'ok',
      targetType: 'appointment',
      targetId: String(id),
      detail: `to_schedule=${schedule_id}`,
    });
    return res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
