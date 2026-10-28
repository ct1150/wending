// LOCAL FIXTURES only. These tests never call Cloudflare or validate a profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScene } from '../src/worker/story-provider.js';
import { CANDIDATE_PROFILE, PRODUCTION_PROFILES, STORY_LIMITS } from '../src/worker/story-config.js';
import { buildStoryContext, validateGeneratedScene } from '../src/game/cultivation/live/memory.js';
import { createLiveGame, prepareOpening, prepareChoice, commitTurn } from '../src/game/cultivation/live/engine.js';
import { SCENE_SCHEMA, idField } from '../src/game/cultivation/live/schema.js';
import * as acceptance from '../src/worker/story-acceptance.js';
import * as providerCore from '../src/worker/story-provider-core.js';
const promotedFixtureProfile={...CANDIDATE_PROFILE,validated:true,supportsStructuredOutput:true};
function context() {
  const born=createLiveGame({runId:'acceptance-run',seed:42});
  return buildStoryContext(born,prepareOpening(born,{requestId:'fixture-opening'}));
}
function scene(c=context()) {
  const prefix=c.namespace+':t'+c.identity.turnId+':';
  return {id:prefix+'s:bridge',title:'桥边来信',location:'河岸',blocks:[{kind:'narration',text:'旧桥下漂来一封未署名的信，远处船夫招手。'}],entities:[{id:prefix+'e:boatman',name:'渡者',kind:'person'}],choices:[{id:prefix+'c:rest',label:'歇息片刻',intent:'rest',targetId:'self',approach:'recover',stake:'normal'},{id:prefix+'c:talk',label:'向渡者问路',intent:'negotiate',targetId:prefix+'e:boatman',approach:'cooperate',stake:'normal'}],memoryDeltas:[]};
}
function response(value=scene()) {
  return {model:CANDIDATE_PROFILE.modelId,choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}],usage:{prompt_tokens:100,completion_tokens:80,total_tokens:180}};
}
function assertSeam() {
  assert.equal(typeof acceptance.buildCandidateStoryInput,'function','acceptance input builder exists');
  assert.equal(typeof acceptance.generateAcceptanceScene,'function','acceptance generator exists');
}

test('production accepts the observed whitespace-only reasoning placeholder and requests no thinking',async()=>{
  const raw=response();raw.choices[0].message.reasoning_content='\n\n';
  let submitted;
  const result=await generateScene({run:async(model,input)=>{submitted=input;return raw;}},promotedFixtureProfile,context());
  assert.equal(result.status,'ready');
  assert.match(submitted.messages[0].content,/ \/no_think$/);
  assert.equal(Object.hasOwn(result,'reasoning_content'),false);
});

test('the fixed acceptance seam executes the unpromoted candidate while production still refuses it',async()=>{
  assertSeam();
  const c=context(),expected=acceptance.buildCandidateStoryInput(c),calls=[];
  const ai={run:async(model,input)=>{calls.push({model,input:structuredClone(input)});return response();}};
  const blocked=await generateScene(ai,CANDIDATE_PROFILE,c);
  assert.equal(blocked.errorCode,'MODEL_UNVALIDATED');assert.equal(blocked.inferencePerformed,false);
  assert.equal(calls.length,0);
  const result=await acceptance.generateAcceptanceScene(ai,c,{attemptId:'acceptance-attempt'});
  assert.equal(result.status,'ready');assert.equal(result.accountingStatus,'complete');
  assert.deepEqual(result.scene,scene());assert.equal(result.attemptId,'acceptance-attempt');
  assert.deepEqual(result.usage,{promptTokens:100,completionTokens:80,totalTokens:180});
  assert.equal(result.modelId,'@cf/qwen/qwen3-30b-a3b-fp8');assert.equal(result.actualNeurons,null);
  assert.equal(calls.length,1);assert.deepEqual(calls[0],{model:CANDIDATE_PROFILE.modelId,input:expected});
  assert.equal(expected.max_tokens,1536);assert.equal(expected.stream,false);
  assert.equal(expected.messages.length,2);assert.equal(expected.messages[1].content,JSON.stringify(c));
  assert.equal(expected.response_format.type,'json_schema');
  const unscoped=structuredClone(expected.response_format.json_schema);
  unscoped.properties.id=SCENE_SCHEMA.properties.id;
  unscoped.properties.choices.items.properties.id=SCENE_SCHEMA.properties.choices.items.properties.id;
  assert.deepEqual(unscoped,SCENE_SCHEMA);
  assert.equal(CANDIDATE_PROFILE.validated,false);assert.equal(CANDIDATE_PROFILE.supportsStructuredOutput,null);
  assert.deepEqual(PRODUCTION_PROFILES,[]);
});

