import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryClient} from '../src/ui/story-client.js';
import {STORY_API_LIMITS} from '../src/worker/story-api.js';
import {STORY_LIMITS} from '../src/worker/story-config.js';
import {BUDGET_LIMITS} from '../src/worker/story-budget.js';

const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});

test('browser receives generation and settlement after the former seventy-five-second abort',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const pending={identity:{requestId:'request'}},attempt={id:'attempt',sessionRef:'session'};
  const ready={protocolVersion:1,status:'ready',errorCode:null,requestId:'request',attemptId:'attempt',sessionRef:'session',scene:{title:'下一幕'},retry:null};
  const client=createStoryClient({location:{protocol:'https:'},fetch:(path,options)=>{
    if(path.endsWith('/capabilities'))return Promise.resolve(json({protocolVersion:1,available:true,status:'ready',errorCode:null,limits:STORY_API_LIMITS}));
    return new Promise((resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
      setTimeout(()=>resolve(json(ready)),95000);
    });
  }});
  assert.equal((await client.capabilities()).available,true);
  const response=client.requestTurn(pending,{},attempt);
  t.mock.timers.tick(95000);
  assert.deepEqual(await response,ready);
});

test('browser transport remains bounded at 105 seconds without an automatic retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let calls=0,settled=false;
  const client=createStoryClient({location:{protocol:'https:'},fetch:(path,options)=>{
    calls++;
    if(path.endsWith('/capabilities'))return Promise.resolve(json({protocolVersion:1,available:true,status:'ready',errorCode:null,limits:STORY_API_LIMITS}));
    return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  }});
  assert.equal((await client.capabilities()).available,true);
  const response=client.requestTurn({identity:{requestId:'request'}},{},{id:'attempt',sessionRef:'session'});
  response.then(()=>{settled=true;},()=>{settled=true;});
  const rejected=assert.rejects(response,{code:'PROVIDER_TIMEOUT'});
  t.mock.timers.tick(104999);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false);assert.equal(calls,2);
  t.mock.timers.tick(1);await rejected;
  t.mock.timers.tick(120000);
  assert.equal(calls,2);
});

test('transport and active-attempt lease outlast the provider deadline and settlement',()=>{
  assert.equal(STORY_LIMITS.timeoutMs,90000);
  assert.equal(STORY_API_LIMITS.timeoutMs,105000);
  assert.equal(BUDGET_LIMITS.pendingMs,120000);
  assert.ok(STORY_API_LIMITS.timeoutMs>=STORY_LIMITS.timeoutMs+15000);
  assert.ok(BUDGET_LIMITS.pendingMs>=STORY_API_LIMITS.timeoutMs+15000);
});
