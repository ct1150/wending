import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function buildWorker({ root = projectRoot, sourceCommit = process.env.SOURCE_COMMIT } = {}) {
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT must be a full 40-character Git commit SHA');
  }
  const [htmlBytes, iconBytes] = await Promise.all([
    readFile(path.join(root, 'release', 'baishi-wending-offline.html')),
    readFile(path.join(root, 'assets', 'seal.svg')),
  ]);
  const htmlSha256 = createHash('sha256').update(htmlBytes).digest('hex');
  const commit = sourceCommit.toLowerCase();
  const code = `// Temporary Worker distribution of the verified offline release.
const html = ${JSON.stringify(htmlBytes.toString('utf8'))};
const icon = ${JSON.stringify(iconBytes.toString('utf8'))};
const health = ${JSON.stringify(JSON.stringify({ status: 'ok', sourceCommit: commit, htmlSha256 }))};

export default {
  fetch(request) {
    const head = request.method === 'HEAD';
    const respond = (body, status, type, extra = {}) => new Response(head ? null : body, {
      status,
      headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
    });
    if (request.method !== 'GET' && !head) return respond('Method not allowed', 405, 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
    const pathname = new URL(request.url).pathname;
    if (pathname === '/' || pathname === '/index.html') return respond(html, 200, 'text/html; charset=utf-8');
    if (pathname === '/baishi-wending-offline.html') return respond(html, 200, 'text/html; charset=utf-8', { 'Content-Disposition': 'attachment; filename="baishi-wending-offline.html"' });
    if (pathname === '/favicon.svg' || pathname === '/favicon.ico') return respond(icon, 200, 'image/svg+xml');
    if (pathname === '/healthz') return respond(health, 200, 'application/json; charset=utf-8');
    return respond('Not found', 404, 'text/plain; charset=utf-8');
  },
};
`;
  const file = path.join(root, 'release', 'worker.mjs');
  await writeFile(file, code);
  return { file, sourceCommit: commit, htmlSha256, htmlBytes: htmlBytes.length, workerBytes: Buffer.byteLength(code) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let sourceCommit = process.env.SOURCE_COMMIT;
  if (args.length) {
    if (args.length === 2 && args[0] === '--source-commit') sourceCommit = args[1];
    else if (args.length === 1 && args[0].startsWith('--source-commit=')) sourceCommit = args[0].slice('--source-commit='.length);
    else { console.error('Usage: node scripts/build-worker.js [--source-commit <full Git SHA>]'); process.exitCode = 1; }
  }
  if (!process.exitCode) buildWorker({ sourceCommit }).then(result => console.log(`Built release/worker.mjs (${result.workerBytes} bytes); HTML SHA-256 ${result.htmlSha256}; source ${result.sourceCommit}`)).catch(error => { console.error(`Worker packaging failed: ${error.message}`); process.exitCode = 1; });
}
