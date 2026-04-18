import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';

export async function listRecords(req, res) {
  const role = req.user.role;
  const [rows] = await pool.query(
    `SELECT r.id, r.appointment_id, r.user_id, r.doctor_id, r.diagnosis, r.prescription, r.advice, r.created_at,
            p.name AS patient_name,
            du.name AS doctor_name,
            s.schedule_date, s.start_time, s.end_time,
            dp.name AS department_name
     FROM medical_record r
     JOIN users p ON p.id = r.user_id
     JOIN doctor d ON d.id = r.doctor_id
     JOIN users du ON du.id = d.user_id
     JOIN appointment a ON a.id = r.appointment_id
     JOIN schedule s ON s.id = a.schedule_id
     JOIN department dp ON dp.id = d.department_id
     WHERE (? = 'admin' OR ? = 'staff' OR (? = 'doctor' AND d.user_id = ?) OR (? = 'patient' AND r.user_id = ?))
     ORDER BY r.created_at DESC`,
    [role, role, role, req.user.id, role, req.user.id],
  );
  res.json({ ok: true, list: rows });
}

export async function createRecord(req, res) {
  if (!['doctor', 'admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: '仅医生或管理角色可创建就诊记录' });
  }
  const { appointment_id, diagnosis, prescription, advice } = req.body || {};
  if (!appointment_id || !diagnosis) {
    return res.status(400).json({ ok: false, message: '请填写预约ID和诊断结果' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [appRows] = await conn.query(
      `SELECT a.id, a.user_id, a.schedule_id, s.doctor_id
       FROM appointment a
       JOIN schedule s ON s.id = a.schedule_id
       WHERE a.id = ?
       FOR UPDATE`,
      [Number(appointment_id)],
    );
    if (!appRows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: '预约不存在' });
    }
    const app = appRows[0];
    if (req.user.role === 'doctor') {
      const [doctorRows] = await conn.query('SELECT id FROM doctor WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (!doctorRows.length || Number(doctorRows[0].id) !== Number(app.doctor_id)) {
        await conn.rollback();
        return res.status(403).json({ ok: false, message: '只能为本人排班的预约创建病历' });
      }
    }
    const [exists] = await conn.query('SELECT id FROM medical_record WHERE appointment_id = ? LIMIT 1', [
      Number(appointment_id),
    ]);
    if (exists.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: '该预约已有病历记录' });
    }

    const [r] = await conn.query(
      `INSERT INTO medical_record (appointment_id, user_id, doctor_id, diagnosis, prescription, advice)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(appointment_id),
        Number(app.user_id),
        Number(app.doctor_id),
        diagnosis,
        prescription || null,
        advice || null,
      ],
    );
    await conn.query('UPDATE appointment SET status = "completed" WHERE id = ?', [Number(appointment_id)]);
    await conn.commit();
    await writeAuditLog(pool, req, {
      action: 'record.create',
      status: 'ok',
      targetType: 'medical_record',
      targetId: String(r.insertId),
      detail: `appointment=${appointment_id}`,
    });
    return res.json({ ok: true, id: Number(r.insertId) });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
