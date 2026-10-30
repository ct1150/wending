import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {buildGlmWire,decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {generateScene} from '../src/worker/story-provider.js';
import {normalizeNamedScene} from '../src/worker/story-named-targets.js';

const person=(name='陈叔',ref=null,status=null)=>({kind:'person',name,ref,status});

test('arrival keeps a real withdrawal without requiring a paired fight or a free conversation exit',async()=>{
  const f=fixture();f.wire.choices[0]={action:'travel:road',target:{kind:'place',name:'山道',ref:'',status:null},stake:'low',purpose:'前往山道',anchor:0};const opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),travel=prepareChoice(active,{requestId:'arrival',choiceId:opening.choices[0].id}),context=buildStoryContext(active,travel),target=person('赤焰虎'),wire={blocks:[{kind:'narration',text:'赤焰虎已经发现你，向你低吼。'}],title:'林间遇险',location:'山道',choices:[{action:'interact:ask',target,stake:'low',purpose:'询问赤焰虎为何在此',anchor:0},{action:'interact:observe',target,stake:'low',purpose:'观察赤焰虎的动作',anchor:0},{action:'evade:withdraw',target,stake:'low',purpose:'避开赤焰虎的攻击',anchor:0}],memoryDeltas:[]};
  wire.choices.shift();const run=()=>generateProviderScene({run:async()=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},context),result=await run();
  assert.equal(result.status,'ready');assert.deepEqual(result.scene.choices.map(choice=>choice.approach),['observe','withdraw']);assert.ok(!result.scene.choices.some(choice=>choice.approach==='leave'));validateGeneratedScene(result.scene,context,{requireExit:true});
  const state=commitTurn(active,travel,result.scene),pending=prepareChoice(state,{requestId:'escape',choiceId:result.scene.choices[1].id});assert.equal(pending.receipt.elapsedDays,14);
  wire.blocks[0].text='卖饼老汉在山道口摆摊。';for(const choice of wire.choices)choice.target=person('卖饼老汉');wire.choices[0]={...wire.choices[0],action:'interact:ask',purpose:'询问饼价'};wire.choices[1]={...wire.choices[1],action:'interact:leave',purpose:'结束交谈'};assert.equal((await run()).status,'ready','a present human can be asked before speaking');
  wire.blocks[0].text='山道口只有风声，没有旁人。';assert.equal((await run()).errorCode,'CHOICE_NOT_COMPILABLE','newly declared actors must actually occur in the prose');
});
function fixture(){
  const state=createLiveGame({runId:'named-targets',seed:42}),pending=prepareOpening(state,{requestId:'named-open'}),context=buildStoryContext(state,pending),actor=person();
  const wire={blocks:[{kind:'dialogue',speaker:actor,text:'陈叔说道：林东有人呼救，你愿意先听听经过吗？'}],choices:[{action:'interact:ask',target:actor,stake:'low',purpose:'求救声从哪里传来',anchor:0},{action:'interact:leave',target:actor,stake:'low',purpose:'结束这次交谈',anchor:0}],title:'林边求救',location:'林边',memoryDeltas:[{target:actor,kind:'clue',anchor:0,status:'open'}]};
  return {state,pending,context,wire};
}

test('named dialogue, choice and memory resolve to one server-owned entity without a separate alias list',()=>{
  const {context,wire}=fixture(),before=structuredClone({context,wire}),scene=decodeGlmScene(wire,context,{storyActions:true});validateGeneratedScene(scene,context);
  assert.equal(scene.entities.length,1);assert.equal(scene.entities[0].name,'陈叔');assert.equal(scene.blocks[0].speaker,scene.entities[0].id);assert.equal(scene.choices[0].targetId,scene.entities[0].id);assert.equal(scene.memoryDeltas[0].entityId,scene.entities[0].id);assert.deepEqual({context,wire},before);
  assert.throws(()=>decodeGlmScene(wire,context),{code:'GENERATED_SCENE_INVALID'});
});

