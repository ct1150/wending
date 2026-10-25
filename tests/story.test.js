import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/game/engine.js';

const fresh = (options = {}) => engine.createGame({ seed: '药谷测试', ...options });
function pick(state, id) {
  const choice = engine.getStoryView(state).choices.find(row => row.id === id);
  assert.ok(choice, `missing ${id} in ${engine.getStoryView(state).sceneId}`);
  assert.ok(choice.enabled, `${id}: ${choice.reason}`);
  const before = JSON.stringify(state);
  const next = engine.chooseStory(state, id);
  assert.equal(JSON.stringify(state), before, 'story actions are pure');
  assert.deepEqual(engine.deserialize(engine.serialize(next)), next);
  return next;
}

test('new life exposes a readable objective and persistent choice consequences without advancing on reads', () => {
  const start = fresh();
  assert.equal(typeof engine.getStoryView, 'function', 'the story view is a public engine API');
  const before = JSON.stringify(start), view = engine.getStoryView(start);
  assert.equal(view.status, 'active');
  assert.ok(view.objective.length > 8);
  assert.ok(view.paragraphs.length >= 2);
  assert.ok(view.choices.every(row => typeof row.costText === 'string'));
  assert.equal(JSON.stringify(start), before);
  const next = pick(start, 'enter_ask');
  assert.ok(engine.getStoryView(next).lastResult.text.length > 10);
  const paused = engine.act(next, { type: 'train' });
  assert.deepEqual(engine.getStoryView(paused).lastResult, engine.getStoryView(next).lastResult);
});

test('story choices reject wrong phase and location; travel and cultivation can pause the quest', () => {
  let state = pick(fresh(), 'enter_ask');
  state.run.realmIndex = 2; state.run.hp = engine.getStats(state).maxHp;
  const away = engine.act(state, { type: 'travel', worldId: 'nether' });
  assert.ok(engine.getStoryView(away).choices.every(row => !row.enabled));
  assert.throws(() => engine.chooseStory(away, 'pledge_truth'), /人间|所在/);
  state = engine.act(away, { type: 'travel', worldId: 'mortal' });
  assert.ok(engine.getStoryView(state).choices.some(row => row.enabled));
  const pending = engine.act(state, { type: 'challenge', challengeId: 'mortal-proof' });
  assert.throws(() => engine.chooseStory(pending, 'pledge_truth'), /战斗|阶段|完成/);
});

test('unknown choices and resource gates reject without consuming time, RNG or resources', () => {
  const start = fresh(), before = JSON.stringify(start);
  assert.throws(() => engine.chooseStory(start, '__unknown__'), /选项/);
  assert.equal(JSON.stringify(start), before);
});

function hub(options = {}) {
  let s = fresh(options);
  for (const id of ['enter_help', 'pledge_truth', 'ask_permission']) s = pick(s, id);
  return s;
}
function finishMain(outcome, options = {}) {
  let s = hub(options);
  for (const id of ['route_channel']) s = pick(s, id);
  if (engine.getStoryView(s).sceneId.startsWith('SIDE')) s = pick(s, 'leave_side');
  s = pick(s, 'measure_above');
  s = pick(s, 'route_ledger');
  if (engine.getStoryView(s).sceneId.startsWith('SIDE')) s = pick(s, 'leave_side');
  for (const id of ['official_archive', 'copy_accountable', 'go_confront', 'public_hearing', 'carry_rescue']) s = pick(s, id);
  const entry = { sword: 'sword_break', body: 'body_lift', alchemy: 'alchemy_smoke' }[s.run.pathId];
  // The alchemist with the poorest origin has exactly three herbs: use the guardian's key instead.
  s = pick(s, s.run.pathId === 'alchemy' ? 'lu_open' : entry);
  if (outcome === 'ash_refuge') return pick(s, 'release_now');
  s = pick(s, 'stabilize_life');
  return pick(s, outcome === 'open_clinic' ? 'choose_clinic' : 'choose_estate');
}
function reborn(s) {
  s = engine.act(s, { type: 'retire' });
  if (s.summary.legacyOptions.length) s = engine.selectLegacy(s, s.summary.legacyOptions[0]);
  return engine.reincarnate(s);
}

