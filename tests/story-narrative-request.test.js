import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_MODEL_ID,GLM_PROFILE,STORY_LIMITS} from '../src/worker/story-config.js';

const profile={...GLM_PROFILE,storyActions:true,engineMenu:true};
function fixture(v7=true){
  const state=createLiveGame({runId:'narrative-request',seed:42,...(v7?{engineVersion:7}:{})}),pending=prepareOpening(state,{requestId:'narrative-opening'});
  return {state,pending,c:buildStoryContext(state,pending)};
}

test('new v7 GLM generation requires only narrative blocks and provides future decisions as input data',()=>{
  const {c}=fixture(),saved=structuredClone(c),input=buildStoryInput(profile,c),schema=input.response_format.json_schema.schema;
  assert.deepEqual(schema.required,['blocks']);assert.equal(schema.additionalProperties,false);
  assert.deepEqual(Object.keys(schema.properties),['blocks']);
  assert.doesNotMatch(JSON.stringify(schema),/"choices"|"purpose"|"stake"|"action"|interact:ask|choicePurpose/);
  const facts=JSON.parse(input.messages.at(-1).content);
  assert.ok(facts.possibleNextSteps.length>=2);assert.ok(facts.possibleNextSteps.every(cue=>typeof cue==='string'&&cue.trim()));
  assert.deepEqual(facts.settled.items,c.life.items);
  assert.match(input.messages[0].content,/停在.*决定前/u);
  assert.doesNotMatch(input.messages[0].content,/合法动作与目标以schema|每项只写action|给2至3个本场真正不同的选择|选项全部由你生成/);
  assert.equal(input.stream,true);assert.equal(input.stream_options.include_usage,true);
  assert.ok(Buffer.byteLength(JSON.stringify(input))<=STORY_LIMITS.maxInputBytes);
  assert.deepEqual(c,saved);
});

test('explicit engine menu does not change the v6 or unnegotiated input; saved v7 model menus retain their contract',()=>{
  const legacy=fixture(false).c,v7=fixture().c;
  assert.deepEqual(buildStoryInput(profile,legacy),buildStoryInput({...profile,engineMenu:false},legacy));
  assert.deepEqual(buildStoryInput({...profile,storyActions:false},v7),buildStoryInput({...profile,storyActions:false,engineMenu:false},v7));
  assert.ok(buildStoryInput({...profile,engineMenu:false},v7).response_format.json_schema.schema.required.includes('choices'));
});

test('one narrative-only GLM completion keeps its prose and every engine decision prepares the next receipt',async()=>{
  const {state,pending,c}=fixture(),blocks=[{kind:'narration',text:'渡口的雾散了一层，船夫把绳结指给你看。'},{kind:'dialogue',speaker:{kind:'person',name:'张船夫'},text:'这根绳不是风刮断的，你看看断口。'}];
  let calls=0;
  const ai={run:async(model,input)=>{calls++;assert.equal(model,GLM_MODEL_ID);assert.equal(input.response_format.json_schema.schema.properties.choices,undefined);return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify({blocks})}}],usage:{prompt_tokens:400,completion_tokens:150,total_tokens:550}};}};
  const result=await generateProviderScene(ai,profile,c);assert.equal(calls,1);assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.blocks.map(b=>b.text),blocks.map(b=>b.text));
  const active=commitTurn(state,pending,result.scene);
  assert.ok(active.currentScene.choices.length>=2&&active.currentScene.choices.length<=3);
  for(const choice of active.currentScene.choices){
    const next=prepareChoice(active,{choiceId:choice.id,requestId:'next-'+choice.approach});
    assert.deepEqual(next.receipt.action,choice);
    if(choice.approach==='observe'){
      const nextContext=buildStoryContext(active,next);
      const body=buildStoryInput(profile,nextContext).response_format.json_schema.schema.properties.blocks;
      assert.ok(body.items.oneOf?.some(row=>row.properties.kind.const==='dialogue'),'an actual eyewitness may speak during an observation');
      assert.equal(buildStoryInput({...profile,engineMenu:false},nextContext).response_format.json_schema.schema.properties.blocks.maxItems,1);
    }
  }
});

