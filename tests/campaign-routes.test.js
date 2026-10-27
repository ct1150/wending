import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { validateCultivation } from '../src/game/cultivation/validation.js';
import { NODES, resolveCultivationScene } from '../src/game/cultivation/v3/content.js';
import { REALMS, TALENTS } from '../src/game/cultivation/v3/model.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';

function take(state,id,extra={}) {
 const view=getCultivationView(state);
 if(state.phase!=='creating') assert.ok(view.choices.find(choice=>choice.id===id)?.enabled,`${state.scene.nodeId}: ${id} unavailable ${JSON.stringify(view.choices)}`);
 const result=chooseCultivation(state,{revision:view.revision,sceneId:view.sceneId,choiceId:id,...extra});
 assert.equal(result.kind,'applied',`${state.scene.nodeId}/${id}: ${result.message}`);
 validateCultivation(result.state);
 return result.state;
}
function start(origin='village',seed='route',state=null) {
 let s=state||createCultivation({contentVersion:3,characterCreation:true,seed});
 s=take(s,'birth-origin',{originId:origin});
 return take(s,'birth-start',{name:'问路'});
}
function primary(state,route='sect',trial='ruins') {
 const view=getCultivationView(state), enabled=view.choices.filter(c=>c.enabled);
 return (enabled.find(c=>c.id===`route-${route}`)||enabled.find(c=>c.id===`trial-${trial}`)||enabled.find(c=>c.id==='breakthrough')||enabled.find(c=>c.id==='talent-use')||enabled.find(c=>c.id==='combine')||enabled.find(c=>c.id==='continue')||enabled[0]).id;
}
function journey({origin='village',route='sect',trial='ruins',seed='journey',state=null,overrides={},stop=null}={}) {
 let s=state||start(origin,seed), steps=0;
 const seen=new Set(), gates=[];
 while(s.phase==='playing' && s.scene.nodeId!==stop && steps<180) {
  seen.add(s.scene.nodeId);
  const choiceId=overrides[s.scene.nodeId]||primary(s,route,trial);
  const choice=resolveCultivationScene(s).choices.find(c=>c.id===choiceId);
  if(choice.effects?.realm){const r=REALMS[choice.effects.realm];gates.push({from:s.life.realm,to:r.id,material:r.material,count:s.life.items[r.material],cultivation:s.life.cultivation,years:choice.costs.years});}
  s=take(s,choiceId);steps++;
 }
 assert.ok(steps<180,'route must terminate without a farming loop');
 return {state:s,steps,seen,gates};
}

test('all four origins, three livelihoods and three expeditions earn every realm and all three proofs through public commands',()=>{
 const seen=new Set(['ended']);
 for(const origin of ['village','artisan','ferry','exile'])for(const route of ['sect','wanderer','alliance'])for(const trial of ['ruins','beast','sea']){
  const run=journey({origin,route,trial,seed:`${origin}/${route}/${trial}`});
  assert.equal(run.state.summary.cause,'victory');
  assert.equal(run.state.life.realm,'immortal');
  assert.deepEqual([...run.state.world.proofs].sort(),['celestial','mortal','nether']);
  assert.ok(run.steps>=55,`winning path had only ${run.steps} choices`);
  assert.deepEqual(run.gates.map(g=>g.to),['qi','foundation','golden','nascent','spirit','immortal']);
  for(const gate of run.gates){assert.ok(gate.count>=1);assert.ok(gate.cultivation>=REALMS[gate.to].threshold);assert.ok(gate.years>=REALMS[gate.to].minYears);assert.equal(run.state.life.items[gate.material],0);}
  assert.deepEqual(deserializeGame(serializeGame(run.state)),run.state);
  run.seen.forEach(id=>seen.add(id));
 }
 assert.ok(seen.size>=90,`Main routes reached ${seen.size} nodes`);
});

test('every authored scene is reachable including recovery, celestial side paths, and earned next-life origin',()=>{
 const seen=new Set(['ended']);
 for(const origin of ['village','artisan','ferry','exile'])for(const route of ['sect','wanderer','alliance'])for(const trial of ['ruins','beast','sea'])journey({origin,route,trial}).seen.forEach(id=>seen.add(id));
 for(const realm of ['qi','foundation','golden','nascent','spirit','immortal']){
  let s=journey({stop:`${realm}-gate`}).state;
  s=take(s,'recover');seen.add(s.scene.nodeId);
  s=take(s,'continue');assert.equal(s.scene.nodeId,`${realm}-gate`);
 }
 const won=journey().state;
 let reborn=take(won,'new-life');
 reborn=start('wanderer','ignored',reborn);
 assert.ok(resolveCultivationScene(reborn).choices.some(c=>c.id==='old-shelter'));
 const sheltered=take(reborn,'old-shelter');
 assert.equal(sheltered.life.items.favor,(reborn.life.items.favor||0)+1);
 assert.equal(sheltered.life.facts['used-old-shelter'],true);
 journey({state:reborn}).seen.forEach(id=>seen.add(id));
 // Branch discovery uses a reachable saved state and genuine public actions.
 const states=[];let s=start();
 while(s.phase==='playing'){states.push(s);s=take(s,primary(s));}
 for(const original of states){
  const choices=getCultivationView(original).choices.filter(c=>c.enabled);
  for(const choice of choices){
   const next=take(original,choice.id);
   if(next.phase==='playing')journey({state:next}).seen.forEach(id=>seen.add(id));
  }
 }
 assert.deepEqual(NODES.filter(id=>!seen.has(id)),[],`Unreachable catalog nodes: ${NODES.filter(id=>!seen.has(id)).join(', ')}`);
});

