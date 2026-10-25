import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, combatAction, getStats, serialize, deserialize } from '../src/game/engine.js';
import { renderCombatActions } from '../src/ui/combat.js';

function combatState(spirit = 24, herbs = 3) {
  const prepared = createGame({ seed: 'paper-combat-costs' });
  prepared.run.realmIndex = 5;
  prepared.run.hp = getStats(prepared).maxHp;
  prepared.run.spirit = spirit;
  prepared.run.herbs = herbs;
  return deserialize(serialize(act(prepared, { type: 'challenge', challengeId: 'mortal-proof' })));
}

function actionMarkup(markup, id) {
  const match = markup.match(new RegExp(`<button([^>]*data-combat="${id}"[^>]*)>([\\s\\S]*?)<\\/button>`));
  assert.ok(match, `real rendered ${id} control must exist`);
  return { attributes: match[1], text: match[2].replace(/<[^>]*>/g, ' ') };
}

// These catch missing resource disclosures, rounding errors, or charging an unavailable herb.
for (const [spirit, herbs, spiritLoss, herbLoss] of [[24, 3, 5, 1], [24, 0, 5, 0], [0, 3, 0, 1], [0, 0, 0, 0], [1, 1, 1, 1]]) {
  test(`flee shows actual cost and balances for ${spirit} spirit / ${herbs} herbs without changing state`, () => {
    const state = combatState(spirit, herbs);
    const before = structuredClone(state);
    const markup = renderCombatActions(state);
    const flee = actionMarkup(markup, 'flee');
    const costs = flee.text.match(/损失\s+(\d+)\s+灵石（当前\s+(\d+)）和\s+(\d+)\s+药材（当前\s+(\d+)），耗时\s+(\d+)\s+年/);
    assert.ok(costs, 'flee must visibly disclose both computed losses, both balances and elapsed years');
    assert.deepEqual(costs.slice(1).map(Number), [spiritLoss, spirit, herbLoss, herbs, 2]);
    assert.deepEqual(state, before);
    for (const id of ['strike', 'guard', 'burn', 'flee']) actionMarkup(markup, id);
    const escaped = combatAction(state, 'flee');
    assert.equal(escaped.phase, 'adventure');
    assert.equal(Number(costs[1]), state.run.spirit - escaped.run.spirit);
    assert.equal(Number(costs[3]), state.run.herbs - escaped.run.herbs);
    assert.equal(Number(costs[5]), escaped.run.age - state.run.age);
    assert.equal(escaped.meta.worldYear - state.meta.worldYear, 2);
  });
}

// These catch a tooltip-only explanation or the wrong <=5-year availability boundary.
for (const remainingLife of [4, 5, 6]) {
  test(`burn exposes native availability and a visible reason at ${remainingLife} years remaining`, () => {
    const state = combatState();
    state.run.age = getStats(state).lifeLimit - state.run.lifeDamage - remainingLife;
    const burn = actionMarkup(renderCombatActions(state), 'burn');
    assert.match(burn.text, /损耗\s+5\s+年寿元/);
    assert.match(burn.text, new RegExp(`余寿\\s+${remainingLife}\\s+年`));
    if (remainingLife <= 5) {
      assert.match(burn.attributes, /\bdisabled\b/);
      assert.match(burn.text, /余寿不足以承受禁术/);
    } else {
      assert.doesNotMatch(burn.attributes, /\bdisabled\b/);
      assert.doesNotMatch(burn.text, /余寿不足以承受禁术/);
    }
  });
}
