import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/engine.js';

function oldBackup(state = engine.createGame({ seed: 'old-v1' })) {
  const old = structuredClone(state);
  old.version = 1; delete old.story; delete old.meta.storyWorld;
  return old;
}
test('valid v1 saves upgrade strictly, preserve the current life, and begin a story only after reincarnation', () => {
  const old = oldBackup(), raw = JSON.stringify(old);
  const loaded = engine.deserialize(raw);
  assert.equal(loaded.version, 2);
  assert.equal(loaded.story, null);
  assert.equal(engine.getStoryView(loaded), null);
  assert.deepEqual(loaded.run, old.run);
  assert.equal(loaded.rng, old.rng);
  assert.equal(loaded.phase, old.phase);
  const reborn = engine.reincarnate(engine.act(loaded, { type: 'retire' }));
  assert.ok(engine.getStoryView(reborn));
  assert.equal(JSON.stringify(old), raw);
  assert.deepEqual(engine.deserialize(engine.serialize(loaded)), loaded);
});

test('v1 migration never fills malformed required data or swallows injected new fields', () => {
  for (const mutate of [s => { delete s.run.hp; }, s => { s.meta.storyWorld = {}; }, s => { s.story = null; }, s => { s.run.herbs = -1; }, s => { s.meta.history = null; }]) {
    const old = oldBackup(); mutate(old);
    assert.throws(() => engine.deserialize(JSON.stringify(old)), /存档/);
  }
});

test('v2 requires story and storyWorld; malformed scene, flags, counters and facts are rejected', () => {
  const start = engine.createGame();
  assert.equal(start.version, 2);
  for (const mutate of [
    s => { delete s.story; }, s => { delete s.meta.storyWorld; },
    s => { s.story.sceneId = 'invented'; }, s => { s.story.flags.push('invented'); },
    s => { s.story.investigations = 3; }, s => { s.meta.storyWorld.valley = 'invented'; },
    s => { s.story.extra = true; }, s => { s.meta.storyWorld.records = null; },
  ]) {
    const bad = structuredClone(start); mutate(bad);
    assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  }
});

test('early retirement settles unfinished story once before life summary and history snapshots', () => {
  const start = engine.createGame(), ended = engine.act(start, { type: 'retire' });
  assert.equal(ended.story.status, 'failed');
  assert.equal(ended.story.outcomeId, 'unfinished');
  assert.equal(ended.meta.storyWorld.records.length, 1);
  assert.ok(ended.summary.worldChanges.some(text => text.includes('未竟')));
  assert.ok(ended.meta.history[0].log.some(row => row.kind === 'world' && row.text.includes('未竟')));
  assert.deepEqual(engine.deserialize(engine.serialize(ended)), ended);
  assert.throws(() => engine.act(ended, { type: 'retire' }));
  assert.equal(ended.meta.storyWorld.records.length, 1);
});

test('all legacy phases preserve event/combat/summary and RNG through strict upgrade', () => {
  const active = engine.createGame({ seed: '5' });
  active.version = 1; delete active.story; delete active.meta.storyWorld;
  const oldAdventure = engine.deserialize(JSON.stringify(active));
  const event = engine.act(oldAdventure, { type: 'explore' });
  assert.equal(event.phase, 'event');
  const prepared = structuredClone(oldAdventure);
  prepared.run.realmIndex = 5; prepared.run.hp = engine.getStats(prepared).maxHp;
  const combat = engine.act(prepared, { type: 'challenge', challengeId: 'mortal-proof' });
  const ended = engine.act(oldAdventure, { type: 'retire' });
  const finalReady = structuredClone(prepared); finalReady.meta.proofs = ['mortal', 'nether', 'celestial']; finalReady.run.worldId = 'celestial';
  finalReady.run.items.push('star-sword-art', 'burning-star', 'ashen-sheath');
  let winner = engine.equipItem(finalReady, 'star-sword-art');
  winner = engine.equipItem(winner, 'burning-star', 1); winner = engine.equipItem(winner, 'ashen-sheath');
  winner = engine.act(winner, { type: 'finale' });
  while (winner.phase === 'combat') winner = engine.combatAction(winner, 'burn');
  assert.equal(winner.phase, 'victory');
  for (const source of [oldAdventure, event, combat, ended, winner]) {
    const old = oldBackup(source), loaded = engine.deserialize(JSON.stringify(old));
    assert.equal(loaded.version, 2); assert.equal(loaded.story, null);
    for (const key of ['run', 'rng', 'phase', 'combat', 'eventId', 'summary', 'lastMessage']) assert.deepEqual(loaded[key], old[key]);
    const meta = structuredClone(loaded.meta); delete meta.storyWorld;
    assert.deepEqual(meta, old.meta);
    assert.deepEqual(engine.deserialize(engine.serialize(loaded)), loaded);
  }
});

