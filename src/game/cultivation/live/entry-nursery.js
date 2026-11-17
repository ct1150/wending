import {exactKeys} from './schema.js';
import {DAYS_PER_YEAR} from './model.js';

// The lower bed feeds the kitchen; the upper bed supplies the infirmary.
// The same two tools do different work in a downpour and a drying wind.
function sheltered(rain,tool){
 return (tool==='ditch')===rain?'beans':'herbs';
}
export function validateNursery(events,life,birthRoll){
 const r=events.nursery,node=events.node;
 if(node==='nursery-receipt'&&(!r?.end||events.entry!=='joined'))throw Error('药圃尚未交工。');
 if(['nursery-book','nursery-pot','work-porch'].includes(node)&&events.entry!=='accepted')throw Error('药圃差事尚未签下。');
 if(node==='nursery-pot'&&(!r?.care||r.end||r.care!=='beans'&&sheltered(r.rain,r.tool)!=='beans'))throw Error('尚无豆苗可移盆。');
 if(!Object.hasOwn(events,'nursery'))return;
 if(node==='work'&&events.entry!=='accepted')throw Error('已结清或辞去的差事不能重新开工。');
 exactKeys(r,['start','rain','tool','care','end','settled']);
 if(!Number.isSafeInteger(r.start)||r.start<0||typeof r.rain!=='boolean'||birthRoll!==undefined&&r.rain!==Boolean(birthRoll%2)||
    !['rack','ditch'].includes(r.tool)||![null,'beans','herbs'].includes(r.care)||![null,'beans','herbs','pot','late'].includes(r.end)||
    !['accepted','joined','declined'].includes(events.entry)||Boolean(r.end)!==(events.entry==='joined'))throw Error('药圃工簿失实。');
 if(r.end){
  if(!Number.isSafeInteger(r.settled)||(r.end==='late'?r.settled<=r.start+3:r.settled!==r.start+3))throw Error('药圃交工日期失实。');
  const crop=r.end==='pot'?'beans':r.end;
  if(r.end!=='late'&&(!r.care||r.care!==crop&&sheltered(r.rain,r.tool)!==crop))throw Error('药圃收成与值守不符。');
  if(r.end==='pot'&&![...(events.garden?.record??[]),events.garden?.plot].some(p=>p?.bed===0&&p.sown===r.settled))throw Error('出圃的豆苗没有入盆。');
 }else if(r.settled!==null)throw Error('药圃尚未结账。');
 if(life&&life.ageDays<(r.settled??r.start+(r.care?2:1)))throw Error('药圃工日尚未经过。');
}