test('both paths accept only absent, null, empty or whitespace string reasoning and never return it',async()=>{
  assertSeam();
  for(const generate of [
    (ai,c)=>generateScene(ai,promotedFixtureProfile,c),
    (ai,c)=>acceptance.generateAcceptanceScene(ai,c),
  ]) {
    for(const reasoning of [undefined,null,'','\n\n',' \t\r\n']) {
      const raw=response();if(reasoning!==undefined)raw.choices[0].message.reasoning_content=reasoning;
      const result=await generate({run:async()=>raw},context());
      assert.equal(result.status,'ready');assert.equal(result.accountingStatus,'complete');
      assert.deepEqual(result.scene,scene());
      assert.equal(JSON.stringify(result).includes('reasoning'),false);
    }
    for(const reasoning of ['private-secret-thought',' \n秘密推理\t',0,false,[],{},['private-secret-thought']]) {
      const raw=response();raw.choices[0].message.reasoning_content=reasoning;
      const result=await generate({run:async()=>raw},context());
      assert.equal(result.errorCode,'PROVIDER_RESPONSE_INVALID');assert.equal(result.status,'rejected');
      assert.equal(result.accountingStatus,'complete');assert.equal(result.inferencePerformed,true);
      assert.deepEqual(result.usage,{promptTokens:100,completionTokens:80,totalTokens:180});
      assert.equal(Object.hasOwn(result,'scene'),false);
      assert.doesNotMatch(JSON.stringify(result),/reasoning|private-secret|秘密推理/);
    }
  }
});

test('acceptance and production submit the same complete bounded input and builder results cannot alter the schema',async()=>{
  assertSeam();
  const c=context(),built=acceptance.buildCandidateStoryInput(c),inputs=[];
  const ai={run:async(model,input)=>{inputs.push(structuredClone(input));return response();}};
  assert.equal((await generateScene(ai,promotedFixtureProfile,c)).status,'ready');
  assert.equal((await acceptance.generateAcceptanceScene(ai,c)).status,'ready');
  assert.deepEqual(inputs,[built,built]);
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  assert.ok(bytes(built)<=STORY_LIMITS.maxInputBytes);
  assert.ok(bytes({model:CANDIDATE_PROFILE.modelId,input:built})<=STORY_LIMITS.maxRequestBytes);
  assert.ok(bytes(built)+1024+64*built.messages.length+built.max_tokens<=CANDIDATE_PROFILE.contextTokens);
  built.max_tokens=99999;built.messages[0].content='override';built.response_format.json_schema.properties.id.type='number';
  assert.equal((await acceptance.generateAcceptanceScene(ai,c)).status,'ready');
  assert.equal(inputs[2].max_tokens,1536);assert.match(inputs[2].messages[0].content,/ \/no_think$/);
  assert.equal(inputs[2].response_format.json_schema.properties.id.type,'string');
});

test('candidate input builder throws typed validation errors and both generators block invalid contexts before inference',async()=>{
  assertSeam();
  const invalid=[{},null,{...context(),unexpected:true}, {...context(),identity:{...context().identity,promptVersion:999}}];
  const oversized=structuredClone(context());oversized.life.name='山'.repeat(7000);invalid.push(oversized);
  let evaluated=0;const accessor=structuredClone(context());Object.defineProperty(accessor,'phase',{enumerable:true,get(){evaluated++;return 'opening';}});invalid.push(accessor);
  let calls=0;const ai={run:async()=>{calls++;return response();}};
  for(const c of invalid) {
    assert.throws(()=>acceptance.buildCandidateStoryInput(c),error=>typeof error.code==='string'&&error.code.length>0);
    for(const generate of [()=>acceptance.generateAcceptanceScene(ai,c),()=>generateScene(ai,promotedFixtureProfile,c)]) {
      const result=await generate();assert.equal(result.inferencePerformed,false);assert.equal(result.status,'rejected');
      assert.equal(result.accountingStatus,'complete');
    }
  }
  assert.equal(calls,0);assert.equal(evaluated,0);
});

