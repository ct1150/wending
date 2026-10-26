import { assertSaveSize } from '../save-size.js';
import { ITEMS, SKILLS, REALMS, NODES, resolveCultivationScene } from './content.js';
import { validateCultivation } from './validation.js';
import { DAYS_PER_YEAR, BIRTH_ATTRIBUTES, BIRTH_TALENTS, normalizeCultivationName, remainingDays, durationText, matchesCultivationConditions } from './model.js';

const copy = value => structuredClone(value);
const own = (object, key) => Object.hasOwn(object, key);

function seedHash(seed) {
  let value = 2166136261;
  for (const character of String(seed ?? '凡骨问道')) value = Math.imul(value ^ character.codePointAt(0), 16777619);
  return value >>> 0 || 1;
}

function draw(state, candidates) {
  let value = state.rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rng = value >>> 0 || 1;
  return candidates[Math.floor(state.rng / 4294967296 * candidates.length)];
}

function nextFate(state) {
  // Resolve the whole life's opportunities at birth; reading cannot reroll them.
  const opening = draw(state, ['valley', 'market', 'ferry']);
  return {
    opening,
    opportunity: draw(state, ['marsh', 'ruins', 'caravan']),
    pressure: draw(state, ['rival', 'scarcity', 'storm']),
  };
}

function rollBirth(state, rollCount = 1) {
  const faces = [1, 2, 3, 4, 5, 6];
  return {
    attributes: {
      constitution: draw(state, faces),
      insight: draw(state, faces),
      fortune: draw(state, faces),
    },
    talentId: draw(state, Object.keys(BIRTH_TALENTS)),
    rollCount,
  };
}

function birthView(state) {
  if (state.contentVersion !== 2) return { attributes: [], talents: [] };
  const { attributes, talentId } = state.life.birth;
  const descriptions = {
    constitution: '本来就能疗伤的行动额外恢复' + Math.floor(attributes.constitution / 3) + '级伤势，最多恢复至无碍。',
    insight: '首次成功引气入体时额外积累' + Math.floor(attributes.insight / 3) + '点修为，修为最高为六；功法与修炼年月照常需要。',
    fortune: '入世时额外携带' + Math.floor(attributes.fortune / 3) + '块灵石。',
  };
  return {
    attributes: Object.entries(BIRTH_ATTRIBUTES).map(([id, name]) => ({ id, name, value: attributes[id], description: descriptions[id] })),
    talents: [{ ...BIRTH_TALENTS[talentId] }],
  };
}

function append(state, block) {
  state.transcript.push({ id: 'cultivation-' + (state.transcript.length + 1), sceneId: state.scene.nodeId, ...block });
}

function enterScene(state, nodeId) {
  if (!NODES.includes(nodeId)) throw new Error('修行故事缺少后续场景：' + nodeId);
  state.scene.nodeId = nodeId;
  state.scene.visited.push(nodeId);
  const scene = resolveCultivationScene(state);
  for (const block of scene.blocks) append(state, block);
}

function newLife(world, legacyId, name = '云归') {
  return {
    name, ageDays: 16 * DAYS_PER_YEAR, lifeLimit: 72, lifeDamageDays: 0,
    realm: 'mortal', cultivation: 0, injury: 0,
    skills: legacyId ? [legacyId] : [],
    items: { medicine: 1, stones: 0 }, legacyId,
    facts: {}, startDay: world.day,
  };
}

export function createCultivation(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('开局选项须为对象。');
  const { seed } = options;
  if (seed != null && !((typeof seed === 'number' && Number.isFinite(seed)) || (typeof seed === 'string' && seed.length <= 200))) throw new Error('随机种子须为有限数字或至多200字的文字。');
  const creating = options.characterCreation === true;
  const name = creating ? normalizeCultivationName(options.name === undefined ? '云归' : options.name) : '云归';
  if (name === null) throw new Error('姓名须为1至24字，且不能含有控制符或换行。');
  const world = { day: 1000 * DAYS_PER_YEAR, generation: 1, facts: {}, legacies: [], biography: [] };
  const state = {
    version: 4, mode: 'cultivation', contentVersion: creating ? 2 : 1, revision: 0,
    rng: seedHash(seed), phase: creating ? 'creating' : 'playing', world,
    life: newLife(world, null, name), scene: { nodeId: 'arrival', fate: {}, visited: [] },
    transcript: [], summary: null,
  };
  state.scene.fate = nextFate(state);
  if (creating) state.life.birth = rollBirth(state);
  else enterScene(state, 'arrival');
  return validateCultivation(state);
}

