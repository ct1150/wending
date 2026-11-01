import test from 'node:test';
import assert from 'node:assert/strict';
import {requestRecoverableTurn} from '../src/ui/story-recovery.js';
import {createLiveSession} from '../src/ui/live-session.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';

const pending={identity:{requestId:'request'}},attempt={id:'first',sessionRef:'session',retryOf:null};
const result=(a,status='ready',code=null)=>({protocolVersion:1,status,errorCode:code,requestId:'request',attemptId:a.id,sessionRef:a.sessionRef,retry:null,...(status==='ready'?{scene:{title:'下一幕'}}:{})});

test('a lost stream is recovered from its exact charged attempt without another inference',async()=>{
 let posts=0,replacements=0;
 const client={async requestTurn(){posts++;throw Object.assign(Error(),{code:'NETWORK_UNAVAILABLE'});},async getTurn(p,a){return result(a);}};
 const value=await requestRecoverableTurn({client,pending,context:{},attempt,automatic:true,replaceAttempt(){replacements++;}});
 assert.equal(value.result.status,'ready');assert.equal(posts,1);assert.equal(replacements,0);assert.deepEqual(value.attempt,attempt);
});

test('a provider failure creates one durable linked attempt before retrying the same context',async()=>{
 const context={fixed:'receipt'},order=[],seen=[];
 const client={async requestTurn(p,c,a){order.push('post:'+a.id);seen.push(c);return a.id==='first'?result(a,'paused','PROVIDER_TIMEOUT'):result(a);}};
 const value=await requestRecoverableTurn({client,pending,context,attempt,automatic:true,replaceAttempt:async old=>{order.push('persist');return {id:'second',sessionRef:'session',retryOf:{attemptId:old.id,sessionRef:old.sessionRef}};}});
 assert.equal(value.result.status,'ready');assert.deepEqual(order,['post:first','persist','post:second']);assert.ok(seen.every(c=>c===context));
});

test('an in-flight charged attempt is polled rather than duplicated',async()=>{
 let clock=0,lookups=0,replacements=0;
 const client={async requestTurn(){throw Object.assign(Error(),{code:'NETWORK_UNAVAILABLE'});},async getTurn(p,a){lookups++;return lookups===1?result(a,'paused','ATTEMPT_IN_PROGRESS'):result(a);}};
 const value=await requestRecoverableTurn({client,pending,context:{},attempt,automatic:true,now:()=>clock,sleep:async ms=>{clock+=ms;},replaceAttempt(){replacements++;}});
 assert.equal(value.result.status,'ready');assert.equal(lookups,2);assert.equal(replacements,0);assert.ok(clock>0);
});

test('quota exhaustion and identity mismatch cannot trigger new inference',async()=>{
 let replacements=0;
 const options={pending,context:{},attempt,automatic:true,replaceAttempt(){replacements++;}};
 const stopped=await requestRecoverableTurn({...options,client:{async requestTurn(){return result(attempt,'paused','FREE_QUOTA_EXHAUSTED');}}});
 assert.equal(stopped.result.errorCode,'FREE_QUOTA_EXHAUSTED');
 await assert.rejects(requestRecoverableTurn({...options,client:{async requestTurn(){return {...result(attempt,'paused','PROVIDER_TIMEOUT'),attemptId:'other'};}}}),{code:'RESPONSE_IDENTITY_MISMATCH'});
 assert.equal(replacements,0);
});

test('recovery stops after two attempts and older services retain their original behavior',async()=>{
 let calls=0,replacements=0;
 const client={async requestTurn(p,c,a){calls++;return result(a,'rejected','CHOICE_NOT_COMPILABLE');}};
 const options={client,pending,context:{},attempt,replaceAttempt:async old=>{replacements++;return {...old,id:'second',retryOf:{attemptId:old.id,sessionRef:old.sessionRef}};}};
 const value=await requestRecoverableTurn({...options,automatic:true});assert.equal(value.result.status,'rejected');assert.equal(calls,2);assert.equal(replacements,1);
 calls=0;await requestRecoverableTurn({...options,automatic:false});assert.equal(calls,1);assert.equal(replacements,1);
});

test('an older service may still return its original identity-free paused result',async()=>{
 const paused={status:'paused',errorCode:'PROVIDER_TIMEOUT'};
 const value=await requestRecoverableTurn({client:{async requestTurn(){return paused;}},pending,context:{},attempt,automatic:false});
 assert.equal(value.result,paused);
});

test('the game session persists recovery before POST, commits once and never displays the transient failure',async()=>{
 const state=createLiveGame({runId:'ui-recovery',seed:4,engineVersion:7,experienceVersion:1,originStories:true}),p=prepareOpening(state,{requestId:'opening'}),views=[],contexts=[];
 let row={archiveId:'recovery-archive',state,pending:p,attempt:null},calls=0,commits=0;
 const copy=()=>structuredClone(row);
 const archive={async load(){return copy();},async prepare(value){assert.deepEqual(value,p);return copy();},async readStoryRecords(){return {records:[],openTotal:0};},async setAttempt(value){assert.equal(value.expectedAttemptId,row.attempt?.id??null);row={...row,attempt:structuredClone(value.attempt),generation:structuredClone(value.generation)};return copy();},async commit(value){assert.equal(value.expectedAttemptId,row.attempt.id);commits++;row={...row,state:value.nextState,pending:null,attempt:null,generation:null};return copy();}};
 const client={async capabilities(){return {available:true,storyActions:true,experienceVersion:1,originStories:true,openingStoryVersion:1,automaticRecovery:1};},async createSession(){return {sessionRef:'session'};},async requestTurn(pending,context,a){
  calls++;assert.equal(row.attempt.id,a.id);contexts.push(JSON.stringify(context));
  const base={protocolVersion:1,requestId:pending.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,retry:null};
  if(calls===1)return {...base,status:'paused',errorCode:'PROVIDER_TIMEOUT'};
  assert.ok(a.retryOf);const prefix=context.namespace+':t1:';
  return {...base,status:'ready',errorCode:null,scene:{id:prefix+'s:scene',title:'雨后外院',location:'栖云门外院',entities:[],blocks:[{kind:'narration',text:'山门外雨刚停，外院药圃的石阶上留着清晰脚印。远处传来打扫的竹帚声，晾在廊下的口诀纸页正被风吹动。'}],choices:[{id:prefix+'c:a',label:'查看廊下口诀',intent:'interact',targetId:'self',stake:'low',approach:'observe'},{id:prefix+'c:b',label:'按口诀吐纳修行',intent:'practice',targetId:'self',stake:'normal',approach:'steady'}],memoryDeltas:[],story:{pattern:'cultivation',beat:'progress',anchors:[0]}}};
 }};
 const session=createLiveSession({archive,client,onChange:value=>views.push(value)});await session.load();const view=await session.retry();
 assert.equal(view.status,'ready',view.errorCode);assert.equal(calls,2);assert.equal(commits,1);assert.equal(view.state.revision,1);
 assert.equal(contexts[0],contexts[1]);assert.ok(!views.some(v=>v.status==='paused'&&v.errorCode==='PROVIDER_TIMEOUT'));
});
