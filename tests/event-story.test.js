import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/cultivation/live/engine.js';
import {stateHash} from '../src/game/cultivation/live/identity.js';
import {TECHNIQUES,nextRealmFor,v7ActionRule} from '../src/game/cultivation/live/cultivation-rules.js';
import {eventNode} from '../src/game/cultivation/live/event-content.js';
import {saltWindow,validateSaltField} from '../src/game/cultivation/live/salt-field.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';
import {practicePlan} from '../src/game/cultivation/live/practice-plan.js';
import {adventureLeads,journeyNotes,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';

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

test('long-route invitations are available before acceptance and never impersonate commitments',()=>{
 const entry=opening();assert.deepEqual(adventureLeads(entry),[]);
 assert.deepEqual(adventureLeads({...entry,phase:'dead'}),[]);
 assert.deepEqual(adventureLeads({...entry,events:undefined}),[]);
 const employed=choose(entry,'accept');assert.equal(adventureLeads(employed)[0].node,'work');
 const independent=choose(entry,'decline'),leads=adventureLeads(independent);
 assert.deepEqual(leads.map(l=>l.node),['river-book','watch-book']);
 assert.match(leads[1].detail,/渡劫境/);assert.equal(journeyNotes(independent).length,0);
 for(const [node,path] of noteRoutes(independent,leads)){
  const reached=path.reduce(choose,independent);
  assert.equal(reached.events.node,node);assert.deepEqual(reached.life,independent.life);
  assert.equal(reached.rng,independent.rng);assert.equal(reached.events.river,undefined);assert.equal(reached.events.watch,undefined);
 }
 assert.equal(noteRoutes(independent,leads).size,2);
});

test('independent retreats expose the same native intensive tradeoff without requiring a garden',()=>{
 const base=choose(choose(choose(opening(),'decline'),'train-menu'),'practice');
 assert.equal(base.events.garden,undefined);
 const intensive=base.currentScene.choices.find(c=>c.id.endsWith(':c:intensive-again'));
 assert.ok(intensive);const rule=v7ActionRule(base,intensive),next=choose(base,'intensive-again');
 assert.equal(next.life.items.supplies,base.life.items.supplies-1);
 assert.equal(next.life.ageDays-base.life.ageDays,rule.days);
 assert.equal(base.life.cultivationProfile.spirit-next.life.cultivationProfile.spirit,rule.spiritCost);
 assert.equal(next.lastReceipt.cultivationResult.check.chance,rule.chance);
 assert.equal(next.life.cultivation-base.life.cultivation,next.lastReceipt.cultivationResult.check.success?rule.cultivation:0);
 assert.equal(next.events.garden,undefined);
 assert.equal(choose(base,'train-menu').events.node,'training');
 const empty=structuredClone(base);empty.currentScene=null;empty.life.items.supplies=0;empty.life.items.stones=0;empty.life.items.herbs=0;
 const proposal=eventNode(empty).choices.find(c=>c.key==='forage-again');assert.ok(proposal);
 assert.equal(v7ActionRule(empty,proposal).days,90);
 empty.life.items.stones=2;assert.ok(eventNode(empty).choices.some(c=>c.key==='ration-book'));
});

test('a retreat plan quotes actual ordinary steady turns and leaves each accepted appointment reachable',()=>{
 let s=choose(choose(opening(),'decline'),'train-menu');
 const plan=practicePlan(s);
 assert.ok(plan.count>=2);
 const life=structuredClone(s.life);
 for(let i=0;i<plan.count;i++)s=choose(s,i?'practice-again':'practice');
 assert.equal(s.life.ageDays-life.ageDays,plan.days);
 assert.equal(s.life.cultivation-life.cultivation,plan.gain);
 assert.equal(life.cultivationProfile.spirit-s.life.cultivationProfile.spirit,plan.spirit);
 assert.equal(s.life.cultivationProfile.exposure-life.cultivationProfile.exposure,plan.exposure);
 assert.equal(practicePlan(s),null);

 const base=choose(choose(opening(),'decline'),'train-menu'),age=base.life.ageDays,days=plan.days/plan.count;
 for(const [patch,pattern,node] of [
  [{garden:{plot:{bed:0,sown:age},record:[]}},/嫩候/,'garden-book'],
  [{watch:{trail:{start:age,world:0,outcome:null}}},/栗溪/,'watch-trail'],
  [{mine:{start:age,record:[]}},/交班/,'mine-book'],
  [{entry:'accepted',nursery:{start:age-1,care:null}},/药圃工日/,'work'],
  [{entry:'joined',nursery:{end:'beans'},saltField:{bed:'seep',sown:age,mended:false,parcel:null}},/盐埠改畦/,'seed-book'],
  [{convoy:{chapters:[{rig:'light',loads:[5,10]}]},charters:[{start:age,steps:[]}]},/沉钟湾轮航/,'packet-book'],
  [{post:{route:'relay',ending:'box',walk:{start:age,outcome:null}}},/潮约/,'post-shore'],
  [{post:{route:'relay',ending:'box',stations:[{sent:age,settled:null}]}},/两站/,'post-stations'],
 ]){
  const withDate={...base,events:{...base.events,...patch}};
  const constrained=practicePlan(withDate);
  assert.equal(constrained.count,0);assert.match(constrained.stop,pattern);assert.equal(constrained.stopNode,node);
 }
 const post={start:age,route:'relay',steps:[],ending:null};
 const scheduled=practicePlan({...base,events:{...base.events,post}});
 assert.equal(scheduled.count,Math.ceil(DAYS_PER_YEAR/days));assert.match(scheduled.stop,/回单/);
 base.life.cultivationProfile.spirit=plan.spirit/plan.count;
 assert.equal(practicePlan(base).count,1);assert.match(practicePlan(base).stop,/调息/);assert.equal(practicePlan(base).stopNode,null);
 base.life.cultivationProfile.spirit=life.cultivationProfile.spirit;
 base.life.ageDays=base.life.lifeLimit*DAYS_PER_YEAR-days;
 assert.equal(practicePlan(base).count,0);assert.match(practicePlan(base).stop,/寿元/);
 assert.equal(practicePlan({...base,events:{...base.events,node:'mount-sight'}}),null);
});

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

test('both opening forecasts and both tools determine which harvest survives, and three worked days pay one manual',()=>{
 const forecasts=new Set();
 for(let seed=1;seed<=16&&forecasts.size<2;seed++){
  const start=choose(choose(opening({seed}),'accept'),'nursery-book');
  const rain=Boolean(start.birthReceipt.random.after%2);
  if(forecasts.has(rain))continue;
  forecasts.add(rain);
  for(const tool of ['ditch','rack'])for(const crop of ['beans','herbs']){
   const protectedCrop=(tool==='ditch')===rain?'beans':'herbs';
   const first=choose(start,'nursery-'+tool),second=choose(first,'nursery-guard-'+crop);
   const item=crop==='beans'?'supplies':'herbs';
   const final=choose(second,'nursery-'+crop);
   assert.equal(final.life.ageDays-start.life.ageDays,3);
   assert.equal(final.life.items.manual,(start.life.items.manual??0)+1);
   assert.equal(final.life.items[item],(start.life.items[item]??0)+(protectedCrop===crop?2:1));
   assert.equal(final.events.entry,'joined');
   assert.equal(second.currentScene.choices.some(c=>c.id.endsWith(':c:nursery-pot')),protectedCrop==='beans'||crop==='beans');
  }
 }
 assert.equal(forecasts.size,2);
});

test('a transplanted seed uses the existing harvest calendar and pays only when actually harvested',()=>{
 const run=(s,...keys)=>keys.reduce(choose,s);
 let s=run(opening(),'accept','nursery-book','nursery-rack','nursery-guard-beans','nursery-pot','nursery-pot');
 assert.deepEqual(s.events.garden,{plot:{bed:0,sown:s.life.ageDays},record:[]});
 const food=s.life.items.supplies??0;
 s=run(s,'garden-book','inspect-bed','tend','inspect-bed','pick-tips');
 assert.equal(s.life.items.supplies,food+1);assert.equal(s.events.garden.plot,null);
 assert.match(s.currentScene.blocks.map(b=>b.text).join(''),/外院给的旧瓢/);
 s=choose(s,'garden-history');assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:pick-tips')));
});

test('leaving before or after a second shift keeps paid labor and closes the expired crop',()=>{
 const run=(s,...keys)=>keys.reduce(choose,s);
 for(const care of [false,true]){
  let s=run(opening(),'accept','nursery-book','nursery-ditch');
  if(care)s=choose(s,'nursery-guard-beans');
  const abandoned=run(s,'work-porch','abandon-work');
  assert.equal(abandoned.events.entry,'declined');assert.equal(abandoned.events.nursery.end,null);
  s=run(s,'work-porch','pause-work','train-menu','practice','train-menu','rest-menu','back','affairs-menu','resume-work');
  assert.match(s.currentScene.title,/过季/);
  const paid=choose(s,'nursery-late');assert.equal(paid.lastReceipt.elapsedDays,care?1:2);
  assert.deepEqual(paid.lastReceipt.itemChanges,{manual:1});assert.equal(paid.events.nursery.end,'late');
 }
});

test('an existing garden keeps its planted day when its keeper finishes the nursery separately',()=>{
 const run=(s,...keys)=>keys.reduce(choose,s);
 let s=run(opening(),'accept','work-porch','pause-work','train-menu','garden-book','sow');
 const firstPlot=structuredClone(s.events.garden);
 s=run(s,'train-menu','rest-menu','back','affairs-menu','resume-work','nursery-book','nursery-ditch','nursery-guard-beans');
 assert.ok(!s.currentScene.choices.some(c=>c.id.endsWith(':c:nursery-pot')));
 s=choose(s,'nursery-beans');assert.deepEqual(s.events.garden,firstPlot);
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

test('a wayside kitchen exchanges real stores and allows the ordinary forage instead',()=>{
 let s=choose(choose(choose(opening(),'decline'),'journey-menu'),'resources-menu');
 s=choose(choose(choose(s,'next-resource'),'next-resource'),'gather');
 const at=choose(s,'ration-book'),compiled=state=>engine.compileChoices(state,state.currentScene.choices);
 assert.equal(at.life.ageDays,s.life.ageDays);
 const limits={...at,life:{...at.life,items:{...at.life.items,stones:1,herbs:1}}};
 assert.deepEqual(compiled(limits).map(c=>c.enabled),[false,false,true]);
 for(const [key,item,days] of [['ration-buy','stones',1],['ration-tea','herbs',3]]){
  const stocked=structuredClone(at);
  stocked.life.items[item]=2;
  const packed=choose(stocked,key);
  assert.equal(packed.life.items[item],0);
  assert.equal(packed.life.items.supplies,at.life.items.supplies+4);
  assert.equal(packed.lastReceipt.elapsedDays,days);
  assert.equal(choose(packed,'intensive-again').life.items.supplies,at.life.items.supplies+3);
  stocked.life.items.supplies=9996;
  assert.equal(compiled(stocked).find(c=>c.id.endsWith(':c:'+key)).enabled,false);
 }
 const road=choose(at,'ration-road'),foraged=choose(road,'forage-again');
 assert.equal(foraged.lastReceipt.elapsedDays,90);
 assert.ok(foraged.lastReceipt.cultivationResult.check);
 assert.equal(choose(road,'train-menu').events.node,'training');
});

test('salt-field crops, rescue window and upper deliveries follow the recorded nursery and soil',()=>{
 for(const end of ['beans','herbs','pot','late']){
  const s=opening(),e=s.events,life=s.life;
  life.cultivationProfile.worldTier=1;e.node='seed-book';e.nursery={end,settled:life.ageDays};
  const opts=()=>eventNode(s).choices;
  const act=key=>{
   const selected=opts().find(c=>c.key===key);assert.ok(selected,key);
   life.ageDays+=selected.rule.days;Object.assign(e,selected.patch);
   validateSaltField(e,life);return selected.rule;
  };
  assert.match(eventNode(s).blocks[0].text,new RegExp({beans:'亲手送豆',herbs:'细籽',pot:'同畦',late:'本地灶户'}[end]));
  act(end==='herbs'?'seed-ridge':'seed-seep');
  const close=saltWindow(e,life.ageDays).close;
  life.ageDays=close;assert.equal(opts().some(c=>c.key==='seed-mend'),true);
  life.ageDays++;assert.equal(opts().some(c=>c.key==='seed-mend'),false);
  assert.equal(act('seed-watch').days,2);
  assert.equal(opts().some(c=>c.key==='seed-seed'),false);
  act('seed-notes');assert.equal(saltWindow(e,life.ageDays),null);
  assert.equal(opts().some(c=>c.key==='seed-trial'),false);
  life.cultivationProfile.worldTier=2;
  const copy=structuredClone(e.saltField),cost=act('seed-trial').items;
  assert.deepEqual(cost,end==='herbs'?{herbs:1}:{supplies:1});
  assert.deepEqual(opts().map(c=>c.key),['train-menu','back']);
  assert.throws(()=>validateSaltField({...e,saltField:{...copy,parcel:'seed'}},life),/盐畦/);
  e.saltField=copy;act('seed-wall');assert.match(eventNode(s).blocks[0].text,/井壁/);
 }
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
 assert.equal(state.events.firstMeeting,'helped');
 const legacy=structuredClone(state);
 delete legacy.events.firstMeeting;
 const oldOffer=choose(choose(legacy,'post-book'),'launch-relay');
 assert.equal(oldOffer.events.post.origin,'unknown');
 const offer=choose(choose(state,'post-book'),'launch-relay');
 assert.equal(offer.events.post.origin,'helped');assert.equal(offer.life.items.herbs,herbs+2);
});
