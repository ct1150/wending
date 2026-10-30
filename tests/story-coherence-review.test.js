import {namedGlmFixture} from './helpers/named-glm-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice,resolveImmediateInteraction} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene,sceneTurnRecord} from '../src/game/cultivation/live/memory.js';
import {buildGlmWire,decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';

function targetKinds(node,defs){return node.$ref?targetKinds(defs[node.$ref.split('/').at(-1)],defs):node.oneOf?node.oneOf.flatMap(row=>targetKinds(row,defs)):node.properties?.kind?[node.properties.kind.const]:node.enum??[];}
function fixture(){
  const state=createLiveGame({runId:'review-coherence',seed:42}),pending=prepareOpening(state,{requestId:'review-opening'}),context=buildStoryContext(state,pending);
  const wire={blocks:[{kind:'narration',text:'陈叔在林边等你回应求助，可以询问，也可以结束这次交谈。'}],title:'林边交谈',location:'林边',otherPeople:[{id:'p1',name:'陈叔',status:'alive'}],places:[{id:'l1',name:'山道'}],factions:[],choices:[{action:'interact:ask',targetId:'p1',stake:'low',purpose:'求助的具体原因是什么',anchor:0},{action:'interact:leave',targetId:'p1',stake:'low',purpose:'结束这次交谈',anchor:0}],memoryDeltas:[]};
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},context);
  return {state,pending,context,wire,run};
}

test('observing after a local closure keeps independent choices and cannot replay an old request from a clue',async()=>{
  for(const approach of ['decline','leave']){
    const f=fixture();f.wire.choices[1].action='interact:'+approach;f.wire.blocks[0].text+='陈叔拿着绳子在林边来回踱步，不时望向山道，等你决定是否参与这件事情。';const opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),p=prepareChoice(active,{requestId:'close-'+approach,choiceId:opening.choices[1].id}),closed=resolveImmediateInteraction(active,p),ended=commitTurn(active,p,closed),record=sceneTurnRecord(closed,{runId:ended.runId,turnId:ended.turnId,action:p.receipt.action});
    assert.deepEqual(record.entityIds,[opening.entities[0].id]);const oldClue={id:'old-clue',runId:ended.runId,turnId:1,source:'narrative',kind:'clue',entityId:opening.entities[0].id,text:opening.blocks[0].text,status:'open'},context=buildStoryContext(ended,prepareChoice(ended,{requestId:'after-close-'+approach,choiceId:closed.choices[0].id}),[oldClue]),alias=buildGlmWire(context,'',{storyActions:true}).context.entities.find(entity=>entity.kind==='person').id;
    const reply=structuredClone(f.wire);reply.blocks=[{kind:'narration',text:'你转向村外的河岸，注意到泥地里有新留下的脚印。'}];reply.otherPeople=[{id:alias}];reply.places=[{id:'l1',name:'河岸'}];reply.choices.forEach(choice=>choice.targetId=alias);reply.choices.push({action:'travel:road',targetId:'l1',stake:'low',purpose:'前往河岸查看脚印',anchor:0});
    const run=(inputContext=context)=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(reply,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},inputContext),fresh=await run();assert.equal(fresh.status,'ready');assert.ok(fresh.scene.choices.every(choice=>choice.intent!=='interact'||choice.targetId!==opening.entities[0].id));assert.ok(fresh.scene.choices.some(choice=>choice.intent==='travel'));assert.equal(fresh.scene.choices.find(choice=>choice.approach==='leave')?.targetId,'self');
    const legacyContext=structuredClone(context);legacyContext.memory.recent.find(row=>row.turnId===ended.turnId).entityIds=[];legacyContext.memory.facts.push({id:'decision:'+ended.turnId,runId:ended.runId,turnId:ended.turnId,source:'rules',kind:'fact',entityId:opening.entities[0].id,text:'你已结束这次交谈。'});legacyContext.references.push('decision:'+ended.turnId);let legacy=await run(legacyContext);assert.equal(legacy.status,'ready');assert.ok(legacy.scene.choices.every(choice=>choice.intent!=='interact'||choice.targetId!==opening.entities[0].id));const unknownContext=structuredClone(context);unknownContext.memory.recent.find(row=>row.turnId===ended.turnId).entityIds=[];legacy=await run(unknownContext);assert.equal(legacy.status,'ready');assert.ok(legacy.scene.choices.every(choice=>choice.intent!=='interact'||choice.targetId!==opening.entities[0].id));
    reply.blocks=[{kind:'narration',text:oldClue.text}];assert.equal((await run()).errorCode,'REPEATED_SCENE');
    reply.blocks=[{kind:'narration',text:'你转过身，看到河岸草丛中一头青狼向你逼近，必须决定如何应对。'}];reply.otherPeople=[{id:'p2',name:'青狼'}];reply.places=[];reply.choices=[{action:'fight:guard',targetId:'p2',stake:'low',purpose:'挡住青狼的攻击',anchor:0},{action:'evade:withdraw',targetId:'p2',stake:'low',purpose:'避开青狼并撤出攻击范围',anchor:0}];const danger=await run();assert.equal(danger.status,'ready');assert.ok(danger.scene.choices.some(choice=>choice.intent==='evade'));assert.ok(!danger.scene.choices.some(choice=>choice.approach==='leave'));
    reply.places=[{id:'l1',name:'河岸'}];reply.choices=[{action:'travel:road',targetId:'l1',stake:'low',purpose:'前往河岸查看脚印',anchor:0},{action:'interact:observe',targetId:'self',stake:'low',purpose:'观察草丛中的动静',anchor:0},reply.choices[1]];const retreat=await run();assert.equal(retreat.status,'ready');assert.ok(retreat.scene.choices.some(choice=>choice.intent==='evade'));assert.ok(!retreat.scene.choices.some(choice=>choice.approach==='leave'));
  }
});

