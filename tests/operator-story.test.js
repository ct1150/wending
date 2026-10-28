import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { createLiveGame,prepareOpening,prepareChoice,commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { sha256,canonicalStringify } from '../src/game/cultivation/live/identity.js';

const token='fixture-only-story-operator';
const caseIds=['task7-opening','task7-continuation','task7-counterfactual-a','task7-counterfactual-b'];
const revisedCaseIds=['task7-opening-v2','task7-branch-a-v2','task7-branch-b-v2'];
const scopeCorrectedCaseIds=['task7-opening-v3','task7-branch-a-v3','task7-branch-b-v3'];
function disk(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT)');return {sql:{},async get(key){const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?JSON.parse(row.value):undefined;},async put(key,value){db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}};}
const oldRecord=()=>({schemaVersion:1,ledger:{schemaVersion:1,attempts:Array.from({length:4},(_,i)=>({attemptId:'old'+i,task:'task1',reservedNeurons:24,actualNeurons:null,status:'complete'}))},results:Object.fromEntries(Array.from({length:4},(_,i)=>['old'+i,{status:'passed',reasoningPresent:true,reasoningChars:2,reasoningNonWhitespacePresent:false}]))});
function failedOriginalRecord(){
  // Sanitized shape of the actual rejected opening. New invocations below use
  // only the local binding fixture; the historical 77 reservation is immutable.
  const record=oldRecord(),attemptId='task7-20261028-001';
  const state=createLiveGame({runId:'live-acceptance-v1',seed:42,name:'云归',originId:'village'});
  const pending=prepareOpening(state,{requestId:'task7-opening'});
  const association={attemptId,caseId:'task7-opening',status:'failed',contextHash:'79633954725d5bc0297050ae77faf26d5ae55db7f066fb11b116b54923adcbbb',inputHash:'fca92c29a99c9df20f9a70f9701c8131c4abea0e8d307f85e58db5992f9559c1',inputBytes:5314,baseStateHash:pending.identity.stateHash,identity:pending.identity,receipt:pending.receipt};
  record.ledger.attempts.push({task:'task7',attemptId,reservedNeurons:77,actualNeurons:null,status:'failed'});
  record.results[attemptId]={schemaVersion:1,sampleKind:'workers-ai',task:'task7',caseId:'task7-opening',attemptId,contextHash:association.contextHash,inputHash:association.inputHash,inputBytes:5314,modelId:'@cf/qwen/qwen3-30b-a3b-fp8',rulesVersion:1,promptVersion:1,reservedNeurons:77,actualNeurons:null,inferencePerformed:true,usage:{promptTokens:823,completionTokens:563,totalTokens:1386},stopReason:'stop',latencyMs:5888,status:'rejected',identity:pending.identity,receipt:pending.receipt,errorCode:'GENERATED_SCENE_INVALID'};
  record.acceptance={schemaVersion:1,cases:{'task7-opening':association}};
  return record;
}
function failedRevisedRecord(){
  // The second rejected opening is a separate permanent case, not a retry of
  // the first. Its original input/receipt metadata remains the v2 observation.
  const record=failedOriginalRecord(),attemptId='task7-20261028-002',caseId='task7-opening-v2';
  const state=createLiveGame({runId:'live-acceptance-v1',seed:42,name:'云归',originId:'village'});
  const pending=prepareOpening(state,{requestId:caseId});
  const association={attemptId,caseId,status:'failed',contextHash:'b5675e9306d0a787a6811bbab70a93deb662fc32ddb251b1cbf18e9f977a02c2',inputHash:'add5f707be99b2c2ed40a62d85b3b0558170d7f5f02567bc2332b1496d3ae1c7',inputBytes:6659,baseStateHash:pending.identity.stateHash,identity:pending.identity,receipt:pending.receipt,recipeVersion:2};
  record.ledger.attempts.push({task:'task7',attemptId,reservedNeurons:83,actualNeurons:null,status:'failed'});
  record.results[attemptId]={schemaVersion:1,sampleKind:'workers-ai',task:'task7',caseId,attemptId,contextHash:association.contextHash,inputHash:association.inputHash,inputBytes:6659,modelId:'@cf/qwen/qwen3-30b-a3b-fp8',rulesVersion:1,promptVersion:1,reservedNeurons:83,actualNeurons:null,inferencePerformed:true,usage:{promptTokens:1085,completionTokens:581,totalTokens:1666},stopReason:'stop',latencyMs:4838,status:'rejected',identity:pending.identity,receipt:pending.receipt,recipeVersion:2,errorCode:'SCENE_ID_SCOPE_INVALID'};
  record.acceptance.cases[caseId]=association;
  return record;
}
function scene(context){const p=context.namespace+':t'+context.identity.turnId+':',entity=context.entities[0]??{id:p+'e:keeper',name:'守山人',kind:'person',status:'alive'};return {id:p+'s:path',title:'山路新事',location:'松溪山门',blocks:[{kind:'narration',text:'山路传来新消息，第'+context.identity.turnId+'回。行动'+(context.receipt.action?.intent??'opening')+'。'},{kind:'dialogue',speaker:entity.id,text:'旧约还记在册中。'}],entities:[entity],choices:[{id:p+'c:talk',label:'协助守山人',intent:'negotiate',targetId:entity.id,stake:'low',approach:'cooperate'},{id:p+'c:rest',label:'歇息观察',intent:'rest',targetId:'self',stake:'low',approach:'recover'}],memoryDeltas:context.identity.turnId===1?[{kind:'promise',entityId:entity.id,text:'替守山人留意山路。'}]:[]};}
function raw(context){return {model:'@cf/qwen/qwen3-30b-a3b-fp8',choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene(context)),reasoning_content:' \n'}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};}
const config=()=>({operatorTokenSha256:sha256(token),bindingAccountId:'fixture-account',freeBoundaryEvidence:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()}});
const req=(caseId='task7-opening',attemptId='story0',extra={})=>new Request('https://operator.invalid/story-acceptance',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({attemptId,caseId,...extra})});
const statusReq=()=>new Request('https://operator.invalid/status',{headers:{authorization:'Bearer '+token}});
async function fixture(run,initial=oldRecord()){const storage=disk();await storage.put('experiment-v1',initial);const inputs=[];const env={AI:{async run(model,input){const snapshot=await storage.get('experiment-v1'),entry=snapshot.ledger.attempts.at(-1);assert.equal(entry.task,'task7');assert.equal(entry.status,'reserved');const c=JSON.parse(input.messages[1].content);const pending=Object.values(snapshot.acceptance.cases).find(row=>row.attemptId===entry.attemptId);assert.equal(pending.contextHash,sha256(canonicalStringify(c)));assert.equal(pending.inputHash,sha256(JSON.stringify(input)));assert.equal(pending.inputBytes,new TextEncoder().encode(JSON.stringify(input)).length);assert.ok(entry.reservedNeurons>24&&entry.reservedNeurons<=111);inputs.push({model,input,context:c});return run?run(c):raw(c);}}};const cfg=config(),make=()=>new OperatorProbeDurableObject({storage},env,cfg);return {storage,env,cfg,make,object:make(),inputs};}
const call=async(f,caseId,attemptId)=>{const r=await f.object.fetch(req(caseId,attemptId));return r.json();};

