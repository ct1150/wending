import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID,STORY_LIMITS} from '../src/worker/story-config.js';
import { DatabaseSync } from 'node:sqlite';
import { OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { TURN_RESERVATION_NEURONS } from '../src/worker/story-api.js';
import { sha256 } from '../src/game/cultivation/live/identity.js';

const operatorToken='fixture-operator-secret-with-at-least-32-characters';
const originalRecord=()=>({schemaVersion:1,ledger:{schemaVersion:1,attempts:[
  ...Array.from({length:4},(_,i)=>({task:'task1',attemptId:'old-task1-'+i,reservedNeurons:24,actualNeurons:null,status:'complete'})),
  {task:'task7',attemptId:'old-task7-a',reservedNeurons:77,actualNeurons:null,status:'failed'},
  {task:'task7',attemptId:'old-task7-b',reservedNeurons:83,actualNeurons:null,status:'failed'},
]},results:{'old-task7-b':{status:'rejected',errorCode:'SCENE_ID_SCOPE_INVALID'}},acceptance:{schemaVersion:1,cases:{}},audit:'preserve this record'});
const input=(suffix='a')=>({sessionRef:'session-'+suffix,requestId:'request-'+suffix,attemptId:'attempt-'+suffix,payloadHash:sha256('payload-'+suffix),contextHash:sha256('context-'+suffix)});
const acceptedSceneHash=sha256('fixture-accepted-scene');
const privateObservation=(patch={})=>({version:1,stage:'provider',errorCode:'GENERATED_SCENE_INVALID',structureDiagnostic:'FIELD_SET_INVALID',modelId:CANDIDATE_MODEL_ID,inputHash:'a'.repeat(64),inputBytes:6000,usage:{promptTokens:100,completionTokens:80,totalTokens:180},stopReason:'stop',nonThinkingValidated:true,latencyMs:123,...patch});
const request=(body,path='/task8/admit',authorization='Bearer '+operatorToken)=>new Request('https://operator.invalid'+path,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body)});
async function fixture(t,initial=originalRecord()){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const storage={sql:{},reads:0,writes:0,async get(key){this.reads++;const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?JSON.parse(row.value):undefined;},async put(key,value){this.writes++;db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}};
  await storage.put('experiment-v1',initial);storage.writes=0;
  let now=Date.now(),calls=0;t.mock.method(Date,'now',()=>now);
  const cfg={operatorTokenSha256:sha256(operatorToken),bindingAccountId:'fixture-account',freeBoundaryEvidence:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date(now).toISOString()}};
  const env={AI:{run(){calls++;throw new Error('Task8 admission must never run the model');}}};
  const make=()=>new OperatorProbeDurableObject({storage},env,cfg);
  let object=make();
  return {storage,cfg,env,async call(body=input(),path='/task8/admit',authorization){return (await object.fetch(request(body,path,authorization))).json();},async response(body=input(),path='/task8/admit',authorization){return object.fetch(request(body,path,authorization));},async record(){return storage.get('experiment-v1');},restart(){object=make();},nextDay(){now+=86400000;cfg.freeBoundaryEvidence.checkedAt=new Date(now).toISOString();object=make();},get calls(){return calls;}};
}

test('operator-authenticated Task8 admission durably adds the current turn reservation to the existing six-call record',async t=>{
  const old=originalRecord(),f=await fixture(t,old);
  const denied=await f.response(input(),'/task8/admit','Bearer not-the-operator');
  assert.equal(denied.status,401);assert.equal(f.storage.reads,0);assert.equal(f.storage.writes,0);
  const admitted=await f.call();assert.equal(admitted.kind,'reserved');assert.equal(admitted.reservedNeurons,TURN_RESERVATION_NEURONS);
  const record=await f.record();assert.deepEqual(record.ledger.attempts.slice(0,6),old.ledger.attempts);
  assert.deepEqual(record.results,old.results);assert.deepEqual(record.acceptance,old.acceptance);assert.equal(record.audit,old.audit);
  assert.equal(record.ledger.attempts.length,7);assert.equal(record.ledger.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),256+TURN_RESERVATION_NEURONS);
  assert.equal(record.ledger.attempts[6].task,'task8');assert.equal(record.ledger.attempts[6].status,'reserved');assert.equal(record.ledger.attempts[6].actualNeurons,null);
  assert.equal(f.calls,0);
});

