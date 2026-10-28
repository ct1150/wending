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
function disk(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT)');return {sql:{},async get(key){const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?JSON.parse(row.value):undefined;},async put(key,value){db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}};}
const oldRecord=()=>({schemaVersion:1,ledger:{schemaVersion:1,attempts:Array.from({length:4},(_,i)=>({attemptId:'old'+i,task:'task1',reservedNeurons:24,actualNeurons:null,status:'complete'}))},results:Object.fromEntries(Array.from({length:4},(_,i)=>['old'+i,{status:'passed',reasoningPresent:true,reasoningChars:2,reasoningNonWhitespacePresent:false}]))});
function scene(context){const p=context.namespace+':t'+context.identity.turnId+':',entity=context.entities[0]??{id:p+'e:keeper',name:'守山人',kind:'person',status:'alive'};return {id:p+'s:path',title:'山路新事',location:'松溪山门',blocks:[{kind:'narration',text:'山路传来新消息，第'+context.identity.turnId+'回。行动'+(context.receipt.action?.intent??'opening')+'。'},{kind:'dialogue',speaker:entity.id,text:'旧约还记在册中。'}],entities:[entity],choices:[{id:p+'c:talk',label:'协助守山人',intent:'negotiate',targetId:entity.id,stake:'low',approach:'cooperate'},{id:p+'c:rest',label:'歇息观察',intent:'rest',targetId:'self',stake:'low',approach:'recover'}],memoryDeltas:context.identity.turnId===1?[{kind:'promise',entityId:entity.id,text:'替守山人留意山路。'}]:[]};}
function raw(context){return {model:'@cf/qwen/qwen3-30b-a3b-fp8',choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene(context)),reasoning_content:' \n'}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};}
const config=()=>({operatorTokenSha256:sha256(token),bindingAccountId:'fixture-account',freeBoundaryEvidence:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()}});
const req=(caseId='task7-opening',attemptId='story0',extra={})=>new Request('https://operator.invalid/story-acceptance',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({attemptId,caseId,...extra})});
const statusReq=()=>new Request('https://operator.invalid/status',{headers:{authorization:'Bearer '+token}});
async function fixture(run){const storage=disk();await storage.put('experiment-v1',oldRecord());const inputs=[];const env={AI:{async run(model,input){const snapshot=await storage.get('experiment-v1'),entry=snapshot.ledger.attempts.at(-1);assert.equal(entry.task,'task7');assert.equal(entry.status,'reserved');const c=JSON.parse(input.messages[1].content);const pending=snapshot.acceptance.cases[caseIds.find(id=>snapshot.acceptance.cases[id]?.attemptId===entry.attemptId)];assert.equal(pending.contextHash,sha256(canonicalStringify(c)));assert.equal(pending.inputHash,sha256(JSON.stringify(input)));assert.equal(pending.inputBytes,new TextEncoder().encode(JSON.stringify(input)).length);assert.ok(entry.reservedNeurons>24&&entry.reservedNeurons<=111);inputs.push({model,input,context:c});return run?run(c):raw(c);}}};const cfg=config(),make=()=>new OperatorProbeDurableObject({storage},env,cfg);return {storage,env,cfg,make,object:make(),inputs};}
const call=async(f,caseId,attemptId)=>{const r=await f.object.fetch(req(caseId,attemptId));return r.json();};

