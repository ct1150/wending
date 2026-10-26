import { assertSaveSize } from '../save-size.js';
import { SEQUEL_ECHOES, legacySequelEcho } from './chapters/later.js';
import { JOURNEY_CHAPTERS, JOURNEY_ABILITIES, JOURNEY_LEGACIES, JOURNEY_ITEMS, JOURNEY_REALMS, resolveJourneyScene, matchesJourneyConditions } from './content.js';
import { validateJourney } from './validation.js';

const copy = value => structuredClone(value);
function hashSeed(seed) {
  let value = 2166136261;
  for (const char of String(seed ?? '百世问鼎')) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0 || 1;
}
function random(state) {
  let x = state.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0 || 1;
  return state.rng / 4294967296;
}
function append(state, block) {
  state.transcript.push({ id: `journey-${state.transcript.length + 1}`, sceneId: state.scene.nodeId, ...block });
}
export function ageJourneyWorld(state) {
  const spans = { 'shen-zhi':86, 'lu-huai':160, 'wen-du':90 };
  for (const [id, person] of Object.entries(state.world.people)) {
    if (!spans[id]) continue;
    if (person.birthYear === undefined) { person.birthYear={ 'shen-zhi':968, 'lu-huai':924, 'wen-du':943 }[id]; person.deathYear ??= null; }
    if (person.status !== 'dead' && state.world.year >= person.birthYear + spans[id]) { person.status = 'dead'; person.deathYear = person.birthYear + spans[id]; }
    if (id === 'wen-du' && person.status === 'dead') state.world.facts['witness-cooperation'] = false;
  }
}
const sequelByValley = { open_clinic:'clinic', sect_estate:'estate', ash_refuge:'refuge' };
function completed(state, id) { return state.world.completedTasks.some(r => r.episodeId === id); }
function nextJourneyNode(state) {
  if (completed(state, 'three-world-ding')) return 'later-finished';
  if (state.world.facts['legacy-victories'] > 0) return 'later-legacy-victory';
  if (!state.world.proofs.includes('nether')) return 'nether-arrival';
  return 'celestial-arrival';
}
function enterScene(state, nodeId) {
  if (nodeId === 'later-onward') nodeId = nextJourneyNode(state);
  if (nodeId === 'ding-entry' && completed(state, 'three-world-ding')) nodeId = 'later-finished';
  const chapterId = Object.keys(JOURNEY_CHAPTERS).find(id => JOURNEY_CHAPTERS[id].scenes[nodeId]);
  if (!chapterId) throw new Error(`故事后继不存在：${nodeId}`);
  state.scene.chapterId = chapterId;
  state.scene.nodeId = nodeId;
  const chapter = JOURNEY_CHAPTERS[chapterId], scene = chapter.scenes[nodeId];
  if (scene.selectOpportunity && !Object.hasOwn(state.scene.opportunities, chapterId)) {
    const candidates = chapter.opportunities.filter(row => matchesJourneyConditions(state, row.when) && row.abilityId !== JOURNEY_LEGACIES[state.life.legacyId]?.abilityId && !state.life.abilities.includes(row.abilityId));
    if (!candidates.length) throw new Error(`章节没有适用的机会或过渡：${chapterId}`);
    state.scene.opportunities[chapterId] = candidates[Math.floor(random(state) * candidates.length)].id;
  }
  for (const block of resolveJourneyScene(state).blocks) append(state, block);
  if (nodeId === 'later-echo') {
    const arc = sequelByValley[state.world.facts['valley-outcome']];
    const record = state.world.completedTasks.findLast(r => r.episodeId === `mortal-${arc}`);
    append(state, { kind:'narration', text:legacySequelEcho(state.world.legacyArchive?.meta.storyWorld.records ?? [],arc) ?? SEQUEL_ECHOES[record?.outcomeId] ?? '旧委托已结算，细节未知；不补写缺失的结果。' });
  }
}
export function createJourney(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('开局选项必须是对象。');
  const { seed } = options;
  if (seed != null && !((typeof seed === 'string' && seed.length <= 200) || (typeof seed === 'number' && Number.isFinite(seed)))) throw new Error('随机种子须为有限数字或至多 200 字的文字。');
  const state = {
    version: 3, mode: 'dialogue', contentVersion: 1, revision: 0, rng: hashSeed(seed), phase: 'playing',
    world: { year: 1000, generation: 1, facts: {}, people: { 'shen-zhi': { status: 'safe', birthYear:968, deathYear:null }, 'wen-du': { status: 'critical', birthYear:943, deathYear:null }, 'lu-huai': { status: 'safe', birthYear:924, deathYear:null } }, proofs: [], legacies: [], completedTasks: [], biography: [] },
    life: { name: '云归', age: 16, lifeLimit: 80, lifeDamage: 0, realm: 'mortal', injury: 'well', abilities: [], learnedOpportunities: [], items: {}, legacyId: null, facts: {} },
    scene: { chapterId: 'mortal', nodeId: 'mortal-entry', opportunities: {} }, transcript: [], summary: null,
  };
  enterScene(state, 'mortal-entry');
  return validateJourney(state);
}
function unavailableReason(state, choice) {
  if (!matchesJourneyConditions(state, choice.requires)) return '眼前的证物、人物处境或已学方法不满足这项行动。';
  for (const [id, count] of Object.entries(choice.costs?.items ?? {})) {
    if ((state.life.items[id] ?? 0) < count) return `缺少${JOURNEY_ITEMS[id]}，不能用尚未取得的物品。`;
  }
  const years = choice.costs?.years ?? 0, lifeDamage = choice.costs?.lifeDamage ?? 0;
  if (!choice.ending && state.life.age + state.life.lifeDamage + years + lifeDamage >= state.life.lifeLimit) return '当前余寿不足以完成这项承担。';
  if (choice.effects?.learn && (state.life.abilities.length >= 3 || state.life.learnedOpportunities.includes(state.scene.opportunities[state.scene.chapterId]))) return '这一章的学习机会已用完，或此生已学过三项新方法。';
  if (choice.effects?.settle && state.world.completedTasks.some(row => row.episodeId === choice.effects.settle.episodeId)) return '这项经历已经结算，不能重复领取。';
  return null;
}
export function getJourneyView(state) {
  validateJourney(state);
  const scene = resolveJourneyScene(state);
  const choices = state.phase === 'playing' ? scene.choices.map(choice => {
    const reason = unavailableReason(state, choice);
    const hasLifeCost = choice.ending || choice.costs?.years || choice.costs?.lifeDamage;
    const heldItems = Object.entries(choice.costs?.items ?? {}).map(([id, count]) => `${JOURNEY_ITEMS[id]}需 ${count}，现有 ${state.life.items[id] ?? 0}`);
    const detail = choice.detail + (heldItems.length ? ` 当前物品：${heldItems.join('；')}。` : '') + (hasLifeCost ? ` 当前余寿：${state.life.lifeLimit - state.life.age - state.life.lifeDamage} 年。` : '');
    const warnings = [];
    if (choice.costs?.lifeDamage) warnings.push(`会折损 ${choice.costs.lifeDamage} 年寿元。`);
    if (['hurt', 'severe'].includes(choice.effects?.injury)) warnings.push(choice.effects.injury === 'severe' ? '会留下重伤。' : '此举会受伤。');
    if (choice.ending === 'burned') warnings.push('此举必死，将结束这一生。');
    return { id: choice.id, label: choice.label, detail, enabled: !reason, ...(reason ? { reason } : {}), ...(warnings.length ? { warning: warnings.join(' ') } : {}) };
  }) : inheritanceChoices(state);
  return copy({
    revision: state.revision, sceneId: scene.id, phase: state.phase, title: scene.title, location: scene.location,
    blocks: state.transcript.slice(state.life.facts['transcript-start'] ?? 0), choices,
    summary: {
      name: state.life.name, age: state.life.age, year: state.world.year, generation: state.world.generation,
      remainingLife: state.life.lifeLimit - state.life.age - state.life.lifeDamage,
      lifeLimit: state.life.lifeLimit, lifeDamage: state.life.lifeDamage, realm: state.life.realm, injury: state.life.injury,
      abilities: state.life.abilities.map(id => ({ ...JOURNEY_ABILITIES[id] })),
      legacy: state.life.legacyId ? JOURNEY_LEGACIES[state.life.legacyId] : null,
      items: Object.entries(state.life.items).filter(([, count]) => count > 0).map(([id, count]) => ({ id, name: JOURNEY_ITEMS[id], count })),
      ending: state.summary, priorTranscript:state.transcript.slice(0,state.life.facts['transcript-start'] ?? 0), biography: state.world.biography, legacyArchive: state.world.legacyArchive ?? null, legacyCollection: state.world.legacies.map(id => JOURNEY_LEGACIES[id]),
    },
  });
}
function applyEffects(state, effects = {}) {
  for (const [id, count] of Object.entries(effects.items ?? {})) state.life.items[id] = (state.life.items[id] ?? 0) + count;
  const preserveExemption = state.life.facts['joint-seal'] === true && state.life.facts['first-audit'] === false;
  Object.assign(state.life.facts, effects.lifeFacts);
  if (preserveExemption && effects.lifeFacts?.['first-audit'] === true) state.life.facts['first-audit'] = false;
  Object.assign(state.world.facts, effects.worldFacts);
  for (const [id, status] of Object.entries(effects.people ?? {})) if (state.world.people[id]?.status !== 'dead') state.world.people[id] = { ...state.world.people[id], status, ...(status === 'dead' ? { deathYear:state.world.year } : {}) };
  if (effects.injury) state.life.injury = effects.injury;
  if (effects.realm) {
    state.life.realm = effects.realm;
    state.life.lifeLimit = Math.max(state.life.lifeLimit, JOURNEY_REALMS[effects.realm].lifeLimit);
  }
  if (effects.proof && !state.world.proofs.includes(effects.proof)) state.world.proofs.push(effects.proof);
  if (effects.learn) {
    state.life.abilities.push(effects.learn);
    state.life.learnedOpportunities.push(state.scene.opportunities[state.scene.chapterId]);
    for (const id of state.world.legacies) if (id !== `${JOURNEY_LEGACIES[id].abilityId}-memory` && JOURNEY_LEGACIES[id].abilityId === effects.learn) {
      state.life.facts[`recalled-${id}`] = true;
      append(state,{kind:'narration',text:`这次亲学唤起旧藏「${JOURNEY_LEGACIES[id].name}」：${JOURNEY_LEGACIES[id].description} 旧名与来源仍各自留存，方法不叠加。`});
    }
    if (!state.world.legacies.includes(`${effects.learn}-memory`)) state.world.legacies.push(`${effects.learn}-memory`);
  }
  if (effects.settle) {
    const sequence = (state.world.completedTasks.at(-1)?.sequence ?? 0) + 1;
    state.world.completedTasks.push({ ...effects.settle, generation: state.world.generation, sequence });
    const reward = { clinic_open_council:'valley-seed', refuge_common_medicine:'plain-medicine' }[effects.settle.outcomeId];
    if (reward && !state.world.legacies.includes(reward)) state.world.legacies.push(reward);
  }
}
function endLife(state, choice) {
  // Explicit retirement alone advances all remaining years to a real ending.
  const remaining = state.life.lifeLimit - state.life.age - state.life.lifeDamage;
  if (choice.ending === 'burned') state.life.lifeDamage += remaining;
  else { state.life.age += remaining; state.world.year += remaining; }
  state.phase = 'ended';
  state.summary = { cause: choice.ending, generation: state.world.generation, age: state.life.age, title: choice.endingTitle, outcomeId: state.world.completedTasks.at(-1)?.outcomeId ?? null };
  ageJourneyWorld(state);
  recordBiography(state);
}
function recordBiography(state) {
  if (!state.world.biography.some(row => row.generation === state.world.generation)) state.world.biography.push({ ...state.summary, name:state.life.name, realm:state.life.realm, facts:copy(state.life.facts), items:copy(state.life.items), abilities:[...state.life.abilities], legacyId:state.life.legacyId, transcript:copy(state.transcript.slice(state.life.facts['transcript-start'] ?? 0)) });
}
function inheritanceChoices(state) {
  const current = state.life.legacyId;
  const earned = [...state.life.abilities.map(id => `${id}-memory`), ...state.world.legacies.filter(id => state.life.facts[`recalled-${id}`] === true), ...state.world.completedTasks.filter(r => r.generation === state.world.generation).map(r => ({ clinic_open_council:'valley-seed', refuge_common_medicine:'plain-medicine' })[r.outcomeId]).filter(Boolean)];
  const candidates = [...new Set(earned)].filter(id => id !== current).slice(-2);
  if (current) candidates.unshift(current);
  // With no carry, the third learned method is also a legitimate direct choice.
  if (!current && earned.length > 2) candidates.splice(0, candidates.length, ...[...new Set(earned)].slice(-3));
  const gap = state.phase === 'victory' ? `先共同走过余寿 ${state.life.lifeLimit-state.life.age-state.life.lifeDamage} 年后寿终，再经过新生的十六年。` : '新生经过十六年；故人按世界年份老去，历史与世界事实完整保留。';
  return (candidates.length ? candidates : [null]).map(id => ({ id:id ? `inherit-${id}`:'new-life', label:id ? `携「${JOURNEY_LEGACIES[id].name}」再入世。`:'只携记忆，再入世。', detail:gap + (id ? JOURNEY_LEGACIES[id].description : '没有传承候选，不因死亡赠送奖励。'), enabled:true }));
}
// Shared construction boundary used by terminal legacy conversion and v3 rebirth.
// World and transcript are supplied by the caller; no old ending logic runs here.
export function beginJourneyLife(state, legacyId = null) {
  if (state.world.facts['ledger-original'] === 'held') state.world.facts['ledger-original'] = 'archive';
  if (Object.hasOwn(state.world.facts,'witness-cooperation')) state.world.facts['witness-cooperation'] = false;
  state.world.generation++; state.world.year += 16; ageJourneyWorld(state);
  state.life = { name:state.life.name, age:16, lifeLimit:80, lifeDamage:0, realm:'mortal', injury:'well', abilities:[], learnedOpportunities:[], items:{}, legacyId, facts:{'new-person':true,'transcript-start':state.transcript.length, ...(!state.world.facts['valley-outcome'] ? {'unknown-valley':true} : {})} };
  state.phase='playing'; state.summary=null; state.scene={chapterId:'later',nodeId:'later-unknown',opportunities:{}};
  const arc=sequelByValley[state.world.facts['valley-outcome']];
  const node=arc ? (completed(state,`mortal-${arc}`) ? 'later-echo' : `later-${arc}`) : 'later-unknown';
  enterScene(state,node);
  return validateJourney(state);
}
export function chooseJourney(state, command) {
  validateJourney(state);
  if (!command || command.revision !== state.revision || command.sceneId !== state.scene.nodeId) return { kind: 'stale', state, message: '这页已经改变，请以眼前的新情境为准。' };
  if (state.phase !== 'playing') {
    const choice = inheritanceChoices(state).find(row => row.id === command.choiceId);
    if (!choice) return { kind:'unavailable', state, message:'眼前没有这项传承。' };
    const next=copy(state);
    append(next,{kind:'action',text:choice.label,choiceId:choice.id});
    if (next.phase === 'victory') {
      const remaining=next.life.lifeLimit-next.life.age-next.life.lifeDamage;
      next.life.age+=remaining; next.world.year+=remaining;
      next.summary={...next.summary,age:next.life.age};
      append(next,{kind:'result',text:`问鼎之后又过了 ${remaining} 年，你在履行有限职责后寿终；胜利与当年的未竟均保留。`});
      recordBiography(next);
    }
    next.revision++;
    beginJourneyLife(next,choice.id==='new-life' ? null : choice.id.slice(8));
    return commitJourney(state, next, '新的一世从尚未完成的责任开始。');
  }
  const scene = resolveJourneyScene(state), choice = scene.choices.find(row => row.id === command.choiceId);
  if (state.phase !== 'playing' || !choice) return { kind: 'unavailable', state, message: '眼前没有这项行动。' };
  const reason = unavailableReason(state, choice);
  if (reason) return { kind: 'unavailable', state, message: reason };
  const next = copy(state);
  append(next, { kind: 'action', text: choice.label, choiceId: choice.id });
  for (const [id, count] of Object.entries(choice.costs?.items ?? {})) next.life.items[id] -= count;
  next.life.age += choice.costs?.years ?? 0;
  next.world.year += choice.costs?.years ?? 0;
  next.life.lifeDamage += choice.costs?.lifeDamage ?? 0;
  ageJourneyWorld(next);
  if (choice.ending) endLife(next, choice);
  else {
    applyEffects(next, choice.effects);
    if (choice.victory) {
      next.phase = 'victory';
      next.summary = { cause: 'victory', generation: next.world.generation, age: next.life.age, title: '三界问鼎', outcomeId: 'bounded-victory' };
    }
  }
  append(next, { kind: 'result', text: choice.result });
  next.revision++;
  enterScene(next, choice.to);
  if (next.phase === 'ended') next.world.biography.at(-1).transcript=copy(next.transcript.slice(next.life.facts['transcript-start'] ?? 0));
  validateJourney(next);
  return commitJourney(state, next, choice.result);
}

function commitJourney(previous, next, message) {
  try { assertSaveSize(JSON.stringify(next)); }
  catch (error) {
    return { kind: 'unavailable', state: previous, message: `${error.message} 本次行动未提交，原有进度与完整历史保持不变；可导出当前存档备份。` };
  }
  return { kind: 'applied', state: next, message };
}
