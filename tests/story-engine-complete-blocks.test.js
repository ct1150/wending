import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScene} from '../src/worker/story-provider.js';
import {GLM_MODEL_ID,GLM_PROFILE,STORY_LIMITS} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

// Only the three public, completed narration rows are known from candidate
// #118. The full and unfinished JSON tails below are controlled alternatives.
const blocks=[
  {
    "kind": "narration",
    "text": "三十日的时间在村口的石碾旁显得格外漫长。晨雾散去又聚拢，老张那惊魂未定的模样成了村头巷尾的谈资。你并未急着离开，只是静静坐在石碾旁，借着五行伪灵根的感应，将那股缠绕在老张指尖的阴冷触感在脑海中反复推演。那并非单纯的寒意，而是一种带着粘稠质感的阻滞，仿佛有什么东西试图顺着经脉逆流而上。你闭上眼，尝试调动体内微薄的灵力，依照那残缺的《回脉篇》心法，引导气息在四肢百骸间游走。虽然灵根驳杂，经络狭窄，但这三十日的静坐让你勉强摸到了一丝灵力运行的脉络，虽如涓涓细流，却比之前凝实了几分。那盏伴生的听烛残灯在怀中微微发烫，似乎在回应你体内灵力的波动，灯芯跳动了一下，映照出你略显苍白的面容。"
  },
  {
    "kind": "narration",
    "text": "老张见你坐了许久，眼神中多了几分敬畏，却又带着几分忌惮。他不再多言，只是匆匆收拾了摊位，借口家里有事，早早便回了家。村中其余人依旧在议论纷纷，但当你再次看向那处乱葬岗的方向时，心中却生出一股莫名的躁动。那股躁动并非恐惧，而是一种被某种存在注视的战栗感。你低头看向手中的干粮，那是仅剩的一株草药，原本只是用来充饥，此刻却觉得它似乎比之前沉重了几分。"
  },
  {
    "kind": "narration",
    "text": "你站起身，拍了拍衣摆上的尘土。三十日的调养让你精神焕发，但那股阴冷的触感并未完全消散，反而像是一颗种子，埋在了你的识海深处。你意识到，仅仅依靠《回脉篇》的残缺功法，想要彻底理清那股力量的来龙去脉，无异于杯水车薪。你需要更多的资源，或者更直接地接触那个源头。"
  }
];
const limit=STORY_LIMITS.maxOutputTokens,usage={prompt_tokens:400,completion_tokens:limit,total_tokens:400+limit};
function thirdTurn(){
  let state=createLiveGame({runId:'engine-length-rest',seed:42,engineVersion:7});
  let pending=prepareOpening(state,{requestId:'opening'});const c=buildStoryContext(state,pending),actor=c.namespace+':t1:e:person_1';
  const scene=turn=>({id:c.namespace+':t'+turn+':s:scene',title:'村口话别',location:'村口',entities:[{kind:'person',name:'老陈',id:actor}],blocks:[{kind:'dialogue',speaker:actor,text:'可以先在这里歇脚。'}],memoryDeltas:[],story:{pattern:'discovery',beat:'progress',anchors:[0]},choices:[
    {id:'ask',intent:'interact',approach:'ask',stake:'low',targetId:actor,label:'请说明来由'},
    {id:'rest',intent:'rest',approach:'recover',stake:'low',targetId:'self',label:'就地歇脚'},
  ]});
  state=commitTurn(state,pending,scene(1));pending=prepareChoice(state,{choiceId:'ask',requestId:'ask'});state=commitTurn(state,pending,scene(2));
  pending=prepareChoice(state,{choiceId:'rest',requestId:'rest'});return {state,pending,c:buildStoryContext(state,pending)};
}
async function generate(content,c,{stop='length',counts=usage,model=GLM_MODEL_ID,delta={},done=true}={}){
  const frames=[{model,choices:[{index:0,delta:{content,...delta}}]},{model,choices:[{index:0,delta:{},finish_reason:stop}]},...(counts?[{choices:[],usage:counts}]:[])];
  const sse=frames.map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')+(done?'data: [DONE]\n\n':'');
  let calls=0;const result=await generateScene({run:async()=>{calls++;return new Response(sse).body;}},{...GLM_PROFILE,validated:true,supportsStructuredOutput:true},c,{}, {storyActions:true});
  assert.equal(calls,1);return result;
}

test('a token-limited rest turn with prose alone cannot insert another rest or overwrite the frozen receipt',async()=>{
  const {state,pending,c}=thirdTurn(),saved=structuredClone(pending);
  assert.equal(pending.receipt.elapsedDays,30);assert.deepEqual(blocks.map(b=>Array.from(b.text).length),[291,173,128]);
  const body=JSON.stringify(blocks);
  for(const source of [JSON.stringify({blocks}), '{"blocks":'+body.slice(0,-1)+',{"kind":"narration","text":"unfinished',
    '{"blocks":'+body+',"memoryDeltas":[{"kind":"death","target":']){
    const result=await generate(source,c);
    assert.notEqual(result.status,'ready');assert.equal(result.scene,undefined);
    assert.deepEqual(pending,saved);assert.equal(state.revision,2);
  }
});

test('incomplete native output preserves transport identity, accounting and stop errors',async()=>{
  const {c}=thirdTurn(),source=JSON.stringify({blocks});
  for(const [options,code] of [
    [{counts:null},'PROVIDER_USAGE_INVALID'],[{counts:{prompt_tokens:0,completion_tokens:limit+1,total_tokens:limit+1}},'OUTPUT_TOO_LARGE'],
    [{model:'another-model'},'MODEL_RESPONSE_MISMATCH'],[{done:false},'PROVIDER_RESPONSE_INVALID'],
    [{stop:'tool_calls'},'STOP_REASON_INVALID'],[{stop:'content_filter'},'STOP_REASON_INVALID'],[{stop:'unrecognized'},'STOP_REASON_INVALID'],
    [{delta:{reasoning_content:'still thinking'}},'PROVIDER_RESPONSE_INVALID'],[{delta:{tool_calls:[{index:0}]}},'PROVIDER_RESPONSE_INVALID'],
  ]){
    const failed=await generate(source,c,options);assert.equal(failed.errorCode,code,JSON.stringify(options));assert.equal(failed.scene,undefined);
  }
});

test('a token cap after two complete authored choices keeps their labels, the paid rest receipt and exact usage',async()=>{
  const {state,pending,c}=thirdTurn();
  const choices=[
    {action:'interact:observe',target:'self',purpose:'举起听烛残灯，细辨灯芯的波动'},
    {action:'interact:leave',target:'self',purpose:'收好听烛残灯，暂且搁下石碾边的异状'},
  ];
  const content=JSON.stringify({blocks,choices}).slice(0,-1)+',"title":"';
  const result=await generate(content,c);
  assert.equal(result.status,'ready',result.errorCode);assert.equal(result.stopReason,'length');
  assert.deepEqual(result.usage,{promptTokens:400,completionTokens:limit,totalTokens:400+limit});
  const next=commitTurn(state,pending,result.scene);
  assert.deepEqual(next.lastReceipt,pending.receipt);assert.equal(next.revision,3);
  assert.deepEqual(next.currentScene.blocks,blocks);assert.deepEqual(next.currentScene.choices.map(row=>row.label),choices.map(row=>row.purpose));
});
