import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const envPath = path.join(serverRoot, '.env');

dotenv.config({ path: envPath });

const OLLAMA_BASE = 'http://127.0.0.1:11434/v1';

function updateEnvFile(model) {
  const file = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const pairs = [
    ['AI_API_BASE', OLLAMA_BASE],
    ['AI_MODEL', model],
    ['AI_API_KEY', ''],
    ['AI_HOST_HEADER', ''],
  ];
  let next = file;
  for (const [k, v] of pairs) {
    const line = `${k}=${v}`;
    const hasKey = new RegExp(`^${k}=.*$`, 'm').test(next);
    next = hasKey
      ? next.replace(new RegExp(`^${k}=.*$`, 'm'), line)
      : `${next}${next.endsWith('\n') || next.length === 0 ? '' : '\n'}${line}\n`;
  }
  fs.writeFileSync(envPath, next, 'utf8');
}

async function updateDatabase(model) {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 1111),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123123',
    database: process.env.MYSQL_DATABASE || 'tcm_ai_review',
  });
  try {
    const pairs = [
      ['ai_api_base', OLLAMA_BASE],
      ['ai_model', model],
      ['ai_api_key', ''],
      ['ai_host_header', ''],
    ];
    for (const [k, v] of pairs) {
      await conn.query(
        'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [k, v],
      );
    }
  } finally {
    await conn.end();
  }
}

async function checkOllama(model) {
  try {
    const resp = await fetch('http://127.0.0.1:11434/api/tags');
    if (!resp.ok) {
      console.warn(`[set-ollama] Ollama reachable but /api/tags status=${resp.status}`);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const list = Array.isArray(data?.models) ? data.models : [];
    const hit = list.some((m) => String(m?.name || '').startsWith(model));
    if (!hit) {
      console.warn(`[set-ollama] Model "${model}" not found locally. Run: ollama pull ${model}`);
    } else {
      console.log(`[set-ollama] Ollama model "${model}" is ready.`);
    }
  } catch {
    console.warn('[set-ollama] Ollama not running. Start it with: ollama serve');
  }
}

async function main() {
  const model = String(process.argv[2] || 'qwen2.5:7b').trim();
  if (!model) {
    throw new Error('Model name cannot be empty');
  }
  await updateDatabase(model);
  updateEnvFile(model);
  await checkOllama(model);
  console.log('[set-ollama] Switched AI config to local Ollama successfully.');
  console.log(`[set-ollama] Base URL: ${OLLAMA_BASE}`);
  console.log(`[set-ollama] Model: ${model}`);
}

main().catch((error) => {
  console.error(`[set-ollama] ${error?.message || error}`);
  process.exitCode = 1;
});
