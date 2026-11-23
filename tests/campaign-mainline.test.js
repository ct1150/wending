import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {nextRealmFor,realmFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {noteRoutes,preparationStops} from '../src/game/cultivation/live/journey-notes.js';
import {campaignProgress} from '../src/game/cultivation/live/campaign.js';
import {DAYS_PER_YEAR} from '../src/game/cultivation/live/model.js';
import {stateHash} from '../src/game/cultivation/live/identity.js';

function createRoute(){
 const config={runId:'campaign-native',engineVersion:7,originStories:true,eventVersion:2,seed:42,name:'沈渡'};
 let state=createLiveGame(config);
 const opening=prepareOpening(state,{requestId:'opening'});
 state=commitTurn(state,opening,resolveRuleScene(state,opening));
 const actions=[];
 const id=key=>state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key))?.id;
 const can=key=>compileChoices(state,state.currentScene.choices).some(c=>c.id===id(key)&&c.enabled);
 function pick(...keys){
  for(const key of keys){
   assert.ok(id(key),`${state.events.node} missing ${key}`);
   const turn=prepareChoice(state,{requestId:`campaign-${state.turnId}`,choiceId:id(key)});
   assert.equal(turn.receipt.death,null,`death at ${state.life.realm}: ${key}`);
   state=commitTurn(state,turn,resolveRuleScene(state,turn));
   actions.push(key);
  }
 }
 function reach(node){
  const path=noteRoutes(state,[{node}]).get(node);
  assert.ok(path,`no route to ${node} from ${state.events.node}`);
  pick(...path);
 }
 function rest(){reach('rest');pick('recover');}
 function stock(item,count){
  for(let tries=0;(state.life.items[item]??0)<count;tries++){
   assert.ok(tries<65,`could not collect ${item}`);
   if(state.life.injury>1||state.life.cultivationProfile.spirit<18)rest();
   if(state.lastReceipt.action?.targetId===item&&can('gather-again'))pick('gather-again');
   else{
    const stop=preparationStops(state).find(stop=>stop.id==='resource-'+item);
    assert.ok(stop,`no resource stop for ${item}`);
    const path=noteRoutes(state,[stop]).get(stop.id);
    assert.ok(path,`can't reach ${stop.id} from ${state.events.node}`);
    pick(...path,'gather');
   }
  }
 }
 function craft(item){
  for(let tries=0;!state.life.items[item];tries++){
   assert.ok(tries<15);
   stock('stones',6);stock('iron',item==='array'?2:4);rest();
   const stop=preparationStops(state).find(stop=>stop.id==='recipe-'+item);
   const path=noteRoutes(state,[stop]).get(stop.id);
   assert.ok(path);pick(...path,'craft');
  }
 }
 function train(target){
  for(let tries=0;state.life.realm!==target;tries++){
   assert.ok(tries<175,`could not reach ${target}`);
   const next=nextRealmFor(state.life);
   const yearsLeft=state.life.lifeLimit-state.life.ageDays/DAYS_PER_YEAR;
   if(yearsLeft<next.minYears+realmFor(state.life).practiceYears+1){
    reach('rest');pick('recover');
    for(let i=0;!state.life.items.elixir;i++){
     assert.ok(i<75);
     pick(state.life.cultivationProfile.spirit<15||state.life.injury>1?'recover':
      state.life.items.herbs>=8&&state.life.items.stones>=12?'brew-elixir':'gather-ingredient');
    }
    pick('take-elixir');
   }
   if(state.life.injury>1||state.life.cultivationProfile.spirit<40+next.rank*4)rest();
   if(state.life.cultivation<next.threshold){
    if(can('practice-again'))pick('practice-again');
    else{reach('training');pick('practice');}
    continue;
   }
   stock(next.material,1);
   if(next.rank>=7){craft('artifact');craft('array');}
   if(state.life.injury>1||state.life.cultivationProfile.spirit<45+next.rank*5)rest();
   reach('training');
   if(next.rank>=7)pick('ward-book','guarded-breakthrough');
   else pick('breakthrough');
  }
 }
 function cross(tier){
  for(let tries=0;state.life.cultivationProfile.worldTier<tier;tries++){
   assert.ok(tries<8);
   craft('array');stock('stones',tier===1?45:90);rest();
   reach('crossing-ways');pick('cross-array');
  }
 }
 pick('leave-village','take-road','follow-water','save-houses');
 for(let i=0;state.life.realm==='mortal';i++){
  assert.ok(i<15);
  if(state.events.node==='prologue-result')pick('recover-first');
  else pick(compileChoices(state,state.currentScene.choices).find(c=>c.enabled).id.split(':').at(-1));
 }
 pick('take-help','chapter-out','affairs-menu');
 assert.equal(state.lastReceipt.elapsedDays,0);
 assert.ok(can('companion-menu'));
 pick('campaign-book');
 for(const [rank,realm] of ['qi','foundation','golden','nascent','spirit','void','unity','mahayana'].entries()){
  if(rank===2)cross(1);
  if(rank===4)cross(2);
  train(realm);
  reach('campaign-book');
  assert.equal(campaignProgress(state).done,rank);
  if(rank===0){
   const atBook=state,length=actions.length;
   pick('campaign-act');
   const plan=key=>prepareChoice(state,{requestId:'preview',choiceId:id(key)}).receipt;
   const before=plan('campaign-personal').elapsedDays;
   assert.ok(plan('campaign-public').elapsedDays<before);
   assert.equal(plan('campaign-public').itemChanges.supplies,-1);
   state=atBook;actions.length=length;
   pick('campaign-detour','river-open','clue-1','river-return','deliberate','policy-0');
   reach('campaign-book');
   pick('campaign-act');
   assert.equal(plan('campaign-personal').elapsedDays,Math.ceil(before/2));
   pick('campaign-book');
  }
  pick('campaign-act');
  assert.ok(can('campaign-personal'));
  pick('campaign-personal');
  assert.equal(state.events.campaign.marks.length,rank+1);
 }
 train('tribulation');reach('campaign-book');pick('campaign-ding');
 return {get state(){return state;},config,actions,pick};
}