test('two investigation routes change evidence, relationships and later noncombat approaches', () => {
  let ledger = hub();
  for (const id of ['route_ledger']) ledger = pick(ledger, id);
  if (engine.getStoryView(ledger).sceneId.startsWith('SIDE')) ledger = pick(ledger, 'leave_side');
  for (const id of ['official_archive', 'copy_accountable']) ledger = pick(ledger, id);
  assert.ok(engine.getStoryView(ledger).clues.some(row => row.id === 'ledger'));
  assert.ok(engine.getStoryView(ledger).people.find(row => row.id === 'lu_huai').relationship > 0);
  assert.equal(engine.getStoryView(ledger).choices.find(row => row.id === 'route_ledger').enabled, false);
  let witness = hub();
  witness = pick(witness, 'route_witness');
  if (engine.getStoryView(witness).sceneId.startsWith('SIDE')) witness = pick(witness, 'leave_side');
  for (const id of ['treat_wen', 'protect_wen']) witness = pick(witness, id);
  assert.ok(engine.getStoryView(witness).clues.some(row => row.id === 'testimony'));
  assert.ok(engine.getStoryView(witness).people.some(row => row.id === 'wen_du'));
  assert.ok(!engine.getStoryView(witness).clues.some(row => row.id === 'ledger'));
});

test('three main outcomes each lead to a distinct playable five-scene next-life task', () => {
  const cases = [
    ['open_clinic', 'G2A01', ['accept_patients', 'triage_urgent', 'ration_medicine', 'publish_accounts', 'settle_clinic'], 'clinic_rationed'],
    ['sect_estate', 'G2B01', ['accept_contract', 'request_workers', 'public_archive', 'fixed_minimum', 'settle_estate'], 'estate_shared_supply'],
    ['ash_refuge', 'G2C01', ['accept_garden', 'carry_kept_promise', 'hire_garden', 'shared_garden', 'settle_refuge'], 'refuge_common_medicine'],
  ];
  for (const [outcome, start, choices, after] of cases) {
    const resolved = finishMain(outcome);
    assert.equal(engine.getStoryView(resolved).outcome.id, outcome);
    assert.equal(resolved.meta.storyWorld.records.length, 1);
    let next = reborn(resolved);
    assert.equal(engine.getStoryView(next).sceneId, start);
    for (const choice of choices) next = pick(next, choice);
    assert.equal(engine.getStoryView(next).outcome.id, after);
    assert.equal(next.meta.storyWorld.records.length, 2);
    assert.equal(engine.getStoryView(next).choices.length, 0);
  }
});

test('all paths and origins can legally complete the noncombat common-clinic route', () => {
  for (const pathId of ['sword', 'body', 'alchemy']) for (const originId of ['village', 'heir', 'herbalist']) {
    const s = finishMain('open_clinic', { pathId, originId });
    assert.equal(engine.getStoryView(s).status, 'resolved', `${pathId}/${originId}`);
    assert.ok(s.run.hp > 0);
    assert.ok(s.run.herbs >= 0);
    assert.ok(s.run.spirit >= 0);
  }
});

test('the eight-year deadline advances while training and leaves an affordable emergency exit', () => {
  let s = hub();
  for (let i = 0; i < 3; i++) s = engine.act(s, { type: 'train' });
  assert.equal(engine.getStoryView(s).sceneId, 'YG10');
  assert.ok(engine.getStoryView(s).lastResult.text.includes('封谷'));
  for (const id of ['deal_sect', 'sect_rescue', 'lu_open', 'stabilize_by_sect', 'choose_estate']) s = pick(s, id);
  assert.equal(engine.getStoryView(s).outcome.id, 'sect_estate');
});

test('scene transactions pay once, reject repetition and check aging before rewards', () => {
  let s = fresh();
  s = pick(s, 'enter_ask');
  const before = s.run.herbs;
  const next = pick(s, 'pledge_truth');
  assert.equal(next.run.herbs, before + 2);
  assert.throws(() => engine.chooseStory(next, 'pledge_truth'), /选项/);
  let dying = hub();
  dying = pick(dying, 'route_channel');
  if (engine.getStoryView(dying).sceneId.startsWith('SIDE')) dying = pick(dying, 'leave_side');
  dying.run.age = 98;
  const ended = engine.chooseStory(dying, 'measure_above');
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.summary.cause, 'lifespan');
  assert.equal(ended.story.clues.channel, 'none');
  assert.equal(ended.story.outcomeId, 'unfinished');
});

