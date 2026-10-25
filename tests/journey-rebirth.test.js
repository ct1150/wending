import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, getJourneyView, chooseJourney } from '../src/game/journey/engine.js';
import { validateJourney } from '../src/game/journey/validation.js';
import { renderJourney } from '../src/ui/journey.js';
import { route, pick, clinic, evidenceVictory, limitedVictory } from './helpers/journey-routes.js';

const rebirth = s => pick(s, getJourneyView(s).choices[0]?.id);
test('ended life offers direct rebirth without a reward and preserves full history', () => {
 const ended = route([...clinic.slice(0,-1), 'keep-watch']);
 const view = getJourneyView(ended);
 assert.equal(view.choices.length,1);
 assert.deepEqual(ended.world.legacies,[]);
 const next = rebirth(ended);
 assert.equal(next.world.generation,2); assert.equal(next.world.year,ended.world.year+16);
 assert.equal(next.revision,ended.revision+1); assert.deepEqual(next.world.biography,ended.world.biography);
 assert.equal(next.scene.nodeId,'later-clinic'); assert.equal(next.life.legacyId,null);
 assert.ok(next.world.biography[0].transcript.length > 20);
 assert.match(renderJourney(getJourneyView(next)),/生平|旧人生/);
 assert.equal(chooseJourney(next,{revision:0,sceneId:next.scene.nodeId,choiceId:'triage-severity'}).kind,'stale');
});
test('living victory explicitly waits remaining years then births once without replaying finale', () => {
 const won = route(evidenceVictory), remaining = getJourneyView(won).summary.remainingLife;
 assert.match(getJourneyView(won).choices[0]?.detail ?? '',new RegExp(String(remaining)));
 const next = rebirth(won);
 assert.equal(next.world.year,won.world.year+remaining+16);
 assert.equal(next.world.biography.length,1); assert.equal(next.world.biography[0].cause,'victory');
 assert.deepEqual(next.world.completedTasks,won.world.completedTasks);
 assert.equal(next.world.facts['local-supply'],'minimum'); assert.equal(next.world.facts['celestial-consent'],'clinic');
 assert.equal(next.world.facts['ledger-original'],'archive'); assert.equal(next.life.items['ledger-page']??0,0);
 assert.equal(next.world.people['wen-du'].status,'dead'); assert.equal(next.life.facts['copy-custodian'],undefined);
});
test('earned methods offer one retained and at most two actual replacements, applied without stacking', () => {
 let state=route([...clinic.map(x=>x==='continue-road'?'learn-method':x).slice(0,-1),'keep-watch'],1);
 assert.ok(state.world.legacies.includes('discern-memory'));
 state=rebirth(state); assert.equal(state.life.legacyId,'discern-memory'); assert.deepEqual(state.life.abilities,[]);
 assert.ok(getJourneyView(state).choices.every(c=>c.enabled));
});
test('destroyed seed, dead witness and completed refuge stay true across repeated lives', () => {
 let state=rebirth(route(limitedVictory));
 for(const id of ['acknowledge-loss','small-plot','continue-journey']) state=pick(state,id);
 assert.equal(state.scene.nodeId,'later-finished'); assert.equal(state.phase,'playing');
 state=pick(state,'finish-life'); state=rebirth(state);
 assert.equal(state.scene.nodeId,'later-echo');
 assert.equal(state.world.facts['seed-state'],'destroyed'); assert.equal(state.world.people['wen-du'].status,'dead');
 assert.equal(state.world.completedTasks.filter(r=>r.episodeId==='mortal-refuge').length,1);
 assert.match(getJourneyView(state).blocks.at(-1).text,/小块|小药圃/);
});
test('held celestial proof does not revoke institutional supply or transfer old duties', () => {
 let state=rebirth(route(evidenceVictory));
 state.scene={...state.scene,chapterId:'celestial',nodeId:'celestial-arrival'};
 state=pick(state,'honor-celestial-proof');
 assert.equal(state.world.facts['local-supply'],'minimum'); assert.equal(state.world.facts['celestial-consent'],'clinic');
 assert.equal(state.life.facts['copy-custodian'],'self');
 validateJourney(state);
});

