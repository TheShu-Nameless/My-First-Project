import { config } from '../config.js';
import { pool } from '../db/pool.js';
import http from 'http';
import https from 'https';

async function getSetting(key, fallback) {
  const [rows] = await pool.query('SELECT value FROM system_settings WHERE `key` = ?', [key]);
  if (rows.length && rows[0].value != null && rows[0].value !== '') return rows[0].value;
  return fallback;
}

function clip(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

export async function getEffectiveAiConfig() {
  const baseUrl = (await getSetting('ai_api_base', config.ai.baseUrl)).replace(/\/$/, '');
  const apiKey = String((await getSetting('ai_api_key', config.ai.apiKey)) || config.ai.apiKey || '').trim();
  const model = await getSetting('ai_model', config.ai.model);
  const hostHeader = String(await getSetting('ai_host_header', config.ai.hostHeader || '') || '').trim();
  return { baseUrl, apiKey, model, hostHeader };
}

function isAuthKeyError(message) {
  const msg = String(message || '').toLowerCase();
  return (
    msg.includes('incorrect api key') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid_api_key') ||
    msg.includes('unauthorized') ||
    msg.includes('authentication') ||
    msg.includes('no api key') ||
    msg.includes('missing api key') ||
    msg.includes('bearer')
  );
}

function isOllamaBaseUrl(url) {
  const s = String(url || '').toLowerCase();
  return s.includes('127.0.0.1:11434') || s.includes('localhost:11434');
}

function isCloudBaseUrl(url) {
  const s = String(url || '').toLowerCase();
  if (!s.startsWith('http://') && !s.startsWith('https://')) return false;
  return !isOllamaBaseUrl(s);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || '{}'));
  } catch {
    return {};
  }
}

function normalizeOllamaBase(url) {
  const clean = String(url || '').replace(/\/$/, '');
  return clean.replace(/\/v1$/i, '');
}

function dedupe(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

async function requestOllamaNativeChat({ baseUrl, model, messages, options = {} }) {
  const root = normalizeOllamaBase(baseUrl || 'http://127.0.0.1:11434');
  const url = `${root}/api/chat`;
  const timeoutMs = Number(options.timeoutMs || 22000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('AI 请求超时')), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: { temperature: options.temperature ?? 0.3 },
      }),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    const data = safeJsonParse(text);
    if (!res.ok) {
      const msg = data?.error || data?.message || text || `status=${res.status}`;
      throw new Error(`Ollama 接口错误: ${String(msg).slice(0, 500)}`);
    }
    const out = data?.message?.content || data?.response;
    if (!out) throw new Error('Ollama 返回为空');
    return String(out).trim();
  } finally {
    clearTimeout(timer);
  }
}

async function listOllamaModels(baseUrl) {
  const root = normalizeOllamaBase(baseUrl || 'http://127.0.0.1:11434');
  const res = await fetch(`${root}/api/tags`, { method: 'GET' });
  const text = await res.text().catch(() => '');
  const data = safeJsonParse(text);
  if (!res.ok) {
    const msg = data?.error || data?.message || text || `status=${res.status}`;
    throw new Error(`读取 Ollama 模型列表失败: ${String(msg).slice(0, 300)}`);
  }
  const list = Array.isArray(data?.models) ? data.models : [];
  return list
    .map((m) => String(m?.name || '').trim())
    .filter(Boolean);
}

function pickOllamaModels(configuredModel, discoveredModels = []) {
  const preferred = discoveredModels.filter((name) => /(qwen|deepseek|llama|yi|mistral|glm)/i.test(name));
  return dedupe([
    String(configuredModel || '').trim(),
    ...preferred,
    ...discoveredModels,
    'qwen2.5:7b',
    'qwen2.5:14b',
    'deepseek-r1:7b',
    'llama3.1:8b',
  ]);
}

async function tryOllamaCompletion({ baseUrl, model, messages, options = {} }) {
  const bases = dedupe([
    isOllamaBaseUrl(baseUrl) ? normalizeOllamaBase(baseUrl) : '',
    'http://127.0.0.1:11434',
    'http://localhost:11434',
  ]);
  let firstListErr = null;
  let lastErr = null;
  for (const base of bases) {
    try {
      const discovered = await listOllamaModels(base);
      const candidates = pickOllamaModels(model, discovered);
      for (const candidate of candidates) {
        try {
          return await requestOllamaNativeChat({
            baseUrl: base,
            model: candidate,
            messages,
            options,
          });
        } catch (e) {
          lastErr = e;
        }
      }
      if (!candidates.length) {
        lastErr = new Error('未发现可用的 Ollama 模型，请先执行 ollama pull');
      }
    } catch (e) {
      if (!firstListErr) firstListErr = e;
      lastErr = e;
    }
  }
  throw lastErr || firstListErr || new Error('本地 Ollama 不可用');
}

