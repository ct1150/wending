import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampAppVersion } from './app-version.js';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };

export async function createRequestHandler(root = defaultRoot) {
  const base = await realpath(root);
  return async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    try {
      // Decode before normalization so encoded traversal is rejected too.
      const raw = decodeURIComponent((request.url || '/').split('?')[0]);
      if (raw.includes('\0') || raw.includes('\\') || raw.split('/').some(part => part === '..' || part.startsWith('.'))) { response.writeHead(403).end('Forbidden'); return; }
      if (raw === '/baishi-wending-offline.html') {
        response.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(request.method === 'HEAD' ? undefined : '离线版已停止提供，请返回首页在线游玩。');
        return;
      }
      const candidate = path.resolve(base, '.' + raw);
      if (candidate !== base && !candidate.startsWith(base + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
      let file = await realpath(candidate);
      if (file !== base && !file.startsWith(base + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
      if ((await stat(file)).isDirectory()) file = await realpath(path.join(file, 'index.html'));
      if (file !== base && !file.startsWith(base + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
      let content = await readFile(file);
      if (file === path.join(base, 'index.html') && content.includes('<meta name="application-version" content="dev" />')) {
        const pkg = JSON.parse(await readFile(path.join(base, 'package.json'), 'utf8'));
        content = stampAppVersion(content.toString(), pkg.version);
      }
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500;
      response.writeHead(status).end(status === 500 ? 'Server error' : status === 400 ? 'Bad request' : 'Not found');
    }
  };
}

export async function createDevServer(root = defaultRoot) {
  return createServer(await createRequestHandler(root));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); const portIndex = args.indexOf('--port');
  const portValue = args.find(arg => arg.startsWith('--port='))?.split('=')[1] ?? (portIndex >= 0 ? args[portIndex + 1] : undefined) ?? process.env.PORT ?? '5173';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('PORT/--port must be an integer from 0 to 65535'); process.exitCode = 1; }
  else {
    const server = await createDevServer();
    server.on('error', error => { console.error(`Dev server failed: ${error.message}`); process.exitCode = 1; });
    server.listen(port, '0.0.0.0', () => console.log(`百世问鼎: http://0.0.0.0:${server.address().port}`));
  }
}