test('fixed story cases preserve old ledger, exact prerequisites and full-input durable accounting',async()=>{const f=await fixture();assert.equal((await call(f,'task7-continuation','early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');assert.equal(f.inputs.length,0);for(let i=0;i<4;i++){const r=await call(f,caseIds[i],'story'+i);assert.equal(r.status,'ready');assert.equal(r.sampleKind,'workers-ai');assert.equal(r.actualNeurons,null);assert.equal(r.caseId,caseIds[i]);assert.ok(r.scene.blocks.length);f.object=f.make();}const snapshot=await f.storage.get('experiment-v1');assert.deepEqual(snapshot.ledger.attempts.slice(0,4),oldRecord().ledger.attempts);assert.deepEqual(Object.fromEntries(Object.entries(snapshot.results).filter(([id])=>id.startsWith('old'))),oldRecord().results);assert.equal(snapshot.ledger.attempts.length,8);assert.equal(snapshot.acceptance.schemaVersion,1);assert.equal(f.inputs[0].context.life.name,'云归');assert.equal(f.inputs[0].context.identity.runId,'live-acceptance-v1');assert.equal(f.inputs[1].context.receipt.action.intent,'negotiate');const a=f.inputs[2].context,b=f.inputs[3].context;assert.equal(a.identity.baseRevision,b.identity.baseRevision);assert.equal(a.identity.stateHash,b.identity.stateHash);assert.notEqual(a.identity.choiceId,b.identity.choiceId);assert.notEqual(a.receipt.elapsedDays,b.receipt.elapsedDays);assert.equal(a.relationships[a.entities[0].id],6);assert.equal(b.relationships[b.entities[0].id],3);assert.equal(a.memory.promises[0].text,'替守山人留意山路。');assert.equal(snapshot.acceptance.cases['task7-counterfactual-a'].state.turnId,3);assert.equal(snapshot.acceptance.cases['task7-counterfactual-b'].state.turnId,3);assert.equal(snapshot.acceptance.cases['task7-continuation'].state.turnId,2);const audit=await (await f.object.fetch(statusReq())).json();assert.equal(audit.acceptance.schemaVersion,1);assert.doesNotMatch(JSON.stringify(audit),/reasoning_content|operatorTokenSha256|fixture-only/);});
test('strict story body/auth/config gates and exhausted shared budget never infer',async()=>{const f=await fixture();for(const extra of [{context:{}},{model:'other'},{task:'task8'},{proof:{}},{limit:1}])assert.equal((await f.object.fetch(req('task7-opening','bad',extra))).status,400);assert.equal((await f.object.fetch(req('task8-opening','bad'))).status,400);const unauth=req();unauth.headers.delete('authorization');assert.equal((await f.object.fetch(unauth)).status,401);f.cfg.freeBoundaryEvidence.checkedAt='2020-01-01T00:00:00.000Z';f.object=f.make();assert.equal((await call(f,caseIds[0],'stale')).errorCode,'FREE_BOUNDARY_UNVERIFIED');assert.equal(f.inputs.length,0);assert.equal((await f.storage.get('experiment-v1')).ledger.attempts.length,4);const g=await fixture();const snapshot=await g.storage.get('experiment-v1');snapshot.ledger.attempts.push({task:'task8',attemptId:'global',reservedNeurons:804,actualNeurons:null,status:'unknown'});await g.storage.put('experiment-v1',snapshot);assert.equal((await call(g,caseIds[0],'full')).errorCode,'EXPERIMENT_BUDGET_EXHAUSTED');assert.equal(g.inputs.length,0);});
test('concurrent/replayed attempt or case invokes only once and cannot change association',async()=>{const f=await fixture();const result=await Promise.all([call(f,caseIds[0],'one'),call(f,caseIds[0],'one'),call(f,caseIds[0],'other')]);assert.ok(result.every(r=>r.status==='ready'));assert.equal(f.inputs.length,1);assert.equal(result[2].attemptId,'one');f.object=f.make();assert.equal((await call(f,caseIds[0],'again')).attemptId,'one');assert.equal((await call(f,caseIds[1],'one')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');assert.equal((await call(f,caseIds[0],'old0')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');assert.equal(f.inputs.length,1);});
test('failed/unknown case and lost final write retain permanent case tombstones across restart',async()=>{for(const behavior of ['reject','throw','reasoning','lost-write']){const f=await fixture(c=>{if(behavior==='throw')throw new Error('secret reasoning content');if(behavior==='reject'){const v=raw(c);v.choices[0].message.content='bad';return v;}if(behavior==='reasoning'){const v=raw(c);v.choices[0].message.reasoning_content='secret reasoning content';return v;}return raw(c);});if(behavior==='lost-write'){const put=f.storage.put.bind(f.storage);let writes=0;f.storage.put=async(key,value)=>{if(writes++>0)throw new Error('disk secret');await put(key,value);};}await call(f,caseIds[0],'first');f.object=f.make();const replay=await call(f,caseIds[0],'second');assert.ok(['rejected','paused','already-reserved-or-unknown'].includes(replay.status));assert.equal(f.inputs.length,1);assert.equal((await call(f,caseIds[1],'next')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');const record=await f.storage.get('experiment-v1');assert.equal(record.ledger.attempts.length,5);assert.ok(['reserved','failed','unknown'].includes(record.ledger.attempts.at(-1).status));assert.doesNotMatch(JSON.stringify(record),/secret reasoning content|disk secret|reasoning_content/);}});
test('insufficient distinct nonterminal choices block counterfactual without fabricating extra calls',async()=>{const f=await fixture(c=>{const v=raw(c),s=scene(c);s.choices[1]={...s.choices[1],intent:'practice',targetId:'qi',approach:'breakthrough'};v.choices[0].message.content=JSON.stringify(s);return v;});assert.equal((await call(f,caseIds[0],'one')).status,'ready');assert.equal((await call(f,caseIds[1],'two')).status,'ready');assert.equal((await call(f,caseIds[2],'three')).errorCode,'ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');assert.equal(f.inputs.length,2);});

test('Task7 allocation and global call cap remain shared with old Tasks1/8 entries',async()=>{
  for(const additional of [
    Array.from({length:5},(_,i)=>({task:'task7',attemptId:'spent7_'+i,reservedNeurons:40,actualNeurons:null,status:'unknown'})),
    Array.from({length:8},(_,i)=>({task:i<5?'task7':'task8',attemptId:'spent_'+i,reservedNeurons:40,actualNeurons:null,status:'unknown'})),
  ]){
    const f=await fixture();const record=await f.storage.get('experiment-v1');record.ledger.attempts.push(...additional);await f.storage.put('experiment-v1',record);
    assert.equal((await call(f,caseIds[0],'new')).errorCode,'EXPERIMENT_BUDGET_EXHAUSTED');assert.equal(f.inputs.length,0);
    assert.deepEqual((await f.storage.get('experiment-v1')).ledger,record.ledger);
  }
});
test('first durable write failure and bounded snapshot admission never invoke AI',async()=>{
  const f=await fixture();f.storage.put=async()=>{throw new Error('private storage exception');};
  assert.equal((await call(f,caseIds[0],'first')).errorCode,'LEDGER_PERSIST_FAILED');assert.equal(f.inputs.length,0);
  const g=await fixture();const record=await g.storage.get('experiment-v1');record.auditPad='x'.repeat(120*1024);await g.storage.put('experiment-v1',record);
  assert.equal((await call(g,caseIds[0],'large')).errorCode,'ACCEPTANCE_STORAGE_LIMIT');assert.equal(g.inputs.length,0);
  assert.equal((await g.storage.get('experiment-v1')).ledger.attempts.length,4);
});

async function nativeFixture(t,initial=oldRecord()){
  const root=await mkdtemp(path.join(tmpdir(),'wending-operator-story-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const entry=`import {createOperatorProbeWorker,OperatorProbeDurableObject} from './operator-probe.js';
const config=${JSON.stringify(config())};const scene=${scene.toString()};const raw=${raw.toString()};
export class Probe extends OperatorProbeDurableObject{constructor(ctx,env){super(ctx,{...env,AI:{async run(model,input){const stored=await ctx.storage.get('experiment-v1');if(stored.ledger.attempts.at(-1).status!=='reserved'||stored.ledger.attempts.slice(0,4).some(row=>row.task!=='task1'))throw new Error('reservation lost');return raw(JSON.parse(input.messages[1].content));}}},config);ctx.blockConcurrencyWhile(async()=>{if(await ctx.storage.get('experiment-v1')===undefined)await ctx.storage.put('experiment-v1',${JSON.stringify(initial)});});}}
export default createOperatorProbeWorker(config);`;
  const modules=[{type:'ESModule',path:path.join(root,'src/worker/entry.js'),contents:entry}],visited=new Set();
  async function graph(url,name){if(visited.has(url.href))return;visited.add(url.href);const contents=await readFile(url,'utf8');modules.push({type:'ESModule',path:path.join(root,name),contents});for(const match of contents.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await graph(new URL(match[1],url),path.normalize(path.join(path.dirname(name),match[1])));}
  await graph(new URL('../src/worker/operator-probe.js',import.meta.url),'src/worker/operator-probe.js');
  let egress=0;const options={name:'wending-story-acceptance-local',compatibilityDate:'2026-07-30',modulesRoot:root,modules,durableObjects:{OPERATOR_PROBE:{className:'Probe',useSQLite:true}},durableObjectsPersist:path.join(root,'sqlite'),outboundService:()=>{egress++;throw new Error('network forbidden');}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const call=async(id,attempt)=>{const r=req(id,attempt);return (await mf.dispatchFetch(r.url,{method:r.method,headers:Object.fromEntries(r.headers),body:await r.text()})).json();};
  return {call,async restart(){await mf.dispose();mf=new Miniflare(options);},async status(){return (await mf.dispatchFetch('https://operator.invalid/status',{headers:{authorization:'Bearer '+token}})).json();},get egress(){return egress;}};
}
test('native workerd SQLite preserves four old calls and four fixed story cases across restart',{timeout:30000},async t=>{
  const f=await nativeFixture(t);
  assert.equal((await f.call(caseIds[0],'native0')).status,'ready');assert.equal((await f.call(caseIds[1],'native1')).status,'ready');
  await f.restart();
  assert.equal((await f.call(caseIds[0],'replay')).attemptId,'native0');
  assert.equal((await f.call(caseIds[2],'native2')).status,'ready');assert.equal((await f.call(caseIds[3],'native3')).status,'ready');
  const status=await f.status();
  assert.equal(status.callCount,8);assert.deepEqual(status.ledger.attempts.slice(0,4),oldRecord().ledger.attempts);assert.equal(Object.keys(status.acceptance.cases).length,4);assert.equal(f.egress,0);
});


test('rule-confirmed death blocks a fixed continuation without inference or state fabrication',async()=>{
  let state=createLiveGame({runId:'live-acceptance-v1',seed:42,name:'云归',originId:'village'});
  let pending=prepareOpening(state,{requestId:'local-opening'});
  function retirement(context){const value=scene(context);value.choices=value.choices.map((choice,i)=>({...choice,intent:'rest',targetId:'self',approach:i?'recover':'retire'}));return value;}
  state=commitTurn(state,pending,retirement(buildStoryContext(state,pending)));
  while(state.life.ageDays<80*360-30){
    pending=prepareChoice(state,{requestId:'local-'+state.turnId,choiceId:state.currentScene.choices[0].id});
    if(pending.receipt.death)break;
    state=commitTurn(state,pending,retirement(buildStoryContext(state,pending)));
  }
  // At age79 only a year-long retirement is terminal; use genuine repeated
  // monthly rest transitions to leave exactly30 days without editing life.
  while(state.life.ageDays<80*360-30){
    pending=prepareChoice(state,{requestId:'month-'+state.turnId,choiceId:state.currentScene.choices[1].id});
    if(pending.receipt.death)break;
    state=commitTurn(state,pending,retirement(buildStoryContext(state,pending)));
  }
  const f=await fixture(),record=await f.storage.get('experiment-v1');
  record.acceptance={schemaVersion:1,cases:{'task7-opening':{attemptId:'old0',status:'complete',state,records:[]}}};
  await f.storage.put('experiment-v1',record);
  assert.equal((await call(f,caseIds[1],'terminal')).errorCode,'ACCEPTANCE_RULE_DEATH');
  assert.equal(f.inputs.length,0);assert.equal((await f.storage.get('experiment-v1')).ledger.attempts.length,4);
});
test('oversized accepted snapshot becomes a bounded failed case and never reruns',async()=>{
  const f=await fixture(c=>{const value=raw(c),large=scene(c);large.blocks=Array.from({length:6},()=>({kind:'narration',text:'山'.repeat(1800)}));value.choices[0].message.content=JSON.stringify(large);return value;});
  const record=await f.storage.get('experiment-v1');record.auditPad='x'.repeat(70*1024);await f.storage.put('experiment-v1',record);
  const result=await call(f,caseIds[0],'large-result');
  assert.equal(result.status,'rejected');assert.equal(result.errorCode,'ACCEPTANCE_STORAGE_LIMIT');assert.equal(Object.hasOwn(result,'scene'),false);
  const stored=await f.storage.get('experiment-v1');assert.equal(stored.acceptance.cases[caseIds[0]].status,'failed');assert.equal(Object.hasOwn(stored.acceptance.cases[caseIds[0]],'state'),false);
  assert.ok(new TextEncoder().encode(JSON.stringify(stored)).length<=120*1024);
  f.object=f.make();assert.equal((await call(f,caseIds[0],'try-again')).attemptId,'large-result');assert.equal(f.inputs.length,1);
});


test('account mismatch, missing native binding and insufficient fresh account quota reserve nothing',async()=>{
  for(const kind of ['account','binding','balance']){
    const f=await fixture();
    if(kind==='account')f.cfg.freeBoundaryEvidence.accountId='different-account';
    if(kind==='binding')delete f.env.AI;
    if(kind==='balance')f.cfg.freeBoundaryEvidence.remainingNeurons=100;
    f.object=f.make();
    assert.equal((await call(f,caseIds[0],'blocked')).errorCode,{account:'FREE_BOUNDARY_UNVERIFIED',binding:'AI_BINDING_MISSING',balance:'ACCOUNT_QUOTA_UNAVAILABLE'}[kind]);
    assert.equal(f.inputs.length,0);assert.deepEqual(await f.storage.get('experiment-v1'),oldRecord());
  }
});
test('existing Task1 results replay through probe and its exhausted allocation cannot spend Task7 slots',async()=>{
  const f=await fixture();
  const request=attemptId=>new Request('https://operator.invalid/probe',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({attemptId})});
  assert.deepEqual(await (await f.object.fetch(request('old0'))).json(),oldRecord().results.old0);
  assert.equal((await (await f.object.fetch(request('new-task1'))).json()).errorCode,'EXPERIMENT_BUDGET_EXHAUSTED');
  assert.equal(f.inputs.length,0);assert.equal((await f.storage.get('experiment-v1')).ledger.attempts.length,4);
});

test('revised three-call recipe preserves failed evidence and branches from one accepted opening',async()=>{
  const original=failedOriginalRecord(),f=await fixture(undefined,original);
  assert.equal((await call(f,revisedCaseIds[1],'too-early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  const opening=await call(f,revisedCaseIds[0],'revised0');
  assert.equal(opening.status,'ready');assert.equal(opening.recipeVersion,2);
  assert.deepEqual(opening.receipt,original.acceptance.cases['task7-opening'].receipt);
  assert.equal(opening.identity.requestId,'task7-opening-v2');
  assert.equal((await call(f,revisedCaseIds[2],'b-before-a')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  const openingRow=(await f.storage.get('experiment-v1')).acceptance.cases[revisedCaseIds[0]];
  f.object=f.make();assert.equal((await call(f,revisedCaseIds[1],'revised1')).status,'ready');
  const branchA=(await f.storage.get('experiment-v1')).acceptance.cases[revisedCaseIds[1]];
  f.object=f.make();assert.equal((await call(f,revisedCaseIds[2],'revised2')).status,'ready');
  const record=await f.storage.get('experiment-v1'),branchB=record.acceptance.cases[revisedCaseIds[2]];
  assert.deepEqual(record.ledger.attempts.slice(0,5),original.ledger.attempts);
  for(const [id,result] of Object.entries(original.results))assert.deepEqual(record.results[id],result);
  assert.deepEqual(record.acceptance.cases['task7-opening'],original.acceptance.cases['task7-opening']);
  assert.deepEqual(record.acceptance.cases[revisedCaseIds[0]],openingRow);
  assert.deepEqual(record.acceptance.cases[revisedCaseIds[1]],branchA);
  assert.equal(record.ledger.attempts.length,8);assert.equal(record.ledger.attempts.filter(row=>row.task==='task7').length,4);
  assert.equal(record.ledger.attempts.slice(0,5).reduce((n,row)=>n+row.reservedNeurons,0),173);
  for(const id of revisedCaseIds){assert.equal(record.acceptance.cases[id].recipeVersion,2);assert.equal(record.results[record.acceptance.cases[id].attemptId].recipeVersion,2);}
  assert.equal(branchA.baseStateHash,branchB.baseStateHash);assert.equal(branchA.identity.baseRevision,1);assert.equal(branchB.identity.baseRevision,1);
  assert.equal(branchA.state.revision,2);assert.equal(branchB.state.revision,2);assert.equal(openingRow.state.revision,1);
  assert.equal(branchA.receipt.action.intent,'negotiate');assert.equal(branchB.receipt.action.intent,'rest');
  assert.equal(branchA.receipt.elapsedDays,7);assert.equal(branchB.receipt.elapsedDays,30);
  assert.notDeepEqual(branchA.receipt,branchB.receipt);assert.notDeepEqual(branchA.state.life,branchB.state.life);
  assert.deepEqual(f.inputs[1].context.memory,f.inputs[2].context.memory);
  assert.equal(f.inputs[1].context.memory.promises[0].text,'替守山人留意山路。');
  assert.equal((await call(f,revisedCaseIds[0],'new-opening-attempt')).attemptId,'revised0');
  assert.equal((await call(f,revisedCaseIds[2],'new-branch-attempt')).attemptId,'revised2');
  assert.equal(f.inputs.length,3);
});

test('revised opening requires matching durable failed original case, ledger and structural rejection',async()=>{
  const changes=[
    record=>{delete record.acceptance;},
    ...['reserved','unknown','complete'].map(status=>record=>{record.acceptance.cases['task7-opening'].status=status;}),
    record=>{record.ledger.attempts.pop();},
    ...['reserved','unknown','complete'].map(status=>record=>{record.ledger.attempts[4].status=status;}),
    record=>{record.ledger.attempts[4].task='task8';},
    record=>{record.acceptance.cases['task7-opening'].attemptId='another-attempt';},
    record=>{delete record.results['task7-20261028-001'];},
    record=>{record.results['task7-20261028-001'].errorCode='PROVIDER_FAILED';},
    record=>{record.results['task7-20261028-001'].attemptId='another-attempt';},
    record=>{record.results['task7-20261028-001'].caseId='task7-continuation';},
  ];
  for(const change of changes){
    const record=failedOriginalRecord();change(record);const f=await fixture(undefined,record);
    assert.equal((await call(f,revisedCaseIds[0],'revised')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    assert.equal(f.inputs.length,0);assert.deepEqual(await f.storage.get('experiment-v1'),record);
  }
});

test('revised branch selection skips cosmetic stakes and requires a meaningful second action',async()=>{
  for(const hasThird of [false,true]){
    const f=await fixture(context=>{
      const value=raw(context),s=scene(context);
      if(context.identity.turnId===1){
        const rest=s.choices[1],talk=s.choices[0];
        s.choices=[rest,{...rest,id:rest.id+'2',label:'换个说法歇息',stake:'normal'},...(hasThird?[talk]:[])];
      }
      value.choices[0].message.content=JSON.stringify(s);return value;
    },failedOriginalRecord());
    assert.equal((await call(f,revisedCaseIds[0],'opening')).status,'ready');
    const a=await call(f,revisedCaseIds[1],'branch-a');
    if(!hasThird){
      assert.equal(a.errorCode,'ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');assert.equal(f.inputs.length,1);
      assert.equal((await f.storage.get('experiment-v1')).ledger.attempts.length,6);
      assert.equal((await call(f,revisedCaseIds[2],'branch-b')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
      continue;
    }
    assert.equal(a.status,'ready');
    const b=await call(f,revisedCaseIds[2],'branch-b');
    assert.equal(b.status,'ready');assert.equal(b.receipt.action.intent,'negotiate');assert.equal(f.inputs.length,3);
  }
});

test('revised failed, unknown and lost-write opening cannot restart or unlock a branch',async()=>{
  for(const kind of ['rejected','unknown','lost-write']){
    const original=failedOriginalRecord(),f=await fixture(context=>{
      if(kind==='unknown')throw new Error('private fixture transport detail');
      const value=raw(context);if(kind==='rejected')value.choices[0].message.content='not-json';return value;
    },original);
    if(kind==='lost-write'){
      const put=f.storage.put.bind(f.storage);let writes=0;
      f.storage.put=async(key,value)=>{if(writes++)throw new Error('private fixture storage detail');return put(key,value);};
    }
    await call(f,revisedCaseIds[0],'revised-failed');f.object=f.make();
    const replay=await call(f,revisedCaseIds[0],'try-again');
    assert.ok(['rejected','paused','already-reserved-or-unknown'].includes(replay.status));
    assert.equal((await call(f,revisedCaseIds[1],'cannot-advance')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    assert.equal(f.inputs.length,1);const record=await f.storage.get('experiment-v1');
    assert.equal(record.ledger.attempts.length,6);assert.deepEqual(record.ledger.attempts.slice(0,5),original.ledger.attempts);
    assert.deepEqual(record.acceptance.cases['task7-opening'],original.acceptance.cases['task7-opening']);
    assert.doesNotMatch(JSON.stringify(record),/private fixture/);
  }
});

test('revised recipe cannot allocate a sixth Task7 call after previous commitments',async()=>{
  const record=failedOriginalRecord();
  for(let i=0;i<4;i++)record.ledger.attempts.push({task:'task7',attemptId:'previously-spent-'+i,reservedNeurons:77,actualNeurons:null,status:'unknown'});
  const f=await fixture(undefined,record);
  assert.equal((await call(f,revisedCaseIds[0],'not-allowed')).errorCode,'EXPERIMENT_BUDGET_EXHAUSTED');
  assert.equal(f.inputs.length,0);assert.deepEqual(await f.storage.get('experiment-v1'),record);
});

test('revised structural rejection retains only the provider fixed diagnostic category',async()=>{
  const f=await fixture(context=>{
    const value=raw(context),s=scene(context);
    s.blocks[0].speaker='private rejected field contents';
    value.choices[0].message.content=JSON.stringify(s);return value;
  },failedOriginalRecord());
  const result=await call(f,revisedCaseIds[0],'diagnostic');
  assert.equal(result.errorCode,'GENERATED_SCENE_INVALID');assert.equal(result.structureDiagnostic,'FIELD_SET_INVALID');
  const record=await f.storage.get('experiment-v1');
  assert.equal(record.results.diagnostic.structureDiagnostic,'FIELD_SET_INVALID');
  assert.equal(record.acceptance.cases[revisedCaseIds[0]].status,'failed');
  assert.equal(Object.hasOwn(result,'scene'),false);assert.doesNotMatch(JSON.stringify(record),/private rejected field contents|reasoning_content/);
  const g=await fixture(context=>({...raw(context),structureDiagnostic:'private provider-supplied diagnostic'}),failedOriginalRecord());
  const ready=await call(g,revisedCaseIds[0],'not-a-diagnostic');
  assert.equal(ready.status,'ready');assert.equal(Object.hasOwn(ready,'structureDiagnostic'),false);
});

test('revised counterfactual can differ through actual mechanics with the same intent, target and approach',async()=>{
  const f=await fixture(context=>{
    const value=raw(context),s=scene(context);
    if(context.identity.turnId===1)s.choices=s.choices.map((choice,i)=>({...choice,intent:'fight',targetId:s.entities[0].id,approach:'guard',stake:i?'high':'low'}));
    value.choices[0].message.content=JSON.stringify(s);return value;
  },failedOriginalRecord());
  assert.equal((await call(f,revisedCaseIds[0],'opening')).status,'ready');
  const a=await call(f,revisedCaseIds[1],'a'),b=await call(f,revisedCaseIds[2],'b');
  assert.equal(a.status,'ready');assert.equal(b.status,'ready');
  for(const key of ['intent','targetId','approach'])assert.equal(a.receipt.action[key],b.receipt.action[key]);
  assert.equal(b.receipt.after.injury-a.receipt.after.injury,2);assert.equal(f.inputs.length,3);
});

test('native workerd revised recipe preserves the failed opening and resumes only distinct pending cases',{timeout:30000},async t=>{
  const original=failedOriginalRecord(),f=await nativeFixture(t,original);
  assert.equal((await f.status()).reservedNeurons,173);
  assert.equal((await f.call(revisedCaseIds[0],'native-revised0')).status,'ready');
  await f.restart();
  assert.equal((await f.call(revisedCaseIds[0],'replay-opening')).attemptId,'native-revised0');
  assert.equal((await f.call(revisedCaseIds[2],'b-before-a')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  assert.equal((await f.call(revisedCaseIds[1],'native-revised1')).status,'ready');
  await f.restart();
  assert.equal((await f.call(revisedCaseIds[2],'native-revised2')).status,'ready');
  const status=await f.status();
  assert.equal(status.callCount,8);assert.deepEqual(status.ledger.attempts.slice(0,5),original.ledger.attempts);
  assert.deepEqual(status.acceptance.cases['task7-opening'],original.acceptance.cases['task7-opening']);
  assert.deepEqual(status.results['task7-20261028-001'],original.results['task7-20261028-001']);
  const a=status.acceptance.cases[revisedCaseIds[1]],b=status.acceptance.cases[revisedCaseIds[2]];
  assert.equal(a.baseStateHash,b.baseStateHash);assert.equal(a.identity.baseRevision,1);assert.equal(b.identity.baseRevision,1);
  assert.equal(a.recipeVersion,2);assert.equal(b.recipeVersion,2);assert.equal(f.egress,0);
});

test('v3 uses one new opening and two counterfactual branches while preserving all six earlier commitments',async()=>{
  const original=failedRevisedRecord(),f=await fixture(undefined,original);
  for(const id of scopeCorrectedCaseIds.slice(1))assert.equal((await call(f,id,'early-'+id)).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  assert.equal(f.inputs.length,0);
  const openings=await Promise.all([call(f,scopeCorrectedCaseIds[0],'v3-opening'),call(f,scopeCorrectedCaseIds[0],'v3-duplicate')]);
  assert.equal(openings[0].status,'ready');assert.deepEqual(openings[1],openings[0]);assert.equal(f.inputs.length,1);
  let record=await f.storage.get('experiment-v1');const opening=structuredClone(record.acceptance.cases[scopeCorrectedCaseIds[0]]);
  assert.equal(opening.recipeVersion,3);assert.equal(opening.state.revision,1);
  assert.deepEqual(opening.receipt,original.acceptance.cases['task7-opening-v2'].receipt);
  assert.equal(opening.baseStateHash,original.acceptance.cases['task7-opening-v2'].baseStateHash);
  assert.deepEqual(f.inputs[0].input.response_format.json_schema.properties.id.enum,[f.inputs[0].context.namespace+':t1:s:scene']);
  assert.equal((await call(f,scopeCorrectedCaseIds[2],'too-early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  f.object=f.make();assert.equal((await call(f,scopeCorrectedCaseIds[1],'v3-a')).status,'ready');
  record=await f.storage.get('experiment-v1');const a=structuredClone(record.acceptance.cases[scopeCorrectedCaseIds[1]]);
  f.object=f.make();assert.equal((await call(f,scopeCorrectedCaseIds[2],'v3-b')).status,'ready');
  record=await f.storage.get('experiment-v1');const b=record.acceptance.cases[scopeCorrectedCaseIds[2]];
  assert.deepEqual(record.ledger.attempts.slice(0,6),original.ledger.attempts);
  for(const [id,value] of Object.entries(original.results))assert.deepEqual(record.results[id],value);
  for(const [id,value] of Object.entries(original.acceptance.cases))assert.deepEqual(record.acceptance.cases[id],value);
  assert.deepEqual(record.acceptance.cases[scopeCorrectedCaseIds[0]],opening);assert.deepEqual(record.acceptance.cases[scopeCorrectedCaseIds[1]],a);
  assert.equal(record.ledger.attempts.length,9);assert.equal(record.ledger.attempts.filter(row=>row.task==='task7').length,5);
  assert.equal(record.ledger.attempts.slice(0,6).reduce((n,row)=>n+row.reservedNeurons,0),256);
  for(const id of scopeCorrectedCaseIds){assert.equal(record.acceptance.cases[id].recipeVersion,3);assert.equal(record.results[record.acceptance.cases[id].attemptId].recipeVersion,3);}
  assert.equal(a.baseStateHash,b.baseStateHash);assert.equal(a.identity.baseRevision,1);assert.equal(b.identity.baseRevision,1);
  assert.equal(a.state.revision,2);assert.equal(b.state.revision,2);
  assert.equal(a.receipt.action.intent,'negotiate');assert.equal(b.receipt.action.intent,'rest');
  assert.equal(a.receipt.elapsedDays,7);assert.equal(b.receipt.elapsedDays,30);
  assert.notDeepEqual(a.receipt,b.receipt);assert.notDeepEqual(a.state.life,b.state.life);
  assert.deepEqual(f.inputs[1].context.memory,f.inputs[2].context.memory);
  assert.equal(f.inputs[1].context.memory.promises[0].text,'替守山人留意山路。');
  for(const id of ['task7-opening','task7-opening-v2',...scopeCorrectedCaseIds])assert.equal((await call(f,id,'do-not-reinfer')).attemptId,record.acceptance.cases[id].attemptId);
  assert.equal((await call(f,scopeCorrectedCaseIds[1],'v3-opening')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');
  assert.equal(f.inputs.length,3);
});

test('v3 admission requires the matching permanent v2 scope failure, original failure and immutable association',async()=>{
  const changes=[
    record=>{delete record.acceptance.cases['task7-opening'];},
    record=>{record.results['task7-20261028-001'].errorCode='PROVIDER_FAILED';},
    record=>{delete record.acceptance.cases['task7-opening-v2'];},
    ...['reserved','unknown','complete'].map(status=>record=>{record.acceptance.cases['task7-opening-v2'].status=status;}),
    record=>{record.acceptance.cases['task7-opening-v2'].caseId='task7-opening';},
    record=>{record.ledger.attempts.pop();},
    ...['reserved','unknown','complete'].map(status=>record=>{record.ledger.attempts[5].status=status;}),
    record=>{record.ledger.attempts[5].task='task8';},
    record=>{record.ledger.attempts[5].reservedNeurons=82;},
    record=>{record.acceptance.cases['task7-opening-v2'].attemptId='different-attempt';},
    record=>{delete record.results['task7-20261028-002'];},
    record=>{record.results['task7-20261028-002'].errorCode='GENERATED_SCENE_INVALID';},
    record=>{record.results['task7-20261028-002'].status='ready';},
    record=>{record.results['task7-20261028-002'].task='task8';},
    record=>{record.results['task7-20261028-002'].caseId='task7-opening';},
    record=>{record.results['task7-20261028-002'].attemptId='different-attempt';},
    record=>{record.results['task7-20261028-002'].recipeVersion=3;},
    record=>{record.results['task7-20261028-002'].inferencePerformed=false;},
    record=>{record.results['task7-20261028-002'].inputHash='0'.repeat(64);},
    record=>{record.results['task7-20261028-002'].contextHash='0'.repeat(64);},
    record=>{record.results['task7-20261028-002'].inputBytes++;},
    record=>{record.results['task7-20261028-002'].identity.requestId='other-case';},
    record=>{record.results['task7-20261028-002'].receipt.elapsedDays=1;},
    record=>{record.acceptance.cases['task7-opening-v2'].baseStateHash='0'.repeat(64);},
  ];
  for(const change of changes){
    const record=JSON.parse(JSON.stringify(failedRevisedRecord()));change(record);const f=await fixture(undefined,record);
    assert.equal((await call(f,scopeCorrectedCaseIds[0],'v3-blocked')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    assert.equal(f.inputs.length,0);assert.deepEqual(await f.storage.get('experiment-v1'),record);
  }
});

test('v3 failed, unknown and lost-write opening keep their own tombstone and cannot unlock branches',async()=>{
  for(const kind of ['rejected','unknown','lost-write']){
    const original=failedRevisedRecord(),f=await fixture(context=>{
      if(kind==='unknown')throw new Error('private v3 transport detail');
      const value=raw(context);if(kind==='rejected')value.choices[0].message.content='not-json';return value;
    },original);
    if(kind==='lost-write'){
      const put=f.storage.put.bind(f.storage);let writes=0;
      f.storage.put=async(key,value)=>{if(writes++)throw new Error('private v3 storage detail');return put(key,value);};
    }
    await call(f,scopeCorrectedCaseIds[0],'v3-once');f.object=f.make();
    const replay=await call(f,scopeCorrectedCaseIds[0],'v3-never-again');
    assert.ok(['rejected','paused','already-reserved-or-unknown'].includes(replay.status));
    assert.equal(replay.attemptId,'v3-once');
    for(const id of scopeCorrectedCaseIds.slice(1))assert.equal((await call(f,id,'no-branch')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    assert.equal(f.inputs.length,1);const record=await f.storage.get('experiment-v1');
    assert.equal(record.ledger.attempts.length,7);assert.deepEqual(record.ledger.attempts.slice(0,6),original.ledger.attempts);
    assert.equal(record.acceptance.cases[scopeCorrectedCaseIds[0]].recipeVersion,3);
    for(const [id,value] of Object.entries(original.acceptance.cases))assert.deepEqual(record.acceptance.cases[id],value);
    assert.doesNotMatch(JSON.stringify(record),/private v3/);
  }
});

test('v3 requires two distinct living actions before spending branch A',async()=>{
  for(const kind of ['one-enabled','cosmetic-only']){
    const f=await fixture(context=>{
      const value=raw(context),s=scene(context);
      if(context.identity.turnId===1){
        const rest=s.choices[1];
        const second=kind==='one-enabled'?{...s.choices[0],intent:'craft',targetId:'manual',approach:'study'}:{...rest,id:rest.id+'2',label:'换个说法歇息',stake:'normal'};
        s.choices=[rest,second];
      }
      value.choices[0].message.content=JSON.stringify(s);return value;
    },failedRevisedRecord());
    assert.equal((await call(f,scopeCorrectedCaseIds[0],'v3-opening')).status,'ready');
    const before=await f.storage.get('experiment-v1');
    assert.equal((await call(f,scopeCorrectedCaseIds[1],'v3-branch')).errorCode,'ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');
    assert.equal((await call(f,scopeCorrectedCaseIds[2],'v3-other')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
    assert.equal(f.inputs.length,1);assert.deepEqual(await f.storage.get('experiment-v1'),before);
  }
});

test('native workerd v3 preserves both failed openings and all old reservations through restart and replay',{timeout:30000},async t=>{
  const original=failedRevisedRecord(),f=await nativeFixture(t,original);
  assert.equal((await f.status()).callCount,6);assert.equal((await f.status()).reservedNeurons,256);
  assert.equal((await f.call(scopeCorrectedCaseIds[0],'native-v3-opening')).status,'ready');
  await f.restart();
  assert.equal((await f.call(scopeCorrectedCaseIds[0],'native-v3-replay')).attemptId,'native-v3-opening');
  assert.equal((await f.call(scopeCorrectedCaseIds[2],'b-before-a')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');
  assert.equal((await f.call(scopeCorrectedCaseIds[1],'native-v3-a')).status,'ready');
  await f.restart();
  assert.equal((await f.call(scopeCorrectedCaseIds[2],'native-v3-b')).status,'ready');
  const status=await f.status();assert.equal(status.callCount,9);
  assert.deepEqual(status.ledger.attempts.slice(0,6),original.ledger.attempts);
  for(const [id,value] of Object.entries(original.acceptance.cases))assert.deepEqual(status.acceptance.cases[id],value);
  for(const [id,value] of Object.entries(original.results))assert.deepEqual(status.results[id],value);
  const a=status.acceptance.cases[scopeCorrectedCaseIds[1]],b=status.acceptance.cases[scopeCorrectedCaseIds[2]];
  assert.equal(a.baseStateHash,b.baseStateHash);assert.equal(a.identity.baseRevision,1);assert.equal(b.identity.baseRevision,1);
  assert.equal(a.recipeVersion,3);assert.equal(b.recipeVersion,3);
  for(const id of ['task7-opening','task7-opening-v2',...scopeCorrectedCaseIds])assert.equal((await f.call(id,'never-repeat')).attemptId,status.acceptance.cases[id].attemptId);
  assert.equal((await f.status()).callCount,9);assert.equal(f.egress,0);
});
