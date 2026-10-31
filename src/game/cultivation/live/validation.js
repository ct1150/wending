import {checkActorScene} from './actor-insight.js';
import { assertPlainData, canonicalStringify } from './identity.js';
import { DAYS_PER_YEAR, ORIGINS, TALENTS, ITEMS, REALMS, LEGACY_ITEMS, LEGACY_INTENTS } from './model.js';
import { exactKeys, idField, textField, validateProposal, validateEntities, validateGeneratedScene } from './schema.js';
import { V7_REALMS, isV7Life, isV7Birth, summarizeLife, initialLifeForBirth, initialItemsForBirth, validateV7BirthProfile, validateV7Profile, realmFor, lifespanLimitFor, maximumSpiritFor, validV7Target } from './cultivation-rules.js';
import { isExperienceLife, validateExperienceState, experienceAfterAction, GROWTH_TERMS } from './experience.js';
import { validateStoryDirector } from './story-director.js';
import { validateReincarnation } from './reincarnation.js';
import { validateRetrievalMemory } from './retrieval-memory.js';
export { assertPlainData };
export function integer(value,min=0,max=Number.MAX_SAFE_INTEGER-1) { if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('数值字段无效。'); }
export function validateBirth(birth) { exactKeys(birth,['originId','talentIds','attributes'],['cultivationProfile']);if(Object.hasOwn(birth,'cultivationProfile'))validateV7BirthProfile(birth.cultivationProfile);if(!Object.hasOwn(ORIGINS,birth.originId)||!Array.isArray(birth.talentIds)||birth.talentIds.length!==2||new Set(birth.talentIds).size!==2||birth.talentIds.some(id=>!Object.hasOwn(TALENTS,id)))throw new Error('出生条件无效。');exactKeys(birth.attributes,['constitution','insight','fortune']);let total=0;for(const n of Object.values(birth.attributes)){integer(n,1,6);total+=n;}if(total!==12)throw new Error('资质必须合计十二点。'); }
export function validateLife(life) {
 exactKeys(life,['name','ageDays','lifeLimit','realm','cultivation','injury','items','relations','birth'],['cultivationProfile']);textField(life.name,24);validateBirth(life.birth);
 if(Object.hasOwn(life,'cultivationProfile'))validateV7Profile(life.cultivationProfile);
 validateExperienceState(life);
 if(isV7Life(life)!==isV7Birth(life.birth)||/[\r\n]/.test(life.name)||!realmFor(life)||life.lifeLimit!==lifespanLimitFor(life))throw new Error('人物境界或寿元无效。');
 if(isV7Life(life)&&life.cultivationProfile.maxSpirit!==maximumSpiritFor(life))throw new Error('灵力上限与此身不符。');
 integer(life.ageDays,16*DAYS_PER_YEAR,isV7Life(life)?1032000*DAYS_PER_YEAR:life.lifeLimit*DAYS_PER_YEAR);integer(life.cultivation,0,9999);integer(life.injury,0,10);
 exactKeys(life.items,[],Object.keys(isV7Life(life)?ITEMS:LEGACY_ITEMS));for(const n of Object.values(life.items))integer(n,0,9999);
 if(!life.relations||typeof life.relations!=='object'||Array.isArray(life.relations)||Object.keys(life.relations).length>24)throw new Error('人物关系无效。');for(const [id,n] of Object.entries(life.relations)){idField(id);integer(n,-100,100);}
 return life;
}
function validateSummary(row) {
  const modern=Object.hasOwn(row,'cultivationProfile');
  exactKeys(row, ['ageDays', 'realm', 'cultivation', 'injury',...(modern?['lifeLimit','cultivationProfile']:[])]);
  if(modern)validateV7Profile(row.cultivationProfile);
  if (!realmFor(row)) throw new Error('收据境界无效。');
  if(modern&&row.lifeLimit!==lifespanLimitFor(row))throw new Error('收据寿元上限无效。');
  integer(row.ageDays, 16 * DAYS_PER_YEAR, modern?1032000*DAYS_PER_YEAR:REALMS[row.realm].lifeLimit * DAYS_PER_YEAR);
  integer(row.cultivation, 0, 9999);
  integer(row.injury, 0, 10);
}
function same(left, right) { return canonicalStringify(left) === canonicalStringify(right); }
const lifeSummary=summarizeLife;
export function validateReceipt(row,{turnId}={}) {
  exactKeys(row, ['kind','choiceId','action','elapsedDays','itemChanges','relationChanges','random','before','after','death','birth'],['cultivationResult']);
  const modern=Object.hasOwn(row.before??{},'cultivationProfile');
  if(modern!==Object.hasOwn(row.after??{},'cultivationProfile')||modern!==Object.hasOwn(row,'cultivationResult'))throw new Error('收据规则版本不一致。');
  if (!['opening', 'choice'].includes(row.kind)) throw new Error('收据类型无效。');
  integer(row.elapsedDays, 0, modern?1032000*DAYS_PER_YEAR:1080000);
  exactKeys(row.itemChanges, [], Object.keys(modern?ITEMS:LEGACY_ITEMS));
  for (const n of Object.values(row.itemChanges)) integer(n, -9999, 9999);
  if (!row.relationChanges || typeof row.relationChanges !== 'object' || Array.isArray(row.relationChanges) || Object.keys(row.relationChanges).length > 24) throw new Error('关系变化无效。');
  for (const [id, n] of Object.entries(row.relationChanges)) { idField(id); integer(n, -200, 200); }
  exactKeys(row.random, ['before', 'after', 'roll']);
  integer(row.random.before, 0, 4294967295);
  integer(row.random.after, 0, 4294967295);
  if (row.random.roll !== null) integer(row.random.roll, 0, 99);
  validateSummary(row.before);
  validateSummary(row.after);
  const beforeExperience=row.before.cultivationProfile?.experience,afterExperience=row.after.cultivationProfile?.experience;
  const growth=row.action?.intent==='craft'&&GROWTH_TERMS[row.action.approach];
  if(growth){
    if(!beforeExperience)throw new Error('旧人生没有这项修行行动。');
    if(!row.death&&(row.elapsedDays!==growth.days||row.after.cultivationProfile.spirit!==row.before.cultivationProfile.spirit-growth.spiritCost||
      !same(row.itemChanges,row.action.approach==='repay'?{supplies:-1}:{})))throw new Error('修行代价与行动不符。');
  }
  if(Boolean(beforeExperience)!==Boolean(afterExperience)||beforeExperience&&!same(experienceAfterAction(beforeExperience,row.before.realm!==row.after.realm,{action:row.action,death:row.death,turnId:turnId??afterExperience?.commitment?.acceptedTurn}),afterExperience))throw new Error('修行经历与行动不符。');
  if (row.death !== null) {
    exactKeys(row.death, ['cause']);
    if (!['lifespan', 'injury'].includes(row.death.cause)) throw new Error('死亡原因无效。');
  }
  if (row.after.ageDays - row.before.ageDays !== row.elapsedDays) throw new Error('收据时间不一致。');
  const expired = modern?row.after.ageDays>=row.after.lifeLimit*DAYS_PER_YEAR:row.after.ageDays === REALMS[row.after.realm].lifeLimit * DAYS_PER_YEAR;
  const injured = row.after.injury === 10;
  if ((expired || injured) !== Boolean(row.death)) throw new Error('收据生死不一致。');
  if (row.death && (row.death.cause !== (expired ? 'lifespan' : 'injury') || !modern&&expired&&injured || row.before.realm !== row.after.realm)) throw new Error('死亡原因与真实终局不符。');
  if (row.kind === 'opening') {
    validateBirth(row.birth);
    if(modern!==isV7Birth(row.birth)||![row.before,row.after].every(summary=>same(summary,summarizeLife(initialLifeForBirth('出生',row.birth)))))throw new Error('出生收据不符。');
    if (row.choiceId !== null || row.action !== null || row.elapsedDays !== 0 || Object.keys(row.itemChanges).length || Object.keys(row.relationChanges).length || row.death !== null || row.random.before !== row.random.after || row.random.roll !== null || !same(row.before, row.after)) throw new Error('出生收据不能包含行动结果。');
  } else {
    validateProposal(row.action);
    if(!modern&&!LEGACY_INTENTS[row.action.intent]?.includes(row.action.approach))throw new Error('旧生行动规则无效。');
    const immediate=row.action.intent==='interact'&&['ask','observe','decline','leave'].includes(row.action.approach)&&row.action.stake==='low';
    const zeroTime=immediate||modern&&(row.action.intent==='rest'&&row.action.approach==='extend'||row.action.intent==='evade'&&row.action.approach==='blood'&&row.death?.cause==='lifespan');
    if (row.choiceId !== row.action.id || row.birth !== null || row.elapsedDays < (zeroTime?0:1) || row.random.roll === null) throw new Error('行动收据无效。');
    if(immediate&&(row.elapsedDays!==0||Object.keys(row.itemChanges).length||Object.keys(row.relationChanges).length||!same(row.before,row.after)||row.death!==null))throw new Error('短时互动不能产生资源或数值变化。');
    if (row.before.injury >= 10 || row.before.ageDays >= (modern?row.before.lifeLimit:REALMS[row.before.realm].lifeLimit)*DAYS_PER_YEAR) throw new Error('死亡后不能产生行动收据。');
    const expectedRandom = (Math.imul(row.random.before, 1664525) + 1013904223) >>> 0;
    if (row.random.after !== expectedRandom || row.random.roll !== expectedRandom % 100) throw new Error('行动随机收据不一致。');
  }
  if(modern)validateCultivationResult(row);
  return row;
}

