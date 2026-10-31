import { assertPlainData, canonicalStringify, sha256 } from './identity.js';
import {buildOpeningBrief,advanceExperienceStory} from './experience-story.js';
import { isExperienceLife, advancesEvent } from './experience.js';
import { DAYS_PER_YEAR } from './model.js';
import { ROOTS, RELICS, TECHNIQUES, realmFor, fortuneCycleModifier } from './cultivation-rules.js';
import { STORY_PATTERNS, STORY_BEATS, STORY_NPC_TRAITS as TRAITS, STORY_ANNOTATION_SCHEMA, validateStoryAnnotation } from './story-annotation.js';
export { STORY_PATTERNS, STORY_BEATS, STORY_ANNOTATION_SCHEMA, validateStoryAnnotation };

// The director stores a bounded working memory. Immutable scenes and receipts
// remain in the archive; leaving this working set never means death or closure.
const LIMITS=Object.freeze({causes:10,npcs:5,enemies:5,clues:3});
const SCOPES=Object.freeze({mortal:'乡野与市镇',qi:'郡县与坊市',foundation:'地域宗门',golden:'多方宗门',nascent:'一域秩序',spirit:'跨域势力',void:'界域通道',unity:'诸域盟约',mahayana:'上界边缘',tribulation:'上界规则',immortal:'更高天地'});
const SEEDS=Object.freeze([
  {destiny:'循自身所见，走出不依附既定道统的修行路',motif:'逆行灵痕',mystery:'为何相隔遥远的灵脉会留下相同的逆行痕迹？'},
  {destiny:'辨明机缘背后的代价，自定取舍与修行之道',motif:'空名旧契',mystery:'为何古老灵契都为一位无人记得的人留着空名？'},
  {destiny:'在势力更替中守住自己的求道方向',motif:'错时星影',mystery:'为何不同地域的星影会指向尚未发生的同一时刻？'},
  {destiny:'追问修行秩序的来处，亲自选择是否改变它',motif:'无源道鸣',mystery:'为何突破关口的道鸣中会出现没有源头的回应？'},
]);
const copy=value=>JSON.parse(JSON.stringify(value));
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const chars=value=>Array.from(value);
const clip=(value,max)=>chars(String(value??'').replace(/\s+/gu,' ').trim()).slice(0,max).join('');
const keys=(value,required,optional=[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('STORY_DIRECTOR_INVALID');};
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER-1)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail('STORY_DIRECTOR_INVALID');};
const text=(value,max,empty=false)=>{if(typeof value!=='string'||(!empty&&!value.trim())||chars(value).length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value))fail('STORY_DIRECTOR_INVALID');};
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/u.test(value))fail('STORY_DIRECTOR_INVALID');};
const lifeYear=life=>Math.floor(life.ageDays/DAYS_PER_YEAR);
const rowId=(scene,index)=>scene.memoryDeltas[index].referenceId??'m:'+sha256(scene.id+':'+index).slice(0,32);
const openingSeed=(life,seed)=>parseInt(sha256(String(seed)+':'+(life.birth?.originId??'wanderer')).slice(0,8),16)>>>0;

function schedule(d,life,turnId,receipt) {
  const marked=isExperienceLife(life),clock=marked?d.eventCount+(advancesEvent(receipt)?1:0):turnId;
  const luck=life.birth?.cultivationProfile?fortuneCycleModifier({life,turnId:turnId-1,director:{eventCount:clock}}):((Math.floor((turnId-1)/20)+d.seed)%5-2)*3,check=receipt?.cultivationResult?.check,streak=check?(check.success?0:d.pacing.setbackStreak+1):d.pacing.setbackStreak;
  const fortuneClock=marked?clock:clock-1;
  return {...d.pacing,turnId,volume:Math.floor(fortuneClock/50)+1,plotDue:clock>=d.pacing.nextBeat,beatOverdue:clock-d.pacing.lastBeat>=20,fortuneDue:fortuneClock>0&&fortuneClock%20===0,eraDue:Math.floor(clock/30)>Math.floor(d.pacing.lastEra/30),volumeDue:clock>0&&clock%50===0,canClimax:clock-d.pacing.lastBeat>=10,fortunePhase:luck>0?'机缘初露':luck<0?'代价浮现':'局势松动',fortuneBand:luck>0?'high':luck<0?'low':'recovering',opportunityDue:streak>=3,opportunityRequired:streak>=5,scope:SCOPES[life.realm]??'当前地域'};
}

