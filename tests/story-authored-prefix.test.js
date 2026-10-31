import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompleteV7Body} from '../src/worker/story-readable-wire.js';
import {adaptV7EngineMenuOutput} from '../src/worker/story-model-output.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

// The one complete public #119 SSE row. Its private model envelope and the
// reason the following text was malformed are unknown. Each suffix is synthetic.
const block={kind:'narration',text:"晨雾尚未散尽，村口的石碾旁围了几个人，正指指点点。你拨开人群，见一老者正对着一只被压扁的野兔发愁，那兔身虽碎，却隐隐透着股诡异的青色光泽。老者见你走近，浑浊的眼珠转了转，压低声音道：'小友，这兔子不是寻常猎物，是那'青鳞兽'的幼崽，昨夜才在林子里现了踪迹。'"};
const speaker={kind:'person',name:'老周'},dialogue={kind:'dialogue',speaker,text:'你愿意听听它的来历吗？'};
const root='{"blocks":[',s=JSON.stringify(block),d=JSON.stringify(dialogue);
const state=createLiveGame({runId:'authored-prefix',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'opening'}),ctx=buildStoryContext(state,pending);
const read=source=>readCompleteV7Body(source,ctx);

test('a malformed later block cannot erase an already complete, exact authored row',()=>{
  assert.equal(Array.from(block.text).length,129);
  for(const tail of [',{"kind":"narration","text":"这不是"一段"有效JSON"}]}',',{"kind":"dialogue","speaker":{"kind":"person","name":"不完整"},"text":"坏\u0001控制符"}]}',',{"kind":"narration","text":]]]]}',',,,,garbled-tail',',{"kind":"narration","text": {"embedded":{"kind":"narration","text":"不是顶层正文"}}']){
    assert.deepEqual(read(root+s+tail),{blocks:[block]},tail);
    assert.deepEqual(read(root+s+','+d+tail),{blocks:[block,dialogue]},tail);
  }
});

test('a prefix comes only from the first root and a complete direct row; complete conflicting speakers are isolated before commit',()=>{
  for(const source of ['{"nested":{"blocks":['+s+']},"damaged":]]}', '{"choices":[{"blocks":['+s+']}],"broken":]]}',root+'{"kind":"narration","text":"半句',root+'{"inside":'+s+'},]]}',JSON.stringify({blocks:[block]})+JSON.stringify({blocks:[dialogue]}),root+s+'],"blocks":['+d+',]]}'])assert.equal(read(source),null,source.slice(-50));
  const actual={kind:'dialogue',speaker:'k99',text:'我真的作为这一段的说话人出现。'},saved=read(root+s+','+JSON.stringify(actual)+',]]]}');
  assert.deepEqual(saved.blocks,[block,actual]);assert.deepEqual(adaptV7EngineMenuOutput(saved,ctx).blocks,[block]);
});

test('known complete optional records survive a later bad field; an ambiguous partial obligation is not synthesized',()=>{
  const close={referenceId:'m1',status:'resolved'},death={kind:'death',target:speaker,anchor:0},mem=JSON.stringify([death,close]);
  for(const source of ['{"memoryDeltas":'+mem+',"blocks":['+s+',]]]}',root+s+'],"memoryDeltas":'+mem+',"comment":{"bad":]]]']){
    const saved=read(source);assert.deepEqual(saved?.blocks,[block]);assert.deepEqual(saved.memoryDeltas,[death,close]);
  }
  for(const partial of ['{"referenceId":"m1","status":"resolved"','{"kind":"death","target":','{"kind":"promise","anchor":0,']){
    assert.deepEqual(read(root+s+'],"memoryDeltas":['+JSON.stringify(close)+','+partial),{blocks:[block],memoryDeltas:[close]});
    assert.equal(read('{"memoryDeltas":['+partial),null,'no invented body from metadata');
  }
});

test('one accepted stop preserves the reported paragraph and produces actionable choices from the frozen turn',async()=>{
  let calls=0;const content=root+s+','+d+',{ "kind":"narration", "text":"这是"坏"引号" }]}';
  const result=await generateProviderScene({run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content}}],usage:{prompt_tokens:200,completion_tokens:200,total_tokens:400}};}},{...GLM_PROFILE,storyActions:true,engineMenu:true},ctx);
  assert.equal(result.status,'ready',result.errorCode);assert.equal(calls,1);assert.deepEqual(result.scene.blocks.map(b=>b.text),[block.text,dialogue.text]);
  const next=commitTurn(state,pending,result.scene);assert.ok(next.currentScene.choices.length>=2);for(const ch of next.currentScene.choices)assert.deepEqual(prepareChoice(next,{requestId:'next',choiceId:ch.id}).receipt.action,ch);
});

test('a bounded but unparseable block cannot swallow the real sibling memory array',()=>{
  const death={kind:'death',target:speaker,anchor:0},closure={referenceId:'m1',status:'resolved'},records=[death,closure];
  const damaged=JSON.stringify({kind:'narration',text:'正常',decoy:{memoryDeltas:[{referenceId:'wrong-nested',status:'broken'}]}}).replace('"正常"','"这是"坏"引号"');
  for(const badRow of [damaged,'{"kind":"narration","text":"未转义\u0001字符"}']){
    const content=root+s+','+badRow+','+d+'],"memoryDeltas":'+JSON.stringify(records)+'}';
    const recovered=read(content);assert.deepEqual(recovered?.blocks,[block],'only the verified prefix survives');assert.deepEqual(recovered?.memoryDeltas,records);
    const proposed=adaptV7EngineMenuOutput(recovered,ctx);assert.deepEqual(proposed.memoryDeltas,records);
    assert.throws(()=>decodeGlmScene(proposed,ctx,{storyActions:true}),'the nonexistent closure is still rejected by the authority boundary');
  }
  assert.deepEqual(read(root+s+','+damaged+'],"irrelevant":{"memoryDeltas":'+JSON.stringify(records)+'}}'),{blocks:[block]},'never seek records inside unrelated objects');
  assert.deepEqual(read(root+s+',{ "kind":"narration", ]]} "memoryDeltas":'+JSON.stringify(records)),{blocks:[block]},'an ambiguous boundary supplies no sibling record');
});
