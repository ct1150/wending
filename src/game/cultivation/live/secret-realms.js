import {exactKeys} from './schema.js';
import {realmFor,V7_REALMS} from './cultivation-rules.js';
import {ITEMS} from './model.js';
import {REALMS_PART_A} from './realms-data-a.js';
import {REALMS_PART_B} from './realms-data-b.js';

export const SECRET_REALMS=[...REALMS_PART_A,...REALMS_PART_B];
export const realmNodes=['realm-book','realm-room','realm-map','realm-npc','realm-climax','realm-result'];

const byId=id=>SECRET_REALMS.find(r=>r.id===id);
const realmAt=page=>SECRET_REALMS[page%SECRET_REALMS.length];

export function nextAvailableRealm(state){
 if(state?.events?.version!==2||!state.events.prologue?.help)return null;
 const done=state.events.realms?.done??{};
 const rank=realmFor(state.life).rank,tier=state.life.cultivationProfile.worldTier;
 return SECRET_REALMS.find(r=>!Object.hasOwn(done,r.id)&&rank>=V7_REALMS[r.realm].rank&&tier>=r.tier)??null;
}

export function realmEntities(state,prefix){
 const activeId=state.events.realms?.active?.id;
 const r=byId(activeId)??realmAt(state.events.page??0);
 return [{id:prefix+'rnpc',name:r.npc.name,kind:'person',status:'alive'}];
}

export function validateRealms(events,life){
 const rs=events.realms,node=events.node;
 if(events.version!==2)throw Error('旧版人生不支持三界秘境探幽。');
 if(rs!==undefined){
  exactKeys(rs,['done','active'],['last']);
  exactKeys(rs.done,[],SECRET_REALMS.map(r=>r.id));
  for(const [id,val] of Object.entries(rs.done)){
   const r=byId(id);
   if(!r||!['0','1','2'].includes(val))throw Error('秘境结局记录无效。');
   if(life&&(realmFor(life).rank<V7_REALMS[r.realm].rank||life.cultivationProfile.worldTier<r.tier))throw Error('秘境不能越境完成。');
  }
  if(rs.last!==undefined&&rs.last!==null&&!Object.hasOwn(rs.done,rs.last))throw Error('最近完成的秘境记录无效。');
  if(rs.active!==null){
   const a=rs.active;
   exactKeys(a,['id','room','clues','npc']);
   const r=byId(a.id);
   if(!r||Object.hasOwn(rs.done,a.id)||!Number.isInteger(a.room)||a.room<0||a.room>3||
      !Number.isInteger(a.clues)||a.clues<0||a.clues>7||!Number.isInteger(a.npc)||a.npc<0||a.npc>2)throw Error('秘境探索状态无效。');
   if(life&&(realmFor(life).rank<V7_REALMS[r.realm].rank||life.cultivationProfile.worldTier<r.tier))throw Error('当前境界尚不能踏足此秘境。');
  }
 }
 if(['realm-room','realm-map','realm-npc','realm-climax'].includes(node)&&!rs?.active)throw Error('当前没有正在探索的秘境。');
 if(node==='realm-result'&&!rs?.last)throw Error('尚无已收官的秘境。');
}

