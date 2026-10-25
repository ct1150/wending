import { getStats } from '../game/engine.js';
import { icon } from './icons.js';

const num = value => Math.round(value || 0).toLocaleString('zh-CN');

export function renderCombatActions(state) {
  const stats = getStats(state);
  const burnUnavailable = stats.remainingLife <= 5;
  const spiritLoss = Math.ceil(state.run.spirit * 0.2);
  const herbLoss = Math.min(1, state.run.herbs);
  const actions = [{ id: 'strike', name: '出手破敌', icon: 'sword', sub: `攻势 ${num(stats.attack)}` }, { id: 'guard', name: '守势蓄力', icon: 'shield', sub: '减伤，蓄势下一击' }, { id: 'burn', name: '燃寿强攻', icon: 'flame', sub: `损耗 5 年寿元 · 余寿 ${num(Math.max(0, stats.remainingLife))} 年` }, { id: 'flee', name: '遁走避锋', icon: 'feather', sub: `损失 ${num(spiritLoss)} 灵石（当前 ${num(state.run.spirit)}）和 ${num(herbLoss)} 药材（当前 ${num(state.run.herbs)}），耗时 2 年` }];
  return `<div class="battle-actions">${actions.map(action => `<button data-combat="${action.id}" ${action.id === 'burn' && burnUnavailable ? 'disabled title="余寿不足以承受禁术"' : ''}>${icon(action.icon, 21)}<span>${action.name}</span><small>${action.sub}</small>${action.id === 'burn' && burnUnavailable ? '<small class="choice-reason">余寿不足以承受禁术</small>' : ''}</button>`).join('')}</div>`;
}