test('new inference requires purposeful choices and anchored memories; historical decoding stays compatible',async()=>{
  const {wire,context,run}=fixture();assert.equal((await run(wire)).status,'ready');
  const old=structuredClone(wire);for(const choice of old.choices){choice.label='询问陈叔：'+choice.purpose;delete choice.purpose;}
  assert.doesNotThrow(()=>decodeGlmScene(old,context,{storyActions:true}));
  assert.equal((await run(old)).errorCode,'GENERATED_SCENE_INVALID');
  const invented=structuredClone(wire);invented.memoryDeltas=[{entityId:'p1',kind:'promise',text:'你已答应陈叔来日相助。',status:'open'}];
  assert.doesNotThrow(()=>decodeGlmScene(invented,context,{storyActions:true}));
  assert.equal((await run(invented)).errorCode,'GENERATED_SCENE_INVALID');
});

test('an explicitly rejected request does not create an open promise',()=>{
  const {wire,context}=fixture();wire.memoryDeltas=[{entityId:'p1',kind:'promise',anchor:0,status:'open'}];
  for(const text of ['陈叔希望你答应来日相助，但你明确拒绝了这个请求。','陈叔请求你承诺同行，你婉拒了他的邀请。','你拒绝答应来日相助，陈叔让你自行离开。']){
    wire.blocks[0].text=text;const record=decodeGlmScene(wire,context,{storyActions:true}).memoryDeltas[0];
    assert.equal(record.kind,'fact');assert.equal(record.status,undefined);assert.equal(record.text,text);
  }
});

test('a fresh event keeps an executable way to end the current interaction',async()=>{
  const {wire,run}=fixture();wire.choices[1]={action:'interact:observe',targetId:'self',stake:'low',purpose:'看看林边的动静',anchor:0};
  const noExit=await run(wire);assert.equal(noExit.status,'ready');assert.ok(noExit.scene.choices.some(choice=>choice.id.endsWith(':c:leave')&&choice.intent==='interact'&&choice.approach==='leave'&&choice.targetId===noExit.scene.entities[0].id));
  wire.choices[1]={action:'interact:leave',targetId:'self',stake:'low',purpose:'结束这次交谈',anchor:0};assert.equal((await run(wire)).status,'ready');
  wire.choices[1]={action:'interact:decline',targetId:'p1',stake:'low',purpose:'拒绝这次请求，不再介入',anchor:0};assert.equal((await run(wire)).status,'ready','refusing the current request is a valid way out of it');
});

