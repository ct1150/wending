import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createStoryApi, TURN_RESERVATION_NEURONS } from '../src/worker/story-api.js';
import { createStoryWorker } from '../src/worker/index.js';
import { createBudgetCoordinator } from '../src/worker/story-budget.js';
import { generateScene } from '../src/worker/story-provider.js';
import { CANDIDATE_PROFILE } from '../src/worker/story-config.js';
import { createLiveGame,prepareOpening } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
const origin='https://game.example';
const context=()=>{const s=createLiveGame({runId:'api-run',seed:42});return buildStoryContext(s,prepareOpening(s,{requestId:'game-request'}));};
const scene=c=>({id:c.namespace+':t1:s:opening',title:'山中来信',location:'山下',blocks:[{kind:'narration',text:'一位旅人留下了一封来信。'}],entities:[],choices:['a','b'].map(id=>({id:c.namespace+':t1:c:'+id,label:id,intent:id==='a'?'rest':'practice',targetId:'self',approach:id==='a'?'recover':'steady',stake:'normal'})),memoryDeltas:[]});
function fixture(provider,options={}){const db=new DatabaseSync(':memory:');const storage={sql:{exec(q,...p){return {toArray:()=>db.prepare(q).all(...p)};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};let now=Date.parse('2026-10-27T10:00:00Z'),calls=0;const budget=createBudgetCoordinator({storage,now:()=>now,limits:options.limits??{}});const api=createStoryApi({budget,config:{readiness:()=>options.profile??{modelId:'fixture'},now:()=>now},provider:async(...args)=>{calls++;return provider?provider(...args):{status:'ready',scene:scene(args[2]),actualNeurons:null,inferencePerformed:true};}});return {api,budget,db,setNow:v=>now=v,get calls(){return calls;}};}
const req=(path,body,cookie,headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'192.0.2.5',...(cookie?{cookie}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
async function session(f){const r=await f.api.fetch(req('/api/story/session',{protocolVersion:1}));return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],setCookie:r.headers.get('set-cookie')};}
const body=(s,id='attempt-1',retryOf=null)=>({context:context(),attempt:{id,sessionRef:s.data.sessionRef,retryOf}});
test('capabilities and deployed default fail closed without AI calls or session allocation',async()=>{let allocated=0;const api=createStoryApi({budget:{createSession(){allocated++;}},provider(){throw new Error('called');}});const r=await api.fetch(req('/api/story/capabilities'));const data=await r.json();assert.equal(data.available,false);assert.equal(data.errorCode,'INFERENCE_DISABLED');assert.equal(allocated,0);const worker=createStoryWorker({staticFetch:()=>new Response('static')});assert.equal((await (await worker.fetch(req('/api/story/capabilities'),{})).json()).available,false);assert.equal(await (await worker.fetch(req('/ordinary'),{})).text(),'static');});
test('secure cookie and concurrent idempotency return one persisted scene, never another session result',async()=>{let release;const f=fixture(async(a,p,c)=>{await new Promise(r=>release=r);return {status:'ready',scene:scene(c),inferencePerformed:true};});const s=await session(f);assert.match(s.setCookie,/HttpOnly/);assert.match(s.setCookie,/Secure/);assert.match(s.setCookie,/SameSite=Strict/);const b=body(s);const first=f.api.fetch(req('/api/story/turn',b,s.cookie));await new Promise(r=>setTimeout(r,10));const duplicate=await f.api.fetch(req('/api/story/turn',b,s.cookie));assert.equal((await duplicate.json()).errorCode,'ATTEMPT_IN_PROGRESS');release();assert.equal((await (await first).json()).status,'ready');assert.equal((await (await f.api.fetch(req('/api/story/turn',b,s.cookie))).json()).status,'ready');assert.equal(f.calls,1);const changed=structuredClone(b);changed.context.life.name='另一个人';assert.equal((await (await f.api.fetch(req('/api/story/turn',changed,s.cookie))).json()).errorCode,'ATTEMPT_PAYLOAD_MISMATCH');const second=await session({...f,api:createStoryApi({budget:f.budget,config:{readiness:()=>({})}})}); // no-cookie explicit new session
const other=await f.api.fetch(req('/api/story/turn/game-request?attemptId=attempt-1',undefined,second.cookie));assert.equal((await other.json()).errorCode,'ATTEMPT_NOT_FOUND');assert.equal(f.calls,1);});
test('lost credentials and expired session pause; explicit new session and new retry regenerate same receipt',async()=>{const f=fixture();const s=await session(f),b=body(s);assert.equal((await (await f.api.fetch(req('/api/story/turn',b))).json()).errorCode,'SESSION_UNAVAILABLE');await f.api.fetch(req('/api/story/turn',b,s.cookie));f.setNow(Date.parse('2026-10-29T10:00:00Z'));const old=await (await f.api.fetch(req('/api/story/turn',b,s.cookie))).json();assert.equal(old.status,'paused');assert.equal(old.errorCode,'SESSION_UNAVAILABLE');assert.equal(f.calls,1);const next=await session(f),retry=body(next,'attempt-2',{attemptId:'attempt-1',sessionRef:s.data.sessionRef});assert.equal((await (await f.api.fetch(req('/api/story/turn',retry,next.cookie))).json()).status,'ready');assert.equal(f.calls,2);});
test('strict HTTP boundaries reject wrong origin, type, envelope, IDs, query and streaming overrun before AI',async()=>{const f=fixture(),s=await session(f);for(const [request,status] of [[req('/api/story/turn',body(s),s.cookie,{origin:'https://evil.example'}),403],[req('/api/story/turn',body(s),s.cookie,{'content-type':'text/plain'}),415],[req('/api/story/turn',{...body(s),modelId:'paid'} ,s.cookie),400],[req('/api/story/turn','{bad',s.cookie),400],[req('/api/story/turn/'+ 'x'.repeat(90)+'?attemptId=a',undefined,s.cookie),400],[req('/api/story/turn/game-request?attemptId=a&extra=1',undefined,s.cookie),400],[req('/api/story/unknown',undefined,s.cookie),404]])assert.equal((await f.api.fetch(request)).status,status);
let canceled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(32769));},cancel(){canceled=true;}});const oversized=new Request(origin+'/api/story/turn',{method:'POST',headers:{origin,'content-type':'application/json',cookie:s.cookie},body:stream,duplex:'half'});assert.equal((await f.api.fetch(oversized)).status,413);assert.equal(canceled,true);assert.equal(f.calls,0);});
test('quota, busy, timeout, invalid output and secrets become bounded persisted envelopes without automatic retry',async()=>{for(const code of ['FREE_QUOTA_EXHAUSTED','PROVIDER_BUSY','PROVIDER_TIMEOUT','PROVIDER_FAILED']){const f=fixture(async()=>({status:'paused',errorCode:code,inferencePerformed:true,actualNeurons:null,secret:'credential-secret'}));const s=await session(f),b=body(s),r=await (await f.api.fetch(req('/api/story/turn',b,s.cookie))).json();assert.equal(r.status,'paused');assert.equal(r.errorCode,code);assert.equal(r.retry.explicit,true);assert.doesNotMatch(JSON.stringify(r),/credential-secret|actualNeurons/);assert.equal((await (await f.api.fetch(req('/api/story/turn',b,s.cookie))).json()).errorCode,code);assert.equal(f.calls,1);}
const f=fixture(async()=>({status:'ready',scene:{secret:'raw-token'}})),s=await session(f);const r=await (await f.api.fetch(req('/api/story/turn',body(s),s.cookie))).json();assert.equal(r.status,'rejected');assert.doesNotMatch(JSON.stringify(r),/raw-token/);});

