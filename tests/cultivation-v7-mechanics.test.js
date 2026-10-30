import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/cultivation/live/engine.js';
import { validateLiveState, serializeLiveState, deserializeLiveState } from '../src/game/cultivation/live/validation.js';
import { stateHash } from '../src/game/cultivation/live/identity.js';
import { V7_REALMS, ROOTS, TECHNIQUES, isV7Life, summarizeLife, initialItemsForBirth, realmFor, nextRealmFor, createCultivationBirthProfile, fortuneCycleModifier } from '../src/game/cultivation/live/cultivation-rules.js';

const proposal=(id='rest',intent='rest',targetId='self',approach='recover',stake='low')=>({id,label:id,intent,targetId,approach,stake});
const actor={id:'rival',name:'山客',kind:'person'};
const choicesFor=p=>[p,proposal('safe','rest','self',p.intent==='rest'&&p.approach==='recover'?'retire':'recover'),proposal('watch','interact','self','observe')];
const scene=(choices=choicesFor(proposal('train','practice','self','steady')))=>({id:'scene',title:'山间',location:'山居',blocks:[{kind:'narration',text:'山路仍在，你自行决定下一步。'}],entities:[actor,{id:'road',name:'渡口',kind:'place'}],choices,memoryDeltas:[]});
const born=(options={})=>engine.createLiveGame({runId:'v7-mechanics',seed:42,engineVersion:7,...options});
const take=(state,id='safe')=>engine.prepareChoice(state,{requestId:'turn-'+state.revision,choiceId:id});
function active(p=proposal('train','practice','self','steady'),options={}){
  const birth=born(options),opened=engine.commitTurn(birth,engine.prepareOpening(birth,{requestId:'opening'}),scene(choicesFor(p)));
  return engine.commitTurn(opened,take(opened),scene(choicesFor(p)));
}
// Synthetic later-life fixtures retain snapshot/receipt accounting. Separate
// replay tests exercise the complete, unmodified chain of legal actions.
function setLife(state,fields){
  Object.assign(state.life,fields);
  state.lastReceipt.after=summarizeLife(state.life);
  state.lastReceipt.before={...structuredClone(state.lastReceipt.after),ageDays:state.life.ageDays-state.lastReceipt.elapsedDays};
  state.lastReceipt.cultivationResult={version:7,check:null,lifespanChange:{years:0,cause:null}};
  return validateLiveState(state);
}
function forceNextRoll(state,desired){
  let rng=0;
  while(((Math.imul(rng,1664525)+1013904223)>>>0)%100!==desired)rng++;
  state.rng=rng;
  state.lastReceipt.random={before:Number(((BigInt(rng)-1013904223n)*4276115653n)&0xffffffffn),after:rng,roll:rng%100};
  return validateLiveState(state);
}
function provision(state){Object.assign(state.life.items,{supplies:100,stones:100,herbs:100,iron:100,relic:1,artifact:1,elixir:1,medicine:1});return state;}

test('legacy birth identity and mechanics remain exactly replay compatible',()=>{
  const state=engine.createLiveGame({runId:'v7-legacy-golden',seed:42});
  assert.equal(stateHash(state),'37588ee8b2a843f459b132e7a89203603f3a04606c73a92fcc42297d43994edd');
  assert.equal(isV7Life(state.life),false);
  assert.deepEqual(summarizeLife(state.life),{ageDays:5760,realm:'mortal',cultivation:0,injury:0});
  const opened=engine.commitTurn(state,engine.prepareOpening(state,{requestId:'open'}),scene());
  assert.throws(()=>engine.compileChoices(opened,[proposal('blood','evade','rival','blood')]));
  assert.equal(Object.hasOwn(take(opened).receipt,'cultivationResult'),false);
});

