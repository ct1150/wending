import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateStoryContext} from '../src/game/cultivation/live/memory.js';
import {v7ActionRule,WORLD_TRAVEL_APPROACHES,V7_REALMS,summarizeLife,maximumSpiritFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {ITEMS} from '../src/game/cultivation/live/model.js';
import {buildGlmWire,decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {buildNamedSceneSchema} from '../src/worker/story-named-targets.js';
import {buildStoryInput} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,STORY_LIMITS} from '../src/worker/story-config.js';
import {canonicalStringify,sha256} from '../src/game/cultivation/live/identity.js';

function context(){
  const state=createLiveGame({runId:'available-actions',seed:42,engineVersion:7});
  return structuredClone(buildStoryContext(state,prepareOpening(state,{requestId:'available-opening'})));
}
function rich(c){
  c.life.realm='foundation';c.life.cultivation=100;c.life.injury=0;c.life.cultivationProfile.spirit=100;
  for(const item of Object.keys(ITEMS))c.life.items[item]=200;
  return c;
}
function generation(c){const wire=buildGlmWire(c,'',{storyActions:true});return {...wire,named:buildNamedSceneSchema(wire.schema,wire.context)};}
// Exercise the actual generated grammar against candidate values, rather than
// asserting its internal grouping or the number of implementation branches.
function accepts(schema,rule,value){
  if(rule.$ref)return accepts(schema,schema.$defs[rule.$ref.split('/').at(-1)],value);
  if(rule.oneOf)return rule.oneOf.filter(branch=>accepts(schema,branch,value)).length===1;
  if(rule.anyOf)return rule.anyOf.some(branch=>accepts(schema,branch,value));
  if(Object.hasOwn(rule,'const')&&value!==rule.const)return false;
  if(rule.enum&&!rule.enum.includes(value))return false;
  if(rule.type==='string'&&(typeof value!=='string'||rule.minLength!==undefined&&Array.from(value).length<rule.minLength||rule.maxLength!==undefined&&Array.from(value).length>rule.maxLength||rule.pattern&&!new RegExp(rule.pattern,'u').test(value)))return false;
  if(rule.type==='integer'&&(!Number.isInteger(value)||rule.minimum!==undefined&&value<rule.minimum||rule.maximum!==undefined&&value>rule.maximum))return false;
  if(rule.type==='object'){
    if(value===null||typeof value!=='object'||Array.isArray(value)||rule.required.some(key=>!Object.hasOwn(value,key)))return false;
    if(rule.additionalProperties===false&&Object.keys(value).some(key=>!Object.hasOwn(rule.properties,key)))return false;
    return Object.entries(value).every(([key,entry])=>!rule.properties[key]||accepts(schema,rule.properties[key],entry));
  }
  return true;
}
const target=(kind,name,ref)=>ref===undefined?{kind,name}:{kind,name,ref,status:null};
const choice=(action,target,stake='low',purpose='辨明眼前情况')=>({action,target,stake,purpose,anchor:0});
const allows=(built,value)=>accepts(built.named,built.named.properties.choices.items,value);

function namedOpening(actor,notes=[]){return {blocks:[{kind:'narration',text:'船夫指着渡口，告诉你船上的陶罐是在上游找到的。'}],choices:[choice('interact:ask',actor),choice('interact:observe',actor),choice('interact:decline',actor)],title:'渡口陶罐',location:'渡口',memoryDeltas:notes,story:{pattern:'investigation',beat:'progress',anchors:[0]}};}

test('native compact targets and omitted status bind bare-name memories to the same actor as the selected action',()=>{
  const c=context(),person={kind:'person',name:'船夫'},built=generation(c);
  assert.deepEqual(built.named.$defs.personNewTarget.required,['kind','name']);
  for(const actor of [person,{...person,ref:''},{...person,ref:'',status:null},{...person,ref:null},{...person,ref:'null'}]){
    const wire=namedOpening(actor,[{target:'船夫',kind:'clue',status:'open',anchor:0}]);
    const scene=decodeGlmScene(wire,c,{storyActions:true});assert.equal(scene.entities.length,1);
    assert.ok(scene.choices.every(row=>row.targetId===scene.entities[0].id));assert.equal(scene.memoryDeltas[0].entityId,scene.entities[0].id);
    assert.equal(scene.memoryDeltas[0].text,wire.blocks[0].text);assert.equal(scene.memoryDeltas[0].kind,'clue');
  }
  c.entities=[{id:'old:boatman',kind:'person',name:'船夫',status:'alive'}];
  const known=decodeGlmScene(namedOpening('k1',[{target:'船夫',kind:'fact',anchor:0}]),c,{storyActions:true});assert.equal(known.choices[0].targetId,'old:boatman');assert.equal(known.memoryDeltas[0].entityId,'old:boatman');
});

test('typed scene-local symbols only resolve unambiguously declared participants and never rebind existing identities',()=>{
  const c=context(),person=target('person','船夫');
  for(const ref of ['p1','npc1']){
    const scene=decodeGlmScene(namedOpening({...person,ref},[{target:ref,kind:'fact',anchor:0}]),c,{storyActions:true});assert.equal(scene.memoryDeltas[0].entityId,scene.choices[0].targetId);
  }
  const collided=namedOpening({...person,ref:'npc1'});collided.choices[1].target={kind:'person',name:'陌生人',ref:'npc1'};
  assert.throws(()=>decodeGlmScene(collided,c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  for(const ref of ['l1','k1','npc99','r:other:t3:e:person_1','an-arbitrary-reference'])assert.throws(()=>decodeGlmScene(namedOpening({...person,ref}),c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  c.entities=[{id:'old:known',kind:'person',name:'船夫',status:'alive'}];
  assert.throws(()=>decodeGlmScene(namedOpening({...person,ref:'p1'}),c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('unbound or ambiguous ordinary memory is omitted without creating an entity; identity conflicts remain errors',()=>{
  const c=context(),person=target('person','船夫'),notes=[{target:'未知过客',kind:'fact',anchor:0},{target:'p9',kind:'relationship',anchor:0},{target:'船夫',kind:'fact',anchor:0}];
  let scene=decodeGlmScene(namedOpening(person,notes),c,{storyActions:true});assert.equal(scene.entities.length,1);assert.equal(scene.memoryDeltas.length,1);
  c.entities=[{id:'old:a',kind:'person',name:'船夫',status:'alive'},{id:'old:b',kind:'person',name:'船夫',status:'alive'}];
  const ambiguous=namedOpening('k1',notes);ambiguous.choices[1].target='k2';scene=decodeGlmScene(ambiguous,c,{storyActions:true});assert.equal(scene.entities.length,2);assert.equal(scene.memoryDeltas.length,0);
  for(const bad of [{target:'船夫',kind:'death',anchor:0},{target:'未知过客',kind:'promise',status:'open',anchor:0},{target:'k9',kind:'fact',anchor:0},{target:'r:other:t3:e:person_1',kind:'fact',anchor:0},{target:'未知过客',kind:'fact',status:'dead',anchor:0}])assert.throws(()=>decodeGlmScene({...ambiguous,memoryDeltas:[bad]},c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
});

test('v7 named memory offers only real open references with the allowed closure, and only people can die',()=>{
  const c=context(),actor=target('person','渡者'),place=target('place','渡口');
  const permits=(built,row)=>accepts(built.named,built.named.properties.memoryDeltas.items,row);
  const opening=generation(c);
  assert.equal(permits(opening,{referenceId:'m1',status:'resolved'}),false,'a new life has no obligation to close');
  assert.equal(permits(opening,{kind:'death',target:place,anchor:0}),false);
  assert.equal(permits(opening,{kind:'death',target:actor,anchor:0}),true);
  assert.equal(permits(opening,{kind:'fact',target:place,anchor:0}),true);
  c.entities=[{id:'old:host',kind:'person',name:'渡者',status:'alive'}];
  c.memory.promises=[{id:'first',kind:'promise',entityId:'old:host',status:'open'},{id:'old',kind:'promise',entityId:'old:host',status:'resolved'}];
  c.memory.clues=[{id:'third',kind:'clue',entityId:'old:host',status:'open'}];
  const next=generation(c);
  for(const [id,status,valid]of [['m1','broken',true],['m1','resolved',true],['m2','resolved',false],['m3','broken',false],['m3','resolved',true],['m4','resolved',false]])assert.equal(permits(next,{referenceId:id,status}),valid,id+'/'+status);
});

test('v7 choice anchors always name an existing block, and optional NPC traits can be omitted individually',()=>{
  const built=generation(context()),schema=built.named;
  assert.equal(allows(built,choice('interact:observe','self')),true);
  assert.equal(allows(built,{...choice('interact:observe','self'),anchor:3}),false);
  assert.equal(accepts(schema,schema.properties.story.properties.npcs.items,{target:target('person','渡者'),anchor:0,habit:'盘绳'}),true);
});

test('a missing optional memory anchor does not create an entity or move death and promises to another paragraph',()=>{
  const c=context(),actor=target('person','渡者'),stranger=target('person','过客'),blocks=[{kind:'narration',text:'渡者望着江面。'},{kind:'narration',text:'渡者承诺，等对岸来船时便通知你。'}];
  const wire={blocks,title:'渡口',location:'渡口',choices:[choice('interact:ask',actor),choice('interact:observe','self'),choice('interact:decline',actor)],memoryDeltas:[{target:stranger,kind:'death',anchor:2},{target:actor,kind:'promise',anchor:3,status:'open'},{target:actor,kind:'promise',anchor:1,status:'open'}],story:{pattern:'relationship',beat:'progress',anchors:[1]}};
  const scene=decodeGlmScene(wire,c,{storyActions:true});
  assert.deepEqual(scene.entities.map(entity=>entity.name),['渡者']);assert.deepEqual(scene.memoryDeltas.map(row=>[row.kind,row.text]),[['promise',blocks[1].text]]);
  for(const bad of [{target:{...actor,ref:'k99'},kind:'death',anchor:2},{target:target('place','码头'),kind:'death',anchor:2},{target:stranger,kind:'death',anchor:2,unexpected:true},{target:stranger,kind:'bogus',anchor:2}]){
    assert.throws(()=>decodeGlmScene({...wire,memoryDeltas:[bad]},c,{storyActions:true}),{code:'GENERATED_SCENE_INVALID'});
  }
});

test('v7 generation offers only action, target and stake combinations executable with the actual resources',()=>{
  for(const exhausted of [true,false]){
    const c=rich(context());
    if(exhausted){for(const item of Object.keys(c.life.items))c.life.items[item]=0;c.life.cultivationProfile.spirit=0;}
    const built=generation(c);
    for(const branch of built.schema.properties.choices.items.oneOf)for(const action of branch.properties.action.enum)for(const id of branch.properties.targetId.enum)for(const stake of branch.properties.stake.enum??[branch.properties.stake.const]){
      const [intent,approach]=action.split(':'),fresh=/^([plf])\d+$/u.exec(id);
      const kind=fresh&&({p:'person',l:'place',f:'faction'})[fresh[1]];
      const entity=fresh?{id,kind,name:kind==='place'&&WORLD_TRAVEL_APPROACHES.includes(approach)?'中界云津':'眼前新对象',status:'alive'}:null;
      const rule=v7ActionRule({life:c.life,turnId:c.identity.turnId,relatedEntities:entity?[entity]:[]},{intent,approach,targetId:id,stake});
      assert.equal(rule.reason,undefined,`${exhausted?'empty':'stocked'} inventory must not offer ${action}/${id}/${stake}: ${rule.reason}`);
    }
    assert.equal(allows(built,choice('interact:observe','self')),true,'a resource-free local observation always remains available');
    assert.equal(allows(built,choice('rest:medicine','self')),!exhausted);
    assert.equal(allows(built,choice('craft:alchemy','elixir')),!exhausted);
    assert.equal(allows(built,choice('travel:smuggle',target('place','中界云津'))),!exhausted);
  }
});

test('v7 action generation distinguishes resources within the same approach',()=>{
  const c=context();for(const item of Object.keys(c.life.items))c.life.items[item]=0;
  c.life.items.herbs=3;c.life.items.stones=3;c.life.cultivationProfile.spirit=100;
  const built=generation(c);
  assert.equal(allows(built,choice('craft:alchemy','medicine')),true);
  assert.equal(allows(built,choice('craft:alchemy','elixir')),false);
  assert.equal(allows(built,choice('practice:breakthrough','qi')),false,'a realm name is insufficient without the actual breakthrough prerequisites');
});

test('named generation keeps dead, arrived and mismatched targets out of executable branches',()=>{
  const c=rich(context());
  c.phase='choice';c.director.world.location='渡口';
  c.entities=[{id:'old:living',kind:'person',name:'陈叔',status:'alive'},{id:'old:dead',kind:'person',name:'故人',status:'dead'},{id:'old:here',kind:'place',name:'渡口',status:'unknown'},{id:'old:road',kind:'place',name:'山道',status:'unknown'}];
  c.receipt.action={intent:'travel',approach:'road',targetId:'old:here'};
  const built=generation(c),[living,dead,here,road]=built.context.entities.map(entity=>entity.id);
  assert.equal(allows(built,choice('interact:ask',living)),true,'known targets can be selected by their already supplied identity');
  for(const value of [dead,target('person','故人'),target('person','故人',living),target('place','山道')])assert.equal(allows(built,choice('interact:ask',value)),false,JSON.stringify(value));
  for(const value of [here,target('place','渡口'),target('place','渡口',road)])assert.equal(allows(built,choice('travel:road',value)),false,JSON.stringify(value));
  assert.equal(allows(built,choice('travel:road',road)),true);
  assert.equal(allows(built,choice('travel:road',target('place','溪边新路'))),true);
});

test('fresh travel destinations preserve local versus next-world mechanics without banning world crossings',()=>{
  const c=rich(context()),built=generation(c);
  assert.equal(allows(built,choice('travel:road',target('place','青石镇'))),true);
  assert.equal(allows(built,choice('travel:road',target('place','下界青石镇'))),true);
  for(const name of ['中界青石镇','上界青石镇'])assert.equal(allows(built,choice('travel:road',target('place',name))),false,name);
  assert.equal(allows(built,choice('travel:smuggle',target('place','中界云津'))),true);
  for(const name of ['青石镇','上界云津','中界通往上界'])assert.equal(allows(built,choice('travel:smuggle',target('place',name))),false,name);
});

test('ended interactions are excluded while observations and other people remain available',()=>{
  const c=rich(context());c.entities=[{id:'old:host',kind:'person',name:'陈叔',status:'alive'},{id:'old:other',kind:'person',name:'舟娘',status:'alive'}];
  c.receipt.action={intent:'interact',approach:'leave',targetId:'old:host'};
  const built=generation(c),[host,other]=built.context.entities.map(entity=>entity.id);
  assert.equal(allows(built,choice('interact:ask',host)),false);
  assert.equal(allows(built,choice('interact:ask',target('person','陈叔'))),false);
  assert.equal(allows(built,choice('interact:ask',other)),true);
  assert.equal(allows(built,choice('interact:observe','self')),true);
});

test('location observations use self or the known current place instead of an invented remote place',()=>{
  const c=context();c.entities=[{id:'old:here',kind:'place',name:'渡口',status:'unknown'},{id:'old:away',kind:'place',name:'远山',status:'unknown'}];
  c.phase='choice';c.director.world.location='渡口';
  const built=generation(c),[here,away]=built.context.entities.map(entity=>entity.id);
  assert.equal(allows(built,choice('interact:observe',here)),true);
  for(const value of [away,target('place','远山'),target('place','新发现的谷地')])assert.equal(allows(built,choice('interact:observe',value)),false,JSON.stringify(value));
  assert.equal(allows(built,choice('interact:observe','self')),true);
});

test('food help and black-market choices express exactly their actual available transaction',()=>{
  const c=rich(context()),built=generation(c),actor=target('person','行脚客');
  assert.equal(allows(built,choice('interact:help',actor,'low','给出一份行粮，帮助对方充饥')),true);
  assert.equal(allows(built,choice('interact:help',actor,'low','替对方包扎伤口')),false);
  assert.equal(allows(built,choice('negotiate:black-market',actor,'low','出售古修遗物，换取灵石')),true);
  assert.equal(allows(built,choice('negotiate:black-market',actor,'low','出售法器，换取灵石')),false);
  c.life.items.relic=0;
  assert.equal(allows(generation(c),choice('negotiate:black-market',actor,'low','出售法器，换取灵石')),true);
});

test('known target aliases decode without changing the canonical stored identity',()=>{
  const c=context();c.entities=[{id:'old:host',kind:'person',name:'陈叔',status:'alive'}];
  const actor=generation(c).context.entities[0].id;
  const wire={blocks:[{kind:'dialogue',speaker:actor,text:'陶罐是在井边找到的。'}],choices:[choice('interact:ask',actor),choice('interact:observe','self'),choice('interact:decline',actor)],title:'井边陶罐',location:'村口',memoryDeltas:[{target:actor,kind:'clue',anchor:0,status:'open'}],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
  const scene=decodeGlmScene(wire,c,{storyActions:true});
  assert.equal(scene.blocks[0].speaker,'old:host');assert.equal(scene.choices[0].targetId,'old:host');assert.equal(scene.memoryDeltas[0].entityId,'old:host');assert.equal(scene.entities.length,1);
});

test('same-name and same-prefix known targets keep their separate identities and kinds',()=>{
  const c=context();c.entities=[{id:'old:first',kind:'person',name:'白',status:'alive'},{id:'old:second',kind:'person',name:'白',status:'alive'},{id:'old:place',kind:'place',name:'白',status:'unknown'},{id:'old:long-first',kind:'person',name:'河岸守夜人的兄长',status:'alive'},{id:'old:long-second',kind:'person',name:'河岸守夜人的师傅',status:'alive'}];
  const built=generation(c),[first,second,place,longFirst,longSecond]=built.context.entities.map(entity=>entity.id);
  for(const entity of built.context.entities)assert.match(entity.id,/^k\d+$/u,'v7 aliases do not duplicate names already present in the same context');
  for(const actor of [first,second,longFirst,longSecond])assert.equal(allows(built,choice('interact:ask',actor)),true,actor);
  assert.equal(allows(built,choice('interact:ask',place)),false);
  assert.equal(allows(built,choice('interact:ask',target('person','白'))),false,'an ambiguous known name cannot become a fresh identity');
  assert.equal(allows(built,choice('interact:ask',target('person','白舟'))),true,'a short known name does not reserve its whole surname');
  const wire={blocks:[{kind:'narration',text:'两位同名旅人在桥边等你回应。'}],choices:[choice('interact:ask',first),choice('interact:ask',second),choice('interact:observe','self')],title:'桥边',location:'村口',memoryDeltas:[],story:{pattern:'relationship',beat:'progress',anchors:[0]}};
  const scene=decodeGlmScene(wire,c,{storyActions:true});assert.deepEqual(scene.choices.slice(0,2).map(row=>row.targetId),['old:first','old:second']);
});

test('v7 guidance accepts natural names and response lengths while legacy requests remain stable',()=>{
  const c=context(),instructions=generation(c).instructions;
  assert.doesNotMatch(instructions,/purpose必须包含目标全名|人物的purpose含全名|正文200–400字/);
  const state=createLiveGame({runId:'legacy-director-wire',seed:42}),legacy=structuredClone(buildStoryContext(state,prepareOpening(state,{requestId:'legacy-open'})));
  // Frozen requests predate the optional retrieval capability advertised by
  // newly built contexts. Their existing complete input must stay unchanged.
  delete legacy.retrieval;
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},legacy);
  assert.equal(sha256(JSON.stringify(input)),'6040772d4faeea1ca096c6c61ebeb60d1743d37762c68c10550142b22277a745');
  const current=buildStoryInput({...GLM_PROFILE,storyActions:true},c);
  assert.ok(new TextEncoder().encode(JSON.stringify(current)).length<=STORY_LIMITS.maxInputBytes);
});

test('a dense v7 context keeps its complete target constraints inside the provider input budget',()=>{
  const c=context();c.entities=Array.from({length:24},(_,index)=>({id:'prior:entity'+index,kind:['person','place','faction'][index%3],name:String.fromCodePoint(0x4e00+index)+'名'.repeat(11),status:index%6===0?'dead':'unknown'}));
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  assert.ok(bytes(c)>6500&&bytes(c)<=7000,'use a genuinely near-full v7 context');
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},c);
  assert.ok(bytes(input)<=STORY_LIMITS.maxInputBytes,`complete provider request: ${bytes(input)} bytes`);
  const built=generation(c);
  assert.equal(allows(built,choice('interact:ask',target('person',c.entities[0].name))),false);
  for(const schema of Object.values(built.named.$defs))if(schema?.properties?.name?.pattern)assert.doesNotMatch(schema.properties.name.pattern,/\(\?[=!<]/u,'native generation does not support lookaround');
});

test('a near-full v7 continuation preserves its complete action grammar when references share the request budget',t=>{
  const state=createLiveGame({runId:'rich-continuation',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'rich-opening'}),openingContext=buildStoryContext(state,pending);
  const scene=decodeGlmScene({blocks:[{kind:'narration',text:'村口的古井旁留下新鲜泥痕，来路尚待辨认。'}],choices:[choice('interact:observe','self','low','查看古井边缘'),choice('interact:observe','self','low','查看地上泥痕'),choice('interact:leave','self','low','暂且放下井边异状')],title:'井边异状',location:'村口',memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}},openingContext,{storyActions:true});
  const active=commitTurn(state,pending,scene),c=structuredClone(buildStoryContext(active,prepareChoice(active,{requestId:'rich-next',choiceId:scene.choices[0].id})));
  rich(c);c.life.lifeLimit=V7_REALMS[c.life.realm].lifeLimit;c.life.cultivationProfile.maxSpirit=maximumSpiritFor(c.life);c.life.cultivationProfile.spirit=c.life.cultivationProfile.maxSpirit;c.receipt.before=summarizeLife(c.life);c.receipt.after=summarizeLife(c.life);
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  c.entities=Array.from({length:24},(_,index)=>({id:'prior:entity'+index,kind:['person','place','faction'][index%3],name:String.fromCodePoint(0x4e00+index)+'名'.repeat(11),status:'unknown'}));
  while(bytes(c)>6900)for(const entity of c.entities)entity.name=entity.name.slice(0,-1);
  assert.ok(bytes(c)>6500&&bytes(c)<=7000);validateStoryContext(c);
  const input=buildStoryInput({...GLM_PROFILE,storyActions:true},c);
  assert.ok(bytes(input)<=STORY_LIMITS.maxInputBytes,`rich request: ${bytes(input)} bytes`);
  const before=JSON.stringify(c),evidenceId='SCHEMA-TEST-001',family='source:TEST-0001',text='合成参考：先询问在场之人，再决定是否调查此事。'.repeat(30);
  const references={selection:{corpusVersion:'source-schema-test-v1',queryHash:sha256(canonicalStringify(c)),cardIds:[],evidenceIds:[evidenceId],families:[family]},curated:[],evidence:[{id:evidenceId,chapterId:'TEST-0001',family,text}]};
  const packed=buildStoryInput({...GLM_PROFILE,storyActions:true},c,references),{storyReferences,...modelContext}=JSON.parse(packed.messages[1].content);
  assert.ok(bytes(packed)<=STORY_LIMITS.maxInputBytes,`rich request with references: ${bytes(packed)} bytes`);
  assert.equal(storyReferences.evidence.length,1);
  assert.ok(storyReferences.evidence[0].excerpt.length<text.length,'only optional reference prose yields to the original request budget');
  assert.deepEqual(modelContext,JSON.parse(input.messages[1].content),'packing references preserves every known alias and gameplay fact');
  assert.deepEqual(packed.response_format,input.response_format,'packing references preserves the complete action grammar');
  assert.deepEqual(buildStoryInput({...GLM_PROFILE,storyActions:true,maxInput:bytes(input)+8},c,references),input,'an almost-full request omits references without removing legal actions or known targets');
  assert.equal(JSON.stringify(c),before,'reference packing does not rewrite the frozen context');
  t.diagnostic(`v7 context ${bytes(c)} B; complete input ${bytes(input)} B; with references ${bytes(packed)} B / ${STORY_LIMITS.maxInputBytes} B`);
});
