import {exactKeys} from './schema.js';
import {realmFor,V7_REALMS} from './cultivation-rules.js';
import {ITEMS} from './model.js';
import {DUEL_ENCOUNTERS} from './duel-encounters.js';

export const duelNodes=['duel-book','duel-arena','duel-tactics','duel-victory','duel-retreat'];

const byId=id=>DUEL_ENCOUNTERS.find(e=>e.id===id);

export function nextAvailableDuel(state){
 if(state?.events?.version!==2||!state.events.prologue?.help)return null;
 const won=new Set(state.events.duels?.won??[]);
 const rank=realmFor(state.life).rank,tier=state.life.cultivationProfile.worldTier;
 return DUEL_ENCOUNTERS.find(e=>!won.has(e.id)&&rank>=V7_REALMS[e.realm].rank&&tier>=e.tier)??null;
}

export function duelEntities(state,prefix){
 const activeId=state.events.duels?.active?.id;
 const lastWonId=state.events.duels?.won?.at(-1);
 const enc=byId(activeId)??(state.events.node==='duel-victory'?byId(lastWonId):nextAvailableDuel(state))??DUEL_ENCOUNTERS[0];
 return [{id:prefix+'foe',name:enc.name,kind:'person',status:'alive'}];
}

export function validateDuels(events,life){
 const d=events.duels,node=events.node;
 if(events.version!==2)throw Error('旧版人生不支持问道斗法。');
 if(d!==undefined){
  exactKeys(d,['won','active']);
  if(!Array.isArray(d.won)||new Set(d.won).size!==d.won.length||d.won.some(id=>!byId(id)))throw Error('斗法胜绩记录无效。');
  if(d.active!==null){
   const a=d.active;
   exactKeys(a,['id','round','foeHp','foeMax','foeGuard','playerGuard','intentIdx','momentum','log']);
   const enc=byId(a.id);
   if(!enc||d.won.includes(a.id)||!Number.isInteger(a.round)||a.round<1||a.round>40||
      !Number.isInteger(a.foeHp)||a.foeHp<1||a.foeHp>enc.foeMax||a.foeMax!==enc.foeMax||
      !Number.isInteger(a.foeGuard)||a.foeGuard<0||a.foeGuard>40||
      !Number.isInteger(a.playerGuard)||a.playerGuard<0||a.playerGuard>30||
      !Number.isInteger(a.intentIdx)||a.intentIdx<0||a.intentIdx>=enc.intents.length||
      !Number.isInteger(a.momentum)||a.momentum<0||a.momentum>4||
      typeof a.log!=='string'||a.log.length>80)throw Error('斗法战局状态无效。');
   if(life&&(realmFor(life).rank<V7_REALMS[enc.realm].rank||life.cultivationProfile.worldTier<enc.tier))throw Error('当前境界尚不能赴此战局。');
  }
 }
 if(['duel-arena','duel-tactics'].includes(node)&&!d?.active)throw Error('当前没有进行中的斗法。');
 if(node==='duel-victory'&&!d?.won?.length)throw Error('尚无斗法胜绩。');
}

function playerPower(life,events){
 const rank=realmFor(life).rank;
 const base=14+rank*5+life.birth.attributes.constitution+life.birth.attributes.insight;
 const artBonus=Math.floor((life.cultivationProfile.arts.forging+life.cultivationProfile.arts.talismans)/2);
 const repairedBonus=life.cultivationProfile.experience?.repaired?4:0;
 const formBonus=events.forms?.known?3:0;
 return base+artBonus+repairedBonus+formBonus;
}

