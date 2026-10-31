import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,commitTurn,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildStoryInput,generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE,STORY_LIMITS} from '../src/worker/story-config.js';

const profile={...GLM_PROFILE,storyActions:true,authoredChoices:true};
const state=createLiveGame({runId:'narrative-request',seed:42,engineVersion:7}),opening=prepareOpening(state,{requestId:'opening'});
const ctx=buildStoryContext(state,opening);
const blocks=[{kind:'narration',text:'渡口无人，断桩上的红泥尚湿。水纹一直延伸到盐仓边的浅滩。'}];
const choices=[
  {action:'interact:observe',target:'self',purpose:'比对断桩红泥和岸边的泥色'},
  {action:'travel:road',target:{kind:'place',name:'盐仓浅滩'},stake:'low',purpose:'沿岸走到盐仓浅滩，找水纹的来处'},
];
async function generate(wire,context=ctx){
  let calls=0;
  const result=await generateProviderScene({run:async model=>{
    calls++;
    return {model,choices:[{finish_reason:'stop',message:{content:typeof wire==='string'?wire:JSON.stringify(wire)}}],usage:{prompt_tokens:200,completion_tokens:150,total_tokens:350}};
  }},profile,context);
  assert.equal(calls,1);
  return result;
}

test('current v7 asks for scene prose and authored decisions together without a predetermined menu',()=>{
  const input=buildStoryInput(profile,ctx),schema=input.response_format.json_schema.schema;
  assert.ok(schema.required.includes('blocks')&&schema.required.includes('choices'));
  assert.ok(schema.properties.choices.minItems>=2&&schema.properties.choices.maxItems<=3);
  assert.doesNotMatch(JSON.stringify(input.messages),/possibleNextSteps/);
  assert.ok(input.stream&&input.stream_options.include_usage);
  assert.ok(Buffer.byteLength(JSON.stringify(input))<=STORY_LIMITS.maxInputBytes);
});

test('two different menus for the same empty ferry landing reach the player and next receipt verbatim',async()=>{
  const before=structuredClone(ctx),other=[
    {...choices[0],purpose:'蹲到断桩旁，量一量水纹间隔'},
    {action:'interact:leave',target:'self',purpose:'收回探桩的手，不再追问水纹的来由'},
  ];
  for(const menu of [choices,other]){
    const result=await generate({blocks,choices:menu});
    assert.equal(result.status,'ready',result.errorCode);assert.deepEqual(result.scene.blocks,blocks);
    assert.deepEqual(result.scene.choices.map(row=>row.label),menu.map(row=>row.purpose));
    assert.deepEqual(result.scene.choices.map(row=>row.intent+':'+row.approach),menu.map(row=>row.action));
    const active=commitTurn(state,opening,result.scene);
    for(const row of active.currentScene.choices){
      const next=prepareChoice(active,{choiceId:row.id,requestId:'next-'+row.approach});
      assert.deepEqual(next.receipt.action,row);
      assert.ok(buildStoryInput(profile,buildStoryContext(active,next)).messages.at(-1).content.includes(row.label));
      if(row.intent==='travel')assert.equal(next.receipt.elapsedDays,30);
    }
  }
  assert.deepEqual(ctx,before);
});

test('absent, unplayable and partial model menus cannot create even a temporary committed action',async()=>{
  const invalid=choices.map(row=>({...row,action:'invented:gesture'})),body=JSON.stringify(blocks);
  for(const candidate of [{blocks},{blocks,choices:[]},{blocks,choices:[choices[0]]},{blocks,choices:invalid},
    {blocks,choices:[choices[0],choices[0]]},'{"blocks":'+body+',"choices":['+JSON.stringify(choices[0])+',{"action":"travel:road"']){
    const result=await generate(candidate);
    assert.notEqual(result.status,'ready');assert.equal(result.scene,undefined);
  }
});

test('complete original choices survive a broken optional footer without inventing a third',async()=>{
  const source='{"blocks":'+JSON.stringify(blocks)+',"choices":'+JSON.stringify(choices)+',"title":"';
  const result=await generate(source);
  assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.choices.map(row=>row.label),choices.map(row=>row.purpose));
  assert.deepEqual(result.scene.blocks,blocks);
});

test('one malformed suggestion cannot replace the other two original choices or shift their persisted IDs',async()=>{
  const menu=[choices[0],{action:'invented:meditate',target:'self',purpose:'无效的行动'},choices[1]];
  const result=await generate({blocks,choices:menu});
  assert.equal(result.status,'ready',result.errorCode);
  assert.deepEqual(result.scene.choices.map(c=>[c.id.split(':').at(-1),c.label]),[['a',choices[0].purpose],['c',choices[1].purpose]]);
  const saved=commitTurn(state,opening,result.scene);
  for(const c of saved.currentScene.choices){
    const next=prepareChoice(saved,{requestId:'survivor-'+c.approach,choiceId:c.id});
    assert.deepEqual(next.receipt.action,c);
  }
});

test('a harmless afterword cannot derail the model menu or smuggle state changes into the same turn',async()=>{
  const core={blocks,choices},baseline=await generate(core),extra=await generate({...core,afterword:'完'});
  assert.equal(baseline.status,'ready');assert.equal(extra.status,'ready',extra.errorCode);
  assert.deepEqual(extra.scene,baseline.scene);
  for(const afterword of [{receipt:{elapsedDays:0}},{editorial:{life:{realm:'immortal'}}},'r:other-life:t7:e:person_1']){
    const attempted=await generate({...core,afterword});
    assert.notEqual(attempted.status,'ready');assert.equal(attempted.scene,undefined);
  }
});

test('a food transfer must benefit its displayed recipient when two hungry people are present',async()=>{
  const chen={kind:'person',name:'陈砚'},li={kind:'person',name:'李青'};
  const scene=[
    {kind:'dialogue',speaker:chen,text:'我的干粮在桥头落水了。'},
    {kind:'dialogue',speaker:li,text:'我也未曾进食。'},
  ];
  const question={action:'interact:ask',target:chen,purpose:'问陈砚是否知道李青从哪里渡河'};
  const leave={action:'interact:leave',target:li,purpose:'与李青道别，让他先过桥'};
  const give={action:'interact:help',target:chen,purpose:'从包袱里拿出一份行粮，递给他充饥'};
  const good=await generate({blocks:scene,choices:[give,question,leave]});
  assert.equal(good.status,'ready',good.errorCode);assert.deepEqual(good.scene.choices.map(c=>c.label),[give,question,leave].map(c=>c.purpose));
  const saved=commitTurn(state,opening,good.scene),chenId=saved.relatedEntities.find(e=>e.name===chen.name).id;
  const paid=prepareChoice(saved,{requestId:'give-ration',choiceId:saved.currentScene.choices[0].id});
  assert.equal(paid.receipt.action.targetId,chenId);assert.equal(paid.receipt.itemChanges.supplies,-1);
  const bad=await generate({blocks:scene,choices:[{...give,purpose:'把仅剩的一份行粮交给李青充饥'},question,leave]});
  assert.ok(!bad.scene?.choices.some(c=>c.approach==='help'));
  if(bad.scene)assert.deepEqual(bad.scene.choices.map(c=>c.label),[question.purpose,leave.purpose]);
});