test('automatic opt-out uses self when a newly declared actor is absent from the prose',async()=>{
  const {wire,run}=fixture();wire.blocks=[{kind:'narration',text:'荒坡上只有一只黑熊，四下没有其他人。'}];wire.otherPeople[0].name='王大伯';wire.choices=[{action:'interact:observe',targetId:'self',stake:'low',purpose:'观察黑熊的动静',anchor:0},{action:'rest:recover',targetId:'self',stake:'low',purpose:'在原地稍作休息',anchor:0}];
  const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices.find(choice=>choice.approach==='leave').targetId,'self');
});

test('following a quest destination does not replace the option to stop engaging',async()=>{
  const {wire,run}=fixture();wire.blocks[0].text='陈叔指向山道，说那边有人呼救，你可以进一步询问、前去，也可以不介入。';
  wire.choices=[wire.choices[0],{...wire.choices[0],purpose:'求助者在什么方位'},{action:'travel:road',targetId:'l1',stake:'low',purpose:'前往山道查看线索',anchor:0}];
  const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices.length,3);
  assert.equal(result.scene.choices.filter(choice=>choice.approach==='ask').length,1);assert.ok(result.scene.choices.some(choice=>choice.intent==='travel'));
  const exit=result.scene.choices.find(choice=>choice.id.endsWith(':c:leave'));assert.equal(exit.approach,'leave');assert.equal(exit.targetId,result.scene.entities.find(entity=>entity.kind==='person').id);
});

test('a disabled escape does not satisfy a fresh event exit requirement',()=>{
  const {state,pending,context,wire}=fixture();wire.choices[0].action='interact:help';
  const opening=decodeGlmScene(wire,context,{storyActions:true});let active=commitTurn(state,pending,opening);
  while(active.life.items.supplies>0)active=commitTurn(active,prepareChoice(active,{requestId:'use-supply-'+active.turnId,choiceId:opening.choices[0].id}),opening);
  const empty=buildStoryContext(active,prepareChoice(active,{requestId:'empty-choice',choiceId:opening.choices[1].id})),prefix=empty.namespace+':t'+empty.identity.turnId+':';
  const scene={...opening,id:prefix+'s:scene',blocks:[{kind:'narration',text:'陈叔说山道已经清静，你可以留在林边，也可以动身。'}],choices:opening.choices.map((choice,index)=>({...choice,id:prefix+'c:'+index,...(index===0?{approach:'ask'}:{})}))};
  scene.choices[1]={...scene.choices[1],intent:'travel',approach:'wilderness',targetId:scene.entities.find(entity=>entity.kind==='place').id};
  assert.throws(()=>validateGeneratedScene(scene,empty,{requireExit:true}),{code:'CHOICE_NOT_COMPILABLE'});
  assert.doesNotThrow(()=>validateGeneratedScene(scene,empty),'canonical history keeps its original one-enabled-choice rule');
});

