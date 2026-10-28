// Local fixtures only. No Cloudflare request or real inference is made here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { createLiveGame,prepareOpening,commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { canonicalStringify,sha256,stateHash } from '../src/game/cultivation/live/identity.js';
import {createStoryObservation,storyObservationHash} from '../src/worker/story-observation.js';

const token='local-baseline-operator-credential',branchA='task7-player-branch-a-v1',branchB='task7-player-branch-b-v1';
const clone=value=>structuredClone(value);
function historicalRecord(){
  const record={schemaVersion:1,ledger:{schemaVersion:1,attempts:[]},results:{},acceptance:{schemaVersion:1,cases:{}}};
  for(let i=0;i<4;i++){const attemptId='old-task1-'+i;record.ledger.attempts.push({task:'task1',attemptId,reservedNeurons:24,actualNeurons:null,status:'complete'});record.results[attemptId]={status:'passed'};}
  const birth=createLiveGame({runId:'live-acceptance-v1',seed:42,name:'云归',originId:'village'});
  for(const [index,caseId,reservedNeurons,errorCode] of [[1,'task7-opening',77,'GENERATED_SCENE_INVALID'],[2,'task7-opening-v2',83,'SCENE_ID_SCOPE_INVALID'],[3,'task7-opening-v3',83,'GENERATED_SCENE_INVALID']]){
    const attemptId='old-task7-'+index,pending=prepareOpening(birth,{requestId:caseId});
    const association={attemptId,caseId,status:'failed',contextHash:sha256('historical context '+caseId),inputHash:sha256('historical input '+caseId),inputBytes:6000,baseStateHash:stateHash(birth),identity:pending.identity,receipt:pending.receipt,...(index>1?{recipeVersion:index}:{})};
    record.ledger.attempts.push({task:'task7',attemptId,reservedNeurons,actualNeurons:null,status:'failed'});
    record.acceptance.cases[caseId]=association;
    record.results[attemptId]={...association,task:'task7',status:'rejected',reservedNeurons,actualNeurons:null,inferencePerformed:true,errorCode,...(index===3?{structureDiagnostic:'ACTION_PAIR_INVALID'}:{})};
  }
  return record;
}
function makeScene(context){
  const prefix=context.namespace+':t'+context.identity.turnId+':',keeper=context.entities[0]??{id:prefix+'e:keeper',name:'守路人',kind:'person',status:'alive'};
  return {id:prefix+'s:scene',title:'山路来信',location:'山路',blocks:[{kind:'narration',text:'你沿山路走来，回应'+(context.receipt.action?.intent??'初次相逢')+'。'},{kind:'dialogue',speaker:keeper.id,text:'前路的约定还在。'}],entities:[keeper],choices:[{id:prefix+'c:talk',label:'协助守路人',intent:'negotiate',targetId:keeper.id,stake:'low',approach:'cooperate'},{id:prefix+'c:rest',label:'暂且休息',intent:'rest',targetId:'self',stake:'low',approach:'recover'}],memoryDeltas:context.phase==='opening'?[{entityId:keeper.id,kind:'promise',text:'替守路人留意来信。'}]:[]};
}
function sourceFixture({singleChoice=false,retryOf=null}={}){
  const record=historicalRecord(),birth=createLiveGame({runId:'actual-player-fixture',seed:136,name:'云归',originId:'village'}),pending=prepareOpening(birth,{requestId:'player-opening'});
  const context=buildStoryContext(birth,pending,[],{selection:'relevance-v1',openTotal:0}),scene=makeScene(context);
  if(singleChoice)scene.choices[1]={...scene.choices[1],intent:'craft',targetId:'manual',approach:'study'};
  const browserState=commitTurn(birth,pending,scene,context.relationships),attempt={id:'player-attempt',sessionRef:'player-session',retryOf};
  const identity={sessionRef:attempt.sessionRef,requestId:pending.identity.requestId,attemptId:attempt.id,payloadHash:sha256(canonicalStringify({context,attempt})),contextHash:sha256(canonicalStringify(context))};
  const admissionId='task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId])),acceptedSceneHash=sha256(canonicalStringify(scene));
  record.ledger.attempts.push({task:'task8',attemptId:admissionId,reservedNeurons:111,actualNeurons:null,status:'complete'});
  record.task8={schemaVersion:1,admissions:{[admissionId]:{identity,status:'complete',acceptedSceneHash}}};
  record.results[admissionId]={task:'task8',...identity,status:'complete',reservedNeurons:111,actualNeurons:null,acceptedSceneHash};
  return clone({record,body:{admissionId,context,scene,browserState,...(retryOf===null?{}:{retryOf})}});
}
function retrySourceFixture(){
  const retryOf={attemptId:'unknown-opening',sessionRef:'player-session'},data=sourceFixture({retryOf});
  const source=data.record.task8.admissions[data.body.admissionId],attempt={id:retryOf.attemptId,sessionRef:retryOf.sessionRef,retryOf:null};
  const identity={...source.identity,attemptId:attempt.id,payloadHash:sha256(canonicalStringify({context:data.body.context,attempt}))};
  const admissionId='task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId]));
  data.record.ledger.attempts.splice(7,0,{task:'task8',attemptId:admissionId,reservedNeurons:111,actualNeurons:null,status:'unknown'});
  data.record.task8.admissions[admissionId]={identity,status:'unknown'};
  data.record.results[admissionId]={task:'task8',...identity,status:'unknown',reservedNeurons:111,actualNeurons:null};
  return data;
}
async function fixture(data=sourceFixture(),run){
  let saved=clone(data.record),writes=0,calls=0;const inputs=[];
  const storage={sql:{},async get(){return clone(saved);},async put(key,value){assert.equal(key,'experiment-v1');saved=clone(value);writes++;}};
  const config={operatorTokenSha256:sha256(token),bindingAccountId:'local-account',freeBoundaryEvidence:{accountId:'local-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:800,checkedAt:new Date().toISOString()}};
  const env={AI:{async run(model,input){calls++;const c=JSON.parse(input.messages[1].content);inputs.push(c);const response={model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(makeScene(c))}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};return run?run(c,response):response;}}};
  const make=()=>new OperatorProbeDurableObject({storage},env,config);let object=make();
  const fetch=(body=data.body,{path='/task7/baseline',authorization='Bearer '+token,method='POST'}={})=>object.fetch(new Request('https://operator.invalid'+path,{method,headers:{authorization,'content-type':'application/json'},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));
  return {data,storage,inputs,fetch,async call(body,options){return (await fetch(body,options)).json();},async branch(caseId,attemptId){return this.call({caseId,attemptId},{path:'/story-acceptance'});},restart(){object=make();},record:()=>clone(saved),get calls(){return calls;},get writes(){return writes;}};
}

test('operator registers one server-attested browser opening without a model call or reservation',async()=>{
  const f=await fixture(),before=f.record();const result=await f.call();
  assert.equal(result.status,'registered');assert.equal(result.sourceTask,'task8');assert.equal(result.stateHash,stateHash(f.data.body.browserState));
  const after=f.record();assert.deepEqual(after.ledger,before.ledger);assert.deepEqual(after.results,before.results);assert.deepEqual(after.task8,before.task8);assert.deepEqual(after.acceptance.cases,before.acceptance.cases);
  assert.deepEqual(after.acceptance.playerBaseline.state,f.data.body.browserState);
  assert.ok(after.acceptance.playerBaseline.records.some(row=>row.kind==='promise'&&row.text==='替守路人留意来信。'));
  assert.equal(f.calls,0);assert.equal(f.writes,1);
  f.restart();assert.deepEqual(await f.call(),result);assert.equal(f.writes,1);assert.equal(f.calls,0);
});

test('baseline accepts coherent private observation links but rejects altered or orphaned copies',async()=>{
  const data=sourceFixture(),id=data.body.admissionId;
  const observation={...createStoryObservation({modelId:CANDIDATE_MODEL_ID,inputHash:sha256('actual fixture input'),inputBytes:6000,nonThinkingValidated:true},{latencyMs:30}),modelId:'@cf/qwen/qwen3-30b-a3b-fp8'};
  const observationHash=storyObservationHash(observation);
  Object.assign(data.record.results[id],{observation,observationHash});data.record.task8.admissions[id].observationHash=observationHash;
  const valid=await fixture(data),before=valid.record();assert.equal((await valid.call()).status,'registered');assert.deepEqual(valid.record().results,before.results);assert.deepEqual(valid.record().ledger,before.ledger);assert.equal(valid.calls,0);
  for(const mutate of [d=>d.record.results[id].observation.latencyMs++,d=>delete d.record.results[id].observation,d=>delete d.record.results[id].observationHash,d=>delete d.record.task8.admissions[id].observationHash,d=>d.record.results[id].observation.errorCode='GENERATED_SCENE_INVALID']){
    const bad=clone(data);mutate(bad);const f=await fixture(bad),before=f.record();assert.equal((await f.call()).status,'blocked');assert.deepEqual(f.record(),before);assert.equal(f.calls,0);assert.equal(f.writes,0);
  }
});

test('first accepted opening may follow a failed Task8 but not an active reservation or prior success',async()=>{
  const data=sourceFixture(),identity={sessionRef:'old-failed-session',requestId:'old-failed-opening',attemptId:'old-failed-attempt',payloadHash:sha256('old failed payload'),contextHash:sha256('old failed context')};
  const id='task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId]));
  data.record.ledger.attempts.splice(7,0,{task:'task8',attemptId:id,status:'failed',reservedNeurons:111,actualNeurons:null});
  data.record.task8.admissions[id]={identity,status:'failed'};data.record.results[id]={task:'task8',...identity,status:'failed',reservedNeurons:111,actualNeurons:null};
  const f=await fixture(data),before=f.record();assert.equal((await f.call()).status,'registered');assert.deepEqual(f.record().ledger,before.ledger);assert.deepEqual(f.record().results,before.results);assert.deepEqual(f.record().task8,before.task8);assert.equal(f.calls,0);
  f.restart();assert.equal((await f.call()).status,'registered');assert.equal(f.writes,1);
  for(const status of ['reserved','complete']){
    const blocked=clone(data);blocked.record.ledger.attempts[7].status=status;blocked.record.task8.admissions[id].status=status;blocked.record.results[id].status=status;
    if(status==='complete'){const acceptedSceneHash=sha256('earlier accepted scene');blocked.record.task8.admissions[id].acceptedSceneHash=acceptedSceneHash;blocked.record.results[id].acceptedSceneHash=acceptedSceneHash;}
    const g=await fixture(blocked),original=g.record();assert.equal((await g.call()).status,'blocked');assert.deepEqual(g.record(),original);assert.equal(g.writes,0);assert.equal(g.calls,0);
  }
});

test('a separately attested opening may follow the actual failed and unknown history without altering it',async()=>{
  const data=sourceFixture();
  for(const [index,status]of ['failed','unknown'].entries()){
    const identity={sessionRef:'previous-session-'+index,requestId:'previous-opening-'+index,attemptId:'previous-attempt-'+index,payloadHash:sha256('previous payload '+index),contextHash:sha256('previous context '+index)};
    const id='task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId]));
    data.record.ledger.attempts.splice(7+index,0,{task:'task8',attemptId:id,status,reservedNeurons:111,actualNeurons:null});
    data.record.task8.admissions[id]={identity,status};data.record.results[id]={task:'task8',...identity,status,reservedNeurons:111,actualNeurons:null};
  }
  const f=await fixture(data),before=f.record();
  assert.equal(before.ledger.attempts.slice(0,9).reduce((total,row)=>total+row.reservedNeurons,0),561);
  assert.equal((await f.call()).status,'registered');
  assert.deepEqual(f.record().ledger,before.ledger);assert.deepEqual(f.record().results,before.results);assert.deepEqual(f.record().task8,before.task8);
  assert.equal(f.record().acceptance.playerBaseline.admissionId,data.body.admissionId);assert.equal(f.calls,0);
  f.restart();assert.equal((await f.call()).status,'registered');assert.equal(f.writes,1);
});

test('successful explicit retry becomes an attested baseline and survives restart before branch acceptance',async()=>{
  const data=retrySourceFixture(),f=await fixture(data),before=f.record(),registered=await f.call();
  assert.equal(registered.status,'registered');assert.equal(f.calls,0);assert.equal(f.writes,1);
  const baseline=f.record().acceptance.playerBaseline;
  assert.deepEqual(baseline.retryOf,{attemptId:'unknown-opening',sessionRef:'player-session'});
  assert.deepEqual(f.record().ledger,before.ledger);assert.deepEqual(f.record().task8,before.task8);assert.deepEqual(f.record().results,before.results);
  f.restart();assert.deepEqual(await f.call(),registered);assert.equal(f.writes,1);
  assert.equal((await f.branch(branchA,'retry-opening-branch')).status,'ready');assert.equal(f.calls,1);
  assert.deepEqual(f.record().acceptance.playerBaseline,baseline);
  assert.deepEqual(f.record().ledger.attempts.slice(0,-1),before.ledger.attempts);
});

test('baseline rejects missing or altered retry lineage and cannot skip an active predecessor',async()=>{
  const data=retrySourceFixture();
  for(const mutate of [
    d=>{delete d.body.retryOf;},
    d=>{d.body.retryOf=null;},
    d=>{d.body.retryOf.attemptId='another-attempt';},
    d=>{d.body.retryOf.sessionRef='another-session';},
    d=>{const entry=d.record.ledger.attempts[7];entry.status='reserved';d.record.task8.admissions[entry.attemptId].status='reserved';delete d.record.results[entry.attemptId];},
  ]){
    const changed=clone(data);mutate(changed);const f=await fixture(changed),before=f.record();
    assert.equal((await f.call()).status,'blocked');assert.deepEqual(f.record(),before);assert.equal(f.writes,0);assert.equal(f.calls,0);
  }
});

test('explicit null retry lineage retains the legacy baseline representation and replay',async()=>{
  const f=await fixture(),registered=await f.call(),before=f.record();
  assert.deepEqual(await f.call({...f.data.body,retryOf:null}),registered);
  assert.equal(Object.hasOwn(before.acceptance.playerBaseline,'retryOf'),false);
  assert.deepEqual(f.record(),before);assert.equal(f.writes,1);assert.equal(f.calls,0);
});

test('baseline verifies the recorded positive reservation rather than one deployment constant',async()=>{
  for(const reservation of [111,130]){
    const data=sourceFixture();data.record.ledger.attempts.at(-1).reservedNeurons=reservation;data.record.results[data.body.admissionId].reservedNeurons=reservation;
    const f=await fixture(data),before=f.record();assert.equal((await f.call()).status,'registered');assert.deepEqual(f.record().ledger,before.ledger);assert.deepEqual(f.record().results,before.results);
  }
  for(const reservation of [0,-1,1.5]){
    const data=sourceFixture();data.record.ledger.attempts.at(-1).reservedNeurons=reservation;data.record.results[data.body.admissionId].reservedNeurons=reservation;
    const f=await fixture(data),before=f.record();assert.equal((await f.call()).status,'blocked');assert.deepEqual(f.record(),before);assert.equal(f.writes,0);
  }
  const data=sourceFixture();data.record.results[data.body.admissionId].reservedNeurons=130;
  const f=await fixture(data);assert.equal((await f.call()).status,'blocked');assert.equal(f.writes,0);
});

test('baseline authenticates, bounds and validates its body before writing or inferring',async()=>{
  const f=await fixture();assert.equal((await f.fetch(undefined,{authorization:'Bearer wrong'})).status,401);
  for(const body of ['{','null','[]','{}',' '.repeat(65537),{...f.data.body,extra:true},{...f.data.body,admissionId:'bad space'}])assert.equal((await f.fetch(body)).status,400);
  assert.equal((await f.fetch(undefined,{method:'GET'})).status,405);
  assert.equal((await f.fetch(undefined,{path:'/task7/baseline?reset=1'})).status,400);
  assert.equal(f.calls,0);assert.equal(f.writes,0);
});

test('baseline refuses missing, unknown, altered and unattested Task8 sources without changing original evidence',async()=>{
  assert.equal((await (await fixture()).call()).status,'registered');
  const mutations=[
    d=>{delete d.record.task8;},
    d=>{d.record.ledger.attempts.at(-1).task='task7';},
    d=>{d.record.ledger.attempts.at(-1).status='unknown';},
    d=>{delete d.record.task8.admissions[d.body.admissionId].acceptedSceneHash;},
    d=>{d.record.results[d.body.admissionId].acceptedSceneHash=sha256('other scene');},
    d=>{d.record.results[d.body.admissionId].requestId='another-request';},
    d=>{d.body.scene.title='改写后的场景';},
    d=>{d.body.context.life.name='另一个人';},
    d=>{d.body.browserState.life.items.stones=500;},
    d=>{d.record.acceptance.cases['task7-opening-v3'].status='unknown';},
    d=>{d.record.results['old-task7-3'].structureDiagnostic='TEXT_INVALID';},
  ];
  for(const mutate of mutations){const data=sourceFixture();mutate(data);const f=await fixture(data),before=f.record();assert.equal((await f.call()).status,'blocked');assert.deepEqual(f.record(),before);assert.equal(f.calls,0);assert.equal(f.writes,0);}
});

test('baseline requires an exact opening context and browser commit and cannot replace an existing source',async()=>{
  const f=await fixture();await f.call();const before=f.record();
  for(const mutate of [b=>b.scene.blocks[0].text='另一段正文',b=>b.browserState.archiveCursor=1,b=>b.context.receipt.random.after++,b=>b.admissionId='task8_'+sha256('different')]){
    const body=clone(f.data.body);mutate(body);assert.equal((await f.call(body)).status,'blocked');assert.deepEqual(f.record(),before);
  }
  assert.equal(f.writes,1);assert.equal(f.calls,0);
});

test('shared-opening branches clone the attested S1, keep all three failures and never advance the browser',async()=>{
  const f=await fixture(),original=f.record();assert.equal((await f.branch(branchA,'too-early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');assert.equal(f.calls,0);
  await f.call();const baseline=clone(f.record().acceptance.playerBaseline),browserState=clone(f.data.body.browserState);
  assert.equal((await f.branch(branchB,'out-of-order')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  assert.equal((await f.branch(branchA,'private-a')).status,'ready');f.restart();
  assert.equal((await f.branch(branchA,'replayed-a')).attemptId,'private-a');assert.equal(f.calls,1);
  assert.equal((await f.branch(branchB,'private-b')).status,'ready');assert.equal(f.calls,2);
  const record=f.record();assert.equal(record.ledger.attempts.length,10);assert.equal(record.ledger.attempts.filter(row=>row.task==='task7').length,5);assert.equal(record.ledger.attempts.filter(row=>row.task==='task8').length,1);
  assert.deepEqual(record.ledger.attempts.slice(0,8),original.ledger.attempts);assert.deepEqual(record.acceptance.playerBaseline,baseline);assert.deepEqual(f.data.body.browserState,browserState);
  for(const [id,row] of Object.entries(original.acceptance.cases))assert.deepEqual(record.acceptance.cases[id],row);
  const [a,b]=f.inputs;assert.equal(a.identity.stateHash,stateHash(browserState));assert.equal(b.identity.stateHash,a.identity.stateHash);assert.equal(a.identity.baseRevision,1);assert.equal(b.identity.baseRevision,1);assert.notEqual(a.identity.choiceId,b.identity.choiceId);assert.notEqual(a.receipt.elapsedDays,b.receipt.elapsedDays);
  assert.equal(record.acceptance.cases[branchA].state.revision,2);assert.equal(record.acceptance.cases[branchB].state.revision,2);
  assert.equal(record.acceptance.cases[branchA].sourceTask8AdmissionId,f.data.body.admissionId);
  assert.equal(record.acceptance.cases[branchB].sourceTask8AdmissionId,f.data.body.admissionId);
});

test('explicit new branch attempts preserve terminal failures and exact replay across restart',async t=>{
  for(const failure of ['rejected','unknown'])await t.test(failure,async()=>{
    let calls=0;
    const f=await fixture(sourceFixture(),(context,response)=>{
      if(calls++===0){if(failure==='unknown')throw Error('private transient failure');response.choices[0].message.content='invalid json';}
      return response;
    });
    await f.call();const baseline=clone(f.record().acceptance.playerBaseline);
    const first=await f.branch(branchA,'failed-branch'),failed=f.record(),association=clone(failed.acceptance.cases[branchA]);
    assert.equal(association.status,failure==='unknown'?'unknown':'failed');assert.equal(f.calls,1);
    f.restart();assert.deepEqual(await f.branch(branchA,'failed-branch'),first);assert.equal(f.calls,1);
    assert.equal((await f.branch(branchB,'too-early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    const put=f.storage.put;f.storage.put=async()=>{throw Error('private storage unavailable');};
    assert.equal((await f.branch(branchA,'new-branch')).errorCode,'LEDGER_PERSIST_FAILED');assert.deepEqual(f.record(),failed);assert.equal(f.calls,1);
    f.storage.put=put;f.restart();
    const [second,replay]=await Promise.all([f.branch(branchA,'new-branch'),f.branch(branchA,'new-branch')]);
    assert.equal(second.status,'ready');assert.equal(second.attemptId,'new-branch');assert.equal(second.retryOf,'failed-branch');assert.deepEqual(replay,second);assert.equal(f.calls,2);
    const stored=f.record();assert.deepEqual(stored.ledger.attempts.slice(0,-1),failed.ledger.attempts);
    assert.deepEqual(stored.results['failed-branch'],failed.results['failed-branch']);assert.deepEqual(stored.acceptance.caseHistory['failed-branch'],association);
    assert.equal(stored.acceptance.cases[branchA].retryOf,'failed-branch');assert.deepEqual(stored.acceptance.playerBaseline,baseline);
    assert.deepEqual(f.inputs[0],f.inputs[1]);
    f.restart();assert.deepEqual(await f.branch(branchA,'failed-branch'),first);assert.deepEqual(await f.branch(branchA,'new-branch'),second);
    assert.deepEqual(await f.branch(branchA,'do-not-duplicate-success'),second);assert.equal(f.calls,2);assert.deepEqual(f.record(),stored);
    assert.equal((await f.branch(branchB,'failed-branch')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');assert.equal(f.calls,2);
    assert.equal((await f.branch(branchB,'branch-b')).status,'ready');assert.equal(f.calls,3);
  });
});

test('a branch retry chain keeps each previous association and result immutable',async()=>{
  let calls=0;const f=await fixture(sourceFixture(),(context,response)=>{if(calls++<2)throw Error('fixture temporary failure');return response;});
  await f.call();const first=await f.branch(branchA,'attempt-one'),one=f.record();
  const second=await f.branch(branchA,'attempt-two'),two=f.record();assert.equal(second.retryOf,'attempt-one');
  const third=await f.branch(branchA,'attempt-three');assert.equal(third.status,'ready');assert.equal(third.retryOf,'attempt-two');
  const stored=f.record();assert.deepEqual(stored.acceptance.caseHistory['attempt-one'],one.acceptance.cases[branchA]);assert.deepEqual(stored.acceptance.caseHistory['attempt-two'],two.acceptance.cases[branchA]);
  assert.deepEqual(stored.results['attempt-one'],first);assert.deepEqual(stored.results['attempt-two'],second);
  f.restart();assert.deepEqual(await f.branch(branchA,'attempt-one'),first);assert.deepEqual(await f.branch(branchA,'attempt-two'),second);assert.deepEqual(await f.branch(branchA,'attempt-three'),third);assert.equal(f.calls,3);assert.deepEqual(f.record(),stored);
});

test('a branch with no durable terminal result cannot be retried under a different identity',async()=>{
  const f=await fixture();await f.call();const put=f.storage.put;let writes=0;
  f.storage.put=async(key,value)=>{if(writes++>0)throw Error('final persistence failure');return put(key,value);};
  await f.branch(branchA,'uncertain-branch');const before=f.record();assert.equal(before.acceptance.cases[branchA].status,'reserved');
  f.storage.put=put;f.restart();assert.equal((await f.branch(branchA,'new-identity')).status,'already-reserved-or-unknown');assert.equal(f.calls,1);assert.deepEqual(f.record(),before);
});

test('only one executable source choice blocks branch A before any additional reservation',async()=>{
  const f=await fixture(sourceFixture({singleChoice:true}));assert.equal((await f.call()).status,'registered');const before=f.record();
  assert.equal((await f.branch(branchA,'cannot-contrast')).errorCode,'ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');assert.equal(f.calls,0);assert.deepEqual(f.record(),before);
});

test('missing original ledger and failed baseline persistence never initialize or reserve',async()=>{
  const f=await fixture();f.storage.get=async()=>undefined;assert.equal((await f.call()).status,'blocked');assert.equal(f.writes,0);assert.equal(f.calls,0);
  const g=await fixture(),before=g.record();g.storage.put=async()=>{throw Error('private persistence detail');};const result=await g.call();assert.equal(result.errorCode,'LEDGER_PERSIST_FAILED');assert.doesNotMatch(JSON.stringify(result),/private persistence detail/);assert.deepEqual(g.record(),before);assert.equal(g.calls,0);
});

test('native workerd preserves attested baseline and private branches across SQLite restarts',{timeout:30000},async t=>{
  const data=sourceFixture(),root=await mkdtemp(path.join(tmpdir(),'wending-baseline-native-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const observation={...createStoryObservation({modelId:CANDIDATE_MODEL_ID,inputHash:sha256('native fixture input'),inputBytes:6000,nonThinkingValidated:true},{latencyMs:30}),modelId:'@cf/qwen/qwen3-30b-a3b-fp8'};
  const observationHash=storyObservationHash(observation);
  Object.assign(data.record.results[data.body.admissionId],{observation,observationHash});data.record.task8.admissions[data.body.admissionId].observationHash=observationHash;
  const config={operatorTokenSha256:sha256(token),bindingAccountId:'local-account',freeBoundaryEvidence:{accountId:'local-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:800,checkedAt:new Date().toISOString()}};
  const entry=`import {OperatorProbeDurableObject,createOperatorProbeWorker} from './src/worker/operator-probe.js';
const config=${JSON.stringify(config)},initial=${JSON.stringify(data.record)};
const makeScene=${makeScene.toString()};
export class Probe extends OperatorProbeDurableObject{constructor(ctx,env){super(ctx,{...env,AI:{async run(model,input){const saved=await ctx.storage.get('experiment-v1');if(saved.ledger.attempts.at(-1).status!=='reserved')throw Error('missing reservation');return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(makeScene(JSON.parse(input.messages[1].content)))}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};}}},config);ctx.blockConcurrencyWhile(async()=>{if(await ctx.storage.get('experiment-v1')===undefined)await ctx.storage.put('experiment-v1',initial);});}}
export default createOperatorProbeWorker(config);`;
  const modules=[{type:'ESModule',path:path.join(root,'entry.mjs'),contents:entry}],visited=new Set();
  async function graph(url,name){if(visited.has(url.href))return;visited.add(url.href);const contents=await readFile(url,'utf8');modules.push({type:'ESModule',path:path.join(root,name),contents});for(const match of contents.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await graph(new URL(match[1],url),path.normalize(path.join(path.dirname(name),match[1])));}
  await graph(new URL('../src/worker/operator-probe.js',import.meta.url),'src/worker/operator-probe.js');
  let egress=0;const options={name:'wending-baseline-native',compatibilityDate:'2026-07-30',modulesRoot:root,modules,durableObjects:{OPERATOR_PROBE:{className:'Probe',useSQLite:true}},durableObjectsPersist:path.join(root,'sqlite'),outboundService:()=>{egress++;throw Error('network forbidden');}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const post=async(route,body)=>(await mf.dispatchFetch('https://operator.invalid'+route,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)})).json();
  const status=async()=>(await mf.dispatchFetch('https://operator.invalid/status',{headers:{authorization:'Bearer '+token}})).json();
  const registered=await post('/task7/baseline',data.body);assert.equal(registered.status,'registered');assert.equal((await status()).callCount,8);
  await mf.dispose();mf=new Miniflare(options);assert.deepEqual(await post('/task7/baseline',data.body),registered);
  assert.equal((await post('/story-acceptance',{caseId:branchA,attemptId:'native-a'})).status,'ready');
  await mf.dispose();mf=new Miniflare(options);assert.equal((await post('/story-acceptance',{caseId:branchA,attemptId:'native-a-replay'})).attemptId,'native-a');
  assert.equal((await post('/story-acceptance',{caseId:branchB,attemptId:'native-b'})).status,'ready');
  const saved=await status();assert.equal(saved.callCount,10);assert.deepEqual(saved.ledger.attempts.slice(0,8),data.record.ledger.attempts);assert.deepEqual(saved.acceptance.playerBaseline.state,data.body.browserState);assert.equal(egress,0);
  assert.deepEqual(saved.results[data.body.admissionId].observation,observation);assert.equal(saved.task8.admissions[data.body.admissionId].observationHash,observationHash);
});
