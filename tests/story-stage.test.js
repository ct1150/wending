import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import { DatabaseSync } from 'node:sqlite';
import { OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { createBudgetCoordinator } from '../src/worker/story-budget.js';
import { createStoryWorker } from '../src/worker/index.js';
import {TURN_RESERVATION_NEURONS} from '../src/worker/story-api.js';
import { createStoryClient } from '../src/ui/story-client.js';
import { createLiveGame,prepareOpening } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { canonicalStringify,sha256 } from '../src/game/cultivation/live/identity.js';

const origin='https://game.example',permit='a8'.repeat(32),operatorToken='fixture-server-only-operator-credential-with-32-characters';
const testerHeader='x-wending-story-tester';
const oldRecord=()=>({schemaVersion:1,ledger:{schemaVersion:1,attempts:[...Array.from({length:4},(_,i)=>({task:'task1',attemptId:'old1-'+i,reservedNeurons:24,actualNeurons:null,status:'complete'})),{task:'task7',attemptId:'old7-a',reservedNeurons:77,actualNeurons:null,status:'failed'},{task:'task7',attemptId:'old7-b',reservedNeurons:83,actualNeurons:null,status:'failed'}]},results:{},acceptance:{schemaVersion:1,cases:{}}});
const prepare=(id='request-a')=>{const state=createLiveGame({runId:'stage-run',seed:42});const pending=prepareOpening(state,{requestId:id});return {pending,context:buildStoryContext(state,pending)};};
const scene=context=>({id:context.namespace+':t1:s:opening',title:'山中来信',location:'山下',blocks:[{kind:'narration',text:'一位旅人留下了一封来信。'}],entities:[],choices:['a','b'].map(id=>({id:context.namespace+':t1:c:'+id,label:id,intent:id==='a'?'rest':'practice',targetId:'self',approach:id==='a'?'recover':'steady',stake:'normal'})),memoryDeltas:[]});
const request=(path,body,cookie,provided=permit)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.8',...(cookie?{cookie}:{}),...(provided===null?{}:{[testerHeader]:provided})},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function stageFactory(options){
  const module=await import('../src/worker/story-stage.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
  assert.equal(typeof module.createStoryStageWorker,'function','server-only tester composition is not implemented');
  return module.createStoryStageWorker(options);
}
async function fixture(t,options={}){
  const db=new DatabaseSync(':memory:'),privateDb=new DatabaseSync(':memory:');t.after(()=>{db.close();privateDb.close();});
  const playerStorage={sql:{exec(q,...args){return {toArray:()=>db.prepare(q).all(...args)};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}};
  const budget=createBudgetCoordinator({storage:playerStorage});
  privateDb.exec('CREATE TABLE kv (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const privateStorage={sql:{},async get(key){const row=privateDb.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?JSON.parse(row.value):undefined;},async put(key,value){privateDb.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}};
  await privateStorage.put('experiment-v1',oldRecord());
  const proof={accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()};
  const config={enabled:true,mode:'tester-only',modelId:CANDIDATE_MODEL_ID,testerPermitSha256:sha256(permit),bindingAccountId:'fixture-account',currentPlan:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:proof};
  let calls=0,bridgeAdmissions=0;const operatorCfg={operatorTokenSha256:sha256(operatorToken),bindingAccountId:'fixture-account',freeBoundaryEvidence:proof};
  const operator=new OperatorProbeDurableObject({storage:privateStorage},{AI:{run(){throw Error('admission cannot call AI');}}},operatorCfg);
  const env={STORY_OPERATOR_TOKEN:operatorToken,STORY_BUDGET:{idFromName(name){assert.equal(name,'story-budget-v1-global');return name;},get(){return {async fetch(req){const method=new URL(req.url).pathname.slice(1);return Response.json(budget[method](await req.json()));}};}},STORY_EXPERIMENT:{idFromName(name){assert.equal(name,'wending-realtime-acceptance-v1');return name;},get(){return {async fetch(req){assert.equal(req.headers.get('authorization'),'Bearer '+operatorToken);assert.equal(req.headers.has(testerHeader),false);if(new URL(req.url).pathname==='/task8/admit')bridgeAdmissions++;return operator.fetch(req);}};}},AI:{async run(model,input){
    calls++;assert.equal(model,CANDIDATE_MODEL_ID);assert.equal(input.max_tokens,1536);
    assert.equal(db.prepare('SELECT status FROM ledger ORDER BY rowid DESC LIMIT 1').get().status,'reserved');
    assert.equal((await privateStorage.get('experiment-v1')).ledger.attempts.at(-1).status,'reserved');
    if(options.run)return options.run(model,input);
    const context=JSON.parse(input.messages[1].content);
    return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene(context))}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
  }}};
  let worker=await stageFactory({config,staticFetch:()=>new Response('static')});
  const fetch=req=>worker.fetch(req,env);
  return {env,config,db,privateStorage,operator,fetch,async useConfig(next){worker=await stageFactory({config:next});},async session(provided=permit){const response=await fetch(request('/api/story/session',{protocolVersion:1},null,provided));return {data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};},async record(){return privateStorage.get('experiment-v1');},get calls(){return calls;},get bridgeAdmissions(){return bridgeAdmissions;}};
}
const body=(session,id='a',retryOf=null)=>({...prepare('request-'+id),attempt:{id:'attempt-'+id,sessionRef:session.data.sessionRef,retryOf}});
const wireBody=value=>({context:value.context,attempt:value.attempt});

test('tester-only composition denies missing, wrong and operator credentials without shared reservations or AI',async t=>{
  const f=await fixture(t);
  for(const provided of [null,'b9'.repeat(32),operatorToken]){
    const capabilities=await (await f.fetch(request('/api/story/capabilities',undefined,null,provided))).json();
    assert.equal(capabilities.available,false);assert.equal(capabilities.errorCode,'TESTER_PERMIT_REQUIRED');
    const session=await f.session(provided);assert.equal(session.data.status,'paused');assert.equal(session.cookie,undefined);
  }
  assert.equal(f.bridgeAdmissions,0);assert.equal(f.calls,0);assert.deepEqual(await f.record(),oldRecord());
  assert.equal(await (await f.fetch(new Request(origin+'/'))).text(),'static');
});

test('production startup-clock simulation does not latch a valid stage policy as invalid',async t=>{
  const f=await fixture(t);
  // Production observation: Date.now() is 0 during module evaluation, then
  // becomes request time. This is a simulation; pinned local workerd differs.
  const startupClock=t.mock.method(Date,'now',()=>0);
  try{await f.useConfig(f.config);}finally{startupClock.mock.restore();}
  const missing=await(await f.fetch(request('/api/story/capabilities',undefined,null,null))).json();
  assert.equal(missing.available,false);assert.equal(missing.errorCode,'TESTER_PERMIT_REQUIRED');
  const permitted=await(await f.fetch(request('/api/story/capabilities'))).json();
  assert.equal(permitted.available,true);assert.equal(permitted.errorCode,null);
  assert.equal(f.calls,0);assert.equal(f.bridgeAdmissions,0);assert.deepEqual(await f.record(),oldRecord());
});

test('true player cookie and protocol client traverse both durable reservations once, then replay after disable',async t=>{
  const f=await fixture(t);let cookie=null,setCookie=null;
  const client=createStoryClient({location:{protocol:'https:'},fetch:async(path,init)=>{
    assert.equal(init.credentials,'same-origin');const headers=new Headers(init.headers);headers.set('origin',origin);headers.set(testerHeader,permit);if(cookie)headers.set('cookie',cookie);
    const response=await f.fetch(new Request(origin+path,{...init,headers}));if(response.headers.has('set-cookie')){setCookie=response.headers.get('set-cookie');cookie=setCookie.split(';')[0];}return response;
  }});
  assert.equal((await client.capabilities()).available,true);
  const session=await client.createSession();assert.match(setCookie,/^__Host-story_session=[a-f0-9]{64}; Path=\/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict$/);
  assert.equal((await client.createSession()).sessionRef,session.sessionRef);
  const {pending,context}=prepare(),attempt={id:'attempt-a',sessionRef:session.sessionRef,retryOf:null};
  const result=await client.requestTurn(pending,context,attempt);assert.equal(result.status,'ready');
  assert.equal(f.calls,1);assert.equal(f.bridgeAdmissions,1);
  const record=await f.record();assert.equal(record.ledger.attempts.length,7);assert.equal(record.ledger.attempts.at(-1).reservedNeurons,TURN_RESERVATION_NEURONS);assert.equal(record.ledger.attempts.at(-1).status,'complete');
  const admissionId=record.ledger.attempts.at(-1).attemptId,acceptedSceneHash=sha256(canonicalStringify(result.scene));
  assert.equal(record.task8.admissions[admissionId].acceptedSceneHash,acceptedSceneHash);
  assert.equal(record.results[admissionId].acceptedSceneHash,acceptedSceneHash);
  assert.equal(record.results[admissionId].contextHash,sha256(canonicalStringify(context)));
  assert.equal(Object.hasOwn(result,'acceptedSceneHash'),false);
  assert.doesNotMatch(JSON.stringify(record),new RegExp(permit+'|'+operatorToken));
  await f.useConfig({enabled:false});assert.equal((await client.capabilities()).errorCode,'INFERENCE_DISABLED');
  assert.deepEqual(await client.getTurn(pending,attempt),result);assert.deepEqual(await client.requestTurn(pending,context,attempt),result);
  assert.equal(f.calls,1);assert.equal(f.bridgeAdmissions,1);
});

test('player acceptance continues beyond the former Task8 cap while replay stays idempotent',async t=>{
  const f=await fixture(t),s=await f.session();
  for(const id of ['a','b','c'])assert.equal((await (await f.fetch(request('/api/story/turn',wireBody(body(s,id)),s.cookie))).json()).status,'ready');
  const fourth=wireBody(body(s,'d')),result=await (await f.fetch(request('/api/story/turn',fourth,s.cookie))).json();
  assert.equal(result.status,'ready');assert.equal(f.calls,4);
  assert.deepEqual(await (await f.fetch(request('/api/story/turn',fourth,s.cookie))).json(),result);assert.equal(f.bridgeAdmissions,4);
  const row=f.db.prepare('SELECT status,charge FROM ledger WHERE attempt_id=?').get('attempt-d');assert.equal(row.status,'complete');assert.equal(row.charge,TURN_RESERVATION_NEURONS);
  assert.equal((await f.record()).ledger.attempts.length,10);
});

test('shared admission persistence failure settles a recoverable player pause without invoking AI',async t=>{
  const f=await fixture(t),s=await f.session(),turn=wireBody(body(s));
  f.privateStorage.put=async()=>{throw Error('private storage secret');};
  const result=await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json();
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'LEDGER_PERSIST_FAILED');assert.equal(f.calls,0);
  assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'unknown');assert.deepEqual(await f.record(),oldRecord());
  assert.deepEqual(await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json(),result);assert.equal(f.bridgeAdmissions,1);
  assert.doesNotMatch(JSON.stringify(result),/private storage secret/);
});

