import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/cultivation/live/engine.js';
import {stateHash} from '../src/game/cultivation/live/identity.js';
import {TECHNIQUES,nextRealmFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';

const options={runId:'rules-event-life',seed:42,name:'沈渡',engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1};
function opening(extra={}){
 const state=engine.createLiveGame({...options,...extra}),pending=engine.prepareOpening(state,{requestId:'opening'});
 return engine.commitTurn(state,pending,engine.resolveRuleScene(state,pending));
}
function choose(state,key){
 const choice=state.currentScene.choices.find(row=>row.id.endsWith(':c:'+key));
 assert.ok(choice,'missing '+key+' at '+state.events.node);
 const pending=engine.prepareChoice(state,{choiceId:choice.id,requestId:'turn-'+(state.turnId+1)});
 return pending.receipt.death?engine.settleDeath(state,pending):engine.commitTurn(state,pending,engine.resolveRuleScene(state,pending));
}

test('event birth is explicit and preserves the same rolled birth and resources',()=>{
 let state;assert.doesNotThrow(()=>{state=engine.createLiveGame(options);});
 const old=engine.createLiveGame(Object.fromEntries(Object.entries(options).filter(([key])=>key!=='eventVersion')));
 assert.equal(old.events,undefined);assert.equal(state.events.version,1);
 const birth=structuredClone(state.life.birth);delete birth.cultivationProfile.eventVersion;
 assert.deepEqual(birth,old.life.birth);assert.deepEqual(state.life.items,old.life.items);assert.equal(state.rng,old.rng);
 const ready=opening();assert.equal(ready.phase,'active');assert.equal(ready.events.node,'arrival');
 assert.equal(ready.currentScene.choices.length,3);assert.match(ready.currentScene.blocks.map(b=>b.text).join(''),/栖云门/);
});

test('entry work completes once and refusal leaves a playable independent cultivation path',()=>{
 let state=choose(opening(),'accept');assert.equal(state.events.entry,'accepted');
 const before=state.life.items.manual??0;state=choose(state,'finish-work');
 assert.equal(state.events.entry,'joined');assert.equal(state.life.items.manual,before+1);assert.equal(state.lastReceipt.elapsedDays,3);
 state=choose(state,'continue');assert.equal(state.events.node,'hub');
 assert.ok(!state.currentScene.choices.some(c=>c.id.endsWith(':c:finish-work')));
 const declined=choose(opening(),'decline');assert.equal(declined.events.entry,'declined');
 assert.equal(declined.lastReceipt.elapsedDays,0);assert.deepEqual(declined.life.items,opening().life.items);
 assert.ok(declined.currentScene.choices.some(c=>c.id.endsWith(':c:train-menu')));
});

test('free questions and menus cannot farm items, reroll risk, or accept an unchosen request',()=>{
 let state=opening(),rng=state.rng,items=structuredClone(state.life.items),age=state.life.ageDays;
 for(let i=0;i<12;i++){state=choose(state,'ask');state=choose(state,'companion');state=choose(state,'leave-companion');}
 assert.equal(state.rng,rng);assert.deepEqual(state.life.items,items);assert.equal(state.life.ageDays,age);assert.equal(state.events.entry,'unresolved');
});

test('being paid a manual for nursery work never activates the treasure compass',()=>{
 const seed=Array.from({length:100},(_,i)=>i).find(i=>engine.createLiveGame({...options,seed:i}).life.birth.cultivationProfile.relicId==='rusted-needle');
 assert.notEqual(seed,undefined);
 const before=choose(opening({seed}),'accept'),after=choose(before,'finish-work');
 assert.equal(after.life.cultivationProfile.exposure,before.life.cultivationProfile.exposure);
 assert.equal(after.life.items.manual,(before.life.items.manual??0)+1);
});

test('a companion decision persists and aid has an actual cost without taking over the entry quest',()=>{
 let state=choose(choose(opening(),'ask'),'companion');
 const supplies=state.life.items.supplies;state=choose(state,'aid');
 assert.equal(state.events.companion,'helped');assert.equal(state.life.items.supplies,supplies-1);assert.equal(state.lastReceipt.elapsedDays,1);
 state=choose(state,'continue');assert.equal(state.events.entry,'unresolved');assert.equal(state.events.node,'arrival');
 const declined=choose(choose(choose(opening(),'ask'),'companion'),'decline-companion');
 assert.equal(declined.events.companion,'declined');assert.equal(declined.life.items.supplies,supplies);assert.equal(declined.lastReceipt.elapsedDays,0);
});

test('training and material preparation remain reachable when optional story events are declined',()=>{
 let state=choose(opening(),'decline');state=choose(state,'train-menu');
 assert.ok(state.currentScene.choices.some(c=>c.intent==='practice'&&c.approach==='steady'));
 state=choose(choose(state,'rest-menu'),'back');state=choose(state,'journey-menu');state=choose(state,'resources-menu');
 assert.ok(state.currentScene.choices.some(c=>c.intent==='explore'&&c.targetId==='manual'));
 assert.ok(engine.compileChoices(state,state.currentScene.choices).some(c=>c.enabled));
});

test('event scenes cannot be replaced by structurally valid model text or invented options',()=>{
 const state=engine.createLiveGame(options),pending=engine.prepareOpening(state,{requestId:'opening'}),scene=engine.resolveRuleScene(state,pending);
 const forged=structuredClone(scene);forged.blocks[0].text='你已经得到掌门的认可。';
 assert.throws(()=>engine.commitTurn(state,pending,forged),/规则事件/);
 const before=stateHash(state);engine.resolveRuleScene(state,pending);assert.equal(stateHash(state),before);
});

function repairStart(){
 const seed=Array.from({length:30},(_,i)=>i).find(seed=>TECHNIQUES[engine.createLiveGame({...options,seed}).life.cultivationProfile.experience.activeTechniqueId].defective);
 assert.notEqual(seed,undefined);
 let state=choose(opening({seed}),'decline');state=choose(state,'affairs-menu');state=choose(state,'mentor-menu');
 return choose(state,'diagnose');
}
test('self repair and personal guidance produce distinct real costs and only the accepted guidance creates a debt',()=>{
 const diagnosed=repairStart(),self=choose(diagnosed,'restore'),guided=choose(diagnosed,'pledge');
 assert.equal(self.life.cultivationProfile.experience.repaired,true);assert.equal(self.life.cultivationProfile.experience.commitment??null,null);
 assert.ok(self.lastReceipt.elapsedDays>=45);assert.equal(guided.lastReceipt.elapsedDays,3);
 assert.equal(guided.life.cultivationProfile.experience.commitment.status,'owed');assert.equal(guided.events.mentor,'guided');
 let state=choose(choose(guided,'back'),'affairs-menu');state=choose(state,'mentor-menu');
 const supplies=state.life.items.supplies;state=choose(state,'repay');
 assert.equal(state.life.items.supplies,supplies-1);assert.equal(state.life.cultivationProfile.experience.commitment.status,'fulfilled');
 state=choose(state,'mentor-menu');assert.ok(!state.currentScene.choices.some(c=>c.approach==='repay'));assert.equal(state.life.items.supplies,supplies-1);
 const declined=choose(diagnosed,'back');assert.equal(declined.life.cultivationProfile.experience.commitment??null,null);assert.equal(declined.life.cultivationProfile.experience.repaired,false);
});

test('a complete technique offers no fabricated defect or extra repair bill',()=>{
 const seed=Array.from({length:50},(_,i)=>i).find(seed=>!TECHNIQUES[engine.createLiveGame({...options,seed}).life.cultivationProfile.experience.activeTechniqueId].defective);
 assert.notEqual(seed,undefined);let state=choose(opening({seed}),'decline');state=choose(choose(state,'affairs-menu'),'mentor-menu');
 assert.ok(!state.currentScene.choices.some(c=>['diagnose','pledge','restore'].includes(c.approach)));
});

test('an old unclaimed nursery contract is honored by the office without summoning the original teenagers',()=>{
 const state=opening();state.life.ageDays=81*DAYS_PER_YEAR;
 for(const node of ['work','entry-result','companion','reunion']){
  state.events={...state.events,node,entry:'accepted',companion:'helped'};
  const scene=eventNode(state),text=scene.blocks.map(b=>b.text).join('');
  assert.doesNotMatch(text,/周执事照着|眼下他正在|林砚如今|林砚认出了你/);
  assert.ok(!scene.choices.some(row=>row.next==='companion'||row.next==='reunion'));
  if(node==='entry-result')assert.ok(scene.choices.some(c=>c.next==='old-record'));
 }
});

test('guidance is offered only when its three days leave time for a personal repayment',()=>{
 const state=repairStart();
 state.life.ageDays=100*DAYS_PER_YEAR-4;
 assert.ok(eventNode(state).choices.some(row=>row.key==='pledge'));
 state.life.ageDays++;
 assert.ok(!eventNode(state).choices.some(row=>row.key==='pledge'));
 assert.ok(eventNode(state).choices.some(row=>row.key==='restore'));
});

test('the authored loop can earn a real breakthrough and revisit the companion without replaying the aid reward',()=>{
 let state=choose(choose(choose(opening(),'ask'),'companion'),'aid');state=choose(state,'continue');state=choose(choose(choose(state,'accept'),'finish-work'),'continue');state=choose(state,'train-menu');
 let actions=0;
 while(state.life.realm==='mortal'&&actions++<45){
  assert.equal(state.phase,'active');const next=nextRealmFor(state.life);
  if(state.events.node!=='training')throw Error('not training');
  if(state.life.injury>1||state.life.cultivationProfile.spirit<25){state=choose(choose(state,'rest-menu'),'recover');state=choose(state,'train-menu');continue;}
  if((state.life.items[next.material]??0)<1){state=choose(choose(choose(choose(state,'rest-menu'),'back'),'journey-menu'),'resources-menu');state=choose(state,'gather');state=choose(state,'train-menu');continue;}
  if(state.life.cultivation<next.threshold){state=choose(state,'practice');state=choose(state,'train-menu');continue;}
  state=choose(state,'breakthrough');state=choose(state,'train-menu');
 }
 assert.equal(state.life.realm,'qi');assert.ok(actions<45);assert.equal(state.events.companion,'helped');
 state=choose(choose(choose(choose(state,'rest-menu'),'back'),'affairs-menu'),'companion-menu');assert.equal(state.events.node,'reunion');
 const herbs=state.life.items.herbs??0;state=choose(state,'reunion-work');assert.equal(state.life.items.herbs,herbs+2);assert.equal(state.lastReceipt.elapsedDays,5);
 state=choose(choose(state,'continue'),'affairs-menu');state=choose(state,'companion-menu');assert.equal(state.events.companion,'completed');assert.notEqual(state.events.node,'reunion');
});
