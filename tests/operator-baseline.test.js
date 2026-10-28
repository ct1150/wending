// Local fixtures only. No Cloudflare request or real inference is made here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { createLiveGame,prepareOpening,commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { canonicalStringify,sha256,stateHash } from '../src/game/cultivation/live/identity.js';

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
function sourceFixture({singleChoice=false}={}){
  const record=historicalRecord(),birth=createLiveGame({runId:'actual-player-fixture',seed:136,name:'云归',originId:'village'}),pending=prepareOpening(birth,{requestId:'player-opening'});
  const context=buildStoryContext(birth,pending,[],{selection:'relevance-v1',openTotal:0}),scene=makeScene(context);
  if(singleChoice)scene.choices[1]={...scene.choices[1],intent:'craft',targetId:'manual',approach:'study'};
  const browserState=commitTurn(birth,pending,scene,context.relationships),attempt={id:'player-attempt',sessionRef:'player-session',retryOf:null};
  const identity={sessionRef:attempt.sessionRef,requestId:pending.identity.requestId,attemptId:attempt.id,payloadHash:sha256(canonicalStringify({context,attempt})),contextHash:sha256(canonicalStringify(context))};
  const admissionId='task8_'+sha256(canonicalStringify([identity.sessionRef,identity.attemptId])),acceptedSceneHash=sha256(canonicalStringify(scene));
  record.ledger.attempts.push({task:'task8',attemptId:admissionId,reservedNeurons:111,actualNeurons:null,status:'complete'});
  record.task8={schemaVersion:1,admissions:{[admissionId]:{identity,status:'complete',acceptedSceneHash}}};
  record.results[admissionId]={task:'task8',...identity,status:'complete',reservedNeurons:111,actualNeurons:null,acceptedSceneHash};
  return clone({record,body:{admissionId,context,scene,browserState}});
}
async function fixture(data=sourceFixture()){
  let saved=clone(data.record),writes=0,calls=0;const inputs=[];
  const storage={sql:{},async get(){return clone(saved);},async put(key,value){assert.equal(key,'experiment-v1');saved=clone(value);writes++;}};
  const config={operatorTokenSha256:sha256(token),bindingAccountId:'local-account',freeBoundaryEvidence:{accountId:'local-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:800,checkedAt:new Date().toISOString()}};
  const env={AI:{async run(model,input){calls++;const c=JSON.parse(input.messages[1].content);inputs.push(c);return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(makeScene(c))}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};}}};
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
});