export function createStoryDirector(life,seed=0) {
  assertPlainData(life);integer(seed,0,4294967295);integer(life.ageDays);
  const seeded=openingSeed(life,seed),theme=SEEDS[seeded%SEEDS.length],birth=life.birth?.cultivationProfile,relic=RELICS[birth?.relicId],root=ROOTS[birth?.rootId];
  const d={version:7,seed:seeded,turnId:0,resolvedCount:0,...(isExperienceLife(life)?{eventCount:0}:{}),
    destiny:{id:'destiny:'+seeded,text:clip((relic?'伴生的'+relic.name+'牵动旧因果；':'')+theme.destiny,60),motif:theme.motif},
    mystery:{id:'mystery:'+seeded,question:clip(relic?`为何${relic.name}会回应${theme.motif}，而你的${root?.name??'灵根'}能感知其回声？`:theme.mystery,80),progress:0},
    currentGoal:'先辨清眼前局势，再决定去留',mainQuest:null,sideQuests:[],memory:{causes:[],npcs:[],enemies:[],clues:[]},
    background:{count:0,text:''},world:{year:lifeYear(life),tier:life.cultivationProfile?.worldTier??0,location:'出生地',faction:'尚未相识',summary:'尚无已确认的世局变化。'},
    archive:{throughTurn:0,text:'此生尚未落笔。',reasons:[]},
    pacing:{turnId:1,arc:1,startedAt:1,lastBeat:0,nextBeat:10+seeded%11,lastEra:0,pattern:'discovery',completedPatterns:[],sceneHashes:[],setbackStreak:0,pressure:0},
  };
  d.pacing=schedule(d,life,1);
  if(isExperienceLife(life))d.currentGoal=buildOpeningBrief({life,director:d,phase:'opening'}).goal;
  return validateStoryDirector(d);
}

function groundedTraits(scene) {
  const traits=new Map();
  for(const npc of scene.story?.npcs??[]){
    const entity=scene.entities.find(row=>row.id===npc.entityId&&row.kind==='person'),block=scene.blocks[npc.anchor];
    if(!entity||!block)fail('STORY_ANNOTATION_INVALID');
    const mentioned=block.text.includes(entity.name)||block.kind==='dialogue'&&block.speaker===entity.id;
    // Optional characterization is useful only when the scene shows it. Ignore
    // unsupported additions instead of rejecting play or replacing prior facts.
    traits.set(npc.entityId,Object.fromEntries(TRAITS.filter(key=>mentioned&&npc[key]&&block.text.includes(npc[key])).map(key=>[key,npc[key]])));
  }
  return traits;
}

