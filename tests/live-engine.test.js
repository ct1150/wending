import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseModule } from '../scripts/build.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
const api = await import('../src/game/cultivation/live/engine.js').catch(() => null);
const validation = await import('../src/game/cultivation/live/validation.js').catch(() => null);
const identity = await import('../src/game/cultivation/live/identity.js').catch(() => null);
const proposal = (id='rest',intent='rest',targetId='self',approach='recover',stake='normal') => ({id,label:id,intent,targetId,approach,stake});
const scene = (choices=[proposal(),proposal('train','practice','self','steady')],entities=[]) => ({id:'scene-1',title:'山路',location:'故乡',blocks:[{kind:'narration',text:'前路仍在。'}],entities,choices,memoryDeltas:[]});
const born = (options={}) => { assert.ok(api,'live engine must exist'); return api.createLiveGame({runId:'run-test',seed:42,...options}); };
const active = (choices,entities) => { const s=born();return api.commitTurn(s,api.prepareOpening(s,{requestId:'open-1'}),scene(choices,entities)); };
const prepared = (s,id='rest',requestId='request-1') => api.prepareChoice(s,{requestId,choiceId:id,baseRevision:s.revision});
// Synthetic later-life fixtures retain consistent current receipt accounting;
// full provenance is the archive replay's responsibility.
function setLife(state, fields) {
  Object.assign(state, api.commitTurn(state, prepared(state), state.currentScene));
  Object.assign(state.life, fields);
  const { ageDays, realm, cultivation, injury } = state.life;
  state.lastReceipt.after = { ageDays, realm, cultivation, injury };
  state.lastReceipt.before = { ageDays: ageDays - state.lastReceipt.elapsedDays, realm, cultivation, injury };
  return state;
}