test('modern known references expose their kind and name and cannot redeclare a place as a person',()=>{
  const {state,pending,wire,context}=fixture(),scene=decodeGlmScene(wire,context,{storyActions:true}),active=commitTurn(state,pending,scene),next=prepareChoice(active,{requestId:'review-next',choiceId:scene.choices[0].id}),c=buildStoryContext(active,next);
  const packed=buildGlmWire(c,'',{storyActions:true}).context;
  const person=packed.entities.find(entity=>entity.kind==='person'),place=packed.entities.find(entity=>entity.kind==='place');
  assert.match(person.id,/^k\d+_person_陈叔$/u);assert.match(place.id,/^k\d+_place_山道$/u);
  assert.match(buildGlmWire(c,'').context.entities[0].id,/^k\d+$/u,'old in-flight wire keeps its old references');
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),schema=input.response_format.json_schema.schema;
  assert.equal(schema.$defs.personTarget.properties.kind.const,'person');assert.equal(schema.$defs.placeTarget.properties.kind.const,'place');assert.deepEqual(targetKinds(schema.properties.choices.items.oneOf.find(row=>row.properties.action.enum.includes('interact:ask')).properties.target,schema.$defs).sort(),['faction','person']);
  const follow=structuredClone(wire);follow.blocks[0].text='陈叔解释说，林中传来求救声，但他还没有见到求救的人。';follow.otherPeople=[{id:person.id}];follow.places=[];follow.choices.forEach(choice=>choice.targetId=person.id);
  const decoded=decodeGlmScene(follow,c,{storyActions:true});assert.equal(decoded.entities[0].id,scene.entities[0].id);validateGeneratedScene(decoded,c);
  follow.otherPeople=[{id:place.id,name:'摊主'}];follow.choices.forEach(choice=>choice.targetId=place.id);
  assert.throws(()=>decodeGlmScene(follow,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  follow.otherPeople=[{id:person.id+'伪造'}];follow.choices.forEach(choice=>choice.targetId=person.id+'伪造');
  assert.throws(()=>decodeGlmScene(follow,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('typed known references keep old journeys with long emoji names within the real provider input limit',()=>{
  const birth=createLiveGame({runId:'typed-old-journey',seed:42});delete birth.relationshipVersion;
  const opening=prepareOpening(birth,{requestId:'open'}),start=buildStoryContext(birth,opening,[],{continuity:false}),p=start.namespace+':t1:';
  const scene={id:p+'s:scene',title:'会面',location:'山口',blocks:[{kind:'narration',text:'山道上行人神情凝重。'+'山'.repeat(460)}],entities:Array.from({length:23},(_,i)=>({id:p+'e:person_'+(i+1),name:i+'🌲'.repeat(13),kind:'person',status:'alive'})),choices:[{id:p+'c:a',label:'调息',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:p+'c:b',label:'休养',intent:'rest',targetId:'self',stake:'low',approach:'retire'}],memoryDeltas:[]};
  validateGeneratedScene(scene,start);
  const active=commitTurn(birth,opening,scene),pending=prepareChoice(active,{requestId:'r'.repeat(80),choiceId:scene.choices[0].id});
  const rows=[sceneTurnRecord(scene,{runId:birth.runId,turnId:1}),...scene.entities.map((entity,i)=>({id:'old-entity:'+i,runId:birth.runId,turnId:1,source:'narrative',kind:'entity',entity:{id:entity.id,name:entity.name,kind:entity.kind},status:entity.status}))];
  const context=buildStoryContext(active,pending,rows,{selection:'relevance-v1',openTotal:0});
  assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(context)))<=7000);
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},context);assert.ok(Buffer.byteLength(JSON.stringify(input))<=24576);
});

test('a zero-day question to a person permits only that person answering, without unselected player actions',async()=>{
  const {state,pending,context,wire}=fixture(),opening=decodeGlmScene(wire,context,{storyActions:true}),active=commitTurn(state,pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'ask-reply',choiceId:opening.choices[0].id}));
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),blocks=input.response_format.json_schema.schema.properties.blocks,alias=buildGlmWire(c,'',{storyActions:true}).context.entities.find(entity=>entity.kind==='person').id;
  assert.equal(blocks.items.properties.kind.const,'dialogue');assert.equal(blocks.items.properties.speaker.properties.ref.const,alias);assert.match(input.messages.at(-1).content,/只写被询问人物的回答/);
  assert.equal(blocks.maxItems,1,'one question should not trigger a duplicated second answer');
  assert.equal(input.response_format.json_schema.schema.properties.choices.items.oneOf[0].properties.anchor.maximum,blocks.maxItems-1);
  const reply=structuredClone(wire);reply.otherPeople=[{id:alias}];reply.places=[];reply.choices.forEach(choice=>choice.targetId=alias);reply.choices[0].purpose='求救者在什么方向';reply.blocks=[{kind:'dialogue',speaker:alias,text:'林子东边有人跌进沟里，我只听见呼救，还没看清伤势。'}];
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal((await run(reply)).status,'ready');
  for(const block of [{kind:'narration',text:'你没有追问，转身修好了木鸢，还收下了铜片。'},{kind:'dialogue',speaker:'self',text:'我已经修好了，请给我铜片。'}]){
    const bad=structuredClone(reply);bad.blocks=[block];assert.equal((await run(bad)).errorCode,'GENERATED_SCENE_INVALID');
  }
});