test('deployed factory cannot inject a readiness bypass and preserves static request/env/context delegation',async()=>{let aiCalls=0,delegated;const worker=createStoryWorker({config:{enabled:true,readiness:()=>({}),evidence:{plan:'workers-free'}},staticFetch:(...args)=>{delegated=args;return new Response('static');}});const env={AI:{run(){aiCalls++;}}},ctx={waitUntil(){}};const r=await worker.fetch(req('/api/story/capabilities'),env,ctx);assert.equal((await r.json()).errorCode,'FREE_BOUNDARY_UNVERIFIED');assert.equal(aiCalls,0);const staticRequest=req('/archive');assert.equal(await (await worker.fetch(staticRequest,env,ctx)).text(),'static');assert.deepEqual(delegated,[staticRequest,env,ctx]);assert.equal((await worker.fetch(req('/api/story'),env,ctx)).status,404);});


test('HTTP retries cannot bypass current ready result and cache loss requires explicit latest link',async()=>{
  const f=fixture(),s=await session(f),initial=body(s);
  assert.equal((await (await f.api.fetch(req('/api/story/turn',initial,s.cookie))).json()).status,'ready');
  const foreign=body(s,'attempt-2',{sessionRef:'fictional',attemptId:'fictional'});
  assert.equal((await (await f.api.fetch(req('/api/story/turn',foreign,s.cookie))).json()).errorCode,'ATTEMPT_ALREADY_READY');assert.equal(f.calls,1);
  f.db.prepare('DELETE FROM attempts WHERE session_ref=?').run(s.data.sessionRef);
  assert.equal((await (await f.api.fetch(req('/api/story/turn',body(s,'attempt-2'),s.cookie))).json()).errorCode,'EXPLICIT_RETRY_REQUIRED');assert.equal(f.calls,1);
  assert.equal((await (await f.api.fetch(req('/api/story/turn',foreign,s.cookie))).json()).errorCode,'RETRY_INVALID');assert.equal(f.calls,1);
  const linked=body(s,'attempt-2',{sessionRef:s.data.sessionRef,attemptId:'attempt-1'});
  assert.equal((await (await f.api.fetch(req('/api/story/turn',linked,s.cookie))).json()).status,'ready');assert.equal(f.calls,2);
});

