import { pool } from '../db/pool.js';
import { runTriage } from '../services/aiService.js';
import { writeAuditLog } from '../middleware/security.js';

export async function triage(req, res) {
  const { symptom } = req.body || {};
  if (!symptom || String(symptom).trim().length < 4) {
    return res.status(400).json({ ok: false, message: '请输入更完整的症状描述（至少4字）' });
  }
  const result = await runTriage(String(symptom).trim());
  const [r] = await pool.query(
    `INSERT INTO inquiry (user_id, symptom, suggestion, recommended_department_id, confidence, raw_result)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      String(symptom).trim(),
      result.suggestion,
      result.recommended_department_id,
      result.confidence,
      JSON.stringify(result.raw_json || {}),
    ],
  );
  await writeAuditLog(pool, req, {
    action: 'triage.run',
    status: 'ok',
    targetType: 'inquiry',
    targetId: String(r.insertId),
    detail: `${result.recommended_department}|${result.confidence}`,
  });
  res.json({
    ok: true,
    id: Number(r.insertId),
    result: {
      recommended_department: result.recommended_department,
      confidence: result.confidence,
      suggestion: result.suggestion,
      risk_level: result.risk_level,
      keywords: result.keywords,
    },
  });
}

export async function listInquiries(req, res) {
  const [rows] = await pool.query(
    `SELECT i.id, i.symptom, i.suggestion, i.confidence, i.created_at,
            dp.name AS department_name
     FROM inquiry i
     LEFT JOIN department dp ON dp.id = i.recommended_department_id
     WHERE i.user_id = ?
     ORDER BY i.id DESC
     LIMIT 50`,
    [req.user.id],
  );
  res.json({ ok: true, list: rows });
}
