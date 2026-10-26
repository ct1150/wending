import { assertSaveSize, MAX_SAVE_CHARACTERS } from '../save-size.js';
import { ITEMS, SKILLS, REALMS, NODES } from './content.js';
import { BIRTH_ATTRIBUTES, BIRTH_TALENTS, validCultivationName } from './model.js';

const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
const summaryFields = ['cause', 'title', 'generation', 'age', 'realm', 'achievement', 'lesson'];
const biographyFields = [...summaryFields, 'name', 'year', 'legacyId', 'skills', 'deeds'];
const blockKinds = ['narration', 'dialogue', 'action', 'result'];
const endingCauses = ['battle', 'lifespan', 'retired'];
const skillIds = Object.keys(SKILLS);
const nodeIds = new Set(NODES);

function fail(message) {
  const error = new Error('求仙存档：' + message);
  error.code = 'INVALID_CULTIVATION_SAVE';
  throw error;
}

const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value, min = 0, max = MAX_SAVE_CHARACTERS) => typeof value === 'string' && value.length >= min && value.length <= max;
const known = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);

// Inspect descriptors before reading values. A save must have the same meaning
// after JSON export, without executing accessors or serialization hooks.
function record(value, label, required = null, optional = []) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(label + '必须是普通记录。');
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== 'string' || forbiddenKeys.has(key)) fail(label + '含有不安全的字段。');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(label + '含有无法完整保存的字段。');
    if (required && !required.includes(key) && !optional.includes(key)) fail(label + '含有未知字段。');
  }
  if (required?.some(key => !Object.hasOwn(value, key))) fail(label + '缺少必要字段。');
  return keys;
}

function list(value, label, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) fail(label + '列表无效或超过数量上限。');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail(label + '列表含有无法保存的额外字段或空位。');
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(label + '列表含有无法保存的空位或读取方法。');
  }
}

function skills(value, label) {
  list(value, label, skillIds.length);
  if (value.some(id => !known(SKILLS, id)) || new Set(value).size !== value.length) fail(label + '含有未知或重复法门。');
}

function facts(value, label) {
  const keys = record(value, label);
  if (keys.length > 200) fail(label + '最多保留二百项事实。');
  for (const key of keys) {
    const fact = value[key];
    const primitive = fact === null || typeof fact === 'boolean' || (typeof fact === 'number' && Number.isFinite(fact)) || text(fact, 0, 200);
    if (!text(key, 1, 80) || !primitive) fail(label + '的标记或取值无效。');
  }
}

function legacy(id, heldSkills, worldLegacies, label) {
  if (id !== null && (!known(SKILLS, id) || !heldSkills.includes(id) || !worldLegacies.includes(id))) fail(label + '传承没有对应的已得法门。');
}

function summary(value, label, generation) {
  if (!endingCauses.includes(value.cause) || !text(value.title, 1) || !integer(value.generation, 1, generation) || !integer(value.age) || !known(REALMS, value.realm) || !text(value.achievement) || !text(value.lesson)) fail(label + '的缘由、年龄、境界或文字无效。');
}

function validateBiography(world) {
  list(world.biography, '生平', 300);
  let previousGeneration = 0, previousYear = 0;
  const currentYear = Math.floor(world.day / 360);
  for (const row of world.biography) {
    record(row, '生平记录', biographyFields);
    summary(row, '生平记录', world.generation);
    if (!text(row.name, 1) || !integer(row.year, previousYear, currentYear) || row.generation <= previousGeneration) fail('生平的姓名、年份或世代顺序无效。');
    skills(row.skills, '生平法门');
    legacy(row.legacyId, row.skills, world.legacies, '生平');
    list(row.deeds, '生平事迹', 8);
    if (row.deeds.some(deed => !text(deed, 0, 200))) fail('生平事迹必须是至多二百字的文字。');
    previousGeneration = row.generation;
    previousYear = row.year;
  }
}