export function nurseryNode(state,menu,choice,steward){
 const {events:e,life}=state,r=e.nursery,age=life.ageDays;
 const rain=r?.rain??Boolean(state.birthReceipt.random.after%2);
 const row=(title,lines,choices)=>({title,goal:'做足三日差事，决定这一季的豆苗与药草交给谁',location:'外院药圃',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const porch=menu('work-porch','回棚找人、暂缓或辞工','work-porch'),book=menu('nursery-book','回田埂查看眼前的工序','nursery-book');
 if(e.node==='work-porch'){
  const young=age<80*DAYS_PER_YEAR;
  return row('田埂外的歇脚棚',[r?'管圃人照着木牌念出你已经做完的'+(r.care?'两':'一')+'个工日。去做别的事，圃里的天气也照常过去。':'棚边留着药圃名册。你还没有动工，进田才开始计算工日。三日工换书卷，种得如何不影响这份工钱。'],[
   young&&e.companion==='unmet'?menu('companion','问问林砚的空布袋','companion'):book,menu('pause-work','暂留名字，先去安排修行','hub'),
   choice('abandon-work','划去自己的名字，自行离开','interact',young?steward:'self',young?'decline':'leave',{next:'hub',navigation:true,patch:{entry:'declined',location:'retreat'}})]);
 }
 if(e.node==='nursery-receipt'){
  const stories={beans:'灶头蒸起第一笼豆饼。厨工拿半块饼试了试，还能卷起来，便叫人把剩下的分给赶早路的人。',herbs:'药棚把能用的叶子晒在竹匾里。屋里有个脚上起泡的送信人，先用上了这一批新药。',pot:'你提起一盆灯笼豆。底下钻了洞，挑水人怕它磕破，又拆自己腰上的草绳给你缠了两道。这就是你后来走到哪里都能带上的第一畦。',late:'原来那一季已经收过。你依簿补完剩余工日，领到约定的功法；旧圃的收成归当时在场的人。'};
  return row('药圃交工 · 一卷入门法',[stories[r.end],'管圃人把写着三个工记的木牌穿回旧绳，把约好的功法交到你手里。以后留不留门，你自己决定。'],[
   ...(r.end==='pot'?[menu('garden-book','看看随身这盆豆的嫩候与熟候','garden-book')]:[]),menu('train-menu','带着新得的功法去修行','training'),menu('continue','走出药圃，安排自己的去向','hub')]);
 }
 if(!r){
  const open=(tool,label,target)=>choice('nursery-'+tool,label,'explore',target,'cautious',{next:'nursery-book',patch:{nursery:{start:age,rain,tool,care:null,end:null,settled:null}},rule:{days:1}});
  return row('第一日 · 一道沟，一架帘',['低处的豆苗归灶房，高处的薄叶草归药棚。两家只匀给你一把锄、一张旧竹帘。天变以前，你只来得及把其中一样收拾好。',
   rain?'水瓮上浮着昨夜落的桃花，山坳已经起了雨脚。清开旧沟，急水便能绕过低处豆苗；把竹帘架在高畦，雨点就砸不到药叶。':'迎风的土裂开了，灶房今天淘米只敢用半瓢水。清开引水沟能把泉送到高处药草；把旧帘压低，豆苗的嫩尖便能躲过热风。',
   '明天你还能亲自守一畦。想让两家都留苗，或只让一家多收一些，今日便可以打算。'],[open('ditch','动锄清沟，做第一日工','stones'),open('rack','修好竹帘，做第一日工','iron'),porch]);
 }
 const first=sheltered(r.rain,r.tool),left=r.care?1:2;
 const finish=(end,label,target,gain={},extra={})=>choice('nursery-'+end,label,'explore',target,'cautious',{next:'nursery-receipt',
  patch:{entry:'joined',nursery:{...r,end,settled:age+left},...extra},rule:{days:left,gain:{manual:1,...gain}}});
 if(age>r.start+(r.care?2:1))return row('过季的药圃工簿',['你回到圃边，旧木牌还挂在绳上，当时要抢的那一茬苗已经有人接走。簿上认你做过的工，不必从头再做。还差'+left+'日便能领卷。'],[finish('late','补完余下'+left+'日清沟分苗，依约领卷','manual'),porch]);
 const saving=first==='beans'?'豆苗':'药草';
 if(!r.care){
  const guard=(crop,label,target)=>choice('nursery-guard-'+crop,label,'explore',target,'cautious',{next:'nursery-book',patch:{nursery:{...r,care:crop}},rule:{days:1}});
  return row('第二日 · 只够一双手',[r.rain?'夜雨把田踩成一片软泥。':'太阳才爬上山墙，井边的石头已经晒得烫手。',
   (r.tool==='rack'?'昨天支好的竹帘':'昨天挖通的水沟')+'已经护住'+saving+'。你若去另一畦，灶房和药棚都能有收成；留下再守一班，这畦能收双份，另一畦只能留根。',
   '高低两畦隔着田埂。厨工拿来一只空甑，药棚的人摊开一块晒布，都等你自己定。'],[guard('beans','下低畦守豆苗，给灶房留粮','supplies'),guard('herbs','去高畦护薄叶草，给药棚留药','herbs'),porch]);
 }
 const beans=Number(first==='beans')+Number(r.care==='beans'),herbs=2-beans;
 const canPot=beans>0&&life.realm==='mortal'&&!e.garden?.plot&&!e.garden?.record?.length;
 if(e.node==='nursery-pot')return row('小瓢里的灯笼豆',['灶房把旧瓢拿到田埂上，给你摸了摸盆底透水的小孔。移盆也算第三日工；带走这一盆，就把这季的干粮和药叶都留给两家。豆苗从交工那天起跟着你生长。'],[
  ...(canPot?[finish('pot','用最后一日移盆，领卷并带走活苗','manual',{}, {garden:{record:[],plot:{bed:0,sown:age+1}}})]:[]),book,porch]);
 const give=(crop,n,item,label)=>{
  const room=Math.min(n,9999-(life.items[item]??0));
  const pay=room?'，领卷及'+room+'份'+(item==='supplies'?'行粮':'灵草'):'，谢礼留在本地，领卷';
  return finish(crop,label+pay,item,room?{[item]:room}:{});
 };
 return row('第三日 · 一张交工签',['低畦'+(beans?'收下'+beans+'份豆荚':'只留住了来年的老根')+'，高畦'+(herbs?'收下'+herbs+'份药叶':'只剩光秆')+'。你可以替一家把收成送到门前，领他们备下的谢礼；两家余下的收成都归各家自己。'+(canPot?'灶房也肯让你挑一株，移进行路的小瓢。':'')],[
  ...(beans?[give('beans',beans,'supplies','替灶房送豆')]:[]),...(herbs?[give('herbs',herbs,'herbs','替药棚送叶')]:[]),...(canPot?[menu('nursery-pot','问问活豆苗能否带走','nursery-pot')]:[]),...(!beans||!herbs||!canPot?[porch]:[])]);
}
