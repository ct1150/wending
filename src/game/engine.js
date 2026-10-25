import { createStoryWorld, createStory, syncStoryClock, ageStoryWorld, storyChoices, advanceStory, resumeStoryCombat, settleStory, storyView, validateStoryWorld, validateStory } from './story.js';
import { REALMS, PATHS, ORIGINS, WORLDS, ITEMS, LEGACIES, EVENTS, ENEMIES, CHALLENGES, WORLD_FLAGS } from './content.js';

const find = (rows, id) => rows.find(row => row.id === id);
const copy = value => structuredClone(value);
const unique = values => [...new Set(values)];
const fail = text => { throw new Error(text); };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ACTIONS = { train: '闭关修行', explore: '外出历练', rest: '休养调息', alchemy: '炼制延寿丹', breakthrough: '尝试突破', retire: '归隐此生' };
const MAX_NUMBER = 1000000000;
function hashSeed(seed) {
  const text = String(seed ?? '百世问鼎');
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0 || 1;
}
function random(state) {
  let x = state.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0 || 1;
  return state.rng / 4294967296;
}
function log(state, title, text, kind = 'action') {
  state.lastMessage = text;
  const previous = state.run.log.at(-1)?.id ?? 0;
  state.run.log.push({ id: previous + 1, year: state.meta.worldYear, age: state.run.age, title, text, kind });
  state.run.log = state.run.log.slice(-200);
}
function candidate(state, id) {
  if (find(LEGACIES, id) && !state.meta.legacyIds.includes(id) && !state.run.legacyCandidates.includes(id)) state.run.legacyCandidates.push(id);
}
function milestones(state) {
  const r = state.run;
  if (r.realmIndex >= 2) {
    candidate(state, 'realm-memory');
    if (r.pathId === 'sword') candidate(state, 'sword-heart');
    if (r.pathId === 'body') candidate(state, 'iron-bone');
  }
  if (r.pathId === 'alchemy' && r.realmIndex >= 1 && r.elixirsUsed === 2) candidate(state, 'golden-furnace');
}
function historyLog(state) {
  const kinds = ['birth', 'event', 'failure', 'world', 'milestone', 'ending', 'legacy'];
  return copy(state.run.log.filter(entry => kinds.includes(entry.kind)).slice(-40));
}
function endLife(state, cause, text) {
  if (state.phase === 'ended' || state.phase === 'victory') return state;
  settleNarrative(state, true);
  milestones(state);
  state.phase = 'ended'; state.eventId = null; state.combat = null;
  const options = state.run.legacyCandidates.filter(id => !state.meta.legacyIds.includes(id));
  state.summary = { cause, title: cause === 'victory' ? '问鼎三界' : cause === 'retired' ? '归隐山林' : cause === 'battle' ? '身陨道途' : '寿元已尽', text, age: state.run.age, realmIndex: state.run.realmIndex, legacyOptions: options, selectedLegacyId: null, deeds: [...state.run.deeds], worldChanges: state.run.log.filter(entry => entry.kind === 'world').map(entry => entry.text) };
  log(state, state.summary.title, text, 'ending');
  state.meta.history.push({ generation: state.meta.generation, name: state.run.name, age: state.run.age, realmIndex: state.run.realmIndex, cause, deeds: [...state.run.deeds], log: historyLog(state), selectedLegacyId: null });
  state.meta.history = state.meta.history.slice(-50);
  return state;
}
function checkLife(state) {
  if (getStats(state).remainingLife <= 0) { endLife(state, 'lifespan', '岁月与命损耗尽了余寿。此生经历已记入轮回。'); return false; }
  if (state.run.hp <= 0) { endLife(state, 'battle', '气血耗尽，道途止于此刻。此生经历已记入轮回。'); return false; }
  return true;
}
function spendYears(state, years) {
  state.run.age += years; state.meta.worldYear += years;
  state.meta.storyWorld = ageStoryWorld(state.meta.storyWorld, state.meta.worldYear);
  // Elapsed time remains a fact when its cost ends the life. Synchronize before
  // settlement so failed-story replay sees the same deadline transition.
  state.story = syncStoryClock(state.story, state.meta.worldYear);
  return checkLife(state);
}
function requirePhase(state, phase = 'adventure') {
  if (state.phase !== phase) fail(phase === 'adventure' ? '请先完成当前际遇或战斗；此刻不能进行此行动。' : `当前阶段不能进行此操作（${state.phase}）。`);
}
function equippedItems(run) {
  return [run.loadout.art, ...run.loadout.skills, run.loadout.artifact].filter(Boolean).map(id => find(ITEMS, id));
}
export function getStats(state) {
  const run = state.run, realm = REALMS[run.realmIndex], path = find(PATHS, run.pathId);
  const stats = { attack: realm.attack + path.bonuses.attack + run.attackBonus, defense: realm.defense + path.bonuses.defense + run.defenseBonus, maxHp: realm.hp + path.bonuses.hp + run.hpBonus, training: realm.trainGain + path.bonuses.training, burnBonus: 0, healingBonus: 0 };
  for (const item of equippedItems(run)) for (const [key, value] of Object.entries(item.stats)) {
    const target = { hp: 'maxHp', burn: 'burnBonus', healing: 'healingBonus' }[key] ?? key;
    stats[target] += value;
  }
  stats.lifeLimit = realm.lifeCap + run.lifeBonus;
  stats.remainingLife = stats.lifeLimit - run.age - run.lifeDamage;
  stats.realm = realm; stats.nextRealm = REALMS[run.realmIndex + 1] ?? null;
  stats.need = realm.need;
  stats.breakthroughChance = stats.nextRealm ? Math.min(0.98, 0.76 + run.breakthroughFailures * 0.1 + Math.min(0.1, Math.max(0, run.cultivation - realm.need) / Math.max(1, realm.need) * 0.1)) : 0;
  return stats;
}
export function createGame(options = {}, previousMeta = null) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('请提供有效的开局选项。');
  if (previousMeta !== null) validateMeta(previousMeta);
  if (options.seed != null && !((typeof options.seed === 'string' && options.seed.length <= 200) || (typeof options.seed === 'number' && Number.isFinite(options.seed)))) fail('随机种子须为有限数字或至多 200 字的文字。');
  const { name = '无名修士', originId = 'village', pathId = 'sword', seed, legacyIds = [] } = options;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) fail('道号须为 1～24 个字符。');
  const origin = find(ORIGINS, originId), path = find(PATHS, pathId);
  if (!origin || !path) fail('出身或流派不存在。');
  if (!Array.isArray(legacyIds) || legacyIds.length > 2 || unique(legacyIds).length !== legacyIds.length) fail('每世最多携带两项不同传承。');
  for (const id of legacyIds) if (!find(LEGACIES, id) || !previousMeta?.legacyIds.includes(id)) fail('只能携带已经解锁的传承。');
  const meta = previousMeta ? { ...copy(previousMeta), generation: previousMeta.generation + 1, worldYear: previousMeta.worldYear + 16 } : { generation: 1, worldYear: 1000, legacyIds: [], proofs: [], worldFlags: [], history: [], victories: 0 };
  const run = { name: name.trim(), originId, pathId, age: 16, realmIndex: 0, worldId: 'mortal', cultivation: 0, hp: 1, spirit: origin.spirit, herbs: origin.herbs, merit: 0, renown: 0, lifeBonus: 0, lifeDamage: 0, elixirsUsed: 0, turn: 0, attackBonus: 0, defenseBonus: 0, hpBonus: origin.hpBonus, breakthroughFailures: 0, items: unique([path.starterArt, path.starterSkill]), loadout: { art: path.starterArt, skills: [path.starterSkill], artifact: null }, flags: [], visitedEvents: [], legacyCandidates: [], selectedLegacies: [...legacyIds], deeds: [], log: [] };
  if (!previousMeta) meta.storyWorld = createStoryWorld(meta);
  meta.storyWorld = ageStoryWorld(meta.storyWorld, meta.worldYear);
  const state = { version: 2, rng: hashSeed(seed), phase: 'adventure', run, meta, eventId: null, combat: null, summary: null, lastMessage: '', story: null };
  for (const id of legacyIds) {
    const effects = find(LEGACIES, id).effects;
    for (const key of ['spirit', 'herbs', 'cultivation']) run[key] += effects[key] ?? 0;
    for (const key of ['attack', 'defense', 'hp']) run[`${key}Bonus`] += effects[key] ?? 0;
    if (effects.itemId) run.items = unique([...run.items, effects.itemId]);
    if (effects.flag) run.flags = unique([...run.flags, effects.flag]);
  }
  run.hp = getStats(state).maxHp;
  state.story = createStory(state);
  log(state, '灵台初醒', `${meta.worldYear} 年，${run.name}于十六岁踏上${path.name}之途。`, 'birth');
  return state;
}
function settleNarrative(state, interrupted = false) {
  const result = settleStory(state.story, state.meta.storyWorld, state.meta.generation, state.meta.worldYear, interrupted);
  if (!result) return;
  state.story = result.story; state.meta.storyWorld = result.world;
  if (result.world.valleyOutcome === 'open_clinic') state.meta.worldFlags = unique([...state.meta.worldFlags, 'medicine-valley']);
  else state.meta.worldFlags = state.meta.worldFlags.filter(id => id !== 'medicine-valley');
  if (!interrupted) {
    if (['open_clinic', 'clinic_open_council'].includes(state.story.outcomeId)) {
      state.run.items = unique([...state.run.items, 'valley-canon']); candidate(state, 'valley-seed');
    }
    if (state.story.outcomeId === 'sect_estate') state.run.spirit += 20;
    const gains = ['open_clinic', 'clinic_open_council'].includes(state.story.outcomeId) ? ['获得青谷丹书', '药谷种籽列为本世传承候选'] : state.story.outcomeId === 'sect_estate' ? ['安置协助补偿：灵石+20（仅一次）'] : state.story.outcomeId === 'refuge_common_medicine' ? ['朴药手记列为本世传承候选'] : [];
    if (state.story.lastResult) state.story.lastResult.changes.push(...gains);
    if (state.story.outcomeId === 'refuge_common_medicine') candidate(state, 'plain-medicine');
    state.run.deeds = unique([...state.run.deeds, result.outcome.title]);
  }
  const change = interrupted && state.story.arc !== 'old-fire' ? '后世任务未竟，保留既定谷地与灵种事实，未执行的选项不发奖励。' : result.outcome.worldChange;
  log(state, result.outcome.title, change, 'world');
}
export function getStoryView(state) {
  return storyView({ ...state, remainingLife: getStats(state).remainingLife });
}
export function chooseStory(state, choiceId) {
  requirePhase(state);
  if (!state.story) fail('本世没有剧情选项；下一世进入新篇。');
  const choice = storyChoices({ ...state, remainingLife: getStats(state).remainingLife }).find(row => row.id === choiceId);
  if (!choice) fail('没有这个剧情选项。');
  if (!choice.enabled) fail(choice.reason);
  const next = copy(state), cost = choice.cost, originalScene = state.story.sceneId;
  next.run.turn++;
  if (choice.restOfLife) {
    const text = `你用余下${cost.years}年守望既定的药谷生活，从${next.run.age}岁走到${next.run.age + cost.years}岁。没有免费破境，药簿与在世者继续老去，世界也会真实经过这段岁月。`;
    next.story.lastResult = { title: '守望余生', text, changes: [`经过${cost.years}年`] };
    next.story.journal.push({ title: '守望余生', text, year: next.meta.worldYear });
    log(next, '守望余生', text, 'event');
  }
  next.run.spirit -= cost.spirit ?? 0; next.run.herbs -= cost.herbs ?? 0; next.run.hp -= cost.hp ?? 0;
  next.run.lifeDamage += cost.lifeDamage ?? 0;
  if (!spendYears(next, cost.years ?? 0)) return next;
  if (next.story.sceneId !== originalScene) {
    log(next, next.story.lastResult.title, next.story.lastResult.text, 'event');
    return next;
  }
  next.story = advanceStory(next.story, choice, next.meta.worldYear, next.meta.storyWorld);
  applyEffects(next, choice.effects);
  log(next, next.story.lastResult.title, next.story.lastResult.text, 'event');
  if (choice.combat) beginCombat(next, find(ENEMIES, choice.combat), null);
  settleNarrative(next);
  return next;
}
export function getActionInfo(state, type) {
  if (!Object.hasOwn(ACTIONS, type)) fail('未知行动。');
  const stats = getStats(state), realm = stats.realm;
  const years = { train: realm.trainYears, explore: 2, rest: 2, alchemy: realm.trainYears, breakthrough: realm.breakYears, retire: 0 }[type];
  let reason = '';
  if (state.phase !== 'adventure') reason = '请先完成当前际遇或战斗。';
  else if (type === 'breakthrough' && !stats.nextRealm) reason = '已臻登仙，无更高境界。';
  else if (type === 'breakthrough' && state.run.cultivation < stats.need) reason = `修为不足，尚需 ${stats.need - state.run.cultivation} 点。`;
  else if (type === 'alchemy' && state.run.elixirsUsed >= 2) reason = '每世最多服用两枚延寿丹。';
  else if (type === 'alchemy' && (state.run.herbs < 3 || state.run.spirit < 15)) reason = '需要 3 药材和 15 灵石。';
  return { type, label: ACTIONS[type], years, enabled: !reason, reason, costText: `${years ? `耗时 ${years} 年` : '不耗时'}${type === 'alchemy' ? ' · 3 药材 · 15 灵石 · 每世最多两次' : ''}${type === 'explore' ? ' · 可能遭遇战斗' : ''}${type === 'breakthrough' && stats.nextRealm ? ` · 成功率 ${Math.round(stats.breakthroughChance * 100)}%` : ''}` };
}
export function act(state, action) {
  requirePhase(state);
  const type = action?.type;
  if (type === 'challenge' || type === 'finale') return startChallenge(state, action);
  const next = copy(state), run = next.run;
  if (type === 'travel') {
    const world = find(WORLDS, action.worldId);
    if (!world || run.realmIndex < world.minRealm) fail('境界不足，尚不能前往该界。');
    if (run.worldId === world.id) fail('你已在此界。');
    run.turn++;
    if (!spendYears(next, 2)) return next;
    run.worldId = world.id; log(next, '游历三界', `历时两年，抵达${world.name}。`); return next;
  }
  const info = getActionInfo(state, type);
  if (!info.enabled) fail(info.reason);
  if (type === 'retire') return endLife(next, 'retired', '你将余生交给山林，所行之事与未竟之愿留待后世。');
  run.turn++;
  if (type === 'alchemy') { run.herbs -= 3; run.spirit -= 15; }
  if (!spendYears(next, info.years)) return next;
  if (type === 'train') { run.cultivation += getStats(next).training; run.spirit += 5; log(next, '闭关修行', `静修${info.years}年，修为增长 ${getStats(next).training}，灵石增加 5。`); }
  if (type === 'rest') { const healing = Math.ceil(getStats(next).maxHp * 0.45) + getStats(next).healingBonus; run.hp = Math.min(getStats(next).maxHp, run.hp + healing); log(next, '休养调息', `休养两年，恢复 ${healing} 气血。`); }
  if (type === 'alchemy') { run.lifeBonus += 2 * getStats(next).realm.trainYears; run.elixirsUsed++; milestones(next); log(next, '延寿丹成', `服下延寿丹，寿限增加 ${2 * getStats(next).realm.trainYears} 年（本世 ${run.elixirsUsed}/2 次）。`, 'milestone'); }
  if (type === 'breakthrough') {
    if (random(next) < getStats(next).breakthroughChance) {
      run.cultivation -= getStats(next).need; run.realmIndex++; run.breakthroughFailures = 0; run.hp = getStats(next).maxHp; milestones(next);
      run.deeds.push(`突破${getStats(next).realm.name}`); log(next, '破境功成', `你踏入${getStats(next).realm.name}，寿限与气血随之提升。`, 'milestone');
    } else { run.breakthroughFailures++; run.hp = Math.max(1, run.hp - Math.ceil(getStats(next).maxHp * 0.12)); log(next, '突破未成', '冲关失败，气血受损；修为保留，下一次成功率提高。'); }
  }
  if (type === 'explore') explore(next);
  return next;
}
export function reincarnate(state, options = {}) {
  if (!['ended', 'victory'].includes(state.phase)) fail('此生尚未结束。');
  if (state.summary.legacyOptions.length && !state.summary.selectedLegacyId) fail('请先从本世候选中选择一项传承。');
  return createGame({ name: state.run.name, originId: state.run.originId, pathId: state.run.pathId, seed: state.rng, ...options }, state.meta);
}

