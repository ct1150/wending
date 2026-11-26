import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deploy() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || 'b266970852cbc371061c94c5b1fe76a9').trim();
  const workerName = (process.env.CF_WORKER_NAME || 'baishi-wending').trim();
  const publicUrl = (process.env.CF_PUBLIC_URL || 'https://wending.868656.xyz').trim();
  const sourceCommit = process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || '';

  if (!token || !token.trim()) {
    throw new Error('CLOUDFLARE_API_TOKEN is required to deploy to Cloudflare');
  }

  const manifest = JSON.parse(await readFile(path.join(root, 'release/backend/deployment.json'), 'utf8'));
  const expectedVersion = manifest.version || manifest.frontend?.version || '8.0.0';
  const expectedSha = manifest.frontend?.sha256;

  const form = new FormData();
  const metadata = {
    main_module: manifest.main_module,
    compatibility_date: manifest.compatibility_date,
    compatibility_flags: [],
    bindings: manifest.bindings ?? [],
    keep_bindings: ['secret_text'],
    annotations: {
      'workers/message': `Production ${expectedVersion}: automated CI release (${(sourceCommit || manifest.sourceCommit || '').slice(0, 12)})`,
    },
  };
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

  for (const mod of manifest.modules) {
    const bytes = await readFile(path.join(root, 'release/backend', mod.name));
    if (digest(bytes) !== mod.sha256) throw new Error(`Checksum mismatch for ${mod.name}`);
    form.append(mod.name, new Blob([bytes], { type: 'application/javascript+module' }), mod.name);
  }

  const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`;
  const authHeaders = { Authorization: `Bearer ${token.trim()}` };

  // Step 1: Upload new Worker Version
  const uploadRes = await fetch(`${apiBase}/versions`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.success || !uploadJson.result?.id) {
    throw new Error(`Cloudflare version upload failed: ${JSON.stringify(uploadJson.errors ?? uploadJson)}`);
  }
  const versionId = uploadJson.result.id;

  // Step 2: Promote Version to 100% live production traffic
  const deployRes = await fetch(`${apiBase}/deployments`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: {
        'workers/message': `Promote ${expectedVersion} to 100% production`,
      },
    }),
  });
  const deployJson = await deployRes.json();
  if (!deployRes.ok || !deployJson.success || !deployJson.result?.id) {
    throw new Error(`Cloudflare deployment promotion failed: ${JSON.stringify(deployJson.errors ?? deployJson)}`);
  }
  const deploymentId = deployJson.result.id;

  // Step 3: Verify live /healthz converges to the new version & SHA
  const healthUrl = `${publicUrl.replace(/\/$/, '')}/healthz`;
  let lastHealth = null;
  let verified = false;
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const res = await fetch(`${healthUrl}?t=${Date.now()}`);
      if (res.ok) {
        lastHealth = await res.json();
        if (lastHealth.status === 'ok' && lastHealth.version === expectedVersion && lastHealth.htmlSha256 === expectedSha) {
          verified = true;
          break;
        }
      }
    } catch {
      // Retry until edge propagation completes
    }
    if (attempt < 12) await sleep(5000);
  }

  if (!verified) {
    throw new Error(`Live /healthz (${healthUrl}) did not converge to ${expectedVersion}; last observed: ${JSON.stringify(lastHealth)}`);
  }

  console.log(JSON.stringify({ deployed: true, verified: true, workerName, publicUrl, versionId, deploymentId, health: lastHealth }, null, 2));
}

deploy().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
