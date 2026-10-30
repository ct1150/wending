import {namedGlmFixture} from './helpers/named-glm-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices,resolveImmediateInteraction} from '../src/game/cultivation/live/engine.js';
import * as memory from '../src/game/cultivation/live/memory.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {validateReceipt} from '../src/game/cultivation/live/validation.js';
import {buildGlmWire,decodeGlmScene} from '../src/worker/story-glm-wire.js';

test('new refusals and farewells close locally without rewards, travel or another NPC question',()=>{
  for(const approach of ['decline','leave']){
    const {state}=encounter(),actor=state.relatedEntities.find(entity=>entity.kind==='person');state.currentScene.choices[0]={id:state.currentScene.choices[0].id,label:'结束眼前的请求',intent:'interact',targetId:actor.id,stake:'low',approach};
    const before=structuredClone(state),pending=prepareChoice(state,{requestId:'immediate-'+approach,choiceId:state.currentScene.choices[0].id}),scene=resolveImmediateInteraction(state,pending),next=commitTurn(state,pending,scene);
    memory.validateGeneratedScene(scene,memory.buildStoryContext(state,pending));assert.deepEqual(state,before);assert.deepEqual(next.life,state.life);assert.equal(next.rng,pending.nextRng);assert.equal(next.revision,state.revision+1);assert.equal(scene.location,state.currentScene.location);assert.ok(scene.blocks[0].text.includes(actor.name));assert.ok(scene.choices.every(choice=>choice.targetId!==actor.id&&!['decline','leave'].includes(choice.approach)));assert.ok(scene.choices.some(choice=>choice.intent==='travel'));assert.ok(scene.choices.some(choice=>choice.intent==='interact'&&choice.approach==='observe'));
  }
  const {state,pending}=encounter();assert.throws(()=>resolveImmediateInteraction(state,pending));
  state.currentScene.location='village';state.currentScene.choices[0]={id:state.currentScene.choices[0].id,label:'结束互动',intent:'interact',targetId:'self',approach:'leave',stake:'low'};const local=resolveImmediateInteraction(state,prepareChoice(state,{requestId:'opaque-place',choiceId:state.currentScene.choices[0].id}));assert.ok(!local.blocks[0].text.includes('village'));assert.equal(local.location,'village');
});

test('an old scene matching the local farewell still advances without weakening repeat validation',()=>{
  const {state}=encounter();state.currentScene.choices[0]={id:state.currentScene.choices[0].id,label:'结束当前互动',intent:'interact',targetId:'self',approach:'leave',stake:'low'};
  let pending=prepareChoice(state,{requestId:'repeat-local-old',choiceId:state.currentScene.choices[0].id});state.currentScene.blocks=resolveImmediateInteraction(state,pending).blocks;pending=prepareChoice(state,{requestId:'repeat-local-new',choiceId:state.currentScene.choices[0].id});
  const scene=resolveImmediateInteraction(state,pending);assert.notDeepEqual(scene.blocks,state.currentScene.blocks);assert.doesNotThrow(()=>memory.validateGeneratedScene(scene,memory.buildStoryContext(state,pending)));
});

test('modern model guidance uses short interactions for questions without legacy negotiation instructions',()=>{
  const state=createLiveGame({runId:'modern-question',seed:42}),context=memory.buildStoryContext(state,prepareOpening(state,{requestId:'question-opening'}));
  const modern=buildStoryInput({...GLM_PROFILE,storyActions:true},context).messages[0].content;
  assert.doesNotMatch(modern,/询问用negotiate/);
  assert.match(modern,/询问、打听、确认用interact:ask/);
  assert.match(modern,/普通问答不能使用negotiate/);
  assert.match(modern,/至少两个.*可执行/);
  assert.match(buildStoryInput(GLM_PROFILE,context).messages[0].content,/询问用negotiate/,'legacy attempts retain their original action vocabulary');
});

test('modern narration receives the settled day and Chinese inventory including absent resources',()=>{
  const {state,pending}=encounter(),context=memory.buildStoryContext(state,pending);
  const modern=buildStoryInput({...GLM_PROFILE,storyActions:true},context).messages[0].content;
  assert.match(modern,new RegExp('本回合实际经过'+pending.receipt.elapsedDays+'日'));
  assert.match(modern,new RegExp('行粮='+context.life.items.supplies));
  assert.match(modern,/灵石=0/);
  assert.match(modern,/数量为0的物品不能持有、支付或赠出/);
  assert.match(modern,/没有列在itemChanges中的物品不能增减/);
});

