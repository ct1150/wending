import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlmTransport} from '../src/worker/story-glm-provider.js';
import {createStoryApi} from '../src/worker/story-api.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

// Only this completed display row was observed in #119. Broken tails are
// synthetic controls, never used as supposed raw native response evidence.
const first={"kind": "narration", "text": "晨雾尚未散尽，村口的石碾旁围了几个人，正指指点点。你拨开人群，见一老者正对着一只被压扁的野兔发愁，那兔身虽碎，却隐隐透着股诡异的青色光泽。老者见你走近，浑浊的眼珠转了转，压低声音道：'小友，这兔子不是寻常猎物，是那'青鳞兽'的幼崽，昨夜才在林子里现了踪迹。'"};
const header='{"blocks":['+JSON.stringify(first),done='data: [DONE]\n\n';
const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true};
function stream(parts){
  const packet=item=>'data: '+JSON.stringify(item)+'\n\n';
  const frames=[...parts.map(v=>packet(typeof v==='string'?{model:GLM_MODEL_ID,choices:[{delta:{content:v}}]}:v)),packet({model:GLM_MODEL_ID,choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:200,completion_tokens:150,total_tokens:350}}),done];
  return new Response(frames.join('')).body;
}
function context(){const state=createLiveGame({runId:'stable-preview',seed:42,engineVersion:7});return buildStoryContext(state,prepareOpening(state,{requestId:'stable-opening'}));}
async function read(parts,engineMenu=true){
  const events=[];let calls=0;
  const transport=createGlmTransport({context:context(),engineMenu,onProgress:e=>events.push(e),ai:{run:async()=>{calls++;return stream(parts);}}});
  let raw,code;try{raw=await transport.run(GLM_MODEL_ID,{stream:true});}catch(e){code=e.code;}
  assert.equal(calls,1);return {events,raw,code};
}

test('a completed #119 block stays visible on the actual HTTP stream when an invalid tail cannot be committed',async()=>{
  assert.equal(Array.from(first.text).length,129);
  for(const structured of [true,false]){
    let settled=null,calls=0;const sessionRef='preview-session';
    const budget={async admit(){return {kind:'allowed'};},async getSession(){return {kind:'session',sessionRef};},async lookup(){return {code:'ATTEMPT_NOT_FOUND'};},async reserve(){return {kind:'reserved'};},async settle(value){settled=value;return {kind:'settled'};}};
    const api=createStoryApi({budget,config:{readiness:()=>profile}}),ctx=context();
    const request=new Request('https://preview.test/api/story/turn',{method:'POST',headers:{origin:'https://preview.test','content-type':'application/json',accept:'text/event-stream','X-Story-Actions':'1',...(structured?{'X-Story-Preview':'2'}:{}),cookie:'__Host-story_session='+'a'.repeat(64)},body:JSON.stringify({context:ctx,attempt:{id:'preview-attempt',sessionRef,retryOf:null},storyActions:true})});
    const response=await api.fetch(request,{AI:{run:async()=>{calls++;return stream([header+']}',' {"blocks":[{"kind":"narration","text":"不得从第二份文档中换入这段正文。"}]}']);}}});
    const rows=(await response.text()).trim().split('\n\n').map(p=>JSON.parse(p.slice(6)));
    assert.equal(calls,1);assert.equal(rows.at(-1).type,'result');assert.equal(rows.at(-1).result.status,'rejected');assert.equal(settled.result.scene,undefined);
    assert.ok(rows.some(e=>structured?e.type==='block'&&e.index===0&&e.complete&&e.text===first.text:e.type==='preview'&&e.text===first.text));
    assert.equal(rows.some(e=>e.type==='reset'),false,'a damaged optional tail cannot erase the closed paragraph before final rejection');
  }
});

test('a display can grow from partial to complete rows, keeping draft status until the actual closing brace arrives',async()=>{
  const partial='第二段仍然在写。'.repeat(12),tail='此处确实结束。'.repeat(8);
  const prefix=header+',{"kind":"narration","text":"'+partial;
  const pieces=[header,',{"kind":"narration","text":"'+partial,tail+'"}]}',' invalid afterword '.repeat(6)];
  const {events,raw}=await read(pieces),drafts=events.filter(e=>e.type==='presentation');
  assert.ok(drafts.every(d=>d.blocks[0]?.complete&&d.blocks[0].text===first.text));
  assert.ok(drafts.some(d=>d.blocks[1]?.text===partial&&d.blocks[1].complete===false));
  assert.deepEqual(drafts.at(-1).blocks.map(b=>[b.complete,b.text]),[[true,first.text],[true,partial+tail]]);
  assert.equal(raw.choices[0].message.content,pieces.join(''),'transport returns the original bytes decoded to text, never a draft reconstruction');
  const interrupted=await read([prefix,'\n'+' invalid'.repeat(10)]);
  assert.ok(interrupted.events.filter(e=>e.type==='presentation').every(d=>!d.blocks[1]?.complete),'partial second row is never upgraded on parse failure');
  const old=await read(pieces,false);assert.deepEqual(old.events.filter(e=>e.type==='presentation').at(-1).blocks,[],'legacy presentation policy remains unchanged');
});

test('monotone display cannot mask a subsequent model mismatch, reasoning delta or visible thinking markup',async()=>{
  for(const [suffix,expected] of [
    [{model:'wrong-model',choices:[]},'MODEL_RESPONSE_MISMATCH'],
    [{model:GLM_MODEL_ID,choices:[{delta:{reasoning_content:'private reasoning'}}]},'PROVIDER_RESPONSE_INVALID'],
    [',{"kind":"narration","text":"<think>secret</think>'+'填'.repeat(30)+'"}]}','PROVIDER_RESPONSE_INVALID'],
  ]){
    const {events,code,raw}=await read([header,suffix]);assert.equal(code,expected);assert.equal(raw,undefined);
    assert.doesNotMatch(JSON.stringify(events),/private reasoning|secret/u);
  }
});
