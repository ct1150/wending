import test from 'node:test';
import assert from 'node:assert/strict';
import { createCultivation, chooseCultivation, getCultivationView } from '../src/game/cultivation/engine.js';
import { validateCultivation } from '../src/game/cultivation/validation.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
const create=()=>createCultivation({contentVersion:3,characterCreation:true,seed:'save'});
test('CV3 rejects forged fields, unlocked ids, invalid inventories and inconsistent chronology',()=>{const valid=create();assert.equal(valid.contentVersion,3);const mutations=[s=>{delete s.life.facts['transcript-start'];},s=>{s.world.unlocks=['rootless'];},s=>{s.life.birth.originId='wanderer';},s=>{s.life.birth.talentIds=['rootless','keen-memory'];},s=>{s.life.birth.talentIds.fill(s.life.birth.talentIds[0]);},s=>{s.life.birth.lockedTalentId='void-echo';},s=>{s.life.birth.attributes.insight=0;},s=>{s.life.birth.attributes={constitution:6,insight:6,fortune:6};},s=>{s.life.items.stones=-1;},s=>{s.world.day++;},s=>{s.world.proofs=['fake'];},s=>{s.world.recentFates=['bad'];},s=>{s.contentVersion=2;},s=>{s.life.birth.talentId='focused';},s=>{s.phase='playing';}];for(const mutate of mutations){const s=structuredClone(valid);mutate(s);assert.throws(()=>validateCultivation(s),/存档/);}assert.deepEqual(deserializeGame(serializeGame(valid)),valid);});
test('CV3 validation never executes accessors or serialization hooks',()=>{const base=create();assert.equal(base.contentVersion,3);let calls=0;for(const target of ['state','world','birth','attributes','talents']){const s=structuredClone(base);const o=target==='state'?s:target==='world'?s.world:target==='birth'?s.life.birth:target==='attributes'?s.life.birth.attributes:s.life.birth.talentIds;const key=target==='state'?'contentVersion':target==='world'?'day':target==='birth'?'originId':target==='attributes'?'insight':'0';Object.defineProperty(o,key,{enumerable:true,get(){calls++;return 3;}});assert.throws(()=>validateCultivation(s));}const s=structuredClone(base);s.world.facts.toJSON=()=>{calls++;return {};};assert.throws(()=>validateCultivation(s));assert.equal(calls,0);});
test('legacy CV1/CV2 creators retain versions, random sequence and exact serialized round trips',()=>{for(const characterCreation of [false,true]){const s=createCultivation({seed:1,characterCreation});assert.equal(s.contentVersion,characterCreation?2:1);if(!characterCreation)assert.equal(s.rng,245069412);assert.deepEqual(deserializeGame(serializeGame(s)),s);const r=chooseCultivation(s,{revision:s.revision-1,sceneId:s.scene.nodeId,choiceId:'birth-start'});assert.equal(r.kind,'stale');assert.equal(r.state,s);}});
test('public save export rejects a version accessor without running it',()=>{const s=create();let calls=0;Object.defineProperty(s,'version',{enumerable:true,get(){calls++;return 4;}});assert.throws(()=>serializeGame(s));assert.equal(calls,0);});
test('full CV3 prose uses the shared exact save boundary and growing actions fail atomically',()=>{
 let s=create();s=chooseCultivation(s,{revision:s.revision,sceneId:s.scene.nodeId,choiceId:'birth-start'}).state;
 const block=s.transcript[0];block.text+='记'.repeat(1_000_000-JSON.stringify(s).length);
 const raw=serializeGame(s);assert.equal(raw.length,1_000_000);assert.deepEqual(deserializeGame(raw),s);
 const r=chooseCultivation(s,{revision:s.revision,sceneId:s.scene.nodeId,choiceId:'continue'});assert.equal(r.kind,'unavailable');assert.equal(r.state,s);assert.equal(serializeGame(s),raw);
 const oversized=structuredClone(s);oversized.transcript[0].text+='记';assert.throws(()=>serializeGame(oversized));
});
test('birth command accessors and unknown parameters cannot mutate state or execute hooks',()=>{const s=create(),raw=serializeGame(s);let calls=0;const c={revision:s.revision,sceneId:s.scene.nodeId,choiceId:'birth-start'};Object.defineProperty(c,'name',{enumerable:true,get(){calls++;return '云归';}});const r=chooseCultivation(s,c);assert.equal(r.kind,'unavailable');assert.equal(r.state,s);assert.equal(calls,0);assert.equal(serializeGame(s),raw);});
// Follow only authored primary choices to the first real cultivation gate; the
// fixture is a command-produced life, not a manually invented late-game save.
async function firstGate() {
 const { resolveCultivationScene }=await import('../src/game/cultivation/v3/content.js');
 let s=create();
 const take=(state,id)=>{const r=chooseCultivation(state,{revision:state.revision,sceneId:state.scene.nodeId,choiceId:id});assert.equal(r.kind,'applied',r.message);return r.state;};
 s=take(s,'birth-start');
 for(let steps=0;steps<150;steps++){
   const scene=resolveCultivationScene(s),gate=scene.choices.find(c=>c.effects?.realm==='qi');
   if(gate)return {state:s,choice:gate};
   const view=getCultivationView(s),choice=view.choices.find(c=>c.id==='talent-use'&&c.enabled)??view.choices.find(c=>c.id==='continue'&&c.enabled);
   assert.ok(choice,`No primary route at ${s.scene.nodeId}`);s=take(s,choice.id);
 }
 assert.fail('The primary route never reached an actual qi breakthrough');
}
test('real CV3 breakthrough independently requires cultivation, consumed material and healthy meridians',async()=>{
 const {state:s,choice}=await firstGate();
 for(const mutate of [x=>{x.life.cultivation=1;},x=>{x.life.items.manual=0;},x=>{x.life.injury=2;},x=>{x.life.realm='foundation';x.life.lifeLimit=240;}]){
  const candidate=structuredClone(s);mutate(candidate);const raw=serializeGame(candidate),r=chooseCultivation(candidate,{revision:candidate.revision,sceneId:candidate.scene.nodeId,choiceId:choice.id});assert.equal(r.kind,'unavailable');assert.equal(r.state,candidate);assert.equal(serializeGame(candidate),raw);
 }
 const request={revision:s.revision,sceneId:s.scene.nodeId,choiceId:choice.id},r=chooseCultivation(s,request);assert.equal(r.kind,'applied',r.message);assert.equal(r.state.life.realm,'qi');assert.equal(r.state.life.lifeLimit,120);assert.equal(r.state.life.cultivation,0);assert.equal(r.state.life.items.manual,(s.life.items.manual??0)-1);assert.equal(r.state.life.facts['learned-manual'],true);assert.ok(r.state.world.day-s.world.day>=2*360);assert.equal(r.state.life.ageDays-s.life.ageDays,r.state.world.day-s.world.day);assert.equal(chooseCultivation(r.state,request).kind,'stale');
});

