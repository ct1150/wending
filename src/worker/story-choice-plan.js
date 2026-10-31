import {advancesEvent,GROWTH_TERMS,isExperienceLife} from '../game/cultivation/live/experience.js';
import {ITEMS} from '../game/cultivation/live/model.js';
import {isV7Life,nextRealmFor,v7ActionRule,V7_EXPLORE_TARGETS,V7_REALMS,WORLD_TIERS,WORLD_TRAVEL_APPROACHES} from '../game/cultivation/live/cultivation-rules.js';
import {formatStoryChoiceLabel} from '../game/cultivation/live/story-choice-label.js';
import {createNamedTargetLookup} from './story-named-targets.js';

const SPEAKER='@speaker',nearby=['青石驿','柳湾渡','松风岭','落雁集','长溪铺','南屏镇'];
const row=(action,target,purpose,stake='low')=>({action,target,purpose,stake});
const observe=()=>row('interact:observe','self','辨清眼前的细节，再决定下一步');
const rest=()=>row('rest:recover','self','先在此歇息，恢复精力');
const pick=(rows,index)=>rows.length?rows[index%rows.length]:null;
const alias=(c,entity)=>'k'+(c.entities.indexOf(entity)+1);
function location(c){
  const action=c.receipt.action,failed=c.receipt.cultivationResult?.check?.kind==='world-crossing'&&c.receipt.cultivationResult.check.success===false;
  return action?.intent==='travel'&&!failed?c.entities.find(e=>e.id===action.targetId&&e.kind==='place')?.name??c.director.world.location:c.director.world.location;
}
const closed=c=>c.previousScene?.id===c.namespace+':t'+(c.identity.turnId-1)+':s:closed'||c.receipt.action?.intent==='interact'&&['decline','leave'].includes(c.receipt.action.approach);
function entity(c,target){
  if(target===SPEAKER)return {id:'plan:speaker',kind:'person',name:'眼前发言人',status:'unknown'};
  if(typeof target==='string')return /^k[1-9]\d*$/u.test(target)?c.entities[Number(target.slice(1))-1]:null;
  return target&&typeof target==='object'?{id:'plan:new',kind:target.kind,name:target.name,status:'unknown'}:null;
}
function runnable(c,choice,here=location(c)){
  if(!choice)return false;const [intent,approach]=choice.action.split(':'),e=entity(c,choice.target);
  if(intent==='travel'&&e?.name===here||intent==='interact'&&closed(c)&&e)return false;
  const director=isExperienceLife(c.life)?{...c.director,eventCount:c.director.eventCount+(advancesEvent(c.receipt)?1:0)}:c.director;
  try{return !v7ActionRule({life:c.life,turnId:c.identity.turnId,director,relatedEntities:e?[e]:[]},{intent,approach,targetId:e?.id??choice.target,stake:choice.stake}).reason;}catch{return false;}
}
const identity=r=>JSON.stringify([r.action,r.target,r.stake]);
function cue(c,r){
  const e=entity(c,r.target),targetName=e?.name??ITEMS[r.target]??V7_REALMS[r.target]?.name??'';
  return formatStoryChoiceLabel({action:r.action,targetId:e?.id??r.target,targetName,stake:r.stake,purpose:r.purpose});
}