test('v7 birth is deterministic and immutable, with explicit traits and inherited benefits',()=>{
  const benefits=['resilient-body','past-memory','causal-compass','former-relic'];
  const state=born({inheritedBenefits:benefits});
  assert.deepEqual(state,born({inheritedBenefits:benefits}));
  assert.equal(isV7Life(state.life),true);
  assert.equal(state.life.birth.cultivationProfile.version,7);
  assert.equal(state.life.birth.cultivationProfile.advantages.length>=3,true);
  assert.equal(state.life.birth.cultivationProfile.defects.length>=3,true);
  assert.deepEqual(state.life.items,initialItemsForBirth(state.life.birth));
  assert.ok(state.life.items.relic>0);
  assert.equal(state.life.cultivation,1);
  assert.deepEqual(deserializeLiveState(serializeLiveState(state)),state);
  assert.throws(()=>born({inheritedBenefits:['past-memory','past-memory']}));
  assert.throws(()=>born({inheritedBenefits:['invented-bonus']}));
  const forged=structuredClone(state);forged.life.birth.cultivationProfile.rootId='invented';
  assert.throws(()=>validateLiveState(forged));
});

test('ordinary practice, travel, combat, exploration and recovery only advance age, never reduce maximum lifespan',()=>{
  const proposals=[proposal('go','practice','self','steady'),proposal('go','practice','self','intensive'),proposal('go','explore','stones','bold'),proposal('go','negotiate','rival','pressure'),proposal('go','fight','rival','desperate'),proposal('go','evade','rival','withdraw'),proposal('go','travel','road','road'),proposal('go','rest','self','recover')];
  for(const p of proposals){
    const state=provision(active(p)),pending=take(state,'go');
    assert.equal(pending.nextLife.ageDays-state.life.ageDays,pending.receipt.elapsedDays,p.intent);
    assert.equal(pending.nextLife.lifeLimit,state.life.lifeLimit,p.intent);
    assert.equal(pending.nextLife.cultivationProfile.lifespanLoss,0,p.intent);
    assert.deepEqual(pending.receipt.cultivationResult.lifespanChange,{years:0,cause:null});
  }
});

test('blood escape explicitly reduces the maximum and may cause local death without making age younger',()=>{
  const state=active(proposal('blood','evade','rival','blood'));
  const pending=take(state,'blood');
  assert.ok(pending.nextLife.lifeLimit<state.life.lifeLimit);
  assert.ok(pending.nextLife.ageDays>=state.life.ageDays);
  assert.equal(pending.receipt.cultivationResult.lifespanChange.cause,'blood-escape');
  const old=setLife(active(proposal('blood','evade','rival','blood')),{ageDays:80*360-1});
  const dying=take(old,'blood');
  assert.equal(dying.receipt.death.cause,'lifespan');
  assert.equal(dying.nextLife.ageDays,old.life.ageDays);
  assert.ok(dying.nextLife.ageDays>dying.nextLife.lifeLimit*360);
  assert.equal(engine.settleDeath(old,dying).phase,'dead');
});

test('an actual longevity elixir raises maximum lifespan without changing age',()=>{
  const state=active(proposal('extend','rest','self','extend'));
  assert.equal(engine.compileChoices(state,[state.currentScene.choices[0]])[0].enabled,false);
  state.life.items.elixir=1;
  const pending=take(state,'extend');
  assert.equal(pending.receipt.elapsedDays,0);
  assert.equal(pending.nextLife.ageDays,state.life.ageDays);
  assert.ok(pending.nextLife.lifeLimit>state.life.lifeLimit);
  assert.equal(pending.nextLife.items.elixir,0);
  assert.equal(pending.receipt.cultivationResult.lifespanChange.cause,'longevity-elixir');
  assert.equal(engine.commitTurn(state,pending,scene()).phase,'active');
});

test('breakthrough is a deliberate gated attempt and age cannot borrow the future realm ceiling',()=>{
  const state=active(proposal('advance','practice','qi','breakthrough'));
  setLife(state,{cultivation:999});
  assert.equal(engine.compileChoices(state,[state.currentScene.choices[0]])[0].enabled,false);
  assert.throws(()=>take(state,'advance'));
  state.life.items.manual=1;
  forceNextRoll(state,0);
  const successful=take(state,'advance');
  assert.equal(successful.nextLife.realm,'qi');
  assert.equal(successful.nextLife.items.manual,0);
  assert.equal(successful.receipt.cultivationResult.check.success,true);
  assert.ok(successful.receipt.elapsedDays>=360);
  const ordinary=provision(active(proposal('train','practice','self','steady')));
  setLife(ordinary,{cultivation:999});
  assert.equal(take(ordinary,'train').nextLife.realm,'mortal');
  setLife(state,{ageDays:80*360-1});
  const dying=take(state,'advance');
  assert.equal(dying.receipt.death.cause,'lifespan');
  assert.equal(dying.nextLife.realm,'mortal');
  assert.equal(dying.nextLife.lifeLimit,80);
});

