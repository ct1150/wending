// Temporary operator-only entry; deliberately absent from the production graph.
import { createExperimentLedger, confirmFreeBoundaryEvidence, EXPERIMENT_LIMITS } from './story-config.js';
import { runProbe } from './story-probe.js';

export const OPERATOR_PROBE_NAME = 'wending-realtime-acceptance-v1';
const STORAGE_KEY = 'experiment-v1';
const MAX_BODY_BYTES = 1024;
const encoder = new TextEncoder();
const reply = (body, status = 200) => Response.json(body, { status, headers:{ 'cache-control':'no-store' } });
const blocked = (errorCode, status = 503) => reply({ status:'blocked', errorCode }, status);
function snapshotConfig(config) {
  try { return structuredClone(config); } catch { return null; }
}
async function authenticate(request, config) {
  if (typeof config?.operatorTokenSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(config.operatorTokenSha256)) return blocked('OPERATOR_CONFIGURATION_INVALID');
  const authorization = request.headers.get('authorization');
  if (!authorization || authorization.length > 1024 || !/^Bearer [^\s]+$/.test(authorization)) return blocked('UNAUTHORIZED', 401);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(authorization.slice(7))));
  const expected = config.operatorTokenSha256;
  let different = 0;
  for (let i = 0; i < bytes.length; i++) different |= bytes[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return different === 0 ? null : blocked('UNAUTHORIZED', 401);
}
function routeError(request) {
  const url = new URL(request.url);
  if (!['/status','/probe'].includes(url.pathname)) return blocked('NOT_FOUND', 404);
  if (request.method !== (url.pathname === '/status' ? 'GET' : 'POST')) return blocked('METHOD_NOT_ALLOWED', 405);
  if (url.search) return blocked('REQUEST_INVALID', 400);
  return null;
}
async function readAttempt(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) return { error:blocked('CONTENT_TYPE_INVALID',415) };
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return { error:blocked('REQUEST_INVALID',400) };
  const reader = request.body?.getReader();
  if (!reader) return { error:blocked('REQUEST_INVALID',400) };
  try {
    let size = 0;
    const chunks = [];
    for (;;) {
      const { done,value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return { error:blocked('REQUEST_INVALID',400) }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder('utf-8',{ fatal:true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.attemptId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.attemptId)) throw new Error();
    return { attemptId:body.attemptId };
  } catch { return { error:blocked('REQUEST_INVALID',400) }; }
  finally { reader.releaseLock(); }
}
function proof(config) {
  if (typeof config?.bindingAccountId !== 'string' || !config.bindingAccountId || config.freeBoundaryEvidence?.accountId !== config.bindingAccountId) throw new Error('FREE_BOUNDARY_UNVERIFIED');
  // Preserve checkedAt; reconstruction never refreshes the observation.
  return confirmFreeBoundaryEvidence(config.freeBoundaryEvidence);
}

// The generated deployment entry must export a subclass whose constructor calls
// super(ctx, env, trustedConfig). OPERATOR_PROBE must be a SQLite DO namespace.
export class OperatorProbeDurableObject {
  constructor(ctx, env, config) {
    this.storage = ctx.storage;
    this.env = env;
    this.config = snapshotConfig(config);
    this.queue = Promise.resolve();
  }
  async fetch(request) {
    const authError = await authenticate(request,this.config);
    if (authError) return authError;
    const error = routeError(request);
    if (error) return error;
    let attemptId;
    if (request.method === 'POST') {
      const body = await readAttempt(request);
      if (body.error) return body.error;
      attemptId = body.attemptId;
    }
    // Serialize the whole read/reserve/invoke/settle operation, including external
    // awaits, rather than relying only on the DO's storage input/output gates.
    const pending = this.queue.then(() => this.handle(attemptId));
    this.queue = pending.catch(() => {});
    try { return await pending; } catch { return blocked('OPERATOR_STORAGE_UNAVAILABLE'); }
  }
  async handle(attemptId) {
    if (!this.storage?.sql || typeof this.storage.get !== 'function' || typeof this.storage.put !== 'function') return blocked('OPERATOR_STORAGE_UNAVAILABLE');
    const stored = await this.storage.get(STORAGE_KEY);
    const record = stored === undefined ? { schemaVersion:1, ledger:createExperimentLedger(), results:{} } : stored;
    if (record?.schemaVersion !== 1 || record.ledger?.schemaVersion !== 1 || !Array.isArray(record.ledger.attempts) || !record.results || typeof record.results !== 'object' || Array.isArray(record.results)) return blocked('EXPERIMENT_LEDGER_INVALID');
    if (attemptId === undefined) {
      return reply({ schemaVersion:1, status:'ok', limits:EXPERIMENT_LIMITS, callCount:record.ledger.attempts.length, reservedNeurons:record.ledger.attempts.reduce((sum,entry) => sum + entry.reservedNeurons,0), ledger:record.ledger, results:record.results });
    }
    const previous = record.ledger.attempts.find(entry => entry.attemptId === attemptId);
    if (previous) return Object.hasOwn(record.results,attemptId) ? reply(record.results[attemptId]) : reply({ status:'already-reserved-or-unknown', attemptId, reservation:previous });
    let evidence;
    try { evidence = proof(this.config); } catch { return blocked('FREE_BOUNDARY_UNVERIFIED'); }
    const result = await runProbe({ execute:true, env:this.env, evidence, ledger:record.ledger, attemptId, task:'task1', persistLedger:async ledger => {
      // SQLite-backed KV put resolves only after the durable reservation write.
      // No AI call is made unless this awaited write succeeds.
      await this.storage.put(STORAGE_KEY,{ ...record, ledger });
      record.ledger = ledger;
    } });
    if (record.ledger.attempts.some(entry => entry.attemptId === attemptId)) {
      // runProbe exposes only allowlisted metadata: never the prompt, story or
      // reasoning text. Keep it in the same atomic durable snapshot as the ledger.
      record.results = { ...record.results, [attemptId]:result };
      try { await this.storage.put(STORAGE_KEY,record); }
      catch { return reply({ ...result, ledgerErrorCode:'LEDGER_PERSIST_FAILED' },503); }
    }
    return reply(result,result.status === 'blocked' ? 503 : 200);
  }
}

export function createOperatorProbeWorker(config) {
  const trusted = snapshotConfig(config);
  return { async fetch(request,env) {
    const authError = await authenticate(request,trusted);
    if (authError) return authError;
    const error = routeError(request);
    if (error) return error;
    if (!env?.OPERATOR_PROBE || typeof env.OPERATOR_PROBE.idFromName !== 'function' || typeof env.OPERATOR_PROBE.get !== 'function') return blocked('OPERATOR_STORAGE_UNAVAILABLE');
    try { return await env.OPERATOR_PROBE.get(env.OPERATOR_PROBE.idFromName(OPERATOR_PROBE_NAME)).fetch(request); }
    catch { return blocked('OPERATOR_STORAGE_UNAVAILABLE'); }
  } };
}
