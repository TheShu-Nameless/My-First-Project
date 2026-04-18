/**
 * 生成交付用 docx（调用 tools/gen-docx）与项目源码 zip（tar）
 * 用法: node scripts/generate-deliverables.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const gen = path.join(root, 'tools', 'gen-docx', 'gen.mjs');
const node = process.execPath;

if (!fs.existsSync(path.join(root, 'tools', 'gen-docx', 'node_modules', 'docx'))) {
  console.error('请先执行: cd tools/gen-docx && npm install');
  process.exit(1);
}

const pairs = [
  ['交付手册-提交版.md', '交付手册-提交版.docx'],
  ['项目文档-老师提交版.md', '项目文档-提交版.docx'],
  ['产品手册-提交版.md', '产品手册-提交版.docx'],
  ['技术白皮书-提交版.md', '技术白皮书-提交版.docx'],
  ['前端静态HTML说明-提交版.html', '前端静态HTML说明-提交版.docx'],
];

for (const [relSrc, relDst] of pairs) {
  const src = path.join(root, relSrc);
  const dst = path.join(root, relDst);
  if (!fs.existsSync(src)) {
    console.error('缺少源文件:', src);
    process.exit(1);
  }
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  const r = spawnSync(node, [gen, src, dst], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 使用 robocopy + Compress-Archive，避免 Windows 自带 tar 生成的 zip 在部分解压工具中显示异常
const zipScript = path.join(__dirname, 'build-source-zip.ps1');
const finalZip = path.join(root, '项目源码-提交版.zip');
const zr = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    zipScript,
    '-Root',
    root,
    '-OutZip',
    finalZip,
  ],
  { stdio: 'inherit', shell: false },
);
if (zr.status !== 0) {
  console.error('源码 ZIP 打包失败');
  process.exit(zr.status ?? 1);
}

const mb = (fs.statSync(finalZip).size / (1024 * 1024)).toFixed(2);
console.log(`ZIP: ${mb} MB -> ${finalZip}`);
console.log('全部完成。');
