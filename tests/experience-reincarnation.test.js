import test from 'node:test';
import assert from 'node:assert/strict';
import {storyLife} from './helpers/experience-death.js';
import {buildRebirthOptions,getReincarnationSettlement,validateReincarnation} from '../src/game/cultivation/live/reincarnation.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {buildStoryInput} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {renderLiveJourney} from '../src/ui/journey.js';
test('real owed and fulfilled lives leave different traceable memories without inherited items or points for narration',()=>{
 for(const repaid of [false,true]){
  const p=storyLife('last-life-'+repaid,repaid),s=getReincarnationSettlement(p.state),o=buildRebirthOptions(p.state,[]),r=o.reincarnation;
  assert.equal(s.earnedPoints,2);assert.equal(s.deathCause,'injury');assert.equal(s.selectionLimit,2);assert.ok(s.decisions.some(t=>t.includes('校法')));
  assert.equal(s.unfinished.length,repaid?0:1);assert.ok(s.decisions.some(t=>t.includes('拼命')));
  assert.equal(r.version,2);assert.equal(r.parentStateHash,p.hash);assert.equal(r.echoes.length,3);assert.equal(r.echoes.find(e=>e.kind==='pledge').status,repaid?'fulfilled':'owed');assert.equal(r.echoes.find(e=>e.kind==='pledge').turn,p.state.life.cultivationProfile.experience.commitment.acceptedTurn);
  const b=createLiveGame({...o,runId:'next',seed:2}),n=createLiveGame({engineVersion:7,experienceVersion:1,runId:'next',seed:2});assert.deepEqual(b.life,n.life);assert.equal(b.rng,n.rng);
  const c=buildStoryContext(b,prepareOpening(b,{requestId:'open'}),[],{selection:'relevance-v1',openTotal:0}),input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),word=repaid?'已还行粮':'尚欠行粮';
  assert.ok(JSON.stringify(input.messages).includes(word));assert.ok(!c.entities.some(e=>e.id===p.state.life.cultivationProfile.experience.commitment.entityId));
  assert.ok(renderLiveJourney({state:b},[]).includes(word));assert.ok(renderLiveJourney({state:p.state},[]).includes('最多两项'));
  for(const edit of [x=>x.balance++,x=>x.echoes[1].entityId='another-life',x=>x.echoes[0].turn--,x=>x.echoes.push(x.echoes[0])]){const forged=structuredClone(r);edit(forged);assert.throws(()=>validateReincarnation(forged));}
  const downgrade={...o};delete downgrade.experienceVersion;assert.throws(()=>createLiveGame(downgrade));
 }
});
test('four real deaths can bank eight points; marked child limits purchases to two even when three are affordable, legacy keeps all three',()=>{
 for(const marked of [true,false]){
  let parent=null;for(let n=0;n<4;n++)parent=storyLife('life-'+n,false,parent,{marked}).state;
  const ids=['past-memory','resilient-body','causal-compass'];assert.equal(getReincarnationSettlement(parent).availablePoints,8);
  const two=buildRebirthOptions(parent,ids.slice(0,2));assert.equal(two.reincarnation.balance,3);
  if(marked)assert.throws(()=>buildRebirthOptions(parent,ids),{code:'REINCARNATION_SELECTION_LIMIT'});
  else{const r=buildRebirthOptions(parent,ids).reincarnation;assert.equal(r.version,1);assert.equal(r.balance,0);assert.equal(r.echoes,undefined);assert.equal(Object.keys(r).length,8);}
 }
});

test('self-study is observed in the death snapshot without inventing a turn for the repair',()=>{
 const parent=storyLife('self-study',false,null,{selfStudy:true}),s=getReincarnationSettlement(parent.state),e=s.echoes.find(e=>e.kind==='method');
 assert.ok(parent.steps.findIndex(row=>row.command.customAction==='自行推演残法')<parent.steps.length-2);
 assert.equal(e.route,'study');assert.equal(e.turn,undefined);assert.equal(e.observedAt,parent.state.turnId);assert.equal(s.unfinished.length,0);assert.ok(s.decisions.at(-1).includes('拼命'));
});
