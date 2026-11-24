import {exactKeys} from './schema.js';
import {realmFor,V7_REALMS} from './cultivation-rules.js';
import {ITEMS} from './model.js';
import {BONDS_PART_A} from './bonds-data-a.js';
import {BONDS_PART_B} from './bonds-data-b.js';

export const BOND_CHARACTERS=[...BONDS_PART_A,...BONDS_PART_B];
export const bondNodes=['bonds-book','bond-act','bond-talk','bond-decide','bond-result','bond-review'];

const charById=id=>BOND_CHARACTERS.find(c=>c.id===id);
const charAt=page=>BOND_CHARACTERS[page%BOND_CHARACTERS.length];

export function nextAvailableBond(state){
 if(state?.events?.version!==2||!state.events.prologue?.help)return null;
 const bonds=state.events.bonds??{};
 const rank=realmFor(state.life).rank,tier=state.life.cultivationProfile.worldTier;
 for(const ch of BOND_CHARACTERS){
  const rec=bonds[ch.id]??{stage:0,route:''};
  const act=ch.acts[rec.stage];
  if(act&&rank>=V7_REALMS[act.realm].rank&&tier>=act.tier)return {char:ch,act,stage:rec.stage};
 }
 return null;
}

export function bondEntities(state,prefix){
 const ch=charAt(state.events.page??0);
 return [{id:prefix+'char',name:ch.name,kind:'person',status:'alive'}];
}

export function validateBonds(events,life){
 const b=events.bonds,node=events.node;
 if(events.version!==2)throw Error('旧版人生不支持红尘故人志。');
 if(b!==undefined){
  exactKeys(b,[],BOND_CHARACTERS.map(c=>c.id));
  for(const [id,rec] of Object.entries(b)){
   exactKeys(rec,['stage','route']);
   const ch=charById(id);
   if(!ch||!Number.isInteger(rec.stage)||rec.stage<0||rec.stage>ch.acts.length||
      typeof rec.route!=='string'||!/^[01]*$/.test(rec.route)||rec.route.length!==rec.stage)throw Error('故人羁绊记录无效。');
   if(life&&rec.stage>0){
    const last=ch.acts[rec.stage-1];
    if(realmFor(life).rank<V7_REALMS[last.realm].rank||life.cultivationProfile.worldTier<last.tier)throw Error('故人羁绊不能越境推进。');
   }
  }
 }
 if(['bond-act','bond-talk','bond-decide'].includes(node)){
  const ch=charAt(events.page??0),rec=b?.[ch.id]??{stage:0,route:''},act=ch.acts[rec.stage];
  if(!act||life&&(realmFor(life).rank<V7_REALMS[act.realm].rank||life.cultivationProfile.worldTier<act.tier))throw Error('此位故人眼下尚无待续幕次。');
 }
 if(['bond-result','bond-review'].includes(node)){
  const ch=charAt(events.page??0),rec=b?.[ch.id];
  if(!rec?.stage)throw Error('尚未与这位故人走过任何一幕。');
 }
}