test('failed breakthroughs consume their actual material, injure and regress cultivation without changing maximum lifespan',()=>{
  const state=active(proposal('advance','practice','qi','breakthrough'));
  setLife(state,{cultivation:10});state.life.items.manual=1;forceNextRoll(state,99);
  const failed=take(state,'advance');
  assert.equal(failed.receipt.cultivationResult.check.success,false);
  assert.equal(failed.nextLife.realm,'mortal');
  assert.equal(failed.nextLife.items.manual,0);
  assert.ok(failed.nextLife.injury>state.life.injury);
  assert.ok(failed.nextLife.cultivation<state.life.cultivation);
  assert.equal(failed.nextLife.lifeLimit,state.life.lifeLimit);
  assert.equal(engine.commitTurn(state,failed,scene()).phase,'active');
});

test('breakthrough lifespan increase retains genuine previous sacrifice',()=>{
  const state=active(proposal('advance','practice','qi','breakthrough'));
  const profile={...state.life.cultivationProfile,lifespanLoss:5};
  setLife(state,{lifeLimit:75,cultivation:10,cultivationProfile:profile});state.life.items.manual=1;forceNextRoll(state,0);
  const pending=take(state,'advance');
  assert.equal(pending.nextLife.lifeLimit,V7_REALMS.qi.lifeLimit-5);
  assert.equal(pending.nextLife.cultivationProfile.lifespanLoss,5);
});

test('forbidden technique backlash is distinct from ordinary training damage',()=>{
  const state=provision(active(proposal('forbid','practice','self','forbidden')));forceNextRoll(state,99);
  const pending=take(state,'forbid');
  assert.equal(pending.receipt.cultivationResult.check.kind,'forbidden');
  assert.equal(pending.receipt.cultivationResult.check.success,false);
  assert.ok(pending.nextLife.lifeLimit<state.life.lifeLimit);
  assert.equal(pending.receipt.cultivationResult.lifespanChange.cause,'forbidden-backlash');
});

test('all nine cultivation realms have actual material gates and higher realms use longer time scales',()=>{
  assert.deepEqual(Object.keys(V7_REALMS),['mortal','qi','foundation','golden','nascent','spirit','void','unity','mahayana','tribulation']);
  assert.equal(V7_REALMS.golden.name,'结丹');
  assert.equal(V7_REALMS.tribulation.name,'渡劫');
  for(const realm of Object.values(V7_REALMS).slice(1))assert.ok(realm.material&&realm.threshold>0&&realm.minYears>0);
  assert.ok(V7_REALMS.tribulation.practiceYears>V7_REALMS.qi.practiceYears);
  const state=active();const profile={...state.life.cultivationProfile,maxSpirit:280,spirit:280};
  // Keep the character's innate spirit modifier when constructing this fixture.
  const modifier=state.life.cultivationProfile.maxSpirit-100;profile.maxSpirit+=modifier;profile.spirit+=modifier;
  setLife(state,{realm:'tribulation',lifeLimit:V7_REALMS.tribulation.lifeLimit,cultivationProfile:profile});
  assert.equal(nextRealmFor(state.life),null);assert.equal(realmFor(state.life).name,'渡劫');
  const pending=take(state,'safe');assert.equal(pending.receipt.death,null);
  assert.equal(engine.commitTurn(state,pending,scene()).phase,'active');
});

