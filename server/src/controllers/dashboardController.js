import { pool } from '../db/pool.js';

function val(x) {
  if (typeof x === 'bigint') return Number(x);
  return Number(x || 0);
}

export async function stats(req, res) {
  const role = req.user.role;
  const userId = req.user.id;

  const [[dept]] = await pool.query('SELECT COUNT(*) AS c FROM department');
  const [[doctor]] = await pool.query('SELECT COUNT(*) AS c FROM doctor WHERE is_active = 1');
  const [[appointment]] = await pool.query(
    `SELECT COUNT(*) AS c FROM appointment
     WHERE status IN ('booked','checked_in')`,
  );
  const [[today]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM appointment a
     JOIN schedule s ON s.id = a.schedule_id
     WHERE s.schedule_date = CURDATE() AND a.status IN ('booked','checked_in','completed')`,
  );

  const [annRows] = await pool.query(
    `SELECT id, title, content, created_at
     FROM announcement
     WHERE is_active = 1
     ORDER BY id DESC
     LIMIT 8`,
  );

  const [myAppointments] = await pool.query(
    `SELECT a.id, a.status, s.schedule_date, s.start_time, s.end_time,
            u.name AS doctor_name, dp.name AS department_name
     FROM appointment a
     JOIN schedule s ON s.id = a.schedule_id
     JOIN doctor d ON d.id = s.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN department dp ON dp.id = d.department_id
     WHERE (? = 'patient' AND a.user_id = ?)
        OR (? IN ('admin','staff') AND a.status IN ('booked','checked_in'))
        OR (? = 'doctor' AND d.user_id = ?)
     ORDER BY s.schedule_date ASC, s.start_time ASC
     LIMIT 10`,
    [role, userId, role, role, userId],
  );

  const [peakRows] = await pool.query(
    `SELECT HOUR(s.start_time) AS hour_slot, COUNT(*) AS c
     FROM appointment a
     JOIN schedule s ON s.id = a.schedule_id
     WHERE s.schedule_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
     GROUP BY HOUR(s.start_time)
     ORDER BY c DESC
     LIMIT 6`,
  );

  res.json({
    ok: true,
    stats: {
      departmentCount: val(dept.c),
      doctorCount: val(doctor.c),
      activeAppointmentCount: val(appointment.c),
      todayVisitCount: val(today.c),
    },
    announcements: annRows,
    upcoming: myAppointments,
    peakHours: peakRows.map((x) => ({ hour: val(x.hour_slot), count: val(x.c) })),
  });
}