function meets(state, requires = {}) {
  const r = state.run;
  return (requires.minRealm == null || r.realmIndex >= requires.minRealm)
    && (requires.maxRealm == null || r.realmIndex <= requires.maxRealm)
    && (!requires.pathId || r.pathId === requires.pathId)
    && (!requires.flag || r.flags.includes(requires.flag))
    && (!requires.notFlag || !r.flags.includes(requires.notFlag))
    && (!requires.worldFlag || state.meta.worldFlags.includes(requires.worldFlag))
    && (!requires.notWorldFlag || !state.meta.worldFlags.includes(requires.notWorldFlag));
}
function explore(state) {
  const enemies = ENEMIES.filter(enemy => enemy.id !== 'valley-sentinel' && enemy.worldId === state.run.worldId && !CHALLENGES.some(challenge => challenge.enemyId === enemy.id));
  if (state.run.visitedEvents.length > 0 && enemies.length && random(state) < 0.15) {
    const enemy = enemies[Math.floor(random(state) * enemies.length)];
    beginCombat(state, enemy, null);
    log(state, '道途遇敌', `历练途中遭遇${enemy.name}。敌意已现，可战亦可退。`, 'combat');
    return;
  }
  const pool = EVENTS.filter(event => !(state.story && ['mortal-seed', 'mortal-valley-heirs'].includes(event.id)) && event.worldId === state.run.worldId && !state.run.visitedEvents.includes(event.id) && meets(state, event.requires));
  if (!pool.length) {
    state.run.spirit += 8; state.run.herbs += 2;
    log(state, '山川静行', '此地暂无线索。你采得 2 份药材，寻得 8 枚灵石，平安归来。');
    return;
  }
  const event = pool[Math.floor(random(state) * pool.length)];
  state.phase = 'event'; state.eventId = event.id;
  state.run.visitedEvents.push(event.id);
  log(state, event.title, event.body, 'event');
}
function choiceReason(state, choice) {
  if (!meets(state, choice.requires)) return '尚未满足此选项的境界、流派或因果条件。';
  const cost = choice.cost ?? {};
  if (state.run.spirit < (cost.spirit ?? 0)) return `灵石不足，需要 ${cost.spirit}。`;
  if (state.run.herbs < (cost.herbs ?? 0)) return `药材不足，需要 ${cost.herbs}。`;
  if (state.run.hp < (cost.hp ?? 0)) return `气血不足，需要 ${cost.hp}。`;
  return '';
}
export function getEventChoices(state) {
  requirePhase(state, 'event');
  const event = find(EVENTS, state.eventId);
  if (!event) fail('当前际遇资料不存在。');
  return event.choices.map(choice => { const reason = choiceReason(state, choice); return { ...copy(choice), enabled: !reason, reason }; });
}
function applyEffects(state, effects = {}) {
  const run = state.run;
  for (const key of ['cultivation', 'spirit', 'herbs', 'merit', 'renown', 'lifeDamage']) if (effects[key] != null) run[key] = Math.max(0, run[key] + effects[key]);
  if (effects.itemId) {
    if (!find(ITEMS, effects.itemId)) fail('际遇物品资料不存在。');
    run.items = unique([...run.items, effects.itemId]);
  }
  if (effects.flag) run.flags = unique([...run.flags, effects.flag]);
  if (effects.worldFlag && !state.meta.worldFlags.includes(effects.worldFlag)) {
    state.meta.worldFlags.push(effects.worldFlag);
    if (effects.worldFlag === 'medicine-valley' && state.story === null) {
      // A migrated character may still earn the original valley fact this life.
      // Preserve that real act, without inventing the new case or NPC meetings.
      Object.assign(state.meta.storyWorld, { valleyOutcome: 'open_clinic', resolvedYear: state.meta.worldYear, resolvedGeneration: state.meta.generation, seedCustodian: 'clinic' });
    }
    const text = `世界因果「${WORLD_FLAGS[effects.worldFlag].name}」已留存，后世将见其回响。`;
    run.deeds = unique([...run.deeds, `留下因果：${WORLD_FLAGS[effects.worldFlag].name}`]);
    log(state, '因果留痕', text, 'world');
  }
  if (effects.removeWorldFlag && state.meta.worldFlags.includes(effects.removeWorldFlag)) {
    state.meta.worldFlags = state.meta.worldFlags.filter(id => id !== effects.removeWorldFlag);
    log(state, '因果化解', `世界因果「${WORLD_FLAGS[effects.removeWorldFlag].name}」已化解。`, 'world');
  }
  if (effects.legacyId) candidate(state, effects.legacyId);
  if (effects.hp != null) run.hp = clamp(run.hp + effects.hp, 0, getStats(state).maxHp);
}
export function chooseEvent(state, choiceId) {
  const choice = getEventChoices(state).find(row => row.id === choiceId);
  if (!choice) fail('没有这个际遇选项。');
  if (!choice.enabled) fail(choice.reason);
  const next = copy(state), cost = choice.cost ?? {};
  next.run.spirit -= cost.spirit ?? 0; next.run.herbs -= cost.herbs ?? 0; next.run.hp -= cost.hp ?? 0;
  next.run.lifeDamage += cost.lifeDamage ?? 0;
  next.run.turn++;
  if (!spendYears(next, cost.years ?? 0)) return next;
  const success = choice.chance == null || random(next) < choice.chance;
  const result = success ? { text: choice.result, effects: choice.effects } : (choice.failure ?? { text: '机缘未成，你空手而归。', effects: {} });
  next.phase = 'adventure'; next.eventId = null;
  applyEffects(next, result.effects);
  log(next, choice.label, result.text, success ? 'event' : 'failure');
  checkLife(next); milestones(next);
  return next;
}
export function equipItem(state, itemId, slot = 0) {
  requirePhase(state);
  const item = find(ITEMS, itemId);
  if (!item || !state.run.items.includes(itemId)) fail('尚未拥有这件物品。');
  const next = copy(state), loadout = next.run.loadout;
  if (item.kind === 'skill') {
    if (!Number.isInteger(slot) || slot < 0 || slot > 1) fail('神通只有第 1、2 两个槽位。');
    if (loadout.skills.some((id, index) => id === itemId && index !== slot)) fail('同一神通不能重复装备。');
    if (slot === 1 && loadout.skills.length === 0) fail('请先装备第一个神通槽位。');
    loadout.skills[slot] = itemId;
  } else loadout[item.kind] = itemId;
  next.run.hp = Math.min(next.run.hp, getStats(next).maxHp);
  log(next, '调整构筑', `已装备${item.name}。`);
  return next;
}
function beginCombat(state, enemy, challengeId) {
  state.phase = 'combat'; state.eventId = null;
  state.combat = { enemyId: enemy.id, enemyHp: enemy.hp, enemyMaxHp: enemy.hp, round: 1, focus: 0, challengeId, log: [`${enemy.name}拦住去路。每第三回合将施展强击。`] };
}
function startChallenge(state, action) {
  const id = action.type === 'finale' ? 'finale' : action.challengeId;
  const challenge = find(CHALLENGES, id);
  if (!challenge) fail('挑战不存在。');
  if (state.run.worldId !== challenge.worldId) fail('请先前往挑战所在的世界。');
  if (state.run.realmIndex < challenge.minRealm) fail('境界不足，尚不能发起此挑战。');
  if (challenge.proofId && state.meta.proofs.includes(challenge.proofId)) fail('此界道证已取得，无需再次挑战。');
  if (challenge.final && !['mortal', 'nether', 'celestial'].every(proof => state.meta.proofs.includes(proof))) fail('尚未集齐三界道证。');
  const next = copy(state);
  beginCombat(next, find(ENEMIES, challenge.enemyId), challenge.id);
  log(next, challenge.name, challenge.description, 'combat');
  return next;
}
function winCombat(state) {
  if (state.story?.pendingCombat) {
    state.phase = 'adventure'; state.combat = null;
    state.story = resumeStoryCombat(state.story, 'win', state.meta.worldYear);
    log(state, state.story.lastResult.title, state.story.lastResult.text, 'event');
    return state;
  }
  const enemy = find(ENEMIES, state.combat.enemyId);
  const challenge = find(CHALLENGES, state.combat.challengeId);
  state.phase = 'adventure'; state.combat = null;
  state.run.spirit += challenge ? 35 : 12;
  state.run.herbs += challenge ? 3 : 1;
  state.run.renown += challenge ? 5 : 1;
  state.run.deeds = unique([...state.run.deeds, `战胜${enemy.name}`]);
  if (challenge?.proofId) {
    state.meta.proofs = unique([...state.meta.proofs, challenge.proofId]);
    if (state.run.pathId === 'sword') candidate(state, 'sword-heart');
    log(state, '道证入手', `你战胜${enemy.name}，取得${find(WORLDS, challenge.worldId).name}道证。道证将随轮回保留。`, 'milestone');
  } else log(state, '战斗得胜', `你战胜${enemy.name}，获得灵石与药材。`, 'combat');
  milestones(state);
  if (challenge?.final) {
    endLife(state, 'victory', '三界道证共鸣，旧世因果皆化为此刻的见证。你登临共主之位，百世问鼎，终得其答。');
    state.phase = 'victory'; state.summary.title = '百世问鼎 · 三界共主'; state.meta.victories++;
  }
  return state;
}
export function combatAction(state, action) {
  requirePhase(state, 'combat');
  if (!['strike', 'guard', 'burn', 'flee'].includes(action)) fail('未知战斗行动。');
  const next = copy(state), combat = next.combat, run = next.run, enemy = find(ENEMIES, combat.enemyId);
  run.turn++;
  if (action === 'flee') {
    const lost = Math.ceil(run.spirit * 0.2); run.spirit -= lost; run.herbs = Math.max(0, run.herbs - 1);
    next.phase = 'adventure'; next.combat = null;
    if (!spendYears(next, 2)) return next;
    if (next.story?.pendingCombat) next.story = resumeStoryCombat(next.story, 'flee', next.meta.worldYear);
    log(next, '撤出战局', `绕道两年摆脱追击，损失 ${lost} 灵石和至多 1 药材。`, 'combat');
    return next;
  }
  if (action === 'burn') {
    run.lifeDamage += 5;
    if (!checkLife(next)) return next;
  }
  const stats = getStats(next), lines = [];
  if (action === 'guard') {
    combat.focus = Math.min(2, combat.focus + 1);
    lines.push('你凝神守势，下一击蓄势增强。');
  } else {
    const raw = action === 'burn' ? stats.attack * 2 + stats.burnBonus : stats.attack;
    const damage = Math.max(1, Math.round(raw * (1 + combat.focus * 0.45)) - enemy.defense);
    combat.focus = 0; combat.enemyHp = Math.max(0, combat.enemyHp - damage);
    lines.push(`${action === 'burn' ? '燃去五年余寿，强攻' : '出手'}造成 ${damage} 伤害。`);
    if (combat.enemyHp <= 0) return winCombat(next);
  }
  const heavy = combat.round % 3 === 0;
  // Escalating pressure makes indefinite guarding impossible, even with exceptional defense.
  const rage = Math.floor((combat.round - 1) / 4) * 3;
  const incoming = Math.max(1, Math.round((enemy.attack + rage) * (heavy ? 1.65 : 1)) - stats.defense);
  const damage = action === 'guard' ? Math.max(1, Math.ceil(incoming * 0.32)) : incoming;
  run.hp = Math.max(0, run.hp - damage);
  lines.push(`${enemy.name}${heavy ? '施展强击' : '反击'}，你损失 ${damage} 气血。`);
  combat.round++; combat.log = [...combat.log, ...lines].slice(-100);
  log(next, `交锋 ${combat.round - 1}`, lines.join(''), 'combat');
  if (checkLife(next) && next.story?.pendingCombat && combat.round > 3) {
    const lost = Math.min(6, run.spirit); run.spirit -= lost;
    next.phase = 'adventure'; next.combat = null;
    next.story = resumeStoryCombat(next.story, 'retreat', next.meta.worldYear);
    next.story.lastResult.changes = [`损失${lost}灵石`, '证据原件保留'];
    log(next, next.story.lastResult.title, next.story.lastResult.text, 'event');
  }
  return next;
}
export function selectLegacy(state, legacyId) {
  if (!['ended', 'victory'].includes(state.phase)) fail('只有此生结束后才能择定传承。');
  if (state.summary.selectedLegacyId) fail('本世已经择定传承。');
  if (!state.summary.legacyOptions.includes(legacyId) || state.meta.legacyIds.includes(legacyId)) fail('此传承不在本世可选候选中。');
  const next = copy(state);
  next.meta.legacyIds.push(legacyId); next.summary.selectedLegacyId = legacyId;
  log(next, '传承留存', `将「${find(LEGACIES, legacyId).name}」留给后世。`, 'legacy');
  const history = next.meta.history.at(-1);
  history.selectedLegacyId = legacyId; history.log = historyLog(next);
  return next;
}

