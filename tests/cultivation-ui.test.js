import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJourney, renderJourneyHistory } from '../src/ui/journey.js';
import { renderIdentityBar, renderCharacterDetails } from '../src/ui/character.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { createJourney } from '../src/game/journey/engine.js';
import { createCultivation, getCultivationView, chooseCultivation } from '../src/game/cultivation/engine.js';
import { bootstrapSession, persistSession, migrateSession, recoverLegacySession } from '../src/ui/session.js';
import { SAVE_KEY } from '../src/game/persistence.js';
import { startApp } from './helpers/app-harness.js';

// A public display-view fixture isolates presentation from authored route text.
// The actual application tests below still run the bundled engine and storage.
function displayView() {
  return {
    revision: 8, sceneId: 'arrival', phase: 'playing', title: '山门之外', location: '药谷',
    goal: '先找到愿意授你入门功法的人。',
    blocks: [{ id: 'cultivation-1', sceneId: 'arrival', kind: 'narration', text: '你还记得自己为何来到这里。' }],
    choices: [
      { id: 'ask', label: '上前问路', detail: '耗时 1 天；丹药 1 枚（当前 1 枚）。', enabled: true, reason: '' },
      { id: 'wait', label: '等候天明', detail: '山风渐冷，暂且寻一处避风地方。', enabled: true, reason: '' },
    ],
    summary: {
      name: '云归', age: 16, ageText: '16 岁零 2 天', year: 1000, generation: 1,
      remainingLife: 55, remainingLifeText: '55 年 358 天', lifeLimit: 72, lifeDamage: 0,
      realm: 'mortal', realmName: '凡人', injury: 0, injuryName: '无伤', abilities: [], legacy: null,
      items: [{ id: 'medicine', name: '丹药', count: 1 }], ending: null, biography: [],
      priorTranscript: [], legacyArchive: null, legacyCollection: [],
    },
  };
}

function cultivationCheckpoint() {
  return {
    version: 4, mode: 'cultivation', contentVersion: 1, revision: 0,
    rng: 20261025, phase: 'playing',
    world: { day: 360000, generation: 1, facts: {}, legacies: [], biography: [] },
    life: { name: '云归', ageDays: 5760, lifeLimit: 72, lifeDamageDays: 0, realm: 'mortal', cultivation: 0, injury: 0, skills: [], items: { medicine: 1, stones: 0 }, legacyId: null, facts: {}, startDay: 360000 },
    scene: { nodeId: 'arrival', fate: { opening: 'valley', opportunity: 'marsh', pressure: 'rival' }, visited: [] },
    transcript: [], summary: null,
  };
}

function currentCommand(state) {
  const view = getCultivationView(state), choice = view.choices.find(row => row.enabled);
  assert.ok(choice, 'the authored current scene must offer a playable choice');
  return { revision: view.revision, sceneId: view.sceneId, choiceId: choice.id };
}

function clickCommand(app, command) {
  app.click({ journeyChoice: command.choiceId, revision: String(command.revision), sceneId: command.sceneId });
}

test('the unified save boundary round-trips cultivation and rejects an invalid cultivation state', () => {
  const state = cultivationCheckpoint();
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
  const malformed = structuredClone(state); malformed.life.ageDays = -1;
  assert.throws(() => serializeGame(malformed), /存档/);
  assert.throws(() => deserializeGame(JSON.stringify(malformed)), /存档/);
});

test('a cultivation session reads and writes its own save without touching an old-life backup', () => {
  const state = cultivationCheckpoint(), raw = JSON.stringify(state), keys = [];
  const storage = {
    raw,
    getItem(key) { keys.push(key); if (key !== SAVE_KEY) throw new Error('unrelated old backup is corrupt'); return this.raw; },
    setItem(key, value) { keys.push(key); assert.equal(key, SAVE_KEY); this.raw = value; },
  };
  const session = bootstrapSession(storage);
  assert.equal(session.status, 'loaded');
  assert.equal(session.saved, true);
  assert.equal(session.error, '');
  assert.deepEqual(session.state, state);
  assert.deepEqual(keys, [SAVE_KEY]);
  assert.equal(Object.hasOwn(session, 'originalLegacyRaw'), false);
  const saved = persistSession(session, storage);
  assert.equal(saved.saved, true);
  assert.equal(saved.error, '');
  assert.deepEqual(keys, [SAVE_KEY, SAVE_KEY]);
  assert.deepEqual(deserializeGame(storage.raw), state);
  assert.equal(migrateSession(saved, { choiceId: 'remember-only' }, storage), saved);
  assert.equal(recoverLegacySession(saved, storage), saved);
  assert.deepEqual(keys, [SAVE_KEY, SAVE_KEY]);
});

