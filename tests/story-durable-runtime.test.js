import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {StoryBudget} from '../src/worker/story-budget.js';
import {createStoryProductionWorker} from '../src/worker/story-production.js';
import {CANDIDATE_MODEL_ID} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
const origin='https://game.test',header='x-wending-production-policy';
function policy(){const accountId='durable-runtime-test';return {enabled:true,mode:'production',modelId:CANDIDATE_MODEL_ID,bindingAccountId:accountId,currentPlan:{accountId,source:'operator-account-verification',plan:'workers-free'},freeBoundaryProof:{accountId,source:'operator-account-verification',plan:'workers-free',hardLimit:true,noGatewayCredits:true,directBinding:true,accountUsageVerified:true,storageFreeVerified:true,remainingNeurons:0,checkedAt:new Date(Date.now()-86400000).toISOString()},protocolVersion:1,rulesVersion:1,promptVersion:1,saveVersion:5,contentVersion:4};}
const req=(path,body,cookie,extra={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
function setup(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const storage={sql:{exec(q,...p){return {toArray:()=>db.prepare(q).all(...p)};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};
 let calls=0;const work=[];const ctx={storage,waitUntil:p=>work.push(p)};
 const env={AI:{async run(model,input){calls++;const c=JSON.parse(input.messages.at(-1).content),prefix=c.namespace+':t'+c.identity.turnId+':';return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({id:prefix+'s:scene',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你循着松影向前。'}],entities:[],choices:[{id:prefix+'c:rest',label:'歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:train',label:'修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]})}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};}}};
 let object=new StoryBudget(ctx,env);const binding={idFromName(name){assert.equal(name,'story-budget-v1-global');return name;},get(){return {fetch:r=>object.fetch(r)};}};
 return {db,work,get calls(){return calls;},restart(){object=new StoryBudget(ctx,env);},binding};
}
test('production turns cross the durable boundary with server policy, original request and stream unchanged',async()=>{
 const config=policy(),worker=createStoryProductionWorker({config}),body={context:'opaque'},cookie='story_session=private';let forwarded;
 const expected='data: {"type":"result"}\n\n';const env={STORY_BUDGET:{idFromName:name=>name,get:id=>({async fetch(r){assert.equal(id,'story-budget-v1-global');forwarded=r;return new Response(expected,{headers:{'content-type':'text/event-stream'}});}})},AI:{run(){throw Error('entry worker must not infer');}}};
 const response=await worker.fetch(req('/api/story/turn',body,cookie,{accept:'text/event-stream',[header]:'{"enabled":false}'}),env);
 assert.equal(response.headers.get('content-type'),'text/event-stream');assert.equal(await response.text(),expected);
 assert.ok(forwarded,'turn execution must leave the low-CPU public Worker');assert.equal(forwarded.url,origin+'/api/story/turn');assert.equal(forwarded.headers.get('origin'),origin);assert.equal(forwarded.headers.get('cookie'),cookie);assert.equal(forwarded.headers.get('accept'),'text/event-stream');assert.deepEqual(JSON.parse(forwarded.headers.get(header)),config);assert.deepEqual(await forwarded.json(),body);
});
test('durable turn executes with its own AI and preserves replay and quota accounting across restart',async t=>{
 const f=setup(t),config=policy(),worker=createStoryProductionWorker({config}),env={STORY_BUDGET:f.binding,AI:{run(){throw Error('thin worker inference');}}};
 const sessionResponse=await worker.fetch(req('/api/story/session',{protocolVersion:1}),env),session=await sessionResponse.json(),cookie=sessionResponse.headers.get('set-cookie').split(';')[0];
 const state=createLiveGame({runId:'durable-life',seed:42}),pending=prepareOpening(state,{requestId:'durable-opening'}),body={context:buildStoryContext(state,pending),attempt:{id:'durable-attempt',sessionRef:session.sessionRef,retryOf:null}};
 const response=await worker.fetch(req('/api/story/turn',body,cookie,{accept:'text/event-stream'}),env),wire=await response.text();await Promise.all(f.work);
 assert.match(wire,/"type":"result"/);const ready=wire.split('\n').filter(s=>s.startsWith('data: ')).map(s=>JSON.parse(s.slice(6))).find(p=>p.type==='result').result;
 assert.equal(ready.status,'ready',ready.errorCode);assert.equal(f.calls,1);assert.equal(f.db.prepare('SELECT count(*) AS n FROM ledger').get().n,1);assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'complete');
 f.restart();const disabled=createStoryProductionWorker({config:{...config,enabled:false}});
 const replay=await(await disabled.fetch(req('/api/story/turn/durable-opening?attemptId=durable-attempt',undefined,cookie),env)).json();assert.deepEqual(replay,ready);assert.equal(f.calls,1);
 const blocked=await(await disabled.fetch(req('/api/story/turn',{...body,attempt:{...body.attempt,id:'blocked'}},cookie,{[header]:JSON.stringify(config)}),env)).json();assert.equal(blocked.errorCode,'INFERENCE_DISABLED');assert.equal(f.calls,1);assert.equal(f.db.prepare('SELECT count(*) AS n FROM ledger').get().n,1);
 const crossOrigin=await worker.fetch(req('/api/story/turn',body,cookie,{origin:'https://attacker.test'}),env);assert.equal(crossOrigin.status,403);assert.equal(f.calls,1);
});