// Save files are untrusted input. Validate every persisted field before exposing it to UI or rules.
function invalid(path, detail) { fail(`存档无效：${path}${detail ? `（${detail}）` : ''}。请导入有效的第 1 或第 2 版备份。`); }
function object(value, path, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid(path, '应为对象');
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !keys.includes(key))) invalid(path, '字段缺失或包含未知字段');
}
function integer(value, path, min = 0, max = MAX_NUMBER) { if (!Number.isSafeInteger(value) || value < min || value > max) invalid(path, `应为 ${min}～${max} 的整数`); }
function string(value, path, max = 4096, min = 0) { if (typeof value !== 'string' || value.length < min || value.length > max) invalid(path, '文字长度或格式不正确'); }
function array(value, path, max, fn, distinct = false) {
  if (!Array.isArray(value) || value.length > max) invalid(path, '列表格式或长度不正确');
  value.forEach((entry, index) => fn(entry, `${path}[${index}]`));
  if (distinct && new Set(value).size !== value.length) invalid(path, '列表中存在重复项目');
}
function known(value, path, rows, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !rows.some(row => row.id === value)) invalid(path, '未知内容编号');
}
const validateStrings = (values, path, max = 50) => array(values, path, max, (value, itemPath) => string(value, itemPath, 200));
function validateLog(entries, path, max, worldYear, age) {
  array(entries, path, max, (entry, itemPath) => {
    object(entry, itemPath, ['id', 'year', 'age', 'title', 'text', 'kind']);
    integer(entry.id, `${itemPath}.id`, 1); integer(entry.year, `${itemPath}.year`, 1000, worldYear); integer(entry.age, `${itemPath}.age`, 16, age);
    string(entry.title, `${itemPath}.title`, 120, 1); string(entry.text, `${itemPath}.text`); string(entry.kind, `${itemPath}.kind`, 24, 1);
    if (!['action', 'ending', 'birth', 'milestone', 'event', 'failure', 'world', 'combat', 'legacy'].includes(entry.kind)) invalid(`${itemPath}.kind`, '未知日志类型');
  });
  for (let i = 1; i < entries.length; i++) if (entries[i].id <= entries[i - 1].id || entries[i].year < entries[i - 1].year || entries[i].age < entries[i - 1].age) invalid(path, '日志顺序错误');
}
function validateMeta(meta, version = 2) {
  object(meta, 'meta', ['generation', 'worldYear', 'legacyIds', 'proofs', 'worldFlags', 'history', 'victories', ...(version === 2 ? ['storyWorld'] : [])]);
  integer(meta.generation, 'meta.generation', 1);
  integer(meta.worldYear, 'meta.worldYear', 1000);
  integer(meta.victories, 'meta.victories', 0, meta.generation);
  array(meta.legacyIds, 'meta.legacyIds', LEGACIES.length, (id, path) => known(id, path, LEGACIES), true);
  array(meta.proofs, 'meta.proofs', 3, (id, path) => { if (!['mortal', 'nether', 'celestial'].includes(id)) invalid(path, '未知道证'); }, true);
  array(meta.worldFlags, 'meta.worldFlags', Object.keys(WORLD_FLAGS).length, (id, path) => { if (!Object.hasOwn(WORLD_FLAGS, id)) invalid(path, '未知世界因果'); }, true);
  array(meta.history, 'meta.history', 50, (entry, path) => {
    object(entry, path, ['generation', 'name', 'age', 'realmIndex', 'cause', 'deeds', 'log', 'selectedLegacyId']);
    integer(entry.generation, `${path}.generation`, 1, meta.generation);
    string(entry.name, `${path}.name`, 24, 1); integer(entry.age, `${path}.age`, 16);
    integer(entry.realmIndex, `${path}.realmIndex`, 0, REALMS.length - 1);
    if (!['lifespan', 'battle', 'retired', 'victory'].includes(entry.cause)) invalid(`${path}.cause`, '未知结局');
    validateStrings(entry.deeds, `${path}.deeds`);
    validateLog(entry.log, `${path}.log`, 40, meta.worldYear, entry.age);
    known(entry.selectedLegacyId, `${path}.selectedLegacyId`, LEGACIES, true);
    if (entry.selectedLegacyId && !meta.legacyIds.includes(entry.selectedLegacyId)) invalid(`${path}.selectedLegacyId`, '此传承尚未解锁');
  });
  for (let i = 1; i < meta.history.length; i++) if (meta.history[i].generation <= meta.history[i - 1].generation) invalid('meta.history', '轮回序号须递增');
  if (version === 2) validateStoryWorld(meta.storyWorld, meta, { object, integer, string, array, invalid });
}
function localFlagIds() {
  const ids = [];
  for (const event of EVENTS) {
    ids.push(event.requires?.flag, event.requires?.notFlag);
    for (const choice of event.choices) ids.push(choice.requires?.flag, choice.requires?.notFlag, choice.effects?.flag, choice.failure?.effects?.flag);
  }
  for (const legacy of LEGACIES) ids.push(legacy.effects.flag);
  return unique(ids.filter(Boolean));
}
function validateState(state, version = 2) {
  object(state, '根对象', ['version', 'rng', 'phase', 'run', 'meta', 'eventId', 'combat', 'summary', 'lastMessage', ...(version === 2 ? ['story'] : [])]);
  if (state.version !== version) invalid('version', '不兼容的存档版本');
  integer(state.rng, 'rng', 1, 4294967295);
  if (!['adventure', 'event', 'combat', 'ended', 'victory'].includes(state.phase)) invalid('phase', '未知阶段');
  string(state.lastMessage, 'lastMessage'); validateMeta(state.meta, version);
  const r = state.run;
  object(r, 'run', ['name', 'originId', 'pathId', 'age', 'realmIndex', 'worldId', 'cultivation', 'hp', 'spirit', 'herbs', 'merit', 'renown', 'lifeBonus', 'lifeDamage', 'elixirsUsed', 'turn', 'attackBonus', 'defenseBonus', 'hpBonus', 'breakthroughFailures', 'items', 'loadout', 'flags', 'visitedEvents', 'legacyCandidates', 'selectedLegacies', 'deeds', 'log']);
  string(r.name, 'run.name', 24, 1);
  if (!r.name.trim()) invalid('run.name', '道号不可为空白');
  known(r.originId, 'run.originId', ORIGINS); known(r.pathId, 'run.pathId', PATHS); known(r.worldId, 'run.worldId', WORLDS);
  integer(r.age, 'run.age', 16); integer(r.realmIndex, 'run.realmIndex', 0, REALMS.length - 1);
  for (const key of ['cultivation', 'hp', 'spirit', 'herbs', 'merit', 'renown', 'lifeBonus', 'lifeDamage', 'turn', 'attackBonus', 'defenseBonus', 'hpBonus', 'breakthroughFailures']) integer(r[key], `run.${key}`);
  integer(r.elixirsUsed, 'run.elixirsUsed', 0, 2);
  if (r.lifeBonus > r.elixirsUsed * 2 * Math.max(...REALMS.slice(0, r.realmIndex + 1).map(realm => realm.trainYears))) invalid('run.lifeBonus', '延寿收益超过本世丹药上限');
  if (r.realmIndex < find(WORLDS, r.worldId).minRealm) invalid('run.worldId', '当前境界不能位于此界');
  array(r.items, 'run.items', ITEMS.length, (id, path) => known(id, path, ITEMS), true);
  object(r.loadout, 'run.loadout', ['art', 'skills', 'artifact']);
  for (const kind of ['art', 'artifact']) {
    known(r.loadout[kind], `run.loadout.${kind}`, ITEMS, true);
    if (r.loadout[kind] && (!r.items.includes(r.loadout[kind]) || find(ITEMS, r.loadout[kind]).kind !== kind)) invalid(`run.loadout.${kind}`, '未拥有或类型不符');
  }
  array(r.loadout.skills, 'run.loadout.skills', 2, (id, path) => {
    known(id, path, ITEMS);
    if (!r.items.includes(id) || find(ITEMS, id).kind !== 'skill') invalid(path, '未拥有或不是神通');
  }, true);
  const localFlags = localFlagIds();
  array(r.flags, 'run.flags', localFlags.length, (id, path) => { if (!localFlags.includes(id)) invalid(path, '未知当世标记'); }, true);
  array(r.visitedEvents, 'run.visitedEvents', EVENTS.length, (id, path) => known(id, path, EVENTS), true);
  array(r.legacyCandidates, 'run.legacyCandidates', LEGACIES.length, (id, path) => known(id, path, LEGACIES), true);
  array(r.selectedLegacies, 'run.selectedLegacies', 2, (id, path) => {
    known(id, path, LEGACIES);
    if (!state.meta.legacyIds.includes(id)) invalid(path, '未解锁的携带传承');
  }, true);
  validateStrings(r.deeds, 'run.deeds');
  validateLog(r.log, 'run.log', 200, state.meta.worldYear, r.age);
  const stats = getStats(state);
  if (r.hp > stats.maxHp) invalid('run.hp', '气血超过上限');
  const terminal = ['ended', 'victory'].includes(state.phase);
  if (!terminal && (r.hp === 0 || stats.remainingLife <= 0)) invalid('phase', '已耗尽气血或余寿，不能继续行动');
  if (state.phase === 'event') {
    known(state.eventId, 'eventId', EVENTS);
    const event = find(EVENTS, state.eventId);
    if (!r.visitedEvents.includes(event.id) || event.worldId !== r.worldId || !meets(state, event.requires)) invalid('eventId', '际遇与当前人物不一致');
  } else if (state.eventId !== null) invalid('eventId', '非际遇阶段必须为空');
  if (state.phase === 'combat') {
    const combat = state.combat;
    object(combat, 'combat', ['enemyId', 'enemyHp', 'enemyMaxHp', 'round', 'focus', 'challengeId', 'log']);
    known(combat.enemyId, 'combat.enemyId', ENEMIES);
    if (version === 1 && combat.enemyId === 'valley-sentinel') invalid('combat.enemyId', '第1版没有剧情战斗');
    const enemy = find(ENEMIES, combat.enemyId);
    integer(combat.enemyMaxHp, 'combat.enemyMaxHp', enemy.hp, enemy.hp); integer(combat.enemyHp, 'combat.enemyHp', 1, enemy.hp);
    integer(combat.round, 'combat.round', 1); integer(combat.focus, 'combat.focus', 0, 2);
    array(combat.log, 'combat.log', 100, (line, path) => string(line, path, 1000));
    known(combat.challengeId, 'combat.challengeId', CHALLENGES, true);
    if (enemy.worldId !== r.worldId) invalid('combat.enemyId', '敌人与世界不一致');
    if (combat.challengeId) {
      const challenge = find(CHALLENGES, combat.challengeId);
      if (challenge.enemyId !== enemy.id || challenge.worldId !== r.worldId || challenge.minRealm > r.realmIndex || (challenge.proofId && state.meta.proofs.includes(challenge.proofId)) || (challenge.final && state.meta.proofs.length !== 3)) invalid('combat.challengeId', '挑战条件不一致');
    } else if (CHALLENGES.some(challenge => challenge.enemyId === enemy.id)) invalid('combat.enemyId', '首领缺少挑战记录');
  } else if (state.combat !== null) invalid('combat', '非战斗阶段必须为空');
  if (terminal) {
    const summary = state.summary;
    object(summary, 'summary', ['cause', 'title', 'text', 'age', 'realmIndex', 'legacyOptions', 'selectedLegacyId', 'deeds', 'worldChanges']);
    if (!['lifespan', 'battle', 'retired', 'victory'].includes(summary.cause)) invalid('summary.cause', '未知结局');
    if ((state.phase === 'victory') !== (summary.cause === 'victory')) invalid('summary.cause', '结局阶段不一致');
    if (summary.cause === 'lifespan' && stats.remainingLife > 0) invalid('summary.cause', '寿元尚未耗尽');
    if (summary.cause === 'battle' && r.hp > 0) invalid('summary.cause', '气血尚未耗尽');
    if (summary.cause === 'victory' && (r.realmIndex !== 5 || state.meta.proofs.length !== 3 || state.meta.victories < 1)) invalid('summary.cause', '通关条件不一致');
    string(summary.title, 'summary.title', 120, 1); string(summary.text, 'summary.text');
    integer(summary.age, 'summary.age', r.age, r.age); integer(summary.realmIndex, 'summary.realmIndex', r.realmIndex, r.realmIndex);
    array(summary.legacyOptions, 'summary.legacyOptions', LEGACIES.length, (id, path) => {
      known(id, path, LEGACIES);
      if (!r.legacyCandidates.includes(id) || (state.meta.legacyIds.includes(id) && summary.selectedLegacyId !== id)) invalid(path, '不是本世新候选');
    }, true);
    known(summary.selectedLegacyId, 'summary.selectedLegacyId', LEGACIES, true);
    if (summary.selectedLegacyId && (!summary.legacyOptions.includes(summary.selectedLegacyId) || !state.meta.legacyIds.includes(summary.selectedLegacyId))) invalid('summary.selectedLegacyId', '未在本世选定解锁');
    validateStrings(summary.deeds, 'summary.deeds'); validateStrings(summary.worldChanges, 'summary.worldChanges', 200);
    const expectedOptions = r.legacyCandidates.filter(id => !state.meta.legacyIds.includes(id) || summary.selectedLegacyId === id);
    if (expectedOptions.length !== summary.legacyOptions.length || expectedOptions.some(id => !summary.legacyOptions.includes(id))) invalid('summary.legacyOptions', '候选传承与当世经历不一致');
    if (JSON.stringify(summary.deeds) !== JSON.stringify(r.deeds)) invalid('summary.deeds', '本世功业不一致');
    const history = state.meta.history.at(-1);
    if (!history || history.generation !== state.meta.generation || history.name !== r.name || history.age !== r.age || history.realmIndex !== r.realmIndex || history.cause !== summary.cause || history.selectedLegacyId !== summary.selectedLegacyId || JSON.stringify(history.deeds) !== JSON.stringify(r.deeds)) invalid('meta.history', '缺少本世结算');
  } else {
    if (state.summary !== null) invalid('summary', '未结算时必须为空');
    if (state.meta.history.at(-1)?.generation === state.meta.generation) invalid('meta.history', '当世尚未结算');
  }
  if (version === 1 && [
    ...state.meta.legacyIds, ...r.legacyCandidates, ...r.selectedLegacies,
    ...state.meta.history.map(entry => entry.selectedLegacyId),
    ...(state.summary?.legacyOptions ?? []), state.summary?.selectedLegacyId,
  ].includes('plain-medicine')) invalid('legacy', '第1版没有朴药手记');
  if (version === 2) validateStory(state.story, state, { object, integer, string, array, invalid });
  return state;
}
export function serialize(state) { validateState(state); return JSON.stringify(state); }
export function deserialize(raw) {
  if (typeof raw !== 'string' || raw.length > 1000000) invalid('文件', '存档应为不超过 1MB 的文字');
  let state;
  try { state = JSON.parse(raw); } catch { invalid('JSON', '无法读取存档文字'); }
  // Early v1 backups only retained life summaries. Fill missing fields without
  // inventing past events or replacing malformed fields that must be rejected.
  if (state?.version === 1 && Array.isArray(state.meta?.history)) {
    for (const entry of state.meta.history) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      if (!Object.hasOwn(entry, 'log')) entry.log = [];
      if (!Object.hasOwn(entry, 'selectedLegacyId')) {
        const currentEnding = entry.generation === state.meta.generation && ['ended', 'victory'].includes(state.phase);
        entry.selectedLegacyId = currentEnding ? state.summary?.selectedLegacyId ?? null : null;
      }
    }
  }
  if (state?.version === 1) {
    validateState(state, 1);
    state.version = 2; state.story = null; state.meta.storyWorld = createStoryWorld(state.meta);
    state.meta.storyWorld = ageStoryWorld(state.meta.storyWorld, state.meta.worldYear);
  }
  return validateState(state);
}