function validateTranscript(transcript) {
  list(transcript, '正文', 30000);
  for (let index = 0; index < transcript.length; index++) {
    const block = transcript[index];
    record(block, '正文段落', ['id', 'sceneId', 'kind', 'text'], ['speaker', 'choiceId']);
    if (block.id !== 'cultivation-' + (index + 1)) fail('正文段落编号必须与记录顺序一致。');
    if (!nodeIds.has(block.sceneId) || !blockKinds.includes(block.kind) || !text(block.text, 1)) fail('正文段落的场景、种类或文字无效。');
    if (Object.hasOwn(block, 'speaker') && !text(block.speaker, 1)) fail('对话人物姓名无效。');
    if (Object.hasOwn(block, 'choiceId') && !text(block.choiceId, 1, 100)) fail('正文中的行动编号无效。');
  }
}

function validateBirth(birth) {
  record(birth, '先天资质', ['attributes', 'talentId', 'rollCount']);
  const attributes = record(birth.attributes, '先天属性', Object.keys(BIRTH_ATTRIBUTES));
  if (attributes.some(id => !integer(birth.attributes[id], 1, 6)) || !known(BIRTH_TALENTS, birth.talentId) || !integer(birth.rollCount, 1)) fail('先天属性、天赋或掷骰次数无效。');
}

function validateCreation(state) {
  const { life, world, scene } = state;
  if (scene.nodeId !== 'arrival' || scene.visited.length || life.ageDays !== 16 * 360 || life.startDay !== world.day || life.realm !== 'mortal' || life.cultivation !== 0 || life.injury !== 0 || life.lifeDamageDays !== 0 || state.summary !== null) fail('尚未入世的身体、时间或场景已经发生变化。');
  if (Object.keys(life.items).length !== 2 || life.items.medicine !== 1 || life.items.stones !== 0) fail('尚未入世时不能提前领取行装。');
  const inherited = life.legacyId === null ? [] : [life.legacyId];
  if (life.skills.length !== inherited.length || inherited.some(id => !life.skills.includes(id))) fail('尚未入世时只能记住已选的前世法门。');
  if (Object.keys(life.facts).some(key => key !== 'transcript-start') || (life.facts['transcript-start'] ?? 0) !== state.transcript.length) fail('尚未入世时不能已有当世经历或正文。');
  if (world.generation === 1 && state.transcript.length !== 0) fail('第一世入世之前不能已有前世正文。');
  if (world.biography.at(-1)?.generation === world.generation) fail('尚未入世的人生不能已有结算。');
}