export function bondNode(state,menu,choice,actor){
 const {events:e,life}=state,bonds=e.bonds??{},node=e.node;
 const page=(e.page??0)%BOND_CHARACTERS.length,ch=charAt(page);
 const rec=bonds[ch.id]??{stage:0,route:''};
 const rank=realmFor(life).rank,tier=life.cultivationProfile.worldTier;
 const act=ch.acts[rec.stage];
 const ready=Boolean(act&&rank>=V7_REALMS[act.realm].rank&&tier>=act.tier);

 const n=text=>({kind:'narration',text});
 const dlg=text=>({kind:'dialogue',speaker:actor('char'),text});
 const materialize=list=>list.map(b=>b.kind==='dialogue'?dlg(b.text):n(b.text));
 const row=(title,goal,blocks,choices,location)=>({title,goal,location:location??'红尘故人志',blocks,choices});
 const book=menu('bonds-book','返回红尘故人志','bonds-book',{page});
 const train=menu('train-menu','静心闭关修炼','training');
 const backHub=menu('back','收卷回山居','hub');

 if(node==='bonds-book'){
  const nextPage=(page+1)%BOND_CHARACTERS.length;
  const nextChar=charAt(nextPage);
  const doneCount=BOND_CHARACTERS.reduce((s,c)=>s+(bonds[c.id]?.stage??0),0);
  const totalCount=BOND_CHARACTERS.reduce((s,c)=>s+c.acts.length,0);
  const statusLine=rec.stage>=ch.acts.length
   ?'此生与'+ch.name+'的五幕红尘羁绊已尽数走完，昔日抉择皆刻入道心。'
   :ready?'第 '+(rec.stage+1)+' 幕「'+act.title+'」机缘已至，地点在'+act.location+'。'
   :'下一幕「'+act.title+'」需身在'+['下界','中界','上界'][act.tier]+'且修至'+V7_REALMS[act.realm].name+'方能重逢。';
  const prevLead=rec.stage>0&&act?.leadByPrev?.[rec.route.at(-1)]?act.leadByPrev[rec.route.at(-1)]:null;
  const firstBtn=ready
   ?menu('bond-open','赴约 · 第'+(rec.stage+1)+'幕「'+act.title+'」','bond-act',{page})
   :rec.stage>0?menu('bond-review','回读与'+ch.name+'走过的往事','bond-review',{page})
   :train;
  return row('红尘故人志 · '+ch.name+'（'+rec.stage+'/'+ch.acts.length+'）','遍访三界故人，历尽百年沧桑（全志 '+doneCount+'/'+totalCount+' 幕）',[
   n(ch.name+' · '+ch.epithet+'。'+ch.intro),
   ...(prevLead?[n(prevLead)]:[]),
   n(statusLine),
  ],[
   firstBtn,
   menu('bond-next','翻看下一位故人 · '+nextChar.name,'bonds-book',{page:nextPage}),
   menu('v2-chronicles','返回三界风云录','v2-chronicles',{page:0}),
  ]);
 }

 if(node==='bond-review'){
  const lines=Array.from({length:rec.stage},(_,i)=>{
   const a=ch.acts[i],pick=Number(rec.route[i]);
   return n('【第'+(i+1)+'幕 · '+a.title+'】'+a.choices[pick].result);
  });
  return row(ch.name+' · 往事回眸','重温与故人走过的风雨岁月',lines.slice(-10),[book,train,backHub]);
 }

 if(node==='bond-result'){
  const prevAct=ch.acts[rec.stage-1],picked=prevAct.choices[Number(rec.route.at(-1))];
  return row(ch.name+' · '+prevAct.title+'（余波）','记住这一幕的聚散得失',[
   n(picked.result),
   n(rec.stage<ch.acts.length?'待境界与岁月再进一步，你与'+ch.name+'还会在更远的山海重逢。':'五幕尘缘至此画上句点，'+ch.name+'的音容与托付，已伴你走向更高天地。'),
  ],[book,train,backHub],prevAct.location);
 }

 if(node==='bond-act'){
  const prevLead=rec.stage>0&&act.leadByPrev?.[rec.route.at(-1)]?act.leadByPrev[rec.route.at(-1)]:null;
  return row(ch.name+' · '+act.title,'听清故人近况，选择深谈或当场定夺',[
   ...(prevLead?[n(prevLead)]:[]),
   ...materialize(act.blocks),
  ],[
   menu('bond-talk','留步深谈，听'+ch.name+'吐露心底隐情','bond-talk',{page}),
   menu('bond-decide-menu','权衡情义与利害，作出此幕抉择','bond-decide',{page}),
   book,
  ],act.location);
 }

 if(node==='bond-talk'){
  return row(ch.name+' · '+act.title+'（深谈）','知其心结与难处，再作取舍',materialize(act.deepTalk),[
   menu('bond-decide-menu','听罢肺腑之言，前去作出抉择','bond-decide',{page}),
   book,
  ],act.location);
 }

 // bond-decide
 const makePick=(idx)=>{
  const c=act.choices[idx];
  const nextRec={stage:rec.stage+1,route:rec.route+idx};
  const target=idx===0?'stones':'herbs';
  const approach=idx===0?'cautious':'bold';
  const rewardList=Object.entries(c.gain??{}).map(([k,v])=>ITEMS[k]+'×'+v);
  if(c.cultivation)rewardList.push('修为感悟+'+c.cultivation);
  return choice('bond-pick-'+idx,c.label,'explore',target,approach,{
   next:'bond-result',
   optionalGift:true,
   patch:{page,bonds:{...bonds,[ch.id]:nextRec}},
   rule:{days:c.days,items:c.items??{},spiritCost:c.spiritCost??0,gain:c.gain??{},cultivation:c.cultivation??0,checkKind:null,warnings:rewardList.length?['此择可得：'+rewardList.join('、')+'。']:[]},
  });
 };
 return row(ch.name+' · '+act.title+'（抉择）','每一念取舍，皆会牵动故人与自身的后路',[
  n('眼下局势已明，与'+ch.name+'这一幕的聚散分合，全系于你这一念之间。'),
 ],[
  makePick(0),
  makePick(1),
  menu('bond-back-act','再看一遍方才情形','bond-act',{page}),
 ],act.location);
}