test('four arts spend real ingredients and black-market trade carries exposure and failure risk',()=>{
  for(const [approach,target,art] of [['alchemy','elixir','alchemy'],['forge','artifact','forging'],['formation','array','formations'],['talisman','talisman','talismans']]){
    const state=provision(active(proposal('craft','craft',target,approach)));forceNextRoll(state,0);
    const pending=take(state,'craft');
    assert.equal(pending.receipt.cultivationResult.check.kind,'craft');
    assert.ok(Object.values(pending.receipt.itemChanges).some(n=>n<0));
    assert.ok(pending.nextLife.cultivationProfile.arts[art]>state.life.cultivationProfile.arts[art]);
  }
  const state=provision(active(proposal('trade','negotiate','rival','black-market')));forceNextRoll(state,99);
  const pending=take(state,'trade');
  assert.equal(pending.receipt.cultivationResult.check.kind,'black-market');
  assert.equal(pending.receipt.cultivationResult.check.success,false);
  assert.ok(pending.nextLife.cultivationProfile.exposure>state.life.cultivationProfile.exposure);
  assert.ok(pending.nextLife.injury>state.life.injury);
});

test('receipt validation rejects forged maximum-lifespan and forbidden-loss claims',()=>{
  const state=active(),pending=take(state),next=engine.commitTurn(state,pending,scene());
  for(const change of [s=>s.life.lifeLimit--,s=>s.lastReceipt.after.lifeLimit--,s=>{s.lastReceipt.cultivationResult.lifespanChange={years:-5,cause:'blood-escape'};},s=>{s.life.cultivationProfile.spirit=9999;}]){
    const copy=structuredClone(next);change(copy);assert.throws(()=>validateLiveState(copy));
  }
});

test('the four root categories and a nine-in-ten flawed technique draw have real consequences',()=>{
  assert.deepEqual(new Set(Object.values(ROOTS).map(root=>root.category)),new Set(['伪灵根','真灵根','异灵根','天灵根']));
  let flawed=0;
  for(let index=0;index<10;index++){
    let call=0;const profile=createCultivationBirthProfile(()=>call++===3?index:0);
    if(TECHNIQUES[profile.techniqueId].defective)flawed++;
  }
  assert.equal(flawed,9);
  let heavenly,expensive;
  for(let seed=0;seed<200&&(!heavenly||!expensive);seed++){
    const candidate=born({seed}),profile=candidate.life.birth.cultivationProfile;
    if(profile.rootId==='pure-heaven')heavenly=seed;
    if(profile.techniqueId==='false-circuit')expensive=seed;
  }
  assert.equal(typeof heavenly,'number');assert.equal(typeof expensive,'number');
  const luminous=active(proposal('train','practice','self','steady'),{seed:heavenly});
  assert.ok(take(luminous,'train').nextLife.cultivationProfile.exposure>=20);
  const inefficient=active(proposal('train','practice','self','steady'),{seed:expensive});
  const spent=inefficient.life.cultivationProfile.spirit-take(inefficient,'train').nextLife.cultivationProfile.spirit;
  assert.ok(spent>=13,'the flawed circuit consumes at least eight spirit beyond steady practice');
});

test('fortune changes on twenty-turn boundaries without rerolling or mutating birth facts',()=>{
  const state=born(),raw=JSON.stringify(state);
  const first=fortuneCycleModifier({...state,turnId:0});
  assert.equal(fortuneCycleModifier({...state,turnId:19}),first);
  assert.notEqual(fortuneCycleModifier({...state,turnId:20}),first);
  assert.equal(JSON.stringify(state),raw);
});