test('modern wire declares entities after choices so every new choice target can be named',()=>{
  const state=createLiveGame({runId:'choice-declarations',seed:42}),context=memory.buildStoryContext(state,prepareOpening(state,{requestId:'declarations-opening'}));
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},context);
  assert.deepEqual(Object.keys(buildGlmWire(context,'instructions',{storyActions:true}).schema.properties),['blocks','choices','title','location','otherPeople','places','factions','memoryDeltas']);
  assert.match(input.messages[0].content,/先写blocks，再写choices，最后填写memoryDeltas/);
  assert.match(input.messages[0].content,/交谈或援助的对象必须先在本场正文出场/);
  const bad=sceneWire();bad.otherPeople=[];
  assert.throws(()=>decodeGlmScene(bad,context,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'},'undeclared new actors must still be rejected');
});

test('modern GLM constrains the output envelope without clipping prose or forcing action tuples',()=>{
  const state=createLiveGame({runId:'json-object',seed:42}),context=memory.buildStoryContext(state,prepareOpening(state,{requestId:'json-opening'}));
  const modern=buildStoryInput({...GLM_PROFILE,storyActions:true},context);
  assert.equal(modern.response_format.type,'json_schema');
  const schema=modern.response_format.json_schema.schema;
  assert.deepEqual(schema.required,['blocks','choices','title','location','memoryDeltas']);
  assert.equal(schema.additionalProperties,false);
  assert.equal(schema.properties.blocks.items.oneOf[0].properties.text.maxLength,undefined);
  assert.ok(schema.properties.choices.items.oneOf.every(row=>row.type==='object'&&row.additionalProperties===false&&['action','target','stake','purpose','anchor'].every(field=>row.required.includes(field)&&row.properties[field])));
  assert.match(modern.messages[0].content,/合法动作与目标/);
  assert.equal(modern.stream,true);
  assert.match(modern.messages.at(-1).content,/本次是开局.*当地人类/);
  assert.equal(buildStoryInput(GLM_PROFILE,context).response_format.type,'json_schema');
});

test('modern decoding tolerates only unchanged input echoes and never accepts model-owned state',()=>{
  const state=createLiveGame({runId:'input-echoes',seed:42}),context=memory.buildStoryContext(state,prepareOpening(state,{requestId:'echo-opening'})),wire=sceneWire();
  const expected=decodeGlmScene(wire,context,{storyActions:true}),echo=buildGlmWire(context,'instructions',{storyActions:true}).context;
  const repeated={...wire,...structuredClone(echo)};
  assert.deepEqual(decodeGlmScene(repeated,context,{storyActions:true}),expected);
  const changed=structuredClone(repeated);changed.life.items.stones=100;
  assert.throws(()=>decodeGlmScene(changed,context,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  assert.throws(()=>decodeGlmScene({...repeated,effects:{stones:100}},context,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  assert.throws(()=>decodeGlmScene(repeated,context),{code:'GENERATED_SCENE_INVALID'});
});

function encounter(text='林中传来求救声。岔路旁的村民请你先留意四周，再决定是否前去。'){
  const born=createLiveGame({runId:'coherent-story',name:'云归',seed:42}),opening=prepareOpening(born,{requestId:'coherent-opening'}),c=memory.buildStoryContext(born,opening),prefix=c.namespace+':t1:';
  const scene={id:prefix+'s:scene',title:'林间求救',location:'黑风林外',entities:[{id:prefix+'e:person_villager',name:'陈叔',kind:'person',status:'alive'},{id:prefix+'e:place_forest',name:'黑风林',kind:'place'}],blocks:[{kind:'narration',text}],choices:[{id:prefix+'c:a',label:'在树下歇息，等陈叔带回林中的消息',intent:'rest',targetId:'self',approach:'recover',stake:'low'},{id:prefix+'c:b',label:'沿小径前往黑风林',intent:'travel',targetId:prefix+'e:place_forest',approach:'road',stake:'low'}],memoryDeltas:[]};
  const state=commitTurn(born,opening,scene),pending=prepareChoice(state,{requestId:'coherent-choice',choiceId:scene.choices[0].id});return {state,pending,scene};
}

test('context includes the committed scene and selected purpose for existing journeys',()=>{
  const {state,pending,scene}=encounter(),before=structuredClone(state);
  for(const options of [{},{selection:'relevance-v1',openTotal:0}]){
    const c=memory.buildStoryContext(state,pending,[],options);
    assert.ok(c.memory.recent.some(row=>row.kind==='turn'&&row.text.includes('林中传来求救声')&&row.text.includes('黑风林外')),'a previousScene hash cannot stand in for its prose');
    assert.equal(c.receipt.action.label,scene.choices[0].label);memory.validateStoryContext(c);
    assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(c)))<=7000);assert.ok(Buffer.byteLength(JSON.stringify(buildStoryInput(GLM_PROFILE,c)))<=24576);
  }
  assert.deepEqual(state,before);
});

test('modern provider ends with the selected purpose while keeping the actual scene in history input',()=>{
  const {state,pending,scene}=encounter(),c=memory.buildStoryContext(state,pending),input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),last=input.messages.at(-1);
  assert.equal(input.messages.length,3);assert.equal(last.role,'user');
  assert.ok(last.content.endsWith(JSON.stringify(pending.receipt.action.label)+'}'));
  assert.equal(last.content.includes(scene.blocks[0].text),false,'do not repeat a historical NPC request after the current player choice');
  assert.ok(input.messages[1].content.includes(scene.blocks[0].text),'the actual previous scene remains in the bounded history context');
  assert.match(last.content,/询问必须具体作答/);
  assert.equal(buildStoryInput(GLM_PROFILE,c).messages.length,2);
});