function advancementReason(state, choice) {
  const target = choice.effects?.realm;
  if (target === 'qi') {
    if (state.life.realm !== 'mortal') return '你已走过引气入体这一关。';
    if ((state.life.items.manual ?? 0) < 1) return '缺少完整功法，不能凭残篇引气入体。';
    if ((choice.costs?.years ?? 0) < 2) return '引气需要真正经过数年修习。';
  }
  if (target === 'foundation') {
    if (state.life.realm !== 'qi' || state.life.cultivation < 3) return '炼气尚未圆满，先把功法修稳。';
    if (state.life.injury > 1) return '经脉伤势太重，眼下无法承受筑基。';
    const consumesEssence = (choice.costs?.items?.essence ?? 0) >= 1;
    if (!consumesEssence && state.life.facts['warm-foundation'] !== true) return '还缺筑基灵物，或尚未完成温养准备。';
    if ((choice.costs?.years ?? 0) < 1) return '筑基须经历真实闭关，不能一步跨过。';
  }
  return null;
}

function unmetRequirement(state, conditions = []) {
  const condition = conditions.find(row => !matchesCultivationConditions(state, [row]));
  if (!condition) return null;
  switch (condition.kind) {
    case 'item': return '还缺' + ITEMS[condition.id].name + '，需要' + (condition.min ?? 1) + '，现有' + (state.life.items[condition.id] ?? 0) + '。';
    case 'skill': return '尚未学会' + SKILLS[condition.id].name + '，这条路需要亲身练过的本事。';
    case 'realm': return '这条路须先修至' + REALMS[condition.value].name + '。';
    case 'cultivation': return '修为积累尚不足以冲关，须先完成更多修炼或历练。';
    case 'injury-max': return '当前伤势过重，须先疗伤，才能承受这一步。';
    case 'days-left': return '进谷已过' + (state.world.day - state.life.startDay) + '日，这件事须在第' + condition.value + '日结束前动手。';
    default: return '尚未完成这条路所需的准备；请查看选项中说明的条件。';
  }
}

function unavailableReason(state, choice) {
  const requirement = unmetRequirement(state, choice.requires);
  if (requirement) return requirement;
  for (const [id, count] of Object.entries(choice.costs?.items ?? {})) {
    if (!own(ITEMS, id) || !Number.isSafeInteger(count) || count < 1) throw new Error('故事中的物品成本无效。');
    if ((state.life.items[id] ?? 0) < count) return '还缺' + ITEMS[id].name + '，需要' + count + '，现有' + (state.life.items[id] ?? 0) + '。';
  }
  for (const [id, count] of Object.entries(choice.effects?.items ?? {})) {
    const nextCount = (state.life.items[id] ?? 0) - (choice.costs?.items?.[id] ?? 0) + count;
    if (!own(ITEMS, id) || !Number.isSafeInteger(count)) throw new Error('故事中的物品变化无效。');
    if (nextCount < 0) return '手中没有足够的' + ITEMS[id].name + '。';
    if (nextCount > 9999) return '随身物品已经装不下了。';
  }
  return advancementReason(state, choice);
}

function skillView(id) {
  return { ...SKILLS[id], source: SKILLS[id].source || '在前世亲身学成的法门', description: SKILLS[id].description || '只保留这一项法门的经验，修为仍须今生重修。' };
}

function inheritanceChoices(state) {
  const candidates = state.world.legacies.slice(-2);
  return [
    ...candidates.map(id => ({
      id: 'inherit-' + id, label: '记住' + SKILLS[id].name + '，再入轮回。',
      detail: '十六年后重新入世，只保留这一门方法；境界、灵石和伤势不带入下一世。' + (SKILLS[id].description || ''),
      enabled: true,
    })),
    { id: 'new-life', label: '只携此生记忆，重新问道。', detail: '十六年后新生，故地会记得你的作为。这一世的机缘与修炼之路重新展开。', enabled: true },
  ];
}