test('a duplicate experiment grant never invokes AI even when the player response row is new',async t=>{
  const f=await fixture(t),s=await f.session(),turn=wireBody(body(s));
  const admission={sessionRef:turn.attempt.sessionRef,requestId:turn.context.identity.requestId,attemptId:turn.attempt.id,payloadHash:sha256(canonicalStringify(turn)),contextHash:sha256(canonicalStringify(turn.context))};
  const first=await f.operator.fetch(new Request('https://operator.invalid/task8/admit',{method:'POST',headers:{authorization:'Bearer '+operatorToken,'content-type':'application/json'},body:JSON.stringify(admission)}));assert.equal((await first.json()).kind,'reserved');
  const result=await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json();
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'EXPERIMENT_ATTEMPT_ALREADY_ADMITTED');assert.equal(f.calls,0);assert.equal((await f.record()).ledger.attempts.length,7);
});

test('provider uncertainty and failed bridge settlement retain permanent unknown or reserved commitments',async t=>{
  for(const mode of ['provider','settlement'])await t.test(mode,async t=>{
    const f=await fixture(t,mode==='provider'?{run(){throw Error('private provider secret');}}:{}),s=await f.session(),turn=wireBody(body(s));
    if(mode==='settlement'){const put=f.privateStorage.put.bind(f.privateStorage);let writes=0;f.privateStorage.put=async(...args)=>{if(writes++)throw Error('private settlement secret');return put(...args);};}
    const result=await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json();assert.equal(result.status,'paused');
    assert.equal(result.errorCode,mode==='provider'?'PROVIDER_FAILED':'EXPERIMENT_BUDGET_UNAVAILABLE');assert.equal(f.calls,1);
    assert.equal((await f.record()).ledger.attempts.at(-1).status,mode==='provider'?'unknown':'reserved');assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'unknown');
    assert.deepEqual(await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json(),result);assert.equal(f.calls,1);
  });
});

