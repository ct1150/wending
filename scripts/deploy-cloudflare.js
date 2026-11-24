import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGateway } from './build-gateway.js';
import { GLM_MODEL_ID } from '../src/worker/story-config.js';
import { STORY_PRODUCTION_VERSIONS } from '../src/worker/story-production.js';

export const DEFAULT_ACCOUNT_ID = 'b266970852cbc371061c94c5b1fe76a9';
export const DEFAULT_WORKER_NAME = 'baishi-wending';
export const DEFAULT_PUBLIC_URL = 'https://baishi-wending.ct1150.workers.dev';
export const DEFAULT_KNOWLEDGE_CORPUS_VERSION = 'fanren-full-v1-b4a4d1c0329acb9f5ec2';
export const DEFAULT_KNOWLEDGE_NAMESPACE_ID = 'c3b136befd644391a62a8af515ac6e41';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const digest = (buf) => createHash('sha256').update(buf).digest('hex');

export function buildProductionConfig({
  accountId = DEFAULT_ACCOUNT_ID,
  corpusVersion = DEFAULT_KNOWLEDGE_CORPUS_VERSION,
  knowledgeNamespaceId = DEFAULT_KNOWLEDGE_NAMESPACE_ID,
} = {}) {
  return {
    enabled: true,
    mode: 'production',
    modelId: GLM_MODEL_ID,
    bindingAccountId: accountId,
    currentPlan: {
      accountId,
      source: 'operator-account-verification',
      plan: 'workers-free',
    },
    freeBoundaryProof: {
      accountId,
      source: 'operator-account-verification',
      plan: 'workers-free',
      hardLimit: true,
      noGatewayCredits: true,
      directBinding: true,
      accountUsageVerified: true,
      storageFreeVerified: true,
      remainingNeurons: 6167,
      checkedAt: '2026-10-28T16:34:32.885Z',
    },
    ...STORY_PRODUCTION_VERSIONS,
    knowledge: {
      enabled: true,
      corpusVersion,
      namespaceId: knowledgeNamespaceId,
    },
  };
}

export function buildUploadMetadata(manifest) {
  return {
    main_module: manifest.main_module,
    compatibility_date: manifest.compatibility_date,
    compatibility_flags: [],
    bindings: manifest.bindings,
    keep_bindings: ['secret_text'],
    annotations: {
      'workers/message': `Production ${manifest.frontend.version}: automated CI release (${manifest.sourceCommit.slice(0, 12)})`,
    },
  };
}

export async function deployCloudflare({
  root = projectRoot,
  token = process.env.CLOUDFLARE_API_TOKEN,
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID,
  workerName = process.env.CF_WORKER_NAME || DEFAULT_WORKER_NAME,
  publicUrl = process.env.CF_PUBLIC_URL || DEFAULT_PUBLIC_URL,
  sourceCommit = process.env.GITHUB_SHA || process.env.SOURCE_COMMIT,
  buildGatewayImpl = buildGateway,
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  verifyAttempts = 12,
  verifyIntervalMs = 5000,
} = {}) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('CLOUDFLARE_API_TOKEN is required to deploy to Cloudflare');
  }
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/.test(accountId.trim())) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID must be a 32-character hex account ID');
  }
  if (typeof sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error('A full 40-character sourceCommit (GITHUB_SHA or SOURCE_COMMIT) is required');
  }

  const htmlPath = path.join(root, 'release/baishi-wending-web.html');
  const releaseMetaPath = path.join(root, 'release/release.json');
  const htmlBytes = await readFile(htmlPath);
  const releaseMeta = JSON.parse(await readFile(releaseMetaPath, 'utf8'));
  const htmlSha256 = digest(htmlBytes);
  if (releaseMeta.frontend?.bytes !== htmlBytes.byteLength || releaseMeta.frontend?.sha256 !== htmlSha256) {
    throw new Error('Verified frontend HTML does not match release/release.json');
  }

  const production = buildProductionConfig({ accountId: accountId.trim() });
  await buildGatewayImpl({ root, sourceCommit, production });

  const manifestPath = path.join(root, 'release/backend/deployment.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.modules.some((m) => /tester|operator|acceptance|experiment/.test(m.name))) {
    throw new Error('Production backend manifest must never include tester or operator modules');
  }

  const form = new FormData();
  const metadata = buildUploadMetadata(manifest);
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

  for (const mod of manifest.modules) {
    const modBytes = await readFile(path.join(root, 'release/backend', mod.name));
    if (digest(modBytes) !== mod.sha256) {
      throw new Error(`Module SHA-256 mismatch: ${mod.name}`);
    }
    form.append(mod.name, new Blob([modBytes], { type: 'application/javascript+module' }), mod.name);
  }

  const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/workers/scripts/${workerName}`;
  const authHeaders = { Authorization: `Bearer ${token.trim()}` };

  const uploadRes = await fetchImpl(`${apiBase}/versions`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.success || !uploadJson.result?.id) {
    throw new Error(`Cloudflare version upload failed: ${JSON.stringify(uploadJson.errors ?? uploadJson)}`);
  }
  const versionId = uploadJson.result.id;

  const deployRes = await fetchImpl(`${apiBase}/deployments`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: {
        'workers/message': `Promote ${manifest.frontend.version} (${sourceCommit.slice(0, 12)}) to 100% production`,
      },
    }),
  });
  const deployJson = await deployRes.json();
  if (!deployRes.ok || !deployJson.success || !deployJson.result?.id) {
    throw new Error(`Cloudflare deployment promotion failed: ${JSON.stringify(deployJson.errors ?? deployJson)}`);
  }
  const deploymentId = deployJson.result.id;

  const healthUrl = `${publicUrl.replace(/\/$/, '')}/healthz`;
  let lastHealth = null;
  let verified = false;
  for (let attempt = 1; attempt <= verifyAttempts; attempt++) {
    try {
      const healthRes = await fetchImpl(healthUrl);
      if (healthRes.ok) {
        lastHealth = await healthRes.json();
        if (
          lastHealth.status === 'ok' &&
          lastHealth.version === manifest.frontend.version &&
          lastHealth.sourceCommit === sourceCommit &&
          lastHealth.htmlSha256 === htmlSha256 &&
          lastHealth.htmlBytes === htmlBytes.byteLength
        ) {
          verified = true;
          break;
        }
      }
    } catch {
      // Retry until edge propagation converges.
    }
    if (attempt < verifyAttempts) await sleepImpl(verifyIntervalMs);
  }

  if (!verified) {
    throw new Error(`Live /healthz did not converge to ${manifest.frontend.version} (${sourceCommit.slice(0, 12)}); last observed: ${JSON.stringify(lastHealth)}`);
  }

  return {
    deployed: true,
    verified: true,
    workerName,
    version: manifest.frontend.version,
    sourceCommit,
    htmlSha256,
    htmlBytes: htmlBytes.byteLength,
    moduleCount: manifest.modules.length,
    versionId,
    deploymentId,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deployCloudflare()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error?.message || 'Cloudflare deployment failed');
      process.exitCode = 1;
    });
}
