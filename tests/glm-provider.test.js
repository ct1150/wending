import test from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../src/worker/story-config.js';
import {generateScene} from '../src/worker/story-provider.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
const previewModule=await import('../src/game/cultivation/live/story-preview.js').catch(()=>null);
const context=()=>{const state=createLiveGame({runId:'glm-fixture-run',seed:42});return buildStoryContext(state,prepareOpening(state,{requestId:'glm-opening'}));};
const scene=c=>({id:c.namespace+':t1:s:scene',title:'山风',location:'山下',entities:[],blocks:[{kind:'narration',text:'山风拂过，你望向远山。'}],choices:[{id:c.namespace+':t1:c:a',label:'歇息调养（谨慎）',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:c.namespace+':t1:c:b',label:'凝神修行（谨慎）',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]});
const profile=()=>({...config.GLM_PROFILE,validated:true,supportsStructuredOutput:true,validationEvidence:'test-fixture-only'});
const encode=new TextEncoder();
const wireScene=value=>value?.id?{...Object.fromEntries(Object.entries(value).filter(([key])=>!['id','entities','choices'].includes(key))),...Object.fromEntries([['otherPeople','person'],['places','place'],['factions','faction']].map(([field,kind])=>[field,value.entities.filter(entity=>entity.kind===kind).map(({kind,...entity})=>entity)])),choices:value.choices.map(choice=>({action:choice.intent+':'+choice.approach,targetId:choice.targetId,stake:choice.stake}))}:value;
function stream(value,{model=config.GLM_MODEL_ID,usage={prompt_tokens:100,completion_tokens:80,total_tokens:180},finish='stop',reasoning}={}){
  const content=typeof value==='string'?value:JSON.stringify(wireScene(value));
  const frames=[{model,choices:[{delta:{content:content.slice(0,Math.floor(content.length/2)),...(reasoning?{reasoning_content:reasoning}:{})}}]},{model,choices:[{delta:{content:content.slice(Math.floor(content.length/2))},finish_reason:finish}]},...(usage?[{choices:[],usage}]:[])];
  const bytes=encode.encode(frames.map(x=>'data: '+JSON.stringify(x)+'\r\n\r\n').join('')+'data: [DONE]\r\n\r\n');let offset=0;
  return new ReadableStream({pull(controller){if(offset>=bytes.length)return controller.close();controller.enqueue(bytes.slice(offset,offset+7));offset+=7;}});
}

test('GLM is a separate unpromoted candidate, preserving the real Qwen release profile',()=>{
  assert.equal(config.GLM_MODEL_ID,'@cf/zai-org/glm-4.7-flash');
  assert.equal(config.DEFAULT_STORY_MODEL_ID,config.GLM_MODEL_ID);
  assert.equal(config.CANDIDATE_MODEL_ID,'@cf/qwen/qwen3.8-27b');
  assert.equal(config.GLM_PROFILE.validated,false);
  assert.equal(config.PRODUCTION_PROFILES.find(p=>p.modelId===config.CANDIDATE_MODEL_ID).validationEvidence,'docs/evidence/realtime-release-2026-10-28.json');
  assert.equal(config.PRODUCTION_PROFILES.some(p=>p.modelId===config.GLM_MODEL_ID&&p.validated),false);
});

test('partial JSON preview decodes only blocks text, including split escapes and Unicode',()=>{
  assert.equal(typeof previewModule?.readStoryPreview,'function');
  const read=previewModule.readStoryPreview;
  assert.equal(read('{"title":"不要显示","entities":[{"name":"故人"}],"blocks":[{"kind":"narration","text":"山风\\n吹过\\u4e91'),'山风\n吹过云');
  assert.equal(read('{"blocks":[{"text":"你说：\\"走吧\\"。"},{"text":"第二段'), '你说："走吧"。\n\n第二段');
  assert.equal(read('{"entities":[{"text":"不能显示"}],"choices":[{"text":"也不能显示"}]}'),'');
  assert.equal(read('{"blocks":[{"text":"山风\\u4e'),'山风');
});

test('GLM streams real narrative before completion and still uses final scene validation',async()=>{
  const c=context(),value=scene(c),progress=[];let complete=false,finish;
  const held=new Promise(resolve=>finish=resolve);
  const ai={async run(model,input){assert.equal(model,config.GLM_MODEL_ID);assert.equal(input.stream,true);assert.equal(input.response_format,undefined);assert.equal(input.chat_template_kwargs.enable_thinking,false);assert.match(input.messages[0].content,/memoryDeltas/);const source=stream(value).getReader();return new ReadableStream({async pull(controller){const item=await source.read();if(item.done){await held;controller.close();}else controller.enqueue(item.value);}});}};
  const pending=generateScene(ai,profile(),c,{}, {onProgress:event=>progress.push(event)}).then(result=>{complete=true;return result;});
  while(!complete&&!progress.some(e=>e.type==='preview'&&e.text.includes('山风')))await new Promise(resolve=>setImmediate(resolve));
  const previewArrived=progress.some(e=>e.type==='preview'&&e.text.includes('山风')),finishedBeforePreview=complete;
  finish();const result=await pending;assert.equal(previewArrived,true);assert.equal(finishedBeforePreview,false);
  assert.equal(result.status,'ready');assert.deepEqual(result.scene,value);assert.equal(result.nonThinkingValidated,true);assert.equal(result.stopReason,'stop');
});

test('the fixed free Zhipu primary streams with server-only credentials without calling Cloudflare',async()=>{
  const c=context(),events=[];let primary=0,backup=0;
  const result=await generateScene({async run(){primary++;throw new Error('4006: private provider error');}},profile(),c,{}, {apiKey:'fixture-private-key',onProgress:e=>events.push(e),fetch:async(url,options)=>{
    backup++;assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(options.headers.Authorization,'Bearer fixture-private-key');assert.equal(options.redirect,'manual');
    const input=JSON.parse(options.body);assert.equal(input.model,'glm-4.7-flash');assert.equal(input.thinking.type,'disabled');assert.equal(input.stream,true);assert.equal(input.response_format.type,'json_object');
    return new Response(stream(scene(c),{model:'glm-4.7-flash'}),{headers:{'content-type':'text/event-stream'}});
  }});
  assert.equal(result.status,'ready');assert.equal(primary,0);assert.equal(backup,1);assert.equal(result.providerSource,'zhipu');assert.equal(events.some(e=>e.type==='reset'),false);
  assert.doesNotMatch(JSON.stringify({result,events}),/fixture-private-key|private provider error/);
});

test('missing backup credentials preserve the provider pause without making external requests',async()=>{
  let backup=0;
  const result=await generateScene({async run(){throw Object.assign(Error('private'),{code:4006});}},profile(),context(),{}, {fetch:async()=>{backup++;throw Error('must not fetch');}});
  assert.equal(result.status,'paused');assert.equal(result.errorCode,'FREE_QUOTA_EXHAUSTED');assert.equal(backup,0);
});

test('a Zhipu HTTP 429 switches once to Cloudflare and resets the provisional text',async()=>{
  const c=context(),calls=[],events=[];
  const result=await generateScene({run:async(model,input)=>{calls.push('cloudflare');assert.equal(model,config.GLM_MODEL_ID);assert.equal(input.stream,true);return stream(scene(c));}},profile(),c,{}, {apiKey:'fixture-key',onProgress:e=>events.push(e),fetch:async()=>{calls.push('zhipu');return new Response(JSON.stringify({error:{code:'1305'}}),{status:429});}});
  assert.equal(result.status,'ready');assert.deepEqual(calls,['zhipu','cloudflare']);assert.equal(result.providerSource,'cloudflare');assert.ok(events.some(e=>e.type==='reset'));
});

test('a Zhipu server failure can use Cloudflare without claiming its unknown cost is complete',async()=>{
  const c=context();let backup=0;
  const result=await generateScene({run:async()=>{backup++;return stream(scene(c));}},profile(),c,{}, {apiKey:'fixture-key',fetch:async()=>new Response('Unavailable',{status:503})});
  assert.equal(result.status,'ready');assert.equal(backup,1);assert.equal(result.accountingStatus,'unknown');
});

test('primary timeout resets partial text and ignores late completion after a successful backup',async()=>{
  const c=context(),events=[];let primarySink;
  const result=await generateScene({run:async()=>stream(scene(c))},profile(),c,{timeoutMs:1000},{apiKey:'fixture-key',primaryTimeoutMs:20,onProgress:event=>events.push(event),fetch:async()=>new Response(new ReadableStream({start(controller){primarySink=controller;controller.enqueue(encode.encode('data: '+JSON.stringify({model:'glm-4.7-flash',choices:[{delta:{content:'{"blocks":[{"text":"旧正文'}}]})+'\n\n'));}}),{headers:{'content-type':'text/event-stream'}})});
  assert.equal(result.status,'ready');assert.equal(result.accountingStatus,'unknown');assert.ok(events.findIndex(e=>e.type==='preview')<events.findIndex(e=>e.type==='reset'));
  const before=structuredClone(events);try{primarySink.enqueue(encode.encode('late'));}catch{}await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,before);
});

