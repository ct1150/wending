// Server/operator-only policy. Never construct billing evidence from browser input.
export const STORY_LIMITS = Object.freeze({ maxInputBytes:24 * 1024, maxRequestBytes:32 * 1024, maxResponseBytes:64 * 1024, maxOutputTokens:1536, timeoutMs:90000, maxMessages:8, evidenceMaxAgeMs:300000, dailyFreeNeurons:10000 });
// The owner authorized completion without experiment count or Neuron ceilings.
// Null means uncapped history, not a provider quota or a replacement allocation.
export const EXPERIMENT_LIMITS = Object.freeze({ maxCalls:null, maxNeurons:null, taskCalls:Object.freeze({ task1:null, task7:null, task8:null }) });
export const CANDIDATE_MODEL_ID = '@cf/qwen/qwen3.8-27b';
export const CANDIDATE_PROFILE = Object.freeze({
  modelId:CANDIDATE_MODEL_ID, validated:false, requestFormat:'workers-ai-messages', responseFormat:'json_schema', supportsStructuredOutput:null,
  maxInput:STORY_LIMITS.maxInputBytes, maxOutput:STORY_LIMITS.maxOutputTokens, contextTokens:262144,
  usageFields:Object.freeze(['usage.prompt_tokens', 'usage.completion_tokens', 'usage.total_tokens']),
  stopFields:Object.freeze(['choices[0].finish_reason']),
  freeBoundaryEvidence:null,
  neuronRates:Object.freeze({ inputPerMillion:40909, outputPerMillion:290909, verifiedOn:'2026-10-28', source:'https://developers.cloudflare.com/workers-ai/platform/pricing/' }),
});
// A successful catalog lookup is not validation. Promotion requires reviewed real evidence.
export const PRODUCTION_PROFILES = Object.freeze([]);
const trustedEvidence = new WeakSet();
const encoder = new TextEncoder();
function fail(code) { throw Object.assign(new Error(code), { code }); }
function finiteNonnegative(value) { return Number.isFinite(value) && value >= 0; }
function currentEvidence(value, now, requireFreshBalance = true) {
  const checked = Date.parse(value?.checkedAt);
  return Number.isFinite(now) && Number.isFinite(checked) && checked <= now && (!requireFreshBalance || (now - checked <= STORY_LIMITS.evidenceMaxAgeMs && new Date(checked).toISOString().slice(0,10) === new Date(now).toISOString().slice(0,10)));
}

// This is an explicit trusted-configuration boundary, not an authentication check.
// Only account-verification/operator code may call it, with evidence for this binding's account.
export function confirmFreeBoundaryEvidence(value, { now = Date.now() } = {}) {
  if (value?.source !== 'operator-account-verification' || value.plan !== 'workers-free' || value.hardLimit !== true || value.noGatewayCredits !== true || value.directBinding !== true || value.accountUsageVerified !== true || value.storageFreeVerified !== true || !finiteNonnegative(value.remainingNeurons) || value.remainingNeurons > STORY_LIMITS.dailyFreeNeurons || !currentEvidence(value, now)) fail('FREE_BOUNDARY_UNVERIFIED');
  const result = Object.freeze({ source:value.source, plan:value.plan, hardLimit:true, noGatewayCredits:true, directBinding:true, accountUsageVerified:true, storageFreeVerified:true, remainingNeurons:value.remainingNeurons, checkedAt:value.checkedAt });
  trustedEvidence.add(result);
  return result;
}

export function assertProviderReady({ enabled = false, modelId = CANDIDATE_MODEL_ID, env, evidence, purpose = 'production', ledger, reservationNeurons = 0, now = Date.now() } = {}) {
  if (modelId !== CANDIDATE_MODEL_ID) fail('MODEL_NOT_ALLOWED');
  if (enabled !== true) fail('INFERENCE_DISABLED');
  if (typeof env?.AI?.run !== 'function') fail('AI_BINDING_MISSING');
  if (ledger) validateLedger(ledger);
  if (!trustedEvidence.has(evidence) || !currentEvidence(evidence, now, purpose === 'probe')) fail('FREE_BOUNDARY_UNVERIFIED');
  // Reservations are immutable history, not a lifetime spend ceiling. Account
  // analytics are delayed observations; the verified Free provider enforces quota.
  if (!finiteNonnegative(reservationNeurons)) fail('ACCOUNT_QUOTA_UNAVAILABLE');
  if (purpose !== 'probe') {
    const profile = PRODUCTION_PROFILES.find(candidate => candidate.modelId === modelId && candidate.validated === true && candidate.supportsStructuredOutput === true);
    if (!profile) fail('MODEL_UNVALIDATED');
    return profile;
  }
  return CANDIDATE_PROFILE;
}

