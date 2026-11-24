import {exactKeys} from './schema.js';
import {realmFor,V7_REALMS} from './cultivation-rules.js';
import {ITEMS} from './model.js';
import {TALES_PART_A} from './world-tales-data-a.js';
import {TALES_PART_B} from './world-tales-data-b.js';

export const WORLD_TALES=[...TALES_PART_A,...TALES_PART_B];
export const taleNodes=['tale-book','tale-scene','tale-result'];

function availableTales(state){
 const done=state.events?.tales??{};
 const rank=realmFor(state.life).rank,tier=state.life.cultivationProfile.worldTier;
 const list=WORLD_TALES.filter(t=>!Object.hasOwn(done,t.id)&&rank>=V7_REALMS[t.realm].rank&&tier>=t.tier);
 return list.sort((a,b)=>(b.tier===tier?1:0)-(a.tier===tier?1:0)||WORLD_TALES.indexOf(a)-WORLD_TALES.indexOf(b));
}

export function nextAvailableTale(state){
 if(state?.events?.version!==2||!state.events.prologue?.help)return null;
 return availableTales(state)[0]??null;
}

export function taleEntities(state,prefix){
 const e=state.events,node=e.node;
 const tale=(node==='tale-scene'||node==='tale-result')
  ?(WORLD_TALES[e.page]??WORLD_TALES[0])
  :(availableTales(state)[0]??WORLD_TALES[0]);
 return [{id:prefix+'npc',name:tale.npcName,kind:'person',status:'alive'}];
}

export function validateTales(events,life){
 if(events.version!==2)throw Error('旧版人生无三界江湖奇谭。');
 const t=events.tales;
 if(t!==undefined){
  exactKeys(t,[],WORLD_TALES.map(x=>x.id));
  for(const [id,val] of Object.entries(t)){
   if(val!==0&&val!==1)throw Error('江湖奇谭抉择记录无效。');
   if(life){
    const tale=WORLD_TALES.find(x=>x.id===id);
    if(!tale||realmFor(life).rank<V7_REALMS[tale.realm].rank||life.cultivationProfile.worldTier<tale.tier)throw Error('江湖奇谭不可越境记入。');
   }
  }
 }
 if(events.node==='tale-scene'){
  const tale=WORLD_TALES[events.page];
  if(!tale||Object.hasOwn(t??{},tale.id))throw Error('江湖奇谭页次无效或已历毕。');
  if(life&&(realmFor(life).rank<V7_REALMS[tale.realm].rank||life.cultivationProfile.worldTier<tale.tier))throw Error('当前境界尚未触及此桩奇谭。');
 }
 if(events.node==='tale-result'){
  const tale=WORLD_TALES[events.page];
  if(!tale||!Object.hasOwn(t??{},tale.id))throw Error('尚未完成此桩江湖奇谭。');
 }
}

export function taleNode(state,menu,choice,actor){
 const {events:e,life}=state,done=e.tales??{},node=e.node;
 const n=text=>({kind:'narration',text});
 const dlg=text=>({kind:'dialogue',speaker:actor('npc'),text});
 const row=(title,goal,blocks,choices,location)=>({title,goal,location:location??'三界江湖奇谭',blocks,choices});
 const backBook=menu('tale-book','返回江湖奇谭录','tale-book',{page:0});
 const backMore=menu('v2-chronicles-more','返回故人、奇谭与旧卷','v2-chronicles-more',{page:0});
 const train=menu('train-menu','收心回山闭关修炼','training');
 const hub=menu('back','回到山居静室','hub');

 if(node==='tale-book'){
  const avail=availableTales(state);
  const doneCount=Object.keys(done).length;
  if(!avail.length){
   const locked=WORLD_TALES.find(t=>!Object.hasOwn(done,t.id));
   return row('江湖奇谭录（'+doneCount+'/'+WORLD_TALES.length+'）','静候更高境界与远方天地的新传闻',[
    n('茶肆酒坊里能听见的本境风声，眼下都已被你亲身走过一遍。'),
    n(locked?'更远处的下一桩奇谭，需待你修至'+V7_REALMS[locked.realm].name+'并踏足'+['下界','中界','上界'][locked.tier]+'后，方能在江湖人嘴里听出端倪。':'三界二十四桩奇谭已尽数收入此生见闻，尘世冷暖与修士悲欢，你皆亲眼见证。'),
   ],[backMore,train,hub]);
  }
  const curPos=Math.max(0,avail.findIndex(t=>WORLD_TALES.indexOf(t)===e.page));
  const tale=avail[curPos],taleIdx=WORLD_TALES.indexOf(tale);
  const nextTale=avail[(curPos+1)%avail.length],nextIdx=WORLD_TALES.indexOf(nextTale);
  const tierName=['下界','中界','上界'][tale.tier];
  return row('江湖奇谭录 · '+tale.title,'探访三界散修奇遇与尘世暗涌（已历 '+doneCount+'/'+WORLD_TALES.length+'）',[
   n('行脚途中，坊市茶肆间新近传开一桩风声——地点在「'+tale.location+'」，牵涉之人唤作'+tale.npcName+'（'+tierName+' · '+V7_REALMS[tale.realm].name+'见闻）。'),
   n(tale.blocks[0].text),
   n('眼下与你境界相合的未探奇谭尚有 '+avail.length+' 桩。是亲自过去瞧个究竟，还是先换看别处传闻？'),
  ],[
   menu('tale-open','亲自前往「'+tale.title+'」','tale-scene',{page:taleIdx}),
   avail.length>1?menu('tale-next','换看另一桩传闻 · '+nextTale.title,'tale-book',{page:nextIdx}):train,
   backMore,
  ],tale.location);
 }

 const tale=WORLD_TALES[e.page];
 if(node==='tale-scene'){
  const blocks=tale.blocks.map(b=>b.kind==='dialogue'?dlg(b.text):n(b.text));
  const makePick=idx=>{
   const c=tale.choices[idx];
   const target=idx===0?'stones':'herbs';
   const approach=idx===0?'cautious':'bold';
   const rewardList=Object.entries(c.gain??{}).map(([k,v])=>ITEMS[k]+'×'+v);
   if(c.cultivation)rewardList.push('修为感悟+'+c.cultivation);
   return choice('tale-pick-'+idx,c.label,'explore',target,approach,{
    next:'tale-result',
    optionalGift:true,
    patch:{page:e.page,tales:{...done,[tale.id]:idx}},
    rule:{days:c.days,items:c.items??{},spiritCost:c.spiritCost??0,gain:c.gain??{},cultivation:c.cultivation??0,checkKind:null,warnings:rewardList.length?['此择可得：'+rewardList.join('、')+'。']:[]},
   });
  };
  return row('江湖奇谭 · '+tale.title,'听清各方说辞，当场定夺去留与善恶',blocks,[
   makePick(0),
   makePick(1),
   menu('tale-back','按下心念，暂不卷入此事','tale-book',{page:0}),
  ],tale.location);
 }

 // tale-result
 const pickedIdx=done[tale.id]??0;
 const picked=tale.choices[pickedIdx];
 const doneCount=Object.keys(done).length;
 return row('江湖奇谭 · '+tale.title+'（了结）','收拢此行见闻，继续三界仙路',[
  n(picked.result),
  n('此桩风波就此落定。你合上随身记事薄，三界江湖奇谭已亲历 '+doneCount+' / '+WORLD_TALES.length+' 桩。'),
 ],[backBook,train,hub],tale.location);
}