test('bridge settlement acknowledgement must attest the same accepted scene before the player receives ready',async t=>{
  for(const mode of ['missing','changed'])await t.test(mode,async t=>{
    const f=await fixture(t),s=await f.session(),turn=wireBody(body(s));
    const originalGet=f.env.STORY_EXPERIMENT.get.bind(f.env.STORY_EXPERIMENT);
    f.env.STORY_EXPERIMENT.get=(...args)=>{const stub=originalGet(...args);return {async fetch(req){
      const response=await stub.fetch(req);
      if(new URL(req.url).pathname!=='/task8/settle')return response;
      const result=await response.json();
      if(mode==='missing')delete result.acceptedSceneHash;else result.acceptedSceneHash=sha256('different-scene');
      return Response.json(result);
    }};};
    const result=await(await f.fetch(request('/api/story/turn',turn,s.cookie))).json();
    assert.equal(result.status,'paused');assert.equal(result.errorCode,'EXPERIMENT_BUDGET_UNAVAILABLE');
    assert.equal(f.calls,1);assert.equal(f.bridgeAdmissions,1);
    const record=await f.record(),id=record.ledger.attempts.at(-1).attemptId;
    assert.equal(record.ledger.attempts.at(-1).status,'complete');
    assert.equal(record.task8.admissions[id].acceptedSceneHash,sha256(canonicalStringify(scene(turn.context))));
    const player=f.db.prepare('SELECT status,charge,actual FROM ledger').get();assert.equal(player.status,'unknown');assert.equal(player.charge,TURN_RESERVATION_NEURONS);assert.equal(player.actual,null);
    assert.deepEqual(await(await f.fetch(request('/api/story/turn',turn,s.cookie))).json(),result);
    assert.equal(f.calls,1);assert.equal(f.bridgeAdmissions,1);assert.deepEqual(await f.record(),record);
  });
});