export function secretRealmNode(state,menu,choice,actor){
 const {events:e,life}=state,rs=e.realms??{done:{},active:null},node=e.node;
 const page=(e.page??0)%SECRET_REALMS.length;
 const rank=realmFor(life).rank,tier=life.cultivationProfile.worldTier;
 const n=text=>({kind:'narration',text});
 const dlg=text=>({kind:'dialogue',speaker:actor('rnpc'),text});
 const row=(title,goal,blocks,choices,location)=>({title,goal,location:location??'三界秘境探幽',blocks,choices});
 const backHub=menu('back','收卷回山居整备','hub');
 const train=menu('train-menu','静心闭关修炼','training');
 const book=menu('realm-book','返回三界秘境总录','realm-book',{page});

 if(node==='realm-result'){
  const r=byId(rs.last),endIdx=Number(rs.done[rs.last]),ending=r.endings[endIdx];
  return row(r.title+' · '+ending.title,'清点秘境所得，继续问鼎仙途',[
   n(ending.text),
   n(endIdx===2?'你凭细心勘查揭开了整座秘境最深处的真相，这段奇遇必将在三界广为流传。':'尘埃落定，此间秘境机缘已尽。带着这一趟搏来的资用与阅历，前路仍长。'),
  ],[book,train,backHub],r.location);
 }

 if(node==='realm-book'){
  if(rs.active){
   const r=byId(rs.active.id);
   const foundCount=[0,1,2].filter(bit=>rs.active.clues&(1<<bit)).length;
   return row('秘境未竟 · '+r.title,'重返秘境现场，续查暗线与宝藏',[
    n('你眼下正身处「'+r.title+'」的'+r.rooms[rs.active.room].title+'，已查明核心线索 '+foundCount+' / 3 处。暂退回山不失进度，随时可重返现场继续探幽。'),
   ],[menu('realm-resume','立刻重返'+r.title,'realm-room'),train,backHub],r.location);
  }
  const r=realmAt(page),nextPage=(page+1)%SECRET_REALMS.length,nextR=realmAt(nextPage);
  const doneCount=Object.keys(rs.done).length;
  const finished=Object.hasOwn(rs.done,r.id);
  const ready=!finished&&rank>=V7_REALMS[r.realm].rank&&tier>=r.tier;
  const statusLine=finished
   ?'此秘境已收官，当年所走结局为「'+r.endings[Number(rs.done[r.id])].title+'」。'
   :ready?'当前修为与界域皆已足够，可携行囊动身探秘！'
   :'踏足此境需身处'+['下界','中界','上界'][r.tier]+'并修至'+V7_REALMS[r.realm].name+'。';
  const entryBtn=ready
   ?choice('realm-enter','动身踏入「'+r.title+'」','explore','supplies','cautious',{
     next:'realm-room',
     patch:{realms:{...rs,active:{id:r.id,room:0,clues:0,npc:0}}},
     rule:{days:r.entryCost.days,items:r.entryCost.items??{},spiritCost:2,checkKind:null},
    })
   :finished?menu('realm-recheck','回看当年此境结局','realm-result',{realms:{...rs,last:r.id}}):train;
  return row('三界秘境 · '+r.title+'（已破 '+doneCount+'/'+SECRET_REALMS.length+'）',r.subtitle,[
   n(r.intro),
   n(statusLine),
  ],[
   entryBtn,
   menu('realm-next','翻看下一座秘境 · '+nextR.title,'realm-book',{page:nextPage}),
   menu('v2-chronicles','返回三界风云录','v2-chronicles',{page:0}),
  ],r.location);
 }

 const a=rs.active,r=byId(a.id),rm=r.rooms[a.room];
 const foundBits=[0,1,2].filter(bit=>a.clues&(1<<bit));
 const patchActive=change=>({realms:{...rs,active:{...a,...change}}});

 if(node==='realm-map'){
  const others=[0,1,2,3].filter(idx=>idx!==a.room);
  const clueLines=foundBits.length
   ?'已掌握线索（'+foundBits.length+'/3）：'+foundBits.map(b=>r.rooms[b].clueName).join('、')+'。'
   :'眼下尚未查明任何核心线索，建议细查各处现场以防落入陷阱。';
  return row(r.title+' · 秘境路径','择一处地点前往探查',[
   n('当前所在：'+rm.title+'。'+clueLines),
   n(a.npc===1?'已与'+r.npc.name+'周旋套话。':a.npc===2?'已当面点破'+r.npc.name+'的破绽。':'尚未与'+r.npc.name+'深谈。'),
  ],others.map(idx=>menu('realm-go-'+idx,'前往 · '+r.rooms[idx].title+(idx<3&&(a.clues&(1<<idx))?'（已查）':''),'realm-room',patchActive({room:idx}))),r.location);
 }

 if(node==='realm-npc'){
  const allClues=a.clues===7;
  return row(r.title+' · '+r.npc.name,'察言观色，辨明对方虚实与图谋',[
   n(r.npc.intro),
   ...r.npc.dialogues.map(text=>dlg(text)),
   ...(allClues&&r.npc.confront?[n('【执证对质】'+r.npc.confront)]:[]),
  ],[
   menu('realm-npc-trust','不动声色顺势周旋，暗中套取底细','realm-room',patchActive({npc:1})),
   menu('realm-npc-suspect','冷面拆穿对方言行破绽，当场试探','realm-room',patchActive({npc:2})),
   menu('realm-back-room','暂不打草惊蛇，退回现场','realm-room'),
  ],r.location);
 }

 if(node==='realm-climax'){
  const allClues=a.clues===7;
  const endSpecs=[['iron','bold'],['stones','cautious'],['herbs','bold']];
  const makeEnd=(idx)=>{
   const en=r.endings[idx],[target,approach]=endSpecs[idx];
   const rewardList=Object.entries(en.gain??{}).map(([k,v])=>ITEMS[k]+'×'+v);
   if(en.cultivation)rewardList.push('修为感悟+'+en.cultivation);
   const warns=[];
   if(en.injury>0)warns.push('强行硬拼预计承受'+en.injury+'分伤势。');
   if(rewardList.length)warns.push('收官可得：'+rewardList.join('、')+'。');
   return choice('realm-end-'+idx,en.label,'explore',target,approach,{
    next:'realm-result',
    optionalGift:true,
    patch:{realms:{done:{...rs.done,[r.id]:String(idx)},active:null,last:r.id}},
    rule:{days:en.days,spiritCost:en.spiritCost,injury:en.injury??0,gain:en.gain??{},cultivation:en.cultivation??0,checkKind:null,warnings:warns},
   });
  };
  const choices=[makeEnd(0),makeEnd(1),allClues?makeEnd(2):menu('realm-back-room','尚有线索未明，退回各处继续追查真相','realm-room')];
  return row(r.title+' · 终局破阵','以亲手查明的底牌定下此境归宿',[
   n(r.rooms[3].scene),
   n(allClues
    ?'你已集齐全部三处核心铁证（'+[0,1,2].map(b=>r.rooms[b].clueName).join('、')+'），整座秘境的杀机与真解皆尽在掌中！'
    :'已查明线索 '+foundBits.length+' / 3 处。若能回其余地点找齐全部线索，或许能看穿不伤己身、尽得真传的破局真解！'),
  ],choices,r.location);
 }

 // realm-room
 const canSearch=a.room<3&&!(a.clues&(1<<a.room));
 const canNpc=a.room===2&&a.npc===0;
 const blocks=[
  n('【'+rm.title+'】'+rm.scene),
  ...(rm.dialogue?[dlg(rm.dialogue)]:[]),
  ...(a.room<3&&(a.clues&(1<<a.room))?[n('【已查线索 · '+rm.clueName+'】'+rm.clueText),...(rm.record?[n(rm.record)]:[])]:[]),
  ...(a.room===3&&rm.record?[n(rm.record)]:[]),
  ...(a.room===2&&a.npc===1?[n('【人物交锋】'+r.npc.trustResult)]:[]),
  ...(a.room===2&&a.npc===2?[n('【人物交锋】'+r.npc.suspectResult)]:[]),
  n('当前已掌握核心线索：'+foundBits.length+' / 3。'),
 ];
 const options=[];
 if(a.room===3){
  options.push(menu('realm-climax','步入核心终局 · 决断破局之策','realm-climax'));
  options.push(menu('realm-map','暂不决断，返回其余地点继续查探','realm-map'));
  options.push(book);
 }else{
  if(canSearch){
   options.push(choice('realm-search',rm.searchLabel,'explore','herbs','cautious',{
    next:'realm-room',
    patch:patchActive({clues:a.clues|(1<<a.room)}),
    rule:{days:1,spiritCost:2,checkKind:null},
   }));
  }
  if(canNpc)options.push(menu('realm-npc','上前与'+r.npc.name+'当面盘问交锋','realm-npc'));
  options.push(menu('realm-map','展开秘境路径，前往其余地点','realm-map'));
  if(options.length<3)options.push(book);
 }
 return row(r.title+' · '+rm.title,'勘查现场线索，步步揭开秘境真相',blocks,options.slice(0,3),r.location);
}
