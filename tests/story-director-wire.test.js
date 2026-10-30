import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame,prepareOpening,prepareChoice,commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext } from '../src/game/cultivation/live/memory.js';
import { buildGlmWire,decodeGlmScene } from '../src/worker/story-glm-wire.js';
import { buildNamedSceneSchema } from '../src/worker/story-named-targets.js';
import { createStoryDirector,buildDirectorContext } from '../src/game/cultivation/live/story-director.js';
import { createCultivationBirthProfile,initialLifeForBirth,summarizeLife,V7_REALMS,maximumSpiritFor } from '../src/game/cultivation/live/cultivation-rules.js';
import { buildStoryInput,generateProviderScene } from '../src/worker/story-provider-core.js';
import { GLM_PROFILE,GLM_MODEL_ID,STORY_LIMITS } from '../src/worker/story-config.js';
import { formatStoryChoiceLabel } from '../src/game/cultivation/live/story-choice-label.js';

function context(){
  const legacy=createLiveGame({runId:'director-wire',seed:42}),pending=prepareOpening(legacy,{requestId:'wire-open'}),c=structuredClone(buildStoryContext(legacy,pending));
  const birth={...c.life.birth,cultivationProfile:createCultivationBirthProfile(()=>0)},life=initialLifeForBirth('衡生',birth);
  c.life=life;c.receipt={...c.receipt,birth,before:summarizeLife(life),after:summarizeLife(life),cultivationResult:{version:7,check:null,lifespanChange:{years:0,cause:null}}};
  c.director=buildDirectorContext(createStoryDirector(life,42),life,c.receipt,1);
  return c;
}
function wireFixture(){
  const actor={kind:'person',name:'江陌',ref:'',status:null};
  return {blocks:[{kind:'narration',text:'江陌站在渡口旧桩旁，指给你看水流改道后露出的刻痕。你留在岸上，尚未答应任何委托。'+ '河岸的痕迹仍待辨认，先听清来由再作取舍。'.repeat(8)}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'水流何时开始改道',anchor:0},{action:'interact:observe',target:'self',stake:'low',purpose:'核对旧桩上的凿痕',anchor:0},{action:'interact:decline',target:actor,stake:'low',purpose:'暂不答应调查改道之事',anchor:0}],title:'旧桩之问',location:'渡口',memoryDeltas:[{target:actor,kind:'clue',anchor:0,status:'open'}],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
}

test('v7 named generation preserves story annotations after the streamed choices and requires exactly three choices',()=>{
  const c=context(),built=buildGlmWire(c,'当前事实\n独立的固定安全规则',{storyActions:true});
  const schema=buildNamedSceneSchema(built.schema,built.context);
  assert.equal(schema.properties.choices.minItems,3);
  assert.equal(schema.properties.choices.maxItems,3);
  assert.equal(built.schema.$defs.anchor.maximum,3);
  assert.ok(schema.required.includes('story'));
  assert.ok(Object.keys(schema.properties).indexOf('story')>Object.keys(schema.properties).indexOf('choices'));
  const wire=wireFixture(),scene=decodeGlmScene(wire,c,{storyActions:true});
  assert.deepEqual(scene.story,wire.story);
  assert.equal(scene.choices.length,3);
  assert.equal(scene.memoryDeltas[0].text,scene.blocks[0].text);
  assert.match(built.instructions,/独立的固定安全规则/,'the modern prompt must retain its supplied system contract');
  assert.match(built.instructions,/200[—–-]400/);
});

test('v7 schemas expose only paired executable craft resources and the next higher realm',()=>{
  const c=context();c.life.realm='spirit';
  const schema=buildGlmWire(c,'',{storyActions:true}).schema;
  const targets=action=>schema.properties.choices.items.oneOf.filter(branch=>branch.properties.action.enum.includes(action)).flatMap(branch=>branch.properties.targetId.enum);
  assert.deepEqual(targets('practice:breakthrough'),['void']);
  assert.deepEqual(targets('craft:alchemy'),['medicine','elixir']);
  assert.deepEqual(targets('craft:formation'),['array']);
  assert.deepEqual(targets('craft:forge'),['talisman','artifact']);
  assert.ok(targets('explore:cautious').includes('voidstone'));
  assert.ok(!targets('explore:cautious').includes('elixir'));
});

test('legacy named wire keeps its original two-choice contract and never requests new narrative annotations',()=>{
  const state=createLiveGame({runId:'legacy-director-wire',seed:42}),c=buildStoryContext(state,prepareOpening(state,{requestId:'legacy-open'}));
  const built=buildGlmWire(c,'',{storyActions:true}),schema=buildNamedSceneSchema(built.schema,built.context);
  assert.equal(schema.properties.choices.minItems,2);
  assert.ok(!schema.required.includes('story'));
  assert.ok(!JSON.stringify(schema).includes('practice:forbidden'));
  assert.ok(!JSON.stringify(schema).includes('voidstone'));
});