test('concurrent duplicate Task8 admissions grant once and reject changed request or content',async t=>{
  const f=await fixture(t),body=input();
  const results=await Promise.all([f.call(body),f.call(body),f.call(body)]);
  assert.deepEqual(results.map(row=>row.kind),['reserved','duplicate','duplicate']);
  assert.equal(results[1].admissionId,results[0].admissionId);
  for(const changed of [{requestId:'changed-request'},{payloadHash:sha256('changed')},{contextHash:sha256('changed-context')}]){
    const result=await f.call({...body,...changed});assert.equal(result.kind,'denied');assert.equal(result.code,'TASK8_ADMISSION_CONFLICT');
  }
  f.restart();assert.equal((await f.call(body)).kind,'duplicate');assert.equal((await f.record()).ledger.attempts.length,7);assert.equal(f.calls,0);
});

test('new Task8 attempts preserve terminal history across restart and UTC rollover without task ceilings',async t=>{
  const f=await fixture(t);await f.call(input('a'));
  assert.equal((await f.call({...input('a'),status:'unknown'},'/task8/settle')).kind,'settled');
  f.restart();assert.equal((await f.call(input('a'))).kind,'duplicate');
  for(const suffix of ['b','c']){assert.equal((await f.call(input(suffix))).kind,'reserved');assert.equal((await f.call({...input(suffix),status:'failed'},'/task8/settle')).kind,'settled');}
  const previous=await f.record();f.nextDay();
  for(const suffix of ['d','e','f','g','h'])assert.equal((await f.call(input(suffix))).kind,'reserved');
  const record=await f.record();assert.equal(record.ledger.attempts.length,14);
  assert.deepEqual(record.ledger.attempts.slice(0,9),previous.ledger.attempts);assert.deepEqual(record.results,previous.results);
  for(const [id,row]of Object.entries(previous.task8.admissions))assert.deepEqual(record.task8.admissions[id],row);
  assert.equal(record.ledger.attempts.reduce((sum,row)=>sum+row.reservedNeurons,0),256+8*TURN_RESERVATION_NEURONS);assert.equal(f.calls,0);
});

test('concurrent distinct Task8 admissions persist once per identity without the former three-slot ceiling',async t=>{
  const f=await fixture(t),bodies=['a','b','c','d','e'].map(id=>input(id));
  const results=await Promise.all(bodies.map(body=>f.call(body)));
  assert.ok(results.every(row=>row.kind==='reserved'));
  const record=await f.record();assert.equal(record.ledger.attempts.length,11);assert.equal(Object.keys(record.task8.admissions).length,5);
  for(let i=0;i<results.length;i++){
    const row=results[i];assert.equal(row.reservedNeurons,TURN_RESERVATION_NEURONS);assert.deepEqual(record.task8.admissions[row.admissionId].identity,bodies[i]);
    assert.ok(record.ledger.attempts.some(entry=>entry.attemptId===row.admissionId&&entry.task==='task8'&&entry.reservedNeurons===TURN_RESERVATION_NEURONS));
    assert.equal((await f.call(bodies[i])).kind,'duplicate');
  }
  assert.equal((await f.record()).ledger.attempts.length,11);assert.equal(f.calls,0);
});

