import { serialize, deserialize } from '../engine.js';
import { createJourney, beginJourneyLife } from './engine.js';
import { JOURNEY_LEGACIES } from './content.js';

const validateLegacy = state => deserialize(serialize(state));
export function getLegacyBridgeChoices(validLegacyState) {
 const state = validateLegacy(validLegacyState);
 if (!['ended','victory'].includes(state.phase) || (state.summary.legacyOptions.length && !state.summary.selectedLegacyId)) return [];
 const candidates=[...new Set([...state.run.selectedLegacies,...(state.summary.selectedLegacyId ? [state.summary.selectedLegacyId]:[])])];
 return (candidates.length ? candidates : [null]).map(id=>({id:id ? `carry:${id}`:'new-life',label:id ? `携「${JOURNEY_LEGACIES[id].name}」进入新人生。`:'只携记忆，进入新人生。',detail:'下一世只沿用一项情境方法；全部收藏、道证、因果与生平保留。'+(id ? JOURNEY_LEGACIES[id].description:'不因死亡赠送奖励。'),enabled:true}));
}
export function migrateLegacyLife(validLegacyState,{choiceId,seed}={}) {
 const old=validateLegacy(validLegacyState);
 if (!getLegacyBridgeChoices(old).some(row=>row.id===choiceId)) throw new Error('旧人生尚未结算、传承尚未择定，或交接选择已经失效。');
 const state=createJourney({seed}), sw=old.meta.storyWorld;
 state.transcript=[];
 state.life.name=old.run.name;
 state.world={year:old.meta.worldYear,generation:old.meta.generation,facts:{'legacy-victories':old.meta.victories},people:{},proofs:[...old.meta.proofs],legacies:[...old.meta.legacyIds],completedTasks:[],biography:structuredClone(old.meta.history),legacyArchive:structuredClone(old)};
 for(const [legacy,id] of Object.entries({shen_zhi:'shen-zhi',lu_huai:'lu-huai',wen_du:'wen-du'})) state.world.people[id]={status:sw.npcDeathYears[legacy]===null?'safe':'dead',birthYear:sw.npcBirthYears[legacy],deathYear:sw.npcDeathYears[legacy]};
 const f=state.world.facts;
 for(const flag of old.meta.worldFlags) f[`legacy-flag-${flag}`]=true;
 if(sw.valleyOutcome){
  f['valley-outcome']=sw.valleyOutcome;
  [f['seed-state'],f['seed-custodian']]={open_clinic:['rooted','valley-households'],sect_estate:['sect-custody','guiheng'],ash_refuge:['destroyed','none']}[sw.valleyOutcome];
  state.world.completedTasks.push({episodeId:'mortal-valley',outcomeId:sw.valleyOutcome,generation:sw.resolvedGeneration??old.meta.generation,sequence:1});
 }
 // Old booleans/evidence cannot establish v3 named consent or full-source custody.
 // Keep their exact shape in the read-only archive; map only equivalent facts.
 f['public-truth']=sw.publicTruth; f['supply-debt']=sw.supplyDebt; f['grave-moved']=sw.graveMoved;
 f['legacy-unpaid-promise']=sw.unpaidPromise; f['legacy-survivor-line']=sw.survivorLine;
 if(sw.survivorLine==='safe') f['legacy-safe-rescue']=true;
 for(const record of sw.records){
  if(!['clinic','estate','refuge'].includes(record.arc)||record.outcomeId==='unfinished') continue;
  const episodeId=`mortal-${record.arc}`;
  if(state.world.completedTasks.some(row=>row.episodeId===episodeId)) continue;
  state.world.completedTasks.push({episodeId,outcomeId:record.outcomeId,generation:record.generation,sequence:state.world.completedTasks.length+1});
 }
 state.revision=1;
 return beginJourneyLife(state,choiceId==='new-life'?null:choiceId.slice(6));
}
