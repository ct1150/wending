// The immutable birth marker is the only opt-in. Never infer it from the
// presence of a mutable field or from the server currently being newer.
import {exactKeys} from './schema.js';
export const EXPERIENCE_VERSION=1;
const lessons=['breakthrough','diagnosed'];
const invalid=()=>{throw new Error('修行经历与出生或行动记录不符。');};
export function isExperienceLife(life){return life?.birth?.cultivationProfile?.experienceVersion===EXPERIENCE_VERSION;}
export function createExperienceState(birth){
  if(birth?.cultivationProfile?.experienceVersion!==EXPERIENCE_VERSION)invalid();
  return {version:EXPERIENCE_VERSION,activeTechniqueId:birth.cultivationProfile.techniqueId,repaired:false,lessons:[]};
}
export function validateExperienceProfile(value){
  exactKeys(value,['version','activeTechniqueId','repaired','lessons'],['commitment']);
  if(value.version!==EXPERIENCE_VERSION||typeof value.activeTechniqueId!=='string'||typeof value.repaired!=='boolean'||!Array.isArray(value.lessons)||value.lessons.length>lessons.length||new Set(value.lessons).size!==value.lessons.length||value.lessons.some(id=>!lessons.includes(id)))invalid();
  if(value.repaired&&!value.lessons.includes('diagnosed'))invalid();
  if(Object.hasOwn(value,'commitment')){
    const c=value.commitment;exactKeys(c,['entityId','acceptedActionId','acceptedTurn','condition','status']);
    const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/u.test(v);
    if(!value.repaired||!id(c.entityId)||!id(c.acceptedActionId)||!Number.isSafeInteger(c.acceptedTurn)||c.acceptedTurn<1||c.condition!=='return-supply'||!['owed','fulfilled'].includes(c.status))invalid();
  }
  return value;
}
export function validateExperienceState(life){
  const present=Object.hasOwn(life.cultivationProfile??{},'experience');
  if(present!==isExperienceLife(life))invalid();
  if(present)validateExperienceProfile(life.cultivationProfile.experience);
  return life;
}
export const GROWTH_TERMS=Object.freeze({
  diagnose:{days:1,spiritCost:2},restore:{days:90,spiritCost:8},pledge:{days:3,spiritCost:4},
  repay:{days:1,spiritCost:0,items:{supplies:1},relationship:2},
});
export function experienceAfterAction(before,breakthrough,{action,turnId,death=false}={}){
  if(death)return before;
  const learn=id=>before.lessons.includes(id)?before:{...before,lessons:[...before.lessons,id]};
  if(breakthrough)return learn('breakthrough');
  if(action?.intent!=='craft'||!Object.hasOwn(GROWTH_TERMS,action.approach))return before;
  const {approach,targetId,stake}=action,diagnosed=before.lessons.includes('diagnosed');
  if(stake!=='low')invalid();
  if(approach==='repay'){
    if(before.commitment?.status!=='owed'||before.commitment.entityId!==targetId)invalid();
    return {...before,commitment:{...before.commitment,status:'fulfilled'}};
  }
  if(before.repaired||(approach==='diagnose')===diagnosed)invalid();
  if(approach==='diagnose'||approach==='restore'){
    if(targetId!=='self')invalid();
    return approach==='diagnose'?learn('diagnosed'):{...before,repaired:true};
  }
  if(targetId==='self'||!Number.isSafeInteger(turnId)||turnId<1)invalid();
  return {...before,repaired:true,commitment:{entityId:targetId,acceptedActionId:action.id,acceptedTurn:turnId,condition:'return-supply',status:'owed'}};
}
// A paid action or a recorded consequence is one event even if both occur.
// Reference IDs and open status are independently verified against archived
// records before generated scenes can be committed.
export function advancesEvent(receipt,scene=null){
  if(receipt?.kind!=='choice')return false;
  return receipt.elapsedDays>0||Boolean(receipt.death)||Object.keys(receipt.itemChanges).length>0||Object.keys(receipt.relationChanges).length>0||
    Boolean(scene?.memoryDeltas.some(row=>row.referenceId&&['resolved','broken'].includes(row.status)&&scene.blocks.some(block=>block.text.includes(row.text))));
}
