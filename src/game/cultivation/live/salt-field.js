import {exactKeys} from './schema.js';

// The lower-world nursery determines the provenance. The two beds have
// different water tables, so the same intervention cannot suit both crops.
const beans=e=>e.nursery.end!=='herbs';
const suited=e=>(e.saltField.bed==='ridge')===beans(e);
const saltSeason=90;
export function saltWindow(e,age){
 const r=e.saltField;
 if(!r||r.parcel)return null;
 const ripe=r.sown+saltSeason;
 if(!suited(e)&&!r.mended&&age<=ripe-3)return {name:'盐埠改畦',open:r.sown,close:ripe-3};
 return {name:'盐埠收签',open:ripe,close:Infinity};
}

export function validateSaltField(e,life){
 const r=e.saltField;
 if(!e.nursery?.end||life&&life.cultivationProfile.worldTier<1)throw Error('盐埠没有可查的跨界工签。');
 if(!Object.hasOwn(e,'saltField'))return;
 exactKeys(r,['bed','sown','mended','parcel','sent','ending']);
 if(!['ridge','seep'].includes(r.bed)||!Number.isSafeInteger(r.sown)||r.sown<e.nursery.settled+2||
    typeof r.mended!=='boolean'||r.mended&&suited(e)||![null,'seed','notes'].includes(r.parcel)||
    (r.parcel===null?r.sent!==null:!Number.isSafeInteger(r.sent)||r.sent<r.sown+saltSeason+1)||
    r.parcel==='seed'&&!suited(e)&&!r.mended||![null,'terrace','households','trial','wall'].includes(r.ending)||
    r.ending&&(r.parcel==='seed'?!['terrace','households'].includes(r.ending):r.parcel!=='notes'||!['trial','wall'].includes(r.ending))||
    life&&(life.ageDays<(r.sent??r.sown+(r.mended?3:0))||r.ending&&life.cultivationProfile.worldTier<2))throw Error('盐畦工签与试种经过不符。');
}

