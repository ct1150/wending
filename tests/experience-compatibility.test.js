import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {stateHash,canonicalStringify,sha256} from '../src/game/cultivation/live/identity.js';
import {validateLiveState,validateLife,validateReceipt,serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {buildStoryContext,validateStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {fortuneCycleModifier,v7ActionRule,resolveV7Action,nextRealmFor} from '../src/game/cultivation/live/cultivation-rules.js';
const frozen=JSON.parse(readFileSync(new URL('./fixtures/v540-unmarked-v7.json',import.meta.url)));
const digest=v=>sha256(canonicalStringify(v));
const copy=structuredClone;
const marked=()=>createLiveGame({...frozen.options,experienceVersion:1});
const opening=s=>prepareOpening(s,{requestId:frozen.openingRequestId});
const choose=(s,i,requestId)=>prepareChoice(s,{choiceId:s.currentScene.choices[i].id,requestId});
function scene(n){const s=copy(frozen.scene);s.id=s.id.replace(':t1:',':t'+n+':');for(const c of s.choices)c.id=c.id.replace(':t1:',':t'+n+':');return s;}
test('original 5.4.0 unmarked birth, committed opening, pending action, RNG and director retain frozen hashes',()=>{
  const s=createLiveGame(frozen.options),o=opening(s),a=commitTurn(s,o,frozen.scene),p=choose(a,0,frozen.choiceRequestId);
  assert.deepEqual({birthState:stateHash(s),birthRng:s.rng,opening:digest(o),openingState:stateHash(a),openingDirector:digest(a.director),pendingAction:digest(p),actionReceipt:digest(p.receipt),nextLife:digest(p.nextLife),nextRng:p.nextRng},frozen.expected);
});
test('opt-in experience is receipt-bound, exact, serialized, and cannot be silently added or dropped',()=>{
  const s=marked(),plain=createLiveGame(frozen.options),l=s.life;
  assert.equal(l.birth.cultivationProfile.experienceVersion,1);assert.deepEqual(l.cultivationProfile.experience,{version:1,activeTechniqueId:l.birth.cultivationProfile.techniqueId,repaired:false,lessons:[]});
  assert.equal(s.rng,plain.rng);assert.equal(s.director.eventCount,0);assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
  assert.deepEqual(s.birthReceipt.before.cultivationProfile.experience,l.cultivationProfile.experience);
  assert.equal('experience' in plain.life.cultivationProfile,false);assert.equal('eventCount' in plain.director,false);
  for(const edit of [x=>delete x.birth.cultivationProfile.experienceVersion,x=>delete x.cultivationProfile.experience,x=>x.birth.cultivationProfile.experienceVersion=2,x=>x.cultivationProfile.experience.activeTechniqueId='invented',x=>x.cultivationProfile.experience.counter=0,x=>x.cultivationProfile.experience.lessons=['unearned']]){
    const bad=copy(l);edit(bad);assert.throws(()=>validateLife(bad));
  }
  for(const edit of [x=>delete x.director,x=>delete x.director.eventCount,x=>x.director.eventCount=1,x=>x.life.cultivationProfile.experience.repaired=true]){
    const bad=copy(s);edit(bad);assert.throws(()=>validateLiveState(bad));
  }
  assert.throws(()=>createLiveGame({experienceVersion:1}));assert.throws(()=>createLiveGame({...frozen.options,experienceVersion:2}));
  const a=commitTurn(s,opening(s),scene(1)),p=choose(a,0,'paid');const bad=copy(p.receipt);delete bad.before.cultivationProfile.experience;assert.throws(()=>validateReceipt(bad));
  const c=buildStoryContext(a,p,[]);assert.ok(validateStoryContext(c));const wrong=copy(c);delete wrong.director.eventCount;assert.throws(()=>validateStoryContext(wrong));
});
test('zero-day questions keep event pace and fortune stationary while real turn and RNG advance',()=>{
  let s=marked();s=commitTurn(s,opening(s),scene(1));const initialFortune=fortuneCycleModifier(s),rng=s.rng;
  for(let n=2;n<=52;n++){
    const p=choose(s,1,'ask-'+n);assert.deepEqual(p.receipt.before,p.receipt.after);const c=buildStoryContext(s,p,[]);
    const next=scene(n);next.story.beat='climax';validateGeneratedScene(next,c);s=commitTurn(s,p,next);
    assert.equal(s.director.eventCount,0);assert.equal(s.director.pacing.canClimax,false);assert.equal(s.director.pacing.volume,1);assert.equal(fortuneCycleModifier(s),initialFortune);
  }
  assert.equal(s.turnId,52);assert.notEqual(s.rng,rng);
  const p=choose(s,0,'rest'),c=buildStoryContext(s,p,[]),next=scene(53);validateGeneratedScene(next,c);s=commitTurn(s,p,next);
  assert.equal(s.director.eventCount,1);assert.ok(compileChoices(s,s.currentScene.choices).some(row=>row.enabled));
});
test('a referenced and grounded closure advances a zero-day interaction exactly once; a fresh clue does not',()=>{
  const s=marked(),o=opening(s),first=scene(1),text='陈砚在落苇渡等雨停。';
  const fact={entityId:first.entities[0].id,kind:'clue',text,status:'open'};
  first.memoryDeltas=[fact];const active=commitTurn(s,o,first),referenceId=active.director.memory.clues[0].id;
  const p=choose(active,1,'ask-close'),second=scene(2);
  const refs=[{id:referenceId,runId:s.runId,turnId:1,source:'narrative',...fact}];
  second.memoryDeltas=[{...fact,referenceId,status:'resolved'}];
  validateGeneratedScene(second,buildStoryContext(active,p,refs));const a=commitTurn(active,p,second);
  assert.equal(a.director.eventCount,1);assert.deepEqual(p.receipt.before,p.receipt.after);
  const bad=copy(second);bad.memoryDeltas[0].referenceId='invented';assert.throws(()=>validateGeneratedScene(bad,buildStoryContext(active,p,refs)));
});

test('a breakthrough lesson is awarded once by a successful paid realm change',()=>{
  const state=marked(),next=nextRealmFor(state.life);
  state.life.cultivation=next.threshold;state.life.items[next.material]=1;
  const action={intent:'practice',approach:'breakthrough',targetId:next.id,stake:'normal'},rule=v7ActionRule(state,action);
  assert.equal(rule.reason,undefined);
  const won=resolveV7Action(state.life,action,rule,0),lost=resolveV7Action(state.life,action,rule,99);
  assert.equal(won.nextLife.realm,next.id);assert.equal(won.nextLife.items[next.material],0);
  assert.deepEqual(won.nextLife.cultivationProfile.experience.lessons,['breakthrough']);assert.deepEqual(lost.nextLife.cultivationProfile.experience.lessons,[]);
  const later={...state,life:won.nextLife},further=nextRealmFor(later.life);later.life.cultivation=further.threshold;later.life.items[further.material]=1;
  const second={...action,targetId:further.id};
  assert.deepEqual(resolveV7Action(later.life,second,v7ActionRule(later,second),0).nextLife.cultivationProfile.experience.lessons,['breakthrough']);
});
