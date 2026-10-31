import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlmTransport} from '../src/worker/story-glm-provider.js';
import {generateScene} from '../src/worker/story-provider.js';
import {GLM_MODEL_ID,GLM_PROFILE,STORY_LIMITS} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {capturedStoryWire} from './helpers/story-choice-captured.js';

const enc=new TextEncoder(),done=enc.encode('data: [DONE]\r\n\r\n'),usage={prompt_tokens:400,completion_tokens:1300,total_tokens:1700};
const envelope={id:'chatcmpl-2722947a6dd44b6b8cd4b77ab45ebfef',object:'chat.completion.chunk',created:1793430000,model:GLM_MODEL_ID,system_fingerprint:'fp_a6417e95b2'};
const packet=(part,last=false)=>enc.encode('data: '+JSON.stringify({...envelope,choices:[{index:0,delta:last?{}:{content:part},logprobs:null,finish_reason:last?'stop':null}],usage:last?usage:null})+'\r\n\r\n');
function binding(frames){
  let calls=0,reads=0;
  return {get calls(){return calls;},get reads(){return reads;},run(){calls++;return new ReadableStream({pull(c){if(reads===frames.length)c.close();else c.enqueue(frames[reads++]);}});}};
}
const raw=ai=>createGlmTransport({ai}).run(GLM_MODEL_ID,{max_tokens:STORY_LIMITS.maxOutputTokens});

test('the same completed v7 response is playable when legitimate per-token SSE envelopes exceed 256 KiB',async()=>{
  const state=createLiveGame({runId:'transport-envelope',engineVersion:7,seed:42}),pending=prepareOpening(state,{requestId:'open'}),context=buildStoryContext(state,pending);
  const wire=capturedStoryWire();
  wire.blocks[0].text+='陶罐旁的灯影落在石上。'.repeat(45).slice(0,1163-Array.from(JSON.stringify(wire)).length);
  const chars=Array.from(JSON.stringify(wire));assert.equal(chars.length,1163);
  const results=[];
  for(const width of [3,1]){
    const frames=[];
    for(let i=0;i<chars.length;i+=width)frames.push(packet(chars.slice(i,i+width).join('')));
    frames.push(packet('',true),done);
    const bytes=frames.reduce((sum,f)=>sum+f.byteLength,0);
    assert.equal(bytes>256*1024,width===1);assert.ok(Math.max(...frames.map(f=>f.byteLength))<400);
    const ai=binding(frames),profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true};
    const result=await generateScene(ai,profile,context,{}, {storyActions:true});
    assert.equal(ai.calls,1);assert.equal(result.status,'ready',result.errorCode);
    assert.deepEqual(result.usage,{promptTokens:400,completionTokens:1300,totalTokens:1700});
    assert.deepEqual(result.scene.blocks,wire.blocks);assert.equal(result.scene.choices.length,3);
    results.push(commitTurn(state,pending,result.scene));
  }
  assert.deepEqual(results[0],results[1]);
});

test('one large network read may contain many independently bounded UTF-8 events',async()=>{
  const frames=[...Array(1450).fill(packet('山')),packet('',true),done],joined=Buffer.concat(frames);
  assert.ok(joined.length>400*1024);
  const ai=binding([joined.buffer.slice(joined.byteOffset,joined.byteOffset+joined.byteLength)]);
  const out=await raw(ai);assert.equal(out.choices[0].message.content,'山'.repeat(1450));assert.equal(ai.calls,1);
});

test('decoded content has its own exact UTF-8 ceiling, including a surrogate pair split between deltas',async()=>{
  const prefix='a'.repeat(STORY_LIMITS.maxResponseBytes-4),parts=[packet(prefix+'\ud83d'),packet('\udc7f'),packet('',true),done];
  const ai=binding(parts),out=await raw(ai);assert.equal(ai.calls,1);assert.equal(out.choices[0].message.content,prefix+'👿');
  const excessive=binding([packet(prefix+'👿x'),packet('',true),done]);await assert.rejects(raw(excessive),{code:'PROVIDER_RESPONSE_TOO_LARGE'});assert.equal(excessive.calls,1);
});

test('control and tiny events cannot avoid the frame, unterminated frame or total transport bounds',async()=>{
  const final=[packet('ok'),packet('',true),done];
  for(const [name,frames] of [
    ['comment flood',[...Array(5000).fill(enc.encode(': ping\n\n')),...final]],
    ['empty delta flood',[...Array(5000).fill(packet('')),...final]],
    ['large unterminated event',[...Array(510).fill(enc.encode('x'.repeat(1024))),enc.encode('\n\n'),...final]],
    ['excess cumulative metadata',[...Array(2000).fill(enc.encode(': '+'x'.repeat(2050)+'\n\n')),...final]],
  ]){
    const ai=binding(frames);
    await assert.rejects(raw(ai),{code:'PROVIDER_RESPONSE_TOO_LARGE'},name);assert.equal(ai.calls,1);
    assert.ok(ai.reads<frames.length,name+' stops without reading the rest of the stream');
  }
});

test('zero-byte reads cannot keep a provider operation busy until its wall-clock timeout',async()=>{
  const frames=[...Array(100).fill(new Uint8Array()),packet('ok'),packet('',true),done],ai=binding(frames);
  await assert.rejects(raw(ai),{code:'PROVIDER_RESPONSE_INVALID'});assert.ok(ai.reads<frames.length);assert.equal(ai.calls,1);
});