test('both owned talents have an actionable opportunity in first ten choices, and all eight can be earned',()=>{
 const reached=new Set();
 for(let seed=0;seed<80&&reached.size<6;seed++){
  let s=start('village',seed),count=0;
  while(s.scene.nodeId!=='qi-gate'&&count<10){
   if(s.scene.nodeId==='talent-first'||s.scene.nodeId==='talent-second'){
    const index=s.scene.nodeId==='talent-first'?0:1,id=s.life.birth.talentIds[index];
    assert.ok(getCultivationView(s).choices.find(c=>c.id==='talent-use')?.enabled);reached.add(id);
   }
   s=take(s,primary(s));count++;
  }
  assert.equal(s.scene.nodeId,'qi-gate');
  assert.ok(s.life.facts['talent-combination']);
 }
 assert.equal(reached.size,6);
 let s=take(journey().state,'new-life');
 for(let reroll=0;reroll<150&&!['rootless','void-echo'].every(id=>reached.has(id));reroll++){
  s=take(s,'birth-reroll');
  for(const id of s.life.birth.talentIds)if(['rootless','void-echo'].includes(id)){
   const run=start('wanderer','unused',s);
   const before=journey({state:run,stop:'qi-gate'}).state;
   assert.equal(before.life.facts[`used-${id}`],true);reached.add(id);
  }
 }
 assert.deepEqual([...reached].sort(),Object.keys(TALENTS).sort());
});

test('a declared fatal duel and voluntary retirement produce biographies and genuinely different next lives',()=>{
 const atChain=journey({stop:'nether-chain'}).state;
 const loss=take(atChain,'challenge');
 assert.equal(loss.summary.cause,'battle');
 assert.ok(!loss.world.facts['nether-pact']);
 assert.ok(loss.world.biography[0].deeds.some(text=>/死战/.test(text)));
 const firstFate=JSON.stringify(loss.scene.fate);
 const next=take(loss,'new-life');
 assert.equal(next.phase,'creating');
 assert.notEqual(JSON.stringify(next.scene.fate),firstFate);
 assert.deepEqual(next.world.proofs,['mortal']);
 assert.ok(next.transcript.length>=loss.transcript.length);
 const gate=journey({stop:'qi-gate'}).state;
 const retired=take(gate,'retire');
 assert.equal(retired.summary.cause,'retired');
 assert.equal(retired.life.ageDays,80*360);
 let expired=gate,restCount=0;
 while(expired.phase==='playing'&&restCount<80){
  expired=take(expired,expired.scene.nodeId==='qi-gate'?'recover':'continue');
  restCount++;
 }
 assert.equal(expired.summary.cause,'lifespan');
 assert.equal(expired.life.realm,'mortal');
 assert.equal(expired.life.ageDays,80*360);
 assert.equal(expired.life.items.manual,1);
 assert.deepEqual(expired.world.proofs,[]);
});

test('costlier and risky alternatives remain playable without free resource loops',()=>{
 for(let seed=0;seed<6;seed++){
  let s=start(['village','artisan','ferry','exile'][seed%4],`alternatives-${seed}`),steps=0;
  while(s.phase==='playing'&&steps<100){
   const enabled=getCultivationView(s).choices.filter(c=>c.enabled);
   const canonical=resolveCultivationScene(s).choices;
   const alternative=enabled.find(c=>c.id==='alternative'&&!canonical.find(row=>row.id===c.id).ending);
   const id=enabled.some(c=>c.id==='breakthrough')?'breakthrough':s.scene.nodeId.endsWith('-gate')?primary(s):alternative?.id||primary(s,['sect','wanderer','alliance'][seed%3],['ruins','beast','sea'][seed%3]);
   const before=s.world.day;s=take(s,id);assert.ok(s.world.day>before,'every route action spends actual time');steps++;
  }
  assert.equal(s.summary.cause,'victory');assert.ok(steps>=55&&steps<100);
 }
});

export { start, take, primary, journey };
