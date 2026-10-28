import test from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../src/worker/story-config.js';
import { runProbe, summarizeProbeEvidence } from '../scripts/workers-ai-probe.js';
const { assertProviderReady } = config;

test('unknown billing blocks inference before using a binding', () => {
  assert.throws(() => assertProviderReady({ enabled:true, env:{ AI:{ run() { throw new Error('must not run'); } } } }), { code:'FREE_BOUNDARY_UNVERIFIED' });
});

const now = Date.parse('2026-10-27T10:00:00Z');
const payload = { messages:[{ role:'system', content:'只输出中文JSON。' }, { role:'user', content:'山门前发生了什么？' }], max_tokens:128, stream:false, response_format:{ type:'json_schema', json_schema:{name:'accounting_fixture',strict:true,schema:{ type:'object' }} } };
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
  assert.equal(assertProviderReady(options).modelId, '@cf/qwen/qwen3.8-27b');
  assert.throws(() => assertProviderReady({ ...options, modelId:'@cf/qwen/qwen3-30b-a3b-fp8' }), { code:'MODEL_NOT_ALLOWED' });
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
  full.messages[0].content = 'a'.repeat(config.STORY_LIMITS.maxInputBytes - bytes);
  // 25,664 input tokens at 40,909/M plus 1,536 output at 290,909/M.
  assert.equal(config.estimateMaxNeurons(full), 1497);
  assert.throws(() => config.estimateMaxNeurons(full,{modelId:'@cf/qwen/qwen3-30b-a3b-fp8'}), { code:'MODEL_NOT_ALLOWED' });
  full.messages[0].content += '山';
  assert.throws(() => config.estimateMaxNeurons(full), { code:'INPUT_TOO_LARGE' });
  assert.throws(() => config.estimateMaxNeurons({ ...payload, max_tokens:1537 }), { code:'OUTPUT_TOO_LARGE' });
});
test('experiment history exceeds former task, call and Neuron ceilings without changing prior rows', () => {
  let ledger = config.createExperimentLedger();
  for (const task of ['task1','task7','task8']) for (let i=0;i<6;i++) {
    const before=structuredClone(ledger);
    ledger=config.reserveExperiment(ledger,{task,attemptId:task+'-'+i,reservedNeurons:111});
    assert.deepEqual(ledger.attempts.slice(0,-1),before.attempts);
    ledger=config.settleExperiment(ledger,task+'-'+i,{status:i%2?'failed':'unknown'});
  }
  assert.equal(ledger.attempts.length,18);
  assert.equal(ledger.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),1998);
  assert.ok(ledger.attempts.every(row=>row.actualNeurons===null));
  assert.throws(()=>config.reserveExperiment(ledger,{task:'task7',attemptId:'task7-0',reservedNeurons:111}),{code:'EXPERIMENT_ATTEMPT_INVALID'});
  assert.throws(()=>config.reserveExperiment(ledger,{task:'other',attemptId:'new',reservedNeurons:111}),{code:'EXPERIMENT_ATTEMPT_INVALID'});
});

test('continuation preserves the original six reservations and accepts a later distinct attempt', () => {
  const original = {schemaVersion:1,attempts:[
    ...Array.from({length:4},(_,i)=>({task:'task1',attemptId:'original-task1-'+i,reservedNeurons:24,actualNeurons:null,status:'complete'})),
    {task:'task7',attemptId:'original-opening',reservedNeurons:77,actualNeurons:null,status:'failed'},
    {task:'task7',attemptId:'original-opening-v2',reservedNeurons:83,actualNeurons:null,status:'failed'},
  ]};
  const snapshot = structuredClone(original);
  let ledger = original;
  for (const [task,attemptId,reservedNeurons] of [
    ['task7','opening-v3',83],['task7','branch-a-v3',111],['task7','branch-b-v3',111],
    ['task8','player-opening',111],['task8','player-choice',111],
  ]) {
    assert.equal(assertProviderReady({enabled:true,purpose:'probe',env:{AI:{run(){}}},evidence:evidence({remainingNeurons:800}),now,ledger,reservationNeurons:reservedNeurons}).modelId,config.CANDIDATE_MODEL_ID);
    ledger = config.reserveExperiment(ledger,{task,attemptId,reservedNeurons});
    ledger = config.settleExperiment(ledger,attemptId,{status:'unknown'});
  }
  assert.deepEqual(original,snapshot);
  assert.deepEqual(ledger.attempts.slice(0,6),snapshot.attempts);
  assert.equal(ledger.attempts.length,11);
  assert.equal(ledger.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),783);
  assert.ok(ledger.attempts.every(row=>row.actualNeurons===null));
  assert.equal(config.reserveExperiment(ledger,{task:'task7',attemptId:'extra',reservedNeurons:111}).attempts.length,12);
  assert.equal(assertProviderReady({enabled:true,purpose:'probe',env:{AI:{run(){}}},ledger,evidence:evidence(),now}).modelId,config.CANDIDATE_MODEL_ID);
});
test('new completion retains the actual nine-row history beyond former twelve-call and900 ceilings', () => {
  const original={schemaVersion:1,attempts:[
    ...Array.from({length:4},(_,i)=>({task:'task1',attemptId:'initial-task1-'+i,reservedNeurons:24,actualNeurons:null,status:'complete'})),
    ...[77,83,83].map((reservedNeurons,i)=>({task:'task7',attemptId:'failed-task7-'+i,reservedNeurons,actualNeurons:null,status:'failed'})),
    {task:'task8',attemptId:'failed-player-opening',reservedNeurons:111,actualNeurons:null,status:'failed'},
    {task:'task8',attemptId:'unknown-player-opening',reservedNeurons:111,actualNeurons:null,status:'unknown'},
  ]};
  const frozen=structuredClone(original);let ledger=original;
  for(const [task,attemptId] of [['task8','new-player-opening'],['task7','new-branch-a'],['task7','new-branch-b'],['task8','new-player-choice']]){
    assert.equal(assertProviderReady({enabled:true,purpose:'probe',env:{AI:{run(){}}},evidence:evidence({remainingNeurons:0}),now,ledger,reservationNeurons:111}).modelId,config.CANDIDATE_MODEL_ID);
    ledger=config.reserveExperiment(ledger,{task,attemptId,reservedNeurons:111});
    ledger=config.settleExperiment(ledger,attemptId,{status:'unknown'});
  }
  assert.deepEqual(original,frozen);assert.deepEqual(ledger.attempts.slice(0,9),frozen.attempts);
  assert.equal(ledger.attempts.length,13);assert.equal(ledger.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),1005);
  assert.ok(ledger.attempts.every(row=>row.actualNeurons===null));
  assert.throws(()=>assertProviderReady({enabled:true,purpose:'probe',env:{AI:{run(){}}},evidence:{},now,ledger,reservationNeurons:111}),{code:'FREE_BOUNDARY_UNVERIFIED'});
});

