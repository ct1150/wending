import { DAYS_PER_YEAR, ITEMS, REALMS, ORIGINS } from './model.js';
import { exactKeys } from './schema.js';

import {EXPERIENCE_VERSION,isExperienceLife,createExperienceState,validateExperienceProfile,experienceAfterAction,GROWTH_TERMS} from './experience.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const bounded=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const requireValue=(condition,message='修行规则数据无效。')=>{if(!condition)throw new Error(message);};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const hasBenefit=(birth,id)=>birth.cultivationProfile.inheritedBenefits.includes(id);

// The original REALMS table remains untouched: existing archive receipts replay
// against their original rules. Only explicitly marked new lives use this table.
import {V7_REALMS} from './actor-insight.js';
export {V7_REALMS};

export const ROOTS=Object.freeze({
  'mixed-five':{id:'mixed-five',name:'五行伪灵根',category:'伪灵根',description:'五种灵息皆有感应，寻物敏锐，破境却较艰难。',advantage:'五行感应：探索判定更敏锐。',defect:'灵根驳杂：突破较难。',breakthrough:-5,exploration:8},
  'wood-fire':{id:'wood-fire',name:'木火真灵根',category:'真灵根',description:'木火相生，善于炼丹，苦修时消耗更多灵力。',advantage:'木火相生：炼丹更稳。',defect:'灵息相争：苦修额外消耗灵力。',breakthrough:3,alchemy:10,intensiveCost:3},
  'frost-water':{id:'frost-water',name:'寒水真灵根',category:'真灵根',description:'灵息绵长，调息较快，强攻时寒气反冲。',advantage:'寒水归息：休养额外恢复伤势。',defect:'寒气反冲：强攻多承受一分伤势。',breakthrough:5,recovery:1,assaultInjury:1},
  'storm':{id:'storm',name:'风雷异灵根',category:'异灵根',description:'修行进境较快，雷息也让急进更危险。',advantage:'风雷灵息：修行额外积累一分。',defect:'雷息不驯：急进与破境风险更高。',practice:1,breakthrough:-5,intensiveRisk:6},
  'pure-heaven':{id:'pure-heaven',name:'清曜天灵根',category:'天灵根',description:'清曜灵息令进境与破境更快，每次运功也会留下难掩异象，招来窥伺。',advantage:'清曜天根：修行多积两分，突破更稳。',defect:'天根难藏：每次运功提高暴露，高暴露会引来实质风险。',practice:2,breakthrough:12,practiceExposure:20},
});
export const PHYSIQUES=Object.freeze({
  'plain':{id:'plain',name:'归息凡体',description:'伤后易于静养，破境时仍须克服凡躯。',advantage:'归息凡体：调息多恢复一分。',defect:'凡躯桎梏：突破稍难。',recovery:1,breakthrough:-2},
  'iron':{id:'iron',name:'凝骨体',description:'筋骨耐受风霜，容纳的灵力较少。',advantage:'凝骨体：历练较少受伤。',defect:'经络狭窄：灵力上限较低。',protection:8,maxSpirit:-10},
  'jade':{id:'jade',name:'透脉体',description:'灵脉通透，灵力充盈，肉身较为脆弱。',advantage:'透脉体：灵力上限增加。',defect:'肉身脆弱：历练更易受伤。',protection:-3,maxSpirit:20,breakthrough:3},
  'ember':{id:'ember',name:'留焰体',description:'体内残焰可助丹火，冲关时却容易扰乱心神。',advantage:'留焰体：炼丹更稳，灵力略多。',defect:'残焰扰心：突破稍难。',alchemy:8,maxSpirit:10,breakthrough:-3},
});
export const RELICS=Object.freeze({
  'quiet-lamp':{id:'quiet-lamp',name:'听烛残灯',description:'苦修时稳住心念；灯焰也会留下可追索的异象。',advantage:'听烛残灯：苦修额外积累一分。',defect:'烛焰异象：苦修与破境增加暴露。'},
  'cracked-mirror':{id:'cracked-mirror',name:'缺角石镜',description:'映出隐蔽灵息；冒险照镜会耗神并引人窥视。',advantage:'缺角石镜：寻宝判定更稳。',defect:'照镜耗神：冒险探索消耗灵力并增加暴露。'},
  'root-seed':{id:'root-seed',name:'枯壳灵种',description:'可感应丹药生机，温养灵种需分出修行灵力。',advantage:'枯壳灵种：炼丹判定更稳。',defect:'温养灵种：修炼额外消耗灵力。'},
  'rusted-needle':{id:'rusted-needle',name:'锈纹罗针',description:'指向近处灵物；寻宝时留下难以抹净的灵痕。',advantage:'锈纹罗针：寻宝行程缩短。',defect:'罗针留痕：寻宝增加暴露。'},
});
export const TECHNIQUES=Object.freeze({
  'clear-stream':{id:'clear-stream',name:'澄流吐纳诀',category:'完整',defective:false,description:'脉路完整，行气平稳；突破仍需要亲自取得完整功法与对应材料。',advantage:'澄流吐纳：行气较稳。',defect:'基础法诀：不能替代突破材料。',breakthrough:2},
  'torn-meridian':{id:'torn-meridian',name:'缺页回脉篇',category:'残缺',defective:true,description:'后半脉路残缺，每次修炼须多花年月校正。',advantage:'回脉旧法：仍可积累修为。',defect:'功法残页：修行耗时增加两成。',timePercent:120},
  'sealed-breath':{id:'sealed-breath',name:'锁息旧章',category:'暗门',defective:true,description:'吐纳中藏有旧主留下的闭锁，破境更难。',advantage:'锁息吐纳：日常能够修行。',defect:'功法暗门：突破判定受阻。',breakthrough:-8},
  'borrowed-flame':{id:'borrowed-flame',name:'借焰行气录',category:'副作用',defective:true,description:'借外火引气，稍有不慎便会灼伤经络。',advantage:'借焰行气：修炼多积一分。',defect:'借火伤脉：普通修行也有受伤风险。',practice:1,risk:10},
  'tracked-script':{id:'tracked-script',name:'回纹引灵简',category:'暗门',defective:true,description:'行气纹路会向外泄露灵息痕迹。',advantage:'回纹引灵：仍可稳步修行。',defect:'引灵暗记：运功会提高暴露。',exposure:8},
  'false-circuit':{id:'false-circuit',name:'错环周天法',category:'残缺',defective:true,description:'周天多了一段错环，每次运功消耗更多灵力。',advantage:'错环周天：绕行仍可积累。',defect:'错环耗神：修行额外消耗八点灵力。',spiritCost:8},
  'hollow-marrow':{id:'hollow-marrow',name:'空髓引炁篇',category:'副作用',defective:true,description:'引炁较快，却容易震伤尚未稳固的筋骨。',advantage:'空髓引炁：修行多积一分。',defect:'空髓反震：运功有伤身风险。',practice:1,risk:8},
  'closed-heart':{id:'closed-heart',name:'闭心凝息诀',category:'暗门',defective:true,description:'闭心法能积蓄灵息，真正冲关时却难以转圜。',advantage:'闭心凝息：修行多积一分。',defect:'闭心桎梏：突破更难。',practice:1,breakthrough:-10},
  'borrowed-shadow':{id:'borrowed-shadow',name:'借影藏息书',category:'副作用',defective:true,description:'借影藏息会留下另一道可被追索的残影。',advantage:'借影行气：日常可继续修炼。',defect:'残影可寻：运功会提高暴露。',exposure:10},
  'frayed-thread':{id:'frayed-thread',name:'断丝归气录',category:'残缺',defective:true,description:'行气次序断裂，需要额外灵力接续。',advantage:'断丝归气：残法仍可使用。',defect:'脉序断裂：修行耗时与耗神均增加。',timePercent:110,spiritCost:4},
});
export const INHERITED_BENEFITS=Object.freeze({
  'resilient-body':{id:'resilient-body',name:'护魂锻体',description:'此生历练受伤风险降低，灵力上限增加十点。'},
  'past-memory':{id:'past-memory',name:'残缺前忆',description:'此生入世带一分修为，突破判定略有助益。'},
  'causal-compass':{id:'causal-compass',name:'因果寻踪',description:'此生探索更容易得到目标资源。'},
  'former-relic':{id:'former-relic',name:'前世遗物',description:'此生入世携一件古修遗物，可留待历险或交易。'},
});
export const ART_NAMES=Object.freeze({alchemy:'丹道',forging:'器道',formations:'阵道',talismans:'符道'});
export const WORLD_TIERS=Object.freeze(['下界','中界','上界']);
export const WORLD_TRAVEL_APPROACHES=Object.freeze(['ascend','smuggle','rift','ancient-array']);
export const V7_EXPLORE_TARGETS=Object.freeze(['supplies','stones','manual','crystal','core','soulseal','skykey','relic','iron','herbs','voidstone','unityjade','daofruit','thunderseal']);
const ORIGIN_ITEMS=Object.freeze({village:{supplies:4,stones:0,herbs:1},artisan:{supplies:2,stones:4,iron:1},ferry:{supplies:4,stones:2},exile:{supplies:2,stones:0,herbs:2,talisman:1}});
const BIRTH_KEYS=['version','rootId','physiqueId','relicId','techniqueId','advantages','defects','inheritedBenefits'];
const PROFILE_KEYS=['version','lifespanBonus','lifespanLoss','spirit','maxSpirit','exposure','worldTier','arts'];

