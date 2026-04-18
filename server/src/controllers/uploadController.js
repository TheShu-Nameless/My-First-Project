import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { assertProjectVisible } from '../services/projectAccess.js';
import { config } from '../config.js';

function normalizeExt(filename = '') {
  return path.extname(String(filename)).toLowerCase();
}

function isAllowedExt(ext) {
  if (!ext) return false;
  return config.upload.allowedExtensions.includes(ext);
}

function safeResolveUnderUploadDir(relPath = '') {
  const normalizedRel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(config.uploadDir, normalizedRel);
  const base = path.resolve(config.uploadDir) + path.sep;
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

export async function uploadFiles(req, res) {
  const projectId = Number(req.params.id);
  const vis = await assertProjectVisible(req.user, projectId);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  if (vis.project.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: '仅项目创建者可上传材料' });
  }
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ ok: false, message: '未选择文件' });

  const sub = path.join(config.uploadDir, String(projectId));
  if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });

  const saved = [];
  for (const f of files) {
    const ext = normalizeExt(f.originalname || '');
    if (!isAllowedExt(ext)) {
      try {
        if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      } catch {
        // ignore
      }
      return res.status(400).json({
        ok: false,
        message: `不支持的文件类型：${ext || '无扩展名'}`,
      });
    }
    const stored = `${uuidv4()}${ext}`;
    const dest = path.join(sub, stored);
    fs.renameSync(f.path, dest);
    const rel = path.relative(config.uploadDir, dest).split(path.sep).join('/');
    const [r] = await pool.query(
      `INSERT INTO project_files (project_id, original_name, stored_name, filepath, file_type, file_size)
       VALUES (?,?,?,?,?,?)`,
      [
        projectId,
        f.originalname,
        stored,
        rel,
        f.mimetype || ext.slice(1),
        f.size || 0,
      ],
    );
    saved.push({ id: r.insertId, original_name: f.originalname });
  }
  res.json({ ok: true, files: saved });
}

export async function deleteFile(req, res) {
  const projectId = Number(req.params.id);
  const fileId = Number(req.params.fileId);
  const vis = await assertProjectVisible(req.user, projectId);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const [rows] = await pool.query(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
    [fileId, projectId],
  );
  if (!rows.length) return res.status(404).json({ ok: false, message: '文件不存在' });
  if (vis.project.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: '无权删除' });
  }
  const fp = safeResolveUnderUploadDir(rows[0].filepath);
  if (!fp) return res.status(400).json({ ok: false, message: '非法文件路径' });
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    /* ignore */
  }
  await pool.query('DELETE FROM project_files WHERE id = ?', [fileId]);
  res.json({ ok: true });
}

export async function downloadFile(req, res) {
  const projectId = Number(req.params.id);
  const fileId = Number(req.params.fileId);
  const vis = await assertProjectVisible(req.user, projectId);
  if (!vis.ok) return res.status(vis.status).json({ ok: false, message: vis.message });
  const [rows] = await pool.query(
    'SELECT * FROM project_files WHERE id = ? AND project_id = ?',
    [fileId, projectId],
  );
  if (!rows.length) return res.status(404).json({ ok: false, message: '文件不存在' });
  const fp = safeResolveUnderUploadDir(rows[0].filepath);
  if (!fp) return res.status(400).json({ ok: false, message: '非法文件路径' });
  if (!fs.existsSync(fp)) return res.status(404).json({ ok: false, message: '文件已丢失' });
  res.download(fp, rows[0].original_name);
}