test('recent scene memory is bounded, keeps the event ending and never splits emoji',()=>{
  const {state,scene}=encounter('📜'.repeat(700)+'林中忽然传来求救声');
  assert.equal(typeof memory.sceneTurnRecord,'function');
  const record=memory.sceneTurnRecord(scene,{runId:state.runId,turnId:state.turnId,action:state.lastReceipt.action});
  assert.equal(record.kind,'turn');assert.ok(record.text.length<=500);assert.ok(record.text.includes('黑风林外'));assert.ok(record.text.endsWith('林中忽然传来求救声'));
  assert.equal(record.text.isWellFormed(),true);assert.deepEqual(record.entityIds,[],'current-scene identities already live in context.entities');
});

test('context keeps current scene memory once when archive already has the turn record',()=>{
  const {state,pending,scene}=encounter();assert.equal(typeof memory.sceneTurnRecord,'function');
  const record=memory.sceneTurnRecord(scene,{runId:state.runId,turnId:state.turnId,action:state.lastReceipt.action});
  const c=memory.buildStoryContext(state,pending,[record],{selection:'relevance-v1',openTotal:0});
  assert.equal(c.memory.recent.filter(row=>row.id===record.id).length,1);assert.equal(new Set(c.references).size,c.references.length);memory.validateStoryContext(c);
});

test('legacy pending can rebuild the original context without new scene memory',()=>{
  const {state,pending}=encounter();
  const c=memory.buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0,continuity:false});
  assert.deepEqual(c.memory.recent,[]);assert.deepEqual(c.references,[]);assert.deepEqual(c.identity,pending.identity);assert.deepEqual(c.receipt,pending.receipt);
});

test('short story interactions keep the same day without granting resources or relations',()=>{
  for(const approach of ['ask','observe','decline','leave']){
    const {state,scene}=encounter(),targetId=scene.entities[0].id;
    state.currentScene.choices[0]={...scene.choices[0],label:'留意陈叔的反应',intent:'interact',targetId,approach,stake:'low'};
    const pending=prepareChoice(state,{requestId:'interaction-'+approach,choiceId:scene.choices[0].id});
    assert.equal(pending.receipt.elapsedDays,0);assert.equal(pending.nextLife.ageDays,state.life.ageDays);assert.deepEqual(pending.receipt.itemChanges,{});assert.deepEqual(pending.receipt.relationChanges,{});assert.equal(pending.nextLife.cultivation,state.life.cultivation);assert.equal(pending.nextLife.injury,state.life.injury);validateReceipt(pending.receipt);
  }
});