test('Task8 settlement binds the full admission and cannot replace an earlier unknown outcome',async t=>{
  const f=await fixture(t),body=input();await f.call(body);
  assert.equal((await f.call({...body,contextHash:sha256('wrong'),status:'complete',acceptedSceneHash},'/task8/settle')).code,'TASK8_ADMISSION_CONFLICT');
  assert.equal((await f.call({...input('absent'),status:'complete',acceptedSceneHash},'/task8/settle')).code,'TASK8_ADMISSION_MISSING');
  assert.equal((await f.call({...body,status:'unknown'},'/task8/settle')).kind,'settled');
  assert.equal((await f.call({...body,status:'unknown'},'/task8/settle')).kind,'settled');
  assert.equal((await f.call({...body,status:'complete',acceptedSceneHash},'/task8/settle')).code,'TASK8_SETTLEMENT_CONFLICT');
  assert.equal((await f.record()).ledger.attempts.at(-1).status,'unknown');
});

test('Task8 duplicate and terminal settlement retain the reservation recorded by the admitting deployment',async t=>{
  for(const reservation of [111,130])await t.test(String(reservation),async t=>{
    const original=originalRecord(),body=input('earlier'),id='task8_'+sha256(JSON.stringify([body.sessionRef,body.attemptId]));
    original.ledger.attempts.push({task:'task8',attemptId:id,status:'reserved',reservedNeurons:reservation,actualNeurons:null});
    original.task8={schemaVersion:1,admissions:{[id]:{identity:body,status:'reserved'}}};
    const f=await fixture(t,original),duplicate=await f.call(body);
    assert.equal(duplicate.kind,'duplicate');assert.equal(duplicate.reservedNeurons,reservation);
    assert.equal((await f.call({...body,status:'complete',acceptedSceneHash},'/task8/settle')).kind,'settled');
    const record=await f.record();assert.equal(record.results[id].reservedNeurons,reservation);assert.equal(record.ledger.attempts.at(-1).reservedNeurons,reservation);
    assert.deepEqual(record.ledger.attempts.slice(0,6),original.ledger.attempts.slice(0,6));
    f.restart();assert.equal((await f.call(body)).reservedNeurons,reservation);assert.equal(f.calls,0);
  });
});

test('Task8 complete settlement attests one immutable accepted scene hash across restart and replay',async t=>{
  const f=await fixture(t),body=input(),grant=await f.call(body);
  const settled={...body,status:'complete',acceptedSceneHash};
  const first=await f.call(settled,'/task8/settle');
  assert.equal(first.kind,'settled');assert.equal(first.acceptedSceneHash,acceptedSceneHash);
  const record=await f.record(),row=record.task8.admissions[grant.admissionId];
  assert.deepEqual(row,{identity:body,status:'complete',acceptedSceneHash});
  assert.equal(record.results[grant.admissionId].acceptedSceneHash,acceptedSceneHash);
  assert.equal(record.results[grant.admissionId].contextHash,body.contextHash);
  assert.deepEqual(record.ledger.attempts.slice(0,6),originalRecord().ledger.attempts);
  assert.equal(record.ledger.attempts.at(-1).reservedNeurons,TURN_RESERVATION_NEURONS);assert.equal(record.ledger.attempts.at(-1).actualNeurons,null);
  const writes=f.storage.writes;f.restart();
  assert.deepEqual(await f.call(settled,'/task8/settle'),first);
  assert.equal((await f.call({...settled,acceptedSceneHash:sha256('different-scene')},'/task8/settle')).code,'TASK8_SETTLEMENT_CONFLICT');
  assert.equal((await f.call({...body,status:'failed'},'/task8/settle')).code,'TASK8_SETTLEMENT_CONFLICT');
  assert.equal((await f.call(body)).kind,'duplicate');
  assert.equal(f.storage.writes,writes);assert.deepEqual(await f.record(),record);assert.equal(f.calls,0);
});

