import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  DEFAULT_ACCOUNT_ID,
  buildProductionConfig,
  buildUploadMetadata,
  deployCloudflare,
} from '../scripts/deploy-cloudflare.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');

test('buildProductionConfig produces a valid production policy bound to the verified account and knowledge corpus', () => {
  const cfg = buildProductionConfig({ accountId: DEFAULT_ACCOUNT_ID });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.mode, 'production');
  assert.equal(cfg.modelId, '@cf/zai-org/glm-4.7-flash');
  assert.equal(cfg.bindingAccountId, DEFAULT_ACCOUNT_ID);
  assert.equal(cfg.knowledge.enabled, true);
  assert.equal(cfg.knowledge.namespaceId, 'c3b136befd644391a62a8af515ac6e41');
});

test('buildUploadMetadata preserves existing secret bindings and never sends destructive migrations', () => {
  const meta = buildUploadMetadata({
    main_module: 'entry.mjs',
    compatibility_date: '2026-07-30',
    bindings: [{ name: 'AI', type: 'ai' }],
    sourceCommit: 'a'.repeat(40),
    frontend: { version: '7.1.1', htmlSha256: 'b'.repeat(64) },
  });
  assert.equal(meta.main_module, 'entry.mjs');
  assert.deepEqual(meta.keep_bindings, ['secret_text']);
  assert.equal('migrations' in meta, false);
  assert.match(meta.annotations['workers/message'], /7\.1\.1/);
});

test('deployCloudflare refuses missing token without making any network requests', async () => {
  let called = 0;
  await assert.rejects(
    () => deployCloudflare({
      token: '',
      sourceCommit: 'a'.repeat(40),
      fetchImpl: async () => { called++; throw new Error('should not fetch'); },
    }),
    /CLOUDFLARE_API_TOKEN/,
  );
  assert.equal(called, 0);
});

test('deployCloudflare uploads modules, promotes deployment to 100%, and verifies /healthz convergence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wending-cf-deploy-'));
  try {
    const commit = 'c'.repeat(40);
    const html = '<!doctype html><html><body>7.1.1</body></html>';
    const htmlSha = sha(html);
    await mkdir(path.join(root, 'release/backend'), { recursive: true });
    await writeFile(path.join(root, 'release/baishi-wending-web.html'), html);
    await writeFile(path.join(root, 'release/release.json'), JSON.stringify({
      version: '7.1.1',
      frontend: { file: 'baishi-wending-web.html', bytes: Buffer.byteLength(html), sha256: htmlSha },
    }));
    const entryCode = 'export default { fetch() { return new Response("ok"); } };';
    await writeFile(path.join(root, 'release/backend/entry.mjs'), entryCode);
    await writeFile(path.join(root, 'release/backend/deployment.json'), JSON.stringify({
      schemaVersion: 1,
      main_module: 'entry.mjs',
      compatibility_date: '2026-07-30',
      sourceCommit: commit,
      frontend: { version: '7.1.1', htmlSha256: htmlSha },
      bindings: [{ name: 'AI', type: 'ai' }],
      migrations: [],
      modules: [{ name: 'entry.mjs', type: 'esm', bytes: Buffer.byteLength(entryCode), sha256: sha(entryCode) }],
    }));

    const calls = [];
    let healthChecks = 0;
    const fakeFetch = async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET' });
      if (url.endsWith('/versions')) {
        assert.equal(init.method, 'POST');
        assert.ok(init.body instanceof FormData);
        return new Response(JSON.stringify({ success: true, result: { id: 'ver-123' } }), { status: 200 });
      }
      if (url.endsWith('/deployments')) {
        const body = JSON.parse(init.body);
        assert.deepEqual(body.versions, [{ version_id: 'ver-123', percentage: 100 }]);
        return new Response(JSON.stringify({ success: true, result: { id: 'dep-456' } }), { status: 200 });
      }
      if (url.endsWith('/healthz')) {
        healthChecks++;
        // Simulate 1 stale edge response before converging to 7.1.1
        const converged = healthChecks >= 2;
        return new Response(JSON.stringify({
          status: 'ok',
          version: converged ? '7.1.1' : '7.1.0',
          sourceCommit: converged ? commit : '0'.repeat(40),
          htmlSha256: converged ? htmlSha : '0'.repeat(64),
          htmlBytes: Buffer.byteLength(html),
          releaseSource: 'embedded',
        }), { status: 200 });
      }
      throw new Error('Unexpected URL: ' + url);
    };

    const result = await deployCloudflare({
      root,
      token: 'fake-token-for-unit-test',
      accountId: DEFAULT_ACCOUNT_ID,
      sourceCommit: commit,
      buildGatewayImpl: async () => ({ sourceCommit: commit, htmlSha256: htmlSha }),
      fetchImpl: fakeFetch,
      sleepImpl: async () => {},
      verifyAttempts: 3,
    });

    assert.equal(result.versionId, 'ver-123');
    assert.equal(result.deploymentId, 'dep-456');
    assert.equal(result.version, '7.1.1');
    assert.equal(result.verified, true);
    assert.equal(healthChecks, 2);
    assert.equal(calls.filter(c => c.method === 'POST').length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
