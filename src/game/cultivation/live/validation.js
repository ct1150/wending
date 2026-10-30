import { assertPlainData, canonicalStringify } from './identity.js';
import { DAYS_PER_YEAR, ORIGINS, TALENTS, ITEMS, REALMS } from './model.js';
import { exactKeys, idField, textField, validateProposal, validateEntities, validateGeneratedScene } from './schema.js';
export { assertPlainData };
export function integer(value,min=0,max=Number.MAX_SAFE_INTEGER-1) { if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('数值字段无效。'); }
export function validateBirth(birth) { exactKeys(birth,['originId','talentIds','attributes']);if(!Object.hasOwn(ORIGINS,birth.originId)||!Array.isArray(birth.talentIds)||birth.talentIds.length!==2||new Set(birth.talentIds).size!==2||birth.talentIds.some(id=>!Object.hasOwn(TALENTS,id)))throw new Error('出生条件无效。');exactKeys(birth.attributes,['constitution','insight','fortune']);let total=0;for(const n of Object.values(birth.attributes)){integer(n,1,6);total+=n;}if(total!==12)throw new Error('资质必须合计十二点。'); }
export function validateLife(life) {
 exactKeys(life,['name','ageDays','lifeLimit','realm','cultivation','injury','items','relations','birth']);textField(life.name,24);if(/[\r\n]/.test(life.name)||!Object.hasOwn(REALMS,life.realm)||life.lifeLimit!==REALMS[life.realm].lifeLimit)throw new Error('人物境界或寿元无效。');integer(life.ageDays,16*DAYS_PER_YEAR,life.lifeLimit*DAYS_PER_YEAR);integer(life.cultivation,0,9999);integer(life.injury,0,10);validateBirth(life.birth);
 exactKeys(life.items,[],Object.keys(ITEMS));for(const n of Object.values(life.items))integer(n,0,9999);
 if(!life.relations||typeof life.relations!=='object'||Array.isArray(life.relations)||Object.keys(life.relations).length>24)throw new Error('人物关系无效。');for(const [id,n] of Object.entries(life.relations)){idField(id);integer(n,-100,100);}
 return life;
}
function validateSummary(row) {
  exactKeys(row, ['ageDays', 'realm', 'cultivation', 'injury']);
  if (!Object.hasOwn(REALMS, row.realm)) throw new Error('收据境界无效。');
  integer(row.ageDays, 16 * DAYS_PER_YEAR, REALMS[row.realm].lifeLimit * DAYS_PER_YEAR);
  integer(row.cultivation, 0, 9999);
  integer(row.injury, 0, 10);
}
function same(left, right) { return canonicalStringify(left) === canonicalStringify(right); }
function lifeSummary(life) {
  return { ageDays: life.ageDays, realm: life.realm, cultivation: life.cultivation, injury: life.injury };
}
export function validateReceipt(row) {
  exactKeys(row, ['kind','choiceId','action','elapsedDays','itemChanges','relationChanges','random','before','after','death','birth']);
  if (!['opening', 'choice'].includes(row.kind)) throw new Error('收据类型无效。');
  integer(row.elapsedDays, 0, 1080000);
  exactKeys(row.itemChanges, [], Object.keys(ITEMS));
  for (const n of Object.values(row.itemChanges)) integer(n, -9999, 9999);
  if (!row.relationChanges || typeof row.relationChanges !== 'object' || Array.isArray(row.relationChanges) || Object.keys(row.relationChanges).length > 24) throw new Error('关系变化无效。');
  for (const [id, n] of Object.entries(row.relationChanges)) { idField(id); integer(n, -200, 200); }
  exactKeys(row.random, ['before', 'after', 'roll']);
  integer(row.random.before, 0, 4294967295);
  integer(row.random.after, 0, 4294967295);
  if (row.random.roll !== null) integer(row.random.roll, 0, 99);
  validateSummary(row.before);
  validateSummary(row.after);
  if (row.death !== null) {
    exactKeys(row.death, ['cause']);
    if (!['lifespan', 'injury'].includes(row.death.cause)) throw new Error('死亡原因无效。');
  }
  if (row.after.ageDays - row.before.ageDays !== row.elapsedDays) throw new Error('收据时间不一致。');
  const expired = row.after.ageDays === REALMS[row.after.realm].lifeLimit * DAYS_PER_YEAR;
  const injured = row.after.injury === 10;
  if ((expired || injured) !== Boolean(row.death)) throw new Error('收据生死不一致。');
  if (row.death && (row.death.cause !== (expired ? 'lifespan' : 'injury') || expired && injured || row.before.realm !== row.after.realm)) throw new Error('死亡原因与真实终局不符。');
  if (row.kind === 'opening') {
    validateBirth(row.birth);
    if (![row.before, row.after].every(summary => summary.ageDays === 5760 && summary.realm === 'mortal' && summary.cultivation === 0 && summary.injury === 0)) throw new Error('出生收据不符。');
    if (row.choiceId !== null || row.action !== null || row.elapsedDays !== 0 || Object.keys(row.itemChanges).length || Object.keys(row.relationChanges).length || row.death !== null || row.random.before !== row.random.after || row.random.roll !== null || !same(row.before, row.after)) throw new Error('出生收据不能包含行动结果。');
  } else {
    validateProposal(row.action);
    const immediate=row.action.intent==='interact'&&['ask','observe','decline','leave'].includes(row.action.approach)&&row.action.stake==='low';
    if (row.choiceId !== row.action.id || row.birth !== null || row.elapsedDays < (immediate?0:1) || row.random.roll === null) throw new Error('行动收据无效。');
    if(immediate&&(row.elapsedDays!==0||Object.keys(row.itemChanges).length||Object.keys(row.relationChanges).length||!same(row.before,row.after)||row.death!==null))throw new Error('短时互动不能产生资源或数值变化。');
    if (row.before.injury >= 10 || row.before.ageDays >= REALMS[row.before.realm].lifeLimit * DAYS_PER_YEAR) throw new Error('死亡后不能产生行动收据。');
    const expectedRandom = (Math.imul(row.random.before, 1664525) + 1013904223) >>> 0;
    if (row.random.after !== expectedRandom || row.random.roll !== expectedRandom % 100) throw new Error('行动随机收据不一致。');
  }
  return row;
}
export function validateLiveState(state) {
  assertPlainData(state);
  exactKeys(state, ['version','mode','contentVersion','rulesVersion','promptVersion','runId','revision','turnId','phase','rng','life','birthReceipt','currentScene','lastReceipt','relatedEntities','archiveCursor'],['relationshipVersion']);
  if(state.relationshipVersion!==undefined&&state.relationshipVersion!==1)throw new Error('关系规则版本无效。');
  if (state.version !== 5 || state.mode !== 'cultivation' || state.contentVersion !== 4 || state.rulesVersion !== 1 || state.promptVersion !== 1 || !['awaitingOpening','active','dead'].includes(state.phase)) throw new Error('实时存档版本或阶段无效。');
  idField(state.runId);
  integer(state.revision);
  integer(state.turnId);
  if (state.revision !== state.turnId) throw new Error('回合与修订不一致。');
  integer(state.archiveCursor);
  integer(state.rng, 0, 4294967295);
  validateLife(state.life);
  validateReceipt(state.birthReceipt);
  validateEntities(state.relatedEntities);
  if (state.birthReceipt.kind !== 'opening' || !same(state.life.birth, state.birthReceipt.birth)) throw new Error('出生事实不可改写。');
  const expired = state.life.ageDays >= state.life.lifeLimit * DAYS_PER_YEAR;
  const injured = state.life.injury >= 10;
  if (state.phase === 'awaitingOpening') {
    if (state.revision !== 0 || state.currentScene !== null || state.lastReceipt !== null || state.relatedEntities.length) throw new Error('开场之前不能添加经历。');
    validateUnchangedBirth(state);
  } else {
    if (state.revision < 1 || state.lastReceipt === null) throw new Error('已提交回合缺少收据。');
    validateReceipt(state.lastReceipt);
    if (!same(state.lastReceipt.after, lifeSummary(state.life)) || state.lastReceipt.random.after !== state.rng) throw new Error('人物快照与最后收据不一致。');
    if (state.revision === 1) {
      if (!same(state.lastReceipt, state.birthReceipt)) throw new Error('首个提交必须是原始出生收据。');
      validateUnchangedBirth(state);
    } else if (state.lastReceipt.kind !== 'choice') {
      throw new Error('后续回合必须是实际行动收据。');
    }
    if (state.phase === 'dead') {
      if ((!expired && !injured) || state.currentScene !== null || !state.lastReceipt.death) throw new Error('只有真实死亡才能终结。');
    } else {
      if (expired || injured || state.lastReceipt.death !== null) throw new Error('死亡人物不能继续行动。');
      validateGeneratedScene(state.currentScene);
      if (!same(state.currentScene.entities, state.relatedEntities)) throw new Error('场景实体不一致。');
      for (const proposal of state.currentScene.choices) validateContextualTarget(state, proposal);
      for (const memory of state.currentScene.memoryDeltas) {
        if (!state.relatedEntities.some(entity => entity.id === memory.entityId)) throw new Error('记忆实体未知。');
      }
    }
  }
  for (const id of Object.keys(state.life.relations)) {
    if (!state.relatedEntities.some(entity => entity.id === id)) throw new Error('人物关系引用未知实体。');
  }
  if (new TextEncoder().encode(JSON.stringify(state)).length > 65536) throw new Error('实时快照超过容量，请保存完整归档。');
  return state;
}
function validateUnchangedBirth(state) {
  if (!same(lifeSummary(state.life), state.birthReceipt.after) || Object.keys(state.life.relations).length || !same(state.life.items, { supplies: 3, stones: 0 }) || state.rng !== state.birthReceipt.random.after) throw new Error('开场不能改写出生条件。');
}
export function serializeLiveState(state) { validateLiveState(state);return JSON.stringify(state); }
export function deserializeLiveState(raw) {if(typeof raw!=='string'||new TextEncoder().encode(raw).length>65536)throw new Error('实时快照文字过大。');let state;try{state=JSON.parse(raw);}catch{throw new Error('实时快照 JSON 无效。');}return validateLiveState(state);}

function validateContextualTarget(state,p) {
 const entity=state.relatedEntities.find(e=>e.id===p.targetId);
 let valid=false;
 if(p.intent==='rest')valid=p.targetId==='self';
 if(p.intent==='practice')valid=p.approach==='breakthrough'?Object.hasOwn(REALMS,p.targetId)&&REALMS[p.targetId].rank===REALMS[state.life.realm].rank+1:p.targetId==='self';
 if(p.intent==='explore')valid=['supplies','stones','manual','crystal','core','soulseal','skykey','relic','iron'].includes(p.targetId);
 if(['negotiate','fight','evade'].includes(p.intent))valid=entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind);
 if(p.intent==='travel')valid=entity&&entity.kind==='place';
 if(p.intent==='craft')valid=p.targetId==='manual'&&p.approach==='study'||p.targetId==='talisman'&&p.approach==='forge';
 if(p.intent==='interact'){
  valid=p.stake==='low'&&(p.approach==='help'?entity&&entity.kind==='person'&&entity.status!=='dead':['ask','decline'].includes(p.approach)?entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind):p.targetId==='self'||entity&&(p.approach==='observe'||entity.status!=='dead'));
 }
 if(!valid)throw new Error('存档行动目标无效。');
}