test('cultivation separates compact identity from current goal and natural choices', () => {
  const view = displayView(), before = structuredClone(view), html = renderJourney(view);
  const identity = renderIdentityBar(view.summary);
  assert.match(identity, /云归/);
  assert.match(identity, /16 岁零 2 天/);
  assert.match(identity, /凡人/);
  assert.match(identity, /余寿.*55 年 358 天/);
  assert.ok(html.includes('先找到愿意授你入门功法的人。'));
  assert.ok(html.indexOf('先找到愿意授你入门功法的人。') < html.indexOf('data-journey-choice'));
  assert.doesNotMatch(html, /丹药 1 枚（当前 1 枚）/);
  assert.equal((html.match(/data-journey-choice=/g) ?? []).length, 2);
  assert.doesNotMatch(html, /resource-strip|select-card|data-action|data-equip|data-path|data-origin/);
  assert.deepEqual(view, before);
});

test('the actual fresh application opens character creation and saves its prepared fate once', async () => {
  const app = await startApp(), state = deserializeGame(app.storage.raw);
  assert.equal(state.version, 4);
  assert.equal(state.mode, 'cultivation');
  assert.equal(state.contentVersion, 2);
  assert.equal(state.phase, 'creating');
  assert.equal(state.revision, 0);
  assert.equal(state.scene.nodeId, 'arrival');
  assert.equal(state.life.realm, 'mortal');
  assert.equal(state.life.ageDays, 5760);
  assert.equal(app.storage.writes, 1);
  assert.match(app.html, /id="birth-name"[^>]*value="云归"/);
  assert.match(app.html, /data-birth-start/);
  assert.doesNotMatch(app.html, /data-journey-choice/);
  assert.doesNotMatch(app.html, /data-action|data-equip|data-rebirth|dao-name/);
  const restored = await startApp({ raw: app.storage.raw });
  assert.equal(restored.storage.writes, 0);
  assert.deepEqual(deserializeGame(restored.storage.raw), state);
});

test('the cultivation ending explains its achievement and lesson and keeps each completed life readable', () => {
  const view = displayView();
  const ending = { cause: 'retired', title: '归山收剑', generation: 1, age: 44, realm: 'qi', achievement: '你终于独自引气入体。', lesson: '下次入山前，先备好治伤的药。' };
  view.phase = 'ended';
  view.summary.ending = ending;
  view.summary.biography = [{ ...ending, name: '云归', year: 1028, legacyId: null, skills: ['herbalism'], deeds: ['救下山中的采药人。'] }];
  view.choices = [{ id: 'new-life', label: '只携记忆，再入人间', detail: '重走自己的求仙路。', enabled: true }];
  const html = renderJourney(view);
  assert.ok(html.includes(ending.achievement));
  assert.ok(html.includes(ending.lesson));
  assert.ok(!html.includes('救下山中的采药人。'));
  assert.ok(renderJourneyHistory(view).includes('救下山中的采药人。'));
  assert.match(html, /data-journey-choice="new-life"/);
  view.goal = '<img src=x onerror=bad()>';
  view.summary.realmName = '<script>bad()</script>';
  view.summary.ending.lesson = '<svg onload=bad()>';
  const escaped = renderJourney(view) + renderIdentityBar(view.summary) + renderCharacterDetails(view.summary);
  assert.doesNotMatch(escaped, /<img|<script|<svg/);
  assert.match(escaped, /&lt;img/);
  assert.match(escaped, /&lt;script/);
  assert.match(escaped, /&lt;svg/);
});

test('an existing journey offers explicit new-chapter confirmation with an export route before replacement', async () => {
  const source = createJourney({ seed: 'old-chapter' }), raw = serializeGame(source);
  const app = await startApp({ raw });
  assert.equal(app.storage.writes, 0);
  app.click({ view: 'settings' });
  assert.match(app.html, /开始人间求仙篇/);
  app.click({ reset: '' });
  assert.equal(app.dialog.open, true);
  assert.match(app.dialog.innerHTML, /人间求仙篇/);
  assert.match(app.dialog.innerHTML, /data-export/);
  assert.equal(app.storage.raw, raw);
  app.click({ export: '' });
  const backup = app.downloads.find(value => value instanceof Blob);
  assert.deepEqual(deserializeGame(await backup.text()), source);
  app.click({ closeDialog: '' });
  assert.equal(app.storage.raw, raw);
  app.click({ reset: '' });
  app.click({ confirm: '' });
  const fresh = deserializeGame(app.storage.raw);
  assert.equal(fresh.version, 4);
  assert.equal(fresh.world.generation, 1);
  assert.equal(fresh.revision, 0);
  assert.equal(fresh.life.realm, 'mortal');
});