export function estimateMaxNeurons(input, { modelId = CANDIDATE_MODEL_ID } = {}) {
  if (modelId !== CANDIDATE_MODEL_ID) fail('MODEL_NOT_ALLOWED');
  if (!input || typeof input !== 'object' || !Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > STORY_LIMITS.maxMessages || input.messages.some(message => !message || !['system','user','assistant'].includes(message.role) || typeof message.content !== 'string')) fail('INPUT_INVALID');
  if (!Number.isSafeInteger(input.max_tokens) || input.max_tokens < 1 || input.max_tokens > STORY_LIMITS.maxOutputTokens) fail('OUTPUT_TOO_LARGE');
  let serialized;
  try { serialized = JSON.stringify(input); } catch { fail('INPUT_INVALID'); }
  const inputBytes = encoder.encode(serialized).byteLength;
  if (inputBytes > STORY_LIMITS.maxInputBytes) fail('INPUT_TOO_LARGE');
  // Byte-level token upper bound includes JSON/schema/system text; reserve extra chat framing.
  // No cache discounts. max_tokens must bound reasoning + visible output in the live probe.
  const inputTokens = inputBytes + 1024 + 64 * input.messages.length;
  if (inputTokens + input.max_tokens > CANDIDATE_PROFILE.contextTokens) fail('CONTEXT_TOO_LARGE');
  const rates=CANDIDATE_PROFILE.neuronRates;
  return Math.ceil((inputTokens * rates.inputPerMillion + input.max_tokens * rates.outputPerMillion) / 1000000);
}

export function createExperimentLedger() { return { schemaVersion:1, attempts:[] }; }
function validateLedger(ledger) {
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.attempts)) fail('EXPERIMENT_LEDGER_INVALID');
  const ids = new Set();
  for (const entry of ledger.attempts) {
    if (!entry || !Object.hasOwn(EXPERIMENT_LIMITS.taskCalls, entry.task) || typeof entry.attemptId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.attemptId) || ids.has(entry.attemptId) || !Number.isSafeInteger(entry.reservedNeurons) || entry.reservedNeurons < 1 || !['reserved','complete','failed','unknown'].includes(entry.status) || (entry.actualNeurons !== null && !finiteNonnegative(entry.actualNeurons))) fail('EXPERIMENT_LEDGER_INVALID');
    ids.add(entry.attemptId);
  }
  return ledger;
}
export function reserveExperiment(ledger, { task, attemptId, reservedNeurons } = {}) {
  validateLedger(ledger);
  if (!Object.hasOwn(EXPERIMENT_LIMITS.taskCalls, task) || typeof attemptId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(attemptId) || ledger.attempts.some(entry => entry.attemptId === attemptId) || !Number.isSafeInteger(reservedNeurons) || reservedNeurons < 1) fail('EXPERIMENT_ATTEMPT_INVALID');
  if (ledger.attempts.some(entry => entry.actualNeurons > entry.reservedNeurons)) fail('EXPERIMENT_BUDGET_EXHAUSTED');
  return { schemaVersion:1, attempts:[...ledger.attempts.map(entry => ({ ...entry })), { task, attemptId, reservedNeurons, actualNeurons:null, status:'reserved' }] };
}
export function settleExperiment(ledger, attemptId, { status = 'unknown', actualNeurons = null } = {}) {
  validateLedger(ledger);
  if (!ledger.attempts.some(entry => entry.attemptId === attemptId) || !['complete','failed','unknown'].includes(status) || (actualNeurons !== null && !finiteNonnegative(actualNeurons))) fail('EXPERIMENT_ATTEMPT_INVALID');
  const previous = ledger.attempts.find(entry => entry.attemptId === attemptId);
  if (previous.actualNeurons !== null && (actualNeurons === null || actualNeurons < previous.actualNeurons)) fail('EXPERIMENT_ATTEMPT_INVALID');
  return { schemaVersion:1, attempts:ledger.attempts.map(entry => entry.attemptId === attemptId ? { ...entry, status, actualNeurons } : { ...entry }) };
}

// Reconstruct deployment proof only at a trusted server composition boundary.
// The caller verifies currentPlan for the binding account; this is not evidence
// obtained from a browser or a fresh account balance measurement. Preserve the
// original checkedAt, and do not use this path to revive a stale probe snapshot.
export function restoreFreeBoundaryEvidence(value,{bindingAccountId,currentPlan,now=Date.now()}={}) {
  if(typeof bindingAccountId!=='string'||!bindingAccountId||value?.accountId!==bindingAccountId||currentPlan?.accountId!==bindingAccountId||currentPlan.source!=='operator-account-verification'||currentPlan.plan!=='workers-free'||!currentEvidence(value,now,false))fail('FREE_BOUNDARY_UNVERIFIED');
  // Reuse the proof field validator at its original observation time, rather
  // than pretending that reconstruction is another verification event.
  return confirmFreeBoundaryEvidence(value,{now:Date.parse(value.checkedAt)});
}