test('a new life crosses all three worlds and can leave two different legacies at the final inscription',async t=>{
 const route=createRoute();
 assert.equal(route.state.life.cultivationProfile.worldTier,2);
 assert.equal(route.state.life.realm,'tribulation');
 assert.equal(route.state.events.campaign.marks,'11111111');
 const alternate=route.state.currentScene.choices.find(c=>c.id.endsWith(':c:ding-public'));
 const turn=prepareChoice(route.state,{requestId:'alternate',choiceId:alternate.id});
 const publicEnding=commitTurn(route.state,turn,resolveRuleScene(route.state,turn));
 assert.equal(publicEnding.events.campaign.ending,'public');
 route.pick('ding-personal');
 assert.equal(route.state.events.campaign.ending,'personal');
 assert.equal(campaignProgress(route.state).done,campaignProgress(route.state).total);
 assert.equal(route.state.phase,'active');
 assert.notEqual(publicEnding.lastReceipt.elapsedDays,route.state.lastReceipt.elapsedDays);
 const endTurn=route.state.turnId;
 route.pick('back','affairs-menu');
 assert.equal(route.state.lastReceipt.elapsedDays,0);
 route.pick('campaign-book','read-ending');
 assert.equal(route.state.lastReceipt.elapsedDays,0);
 assert.equal(route.state.turnId,endTurn+4);
 assert.equal(route.state.events.campaign.ending,'personal');
 if(process.env.WENDING_VERIFY_CAMPAIGN_BROWSER)await verifyNativeCampaignInBrowser(t,route);
 t.diagnostic(`Native continuous route: ${route.actions.length} actions from birth to ending and reread.`);
});

async function verifyNativeCampaignInBrowser(t,route){
 const {liveBrowser}=await import('./helpers/live-browser.js');
 const {page}=await liveBrowser(t);
 const hashes=await page.evaluate(async ({config,actions})=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const {openLiveArchive}=await import('/src/game/live-archive.js');
  const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
  const {stateHash}=await import('/src/game/cultivation/live/identity.js');
  const archive=await openLiveArchive({name:'campaign-full'}),copy=await openLiveArchive({name:'campaign-full-copy'});
  try{
   const session=createLiveSession({archive,client:{}});
   let run=await session.startNew(config);
   for(const key of actions){
    const choice=run.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
    run=await session.choose({choiceId:choice.id,baseRevision:run.state.revision,stateHash:stateHash(run.state)});
    if(run.errorCode)throw Error(`${key}: ${run.errorCode}`);
   }
   await importLiveArchive(exportLiveArchive(archive),copy);
   return [stateHash(run.state),stateHash((await copy.load()).state)];
  }finally{archive.close();copy.close();}
 },{config:route.config,actions:route.actions});
 assert.deepEqual(hashes,[stateHash(route.state),stateHash(route.state)]);
}
