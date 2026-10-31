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
  assert.deepEqual(Object.keys(schema.properties),['blocks','title','location','memoryDeltas','story']);
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