test('portable SHA-256 matches known vectors and canonical identity ignores insertion order',()=>{assert.ok(identity,'portable identity helper must exist');for(const text of ['', 'abc','中文🌿','a'.repeat(1000)])assert.equal(identity.sha256(text),createHash('sha256').update(text).digest('hex'));assert.equal(identity.stateHash({b:2,a:{d:4,c:3}}),identity.stateHash({a:{c:3,d:4},b:2}));});
test('birth draws once, preserves twelve points and two first-life talents; opening is free and atomic',()=>{const s=born(),raw=JSON.stringify(s);assert.equal(s.phase,'awaitingOpening');assert.equal(Object.values(s.life.birth.attributes).reduce((a,b)=>a+b),12);assert.equal(new Set(s.life.birth.talentIds).size,2);assert.deepEqual(born().life.birth,s.life.birth);const p=api.prepareOpening(s,{requestId:'open-1'});assert.deepEqual(p.receipt,s.birthReceipt);assert.equal(p.nextRng,s.rng);assert.deepEqual(p.nextLife,s.life);assert.throws(()=>prepared(s));const next=api.commitTurn(s,p,scene());assert.equal(next.phase,'active');assert.equal(next.revision,1);assert.equal(JSON.stringify(s),raw);assert.deepEqual(next.life,s.life);assert.throws(()=>api.commitTurn(next,p,scene()));assert.throws(()=>api.prepareOpening(next,{requestId:'again'}));});
test('all four origins are available and first-life gated talents are never rolled',()=>{for(const originId of ['village','artisan','ferry','exile'])for(let seed=0;seed<20;seed++){const s=born({originId,seed});assert.equal(s.life.birth.originId,originId);assert.ok(s.life.birth.talentIds.every(id=>!['rootless','void-echo'].includes(id)));assert.ok(Object.values(s.life.birth.attributes).every(n=>n>=1&&n<=6));}assert.throws(()=>born({originId:'wanderer'}));});
test('choice resolution fixes random outcome before prose; retries do not reroll or mutate base',()=>{const s=active([proposal('search','explore','stones','bold'),proposal()]),raw=JSON.stringify(s);const a=prepared(s,'search'),b=prepared(s,'search','retry-2');assert.deepEqual(a.receipt,b.receipt);assert.deepEqual(a.nextLife,b.nextLife);assert.equal(JSON.stringify(s),raw);assert.ok(a.receipt.elapsedDays>0);assert.notEqual(a.nextRng,s.rng);const committed=api.commitTurn(s,a,scene());assert.deepEqual(committed.life,a.nextLife);assert.throws(()=>api.commitTurn(committed,b,scene()));const forged=structuredClone(a);forged.nextLife.items.stones=9999;assert.throws(()=>api.commitTurn(s,forged,scene()));});
test('finite intents reject arbitrary rewards, resurrection, skipping realms and unknown effects',()=>{const s=active();for(const p of [{...proposal(),effects:{stones:9999}},{...proposal(),intent:'resurrect'},{...proposal(),days:0},proposal('skip','practice','immortal','breakthrough'),proposal('bad','rest','self','unknown')])assert.throws(()=>api.compileChoices(s,[p]));assert.throws(()=>api.commitTurn(born(),api.prepareOpening(born(),{requestId:'open'}),{...scene(),life:{realm:'immortal'}}));});
test('strategies have distinct rule costs, rewards, injury risk and relationships',()=>{const person={id:'npc-1',kind:'person',name:'渡者'};const s=active([proposal('kind','negotiate','npc-1','cooperate'),proposal('force','negotiate','npc-1','pressure')],[person]);const kind=prepared(s,'kind'),force=prepared(s,'force');assert.ok(kind.nextLife.relations['npc-1']>force.nextLife.relations['npc-1']);assert.notDeepEqual(kind.receipt.itemChanges,force.receipt.itemChanges);const c=api.compileChoices(s,[proposal('safe','explore','stones','cautious'),proposal('risk','explore','stones','bold')]);assert.notDeepEqual(c[0].costs,c[1].costs);assert.notDeepEqual(c[0].warnings,c[1].warnings);});
test('ordinary realm advancement consumes actual material, cultivation and years',()=>{let s=active([proposal('advance','practice','qi','breakthrough'),proposal()]);assert.equal(api.compileChoices(s,s.currentScene.choices)[0].enabled,false);assert.throws(()=>prepared(s,'advance'));setLife(s,{cultivation:2});s.life.items.manual=1;const p=prepared(s,'advance');assert.equal(p.nextLife.realm,'qi');assert.equal(p.nextLife.items.manual,0);assert.equal(p.receipt.elapsedDays,720);assert.equal(p.nextLife.cultivation,0);assert.equal(p.nextLife.lifeLimit,120);});
test('登仙 and 问鼎 remain living; retirement does not create an alive ending',()=>{const s=active([proposal('retire','rest','self','retire'),proposal()]);setLife(s,{realm:'immortal',lifeLimit:3000});const next=api.commitTurn(s,prepared(s,'retire'),scene());assert.equal(next.phase,'active');assert.equal(next.life.realm,'immortal');assert.ok(next.life.ageDays>s.life.ageDays);assert.equal(next.lastReceipt.death,null);});
test('lifespan expiry settles locally, grants no action rewards and stops new turns',()=>{const s=active([proposal('search','explore','stones','bold'),proposal()]);setLife(s,{ageDays:s.life.lifeLimit*360-1});const p=prepared(s,'search');assert.equal(p.receipt.death.cause,'lifespan');assert.equal(p.receipt.elapsedDays,1);assert.equal(p.nextLife.items.stones,s.life.items.stones);assert.throws(()=>api.commitTurn(s,p,scene()));const dead=api.settleDeath(s,p);assert.equal(dead.phase,'dead');assert.equal(dead.currentScene,null);assert.throws(()=>prepared(dead));assert.throws(()=>api.prepareOpening(dead,{requestId:'dead'}));assert.throws(()=>api.settleDeath(active(),prepared(active())));});
test('lethal combat ends actual life without a provider',()=>{const s=active([proposal('fight','fight','enemy','desperate','high'),proposal()],[{id:'enemy',kind:'person',name:'追兵'}]);setLife(s,{injury:9});const p=prepared(s,'fight');assert.equal(p.receipt.death.cause,'injury');assert.equal(api.settleDeath(s,p).phase,'dead');});
test('serialization rejects prototypes, accessors, unknown state and forged birth without calling getters',()=>{const s=born();let calls=0;const hostile=structuredClone(s);Object.defineProperty(hostile.life,'name',{enumerable:true,get(){calls++;return '坏';}});assert.throws(()=>validation.serializeLiveState(hostile));assert.equal(calls,0);assert.throws(()=>validation.serializeLiveState({...s,transcript:[]}));assert.throws(()=>validation.serializeLiveState(Object.assign(Object.create({evil:1}),s)));const forged=structuredClone(s);forged.life.birth.attributes.insight++;assert.throws(()=>validation.serializeLiveState(forged));assert.deepEqual(validation.deserializeLiveState(validation.serializeLiveState(s)),s);});
test('identity guards stale revision and hash, malformed scene and malicious pending getters atomically',()=>{const s=active(),raw=JSON.stringify(s);assert.throws(()=>api.prepareChoice(s,{choiceId:'rest',requestId:'r',baseRevision:0}));assert.throws(()=>api.prepareChoice(s,{choiceId:'rest',requestId:'r',stateHash:'0'.repeat(64)}));const p=prepared(s);const bad={...scene(),choices:[proposal('x'),proposal('x')]};assert.throws(()=>api.commitTurn(s,p,bad));let calls=0;Object.defineProperty(p,'nextLife',{enumerable:true,get(){calls++;return s.life;}});assert.throws(()=>api.commitTurn(s,p,scene()));assert.equal(calls,0);assert.equal(JSON.stringify(s),raw);});
test('active snapshots stay bounded across many turns and legacy serializers explicitly direct V5 to archives',()=>{let s=active();for(let n=0;n<150;n++)s=api.commitTurn(s,prepared(s,'rest','request-'+n),scene());assert.ok(validation.serializeLiveState(s).length<10000);assert.equal(s.revision,151);assert.equal(Object.hasOwn(s,'transcript'),false);assert.throws(()=>serializeGame(s),/live-archive|归档/);assert.throws(()=>deserializeGame(JSON.stringify(s)),/live-archive|归档/);});
test('persisted snapshots reject corrupted receipt accounting, unknown targets and mismatched entity references',()=>{for(const change of [s=>{s.birthReceipt.before.ageDays=0;s.birthReceipt.after.ageDays=0;},s=>{s.currentScene.choices[0].targetId='unknown';},s=>{s.life.relations.unknown=3;},s=>{s.currentScene.entities=[{id:'forged',name:'假人',kind:'person'}];},s=>{s.lastReceipt.after.injury=10;}]){const s=active();change(s);assert.throws(()=>validation.serializeLiveState(s));}});
test('scene and serialization reject nested accessors and unknown effects without invoking code',()=>{const s=born(),p=api.prepareOpening(s,{requestId:'opening'}),payload=scene();let calls=0;Object.defineProperty(payload.choices[0],'intent',{enumerable:true,get(){calls++;return 'rest';}});assert.throws(()=>api.commitTurn(s,p,payload));assert.equal(calls,0);assert.throws(()=>identity.canonicalStringify({toJSON(){calls++;return {};}}));assert.equal(calls,0);const huge=scene();huge.blocks[0].text='大'.repeat(2001);assert.throws(()=>api.commitTurn(s,p,huge));});
test('death before breakthrough cannot gain a new realm or extended lifespan',()=>{const s=active([proposal('advance','practice','qi','breakthrough'),proposal()]);setLife(s,{cultivation:2,ageDays:80*360-360});s.life.items.manual=1;const p=prepared(s,'advance');assert.equal(p.nextLife.realm,'mortal');assert.equal(p.nextLife.lifeLimit,80);assert.equal(p.receipt.death.cause,'lifespan');assert.equal(p.nextLife.cultivation,2);assert.equal(p.receipt.elapsedDays,360);});
test('relationship receipts retain rule consequences after the current NPC leaves the bounded scene',()=>{const s=active([proposal('kind','negotiate','npc','cooperate'),proposal()],[{id:'npc',kind:'person',name:'渡者'}]);const p=prepared(s,'kind');assert.deepEqual(p.receipt.relationChanges,{npc:3});const next=api.commitTurn(s,p,scene());assert.deepEqual(next.life.relations,{});assert.deepEqual(next.lastReceipt.relationChanges,{npc:3});assert.deepEqual(next.birthReceipt.relationChanges,{});const bad=structuredClone(next);bad.lastReceipt.relationChanges.npc=300;assert.throws(()=>validation.serializeLiveState(bad));});
test('NPC lifecycle is bounded narrative data and dead people cannot be targets of living interactions',()=>{const s=born(),pending=api.prepareOpening(s,{requestId:'open'}),payload=scene(undefined,[{id:'ancestor',kind:'person',name:'故人',status:'dead'}]);payload.memoryDeltas=[{entityId:'ancestor',kind:'death',text:'故人已逝。'}];const next=api.commitTurn(s,pending,payload);assert.equal(next.relatedEntities[0].status,'dead');for(const intent of ['negotiate','fight','evade'])assert.throws(()=>api.compileChoices(next,[proposal('bad',intent,'ancestor',intent==='negotiate'?'cooperate':intent==='fight'?'guard':'withdraw')]));const invalid=scene(undefined,[{id:'village',kind:'place',name:'故乡',status:'dead'}]);assert.throws(()=>api.commitTurn(s,pending,invalid));assert.equal(next.phase,'active');});