function choiceView(state, choice) {
  const reason = unavailableReason(state, choice);
  const detail = [choice.detail];
  const costs = choice.costs || {};
  const duration = (costs.years || 0) * DAYS_PER_YEAR + (costs.days || 0);
  const damage = (costs.lifeYears || 0) * DAYS_PER_YEAR;
  if (duration) detail.push('历时' + durationText(duration) + '。');
  if (damage) detail.push('折损寿元' + durationText(damage) + '。');
  for (const [id, count] of Object.entries(costs.items || {})) detail.push(ITEMS[id].name + '需' + count + '，现有' + (state.life.items[id] || 0) + '。');
  if (duration || damage) {
    detail.push('余寿' + durationText(Math.max(0, remainingDays(state))) + '。');
    if (duration + damage >= remainingDays(state)) detail.push('余寿已不足以完成：继续将寿尽于途中，得不到这次修行成果。');
  }
  const warnings = [];
  if ((duration || damage) && duration + damage >= remainingDays(state)) warnings.push('余寿不足以完成，继续将在途中寿尽，无法得到这次修行成果。');
  if (choice.ending === 'battle') warnings.push('此举必死，将结束这一生。');
  if (damage) warnings.push('会折损寿元' + durationText(damage) + '。');
  if (choice.effects?.lifeFacts?.['foundation-failed'] || /必定失败/.test(choice.label)) warnings.push('强行催动会使冲关失败。');
  if ((choice.effects?.injury || 0) > 0) warnings.push(state.life.injury + choice.effects.injury >= 3 ? '会留下重伤。' : '此举会受伤。');
  return { id: choice.id, label: choice.label, detail: detail.join(' '), enabled: !reason, ...(reason ? { reason } : {}), ...(warnings.length ? { warning: warnings.join(' ') } : {}) };
}

export function getCultivationView(state) {
  validateCultivation(state);
  const creating = state.phase === 'creating';
  const scene = creating ? { title: '为此生落笔', location: '入世之前', goal: '定下姓名，看看此生的资质与天赋', choices: [] } : resolveCultivationScene(state);
  const remaining = Math.max(0, remainingDays(state));
  const age = Math.floor(state.life.ageDays / DAYS_PER_YEAR);
  const year = Math.floor(state.world.day / DAYS_PER_YEAR);
  const transcriptStart = state.life.facts['transcript-start'] ?? 0;
  const traits = birthView(state);
  return copy({
    revision: state.revision, sceneId: state.scene.nodeId, phase: state.phase,
    title: scene.title, location: scene.location, goal: scene.goal,
    blocks: state.transcript.slice(transcriptStart),
    choices: state.phase === 'ended' ? inheritanceChoices(state) : scene.choices.map(choice => choiceView(state, choice)),
    ...(creating ? { creation: { name: state.life.name, ...traits, rollCount: state.life.birth.rollCount } } : {}),
    summary: {
      name: state.life.name, age, ageText: age + '岁', year, generation: state.world.generation,
      remainingLife: Math.floor(remaining / DAYS_PER_YEAR), remainingLifeText: durationText(remaining),
      lifeLimit: state.life.lifeLimit, lifeDamage: state.life.lifeDamageDays / DAYS_PER_YEAR,
      realm: state.life.realm, realmName: REALMS[state.life.realm].name,
      injury: state.life.injury, injuryName: ['无碍', '轻伤', '内伤', '重伤'][state.life.injury],
      abilities: state.life.skills.map(id => ({ ...SKILLS[id] })),
      legacy: state.life.legacyId ? skillView(state.life.legacyId) : null,
      items: Object.entries(state.life.items).filter(([, count]) => count > 0).map(([id, count]) => ({ id, name: ITEMS[id].name, count })),
      ending: state.summary, biography: state.world.biography, priorTranscript: state.transcript.slice(0, transcriptStart), legacyArchive: null,
      legacyCollection: state.world.legacies.map(skillView),
      ...traits,
    },
  });
}

function addDeed(state, text) {
  if (!text) return;
  const deeds = Object.keys(state.life.facts).filter(key => /^deed-\d+$/.test(key)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5))).map(key => state.life.facts[key]);
  if (deeds.includes(text)) return;
  deeds.push(text);
  const kept = deeds.slice(-8);
  for (const key of Object.keys(state.life.facts)) if (/^deed-\d+$/.test(key)) delete state.life.facts[key];
  kept.forEach((value, index) => { state.life.facts['deed-' + (index + 1)] = value; });
}

