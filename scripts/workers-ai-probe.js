import { readFile, open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runProbe } from '../src/worker/story-probe.js';
export { runProbe, summarizeProbeEvidence } from '../src/worker/story-probe.js';

const fail = code => Object.assign(new Error(code), { code });

async function main(args) {
  if (!args.includes('--execute')) {
    process.stdout.write(JSON.stringify(await runProbe(), null, 2) + '\n');
    return;
  }
  const value = flag => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1]; };
  const operatorPath = value('--operator'), ledgerPath = value('--ledger'), attemptId = value('--attempt');
  if (!operatorPath || !ledgerPath || !attemptId) throw fail('PROBE_CONFIGURATION_INVALID');
  const file = resolve(ledgerPath), lock = `${file}.lock`;
  // Single local operator process; no automatic stale-lock recovery or ledger reset.
  const handle = await open(lock, 'wx');
  try {
    const ledger = JSON.parse(await readFile(file, 'utf8'));
    const operator = await import(pathToFileURL(resolve(operatorPath)).href);
    const trusted = await operator.default();
    const persistLedger = async next => {
      const temporary = `${file}.${process.pid}.tmp`;
      const output = await open(temporary, 'wx', 0o600);
      try { await output.writeFile(JSON.stringify(next, null, 2) + '\n'); await output.sync(); }
      finally { await output.close(); }
      await rename(temporary, file);
    };
    const result = await runProbe({ execute:true, env:trusted.env, evidence:trusted.evidence, ledger, persistLedger, attemptId, task:value('--task') ?? 'task1' });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'passed') process.exitCode = 1;
  } finally { await handle.close(); await unlink(lock); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => { process.stderr.write('{"status":"blocked","errorCode":"PROBE_CONFIGURATION_OR_LEDGER_UNAVAILABLE"}\n'); process.exitCode = 1; });
}
