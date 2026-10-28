import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { createOperatorProbeWorker, OperatorProbeDurableObject } from '../src/worker/operator-probe.js';
import { runProbe, summarizeProbeEvidence } from '../src/worker/story-probe.js';
import * as cli from '../scripts/workers-ai-probe.js';

const token = 'fixture-only-not-a-real-operator-credential';
const digest = async text => Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
const config = async (overrides={}) => ({operatorTokenSha256:await digest(token),bindingAccountId:'fixture-account',freeBoundaryEvidence:{accountId:'fixture-account',source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:10000,checkedAt:new Date().toISOString()},...overrides});
const response = () => ({model:CANDIDATE_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify({scene:'你来到山门。',choices:['入门','等待']}),reasoning_content:'private reasoning'}}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});
function storage(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY,value TEXT)');return {sql:{},reads:0,writes:0,async get(key){this.reads++;const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?JSON.parse(row.value):undefined;},async put(key,value){this.writes++;db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));},db};}
const request=(body={attemptId:'one'},options={})=>new Request('https://operator.invalid'+(options.path??'/probe'),{method:options.method??'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',...options.headers},...((options.method??'POST')==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
async function fixture(overrides={},run){const disk=storage();let calls=0,observed;const cfg=await config(overrides);const env={AI:{async run(model,input){calls++;observed={model,input};assert.equal((await disk.get('experiment-v1')).ledger.attempts.at(-1).status,'reserved');return run?run():response();}}};const make=()=>new OperatorProbeDurableObject({storage:disk},env,cfg);return {disk,cfg,env,make,object:make(),get calls(){return calls;},get observed(){return observed;}};}
const json=async result=>result.json();

test('CLI retains the same pure Worker-compatible probe exports',async()=>{assert.equal(cli.runProbe,runProbe);assert.equal(cli.summarizeProbeEvidence,summarizeProbeEvidence);assert.equal((await runProbe()).errorCode,'INFERENCE_DISABLED');});
test('authentication fails before storage and AI including invalid auth configuration',async()=>{const f=await fixture();for(const authorization of ['', 'Bearer wrong','Basic '+token])assert.equal((await f.object.fetch(request({}, {headers:{authorization}}))).status,401);assert.equal(f.disk.reads,0);assert.equal(f.disk.writes,0);assert.equal(f.calls,0);for(const operatorTokenSha256 of ['invalid',[await digest(token)]]){const bad=await fixture({operatorTokenSha256});assert.equal((await bad.object.fetch(request())).status,503);assert.equal(bad.disk.reads,0);}});
test('private routes reject malformed, extra-field and oversized bodies before storage',async()=>{const f=await fixture();for(const body of ['{','null','[]','{}','{"attemptId":"bad space"}','{"attemptId":"one","model":"other"}','{"attemptId":"one","task":"task7"}','{"attemptId":"one","evidence":{}}',' '.repeat(1025)])assert.equal((await f.object.fetch(request(body))).status,400);assert.equal((await f.object.fetch(request({}, {headers:{'content-type':'text/plain'}}))).status,415);assert.equal((await f.object.fetch(request({}, {path:'/reset'}))).status,404);assert.equal((await f.object.fetch(request({}, {method:'DELETE'}))).status,405);assert.equal((await f.object.fetch(request({}, {path:'/probe?task=task7'}))).status,400);assert.equal(f.calls,0);assert.equal(f.disk.writes,0);});
test('stale, unverified, mismatched-account and missing-binding configurations never reserve',async()=>{for(const change of [{checkedAt:'2020-01-01T00:00:00.000Z'},{plan:'workers-paid'},{storageFreeVerified:false},{accountId:'another-account'},{remainingNeurons:-1}]){const cfg=await config();Object.assign(cfg.freeBoundaryEvidence,change);const f=await fixture(cfg);const r=await json(await f.object.fetch(request()));assert.equal(r.status,'blocked');assert.equal(f.calls,0);assert.equal(f.disk.writes,0);}const f=await fixture();delete f.env.AI;assert.equal((await json(await f.object.fetch(request()))).errorCode,'AI_BINDING_MISSING');assert.equal(f.disk.writes,0);});
test('a real reservation precedes the fixed candidate/input and status omits reasoning and credentials',async()=>{const f=await fixture();const result=await json(await f.object.fetch(request()));assert.equal(result.status,'passed');assert.equal(result.reasoningPresent,true);assert.equal(result.reasoningChars,17);assert.equal(result.reasoningNonWhitespacePresent,true);assert.equal(result.actualNeurons,null);assert.equal(result.reservedNeurons,223);assert.equal(f.observed.model,CANDIDATE_MODEL_ID);assert.equal(f.observed.input.max_tokens,512);assert.equal(f.observed.input.messages[0].content,'你是修仙故事作者。只输出符合schema的中文JSON，不改动人物属性，不输出思考过程。');assert.equal(new TextEncoder().encode(JSON.stringify(f.observed.input)).length,656);assert.equal(f.observed.input.messages[1].content,'你十六岁，初到山门。写一个简短的入门场景和两个可选行动。');const status=await json(await f.object.fetch(request(null,{path:'/status',method:'GET'})));assert.equal(status.ledger.attempts.length,1);assert.equal(status.reservedNeurons,223);assert.equal(status.results.one.status,'passed');assert.doesNotMatch(JSON.stringify(status),/private reasoning|你来到山门|fixture-only|operatorTokenSha256/);});
test('concurrent duplicate and distinct attempts serialize without lost durable commitments',async()=>{const f=await fixture();const results=await Promise.all(['one','one','two'].map(attemptId=>f.object.fetch(request({attemptId})).then(json)));assert.equal(f.calls,2);assert.equal(results[1].status,'passed');const state=await f.disk.get('experiment-v1');assert.deepEqual(state.ledger.attempts.map(a=>a.attemptId),['one','two']);assert.equal((await json(await f.make().fetch(request()))).status,'passed');assert.equal(f.calls,2);});
test('restart and reserved/unknown attempts never recycle or invoke the same ID',async()=>{for(const status of ['reserved','unknown']){const f=await fixture();await f.disk.put('experiment-v1',{schemaVersion:1,ledger:{schemaVersion:1,attempts:[{attemptId:'one',task:'task1',reservedNeurons:24,actualNeurons:null,status}]},results:{}});const r=await json(await f.make().fetch(request()));assert.equal(r.status,'already-reserved-or-unknown');assert.equal(f.calls,0);assert.equal((await f.disk.get('experiment-v1')).ledger.attempts[0].reservedNeurons,24);}});
test('explicit probes exceed former task and global totals while preserving previous records',async()=>{
  const f=await fixture();for(let i=0;i<5;i++)assert.equal((await json(await f.object.fetch(request({attemptId:'a'+i})))).status,'passed');
  assert.equal(f.calls,5);
  for(const attempts of [Array.from({length:12},(_,i)=>({task:i<4?'task1':i<9?'task7':'task8',attemptId:'seed'+i,reservedNeurons:24,actualNeurons:null,status:'unknown'})),[{task:'task7',attemptId:'seed',reservedNeurons:10001,actualNeurons:null,status:'unknown'}]]){
    const g=await fixture(),original={schemaVersion:1,ledger:{schemaVersion:1,attempts},results:{}};
    await g.disk.put('experiment-v1',original);assert.equal((await json(await g.object.fetch(request()))).status,'passed');assert.equal(g.calls,1);
    const stored=await g.disk.get('experiment-v1');assert.deepEqual(stored.ledger.attempts.slice(0,-1),attempts);assert.equal(stored.ledger.attempts.at(-1).reservedNeurons,223);
  }
});

test('storage failure blocks inference and provider failure keeps unknown commitment across restart',async()=>{const f=await fixture();f.disk.put=async()=>{throw new Error('private disk failure');};assert.equal((await json(await f.object.fetch(request()))).errorCode,'LEDGER_PERSIST_FAILED');assert.equal(f.calls,0);const g=await fixture({},()=>{throw new Error('private provider failure');});const r=await json(await g.object.fetch(request()));assert.equal(r.errorCode,'PROVIDER_FAILED');assert.equal((await g.disk.get('experiment-v1')).ledger.attempts[0].status,'unknown');await g.make().fetch(request());assert.equal(g.calls,1);});
test('entry authenticates before namespace access and always forwards to the one private name',async()=>{const cfg=await config();const worker=createOperatorProbeWorker(cfg);let calls=0;const env={OPERATOR_PROBE:{idFromName(name){assert.equal(name,'wending-realtime-acceptance-v1');calls++;return name;},get(){return {fetch:async()=>Response.json({ok:true})};}}};assert.equal((await worker.fetch(request({}, {headers:{authorization:''}}),env)).status,401);assert.equal(calls,0);assert.equal((await worker.fetch(request(null,{path:'/status',method:'GET'}),env)).status,200);assert.equal(calls,1);});

// This catches Worker-incompatible imports and verifies the actual SQLite-backed
// DO/KV persistence contract rather than only the Node SQLite adapter.
test('local workerd SQLite namespace persists the fixed direct-binding probe across restart',{timeout:30000},async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'wending-operator-probe-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const cfg=await config();
  const entry=`import {createOperatorProbeWorker,OperatorProbeDurableObject} from './operator-probe.js';
const config=${JSON.stringify(cfg)};
export class Probe extends OperatorProbeDurableObject { constructor(ctx,env) { super(ctx,{...env,AI:{async run(model,input){
const saved=await ctx.storage.get('experiment-v1');
if(saved.ledger.attempts.at(-1).status!=='reserved'||model!==${JSON.stringify(CANDIDATE_MODEL_ID)}||input.max_tokens!==512)throw new Error('reservation or input mismatch');
return ${JSON.stringify(response())};
}}},config); } }
export default createOperatorProbeWorker(config);`;
  const modules=[{type:'ESModule',path:path.join(root,'src/worker/entry.js'),contents:entry}];
  const visited=new Set();
  async function moduleGraph(url,name){
    if(visited.has(url.href))return;visited.add(url.href);
    const contents=await readFile(url,'utf8');
    modules.push({type:'ESModule',path:path.join(root,name),contents});
    for(const match of contents.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await moduleGraph(new URL(match[1],url),path.normalize(path.join(path.dirname(name),match[1])));
  }
  await moduleGraph(new URL('../src/worker/operator-probe.js',import.meta.url),'src/worker/operator-probe.js');
  let egress=0;
  const options={name:'wending-operator-local',compatibilityDate:'2026-07-30',modulesRoot:root,modules,durableObjects:{OPERATOR_PROBE:{className:'Probe',useSQLite:true}},durableObjectsPersist:path.join(root,'sqlite'),outboundService:()=>{egress++;throw new Error('network forbidden');}};
  let mf=new Miniflare(options);t.after(()=>mf.dispose());
  const call=async(body={attemptId:'local'},route='/probe')=>mf.dispatchFetch('https://operator.invalid'+route,{method:route==='/status'?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(route==='/status'?{}:{body:JSON.stringify(body)})});
  assert.equal((await (await call()).json()).status,'passed');
  await mf.dispose();mf=new Miniflare(options);
  assert.equal((await (await call()).json()).status,'passed');
  const results=await Promise.all(['second','second','third'].map(async attemptId=>(await call({attemptId})).json()));
  assert.ok(results.every(result=>result.status==='passed'));
  const status=await (await call(null,'/status')).json();
  assert.equal(status.callCount,3);assert.equal(status.reservedNeurons,669);assert.equal(egress,0);
});

test('loss of all writes after durable pre-reservation leaves a permanent replay tombstone',async()=>{
  const f=await fixture();
  const put=f.disk.put.bind(f.disk);let writes=0;
  f.disk.put=async(key,value)=>{if(writes++>0)throw new Error('simulated crash boundary');await put(key,value);};
  const result=await json(await f.object.fetch(request()));
  assert.equal(f.calls,1);assert.equal(result.ledgerErrorCode,'LEDGER_PERSIST_FAILED');
  const persisted=await f.disk.get('experiment-v1');
  assert.equal(persisted.ledger.attempts[0].status,'reserved');
  assert.equal(persisted.ledger.attempts[0].reservedNeurons,223);
  f.disk.put=put;
  assert.equal((await json(await f.make().fetch(request()))).status,'already-reserved-or-unknown');
  assert.equal(f.calls,1);
});


test('reasoning diagnostics distinguish whitespace without exposing text or changing existing presence/status',async()=>{
  for(const [value,reasoningPresent,reasoningChars] of [[' \n',true,2],[undefined,false,0],[42,false,0]]){
    const raw=response();raw.choices[0].message.reasoning_content=value;
    const f=await fixture({},()=>raw);
    const result=await json(await f.object.fetch(request()));
    assert.equal(result.status,'passed');
    assert.equal(result.reasoningPresent,reasoningPresent);
    assert.equal(result.reasoningChars,reasoningChars);
    assert.equal(result.reasoningNonWhitespacePresent,false);
    assert.equal(Object.hasOwn(result,'reasoning_content'),false);
    const status=await json(await f.object.fetch(request(null,{path:'/status',method:'GET'})));
    assert.equal(status.results.one.reasoningChars,reasoningChars);
    assert.equal(Object.hasOwn(status.results.one,'reasoning_content'),false);
  }
});