test('cross-world routes require explicit destinations, real resources and sufficient cultivation',()=>{
  for(const [approach,realm] of [['ascend','spirit'],['smuggle','foundation'],['rift','qi'],['ancient-array','foundation']]){
    // Create the ordinary opening before installing a synthetic later-life gate.
    const state=active(),record=V7_REALMS[realm],modifier=state.life.cultivationProfile.maxSpirit-100;
    const profile={...state.life.cultivationProfile,worldTier:0,exposure:70,maxSpirit:100+record.rank*20+modifier,spirit:100+record.rank*20+modifier};
    setLife(state,{realm,lifeLimit:record.lifeLimit,cultivation:30,cultivationProfile:profile});
    Object.assign(state.life.items,{supplies:10,stones:200,artifact:1,array:1,skykey:1,thunderseal:1});
    state.relatedEntities=[actor,{id:'gate',name:'中界落云台',kind:'place'}];state.currentScene.entities=structuredClone(state.relatedEntities);
    state.currentScene.choices=choicesFor(proposal('cross','travel','gate',approach));
    forceNextRoll(state,0);
    const pending=take(state,'cross');
    assert.equal(pending.receipt.cultivationResult.check.kind,'world-crossing');
    assert.equal(pending.receipt.cultivationResult.check.success,true);
    assert.equal(pending.nextLife.cultivationProfile.worldTier,1);
    assert.equal(pending.nextLife.lifeLimit,state.life.lifeLimit);
    assert.ok(pending.receipt.elapsedDays>=360);
    assert.ok(Object.values(pending.receipt.itemChanges).some(change=>change<0));
    assert.deepEqual(pending.nextLife.relations,state.life.relations);
    assert.equal(engine.commitTurn(state,pending,scene()).phase,'active');
    forceNextRoll(state,99);
    const failed=take(state,'cross');
    assert.equal(failed.receipt.cultivationResult.check.success,false);
    assert.equal(failed.nextLife.cultivationProfile.worldTier,0);
    assert.ok(failed.nextLife.injury>state.life.injury);
    if(approach==='rift')assert.equal(engine.settleDeath(state,failed).phase,'dead');
    state.currentScene.choices=choicesFor(proposal('cross','travel','gate','road'));
    assert.equal(engine.compileChoices(state,state.currentScene.choices)[0].enabled,false);
    state.currentScene.choices=choicesFor(proposal('cross','travel','gate',approach));
    state.relatedEntities[1].name='上界落云台';state.currentScene.entities=structuredClone(state.relatedEntities);
    assert.equal(engine.compileChoices(state,state.currentScene.choices)[0].enabled,false,'cannot skip the middle world');
  }
});

test('a fully legal seeded run obtains materials, attempts every realm and continues after tribulation',()=>{
  function planned(life){
    const next=nextRealmFor(life);
    if(!next||life.injury>0||life.cultivationProfile.spirit<70)return proposal('plan','rest','self','recover');
    if(life.cultivation<next.threshold)return proposal('plan','practice','self','steady');
    if(!(life.items[next.material]>0))return proposal('plan','explore',life.items.supplies>0?next.material:'supplies','cautious');
    return proposal('plan','practice',next.id,'breakthrough');
  }
  const nextScene=(life,turn)=>({...scene(),id:'legal-'+turn,entities:[],choices:[planned(life),proposal('watch','interact','self','observe'),{...proposal('look','interact','self','observe'),label:'检查近处线索'}]});
  const start=born({seed:0,runId:'v7-legal-nine-realms'});
  let state=engine.commitTurn(start,engine.prepareOpening(start,{requestId:'open'}),nextScene(start.life,1));
  const reached=['mortal'];
  for(let turn=0;turn<500&&state.phase==='active'&&state.life.realm!=='tribulation';turn++){
    assert.equal(engine.compileChoices(state,state.currentScene.choices)[0].enabled,true);
    const pending=engine.prepareChoice(state,{requestId:'legal-'+turn,choiceId:'plan'});
    state=pending.receipt.death?engine.settleDeath(state,pending):engine.commitTurn(state,pending,nextScene(pending.nextLife,turn+2));
    if(reached.at(-1)!==state.life.realm)reached.push(state.life.realm);
  }
  assert.deepEqual(reached,Object.keys(V7_REALMS));
  assert.equal(state.phase,'active');
  assert.ok(state.life.ageDays>3000*360,'higher-realm lifespan exceeds the old immortal ceiling');
  const previous=state.turnId;
  const pending=take(state,'plan');state=engine.commitTurn(state,pending,nextScene(pending.nextLife,state.turnId+1));
  assert.equal(state.phase,'active');assert.equal(state.turnId,previous+1);
  assert.deepEqual(state.birthReceipt,start.birthReceipt);
});
