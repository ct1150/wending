import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJourney, renderJourneyHistory } from '../src/ui/journey.js';
import { renderIdentityBar, renderCharacterDetails } from '../src/ui/character.js';
import { serializeGame, deserializeGame } from '../src/game/save-format.js';
import { bootstrapSession, persistSession, migrateSession, recoverLegacySession } from '../src/ui/session.js';
import { SAVE_KEY } from '../src/game/persistence.js';

// A public display-view fixture isolates presentation from authored route text.
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
  assert.ok(keys.length > 1 && keys.every(key => key === SAVE_KEY), 'save guards may reread the primary but must not inspect unrelated backups');
  assert.deepEqual(deserializeGame(storage.raw), state);
  assert.equal(migrateSession(saved, { choiceId: 'remember-only' }, storage), saved);
  assert.equal(recoverLegacySession(saved, storage), saved);
  assert.ok(keys.every(key => key === SAVE_KEY));
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
