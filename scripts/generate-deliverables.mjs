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

const tmpZip = path.join(
  process.env.TEMP || process.env.TMP || '/tmp',
  `tcm-src-${Date.now()}.zip`,
);
if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);

const excludes = [
  '--exclude=.git',
  '--exclude=node_modules',
  '--exclude=student-info-system/.tools',
  '--exclude=client/node_modules',
  '--exclude=server/node_modules',
  '--exclude=client/dist',
  '--exclude=server/uploads',
  '--exclude=tools/gen-docx/node_modules',
];

const tarArgs = ['-a', '-c', '-f', tmpZip, ...excludes, '.'];
const tr = spawnSync('tar', tarArgs, { cwd: root, stdio: 'inherit', shell: false });
if (tr.status !== 0) {
  console.error('tar 打包失败');
  process.exit(tr.status ?? 1);
}

const finalZip = path.join(root, '项目源码-提交版.zip');
if (fs.existsSync(finalZip)) fs.unlinkSync(finalZip);
fs.renameSync(tmpZip, finalZip);
const mb = (fs.statSync(finalZip).size / (1024 * 1024)).toFixed(2);
console.log(`ZIP: ${mb} MB -> ${finalZip}`);
console.log('全部完成。');