test('help consumes one day and one supply for a living person without inventing loot',()=>{
  const {state,scene}=encounter(),targetId=scene.entities[0].id;
  state.currentScene.choices[0]={...scene.choices[0],label:'拿出干粮照料陈叔',intent:'interact',targetId,approach:'help',stake:'low'};
  state.currentScene.choices[1]={...scene.choices[1],label:'先观察陈叔的情况',intent:'interact',targetId,approach:'observe',stake:'low'};
  const pending=prepareChoice(state,{requestId:'help-villager',choiceId:scene.choices[0].id});
  assert.equal(pending.receipt.elapsedDays,1);assert.deepEqual(pending.receipt.itemChanges,{supplies:-1});assert.deepEqual(pending.receipt.relationChanges,{[targetId]:2});assert.equal(pending.nextLife.cultivation,state.life.cultivation);validateReceipt(pending.receipt);
  let helped=commitTurn(state,pending,state.currentScene);
  while(helped.life.items.supplies>0)helped=commitTurn(helped,prepareChoice(helped,{requestId:'help-again-'+helped.turnId,choiceId:helped.currentScene.choices[0].id}),helped.currentScene);
  assert.equal(compileChoices(helped,helped.currentScene.choices)[0].enabled,false);
  state.relatedEntities[0].status='dead';state.currentScene.entities[0].status='dead';assert.throws(()=>compileChoices(state,state.currentScene.choices));
});

test('zero-day receipt allowance does not weaken old actions or paid help',()=>{
  const {state,pending}=encounter(),forged=structuredClone(pending.receipt);forged.elapsedDays=0;forged.after.ageDays=forged.before.ageDays;
  assert.throws(()=>validateReceipt(forged));
  state.currentScene.choices[0]={...state.currentScene.choices[0],intent:'interact',targetId:state.relatedEntities[0].id,approach:'help',stake:'low'};
  const help=structuredClone(prepareChoice(state,{requestId:'help-zero-forgery',choiceId:state.currentScene.choices[0].id}).receipt);help.elapsedDays=0;help.after.ageDays=help.before.ageDays;assert.throws(()=>validateReceipt(help));
});

function sceneWire(purposeful=false){
  const wire={blocks:[{kind:'narration',text:'陈叔拦住你，请你先听听林中的动静。'}],title:'林间求救',location:'林外',otherPeople:[{id:'p1',name:'陈叔',status:'alive'}],places:[],factions:[],choices:[{action:'interact:ask',targetId:'p1',stake:'low',label:'询问陈叔听到了什么',anchor:'陈叔拦住你'},{action:'interact:leave',targetId:'p1',stake:'low',label:'婉拒陈叔，结束这次交谈',anchor:'林中的动静'}],memoryDeltas:[]};
  if(purposeful)wire.choices.forEach((choice,index)=>{delete choice.label;choice.purpose=index?'结束这次交谈':'听到了什么';choice.anchor=0;});
  return wire;
}