export function isV7Life(life){return life?.cultivationProfile?.version===7;}
export function isV7Birth(birth){return birth?.cultivationProfile?.version===7;}
export function realmCatalogFor(life){return isV7Life(life)?V7_REALMS:REALMS;}
export function realmFor(life){return realmCatalogFor(life)[life.realm];}
export function nextRealmFor(life){const current=realmFor(life);return current?Object.values(realmCatalogFor(life)).find(realm=>realm.rank===current.rank+1)??null:null;}
export function worldTierForPlaceName(name){const matches=WORLD_TIERS.map((label,index)=>String(name).includes(label)?index:-1).filter(index=>index>=0);return matches.length===1?matches[0]:null;}
export function fortuneCycleModifier(state){
  const profile=state.life.birth.cultivationProfile,band=(Math.floor((isExperienceLife(state.life)?state.director.eventCount:state.turnId)/20)+state.life.birth.attributes.fortune+Object.keys(ROOTS).indexOf(profile.rootId))%5;
  return (band-2)*3;
}
export function summarizeLife(life){
  const summary={ageDays:life.ageDays,realm:life.realm,cultivation:life.cultivation,injury:life.injury};
  if(isV7Life(life)){summary.lifeLimit=life.lifeLimit;summary.cultivationProfile=clone(life.cultivationProfile);}
  return summary;
}
export function validateInheritedBenefits(benefits){
  requireValue(Array.isArray(benefits)&&benefits.length<=4&&new Set(benefits).size===benefits.length&&benefits.every(id=>Object.hasOwn(INHERITED_BENEFITS,id)),'前世传承无效。');
  return benefits;
}
function descriptions(profile){
  const selected=[ROOTS[profile.rootId],PHYSIQUES[profile.physiqueId],RELICS[profile.relicId],TECHNIQUES[profile.techniqueId]];
  return {advantages:[...selected.map(row=>row.advantage),...profile.inheritedBenefits.map(id=>INHERITED_BENEFITS[id].description)],defects:selected.map(row=>row.defect)};
}
export function createCultivationBirthProfile(draw,inheritedBenefits=[],experienceVersion){
  validateInheritedBenefits(inheritedBenefits);
  const select=(table,label)=>Object.keys(table)[draw(Object.keys(table).length,label)];
  const profile={version:7,rootId:select(ROOTS),physiqueId:select(PHYSIQUES,'physique'),relicId:select(RELICS,'relic'),techniqueId:select(TECHNIQUES),inheritedBenefits:[...inheritedBenefits]};
  return {...profile,...descriptions(profile),...(experienceVersion===undefined?{}:{experienceVersion})};
}
export function validateV7BirthProfile(profile){
  exactKeys(profile,BIRTH_KEYS,['experienceVersion']);
  if(Object.hasOwn(profile,'experienceVersion'))requireValue(profile.experienceVersion===EXPERIENCE_VERSION);
  requireValue(profile.version===7&&Object.hasOwn(ROOTS,profile.rootId)&&Object.hasOwn(PHYSIQUES,profile.physiqueId)&&Object.hasOwn(RELICS,profile.relicId)&&Object.hasOwn(TECHNIQUES,profile.techniqueId),'灵根、体质、伴生遗物或功法无效。');
  validateInheritedBenefits(profile.inheritedBenefits);
  const expected=descriptions(profile);
  requireValue(JSON.stringify(profile.advantages)===JSON.stringify(expected.advantages)&&JSON.stringify(profile.defects)===JSON.stringify(expected.defects),'出生长短处不可改写。');
  return profile;
}
export function validateV7Profile(profile){
  exactKeys(profile,PROFILE_KEYS,['experience']);
  if(Object.hasOwn(profile,'experience')){validateExperienceProfile(profile.experience);requireValue(Object.hasOwn(TECHNIQUES,profile.experience.activeTechniqueId)&&(!profile.experience.lessons.includes('diagnosed')||TECHNIQUES[profile.experience.activeTechniqueId].defective));}
  requireValue(profile.version===7&&bounded(profile.lifespanBonus,0,1000000)&&bounded(profile.lifespanLoss,0,1000000)&&bounded(profile.maxSpirit,1,1000)&&bounded(profile.spirit,0,profile.maxSpirit)&&bounded(profile.exposure,0,100)&&bounded(profile.worldTier,0,2));
  exactKeys(profile.arts,Object.keys(ART_NAMES));for(const value of Object.values(profile.arts))requireValue(bounded(value,0,20));
  return profile;
}
export function maximumSpiritFor(life){
  if(!isV7Life(life))return 0;
  return 100+V7_REALMS[life.realm].rank*20+(PHYSIQUES[life.birth.cultivationProfile.physiqueId].maxSpirit??0)+(hasBenefit(life.birth,'resilient-body')?10:0);
}
export function lifespanLimitFor(life){
  const base=realmFor(life).lifeLimit;
  return isV7Life(life)?Math.max(0,base+life.cultivationProfile.lifespanBonus-life.cultivationProfile.lifespanLoss):base;
}
export function initialItemsForBirth(birth){
  if(!isV7Birth(birth))return {supplies:3,stones:0};
  validateV7BirthProfile(birth.cultivationProfile);requireValue(Object.hasOwn(ORIGINS,birth.originId));
  const items={...ORIGIN_ITEMS[birth.originId]};
  if(hasBenefit(birth,'former-relic'))items.relic=1;
  return items;
}
export function initialLifeForBirth(name,birth){
  const life={name,ageDays:16*DAYS_PER_YEAR,lifeLimit:80,realm:'mortal',cultivation:0,injury:0,items:initialItemsForBirth(birth),relations:{},birth:clone(birth)};
  if(isV7Birth(birth)){
    life.cultivationProfile={version:7,lifespanBonus:0,lifespanLoss:0,spirit:100,maxSpirit:100,exposure:0,worldTier:0,arts:{alchemy:0,forging:0,formations:0,talismans:0}};
    if(isExperienceLife(life))life.cultivationProfile.experience=createExperienceState(birth);
    life.cultivationProfile.maxSpirit=maximumSpiritFor(life);life.cultivationProfile.spirit=life.cultivationProfile.maxSpirit;
    if(hasBenefit(birth,'past-memory'))life.cultivation=1;
  }
  return life;
}