test('an unpromoted GLM profile cannot invoke inference',async()=>{
  let calls=0;const result=await generateScene({run:async()=>{calls++;}},config.GLM_PROFILE,context());assert.equal(result.errorCode,'MODEL_UNVALIDATED');assert.equal(calls,0);
});

test('GLM options are validated before reading accessors or starting a provider',async()=>{
  let calls=0,reads=0;const ai={run:async()=>{calls++;}},accessor={};Object.defineProperty(accessor,'timeoutMs',{enumerable:true,get(){reads++;return 1000;}});
  for(const options of [null,accessor]){const result=await generateScene(ai,profile(),context(),options);assert.equal(result.status,'rejected');assert.equal(result.inferencePerformed,false);}
  assert.equal(calls,0);assert.equal(reads,0);
});

test('partial primary failures and missing usage keep conservative unknown accounting',async()=>{
  const c=context(),frames=[{model:config.GLM_MODEL_ID,choices:[{delta:{content:'{"blocks":[{"text":"旧正文'}}]},{error:{code:429}}];
  for(const missingUsage of [false,true]){
    const ai={run:async()=>missingUsage?stream(scene(c),{usage:null}):new ReadableStream({start(s){s.enqueue(encode.encode(frames.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')));s.close();}})};
    const result=await generateScene(missingUsage?ai:{run:async()=>stream(scene(c))},profile(),c,{}, missingUsage?{}:{apiKey:'fixture-key',fetch:async()=>new Response(new ReadableStream({start(s){s.enqueue(encode.encode(frames.map(x=>({...x,...(x.model?{model:'glm-4.7-flash'}:{})})).map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')));s.close();}}),{headers:{'content-type':'text/event-stream'}})});
    assert.equal(result.accountingStatus,'unknown');assert.equal(result.status,missingUsage?'rejected':'ready');
  }
});

test('a Cloudflare fallback stream that fails after output stays unknown',async()=>{
  const text=[{model:config.GLM_MODEL_ID,choices:[{delta:{content:'{"blocks":[{"text":"旧正文'}}]},{error:{code:429}}].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('');
  const result=await generateScene({run:async()=>new Response(text).body},profile(),context());assert.equal(result.status,'paused');assert.equal(result.accountingStatus,'unknown');
});

test('both services failing stop after one fallback and never send the Zhipu key to Cloudflare',async()=>{
  const calls=[];
  const result=await generateScene({run:async(model,input)=>{calls.push('cloudflare');assert.doesNotMatch(JSON.stringify(input),/fixture-private-key/);throw Object.assign(Error('quota'),{code:4006});}},profile(),context(),{}, {apiKey:'fixture-private-key',fetch:async()=>{calls.push('zhipu');return new Response('busy',{status:429});}});
  assert.deepEqual(calls,['zhipu','cloudflare']);assert.equal(result.status,'paused');assert.equal(result.errorCode,'FREE_QUOTA_EXHAUSTED');assert.equal(result.accountingStatus,'complete');
});

test('an invalid Zhipu scene or reasoning is rejected without silently rerolling on Cloudflare',async()=>{
  for(const [value,settings]of [[{invalid:true},{}],[scene(context()),{reasoning:'private reasoning'}]]){
    let cloudflare=0;
    const result=await generateScene({run:async()=>{cloudflare++;}},profile(),context(),{}, {apiKey:'fixture-key',fetch:async()=>new Response(stream(value,{...settings,model:'glm-4.7-flash'}),{headers:{'content-type':'text/event-stream'}})});
    assert.equal(result.status,'rejected');assert.equal(cloudflare,0);
  }
});

test('invalid JSON frame shapes and conflicting terminal markers cannot become a fallback success',async()=>{
  const c=context(),content={model:'glm-4.7-flash',choices:[{delta:{content:JSON.stringify(wireScene(scene(c)))},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
  for(const frames of [[null],[[]],[{...content,choices:[null]}],[{...content,choices:[{delta:{content:JSON.stringify(wireScene(scene(c)))},finish_reason:'length'}]},content]]){
    let fallback=0;
    const text=frames.map(frame=>'data: '+JSON.stringify(frame)+'\n\n').join('')+'data: [DONE]\n\n';
    const result=await generateScene({run:async()=>{fallback++;return stream(scene(c));}},profile(),c,{}, {apiKey:'fixture-key',fetch:async()=>new Response(text,{headers:{'content-type':'text/event-stream'}})});
    assert.equal(result.status,'rejected');assert.equal(result.errorCode,'PROVIDER_RESPONSE_INVALID');assert.equal(fallback,0);
  }
});

test('thinking aliases, think tags, absent model identity and data after DONE are rejected',async()=>{
  const c=context(),normal={model:config.GLM_MODEL_ID,choices:[{delta:{content:JSON.stringify(wireScene(scene(c)))},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
  const think=scene(c);think.blocks[0].text='<think>秘密推理</think>山风。';
  for(const frames of [[{...normal,choices:[{...normal.choices[0],delta:{...normal.choices[0].delta,reasoning_details:[{text:'秘密推理'}]}}]}],[{...normal,choices:[{...normal.choices[0],delta:{content:JSON.stringify(wireScene(think))}}]}],[{...normal,model:undefined}],[normal,'[DONE]',normal]]){
    const events=[];let backup=0;
    const text=frames.map(x=>'data: '+(typeof x==='string'?x:JSON.stringify(x))+'\n\n').join('')+'data: [DONE]\n\n';
    const result=await generateScene({run:async()=>new Response(text).body},profile(),c,{}, {onProgress:e=>events.push(e),fetch:async()=>{backup++;}});
    assert.equal(result.status,'rejected');assert.equal(backup,0);assert.doesNotMatch(JSON.stringify(events),/秘密推理/);
  }
});

test('invalid scenes, reasoning, truncation and wrong models never trigger another generation',async()=>{
  const c=context();
  for(const [value,settings]of [[{invalid:true},{}],[scene(c),{reasoning:'private reasoning'}],[scene(c),{finish:'length'}],[scene(c),{model:'some-other-model'}],[scene(c),{usage:null}]]){
    let backup=0;const events=[];
    const result=await generateScene({run:async()=>stream(value,settings)},profile(),c,{}, {onProgress:e=>events.push(e),fetch:async()=>{backup++;throw Error('must not fetch');}});
    assert.equal(result.status,'rejected');assert.equal(backup,0);assert.doesNotMatch(JSON.stringify(events),/private reasoning/);
  }
});