test('GLM preserves specific story labels and verifies their quoted scene anchor',()=>{
  const state=createLiveGame({runId:'wire-coherent',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'wire-open'})),wire=sceneWire();
  const scene=decodeGlmScene(wire,c,{storyActions:true});assert.equal(scene.choices[0].label,'询问陈叔听到了什么');assert.equal(scene.choices[0].anchor,undefined);memory.validateGeneratedScene(scene,c);
  const missing=structuredClone(wire);delete missing.choices[0].anchor;assert.throws(()=>decodeGlmScene(missing,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  const foreign=structuredClone(wire);foreign.choices[0].anchor='街头忽然下起雨';assert.throws(()=>decodeGlmScene(foreign,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('modern block anchors refer only to an existing current paragraph',()=>{
  const state=createLiveGame({runId:'block-anchors',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'anchor-opening'})),wire=sceneWire();
  wire.choices.forEach(choice=>choice.anchor=0);
  const scene=decodeGlmScene(wire,c,{storyActions:true});memory.validateGeneratedScene(scene,c);
  assert.equal(scene.choices[0].anchor,undefined);
  for(const anchor of [-1,1,0.5,null,'0']){
    const bad=structuredClone(wire);bad.choices[0].anchor=anchor;
    assert.throws(()=>decodeGlmScene(bad,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  }
  assert.throws(()=>decodeGlmScene(wire,c),{code:'GENERATED_SCENE_INVALID'},'legacy generation does not accept modern numeric anchors');
  assert.deepEqual(buildGlmWire(c,'instructions',{storyActions:true}).schema.$defs.anchor,{type:'integer',minimum:0,maximum:1});
});

test('modern new memories take their text from current prose rather than unchosen options',()=>{
  const state=createLiveGame({runId:'memory-anchors',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'memory-opening'})),wire=sceneWire();
  wire.memoryDeltas=[{entityId:'p1',kind:'clue',anchor:0,status:'open'}];
  const scene=decodeGlmScene(wire,c,{storyActions:true});memory.validateGeneratedScene(scene,c);
  assert.equal(scene.memoryDeltas[0].text,wire.blocks[0].text);
  assert.equal(scene.memoryDeltas[0].anchor,undefined);
  for(const change of [m=>m.anchor=1,m=>m.anchor=-1,m=>m.anchor='0',m=>m.text='玩家已答应救人']){
    const bad=structuredClone(wire);change(bad.memoryDeltas[0]);assert.throws(()=>decodeGlmScene(bad,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  }
  assert.throws(()=>decodeGlmScene(wire,c),{code:'GENERATED_SCENE_INVALID'});
  const native=buildStoryInput({...GLM_PROFILE,storyActions:true},c).response_format.json_schema.schema.properties.memoryDeltas.items.oneOf;
  assert.ok(native.filter(row=>row.properties.kind).every(row=>row.required.includes('anchor')&&row.required.includes('target')),'new native memories cannot omit the source paragraph');
  assert.ok(native.some(row=>row.required.includes('referenceId')&&row.required.includes('status')&&!row.properties.anchor),'closure uses only the existing reference');
});

test('modern provider rejects implementation text and exploration disguised as observation',async()=>{
  const state=createLiveGame({runId:'narrative-guard',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'narrative-opening'}));
  const run=wire=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  const valid=sceneWire(true);
  assert.equal((await run(valid)).status,'ready');
  for(const text of ['陈叔收下了interact:help的护符。','陈叔说：灵石=0，行粮=3。']){
    const bad=structuredClone(valid);bad.blocks[0].text=text;
    assert.equal((await run(bad)).errorCode,'GENERATED_SCENE_INVALID');
  }
  const investigate=structuredClone(valid);investigate.choices[0]={action:'explore:cautious',targetId:'relic',stake:'low',purpose:'查看林中的痕迹',anchor:0};
  assert.equal((await run(investigate)).errorCode,'CHOICE_NOT_COMPILABLE','an unavailable relic search cannot replace the second executable response');
  investigate.choices[0].label='查看林中的痕迹';delete investigate.choices[0].purpose;
  assert.equal((await run(investigate)).errorCode,'GENERATED_SCENE_INVALID');
});

test('modern prose guards do not reject the unchanged text of an old obligation closure',async()=>{
  const {state,pending,scene}=encounter(),promise={id:'promise:legacy-inventory',runId:state.runId,turnId:1,source:'narrative',kind:'promise',entityId:scene.entities[0].id,text:'核对灵石=0的账页后，回来告知陈叔。',status:'open'};
  const c=memory.buildStoryContext(state,pending,[promise]),wire=sceneWire(true);wire.location=scene.location;wire.otherPeople=[{id:'k1'}];wire.choices.forEach(choice=>choice.targetId='k1');wire.memoryDeltas=[{referenceId:'m1',status:'resolved'}];
  const result=await generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal(result.status,'ready');assert.equal(result.scene.memoryDeltas[0].text,promise.text);
});

test('modern generation rejects copied prose and an already selected question without replacing it',async()=>{
  const {state,scene}=encounter('林中传来急切的求救声，陈叔站在岔路旁，详细说明他听到声音的方向和刚刚见过的脚印。');
  state.currentScene.choices[0]={...scene.choices[0],label:'询问陈叔：脚印的方向',intent:'interact',targetId:scene.entities[0].id,stake:'low',approach:'ask'};
  const pending=prepareChoice(state,{requestId:'follow-up',choiceId:scene.choices[0].id}),c=memory.buildStoryContext(state,pending),wire=sceneWire(true);wire.location=scene.location;wire.otherPeople=[{id:'k1'}];wire.choices.forEach(choice=>choice.targetId='k1');
  const run=(value,context=c)=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},context);
  const repeated=structuredClone(wire);repeated.blocks[0].text=scene.blocks[0].text;
  const observing=structuredClone(state);observing.currentScene.choices[0].approach='observe';
  const observingContext=memory.buildStoryContext(observing,prepareChoice(observing,{requestId:'repeat-observation',choiceId:scene.choices[0].id}));
  assert.equal((await run(repeated,observingContext)).errorCode,'REPEATED_SCENE');
  const question=structuredClone(wire);question.blocks=[{kind:'dialogue',speaker:'k1',text:'脚印朝林东的小路去了，泥痕很新，我却还没看见留下脚印的人。'}];question.choices[0].purpose='脚印的方向';
  const result=await run(question);assert.equal(result.status,'rejected');assert.equal(result.errorCode,'CHOICE_NOT_COMPILABLE');assert.equal(result.scene,undefined);
  question.choices[0]={action:'interact:observe',targetId:'self',stake:'low',purpose:'辨认林东小路的新泥痕',anchor:0};
  const changed=await run(question);assert.equal(changed.status,'ready');assert.equal(changed.scene.choices[0].label,'仔细观察：辨认林东小路的新泥痕');
});

test('modern actor choices compose their actual target and reject free executable labels',async()=>{
  const state=createLiveGame({runId:'actor-target',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'actor-opening'}));
  const run=wire=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  const wire=sceneWire(true);
  assert.equal((await run(wire)).status,'ready');
  const wrong=structuredClone(wire);wrong.choices[0]={action:'fight:assault',targetId:'p1',stake:'low',label:'尝试射杀野猪',anchor:0};
  assert.equal((await run(wrong)).errorCode,'GENERATED_SCENE_INVALID');
  const spoken=structuredClone(wire);spoken.blocks[0]={kind:'dialogue',speaker:'p1',text:'请你先听听林中的动静。'};
  assert.equal((await run(spoken)).status,'ready','a named dialogue speaker is present even without a repeated name in the text');
});

test('a requested dialogue quotation may repeat remembered wording',async()=>{
  const text='古碑上写着：山门已闭，来者若愿守信，当先查明林中异响的源头，再循旧路返回此地，切勿擅取井中的旧物。';
  const {state,scene}=encounter(text);state.currentScene.choices[0]={...scene.choices[0],label:'请陈叔逐字复述碑文',intent:'interact',targetId:scene.entities[0].id,stake:'low',approach:'ask'};
  const c=memory.buildStoryContext(state,prepareChoice(state,{requestId:'quote-request',choiceId:scene.choices[0].id})),wire=sceneWire(true);wire.location=scene.location;wire.otherPeople=[{id:'k1'}];wire.blocks=[{kind:'dialogue',speaker:'k1',text}];wire.choices.forEach(choice=>choice.targetId='k1');
  const result=await generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal(result.status,'ready');
});

test('zero-day interactions keep a known nearby actor and allow a generic exit',async()=>{
  const {state,scene}=encounter('陈叔站在林边，指着地上的脚印，请你先留意林中的动静。');state.currentScene.choices[0]={...scene.choices[0],label:'询问陈叔林中的动静',intent:'interact',targetId:scene.entities[0].id,stake:'low',approach:'ask'};
  const pending=prepareChoice(state,{requestId:'nearby-ask',choiceId:scene.choices[0].id}),c=memory.buildStoryContext(state,pending),wire=sceneWire(true);wire.location=scene.location;wire.otherPeople=[{id:'k1'}];wire.blocks=[{kind:'dialogue',speaker:'k1',text:'声音从林东边的小路传来，你可以自己决定是否前去。'}];wire.choices.forEach(choice=>choice.targetId='k1');wire.choices[1].purpose='结束这次交谈，独自思考';
  const run=context=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},context);
  assert.equal((await run(c)).status,'ready');
  assert.equal((await run(c)).scene.choices[0].targetId,scene.entities[0].id,'pronouns do not change the authoritative actor');
});

test('dangerous actor labels bind the actual object rather than a nearby ally',async()=>{
  const state=createLiveGame({runId:'attack-object',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'attack-opening'})),wire=sceneWire(true);wire.blocks[0].text='陈叔拔刀拦住你，不许你继续靠近。';
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  for(const label of ['射杀陈叔身旁的野猪','迎战陈叔身旁的野猪','为陈叔射杀野猪']){wire.choices[0]={action:'fight:guard',targetId:'p1',stake:'low',label,anchor:0};assert.equal((await run(wire)).errorCode,'GENERATED_SCENE_INVALID');}
  wire.choices[0]={action:'fight:guard',targetId:'p1',stake:'low',purpose:'谨慎格挡陈叔的攻势',anchor:0};const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices[0].label,'迎战陈叔，稳守：谨慎格挡陈叔的攻势');
});