test('complete escaped input and conservative context limits reject before a binding call',async()=>{
  const c=structuredClone(context());
  c.entities=[{id:'guide',name:'向导',kind:'person',status:'alive'}];
  c.memory.facts=Array.from({length:5},(_,i)=>({id:'fact-'+i,runId:'acceptance-run',turnId:0,source:'narrative',entityId:'guide',kind:'fact',text:'\\'.repeat(500)}));
  c.references=c.memory.facts.map(row=>row.id);
  let calls=0;const ai={run:async()=>{calls++;return response();}};
  assert.throws(()=>acceptance.buildCandidateStoryInput(c),{code:'INPUT_TOO_LARGE'});
  const tooLarge=await acceptance.generateAcceptanceScene(ai,c);
  assert.equal(tooLarge.errorCode,'INPUT_TOO_LARGE');assert.equal(tooLarge.inferencePerformed,false);
  assert.equal(tooLarge.accountingStatus,'complete');
  assert.deepEqual(tooLarge,await generateScene(ai,promotedFixtureProfile,c));
  for(const [overrides,code] of [[{maxInput:600},'INPUT_TOO_LARGE'],[{contextTokens:100},'CONTEXT_TOO_LARGE'],[{maxOutput:0},'PROVIDER_PROFILE_INVALID']]) {
    const result=await generateScene(ai,{...promotedFixtureProfile,...overrides},context());
    assert.equal(result.errorCode,code);assert.equal(result.inferencePerformed,false);
  }
  assert.equal(calls,0);
});

test('acceptance permits only existing bounded attempt and timeout options before inference',async()=>{
  assertSeam();let calls=0;
  const ai={run:async()=>{calls++;return response();}};
  for(const options of [null,[],{timeoutMs:0},{timeoutMs:STORY_LIMITS.timeoutMs+1},{timeoutMs:1.5},{attemptId:'invalid space'},{modelId:'paid/model'},{profile:promotedFixtureProfile},{max_tokens:99999},{validated:true},{supportsStructuredOutput:true},{retry:true}]) {
    const result=await acceptance.generateAcceptanceScene(ai,context(),options);
    assert.equal(result.inferencePerformed,false);assert.equal(result.status,'rejected');
    assert.equal(result.accountingStatus,'complete');
  }
  assert.equal(calls,0);
  const ready=await acceptance.generateAcceptanceScene(ai,context(),{timeoutMs:STORY_LIMITS.timeoutMs});
  assert.equal(ready.status,'ready');assert.equal(ready.attemptId,'fixture-opening');assert.equal(calls,1);
});

test('both wrappers share response size, model, stop, usage, token, JSON, tool and scene validation with complete accounting',async()=>{
  assertSeam();
  const cases=[
    ['MODEL_RESPONSE_MISMATCH',r=>r.model='paid/model'],
    ['OUTPUT_TRUNCATED',r=>r.choices[0].finish_reason='length'],
    ['STOP_REASON_INVALID',r=>delete r.choices[0].finish_reason],
    ['PROVIDER_USAGE_INVALID',r=>r.usage.total_tokens=999],
    ['OUTPUT_TOO_LARGE',r=>r.usage={prompt_tokens:100,completion_tokens:1537,total_tokens:1637}],
    ['PROVIDER_RESPONSE_TOO_LARGE',r=>r.padding='x'.repeat(65536)],
    ['PROVIDER_RESPONSE_INVALID',r=>r.choices[0].message.content='{"bad":'],
    ['PROVIDER_RESPONSE_INVALID',r=>r.choices.push(structuredClone(r.choices[0]))],
    ['PROVIDER_RESPONSE_INVALID',r=>r.choices[0].message.tool_calls=[{id:'tool-secret'}]],
    ['GENERATED_SCENE_INVALID',r=>r.choices[0].message.content=JSON.stringify({...scene(),effects:{stones:9999}})],
    ['MECHANICAL_FACT_CONFLICT',r=>{const s=scene();s.blocks[0].text='你已突破至金丹。';r.choices[0].message.content=JSON.stringify(s);}],
  ];
  for(const [code,mutate] of cases) {
    const raw=response();mutate(raw);let calls=0;
    const ai={run:async()=>{calls++;return raw;}};
    const production=await generateScene(ai,promotedFixtureProfile,context());
    const candidate=await acceptance.generateAcceptanceScene(ai,context());
    assert.equal(candidate.errorCode,code);assert.equal(candidate.status,'rejected');
    assert.equal(candidate.accountingStatus,'complete');assert.equal(candidate.inferencePerformed,true);
    assert.equal(Object.hasOwn(candidate,'scene'),false);assert.equal(candidate.actualNeurons,null);
    assert.deepEqual(candidate,production);assert.equal(calls,2);
  }
});

