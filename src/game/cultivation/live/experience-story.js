import {isExperienceLife} from './experience.js';
import {TECHNIQUES} from './cultivation-rules.js';
import {ORIGINS} from './model.js';

// These are four dilemmas, not four events that have already happened. The
// saved director seed includes origin; retrying never rolls another opening.
const openings=[
  ['entry','试探一道入门机会','开考将近，先让你看清入门门槛，可以试一试，也可放弃。'],
  ['resources','安排有限的修行资用','眼前的修习机会要消耗盘缠或时间，按现有行囊描写，允许省下。'],
  ['secret','决定是否遮掩自己的异象','初次运功露出一处异象，你要决定现身求证还是悄然收手。'],
  ['relationship','决定与谁同行或独行','有人在分路处邀你同行，你可问清缘由、拒绝同行或自己探路。'],
];
export function buildOpeningBrief({life,director,phase}){
  if(phase!=='opening'||!isExperienceLife(life))return null;
  const [kind,goal,dilemma]=openings[director.seed%openings.length],b=life.birth.cultivationProfile,t=TECHNIQUES[b.techniqueId];
  return {kind,goal,dilemma,origin:ORIGINS[life.birth.originId],location:director.world.location,strength:b.advantages[0],tradeoff:t.defective?t.defect:b.defects[0],technique:t.name};
}
export function advanceExperienceStory(previous,receipt,scene,life){
  const e=life.cultivationProfile.experience,c=e.commitment;
  if(c?.status==='owed'){
    const who=scene?.entities.find(a=>a.id===c.entityId)?.name;
    return who?'再遇'+who+'：可归还校法时约定的一份行粮，也可暂缓。':'记着校法之约：下次遇见指点之人时可归还一份行粮。';
  }
  if(receipt.action?.approach==='repay'&&c?.status==='fulfilled')return '校法之约已经还清，下一步由你决定。';
  if(e.repaired)return ['restore','pledge'].includes(receipt.action?.approach)?'功法已修补，可以亲试它的变化，也可另寻机缘。':previous;
  if(!TECHNIQUES[e.activeTechniqueId].defective)return previous;
  if(e.lessons.includes('diagnosed'))return '缺处已明：自行推演，或听取眼前人的校法条件，也可暂缓。';
  return '可验看本命功法，辨明缺处，或先处理眼前机会。';
}
export function growthPrompt(context){
  if(!isExperienceLife(context.life))return '';
  const e=context.life.cultivationProfile.experience,t=TECHNIQUES[e.activeTechniqueId],c=e.commitment;
  if(c?.status==='owed')return '仍欠指点者一份行粮；仅在本人在场时提出偿还，可暂缓。';
  if(context.receipt.action?.approach==='repay'&&c?.status==='fulfilled')return '约定行粮已交还，不再催讨。';
  if(!t.defective||e.repaired)return '';
  return e.lessons.includes('diagnosed')?'缺处已明。可自行推演；若在场真人愿指点，明说三日校法、日后还一份行粮，可拒绝。':'若契合眼前困境，可验看本命功法以辨明缺处，不替玩家行动。';
}
