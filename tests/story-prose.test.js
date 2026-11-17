import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createStoryApi} from '../src/worker/story-api.js';
import {createBudgetCoordinator} from '../src/worker/story-budget.js';
import * as prose from '../src/game/cultivation/live/event-prose.js';
import * as provider from '../src/worker/story-prose.js';
import {GLM_MODEL_ID,PRODUCTION_PROFILES} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';

const origin='https://game.example',profile=PRODUCTION_PROFILES.find(row=>row.modelId===GLM_MODEL_ID);
function brief(runId='prose-life'){const state=createLiveGame({runId,seed:42,engineVersion:7,originStories:true,eventVersion:1}),pending=prepareOpening(state,{requestId:'opening'});return prose.buildEventProseBrief(commitTurn(state,pending,resolveRuleScene(state,pending)));}
const request=(path,body,cookie)=>new Request(origin+'/api/story/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
function fixture(t,reply){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());let calls=0;
 const storage={sql:{exec(q,...args){return {toArray:()=>db.prepare(q).all(...args)};}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const budget=createBudgetCoordinator({storage}),api=createStoryApi({budget,config:{proseEnabled:true,readiness:()=>profile},proseProvider:async(...args)=>{calls++;return reply?reply(...args):{status:'ready',text:'外院的规矩说得清楚，你仍有自己的打算。',accountingStatus:'complete'};}});
 return {api,db,get calls(){return calls;}};
}
async function authenticated(f){const response=await f.api.fetch(request('session',{protocolVersion:1})),value=await response.json();return {cookie:response.headers.get('set-cookie').split(';')[0],attempt:{id:'prose-attempt',sessionRef:value.sessionRef,retryOf:null}};}
function stream(text){return new ReadableStream({start(c){const packet={model:GLM_MODEL_ID,choices:[{index:0,delta:{content:JSON.stringify({text})},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:40,total_tokens:140}};c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(packet)+'\n\ndata: [DONE]\n\n'));c.close();}});}

test('prose is authenticated, source-bound and replays through the existing ledger without generating another turn',async t=>{
 const f=fixture(t),b=brief(),unauth=await(await f.api.fetch(request('prose',{brief:b,attempt:{id:'prose-attempt',sessionRef:'missing',retryOf:null}}))).json();
 assert.equal(unauth.errorCode,'SESSION_UNAVAILABLE');assert.equal(f.calls,0);
 const auth=await authenticated(f),body={brief:b,attempt:auth.attempt};
 const first=await(await f.api.fetch(request('prose',body,auth.cookie))).json(),second=await(await f.api.fetch(request('prose',body,auth.cookie))).json();
 assert.equal(first.status,'ready');assert.equal(first.scene,undefined);assert.equal(first.prose.sourceHash,b.sourceHash);assert.deepEqual(first,second);assert.equal(f.calls,1);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'complete');
});

test('tampered prose facts are rejected before admission and timeouts preserve unknown accounting without retries',async t=>{
 const f=fixture(t,async()=>({status:'paused',errorCode:'PROVIDER_TIMEOUT',accountingStatus:'unknown'})),auth=await authenticated(f),b=brief();
 const bad={...b,text:b.text+'你已获得仙器。'};
 const invalid=await(await f.api.fetch(request('prose',{brief:bad,attempt:auth.attempt},auth.cookie))).json();assert.equal(invalid.status,'rejected');assert.equal(f.calls,0);
 const body={brief:b,attempt:auth.attempt},first=await(await f.api.fetch(request('prose',body,auth.cookie))).json();
 assert.equal(first.errorCode,'PROVIDER_TIMEOUT');assert.equal(f.db.prepare('SELECT status FROM ledger').get().status,'unknown');
 assert.deepEqual(await(await f.api.fetch(request('prose',body,auth.cookie))).json(),first);assert.equal(f.calls,1);
});

test('prose quota exhaustion locks the original Cloudflare route for subsequent optional requests',async t=>{
 const f=fixture(t,async()=>({status:'paused',errorCode:'FREE_QUOTA_EXHAUSTED',accountingStatus:'complete'})),auth=await authenticated(f),b=brief();
 const first=await(await f.api.fetch(request('prose',{brief:b,attempt:auth.attempt},auth.cookie))).json();assert.equal(first.errorCode,'FREE_QUOTA_EXHAUSTED');
 const second=await(await f.api.fetch(request('prose',{brief:brief('next-life'),attempt:{...auth.attempt,id:'another'}},auth.cookie))).json();assert.equal(second.errorCode,'FREE_QUOTA_EXHAUSTED');assert.equal(f.calls,1);
});

test('limited prose uses exactly one bounded GLM stream and returns no scene or state changes',async()=>{
 let calls=0,input;
 const result=await provider.generateProse({run:async(model,body)=>{calls++;assert.equal(model,GLM_MODEL_ID);input=body;return stream('院里人声渐歇，那份说清的条件仍等着你的回答。');}},profile,brief());
 assert.equal(result.status,'ready');assert.equal(calls,1);assert.ok(input.max_tokens<=256);assert.equal(input.chat_template_kwargs.enable_thinking,false);assert.equal(result.scene,undefined);assert.equal(result.memoryDeltas,undefined);
 assert.deepEqual(input.response_format.json_schema.schema.required,['text']);
});

test('limited prose refuses alternate models and reports uncertain transport failures honestly',async()=>{
 let calls=0;const ai={run(){calls++;throw Error('connection lost');}};
 const blocked=await provider.generateProse(ai,{...profile,modelId:'other'},brief());assert.equal(blocked.status,'paused');assert.equal(calls,0);
 const failed=await provider.generateProse(ai,profile,brief());assert.equal(failed.status,'paused');assert.equal(failed.accountingStatus,'unknown');assert.equal(calls,1);
});

test('a quota error after stream admission remains unknown while still reporting the Cloudflare quota lock',async()=>{
 const ai={run:async()=>new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({model:GLM_MODEL_ID,error:{code:4006}})+'\n\n'));c.close();}})};
 const result=await provider.generateProse(ai,profile,brief());assert.equal(result.errorCode,'FREE_QUOTA_EXHAUSTED');assert.equal(result.accountingStatus,'unknown');
});