test('new anchored observations without a commitment are facts, while legacy promise records stay unchanged',()=>{
  const state=createLiveGame({runId:'explicit-promises',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'promise-opening'})),wire=sceneWire();
  wire.choices.forEach(choice=>choice.anchor=0);
  wire.memoryDeltas=[{entityId:'p1',kind:'promise',anchor:0,status:'open'}];
  const fact=decodeGlmScene(wire,c,{storyActions:true}).memoryDeltas[0];assert.equal(fact.kind,'fact');assert.equal(fact.status,undefined);assert.equal(fact.text,wire.blocks[0].text);
  wire.blocks[0].text='陈叔承诺明日带你到林边查探。';assert.equal(decodeGlmScene(wire,c,{storyActions:true}).memoryDeltas[0].kind,'promise');
  wire.blocks[0].text='陈叔没有答应你的请求，只让你自行决定。';assert.equal(decodeGlmScene(wire,c,{storyActions:true}).memoryDeltas[0].kind,'fact');
  const old=sceneWire();old.memoryDeltas=[{entityId:'p1',kind:'promise',text:old.blocks[0].text,status:'open'}];assert.equal(decodeGlmScene(old,c,{storyActions:true}).memoryDeltas[0].kind,'promise');
});

test('modern purposes retain concrete goals while the server names the executable action and target',async()=>{
  const state=createLiveGame({runId:'purpose-actions',seed:42}),pending=prepareOpening(state,{requestId:'purpose-opening'}),c=memory.buildStoryContext(state,pending),wire=sceneWire();
  wire.otherPeople[0].name='百草堂掌柜';wire.blocks[0].text='百草堂掌柜指着院后的井沿，说里面传来求救声。';
  wire.choices.forEach((choice,index)=>{delete choice.label;choice.purpose=index?'结束这次交谈':'这求救声从何而来';choice.anchor=0;});
  const before=structuredClone(wire),scene=decodeGlmScene(wire,c,{storyActions:true});
  assert.equal(scene.choices[0].label,'询问百草堂掌柜：这求救声从何而来');assert.equal(scene.choices[0].purpose,undefined);assert.deepEqual(wire,before);
  const active=commitTurn(state,pending,scene),next=prepareChoice(active,{requestId:'purpose-follow',choiceId:scene.choices[0].id});assert.equal(next.receipt.action.label,scene.choices[0].label);
  const result=await generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(wire,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);assert.equal(result.status,'ready');
  for(const change of [choice=>choice.purpose=' ',choice=>choice.purpose='长'.repeat(51),choice=>choice.label='不同的可执行指令']){const bad=structuredClone(wire);change(bad.choices[0]);assert.throws(()=>decodeGlmScene(bad,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});}
  assert.throws(()=>decodeGlmScene(wire,c),{code:'GENERATED_SCENE_INVALID'});
});