// The proposed terms are fixed by the rules, never by a model menu. A pledge
// additionally needs a live speaker who actually offers those terms in person.
const offerCue='我愿用'+GROWTH_TERMS.pledge.days+'日替你校法，下次见面还我'+GROWTH_TERMS.repay.items.supplies+'份行粮。';
function offersRepair(text){
  if(typeof text!=='string')return false;
  const line=text.trim().replace(/^[“「『‘"']|[”」』’"']$/gu,'');
  // Use a direct affirmative offer, not a report, refusal, price negotiation
  // or a promise inferred from a nearby name or from other speakers' words.
  if(!/^我(?:愿意?|可以|能|可)/u.test(line)||line.length>160||/不|否|没|无需|无须|免|据说|听说|转述|也许|[“”「」『』？?]/u.test(line))return false;
  const duration=/(?<![0-9零〇一二两三四五六七八九十百千])(?:三|3)(?:日|天)/u,work=/(?:替|帮|为|给|教|带)你[^。！？]{0,12}(?:校法|校正.{0,6}功法|修补.{0,6}残法)/u;
  const later=/(?:下次|下回|再见|日后|改日|来日|往后)/u,grain=/(?:还我|给我|带给我|带来|归还)(?:一|1)份(?:行粮|口粮)|(?<![0-9零〇一二两三四五六七八九十百千])(?:一|1)份(?:行粮|口粮)(?:还我|给我|即可归还)/u;
  return duration.test(line)&&work.test(line)&&later.test(line)&&grain.test(line);
}
function growthOptions(c){
  if(!isExperienceLife(c.life))return [];
  const e=c.life.cultivationProfile.experience,debt=e.commitment;
  if(debt?.status==='owed'){
    const who=c.entities.find(x=>x.id===debt.entityId&&x.kind==='person'&&x.status!=='dead');
    return who&&!closed(c)?[row('craft:repay',alias(c,who),'向订约之人归还一份行粮')]:[];
  }
  if(e.repaired)return [];
  if(!e.lessons.includes('diagnosed'))return [row('craft:diagnose','self','验明本命功法的缺处')];
  const terms=row('craft:pledge',SPEAKER,'用三日接受校法，约定下次相见时还一份行粮');
  return [...(!closed(c)?[terms]:[]),row('craft:restore','self','花时间自己推演，不欠别人行粮')];
}

// Build choices before asking for narration. Family rotation keeps mechanics
// reachable across turns without letting a timer decide an outcome or cost.
export function buildStoryChoicePlan(c){
  if(!isV7Life(c.life)||c.director?.version!==7)throw Error('V7 choice plan requires a directed life');
  const turn=c.identity.turnId,selected=c.receipt.action,next=nextRealmFor(c.life),tier=c.life.cultivationProfile.worldTier,here=location(c);
  const turnIndex=Math.max(0,turn-2)+(c.director.seed%17),isClosed=closed(c),known=c.entities.find(e=>e.id===selected?.targetId);
  const actor=known&&['person','faction'].includes(known.kind)&&known.status!=='dead'&&!isClosed&&['fight','evade','interact','negotiate'].includes(selected?.intent)?alias(c,known):SPEAKER;
  const quest=!isClosed&&(c.director.mainQuest??c.director.sideQuests?.[0]),topic=typeof quest?.text==='string'?Array.from(quest.text.trim()).slice(0,16).join(''):'';
  const ask=row('interact:ask',actor,topic?'问清“'+topic+'”的来龙去脉':'请对方说明事情的来由'),leave=row('interact:leave',actor,'结束这次交谈，另作打算');
  const inspect=topic?row('interact:observe','self','细看眼前有无线索能印证“'+topic+'”'):observe();
  const practice=row('practice:steady','self','梳理气息，继续积累修为');
  const breakthrough=next&&row('practice:breakthrough',next.id,'用现有材料尝试冲关');
  const localName=pick(nearby.filter(name=>name!==here),turnIndex),farName=tier<2?WORLD_TIERS[tier+1]+'云津':null;
  const places=c.entities.filter(e=>e.kind==='place'&&e.name!==here).map(e=>alias(c,e));
  const destinations=name=>!name?[]:c.entities.some(e=>e.kind==='place'&&e.name===name)?places:[...places,{kind:'place',name}];
  const travel=(approach,name)=>destinations(name).map(place=>row('travel:'+approach,place,WORLD_TRAVEL_APPROACHES.includes(approach)?'探寻通向下一界的道路':'亲自去那里查探，不先答应别的事')).filter(x=>runnable(c,x));
  const routes=['road','wilderness'].flatMap(a=>travel(a,localName));
  const crossings=WORLD_TRAVEL_APPROACHES.flatMap(a=>travel(a,farName));
  const resources=[...new Set([next?.material,'supplies','stones','herbs',...V7_EXPLORE_TARGETS])].filter(x=>V7_EXPLORE_TARGETS.includes(x));
  const explore=['cautious','bold'].flatMap(a=>resources.map(id=>row('explore:'+a,id,'寻找可用的'+ITEMS[id],a==='bold'?'normal':'low')));
  const crafts=[['alchemy','medicine'],['study','manual'],['forge','artifact'],['talisman','talisman'],['formation','array'],['alchemy','elixir'],['forge','talisman']].map(([a,t])=>row('craft:'+a,t,'利用现有材料'+(a==='study'?'整理功法':'练习这门技艺')));
  const sales=row('negotiate:black-market',actor,'出售'+ITEMS[(c.life.items.relic??0)>0?'relic':'artifact']+'，换取灵石');
  const social=isClosed?[]:[row('negotiate:bargain',actor,'商量补充行粮的条件'),row('negotiate:cooperate',actor,'谈妥双方能够履行的条件'),sales,row('negotiate:pressure',actor,'要求对方说明条件'),row('interact:help',actor,'给出一份行粮，帮助对方充饥')];
  const conflict=!isClosed&&(selected?.intent==='fight'||selected?.intent==='explore'&&selected.approach==='bold');
  const fights=conflict?['guard','assault','desperate'].map(a=>row('fight:'+a,actor,'应对眼前的交锋',a==='guard'?'low':'high')):[];
  const evasions=conflict?['withdraw','conceal','blood'].map(a=>row('evade:'+a,actor,'避开眼前的冲突')):[];
  const practiceSet=[practice,row('practice:intensive','self','收束杂念，专心磨炼功法'),row('practice:forbidden','self','自行承担禁术的代价','high')];
  const recovery=[rest(),row('rest:medicine','self','用现有丹药调养伤势'),row('rest:extend','self','服丹延续此身寿元'),row('rest:retire','self','退居一处静养')];
  const families=[practiceSet,explore,routes,crafts,social,recovery,crossings,[breakthrough],fights,evasions].map(rows=>rows.filter(r=>runnable(c,r))).filter(rows=>rows.length);
  const family=pick(families,turnIndex),opportunity=pick(family,Math.floor(turnIndex/families.length));
  const eligible=rows=>rows.find(r=>runnable(c,r));
  let candidates;
  if(c.phase==='opening')candidates=[ask,observe(),row('interact:decline',actor,'暂不介入眼前的事')];
  else{
    let focus=ask;
    if(isClosed)focus=observe();
    else if(conflict)focus=eligible(fights)??observe();
    else if(selected?.intent==='evade')focus=eligible([rest(),...routes])??observe();
    else if(selected?.intent==='practice')focus=eligible([breakthrough,...practiceSet])??rest();
    else if(selected?.intent==='craft')focus=eligible([crafts.find(r=>r.target===selected.targetId),...crafts,...explore])??observe();
    else if(selected?.intent==='explore')focus=eligible([breakthrough,...crafts,...routes])??observe();
    else if(selected?.intent==='rest')focus=eligible([c.life.injury>0&&recovery[1],breakthrough,practice])??observe();
    else if(selected?.intent==='travel'||selected?.intent==='interact'&&selected.approach==='ask')focus=inspect;
    candidates=conflict?[pick(fights.filter(r=>runnable(c,r)),turnIndex)??focus,pick(evasions.filter(r=>runnable(c,r)),turnIndex),observe()]:[focus,opportunity,focus?.action==='interact:observe'&&!isClosed?leave:inspect];
  }
  if(!conflict){
    const growth=growthOptions(c).filter(r=>runnable(c,r));
    if(growth.length)candidates=growth[0].action==='craft:diagnose'?[candidates[0],...growth,...candidates.slice(1)]:[...growth,...candidates];
  }
  const fallback=[observe(),rest(),practice,...explore.slice(0,2)].filter(r=>runnable(c,r));
  const slots=[],seen=new Set();for(const r of [...candidates,...fallback]){if(runnable(c,r)&&!seen.has(identity(r))){seen.add(identity(r));slots.push({id:['a','b','c'][slots.length],...r});if(slots.length===3)break;}}
  return {slots,fallback,cues:slots.map(r=>r.action==='craft:pledge'?cue(c,r)+'。若在场人愿意指点，可由本人提议：“'+offerCue+'”':cue(c,r))};
}

// Binding is restricted to a real dialogue speaker. A mention in free prose
// never creates an actor, an action, a risk level, a destination or an item.
export function materializeStoryChoices(plan,c,blocks){
  const lookup=createNamedTargetLookup(c),cast=[];
  for(const b of Array.isArray(blocks)?blocks:[]){if(b?.kind!=='dialogue'||b.speaker==='self')continue;
    try{const t=lookup(b.speaker);if(t.kind!=='person'||t.known?.status==='dead'||t.name===c.life.name)continue;
      cast.push({target:t.known?alias(c,t.known):{kind:'person',name:t.name},text:b.text});}catch{/* Only confirmed speakers can bind a slot. */}
  }
  const result=[],seen=new Set();
  function add(slot){
    let target=slot.target,speaker;
    if(target===SPEAKER||typeof target==='string'&&/^k\d+$/u.test(target)&&entity(c,target)?.kind==='person'){
      speaker=slot.action==='craft:pledge'?cast.find(x=>offersRepair(x.text)&&runnable(c,{...slot,target:x.target})):target===SPEAKER?cast[0]:cast.find(x=>x.target===target);if(!speaker)return;target=speaker.target;
    }
    let purpose=slot.purpose;
    if(slot.action==='interact:ask'&&slot.purpose==='请对方说明事情的来由'&&typeof speaker?.text==='string'){
      // Quoting a short exact passage narrows the question without converting
      // free text into a command. The original body still belongs to the author.
      const clause=speaker.text.trim().replace(/^[“「『‘"'\s]+/u,'').split(/[。！？；，、：,.!?：“”「」『』\n]/u).find(part=>part.trim())?.trim()??'';
      const chars=Array.from(clause);if(chars.length)purpose='问问“'+chars.slice(0,16).join('')+(chars.length>16?'…':'')+'”是怎么回事';
    }
    const r={action:slot.action,target,stake:slot.stake,purpose,anchor:0},id=identity(r);if(!runnable(c,r)||seen.has(id))return;seen.add(id);result.push(r);
  }
  for(const slot of plan.slots)add(slot);
  for(const slot of plan.fallback){if(result.length>=2)break;add(slot);}
  return result;
}
