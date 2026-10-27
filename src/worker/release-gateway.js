// A stable gateway for public, tested static releases. It never runs downloaded code server-side.
export function createReleaseGateway({ fallback, icon = '', repository = 'ct1150/wending', branch = 'release-channel', fetchImpl = globalThis.fetch, now = Date.now, cache = null, pollMs = 60000, timeoutMs = 7000 } = {}) {
  const maximum = 3000000;
  const encoder = new TextEncoder();
  const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
  const digest = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
  const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const version = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value);
  if (!fallback || typeof fallback.html !== 'string' || !sha(fallback.sourceCommit) || !hash(fallback.htmlSha256) || !version(fallback.version)) throw new Error('Invalid embedded release');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+$/.test(branch)) throw new Error('Invalid release source');
  const cacheKey = `https://wending-release.invalid/${repository}/${branch}/verified-v1`;
  let active = { ...fallback, htmlBytes: encoder.encode(fallback.html).byteLength, source: 'embedded' };
  let pending = null, attemptedAt = null, succeededAt = null, lastError = '', cacheLoaded = false;

  function validateManifest(value) {
    const fields = ['schemaVersion','version','sourceCommit','artifactCommit','htmlSha256','htmlBytes','artifactPath'];
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key)) || value.schemaVersion !== 1 || !version(value.version) || !sha(value.sourceCommit) || !sha(value.artifactCommit) || !hash(value.htmlSha256) || !Number.isSafeInteger(value.htmlBytes) || value.htmlBytes < 1 || value.htmlBytes > maximum || value.artifactPath !== `releases/${value.htmlSha256}.html`) throw new Error('Invalid release manifest');
    return value;
  }

  async function readBounded(response, limit) {
    const length = response.headers.get('Content-Length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Error('Release response exceeds size limit');
    if (!response.body) throw new Error('Empty release response');
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error('Release response exceeds size limit');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }

  async function download(url, limit) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          // Workers supports manual/follow only; reject every 3xx below without following it.
          const response = await fetchImpl(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: '*/*', 'Cache-Control': 'no-cache' } });
          if (!response.ok) throw new Error('Release source returned an HTTP error');
          return readBounded(response, limit);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Release refresh timed out')); }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }

  function edgeCache() { return cache ?? (typeof caches !== 'undefined' ? caches.default : null); }

  async function cacheAttempt(operation) {
    let timer;
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cache unavailable')), Math.min(timeoutMs, 750)); }),
      ]);
    } finally { clearTimeout(timer); }
  }

  async function loadCache() {
    if (cacheLoaded) return;
    cacheLoaded = true;
    try {
      const candidate = await cacheAttempt(async () => {
        const saved = await edgeCache()?.match(cacheKey);
        if (!saved) return null;
        const metadata = validateManifest(JSON.parse(saved.headers.get('X-Wending-Release')));
        const bytes = await readBounded(saved, maximum);
        if (bytes.byteLength !== metadata.htmlBytes || await digest(bytes) !== metadata.htmlSha256) return null;
        return { ...metadata, html: new TextDecoder('utf-8', { fatal:true, ignoreBOM:true }).decode(bytes), source:'remote-cache' };
      });
      // A late cache result cannot overwrite a release fetched after timeout.
      if (candidate) active = candidate;
    } catch { /* A cold edge always retains its complete embedded baseline. */ }
  }

  async function refresh() {
    await loadCache();
    attemptedAt = now();
    try {
      const manifestBytes = await download(`https://raw.githubusercontent.com/${repository}/${branch}/manifest.json`, 4096);
      const metadata = validateManifest(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(manifestBytes)));
      let html = active.html;
      if (metadata.htmlSha256 !== active.htmlSha256 || metadata.htmlBytes !== active.htmlBytes) {
        const bytes = await download(`https://raw.githubusercontent.com/${repository}/${metadata.artifactCommit}/${metadata.artifactPath}`, maximum);
        if (bytes.byteLength !== metadata.htmlBytes || await digest(bytes) !== metadata.htmlSha256) throw new Error('Release SHA-256 digest mismatch');
        html = new TextDecoder('utf-8', { fatal:true, ignoreBOM:true }).decode(bytes);
      }
      const next = { ...metadata, html, source:'remote-fetch' };
      // Body and identity are one snapshot. A failed cache write does not unpublish a verified release.
      active = next;
      succeededAt = now();
      lastError = '';
      try { await cacheAttempt(async () => edgeCache()?.put(cacheKey, new Response(html, { headers: { 'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=604800','X-Wending-Release':JSON.stringify(metadata) } }))); }
      catch { /* Cache API is best-effort and local to this edge. */ }
    } catch (error) {
      lastError = /^(Invalid release manifest|Release response exceeds size limit|Empty release response|Release source returned an HTTP error|Release refresh timed out|Release SHA-256 digest mismatch)$/.test(error?.message) ? error.message : 'Release source unavailable or invalid';
    }
  }

  async function snapshot() {
    if (!pending && (attemptedAt === null || now() - attemptedAt >= pollMs)) pending = refresh().finally(() => { pending = null; });
    if (pending) await pending;
    return active;
  }

  return {
    async fetch(request) {
      const head = request.method === 'HEAD';
      const respond = (body, status, type, extra = {}) => new Response(head ? null : body, { status, headers: { 'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra } });
      if (request.method !== 'GET' && !head) return respond('Method not allowed',405,'text/plain; charset=utf-8',{Allow:'GET, HEAD'});
      const path = new URL(request.url).pathname;
      if (path === '/favicon.ico' || path === '/favicon.svg') return respond(icon,200,'image/svg+xml');
      if (!['/','/index.html','/baishi-wending-offline.html','/healthz'].includes(path)) return respond('Not found',404,'text/plain; charset=utf-8');
      const current = await snapshot();
      if (path === '/healthz') return respond(JSON.stringify({ status:'ok',version:current.version,sourceCommit:current.sourceCommit,htmlSha256:current.htmlSha256,htmlBytes:current.htmlBytes,releaseSource:current.source,lastAttemptAt:attemptedAt,lastSuccessAt:succeededAt,lastError }),200,'application/json; charset=utf-8');
      return respond(current.html,200,'text/html; charset=utf-8',path === '/baishi-wending-offline.html' ? {'Content-Disposition':'attachment; filename="baishi-wending-offline.html"'} : {});
    },
  };
}
