import { LATER_CHAPTER } from './chapters/later.js';
import { LEGACIES } from '../content.js';
import { MORTAL_CHAPTER } from './chapters/mortal.js';
import { CELESTIAL_CHAPTER } from './chapters/celestial.js';
import { NETHER_CHAPTER } from './chapters/nether.js';

export const JOURNEY_ABILITIES = {
  shelter: { id: 'shelter', name: '护人之术' },
  discern: { id: 'discern', name: '识破虚言' },
  'burn-life': { id: 'burn-life', name: '燃命破局' },
  herbalism: { id: 'herbalism', name: '药理通识' },
  'soul-lamp': { id: 'soul-lamp', name: '引魂灯诀' },
  'bind-oath': { id: 'bind-oath', name: '定契之印' },
};
export const JOURNEY_REALMS = { mortal: { lifeLimit: 80 }, foundation: { lifeLimit: 160 }, golden: { lifeLimit: 240 }, nascent: { lifeLimit: 320 } };
export const JOURNEY_PROOFS = ['mortal', 'nether', 'celestial'];

// Finite IDs for saved inventories; later chapters extend these authoring tables.
export const JOURNEY_ITEMS = {
  'medicine-pack': '止血药包', 'ledger-page': '原始账页', testimony: '温渡口述', 'old-names': '旧名册',
  'witness-notes': '匿名路线笔录', 'ledger-copy': '认证账页抄本', 'ledger-extract': '药窖日期摘录',
  'channel-map': '完整稳脉图', 'channel-rubbing': '禁火刻字拓片',
};
export const JOURNEY_LEGACIES = {
  'shelter-memory': { id: 'shelter-memory', name: '护人旧忆', abilityId: 'shelter' },
  'discern-memory': { id: 'discern-memory', name: '辨言旧忆', abilityId: 'discern' },
};
const legacyMethods = { 'plain-medicine':'herbalism', 'valley-seed':'herbalism', 'golden-furnace':'herbalism', 'sword-echo':'shelter', 'city-oath':'shelter', 'iron-bone':'shelter', 'tomb-lantern':'soul-lamp', 'debt-released':'bind-oath', 'sword-heart':'discern', 'realm-memory':'burn-life' };
const legacyTexts = {
 'plain-medicine':'迁民共同园留下辨凡药的方法，不令灰谷复生。', 'valley-seed':'百年药约留下药理记忆，旧名不是一粒仍存的灵种。',
 'golden-furnace':'真实炼丹火候化为辨药经验，不再叠加药材或灵石。', 'sword-echo':'后世晨课留下护人的步法，不召回任何已失盟友。',
 'city-oath':'获救城民的灯幡留下护送之法，不把后人变成已同意的代理人。', 'iron-bone':'旧日承重留下护人的手段，不叠加前世气血。',
 'tomb-lantern':'守墓托付留下引魂方法，灯不能使故人复生。', 'debt-released':'亲手偿债留下有限立约的方法，名字不能销去后来真实欠下的魂债。',
 'sword-heart':'真实剑心历练留下辨言之法，不添未经核实的证据。', 'realm-memory':'旧日结丹留下燃命破局的方法，每次仍付真实个人寿元。',
};
for (const [id, ability] of Object.entries(JOURNEY_ABILITIES)) JOURNEY_LEGACIES[`${id}-memory`] = { id:`${id}-memory`, name:`${ability.name}旧忆`, abilityId:id, source:'此生实际学会的方法', description:'只传下一项情境方法，不叠加旧数值收益。' };
for (const old of LEGACIES) JOURNEY_LEGACIES[old.id] = { id:old.id, name:old.name, abilityId:legacyMethods[old.id], source:old.source, description:legacyTexts[old.id] };
export const JOURNEY_CHAPTERS = { later: LATER_CHAPTER, mortal: MORTAL_CHAPTER, nether: NETHER_CHAPTER, celestial: CELESTIAL_CHAPTER };

// Conditions are a small, serializable vocabulary shared by authors and save
// validation. Unknown kinds are errors, never silently truthy/falsy predicates.
export function matchesJourneyConditions(state, conditions = []) {
  return conditions.every(condition => {
    switch (condition.kind) {
      case 'proof': return state.world.proofs.includes(condition.id) === (condition.held ?? true);
      case 'ability': return state.life.abilities.includes(condition.id) || JOURNEY_LEGACIES[state.life.legacyId]?.abilityId === condition.id;
      case 'item': return (state.life.items[condition.id] ?? 0) >= (condition.min ?? 1);
      case 'person': return state.world.people[condition.id]?.status === condition.status;
      case 'life-fact': return state.life.facts[condition.id] === condition.value;
      case 'world-fact': return state.world.facts[condition.id] === condition.value;
      case 'opportunity': return Object.values(state.scene.opportunities).includes(condition.id);
      case 'injury-not': return state.life.injury !== condition.value;
      case 'remaining-life': return state.life.lifeLimit - state.life.age - state.life.lifeDamage >= condition.min;
      default: throw new Error(`无法解析的故事条件：${condition.kind}`);
    }
  });
}

export function resolveJourneyScene(state) {
  const chapter = JOURNEY_CHAPTERS[state.scene.chapterId];
  const scene = chapter?.scenes[state.scene.nodeId];
  if (!scene) throw new Error('存档场景不存在。');
  const variant = scene.variants.find(row => matchesJourneyConditions(state, row.when));
  if (!variant) throw new Error(`场景没有适用的故事变体：${state.scene.nodeId}`);
  return { id: state.scene.nodeId, title: scene.title, location: scene.location ?? chapter.location, ...scene, ...variant };
}