test('new interaction grammar is enabled only by the negotiated capability',()=>{
  const {state,pending}=encounter(),c=memory.buildStoryContext(state,pending);
  const modern=buildGlmWire(c,'instructions',{storyActions:true}).schema.properties.choices.items.oneOf;
  const legacy=buildGlmWire(c,'instructions').schema.properties.choices.items.oneOf;
  assert.ok(modern.some(row=>row.properties.action.enum.includes('interact:ask')));assert.equal(legacy.some(row=>row.properties.action.enum.some(action=>action.startsWith('interact:'))),false);
  assert.ok(modern.every(row=>row.required.includes('purpose')&&row.required.includes('anchor')));
  const born=createLiveGame({runId:'legacy-wire',seed:42}),opening=memory.buildStoryContext(born,prepareOpening(born,{requestId:'old-wire'}));assert.throws(()=>decodeGlmScene(sceneWire(),opening),{code:'GENERATED_SCENE_INVALID'});
});

test('two concrete questions to the same person retain distinct purposes while exact duplicates fail',()=>{
  const state=createLiveGame({runId:'different-questions',seed:42}),c=memory.buildStoryContext(state,prepareOpening(state,{requestId:'questions-open'})),wire=sceneWire();
  wire.choices[1]={...wire.choices[0],label:'询问陈叔是否见过求救的人'};
  const scene=decodeGlmScene(wire,c,{storyActions:true});assert.doesNotThrow(()=>memory.validateGeneratedScene(scene,c));
  const repeated=structuredClone(scene);repeated.choices[1].label=repeated.choices[0].label;assert.throws(()=>memory.validateGeneratedScene(repeated,c),{code:'GENERATED_SCENE_INVALID'});
});

