import { stateHash, assertPlainData } from './identity.js';
import { DAYS_PER_YEAR } from './model.js';
import { isExperienceLife, EXPERIENCE_VERSION } from './experience.js';
import { realmFor } from './cultivation-rules.js';

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
export function validateReincarnation(row) {
  assertPlainData(row);
  const keys=['version','lineageId','generation','parentRunId','parentStateHash','earnedPoints','balance','purchases'];
  if(!row||typeof row!=='object'||Object.keys(row).length!==keys.length||keys.some(key=>!Object.hasOwn(row,key))||row.version!==1||!validId(row.lineageId)||!validId(row.parentRunId)||!integer(row.generation,2)||!/^[a-f0-9]{64}$/u.test(row.parentStateHash)||!integer(row.earnedPoints)||!integer(row.balance))fail('REINCARNATION_INVALID_STATE');
  validateRewards(row.purchases);
  return row;
}
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
  return {name,generation,summary,epitaph,realm:realm.name,age,lifeLimit:life.lifeLimit,deathCause,earnedPoints,carriedPoints,availablePoints};
}
export function buildRebirthOptions(deadState,rewardIds=[]) {
  const settlement=getReincarnationSettlement(deadState);
  if(!settlement)fail('REINCARNATION_REQUIRES_DEATH');
  validateRewards(rewardIds);
  const spent=costOf(rewardIds);
  if(spent>settlement.availablePoints)fail('REINCARNATION_INSUFFICIENT_POINTS');
  const purchases=[...rewardIds].sort();
  return {engineVersion:7,...(isExperienceLife(deadState.life)?{experienceVersion:EXPERIENCE_VERSION}:{}),inheritedBenefits:purchases,reincarnation:{
    version:1,lineageId:deadState.reincarnation?.lineageId??deadState.runId,
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
