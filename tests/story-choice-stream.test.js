import test from 'node:test';
import assert from 'node:assert/strict';
import * as preview from '../src/game/cultivation/live/story-preview.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {generateScene} from '../src/worker/story-provider.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createStoryApi} from '../src/worker/story-api.js';
import {createStoryClient} from '../src/ui/story-client.js';

const encoder=new TextEncoder(),tick=()=>new Promise(resolve=>setImmediate(resolve));
const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true,validationEvidence:'test-fixture-only'};
const actor={kind:'person',name:'陈叔',ref:'',status:null};
function fixture(){
  const state=createLiveGame({runId:'choice-stream',seed:42}),pending=prepareOpening(state,{requestId:'choice-stream-open'}),context=buildStoryContext(state,pending);
  const wire={blocks:[{kind:'narration',text:'陈叔站在林边，指向传来哭声的树林。'},{kind:'dialogue',speaker:actor,text:'有人困在林子里，你愿意先听清情况吗？'}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'哭声里夹着几个人的回音',anchor:0},{action:'interact:decline',target:actor,stake:'low',purpose:'不接下林中的求助，留在路边',anchor:1}],title:'林边哭声',location:'林边',memoryDeltas:[]};
  return {state,pending,context,wire};
}
const frame=content=>encoder.encode('data: '+JSON.stringify({model:GLM_MODEL_ID,choices:[{delta:{content}}]})+'\n\n');
const ending=()=>encoder.encode('data: '+JSON.stringify({model:GLM_MODEL_ID,choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:180,total_tokens:280}})+'\n\ndata: [DONE]\n\n');
function run(wire,context){return generateProviderScene({run:async()=>({model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:180,total_tokens:280}})},{...profile,storyActions:true},context);}

test('partial presentation keeps dialogue identity and streams only model choice display text',()=>{
  assert.equal(typeof preview.readStoryPresentation,'function');
  const {wire,context}=fixture(),source=JSON.stringify(wire),end=source.indexOf('哭声里夹着')+'哭声里夹着'.length;
  const result=preview.readStoryPresentation(source.slice(0,end),context);
  assert.deepEqual(result.blocks,[{kind:'narration',text:'陈叔站在林边，指向传来哭声的树林。',complete:true},{kind:'dialogue',speaker:'陈叔',text:'有人困在林子里，你愿意先听清情况吗？',complete:true}]);
  assert.deepEqual(result.choices,[{label:'询问陈叔：哭声里夹着',complete:false}]);
  assert.doesNotMatch(JSON.stringify(result),/target|ref|stake|anchor|memoryDeltas/);
  const full=preview.readStoryPresentation(source,context);
  assert.deepEqual(full.choices,[{label:'询问陈叔：哭声里夹着几个人的回音',complete:true},{label:'婉拒陈叔：不接下林中的求助，留在路边',complete:true}]);
});

test('structured JSON prefixes preserve escaped prose and never expose nested metadata',()=>{
  const {context}=fixture(),wire={blocks:[{kind:'dialogue',speaker:actor,text:'你听见“求救”二字，树影🌲摇动。\n他低声说："先听清楚。"'}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'哭声是否从树影🌲后传来',anchor:0}],title:'隐藏标题',memoryDeltas:[{text:'不能流出的记忆'}]};
  const source=JSON.stringify(wire),expected='询问陈叔：哭声是否从树影🌲后传来';
  for(let length=0;length<=source.length;length++){
    const draft=preview.readStoryPresentation(source.slice(0,length),context);
    for(const block of draft.blocks){assert.equal(block.kind,'dialogue');assert.equal(block.speaker,'陈叔');assert.ok(wire.blocks[0].text.startsWith(block.text));assert.equal(/[\ud800-\udbff]$/u.test(block.text),false);}
    for(const choice of draft.choices){assert.ok(expected.startsWith(choice.label));assert.equal(/[\ud800-\udbff]$/u.test(choice.label),false);}
    assert.doesNotMatch(JSON.stringify(draft),/隐藏标题|不能流出的记忆/);
  }
  assert.deepEqual(preview.readStoryPresentation('{"nested":{"blocks":[{"kind":"narration","text":"秘密"}]}}'),{blocks:[],choices:[]});
  assert.deepEqual(preview.readStoryPresentation('x'.repeat(65537)),{blocks:[],choices:[]});
  const escaped='{"blocks":[{"kind":"narration","text":"山风\\u4e';
  assert.equal(preview.readStoryPresentation(escaped).blocks[0].text,'山风');
  assert.equal(preview.readStoryPresentation(escaped+'91').blocks[0].text,'山风云');
});

