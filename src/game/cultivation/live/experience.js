// The immutable birth marker is the only opt-in. Never infer it from the
// presence of a mutable field or from the server currently being newer.
import {exactKeys} from './schema.js';
export const EXPERIENCE_VERSION=1;
const lessons=['breakthrough'];
const invalid=()=>{throw new Error('修行经历与出生或行动记录不符。');};
export function isExperienceLife(life){return life?.birth?.cultivationProfile?.experienceVersion===EXPERIENCE_VERSION;}
export function createExperienceState(birth){
  if(birth?.cultivationProfile?.experienceVersion!==EXPERIENCE_VERSION)invalid();
  return {version:EXPERIENCE_VERSION,activeTechniqueId:birth.cultivationProfile.techniqueId,repaired:false,lessons:[]};
}
export function validateExperienceProfile(value){
  exactKeys(value,['version','activeTechniqueId','repaired','lessons']);
  if(value.version!==EXPERIENCE_VERSION||typeof value.activeTechniqueId!=='string'||typeof value.repaired!=='boolean'||!Array.isArray(value.lessons)||value.lessons.length>lessons.length||new Set(value.lessons).size!==value.lessons.length||value.lessons.some(id=>!lessons.includes(id)))invalid();
  return value;
}
export function validateExperienceState(life){
  const present=Object.hasOwn(life.cultivationProfile??{},'experience');
  if(present!==isExperienceLife(life))invalid();
  if(present)validateExperienceProfile(life.cultivationProfile.experience);
  return life;
}
export function experienceAfterAction(before,breakthrough){
  return breakthrough&&!before.lessons.includes('breakthrough')?{...before,lessons:[...before.lessons,'breakthrough']}:before;
}
// A paid action or a recorded consequence is one event even if both occur.
// Reference IDs and open status are independently verified against archived
// records before generated scenes can be committed.
export function advancesEvent(receipt,scene=null){
  if(receipt?.kind!=='choice')return false;
  return receipt.elapsedDays>0||Boolean(receipt.death)||Object.keys(receipt.itemChanges).length>0||Object.keys(receipt.relationChanges).length>0||
    Boolean(scene?.memoryDeltas.some(row=>row.referenceId&&['resolved','broken'].includes(row.status)&&scene.blocks.some(block=>block.text.includes(row.text))));
}
