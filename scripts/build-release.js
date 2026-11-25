import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function main() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const singleHtmlPath = path.join(root, 'dist-single', 'index.html');
  const htmlBytes = await readFile(singleHtmlPath);
  const htmlDigest = sha256(htmlBytes);

  const releaseDir = path.join(root, 'release');
  const backendDir = path.join(releaseDir, 'backend');
  await mkdir(backendDir, { recursive: true });

  const outHtmlPath = path.join(releaseDir, 'baishi-wending-web.html');
  await writeFile(outHtmlPath, htmlBytes);

  const releaseMeta = {
    version: pkg.version,
    mode: 'roguelike-static',
    builtAt: new Date().toISOString(),
    frontend: {
      file: 'baishi-wending-web.html',
      bytes: htmlBytes.byteLength,
      sha256: htmlDigest,
    },
  };
  await writeFile(path.join(releaseDir, 'release.json'), JSON.stringify(releaseMeta, null, 2) + '\n');

  // 生成极简 Cloudflare Worker 静态托管入口（零 AI 依赖，提供 / 与 /healthz）
  const sourceCommit = process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || '0000000000000000000000000000000000000000';
  const htmlBase64 = htmlBytes.toString('base64');
  const htmlModuleSource = `export const HTML_BASE64 = ${JSON.stringify(htmlBase64)};\nexport const META = ${JSON.stringify({ version: pkg.version, sourceCommit, sha256: htmlDigest })};\n`;
  const entrySource = `import { HTML_BASE64, META } from './html-bundle.mjs';

let cachedHtml = null;
function getHtml() {
  if (!cachedHtml) {
    const bin = atob(HTML_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    cachedHtml = new TextDecoder().decode(bytes);
  }
  return cachedHtml;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, mode: 'roguelike', ...META }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return new Response(getHtml(), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  },
};
`;

  const htmlModBytes = Buffer.from(htmlModuleSource, 'utf8');
  const entryBytes = Buffer.from(entrySource, 'utf8');
  await writeFile(path.join(backendDir, 'html-bundle.mjs'), htmlModBytes);
  await writeFile(path.join(backendDir, 'entry.mjs'), entryBytes);

  const deployment = {
    main_module: 'entry.mjs',
    compatibility_date: '2026-07-30',
    sourceCommit,
    frontend: releaseMeta.frontend,
    bindings: [],
    modules: [
      { name: 'entry.mjs', sha256: sha256(entryBytes), bytes: entryBytes.byteLength },
      { name: 'html-bundle.mjs', sha256: sha256(htmlModBytes), bytes: htmlModBytes.byteLength },
    ],
  };
  await writeFile(path.join(backendDir, 'deployment.json'), JSON.stringify(deployment, null, 2) + '\n');

  console.log(JSON.stringify({ ok: true, version: pkg.version, singleHtmlBytes: htmlBytes.byteLength, sha256: htmlDigest }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