test('a complete v7 provider turn carries its durable director within the existing request budget',async()=>{
  const c=context(),profile={...GLM_PROFILE,storyActions:true},input=buildStoryInput(profile,c);
  assert.ok(new TextEncoder().encode(JSON.stringify(input)).length<=STORY_LIMITS.maxInputBytes);
  assert.equal(JSON.parse(input.messages[1].content).director.destiny.id,c.director.destiny.id);
  const result=await generateProviderScene({run:async()=>({model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wireFixture())}}],usage:{prompt_tokens:400,completion_tokens:450,total_tokens:850}})},profile,c);
  assert.equal(result.status,'ready',result.errorCode);
  assert.equal(result.scene.choices.length,3);
  assert.equal(result.scene.story.pattern,'investigation');
});

test('named NPC trait annotations resolve one canonical identity and preserve only prose-grounded details',()=>{
  const c=context(),wire=wireFixture(),actor=wire.choices[0].target;
  wire.blocks[0].text+='江陌是摆渡人，惯于盘绳，自称会定流诀，执意找回失踪弟弟。';
  wire.story.npcs=[{target:actor,anchor:0,title:'摆渡人',signatureSpell:'定流诀',habit:'盘绳',obsession:'找回失踪弟弟'}];
  const decoded=decodeGlmScene(wire,c,{storyActions:true});
  assert.equal(decoded.story.npcs[0].entityId,decoded.entities.find(row=>row.name==='江陌').id);
  assert.equal(decoded.story.npcs[0].signatureSpell,'定流诀');
  assert.ok(!Object.hasOwn(decoded.story.npcs[0],'target'));
});

test('new cultivation choices have the same explicit action meaning in streamed and final labels',()=>{
  const label=(action,targetId,targetName)=>formatStoryChoiceLabel({action,targetId,targetName,purpose:'应对眼前险局',stake:'low'});
  assert.match(label('practice:forbidden','self',''),/禁术/);
  assert.match(label('evade:blood','enemy','拦路者'),/燃寿/);
  assert.match(label('rest:medicine','self',''),/疗伤/);
  assert.match(label('rest:extend','self',''),/延寿/);
  assert.match(label('craft:alchemy','medicine','疗伤丹'),/炼制疗伤丹/);
  assert.match(label('craft:forge','artifact','法器'),/锻制法器/);
  assert.match(label('travel:smuggle','destination','中界边港'),/偷渡.*中界边港/);
  assert.match(label('negotiate:black-market','trader','货郎'),/黑市/);
});

test('a failed real world-crossing check keeps the model location in the original world and never instructs arrival',()=>{
  const birth=createLiveGame({runId:'failed-world-wire',seed:42,engineVersion:7}),opening=prepareOpening(birth,{requestId:'world-open'}),c=buildStoryContext(birth,opening);
  const first=decodeGlmScene(wireFixture(),c,{storyActions:true});
  let state=commitTurn(birth,opening,first);
  const observation=prepareChoice(state,{requestId:'world-watch',choiceId:state.currentScene.choices[1].id});
  state=commitTurn(state,observation,{...first,blocks:[{kind:'narration',text:first.blocks[0].text+'江陌让开了河岸。'}]});
  state.life.realm='foundation';state.life.lifeLimit=V7_REALMS.foundation.lifeLimit;state.life.cultivation=30;
  state.life.cultivationProfile.maxSpirit=maximumSpiritFor(state.life);state.life.cultivationProfile.spirit=state.life.cultivationProfile.maxSpirit;state.life.cultivationProfile.exposure=70;
  Object.assign(state.life.items,{supplies:10,stones:200,artifact:1,array:1,skykey:1});
  const gate={id:'world-gate',name:'中界落云台',kind:'place'};
  state.relatedEntities.push(gate);state.currentScene.entities=structuredClone(state.relatedEntities);
  state.currentScene.choices[0]={id:'cross',label:'尝试偷渡前往中界落云台',intent:'travel',targetId:gate.id,approach:'smuggle',stake:'low'};
  state.lastReceipt.after=summarizeLife(state.life);state.lastReceipt.before=structuredClone(state.lastReceipt.after);
  state.lastReceipt.cultivationResult={version:7,check:null,lifespanChange:{years:0,cause:null}};
  let rng=0;while(((Math.imul(rng,1664525)+1013904223)>>>0)%100!==99)rng++;
  state.rng=rng;state.lastReceipt.random={before:Number(((BigInt(rng)-1013904223n)*4276115653n)&0xffffffffn),after:rng,roll:rng%100};
  const failed=prepareChoice(state,{requestId:'failed-crossing',choiceId:'cross'});
  assert.equal(failed.receipt.cultivationResult.check.success,false);
  const next=buildStoryContext(state,failed,[],{selection:'relevance-v1',openTotal:0,continuity:true}),input=buildStoryInput({...GLM_PROFILE,storyActions:true},next);
  assert.equal(input.response_format.json_schema.schema.properties.location.const,'渡口');
  assert.match(input.messages.at(-1).content,/跨界判定失败/);
  assert.ok(!input.messages.at(-1).content.includes('本次旅行只写抵达'));
  assert.ok(!input.messages.at(-1).content.includes('locationTarget'));
});
