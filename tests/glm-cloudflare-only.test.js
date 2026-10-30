import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlmTransport} from '../src/worker/story-glm-provider.js';
import {GLM_MODEL_ID,GLM_PROVIDER_ROUTE} from '../src/worker/story-config.js';

const completion=()=>new Response('data: '+JSON.stringify({model:GLM_MODEL_ID,choices:[{delta:{content:'{"blocks":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})+'\n\ndata: [DONE]\n\n').body;

test('GLM declares Cloudflare as its only route',()=>{
  assert.deepEqual(GLM_PROVIDER_ROUTE,{primary:'cloudflare',primaryModelId:GLM_MODEL_ID});
});

test('existing Zhipu credentials and gates cannot divert a GLM request from Cloudflare',async()=>{
  const calls=[],events=[],input={messages:[{role:'user',content:'你好'}],stream:true};
  const transport=createGlmTransport({
    ai:{run:async(model,body)=>{calls.push('cloudflare');assert.equal(model,GLM_MODEL_ID);assert.equal(body,input);assert.doesNotMatch(JSON.stringify(body),/old-private-key/);return completion();}},
    apiKey:'old-private-key',
    fetch:async()=>{calls.push('external');throw Error('external transport forbidden');},
    providerGate:{acquireProvider:async()=>{calls.push('old-gate');throw Error('old gate forbidden');}},
    onProgress:event=>events.push(event),
  });
  assert.equal((await transport.run(GLM_MODEL_ID,input)).model,GLM_MODEL_ID);
  assert.deepEqual(calls,['cloudflare']);assert.equal(transport.source,'cloudflare');
  assert.equal(events.some(event=>event.type==='reset'||event.status==='switching'||event.status==='queued'),false);
});

test('Cloudflare quota exhaustion is surfaced once without any external fallback',async()=>{
  const calls=[];
  const transport=createGlmTransport({ai:{run:async()=>{calls.push('cloudflare');throw Object.assign(Error('4006: quota'),{code:4006});}},apiKey:'old-private-key',fetch:async()=>{calls.push('external');throw Error('external transport forbidden');}});
  await assert.rejects(transport.run(GLM_MODEL_ID,{stream:true}),error=>error.code===4006);
  assert.deepEqual(calls,['cloudflare']);assert.equal(transport.accountingUnknown,false);
});

test('expired Cloudflare deadline starts no inference',async()=>{
  let calls=0;
  const transport=createGlmTransport({ai:{run:async()=>{calls++;return completion();}},deadlineAt:Date.now()-1});
  await assert.rejects(transport.run(GLM_MODEL_ID,{stream:true}),error=>error.code==='PROVIDER_TIMEOUT');
  assert.equal(calls,0);
});

test('cancelling a Cloudflare call discards its late stream without another request or preview',async()=>{
  const controller=new AbortController(),events=[];let finish,calls=0,cancelled=false;
  const transport=createGlmTransport({ai:{run:()=>{calls++;return new Promise(resolve=>finish=resolve);}},signal:controller.signal,onProgress:event=>events.push(event)});
  const pending=transport.run(GLM_MODEL_ID,{stream:true});controller.abort();
  await assert.rejects(pending,error=>error.code==='PROVIDER_TIMEOUT');const before=structuredClone(events);
  finish(new ReadableStream({cancel(){cancelled=true;}}));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);assert.equal(cancelled,true);assert.deepEqual(events,before);
});
