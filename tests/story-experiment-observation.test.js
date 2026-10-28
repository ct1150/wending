import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import {TURN_RESERVATION_NEURONS} from '../src/worker/story-api.js';
import {createExperimentBridge} from '../src/worker/story-experiment.js';
import {OperatorProbeDurableObject} from '../src/worker/operator-probe.js';
import {createStoryObservation,storyObservationHash} from '../src/worker/story-observation.js';
import {sha256} from '../src/game/cultivation/live/identity.js';

const token='private-fixture-server-credential-32-characters';
const body={sessionRef:'session',requestId:'request',attemptId:'attempt',contextHash:'a'.repeat(64),payloadHash:'b'.repeat(64)};
const observation=()=>createStoryObservation({errorCode:'GENERATED_SCENE_INVALID',structureDiagnostic:'FIELD_SET_INVALID',modelId:CANDIDATE_MODEL_ID,inputHash:'c'.repeat(64),inputBytes:6000,usage:{promptTokens:10,completionTokens:20,totalTokens:30},nonThinkingValidated:true,stopReason:'stop'},{latencyMs:123});
function fixture(){
  let record={schemaVersion:1,ledger:{schemaVersion:1,attempts:[]},results:{}},writes=0,calls=0,bridgeCalls=0;
  const storage={sql:{},get:async()=>structuredClone(record),put:async(key,next)=>{writes++;record=structuredClone(next);}};
  const cfg={operatorTokenSha256:sha256(token),bindingAccountId:'fixture',freeBoundaryEvidence:{accountId:'fixture',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()}};
  const make=()=>new OperatorProbeDurableObject({storage},{AI:{run(){calls++;throw Error('must not infer');}}},cfg);let object=make(),transform=async response=>response;
  const env={STORY_OPERATOR_TOKEN:token,STORY_EXPERIMENT:{idFromName:name=>name,get:()=>({fetch:async request=>{bridgeCalls++;return transform(await object.fetch(request));}})}};
  return {bridge:createExperimentBridge(env),get record(){return structuredClone(record);},get writes(){return writes;},get calls(){return calls;},get bridgeCalls(){return bridgeCalls;},restart(){object=make();},transform(fn){transform=fn;}};
}

test('real experiment bridge carries only validated observation and checks its canonical acknowledgment',async()=>{
  const f=fixture();const grant=await f.bridge.reserve(body);assert.equal(grant.kind,'reserved');
  const obs=observation(),settled={...body,status:'failed',observation:obs,raw:'PRIVATE_SENTINEL'};
  const ack=await f.bridge.settle(settled);assert.equal(ack.kind,'settled');assert.equal(ack.observationHash,storyObservationHash(obs));
  assert.deepEqual(f.record.results[grant.admissionId].observation,obs);assert.doesNotMatch(JSON.stringify(f.record),/PRIVATE_SENTINEL/);
  const writes=f.writes;f.restart();assert.deepEqual(await f.bridge.settle(settled),ack);assert.equal(f.writes,writes);assert.equal(f.calls,0);
});

test('bridge rejects missing or changed observation acknowledgment and never repeats inference after a lost acknowledgment',async()=>{
  for(const mode of ['missing','changed','lost']){
    const f=fixture(),grant=await f.bridge.reserve(body),obs=observation();
    f.transform(async response=>{if(mode==='lost')throw Error('PRIVATE_SENTINEL');const value=await response.json();if(mode==='missing')delete value.observationHash;else value.observationHash='d'.repeat(64);return Response.json(value);});
    assert.deepEqual(await f.bridge.settle({...body,status:'failed',observation:obs}),{kind:'denied',code:'EXPERIMENT_BUDGET_UNAVAILABLE'});
    const stored=f.record;assert.equal(stored.ledger.attempts[0].status,'failed');assert.equal(stored.ledger.attempts[0].reservedNeurons,TURN_RESERVATION_NEURONS);
    assert.deepEqual(stored.results[grant.admissionId].observation,obs);
    f.restart();f.transform(async response=>response);assert.equal((await f.bridge.reserve(body)).kind,'duplicate');
    assert.equal((await f.bridge.settle({...body,status:'failed',observation:obs})).observationHash,storyObservationHash(obs));
    assert.deepEqual(f.record,stored);assert.equal(f.calls,0);
  }
});

test('unsafe observations never leave the bridge and legacy settlement stays unchanged',async()=>{
  const f=fixture();await f.bridge.reserve(body);const before=f.bridgeCalls;
  for(const obs of [{...observation(),raw:'PRIVATE_SENTINEL'},{...observation(),structureDiagnostic:'PRIVATE_SENTINEL'}])assert.equal((await f.bridge.settle({...body,status:'failed',observation:obs})).code,'EXPERIMENT_BUDGET_UNAVAILABLE');
  assert.equal(f.bridgeCalls,before);
  const legacy=await f.bridge.settle({...body,status:'failed'});assert.equal(legacy.kind,'settled');assert.equal(Object.hasOwn(legacy,'observationHash'),false);
});
