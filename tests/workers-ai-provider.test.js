import test from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../src/worker/story-config.js';
import { runProbe, summarizeProbeEvidence } from '../scripts/workers-ai-probe.js';
const { assertProviderReady } = config;

test('unknown billing blocks inference before using a binding', () => {
  assert.throws(() => assertProviderReady({ enabled:true, env:{ AI:{ run() { throw new Error('must not run'); } } } }), { code:'FREE_BOUNDARY_UNVERIFIED' });
});

const now = Date.parse('2026-10-27T10:00:00Z');
const payload = { messages:[{ role:'system', content:'只输出中文JSON。' }, { role:'user', content:'山门前发生了什么？' }], max_tokens:128, stream:false, response_format:{ type:'json_schema', json_schema:{ type:'object' } } };
function evidence(overrides = {}) {
  return config.confirmFreeBoundaryEvidence({ source:'operator-account-verification', plan:'workers-free', hardLimit:true, noGatewayCredits:true, directBinding:true, accountUsageVerified:true, storageFreeVerified:true, remainingNeurons:9000, checkedAt:new Date(now).toISOString(), ...overrides }, { now });
}
test('disabled default and unvalidated production profile cannot be bypassed by a model name', () => {
  assert.throws(() => assertProviderReady(), { code:'INFERENCE_DISABLED' });
  assert.throws(() => assertProviderReady({ enabled:true, env:{ AI:{ run() {} } }, evidence:evidence(), now }), { code:'MODEL_UNVALIDATED' });
});
test('only branded current trusted server evidence unlocks an explicit candidate probe', () => {
  const trusted = evidence();
  const options = { enabled:true, purpose:'probe', env:{ AI:{ run() {} } }, evidence:trusted, now };
  assert.equal(assertProviderReady(options).modelId, '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.throws(() => assertProviderReady({ ...options, evidence:JSON.parse(JSON.stringify(trusted)) }), { code:'FREE_BOUNDARY_UNVERIFIED' });
  assert.throws(() => assertProviderReady({ ...options, now:now + 300001 }), { code:'FREE_BOUNDARY_UNVERIFIED' });
  assert.throws(() => evidence({ plan:'workers-paid' }), { code:'FREE_BOUNDARY_UNVERIFIED' });
  assert.throws(() => evidence({ noGatewayCredits:false }), { code:'FREE_BOUNDARY_UNVERIFIED' });
  assert.throws(() => evidence({ accountUsageVerified:false }), { code:'FREE_BOUNDARY_UNVERIFIED' });
});
test('reservation accounts for every UTF8 byte, schema, framing and full output ceiling', () => {
  const ascii = { ...payload, messages:[{ role:'user', content:'a' }] };
  const chinese = { ...payload, messages:[{ role:'user', content:'山' }] };
  assert.ok(config.estimateMaxNeurons(chinese) >= config.estimateMaxNeurons(ascii));
  const full = { messages:[{role:'user',content:''}], max_tokens:1536 };
  const bytes = new TextEncoder().encode(JSON.stringify(full)).length;
  full.messages[0].content = 'a'.repeat(12288 - bytes);
  assert.equal(config.estimateMaxNeurons(full), 109);
  full.messages[0].content += '山';
  assert.throws(() => config.estimateMaxNeurons(full), { code:'INPUT_TOO_LARGE' });
  assert.throws(() => config.estimateMaxNeurons({ ...payload, max_tokens:1537 }), { code:'OUTPUT_TOO_LARGE' });
});
test('one shared bounded experiment ledger enforces task caps, total calls and total reservation', () => {
  let ledger = config.createExperimentLedger();
  for (let i = 0; i < 4; i++) ledger = config.reserveExperiment(ledger, { task:'task1', attemptId:`task1-${i}`, reservedNeurons:80 });
  assert.throws(() => config.reserveExperiment(ledger, { task:'task1', attemptId:'fifth', reservedNeurons:1 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
  for (let i = 0; i < 4; i++) ledger = config.reserveExperiment(ledger, { task:'task7', attemptId:`task7-${i}`, reservedNeurons:80 });
  for (let i = 0; i < 2; i++) ledger = config.reserveExperiment(ledger, { task:'task8', attemptId:`task8-${i}`, reservedNeurons:80 });
  assert.equal(ledger.attempts.length, 10);
  assert.throws(() => config.reserveExperiment(ledger, { task:'task8', attemptId:'eleventh', reservedNeurons:1 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
  const large = config.reserveExperiment(config.createExperimentLedger(), { task:'task1', attemptId:'large', reservedNeurons:799 });
  assert.throws(() => config.reserveExperiment(large, { task:'task7', attemptId:'over', reservedNeurons:2 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
});
test('unknown consumption and settled usage never recycle the initial experiment reservations', () => {
  let ledger = config.reserveExperiment(config.createExperimentLedger(), { task:'task1', attemptId:'a', reservedNeurons:400 });
  ledger = config.settleExperiment(ledger, 'a', { status:'unknown', actualNeurons:null });
  assert.equal(ledger.attempts[0].reservedNeurons, 400);
  assert.equal(ledger.attempts[0].actualNeurons, null);
  ledger = config.settleExperiment(ledger, 'a', { status:'complete', actualNeurons:2 });
  assert.throws(() => config.reserveExperiment(ledger, { task:'task7', attemptId:'b', reservedNeurons:401 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
  assert.throws(() => config.reserveExperiment(ledger, { task:'task7', attemptId:'a', reservedNeurons:1 }), { code:'EXPERIMENT_ATTEMPT_INVALID' });
});
test('reconciliation cannot erase known usage or permit more calls after an underestimated reservation', () => {
  let ledger = config.reserveExperiment(config.createExperimentLedger(), { task:'task1', attemptId:'a', reservedNeurons:10 });
  ledger = config.settleExperiment(ledger, 'a', { status:'complete', actualNeurons:11 });
  assert.throws(() => config.settleExperiment(ledger, 'a', { status:'unknown' }), { code:'EXPERIMENT_ATTEMPT_INVALID' });
  assert.throws(() => config.reserveExperiment(ledger, { task:'task7', attemptId:'b', reservedNeurons:1 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
});
test('a UTC-day change and insufficient account quota both block a controlled probe', () => {
  const midnight = Date.parse('2026-10-28T00:00:00Z');
  const old = config.confirmFreeBoundaryEvidence({ source:'operator-account-verification', plan:'workers-free', hardLimit:true, noGatewayCredits:true, directBinding:true, accountUsageVerified:true, storageFreeVerified:true, remainingNeurons:100, checkedAt:'2026-10-27T23:59:59Z' }, {now:midnight-1000});
  const options = { enabled:true, purpose:'probe', env:{AI:{run(){}}}, now:midnight, evidence:old };
  assert.throws(() => assertProviderReady(options), {code:'FREE_BOUNDARY_UNVERIFIED'});
  assert.throws(() => assertProviderReady({...options,now,evidence:evidence({remainingNeurons:1}),reservationNeurons:2}), {code:'ACCOUNT_QUOTA_UNAVAILABLE'});
});
test('sequential probes cannot reuse a quota snapshot already committed to unresolved reservations', () => {
  const trusted = evidence({ remainingNeurons:40 });
  const options = { enabled:true, purpose:'probe', env:{AI:{run(){}}}, evidence:trusted, now };
  let ledger = config.createExperimentLedger();
  assert.equal(assertProviderReady({ ...options, ledger, reservationNeurons:30 }).modelId, '@cf/qwen/qwen3-30b-a3b-fp8');
  ledger = config.reserveExperiment(ledger, { task:'task1', attemptId:'first-probe', reservedNeurons:30 });
  ledger = config.settleExperiment(ledger, 'first-probe', { status:'unknown', actualNeurons:null });
  assert.throws(() => assertProviderReady({ ...options, ledger, reservationNeurons:30 }), { code:'ACCOUNT_QUOTA_UNAVAILABLE' });
  assert.equal(assertProviderReady({ ...options, ledger, reservationNeurons:10 }).modelId, '@cf/qwen/qwen3-30b-a3b-fp8');
  // Even a newer snapshot may already reflect some calls: deliberately double-count all
  // experiment commitments rather than claiming a reliable observed remaining balance.
  ledger = config.settleExperiment(ledger, 'first-probe', { status:'complete', actualNeurons:1 });
  assert.throws(() => assertProviderReady({ ...options, evidence:evidence({remainingNeurons:40}), ledger, reservationNeurons:11 }), { code:'ACCOUNT_QUOTA_UNAVAILABLE' });
});
test('production remains unvalidated without treating a five-minute probe balance as a lifetime limit', () => {
  const trusted = evidence();
  assert.throws(() => assertProviderReady({enabled:true,env:{AI:{run(){}}},evidence:trusted,now:now+86400000,purpose:'production'}), {code:'MODEL_UNVALIDATED'});
  assert.equal(trusted.checkedAt, '2026-10-27T10:00:00.000Z');
});
test('paid or unknown models cannot be selected', () => {
  assert.throws(() => assertProviderReady({ modelId:'@cf/moonshotai/kimi-k2.6' }), { code:'MODEL_NOT_ALLOWED' });
});
test('missing AI binding blocks inference', () => {
  assert.throws(() => assertProviderReady({ enabled:true, env:{} }), { code:'AI_BINDING_MISSING' });
});
test('exhausted experiment budget blocks inference', () => {
  assert.throws(() => assertProviderReady({ enabled:true, env:{ AI:{ run() {} } }, ledger:{ attempts:Array(10).fill({ reservedNeurons:1 }) }, purpose:'probe' }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
});

test('probe requires explicit execution, trusted evidence and durable pre-reservation before inference', async () => {
  let calls = 0;
  const env = { AI:{ async run() { calls++; throw new Error('should not execute'); } } };
  const options = { env, evidence:evidence(), ledger:config.createExperimentLedger(), attemptId:'probe-one', now:() => now, persistLedger:async () => {} };
  assert.equal((await runProbe(options)).status, 'blocked');
  assert.equal((await runProbe({ ...options, execute:true, evidence:{} })).errorCode, 'FREE_BOUNDARY_UNVERIFIED');
  assert.equal((await runProbe({ ...options, execute:true, persistLedger:async () => { throw new Error('disk unavailable secret'); } })).errorCode, 'LEDGER_PERSIST_FAILED');
  assert.equal(calls, 0);
});
test('probe records genuine response metadata while its result omits story and reasoning text', async () => {
  const saved = [];
  const env = { AI:{ async run(model, input) {
    assert.equal(model, '@cf/qwen/qwen3-30b-a3b-fp8');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].attempts[0].status, 'reserved');
    assert.equal(input.stream, false);
    assert.equal(input.response_format.type, 'json_schema');
    return { model, choices:[{ finish_reason:'stop', message:{ content:JSON.stringify({ scene:'松风吹过山门，你见一位道童。', choices:['上前问路','静候片刻'] }), reasoning_content:'private-secret-thought' } }], usage:{ prompt_tokens:200, completion_tokens:100, total_tokens:300 } };
  } } };
  const result = await runProbe({ execute:true, env, evidence:evidence(), ledger:config.createExperimentLedger(), attemptId:'probe-one', now:() => now, persistLedger:async ledger => saved.push(ledger) });
  assert.equal(result.status, 'passed');
  assert.equal(result.structuredOutputPassed, true);
  assert.equal(result.chinesePassed, true);
  assert.equal(result.reasoningPresent, true);
  assert.equal(result.usage.promptTokens, 200);
  assert.equal(result.actualNeurons, null);
  assert.equal(saved[1].attempts[0].actualNeurons, null);
  assert.ok(!JSON.stringify(result).includes('private-secret'));
  assert.deepEqual(summarizeProbeEvidence([result]).structure, { passed:1, attempted:1, ratio:1 });
});
test('probe rejects truncated or oversized responses and keeps unknown consumption reserved', async () => {
  for (const response of [
    { choices:[{finish_reason:'length',message:{content:'{}'}}] },
    { response:'x'.repeat(65537), privateToken:'secret' },
  ]) {
    let final;
    const result = await runProbe({ execute:true, env:{AI:{async run(){return response;}}}, evidence:evidence(), ledger:config.createExperimentLedger(), attemptId:'bad-response', now:() => now, persistLedger:async ledger => {final=ledger;} });
    assert.equal(result.status, 'failed');
    assert.equal(result.actualNeurons, null);
    assert.ok(final.attempts[0].reservedNeurons > 0);
    assert.equal(final.attempts[0].actualNeurons, null);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
});
test('timeout and provider exhaustion never trigger retry or fallback', async () => {
  for (const behavior of ['timeout',3036,3040]) {
    let calls = 0, final;
    const result = await runProbe({ execute:true, env:{AI:{run(){calls++; if (behavior === 'timeout') return new Promise(() => {}); throw Object.assign(new Error('sensitive provider text'), {code:behavior});}}}, evidence:evidence(), ledger:config.createExperimentLedger(), attemptId:'failed-call', now:() => now, timeoutMs:5, persistLedger:async ledger => {final=ledger;} });
    assert.equal(calls, 1);
    assert.equal(result.errorCode, behavior === 'timeout' ? 'PROVIDER_TIMEOUT' : behavior === 3036 ? 'FREE_QUOTA_EXHAUSTED' : 'PROVIDER_BUSY');
    assert.equal(final.attempts[0].status, 'unknown');
    assert.equal(final.attempts[0].actualNeurons, null);
    assert.ok(!JSON.stringify(result).includes('sensitive'));
  }
});

test('persisted deployment proof restores only for exact binding account/current Free plan without refreshing snapshot time',()=>{
  const persisted={...evidence(),accountId:'binding-account'},later=now+86400000;
  const options={bindingAccountId:'binding-account',currentPlan:{accountId:'binding-account',plan:'workers-free',source:'operator-account-verification'},now:later};
  const restored=config.restoreFreeBoundaryEvidence(persisted,options);
  assert.equal(restored.checkedAt,persisted.checkedAt);
  assert.throws(()=>assertProviderReady({enabled:true,env:{AI:{run(){}}},evidence:restored,now:later}),{code:'MODEL_UNVALIDATED'});
  assert.throws(()=>assertProviderReady({enabled:true,env:{AI:{run(){}}},purpose:'probe',evidence:restored,now:later}),{code:'FREE_BOUNDARY_UNVERIFIED'});
  for(const overrides of [{bindingAccountId:'other'},{currentPlan:null},{currentPlan:{...options.currentPlan,plan:'workers-paid'}},{currentPlan:{...options.currentPlan,accountId:'other'}}])assert.throws(()=>config.restoreFreeBoundaryEvidence(persisted,{...options,...overrides}),{code:'FREE_BOUNDARY_UNVERIFIED'});
});
