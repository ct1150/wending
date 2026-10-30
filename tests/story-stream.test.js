import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryApi} from '../src/worker/story-api.js';
import {createStoryClient} from '../src/ui/story-client.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
const origin='https://stream.test';
function fixture(provider,{longIds=false,settleFailure=null,onReserve=()=>{}}={}){
  let outcome=null,reserved=false,settlement=null,calls=0;const state=createLiveGame({runId:'stream-api-run',seed:42}),pending=prepareOpening(state,{requestId:longIds?'r'.repeat(80):'stream-request'});
  const context=buildStoryContext(state,pending),attempt={id:longIds?'a'.repeat(80):'stream-attempt',sessionRef:longIds?'s'.repeat(80):'stream-session',retryOf:null};
  const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return outcome?{kind:'replay',result:outcome}:{code:'ATTEMPT_NOT_FOUND'};},async reserve(){if(outcome)return {kind:'replay',result:outcome};if(reserved)return {code:'ATTEMPT_IN_PROGRESS'};reserved=true;onReserve();return {kind:'reserved'};},async settle(value){settlement=value;if(settleFailure==='throw')throw Error('storage failed');if(settleFailure==='denied')return {kind:'denied'};outcome=value.result;return {kind:'settled'};}};
  const api=createStoryApi({budget,config:{readiness:()=>({modelId:'fixture'})},provider:async(...args)=>{assert.equal(reserved,true);calls++;return provider(...args);}});
  const request=()=>new Request(origin+'/api/story/turn',{method:'POST',headers:{origin,'content-type':'application/json',accept:'text/event-stream',cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context,attempt})});
  return {api,request,pending,context,attempt,get settlement(){return settlement;},get calls(){return calls;}};
}
function scene(c){const prefix=c.namespace+':t1:';return {id:prefix+'s:scene',title:'山路',location:'山下',entities:[],blocks:[{kind:'narration',text:'山风拂过。'}],choices:[{id:prefix+'c:a',label:'歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:b',label:'修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};}

test('POST SSE previews precede completion; final validated result is settled once and replayed as JSON',async()=>{
  let release;const held=new Promise(resolve=>release=resolve);
  const f=fixture(async(ai,p,c,options,runtime)=>{runtime.onProgress({type:'preview',text:'山风'});await held;return {status:'ready',scene:scene(c),accountingStatus:'complete'};});
  const response=await f.api.fetch(f.request());assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const reader=response.body.getReader(),decoder=new TextDecoder();let first='';
  while(!first.includes('preview')){const chunk=await reader.read();assert.equal(chunk.done,false);first+=decoder.decode(chunk.value);}
  assert.match(first,/山风/);assert.equal(f.settlement,null);release();let rest='';for(;;){const chunk=await reader.read();if(chunk.done)break;rest+=decoder.decode(chunk.value);}
  assert.match(rest,/"type":"result"/);assert.equal(f.calls,1);assert.equal(f.settlement.result.status,'ready');
  const replay=await f.api.fetch(f.request());assert.match(replay.headers.get('content-type'),/application\/json/);assert.equal((await replay.json()).status,'ready');assert.equal(f.calls,1);
});

test('a ready result retains unknown accounting without incorrectly marking Cloudflare quota exhausted',async()=>{
  const f=fixture(async(ai,p,c)=>({status:'ready',scene:scene(c),accountingStatus:'unknown',providerSource:'cloudflare'}));
  await(await f.api.fetch(f.request())).text();assert.equal(f.settlement.status,'unknown');assert.equal(f.settlement.quotaExhausted,false);
});

test('disconnecting the preview does not reopen the original attempt or skip final settlement',async()=>{
  let release;const held=new Promise(resolve=>release=resolve),f=fixture(async(ai,p,c)=>{await held;return {status:'ready',scene:scene(c),accountingStatus:'complete'};});
  const response=await f.api.fetch(f.request()),reader=response.body.getReader();await reader.read();await reader.cancel();release();
  for(let i=0;i<20&&!f.settlement;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.settlement?.result.status,'ready');const replay=await f.api.fetch(f.request());assert.equal((await replay.json()).status,'ready');assert.equal(f.calls,1);
});

test('unconfirmed settlement terminates SSE without a final result and cannot start another inference',async()=>{
  for(const settleFailure of ['throw','denied']){
    const f=fixture(async(ai,p,c)=>({status:'ready',scene:scene(c),accountingStatus:'complete'}),{settleFailure});
    const response=await f.api.fetch(f.request());await assert.rejects(response.text());
    const repeated=await(await f.api.fetch(f.request())).json();assert.equal(repeated.errorCode,'ATTEMPT_IN_PROGRESS');assert.equal(f.calls,1);
    const legacy=fixture(async(ai,p,c)=>({status:'ready',scene:scene(c),accountingStatus:'complete'}),{settleFailure}),request=legacy.request();request.headers.set('accept','application/json');
    assert.equal((await(await legacy.api.fetch(request)).json()).errorCode,'BUDGET_UNAVAILABLE');
  }
});

test('browser receives incremental preview/reset events and only resolves the matching final envelope',async()=>{
  const events=[];let sink,finished=false;const encode=new TextEncoder();
  const f=fixture(()=>{});
  const client=createStoryClient({location:{protocol:'https:'},fetch:async(path,options)=>{assert.match(options.headers.Accept,/text\/event-stream/);return new Response(new ReadableStream({start(controller){sink=controller;}}),{headers:{'content-type':'text/event-stream'}});}});
  const packet=value=>sink.enqueue(encode.encode('data: '+JSON.stringify({protocolVersion:1,requestId:f.pending.identity.requestId,attemptId:f.attempt.id,sessionRef:f.attempt.sessionRef,...value})+'\n\n'));
  const pending=client.requestTurn(f.pending,f.context,f.attempt,{onProgress:event=>events.push(event)}).then(result=>{finished=true;return result;});
  pending.catch(()=>{});
  await new Promise(resolve=>setImmediate(resolve));packet({type:'preview',text:'山风'});await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);assert.deepEqual(events,[{type:'preview',text:'山风'}]);
  packet({type:'reset'});packet({type:'preview',text:'新故事'});
  const result={protocolVersion:1,status:'ready',errorCode:null,requestId:f.pending.identity.requestId,attemptId:f.attempt.id,sessionRef:f.attempt.sessionRef,scene:scene(f.context),retry:null};
  packet({type:'result',result});sink.close();assert.deepEqual(await pending,result);assert.deepEqual(events.slice(1),[{type:'reset'},{type:'preview',text:'新故事'}]);
});

test('an interrupted or foreign-attempt SSE response cannot return a ready turn',async()=>{
  const f=fixture(()=>{}),encode=new TextEncoder();
  for(const foreign of [false,true]){
    const client=createStoryClient({location:{protocol:'https:'},fetch:async()=>new Response(encode.encode('data: '+JSON.stringify({protocolVersion:1,type:'preview',text:'未完成',requestId:f.pending.identity.requestId,attemptId:foreign?'other':f.attempt.id,sessionRef:f.attempt.sessionRef})+'\n\n'),{headers:{'content-type':'text/event-stream'}})});
    await assert.rejects(client.requestTurn(f.pending,f.context,f.attempt,{onProgress(){}}),{code:foreign?'RESPONSE_IDENTITY_MISMATCH':'NETWORK_UNAVAILABLE'});
  }
});

test('account queue status reaches the browser through SSE before a saved result',async()=>{
  const events=[],f=fixture(async(ai,p,c,o,r)=>{r.onProgress({type:'status',status:'queued'});return {status:'ready',scene:scene(c),accountingStatus:'complete'};});
  const client=createStoryClient({location:{protocol:'https:'},fetch:(path,options)=>{const request=f.request();if(options.headers['X-Story-Queue-Status'])request.headers.set('X-Story-Queue-Status',options.headers['X-Story-Queue-Status']);return f.api.fetch(request);}});
  const result=await client.requestTurn(f.pending,f.context,f.attempt,{onProgress:e=>events.push(e)});
  assert.equal(result.status,'ready');assert.ok(events.some(e=>e.type==='status'&&e.status==='queued'));
});

test('older SSE clients receive a compatible generating status while queued',async()=>{
  const f=fixture(async(ai,p,c,o,r)=>{r.onProgress({type:'status',status:'queued'});return {status:'ready',scene:scene(c),accountingStatus:'complete'};});
  const wire=await(await f.api.fetch(f.request())).text();assert.doesNotMatch(wire,/"status":"queued"/);assert.match(wire,/"status":"generating"/);
});

test('a reservation arriving beyond the shared deadline settles without starting inference',async t=>{
  let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const f=fixture(async(ai,p,c)=>({status:'ready',scene:scene(c),accountingStatus:'complete'}),{onReserve:()=>clock+=90001});
  const client=createStoryClient({location:{protocol:'https:'},fetch:()=>f.api.fetch(f.request())});
  const result=await client.requestTurn(f.pending,f.context,f.attempt,{onProgress(){}});
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'PROVIDER_TIMEOUT');assert.equal(f.calls,0);assert.equal(f.settlement.status,'unknown');
});

test('many tiny previews fit the bounded browser stream and the final result version is checked',async()=>{
  const f=fixture(async(ai,p,c,o,r)=>{for(let i=1;i<=1300;i++)r.onProgress({type:'preview',text:'山'.repeat(i)});return {status:'ready',scene:scene(c),accountingStatus:'complete'};},{longIds:true});
  const response=await f.api.fetch(f.request()),bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.length<262144);
  const client=createStoryClient({location:{protocol:'https:'},fetch:async()=>new Response(bytes,{headers:{'content-type':'text/event-stream'}})});
  assert.equal((await client.requestTurn(f.pending,f.context,f.attempt,{onProgress(){}})).status,'ready');
  const invalid=JSON.parse(new TextDecoder().decode(bytes).trim().split('\n\n').at(-1).slice(6));invalid.result.protocolVersion=999;
  const bad=createStoryClient({location:{protocol:'https:'},fetch:async()=>new Response('data: '+JSON.stringify(invalid)+'\n\n',{headers:{'content-type':'text/event-stream'}})});
  await assert.rejects(bad.requestTurn(f.pending,f.context,f.attempt,{onProgress(){}}),{code:'PROTOCOL_MISMATCH'});
});
