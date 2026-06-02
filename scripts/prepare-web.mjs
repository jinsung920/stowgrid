import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'www');

const files = [
  'index.html',
  'styles.css',
  'i18n.js',
  'data.js',
  'packer.js',
  'viewer.js',
  'app.js',
  '사용설명서_v4.docx',
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(out, file));
}

console.log(`Prepared ${files.length} web files in ${out}`);