test('unknown consumption and settled usage never recycle the initial experiment reservations', () => {
  let ledger = config.reserveExperiment(config.createExperimentLedger(), { task:'task1', attemptId:'a', reservedNeurons:400 });
  ledger = config.settleExperiment(ledger, 'a', { status:'unknown', actualNeurons:null });
  assert.equal(ledger.attempts[0].reservedNeurons, 400);
  assert.equal(ledger.attempts[0].actualNeurons, null);
  ledger = config.settleExperiment(ledger, 'a', { status:'complete', actualNeurons:2 });
  const next=config.reserveExperiment(ledger,{task:'task7',attemptId:'b',reservedNeurons:501});
  assert.deepEqual(next.attempts[0],ledger.attempts[0]);assert.equal(next.attempts[0].reservedNeurons,400);
  assert.equal(next.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),901);
  assert.throws(() => config.reserveExperiment(ledger, { task:'task7', attemptId:'a', reservedNeurons:1 }), { code:'EXPERIMENT_ATTEMPT_INVALID' });
});
test('reconciliation cannot erase known usage or permit more calls after an underestimated reservation', () => {
  let ledger = config.reserveExperiment(config.createExperimentLedger(), { task:'task1', attemptId:'a', reservedNeurons:10 });
  ledger = config.settleExperiment(ledger, 'a', { status:'complete', actualNeurons:11 });
  assert.throws(() => config.settleExperiment(ledger, 'a', { status:'unknown' }), { code:'EXPERIMENT_ATTEMPT_INVALID' });
  assert.throws(() => config.reserveExperiment(ledger, { task:'task7', attemptId:'b', reservedNeurons:1 }), { code:'EXPERIMENT_BUDGET_EXHAUSTED' });
});
test('a UTC-day change invalidates a controlled probe proof without treating analytics as quota', () => {
  const midnight = Date.parse('2026-10-28T00:00:00Z');
  const old = config.confirmFreeBoundaryEvidence({ source:'operator-account-verification', plan:'workers-free', hardLimit:true, noGatewayCredits:true, directBinding:true, accountUsageVerified:true, storageFreeVerified:true, remainingNeurons:100, checkedAt:'2026-10-27T23:59:59Z' }, {now:midnight-1000});
  const options = { enabled:true, purpose:'probe', env:{AI:{run(){}}}, now:midnight, evidence:old };
  assert.throws(() => assertProviderReady(options), {code:'FREE_BOUNDARY_UNVERIFIED'});
  assert.equal(assertProviderReady({...options,now,evidence:evidence({remainingNeurons:1}),reservationNeurons:111}).modelId,config.CANDIDATE_MODEL_ID);
});
test('historical reservations do not become a permanent quota ceiling for verified Free probes', () => {
  const ledger={schemaVersion:1,attempts:[{task:'task7',attemptId:'historical-unknown',reservedNeurons:10001,actualNeurons:null,status:'unknown'}]};
  const original=structuredClone(ledger);
  const options={enabled:true,purpose:'probe',env:{AI:{run(){}}},evidence:evidence({remainingNeurons:0}),ledger,now,reservationNeurons:111};
  assert.equal(assertProviderReady(options).modelId,config.CANDIDATE_MODEL_ID);
  assert.deepEqual(ledger,original);
  assert.throws(()=>assertProviderReady({...options,reservationNeurons:NaN}),{code:'ACCOUNT_QUOTA_UNAVAILABLE'});
  assert.throws(()=>assertProviderReady({...options,evidence:{...options.evidence,plan:'workers-paid'}}),{code:'FREE_BOUNDARY_UNVERIFIED'});
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
test('malformed experiment history blocks inference before a provider call', () => {
  assert.throws(() => assertProviderReady({ enabled:true, env:{ AI:{ run() {} } }, ledger:{ attempts:Array(12).fill({ reservedNeurons:1 }) }, purpose:'probe' }), { code:'EXPERIMENT_LEDGER_INVALID' });
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
    assert.equal(model, '@cf/qwen/qwen3.8-27b');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].attempts[0].status, 'reserved');
    assert.equal(input.stream, false);
    assert.equal(input.response_format.type, 'json_schema');
    assert.deepEqual(input.chat_template_kwargs,{enable_thinking:false});
    assert.equal(input.response_format.json_schema.name,'cultivation_probe');
    assert.equal(input.response_format.json_schema.strict,true);
    assert.equal(input.response_format.json_schema.schema.type,'object');
    assert.equal(input.response_format.json_schema.schema.additionalProperties,false);
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

test('probe inspects both reasoning aliases and accepts the verified model latency allowance without exposing content',async()=>{
  for(const [fields,present,chars,substantive] of [
    [{reasoning:' \n'},true,2,false],
    [{reasoning_content:'\n',reasoning:'private'},true,8,true],
    [{reasoning_content:'private',reasoning:'\n'},true,8,true],
    [{reasoning_content:null,reasoning:null},false,0,false],
  ]){
    const env={AI:{async run(model){return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({scene:'你来到山门。',choices:['入门','等待']}),...fields}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}};}}};
    const result=await runProbe({execute:true,env,evidence:evidence(),ledger:config.createExperimentLedger(),attemptId:'reasoning-alias',now:()=>now,timeoutMs:60000,persistLedger:async()=>{}});
    assert.equal(result.status,'passed');assert.equal(result.reasoningPresent,present);assert.equal(result.reasoningChars,chars);assert.equal(result.reasoningNonWhitespacePresent,substantive);
    assert.doesNotMatch(JSON.stringify(result),/private|reasoning_content|"reasoning"/);
  }
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

test('message-only binding quota and busy errors are recognized without refunding probe reservations',async()=>{
  for(const [prefix,want] of [[3036,'FREE_QUOTA_EXHAUSTED'],[3040,'PROVIDER_BUSY']]){
    const error=new Error(prefix+': private-upstream-detail');error.name='CustomUpstreamError';
    let calls=0,final;
    const result=await runProbe({execute:true,env:{AI:{run(){calls++;throw error;}}},evidence:evidence(),ledger:config.createExperimentLedger(),attemptId:'binding-error',now:()=>now,persistLedger:async ledger=>{final=ledger;}});
    assert.equal(result.errorCode,want);assert.equal(result.status,'failed');assert.equal(calls,1);
    assert.equal(final.attempts[0].status,'unknown');assert.equal(final.attempts[0].reservedNeurons,223);
    assert.equal(final.attempts[0].actualNeurons,null);assert.equal(result.actualNeurons,null);
    assert.doesNotMatch(JSON.stringify({result,final}),/private-upstream-detail|CustomUpstreamError/);
  }
});

test('probe message fallback ignores incidental digits and preserves structured-code precedence',async()=>{
  for(const [error,want] of [
    ...['8007: private-upstream-detail','upstream 3036: private-upstream-detail',' 3036: private-upstream-detail','30360: private-upstream-detail','3036 private-upstream-detail','429: private-upstream-detail','PROVIDER_TIMEOUT: private-upstream-detail'].map(message=>[new Error(message),'PROVIDER_FAILED']),
    [Object.assign(new Error('3036: private-upstream-detail'),{code:'OUTPUT_TOO_LARGE'}),'OUTPUT_TOO_LARGE'],
    [Object.assign(new Error('3036: private-upstream-detail'),{code:8007,errors:[{code:3040}]}),'PROVIDER_FAILED'],
    [Object.assign(new Error('3036: private-upstream-detail'),{errors:[{code:8007}]}),'PROVIDER_FAILED'],
    [Object.assign(new Error('3036: private-upstream-detail'),{code:3040}),'PROVIDER_BUSY'],
  ]){
    let calls=0,final;
    const result=await runProbe({execute:true,env:{AI:{run(){calls++;throw error;}}},evidence:evidence(),ledger:config.createExperimentLedger(),attemptId:'binding-error',now:()=>now,persistLedger:async ledger=>{final=ledger;}});
    assert.equal(result.errorCode,want);assert.equal(calls,1);assert.equal(result.status,'failed');
    assert.equal(final.attempts[0].status,'unknown');assert.equal(final.attempts[0].reservedNeurons,223);
    assert.equal(final.attempts[0].actualNeurons,null);
    assert.doesNotMatch(JSON.stringify({result,final}),/private-upstream-detail/);
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