test('actual provider continuation rejection stays typed through HTTP and completes the charged SQLite ledger',async t=>{
  const f=fixture(generateScene,{
    profile:{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},
    limits:{dailyNeurons:TURN_RESERVATION_NEURONS},
  });
  t.after(()=>f.db.close());
  let inferences=0;
  const sentContexts=[];
  const env={AI:{run:async(model,input)=>{
    inferences++;
    assert.equal(model,CANDIDATE_PROFILE.modelId);
    const c=JSON.parse(input.messages.find(message=>message.role==='user').content);
    sentContexts.push(c);
    const candidate=scene(c);
    if(inferences===1) {
      candidate.entities=Array.from({length:24},(_,i)=>({
        id:c.namespace+':t1:e:'+i+'x'.repeat(48),
        name:String(i)+'名'.repeat(58),kind:'person',
      }));
    }
    return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate)}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
  }}};
  const s=await session(f),firstBody=body(s);
  const first=await (await f.api.fetch(req('/api/story/turn',firstBody,s.cookie),env)).json();
  assert.equal(first.status,'rejected');
  assert.equal(first.errorCode,'NEXT_CONTEXT_TOO_LARGE');
  assert.equal(Object.hasOwn(first,'scene'),false);
  assert.equal(inferences,1);
  const ledger=()=>f.db.prepare('SELECT attempt_id,day,reserved,charge,status,actual,outcome,context_hash FROM ledger ORDER BY created,attempt_id').all();
  const original=ledger()[0];
  assert.equal(original.status,'complete');assert.equal(original.outcome,'rejected');
  assert.equal(original.day,'2026-10-27');assert.equal(original.actual,null);
  assert.equal(original.reserved,TURN_RESERVATION_NEURONS);assert.equal(original.charge,TURN_RESERVATION_NEURONS);
  const replay=await (await f.api.fetch(req('/api/story/turn',firstBody,s.cookie),env)).json();
  const lookup=await (await f.api.fetch(req('/api/story/turn/game-request?attemptId=attempt-1',undefined,s.cookie),env)).json();
  assert.deepEqual(replay,first);assert.deepEqual(lookup,first);
  assert.equal(inferences,1);assert.deepEqual(ledger(),[original]);
  const linked=body(s,'attempt-2',{sessionRef:s.data.sessionRef,attemptId:'attempt-1'});
  const sameDay=await (await f.api.fetch(req('/api/story/turn',linked,s.cookie),env)).json();
  assert.equal(sameDay.errorCode,'DAILY_BUDGET_EXHAUSTED');
  assert.equal(inferences,1);assert.deepEqual(ledger(),[original]);
  f.setNow(Date.parse('2026-10-28T00:00:01Z'));
  const nextDay=await (await f.api.fetch(req('/api/story/turn',linked,s.cookie),env)).json();
  assert.equal(nextDay.status,'ready');assert.ok(nextDay.scene);
  assert.equal(inferences,2);assert.equal(f.calls,2);
  assert.deepEqual(sentContexts[1],sentContexts[0]);
  assert.deepEqual(sentContexts[1].receipt,firstBody.context.receipt);
  assert.equal(sentContexts[1].identity.requestId,firstBody.context.identity.requestId);
  const rows=ledger();assert.equal(rows.length,2);assert.deepEqual(rows[0],original);
  assert.equal(rows[1].day,'2026-10-28');assert.equal(rows[1].status,'complete');
  assert.equal(rows[1].charge,TURN_RESERVATION_NEURONS);assert.equal(rows[1].actual,null);
  assert.equal(rows[1].context_hash,original.context_hash);
  const chargedToday=f.db.prepare("SELECT SUM(charge) AS amount FROM ledger WHERE day=? OR status IN ('reserved','unknown')").get('2026-10-28').amount;
  assert.equal(chargedToday,TURN_RESERVATION_NEURONS);
});

