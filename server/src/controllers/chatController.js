import { pool } from '../db/pool.js';
import { assertProjectVisible } from '../services/projectAccess.js';
import { chatCompletion } from '../services/aiService.js';

const SYS = `你是中医药 AI 全链路开发课程助教，帮助同学完善项目与理解审核意见。回答简洁、专业、友善，使用中文。`;

export async function listChat(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const [rows] = await pool.query(
    `SELECT id, role, content, created_at FROM ai_chat_messages
     WHERE project_id = ? ORDER BY id ASC LIMIT 200`,
    [id],
  );
  res.json({ ok: true, list: rows });
}

export async function postChat(req, res) {
  const id = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, id);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ ok: false, message: '请输入内容' });
  }
  const text = String(content).trim().slice(0, 8000);
  await pool.query(
    'INSERT INTO ai_chat_messages (project_id, user_id, role, content) VALUES (?,?,?,?)',
    [id, req.user.id, 'user', text],
  );

  const [hist] = await pool.query(
    `SELECT role, content FROM ai_chat_messages WHERE project_id = ? ORDER BY id DESC LIMIT 20`,
    [id],
  );
  const ordered = hist.reverse();
  const messages = [
    { role: 'system', content: SYS },
    {
      role: 'system',
      content: `当前项目：${vis.project.name}。描述：${vis.project.description || '无'}。状态：${vis.project.status}。`,
    },
    ...ordered.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const reply = await chatCompletion(messages, { temperature: 0.5 });
    await pool.query(
      'INSERT INTO ai_chat_messages (project_id, user_id, role, content) VALUES (?,?,?,?)',
      [id, req.user.id, 'assistant', reply],
    );
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || '对话失败' });
  }
}
