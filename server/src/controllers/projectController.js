import { pool } from '../db/pool.js';
import { assertProjectVisible, projectListWhereClause } from '../services/projectAccess.js';
import { reviewProjectContext } from '../services/aiService.js';
import { computeFinalScore } from '../services/scoreService.js';

async function logReview(projectId, actorId, action, detail) {
  await pool.query(
    'INSERT INTO review_logs (project_id, actor_id, action, detail) VALUES (?,?,?,?)',
    [projectId, actorId, action, detail ? JSON.stringify(detail) : null],
  );
}

export async function listProjects(req, res) {
  const { sql, params } = projectListWhereClause(req.user);
  const [rows] = await pool.query(
    `SELECT p.*, g.name AS group_name, u.username AS owner_username, u.display_name AS owner_display
     FROM projects p
     JOIN \`groups\` g ON g.id = p.group_id
     JOIN users u ON u.id = p.user_id
     WHERE ${sql}
     ORDER BY p.updated_at DESC`,
    params,
  );
  res.json({ ok: true, list: rows });
}

export async function createProject(req, res) {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: '请填写项目名称' });
  if (!req.user.group_id) {
    return res.status(400).json({ ok: false, message: '您未加入任何分组，请联系管理员' });
  }
  const [r] = await pool.query(
    `INSERT INTO projects (name, user_id, group_id, description, status)
     VALUES (?,?,?,?, 'draft')`,
    [name, req.user.id, req.user.group_id, description || null],
  );
  await logReview(r.insertId, req.user.id, 'create', { name });
  res.json({ ok: true, id: r.insertId });
}

export async function getProject(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const p = vis.project;
  const [files] = await pool.query(
    'SELECT id, original_name, file_type, file_size, uploaded_at FROM project_files WHERE project_id = ? ORDER BY id ASC',
    [id],
  );
  const [logs] = await pool.query(
    `SELECT r.*, u.username AS actor_username
     FROM review_logs r
     JOIN users u ON u.id = r.actor_id
     WHERE r.project_id = ?
     ORDER BY r.id DESC
     LIMIT 80`,
    [id],
  );
  res.json({ ok: true, project: p, files, logs });
}

export async function updateProject(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (vis.project.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: '仅创建者可修改项目基本信息' });
  }
  const { name, description } = req.body || {};
  const fields = [];
  const params = [];
  if (name != null) {
    fields.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    fields.push('description = ?');
    params.push(description);
  }
  if (!fields.length) return res.json({ ok: true });
  params.push(id);
  await pool.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
}

export async function submitProject(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (vis.project.user_id !== req.user.id) {
    return res.status(403).json({ ok: false, message: '仅创建者可提交' });
  }
  await pool.query("UPDATE projects SET status = 'submitted' WHERE id = ?", [id]);
  await logReview(id, req.user.id, 'submit', {});
  res.json({ ok: true });
}

export async function runAiReview(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const [files] = await pool.query(
    'SELECT original_name FROM project_files WHERE project_id = ?',
    [id],
  );
  const names = files.map((f) => f.original_name);
  try {
    const result = await reviewProjectContext({
      name: vis.project.name,
      description: vis.project.description,
      fileNames: names,
    });
    const ai_score = Math.round((result.tech_score + result.innovation_score) / 2);
    const final_score = await computeFinalScore({
      ai_score,
      manual_score: vis.project.manual_score,
      admin_score: vis.project.admin_score,
    });
    await pool.query(
      `UPDATE projects SET
        ai_summary = ?, ai_tech_score = ?, ai_innovation_score = ?, ai_risk_level = ?,
        ai_raw_json = ?, ai_score = ?, final_score = ?, status = 'ai_done'
       WHERE id = ?`,
      [
        result.summary,
        result.tech_score,
        result.innovation_score,
        result.risk,
        JSON.stringify(result.raw_json),
        ai_score,
        final_score,
        id,
      ],
    );
    await logReview(id, req.user.id, 'ai_review', { ai_score, risk: result.risk });
    res.json({ ok: true, ...result, ai_score, final_score });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || 'AI 审核失败' });
  }
}

export async function leaderReview(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (req.user.role !== 'leader' && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: '仅组长或管理员可人工初审' });
  }
  if (req.user.role === 'leader') {
    const [g] = await pool.query('SELECT leader_id FROM `groups` WHERE id = ?', [vis.project.group_id]);
    if (!g.length || Number(g[0].leader_id) !== Number(req.user.id)) {
      return res.status(403).json({ ok: false, message: '您不是该组组长' });
    }
  }
  const { manual_score, comment } = req.body || {};
  const score = Number(manual_score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).json({ ok: false, message: '人工评分须为 0-100' });
  }
  const final_score = await computeFinalScore({
    ai_score: vis.project.ai_score,
    manual_score: score,
    admin_score: vis.project.admin_score,
  });
  await pool.query(
    `UPDATE projects SET manual_score = ?, status = 'leader_done', final_score = ? WHERE id = ?`,
    [score, final_score, id],
  );
  await logReview(id, req.user.id, 'leader_review', { manual_score: score, comment });
  res.json({ ok: true, final_score });
}

export async function adminReview(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, message: '仅管理员可终审' });
  const { admin_score, comment } = req.body || {};
  const score = Number(admin_score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).json({ ok: false, message: '终审评分须为 0-100' });
  }
  const final_score = await computeFinalScore({
    ai_score: vis.project.ai_score,
    manual_score: vis.project.manual_score,
    admin_score: score,
  });
  await pool.query(
    `UPDATE projects SET admin_score = ?, status = 'admin_done', final_score = ? WHERE id = ?`,
    [score, final_score, id],
  );
  await logReview(id, req.user.id, 'admin_review', { admin_score: score, comment });
  res.json({ ok: true, final_score });
}

export async function deleteProject(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (req.user.role !== 'admin' && vis.project.user_id !== req.user.id) {
    return res.status(403).json({ ok: false, message: '无权删除' });
  }
  await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  res.json({ ok: true });
}