test('candidate acceptance retains mandatory continuation admission before returning ready',async()=>{
  assertSeam();const c=context(),heavy=scene(c),prefix=c.namespace+':t1:';
  heavy.entities=Array.from({length:24},(_,i)=>({id:prefix+'e:'+i+'x'.repeat(48),name:String(i)+'名'.repeat(58),kind:'person'}));
  heavy.choices=[heavy.choices[0],{id:prefix+'c:train',label:'修习功法',intent:'practice',targetId:'self',approach:'steady',stake:'normal'}];
  assert.throws(()=>validateGeneratedScene(heavy,c),{code:'NEXT_CONTEXT_TOO_LARGE'});
  const ai={run:async()=>response(heavy)};
  const result=await acceptance.generateAcceptanceScene(ai,c);
  assert.equal(result.errorCode,'NEXT_CONTEXT_TOO_LARGE');assert.equal(result.accountingStatus,'complete');
  assert.equal(Object.hasOwn(result,'scene'),false);
  assert.deepEqual(result,await generateScene(ai,promotedFixtureProfile,c));
});

test('candidate transport keeps no-retry quota, busy and timeout accounting semantics without leaking exceptions',async()=>{
  assertSeam();
  for(const [providerCode,code,accounting] of [[3036,'FREE_QUOTA_EXHAUSTED','complete'],[3040,'PROVIDER_BUSY','complete'],[429,'PROVIDER_BUSY','complete'],['secret-token','PROVIDER_FAILED','unknown']]) {
    let calls=0;
    const result=await acceptance.generateAcceptanceScene({run:async()=>{calls++;throw Object.assign(new Error('private-secret'),{code:providerCode});}},context());
    assert.equal(result.errorCode,code);assert.equal(result.status,'paused');assert.equal(result.accountingStatus,accounting);
    assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/secret/);
  }
  const timed=await acceptance.generateAcceptanceScene({run:()=>new Promise(()=>{})},context(),{timeoutMs:1});
  assert.equal(timed.errorCode,'PROVIDER_TIMEOUT');assert.equal(timed.accountingStatus,'unknown');
  const missing=await acceptance.generateAcceptanceScene({},context());
  assert.equal(missing.errorCode,'AI_BINDING_MISSING');assert.equal(missing.inferencePerformed,false);
});

test('submitted identifier schemas enforce runtime ASCII references without consuming the maximum context allowance',()=>{
  const input=acceptance.buildCandidateStoryInput(context()),schema=input.response_format.json_schema;
  const identifiers=[schema.properties.blocks.items.properties.speaker,schema.properties.entities.items.properties.id,schema.properties.choices.items.properties.targetId,schema.properties.memoryDeltas.items.properties.entityId,schema.properties.memoryDeltas.items.properties.referenceId];
  for(const field of identifiers) {
    assert.equal(typeof field.pattern,'string','the submitted ID/reference contract includes its runtime pattern');
    const accepts=value=>new RegExp(field.pattern).test(value);
    for(const value of ['self','r:0123456789abcdef:t1:s:gate','A'+'x'.repeat(79)]) {idField(value);assert.equal(accepts(value),true);}
    for(const value of ['',':bad','r:0123456789abcdef:t1:s:山门','id space','A'+'x'.repeat(80),'line\nbreak']) {assert.throws(()=>idField(value));assert.equal(accepts(value),false);}
  }
  const size=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  const overhead=size(input)-size(input.messages[1].content);
  assert.ok(overhead<=5288,`fixed overhead ${overhead} must leave all 7000 encoded context bytes`);
  const maximum={...input,messages:[input.messages[0],{role:'user',content:'x'.repeat(6998)}]};
  assert.equal(size(maximum.messages[1].content),7000);assert.ok(size(maximum)<=12288);
});