function furnace(options = {}) {
  let s = hub(options);
  s = pick(s, 'route_channel');
  if (engine.getStoryView(s).sceneId.startsWith('SIDE')) s = pick(s, 'leave_side');
  for (const id of ['retreat_marks', 'go_confront', 'limited_correction', 'launch_now']) s = pick(s, id);
  return s;
}
test('optional story combat wins without normal loot and resumes at the living seed', () => {
  let s = pick(furnace(), 'short_fight');
  const resources = [s.run.spirit, s.run.herbs, s.run.renown];
  assert.equal(s.phase, 'combat');
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  for (let i = 0; s.phase === 'combat' && i < 4; i++) s = engine.combatAction(s, 'strike');
  assert.equal(s.phase, 'adventure');
  assert.equal(engine.getStoryView(s).sceneId, 'YG13');
  assert.equal(s.story.pendingCombat, null);
  assert.deepEqual([s.run.spirit, s.run.herbs, s.run.renown], resources);
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
});

test('story combat flee and three-round retreat have distinct costs but both continue, never reopen rewards', () => {
  const combat = pick(furnace({ pathId: 'body' }), 'short_fight');
  const fled = engine.combatAction(combat, 'flee');
  assert.equal(engine.getStoryView(fled).sceneId, 'YG13');
  assert.equal(fled.run.spirit, combat.run.spirit - Math.ceil(combat.run.spirit * 0.2));
  assert.equal(fled.meta.worldYear, combat.meta.worldYear + 2);
  assert.deepEqual(engine.deserialize(engine.serialize(fled)), fled);
  let retreated = combat;
  for (let i = 0; i < 3; i++) retreated = engine.combatAction(retreated, 'guard');
  assert.equal(retreated.phase, 'adventure');
  assert.equal(retreated.run.spirit, combat.run.spirit - 6);
  assert.equal(engine.getStoryView(retreated).sceneId, 'YG13');
  assert.throws(() => engine.chooseStory(retreated, 'short_fight'), /选项/);
  assert.deepEqual(engine.deserialize(engine.serialize(retreated)), retreated);
});

test('story combat death, burning to death and dying during flight settle unfinished history without rewards', () => {
  for (const kind of ['battle', 'burn', 'flee']) {
    let s = furnace();
    if (kind === 'battle') s.run.hp = 1;
    if (kind === 'burn') s.run.age = 95;
    if (kind === 'flee') s.run.age = 98;
    s = pick(s, 'short_fight');
    const herbs = s.run.herbs;
    s = engine.combatAction(s, kind === 'battle' ? 'guard' : kind);
    assert.equal(s.phase, 'ended');
    assert.equal(s.story.outcomeId, 'unfinished');
    assert.equal(s.meta.storyWorld.valleyOutcome, 'sect_estate');
    assert.equal(s.meta.storyWorld.records.length, 1);
    assert.equal(s.story.pendingCombat, null);
    assert.ok(s.run.herbs <= herbs);
    assert.ok(s.meta.history[0].log.some(row => row.title.includes('未竟')));
    assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  }
});

test('two seed-dependent side opportunities are finite and cannot farm medicine', () => {
  const seen = new Set();
  for (const seed of ['side-0', 'side-1', 'side-2', 'side-3', 'side-4', 'side-5']) {
    let s = hub({ seed });
    s = pick(s, 'route_channel');
    const side = engine.getStoryView(s).sceneId;
    seen.add(side);
    const next = pick(s, 'leave_side');
    assert.throws(() => engine.chooseStory(next, 'leave_side'), /选项/);
    s = pick(next, 'retreat_marks');
    s = pick(s, 'route_ledger');
    assert.notEqual(engine.getStoryView(s).sceneId, side);
    s = pick(s, 'leave_side');
    for (const id of ['wait_public', 'take_partial']) s = pick(s, id);
    assert.equal(s.story.sideIndex, 2);
    assert.equal(engine.getStoryView(s).choices.filter(row => row.id.startsWith('route_') && row.enabled).length, 0);
  }
  assert.equal(seen.size, 3);
});

test('deadline crossing mid-investigation keeps spent costs but grants no unfinished evidence', () => {
  let s = hub();
  s = pick(s, 'route_channel');
  s = pick(s, 'leave_side');
  s = engine.act(s, { type: 'train' });
  s = engine.act(s, { type: 'train' });
  assert.equal(engine.getStoryView(s).sceneId, 'YG08');
  const spirit = s.run.spirit;
  s = engine.chooseStory(s, 'measure_above');
  assert.equal(engine.getStoryView(s).sceneId, 'YG10');
  assert.equal(s.story.clues.channel, 'none');
  assert.equal(s.run.spirit, spirit - 4);
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
});

