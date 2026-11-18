import {exactKeys} from './schema.js';
import {ITEMS} from './model.js';

// The packing problem differs at each port. Each request has one origin,
// destination, displacement, last arrival day and one independently paid fee.
const ports=[
 {name:'沉钟湾',stops:['旧钟埠','高坡夜学','试种圃'],hand:0,tool:2,lead:'湾口才响过第一次新钟，席棚里已经挤了三家。先生想在涨水前搬回长桌，育苗人怕错过浸种的水温。两人都指着同一块空舱板。',cargo:[
  [0,1,2,7,'夜学长桌','iron',1,'先生把长桌倒扣在独木船上，接回了三个住得最远的学生。','学堂先拆了自家门扇当桌，孩子们得从窗边进屋。'],
  [0,2,1,12,'青芒种袋','herbs',3,'泡过第一道温水，种袋的蓝线在秧床边排成了一行。','育苗人把今年的田借给邻户种菱，旧种袋收进干仓。'],
  [1,2,1,15,'孩子画的水尺','supplies',2,'孩子的红线钉在秧床边。今年第一次，两个岸口用同一个刻度放水。','秧床边插了根新竹，孩子们画的尺得等来年再校。']]},
 {name:'中界白汀',stops:['旧街药桥','靛坊','新籍所'],hand:2,tool:0,lead:'白汀桥面正在翻修，染匠和簿吏借了同一班船。药师站在旧桥口，点过空瓶，又把包好的药搁到船头。',cargo:[
  [0,2,1,8,'换班药包','medicine',1,'新籍所的夜班按方分了药，守窗的人终于能回家睡觉。','错过换班，只好请旧街药师多走一程送药。'],
  [0,1,2,11,'装靛泥的旧槽','iron',2,'染槽落稳，第一道青布就留给修桥的人遮雨。','靛泥赶不上头缸，织户把这一批白布改作桥棚布。'],
  [2,1,1,16,'有空栏的名纸','stones',6,'染坊把空栏留给回来的人按自己的名字落款。','簿吏另挂了白板，等远处的人亲自来报名字。']]},
 {name:'上界照影台',stops:['星门旧台','回光礁','归帆井'],hand:1,tool:3,lead:'门开了，礁上的人却还得按潮点吃饭。旧台寄出一只沉重的灯座和一封很轻的回信。守井的人请你捎回一壶不会映出星影的井水。',cargo:[
  [0,1,2,7,'无芯灯座','talisman',1,'守礁人装上旧灯芯，出门的小船有了可以认准的岸。','守礁人把灯移到屋顶，这一潮得有人在岸上扶梯。'],
  [0,2,1,10,'梅核家书','supplies',2,'家书拆开，屋后多了一小块新翻的土。','归船已走，信留在井屋，等下一次有人还乡。'],
  [2,1,1,17,'无影井水','stones',8,'校图人把水滴在窗纸上，那颗画反的星终于找准了方向。','校图人等不及井水，把拿不准的星圈起来交给下一班。']]}
];
const passengers=[
 {name:'阿禾',from:1,to:2,scene:'阿禾抱着一块没画完的木尺来问船。她想去试种圃，亲眼看秧床上的水怎样涨落，再把课上画的刻度改准。尺可以托别人送，人却要自己去。她的行囊和量水工具合占一格；若这一季不顺路，她会留在学堂另约船，不要你替她许下到岸日期。',arrival:'阿禾抱着木尺踏上试种圃，先沿秧床走了一圈。她把一处刻错的红线刮掉，约好下次给学堂带回实测的水痕。尺送到和人走到，终于是两件都做成的事。',aid:'你替学堂修好了借船要用的铁扣。阿禾留下来另约渡船，不占这一班的舱位；这份帮助没有把她写成已经到过试种圃。'},
 {name:'染工青穗',from:1,to:2,scene:'染工青穗把袖子上的靛泥洗去，仍留着一圈蓝。新籍所肯收副页，她却想自己去补名字：家里两个人用过同一个旧船名，托人照抄会再混一次。她和装着旧印的小箱占一格。去新籍所与把名纸送回染坊方向相反，她把这件事先说明白，才问船上有没有位置。',arrival:'青穗在新籍所下船，没有让掌船人代她递印。她把两个人的名字分开写进空栏，另抄一份给还住在旧街的家人。送来的纸并未替她发言，这一趟她亲自把误认说清。',aid:'你交出铁件，帮旧街借船人修好折架。青穗改约另一班去新籍所的船；她的姓名还等本人到场，这次交铁并没有代她完成落籍。'},
 {name:'守灯学徒照石',from:1,to:0,scene:'照石在礁上试过新灯，发现风从一条图上没有的缝里进来。他想回星门旧台当面演给做灯座的人看，身边木盒装着会随风摆动的纸叶。人和木盒占一格。那是回头的一程；梅核家书和井水都还在前面的路上，他不想一句“顺路”让你误排了船期。',arrival:'照石在星门旧台下船，把纸叶摆到灯座旁。匠人看见叶尖倒转，才明白回光礁的那股风。改图的墨还没干，旧台便先留出一处能拆开的通风口。',aid:'你留下一份玄铁修好礁边的小渡架，让照石另约回台的船。掌船人继续原来的航线；灯座的改法仍等学徒回去演示，没有凭这次援手自动改好。'},
];
function passengerReport(port,p,s){
 if(s.person==='landed')return p.arrival;
 if(s.person==='assisted')return p.aid;
 if(s.person==='aboard')return s.closed?p.name+'在'+port.stops[s.stop]+'随收航下船，未送到'+port.stops[p.to]+'。行囊也一并带回，在本埠另约下一班船。':p.name+'仍在船上，目的地是'+port.stops[p.to]+'。若现在收航，会在本埠下船另作安排，不能记作送达。';
 return null;
}
const bit=i=>1<<i;
function capacity(chapter){return chapter.rig==='barge'?3:2;}
function freight(port,mask){return port.cargo.reduce((sum,c,i)=>sum+((mask&bit(i))?c[2]:0),0);}

