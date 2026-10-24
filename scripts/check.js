import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', '.wrangler', 'node_modules', 'dist', 'release']);
async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(file));
    else if (entry.isFile() && file.endsWith('.js')) files.push(file);
  }
  return files;
}
const files = (await collect(root)).sort();
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr || result.error?.message); failed = true; }
}
if (failed) process.exitCode = 1;
else console.log(`Syntax checked ${files.length} JavaScript files.`);
