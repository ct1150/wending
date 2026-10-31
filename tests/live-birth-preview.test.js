import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLiveBirth } from '../src/ui/character.js';

const birth = {
  originId: 'ferry',
  attributes: { constitution: 2, insight: 6, fortune: 4 },
  talentIds: ['sword-bone', 'keen-memory'],
  cultivationProfile: { rootId: 'pure-heaven', techniqueId: 'sealed-breath' },
};

function buttons(html, attribute) {
  return [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes(attribute));
}

test('the live preview shows the rolled origin, aptitudes and root tradeoff while keeping the entered name', () => {
  const html = renderLiveBirth({ birth, name: '孟&云', available: true });
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /渡口短工/);
  for (const pair of ['根骨 2', '悟性 6']) assert.ok(text.includes(pair), pair);
  assert.match(text, /清曜天灵根/);
  assert.match(text, /修行多积两分，突破更稳/);
  assert.match(text, /每次运功提高暴露/);
  assert.doesNotMatch(text, /气运|功法暗门|突破判定受阻/);
  assert.doesNotMatch(html, /<select\b/);
  assert.match(html, /id="live-name"[^>]*value="孟&amp;云"/);
});

test('reroll and both talent locks are optional buttons showing the active lock', () => {
  const html = renderLiveBirth({ birth, lockedTalentId: 'keen-memory', available: true });
  assert.match(html, /天生剑骨/);
  assert.match(html, /过目成诵/);
  const locks = buttons(html, 'data-live-lock=');
  assert.equal(locks.length, 2);
  assert.match(locks.find(tag => tag.includes('"sword-bone"')), /aria-pressed="false"/);
  assert.match(locks.find(tag => tag.includes('"keen-memory"')), /aria-pressed="true"/);
  const reroll = buttons(html, 'data-live-reroll');
  assert.equal(reroll.length, 1);
  for (const button of [...reroll, ...locks]) {
    assert.match(button, /type="button"/);
    assert.doesNotMatch(button, /disabled/);
  }
  assert.doesNotMatch(buttons(html, 'data-live-start')[0], /disabled/);
});

test('submitting freezes the displayed roll and its controls', () => {
  const html = renderLiveBirth({ birth, available: true, busy: true });
  const controls = buttons(html, 'data-live-');
  assert.equal(controls.length, 4);
  for (const control of controls) assert.match(control, /disabled/);
  assert.match(html, /id="live-name"[^>]*disabled/);
});
