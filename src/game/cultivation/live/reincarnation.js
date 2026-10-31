import { stateHash, sha256, assertPlainData } from './identity.js';
import { DAYS_PER_YEAR } from './model.js';
import { isExperienceLife, EXPERIENCE_VERSION } from './experience.js';
import { realmFor, TECHNIQUES, V7_REALMS } from './cultivation-rules.js';

export const REINCARNATION_REWARDS = Object.freeze([
  {id:'resilient-body',name:'特殊体质',cost:3,description:'下一世带入坚韧的体魄，保留与之相伴的缺陷。'},
  {id:'past-memory',name:'前世记忆',cost:2,description:'记住一段修行感悟，助下一世理解功法。'},
  {id:'causal-compass',name:'因果罗盘',cost:3,description:'下一世探索时更易辨识险兆，机缘仍须亲自争取。'},
  {id:'former-relic',name:'前世遗物',cost:4,description:'留下一件有代价的遗物，随新的因果进入来世。'},
].map(Object.freeze));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/u.test(value);
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const costOf=ids=>ids.reduce((sum,id)=>sum+REINCARNATION_REWARDS.find(reward=>reward.id===id).cost,0);

function validateRewards(ids) {
  if(!Array.isArray(ids)||ids.length>REINCARNATION_REWARDS.length||new Set(ids).size!==ids.length||ids.some(id=>!REINCARNATION_REWARDS.some(reward=>reward.id===id)))fail('REINCARNATION_INVALID_REWARDS');
}
const exact=(row,keys)=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key));
const invalid=()=>fail('REINCARNATION_INVALID_STATE');
const earned=(rank,ageDays)=>2+rank*3+Math.max(0,Math.floor((ageDays/DAYS_PER_YEAR-16)/20));
// Each row cites an actual turn in the one immutable parent snapshot. The
// pledge cites the original acceptance; status is its disposition at death.
function readEchoes(rows,parentId){
 if(!Array.isArray(rows)||rows.length<1||rows.length>3||rows.at(-1)?.kind!=='death'||new Set(rows.map(row=>row?.kind)).size!==rows.length)invalid();
 const end=rows.at(-1).turn;
 for(const e of rows){
  const sourceTurn=e?.kind==='method'&&e.route==='study'?e.observedAt:e?.turn;
  if(!integer(sourceTurn,1)||sourceTurn>end)invalid();
  if(e.kind==='method'){
   if(!exact(e,['kind',e.route==='study'?'observedAt':'turn','techniqueId','route'])||(e.route==='study'&&e.observedAt!==end)||!Object.hasOwn(TECHNIQUES,e.techniqueId)||!TECHNIQUES[e.techniqueId].defective||!['aid','study'].includes(e.route))invalid();
  }else if(e.kind==='pledge'){
   if(!exact(e,['kind','turn','entityId','actionId','status'])||!validId(e.entityId)||!e.entityId.startsWith('r:'+sha256(parentId).slice(0,16)+':t')||!validId(e.actionId)||!['owed','fulfilled'].includes(e.status))invalid();
  }else if(e.kind==='death'){
   if(!exact(e,['kind','turn','cause','realm','ageDays'])||!['lifespan','injury'].includes(e.cause)||!Object.hasOwn(V7_REALMS,e.realm)||!integer(e.ageDays,16*DAYS_PER_YEAR))invalid();
  }else invalid();
 }
 const pledged=rows.find(e=>e.kind==='pledge'),aided=rows.find(e=>e.kind==='method'&&e.route==='aid');
 if(Boolean(pledged)!==Boolean(aided)||pledged&&pledged.turn!==aided.turn)invalid();
 return rows;
}
export function validateReincarnation(row) {
 assertPlainData(row);
 const keys=['version','lineageId','generation','parentRunId','parentStateHash','earnedPoints','balance','purchases'];
 if(![1,2].includes(row?.version)||!exact(row,row.version===2?[...keys,'carriedPoints','echoes']:keys)||!validId(row.lineageId)||!validId(row.parentRunId)||!integer(row.generation,2)||!/^[a-f0-9]{64}$/u.test(row.parentStateHash)||!integer(row.earnedPoints)||!integer(row.balance))invalid();
 validateRewards(row.purchases);
 if(row.version===2){
  const d=readEchoes(row.echoes,row.parentRunId).at(-1);
  if(row.purchases.length>2||!integer(row.carriedPoints)||row.earnedPoints!==earned(V7_REALMS[d.realm].rank,d.ageDays)||row.generation===2&&row.carriedPoints!==0||!integer(row.earnedPoints+row.carriedPoints)||row.balance!==row.earnedPoints+row.carriedPoints-costOf(row.purchases))invalid();
 }
 return row;
}
function echoesFor(state){
 const e=state.life.cultivationProfile.experience,c=e.commitment;
 return [...(e.repaired?[{kind:'method',...(c?{turn:c.acceptedTurn}:{observedAt:state.turnId}),techniqueId:e.activeTechniqueId,route:c?'aid':'study'}]:[]),
  ...(c?[{kind:'pledge',turn:c.acceptedTurn,entityId:c.entityId,actionId:c.acceptedActionId,status:c.status}]:[]),
  {kind:'death',turn:state.turnId,cause:state.lastReceipt.death.cause,realm:state.life.realm,ageDays:state.life.ageDays}];
}
export function describeEcho(e){
 if(e.kind==='method')return (e.route==='aid'?'曾向人求教校法，修补':'曾自行推演修补')+'《'+TECHNIQUES[e.techniqueId].name+'》。';
 if(e.kind==='pledge')return '前世第'+e.turn+'回的校法之约'+(e.status==='owed'?'尚欠行粮。':'已还行粮。');
 return '前世止步'+V7_REALMS[e.realm].name+'，'+(e.cause==='lifespan'?'寿尽而终。':'因伤而终。');
}
// The model gets no former entity IDs, instructions or arbitrary strings.
// These small reminders have no place in a rule calculation or an inventory.
const noteFor=e=>e.kind==='method'?(e.route==='aid'?'向人求教修法':'自行推演修法'):e.kind==='pledge'?(e.status==='owed'?'尚欠行粮':'已还行粮'):e.cause==='lifespan'?'寿尽':'伤亡';
const notes=['向人求教修法','自行推演修法','尚欠行粮','已还行粮','寿尽','伤亡'];
export const validEchoNotes=value=>Array.isArray(value)&&value.length>0&&value.length<=3&&new Set(value).size===value.length&&value.every(v=>notes.includes(v));
export const echoNotes=row=>row?.version===2?row.echoes.map(noteFor):[];
export function getReincarnationSettlement(state) {
  if(state?.phase!=='dead')return null;
  const life=state.life,death=state.lastReceipt?.death;
  if(!life||!death||!(life.injury>=10||life.ageDays>=life.lifeLimit*DAYS_PER_YEAR))return null;
  if(state.reincarnation)validateReincarnation(state.reincarnation);
  const realm=realmFor(life),age=life.ageDays/DAYS_PER_YEAR;
  // Questions and other zero-day actions do not farm inheritance currency.
  const earnedPoints=2+realm.rank*3+Math.max(0,Math.floor((age-16)/20));
  const carriedPoints=state.reincarnation?.balance??0,availablePoints=earnedPoints+carriedPoints;
  if(!integer(availablePoints))fail('REINCARNATION_INVALID_STATE');
  const name=life.name,deathCause=death.cause,generation=state.reincarnation?.generation??1;
  const summary=`${name}行至${age.toFixed(1)}岁，最终止步${realm.name}。${deathCause==='lifespan'?'岁月抵达寿元上限，此生因果留在旧卷。':'伤势夺去了此身，已经作出的选择留在旧卷。'}`;
  const epitaph=deathCause==='lifespan'?'一身归于尘土，来路仍有回响。':'仙路未尽，此心曾向长生。';
  const old={name,generation,summary,epitaph,realm:realm.name,age,lifeLimit:life.lifeLimit,deathCause,earnedPoints,carriedPoints,availablePoints};
  if(!isExperienceLife(life))return old;
  const echoes=echoesFor(state),c=life.cultivationProfile.experience.commitment,decisions=[];
  if(life.cultivationProfile.experience.lessons.includes('breakthrough'))decisions.push('曾亲历破境，终局境界为'+realm.name+'。');
  if(echoes[0].kind==='method')decisions.push(describeEcho(echoes[0]));
  const person=c&&(state.relatedEntities.find(row=>row.id===c.entityId)?.name??state.director?.memory.npcs.find(row=>row.id===c.entityId)?.name??'当时的指点者');
  if(c?.status==='fulfilled')decisions.push('第'+c.acceptedTurn+'回接受'+person+'的校法之约，此生已还行粮。');
  if(state.lastReceipt.action)decisions.push('最后一次行动：'+state.lastReceipt.action.label+'。');
  return {...old,selectionLimit:2,decisions,unfinished:c?.status==='owed'?['第'+c.acceptedTurn+'回接受'+person+'的校法之约，直至身故尚欠行粮一份。']:[],echoes};
}
export function buildRebirthOptions(deadState,rewardIds=[]) {
  const settlement=getReincarnationSettlement(deadState);
  if(!settlement)fail('REINCARNATION_REQUIRES_DEATH');
  validateRewards(rewardIds);
  if(settlement.selectionLimit&&rewardIds.length>settlement.selectionLimit)fail('REINCARNATION_SELECTION_LIMIT');
  const spent=costOf(rewardIds);
  if(spent>settlement.availablePoints)fail('REINCARNATION_INSUFFICIENT_POINTS');
  const purchases=[...rewardIds].sort();
  return {engineVersion:7,...(isExperienceLife(deadState.life)?{experienceVersion:EXPERIENCE_VERSION}:{}),inheritedBenefits:purchases,reincarnation:{
    version:settlement.echoes?2:1,...(settlement.echoes?{carriedPoints:settlement.carriedPoints,echoes:settlement.echoes}:{}),lineageId:deadState.reincarnation?.lineageId??deadState.runId,
    generation:settlement.generation+1,parentRunId:deadState.runId,parentStateHash:stateHash(deadState),
    earnedPoints:settlement.earnedPoints,balance:settlement.availablePoints-spent,purchases,
  }};
}