export function validateStoryDirector(d,{turnId,life}={}) {
  assertPlainData(d);keys(d,['version','seed','turnId','resolvedCount','destiny','mystery','currentGoal','mainQuest','sideQuests','memory','background','world','archive','pacing'],['eventCount']);
  if(life&&isExperienceLife(life)!==Object.hasOwn(d,'eventCount'))fail('STORY_DIRECTOR_INVALID');
  if(Object.hasOwn(d,'eventCount'))integer(d.eventCount,0,Math.max(0,d.turnId-1));
  if(d.version!==7)fail('STORY_DIRECTOR_INVALID');integer(d.seed,0,4294967295);integer(d.turnId);integer(d.resolvedCount);if(turnId!==undefined&&d.turnId!==turnId)fail('STORY_DIRECTOR_INVALID');
  keys(d.destiny,['id','text','motif']);id(d.destiny.id);text(d.destiny.text,60);text(d.destiny.motif,12);
  keys(d.mystery,['id','question','progress']);id(d.mystery.id);text(d.mystery.question,80);integer(d.mystery.progress,0,9);
  text(d.currentGoal,60);
  const quest=q=>{keys(q,['id','entityId','kind','text','status','turnId']);id(q.id);id(q.entityId);if(!['promise','clue'].includes(q.kind)||!['available','accepted'].includes(q.status))fail('STORY_DIRECTOR_INVALID');text(q.text,90);integer(q.turnId,1,d.turnId);};
  if(d.mainQuest!==null)quest(d.mainQuest);if(!Array.isArray(d.sideQuests)||d.sideQuests.length>2)fail('STORY_DIRECTOR_INVALID');d.sideQuests.forEach(quest);
  const questIds=[d.mainQuest,...d.sideQuests].filter(Boolean).map(q=>q.id);if(new Set(questIds).size!==questIds.length)fail('STORY_DIRECTOR_INVALID');
  keys(d.memory,Object.keys(LIMITS));
  for(const [kind,limit]of Object.entries(LIMITS)){
    const rows=d.memory[kind];if(!Array.isArray(rows)||rows.length>limit)fail('STORY_DIRECTOR_INVALID');const seen=new Set();
    for(const row of rows){
      const fields=kind==='causes'?['turnId','text']:kind==='npcs'?['id','name','status','text','turnId','introducedAt',...TRAITS]:kind==='enemies'?['id','name','stage','status','text','turnId']:['id','entityId','text','status','turnId'];
      keys(row,fields);integer(row.turnId,1,d.turnId);text(row.text,100);
      const key=kind==='causes'?row.turnId:row.id;if(seen.has(key))fail('STORY_DIRECTOR_INVALID');seen.add(key);
      if(kind!=='causes')id(row.id);
      if(['npcs','enemies'].includes(kind)){text(row.name,60);if(!['alive','unknown','dead'].includes(row.status))fail('STORY_DIRECTOR_INVALID');}
      if(kind==='enemies')integer(row.stage,0,4);
      if(kind==='npcs'){integer(row.introducedAt,1,row.turnId);for(const key of TRAITS)text(row[key],28,true);}
      if(kind==='clues'){id(row.entityId);if(row.status!=='open')fail('STORY_DIRECTOR_INVALID');}
    }
  }
  keys(d.background,['count','text']);integer(d.background.count);text(d.background.text,180,true);
  keys(d.world,['year','tier','location','faction','summary']);integer(d.world.year);integer(d.world.tier,0,2);text(d.world.location,120);text(d.world.faction,60);text(d.world.summary,200);
  keys(d.archive,['throughTurn','text','reasons']);integer(d.archive.throughTurn,0,d.turnId);text(d.archive.text,300);if(!Array.isArray(d.archive.reasons)||d.archive.reasons.some(reason=>!['periodic','volume','context-pressure'].includes(reason)))fail('STORY_DIRECTOR_INVALID');
  const p=d.pacing;keys(p,['turnId','arc','startedAt','lastBeat','nextBeat','lastEra','pattern','completedPatterns','sceneHashes','volume','plotDue','beatOverdue','fortuneDue','eraDue','volumeDue','canClimax','fortunePhase','fortuneBand','scope','setbackStreak','pressure','opportunityDue','opportunityRequired']);
  integer(p.turnId,1);integer(p.arc,1);integer(p.startedAt,1,(d.eventCount??d.turnId)+1);integer(p.lastBeat,0,d.eventCount??d.turnId);integer(p.nextBeat,p.lastBeat+10,p.lastBeat+20);integer(p.lastEra,0,d.eventCount??d.turnId);integer(p.volume,1);
  if(p.turnId!==d.turnId+1||!STORY_PATTERNS.includes(p.pattern)||!Array.isArray(p.completedPatterns)||p.completedPatterns.length>3||p.completedPatterns.some(pattern=>!STORY_PATTERNS.includes(pattern))||!Array.isArray(p.sceneHashes)||p.sceneHashes.length>4||p.sceneHashes.some(hash=>!/^[a-f0-9]{64}$/u.test(hash)))fail('STORY_DIRECTOR_INVALID');
  integer(p.setbackStreak,0,10);integer(p.pressure,0,10);if(!['high','low','recovering','settling'].includes(p.fortuneBand))fail('STORY_DIRECTOR_INVALID');
  for(const key of ['plotDue','beatOverdue','fortuneDue','eraDue','volumeDue','canClimax','opportunityDue','opportunityRequired'])if(typeof p[key]!=='boolean')fail('STORY_DIRECTOR_INVALID');
  text(p.fortunePhase,20);text(p.scope,20);if(bytes(d)>16000)fail('STORY_DIRECTOR_INVALID');
  return d;
}

