import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, chooseCultivation, getCultivationView } from '../src/game/cultivation/engine.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
const create = seed => createCultivation({ contentVersion: 3, characterCreation: true, seed });
const command = (s, choiceId, fields = {}) => ({ revision: s.revision, sceneId: s.scene.nodeId, choiceId, ...fields });
const take = (s, id, fields) => { const r = chooseCultivation(s, command(s,id,fields)); assert.equal(r.kind,'applied',r.message); return r.state; };
test('CV3 births have four origins, two distinct unlocked fates and exactly twelve attribute points', () => {
 for(let seed=0;seed<100;seed++) { const s=create(seed),v=getCultivationView(s); assert.equal(s.contentVersion,3); assert.equal(s.phase,'creating'); assert.deepEqual(s.transcript,[]); assert.equal(s.life.lifeLimit,80); assert.deepEqual(v.creation.origins.map(o=>o.id),['village','artisan','ferry','exile']); assert.equal(new Set(s.life.birth.talentIds).size,2); assert.equal(Object.values(s.life.birth.attributes).reduce((a,b)=>a+b),12); assert.ok(Object.values(s.life.birth.attributes).every(n=>n>=1&&n<=6)); assert.equal(v.creation.attributeBudget,12); assert.equal(v.creation.talents.length,2); }
});
test('origin, name, one locked talent and reroll survive export; reads do not draw',()=>{
 let s=create('locking'); s=take(s,'birth-origin',{originId:'artisan'}); s=take(s,'birth-name',{name:'  林遥  '}); const locked=s.life.birth.talentIds[0]; s=take(s,'birth-lock',{talentId:locked}); const request=command(s,'birth-reroll'),before=serializeGame(s); let r=chooseCultivation(s,request); assert.equal(r.kind,'applied'); assert.equal(serializeGame(s),before); s=r.state; assert.equal(s.life.birth.originId,'artisan'); assert.equal(s.life.name,'林遥'); assert.ok(s.life.birth.talentIds.includes(locked)); assert.equal(s.life.birth.lockedTalentId,locked); assert.equal(s.life.birth.rollCount,2); assert.equal(chooseCultivation(s,request).kind,'stale'); const raw=serializeGame(s); assert.deepEqual(getCultivationView(deserializeGame(raw)),getCultivationView(s)); assert.equal(serializeGame(s),raw); s=take(s,'birth-lock',{talentId:locked}); assert.equal(s.life.birth.lockedTalentId,null); const rng=s.rng,day=s.world.day; s=take(s,'birth-start'); assert.equal(s.rng,rng);assert.equal(s.world.day,day);assert.equal(s.phase,'playing');assert.equal(s.scene.visited[0],'arrival');assert.ok(s.transcript.length);
});
test('invalid birth commands are atomic and cannot forge gated unlocks',()=>{
 const s=create(1),raw=serializeGame(s); for(const [id,fields] of [['birth-origin',{originId:'wanderer'}],['birth-origin',{originId:'__proto__'}],['birth-lock',{talentId:'void-echo'}],['birth-name',{name:'\n云归'}],['birth-reroll',{originId:'village'}],['unknown',{}]]) {const r=chooseCultivation(s,command(s,id,fields));assert.equal(r.kind,'unavailable',id);assert.equal(r.state,s);assert.equal(serializeGame(s),raw);} const started=take(s,'birth-start'); for(const id of ['birth-reroll','birth-origin','birth-lock','birth-start'])assert.equal(chooseCultivation(started,command(started,id)).kind,'unavailable');
});
test('the first unstarted life cannot invent past deeds, proofs, legacies or gated birth choices',()=>{
 const s=create(2);s.world.facts['nether-pact']=true;s.world.facts['rescued-refugees']=true;
 s.world.proofs=['mortal','nether','celestial'];s.world.legacies=['sword'];s.life.legacyId='sword';s.life.skills=['sword'];
 s.life.birth.originId='wanderer';s.life.birth.talentIds=['rootless','void-echo'];
 assert.equal(s.transcript.length,0);assert.equal(s.world.biography.length,0);
 assert.throws(()=>serializeGame(s),/第一世|前世|入世/);
 for(const mutate of [x=>{x.world.facts.example=true;},x=>{x.world.proofs=['mortal'];},x=>{x.world.legacies=['sword'];},x=>{x.world.recentFates=['sect:ruins:storm'];}]){
  const candidate=create(2);mutate(candidate);assert.throws(()=>deserializeGame(JSON.stringify(candidate)),/第一世|前世|入世/);
 }
});
test('each CV3 life records the exact first paragraph index before entering the story',()=>{let s=create('start-index');assert.equal(s.life.facts['transcript-start'],0);s=take(s,'birth-start');assert.equal(s.life.facts['transcript-start'],0);assert.equal(s.transcript[s.life.facts['transcript-start']].sceneId,'arrival');});
