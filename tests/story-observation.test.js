import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import * as observation from '../src/worker/story-observation.js';
const generated=()=>({modelId:CANDIDATE_MODEL_ID,inputHash:'a'.repeat(64),inputBytes:6000,usage:{promptTokens:100,completionTokens:80,totalTokens:180},stopReason:'stop',nonThinkingValidated:true,errorCode:'GENERATED_SCENE_INVALID',structureDiagnostic:'FIELD_SET_INVALID'});
function create(value=generated(),options={stage:'provider',latencyMs:123}){assert.equal(typeof observation.createStoryObservation,'function');return observation.createStoryObservation(value,options);}

test('private observation selects bounded actual metadata without retaining provider content',()=>{
  const source={...generated(),scene:{text:'PRIVATE_SENTINEL'},reasoning_content:'PRIVATE_SENTINEL',message:'PRIVATE_SENTINEL',credentials:'PRIVATE_SENTINEL'};
  const value=create(source);
  assert.deepEqual(value,{version:1,stage:'provider',errorCode:'GENERATED_SCENE_INVALID',structureDiagnostic:'FIELD_SET_INVALID',modelId:CANDIDATE_MODEL_ID,inputHash:'a'.repeat(64),inputBytes:6000,usage:{promptTokens:100,completionTokens:80,totalTokens:180},stopReason:'stop',nonThinkingValidated:true,latencyMs:123});
  assert.doesNotMatch(JSON.stringify(value),/PRIVATE_SENTINEL/);
  assert.deepEqual(observation.validateStoryObservation(value,{status:'failed'}),value);
  source.usage.totalTokens=999;assert.equal(value.usage.totalTokens,180);
});

test('observation creation drops invalid metadata and preserves distinct API rejection stages',()=>{
  const bad={modelId:'PRIVATE_SENTINEL',inputHash:'PRIVATE_SENTINEL',inputBytes:Infinity,usage:{promptTokens:1,completionTokens:1,totalTokens:3},stopReason:'PRIVATE_SENTINEL',nonThinkingValidated:'PRIVATE_SENTINEL',errorCode:'PRIVATE_SENTINEL',structureDiagnostic:'PRIVATE_SENTINEL'};
  const safe=create(bad,{latencyMs:NaN});
  assert.equal(safe.errorCode,'PROVIDER_FAILED');assert.equal(safe.stage,'provider');
  for(const key of ['modelId','inputHash','inputBytes','usage','stopReason','nonThinkingValidated','structureDiagnostic','latencyMs'])assert.equal(safe[key],null,key);
  for(const stage of ['api-scene','api-envelope']){
    const value=create({...generated(),errorCode:null,structureDiagnostic:null},{stage,latencyMs:0,errorCode:'GENERATED_SCENE_INVALID'});
    assert.equal(value.stage,stage);assert.equal(value.errorCode,'GENERATED_SCENE_INVALID');assert.equal(value.structureDiagnostic,null);
  }
  assert.throws(()=>create(generated(),{stage:'PRIVATE_SENTINEL'}));
  assert.throws(()=>create(generated(),{raw:'PRIVATE_SENTINEL'}));
});

test('strict observation validation rejects unknown content, unsafe numbers and inconsistent terminal states',()=>{
  const value=create();
  for(const patch of [{version:2},{extra:'PRIVATE_SENTINEL'},{stage:'PRIVATE_SENTINEL'},{errorCode:'PRIVATE_SENTINEL'},{structureDiagnostic:'PRIVATE_SENTINEL'},{modelId:'other'},{inputHash:'b'.repeat(63)},{inputBytes:12289},{inputBytes:null},{latencyMs:-1},{latencyMs:Infinity},{latencyMs:1.2},{usage:{promptTokens:1,completionTokens:1,totalTokens:3}},{usage:{promptTokens:1,completionTokens:1,totalTokens:2,raw:'PRIVATE_SENTINEL'}},{nonThinkingValidated:1}])assert.throws(()=>observation.validateStoryObservation({...value,...patch}),/STORY_OBSERVATION_INVALID/);
  for(const status of ['complete','unknown','reserved'])assert.throws(()=>observation.validateStoryObservation(value,{status}));
  const ready=create({...generated(),errorCode:null,structureDiagnostic:null});
  assert.deepEqual(observation.validateStoryObservation(ready,{status:'complete'}),ready);
  assert.throws(()=>observation.validateStoryObservation(ready,{status:'failed'}));
  const timeout=create({errorCode:'PROVIDER_TIMEOUT'});assert.deepEqual(observation.validateStoryObservation(timeout,{status:'unknown'}),timeout);
  assert.throws(()=>observation.validateStoryObservation({...value,errorCode:'PROVIDER_FAILED'}));
});

test('server observation options reject hidden, symbolic and non-plain properties without invoking accessors',()=>{
  let accessed=0;const getter={};Object.defineProperty(getter,'stage',{enumerable:true,get(){accessed++;return 'provider';}});
  const hidden={};Object.defineProperty(hidden,'raw',{value:'PRIVATE_SENTINEL'});
  for(const options of [getter,hidden,{[Symbol('raw')]:'PRIVATE_SENTINEL'},Object.create({stage:'provider'}),new Date()])assert.throws(()=>create(generated(),options),/STORY_OBSERVATION_INVALID/);
  const source=generated();Object.defineProperty(source,'raw',{enumerable:true,get(){accessed++;return 'PRIVATE_SENTINEL';}});
  assert.equal(create(source).errorCode,'GENERATED_SCENE_INVALID');assert.equal(accessed,0);
});