function background(d,rows,kind) {
  if(!rows.length)return;
  d.background.count+=rows.length;
  const notes=rows.map(row=>kind==='npcs'||kind==='enemies'?(row.name+'转入背景，'+(row.status==='dead'?'已有死亡记录':'生死未新增变化')):row.text);
  d.background.text=clip([...notes,d.background.text].filter(Boolean).join('；'),180);
}
function upsert(d,kind,row) {
  const rows=d.memory[kind];const old=rows.findIndex(existing=>existing.id===row.id);if(old>=0)rows.splice(old,1);
  rows.push(row);if(rows.length>LIMITS[kind]){
    const eligible=kind==='npcs'?rows.findIndex(npc=>npc.status==='dead'||d.turnId-npc.introducedAt>=3):0;
    background(d,rows.splice(eligible<0?rows.length-1:eligible,rows.length-LIMITS[kind]),kind);
  }
}
function addQuest(d,row) {
  if([d.mainQuest,...d.sideQuests].some(q=>q?.id===row.id))return;
  const quest={...row,status:row.kind==='promise'?'accepted':'available'};
  if(!d.mainQuest)d.mainQuest=quest;else{d.sideQuests.push(quest);if(d.sideQuests.length>2)background(d,d.sideQuests.splice(0,d.sideQuests.length-2),'quest');}
}
function archiveText(d,life,scene) {
  const profile=life.birth?.cultivationProfile,root=ROOTS[profile?.rootId]?.name??'待辨',relic=RELICS[profile?.relicId]?.name??'未录',technique=TECHNIQUES[profile?.techniqueId]?.name??'未录',realm=realmFor(life)?.name??life.realm;
  return clip([`${life.name}，${realm}，${lifeYear(life)}岁，第${d.turnId}回`,'灵根：'+root,'功法：'+technique,'遗物：'+relic,'势力：'+clip(d.world.faction,12),'地点：'+clip(scene?.location??d.world.location,18),'主线：'+clip(d.mainQuest?.text??'未承诺新委托',32),'目标：'+clip(d.currentGoal,24),'因果：'+clip(d.memory.causes.at(-1)?.text??'尚未入世',48),'命途：'+clip(d.destiny.text,24),'悬疑：'+clip(d.mystery.question,24),d.background.text?'旧事：'+clip(d.background.text,24):''].filter(Boolean).join('；'),300);
}

function annualSummary(d,life,result,range) {
  const enemies=d.memory.enemies.filter(row=>row.status!=='dead').slice(-2).map(row=>clip(row.name,8)).join('、')||'未确认';
  const relations=d.memory.npcs.filter(row=>row.status!=='dead').slice(-2).map(row=>clip(row.name,8)+(Object.hasOwn(life.relations??{},row.id)?'关系'+life.relations[row.id]:'尚待了解')).join('、')||'尚无';
  return clip([`第${range}年，${clip(d.world.location,16)}`,'主线：'+clip(d.mainQuest?.text??'尚未承诺委托',26),'目标：'+clip(d.currentGoal,24),'敌手：'+enemies,'关系：'+relations,'世局：'+clip(result,46)].join('；'),200);
}