function crowded(count,{longIds=false,nameLength=1}={}){
  const state=createLiveGame({runId:'crowded-'+count+'-'+nameLength,seed:42}),pending=prepareOpening(state,{requestId:'crowded-open'}),context=memory.buildStoryContext(state,pending),prefix=context.namespace+':t1:';
  const scene={id:prefix+'s:scene',title:'林间议事',location:'林外',blocks:[{kind:'narration',text:'众人聚在林边，等你决定是否继续留意林中的动静。'}],entities:Array.from({length:count},(_,index)=>({id:longIds?(prefix+'e:person_'+index).padEnd(80,'x'):prefix+'e:person_'+index,name:index+'名'.repeat(nameLength),kind:'person',status:'alive'})),choices:[{id:prefix+'c:a',label:'在树下歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:b',label:'凝神修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};
  return {state,pending,context,scene};
}

test('old valid scenes with long entity identities remain recoverable with current-scene memory',()=>{
  const {state,pending,context,scene}=crowded(22,{longIds:true}),active=commitTurn(state,pending,scene),next=prepareChoice(active,{requestId:'r'.repeat(80),choiceId:scene.choices[0].id});
  assert.doesNotThrow(()=>memory.validateGeneratedScene(scene,context));
  const c=memory.buildStoryContext(active,next,[],{selection:'relevance-v1',openTotal:Number.MAX_SAFE_INTEGER});assert.ok(c.memory.recent.length);assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(c)))<=7000);
});

test('modern provider requests fit dense contexts and known identities are sent once',()=>{
  const {state,pending,scene}=crowded(24,{nameLength:20}),active=commitTurn(state,pending,scene),next=prepareChoice(active,{requestId:'r'.repeat(36),choiceId:scene.choices[0].id}),c=memory.buildStoryContext(active,next,[],{selection:'relevance-v1',openTotal:0});
  assert.doesNotThrow(()=>buildStoryInput({...GLM_PROFILE,storyActions:true},c));
  const schema=buildGlmWire(c,'instructions',{storyActions:true}).schema.properties.otherPeople.items.oneOf;
  assert.ok(schema.some(row=>row.properties.id.enum?.some(id=>id.startsWith('k24_person_'))&&row.properties.name===undefined),'known names belong to trusted context, not repeated per-entity grammar');
  const known=schema.find(row=>row.properties.id.enum?.some(id=>id.startsWith('k24_person_')));
  assert.deepEqual(known.properties.status.enum,['alive','dead'],'declaring an unchanged living NPC must not force a death');
});

test('continuation admission invokes the actual provider input budget before accepting a new scene',()=>{
  const {context,scene}=crowded(3);let checked=0;
  assert.throws(()=>memory.validateGeneratedScene(scene,context,{checkNextContext:next=>{checked++;buildStoryInput({...GLM_PROFILE,storyActions:true,maxInput:100},next);}}),{code:'NEXT_CONTEXT_TOO_LARGE'});assert.equal(checked,1);
  assert.doesNotThrow(()=>memory.validateGeneratedScene(scene,context),'canonical old-history replay has no new provider gate');
});

test('modern dense inputs include optional obligations within the actual serialized provider budget',()=>{
  let checked=0;
  for(const count of [8,16,24])for(const nameLength of [1,10,20,30,40,50]){
    const {state,pending,scene}=crowded(count,{nameLength}),active=commitTurn(state,pending,scene),next=prepareChoice(active,{requestId:'r'.repeat(80),choiceId:scene.choices[0].id});
    const records=scene.entities.map((entity,index)=>({id:'grid-memory:'+index,runId:state.runId,turnId:1,source:'narrative',kind:index%2?'clue':'promise',entityId:entity.id,text:'应记住林边的约定，有机会时再打听这件事的后续。'.repeat(3),status:'open'}));
    let c;try{c=memory.buildStoryContext(active,next,records,{selection:'relevance-v1',openTotal:records.length});}catch(error){assert.equal(error.code,'MEMORY_CONTEXT_TOO_LARGE');continue;}
    assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(c)))<=7000);assert.doesNotThrow(()=>buildStoryInput({...GLM_PROFILE,storyActions:true},c));checked++;
  }
  assert.ok(checked>=12);
});

test('known modern declarations restore their names and preserve canonical death checks',()=>{
  const {state,pending}=encounter(),c=memory.buildStoryContext(state,pending),wire=sceneWire();wire.otherPeople=[{id:'k1'}];wire.choices.forEach(choice=>choice.targetId='k1');
  const scene=decodeGlmScene(wire,c,{storyActions:true});assert.equal(scene.entities[0].name,'陈叔');assert.equal(scene.entities[0].status,'alive');memory.validateGeneratedScene(scene,c);
  const malformed=structuredClone(wire);malformed.otherPeople[0].status=null;assert.throws(()=>decodeGlmScene(malformed,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  const dead=structuredClone(c);dead.entities[0].status='dead';wire.otherPeople[0].status='alive';assert.throws(()=>memory.validateGeneratedScene(decodeGlmScene(wire,dead,{storyActions:true}),dead),{code:'ENTITY_DEATH_CONFLICT'});
});
