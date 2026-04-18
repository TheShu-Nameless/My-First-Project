import { pool } from '../db/pool.js';
import { writeAuditLog } from '../middleware/security.js';
import { chatCompletion } from '../services/aiService.js';
import { config } from '../config.js';
import http from 'http';
import https from 'https';

const ALLOWED_KEYS = new Set([
  'ai_api_key',
  'ai_api_base',
  'ai_model',
  'ai_host_header',
  'tts_api_url',
  'tts_api_key',
  'tts_model',
  'tts_voice_mandarin',
  'tts_voice_xiangshan',
  'triage_prompt_version',
]);

function isOllamaBaseUrl(url) {
  const s = String(url || '').toLowerCase();
  return s.includes('127.0.0.1:11434') || s.includes('localhost:11434');
}

export async function getSettings(_req, res) {
  const [rows] = await pool.query('SELECT `key`, value FROM system_settings ORDER BY `key`');
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (map.ai_api_key) map.ai_api_key = map.ai_api_key ? '********' : '';
  if (map.tts_api_key) map.tts_api_key = map.tts_api_key ? '********' : '';
  res.json({ ok: true, settings: map });
}

export async function updateSettings(req, res) {
  const body = req.body || {};
  const [beforeRows] = await pool.query('SELECT `key`, value FROM system_settings ORDER BY `key`');
  const beforeMap = Object.fromEntries(beforeRows.map((r) => [r.key, r.value]));
  const nextBaseUrl = String(body.ai_api_base ?? beforeMap.ai_api_base ?? config.ai.baseUrl);
  const ollamaMode = isOllamaBaseUrl(nextBaseUrl);
  const changed = [];
  for (const k of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    let v = body[k];
    if (
      (k === 'ai_api_key' || k === 'tts_api_key') &&
      (
        v == null ||
        (k === 'ai_api_key' && !ollamaMode && String(v).trim() === '') ||
        String(v).trim() === '********' ||
        String(v).includes('不修改') ||
        String(v).includes('已保存')
      )
    ) continue;
    if (beforeMap[k] === String(v)) continue;
    changed.push(k);
    await pool.query(
      'INSERT INTO system_settings (`key`, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [k, String(v)],
    );
  }
  if (changed.length) {
    const [afterRows] = await pool.query('SELECT `key`, value FROM system_settings ORDER BY `key`');
    const afterMap = Object.fromEntries(afterRows.map((r) => [r.key, r.value]));
    await pool.query(
      `INSERT INTO settings_backup (backup_json, changed_keys, changed_by)
       VALUES (?, ?, ?)`,
      [
        JSON.stringify({
          before: beforeMap,
          after: afterMap,
          changed_keys: changed,
          at: new Date().toISOString(),
        }),
        changed.join(','),
        req.user?.id || null,
      ],
    );
    await writeAuditLog(pool, req, {
      action: 'admin.update_settings',
      status: 'ok',
      targetType: 'system_settings',
      targetId: changed.join(','),
      detail: `changed=${changed.join('|')}`,
    });
  }
  res.json({ ok: true });
}

export async function listSettingBackups(_req, res) {
  const [rows] = await pool.query(
    `SELECT b.id, b.changed_keys, b.created_at, u.username AS actor_username
     FROM settings_backup b
     LEFT JOIN users u ON u.id = b.changed_by
     ORDER BY b.id DESC
     LIMIT 50`,
  );
  res.json({ ok: true, list: rows });
}

function parseAiError(msg) {
  const s = String(msg || '');
  const l = s.toLowerCase();
  if (
    s.includes('invalid_api_key') ||
    l.includes('incorrect api key') ||
    l.includes('invalid api key') ||
    l.includes('unauthorized') ||
    l.includes('authentication') ||
    l.includes('missing api key') ||
    l.includes('no api key') ||
    l.includes('bearer') ||
    l.includes('401') ||
    l.includes('403') ||
    l.includes('未配置 ai key')
  ) {
    return 'AI Key 未配置或无效，请在后台填写可用 Key（或切换到 Ollama 本地模式）';
  }
  if (l.includes('insufficient balance') || l.includes('余额不足')) {
    return '余额不足，请在对应平台充值后重试';
  }
  if (l.includes('quota') || l.includes('rate limit')) {
    return '调用额度不足或触发限流，请稍后重试或提升配额';
  }
  if (l.includes('access to model denied')) {
    return '当前账号无该模型调用权限，请更换模型或开通权限';
  }
  if (l.includes('connect') || s.includes('ECONNREFUSED')) {
    return '无法连接 AI 服务，请检查服务是否启动（Ollama: ollama serve）';
  }
  if (l.includes('model') && l.includes('not found')) {
    return '模型不存在，请先拉取模型（例如：ollama pull qwen2.5:7b）';
  }
  if (l.includes('timeout') || s.includes('超时')) {
    return 'AI 请求超时，请检查网络后重试';
  }
  if (s.includes('AI 接口错误: {}') || s.includes('AI 接口错误:')) {
    return 'AI 接口返回了非兼容数据，请检查 AI Base URL 是否为 OpenAI 兼容地址（应为 .../v1），并确认模型名称可用';
  }
  return s || 'AI 测试失败';
}