export function saltFieldNode(state,menu,choice){
 const {life,events:e}=state,r=e.saltField,tier=life.cultivationProfile.worldTier;
 const bean=beans(e),crop=bean?'灯笼豆':'薄叶草',item=bean?'supplies':'herbs';
 const row=(title,lines,choices)=>({title,location:tier===2?'上界递种亭':'中界盐埠',goal:'决定一畦试种的收成和经验怎样过界',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const home=menu('back','合起种簿，回去安排仙路','hub'),train=menu('train-menu','合起种簿，回山修行','training');
 const work=(key,label,target,days,patch,items={})=>choice(key,label,'explore',target,'cautious',{next:'seed-book',patch:{saltField:{...r,...patch}},rule:{days,items}});
 const relay=tier===2?'你在上界读到中界盐埠的田报，能托递种船把工单送回去。':'盐埠的田师把木桩插在两畦之间，正等人挑地。';
 if(!r){
  const provenance={beans:'当年你亲手送豆到灶房。随信这袋豆，封口还沿用工签上记的结法。',herbs:'当年你把薄叶草送到药棚。药棚留种的几户人家，辗转将一包细籽寄到了盐埠。',pot:'旧簿里画着你移进瓢的那株豆。这回寄来的是同畦人家另外留的种。',late:'旧工签只证明你补完了差事，当年的苗已过季。盐埠用本地灶户留的一袋豆，请你另开一行试种。'}[e.nursery.end];
  const sow=(bed,label,target)=>work('seed-'+bed,label,target,2,{bed,sown:life.ageDays+2,mended:false,parcel:null,sent:null,ending:null});
  return row('盐埠借种 · 选畦',[provenance,relay,'面前的高垄雨后能排水，风过半日就干；低畦接着淡泉，土整日润着。'+(bean?'田师剥开豆荚，指给你看泡久了会烂的脐眼。':'薄叶草根像湿线，晒到发白就接不回去了。')+'这批种只够试一畦。'],[sow('ridge','整两日高垄，种到迎风坡','stones'),sow('seep','清两日泉眼，种在低畦','herbs'),home]);
 }
 if(!r.parcel){
  const left=Math.max(0,r.sown+saltSeason-life.ageDays),good=suited(e)||r.mended;
  const condition=suited(e)?(bean?'高垄上豆根没有积水，花一串串结在节上。':'泉水渗过低畦，药苗软叶舒展，根须伸进了湿泥。'):r.mended?(bean?'起垄后，豆根终于离开积水。':'引泉入沟后，药根重新发出白须。'):(bean?'低畦的豆根浸在水里，轻轻一拔，根皮就褪了下来。':'坡面的风吹硬了泥壳，薄叶草的叶边已经焦卷。');
  if(left){
   const choices=[work('seed-watch','守余下'+left+'日，'+(good?'等这一茬收毕':'按原畦记录歉收'),'supplies',left,{})];
   if(!good&&left>=3)choices.push(work('seed-mend',bean?'用三日起土垫高豆根':'用三日开沟引泉护药根','iron',3,{mended:true}));
   choices.push(train);
   const fresh=bean?(good?'泥团一捻就散，豆种旁留着透气的细缝。':'才播下去，豆窝里已经汪起了水。'):(good?'指尖按进土里，水印正好湿到籽壳。':'表土一吹就起灰，细籽露在风里。');
   return row('盐埠借种 · 苗情',[left>saltSeason-10?fresh:condition,'这畦'+crop+'到收签还有'+left+'日。你若去修行，田师会照原畦收种，把首季的田报留在亭里。'],choices);
  }
  const ship=(parcel,label,target)=>work('seed-'+parcel,label,target,1,{parcel,sent:life.ageDays+1});
  return row('盐埠借种 · 封船',[condition,good?'田师拈出一把饱种。递种船只留一个防潮筒：装活种，或让种子留在本地，把选地与水路画给上界。':'能挑出的饱种只够盐埠续种。田师把空荚和晒白的根摊在纸上，让你把这块地失收的缘故画给下一埠。'],[...(good?[ship('seed','装筒封活种，送上界试栽','supplies')]:[]),ship('notes','种子留盐埠，把试田图寄上界','manual'),home]);
 }
 if(tier<2)return row('盐埠借种 · 已离岸',[r.parcel==='seed'?'船已载走防潮筒，盐埠给上界留了一把活种。':'船已捎走田图，种子留给盐埠来年再种。','船上的回单盖着上界递种亭的印。到了那一界，才能亲自决定这份东西落在哪里。'],[train,home]);
 if(!r.ending){
  const end=(key,label,target,days,items)=>work('seed-'+key,label,target,days,{ending:key},items);
  return r.parcel==='seed'?row('上界递种亭 · 一筒活种',['筒底是盐埠收下的'+crop+'。守亭人把两张签摆在桌上：公圃能年年量同一畦的收成；迁户要分住三处，愿意各自留种，也各自担歉收。筒里只够一处公圃或三份小包。'],[
   end('terrace','用六日栽入公圃，留整畦作种','stones',6),end('households','用三日分拣，交三户各自留种','supplies',3),home]):
   row('上界递种亭 · 一张田图',['展开的是盐埠的田图，筒里没有活种。亭外三户正盘算新田，本地种铺肯用一小包'+crop+'种换'+(bean?'一份行粮':'一份灵草')+'。你可以出这份资用，陪他们做一小畦，也可把水路刻在井壁，让来人都认得这块地。'],[
   end('trial','自出一份'+(bean?'行粮':'灵草')+'，陪迁户试种六日',item,6,{[item]:1}),end('wall','用两日刻井图，留给往来的开田人','iron',2),home]);
 }
 const closing={terrace:'公圃在第一排木牌上刻了盐埠旧名，留出一整畦专供下一年取种。',households:'三户各带一小包走上不同的山道。田簿留下三处地址，此后各家能自行交换留种。',trial:'种铺依约交了本地种。迁户将种按进土里，把盐埠田图钉在小畦边，轮流看守。',wall:'从井口到田脚的落差刻进了井壁。后来领地的人用手摸着水路，也能先给新畦选好位置。'};
 return row('上界递种亭 · 落土',[closing[r.ending],'亭里的回单逐项盖了印：'+crop+'，'+(r.bed==='ridge'?'高垄':'低畦')+(r.mended?'，中途改过水土':'')+'。'],[train,home]);
}