function applyEffects(state, effects = {}) {
  for (const [id, count] of Object.entries(effects.items || {})) state.life.items[id] = (state.life.items[id] || 0) + count;
  for (const id of effects.skills || []) {
    if (!own(SKILLS, id)) throw new Error('故事中的法门不存在。');
    if (!state.life.skills.includes(id)) state.life.skills.push(id);
    if (!state.world.legacies.includes(id)) state.world.legacies.push(id);
  }
  if (effects.legacy && !state.world.legacies.includes(effects.legacy)) {
    if (!own(SKILLS, effects.legacy)) throw new Error('传承法门不存在。');
    state.world.legacies.push(effects.legacy);
  }
  const birth = state.contentVersion === 2 ? state.life.birth : null;
  const qiBonus = birth && state.life.realm === 'mortal' && effects.realm === 'qi'
    ? Math.floor(birth.attributes.insight / 3) + (['focused', 'keen-memory'].includes(birth.talentId) ? 1 : birth.talentId === 'flash-wisdom' ? 2 : 0) : 0;
  const healBonus = birth && (effects.heal || 0) > 0
    ? Math.floor(birth.attributes.constitution / 3) + (birth.talentId === 'restful' ? 1 : 0) : 0;
  state.life.cultivation = Math.max(0, Math.min(6, state.life.cultivation + (effects.cultivation || 0) + qiBonus));
  state.life.injury = Math.max(0, Math.min(3, state.life.injury + (effects.injury || 0) - (effects.heal || 0) - healBonus));
  Object.assign(state.life.facts, effects.lifeFacts);
  Object.assign(state.world.facts, effects.worldFacts);
  if (effects.realm) {
    state.life.realm = effects.realm;
    state.life.lifeLimit = REALMS[effects.realm].lifeLimit;
  }
  addDeed(state, effects.deed);
}

function passDays(state, days) {
  state.life.ageDays += days;
  state.world.day += days;
}

function endLife(state, cause, choice = {}) {
  state.phase = 'ended';
  state.summary = {
    cause,
    title: choice.endingTitle || ({ battle: '仙途未竟', lifespan: '寿尽灯熄', retired: '山中一生' }[cause]),
    generation: state.world.generation, age: Math.floor(state.life.ageDays / DAYS_PER_YEAR), realm: state.life.realm,
    achievement: choice.achievement || (state.life.realm === 'foundation' ? '跨过筑基关隘，寿限与眼界都已不同。' : state.life.realm === 'qi' ? '从凡人踏入炼气，走过属于自己的求仙路。' : '曾为一部完整功法，走进自己不熟悉的世界。'),
    lesson: choice.lesson || (cause === 'lifespan' ? '闭关与筹备都要花年月。下一世可以更早寻找适合自己的机缘。' : cause === 'battle' ? '记住这次已看见却没有避开的危险，下一世多留一条退路。' : '这一生的取舍已留在故地；新的一世仍有不同的修行办法。'),
  };
  const deeds = Object.keys(state.life.facts).filter(key => /^deed-\d+$/.test(key)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5))).map(key => state.life.facts[key]);
  state.world.biography.push({
    ...state.summary, name: state.life.name, year: Math.floor(state.world.day / DAYS_PER_YEAR),
    legacyId: state.life.legacyId, skills: [...state.life.skills], deeds,
  });
  addDeed(state, state.summary.achievement);
}

function commit(previous, next, message) {
  try {
    validateCultivation(next);
    assertSaveSize(JSON.stringify(next));
    return { kind: 'applied', state: next, message };
  } catch (error) {
    return { kind: 'unavailable', state: previous, message: '这一步尚未记下，原有进度保留：' + error.message };
  }
}