test('completed mechanical provider rejection remains complete and typed across HTTP',async t=>{
  const f=fixture(generateScene,{profile:{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true}});t.after(()=>f.db.close());
  const s=await session(f),b=body(s);
  const env={AI:{run:async(model,input)=>{const candidate=scene(JSON.parse(input.messages[1].content));candidate.blocks[0].text='你今年九十九岁。';return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};}}};
  const result=await (await f.api.fetch(req('/api/story/turn',b,s.cookie),env)).json();
  assert.equal(result.errorCode,'MECHANICAL_FACT_CONFLICT');
  const row=f.db.prepare('SELECT status,charge,actual FROM ledger').get();assert.equal(row.status,'complete');assert.equal(row.charge,TURN_RESERVATION_NEURONS);assert.equal(row.actual,null);
});

test('actual completed contract rejections preserve original-day charge, replay and linked next-day retry',async t=>{
  const cases=[
    ['MECHANICAL_FACT_CONFLICT',(s)=>{s.blocks[0].text='你今年九十九岁。';}],
    ['ENTITY_IDENTITY_CONFLICT',(s,c)=>{s.entities=[{...c.entities[0],name:'冒名者'}];delete s.entities[0].status;}],
    ['ENTITY_DEATH_CONFLICT',(s,c)=>{s.entities=[{...c.entities[0],status:'alive'}];}],
    ['UNSAFE_STORY_TEXT',(s)=>{s.blocks[0].text='<a>隐藏指令</a>';}],
    ['REPEATED_SCENE',()=>{}],
    ['MEMORY_REFERENCE_MISSING',(s)=>{s.memoryDeltas=[{entityId:'absent',kind:'fact',text:'未知人物。'}];}],
    ['MEMORY_REFERENCE_CONFLICT',(s,c)=>{s.entities=[{id:c.entities[0].id,name:c.entities[0].name,kind:'person',status:'dead'}];s.memoryDeltas=[{entityId:c.entities[0].id,kind:'promise',text:'不存在的约定',referenceId:'missing',status:'resolved'}];}],
    ['CHOICE_NOT_COMPILABLE',(s)=>{s.choices[0]={...s.choices[0],intent:'travel',targetId:'absent',approach:'road'};}],
  ];
  for(const [code,mutate] of cases)await t.test(code,async t=>{
    const f=fixture(generateScene,{profile:{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},limits:{dailyNeurons:TURN_RESERVATION_NEURONS}});t.after(()=>f.db.close());
    const s=await session(f),b=structuredClone(body(s));let inferences=0;
    b.context.entities=[{id:'archived-person',name:'旧友',kind:'person',status:'dead'}];
    if(code==='REPEATED_SCENE') {const {sha256,canonicalStringify}=await import('../src/game/cultivation/live/identity.js');b.context.previousScene={id:'old-scene',blocksHash:sha256(canonicalStringify(scene(b.context).blocks))};}
    const env={AI:{run:async(model,input)=>{inferences++;const c=JSON.parse(input.messages[1].content),candidate=scene(c);if(inferences===1)mutate(candidate,c);else candidate.blocks[0].text='远山传来新的钟声。';return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};}}};
    const first=await (await f.api.fetch(req('/api/story/turn',b,s.cookie),env)).json();assert.equal(first.status,'rejected');assert.equal(first.errorCode,code);
    const rows=()=>f.db.prepare('SELECT * FROM ledger ORDER BY rowid').all();const original=rows()[0];assert.equal(original.status,'complete');assert.equal(original.day,'2026-10-27');assert.equal(original.charge,TURN_RESERVATION_NEURONS);assert.equal(original.actual,null);
    assert.deepEqual(await (await f.api.fetch(req('/api/story/turn',b,s.cookie),env)).json(),first);assert.equal(inferences,1);
    f.setNow(Date.parse('2026-10-28T00:00:01Z'));const retry=structuredClone(b);retry.attempt.id='attempt-2';retry.attempt.retryOf={sessionRef:s.data.sessionRef,attemptId:'attempt-1'};
    assert.equal((await (await f.api.fetch(req('/api/story/turn',retry,s.cookie),env)).json()).status,'ready');assert.equal(inferences,2);assert.deepEqual(rows()[0],original);assert.equal(rows()[1].status,'complete');assert.equal(rows()[1].actual,null);
  });
});

