import { synthesizeSpeech } from '../services/ttsService.js';
import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';

function parseRate(input) {
  const rate = Number(input);
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.5, Math.min(2, rate));
}

export async function speak(req, res) {
  const mode = ['mandarin', 'xiangshan'].includes(req.body?.mode) ? req.body.mode : 'mandarin';
  const text = String(req.body?.text || '').trim();
  const rate = parseRate(req.body?.rate);
  if (!text) {
    return res.status(400).json({ ok: false, message: '播报内容不能为空' });
  }
  if (text.length > 500) {
    return res.status(400).json({ ok: false, message: '播报内容过长，请控制在500字以内' });
  }

  try {
    const audio = await synthesizeSpeech({ text, mode, rate });
    await writeAuditLog(pool, req, {
      action: 'tts.speak',
      status: 'ok',
      targetType: 'tts',
      targetId: mode,
      detail: `len=${text.length};rate=${rate}`,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', audio.mimeType || 'audio/mpeg');
    return res.send(audio.buffer);
  } catch (e) {
    await writeAuditLog(pool, req, {
      action: 'tts.speak',
      status: 'fail',
      targetType: 'tts',
      targetId: mode,
      detail: String(e?.message || '').slice(0, 300),
    });
    return res.status(400).json({ ok: false, message: String(e?.message || '语音生成失败') });
  }
}

export async function testSpeak(req, res) {
  const mode = ['mandarin', 'xiangshan'].includes(req.body?.mode) ? req.body.mode : 'xiangshan';
  const rate = parseRate(req.body?.rate);
  const text = mode === 'xiangshan'
    ? '阿拉象山话播报测试，若听着正常，说明配置基本可用。'
    : '这是普通话播报测试，若听着正常，说明配置基本可用。';
  try {
    const audio = await synthesizeSpeech({ text, mode, rate });
    await writeAuditLog(pool, req, {
      action: 'admin.tts_test',
      status: 'ok',
      targetType: 'tts',
      targetId: mode,
      detail: `bytes=${audio.buffer.length};rate=${rate}`,
    });
    return res.json({ ok: true, message: 'TTS 连通成功', bytes: audio.buffer.length, mode, rate });
  } catch (e) {
    await writeAuditLog(pool, req, {
      action: 'admin.tts_test',
      status: 'fail',
      targetType: 'tts',
      targetId: mode,
      detail: String(e?.message || '').slice(0, 300),
    });
    return res.status(400).json({ ok: false, message: String(e?.message || 'TTS 测试失败') });
  }
}