test('each submitted schema restricts scene and choice IDs to the actual run and turn without mutating references',()=>{
  const originalSchema=structuredClone(SCENE_SCHEMA),contexts=[context()];
  const born=createLiveGame({runId:'different-acceptance-run',seed:42});
  const pending=prepareOpening(born,{requestId:'other-opening'}),opening=buildStoryContext(born,pending);
  contexts.push(opening);
  const active=commitTurn(born,pending,scene(opening));
  const continuation=buildStoryContext(active,prepareChoice(active,{requestId:'other-turn',choiceId:active.currentScene.choices[0].id}));
  contexts.push(continuation);
  const distant=structuredClone(continuation);
  distant.identity.turnId=9007199254740991;distant.identity.baseRevision=9007199254740990;
  contexts.push(distant);
  for(const c of contexts) {
    const input=acceptance.buildCandidateStoryInput(c),schema=input.response_format.json_schema;
    const prefix=c.namespace+':t'+c.identity.turnId+':';
    assert.deepEqual(schema.properties.id.enum,[prefix+'s:scene'],'the model receives one valid scene ID for this exact request');
    idField(schema.properties.id.enum[0]);
    const field=schema.properties.choices.items.properties.id,pattern=new RegExp(field.pattern);
    const accepts=value=>typeof value==='string'&&value.length<=field.maxLength&&pattern.test(value);
    for(const value of [prefix+'c:rest',prefix+'c:talk_2'])assert.equal(accepts(value),true);
    for(const value of ['namespace:t1:c:rest',c.namespace+':t0:c:rest','r:0000000000000000:t'+c.identity.turnId+':c:rest',prefix+'s:rest',prefix+'c:山门',prefix+'c:',prefix+'c:'+'x'.repeat(80)])assert.equal(accepts(value),false,value);
    assert.ok(input.messages[0].content.includes(prefix+'s:scene'));
    assert.ok(input.messages[0].content.includes(prefix+'c:'));
    assert.ok(input.messages[0].content.includes(prefix+'e:'));
    assert.doesNotMatch(input.messages[0].content,/namespace:t本回合/);
    const target=schema.properties.choices.items.properties.targetId;
    assert.equal(new RegExp(target.pattern).test('self'),true,'action targets must not inherit the current scene scope');
    assert.equal(new RegExp(schema.properties.entities.items.properties.id.pattern).test('old-entity'),true,'existing entities retain their IDs');
    const maximum={...input,messages:[input.messages[0],{role:'user',content:'x'.repeat(6998)}]};
    const bytes=new TextEncoder().encode(JSON.stringify(maximum)).length;
    assert.ok(bytes<=12288,`scope for turn ${c.identity.turnId} must leave all 7000 encoded context bytes, got ${bytes}`);
  }
  assert.deepEqual(SCENE_SCHEMA,originalSchema,'per-request constraints must never leak into the shared schema');
});

test('wrong-scope model output remains rejected without repairing scene or choice IDs',async()=>{
  const c=context();
  for(const mutate of [s=>s.id='namespace:t1:s:scene',s=>s.choices[0].id='namespace:t1:c:rest']) {
    const invalid=scene(c);mutate(invalid);
    assert.throws(()=>validateGeneratedScene(invalid,c),{code:'SCENE_ID_SCOPE_INVALID'});
    const raw=response(invalid),before=JSON.stringify(raw),ai={run:async()=>raw};
    const result=await acceptance.generateAcceptanceScene(ai,c);
    assert.equal(result.errorCode,'SCENE_ID_SCOPE_INVALID');assert.equal(result.status,'rejected');
    assert.equal(result.inferencePerformed,true);assert.equal(result.accountingStatus,'complete');
    assert.equal(Object.hasOwn(result,'scene'),false);assert.equal(JSON.stringify(raw),before);
    assert.deepEqual(result,await generateScene(ai,promotedFixtureProfile,c));
  }
});

