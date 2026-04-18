import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 1111),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '123123',
  database: process.env.MYSQL_DATABASE || 'tcm_ai_review',
});

try {
  const doctorNames = [
    '李青岚', '周景明', '王若溪', '陈知远', '林清和',
    '赵安宁', '孙思雅', '何谨言', '吴承泽', '郑舒宁',
    '冯子墨', '唐亦辰', '许南星', '郭清越', '梁知行',
  ];

  const [deps] = await conn.query('SELECT id, name FROM department ORDER BY id');
  const [existing] = await conn.query('SELECT department_id FROM doctor');
  const hasDoctor = new Set(existing.map((r) => Number(r.department_id)));

  let createdUsers = 0;
  let createdDoctors = 0;
  let nameIndex = 0;

  for (const dep of deps) {
    const depId = Number(dep.id);
    if (hasDoctor.has(depId)) continue;
    const doctorName = doctorNames[nameIndex % doctorNames.length];
    nameIndex += 1;
    const username = `doctor_auto_${depId}`;
    const phone = `139${String(10000000 + depId).slice(-8)}`;
    const passwordHash = '$2a$10$h8e4xW6SR0WvA9EVtqQhTe3GvNfPnNfYAr9w6v4YP11LzW8QfS0ki';

    const [u] = await conn.query(
      'INSERT INTO users (username, password, name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, doctorName, 'doctor', phone],
    );
    createdUsers += 1;

    await conn.query(
      'INSERT INTO doctor (user_id, department_id, title, specialty, intro, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [
        Number(u.insertId),
        depId,
        '主治医师',
        `${dep.name}常见病诊疗`,
        '由系统自动创建，后续可在后台完善医生信息。',
      ],
    );
    createdDoctors += 1;
  }

  const [allDoctors] = await conn.query('SELECT id FROM doctor ORDER BY id');
  const [adminRows] = await conn.query("SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1");
  const createdBy = Number(adminRows[0]?.id || 1);
  const days = [0, 1, 2, 3, 4, 5, 6];
  let scheduleInserted = 0;

  for (const doc of allDoctors) {
    const doctorId = Number(doc.id);
    for (const day of days) {
      await conn.query(
        `INSERT IGNORE INTO schedule
          (doctor_id, schedule_date, start_time, end_time, total_quota, used_quota, status, created_by)
         VALUES
          (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), '08:30:00', '11:30:00', 25, 0, 'published', ?),
          (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), '14:00:00', '17:00:00', 20, 0, 'published', ?)`,
        [doctorId, day, createdBy, doctorId, day, createdBy],
      );
      const [rowCount] = await conn.query('SELECT ROW_COUNT() AS n');
      scheduleInserted += Number(rowCount[0]?.n || 0);
    }
  }

  const [summary] = await conn.query(
    `SELECT dep.id, dep.name, COUNT(doc.id) AS doctor_count
     FROM department dep
     LEFT JOIN doctor doc ON doc.department_id = dep.id
     GROUP BY dep.id, dep.name
     ORDER BY dep.id`,
  );
  const [schedules] = await conn.query(
    `SELECT COUNT(*) AS total_schedule,
            SUM(CASE WHEN schedule_date >= CURDATE() THEN 1 ELSE 0 END) AS future_schedule
     FROM schedule`,
  );

  console.log(
    JSON.stringify(
      {
        createdUsers,
        createdDoctors,
        scheduleInserted,
        departmentDoctorSummary: summary,
        scheduleSummary: schedules[0],
      },
      null,
      2,
    ),
  );
} finally {
  await conn.end();
}
