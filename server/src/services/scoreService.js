import { pool } from '../db/pool.js';
import { config } from '../config.js';

async function loadWeights() {
  const keys = ['score_weight_ai', 'score_weight_leader', 'score_weight_admin'];
  const [rows] = await pool.query(
    'SELECT `key`, value FROM system_settings WHERE `key` IN (?,?,?)',
    keys,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  return {
    ai: Number.isFinite(map.score_weight_ai) ? map.score_weight_ai : config.weights.ai,
    leader: Number.isFinite(map.score_weight_leader) ? map.score_weight_leader : config.weights.leader,
    admin: Number.isFinite(map.score_weight_admin) ? map.score_weight_admin : config.weights.admin,
  };
}

export async function computeFinalScore({ ai_score, manual_score, admin_score }) {
  const w = await loadWeights();
  const parts = [];
  if (ai_score != null) parts.push({ v: Number(ai_score), w: w.ai });
  if (manual_score != null) parts.push({ v: Number(manual_score), w: w.leader });
  if (admin_score != null) parts.push({ v: Number(admin_score), w: w.admin });
  if (!parts.length) return null;
  const sumW = parts.reduce((a, p) => a + p.w, 0);
  if (sumW <= 0) return null;
  const score = parts.reduce((a, p) => a + p.v * p.w, 0) / sumW;
  return Math.round(score * 100) / 100;
}