async function requestChatCompletion({ baseUrl, apiKey, model, hostHeader, messages, options = {} }) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  if (!cleanBase) throw new Error('未配置 AI 接口地址');
  if (!/^https?:\/\//i.test(cleanBase)) throw new Error('AI 接口地址格式不正确，应以 http:// 或 https:// 开头');
  if (isCloudBaseUrl(cleanBase) && !String(apiKey || '').trim()) {
    throw new Error('未配置 AI Key');
  }
  const url = `${cleanBase}/chat/completions`;
  const body = {
    model: options.model || model,
    messages,
    temperature: options.temperature ?? 0.3,
  };
  const timeoutMs = Number(options.timeoutMs || 22000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('AI 请求超时')), timeoutMs);
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    // Ollama 本地部署通常不需要 Authorization；云厂商接口则需要 Bearer Key。
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    let statusCode = 0;
    let data = {};
    let rawResponseText = '';
    if (hostHeader) {
      const u = new URL(url);
      const rawBody = JSON.stringify(body);
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
              'Content-Length': Buffer.byteLength(rawBody),
            },
            timeout: timeoutMs,
          },
          (resp) => {
            statusCode = Number(resp.statusCode || 0);
            let text = '';
            resp.on('data', (chunk) => { text += chunk; });
            resp.on('end', () => resolve(text));
          },
        );
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('AI 请求超时')));
        req.write(rawBody);
        req.end();
      });
      rawResponseText = String(responseText || '');
      data = safeJsonParse(rawResponseText);
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      statusCode = Number(res.status);
      rawResponseText = await res.text().catch(() => '');
      data = safeJsonParse(rawResponseText);
    }
    if (statusCode < 200 || statusCode >= 300) {
      const msg =
        data?.error?.message ||
        data?.message ||
        String(rawResponseText || '').slice(0, 500) ||
        `status=${statusCode}`;
      throw new Error(`AI 接口错误: ${msg}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI 返回为空');
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI 兼容 Chat Completions（DashScope compatible-mode）
 */
export async function chatCompletion(messages, options = {}) {
  const { baseUrl, apiKey, model, hostHeader } = await getEffectiveAiConfig();
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (isOllamaBaseUrl(base)) {
    try {
      return await requestChatCompletion({ baseUrl: base, apiKey: '', model, hostHeader: '', messages, options });
    } catch (openAiCompatErr) {
      try {
        return await tryOllamaCompletion({ baseUrl: base, model, messages, options });
      } catch (ollamaErr) {
        throw new Error(`Ollama 调用失败：${String(openAiCompatErr?.message || '')}；原生回退也失败：${String(ollamaErr?.message || '')}`, {
          cause: ollamaErr,
        });
      }
    }
  }
  try {
    return await requestChatCompletion({ baseUrl: base, apiKey, model, hostHeader, messages, options });
  } catch (error) {
    const envKey = config.ai.apiKey;
    const shouldRetryWithEnv =
      envKey && envKey !== apiKey && isAuthKeyError(error?.message);
    if (shouldRetryWithEnv) {
      return requestChatCompletion({ baseUrl: base, apiKey: envKey, model, hostHeader, messages, options });
    }

    const shouldTryOllamaFallback =
      !isOllamaBaseUrl(base) &&
      (
        !String(apiKey || '').trim() ||
        isAuthKeyError(error?.message) ||
        String(error?.message || '').toLowerCase().includes('connect') ||
        String(error?.message || '').toLowerCase().includes('timeout')
      );
    if (!shouldTryOllamaFallback) throw error;

    try {
      return await tryOllamaCompletion({ baseUrl: '', model, messages, options });
    } catch (ollamaErr) {
      throw new Error(`${String(error?.message || 'AI 调用失败')}；并且本地 Ollama 自动回退失败：${String(ollamaErr?.message || '未知错误')}`, {
        cause: ollamaErr,
      });
    }
  }
}

const TRIAGE_SYSTEM = `你是校园门诊智能分诊助手。请根据输入症状，输出严格 JSON（不要 Markdown），字段：
{"recommended_department":"科室名称","confidence":0-100数字,"suggestion":"不超过120字的建议","risk_level":"低/中/高","keywords":["关键词1","关键词2"]}`;

function localRuleTriage(symptomText) {
  const symptom = String(symptomText || '').trim();
  const departmentRules = [
    {
      department: '中医内科',
      weightedKeywords: [
        ['发热', 3], ['咳嗽', 3], ['头晕', 3], ['乏力', 2], ['胃痛', 3], ['腹泻', 3], ['失眠', 2],
        ['胸闷', 3], ['头痛', 2], ['恶心', 2], ['呕吐', 2], ['咽痛', 2], ['感冒', 2], ['腹痛', 2],
      ],
    },
    {
      department: '针灸推拿科',
      weightedKeywords: [
        ['颈椎', 4], ['肩痛', 3], ['腰痛', 4], ['扭伤', 4], ['关节', 3], ['麻木', 3], ['落枕', 4],
        ['肌肉', 2], ['疼痛', 2], ['酸痛', 2], ['运动损伤', 4], ['僵硬', 2],
      ],
    },
    {
      department: '中医妇科',
      weightedKeywords: [
        ['月经', 4], ['痛经', 5], ['妇科', 4], ['白带', 4], ['经期', 4], ['备孕', 3], ['更年期', 3],
        ['乳房胀痛', 2], ['经量', 3], ['内分泌', 2],
      ],
    },
    {
      department: '中医儿科',
      weightedKeywords: [
        ['小儿', 5], ['儿童', 4], ['宝宝', 4], ['夜啼', 4], ['积食', 4], ['厌食', 3], ['发育', 3],
        ['反复感冒', 3], ['咳喘', 3], ['腹胀', 2],
      ],
    },
    {
      department: '神经内科',
      weightedKeywords: [
        ['头痛', 4], ['偏头痛', 5], ['眩晕', 4], ['头晕', 3], ['失眠', 3], ['麻木', 4], ['抽搐', 5],
        ['神经痛', 4], ['偏瘫', 5], ['记忆力下降', 3], ['肢体无力', 4],
      ],
    },
    {
      department: '心血管内科',
      weightedKeywords: [
        ['胸闷', 4], ['心悸', 5], ['胸痛', 5], ['高血压', 4], ['血压高', 4], ['心慌', 4],
        ['气短', 3], ['下肢水肿', 3],
      ],
    },
    {
      department: '呼吸内科',
      weightedKeywords: [
        ['咳嗽', 4], ['咳痰', 3], ['气促', 4], ['呼吸困难', 5], ['咽痛', 2], ['发热', 2], ['哮喘', 4],
      ],
    },
    {
      department: '消化内科',
      weightedKeywords: [
        ['胃痛', 4], ['腹痛', 3], ['腹胀', 3], ['反酸', 4], ['恶心', 3], ['呕吐', 3], ['腹泻', 3],
        ['便秘', 3], ['消化不良', 4],
      ],
    },
    {
      department: '骨科',
      weightedKeywords: [
        ['关节痛', 4], ['膝痛', 4], ['骨折', 5], ['扭伤', 4], ['腰痛', 4], ['颈椎', 4], ['背痛', 3],
        ['摔伤', 5], ['跌倒', 4], ['撞伤', 4], ['外伤', 4], ['挫伤', 4], ['脱臼', 5], ['骨裂', 5],
        ['手臂', 4], ['手腕', 4], ['肘关节', 4], ['小臂', 4], ['上臂', 4], ['肩关节', 4],
        ['肿胀', 3], ['淤青', 3], ['活动受限', 4], ['抬不起来', 4], ['不能用力', 3], ['疼得厉害', 3],
      ],
    },
  ];

  const highRiskWords = [
    '胸痛', '呼吸困难', '昏迷', '抽搐', '黑便', '便血', '剧痛', '高烧', '持续呕吐', '意识模糊', '站不稳',
    '偏瘫', '口角歪斜',
  ];
  const mediumRiskWords = ['反复发热', '明显乏力', '头晕目眩', '频繁呕吐', '持续腹泻'];
  const traumaWords = [
    '摔伤', '跌倒', '撞伤', '外伤', '挫伤', '扭伤', '脱臼', '骨折', '骨裂', '手臂', '手腕', '肘关节',
    '小臂', '上臂', '肩关节', '活动受限',
  ];

  const scored = departmentRules.map((rule) => {
    let score = 0;
    const matched = [];
    for (const [keyword, weight] of rule.weightedKeywords) {
      if (symptom.includes(keyword)) {
        score += weight;
        matched.push(keyword);
      }
    }
    return { department: rule.department, score, matched };
  });

  scored.sort((a, b) => b.score - a.score);
  let top = scored[0] || { department: '中医内科', score: 0, matched: [] };
  const second = scored[1] || { score: 0, matched: [] };
  const traumaHit = traumaWords.filter((k) => symptom.includes(k));
  if (traumaHit.length && top.department !== '骨科') {
    const ortho = scored.find((x) => x.department === '骨科');
    if (ortho) {
      top = {
        ...ortho,
        score: Math.max(ortho.score, 6),
        matched: uniq([...ortho.matched, ...traumaHit]),
      };
    }
  }
  const margin = top.score - second.score;
  const highRisk = highRiskWords.some((k) => symptom.includes(k));
  const mediumRisk = mediumRiskWords.some((k) => symptom.includes(k)) || traumaHit.length >= 2;

  let riskLevel = '低';
  if (highRisk) riskLevel = '高';
  else if (mediumRisk || top.score >= 6) riskLevel = '中';

  const richness = uniq(top.matched).length;
  let confidence = 48 + top.score * 4 + clip(margin * 3, 0, 15) + clip(richness * 2, 0, 10);
  if (top.score === 0) confidence = 52;
  if (highRisk) confidence = Math.max(confidence, 82);
  confidence = clip(Math.round(confidence), 45, 95);

  const keywords = uniq(top.matched).slice(0, 8);
  const suggestion = highRisk
    ? `出现${keywords.length ? keywords.join('、') : '急性危险'}相关信号，建议立即至导诊台分流，必要时急诊处理。`
    : `建议先到${top.department}就诊，由医生面诊后进一步检查分诊。${keywords.length ? `（依据：${keywords.join('、')}）` : ''}`;

  return {
    recommended_department: top.department || '中医内科',
    confidence,
    suggestion,
    risk_level: riskLevel,
    keywords: keywords.length ? keywords : ['常规分诊'],
    raw_json: {
      source: 'local_rule',
      symptom,
      scored_candidates: scored.slice(0, 3),
      risk_flags: { highRisk, mediumRisk },
    },
  };
}

export async function runTriage(symptom) {
  let parsed;
  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: TRIAGE_SYSTEM },
        { role: 'user', content: `症状描述：${symptom}` },
      ],
      { temperature: 0.2 },
    );
    try {
      const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = {
        recommended_department: '中医内科',
        confidence: 68,
        suggestion: raw.slice(0, 120) || '建议先至中医内科初诊，再由医生分诊。',
        risk_level: '中',
        keywords: ['分诊'],
      };
    }
  } catch (e) {
    const aiErr = String(e?.message || '');
    const lowerAiErr = aiErr.toLowerCase();
    let hint = 'AI服务异常，已切换本地规则分诊';
    if (
      lowerAiErr.includes('incorrect api key') ||
      lowerAiErr.includes('invalid api key') ||
      aiErr.includes('invalid_api_key') ||
      lowerAiErr.includes('unauthorized') ||
      lowerAiErr.includes('authentication') ||
      lowerAiErr.includes('no api key') ||
      lowerAiErr.includes('missing api key') ||
      lowerAiErr.includes('未配置 ai key') ||
      lowerAiErr.includes('bearer') ||
      lowerAiErr.includes('401') ||
      lowerAiErr.includes('403')
    ) {
      hint = 'AI Key 未配置或无效，已切换本地规则分诊';
    } else if (lowerAiErr.includes('insufficient balance') || aiErr.includes('余额不足')) {
      hint = 'AI 余额不足，已切换本地规则分诊';
    } else if (lowerAiErr.includes('access to model denied')) {
      hint = '当前模型无调用权限，已切换本地规则分诊';
    } else if (lowerAiErr.includes('connect') || aiErr.includes('ECONNREFUSED')) {
      hint = '无法连接 AI 服务，已切换本地规则分诊（请检查 Ollama 是否已启动）';
    } else if (lowerAiErr.includes('model') && lowerAiErr.includes('not found')) {
      hint = '未找到本地模型，已切换本地规则分诊（请先执行 ollama pull）';
    } else if (aiErr.includes('超时') || lowerAiErr.includes('timeout')) {
      hint = 'AI 请求超时，已切换本地规则分诊';
    }
    parsed = localRuleTriage(symptom);
    parsed.raw_json = {
      ...(parsed.raw_json || {}),
      ai_fallback_hint: hint,
      ai_error: aiErr.slice(0, 500),
    };
  }

  const departmentName = String(parsed.recommended_department || '中医内科').trim();
  const confidence = Number(parsed.confidence);
  const score = Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 65;
  const suggestion = String(parsed.suggestion || '').trim() || '建议先至中医内科初诊，再由医生分诊。';
  const riskLevel = ['低', '中', '高'].includes(parsed.risk_level) ? parsed.risk_level : '中';
  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [];

  const [depRows] = await pool.query('SELECT id, name FROM department WHERE name = ? LIMIT 1', [departmentName]);
  return {
    recommended_department_id: depRows[0]?.id ? Number(depRows[0].id) : null,
    recommended_department: depRows[0]?.name || departmentName,
    confidence: score,
    suggestion: `${suggestion}（风险等级：${riskLevel}）`,
    risk_level: riskLevel,
    keywords,
    raw_json: parsed,
  };
}