test('live engine module graph parses with the real restricted browser bundler', async () => {
  const visited = new Set();
  async function visit(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const parsed = parseModule(await readFile(url, 'utf8'), url.pathname);
    for (const dependency of parsed.imports) {
      assert.ok(dependency.from.startsWith('./'), 'live runtime imports must be local browser modules');
      await visit(new URL(dependency.from, url));
    }
  }
  await visit(new URL('../src/game/cultivation/live/engine.js', import.meta.url));
  assert.ok(visited.size >= 5);
});
test('snapshots bind the current life summary and RNG to the last committed receipt', () => {
  for (const change of [
    s => { s.life.realm='immortal'; s.life.lifeLimit=3000; },
    s => { s.life.ageDays++; },
    s => { s.life.cultivation++; },
    s => { s.life.injury++; },
    s => { s.rng=(s.rng+1)>>>0; },
  ]) {
    for (const base of [active(), api.commitTurn(active(), prepared(active()), scene())]) {
      const candidate=structuredClone(base);change(candidate);
      assert.throws(()=>validation.serializeLiveState(candidate));
      assert.throws(()=>validation.deserializeLiveState(JSON.stringify(candidate)));
    }
  }
});
test('opening and later-action snapshots enforce lifecycle and random accounting', () => {
  const opening=active();
  for (const change of [
    s => { s.revision=2;s.turnId=2; },
    s => { s.birthReceipt.random.before=(s.rng+1)>>>0;s.birthReceipt.random.after=s.birthReceipt.random.before; },
    s => { s.life.items.stones=5; },
  ]) { const corrupt=structuredClone(opening);change(corrupt);assert.throws(()=>validation.serializeLiveState(corrupt)); }
  const later=api.commitTurn(opening,prepared(opening),scene());
  for (const change of [
    s => { s.revision=1;s.turnId=1; },
    s => { s.rng=(s.rng+1)>>>0;s.lastReceipt.random.after=s.rng;s.lastReceipt.random.roll=s.rng%100; },
    s => { s.lastReceipt.random.roll=(s.lastReceipt.random.roll+1)%100; },
    s => { s.lastReceipt.before.injury=10; },
  ]) { const corrupt=structuredClone(later);change(corrupt);assert.throws(()=>validation.serializeLiveState(corrupt)); }
});
test('terminal cause must agree with actual lifespan or injury, with no posthumous advancement', () => {
  const old=setLife(active(),{ageDays:80*360-1});
  const oldDead=api.settleDeath(old,prepared(old));
  oldDead.lastReceipt.death.cause='injury';
  assert.throws(()=>validation.serializeLiveState(oldDead));
  const battle=setLife(active([proposal('fight','fight','enemy','desperate','high'),proposal()],[{id:'enemy',kind:'person',name:'追兵'}]),{injury:9});
  const battleDead=api.settleDeath(battle,prepared(battle,'fight'));
  battleDead.lastReceipt.death.cause='lifespan';
  assert.throws(()=>validation.deserializeLiveState(JSON.stringify(battleDead)));
});

test('relationship version is hash bound, rejects unknown versions and preserves unmarked replay semantics',()=>{
  const state=born(),old=structuredClone(state);delete old.relationshipVersion;
  assert.equal(state.relationshipVersion,1);assert.notEqual(identity.stateHash(state),identity.stateHash(old));
  assert.doesNotThrow(()=>validation.validateLiveState(old));
  for(const version of [0,2,'1',null])assert.throws(()=>validation.validateLiveState({...state,relationshipVersion:version}));
  const opening=api.prepareOpening(old,{requestId:'old-opening'}),first=api.commitTurn(old,opening,scene());
  const p=api.prepareChoice(first,{choiceId:'rest',requestId:'old-next'});
  assert.deepEqual(api.commitTurn(first,p,scene(undefined,[{id:'returning',name:'旧友',kind:'person'}]),{returning:90}).life.relations,{});
});