test('a dangerous purpose must name its actual rule target rather than redirect onto a nearby ally',async()=>{
  const {wire,run}=fixture();wire.blocks[0].text='陈叔站在一旁，地上的废铁冰冷刺骨。';
  wire.choices.push({action:'evade:withdraw',targetId:'p1',stake:'low',purpose:'收回手，避免被废铁沾染煞气',anchor:0});
  const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices.length,2);assert.equal(result.scene.choices.some(choice=>choice.intent==='evade'),false);
  wire.choices=wire.choices.slice(1);assert.equal((await run(wire)).errorCode,'CHOICE_NOT_COMPILABLE','do not invent a free escape when too few valid model options remain');
});

test('a real combat escape remains available instead of being replaced by a free conversation exit',async()=>{
  const {wire,run,context}=fixture();wire.blocks=[{kind:'narration',text:'陈叔忽然拔刀相逼，你可以迎战，也可以后撤避开他的攻势。'}];wire.choices=[{action:'fight:guard',targetId:'p1',stake:'low',purpose:'稳住架势，挡住陈叔的攻击',anchor:0},{action:'evade:withdraw',targetId:'p1',stake:'low',purpose:'避开陈叔，离开他的攻击范围',anchor:0}];
  const result=await run(wire);assert.equal(result.status,'ready');assert.ok(result.scene.choices.some(choice=>choice.intent==='evade'));assert.ok(!result.scene.choices.some(choice=>choice.intent==='interact'&&choice.approach==='leave'));validateGeneratedScene(result.scene,context,{requireExit:true});
});

test('food help cannot be used for an ordinary question that should cost zero days',async()=>{
  const {wire,run}=fixture();wire.choices.push({action:'interact:help',targetId:'p1',stake:'low',purpose:'询问是否需要帮忙处理这块废铁',anchor:0});
  const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices.length,2);assert.equal(result.scene.choices.some(choice=>choice.approach==='help'),false);
  wire.choices[2].purpose='分出行粮，让陈叔先吃些东西';assert.equal((await run(wire)).scene.choices[2].approach,'help');
  wire.choices[2].purpose='拿出1行粮给陈叔处理伤口';assert.equal((await run(wire)).scene.choices.some(choice=>choice.approach==='help'),false,'food assistance cannot perform medical treatment');
});

test('observation cannot stand in for travelling to a remote place or looking at another actor',async()=>{
  const {wire,run}=fixture();wire.choices.push({action:'interact:observe',targetId:'l1',stake:'low',purpose:'去山道附近查看痕迹',anchor:0});
  assert.equal((await run(wire)).scene.choices.length,2);wire.choices[2]={action:'interact:observe',targetId:'p1',stake:'low',purpose:'观察远处黑熊的动作',anchor:0};assert.equal((await run(wire)).scene.choices.length,2);
  wire.choices[2].purpose='观察陈叔手上的伤势';assert.ok((await run(wire)).scene.choices.some(choice=>choice.approach==='observe'&&choice.targetId!=='self'));
  wire.otherPeople[0].name='陈'.repeat(51);wire.blocks[0].text=wire.otherPeople[0].name+'正在查看林边的动静。';wire.choices[2].purpose='观察这位村民的神情';assert.ok((await run(wire)).scene.choices.some(choice=>choice.approach==='observe'&&choice.targetId!=='self'),'a legal 51-character name cannot fit inside a 50-character purpose');
});