function normalizeOllamaBase(url) {
  return String(url || '').replace(/\/$/, '').replace(/\/v1$/i, '');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || '{}'));
  } catch {
    return {};
  }
}

async function getSetting(key, fallback = '') {
  const [rows] = await pool.query('SELECT value FROM system_settings WHERE `key` = ? LIMIT 1', [key]);
  if (rows.length && rows[0].value != null && String(rows[0].value) !== '') return String(rows[0].value);
  return fallback;
}

async function testOnce({ baseUrl, apiKey, model }) {
  if (isOllamaBaseUrl(baseUrl)) {
    const root = normalizeOllamaBase(baseUrl);
    const resp = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: '回复：ok' }],
        options: { temperature: 0 },
      }),
    });
    const text = await resp.text().catch(() => '');
    const data = safeJsonParse(text);
    if (!resp.ok) {
      const msg = data?.error || data?.message || text || `status=${resp.status}`;
      throw new Error(String(msg));
    }
    const out = data?.message?.content || data?.response;
    if (!out) throw new Error('empty_response');
    return String(out).slice(0, 100);
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const hostHeader = String(await getSetting('ai_host_header', config.ai.hostHeader || '') || '').trim();
  const url = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
  const payload = JSON.stringify({
    model,
    temperature: 0,
    messages: [{ role: 'user', content: '回复：ok' }],
  });
  let statusCode = 0;
  let data;
  if (hostHeader) {
    const u = new URL(url);
    const responseText = await new Promise((resolve, reject) => {
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method: 'POST',
          headers: {
            ...headers,
            Host: hostHeader,
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 15000,
        },
        (resp) => {
          statusCode = Number(resp.statusCode || 0);
          let text = '';
          resp.on('data', (chunk) => { text += chunk; });
          resp.on('end', () => resolve(text));
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.write(payload);
      req.end();
    });
    data = JSON.parse(responseText || '{}');
  } else {
    const resp = await fetch(url, { method: 'POST', headers, body: payload });
    statusCode = Number(resp.status || 0);
    data = await resp.json().catch(() => ({}));
  }
  if (statusCode < 200 || statusCode >= 300) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(msg);
  }
  const out = data?.choices?.[0]?.message?.content;
  if (!out) throw new Error('empty_response');
  return String(out).slice(0, 100);
}

async function tryLocalOllama() {
  const localBase = 'http://127.0.0.1:11434';
  const tagResp = await fetch(`${localBase}/api/tags`, { method: 'GET' }).catch(() => null);
  let discovered = [];
  if (tagResp?.ok) {
    const tagText = await tagResp.text().catch(() => '');
    const tagData = safeJsonParse(tagText);
    discovered = Array.isArray(tagData?.models)
      ? tagData.models.map((x) => String(x?.name || '').trim()).filter(Boolean)
      : [];
  }
  const candidates = Array.from(new Set([
    ...discovered.filter((name) => /(qwen|deepseek|llama|yi|mistral|glm)/i.test(name)),
    ...discovered,
    'qwen2.5:7b',
    'qwen2.5:14b',
    'deepseek-r1:7b',
    'llama3.1:8b',
  ]));
  let lastError = '';
  for (const model of candidates) {
    try {
      const preview = await testOnce({ baseUrl: localBase, apiKey: '', model });
      return { ok: true, baseUrl: localBase, model, preview };
    } catch (e) {
      lastError = String(e?.message || lastError || '');
    }
  }
  return { ok: false, message: lastError || '本地 Ollama 不可用' };
}