test('all three sequel types have real complete and constrained outcomes without replay or valley replacement',()=>{
 const cases=[
 ['choose-clinic',['triage-severity','cover-medicine','clinic-open-council'],'clinic_open_council'],
 ['choose-clinic',['triage-members','cover-medicine','clinic-keeper-rule'],'clinic_keeper_rule'],
 ['choose-clinic',['triage-severity','clinic-sect-debt'],'clinic_sect_debt'],
 ['choose-clinic',['clinic-rationed'],'clinic_rationed'],
 ['choose-estate',['mandate-supply','estate-shared-supply'],'estate_shared_supply'],
 ['choose-estate',['mandate-graves','estate-grave-access'],'estate_grave_access'],
 ['choose-estate',['estate-unchanged'],'estate_unchanged'],
 ['choose-ash',['acknowledge-loss','build-garden','refuge-common-medicine'],'refuge_common_medicine'],
 ['choose-ash',['contribute-care','build-garden','refuge-family-medicine'],'refuge_family_medicine'],
 ['choose-ash',['acknowledge-loss','small-plot'],'refuge_small_plot'],
 ['choose-ash',['refuge-unchanged'],'refuge_unchanged'],
 ];
 for(const [valley,ids,outcome] of cases){
  let s=rebirth(route([...clinic.slice(0,-1).map(id=>id==='choose-clinic'?valley:id),'keep-watch']));
  const oldValley=s.world.facts['valley-outcome'];for(const id of ids)s=pick(s,id);
  assert.equal(s.phase,'playing');assert.equal(s.world.completedTasks.at(-1).outcomeId,outcome);
  assert.equal(s.world.facts['valley-outcome'],oldValley);
  const count=s.world.completedTasks.length;s=pick(s,'finish-life');s=rebirth(s);
  assert.equal(s.scene.nodeId,'later-echo');assert.equal(s.world.completedTasks.length,count);
 }
});
test('all-completed imported records have a finite living echo, and old episodes cannot be rewarded again',()=>{
 let s=rebirth(route(limitedVictory));
 for(const [arc,outcome] of [['clinic','clinic_open_council'],['estate','estate_shared_supply'],['refuge','refuge_small_plot']])s.world.completedTasks.push({episodeId:`mortal-${arc}`,outcomeId:outcome,generation:1,sequence:s.world.completedTasks.length+1});
 s.scene.nodeId='refuge-garden';
 assert.equal(getJourneyView(s).choices.find(c=>c.id==='small-plot').enabled,false);
 s.scene.nodeId='later-result';s=pick(s,'finish-life');s=rebirth(s);s=pick(s,'continue-journey');
 assert.equal(s.scene.nodeId,'later-finished');assert.equal(s.phase,'playing');
 const bad=structuredClone(s);bad.world.completedTasks.push({...bad.world.completedTasks.at(-1),generation:bad.world.generation,sequence:bad.world.completedTasks.length+1});
 assert.throws(()=>validateJourney(bad),/重复/);
});
test('one-year remaining sequel still has an affordable limited completion',()=>{
 let s=rebirth(route([...clinic.slice(0,-1),'keep-watch']));s=pick(s,'triage-severity');
 s.life.lifeDamage=s.life.lifeLimit-s.life.age-1;
 assert.equal(getJourneyView(s).choices.find(c=>c.id==='cover-medicine').enabled,false);
 s=pick(s,'clinic-rationed');s=pick(s,'continue-journey');assert.equal(s.phase,'playing');
});
test('an unfinished Nether responsibility preserves earlier actual debt relief across lives',()=>{
 let s=route([...clinic,'shelve-records','correct-record','continue-inquest','record-gaps','protect-sources','leave-dispute','authorize-self','continue-celestial','limit-terms','trial-appeal','deliver-copies','withdraw-ding','return-watch']);
 s=rebirth(s);s=pick(s,'clinic-rationed');s=pick(s,'continue-journey');
 const view=getJourneyView(s);assert.match(view.blocks.at(-1).text,/没有重新|已纠正/);
 const right=s.world.facts['nether-local-right'];s=pick(s,'shelve-records');
 assert.equal(s.scene.nodeId,'nether-opportunity');assert.equal(s.world.facts['nether-local-right'],right);
});
test('malformed original archive and contradictory natural death records are rejected',()=>{
 const s=rebirth(route(evidenceVictory));
 for(const mutate of [x=>{x.world.people['shen-zhi'].status='safe';},x=>{x.world.legacyArchive={bad:'record'};},x=>{x.world.biography[0].transcript=[{kind:'evil',text:'bad'}];}]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>validateJourney(bad),/旅程存档|存档/);
 }
});

