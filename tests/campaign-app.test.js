import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBirth } from '../src/ui/character.js';

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