export function advanceStoryDirector(director,life,receipt,scene,turnId) {
  validateStoryDirector(director,{life});assertPlainData(life);assertPlainData(receipt);if(turnId!==director.turnId+1)fail('STORY_DIRECTOR_INVALID');
  const d=copy(director);d.turnId=turnId;
  const marked=isExperienceLife(life),event=marked&&advancesEvent(receipt,scene);if(event)d.eventCount++;
  const clock=marked?d.eventCount:turnId,advance=!marked||event;
  const check=receipt.cultivationResult?.check;
  if(check){d.pacing.setbackStreak=check.success?0:Math.min(10,d.pacing.setbackStreak+1);d.pacing.pressure=Math.max(0,Math.min(10,d.pacing.pressure+(check.success?-2:1)));}
  d.world.tier=life.cultivationProfile?.worldTier??0;
  if(scene){
    assertPlainData(scene);if(scene.story)validateStoryAnnotation(scene.story,scene.blocks.length);const shownTraits=groundedTraits(scene);
    const blocks=scene.blocks.map(block=>block.text),body=blocks.join('\n'),annotation=scene.story??{pattern:d.pacing.pattern,beat:'progress',anchors:[0]};
    const fresh=scene.memoryDeltas.filter(row=>!row.referenceId&&blocks.some(block=>block.includes(row.text)));
    const result=fresh[0]?.text??blocks[0],decision=receipt.action?.label;
    d.memory.causes.push({turnId,text:clip((decision?'选择“'+clip(decision,28)+'”；':'')+result,100)});
    if(d.memory.causes.length>10)background(d,d.memory.causes.splice(0,d.memory.causes.length-10),'causes');
    for(const entity of scene.entities){
      const spoken=scene.blocks.some(block=>block.kind==='dialogue'&&block.speaker===entity.id),mentioned=body.includes(entity.name);
      if(!spoken&&!mentioned)continue;
      const fact=fresh.find(row=>row.entityId===entity.id),prior=d.memory.npcs.find(row=>row.id===entity.id);
      const status=prior?.status==='dead'?'dead':entity.status??prior?.status??'unknown';
      const traits=shownTraits.get(entity.id);
      if(entity.kind==='person')upsert(d,'npcs',{id:entity.id,name:entity.name,status,text:clip(fact?.text??blocks.find(block=>block.includes(entity.name))??result,80),turnId,introducedAt:prior?.introducedAt??turnId,...Object.fromEntries(TRAITS.map(key=>[key,traits?.[key]||prior?.[key]||'']))});
      const opponent=d.memory.enemies.find(row=>row.id===entity.id),challenged=receipt.action?.targetId===entity.id&&['fight','evade'].includes(receipt.action.intent);
      if(opponent||challenged){
        const deeper=opponent&&fact&&['revelation','climax'].includes(annotation.beat)&&annotation.anchors.some(anchor=>blocks[anchor].includes(fact.text));
        upsert(d,'enemies',{id:entity.id,name:entity.name,stage:Math.min(4,(opponent?.stage??0)+(deeper?1:0)),status:entity.kind==='person'?status:'unknown',text:clip(fact?.text??result,80),turnId});
      }
    }
    for(const [index,row]of scene.memoryDeltas.entries()){
      if(!['promise','clue'].includes(row.kind))continue;
      const reference=rowId(scene,index);
      if(row.referenceId){
        const known=d.memory.clues.some(clue=>clue.id===reference)||[d.mainQuest,...d.sideQuests].some(q=>q?.id===reference&&q.kind==='clue');
        if(known&&row.kind==='clue'&&row.status==='resolved')d.resolvedCount++;
        d.memory.clues=d.memory.clues.filter(clue=>clue.id!==reference);
        if(d.mainQuest?.id===reference)d.mainQuest=null;
        d.sideQuests=d.sideQuests.filter(q=>q.id!==reference);
        background(d,[{text:row.text}],row.status);
      }else if(fresh.includes(row)){
        const bounded={id:reference,entityId:row.entityId,text:clip(row.text,90),turnId};
        if(row.kind==='clue')upsert(d,'clues',{...bounded,status:'open'});
        // An offered favor or clue is information. Only a player's paid pledge binds a marked life.
        if(!marked||row.kind==='clue')addQuest(d,{...bounded,kind:row.kind});
      }
    }
    if(!d.mainQuest&&d.sideQuests.length)d.mainQuest=d.sideQuests.shift();
    d.currentGoal=clip(d.mainQuest?.text??(receipt.action?.intent==='interact'&&['decline','leave'].includes(receipt.action.approach)?'已结束当前互动，自定下一步':'辨明眼前变化，自定下一步'),60);
    if(marked)d.currentGoal=clip(advanceExperienceStory(d.currentGoal,receipt,scene,life),60);
    const anchors=annotation.anchors.map(anchor=>blocks[anchor]).join('\n');
    if(['revelation','resolution'].includes(annotation.beat)&&anchors.includes(d.destiny.motif)&&fresh.some(row=>row.kind==='clue'&&anchors.includes(row.text)))d.mystery.progress=Math.min(9,d.mystery.progress+1);
    if(advance&&clock-d.pacing.lastBeat>=10&&annotation.beat!=='progress'){
      d.pacing.lastBeat=clock;d.pacing.nextBeat=clock+10+(d.seed+d.pacing.arc)%11;
      if(annotation.beat==='resolution'){
        d.pacing.completedPatterns=[...d.pacing.completedPatterns,annotation.pattern].slice(-3);d.pacing.arc++;d.pacing.startedAt=clock+1;
      }
    }
    d.pacing.pattern=annotation.pattern;
    const worldFacts=fresh.filter(row=>scene.entities.some(entity=>entity.id===row.entityId&&['faction','place'].includes(entity.kind)));
    d.world.location=scene.location;
    const faction=scene.entities.find(entity=>entity.kind==='faction'&&body.includes(entity.name));if(faction)d.world.faction=faction.name;
    if(advance&&Math.floor(clock/30)>Math.floor(d.pacing.lastEra/30)&&worldFacts.length&&annotation.beat!=='progress')d.pacing.lastEra=clock;
    if(lifeYear(life)!==d.world.year){
      const from=d.world.year+1,to=lifeYear(life),range=from===to?String(to):from+'至'+to;
      d.world={...d.world,year:to,summary:annualSummary(d,life,worldFacts.map(row=>row.text).join('；')||result,range)};
    }else if(worldFacts.length)d.world.summary=annualSummary(d,life,worldFacts.map(row=>row.text).join('；'),d.world.year);
    d.pacing.sceneHashes=[...d.pacing.sceneHashes,sha256(canonicalStringify(scene.blocks))].slice(-4);
  }else if(receipt.death){
    d.memory.causes.push({turnId,text:receipt.death.cause==='lifespan'?'此生在真实寿元耗尽后结束。':'此生在真实伤势达到终局后结束。'});
    if(d.memory.causes.length>10)background(d,d.memory.causes.splice(0,d.memory.causes.length-10),'causes');
  }
  const reasons=[...(advance&&clock%30===0?['periodic']:[]),...(advance&&clock%50===0?['volume']:[]),...(bytes(d)>3000?['context-pressure']:[])];
  if(reasons.length)d.archive={throughTurn:turnId,text:archiveText(d,life,scene),reasons};
  if(bytes(d)>14000){for(const rows of Object.values(d.memory))for(const row of rows)row.text=clip(row.text,60);for(const npc of d.memory.npcs)for(const key of TRAITS)npc[key]=clip(npc[key],24);}
  while(bytes(d)>15500&&d.memory.causes.length)background(d,d.memory.causes.splice(0,1),'causes');
  d.pacing=schedule(d,life,turnId+1);
  return validateStoryDirector(d);
}