test('contract vocabulary is complete and accounting is independent of public error presentation',async t=>{
  const {STORY_ERROR_CODES}=await import('../src/game/cultivation/live/memory.js');
  const {PROVIDER_ERROR_CODES}=await import('../src/worker/story-provider.js');
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../src/game/cultivation/live/memory.js',import.meta.url),'utf8');
  assert.deepEqual([...new Set([...source.matchAll(/fail\('([A-Z_]+)'\)/g)].map(m=>m[1]))].sort(),[...STORY_ERROR_CODES].sort());
  for(const code of [...STORY_ERROR_CODES,'SECRET_INTERNAL_FAILURE']) {
    if(code!=='SECRET_INTERNAL_FAILURE')assert.ok(PROVIDER_ERROR_CODES.includes(code));
    const f=fixture(async()=>({status:'rejected',accountingStatus:'complete',errorCode:code}));t.after(()=>f.db.close());const s=await session(f);
    const result=await (await f.api.fetch(req('/api/story/turn',body(s),s.cookie))).json();assert.equal(result.errorCode,code==='SECRET_INTERNAL_FAILURE'?'PROVIDER_FAILED':code);
    assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'complete');
  }
});

test('actual transport failure and timeout remain unknown across UTC days',async t=>{
  for(const timeout of [false,true]) {
    const provider=(ai,p,c)=>generateScene(ai,p,c,{timeoutMs:5});
    const f=fixture(provider,{profile:{...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true},limits:{dailyNeurons:TURN_RESERVATION_NEURONS}});t.after(()=>f.db.close());const s=await session(f);
    const env={AI:{run:()=>timeout?new Promise(()=>{}):Promise.reject(Error('private transport failure'))}};
    const result=await (await f.api.fetch(req('/api/story/turn',body(s),s.cookie),env)).json();assert.equal(result.errorCode,timeout?'PROVIDER_TIMEOUT':'PROVIDER_FAILED');
    const original=f.db.prepare('SELECT * FROM ledger').get();assert.equal(original.status,'unknown');assert.equal(original.actual,null);assert.equal(original.charge,TURN_RESERVATION_NEURONS);
    f.setNow(Date.parse('2026-10-28T00:00:01Z'));const retry=body(s,'attempt-2',{sessionRef:s.data.sessionRef,attemptId:'attempt-1'});
    assert.equal((await (await f.api.fetch(req('/api/story/turn',retry,s.cookie),env)).json()).errorCode,'DAILY_BUDGET_EXHAUSTED');assert.equal(f.calls,1);
  }
});

test('concurrent HTTP distinct requests share one session lease while other sessions remain independent',async t=>{
  let release,entered;const started=new Promise(resolve=>entered=resolve);
  const f=fixture(async(a,p,c)=>{if(c.identity.requestId==='game-request'){entered();await new Promise(r=>release=r);}return {status:'ready',accountingStatus:'complete',scene:scene(c)};});t.after(()=>f.db.close());
  const s=await session(f),other=await session(f);const first=f.api.fetch(req('/api/story/turn',body(s),s.cookie));await started;
  const second=structuredClone(body(s,'attempt-2'));second.context.identity.requestId='another-request';
  const independent=structuredClone(body(other));independent.context.identity.requestId='independent';
  assert.equal((await (await f.api.fetch(req('/api/story/turn',second,s.cookie))).json()).errorCode,'ATTEMPT_IN_PROGRESS');
  assert.equal(f.calls,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);
  assert.equal((await (await f.api.fetch(req('/api/story/turn',independent,other.cookie))).json()).status,'ready');
  release();assert.equal((await (await first).json()).status,'ready');
  assert.equal((await (await f.api.fetch(req('/api/story/turn',second,s.cookie))).json()).status,'ready');assert.equal(f.calls,3);
});
