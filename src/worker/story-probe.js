import { CANDIDATE_MODEL_ID, STORY_LIMITS, assertProviderReady, estimateMaxNeurons, reserveExperiment, settleExperiment } from './story-config.js';

const fail = code => Object.assign(new Error(code), { code });
const safeCodes = new Set(['INFERENCE_DISABLED','MODEL_NOT_ALLOWED','AI_BINDING_MISSING','FREE_BOUNDARY_UNVERIFIED','ACCOUNT_QUOTA_UNAVAILABLE','MODEL_UNVALIDATED','EXPERIMENT_BUDGET_EXHAUSTED','EXPERIMENT_LEDGER_INVALID','EXPERIMENT_ATTEMPT_INVALID','INPUT_TOO_LARGE','INPUT_INVALID','OUTPUT_TOO_LARGE','LEDGER_PERSIST_FAILED','PROBE_CONFIGURATION_INVALID','PROVIDER_TIMEOUT','PROVIDER_RESPONSE_TOO_LARGE','MODEL_RESPONSE_MISMATCH','PROVIDER_RESPONSE_INVALID']);
function errorCode(error) {
  // Binding exceptions expose only name/message; never retain the message text.
  const code = error?.code ?? error?.errors?.[0]?.code ?? (typeof error?.message==='string'?/^(3036|3040): /.exec(error.message.slice(0,16))?.[1]:undefined);
  if (Number(code) === 3036) return 'FREE_QUOTA_EXHAUSTED';
  if (Number(code) === 3040) return 'PROVIDER_BUSY';
  return safeCodes.has(code) ? code : 'PROVIDER_FAILED';
}
function probeInput() {
  return {
    messages:[{ role:'system', content:'你是修仙故事作者。只输出符合schema的中文JSON，不改动人物属性，不输出思考过程。' }, { role:'user', content:'你十六岁，初到山门。写一个简短的入门场景和两个可选行动。' }],
    stream:false, max_tokens:512, chat_template_kwargs:{enable_thinking:false},
    response_format:{ type:'json_schema', json_schema:{name:'cultivation_probe',strict:true,schema:{ type:'object', additionalProperties:false, properties:{ scene:{ type:'string' }, choices:{ type:'array', minItems:2, maxItems:3, items:{ type:'string' } } }, required:['scene','choices'] }} },
  };
}
async function persist(save, ledger) { try { await save(ledger); } catch { throw fail('LEDGER_PERSIST_FAILED'); } }

