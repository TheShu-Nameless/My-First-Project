/**
 * 将 UTF-8 文本（.md / .html 按纯文本读入）转为简单 .docx（段落级，无复杂 Markdown 渲染）
 * 用法: node gen.mjs <输入路径> <输出.docx路径>
 */
import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const [,, inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('用法: node gen.mjs <输入> <输出.docx>');
  process.exit(1);
}

let raw = fs.readFileSync(inPath, 'utf8');
if (inPath.toLowerCase().endsWith('.html')) {
  raw = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
const lines = raw.replace(/\r\n/g, '\n').split('\n');

const children = [];
for (const line of lines) {
  const t = line.trimEnd();
  if (t === '') {
    children.push(new Paragraph({ text: '' }));
    continue;
  }
  if (t.startsWith('# ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: t.slice(2).trim(), font: 'Microsoft YaHei' })],
      }),
    );
    continue;
  }
  if (t.startsWith('## ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.slice(3).trim(), font: 'Microsoft YaHei' })],
      }),
    );
    continue;
  }
  if (t.startsWith('### ')) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: t.slice(4).trim(), font: 'Microsoft YaHei' })],
      }),
    );
    continue;
  }
  const plain = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) continue;
  children.push(
    new Paragraph({
      children: [new TextRun({ text: plain, font: 'Microsoft YaHei', size: 22 })],
    }),
  );
}

const doc = new Document({
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log('OK', outPath);