test('Task8 scene attestation is forbidden on admission or non-complete settlement and required on complete',async t=>{
  const f=await fixture(t),body=input();
  assert.equal((await f.response({...body,acceptedSceneHash})).status,400);
  await f.call(body);const before=await f.record(),writes=f.storage.writes;
  for(const extra of [{},{acceptedSceneHash:null},{acceptedSceneHash:'a'.repeat(63)},{acceptedSceneHash:'A'.repeat(64)}]){
    assert.equal((await f.response({...body,status:'complete',...extra},'/task8/settle')).status,400);
  }
  for(const status of ['failed','unknown'])assert.equal((await f.response({...body,status,acceptedSceneHash},'/task8/settle')).status,400);
  assert.equal(f.storage.writes,writes);assert.deepEqual(await f.record(),before);assert.equal(f.calls,0);
});

test('Task8 complete records without a coherent scene attestation fail closed without backfilling',async t=>{
  for(const mode of ['legacy','result-missing','result-changed'])await t.test(mode,async t=>{
    const f=await fixture(t),body=input(),grant=await f.call(body),record=await f.record();
    record.ledger.attempts.at(-1).status='complete';
    record.task8.admissions[grant.admissionId]={identity:body,status:'complete',...(mode==='legacy'?{}:{acceptedSceneHash})};
    record.results[grant.admissionId]={task:'task8',...body,status:'complete',reservedNeurons:TURN_RESERVATION_NEURONS,actualNeurons:null,...(mode==='result-changed'?{acceptedSceneHash:sha256('changed-result')}:{})};
    if(mode==='result-missing')delete record.results[grant.admissionId];
    await f.storage.put('experiment-v1',record);const writes=f.storage.writes;f.restart();
    assert.equal((await f.call(body)).code,'EXPERIMENT_LEDGER_INVALID');
    assert.equal((await f.call({...body,status:'complete',acceptedSceneHash},'/task8/settle')).code,'EXPERIMENT_LEDGER_INVALID');
    assert.deepEqual(await f.record(),record);assert.equal(f.storage.writes,writes);assert.equal(f.calls,0);
  });
});

test('Task8 refuses malformed identities, caller-selected reservations and invalid fresh account proof',async t=>{
  const f=await fixture(t);
  for(const body of [{...input(),reservedNeurons:1},{...input(),task:'task1'},{...input(),payloadHash:'bad'},{...input(),attemptId:'bad space'},{...input(),context:{}},{...input(),status:'unknown'}]){
    assert.equal((await f.response(body)).status,400);
  }
  assert.equal(f.storage.writes,0);
  for(const change of [{checkedAt:'2020-01-01T00:00:00.000Z'},{accountId:'other'},{plan:'workers-paid'},{remainingNeurons:-1}]){
    const original={...f.cfg.freeBoundaryEvidence};Object.assign(f.cfg.freeBoundaryEvidence,change);f.restart();
    assert.equal((await f.call()).kind,'denied');assert.equal(f.storage.writes,0);f.cfg.freeBoundaryEvidence=original;
  }
  f.restart();delete f.env.AI;assert.equal((await f.call()).code,'AI_BINDING_MISSING');assert.equal(f.storage.writes,0);assert.equal(f.calls,0);
});

test('Task8 admission exceeds former global totals while leaving every historical reservation intact',async t=>{
  const high=originalRecord();high.ledger.attempts[5].reservedNeurons=10001;
  const full={...originalRecord(),ledger:{schemaVersion:1,attempts:Array.from({length:12},(_,i)=>({task:i<4?'task1':i<9?'task7':'task8',attemptId:'prior-'+i,reservedNeurons:50,actualNeurons:null,status:'unknown'}))}};
  for(const original of [high,full])await t.test(String(original.ledger.attempts.length),async t=>{
    const f=await fixture(t,original);f.cfg.freeBoundaryEvidence.remainingNeurons=0;f.restart();
    assert.equal((await f.call()).kind,'reserved');const stored=await f.record();
    assert.deepEqual(stored.ledger.attempts.slice(0,-1),original.ledger.attempts);assert.deepEqual(stored.results,original.results);
    assert.equal(stored.ledger.attempts.at(-1).reservedNeurons,TURN_RESERVATION_NEURONS);assert.equal(f.calls,0);
  });
});