test('strict scene rejection and provider uncertainty never persist or forward accepted scene hashes',async t=>{
  for(const mode of ['rejected','unknown'])await t.test(mode,async t=>{
    const f=await fixture(t,{run(model,input){
      if(mode==='unknown')throw Error('provider unavailable');
      const invalid=scene(JSON.parse(input.messages[1].content));invalid.choices[0].approach='steady';
      return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(invalid)}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180},acceptedSceneHash:sha256('untrusted-provider-hash')};
    }}),s=await f.session(),turn=wireBody(body(s));
    const originalGet=f.env.STORY_EXPERIMENT.get.bind(f.env.STORY_EXPERIMENT);let settlement;
    f.env.STORY_EXPERIMENT.get=(...args)=>{const stub=originalGet(...args);return {async fetch(req){
      if(new URL(req.url).pathname==='/task8/settle')settlement=await req.clone().json();
      return stub.fetch(req);
    }};};
    const result=await(await f.fetch(request('/api/story/turn',turn,s.cookie))).json();
    assert.equal(result.status,mode==='rejected'?'rejected':'paused');assert.equal(f.calls,1);
    assert.equal(settlement.status,mode==='rejected'?'failed':'unknown');assert.equal(Object.hasOwn(settlement,'acceptedSceneHash'),false);
    const record=await f.record(),id=record.ledger.attempts.at(-1).attemptId;
    assert.equal(Object.hasOwn(record.task8.admissions[id],'acceptedSceneHash'),false);
    assert.equal(Object.hasOwn(record.results[id],'acceptedSceneHash'),false);
    assert.equal(record.ledger.attempts.at(-1).reservedNeurons,TURN_RESERVATION_NEURONS);assert.equal(record.ledger.attempts.at(-1).actualNeurons,null);
  });
});