export function validateCultivation(state) {
  record(state, '修行记录', ['version', 'mode', 'contentVersion', 'revision', 'rng', 'phase', 'world', 'life', 'scene', 'transcript', 'summary']);
  if (state.version !== 4 || state.mode !== 'cultivation' || ![1, 2].includes(state.contentVersion)) fail('不支持的格式，请使用第四版人间求仙篇存档。');
  if (!integer(state.revision) || !integer(state.rng, 1, 4294967295)) fail('记录修订数或随机状态无效。');
  if (!(state.contentVersion === 2 ? ['creating', 'playing', 'ended'] : ['playing', 'ended']).includes(state.phase)) fail('人生阶段无效。');

  const { world, life, scene } = state;
  record(world, '世界', ['day', 'generation', 'facts', 'legacies', 'biography']);
  if (!integer(world.day) || !integer(world.generation, 1)) fail('世界日期或世代无效。');
  facts(world.facts, '世界事实');
  skills(world.legacies, '累计传承');
  validateBiography(world);

  record(life, '当世', ['name', 'ageDays', 'lifeLimit', 'lifeDamageDays', 'realm', 'cultivation', 'injury', 'skills', 'items', 'legacyId', 'facts', 'startDay', ...(state.contentVersion === 2 ? ['birth'] : [])]);
  if (!text(life.name, 1) || !integer(life.ageDays, 16 * 360) || !known(REALMS, life.realm) || life.lifeLimit !== REALMS[life.realm].lifeLimit) fail('当世姓名、年龄、境界或寿限无效。');
  if (state.contentVersion === 2) {
    if (!validCultivationName(life.name)) fail('当世姓名须为1至24字，且不能含有首尾空白、控制符或换行。');
    validateBirth(life.birth);
  }
  if (!integer(life.lifeDamageDays, 0, life.lifeLimit * 360) || !integer(life.cultivation, 0, 6) || !integer(life.injury, 0, 3)) fail('寿元折损、修为或伤势超出范围。');
  if (!integer(life.startDay, 0, world.day) || life.ageDays !== 16 * 360 + (world.day - life.startDay)) fail('当世年龄与实际经过的世界日期不一致。');
  skills(life.skills, '当世法门');
  legacy(life.legacyId, life.skills, world.legacies, '当世');
  for (const id of record(life.items, '随身物品')) {
    if (!known(ITEMS, id) || !integer(life.items[id], 0, 9999)) fail('随身物品名称或数量无效。');
  }
  facts(life.facts, '当世事实');
  for (const key of Object.keys(life.facts)) {
    if (/^deed-\d+$/.test(key) && (!/^deed-[1-8]$/.test(key) || !text(life.facts[key], 0, 200))) fail('当世事迹编号或文字无效。');
  }

  record(scene, '当前场景', ['nodeId', 'fate', 'visited']);
  if (!nodeIds.has(scene.nodeId)) fail('当前场景不存在。');
  record(scene.fate, '当世机缘', ['opening', 'opportunity', 'pressure']);
  if (!['valley', 'market', 'ferry'].includes(scene.fate.opening) || !['marsh', 'ruins', 'caravan'].includes(scene.fate.opportunity) || !['rival', 'scarcity', 'storm'].includes(scene.fate.pressure)) fail('当世机缘或开场无效。');
  list(scene.visited, '已到场景', 300);
  if (scene.visited.some(id => !nodeIds.has(id))) fail('已到场景中有未知地点。');

  validateTranscript(state.transcript);
  if (Object.hasOwn(life.facts, 'transcript-start') && !integer(life.facts['transcript-start'], 0, state.transcript.length)) fail('当世正文起点超出实际记录。');
  if (state.contentVersion === 2 && state.phase !== 'creating') {
    const opening = state.transcript[life.facts['transcript-start'] ?? 0];
    if (scene.visited[0] !== 'arrival' || opening?.sceneId !== 'arrival') fail('已经入世的人生缺少当世开场记录。');
  }

  const lastLife = world.biography.at(-1);
  const exhausted = life.ageDays >= life.lifeLimit * 360 - life.lifeDamageDays;
  if (state.phase === 'creating') {
    validateCreation(state);
  } else if (state.phase === 'playing') {
    if (scene.nodeId === 'ended' || exhausted || state.summary !== null || lastLife?.generation === world.generation) fail('尚在进行的人生与余寿、结算或生平记录不一致。');
  } else {
    record(state.summary, '人生结算', summaryFields);
    summary(state.summary, '人生结算', world.generation);
    if (scene.nodeId !== 'ended' || state.summary.generation !== world.generation || state.summary.age !== Math.floor(life.ageDays / 360) || state.summary.realm !== life.realm || (state.summary.cause === 'lifespan' && !exhausted)) fail('人生结算与场景、年龄、境界或余寿不一致。');
    if (!lastLife || summaryFields.some(key => lastLife[key] !== state.summary[key]) || lastLife.name !== life.name || lastLife.year !== Math.floor(world.day / 360) || lastLife.legacyId !== life.legacyId || lastLife.skills.length !== life.skills.length || life.skills.some(id => !lastLife.skills.includes(id))) fail('当世生平与人生结算记录不一致。');
  }

  // The normalized form must remain exportable even if imported JSON used a
  // shorter numeric spelling. Keep all prose intact and reject before commit.
  assertSaveSize(JSON.stringify(state));
  return state;
}
