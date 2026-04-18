import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncRoute } from '../utils/asyncRoute.js';
import { config } from '../config.js';

const r = Router();

r.get(
  '/health',
  asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    const [grows] = await pool.query('SELECT COUNT(*) AS c FROM department');
    const c = Number(grows[0]?.c ?? 0);
    res.json({ ok: true, mysql: true, departmentCount: c });
  }),
);

r.get(
  '/departments',
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, description FROM department ORDER BY id ASC',
    );
    const list = rows.map((x) => ({
      id: typeof x.id === 'bigint' ? Number(x.id) : x.id,
      name: x.name,
      description: x.description,
    }));
    res.json({ ok: true, list });
  }),
);

r.get(
  '/upload-policy',
  asyncRoute(async (_req, res) => {
    res.json({
      ok: true,
      policy: {
        max_files: config.upload.maxFiles,
        max_file_size_mb: config.upload.maxFileSizeMb,
        allowed_extensions: config.upload.allowedExtensions,
      },
    });
  }),
);

export default r;