export function reincarnationClaimForChild(state) {
  if(!state.reincarnation)return null;
  const row=validateReincarnation(state.reincarnation);
  return {version:1,parentRunId:row.parentRunId,parentStateHash:row.parentStateHash,childRunId:state.runId,lineageId:row.lineageId,generation:row.generation};
}

export function validateReincarnationClaim(claim,parent=null,{matchDeathSnapshot=true}={}) {
  assertPlainData(claim);
  const keys=['version','parentRunId','parentStateHash','childRunId','lineageId','generation'];
  if(!claim||typeof claim!=='object'||Object.keys(claim).length!==keys.length||keys.some(key=>!Object.hasOwn(claim,key))||claim.version!==1||![claim.parentRunId,claim.childRunId,claim.lineageId].every(validId)||claim.childRunId===claim.parentRunId||!/^[a-f0-9]{64}$/u.test(claim.parentStateHash)||!integer(claim.generation,2))fail('REINCARNATION_INVALID_STATE');
  if(parent&&(parent.runId!==claim.parentRunId||claim.lineageId!==(parent.reincarnation?.lineageId??parent.runId)||claim.generation!==(parent.reincarnation?.generation??1)+1||matchDeathSnapshot&&(!getReincarnationSettlement(parent)||stateHash(parent)!==claim.parentStateHash)))fail('REINCARNATION_INVALID_STATE');
  return claim;
}
