import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBirth, renderCharacterDetails } from '../src/ui/character.js';
import { startApp } from './helpers/app-harness.js';
import { deserializeGame, serializeGame } from '../src/game/save-format.js';
import { createCultivation } from '../src/game/cultivation/engine.js';

test('the new fate card offers origin choice, two independently lockable fates and secondary attributes', () => {
  const creation = { name: '林<照>', revision: 3, sceneId: 'arrival', rollCount: 1, attributeBudget: 12,
    originId: 'ferry', origin: { id: 'ferry', name: '渡口短工', hook: '雨夜留下了一只木匣。' },
    origins: [{ id: 'village', name: '山村猎户' }, { id: 'artisan', name: '城坊匠徒' }, { id: 'ferry', name: '渡口短工' }, { id: 'exile', name: '流亡孤儿' }],
    attributes: [{ id: 'constitution', name: '根骨', value: 4 }, { id: 'insight', name: '悟性', value: 3 }, { id: 'fortune', name: '气运', value: 5 }],
    talents: [{ id: 'keen-memory', name: '过目成诵', description: '记得残卷，却记不住所有人。' }, { id: 'sensitive-breath', name: '听息敏锐', description: '听见门后的动静。' }], lockedTalentId: 'keen-memory' };
  const before = structuredClone(creation), html = renderBirth(creation);
  assert.match(html, /data-birth-origin="ferry"[^>]*aria-pressed="true"/);
  assert.equal((html.match(/data-birth-origin=/g) ?? []).length, 4);
  assert.equal((html.match(/data-birth-lock=/g) ?? []).length, 2);
  assert.match(html, /data-birth-lock="keen-memory"[^>]*aria-pressed="true"/);
  assert.match(html, /雨夜留下了一只木匣/);
  assert.match(html, /<details[^>]*>[\s\S]*<summary[^>]*>[^<]*资质/);
  assert.match(html, /12/);
  assert.match(html, /林&lt;照&gt;/);
  assert.deepEqual(creation, before);
});

test('new application retains its draft origin and locked fate across reroll and reload until birth', async () => {
  const app = await startApp();
  const initial = deserializeGame(app.navigation.offlineDraft.raw);
  assert.equal(initial.contentVersion, 3);
  const other = initial.life.birth.originId === 'ferry' ? 'artisan' : 'ferry';
  app.input('birth-name', '沈照');
  app.clickRendered(`[data-birth-origin="${other}"]`);
  const chosen = deserializeGame(app.navigation.offlineDraft.raw);
  assert.equal(chosen.life.name, '沈照');
  assert.equal(chosen.life.birth.originId, other);
  assert.equal(chosen.rng, initial.rng);
  const lock = chosen.life.birth.talentIds[1];
  app.input('birth-name', '沈照山');
  app.clickRendered(`[data-birth-lock="${lock}"]`);
  assert.equal(deserializeGame(app.navigation.offlineDraft.raw).life.birth.lockedTalentId, lock);
  app.clickRendered('[data-birth-reroll]');
  const rerolled = deserializeGame(app.navigation.offlineDraft.raw);
  assert.ok(rerolled.life.birth.talentIds.includes(lock));
  assert.equal(rerolled.life.birth.lockedTalentId, lock);
  assert.equal(rerolled.life.birth.originId, other);
  assert.notEqual(rerolled.rng, chosen.rng);
  assert.equal(rerolled.life.birth.rollCount, 2);
  assert.equal(Object.values(rerolled.life.birth.attributes).reduce((a,b)=>a+b,0), 12);
  assert.equal(app.storage.raw, null);
  assert.equal(app.storage.writes, 0);
  const reload = await startApp({ navigation: app.navigation, navigationType: 'reload' });
  assert.deepEqual(deserializeGame(reload.navigation.offlineDraft.raw), rerolled);
  assert.equal(reload.storage.raw, null);
  assert.equal(reload.storage.writes, 0);
  reload.clickRendered('[data-birth-start]');
  const started = deserializeGame(reload.storage.raw);
  assert.equal(started.phase, 'playing');
  assert.equal(started.life.birth.originId, other);
  assert.equal(started.rng, rerolled.rng);
  assert.equal(reload.storage.writes, 1);
  assert.match(reload.html, /沈照山/);
  reload.click({ help: '' });
  assert.doesNotMatch(reload.dialog.innerHTML, /药谷/);
  assert.match(reload.dialog.innerHTML, /命格|出身/);
});

test('an imported CV2 character keeps its original one-talent creation and controls', async () => {
  const old = createCultivation({ seed: 'cv2-unchanged-ui', characterCreation:true });
  const raw = serializeGame(old), app = await startApp({raw});
  assert.equal(deserializeGame(app.storage.raw).contentVersion,2);
  assert.doesNotMatch(app.html, /data-birth-origin|data-birth-lock/);
  app.clickRendered('[data-birth-start]');
  assert.equal(deserializeGame(app.storage.raw).contentVersion,2);
  assert.equal(deserializeGame(app.storage.raw).scene.fate.opening,'valley');
});