export function validV7Target(state,proposal){
  const p=proposal,entity=state.relatedEntities.find(row=>row.id===p.targetId),actor=entity&&entity.status!=='dead'&&['person','faction'].includes(entity.kind);
  if(p.intent==='craft'&&Object.hasOwn(GROWTH_TERMS,p.approach)){
    if(!isExperienceLife(state.life)||p.stake!=='low')return false;
    return ['pledge','repay'].includes(p.approach)?entity?.kind==='person'&&entity.status!=='dead'&&!/野兽|黄鼠狼|野狼|猛虎|野猪|毒蛇|蟒蛇/u.test(entity.name):p.targetId==='self';
  }
  if(p.intent==='practice')return p.approach==='breakthrough'?nextRealmFor(state.life)?.id===p.targetId:p.targetId==='self';
  if(p.intent==='rest')return p.targetId==='self';
  if(p.intent==='explore')return V7_EXPLORE_TARGETS.includes(p.targetId);
  if(['negotiate','fight','evade'].includes(p.intent))return Boolean(actor);
  if(p.intent==='travel')return entity?.kind==='place';
  if(p.intent==='craft')return p.approach==='study'?p.targetId==='manual':p.approach==='forge'?['artifact','talisman'].includes(p.targetId):p.approach==='alchemy'?['medicine','elixir'].includes(p.targetId):p.approach==='formation'?p.targetId==='array':p.approach==='talisman'&&p.targetId==='talisman';
  if(p.intent==='interact')return p.stake==='low'&&(p.approach==='help'?entity?.kind==='person'&&entity.status!=='dead':['ask','decline'].includes(p.approach)?Boolean(actor):p.targetId==='self'||Boolean(entity&&(p.approach==='observe'||entity.status!=='dead')));
  return false;
}