// Observed display rows from #122. Which optional fields, if any, caused
// that native response to fail is unknown; the proposals below are controls.
const travelBlocks=[
  {
    "kind": "narration",
    "text": "三十日的脚程，将青石板路换作了碎石与泥泞。松风岭并不高，却因常年风声如涛而得名。岭上没有松涛，只有枯黄的野草在风中瑟缩。村长家的宅院就在岭脚，此刻大门紧闭，朱漆剥落，显得格外萧索。几个锦衣人正站在院墙外，神色倨傲，目光时不时扫过那棵老槐树，仿佛在审视一件待价而沽的货物。刘三没跟来，或许他嫌这岭上风大，吹得人骨头疼。"
  },
  {
    "kind": "dialogue",
    "text": "“这便是那所谓的‘伴生灵根’？寒水真灵根倒是不错，只是这体质……啧，留焰体？这可是个麻烦。若是炼丹时火候失控，烧了自家的丹房可别怪我们。”",
    "speaker": {
      "kind": "person",
      "name": "锦衣人甲"
    }
  },
  {
    "kind": "narration",
    "text": "那锦衣人甲说着，随手从袖中抛出一枚玉简，在空中划过一道弧线，直直朝你飞来。玉简上刻着繁复的符文，显然不是凡品。他并没有等你伸手去接，而是继续说道：“既然来了，就别磨蹭。少主对这寒水灵根颇为满意，只要你点头，这桩婚事便算成了。至于那棵老槐树的煞气，少主自有办法镇压，你只需负责‘镇住’那股寒气便是。”"
  }
];
function trip(){
  let {state,pending,c}=fixture();const host=c.namespace+':t1:e:person_1',place=c.namespace+':t1:e:place_1';
  const previous=turn=>({id:c.namespace+':t'+turn+':s:scene',title:'村口石碑',location:'村口',entities:[{id:host,kind:'person',name:'老樵夫'},{id:place,kind:'place',name:'松风岭'}],blocks:[{kind:'dialogue',speaker:host,text:'到松风岭能看清山道的旧标记。'}],choices:[{id:'ask',intent:'interact',approach:'ask',targetId:host,stake:'low',label:'询问山道标记'},{id:'travel',intent:'travel',approach:'road',targetId:place,stake:'low',label:'前往松风岭察看标记'}],memoryDeltas:[],story:{pattern:'journey',beat:'progress',anchors:[0]}});
  state=commitTurn(state,pending,previous(1));state=commitTurn(state,prepareChoice(state,{choiceId:'ask',requestId:'ask'}),previous(2));
  pending=prepareChoice(state,{choiceId:'travel',requestId:'travel'});
  const clue={id:'clue:mountain-mark',runId:state.runId,turnId:1,source:'narrative',kind:'clue',entityId:host,text:'去松风岭查明山道标记',status:'open'};
  return {state,pending,c:buildStoryContext(state,pending,[clue]),clue};
}
async function deliver(wire,c){
  let calls=0;
  const result=await generateProviderScene({run:async model=>{calls++;return {model,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:200,completion_tokens:300,total_tokens:500}};}},profile,c);
  assert.equal(calls,1,'checking independent proposals never repeats inference');
  return result;
}

test('only existing open obligations expose an optional, scoped closure field on the narrative request',()=>{
  const {c}=trip(),schema=buildStoryInput(profile,c).response_format.json_schema.schema;
  assert.deepEqual(Object.keys(schema.properties),['blocks','memoryDeltas']);assert.deepEqual(schema.required,['blocks']);
  const item=schema.properties.memoryDeltas.items,variants=item.oneOf??[item];
  assert.ok(variants.every(v=>v.required.length===2&&v.required.includes('referenceId')&&v.required.includes('status')));
  assert.deepEqual(variants.flatMap(v=>v.properties.referenceId.enum),['m1']);
  assert.deepEqual(variants.flatMap(v=>v.properties.status.enum),['resolved']);
});

test('a settled trip keeps the same prose, choices, receipt and valid records when other proposals are inadmissible',async()=>{
  const {state,pending,c,clue}=trip(),target=travelBlocks[1].speaker;
  assert.deepEqual(travelBlocks.map(b=>Array.from(b.text).length),[158,69,149]);
  const good=[{referenceId:'m1',status:'resolved'},{kind:'fact',target,anchor:1}],bad=[{kind:'death',target:{...target,ref:'r:other:t9:e:p'},anchor:0},{referenceId:'m999',status:'resolved'},{kind:'promise',target:'k99',anchor:0,status:'open'}];
  const common={blocks:travelBlocks,title:'松风岭上的来客',location:'前一处地点',story:{pattern:'journey',beat:'progress',anchors:[0]}};
  const expected=await deliver({...common,memoryDeltas:good},c);assert.equal(expected.status,'ready',expected.errorCode);
  const noisy=await deliver({...common,memoryDeltas:[bad[0],good[0],bad[1],good[1],bad[2]]},c);
  assert.equal(noisy.status,'ready',noisy.errorCode);assert.deepEqual(noisy.scene,expected.scene);
  assert.equal(noisy.scene.memoryDeltas[0].referenceId,clue.id);assert.equal(noisy.scene.memoryDeltas[1].text,travelBlocks[1].text);
  const saved=commitTurn(state,pending,noisy.scene);assert.equal(saved.revision,3);assert.equal(saved.currentScene.location,'松风岭');
  assert.deepEqual(saved.lastReceipt,pending.receipt);assert.equal(saved.rng,pending.nextRng);
  assert.ok(saved.currentScene.choices.length>=2);
  for(const choice of saved.currentScene.choices)assert.deepEqual(prepareChoice(saved,{requestId:'next'+choice.approach,choiceId:choice.id}).receipt.action,choice);
  const empty=await deliver({blocks:travelBlocks,memoryDeltas:bad},c);assert.equal(empty.status,'ready',empty.errorCode);assert.deepEqual(empty.scene.memoryDeltas,[]);
  assert.ok(!empty.scene.entities.some(e=>e.status==='dead'));assert.ok(!empty.scene.entities.some(e=>e.id.startsWith('r:other:')));
});