// No network or I/O on import or default invocation. env/evidence/save are trusted operator inputs.
// Caller must serialize all Tasks1/7/8 against one durable ledger; this pure API does not lock it.
export async function runProbe({ execute = false, env, evidence, ledger, persistLedger, attemptId, task = 'task1', modelId = CANDIDATE_MODEL_ID, now = Date.now, timeoutMs = STORY_LIMITS.timeoutMs } = {}) {
  const result = { schemaVersion:1, evidenceKind:'probe-observation', modelId:CANDIDATE_MODEL_ID, inferencePerformed:false, status:'blocked', actualNeurons:null, usage:null, structuredOutputPassed:false, chinesePassed:false, reasoningPresent:false, reasoningChars:0, reasoningNonWhitespacePresent:false, stopReason:null, latencyMs:null };
  let reserved, started;
  try {
    if (execute !== true) throw fail('INFERENCE_DISABLED');
    if (typeof persistLedger !== 'function' || typeof now !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > STORY_LIMITS.timeoutMs) throw fail('PROBE_CONFIGURATION_INVALID');
    const input = probeInput();
    const reservedNeurons = estimateMaxNeurons(input, { modelId });
    assertProviderReady({ enabled:true, env, evidence, purpose:'probe', modelId, ledger, reservationNeurons:reservedNeurons, now:now() });
    reserved = reserveExperiment(ledger, { task, attemptId, reservedNeurons });
    result.reservedNeurons = reservedNeurons;
    await persist(persistLedger, reserved);
    started = now();
    result.inferencePerformed = true;
    let timer, raw;
    try {
      raw = await Promise.race([
        Promise.resolve().then(() => env.AI.run(modelId, input)),
        new Promise((_,reject) => { timer = setTimeout(() => reject(fail('PROVIDER_TIMEOUT')), timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
    result.latencyMs = Math.max(0, now() - started);
    let serialized;
    try { serialized = JSON.stringify(raw); } catch { throw fail('PROVIDER_RESPONSE_INVALID'); }
    if (typeof serialized !== 'string') throw fail('PROVIDER_RESPONSE_INVALID');
    if (new TextEncoder().encode(serialized).byteLength > STORY_LIMITS.maxResponseBytes) throw fail('PROVIDER_RESPONSE_TOO_LARGE');
    if (raw?.model && raw.model !== modelId) throw fail('MODEL_RESPONSE_MISMATCH');
    const choice = raw?.choices?.[0];
    result.stopReason = ['stop','length','tool_calls','content_filter'].includes(choice?.finish_reason) ? choice.finish_reason : null;
    const reasoning=[choice?.message?.reasoning_content,choice?.message?.reasoning].filter(value=>typeof value==='string');
    result.reasoningPresent = reasoning.some(value=>value.length>0);
    result.reasoningChars = reasoning.reduce((total,value)=>total+value.length,0);
    result.reasoningNonWhitespacePresent = reasoning.some(value=>/\S/u.test(value));
    const usage = raw?.usage;
    if (usage && ['prompt_tokens','completion_tokens','total_tokens'].every(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0)) result.usage = { promptTokens:usage.prompt_tokens, completionTokens:usage.completion_tokens, totalTokens:usage.total_tokens };
    // Token-derived estimates are not actual billed Neurons. Unknown remains null.
    let scene;
    try { scene = typeof choice?.message?.content === 'string' ? JSON.parse(choice.message.content) : null; } catch { /* Malformed JSON is a recorded failure. */ }
    result.structuredOutputPassed = !!scene && typeof scene === 'object' && !Array.isArray(scene) && Object.keys(scene).length === 2 && typeof scene.scene === 'string' && scene.scene.length > 0 && Array.isArray(scene.choices) && scene.choices.length >= 2 && scene.choices.length <= 3 && scene.choices.every(text => typeof text === 'string' && text.length > 0);
    result.chinesePassed = result.structuredOutputPassed && [scene.scene,...scene.choices].every(text => /\p{Script=Han}/u.test(text));
    result.status = result.structuredOutputPassed && result.chinesePassed && result.stopReason === 'stop' && result.usage ? 'passed' : 'failed';
    if (result.status === 'failed') result.errorCode = 'PROBE_VALIDATION_FAILED';
    await persist(persistLedger, settleExperiment(reserved, attemptId, { status:result.status === 'passed' ? 'complete' : 'failed', actualNeurons:null }));
  } catch (error) {
    result.errorCode = errorCode(error);
    result.status = result.inferencePerformed ? 'failed' : 'blocked';
    if (result.inferencePerformed) {
      result.latencyMs = Math.max(0, now() - started);
      try { await persist(persistLedger, settleExperiment(reserved, attemptId, { status:'unknown', actualNeurons:null })); }
      catch { result.ledgerErrorCode = 'LEDGER_PERSIST_FAILED'; }
    }
  }
  return result;
}

export function summarizeProbeEvidence(samples) {
  const attempted = samples.filter(sample => sample.inferencePerformed === true);
  const passed = attempted.filter(sample => sample.structuredOutputPassed === true).length;
  return { inferenceCount:attempted.length, structure:{ passed, attempted:attempted.length, ratio:attempted.length ? passed / attempted.length : null }, latencyMs:attempted.map(sample => sample.latencyMs).filter(Number.isFinite), productionValidated:false };
}
