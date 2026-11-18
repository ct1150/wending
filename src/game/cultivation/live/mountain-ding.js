import {exactKeys} from './schema.js';

const rounds=['初入山门','山河往来','天地交还'];
const forms=['hall','village'];
function validFoot(foot,round){return Number.isInteger(foot)&&Math.floor(foot/3)===round;}
export function validateDing(d){
 exactKeys(d,['feet','form']);
 if(!Array.isArray(d.feet)||d.feet.length>3||!d.feet.every(validFoot)||
    d.form!==null&&(!forms.includes(d.form)||d.feet.length!==3))throw new Error('山门问鼎记录无效。');
}
export function validateInscription(inscription){
 exactKeys(inscription,['form','pieces']);
 if(!forms.includes(inscription.form)||!Array.isArray(inscription.pieces)||inscription.pieces.length!==3)throw new Error('鼎铭传拓无效。');
 for(const [round,piece] of inscription.pieces.entries()){
  exactKeys(piece,['foot','shared']);
  if(!validFoot(piece.foot,round)||typeof piece.shared!=='boolean')throw new Error('鼎铭来处无效。');
 }
}
export function inscriptionFrom(watch){
 const ding=watch?.ding;
 if(!ding?.form)return null;
 return {form:ding.form,pieces:ding.feet.map(foot=>({foot,shared:watch.record[foot].shared}))};
}
export function dingNode(state,watches,menu,choice,row,book,train){
 const w=state.events.watch,d=w.ding??{feet:[],form:null},node=state.events.node;
 const patch=(feet,form=null)=>({watch:{...w,ding:{feet,form}}});
 const review=menu('ding-book','回看问鼎之约','watch-ding-book');
 const description=foot=>{
  const c=watches[foot],entry=w.record[foot];
  return entry.shared?c.title+'。值守班许人复核「'+c.object+'」，愿把照原法做出的摹样装在鼎足上。':c.title+'。当年约了封还原样。鼎足只刻一道无名榫，教下一代如何交割，不带出本主的原物和名帖。';
 };
 if(state.life.realm!=='tribulation')return row('山门问鼎 · 炉火未起','渡劫后再来取鼎范',['九次守关的回执已经齐了。山门铸坊问你将来怎么交还这份经历。三足开范要等你亲历渡劫境；闭关用去的材料、寿元与风险，都由你自己衡量。'],[train,book]);
 if(d.form){
  const joined=d.form==='hall';
  return row(joined?'百世问鼎 · 山门有器':'百世问鼎 · 鼎归九处','此生问鼎之约已交割',[joined?'铸坊把三足立在没有门槛的堂屋。第一个进来的人伸手摸了摸鼎腹，问能否把其中一式带回去试。你说可以带的是手法，人的旧约还得自己去问。':'你请铸坊当众卸下三足。九处值守班各领一份可以使用的手法。山门里留了一只空范，下一代若想再聚，得重新去问愿意来的人。',...d.feet.map(description),'鼎上没有刻谁可长生。这次问鼎已经有了去处，你仍能继续修行，也仍有此生自己的寿数。'],[book,train]);
 }
 const n=d.feet.length;
 if(node==='watch-ding-pick'||node==='watch-ding-last'){
  const start=n*3;
  const take=i=>menu('foot-'+i,'取「'+watches[start+i].title+'」这一足',n===2?'watch-ding-book':'watch-ding-pick',patch([...d.feet,start+i]));
  if(node==='watch-ding-last')return row(rounds[n]+' · 第三件','选中这一件，或再看前两件',[description(start+2)],[take(2),menu('choose-feet','再看同组另两件','watch-ding-pick'),review]);
  return row('问鼎取足 · '+rounds[n],'从这一段人生取一件能传给后人的手法',[...Array.from({length:3},(_,i)=>description(start+i))],[take(0),take(1),menu('more-feet','细看第三件，或先回炉前','watch-ding-last')]);
 }
 if(node==='watch-ding-dedicate')return row('问鼎 · 铸前最后一问','决定让三足合器还是各归其主',[...d.feet.map(description),'铸一器留在山门，需自备一份玄铁、九分灵力和九日工期。若把手法分交各地，九班已有旧器，花三日校对交割即可。落印后，此生的鼎铭便按这个决定传下去。'],[
  choice('join-pieces','铸三足为一器，在山门公开陈设','craft','artifact','forge',{next:'watch-ding-result',patch:patch(d.feet,'hall'),rule:{days:9,items:{iron:1},spiritCost:9}}),
  choice('return-pieces','拆范分授，令值守班各自执器','craft','array','formation',{next:'watch-ding-result',patch:patch(d.feet,'village'),rule:{days:3}}),review]);
 const select=n<3?menu('choose-feet','选'+rounds[n]+'的一足','watch-ding-pick'):menu('dedicate','三足齐备，衡量铸鼎去向','watch-ding-dedicate');
 return row('山门问鼎 · 开范','从九次守关中选定三足',['铸坊抬来的泥范比灶锅大不了多少。匠人把它倒过来给你看：空着三个榫眼。她说，不用把九次关里所有的人都放进同一口鼎。每三关取一足，哪几件足以让后来的人懂你当年怎样与人相托，由你自己选。',...(n?d.feet.map(description):['尚未取足。开范前仍可撤下重选，已归还的私样不会因问鼎重新公开。'])],[select,...(n?[menu('undo-foot','撤下最后一足，重选此组','watch-ding-book',patch(d.feet.slice(0,-1)))]:[]),book]);
}