test('current CV3 scene must match the last scene actually entered',()=>{
 let s=create();
 for(const id of ['birth-start','continue']){const r=chooseCultivation(s,{revision:s.revision,sceneId:s.scene.nodeId,choiceId:id});assert.equal(r.kind,'applied');s=r.state;}
 assert.notEqual(s.scene.nodeId,'arrival');assert.deepEqual(deserializeGame(serializeGame(s)),s);
 const mismatched=structuredClone(s);mismatched.scene.nodeId='arrival';
 assert.throws(()=>deserializeGame(JSON.stringify(mismatched)),/当前场景|最后|场景记录/);
});
test('an unfinished CV3 breakthrough cannot borrow its prospective lifespan or award its effects',async()=>{
 const {state:s,choice}=await firstGate();s.life.ageDays=79*360;s.world.day=s.life.startDay+s.life.ageDays-16*360;
 assert.match(getCultivationView(s).choices.find(c=>c.id===choice.id).warning,/余寿|寿尽/);
 const raw=serializeGame(s),r=chooseCultivation(s,{revision:s.revision,sceneId:s.scene.nodeId,choiceId:choice.id});assert.equal(r.kind,'applied',r.message);assert.equal(serializeGame(s),raw);assert.equal(r.state.phase,'ended');assert.equal(r.state.summary.cause,'lifespan');assert.equal(r.state.life.realm,'mortal');assert.equal(r.state.life.lifeLimit,80);assert.equal(r.state.life.cultivation,s.life.cultivation);assert.equal(r.state.life.facts['learned-manual'],undefined);assert.equal(r.state.world.day-s.world.day,360);assert.equal(r.state.life.ageDays,80*360);assert.equal(r.state.world.biography.at(-1).age,80);assert.deepEqual(deserializeGame(serializeGame(r.state)),r.state);
});
test('CV3 rebirth retains complete prose and facts, carries one earned skill, and avoids the last fate combination',async()=>{
 const {state:s,choice}=await firstGate();s.life.ageDays=79*360;s.world.day=s.life.startDay+s.life.ageDays-16*360;
 const end=chooseCultivation(s,{revision:s.revision,sceneId:s.scene.nodeId,choiceId:choice.id}).state;
 assert.equal(end.phase,'ended');assert.ok(end.world.legacies.length);const skill=end.world.legacies[0];
 const r=chooseCultivation(end,{revision:end.revision,sceneId:end.scene.nodeId,choiceId:'inherit-'+skill});assert.equal(r.kind,'applied',r.message);const next=r.state;
 assert.equal(next.phase,'creating');assert.equal(next.contentVersion,3);assert.deepEqual(next.world.facts,end.world.facts);assert.deepEqual(next.world.biography,end.world.biography);assert.deepEqual(next.life.skills,[skill]);assert.equal(next.life.legacyId,skill);assert.equal(next.life.realm,'mortal');assert.equal(next.life.cultivation,0);assert.deepEqual(next.life.items,{supplies:1,stones:0});assert.equal(next.world.day,end.world.day+16*360);assert.equal(next.life.ageDays,16*360);assert.equal(next.life.facts['transcript-start'],next.transcript.length);assert.deepEqual(next.transcript.slice(0,end.transcript.length),end.transcript);assert.notDeepEqual(next.scene.fate,end.scene.fate);assert.deepEqual(deserializeGame(serializeGame(next)),next);
});