export async function testAiConnection(req, res) {
  const baseUrl = String(await getSetting('ai_api_base', config.ai.baseUrl)).replace(/\/$/, '');
  const apiKey = String(await getSetting('ai_api_key', config.ai.apiKey) || '').trim();
  const isOllama = isOllamaBaseUrl(baseUrl);

  async function respondDegradedOk(reason) {
    await writeAuditLog(pool, req, {
      action: 'admin.ai_test',
      status: 'ok',
      targetType: 'system_settings',
      targetId: 'ai',
      detail: `degraded:${String(reason || '').slice(0, 260)}`,
    });
    return res.json({
      ok: true,
      degraded: true,
      message: `云端 AI 暂不可用（${reason}），系统可继续使用本地规则分诊`,
      preview: '本地规则分诊可用',
    });
  }

  try {
    if (!isOllama && !apiKey) {
      const local = await tryLocalOllama();
      if (local.ok) {
        await writeAuditLog(pool, req, {
          action: 'admin.ai_test',
          status: 'ok',
          targetType: 'system_settings',
          targetId: 'ai',
          detail: `fallback_ollama:${local.model}`,
        });
        return res.json({
          ok: true,
          message: '云端 Key 未配置，已自动切换本机 Ollama 自检通过',
          preview: String(local.preview || 'ok').slice(0, 80),
          fallback: {
            baseUrl: local.baseUrl,
            model: local.model,
          },
        });
      }
      return respondDegradedOk('AI Key 未配置且本机 Ollama 未探测到可用模型');
    }

    const output = await chatCompletion(
      [{ role: 'user', content: '请回复：AI连接正常' }],
      { temperature: 0, timeoutMs: 15000 },
    );
    await writeAuditLog(pool, req, {
      action: 'admin.ai_test',
      status: 'ok',
      targetType: 'system_settings',
      targetId: 'ai',
      detail: 'ok',
    });
    res.json({ ok: true, message: 'AI 连通成功', preview: String(output).slice(0, 80) });
  } catch (e) {
    const local = await tryLocalOllama();
    if (local.ok) {
      await writeAuditLog(pool, req, {
        action: 'admin.ai_test',
        status: 'ok',
        targetType: 'system_settings',
        targetId: 'ai',
        detail: `fallback_ollama:${local.model};cause=${String(e?.message || '').slice(0, 180)}`,
      });
      return res.json({
        ok: true,
        message: '云端 AI 不可用，已自动回退本机 Ollama 并连通成功',
        preview: String(local.preview || 'ok').slice(0, 80),
        fallback: {
          baseUrl: local.baseUrl,
          model: local.model,
        },
      });
    }

    const message = parseAiError(e?.message);
    return respondDegradedOk(message);
  }
}

export async function autoSelectAiModel(req, res) {
  const baseUrl = String(await getSetting('ai_api_base', config.ai.baseUrl)).replace(/\/$/, '');
  const apiKey = String(await getSetting('ai_api_key', config.ai.apiKey) || '').trim();
  const hostHeader = String(await getSetting('ai_host_header', config.ai.hostHeader || '') || '').trim();
  const ollamaMode = isOllamaBaseUrl(baseUrl);
  if (!apiKey && !ollamaMode) {
    return res.status(400).json({ ok: false, message: '未配置 AI Key，请先保存 Key 后再自动探测模型' });
  }

  const defaultCandidates = ollamaMode
    ? ['qwen2.5:7b', 'qwen2.5:14b', 'deepseek-r1:7b', 'llama3.1:8b']
    : [
      'deepseek-chat',
      'qwen-plus',
      'qwen-turbo',
      'qwen-max',
      'qwen2.5-7b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-72b-instruct',
    ];
  const inputList = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
  const candidates = inputList.length
    ? inputList.map((x) => String(x || '').trim()).filter(Boolean)
    : defaultCandidates;

  const tried = [];
  for (const model of candidates) {
    try {
      const preview = await testOnce({ baseUrl, apiKey, model });
      await pool.query(
        'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        ['ai_model', model],
      );
      await writeAuditLog(pool, req, {
        action: 'admin.ai_auto_model',
        status: 'ok',
        targetType: 'system_settings',
        targetId: model,
        detail: `base=${baseUrl};host=${hostHeader || '-'}`,
      });
      return res.json({
        ok: true,
        message: `已自动切换为可用模型：${model}`,
        model,
        preview,
        tried,
      });
    } catch (e) {
      const msg = parseAiError(e?.message);
      tried.push({ model, error: msg });
    }
  }

  await writeAuditLog(pool, req, {
    action: 'admin.ai_auto_model',
    status: 'fail',
    targetType: 'system_settings',
    targetId: 'none',
    detail: JSON.stringify(tried).slice(0, 300),
  });

  const first = tried[0]?.error || '未找到可用模型';
  return res.status(400).json({
    ok: false,
    message: `自动探测失败：${first}`,
    tried,
  });
}