test('valid enum values cannot forge story progress, NPC relations or a premature result', () => {
  const start = engine.createGame();
  for (const mutate of [
    s => { s.story.flags.push('luGuarantee'); },
    s => { s.story.relationships.shen_zhi = 2; },
    s => { s.story.sceneId = 'YG14'; s.story.visited.push('YG14'); },
    s => { s.story.met.push('wen_du'); },
    s => { s.story.routes.push('ledger'); s.story.investigations = 1; s.story.clues.ledger = 'full'; },
    s => { s.meta.storyWorld.npcDeathYears.shen_zhi = s.meta.worldYear; },
  ]) {
    const bad = structuredClone(start); mutate(bad);
    assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  }
});

test('world facts cannot be switched to an incompatible valid state or gain unearned public evidence', () => {
  const start = engine.createGame();
  for (const mutate of [
    s => { s.meta.storyWorld.publicTruth = true; },
    s => { s.meta.storyWorld.evidence = ['ledger']; },
    s => { s.meta.storyWorld.unpaidPromise = true; s.meta.storyWorld.survivorLine = 'injured'; },
    s => { s.meta.storyWorld.supplyDebt = true; },
  ]) {
    const bad = structuredClone(start); mutate(bad);
    assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  }
});

test('a migrated legacy life that actually plants the old valley enters the clinic sequel next life without invented case memories', () => {
  const old = oldBackup(engine.createGame({ seed: '5' }));
  let s = engine.deserialize(JSON.stringify(old));
  s = engine.act(s, { type: 'explore' });
  assert.equal(s.eventId, 'mortal-seed');
  s = engine.chooseEvent(s, 'plant');
  assert.equal(s.story, null);
  s = engine.reincarnate(engine.act(s, { type: 'retire' }));
  assert.equal(engine.getStoryView(s).sceneId, 'G2A01');
  assert.equal(s.meta.storyWorld.publicTruth, false);
  assert.deepEqual(s.meta.storyWorld.evidence, []);
  assert.deepEqual(s.meta.storyWorld.records, []);
});

test('legacy validation rejects content identifiers that did not exist in v1', () => {
  const old = oldBackup();
  old.meta.legacyIds.push('plain-medicine');
  assert.throws(() => engine.deserialize(JSON.stringify(old)), /存档/);
});

test('a side continuation pointing to a different legitimate route is rejected before an enabled action', () => {
  let s = engine.createGame({ seed: 'review' });
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission', 'route_channel']) s = engine.chooseStory(s, id);
  assert.equal(s.story.returnSceneId, 'YG08');
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  const bad = structuredClone(s); bad.story.returnSceneId = 'YG04';
  assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  const continued = engine.chooseStory(s, 'leave_side');
  assert.equal(engine.getStoryView(continued).sceneId, 'YG08');
  assert.deepEqual(engine.deserialize(engine.serialize(continued)), continued);
  const interrupted = engine.act(s, { type: 'retire' });
  assert.equal(interrupted.story.returnSceneId, null);
  assert.deepEqual(engine.deserialize(engine.serialize(interrupted)), interrupted);
});

function limitedEstate() {
  let s = engine.createGame({ seed: 'review' });
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission', 'route_channel', 'leave_side', 'retreat_marks', 'go_confront', 'limited_correction', 'launch_now', 'sword_break', 'stabilize_by_sect', 'choose_estate']) s = engine.chooseStory(s, id);
  assert.equal(s.meta.storyWorld.publicTruth, false);
  return s;
}

test('duplicated settled facts cannot override the current life retained evidence and promise trace', () => {
  const s = limitedEstate();
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  for (const change of [
    facts => { facts.publicTruth = true; },
    facts => { facts.evidence = ['ledger']; },
    facts => { facts.survivorLine = 'safe'; },
    facts => { facts.unpaidPromise = true; },
    facts => { facts.graveMoved = true; },
    facts => { facts.supplyDebt = true; },
  ]) {
    const bad = structuredClone(s);
    change(bad.meta.storyWorld); change(bad.meta.storyWorld.records.at(-1).facts);
    assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  }
  let next = engine.reincarnate(engine.act(s, { type: 'retire' }));
  for (const id of ['accept_contract', 'request_medicine']) next = engine.chooseStory(next, id);
  assert.equal(engine.getStoryView(next).choices.find(row => row.id === 'public_archive').enabled, false);
});

