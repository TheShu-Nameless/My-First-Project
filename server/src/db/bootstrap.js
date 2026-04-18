import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { config } from '../config.js';

export async function bootstrapDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS audit_log (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         actor_user_id INT UNSIGNED NULL,
         action VARCHAR(80) NOT NULL,
         target_type VARCHAR(60) NULL,
         target_id VARCHAR(80) NULL,
         status VARCHAR(20) NOT NULL DEFAULT 'ok',
         detail VARCHAR(1000) NULL,
         ip VARCHAR(64) NULL,
         request_id VARCHAR(64) NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_audit_actor (actor_user_id),
         KEY idx_audit_action (action),
         KEY idx_audit_created (created_at),
         CONSTRAINT fk_audit_actor_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    await conn.query(
      `CREATE TABLE IF NOT EXISTS settings_backup (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         backup_json LONGTEXT NOT NULL,
         changed_keys VARCHAR(500) NULL,
         changed_by INT UNSIGNED NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_settings_backup_created (created_at),
         KEY idx_settings_backup_user (changed_by),
         CONSTRAINT fk_settings_backup_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    const [users] = await conn.query('SELECT id, password FROM users WHERE username = ? LIMIT 1', [
      config.admin.username,
    ]);
    if (!users.length) {
      const hash = await bcrypt.hash(config.admin.password, 10);
      await conn.query(
        `INSERT INTO users (username, password, name, role, phone)
         VALUES (?, ?, ?, 'admin', ?)`,
        [config.admin.username, hash, '系统管理员', '13800000000'],
      );
    } else if (!(typeof users[0].password === 'string' && users[0].password.startsWith('$2'))) {
      const hash = await bcrypt.hash(config.admin.password, 10);
      await conn.query('UPDATE users SET password = ? WHERE id = ?', [hash, Number(users[0].id)]);
    }

    const defaults = [
      ['ai_model', config.ai.model],
      ['ai_api_base', config.ai.baseUrl],
      ['ai_api_key', config.ai.apiKey],
      ['ai_host_header', config.ai.hostHeader || ''],
      ['tts_api_url', config.tts.apiUrl || ''],
      ['tts_api_key', config.tts.apiKey || ''],
      ['tts_model', config.tts.model || 'gpt-4o-mini-tts'],
      ['tts_voice_mandarin', config.tts.voiceMandarin || 'alloy'],
      ['tts_voice_xiangshan', config.tts.voiceXiangshan || 'alloy'],
      ['triage_prompt_version', 'v1'],
    ];
    for (const [k, v] of defaults) {
      await conn.query(
        'INSERT IGNORE INTO system_settings (`key`, value) VALUES (?, ?)',
        [k, v],
      );
    }

    const defaultDepartments = [
      ['中医内科', '脾胃、失眠、体质调理等常见内科问题'],
      ['针灸推拿科', '颈肩腰腿痛、运动损伤、理疗康复'],
      ['中医妇科', '月经不调、痛经、孕前调理'],
      ['中医儿科', '小儿感冒、消化不良、体质虚弱'],
      ['神经内科', '头痛、头晕、偏头痛、睡眠障碍、神经系统常见问题'],
      ['心血管内科', '胸闷心悸、血压异常、心血管风险评估'],
      ['呼吸内科', '咳嗽、咽痛、气促、呼吸系统感染与慢病随访'],
      ['消化内科', '胃痛、腹胀、反酸、腹泻、便秘等消化道问题'],
      ['骨科', '关节疼痛、骨伤、扭伤、颈腰椎退变问题'],
      ['皮肤科', '皮疹、过敏、瘙痒、痤疮等皮肤问题'],
      ['耳鼻喉科', '鼻炎、咽炎、耳鸣、咽喉不适等问题'],
    ];
    for (const [name, description] of defaultDepartments) {
      await conn.query(
        'INSERT IGNORE INTO department (name, description) VALUES (?, ?)',
        [name, description],
      );
    }

    const [staff] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', ['staff001']);
    if (!staff.length) {
      const hash = await bcrypt.hash('staff@110', 10);
      await conn.query(
        `INSERT INTO users (username, password, name, role, phone)
         VALUES ('staff001', ?, '门诊值班员', 'staff', '13900000001')`,
        [hash],
      );
    }

    const [doctorUser] = await conn.query('SELECT id FROM users WHERE username = ? LIMIT 1', ['doctor001']);
    let doctorUserId = doctorUser[0]?.id ? Number(doctorUser[0].id) : null;
    if (!doctorUserId) {
      const hash = await bcrypt.hash('doctor@110', 10);
      const [r] = await conn.query(
        `INSERT INTO users (username, password, name, role, phone)
         VALUES ('doctor001', ?, '张仲景', 'doctor', '13900000002')`,
        [hash],
      );
      doctorUserId = Number(r.insertId);
    }

    const [depRows] = await conn.query('SELECT id FROM department WHERE name = ? LIMIT 1', ['中医内科']);
    const defaultDepId = depRows[0]?.id ? Number(depRows[0].id) : null;
    if (doctorUserId && defaultDepId) {
      const [doctorRows] = await conn.query('SELECT id FROM doctor WHERE user_id = ? LIMIT 1', [doctorUserId]);
      if (!doctorRows.length) {
        await conn.query(
          `INSERT INTO doctor (user_id, department_id, title, specialty, intro)
           VALUES (?, ?, '主任医师', '脾胃病、亚健康调理', '累计接诊 5000+，擅长中医辨证论治。')`,
          [doctorUserId, defaultDepId],
        );
      }
    }

    const [annRows] = await conn.query('SELECT id FROM announcement LIMIT 1');
    if (!annRows.length) {
      await conn.query(
        `INSERT INTO announcement (title, content, is_active)
         VALUES
         ('门诊须知', '请提前10分钟签到，过号需重新排队。', 1),
         ('发热就诊提醒', '请有发热症状的同学佩戴口罩并前往导诊台登记。', 1)`,
      );
    }

    // 初始化基础排班，避免患者登录后“挂号预约”为空。
    const [scheduleRows] = await conn.query('SELECT id FROM schedule LIMIT 1');
    if (!scheduleRows.length) {
      const [doctorRows] = await conn.query(
        'SELECT id FROM doctor ORDER BY id ASC LIMIT 8',
      );
      const doctorIds = doctorRows.map((d) => Number(d.id)).filter(Boolean);
      for (const doctorId of doctorIds) {
        await conn.query(
          `INSERT INTO schedule
            (doctor_id, schedule_date, start_time, end_time, total_quota, used_quota, status, created_by)
           VALUES
            (?, CURDATE(), '08:30:00', '11:30:00', 25, 0, 'published', 1),
            (?, CURDATE(), '14:00:00', '17:00:00', 20, 0, 'published', 1),
            (?, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '08:30:00', '11:30:00', 25, 0, 'published', 1),
            (?, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00', '17:00:00', 20, 0, 'published', 1),
            (?, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '08:30:00', '11:30:00', 25, 0, 'published', 1)`,
          [doctorId, doctorId, doctorId, doctorId, doctorId],
        );
      }
    }
  } finally {
    conn.release();
  }
}
