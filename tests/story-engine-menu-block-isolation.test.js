import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptV7EngineMenuOutput as adapt} from '../src/worker/story-model-output.js';
import {generateProviderScene} from '../src/worker/story-provider-core.js';
import {GLM_MODEL_ID,GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';

const state=createLiveGame({runId:'separate-speakers',seed:42,engineVersion:7}),pending=prepareOpening(state,{requestId:'open'}),c=buildStoryContext(state,pending);
const person={kind:'person',name:'锦衣人甲'},n={kind:'narration',text:'山路尽头，草木在风中起伏。'},d={kind:'dialogue',speaker:person,text:'守门人还有一句话要说。我答应明日交还玉简。'};
const invalid={kind:'dialogue',speaker:{...person,ref:'k99'},text:'这段不可确认归属，也不可单独变成一条旁白。'};
function deliver(wire,context){
  let calls=0;
  const ai={run:async()=>{assert.equal(++calls,1);return {model:GLM_MODEL_ID,choices:[{finish_reason:'stop',message:{content:JSON.stringify(wire)}}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}};}};
  return generateProviderScene(ai,{...GLM_PROFILE,storyActions:true,engineMenu:true},context);
}

test('invalid speakers cannot create a character or erase independent real blocks and their playable choices',async()=>{
  const after={kind:'narration',text:'风把松针吹到了台阶上。'};
  for(const speaker of ['k999',{kind:'person',name:c.life.name},{kind:'person',name:'你'},{kind:'person',name:'self'},{...person,ref:'r:foreign:t2:e:npc'},{kind:'place',name:'松风岭'}]){
    assert.deepEqual(adapt({blocks:[n,{...invalid,speaker},after]},c),adapt({blocks:[n,after]},c));
    assert.throws(()=>adapt({blocks:[{...invalid,speaker}]},c));
  }
  const dead={...c,entities:[{id:'late',kind:'person',name:'故人',status:'dead'}]};
  assert.deepEqual(adapt({blocks:[n,{...invalid,speaker:'k1'},d]},dead),adapt({blocks:[n,d]},dead));
  const res=await deliver({blocks:[n,invalid,d]},c),expected=await deliver({blocks:[n,d]},c);
  assert.equal(res.status,'ready',res.errorCode);assert.deepEqual(res.scene,expected.scene);
  const saved=commitTurn(state,pending,res.scene);assert.equal(saved.revision,state.revision+1);assert.deepEqual(saved.lastReceipt,pending.receipt);
  assert.equal(saved.currentScene.entities.find(x=>x.id===saved.currentScene.blocks[1].speaker).name,person.name);
  for(const ch of saved.currentScene.choices)assert.deepEqual(prepareChoice(saved,{choiceId:ch.id,requestId:'selected'}).receipt.action,ch);
});

test('only retained original evidence can anchor a consequence or a trait after a speaker is removed',()=>{
  const source={blocks:[n,invalid,d],story:{pattern:'discovery',beat:'revelation',anchors:[1,2],npcs:[{target:'k99',anchor:1,title:'这段不可确认归属'},{target:person,anchor:2,title:'守门人'}]},memoryDeltas:[
    {kind:'death',target:person,anchor:1},{kind:'fact',target:person,anchor:1},{kind:'promise',target:person,anchor:2,status:'open'},{referenceId:'m1',status:'resolved'}]};
  const baseline={blocks:[n,d],story:{pattern:'discovery',beat:'revelation',anchors:[1],npcs:[{target:person,anchor:1,title:'守门人'}]},memoryDeltas:[{kind:'promise',target:person,anchor:1,status:'open'},{referenceId:'m1',status:'resolved'}]};
  const got=adapt(source,c),valid=adapt(baseline,c);assert.deepEqual(got,valid);assert.equal(got.story.npcs[0].anchor,1);assert.equal(got.memoryDeltas[0].anchor,1);assert.equal(got.memoryDeltas[1].referenceId,'m1');
});

test('an unusable extra row cannot veto complete rows; the archive limit bounds accepted blocks',()=>{
  const rows=Array.from({length:15},(_,i)=>({kind:'narration',text:'完整段落'+i+'。'})),noise={kind:'editor',text:'未要求的注释'};
  assert.deepEqual(adapt({blocks:[n,noise,null,{kind:'narration',text:' '},d,noise]},c).blocks,[n,d]);
  const out=adapt({blocks:[noise,...rows]},c);assert.deepEqual(out.blocks,rows.slice(0,12));
  assert.throws(()=>adapt({blocks:[noise,null,invalid]},c));
});

test('a discarded p1 declaration cannot move its promise to the next speaker',async()=>{
  const opening=await deliver({blocks:[d]},c);
  const saved=commitTurn(state,pending,opening.scene),known=saved.currentScene.entities.find(e=>e.name===person.name);
  const ask=saved.currentScene.choices.find(ch=>ch.approach==='ask'),command=prepareChoice(saved,{choiceId:ask.id,requestId:'ask'});
  const clue={id:'clue:old-road',runId:saved.runId,turnId:1,source:'narrative',kind:'clue',entityId:known.id,text:'确认山路标记',status:'open'};
  const ctx=buildStoryContext(saved,command,[clue]),alias='k'+(ctx.entities.findIndex(e=>e.id===known.id)+1);
  const bad={...invalid,speaker:{kind:'person',name:ctx.life.name,ref:'p1'}},actor={kind:'person',name:'船夫'};
  const reply={kind:'dialogue',speaker:actor,text:'我答应明日交还渡船。'},report={kind:'narration',text:'锦衣人甲认出了山路的标记。'};
  const facts=[{kind:'fact',target:actor,anchor:1},{kind:'fact',target:alias,anchor:2},{referenceId:'m1',status:'resolved'}];
  const got=await deliver({blocks:[bad,reply,report],memoryDeltas:[{kind:'promise',target:'p1',anchor:1,status:'open'},...facts]},ctx);
  assert.equal(got.status,'ready',got.errorCode);
  assert.deepEqual(got.scene.memoryDeltas.map(m=>[m.kind,m.text,m.referenceId]),[['fact',reply.text,undefined],['fact',report.text,undefined],['clue',clue.text,clue.id]]);
  assert.equal(got.scene.memoryDeltas[0].entityId,got.scene.blocks[0].speaker);assert.equal(got.scene.memoryDeltas[1].entityId,known.id);
  assert.equal(got.scene.memoryDeltas[2].status,'resolved');
});