test('cultivation choices apply once, focus the consequence and stay unchanged after reload or an old click', async () => {
  const app = await startApp({ raw: serializeGame(createCultivation({ seed: 'existing-cultivation-choice' })) }), before = deserializeGame(app.storage.raw), command = currentCommand(before);
  const button = app.html.match(new RegExp(`<button[^>]*data-journey-choice="${command.choiceId}"[^>]*>`))?.[0];
  assert.ok(button);
  const renderedCommand = {
    choiceId: button.match(/data-journey-choice="([^"]+)"/)[1],
    revision: Number(button.match(/data-revision="([^"]+)"/)[1]),
    sceneId: button.match(/data-scene-id="([^"]+)"/)[1],
  };
  clickCommand(app, renderedCommand);
  const progressed = deserializeGame(app.storage.raw), writes = app.storage.writes;
  assert.equal(progressed.version, 4);
  assert.equal(progressed.revision, 1);
  assert.equal(progressed.rng, before.rng);
  assert.equal(progressed.transcript.filter(block => block.choiceId === command.choiceId).length, 1);
  const result = progressed.transcript.find(block => block.kind === 'result');
  assert.ok(result);
  assert.equal(app.focus.at(-1), `#journey-block-${result.id}`);
  assert.equal(app.scroll.at(-1), `#journey-block-${result.id}`);
  clickCommand(app, renderedCommand);
  assert.equal(app.storage.writes, writes);
  assert.deepEqual(deserializeGame(app.storage.raw), progressed);
  const restored = await startApp({ raw: app.storage.raw });
  assert.equal(restored.storage.writes, 0);
  assert.ok(restored.html.includes(result.text));
  clickCommand(restored, renderedCommand);
  assert.equal(restored.storage.writes, 0);
  assert.deepEqual(deserializeGame(restored.storage.raw), progressed);
});

test('cultivation import, export and help preserve the saved life through the actual controller', async () => {
  let source = createCultivation({ seed: 'cultivation-import' });
  source = chooseCultivation(source, currentCommand(source)).state;
  source.life.name = '<云归>';
  const previous = serializeGame(createJourney({ seed: 'keep-until-confirmed' }));
  const app = await startApp({ raw: previous, legacyBackupRaw: '{unrelated old backup' });
  await app.import(serializeGame(source));
  assert.equal(app.storage.raw, previous);
  assert.equal(app.storage.writes, 0);
  assert.match(app.dialog.innerHTML, /&lt;云归&gt;/);
  assert.match(app.dialog.innerHTML, /凡人/);
  assert.doesNotMatch(app.dialog.innerHTML, /undefined|NaN/);
  app.click({ confirm: '' });
  assert.equal(app.focus.at(-1), '#journey-current-title');
  assert.deepEqual(deserializeGame(app.storage.raw), source);
  const writes = app.storage.writes;
  app.click({ more: '' }); app.click({ help: '' });
  assert.match(app.dialog.innerHTML, /求仙/);
  app.click({ view: 'settings' }); app.click({ export: '' });
  const backup = app.downloads.find(value => value instanceof Blob);
  assert.deepEqual(deserializeGame(await backup.text()), source);
  const download = app.downloads.find(value => typeof value?.download === 'string');
  assert.match(download.download, /第1世-16岁\.json$/);
  app.click({ view: 'adventure' });
  assert.equal(app.storage.writes, writes);
  assert.deepEqual(deserializeGame(app.storage.raw), source);
  clickCommand(app, currentCommand(source));
  assert.equal(deserializeGame(app.storage.raw).revision, source.revision + 1);
});

test('failed cultivation writes leave new in-memory choices exportable and preserve the previous saved life', async () => {
  const source = createCultivation({ seed: 'cultivation-quota' }), raw = serializeGame(source);
  const app = await startApp({ raw, denyWrite: true });
  clickCommand(app, currentCommand(source));
  assert.equal(app.storage.raw, raw);
  assert.match(app.html, /自动保存暂不可用/);
  assert.match(app.html, /data-revision="1"/);
  app.click({ export: '' });
  const progressed = deserializeGame(await app.downloads.find(value => value instanceof Blob).text());
  assert.equal(progressed.revision, 1);
  assert.equal(progressed.version, 4);
  clickCommand(app, currentCommand(progressed));
  assert.match(app.html, /data-revision="2"/);
  assert.equal(app.storage.raw, raw);
});

test('malformed cultivation imports never replace a valid saved life or its export', async () => {
  const source = createCultivation({ seed: 'cultivation-kept' }), raw = serializeGame(source);
  const app = await startApp({ raw });
  const malformed = structuredClone(source); malformed.scene.nodeId = '<script>bad()</script>';
  await app.import(JSON.stringify(malformed));
  assert.equal(app.dialog.open, false);
  assert.equal(app.storage.writes, 0);
  assert.equal(app.storage.raw, raw);
  assert.match(app.toast, /存档/);
  app.click({ export: '' });
  assert.deepEqual(deserializeGame(await app.downloads.find(value => value instanceof Blob).text()), source);
});