function chooseBirth(state, command) {
  if (!['birth-name', 'birth-reroll', 'birth-start'].includes(command.choiceId)) return { kind: 'unavailable', state, message: '请先定下此生姓名与资质，再踏入故事。' };
  const needsName = command.choiceId === 'birth-name' || (command.choiceId === 'birth-start' && own(command, 'name'));
  const name = needsName ? normalizeCultivationName(command.name) : state.life.name;
  if (name === null) return { kind: 'unavailable', state, message: '姓名须为1至24字，且不能含有控制符或换行。' };
  const next = copy(state);
  next.life.name = name;
  let message = '此生姓名已记下。';
  if (command.choiceId === 'birth-reroll') {
    next.life.birth = rollBirth(next, next.life.birth.rollCount + 1);
    message = '骰子落定，此生的资质与天赋已记下。';
  } else if (command.choiceId === 'birth-start') {
    next.life.items.stones += Math.floor(next.life.birth.attributes.fortune / 3);
    if (next.life.birth.talentId === 'prepared') next.life.items.medicine++;
    if (next.life.birth.talentId === 'herb-affinity') next.life.items.herb = 1;
    if (next.life.birth.talentId === 'sensitive-breath') next.life.items.talisman = 1;
    if (next.life.birth.talentId === 'flash-wisdom') next.life.lifeDamageDays += 3 * DAYS_PER_YEAR;
    if (next.life.birth.talentId === 'fortunate-burden') { next.life.items.stones += 3; next.life.injury = 1; }
    next.phase = 'playing';
    enterScene(next, 'arrival');
    message = name + '，此生的求仙路从这里开始。';
  }
  next.revision++;
  return commit(state, next, message);
}

export function chooseCultivation(state, command) {
  validateCultivation(state);
  if (!command || command.revision !== state.revision || command.sceneId !== state.scene.nodeId) return { kind: 'stale', state, message: '眼前的故事已经变化，请按当前选项继续。' };
  if (state.phase === 'creating') return chooseBirth(state, command);
  if (state.phase === 'ended') {
    const choice = inheritanceChoices(state).find(row => row.id === command.choiceId);
    if (!choice) return { kind: 'unavailable', state, message: '此生没有留下这项传承。' };
    const next = copy(state);
    const legacyId = choice.id === 'new-life' ? null : choice.id.slice(8);
    append(next, { kind: 'action', text: choice.label, choiceId: choice.id });
    next.world.day += 16 * DAYS_PER_YEAR;
    next.world.generation++;
    next.life = newLife(next.world, legacyId, state.life.name);
    next.life.facts['transcript-start'] = next.transcript.length;
    next.scene = { nodeId: 'arrival', fate: nextFate(next), visited: [] };
    next.summary = null;
    next.phase = next.contentVersion === 2 ? 'creating' : 'playing';
    if (next.phase === 'creating') next.life.birth = rollBirth(next);
    next.revision++;
    if (next.phase === 'playing') enterScene(next, 'arrival');
    return commit(state, next, next.phase === 'creating' ? '十六年后，再为此生落笔定名。' : '十六年后，你再一次踏上求仙之路。');
  }
  const scene = resolveCultivationScene(state);
  const choice = scene.choices.find(row => row.id === command.choiceId);
  if (!choice) return { kind: 'unavailable', state, message: '眼前没有这条路。' };
  const reason = unavailableReason(state, choice);
  if (reason) return { kind: 'unavailable', state, message: reason };
  const next = copy(state);
  append(next, { kind: 'action', text: choice.label, choiceId: choice.id });
  const costs = choice.costs || {};
  for (const [id, count] of Object.entries(costs.items || {})) next.life.items[id] -= count;
  const duration = (costs.years || 0) * DAYS_PER_YEAR + (costs.days || 0);
  const damage = (costs.lifeYears || 0) * DAYS_PER_YEAR;
  if (![duration, damage].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('修行年耗无效。');
  const remaining = remainingDays(next);
  let result = choice.result;
  let target = choice.to;
  if (duration + damage >= remaining) {
    const suffered = Math.min(damage, remaining);
    next.life.lifeDamageDays += suffered;
    passDays(next, remaining - suffered);
    endLife(next, 'lifespan', { endingTitle: '未能等到的破关之日', lesson: '这次修行需要的年月超过了余寿。下一世先筹齐条件，或更早换一条修炼之路。' });
    result = '你知道余年已经不够，仍把最后的岁月交给了这次修行。灯火熄灭时，功法尚未练成；未完成的成果没有来到手中。';
    target = 'ended';
  } else {
    passDays(next, duration);
    next.life.lifeDamageDays += damage;
    applyEffects(next, choice.effects);
    if (choice.ending) {
      if (choice.ending === 'retired' || choice.ending === 'lifespan') passDays(next, Math.max(0, remainingDays(next)));
      endLife(next, choice.ending, choice);
      target = 'ended';
    }
  }
  append(next, { kind: 'result', text: result });
  next.revision++;
  enterScene(next, target);
  return commit(state, next, result);
}