test('failed durable admission and settlement writes never recycle or invoke Task8',async t=>{
  const f=await fixture(t),put=f.storage.put.bind(f.storage);
  f.storage.put=async()=>{throw Error('private persistence detail');};
  assert.equal((await f.call()).code,'LEDGER_PERSIST_FAILED');assert.deepEqual(await f.record(),originalRecord());
  f.storage.put=put;assert.equal((await f.call()).kind,'reserved');
  f.storage.put=async()=>{throw Error('private persistence detail');};
  assert.equal((await f.call({...input(),status:'complete',acceptedSceneHash},'/task8/settle')).code,'LEDGER_PERSIST_FAILED');
  f.storage.put=put;f.restart();assert.equal((await f.call()).kind,'duplicate');
  const record=await f.record();assert.equal(record.ledger.attempts.at(-1).status,'reserved');assert.equal(f.calls,0);assert.doesNotMatch(JSON.stringify(record),/private persistence detail|fixture-operator-secret/);
});

test('Task8 never initializes a replacement ledger when the existing record is missing',async t=>{
  const f=await fixture(t);f.storage.get=async()=>undefined;
  assert.equal((await f.call()).code,'EXPERIMENT_LEDGER_INVALID');assert.equal(f.storage.writes,0);assert.equal(f.calls,0);
});

test('Task8 atomically retains a private observation with immutable acknowledgment and original eight rows',async t=>{
  const old=originalRecord();old.ledger.attempts.push({task:'task7',attemptId:'old-task7-c',reservedNeurons:83,actualNeurons:null,status:'failed'});
  const legacy=input('legacy'),legacyId='task8_'+sha256(JSON.stringify([legacy.sessionRef,legacy.attemptId]));
  old.ledger.attempts.push({task:'task8',attemptId:legacyId,reservedNeurons:111,actualNeurons:null,status:'failed'});
  old.task8={schemaVersion:1,admissions:{[legacyId]:{identity:legacy,status:'failed'}}};
  old.results[legacyId]={task:'task8',...legacy,status:'failed',reservedNeurons:111,actualNeurons:null};
  const f=await fixture(t,old),body=input(),grant=await f.call(body),observation=privateObservation();
  const settled={...body,status:'failed',observation};const ack=await f.call(settled,'/task8/settle');
  assert.equal(ack.kind,'settled');assert.match(ack.observationHash,/^[a-f0-9]{64}$/);
  const record=await f.record();assert.deepEqual(record.results[grant.admissionId].observation,observation);
  assert.equal(record.results[grant.admissionId].observationHash,ack.observationHash);
  assert.equal(record.task8.admissions[grant.admissionId].observationHash,ack.observationHash);
  assert.equal(Object.hasOwn(record.task8.admissions[grant.admissionId],'observation'),false);
  assert.deepEqual(record.ledger.attempts.slice(0,8),old.ledger.attempts);assert.deepEqual(record.acceptance,old.acceptance);
  for(const [id,result]of Object.entries(old.results))assert.deepEqual(record.results[id],result);
  assert.equal(record.ledger.attempts.length,9);assert.equal(record.ledger.attempts.reduce((n,x)=>n+x.reservedNeurons,0),450+TURN_RESERVATION_NEURONS);
  const writes=f.storage.writes;f.restart();assert.deepEqual(await f.call(settled,'/task8/settle'),ack);
  for(const changed of [{...settled,observation:privateObservation({latencyMs:124})},{...body,status:'failed'},{...legacy,status:'failed',observation}])assert.equal((await f.call(changed,'/task8/settle')).code,'TASK8_SETTLEMENT_CONFLICT');
  assert.equal(f.storage.writes,writes);assert.deepEqual(await f.record(),record);assert.equal(f.calls,0);
});