test('guarding the remaining life advances real years, records aged NPCs, and leaves the existing outcome settled once', () => {
  let s = finishMain('ash_refuge');
  s = pick(s, 'close_main');
  const year = s.meta.worldYear, age = s.run.age, left = engine.getStats(s).remainingLife;
  s = engine.chooseStory(s, 'life_keep_watch');
  assert.equal(s.phase, 'ended');
  assert.equal(s.meta.worldYear, year + left);
  assert.equal(s.run.age, age + left);
  assert.equal(s.story.outcomeId, 'ash_refuge');
  assert.equal(s.meta.storyWorld.records.length, 1);
  assert.ok(engine.getStoryView(s).people.some(row => row.status.includes('已故')));
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
});

test('new-story exploration cannot use the legacy planting event to override seed ownership', () => {
  let s = finishMain('ash_refuge');
  for (let i = 0; i < 12; i++) {
    s = engine.act(s, { type: 'explore' });
    assert.notEqual(s.eventId, 'mortal-seed');
    assert.notEqual(s.eventId, 'mortal-valley-heirs');
    if (s.phase === 'event') s = engine.chooseEvent(s, engine.getEventChoices(s).find(row => row.enabled && !row.cost && !row.requires).id);
    else if (s.phase === 'combat') s = engine.combatAction(s, 'flee');
  }
  assert.equal(s.meta.storyWorld.seedCustodian, 'destroyed');
  assert.ok(!s.meta.worldFlags.includes('medicine-valley'));
});

test('NPCs who die during a long story pause are represented by successors rather than speaking alive again', () => {
  let s = hub();
  // Follow ordinary cultivation until the original three NPCs have all reached their recorded lifespan.
  while (s.meta.worldYear < 1090 && s.phase === 'adventure') {
    s = engine.act(s, { type: s.run.cultivation < engine.getStats(s).need ? 'train' : 'breakthrough' });
  }
  assert.equal(s.phase, 'adventure');
  const view = engine.getStoryView(s);
  assert.ok(view.people.every(person => person.status.includes('已故')));
  assert.ok(view.paragraphs.some(text => text.includes('继任')));
  assert.ok(!view.paragraphs.some(text => text.includes('这次陆槐来到')));
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
});

test('interrupting a later refuge task preserves the destroyed seed and provides a coherent further-life continuation', () => {
  let s = reborn(finishMain('ash_refuge'));
  s = pick(s, 'accept_garden');
  s = engine.act(s, { type: 'retire' });
  assert.equal(s.meta.storyWorld.seedCustodian, 'destroyed');
  assert.equal(s.meta.storyWorld.valleyOutcome, 'ash_refuge');
  assert.equal(s.story.outcomeId, 'unfinished');
  assert.ok(!engine.getStoryView(s).outcome.paragraphs.join('').includes('收走灵种'));
  assert.deepEqual(engine.deserialize(engine.serialize(s)), s);
  s = engine.reincarnate(s);
  assert.equal(engine.getStoryView(s).sceneId, 'G2C01');
});

test('the visible cost of life watch explains the elapsed years before its terminal transaction', () => {
  let s = pick(finishMain('ash_refuge'), 'close_main');
  const years = engine.getStats(s).remainingLife;
  const choice = engine.getStoryView(s).choices.find(row => row.id === 'life_keep_watch');
  assert.ok(choice.costText.includes(`${years}年`));
  s = engine.chooseStory(s, 'life_keep_watch');
  assert.ok(s.run.log.some(row => row.title === '守望余生' && row.text.includes(`${years}年`)));
});

test('results created after an original NPC dies name living successors and keep genuine earlier memories intact', () => {
  let s = hub();
  const originalEntry = engine.getStoryView(s).journal.find(row => row.title === '先替她搬病人');
  assert.ok(originalEntry.text.includes('沈芷'));
  while (s.meta.worldYear < 1090 && s.phase === 'adventure') s = engine.act(s, { type: s.run.cultivation < engine.getStats(s).need ? 'train' : 'breakthrough' });
  s = pick(s, 'deal_sect');
  s = pick(s, 'carry_rescue');
  const view = engine.getStoryView(s);
  assert.ok(view.lastResult.text.includes('温家的后人'));
  assert.ok(!view.lastResult.text.includes('温渡才低声说'));
  assert.equal(view.journal.at(-1).text, view.lastResult.text);
  assert.deepEqual(view.journal.find(row => row.title === originalEntry.title), originalEntry);
  assert.ok(view.choices.find(row => row.id === 'lu_open').label.includes('继任执事'));
  s = pick(s, 'lu_open');
  assert.ok(engine.getStoryView(s).lastResult.title.includes('继任执事'));
  assert.ok(!engine.getStoryView(s).lastResult.text.includes('你决定请陆槐以封禁令牌'));
});