test('opening dialogue belongs to the introduced NPC rather than the protagonist',async()=>{
  const {context,wire,run}=fixture(),schema=buildStoryInput({...GLM_PROFILE,storyActions:true},context).response_format.json_schema.schema;
  assert.equal(schema.properties.blocks.items.oneOf.find(row=>row.properties.kind.const==='dialogue').properties.speaker.$ref,'#/$defs/personTarget');
  wire.blocks=[{kind:'dialogue',speaker:'self',text:'陈叔说道：请先听我讲讲林中的动静。'}];assert.equal((await run(wire)).errorCode,'GENERATED_SCENE_INVALID');wire.blocks[0].speaker='p1';assert.equal((await run(wire)).status,'ready');
});

test('ending an interaction keeps the current place and only states the player decision',async()=>{
  const {state,pending,context,wire}=fixture(),opening=decodeGlmScene(wire,context,{storyActions:true}),active=commitTurn(state,pending,opening),askPending=prepareChoice(active,{requestId:'ask-before-leave',choiceId:opening.choices[0].id});
  const p=context.namespace+':t2:',answered={...opening,id:p+'s:answer',blocks:[{kind:'dialogue',speaker:opening.entities[0].id,text:'林东有人呼救，但我还没看见求救的人。'}],choices:opening.choices.map((choice,i)=>({...choice,id:p+'c:'+i}))},afterAsk=commitTurn(active,askPending,answered),c=buildStoryContext(afterAsk,prepareChoice(afterAsk,{requestId:'leave-reply',choiceId:answered.choices[1].id}));
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),schema=input.response_format.json_schema.schema;
  assert.equal(schema.properties.blocks.items.properties.kind.const,'narration');assert.equal(schema.properties.blocks.items.properties.speaker,undefined);assert.equal(schema.properties.location.const,opening.location);
  assert.match(input.messages.at(-1).content,/本次是告辞.*不重复拒绝理由/);
  const reply=structuredClone(wire);reply.otherPeople=[];reply.places=[];reply.choices=[{action:'interact:observe',targetId:'self',stake:'low',purpose:'看看林边还有什么动静',anchor:0},{action:'interact:leave',targetId:'self',stake:'low',purpose:'结束当前互动',anchor:0}];reply.blocks=[{kind:'narration',text:'你向陈叔告辞，留在林边，留意起周围的动静。'}];reply.location=opening.location;
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal((await run(reply)).status,'ready');
  const elsewhere=structuredClone(reply);elsewhere.location='遥远的乱葬岗';assert.equal((await run(elsewhere)).errorCode,'GENERATED_SCENE_INVALID');
  const automaticTravel=structuredClone(reply);automaticTravel.blocks=[{kind:'dialogue',speaker:'self',text:'陈叔见你转身，急忙拉住你继续请求。'}];assert.equal((await run(automaticTravel)).errorCode,'GENERATED_SCENE_INVALID');
});

test('an exit-only model menu retains one exit and adds observation of the current surroundings',async()=>{
  const {wire,run}=fixture();wire.choices[0]={action:'interact:decline',targetId:'p1',stake:'low',purpose:'拒绝当前请求',anchor:0};
  const result=await run(wire);assert.equal(result.status,'ready');assert.equal(result.scene.choices.length,2);
  assert.equal(result.scene.choices.filter(choice=>['decline','leave'].includes(choice.approach)).length,1);
  const observation=result.scene.choices.find(choice=>choice.approach==='observe');assert.equal(observation.targetId,'self');assert.equal(observation.label,'仔细观察：留意周围的动静');
  wire.location='山'.repeat(110);const long=await run(wire);assert.equal(long.status,'ready');assert.ok(long.scene.choices.every(choice=>choice.label.length<=120));
});