test('a visible known reference must agree with the complete name and kind',()=>{
  const f=fixture(),opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'named-known',choiceId:opening.choices[0].id})),ref=buildGlmWire(c,'',{storyActions:true}).context.entities[0].id,wire=structuredClone(f.wire);
  wire.blocks[0].speaker=person('陈叔',ref);wire.choices.forEach(choice=>choice.target=person('陈叔',ref));wire.memoryDeltas[0].target=person('陈叔',ref);
  assert.equal(decodeGlmScene(wire,c,{storyActions:true}).choices[0].targetId,opening.entities[0].id);
  for(const target of [person('野猪',ref),{kind:'place',name:'陈叔',ref,status:null},person('陈叔','foreign-reference')]){const bad=structuredClone(wire);bad.choices[0].target=target;assert.throws(()=>decodeGlmScene(bad,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});}
  wire.blocks[0].speaker.ref=null;wire.choices.forEach(choice=>choice.target.ref=null);wire.memoryDeltas[0].target.ref=null;assert.equal(decodeGlmScene(wire,c,{storyActions:true}).entities[0].id,opening.entities[0].id,'a unique known name reuses its identity even without ref');
});

test('equal names in an existing journey require a reference and keep their distinct identities',()=>{
  const f=fixture(),p=f.context.namespace+':t1:',entities=[1,2].map(i=>({id:p+'e:person_'+i,kind:'person',name:'同名村民'})),opening={id:p+'s:scene',title:'路口',location:'林边',blocks:[{kind:'narration',text:'两位同名村民在路口相候。'}],entities,choices:[{id:p+'c:a',label:'在路边调息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:p+'c:b',label:'结束当前互动',intent:'interact',targetId:'self',stake:'low',approach:'leave'}],memoryDeltas:[]};
  const active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'named-duplicate',choiceId:opening.choices[0].id})),wire=structuredClone(f.wire);wire.blocks=[{kind:'narration',text:'两位同名村民仍在路口等候。'}];wire.memoryDeltas=[];wire.choices.forEach(choice=>choice.target=person('同名村民'));
  assert.throws(()=>decodeGlmScene(wire,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  wire.choices.forEach((choice,i)=>choice.target.ref=buildGlmWire(c,'',{storyActions:true}).context.entities[i].id);const scene=decodeGlmScene(wire,c,{storyActions:true});assert.equal(new Set(scene.entities.map(entity=>entity.id)).size,2);assert.deepEqual(scene.choices.map(choice=>choice.targetId),entities.map(entity=>entity.id));
});

test('visible aliases never collide with the hidden formal-ID namespace',()=>{
  const {wire}=fixture(),context={entities:[{id:'old:person1',kind:'person',name:'Alice'},{id:'k1_person_Alic',kind:'person',name:'Alice'}]};wire.blocks=[{kind:'narration',text:'Alice在路边等候。'}];wire.memoryDeltas=[];wire.choices.forEach(choice=>choice.target=person('Alice','k1_person_Alic'));
  const normalized=normalizeNamedScene(wire,context);assert.equal(normalized.choices[0].targetId,'k1');wire.choices[0].target.ref='old:person1';assert.throws(()=>normalizeNamedScene(wire,context),'formal IDs are not model-visible references');
});

test('unspecified status stays unspecified and contradictory explicit references are rejected',()=>{
  const f=fixture(),opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=structuredClone(buildStoryContext(active,prepareChoice(active,{requestId:'named-status',choiceId:opening.choices[0].id})));c.entities[0].status='unknown';
  const scene=decodeGlmScene(f.wire,c,{storyActions:true});assert.equal(Object.hasOwn(scene.entities[0],'status'),false);
  const bad=JSON.parse(JSON.stringify(f.wire));bad.blocks[0].speaker.status='alive';bad.choices[0].target.status='dead';assert.throws(()=>decodeGlmScene(bad,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('normalization cannot discard model-owned state or unknown nested fields',()=>{
  const {context,wire}=fixture(),nested=JSON.parse(JSON.stringify(wire)),choice=JSON.parse(JSON.stringify(wire));nested.choices[0].target.effect={stones:100};choice.choices[0].effect={stones:100};
  for(const bad of [{...structuredClone(wire),receipt:{}},{...structuredClone(wire),otherPeople:[]},nested,choice])assert.throws(()=>decodeGlmScene(bad,context,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('a named destination has its own place identity rather than reusing an unrelated person',()=>{
  const {context,wire}=fixture();wire.choices[0]={action:'travel:road',target:{kind:'place',name:'东边山林',ref:null,status:null},stake:'low',purpose:'前往东边山林寻找线索',anchor:0};const scene=decodeGlmScene(wire,context,{storyActions:true});validateGeneratedScene(scene,context);assert.equal(scene.entities.find(entity=>entity.id===scene.choices[0].targetId).kind,'place');assert.notEqual(scene.choices[0].targetId,scene.blocks[0].speaker);
});

test('native modern schema names its targets inline while legacy schema stays unchanged',()=>{
  const {context}=fixture(),schema=buildStoryInput({...GLM_PROFILE,storyActions:true},context).response_format.json_schema.schema;
  assert.deepEqual(schema.required,['blocks','choices','title','location','memoryDeltas']);assert.ok(schema.properties.choices.items.oneOf.every(row=>row.required.includes('target')&&!row.required.includes('targetId')));assert.equal(buildStoryInput(GLM_PROFILE,context).response_format.json_schema.schema.properties.otherPeople!==undefined,true);
  assert.equal(schema.$defs.personTarget.properties.ref.const,'');assert.equal(schema.$defs.placeTarget.properties.ref.const,'');
  const duplicate={...context,entities:[{id:'old:a',kind:'person',name:'同名村民',status:'alive'},{id:'old:b',kind:'person',name:'同名村民',status:'alive'}]},ambiguous=buildStoryInput({...GLM_PROFILE,storyActions:true},duplicate).response_format.json_schema.schema;assert.equal(ambiguous.$defs.personTarget.properties.ref.type,'string');assert.equal(ambiguous.$defs.placeTarget.properties.ref.const,'');
});

test('named targets stream real block text and preserve the production final validation boundary',async()=>{
  const {context,wire}=fixture(),events=[],content=JSON.stringify(wire),encoder=new TextEncoder();let calls=0;
  const ai={run:async(model,input)=>{calls++;assert.equal(input.response_format.json_schema.schema.properties.otherPeople,undefined);return new ReadableStream({start(controller){for(let index=0;index<content.length;index+=17)controller.enqueue(encoder.encode('data: '+JSON.stringify({model,choices:[{delta:{content:content.slice(index,index+17)}}]})+'\n\n'));controller.enqueue(encoder.encode('data: '+JSON.stringify({model,choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})+'\n\ndata: [DONE]\n\n'));controller.close();}});}};
  const result=await generateScene(ai,{...GLM_PROFILE,validated:true,supportsStructuredOutput:true,validationEvidence:'test-fixture-only'},context,{}, {storyActions:true,onProgress:event=>events.push(event)});
  assert.equal(result.status,'ready');assert.equal(calls,1);assert.ok(events.some(event=>event.type==='preview'&&event.text.includes('林东有人呼救')));assert.ok(events.filter(event=>event.type==='preview').every(event=>!event.text.includes('ref')&&!event.text.includes('target')));assert.equal(result.scene.choices[0].targetId,result.scene.blocks[0].speaker);
});

test('named memory closure keeps the original obligation and literals remain rule-owned targets',()=>{
  const f=fixture(),opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),pending=prepareChoice(active,{requestId:'named-close',choiceId:opening.choices[0].id}),record={id:'clue:old',runId:active.runId,turnId:1,source:'narrative',kind:'clue',entityId:opening.entities[0].id,text:'留意林东的呼救声。',status:'open'},c=buildStoryContext(active,pending,[record]),wire=structuredClone(f.wire);
  wire.memoryDeltas=[{referenceId:'m1',status:'resolved'}];wire.choices[0]={action:'explore:cautious',target:'supplies',stake:'low',purpose:'在林边寻找行粮',anchor:0};const scene=decodeGlmScene(wire,c,{storyActions:true});assert.equal(scene.choices[0].targetId,'supplies');assert.equal(scene.memoryDeltas[0].referenceId,record.id);assert.equal(scene.memoryDeltas[0].text,record.text);assert.equal(scene.memoryDeltas[0].entityId,record.entityId);
});

test('named status cannot revive the dead or kill an existing person without a death record',()=>{
  const f=fixture(),opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'named-death',choiceId:opening.choices[1].id})),wire=JSON.parse(JSON.stringify(f.wire));
  wire.blocks=[{kind:'narration',text:'陈叔突然倒下，已经断气。'}];wire.choices=[{action:'interact:observe',target:'self',stake:'low',purpose:'查看眼前的情况',anchor:0},{action:'interact:leave',target:'self',stake:'low',purpose:'暂不介入',anchor:0}];wire.memoryDeltas=[{target:person('陈叔',null,'dead'),kind:'death',anchor:0}];
  const scene=decodeGlmScene(wire,c,{storyActions:true});validateGeneratedScene(scene,c);assert.equal(scene.entities[0].status,'dead');
  wire.memoryDeltas[0].target.status=null;assert.equal(decodeGlmScene(wire,c,{storyActions:true}).entities[0].status,'dead','an explicit death fact supplies the state without a second model assertion');
  const noRecord={...wire,memoryDeltas:[{target:person('陈叔',null,'dead'),kind:'fact',anchor:0}]};assert.throws(()=>validateGeneratedScene(decodeGlmScene(noRecord,c,{storyActions:true}),c),{code:'ENTITY_DEATH_FACT_REQUIRED'});
  const deadContext=structuredClone(c);deadContext.entities[0].status='dead';const revived=JSON.parse(JSON.stringify(f.wire));revived.blocks[0].speaker.status='alive';assert.throws(()=>validateGeneratedScene(decodeGlmScene(revived,deadContext,{storyActions:true}),deadContext),{code:'ENTITY_DEATH_CONFLICT'});
});

test('empty and textual null references mean no reference and never disambiguate equal names',()=>{
  const {context,wire}=fixture(),expected=decodeGlmScene(wire,context,{storyActions:true});for(const ref of ['', 'null']){const value=JSON.parse(JSON.stringify(wire));value.choices.forEach(choice=>choice.target.ref=ref);value.blocks[0].speaker.ref=ref;value.memoryDeltas[0].target.ref=ref;assert.deepEqual(decodeGlmScene(value,context,{storyActions:true}),expected);}
  const duplicate={entities:[{id:'old:first',name:'陈叔',kind:'person'},{id:'old:second',name:'陈叔',kind:'person'}]},value=JSON.parse(JSON.stringify(wire));value.blocks[0].speaker.ref='null';assert.throws(()=>normalizeNamedScene(value,duplicate));
});

test('new inference rejects an old alias-only response while its historical decoder remains available',async()=>{
  const {context}=fixture(),wire={blocks:[{kind:'narration',text:'陈叔在林边等候。'}],title:'林边',location:'林边',otherPeople:[{id:'p1',name:'陈叔'}],places:[],factions:[],choices:[{action:'interact:ask',targetId:'p1',stake:'low',purpose:'求救声从何处传来',anchor:0},{action:'interact:leave',targetId:'p1',stake:'low',purpose:'结束当前交谈',anchor:0}],memoryDeltas:[]};
  validateGeneratedScene(decodeGlmScene(wire,context,{storyActions:true}),context);
  const encoder=new TextEncoder();let calls=0;const ai={run:async model=>{calls++;return new ReadableStream({start(controller){controller.enqueue(encoder.encode('data: '+JSON.stringify({model,choices:[{delta:{content:JSON.stringify(wire)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})+'\n\ndata: [DONE]\n\n'));controller.close();}});}};
  const result=await generateScene(ai,{...GLM_PROFILE,validated:true,supportsStructuredOutput:true,validationEvidence:'test-fixture-only'},context,{}, {storyActions:true});assert.equal(result.errorCode,'GENERATED_SCENE_INVALID');assert.equal(calls,1);assert.equal(result.accountingStatus,'complete');
});