function crossing(port,chapter,s,to,elapsed,tow){
 const deep=chapter.rig==='barge',distance=(s.stop+to===2?3:2)+Number(deep);
 const slot=(to+4-((elapsed+s.stop)%4))%4;
 const landing=to===1&&(chapter.loads[0]&bit(port.hand))?1:0;
 const days=tow?Math.max(1,distance-1-landing):distance+slot-landing;
 const loan=Boolean(((chapter.loads[0]|chapter.loads[1])&bit(port.tool))&&!s.usedTow);
 const arriving=elapsed+days,unload=port.cargo.reduce((m,c,i)=>m|(c[1]===to?bit(i):0),0)&s.aboard;
 const paid=port.cargo.reduce((m,c,i)=>m|(arriving<=c[3]?bit(i):0),0)&unload;
 return {days,unload,paid,food:tow&&!loan?1:0};
}
// Replay only the small charter log. The main archive separately verifies the
// inventory and lifespan receipt of each actual turn, including failed voyages.
function positions(port,chapter,run){
 const person=passengers[ports.indexOf(port)];
 const s={stop:0,aboard:0,taken:0,paid:0,unloaded:0,usedTow:false,closed:false,day:run.start,person:null};
 const end=port.cargo.at(-1)[3];
 for(const step of run.steps){
  exactKeys(step,['at','kind','n']);
  const {kind,n,at}=step,elapsed=at-run.start;
  if(s.closed||!Number.isSafeInteger(at)||at<s.day||!Number.isInteger(n)||n<0||n>2||(elapsed>=end||s.paid===7&&s.person!=='aboard')&&kind!=='close')throw Error('轮航日期或泊位无效。');
  s.day=at;s.unloaded=0;
  if(kind==='close'){
   if(n!==s.stop)throw Error('轮航收簿泊位不符。');
   s.closed=true;
  }else if(kind==='load'){
   const c=port.cargo[n];
   if(s.stop!==c[0]||s.taken&bit(n)||elapsed+1>=c[3]||freight(port,s.aboard)+Number(s.person==='aboard')+c[2]>capacity(chapter))throw Error('轮航托货无效。');
   s.aboard|=bit(n);s.taken|=bit(n);s.day++;
  }else if(kind==='board'||kind==='aid'){
   if(s.person||s.stop!==person.from||n!==s.stop||elapsed+(kind==='board'?1:2)>=end||kind==='board'&&freight(port,s.aboard)+1>capacity(chapter))throw Error('轮航同行记录无效。');
   s.person=kind==='board'?'aboard':'assisted';s.day+=kind==='board'?1:2;
  }else if((kind==='tide'||kind==='tow')&&s.stop!==n){
   const trip=crossing(port,chapter,s,n,elapsed,kind==='tow');
   s.unloaded=trip.unload;s.aboard&=~trip.unload;s.paid|=trip.paid;s.usedTow||=kind==='tow';s.stop=n;s.day+=trip.days;
   if(s.person==='aboard'&&n===person.to)s.person='landed';
  }else throw Error('轮航行路无效。');
 }
 return s;
}
export function validateCharters(events,life){
 const {convoy,node}=events,runs=events.charters??[];let prior=0,position=null;
 if(!convoy||!Array.isArray(runs)||Object.hasOwn(events,'charters')&&!runs.length||runs.length>3)throw Error('轮航簿无效。');
 for(const [i,r] of runs.entries()){
  exactKeys(r,['start','steps']);
  if(convoy.chapters[i]?.loads.length!==2||life&&life.cultivationProfile.worldTier<i||!Number.isSafeInteger(r.start)||r.start<prior||!Array.isArray(r.steps)||r.steps.length>24)throw Error('轮航开船记录无效。');
  position=positions(ports[i],convoy.chapters[i],r);
  if(i<runs.length-1&&!position.closed||life&&position.day>life.ageDays)throw Error('轮航记录先后不符。');
  prior=position.day;
 }
 if(node?.startsWith('packet-')){
  if(convoy.chapters[0]?.loads.length!==2||!['packet-book','packet-history'].includes(node)&&(!position||position.closed))throw Error('本港尚不能轮航。');
  if(node==='packet-history'&&!runs.length)throw Error('轮航簿为空。');
  if(node.startsWith('packet-to-')&&Number(node.at(-1))===position.stop)throw Error('已经在此泊位。');
  if(node==='packet-people'&&(position.person||position.stop!==passengers[runs.length-1].from||position.paid===7||life&&life.ageDays-runs.at(-1).start>=ports[runs.length-1].cargo.at(-1)[3]))throw Error('岸上同行请托已不在此处。');
 }
}
export function charterNote(events,age){
 const run=events.charters?.at(-1);
 if(!run||run.steps.at(-1)?.kind==='close')return null;
 const i=events.charters.length-1,port=ports[i],s=positions(port,events.convoy.chapters[i],run);
 const open=port.cargo.filter((c,n)=>!(s.paid&bit(n))&&(!(s.taken&bit(n))||s.aboard&bit(n)));
 const next=open.find(c=>run.start+c[3]>=age)??open.at(-1);
 return {title:port.name+'轮航',detail:'船泊'+port.stops[s.stop]+'。'+(s.person==='aboard'?passengerReport(port,passengers[i],s):next?'请核对'+next[4]+'的收货日。':'三张货签已经交代完，可收簿。'),window:next?{open:run.start,close:run.start+next[3]}:s.person==='aboard'?{open:run.start,close:run.start+port.cargo.at(-1)[3]}:null};
}
export function charterNode(state,menu,choice,historicMenu=null){
 const {life,events:e}=state,v=e.convoy,runs=e.charters??[],last=runs.at(-1),closed=last?.steps.at(-1)?.kind==='close';
 const i=runs.length-(last&&!closed?1:0),port=ports[i],chapter=v.chapters[i],node=e.node,age=life.ageDays;
 const desk=menu('packet-book','回船头看货签','packet-book'),home=menu('train-menu','暂泊，回去安排修行','training');
 const tier=life.cultivationProfile.worldTier;
 const row=(title,lines,choices)=>({title,location:port&&tier===i?port.name:'驿站的水鉴',goal:'看清潮期与舱位，自定三处泊位的送货次序',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=list=>({charters:list});
 if(node==='packet-history'){
  const lines=runs.flatMap((r,k)=>{
   const p=ports[k],s=positions(p,v.chapters[k],r);
   return [p.name+' · '+(s.closed?'已收航':'仍在航')+'。'+(s.person?passengerReport(p,passengers[k],s):''),...p.cargo.map((c,n)=>s.paid&bit(n)?c[7]:s.closed?c[8]:c[4]+'尚未收到回执。')];
  });
  return row('轮航回单',lines,[desk,home]);
 }
 if(!last||closed){
  const history=menu('packet-history','读已走过的轮航回单','packet-history');
  if(!port||chapter?.loads.length!==2)return row('旧港收航',[port?'下一港两潮都交割以后，当地才有船可借。':'三港的船都已交还。船上的货签按当时实际到岸的日子留下了回单。'],[history,home]);
  if(tier<i)return row('隔界的轮航簿',['旧图里有'+port.name+'的舱单。要等你自己到过那一界，当地船工才能从水鉴接到你的货签。'],[history,home]);
  return row(port.name+' · 借船轮航',[port.lead,'当地借出你当年排过舱的'+(chapter.rig==='barge'?'重驳（三格）':'轻舟（两格）')+'。三处泊位可往返；接船才起算约期。你在别处闭关、养伤的日子也算在内。',...(life.cultivationProfile.worldTier!==i?['旧港的水鉴照着船头，掌船人等你传回舱单。凭本界驿站交付行粮、领取回礼。']:[]),...port.cargo.map(c=>port.stops[c[0]]+' → '+port.stops[c[1]]+'：'+c[4]+'，占'+c[2]+'格，第'+c[3]+'日收货截止。')],[menu('packet-sign','接下船簿，从今日排程','packet-book',patch([...runs,{start:age,steps:[]}])),...(runs.length?[history]:[]),home]);
 }
 const s=positions(port,chapter,last),elapsed=age-last.start,end=port.cargo.at(-1)[3];
 const person=passengers[i],full=freight(port,s.aboard)+Number(s.person==='aboard'),done=s.paid===7&&s.person!=='aboard';
 const ask=!s.person&&s.stop===person.from&&elapsed<end&&!done;
 const old=historicMenu==='passenger'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_'+node)&&state.currentScene.choices.some(c=>node==='packet-moor'?c.id.endsWith(':c:packet-book'):node==='packet-book'&&c.id.endsWith(':c:packet-moor')&&c.label==='暂泊修行或收航');
 const next=(kind,n)=>patch([...runs.slice(0,-1),{...last,steps:[...last.steps,{at:age,kind,n}]}]);
 const receipt=port.cargo.map((c,n)=>{
  const status=s.paid&bit(n)?'已交割':s.aboard&bit(n)?'在舱':s.taken&bit(n)?'迟到退签':elapsed+1>=c[3]?'已过装货期':'待取';
  return c[4]+'（'+status+'，'+c[2]+'格）　'+port.stops[c[0]]+' → '+port.stops[c[1]]+'，限第'+c[3]+'日。';
 });
 const stamp='开船第'+elapsed+'日 · '+port.stops[s.stop]+' · 已用'+full+' / '+capacity(chapter)+'格。'+(s.person==='aboard'?' '+person.name+'同行占1格。':s.person==='landed'?' 同行已到岸。':'');
 const delivery=port.cargo.flatMap((c,j)=>s.unloaded&bit(j)?[s.paid&bit(j)?c[7]:c[8]]:[]);
 if(s.person)delivery.push(passengerReport(port,person,s));
 const finish=menu('packet-close','把船交回，按实际到岸情况结清','packet-history',next('close',s.stop));
 if(node==='packet-moor'||elapsed>=end||done)return row('泊船交簿',[stamp,...delivery,...receipt,'收航后，本季未按期交到的托货由当地另作安排。暂泊保留货舱，约期仍照常过去。'],[finish,...(node==='packet-moor'&&elapsed<end&&!done?[ask&&!old?menu('packet-people','听岸上人的请托，或继续轮航','packet-people'):desk]:[]),home]);
 if(node==='packet-people')return row(person.name+' · 问一格船位',[stamp,life.cultivationProfile.worldTier===i?'掌船人把你请到跳板旁。':'水鉴里映出跳板，掌船人把岸上的请托传来。',person.scene,'亲自捎带须花一日登船，占用一格至目的地；也可花两日和一份玄铁帮忙修渡具，让对方另约船。本季第'+end+'日收航，未送到的人将在停船处另作安排。这两种安排都不发放额外回礼。'],[
  ...(elapsed+1<end?[choice('packet-board','留一格船位，答应捎到'+port.stops[person.to],'explore','supplies','cautious',{next:'packet-book',patch:next('board',s.stop),rule:{days:1,...(full>=capacity(chapter)?{reason:'船已满，须先卸货再接同行者。'}:{})}})]:[]),
  ...(elapsed+2<end?[choice('packet-aid','付一份玄铁修渡具，请对方另约船','explore','iron','cautious',{next:'packet-book',patch:next('aid',s.stop),rule:{days:2,items:{iron:1}}})]:[]),desk,
  ...(elapsed+2>=end?[home]:[]),
 ]);
 if(node==='packet-cargo'){
  const jobs=[];
  for(const [n,c] of port.cargo.entries()){
   if(s.stop===c[0]&&!(s.taken&bit(n))&&elapsed+1<c[3]&&full+c[2]<=capacity(chapter))jobs.push(choice('packet-load-'+n,'花一日装上'+c[4],'explore',n===0?'iron':n===1?'stones':'supplies','cautious',{next:'packet-book',patch:next('load',n),rule:{days:1}}));
  }
  return row('岸边验货',[stamp,...receipt,jobs.length?'接一张货签要用一天，货只在目的地卸下。':'这里没有还能装下且未过装期的货。'],[...jobs,desk,...(!jobs.length?[home]:[])]);
 }
 if(node==='packet-chart'){
  const timetable=port.stops.map((from,k)=>{
   const routes=port.stops.flatMap((to,n)=>{
    if(n===k)return [];
    const slot=(n-k+4)%4;
    const tide=crossing(port,chapter,{...s,stop:k},n,slot,false);
    return [to+'每逢第'+slot+'、'+(slot+4)+'、'+(slot+8)+'…日开潮，水程'+tide.days+'日'];
   });
   return from+'开船：'+routes.join('；')+'。';
  });
  return row('三个泊位的航图',[stamp,...receipt,'下表从借船日算起，每四日一潮；错过就等下次，也可估算拖航。装货另需一日。',...timetable],[...port.stops.flatMap((name,n)=>n===s.stop?[]:[menu('packet-to-'+n,'估算去'+name+'的航期','packet-to-'+n)]),desk]);
 }
 if(node.startsWith('packet-to-')){
  const n=Number(node.at(-1)),offers=[],lines=[stamp];
  for(const tow of [false,true]){
   const t=crossing(port,chapter,s,n,elapsed,tow),mode=tow?'拖航':'候潮',arrive=elapsed+t.days,gain={};
   lines.push(mode+'到岸为第'+arrive+'日。'+(tow?(t.food?'拖手需一份行粮。':'旧舱单上的船工兑付本季一次拖航。'):'等本潮水位过线，省下行粮。'));
   if(s.person==='aboard')lines.push(n===person.to?person.name+'将在'+port.stops[n]+'下船，腾出一格。':person.name+'仍同行，此处不是约定的'+port.stops[person.to]+'。');
   port.cargo.forEach((c,j)=>{if(t.unload&bit(j)){
    lines.push(c[4]+(t.paid&bit(j)?'赶得及，回礼为'+ITEMS[c[5]]+'×'+c[6]+'。':'将错过约期，只卸货，没有回礼。'));
    if(t.paid&bit(j))gain[c[5]]=(gain[c[5]]??0)+c[6];
   }});
   const missed=port.cargo.filter((c,j)=>!(t.unload&bit(j))&&!(s.paid&bit(j))&&elapsed<c[3]&&arrive>=c[3]);
   if(missed.length)lines.push('这一程回来不及再交'+missed.map(c=>c[4]).join('、')+'。');
   offers.push(choice(tow?'packet-tow':'packet-tide',mode+'去'+port.stops[n]+'（第'+arrive+'日到）','explore',tow?'supplies':'stones','cautious',{next:'packet-book',optionalGift:true,patch:next(tow?'tow':'tide',n),rule:{days:t.days,items:t.food?{supplies:1}:{},gain}}));
  }
  return row('试算航期 · '+port.stops[n],lines,[...offers,desk]);
 }
 return row(port.name+' · 轮航船头',[stamp,...delivery,...receipt],[menu('packet-cargo','验看本埠可装的托货','packet-cargo'),menu('packet-chart','看潮表，选择下一处泊位','packet-chart'),menu('packet-moor',ask&&!old?'泊船听岸上请托，或安排修行':'暂泊修行或收航','packet-moor')]);
}