export function buildDirectorContext(director,life,receipt,turnId) {
  validateStoryDirector(director,{life});if(turnId!==director.turnId+1)fail('STORY_DIRECTOR_INVALID');
  const d=copy(director);d.pacing=schedule(d,life,turnId,receipt);
  // Model input is a compact projection, never a replacement of saved history.
  d.archive.text=clip(d.archive.text,100);d.world.summary=clip(d.world.summary,80);d.background.text=clip(d.background.text,60);
  for(const rows of Object.values(d.memory))for(const row of rows)row.text=clip(row.text,36);
  for(const npc of d.memory.npcs)for(const key of TRAITS)npc[key]=clip(npc[key],16);
  for(const quest of [d.mainQuest,...d.sideQuests].filter(Boolean))quest.text=clip(quest.text,48);
  const trim=[()=>d.memory.causes.shift(),()=>d.memory.npcs.shift(),()=>d.memory.enemies.shift(),()=>d.memory.clues.shift(),()=>d.sideQuests.shift()];
  const lists=[d.memory.causes,d.memory.npcs,d.memory.enemies,d.memory.clues,d.sideQuests];
  for(let i=0;bytes(d)>3000&&i<lists.length;i++)while(bytes(d)>3000&&lists[i].length)trim[i]();
  if(bytes(d)>3000){d.archive.text=clip(d.archive.text,45);d.world.summary=clip(d.world.summary,45);d.background.text='';d.pacing.sceneHashes=d.pacing.sceneHashes.slice(-2);d.currentGoal=clip(d.currentGoal,24);}
  if(bytes(d)>3000)fail('STORY_DIRECTOR_TOO_LARGE');
  return validateStoryDirector(d);
}

export function validateDirectorScene(scene,context) {
  if(!context.director)return scene;
  validateStoryDirector(context.director,{turnId:context.identity.turnId-1});
  if(!scene.story)fail('STORY_ANNOTATION_INVALID');validateStoryAnnotation(scene.story,scene.blocks.length);
  groundedTraits(scene);
  // Length, menu variety and pacing remain generation guidance. The game rules
  // check action availability; editorial preferences must not stop a valid turn.
  return scene;
}