function validateCultivationResult(receipt){
  const result=receipt.cultivationResult,before=receipt.before,after=receipt.after;
  exactKeys(result,['version','check','lifespanChange']);
  if(result.version!==7)throw new Error('修行判定版本无效。');
  exactKeys(result.lifespanChange,['years','cause']);integer(result.lifespanChange.years,-1000000,1000000);
  const {years,cause}=result.lifespanChange;
  if(years!==after.lifeLimit-before.lifeLimit||![null,'breakthrough','blood-escape','forbidden-backlash','longevity-elixir'].includes(cause))throw new Error('寿元变化与收据不符。');
  if(result.check!==null){
    const check=result.check;exactKeys(check,['kind','roll','chance','success']);
    if(!['breakthrough','practice','craft','exploration','combat','forbidden','black-market','world-crossing'].includes(check.kind)||typeof check.success!=='boolean'||check.roll!==receipt.random.roll)throw new Error('修行判定无效。');
    integer(check.roll,0,99);integer(check.chance,0,100);
    if(check.success!==(check.roll<check.chance))throw new Error('修行判定结果不一致。');
  }
  const action=receipt.action;
  const isAction=(intent,approach)=>action?.intent===intent&&action.approach===approach;
  const tierChange=after.cultivationProfile.worldTier-before.cultivationProfile.worldTier;
  if(result.check?.kind==='world-crossing'){
    const crossing=action?.intent==='travel'&&['ascend','smuggle','rift','ancient-array'].includes(action.approach);
    if(!crossing||tierChange!==(result.check.success&&!receipt.death?1:0))throw new Error('界域跃迁必须由真实行动结算。');
  }else if(tierChange!==0)throw new Error('普通行动不能改变所在界域。');
  const bonus=after.cultivationProfile.lifespanBonus-before.cultivationProfile.lifespanBonus,loss=after.cultivationProfile.lifespanLoss-before.cultivationProfile.lifespanLoss;
  if(cause===null&&(years!==0||bonus!==0||loss!==0))throw new Error('普通行动不能更改寿元上限。');
  if(cause==='longevity-elixir'&&(!isAction('rest','extend')||years<=0||bonus!==years||loss!==0||(receipt.itemChanges.elixir??0)!==-1||receipt.elapsedDays!==0))throw new Error('延寿必须实际消耗丹药。');
  if(cause==='blood-escape'&&(!isAction('evade','blood')||years>=0||loss<=0||bonus!==0))throw new Error('血遁命损无效。');
  if(cause==='forbidden-backlash'&&(!isAction('practice','forbidden')||result.check?.kind!=='forbidden'||result.check.success||years>=0||loss<=0||bonus!==0))throw new Error('禁术反噬命损无效。');
  if(cause==='breakthrough'&&(!isAction('practice','breakthrough')||result.check?.kind!=='breakthrough'||!result.check.success||years<=0||bonus!==0||loss!==0))throw new Error('突破延寿无效。');
  if(before.realm!==after.realm){
    const destination=V7_REALMS[after.realm];
    if(cause!=='breakthrough'||action.targetId!==after.realm||destination.rank!==V7_REALMS[before.realm].rank+1||(receipt.itemChanges[destination.material]??0)!==-1)throw new Error('突破必须逐级并消耗真实材料。');
  }else if(cause==='breakthrough')throw new Error('未突破不能增加境界寿元。');
  if(receipt.kind==='opening'&&(result.check!==null||cause!==null))throw new Error('出生不能包含行动判定。');
}
export function validateLiveState(state) {
  assertPlainData(state);
  exactKeys(state, ['version','mode','contentVersion','rulesVersion','promptVersion','runId','revision','turnId','phase','rng','life','birthReceipt','currentScene','lastReceipt','relatedEntities','archiveCursor'],['relationshipVersion','director','reincarnation','retrieval']);
  if(state.relationshipVersion!==undefined&&state.relationshipVersion!==1)throw new Error('关系规则版本无效。');
  if (state.version !== 5 || state.mode !== 'cultivation' || state.contentVersion !== 4 || state.rulesVersion !== 1 || state.promptVersion !== 1 || !['awaitingOpening','active','dead'].includes(state.phase)) throw new Error('实时存档版本或阶段无效。');
  idField(state.runId);
  integer(state.revision);
  integer(state.turnId);
  if(state.retrieval!==undefined){validateRetrievalMemory(state.retrieval);if(state.turnId===0)throw new Error('开场之前不能添加来源记录。');}
  if (state.revision !== state.turnId) throw new Error('回合与修订不一致。');
  integer(state.archiveCursor);
  integer(state.rng, 0, 4294967295);
  validateLife(state.life);
  if(isExperienceLife(state.life)&&!state.director)throw new Error('新人生缺少事件时钟。');
  if(state.director!==undefined){if(!isV7Life(state.life))throw new Error('旧人生不能静默切换世界规则。');validateStoryDirector(state.director,{turnId:state.turnId,life:state.life});}
  if(state.reincarnation!==undefined){
    validateReincarnation(state.reincarnation);
    if(!isV7Life(state.life)||state.reincarnation.parentRunId===state.runId||!same(state.reincarnation.purchases,state.life.birth.cultivationProfile.inheritedBenefits))throw new Error('轮回传承与出生事实不符。');
  }
  validateReceipt(state.birthReceipt);
  validateEntities(state.relatedEntities);if(!isExperienceLife(state.life)&&state.relatedEntities.some(e=>e.experience))throw new Error('旧人生不能写入对手境界。');
  if (state.birthReceipt.kind !== 'opening' || !same(state.life.birth, state.birthReceipt.birth)) throw new Error('出生事实不可改写。');
  const expired = state.life.ageDays >= state.life.lifeLimit * DAYS_PER_YEAR;
  const injured = state.life.injury >= 10;
  if (state.phase === 'awaitingOpening') {
    if (state.revision !== 0 || state.currentScene !== null || state.lastReceipt !== null || state.relatedEntities.length) throw new Error('开场之前不能添加经历。');
    validateUnchangedBirth(state);
  } else {
    if (state.revision < 1 || state.lastReceipt === null) throw new Error('已提交回合缺少收据。');
    validateReceipt(state.lastReceipt,{turnId:state.turnId});
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
      validateGeneratedScene(state.currentScene);checkActorScene(state.currentScene,isExperienceLife(state.life),state.relatedEntities,false);
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
  if (!same(lifeSummary(state.life), state.birthReceipt.after) || Object.keys(state.life.relations).length || !same(state.life.items, initialItemsForBirth(state.life.birth)) || state.rng !== state.birthReceipt.random.after) throw new Error('开场不能改写出生条件。');
}
export function serializeLiveState(state) { validateLiveState(state);return JSON.stringify(state); }
export function deserializeLiveState(raw) {if(typeof raw!=='string'||new TextEncoder().encode(raw).length>65536)throw new Error('实时快照文字过大。');let state;try{state=JSON.parse(raw);}catch{throw new Error('实时快照 JSON 无效。');}return validateLiveState(state);}

function validateContextualTarget(state,p) {
 if(isV7Life(state.life)){if(!validV7Target(state,p))throw new Error('存档行动目标无效。');return;}
 if(!LEGACY_INTENTS[p.intent]?.includes(p.approach))throw new Error('存档行动意图无效。');
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