function resolveTurn(enc,a,move,life,events){
 const intent=enc.intents[a.intentIdx];
 const power=playerPower(life,events);
 const form=events.forms?.known??null;
 let dmgToFoe=0,newPlayerGuard=0,foeGuard=a.foeGuard;
 let momentum=a.momentum,injury=0,spiritCost=4,items={};
 let logCode=move;

 if(move==='strike'){
  const bonus=intent.kind==='open'?Math.round(power*0.6):0;
  const raw=power+bonus;
  const absorbed=Math.min(foeGuard,raw);
  dmgToFoe=Math.max(4,raw-absorbed);
  foeGuard=Math.max(0,foeGuard-absorbed);
  momentum=Math.min(4,momentum+1);
  spiritCost=4;
 }else if(move==='burst'){
  const raw=Math.round(power*2.1)+(intent.kind==='open'?Math.round(power*0.5):0);
  dmgToFoe=Math.max(10,raw-Math.floor(foeGuard/2));
  foeGuard=0;
  momentum=0;
  spiritCost=10;
 }else if(move==='defend'){
  newPlayerGuard=14+(form==='ward'?8:0);
  if(form==='listen'&&intent.kind==='heavy'){
   dmgToFoe=Math.round(power*0.9);
   logCode='counter-listen';
  }else if(form==='ward'&&intent.kind==='heavy'){
   dmgToFoe=Math.round(power*0.7);
   logCode='counter-ward';
  }
  momentum=Math.min(4,momentum+(intent.kind==='heavy'?2:1));
  spiritCost=3;
 }else if(move==='talisman'){
  items={talisman:1};
  dmgToFoe=Math.round(power*1.8);
  foeGuard=0;
  momentum=Math.min(4,momentum+1);
  spiritCost=4;
 }else if(move==='artifact'){
  items={artifact:1};
  dmgToFoe=Math.round(power*2.4);
  foeGuard=0;
  newPlayerGuard=12;
  spiritCost=6;
 }else if(move==='medicine'){
  items={medicine:1};
  newPlayerGuard=10;
  injury=-3;
  spiritCost=0;
 }

 const nextFoeHp=Math.max(0,a.foeHp-dmgToFoe);
 if(nextFoeHp<=0){
  return {won:true,spiritCost,items,injury:Math.min(0,injury),log:logCode+':'+dmgToFoe+':win'};
 }

 // Opponent executes telegraphed move
 let incoming=intent.dmg;
 if(newPlayerGuard>=12)incoming=Math.max(0,incoming-2);
 else if(newPlayerGuard>=8)incoming=Math.max(0,incoming-1);
 else if(a.playerGuard>=10)incoming=Math.max(0,incoming-1);
 // Avoid instant one-shot on full health unless reckless; injury still real!
 if(move==='medicine'&&incoming>0)incoming=Math.max(0,incoming-1);
 const totalInjury=injury+incoming;
 const nextFoeGuard=Math.min(30,Math.max(0,foeGuard)+intent.guard);
 const nextIntent=(a.intentIdx+1+(a.round%2===0&&intent.kind==='heavy'?1:0))%enc.intents.length;

 return {
  won:false,spiritCost,items,injury:totalInjury,
  nextActive:{
   ...a,
   round:a.round+1,
   foeHp:nextFoeHp,
   foeGuard:nextFoeGuard,
   playerGuard:newPlayerGuard,
   intentIdx:nextIntent,
   momentum,
   log:logCode+':'+dmgToFoe+':'+(incoming>0?'hit'+incoming:'blk'),
  },
 };
}

function renderLog(enc,a){
 if(!a.log||a.log==='start')return null;
 const [code,dmgStr,hitCode]=a.log.split(':');
 const dmg=Number(dmgStr)||0;
 const prevIntent=enc.intents[(a.intentIdx+enc.intents.length-1)%enc.intents.length];
 const moveDesc={
  strike:`你催动真元抢攻一招，硬生生打掉${enc.name} ${dmg} 点护体真元！`,
  burst:`剑势蓄满！你倾尽锋芒斩出一记破防绝招，势如破竹重创${enc.name} ${dmg} 点真元，震碎其周身护盾！`,
  defend:`你收剑沉气，凝起厚重护体灵盾，蓄势待发。`,
  'counter-listen':`你暗运「分息听泉」，刹那间看穿${enc.name}杀招轨迹，顺势借力反击削去其 ${dmg} 点真元！`,
  'counter-ward':`你催动「回脉护身」硬扛来袭重压，护体灵光反震而出，震伤${enc.name} ${dmg} 点真元！`,
  talisman:`你甩出一道符箓炸开刺目雷火，轰碎对手护盾，爆出 ${dmg} 点实伤！`,
  artifact:`你祭出法器化作流光镇压全场，不仅重创对手 ${dmg} 点真元，更替自己撑起一层坚实器光！`,
  medicine:`你趁隙吞下一枚疗伤丹，药力化开压住体内翻涌的伤势，气息稳住大半。`,
 }[code]??'双方真气轰然对撞。';
 const foeReaction=hitCode?.startsWith('hit')?prevIntent.hit:prevIntent.blocked;
 return moveDesc+' '+foeReaction;
}