test('real GLM choice text arrives before the rest of its JSON and matches the verified scene',async()=>{
  const {wire,context}=fixture(),source=JSON.stringify(wire),end=source.indexOf('哭声里夹着')+'哭声里夹着'.length,events=[];
  let sink,finished=false;
  const ai={run:async()=>new ReadableStream({start(controller){sink=controller;}})};
  const work=generateScene(ai,profile,context,{}, {storyActions:true,onProgress:event=>events.push(event)}).then(result=>{finished=true;return result;});
  await tick();sink.enqueue(frame(source.slice(0,end)));await tick();
  const before=events.filter(event=>event.type==='presentation').at(-1),premature=finished;
  sink.enqueue(frame(source.slice(end)));sink.enqueue(ending());sink.close();
  const result=await work;
  assert.equal(premature,false);
  assert.equal(before?.choices[0]?.label,'询问陈叔：哭声里夹着');
  assert.equal(before.choices[0].complete,false);
  assert.equal(result.status,'ready');
  const final=events.filter(event=>event.type==='presentation').at(-1);
  assert.deepEqual(final.choices.map(choice=>choice.label),result.scene.choices.map(choice=>choice.label));
  assert.ok(final.choices.every(choice=>choice.complete));
  assert.equal(final.blocks[1].speaker,result.scene.entities.find(entity=>entity.id===result.scene.blocks[1].speaker).name);
});

test('modern model menus cannot be replaced by invented generic exit or observation choices',async()=>{
  const {wire,context}=fixture(),noExit=structuredClone(wire),onlyExit=structuredClone(wire);
  noExit.choices[1]={action:'interact:observe',target:'self',stake:'low',purpose:'辨认树林中传来的哭声',anchor:0};
  onlyExit.choices[0]={action:'interact:leave',target:actor,stake:'low',purpose:'结束关于林中哭声的交谈',anchor:0};
  for(const invalid of [noExit,onlyExit]){
    const result=await run(invalid,context);
    assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(result.scene,undefined);
  }
  const valid=await run(wire,context);assert.equal(valid.status,'ready');assert.equal(valid.scene.choices.length,2);
  assert.deepEqual(valid.scene.choices.map(choice=>choice.id.split(':').at(-1)),['a','b']);
});

function apiFixture(provider){
  const f=fixture(),attempt={id:'choice-attempt',sessionRef:'choice-session',retryOf:null};let settled=null,calls=0;
  const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef:attempt.sessionRef};},async lookup(){return {code:'ATTEMPT_NOT_FOUND'};},async reserve(){return {kind:'reserved'};},async settle(value){settled=value;return {kind:'settled'};}};
  const api=createStoryApi({budget,config:{readiness:()=>profile},provider:async(...args)=>{calls++;return provider(...args);}});
  const request=modern=>new Request('https://choice.test/api/story/turn',{method:'POST',headers:{origin:'https://choice.test','content-type':'application/json',accept:'text/event-stream','X-Story-Actions':'1',...(modern?{'X-Story-Preview':'2'}:{}),cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context:f.context,attempt,storyActions:true})});
  return {...f,api,attempt,request,get settled(){return settled;},get calls(){return calls;}};
}
const packets=text=>text.trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));

