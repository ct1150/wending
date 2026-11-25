import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (buf) => createHash('sha256').update(buf).digest('hex');

async function deploy() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'b266970852cbc371061c94c5b1fe76a9';
  const workerName = process.env.CF_WORKER_NAME || 'baishi-wending';
  const publicUrl = process.env.CF_PUBLIC_URL || 'https://baishi-wending.ct1150.workers.dev';

  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required');

  const manifest = JSON.parse(await readFile(path.join(root, 'release/backend/deployment.json'), 'utf8'));
  const form = new FormData();
  const metadata = {
    main_module: manifest.main_module,
    compatibility_date: manifest.compatibility_date,
    bindings: manifest.bindings,
  };
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');

  for (const mod of manifest.modules) {
    const bytes = await readFile(path.join(root, 'release/backend', mod.name));
    if (digest(bytes) !== mod.sha256) throw new Error(`Checksum mismatch for ${mod.name}`);
    form.append(mod.name, new Blob([bytes], { type: 'application/javascript+module' }), mod.name);
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(`Cloudflare upload failed: ${JSON.stringify(body)}`);
  }

  const health = await fetch(`${publicUrl}/healthz`).then((r) => r.json()).catch(() => null);
  console.log(JSON.stringify({ deployed: true, workerName, publicUrl, health }));
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