test('leaving closes that persons interaction and offers independent local observation',async()=>{
  const f=fixture(),opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'end-conversation',choiceId:opening.choices[1].id}));
  const reply={...structuredClone(f.wire),otherPeople:[{id:'k1'}],places:[],location:opening.location,blocks:[{kind:'narration',text:'你告辞后留在林边，陈叔继续处理自己的事。'}],choices:[{action:'interact:ask',targetId:'k1',stake:'low',purpose:'再次询问是否需要帮忙',anchor:0},{action:'interact:decline',targetId:'k1',stake:'low',purpose:'再次拒绝挽留',anchor:0}]};
  const result=await generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(reply,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal(result.status,'ready');assert.ok(result.scene.choices.every(choice=>choice.targetId==='self'));assert.ok(result.scene.choices.some(choice=>choice.approach==='observe'));assert.ok(result.scene.choices.some(choice=>choice.approach==='leave'));
});

test('a short observation stays at the current place and cannot append an unselected journey',async()=>{
  const f=fixture();f.wire.choices[0]={action:'interact:observe',targetId:'self',stake:'low',purpose:'确认当前环境是否安全',anchor:0};
  const opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'observe-place',choiceId:opening.choices[0].id}));
  const schema=buildStoryInput({...GLM_PROFILE,storyActions:true},c).response_format.json_schema.schema;assert.equal(schema.properties.location.const,opening.location);assert.equal(schema.properties.blocks.maxItems,1);assert.equal(schema.properties.blocks.items.properties.kind.const,'narration');
  const reply=structuredClone(f.wire);reply.otherPeople=[{id:'k1'}];reply.places=[];reply.choices[0]={action:'interact:ask',targetId:'k1',stake:'low',purpose:'询问路边的脚印是什么时候留下的',anchor:0};reply.choices[1].targetId='k1';reply.blocks=[{kind:'narration',text:'陈叔仍在林边等你，山道上没有人影，四周暂时没有异样。'}];
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal((await run(reply)).status,'ready');const moved=structuredClone(reply);moved.location='后山';assert.equal((await run(moved)).errorCode,'GENERATED_SCENE_INVALID');
  const appended=structuredClone(reply);appended.blocks.push({kind:'narration',text:'确认安全后，你已经走到后山泉边。'});assert.equal((await run(appended)).errorCode,'GENERATED_SCENE_INVALID');
});