test('Task8 observations on complete and unknown outcomes remain bounded and preserve reservations on write failure',async t=>{
  const f=await fixture(t),body=input();await f.call(body);
  const observation=privateObservation({errorCode:null,structureDiagnostic:null}),settled={...body,status:'complete',acceptedSceneHash,observation};
  const put=f.storage.put.bind(f.storage);f.storage.put=async()=>{throw Error('PRIVATE_SENTINEL');};
  assert.equal((await f.call(settled,'/task8/settle')).code,'LEDGER_PERSIST_FAILED');
  f.storage.put=put;f.restart();assert.equal((await f.record()).ledger.attempts.at(-1).status,'reserved');
  assert.equal((await f.call(body)).kind,'duplicate');assert.equal((await f.call(settled,'/task8/settle')).kind,'settled');
  const other=input('b');await f.call(other);
  const unknown=privateObservation({errorCode:'PROVIDER_TIMEOUT',structureDiagnostic:null,usage:null,stopReason:null,nonThinkingValidated:null});
  assert.equal((await f.call({...other,status:'unknown',observation:unknown},'/task8/settle')).kind,'settled');
  const record=await f.record();assert.deepEqual(record.ledger.attempts.slice(-2).map(x=>[x.status,x.reservedNeurons]),[['complete',TURN_RESERVATION_NEURONS],['unknown',TURN_RESERVATION_NEURONS]]);assert.equal(f.calls,0);
  assert.doesNotMatch(JSON.stringify(record),/PRIVATE_SENTINEL/);
});

test('Task8 rejects unsafe observations and inconsistent stored observation copies without writes',async t=>{
  const f=await fixture(t),body=input(),grant=await f.call(body);const writes=f.storage.writes;
  assert.equal((await f.response({...body,observation:privateObservation()})).status,400);
  for(const observation of [privateObservation({raw:'PRIVATE_SENTINEL'}),privateObservation({errorCode:'PRIVATE_SENTINEL'}),privateObservation({latencyMs:-1})])assert.equal((await f.response({...body,status:'failed',observation},'/task8/settle')).status,400);
  assert.equal(f.storage.writes,writes);
  assert.equal((await f.call({...body,status:'failed',observation:privateObservation()},'/task8/settle')).kind,'settled');
  const good=await f.record();
  for(const mutate of [r=>r.results[grant.admissionId].observation.latencyMs++,r=>delete r.results[grant.admissionId].observation,r=>delete r.task8.admissions[grant.admissionId].observationHash]){
    const corrupt=structuredClone(good);mutate(corrupt);await f.storage.put('experiment-v1',corrupt);f.restart();const before=f.storage.writes;
    assert.equal((await f.call(body)).code,'EXPERIMENT_LEDGER_INVALID');assert.equal(f.storage.writes,before);
  }
});

test('maximum identity and bounded observation metadata fit the unchanged 1024-byte settlement route',async t=>{
  const f=await fixture(t),body={sessionRef:'s'.repeat(80),requestId:'r'.repeat(80),attemptId:'a'.repeat(80),payloadHash:'a'.repeat(64),contextHash:'b'.repeat(64)};
  const observation=privateObservation({errorCode:null,structureDiagnostic:null,inputBytes:STORY_LIMITS.maxInputBytes,usage:{promptTokens:500000000,completionTokens:500000000,totalTokens:1000000000},stopReason:'content_filter',latencyMs:86400000});
  const settlement={...body,status:'complete',acceptedSceneHash,observation};
  assert.ok(Buffer.byteLength(JSON.stringify(settlement))<=1024);assert.equal((await f.call(body)).kind,'reserved');
  assert.equal((await f.call(settlement,'/task8/settle')).kind,'settled');assert.equal(f.calls,0);
});
