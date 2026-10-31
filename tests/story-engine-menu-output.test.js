import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

const person={kind:'person',name:'药摊主人'},blocks=[{kind:'narration',text:'药摊主人把一包用麻绳缠着的赤炎草放到木台上。'},{kind:'dialogue',speaker:person,text:'山上刚采来的，你想先看叶片，还是问问有什么用处？'},{kind:'narration',text:'你停在木台前，尚未收下草药，摊主等你自己决定。'}];
const modelMenu=[{action:'trade:inquire',target:person,purpose:'打听来历'},{action:'inspect:herb',target:'self',purpose:'观察叶片'},{action:'decline:offer',target:person,purpose:'离开药摊'}];
function fixture(){const state=createLiveGame({runId:'engine-menu-output',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'engine-menu-opening'});return {state,pending,ctx:buildStoryContext(state,pending)};}
// Only the completed presentation rows are from the 5.4.1 #116 smoke. Its
// private model JSON was not observed; the damaged endings below are controls.
const reportedBlocks=[
  {kind:'narration',text:'晨雾尚未散尽，村口的石碾旁围了几个闲汉，正指指点点地盯着那口刚从河滩上捞上来的破旧陶罐。那陶罐半埋在淤泥里，口沿缺了一块，却隐隐透着一股子焦糊味，与周围湿润的泥土格格不入。你站在人群外围，清曜天灵根的感知让你轻易察觉到，那陶罐里似乎封存着某种躁动的热流，正随着周围人的呼吸起伏，像是在等待被唤醒的信号。那股热流并非灵气，倒更像是某种被强行压制的余烬，即便隔着陶土，也能感觉到其中蕴含的、近乎狂暴的破坏力。'},
  {kind:'dialogue',speaker:'老赵头',text:'“啧啧，这可是前些日子河里发大水冲出来的，听说是哪路神仙炼丹炸了炉子，这玩意儿要是真炸了，咱们这小村子怕是连个渣都不剩。”'},
];

async function deliver(content,context){
  let calls=0;
  const result=await generateProviderScene({run:async()=>{calls++;return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:typeof content==='string'?content:JSON.stringify(content)}}],usage:{prompt_tokens:200,completion_tokens:300,total_tokens:500}};}},{...GLM_PROFILE,storyActions:true,authoredChoices:true},context);
  assert.equal(calls,1);return result;
}

test('a pharmacy scene with invented commands cannot independently award equipment or silently substitute another menu',async()=>{
  const {ctx}=fixture();
  for(const choices of [modelMenu,[],null,[{action:'fight:assault',target:'self',stake:'high',purpose:'伪造的动作'}]]){
    const result=await deliver({blocks,choices},ctx);
    assert.notEqual(result.status,'ready');assert.equal(result.scene,undefined);
  }
});

test('public #116 paragraphs retain the two model-authored actions through a truncated optional footer',async()=>{
  const {state,pending,ctx}=fixture();
  const choices=[{action:'interact:ask',target:{kind:'person',name:'老赵头'},purpose:'问老赵头当时是谁捞出了这只破罐'},
    {action:'interact:leave',target:'self',purpose:'收回手，离开石碾旁的人群'}];
  const core=JSON.stringify({blocks:reportedBlocks,choices});
  const response=await deliver(core.slice(0,-1)+',"title":"',ctx);
  assert.equal(response.status,'ready',response.errorCode);
  assert.deepEqual(response.scene.choices.map(c=>c.label),choices.map(row=>row.purpose));
  const next=commitTurn(state,pending,response.scene);
  assert.deepEqual(next.currentScene.blocks.map(b=>b.text),reportedBlocks.map(b=>b.text));
  for(const c of next.currentScene.choices)assert.deepEqual(prepareChoice(next,{choiceId:c.id,requestId:'use-'+c.approach}).receipt.action,c);
  const partial=await deliver(core.slice(0,core.indexOf('"choices"'))+'"choices":['+JSON.stringify(choices[0])+',',ctx);
  assert.notEqual(partial.status,'ready');assert.equal(partial.scene,undefined);
});