export function duelNode(state,menu,choice,actor){
 const {events:e,life}=state,d=e.duels??{won:[],active:null},node=e.node;
 const n=text=>({kind:'narration',text});
 const dlg=(who,text)=>({kind:'dialogue',speaker:actor(who),text});
 const row=(title,goal,blocks,choices,location)=>({title,goal,location:location??'三界演武与宿命战局',blocks,choices});
 const backHub=menu('back','收剑入鞘，先回山居整备','hub');
 const bookMenu=menu('duel-book','翻看三界强敌名录','duel-book');
 const trainMenu=menu('train-menu','回去闭关打磨修为与器物','training');

 if(node==='duel-victory'){
  const enc=byId(d.won.at(-1))??DUEL_ENCOUNTERS[0];
  const blocks=enc.victory.map(b=>b.kind==='dialogue'?dlg('foe',b.text):n(b.text));
  return row(enc.title+' · 胜负已分','清点战果，继续问鼎仙途',blocks,[bookMenu,trainMenu,backHub],enc.location);
 }

 if(node==='duel-retreat'){
  return row('审势抽身 · 留得青山','暂避锋芒，整备丹符法器后再决生死',[
   n('你一记虚招荡开对手压迫，足尖点地掠出十余丈，借着地形迅速脱离战圈。修仙路上莽夫多死于非命，留住性命、备足符箓丹药再回头算账，方是长久之道。'),
  ],[bookMenu,trainMenu,backHub],'战圈之外');
 }

 if(node==='duel-book'){
  if(d.active){
   const enc=byId(d.active.id);
   return row('战局未歇 · '+enc.title,'重返交锋现场，决出胜负',[
    n('你与'+enc.name+'的死斗尚在胶着之中（第'+d.active.round+'回合，对手余势 '+d.active.foeHp+'/'+d.active.foeMax+'）。此时回去仍是真刀真枪的硬仗。'),
   ],[menu('duel-resume','立刻重返战局，再战'+enc.name,'duel-arena'),trainMenu,backHub],enc.location);
  }
  const next=nextAvailableDuel(state);
  const wonList=d.won.length?'已斩落强敌（'+d.won.length+' / '+DUEL_ENCOUNTERS.length+'）：'+d.won.map(id=>byId(id).name).join('、')+'。':'至今尚未在三界留下真正的一战成名之绩。';
  if(!next){
   const upcoming=DUEL_ENCOUNTERS.find(x=>!d.won.includes(x.id));
   return row('问道斗法 · 强敌名录','修为与界域尚待精进',[
    n(wonList),
    n(upcoming?'下一位宿命对手「'+upcoming.name+'（'+upcoming.epithet+'）」活跃在'+['下界','中界','上界'][upcoming.tier]+'，须修至'+V7_REALMS[upcoming.realm].name+'方有资格与其一战。':'从外院恶奴到守鼎老祖化身，三界九场宿命死战已尽数被你斩于剑下！你的剑名早已响彻云海。'),
   ],[trainMenu,menu('v2-chronicles','返回三界游历总卷','v2-chronicles'),backHub]);
  }
  const initActive={id:next.id,round:1,foeHp:next.foeMax,foeMax:next.foeMax,foeGuard:0,playerGuard:0,intentIdx:0,momentum:0,log:'start'};
  const lootText=Object.entries(next.reward).filter(([k])=>k!=='cultivation').map(([k,v])=>ITEMS[k]+'×'+v).join('、');
  return row('问道斗法 · '+next.title,'直面'+next.name+'，见招拆招决生死',[
   n(wonList),
   ...next.intro.map(b=>b.kind==='dialogue'?dlg('foe',b.text):n(b.text)),
   n('对手：'+next.name+'（'+next.epithet+' · 真元 '+next.foeMax+'）。胜出可得'+lootText+'及实打实的斗法感悟（修为+'+next.reward.cultivation+'）。'),
  ],[
   menu('duel-start','亮剑迎战 · 与'+next.name+'分个生死','duel-arena',{duels:{...d,active:initActive}}),
   menu('v2-chronicles','先去整备符箓法器，改日再来','v2-chronicles'),
   backHub,
  ],next.location);
 }

 const a=d.active,enc=byId(a.id),intent=enc.intents[a.intentIdx];
 const moveSpec={
  strike:['iron','cautious'],
  burst:['iron','bold'],
  defend:['stones','cautious'],
  talisman:['herbs','bold'],
  artifact:['stones','bold'],
  medicine:['herbs','cautious'],
 };
 const makeMove=(key,label,move)=>{
  const [target,approach]=moveSpec[move];
  const outcome=resolveTurn(enc,a,move,life,e);
  const nextDuels=outcome.won?{won:[...d.won,enc.id],active:null}:{won:d.won,active:outcome.nextActive};
  const gain=outcome.won?Object.fromEntries(Object.entries(enc.reward).filter(([k])=>k!=='cultivation')):{};
  const cultivation=outcome.won?(enc.reward.cultivation??0):0;
  return choice(key,label,'explore',target,approach,{
   next:outcome.won?'duel-victory':'duel-arena',
   optionalGift:true,
   patch:{duels:nextDuels},
   rule:{days:1,spiritCost:outcome.spiritCost,items:outcome.items,injury:outcome.injury,gain,cultivation,checkKind:null,warnings:outcome.injury>0?['此招硬撼之下预计承受'+outcome.injury+'分伤势。']:[]},
  });
 };

 if(node==='duel-tactics'){
  const hasTal=(life.items.talisman??0)>0;
  const hasArt=(life.items.artifact??0)>0;
  const hasMed=(life.items.medicine??0)>0;
  const options=[];
  if(hasMed&&life.injury>=2)options.push(makeMove('duel-medicine','趁隙吞服疗伤丹稳住伤势（耗疗伤丹×1）','medicine'));
  else if(hasTal)options.push(makeMove('duel-talisman','祭出一道符箓破盾强杀（耗符箓×1）','talisman'));
  else if(hasArt)options.push(makeMove('duel-artifact','祭出法器镇压全场（耗法器×1）','artifact'));
  else if(hasMed&&life.injury>0)options.push(makeMove('duel-medicine','趁隙吞服疗伤丹稳住伤势（耗疗伤丹×1）','medicine'));
  options.push(choice('duel-flee','虚晃一招抽身遁走，保命退场','explore','supplies','cautious',{next:'duel-retreat',patch:{duels:{...d,active:null}},rule:{days:1,spiritCost:4,checkKind:null}}));
  options.push(menu('duel-back-arena','收起心思，返回正面过招','duel-arena'));
  return row(enc.title+' · 变招与奇策','动用随身丹符法器，或趁隙抽身退走',[
   n('第 '+a.round+' 回合 · '+enc.name+'余势 '+a.foeHp+'/'+a.foeMax+(a.foeGuard?'（护盾 '+a.foeGuard+'）':'')+' · 你的剑势 '+a.momentum+'/4 · 当前伤势 '+life.injury+'/10。'),
   n('随身可用：符箓 '+(life.items.talisman??0)+' 张 · 法器 '+(life.items.artifact??0)+' 件 · 疗伤丹 '+(life.items.medicine??0)+' 枚。'),
   n('对手下一招：【'+intent.name+'】——'+intent.telegraph),
  ],options.slice(0,3),enc.location);
 }

 // duel-arena
 const logLine=renderLog(enc,a);
 const phaseLine=a.foeHp<=Math.floor(enc.foeMax*0.3)?enc.phaseLow:a.foeHp<=Math.floor(enc.foeMax*0.6)?enc.phaseHalf:null;
 const form=e.forms?.known;
 const defLabel=form==='listen'&&intent.kind==='heavy'?'运「分息听泉」识破杀招并反击':
  form==='ward'&&intent.kind==='heavy'?'运「回脉护身」硬扛重击并反震':
  '凝气守势，撑起护体灵盾蓄势';
 const atkOption=a.momentum>=3
  ?makeMove('duel-burst','剑势已满！倾力斩出破防绝招','burst')
  :makeMove('duel-strike',intent.kind==='open'?'趁对手露绽，抢攻重创要害':'催动真元主动抢攻，积攒剑势','strike');

 const blocks=[
  n('第 '+a.round+' 回合 · '+enc.name+'（余势 '+a.foeHp+' / '+a.foeMax+(a.foeGuard?' · 护盾 '+a.foeGuard:'')+'） · 你的战意剑势 '+a.momentum+' / 4'),
  ...(logLine?[n(logLine)]:[]),
  ...(phaseLine?[dlg('foe',phaseLine)]:[]),
  n('【敌招杀机 · '+intent.name+'】'+intent.telegraph),
 ];
 return row(enc.title+' · 第'+a.round+'合','读懂对手杀招，见招拆招',[...blocks],[
  atkOption,
  makeMove('duel-defend',defLabel,'defend'),
  menu('duel-tactics','动用符箓法器、服丹或抽身遁走','duel-tactics'),
 ],enc.location);
}