test('fixed story cases preserve old ledger, exact prerequisites and full-input durable accounting',async()=>{const f=await fixture();assert.equal((await call(f,'task7-continuation','early')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');assert.equal(f.inputs.length,0);for(let i=0;i<4;i++){const r=await call(f,caseIds[i],'story'+i);assert.equal(r.status,'ready');assert.equal(r.sampleKind,'workers-ai');assert.equal(r.actualNeurons,null);assert.equal(r.caseId,caseIds[i]);assert.ok(r.scene.blocks.length);f.object=f.make();}const snapshot=await f.storage.get('experiment-v1');assert.deepEqual(snapshot.ledger.attempts.slice(0,4),oldRecord().ledger.attempts);assert.deepEqual(Object.fromEntries(Object.entries(snapshot.results).filter(([id])=>id.startsWith('old'))),oldRecord().results);assert.equal(snapshot.ledger.attempts.length,8);assert.equal(snapshot.acceptance.schemaVersion,1);assert.equal(f.inputs[0].context.life.name,'云归');assert.equal(f.inputs[0].context.identity.runId,'live-acceptance-v1');assert.equal(f.inputs[1].context.receipt.action.intent,'negotiate');const a=f.inputs[2].context,b=f.inputs[3].context;assert.equal(a.identity.baseRevision,b.identity.baseRevision);assert.equal(a.identity.stateHash,b.identity.stateHash);assert.notEqual(a.identity.choiceId,b.identity.choiceId);assert.notEqual(a.receipt.elapsedDays,b.receipt.elapsedDays);assert.equal(a.relationships[a.entities[0].id],6);assert.equal(b.relationships[b.entities[0].id],3);assert.equal(a.memory.promises[0].text,'替守山人留意山路。');assert.equal(snapshot.acceptance.cases['task7-counterfactual-a'].state.turnId,3);assert.equal(snapshot.acceptance.cases['task7-counterfactual-b'].state.turnId,3);assert.equal(snapshot.acceptance.cases['task7-continuation'].state.turnId,2);const audit=await (await f.object.fetch(statusReq())).json();assert.equal(audit.acceptance.schemaVersion,1);assert.doesNotMatch(JSON.stringify(audit),/reasoning_content|operatorTokenSha256|fixture-only/);});
test('strict story body/auth/config gates and exhausted shared budget never infer',async()=>{const f=await fixture();for(const extra of [{context:{}},{model:'other'},{task:'task8'},{proof:{}},{limit:1}])assert.equal((await f.object.fetch(req('task7-opening','bad',extra))).status,400);assert.equal((await f.object.fetch(req('task8-opening','bad'))).status,400);const unauth=req();unauth.headers.delete('authorization');assert.equal((await f.object.fetch(unauth)).status,401);f.cfg.freeBoundaryEvidence.checkedAt='2020-01-01T00:00:00.000Z';f.object=f.make();assert.equal((await call(f,caseIds[0],'stale')).errorCode,'FREE_BOUNDARY_UNVERIFIED');assert.equal(f.inputs.length,0);assert.equal((await f.storage.get('experiment-v1')).ledger.attempts.length,4);const g=await fixture();const snapshot=await g.storage.get('experiment-v1');snapshot.ledger.attempts.push({task:'task8',attemptId:'global',reservedNeurons:704,actualNeurons:null,status:'unknown'});await g.storage.put('experiment-v1',snapshot);assert.equal((await call(g,caseIds[0],'full')).errorCode,'EXPERIMENT_BUDGET_EXHAUSTED');assert.equal(g.inputs.length,0);});
test('concurrent/replayed attempt or case invokes only once and cannot change association',async()=>{const f=await fixture();const result=await Promise.all([call(f,caseIds[0],'one'),call(f,caseIds[0],'one'),call(f,caseIds[0],'other')]);assert.ok(result.every(r=>r.status==='ready'));assert.equal(f.inputs.length,1);assert.equal(result[2].attemptId,'one');f.object=f.make();assert.equal((await call(f,caseIds[0],'again')).attemptId,'one');assert.equal((await call(f,caseIds[1],'one')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');assert.equal((await call(f,caseIds[0],'old0')).errorCode,'ACCEPTANCE_ATTEMPT_CONFLICT');assert.equal(f.inputs.length,1);});
test('failed/unknown case and lost final write retain permanent case tombstones across restart',async()=>{for(const behavior of ['reject','throw','reasoning','lost-write']){const f=await fixture(c=>{if(behavior==='throw')throw new Error('secret reasoning content');if(behavior==='reject'){const v=raw(c);v.choices[0].message.content='bad';return v;}if(behavior==='reasoning'){const v=raw(c);v.choices[0].message.reasoning_content='secret reasoning content';return v;}return raw(c);});if(behavior==='lost-write'){const put=f.storage.put.bind(f.storage);let writes=0;f.storage.put=async(key,value)=>{if(writes++>0)throw new Error('disk secret');await put(key,value);};}await call(f,caseIds[0],'first');f.object=f.make();const replay=await call(f,caseIds[0],'second');assert.ok(['rejected','paused','already-reserved-or-unknown'].includes(replay.status));assert.equal(f.inputs.length,1);assert.equal((await call(f,caseIds[1],'next')).errorCode,'ACCEPTANCE_PREREQUISITE_MISSING');const record=await f.storage.get('experiment-v1');assert.equal(record.ledger.attempts.length,5);assert.ok(['reserved','failed','unknown'].includes(record.ledger.attempts.at(-1).status));assert.doesNotMatch(JSON.stringify(record),/secret reasoning content|disk secret|reasoning_content/);}});
test('insufficient distinct nonterminal choices block counterfactual without fabricating extra calls',async()=>{const f=await fixture(c=>{const v=raw(c),s=scene(c);s.choices[1]={...s.choices[1],intent:'practice',targetId:'qi',approach:'breakthrough'};v.choices[0].message.content=JSON.stringify(s);return v;});assert.equal((await call(f,caseIds[0],'one')).status,'ready');assert.equal((await call(f,caseIds[1],'two')).status,'ready');assert.equal((await call(f,caseIds[2],'three')).errorCode,'ACCEPTANCE_DISTINCT_CHOICES_UNAVAILABLE');assert.equal(f.inputs.length,2);});

test('Task7 allocation and global call cap remain shared with old Tasks1/8 entries',async()=>{
  for(const additional of [
    Array.from({length:4},(_,i)=>({task:'task7',attemptId:'spent7_'+i,reservedNeurons:40,actualNeurons:null,status:'unknown'})),
    Array.from({length:6},(_,i)=>({task:i<4?'task7':'task8',attemptId:'spent_'+i,reservedNeurons:40,actualNeurons:null,status:'unknown'})),
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

test('native workerd SQLite preserves four old calls and four fixed story cases across restart',{timeout:30000},async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wending-operator-story-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const entry=`import {createOperatorProbeWorker,OperatorProbeDurableObject} from './operator-probe.js';
const config=${JSON.stringify(config())};const scene=${scene.toString()};const raw=${raw.toString()};
export class Probe extends OperatorProbeDurableObject{constructor(ctx,env){super(ctx,{...env,AI:{async run(model,input){const stored=await ctx.storage.get('experiment-v1');if(stored.ledger.attempts.at(-1).status!=='reserved'||stored.ledger.attempts.slice(0,4).some(row=>row.task!=='task1'))throw new Error('reservation lost');return raw(JSON.parse(input.messages[1].content));}}},config);ctx.blockConcurrencyWhile(async()=>{if(await ctx.storage.get('experiment-v1')===undefined)await ctx.storage.put('experiment-v1',${JSON.stringify(oldRecord())});});}}
export default createOperatorProbeWorker(config);`;
  const modules=[{type:'ESModule',path:path.join(root,'src/worker/entry.js'),contents:entry}],visited=new Set();
  async function graph(url,name){if(visited.has(url.href))return;visited.add(url.href);const contents=await readFile(url,'utf8');modules.push({type:'ESModule',path:path.join(root,name),contents});for(const match of contents.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await graph(new URL(match[1],url),path.normalize(path.join(path.dirname(name),match[1])));}
  await graph(new URL('../src/worker/operator-probe.js',import.meta.url),'src/worker/operator-probe.js');
  let egress=0;const options={name:'wending-story-acceptance-local',compatibilityDate:'2026-07-30',modulesRoot:root,modules,durableObjects:{OPERATOR_PROBE:{className:'Probe',useSQLite:true}},durableObjectsPersist:path.join(root,'sqlite'),outboundService:()=>{egress++;throw new Error('network forbidden');}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const call=async(id,attempt)=>{const r=req(id,attempt);return (await mf.dispatchFetch(r.url,{method:r.method,headers:Object.fromEntries(r.headers),body:await r.text()})).json();};
  assert.equal((await call(caseIds[0],'native0')).status,'ready');assert.equal((await call(caseIds[1],'native1')).status,'ready');
  await mf.dispose();mf=new Miniflare(options);
  assert.equal((await call(caseIds[0],'replay')).attemptId,'native0');
  assert.equal((await call(caseIds[2],'native2')).status,'ready');assert.equal((await call(caseIds[3],'native3')).status,'ready');
  const status=await (await mf.dispatchFetch('https://operator.invalid/status',{headers:{authorization:'Bearer '+token}})).json();
  assert.equal(status.callCount,8);assert.deepEqual(status.ledger.attempts.slice(0,4),oldRecord().ledger.attempts);assert.equal(Object.keys(status.acceptance.cases).length,4);assert.equal(egress,0);
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