export function effectiveTechniqueFor(life){
  const e=life.cultivationProfile.experience,t=TECHNIQUES[isExperienceLife(life)?e.activeTechniqueId:life.birth.cultivationProfile.techniqueId];
  if(!isExperienceLife(life)||!e.repaired||!t.defective)return t;
  // Only mechanically negative properties of the equipped method yield.
  return {...t,timePercent:100,spiritCost:0,risk:0,exposure:0,breakthrough:Math.max(0,t.breakthrough??0)};
}
function modifiers(life){
  const birth=life.birth,profile=birth.cultivationProfile;
  return {root:ROOTS[profile.rootId],body:PHYSIQUES[profile.physiqueId],relic:profile.relicId,technique:effectiveTechniqueFor(life),
    protection:birth.attributes.constitution+(birth.talentIds.includes('iron-bones')?10:0)+(PHYSIQUES[profile.physiqueId].protection??0)+(hasBenefit(birth,'resilient-body')?10:0),
    fortune:birth.attributes.fortune,insight:birth.attributes.insight,
    exposed:life.cultivationProfile.exposure>=80?20:life.cultivationProfile.exposure>=50?10:0};
}

// Proposals express a finite intention. All amounts, durations, checks and
// consequences are supplied here; model text never supplies numeric effects.
export function v7ActionRule(state,p){
  requireValue(validV7Target(state,p),'行动目标不属于可执行规则。');
  const life=state.life,realm=realmFor(life),profile=life.cultivationProfile,m=modifiers(life),factor=p.stake==='high'?2:p.stake==='low'?0:1;
  const hasStoryTalent=id=>Boolean(life.birth.backgroundId)&&life.birth.talentIds.includes(id);
  const rule={days:30,items:{},gain:{},cultivation:0,injury:0,relationship:0,risk:0,realm:null,spiritCost:0,spiritGain:0,lifeLoss:0,lifeGain:0,exposure:0,checkKind:null,chance:100,failureInjury:0,art:null,worldTier:null,arrivalExposure:0,warnings:[]};
  const check=(kind,chance,failureInjury=1)=>{rule.checkKind=kind;rule.chance=clamp(Math.round(chance),5,99);rule.failureInjury=failureInjury;};
  switch(p.intent){
    case 'rest':
      if(p.approach==='extend'){
        rule.days=0;rule.items.elixir=1;rule.lifeGain=Math.max(5,Math.floor(realm.lifeLimit/20));
        if(profile.lifespanBonus+rule.lifeGain>1000000)rule.reason='此身已无法再吸纳延寿药力。';
      }else if(p.approach==='medicine'){
        rule.days=1;rule.items.medicine=1;rule.injury=-4;rule.spiritGain=60;
      }else{
        rule.days=p.approach==='retire'?Math.max(1,realm.practiceYears)*DAYS_PER_YEAR:30;
        rule.injury=-(2+(m.root.recovery??0)+(m.body.recovery??0));rule.spiritGain=p.approach==='retire'?1000:50;rule.exposure=-5;
      }
      break;
    case 'practice':{
      const steadyGain=1+Math.floor(realm.rank/2)+(m.root.practice??0)+(m.technique.practice??0);
      if(p.approach==='breakthrough'){
        const next=nextRealmFor(life);rule.days=next.minYears*DAYS_PER_YEAR;rule.items[next.material]=1;rule.realm=next.id;rule.cultivation=-next.threshold;rule.spiritCost=20+next.rank*5;
        if(life.cultivation<next.threshold)rule.reason='修为积累不足，须先修行。';
        if(life.injury>1)rule.reason='伤势过重，须先疗伤。';
        const surplus=Math.min(8,Math.floor((life.cultivation-next.threshold)/2));
        const insightBonus=hasStoryTalent('flash-wisdom')?6:0;
        check('breakthrough',70+m.insight*2+insightBonus+(m.root.breakthrough??0)+(m.body.breakthrough??0)+(m.technique.breakthrough??0)+(hasBenefit(life.birth,'past-memory')?5:0)+surplus-life.injury*8-(next.rank>=7?10:0),2);
        rule.warnings.push('突破需要实际材料与闭关年月；失败会损失材料、修为并受伤。');
        if(next.rank>=7)rule.warnings.push('高境冲关可能引来致命反噬。');
        if(m.relic==='quiet-lamp')rule.exposure=6;
      }else if(p.approach==='forbidden'){
        rule.days=Math.max(30,Math.floor(realm.practiceYears*DAYS_PER_YEAR/2));rule.items.supplies=1;rule.cultivation=steadyGain*3;rule.spiritCost=30;rule.exposure=12;
        rule.backlashLoss=Math.max(1,Math.ceil(realm.lifeLimit/100));
        check('forbidden',65+m.insight*2-m.exposed,2);
        rule.warnings.push('禁术失败会受伤、修为倒退，并使寿元上限降低'+rule.backlashLoss+'年。');
      }else if(p.approach==='intensive'){
        rule.days=Math.max(90,Math.floor(realm.practiceYears*DAYS_PER_YEAR/2));rule.items.supplies=1;rule.cultivation=steadyGain+1+(m.relic==='quiet-lamp'?1:0);rule.spiritCost=15+(m.root.intensiveCost??0);rule.failureInjury=1;
        check('practice',78+m.protection-(m.root.intensiveRisk??0)-m.exposed,1);
        if(m.relic==='quiet-lamp')rule.exposure=6;
      }else{
        rule.days=realm.practiceYears*DAYS_PER_YEAR;rule.cultivation=steadyGain;rule.spiritCost=5;
      }
      if(m.relic==='root-seed')rule.spiritCost+=3;
      rule.spiritCost+=m.technique.spiritCost??0;
      rule.days=Math.ceil(rule.days*(m.technique.timePercent??100)/100);
      rule.exposure+=(m.root.practiceExposure??0)+(m.technique.exposure??0);
      if(m.technique.risk){
        if(rule.checkKind)rule.chance=clamp(rule.chance-m.technique.risk,5,99);
        else check('practice',95+Math.floor(m.protection/2)-m.technique.risk-m.exposed,1);
      }else if(!rule.checkKind&&m.exposed)check('practice',95+Math.floor(m.protection/2)-m.exposed,1);
      break;
    }
    case 'explore':{
      const needed=Object.values(V7_REALMS).find(row=>row.material===p.targetId),bold=p.approach==='bold';
      if(needed&&realm.rank<needed.rank-1)rule.reason='境界尚不足以寻找此种材料。';
      const special=Boolean(needed)||p.targetId==='relic';
      rule.days=special?Math.max(30,Math.ceil(realm.exploreDays*(bold?0.5:1))):bold?30:90;
      if(special&&m.relic==='rusted-needle')rule.days=Math.max(1,Math.ceil(rule.days*0.8));
      if(needed&&needed.rank>1)rule.items.supplies=1;
      rule.gain[p.targetId]=p.targetId==='stones'?(bold?6:3)+realm.rank:(bold?2:1);
      rule.spiritCost=special?5:0;
      const breathBonus=!bold&&hasStoryTalent('sensitive-breath')?8:0;
      check('exploration',(bold?65:90)+breathBonus+m.fortune*2+(m.root.exploration??0)+(m.relic==='cracked-mirror'?10:0)+(hasBenefit(life.birth,'causal-compass')?12:0)+Math.floor(m.protection/2)-factor*3-m.exposed+fortuneCycleModifier(state),bold?2:1);
      if(bold&&hasStoryTalent('fortune-debt')){
        rule.gain[p.targetId]++;
        rule.failureInjury++;
      }
      if(m.relic==='cracked-mirror'&&bold){rule.spiritCost+=3;rule.exposure+=8;}
      if(m.relic==='rusted-needle'&&special)rule.exposure+=5;
      if(p.targetId==='relic')rule.exposure+=10;
      break;
    }
    case 'negotiate':
      rule.days=7;
      if(p.approach==='cooperate'){rule.items.supplies=1;rule.relationship=3;rule.gain.stones=2;}
      else if(p.approach==='bargain'){rule.items.stones=1;rule.gain.supplies=2;rule.relationship=1;}
      else if(p.approach==='black-market'){
        const item=(life.items.relic??0)>0?'relic':'artifact';rule.items[item]=1;rule.gain.stones=(item==='relic'?25:15)+realm.rank*8;rule.relationship=-2;rule.exposure=25;
        check('black-market',60+m.fortune*2-Math.floor(profile.exposure/5),profile.exposure>=80?5:2);
        rule.warnings.push('黑市可能吞货或引来追索；交易会提高遗物暴露程度。');
      }else{rule.relationship=-3;rule.gain.stones=2;rule.injury=1;check('combat',75+m.protection-m.exposed,1);}
      break;
    case 'fight':{
      rule.days=7;const guard=p.approach==='guard',desperate=p.approach==='desperate';rule.spiritCost=guard?10:desperate?25:15;
      rule.injury=Math.max(0,(guard?1:desperate?3:2)+factor-((life.items.artifact??0)>0?1:0)+(guard?0:m.root.assaultInjury??0));
      const assaultBonus=p.approach==='assault'&&hasStoryTalent('sword-bone')?8:0;
      rule.relationship=-5;rule.gain.stones=guard?2:5;check('combat',75+m.protection+assaultBonus-(desperate?15:0)-factor*5-m.exposed,2);
      if(guard&&(life.items.talisman??0)>0){rule.items.talisman=1;rule.injury=Math.max(0,rule.injury-1);}
      break;
    }
    case 'evade':
      rule.relationship=-1;
      if(p.approach==='blood'){
        rule.days=1;rule.lifeLoss=Math.max(1,Math.ceil(realm.lifeLimit/100));rule.spiritCost=10;rule.exposure=10;
        rule.warnings.push('血遁会使寿元上限降低'+rule.lifeLoss+'年，不会使当前年龄减少。');
      }else if(p.approach==='conceal'){rule.days=30;rule.exposure=-10;rule.spiritCost=5;}
      else{rule.days=14;check('exploration',82+m.protection-m.exposed,1);}
      break;
    case 'travel':{
      const destination=state.relatedEntities.find(entity=>entity.id===p.targetId),tier=worldTierForPlaceName(destination.name);
      if(WORLD_TRAVEL_APPROACHES.includes(p.approach)){
        const nextTier=profile.worldTier+1;
        if(tier===null||tier!==nextTier||nextTier>2)rule.reason='跨界目的地须明确为下一重中界或上界，不能越界或跳级。';
        rule.worldTier=Math.min(2,nextTier);
        const upper=nextTier===2;
        if(p.approach==='ascend'){
          rule.days=(upper?100:10)*DAYS_PER_YEAR;rule.items[upper?'thunderseal':'skykey']=1;rule.items.stones=upper?60:30;rule.spiritCost=30;rule.injury=1;
          if(realm.rank<(upper?8:5))rule.reason=upper?'飞升上界须修至大乘。':'飞升中界须修至化神。';
          check('world-crossing',80+m.insight*2,4);
        }else if(p.approach==='smuggle'){
          rule.days=(upper?20:2)*DAYS_PER_YEAR;rule.items.supplies=3;rule.items.stones=upper?120:60;rule.spiritCost=15;rule.arrivalExposure=25;
          if(realm.rank<(upper?5:2))rule.reason='当前境界不足以承受这段偷渡航路。';
          check('world-crossing',55+m.fortune*2-Math.floor(profile.exposure/5),4);
        }else if(p.approach==='rift'){
          rule.days=(upper?50:5)*DAYS_PER_YEAR;rule.items.artifact=1;rule.spiritCost=30;rule.injury=2;rule.arrivalExposure=15;rule.cultivation=-Math.min(life.cultivation,Math.max(1,realm.rank*2));
          if(realm.rank<(upper?4:1))rule.reason='当前境界不足以承受空间裂缝。';
          check('world-crossing',45+m.protection+m.fortune*2,6);rule.lethalFailure=true;
        }else{
          rule.days=(upper?10:1)*DAYS_PER_YEAR;rule.items.array=1;rule.items.stones=upper?90:45;rule.spiritCost=20;
          if(realm.rank<(upper?4:2))rule.reason='当前境界不足以承受古传送阵。';
          check('world-crossing',80+profile.arts.formations*2+m.insight,3);
        }
        rule.warnings.push('跨界需要实际资源与年月；失败会损失投入并受伤，成功后重新建立当地关系。');
        if(p.approach==='rift')rule.warnings.push('空间裂缝会损伤根基、消耗法器；严重失控可能致命。');
      }else{
        rule.days=p.approach==='road'?30:60;rule.items.supplies=1;
        if(tier!==null&&tier!==profile.worldTier)rule.reason='普通行路不能跨越界域，须另寻飞升、偷渡、裂缝或古阵。';
        if(p.approach==='wilderness')check('exploration',75+m.protection-m.exposed,1);
      }
      break;
    }
    case 'craft':{
      if(Object.hasOwn(GROWTH_TERMS,p.approach)){
        const e=profile.experience,how=p.approach;
        Object.assign(rule,GROWTH_TERMS[how],{items:{...GROWTH_TERMS[how].items}});
        if(how==='restore'&&hasStoryTalent('keen-memory')){
          rule.days=Math.ceil(rule.days/2);
          rule.talentId='keen-memory';
        }
        if(how==='repay'){
          if(e.commitment?.status!=='owed'||e.commitment.entityId!==p.targetId)rule.reason='须向当初校法之人归还约定的一份行粮。';
        }else if(!TECHNIQUES[e.activeTechniqueId].defective||e.repaired)rule.reason='当前功法无需修补。';
        else if((how==='diagnose')===e.lessons.includes('diagnosed'))rule.reason=how==='diagnose'?'脉络已经验明。':'须先验明功法缺处。';
        if(how==='pledge')rule.warnings.push('接受校法后，须向此人归还一份行粮。');
        break;
      }
      if(p.approach==='study'){rule.days=180;rule.items.stones=2;rule.gain.manual=1;rule.spiritCost=5;break;}
      const art=p.approach==='alchemy'?'alchemy':p.approach==='formation'?'formations':p.approach==='talisman'?'talismans':'forging';
      rule.art=art;rule.days=Math.max(30,realm.rank>=5?realm.practiceYears*30:30);rule.spiritCost=15;rule.gain[p.targetId]=1;
      if(art==='alchemy'){rule.items.herbs=p.targetId==='elixir'?8:3;rule.items.stones=p.targetId==='elixir'?12:3;}
      else if(art==='forging'){rule.items.iron=p.targetId==='artifact'?4:2;rule.items.stones=p.targetId==='artifact'?6:1;}
      else if(art==='formations'){rule.items.iron=2;rule.items.stones=6;}
      else{rule.items.herbs=1;rule.items.stones=3;}
      check('craft',65+m.insight*2+profile.arts[art]*2+(art==='alchemy'?(m.root.alchemy??0)+(m.body.alchemy??0)+(m.relic==='root-seed'?10:0):0),1);
      rule.warnings.push('炼制失败仍会消耗投入的材料，并可能受伤。');
      break;
    }
    case 'interact':
      rule.days=p.approach==='help'?1:0;
      if(p.approach==='help'){rule.items.supplies=1;rule.relationship=2;}
      break;
  }
  if(isExperienceLife(life)&&(p.intent==='fight'||p.intent==='evade'||p.intent==='negotiate'&&p.approach==='pressure')){
    const foe=state.relatedEntities.find(row=>row.id===p.targetId),rank=foe.experience?.realmId,known=rank!==undefined;
    // An unknown opponent never acquires an invented realm; use a conservative
    // baseline until a scene explicitly establishes their absolute strength.
    const gap=known?clamp(realm.rank-V7_REALMS[rank].rank,-4,4):-1;
    if(rule.checkKind){
      rule.chance=clamp(rule.chance+gap*14,5,99);
      rule.failureInjury=clamp(rule.failureInjury-gap,1,6);
      if(rule.checkKind==='combat')rule.injury=clamp(rule.injury-gap,0,9);
    }
    const band=!known?'unknown':!rule.checkKind||rule.chance>=78?'favorable':rule.chance>=48?'even':'dangerous';
    const note=state.currentScene?.story?.opponent;
    rule.outlook={band,reason:!known?'未辨明对手境界，按谨慎估计行动。':('对手'+V7_REALMS[rank].name+'，你是'+realm.name+'。'+(!rule.checkKind?'此法以实际代价避开较量。':gap>0?'境界占优。':gap<0?'对方境界更高。':'双方境界相当。')),...(note?.entityId===foe.id?Object.fromEntries(['purpose','condition'].filter(k=>note[k]).map(k=>[k,note[k]])):{})};
  }
  for(const [id,count] of Object.entries(rule.items))if((life.items[id]??0)<count)rule.reason='缺少'+ITEMS[id]+'。';
  for(const [id,count] of Object.entries(rule.gain))if((life.items[id]??0)-(rule.items[id]??0)+count>9999)rule.reason='行囊已经装不下。';
  if(rule.cultivation>0&&life.cultivation+rule.cultivation>9999)rule.reason='当前修为已积累至上限。';
  if(profile.spirit<rule.spiritCost)rule.reason='灵力不足，须先调息。';
  if(rule.injury>0)rule.warnings.push('将增加'+rule.injury+'点伤势；伤势达到10即死亡。');
  if(rule.checkKind&&rule.checkKind!=='breakthrough'&&rule.failureInjury>0)rule.warnings.push('此行动有受伤风险。');
  if(rule.exposure>0)rule.warnings.push('此行动会留下灵息痕迹，提高暴露程度。');
  if(life.ageDays+rule.days>=(life.lifeLimit-rule.lifeLoss)*DAYS_PER_YEAR)rule.warnings.push('此行动无法在当前寿元上限前完成，途中寿尽将无法得到成果。');
  return rule;
}

