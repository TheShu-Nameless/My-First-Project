import { pool } from '../db/pool.js';
import { config } from '../config.js';

async function getSetting(key, fallback = '') {
  const [rows] = await pool.query('SELECT value FROM system_settings WHERE `key` = ? LIMIT 1', [key]);
  if (rows.length && rows[0].value != null && String(rows[0].value) !== '') return String(rows[0].value);
  return fallback;
}

export async function getEffectiveTtsConfig() {
  return {
    apiUrl: String(await getSetting('tts_api_url', config.tts.apiUrl || '') || '').trim(),
    apiKey: String(await getSetting('tts_api_key', config.tts.apiKey || '') || '').trim(),
    model: String(await getSetting('tts_model', config.tts.model || 'gpt-4o-mini-tts') || '').trim(),
    voiceMandarin: String(await getSetting('tts_voice_mandarin', config.tts.voiceMandarin || 'alloy') || '').trim(),
    voiceXiangshan: String(await getSetting('tts_voice_xiangshan', config.tts.voiceXiangshan || 'alloy') || '').trim(),
  };
}

export async function synthesizeSpeech({ text, mode = 'mandarin', rate = 1 }) {
  const cfg = await getEffectiveTtsConfig();
  if (!cfg.apiUrl) {
    throw new Error('未配置 TTS 接口地址，请设置环境变量 TTS_API_URL 或在数据库 system_settings 中配置 tts_api_url');
  }
  const voice = mode === 'xiangshan' ? cfg.voiceXiangshan : cfg.voiceMandarin;
  const basePayload = {
    model: cfg.model || 'gpt-4o-mini-tts',
    voice: voice || 'alloy',
    input: String(text || '').trim(),
  };
  const speed = Number(rate);
  if (Number.isFinite(speed) && speed >= 0.5 && speed <= 2) {
    basePayload.speed = speed;
  }
  if (!basePayload.input) throw new Error('播报内容为空');

  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  async function requestByPayload(payload) {
    const resp = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`TTS 接口错误: ${errText || resp.status}`);
    }

    const contentType = String(resp.headers.get('content-type') || 'audio/mpeg');
    if (contentType.includes('application/json')) {
      const data = await resp.json().catch(() => ({}));
      const maybeBase64 = String(data.audio_base64 || data.audio || '').trim();
      if (!maybeBase64) {
        throw new Error(`TTS 返回 JSON 但无音频字段: ${JSON.stringify(data).slice(0, 200)}`);
      }
      return {
        mimeType: String(data.mime_type || 'audio/mpeg'),
        buffer: Buffer.from(maybeBase64, 'base64'),
      };
    }

    const arr = await resp.arrayBuffer();
    return {
      mimeType: contentType,
      buffer: Buffer.from(arr),
    };
  }

  try {
    // OpenAI 兼容接口通常要求 response_format。
    return await requestByPayload({ ...basePayload, response_format: 'mp3' });
  } catch (firstErr) {
    const msg = String(firstErr?.message || '').toLowerCase();
    const shouldRetryWithFormat = msg.includes('response_format') || msg.includes('unknown parameter');
    if (!shouldRetryWithFormat) throw firstErr;
    // 部分供应商使用 format 字段。
    return requestByPayload({ ...basePayload, format: 'mp3' });
  }
}