test('structured SSE negotiates cumulative rows, clears on reset, and settles before result',async()=>{
  for(const modern of [false,true]){
    let f;
    f=apiFixture(async(ai,p,c,o,r)=>{
      r.onProgress({type:'preview',text:'旧正文'});
      r.onProgress({type:'presentation',blocks:[{kind:'narration',text:'旧正文',complete:false}],choices:[]});
      r.onProgress({type:'reset'});
      r.onProgress({type:'preview',text:'山风'});
      r.onProgress({type:'presentation',blocks:[{kind:'dialogue',speaker:'陈叔',text:'山风',complete:false}],choices:[]});
      const done={type:'presentation',blocks:[{kind:'dialogue',speaker:'陈叔',text:'山风吹过。',complete:true}],choices:[{label:'询问陈叔：哭声里夹着几个人的回音',complete:false}]};
      r.onProgress(done);r.onProgress(done);
      return run(f.wire,c);
    });
    const rows=packets(await(await f.api.fetch(f.request(modern))).text());
    assert.equal(f.settled.result.status,'ready');assert.equal(rows.at(-1).type,'result');
    assert.ok(rows.every(row=>row.protocolVersion===1&&row.requestId===f.pending.identity.requestId&&row.attemptId===f.attempt.id&&row.sessionRef===f.attempt.sessionRef));
    const content=rows.filter(row=>['block','choice','preview','reset'].includes(row.type));
    if(modern){
      assert.ok(content.some(row=>row.type==='block'&&row.text==='旧正文'));
      assert.ok(content.some(row=>row.type==='reset'));
      const choice=content.filter(row=>row.type==='choice');assert.equal(choice.length,1);assert.equal(choice[0].label,'询问陈叔：哭声里夹着几个人的回音');assert.equal(choice[0].index,0);
      assert.equal(content.filter(row=>row.type==='block').at(-1).text,'山风吹过。');
      assert.ok(content.every(row=>row.type!=='preview'));
      assert.doesNotMatch(JSON.stringify(content),/targetId|stake|effect|"id":/);
    }else{
      assert.ok(content.some(row=>row.type==='preview'));assert.ok(content.every(row=>!['block','choice'].includes(row.type)));
    }
  }
});

test('GLM through the actual API and browser exposes a partial choice before validation or settlement',async()=>{
  const f=apiFixture(generateScene),source=JSON.stringify(f.wire),end=source.indexOf('哭声里夹着')+'哭声里夹着'.length,events=[];
  let sink,start,showChoice,timeout,finished=false;
  const started=new Promise(resolve=>start=resolve),visible=new Promise(resolve=>showChoice=resolve);
  const ai={run:async()=>new ReadableStream({start(controller){sink=controller;start();}})};
  const client=createStoryClient({location:{protocol:'https:'},fetch:(path,options)=>f.api.fetch(new Request('https://choice.test'+path,{...options,headers:{...options.headers,origin:'https://choice.test',cookie:'__Host-story_session='+'a'.repeat(64)}}),{AI:ai})});
  const work=client.requestTurn(f.pending,f.context,f.attempt,{storyActions:true,onProgress:event=>{events.push(event);if(event.type==='choice')showChoice(event);}}).then(result=>{finished=true;return result;});
  await started;sink.enqueue(frame(source.slice(0,end)));
  const first=await Promise.race([visible,new Promise(resolve=>timeout=setTimeout(()=>resolve(null),1000))]);clearTimeout(timeout);
  const premature=finished,settledEarly=f.settled;
  sink.enqueue(frame(source.slice(end)));sink.enqueue(ending());sink.close();
  const result=await work;
  assert.equal(first?.label,'询问陈叔：哭声里夹着');assert.equal(first.complete,false);assert.equal(premature,false);assert.equal(settledEarly,null);
  assert.equal(result.status,'ready');assert.equal(f.calls,1);assert.equal(f.settled.result.status,'ready');
  assert.equal(events.some(event=>event.type==='preview'),false);
  const final=events.filter(event=>event.type==='choice'&&event.index===0).at(-1);
  assert.equal(final.label,result.scene.choices[0].label);assert.equal(final.complete,true);
});

test('a streamed model menu without an exit settles as rejected and never returns ready choices',async()=>{
  const f=apiFixture(generateScene);f.wire.choices[1]={action:'interact:observe',target:'self',stake:'low',purpose:'辨认树林中的哭声',anchor:0};
  const ai={run:async()=>new ReadableStream({start(controller){controller.enqueue(frame(JSON.stringify(f.wire)));controller.enqueue(ending());controller.close();}})};
  const result=packets(await(await f.api.fetch(f.request(true),{AI:ai})).text());
  assert.ok(result.some(event=>event.type==='choice'&&event.label==='仔细观察：辨认树林中的哭声'));
  assert.equal(result.at(-1).type,'result');assert.equal(result.at(-1).result.status,'rejected');assert.equal(result.at(-1).result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(result.at(-1).result.scene,undefined);
  assert.equal(f.settled.status,'complete');assert.equal(f.calls,1);
});