test('a settled sequel may only change facts permitted by its trace over the preceding snapshot', () => {
  let s = engine.reincarnate(engine.act(limitedEstate(), { type: 'retire' }));
  for (const id of ['accept_contract', 'request_graves', 'only_graves', 'accept_graves', 'settle_estate']) s = engine.chooseStory(s, id);
  assert.equal(s.story.outcomeId, 'estate_grave_access');
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  for (const change of [facts => { facts.publicTruth = true; }, facts => { facts.evidence = ['ledger']; }, facts => { facts.supplyDebt = true; }]) {
    const bad = structuredClone(s);
    change(bad.meta.storyWorld); change(bad.meta.storyWorld.records.at(-1).facts);
    assert.throws(() => engine.deserialize(JSON.stringify(bad)), /存档/);
  }
});

test('the first sequel of a migrated old valley settles without requiring invented pre-migration facts', () => {
  const old = oldBackup(); old.meta.worldFlags.push('medicine-valley');
  let s = engine.deserialize(JSON.stringify(old));
  s = engine.reincarnate(engine.act(s, { type: 'retire' }));
  assert.deepEqual(s.meta.storyWorld.records, []);
  for (const id of ['accept_patients', 'triage_urgent', 'ration_medicine', 'publish_accounts', 'settle_clinic']) s = engine.chooseStory(s, id);
  assert.equal(s.story.outcomeId, 'clinic_rationed');
  assert.equal(s.meta.storyWorld.publicTruth, false);
  assert.deepEqual(s.meta.storyWorld.evidence, []);
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
});

// Deliberate low-life import boundaries, not claims of naturally reached routes.
for (const kind of ['ordinary rest', 'time-cost story choice']) test(`an accepted save remains round-trippable when ${kind} crosses the deadline fatally`, () => {
  let s = engine.createGame({ seed: 'review' });
  if (kind === 'time-cost story choice') {
    for (const id of ['enter_help', 'pledge_truth', 'ask_permission', 'route_channel', 'leave_side']) s = engine.chooseStory(s, id);
  }
  s = engine.act(engine.act(s, { type: 'train' }), { type: 'train' });
  assert.equal(s.meta.worldYear, 1006);
  s.run.lifeDamage = engine.getStats(s).remainingLife - 2;
  const accepted = engine.deserialize(engine.serialize(s));
  const before = structuredClone(accepted);
  assert.equal(engine.getStats(accepted).remainingLife, 2);
  const ended = kind === 'ordinary rest' ? engine.act(accepted, { type: 'rest' }) : engine.chooseStory(accepted, 'measure_above');
  assert.deepEqual(accepted, before, 'the accepted pre-action save is unchanged');
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.meta.worldYear, 1008);
  assert.equal(ended.summary.cause, 'lifespan');
  assert.equal(engine.getStoryView(ended).sceneId, 'YG10');
  assert.equal(engine.getStoryView(ended).outcome.id, 'unfinished');
  assert.deepEqual(engine.deserialize(engine.serialize(ended)), ended);
  assert.equal(ended.run.cultivation, accepted.run.cultivation);
  assert.equal(ended.run.hp, accepted.run.hp, 'no healing after death');
  assert.equal(ended.run.spirit, accepted.run.spirit - (kind === 'time-cost story choice' ? 4 : 0));
  assert.deepEqual(ended.run.items, accepted.run.items);
  assert.deepEqual(ended.run.legacyCandidates, accepted.run.legacyCandidates);
  assert.deepEqual(engine.getStoryView(ended).clues, engine.getStoryView(accepted).clues, 'unfinished investigation grants no evidence');
  assert.equal(ended.story.choices.length, accepted.story.choices.length);
  assert.equal(ended.meta.storyWorld.records.length, 1);
  assert.equal(ended.meta.history.length, 1);
  assert.equal(ended.story.journal.filter(row => row.title === '封谷最后一夜').length, 1);
  assert.equal(ended.run.log.filter(row => row.kind === 'world').length, 1);
  const restored = engine.deserialize(engine.serialize(ended));
  assert.throws(() => engine.act(restored, { type: 'rest' }), /当前|完成/);
  assert.deepEqual(restored.meta.storyWorld.records, ended.meta.storyWorld.records);
  const forged = structuredClone(ended); forged.story.sceneId = accepted.story.sceneId;
  assert.throws(() => engine.deserialize(JSON.stringify(forged)), /存档/,'failed stories still require a consistent trace');
});
