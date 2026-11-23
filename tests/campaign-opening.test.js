import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';

function open(eventVersion,seed=42){
 const state=createLiveGame({runId:'first-road',engineVersion:7,originStories:true,eventVersion,seed,name:'沈渡'});
 const turn=prepareOpening(state,{requestId:'birth'});
 return commitTurn(state,turn,resolveRuleScene(state,turn));
}
function choose(state,key){
 const choice=state.currentScene.choices.find(choice=>choice.id.endsWith(':c:'+key));
 assert.ok(choice,`${key} / ${state.currentScene.title}`);
 const turn=prepareChoice(state,{requestId:`turn-${state.turnId}`,choiceId:choice.id});
 return commitTurn(state,turn,resolveRuleScene(state,turn));
}
const follow=(state,...keys)=>keys.reduce(choose,state);

test('a new campaign leaves the village without changing the original arrival',()=>{
 const original=open(1),newLife=open(2);
 assert.equal(original.currentScene.title,'外院第一日');
 assert.equal(newLife.currentScene.title,'石溪村 · 临行');
 const gate=choose(newLife,'leave-village');
 assert.equal(gate.lastReceipt.elapsedDays,1);
 assert.equal(gate.events.version,2);
 assert.equal(gate.lastReceipt.eventVersion,2);
 assert.deepEqual(gate.currentScene.choices.map(c=>c.id.split(':').at(-1)),['join-gate','take-road','ask-terms']);
});

test('apprentice and independent paths pay different costs and receive different follow-up help',()=>{
 const gate=choose(open(2),'leave-village');
 const apprentice=follow(gate,'join-gate','work-bank','save-canal');
 const independent=follow(gate,'take-road','buy-passage','save-houses');
 assert.equal(apprentice.life.items.manual,1);
 assert.equal(independent.life.items.manual,1);
 assert.equal(apprentice.life.items.supplies,gate.life.items.supplies);
 assert.equal(independent.life.items.supplies,gate.life.items.supplies-1);
 assert.ok(apprentice.life.ageDays!==independent.life.ageDays);
 const finish=state=>{
  for(let i=0;i<12&&state.life.realm==='mortal';i++){
   if(state.events.node==='prologue-result')state=choose(state,'try-again');
   const next=compileChoices(state,state.currentScene.choices).find(c=>c.enabled);
   state=choose(state,next.id.split(':').at(-1));
  }
  assert.equal(state.life.realm,'qi');
  return choose(state,'take-help');
 };
 const gateGift=finish(apprentice),villageGift=finish(independent);
 assert.equal(gateGift.lastReceipt.itemChanges.stones,2);
 assert.equal(villageGift.lastReceipt.itemChanges.supplies,2);
 assert.equal(gateGift.events.prologue.water,'canal');
 assert.equal(villageGift.events.prologue.water,'houses');
 assert.equal(gateGift.events.prologue.help,'accepted');
 assert.equal(villageGift.events.prologue.help,'accepted');
 assert.match(gateGift.currentScene.blocks[0].text,/闸/);
 assert.match(villageGift.currentScene.blocks[0].text,/门/);
 const hub=choose(villageGift,'chapter-out');
 assert.equal(hub.events.node,'hub');
 assert.equal(hub.events.prologue.help,'accepted');
});

test('a failed first breakthrough leaves the flood decision intact and permits a new attempt',()=>{
 const failed=follow(open(2,8),'leave-village','join-gate','work-bank','save-canal','first-breakthrough');
 assert.equal(failed.lastReceipt.cultivationResult.check.success,false);
 assert.equal(failed.life.realm,'mortal');
 assert.equal(failed.life.items.manual,0);
 assert.equal(failed.events.prologue.water,'canal');
 const restored=follow(failed,'recover-first','restore-copy','settle-breath');
 assert.equal(restored.life.items.manual,1);
 assert.equal(restored.life.injury,0);
 const next=compileChoices(restored,restored.currentScene.choices);
 assert.ok(next.some(c=>c.id.endsWith(':c:first-breakthrough')&&c.enabled));
 assert.ok(!next.some(c=>c.id.endsWith(':c:restore-copy')));
});