test('an actual travel receipt fixes the scene to its selected destination',async()=>{
  const f=fixture();f.wire.choices[0]={action:'travel:road',targetId:'l1',stake:'low',purpose:'沿山道前去寻人',anchor:0};
  const opening=decodeGlmScene(f.wire,f.context,{storyActions:true}),active=commitTurn(f.state,f.pending,opening),c=buildStoryContext(active,prepareChoice(active,{requestId:'actual-travel',choiceId:opening.choices[0].id}));
  assert.ok(c.receipt.elapsedDays>0);const schema=buildStoryInput({...GLM_PROFILE,storyActions:true},c).response_format.json_schema.schema;assert.equal(schema.properties.location.const,'山道');
  assert.deepEqual(targetKinds(schema.properties.choices.items.oneOf.find(row=>row.properties.action.enum.includes('travel:road')).properties.target,schema.$defs),['place']);

  const reply={...structuredClone(f.wire),blocks:[{kind:'narration',text:'你来到山道，前方两侧的树木渐渐繁茂，一道岔路通向河畔。'}],location:'山道',otherPeople:[],places:[],choices:[{action:'interact:observe',targetId:'self',stake:'low',purpose:'留意山道两侧的动静',anchor:0},{action:'interact:leave',targetId:'self',stake:'low',purpose:'暂不介入路边事件',anchor:0}]};
  const run=value=>generateProviderScene({run:async(_model,input)=>({model:GLM_PROFILE.modelId,choices:[{finish_reason:'stop',message:{content:JSON.stringify(namedGlmFixture(value,input))}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})},{...GLM_PROFILE,storyActions:true},c);
  assert.equal((await run(reply)).status,'ready');reply.location=opening.location;assert.equal((await run(reply)).errorCode,'GENERATED_SCENE_INVALID');
  reply.location='山道';reply.otherPeople=[{id:'k1'}];reply.choices[0]={action:'interact:ask',targetId:'k1',stake:'low',purpose:'询问路边的脚印是什么动物留下的',anchor:0};assert.equal((await run(reply)).errorCode,'CHOICE_NOT_COMPILABLE','a person from the former place has not automatically followed the player');
  reply.blocks[0].text='你告别了陈叔，独自抵达山道，这里的气味与陈叔描述的如出一辙。';assert.equal((await run(reply)).errorCode,'CHOICE_NOT_COMPILABLE','mentioning an absent person as background is not evidence they are here');
  reply.blocks=[{kind:'dialogue',speaker:'k1',text:'我已经先到山道，在这里等你。'}];assert.equal((await run(reply)).status,'ready','a returning known character can actually speak in the arrival scene');reply.blocks=[{kind:'narration',text:'你告别了陈叔，独自抵达山道，眼前有许多脚印。'}];
  reply.choices[0]={action:'interact:observe',targetId:'self',stake:'low',purpose:'留意山道两侧的动静',anchor:0};reply.memoryDeltas=[{entityId:'k1',kind:'clue',anchor:0,status:'open'}];assert.equal((await run(reply)).errorCode,'GENERATED_SCENE_INVALID','new local clues must not silently attach to an absent known person');
  reply.memoryDeltas=[];reply.choices[1]={action:'rest:recover',targetId:'self',stake:'low',purpose:'在路边稍作休息',anchor:0};const quit=(await run(reply)).scene.choices.find(choice=>choice.approach==='leave');assert.equal(quit.targetId,'self','the safe exit must not invent an interaction with an absent person');
});

test('named native targets preserve every action kind and crowded legacy travel fits',()=>{
  const state=createLiveGame({runId:'modern-travel-budget',seed:42}),pending=prepareOpening(state,{requestId:'open'}),start=buildStoryContext(state,pending),p=start.namespace+':t1:';
  const entities=Array.from({length:22},(_,i)=>({id:p+'e:'+(i===21?'place_':'person_')+(i+1),name:'🌲'.repeat(4)+i+'甲'.repeat(33),kind:i===21?'place':'person',...(i===21?{}:{status:'alive'})}));
  const scene={id:p+'s:scene',title:'会面',location:'山口',blocks:[{kind:'narration',text:'村口相遇。'+'山'.repeat(460)}],entities,choices:[{id:p+'c:a',label:'前往目的地',intent:'travel',targetId:entities[21].id,stake:'low',approach:'road'},{id:p+'c:b',label:'结束交谈',intent:'interact',targetId:'self',stake:'low',approach:'leave'}],memoryDeltas:[]};
  const active=commitTurn(state,pending,scene),c=buildStoryContext(active,prepareChoice(active,{requestId:'r'.repeat(36),choiceId:scene.choices[0].id}),[],{selection:'relevance-v1',openTotal:0});
  for(const context of [c,{...c,entities:c.entities.map((entity,index)=>index===0?{...entity,status:'dead'}:entity)}]){
    const input=buildStoryInput({...GLM_PROFILE,storyActions:true},context),schema=input.response_format.json_schema.schema,wire=buildGlmWire(context,'',{storyActions:true});assert.ok(Buffer.byteLength(JSON.stringify(input))<=24576);
    for(const group of wire.schema.properties.choices.items.oneOf){const actual=schema.properties.choices.items.oneOf.find(row=>row.properties.action.enum[0]===group.properties.action.enum[0]),expected=[...new Set(group.properties.targetId.enum.map(id=>wire.context.entities.find(entity=>entity.id===id)?.kind??(/^([plf])\d+$/u.test(id)?({p:'person',l:'place',f:'faction'})[id[0]]:id)))];assert.deepEqual(targetKinds(actual.properties.target,schema.$defs).sort(),expected.sort());}

  }
});
