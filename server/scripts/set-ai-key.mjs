import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const envPath = path.join(serverRoot, '.env');

dotenv.config({ path: envPath });

function fail(message) {
  throw new Error(message);
}

function normalizeKey(raw) {
  return String(raw || '').trim();
}

function updateEnvFile(newKey) {
  const file = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const line = `AI_API_KEY=${newKey}`;
  const hasKey = /^AI_API_KEY=.*$/m.test(file);
  const next = hasKey
    ? file.replace(/^AI_API_KEY=.*$/m, line)
    : `${file}${file.endsWith('\n') || file.length === 0 ? '' : '\n'}${line}\n`;
  fs.writeFileSync(envPath, next, 'utf8');
}

async function updateDatabaseKey(newKey) {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 1111),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123123',
    database: process.env.MYSQL_DATABASE || 'tcm_ai_review',
  });
  try {
    await conn.query(
      'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      ['ai_api_key', newKey],
    );
  } finally {
    await conn.end();
  }
}

async function testKey(newKey) {
  const baseUrl = String(process.env.AI_API_BASE || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'deepseek-chat';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    fail(`AI key test failed (${response.status}): ${text}`);
  }
  console.log('[set-ai-key] AI key test passed.');
}

async function main() {
  const key = normalizeKey(process.argv[2]);
  if (!key) {
    fail('Usage: node scripts/set-ai-key.mjs <YOUR_DEEPSEEK_API_KEY>');
  }

  await updateDatabaseKey(key);
  updateEnvFile(key);
  await testKey(key);
  console.log('[set-ai-key] Updated both database setting and server/.env.');
}

main().catch((error) => {
  console.error(`[set-ai-key] ${error?.message || error}`);
  process.exitCode = 1;
});