test('provider quota exhaustion survives failed experiment settlement and blocks explicit retry',async t=>{
  const f=await fixture(t,{run(){throw Object.assign(new Error('quota'),{code:3036});}}),s=await f.session(),turn=wireBody(body(s));
  const put=f.privateStorage.put.bind(f.privateStorage);let writes=0;
  f.privateStorage.put=async(...args)=>{if(writes++)throw Error('private settlement failure');return put(...args);};
  const result=await (await f.fetch(request('/api/story/turn',turn,s.cookie))).json();
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'EXPERIMENT_BUDGET_UNAVAILABLE');assert.equal(f.calls,1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM quota').get().count,1);
  const firstPlayer=f.db.prepare('SELECT * FROM ledger').get(),firstExperiment=await f.record();
  assert.equal(firstPlayer.status,'unknown');assert.equal(firstPlayer.charge,TURN_RESERVATION_NEURONS);assert.equal(firstPlayer.reserved,TURN_RESERVATION_NEURONS);assert.equal(firstPlayer.actual,null);
  assert.equal(firstExperiment.ledger.attempts.length,7);assert.equal(firstExperiment.ledger.attempts.at(-1).status,'reserved');assert.equal(firstExperiment.ledger.attempts.at(-1).reservedNeurons,TURN_RESERVATION_NEURONS);assert.equal(firstExperiment.ledger.attempts.at(-1).actualNeurons,null);
  const retry=structuredClone(turn);retry.attempt={id:'explicit-retry',sessionRef:s.data.sessionRef,retryOf:{attemptId:turn.attempt.id,sessionRef:s.data.sessionRef}};
  const paused=await (await f.fetch(request('/api/story/turn',retry,s.cookie))).json();
  assert.equal(paused.status,'paused');assert.equal(paused.errorCode,'FREE_QUOTA_EXHAUSTED');assert.equal(f.calls,1);assert.equal(f.bridgeAdmissions,1);
  assert.deepEqual(f.db.prepare('SELECT * FROM ledger').all(),[firstPlayer]);assert.deepEqual(await f.record(),firstExperiment);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM quota').get().count,1);
});

test('tester policy cannot activate the public worker or bypass a missing bridge or account proof',async t=>{
  const f=await fixture(t);
  const publicWorker=createStoryWorker({config:f.config});
  assert.equal((await (await publicWorker.fetch(request('/api/story/capabilities'),f.env)).json()).errorCode,'MODEL_UNVALIDATED');
  for(const key of ['STORY_OPERATOR_TOKEN','STORY_EXPERIMENT']){const old=f.env[key];delete f.env[key];assert.equal((await (await f.fetch(request('/api/story/capabilities'))).json()).available,false);f.env[key]=old;}
  await f.useConfig({...f.config,freeBoundaryProof:{...f.config.freeBoundaryProof,accountId:'wrong'}});
  assert.equal((await (await f.fetch(request('/api/story/capabilities'))).json()).available,false);
  assert.equal(f.calls,0);assert.equal(f.bridgeAdmissions,0);
});