test('a historically owned method can be reawakened through the applicable real lesson',()=>{
 let s;
 for(let seed=0;seed<30;seed++){
  s=route([...clinic,'shelve-records','correct-record'],seed);
  if(s.scene.opportunities.nether==='nether-lamp')break;
 }
 s.world.legacies.push('tomb-lantern');
 for(const id of ['learn-nether','record-gaps','protect-sources','share-duty','authorize-self','continue-celestial','limit-terms','trial-appeal','deliver-copies','shared-method','separate-fire','share-stop-right','return-duty'])s=pick(s,id);
 assert.ok(getJourneyView(s).choices.some(c=>c.id==='inherit-tomb-lantern'));
 assert.equal(s.world.legacies.filter(id=>id==='tomb-lantern').length,1);
});

test('three inherited proofs without prior victory still require current agreement before the one finale',()=>{
 let s=route(evidenceVictory.slice(0,-4));s=pick(s,'withdraw-ding');s=pick(s,'return-watch');s=rebirth(s);
 s=pick(s,'clinic-rationed');s=pick(s,'continue-journey');
 assert.equal(s.scene.nodeId,'celestial-arrival');
 const tasks=s.world.completedTasks.length;
 s=pick(s,'honor-celestial-proof');assert.equal(s.life.facts['bounded-terms'],true);assert.equal(s.life.facts['copies-delivered'],true);
 for(const id of ['shared-method','separate-fire','share-stop-right','return-duty'])s=pick(s,id);
 assert.equal(s.phase,'victory');assert.equal(s.world.completedTasks.length,tasks+1);
 assert.equal(s.world.facts['local-supply'],'minimum');
});

test('earlier valid v3 saves without NPC dates gain the established original chronology on actual elapsed time',()=>{
 let s=route(clinic.slice(0,-1));
 for(const person of Object.values(s.world.people)){delete person.birthYear;delete person.deathYear;}
 validateJourney(s);s=pick(s,'keep-watch');s=rebirth(s);
 assert.equal(s.world.people['shen-zhi'].birthYear,968);assert.equal(s.world.people['shen-zhi'].deathYear,1054);assert.equal(s.world.people['shen-zhi'].status,'dead');
});

test('the old realm-memory identity can be reawakened despite sharing the native memory suffix',()=>{
 let s;
 for(let seed=0;seed<30;seed++){
  s=route(evidenceVictory.slice(0,20).concat('authorize-self'),seed);
  if(s.scene.opportunities.celestial==='celestial-fire')break;
 }
 s.world.legacies.push('realm-memory');
 for(const id of ['learn-celestial','limit-terms','trial-appeal','deliver-copies','shared-method','separate-fire','share-stop-right','return-duty'])s=pick(s,id);
 assert.ok(getJourneyView(s).choices.some(c=>c.id==='inherit-realm-memory'));
});

test('malformed current-history boundary cannot hide or truncate the actual readable life',()=>{
 const s=rebirth(route(evidenceVictory));
 for(const badStart of [-1, 'missing', s.transcript.length+1]){const bad=structuredClone(s);bad.life.facts['transcript-start']=badStart;assert.throws(()=>validateJourney(bad),/行文|记录|存档/);}
});
