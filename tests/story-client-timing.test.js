import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryClient} from '../src/ui/story-client.js';
import {STORY_API_LIMITS} from '../src/worker/story-api.js';
import {STORY_LIMITS} from '../src/worker/story-config.js';
import {BUDGET_LIMITS} from '../src/worker/story-budget.js';

const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});

test('browser receives a real-latency generation after the former thirty-second abort',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const pending={identity:{requestId:'request'}},attempt={id:'attempt',sessionRef:'session'};
  const ready={protocolVersion:1,status:'ready',errorCode:null,requestId:'request',attemptId:'attempt',sessionRef:'session',scene:{title:'下一幕'},retry:null};
  const client=createStoryClient({location:{protocol:'https:'},fetch:(path,options)=>{
    if(path.endsWith('/capabilities'))return Promise.resolve(json({protocolVersion:1,available:true,status:'ready',errorCode:null,limits:{maxRequestBytes:32768,maxResponseBytes:65536,maxContextBytes:7000,timeoutMs:75000}}));
    return new Promise((resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
      setTimeout(()=>resolve(json(ready)),35000);
    });
  }});
  assert.equal((await client.capabilities()).available,true);
  const response=client.requestTurn(pending,{},attempt);
  t.mock.timers.tick(35000);
  assert.deepEqual(await response,ready);
});

test('transport and active-attempt lease outlast the provider deadline and settlement',()=>{
  assert.ok(STORY_API_LIMITS.timeoutMs>=STORY_LIMITS.timeoutMs+15000);
  assert.ok(BUDGET_LIMITS.pendingMs>STORY_API_LIMITS.timeoutMs);
});
