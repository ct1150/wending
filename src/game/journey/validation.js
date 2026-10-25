import { deserialize as deserializeLegacy } from '../engine.js';
import { JOURNEY_CHAPTERS, JOURNEY_ABILITIES, JOURNEY_LEGACIES, JOURNEY_ITEMS, JOURNEY_REALMS, JOURNEY_PROOFS, resolveJourneyScene } from './content.js';

const fail = message => { throw new Error(`旅程存档：${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
const text = (value, limit = 2000) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const identifier = value => text(value, 100) && /^[a-z][a-z0-9-]*$/.test(value);
const outcomeIdentifier = value => text(value, 100) && /^[a-z][a-z0-9_-]*$/.test(value);
const factValue = value => typeof value === 'boolean' || text(value, 200) || (typeof value === 'number' && Number.isFinite(value));
const injuries = ['well', 'hurt', 'severe'];
const statuses = ['safe', 'critical', 'mobile', 'testifying', 'dependent', 'dead'];
const blockKinds = ['narration', 'dialogue', 'action', 'result'];
function stringArray(value, label, allowed = null, max = 1000) {
  if (!Array.isArray(value) || value.length > max || value.some(id => !identifier(id) || (allowed && !Object.hasOwn(allowed, id))) || new Set(value).size !== value.length) fail(`${label}列表无效或重复。`);
}
function facts(value, label) {
  if (!object(value) || Object.entries(value).some(([id, fact]) => !identifier(id) || !factValue(fact))) fail(`${label}事实无效。`);
}
function inventory(value, costs = false) {
  if (!object(value) || Object.entries(value).some(([id, count]) => !Object.hasOwn(JOURNEY_ITEMS, id) || !integer(count) || (costs && count === 0))) fail('物品数量或引用无效。');
}
function opportunityTable(chapters) {
  const entries = Object.values(chapters).flatMap(chapter => chapter.opportunities ?? []);
  return Object.fromEntries(entries.map(row => [row.id, row]));
}
function validateConditions(conditions, opportunities) {
  if (!Array.isArray(conditions)) fail('故事条件必须为列表。');
  for (const condition of conditions) {
    if (!object(condition)) fail('无法解析的故事条件。');
    const { kind, id } = condition;
    const fields = {
      proof: ['kind', 'id', 'held'], ability: ['kind', 'id'], item: ['kind', 'id', 'min'], person: ['kind', 'id', 'status'],
      'life-fact': ['kind', 'id', 'value'], 'world-fact': ['kind', 'id', 'value'],
      opportunity: ['kind', 'id'], 'injury-not': ['kind', 'value'], 'remaining-life': ['kind', 'min'],
    };
    if (!Object.hasOwn(fields, kind) || Object.keys(condition).some(key => !fields[kind].includes(key))) fail(`故事条件含未知字段：${kind}`);
    const checks = {
      proof: () => JOURNEY_PROOFS.includes(id) && (condition.held === undefined || typeof condition.held === 'boolean'),
      ability: () => Object.hasOwn(JOURNEY_ABILITIES, id),
      item: () => Object.hasOwn(JOURNEY_ITEMS, id) && (condition.min === undefined || (integer(condition.min) && condition.min > 0)),
      person: () => identifier(id) && statuses.includes(condition.status),
      'life-fact': () => identifier(id) && factValue(condition.value),
      'world-fact': () => identifier(id) && factValue(condition.value),
      opportunity: () => Object.hasOwn(opportunities, id),
      'injury-not': () => injuries.includes(condition.value),
      'remaining-life': () => integer(condition.min),
    };
    if (!Object.hasOwn(checks, kind) || !checks[kind]()) fail(`无法解析的故事条件：${kind} / ${id ?? ''}`);
  }
}
function validateBlocks(blocks, saved = false) {
  if (!Array.isArray(blocks)) fail('正文记录必须是列表。');
  for (const block of blocks) {
    if (!object(block) || !blockKinds.includes(block.kind) || !text(block.text) || (block.speaker !== undefined && !text(block.speaker, 100))) fail('正文记录无效。');
    if (saved && (!identifier(block.id) || !identifier(block.sceneId))) fail('正文记录 ID 或场景无效。');
  }
}

export function validateJourneyContent(chapters = JOURNEY_CHAPTERS) {
  if (!object(chapters) || !Object.keys(chapters).length) fail('故事章节为空。');
  const nodes = {}, opportunities = opportunityTable(chapters);
  const allOpportunities = Object.values(chapters).flatMap(chapter => chapter.opportunities ?? []);
  if (Object.keys(opportunities).length !== allOpportunities.length) fail('故事机会 ID 重复。');
  for (const [chapterId, chapter] of Object.entries(chapters)) {
    if (!identifier(chapterId) || chapter.id !== chapterId || !object(chapter.scenes) || !Array.isArray(chapter.opportunities)) fail('故事章节结构无效。');
    for (const row of chapter.opportunities) {
      if (!identifier(row.id) || !Object.hasOwn(JOURNEY_ABILITIES, row.abilityId)) fail('故事机会能力引用无效。');
      validateConditions(row.when, opportunities);
    }
    for (const [id, scene] of Object.entries(chapter.scenes)) {
      if (!identifier(id) || Object.hasOwn(nodes, id) || !object(scene) || !text(scene.title, 100)) fail('故事场景 ID、标题重复或无效。');
      nodes[id] = scene;
    }
  }
  for (const [id, scene] of Object.entries(nodes)) {
    if (!Array.isArray(scene.variants) || !scene.variants.length) fail(`场景缺少故事变体：${id}`);
    for (const variant of scene.variants) {
      validateConditions(variant.when, opportunities);
      validateBlocks(variant.blocks);
      if (!Array.isArray(variant.choices) || variant.choices.length > 3) fail(`同一场景变体不能超过三项行动：${id}`);
      if (!scene.terminal && !variant.choices.length) fail(`非结算场景没有出口：${id}`);
      if (scene.terminal && (!['ended', 'victory'].includes(scene.terminal) || variant.choices.length)) fail(`结算场景不应包含普通行动：${id}`);
      const ids = new Set();
      for (const choice of variant.choices) {
        if (!identifier(choice.id) || ids.has(choice.id) || !text(choice.label) || !text(choice.detail) || !text(choice.result)) fail(`行动 ID 或文本无效：${id}`);
        ids.add(choice.id);
        if (!Object.hasOwn(nodes, choice.to)) fail(`故事后继不存在：${choice.to}`);
        validateConditions(choice.requires ?? [], opportunities);
        if (choice.costs) {
          if (!object(choice.costs) || Object.keys(choice.costs).some(key => !['items', 'years', 'lifeDamage'].includes(key))) fail('行动成本结构无效。');
          if (choice.costs.items) inventory(choice.costs.items, true);
          for (const key of ['years', 'lifeDamage']) if (choice.costs[key] !== undefined && !integer(choice.costs[key])) fail('行动寿元或年限成本无效。');
        }
        if (choice.ending && (!['retired', 'burned'].includes(choice.ending) || !text(choice.endingTitle, 100) || nodes[choice.to].terminal !== 'ended')) fail('明确终场必须进入人生结算。');
        if (choice.victory && (choice.victory !== true || choice.ending || nodes[choice.to].terminal !== 'victory')) fail('问鼎必须进入真实胜利终场。');
        if (!choice.ending && !choice.victory && nodes[choice.to].terminal) fail('不能通过普通行动进入人生结算。');
        const effects = choice.effects ?? {};
        if (!object(effects) || Object.keys(effects).some(key => !['items', 'lifeFacts', 'worldFacts', 'people', 'injury', 'learn', 'settle', 'realm', 'proof'].includes(key))) fail('行动后果结构无效。');
        if (choice.ending && Object.keys(effects).length) fail('人生终场不能附送普通奖励。');
        if (effects.items) inventory(effects.items);
        if (effects.lifeFacts) facts(effects.lifeFacts, '当世');
        if (effects.worldFacts) facts(effects.worldFacts, '世界');
        if (effects.realm && !Object.hasOwn(JOURNEY_REALMS, effects.realm)) fail('行动境界引用无效。');
        if (effects.proof && !JOURNEY_PROOFS.includes(effects.proof)) fail('行动道证引用无效。');
        if (effects.injury && !injuries.includes(effects.injury)) fail('行动伤势无效。');
        if (effects.learn && !Object.hasOwn(JOURNEY_ABILITIES, effects.learn)) fail('行动能力引用无效。');
        if (effects.people && (!object(effects.people) || Object.entries(effects.people).some(([personId, status]) => !identifier(personId) || !statuses.includes(status)))) fail('行动人物后果无效。');
        if (effects.settle && (!object(effects.settle) || !identifier(effects.settle.episodeId) || !outcomeIdentifier(effects.settle.outcomeId))) fail('行动结算记录无效。');
      }
    }
  }
  for (const [id, scene] of Object.entries(nodes)) {
    if (scene.variants.at(-1).when.length !== 0) fail(`场景条件缺少明确的默认变体：${id}`);
  }
  // Every authored node must have a finite route to a local settlement. This
  // catches accidentally closed cycles as well as missing direct successors.
  const exits = new Set(Object.keys(nodes).filter(id => nodes[id].terminal));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, scene] of Object.entries(nodes)) {
      if (!exits.has(id) && scene.variants.every(variant => variant.choices.some(choice => exits.has(choice.to)))) { exits.add(id); changed = true; }
    }
  }
  if (exits.size !== Object.keys(nodes).length) fail('故事存在无法到达结算的场景出口。');
  return true;
}

// Reject contradictory imported causal records without pretending a save is a
// cryptographic event log. Historical testimony remains usable after a death;
// historical rescue does not promise that its survivor lives forever.
function validateMortalFacts(state) {
  const { world, life } = state, f = world.facts, items = life.items;
  const enums = {
    'valley-outcome': ['open_clinic', 'sect_estate', 'ash_refuge'],
    'seed-state': ['rooted', 'sect-custody', 'destroyed'],
    'seed-custodian': ['valley-households', 'guiheng', 'none'],
    'ledger-original': ['held', 'archive', 'traded', 'destroyed'],
    'ledger-evidence': ['full', 'partial', 'lost'],
    'channel-evidence': ['full', 'partial'],
    'witness-evidence': ['full', 'partial', 'none'],
    'witness-consent': ['named', 'anonymous', 'refused'],
    'survivor-line': ['seven-households-and-wen', 'seven-households-wen-family-hurt', 'seven-households-wen-lost'],
    'truth-pledge': ['pending', 'fulfilled', 'unfulfilled'],
    'evacuation-pledge': ['pending', 'fulfilled', 'unfulfilled'],
    'protect-pledge': ['pending', 'fulfilled', 'broken'],
    'estate-pledge': ['pending', 'fulfilled', 'broken'],
    'valley-handoff': ['recorded', 'uncertified'],
  };
  for (const [id, values] of Object.entries(enums)) if (Object.hasOwn(f, id) && !values.includes(f[id])) fail(`谷地事实取值无效：${id}`);
  const seedByOutcome = { open_clinic: ['rooted', 'valley-households'], sect_estate: ['sect-custody', 'guiheng'], ash_refuge: ['destroyed', 'none'] };
  if (f['valley-outcome']) {
    const [seed, custodian] = seedByOutcome[f['valley-outcome']];
    if (f['seed-state'] !== seed || f['seed-custodian'] !== custodian) fail('谷地结局与灵种存亡、归属矛盾。');
    const last = world.completedTasks.findLast(row => row.episodeId === 'mortal-valley');
    if (!last || last.outcomeId !== f['valley-outcome']) fail('谷地结局与完成记录矛盾。');
  }
  const page = items['ledger-page'] ?? 0;
  if (page > 1 || (page > 0 && f['ledger-original'] !== 'held') || (f['ledger-original'] === 'held' && page !== 1)) fail('原始账页持有与证物去向矛盾。');
  if ((page > 0 || (items['ledger-copy'] ?? 0) > 0) && f['ledger-evidence'] !== 'full') fail('账页与完整证物记录矛盾。');
  if ((items.testimony ?? 0) > 0 && (f['witness-evidence'] !== 'full' || f['witness-consent'] !== 'named')) fail('证物中的完整证言缺少实际授权。');
  if ((items['channel-map'] ?? 0) > 0 && f['channel-evidence'] !== 'full') fail('地脉图与证物记录矛盾。');
  if (f['survivor-line'] === 'seven-households-wen-lost' && world.people['wen-du']?.status !== 'dead') fail('幸存记录中的死者不能重新出现。');
  if (Object.hasOwn(life.facts, 'investigations-used')) {
    const count = life.facts['investigations-used'];
    const visited = ['witness', 'ledger', 'channel'].filter(id => life.facts[`visited-${id}`] === true).length;
    if (!Number.isInteger(count) || count < 0 || count > 2 || count !== visited) fail('调查次数与实际走过的路线矛盾。');
  }
}

function validateCampaignFacts(state) {
  const enums = {
    'dead-debt': ['frozen', 'corrected'],
    'nether-local-right': ['clinic-dates', 'estate-work', 'refuge-memorial'],
    'nether-verdict': ['accountable', 'limited', 'unresolved'],
    'nether-duty': ['source-custody', 'three-seasons'],
    'celestial-consent': ['clinic', 'estate', 'refuge', 'personal'],
    'local-supply': ['pending', 'none', 'minimum', 'substitute'],
    'celestial-terms': ['accepted', 'disputed'],
    'ding-method': ['evidence', 'shared'],
  };
  for (const [id, values] of Object.entries(enums)) {
    if (Object.hasOwn(state.world.facts, id) && !values.includes(state.world.facts[id])) fail(`三界事实取值无效：${id}`);
  }
  if (state.phase === 'victory' && (state.world.facts['celestial-terms'] !== 'accepted' || !['evidence', 'shared'].includes(state.world.facts['ding-method']) || state.life.facts['bounded-terms'] !== true || state.life.facts['copies-delivered'] !== true || state.life.facts['ding-established'] !== true)) fail('问鼎缺少当世真实的有限立约与副本交付。');
}

export function validateJourney(state) {
  if (!object(state) || state.version !== 3 || state.mode !== 'dialogue' || state.contentVersion !== 1) fail('不支持的旅程格式。');
  if (!integer(state.revision)) fail('revision 必须为非负整数。');
  if (!Number.isInteger(state.rng) || state.rng <= 0 || state.rng > 4294967295) fail('随机状态无效。');
  if (!['playing', 'ended', 'victory'].includes(state.phase)) fail('人生阶段无效。');
  const { world, life, scene } = state;
  if (!object(world) || !integer(world.year) || !integer(world.generation) || world.generation < 1) fail('世界年份或世代无效。');
  facts(world.facts, '世界');
  if (!object(world.people) || Object.entries(world.people).some(([id, person]) => !identifier(id) || !object(person) || !statuses.includes(person.status))) fail('世界人物状态无效。');
  for (const [id, person] of Object.entries(world.people)) {
    const span={ 'shen-zhi':86, 'lu-huai':160, 'wen-du':90 }[id];
    if (person.birthYear !== undefined && (!integer(person.birthYear) || person.birthYear > world.year)) fail('人物出生年代无效。');
    if (person.deathYear !== undefined && person.deathYear !== null && (!integer(person.deathYear) || person.deathYear > world.year || person.deathYear < (person.birthYear ?? 0) || person.status !== 'dead')) fail('人物死亡年代与状态矛盾。');
    if (span && person.birthYear !== undefined && world.year >= person.birthYear + span && person.status !== 'dead') fail('已到寿限的人物不能复生。');
  }
  if (world.legacyArchive !== undefined) {
    try { const old=deserializeLegacy(JSON.stringify(world.legacyArchive)); if(!['ended','victory'].includes(old.phase) || old.meta.generation >= world.generation) fail('旧人生档案尚未结算。'); }
    catch { fail('旧人生原始档案无效。'); }
  }
  stringArray(world.proofs, '道证', Object.fromEntries(JOURNEY_PROOFS.map(id => [id, true])));
  stringArray(world.legacies, '累计传承', JOURNEY_LEGACIES);
  if (!Array.isArray(world.completedTasks)) fail('任务完成记录无效。');
  let sequence = 0;
  const episodes = new Set();
  for (const record of world.completedTasks) {
    if (!object(record) || !identifier(record.episodeId) || !outcomeIdentifier(record.outcomeId) || !integer(record.generation) || record.generation < 1 || record.generation > world.generation || !integer(record.sequence) || record.sequence <= sequence) fail('任务结算记录或 sequence 无效。');
    const key = record.episodeId;
    if (episodes.has(key)) fail('已经完成的任务记录重复。');
    episodes.add(key); sequence = record.sequence;
  }
  if (!Array.isArray(world.biography) || world.biography.some(row => !object(row) || !text(row.name, 24) || !integer(row.age) || !integer(row.generation) || row.generation < 1 || row.generation > world.generation || !text(row.cause, 100))) fail('生平结算记录无效。');
  let biographyGeneration = 0;
  for (const row of world.biography) {
    if (row.generation <= biographyGeneration) fail('生平记录世代重复或顺序无效。');
    biographyGeneration = row.generation;
    if (row.transcript !== undefined) validateBlocks(row.transcript,true);
  }
  if (!object(life) || !text(life.name, 24) || !integer(life.age) || !integer(life.lifeLimit) || life.lifeLimit < 1 || !integer(life.lifeDamage) || life.age + life.lifeDamage > life.lifeLimit || !Object.hasOwn(JOURNEY_REALMS, life.realm)) fail('人生年龄、寿限或境界无效。');
  if (!injuries.includes(life.injury)) fail('伤势必须为 well、hurt 或 severe。');
  stringArray(life.abilities, '能力', JOURNEY_ABILITIES, 3);
  stringArray(life.learnedOpportunities, '已学习机会', opportunityTable(JOURNEY_CHAPTERS), 3);
  if (life.learnedOpportunities.length !== life.abilities.length) fail('能力与实际学习记录不一致。');
  if (life.legacyId !== null && (!Object.hasOwn(JOURNEY_LEGACIES, life.legacyId) || !world.legacies.includes(life.legacyId))) fail('当前传承尚未取得。');
  inventory(life.items); facts(life.facts, '当世');
  if (!object(scene) || !Object.hasOwn(JOURNEY_CHAPTERS, scene.chapterId) || !Object.hasOwn(JOURNEY_CHAPTERS[scene.chapterId].scenes, scene.nodeId) || !object(scene.opportunities)) fail('当前场景引用无效。');
  for (const [chapterId, opportunityId] of Object.entries(scene.opportunities)) {
    if (!JOURNEY_CHAPTERS[chapterId]?.opportunities.some(row => row.id === opportunityId)) fail('已保存的故事机会引用无效。');
  }
  for (const id of life.learnedOpportunities) {
    const opportunity = opportunityTable(JOURNEY_CHAPTERS)[id];
    if (!Object.values(scene.opportunities).includes(id) || !life.abilities.includes(opportunity.abilityId)) fail('能力并非来自已选定的学习机会。');
  }
  validateMortalFacts(state);
  validateCampaignFacts(state);
  const resolved = resolveJourneyScene(state);
  if (resolved.selectOpportunity && !Object.hasOwn(scene.opportunities, scene.chapterId)) fail('当前学习场景缺少已选定的机会。');
  if (state.phase === 'playing' && (resolved.terminal || life.age + life.lifeDamage >= life.lifeLimit || state.summary !== null)) fail('当前人生阶段与生命或结算场景不一致。');
  if (state.phase === 'ended' && (resolved.terminal !== 'ended' || !object(state.summary) || !['retired', 'burned'].includes(state.summary.cause) || life.age + life.lifeDamage !== life.lifeLimit || !world.biography.some(row => row.generation === world.generation))) fail('人生结算不完整。');
  if (state.phase === 'ended') {
    const summary = state.summary, biography = world.biography.at(-1);
    if (summary.age !== life.age || summary.generation !== world.generation || !text(summary.title, 100) || summary.outcomeId !== (world.completedTasks.at(-1)?.outcomeId ?? null) || biography.generation !== world.generation || biography.age !== life.age || biography.name !== life.name || biography.cause !== summary.cause || biography.outcomeId !== summary.outcomeId || biography.title !== summary.title) fail('生平与人生结算记录不一致。');
  } else if (world.biography.some(row => row.generation === world.generation)) fail('尚未结束的当世不能已有生平结算。');
  // Victory remains an alive summary, not an ended-life biography. It must
  // retain the actual completed campaign and current bounded agreement.
  if (state.phase === 'victory' && (resolved.terminal !== 'victory' || !object(state.summary) || state.summary.cause !== 'victory' || state.summary.generation !== world.generation || state.summary.age !== life.age || state.summary.outcomeId !== 'bounded-victory' || !text(state.summary.title, 100) || life.age + life.lifeDamage >= life.lifeLimit || !JOURNEY_PROOFS.every(id => world.proofs.includes(id)) || world.facts['ding-complete'] !== true || !world.completedTasks.some(row => row.episodeId === 'three-world-ding' && row.generation === world.generation))) fail('问鼎结算缺少真实三界经历或有效生命。');
  if (life.facts['transcript-start'] !== undefined && (!integer(life.facts['transcript-start']) || !Array.isArray(state.transcript) || life.facts['transcript-start'] >= state.transcript.length)) fail('当世行文起点超出实际记录。');
  validateBlocks(state.transcript, true);
  if (!state.transcript.length || new Set(state.transcript.map(row => row.id)).size !== state.transcript.length || state.transcript.some(row => !Object.values(JOURNEY_CHAPTERS).some(chapter => Object.hasOwn(chapter.scenes, row.sceneId)))) fail('正文记录场景或 ID 无效。');
  return state;
}