test('submitted prompt supplies conditional fields and the complete authoritative action target/approach contract',()=>{
  const system=acceptance.buildCandidateStoryInput(context()).messages[0].content;
  assert.match(system,/ASCII/);
  assert.match(system,/narration=kind,text;dialogue=kind,text,speaker/);
  assert.match(system,/status:person only,alive\/dead;omit unknown/);
  assert.match(system,/referenceId\/status:promise\/clue only;new=omit or open;close=referenceId\+resolved\(promise also broken\)/);
  assert.match(system,/unique entity\/choice IDs and action tuples/);
  const actionLine=system.match(/^Actions=(.*)$/m);assert.ok(actionLine,'the actual provider prompt declares action pairs');
  assert.deepEqual(JSON.parse(actionLine[1]),{
    practice:{self:['steady','intensive'],realm:['breakthrough']},
    explore:{resource:['cautious','bold']},
    negotiate:{npc:['cooperate','bargain','pressure']},
    fight:{npc:['guard','assault','desperate']},
    evade:{npc:['withdraw','conceal']},
    rest:{self:['recover','retire']},
    travel:{place:['road','wilderness']},
    craft:{manual:['study'],talisman:['forge']},
  });
  assert.match(system,/npc=living person\/faction ID;place=place ID;realm=next realm ID/);
  assert.match(system,/resource=supplies,stones,manual,crystal,core,soulseal,skykey,relic,iron/);
  assert.match(system,/qi,foundation,golden,nascent,spirit,immortal/);
  assert.match(system,/ \/no_think$/);
});

test('reproduced structure failures retain strict rejection and expose only fixed categorical diagnostics',async()=>{
  const c=context(),prefix=c.namespace+':t1:';
  const cases=[
    ['FIELD_SET_INVALID',s=>s.blocks[0].speaker='self'],
    ['FIELD_SET_INVALID',s=>s.blocks[0].kind='dialogue'],
    ['ACTION_PAIR_INVALID',s=>s.choices[0].approach='cooperate'],
    ['ENTITY_STATUS_INVALID',s=>s.entities.push({id:prefix+'e:gate',name:'山门',kind:'place',status:'alive'})],
    ['FIELD_SET_INVALID',s=>s.memoryDeltas.push({kind:'fact',entityId:s.entities[0].id,text:'一件往事。',status:'open'})],
    ['MEMORY_CLOSURE_STATUS_INVALID',s=>s.memoryDeltas.push({kind:'clue',entityId:s.entities[0].id,text:'一封来信。',referenceId:'m:prior',status:'open'})],
    ['MEMORY_NEW_STATUS_INVALID',s=>s.memoryDeltas.push({kind:'promise',entityId:s.entities[0].id,text:'等待归来。',status:'resolved'})],
    ['IDENTIFIER_INVALID',s=>s.id=prefix+'s:山门'],
    ['TEXT_INVALID',s=>s.title=' '],
    ['CHOICE_ACTION_DUPLICATE',s=>s.choices[1]={...s.choices[0],id:prefix+'c:other'}],
    ['ENTITY_COLLECTION_INVALID',s=>s.entities.push({...s.entities[0]})],
    ['STRUCTURE_UNCLASSIFIED',s=>s.blocks=[null]],
  ];
  for(const [want,mutate] of cases) {
    const invalid=scene(c);invalid.title='private-rejected-title';mutate(invalid);
    assert.throws(()=>validateGeneratedScene(invalid,c),{code:'GENERATED_SCENE_INVALID'});
    const raw=response(invalid);raw.choices[0].message.reasoning_content=' \n';
    const ai={run:async()=>raw};
    const candidate=await acceptance.generateAcceptanceScene(ai,c),production=await generateScene(ai,promotedFixtureProfile,c);
    assert.equal(candidate.status,'rejected');assert.equal(candidate.errorCode,'GENERATED_SCENE_INVALID');
    assert.equal(candidate.accountingStatus,'complete');assert.equal(candidate.structureDiagnostic,want);
    assert.equal(candidate.actualNeurons,null);assert.equal(Object.hasOwn(candidate,'scene'),false);
    assert.deepEqual(candidate.usage,{promptTokens:100,completionTokens:80,totalTokens:180});assert.deepEqual(candidate,production);
    assert.doesNotMatch(JSON.stringify(candidate),/private-rejected-title|reasoning_content|数据字段|未知行动|山门|Cannot read/);
    assert.ok(providerCore.STRUCTURE_DIAGNOSTIC_CODES.includes(candidate.structureDiagnostic));
  }
  assert.equal(Object.isFrozen(providerCore.STRUCTURE_DIAGNOSTIC_CODES),true);
  for(const value of [response(),{...response(),choices:[{finish_reason:'stop',message:{content:'bad JSON'}}]},response({...scene(c),blocks:[{kind:'narration',text:'你已突破至金丹。'}]})]) {
    const result=await acceptance.generateAcceptanceScene({run:async()=>value},c);
    assert.equal(Object.hasOwn(result,'structureDiagnostic'),false);
  }
});
