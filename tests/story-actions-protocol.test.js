import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryApi} from '../src/worker/story-api.js';
import {createStoryClient} from '../src/ui/story-client.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {exactKeys} from '../src/game/cultivation/live/schema.js';

function fixture(){
  const state=createLiveGame({runId:'actions-protocol',seed:42}),pending=prepareOpening(state,{requestId:'actions-opening'}),context=buildStoryContext(state,pending),attempt={id:'actions-attempt',sessionRef:'actions-session',retryOf:null};
  const wire={blocks:[{kind:'narration',text:'陈叔请你听听林中的求救声。'}],title:'林间求救',location:'林外',otherPeople:[{id:'p1',name:'陈叔'}],places:[],factions:[],choices:[{action:'interact:ask',targetId:'p1',stake:'low',label:'询问陈叔求救声的方位',anchor:'林中的求救声'},{action:'interact:decline',targetId:'p1',stake:'low',label:'婉拒陈叔的请求',anchor:'陈叔请你听听'}],memoryDeltas:[]};
  const scene=decodeGlmScene(wire,context,{storyActions:true}),reservations=[],capabilities=[];let outcome=null,settles=0;
  const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return outcome?{kind:'replay',result:outcome}:{code:'ATTEMPT_NOT_FOUND'};},async reserve(input){reservations.push(input);return outcome?{kind:'replay',result:outcome}:{kind:'reserved'};},async settle(input){settles++;outcome=input.result;return {kind:'settled'};}};
  const api=createStoryApi({budget,config:{readiness:()=>({modelId:'fixture'})},provider:async(ai,p,c,o,r)=>{capabilities.push(r.storyActions);return {status:'ready',scene,accountingStatus:'complete'};}});
  const request=(modern=true,method='POST')=>new Request('https://actions.test/api/story/turn'+(method==='GET'?'/'+pending.identity.requestId+'?attemptId='+attempt.id:''),{method,headers:{origin:'https://actions.test',cookie:'__Host-story_session='+'a'.repeat(64),...(modern?{'X-Story-Actions':'1'}:{}),...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({context,attempt})}:{})});
  return {api,request,reservations,capabilities,pending,context,attempt,get settles(){return settles;}};
}

test('API binds negotiated story actions to inference and new request fingerprints',async()=>{
  const modern=fixture(),legacy=fixture();
  const result=await (await modern.api.fetch(modern.request())).json();assert.equal(result.status,'ready');assert.deepEqual(modern.capabilities,[true]);
  await legacy.api.fetch(legacy.request(false));assert.deepEqual(legacy.capabilities,[false]);
  assert.notEqual(modern.reservations[0].payloadHash,legacy.reservations[0].payloadHash);assert.notEqual(modern.reservations[0].contextHash,legacy.reservations[0].contextHash);
});

test('the server explicitly advertises story-action support to new clients',async()=>{
  const f=fixture(),response=await f.api.fetch(new Request('https://actions.test/api/story/capabilities'));
  assert.equal((await response.json()).storyActions,true);
});

test('an explicit modern envelope is rejected by old servers and retains the original modern fingerprint',async()=>{
  const f=fixture(),request=f.request(),body=await request.clone().json();await f.api.fetch(request);
  const marked={...body,storyActions:true};assert.throws(()=>exactKeys(marked,['context','attempt']),'the old API rejects the new field before reservation');
  const result=await (await f.api.fetch(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(marked)}))).json();
  assert.equal(result.status,'ready');assert.equal(f.reservations.length,2);assert.equal(f.reservations[0].payloadHash,f.reservations[1].payloadHash);assert.equal(f.reservations[0].contextHash,f.reservations[1].contextHash);
  const invalid=fixture(),legacy=invalid.request(false);assert.equal((await (await invalid.api.fetch(new Request(legacy.url,{method:'POST',headers:legacy.headers,body:JSON.stringify(marked)}))).json()).errorCode,'REQUEST_INVALID');assert.equal(invalid.reservations.length,0);
});

test('legacy requests cannot receive new actions from inference or cached modern turns',async()=>{
  const legacy=fixture(),first=await (await legacy.api.fetch(legacy.request(false))).json();assert.equal(first.status,'rejected');assert.equal(first.errorCode,'GENERATED_SCENE_INVALID');
  const modern=fixture();assert.equal((await (await modern.api.fetch(modern.request())).json()).status,'ready');
  const old=await (await modern.api.fetch(modern.request(false,'GET'))).json();assert.equal(old.status,'paused');assert.equal(old.errorCode,'CLIENT_UPDATE_REQUIRED');
  assert.equal((await (await modern.api.fetch(modern.request(true,'GET'))).json()).status,'ready');assert.equal(modern.settles,1);
});

test('new client sends explicit action mode for POST and advertises support for cached GET',async()=>{
  const f=fixture(),headers=[],bodies=[];const client=createStoryClient({location:{protocol:'https:'},fetch:async(url,options)=>{headers.push(options.headers);bodies.push(options.body?JSON.parse(options.body):null);return Response.json({protocolVersion:1,status:'paused',errorCode:'ATTEMPT_IN_PROGRESS',requestId:f.pending.identity.requestId,attemptId:f.attempt.id,sessionRef:f.attempt.sessionRef});}});
  await client.requestTurn(f.pending,f.context,f.attempt,{storyActions:true});await client.getTurn(f.pending,f.attempt);
  assert.equal(headers[0]['X-Story-Actions'],'1');assert.equal(headers[1]['X-Story-Actions'],'1');
  assert.equal(bodies[0].storyActions,true);assert.throws(()=>exactKeys(bodies[0],['context','attempt']));
  await client.requestTurn(f.pending,f.context,f.attempt,{storyActions:false});assert.equal(headers[2]['X-Story-Actions'],undefined);
  assert.equal(bodies[2].storyActions,undefined);assert.doesNotThrow(()=>exactKeys(bodies[2],['context','attempt']));
});