export function resolveV7Action(life,action,rule,roll,turnId){
  const next=clone(life),profile=next.cultivationProfile;
  for(const [id,count] of Object.entries(rule.items))next.items[id]-=count;
  profile.spirit-=rule.spiritCost;
  let cause=null;
  if(rule.lifeLoss){profile.lifespanLoss+=rule.lifeLoss;cause='blood-escape';}
  if(rule.lifeGain){profile.lifespanBonus+=rule.lifeGain;cause='longevity-elixir';}
  next.lifeLimit=lifespanLimitFor(next);
  const beforeTime=Math.max(0,next.lifeLimit*DAYS_PER_YEAR-next.ageDays),elapsedDays=Math.min(beforeTime,rule.days);
  next.ageDays+=elapsedDays;
  let death=next.ageDays>=next.lifeLimit*DAYS_PER_YEAR?{cause:'lifespan'}:null;
  let check=null;
  if(!death){
    const success=rule.checkKind?roll<rule.chance:true;
    if(rule.checkKind)check={kind:rule.checkKind,roll,chance:rule.chance,success};
    profile.exposure=clamp(profile.exposure+rule.exposure,0,100);
    let injury=rule.injury;
    if(!success){
      injury+=rule.failureInjury;
      if(rule.lethalFailure&&roll>=98)injury=10;
      if(rule.checkKind==='breakthrough'){
        next.cultivation=Math.max(0,next.cultivation-Math.max(1,Math.ceil(V7_REALMS[rule.realm].threshold/2)));
        if(V7_REALMS[rule.realm].rank>=7&&roll>=98)injury=10;
      }
      if(rule.checkKind==='forbidden'){
        profile.lifespanLoss+=rule.backlashLoss;next.lifeLimit=lifespanLimitFor(next);cause='forbidden-backlash';
        next.cultivation=Math.max(0,next.cultivation-Math.max(1,Math.floor(rule.cultivation/2)));
      }
    }
    next.injury=clamp(next.injury+injury,0,10);
    death=next.ageDays>=next.lifeLimit*DAYS_PER_YEAR?{cause:'lifespan'}:next.injury>=10?{cause:'injury'}:null;
    if(!death){
      if(success){
        for(const [id,count] of Object.entries(rule.gain))next.items[id]=(next.items[id]??0)+count;
        next.cultivation+=rule.cultivation;
        if(rule.art)profile.arts[rule.art]=Math.min(20,profile.arts[rule.art]+1);
        if(rule.realm){next.realm=rule.realm;next.lifeLimit=lifespanLimitFor(next);profile.maxSpirit=maximumSpiritFor(next);profile.spirit=profile.maxSpirit;cause='breakthrough';}
        // Local standing starts anew; crossing does not erase actual bonds
        // with known people. Fresh destination entities have no relation yet.
        if(rule.worldTier!==null){profile.worldTier=rule.worldTier;profile.exposure=rule.arrivalExposure;}
      }
      profile.spirit=Math.min(profile.maxSpirit,profile.spirit+rule.spiritGain);
      if(rule.relationship)next.relations[action.targetId]=clamp((next.relations[action.targetId]??0)+rule.relationship,-100,100);
    }
  }
  if(isExperienceLife(life))profile.experience=experienceAfterAction(profile.experience,next.realm!==life.realm,{action,turnId,death});
  const result={version:7,check,lifespanChange:{years:next.lifeLimit-life.lifeLimit,cause}};
  if(rule.talentId)result.talentId=rule.talentId;
  return {nextLife:next,elapsedDays,death,result};
}
