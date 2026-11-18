import {realmFor} from './cultivation-rules.js';
import {exactKeys} from './schema.js';
import {formNames} from './technique-forms.js';

export function canVisitRift(state){
 return state.life.cultivationProfile.worldTier===2&&realmFor(state.life).rank>=5&&state.events.cloudPassage?.[0]?.route!=null;
}
const safe=(e,method,route)=>route===(e.cloudPassage[0].route===0?'ledge':'channel')||method===(route==='ledge'?'ward':'listen');

export function validateCloudRift(e,life){
 const r=e.cloudRift;
 if(life&&!canVisitRift({events:e,life}))throw Error('风隙须在化神后循已交接的云渡探访。');
 if(!r){if(Object.hasOwn(e,'cloudRift')||e.node!=='sky-rift')throw Error('风隙尚未起程。');return;}
 exactKeys(r,['start','marks','method','prepared','route','arrived','stumbled','anchor','settled','returned','ending','finished']);
 const date=v=>Number.isSafeInteger(v)&&v>=0&&(!life||v<=life.ageDays);
 if(!date(r.start)||!Number.isInteger(r.marks)||r.marks<0||r.marks>3||typeof r.stumbled!=='boolean'||
  ![null,'survey','listen','ward'].includes(r.method)||![null,'ledge','channel'].includes(r.route)||
  ![null,'moor','drift'].includes(r.anchor)||![null,'renew','change'].includes(r.ending))throw Error('风隙记录无效。');
 const inspections=Number(Boolean(r.marks&1))+Number(Boolean(r.marks&2));
 if(r.method===null?(r.prepared!==null||r.route!==null||r.stumbled||life&&life.ageDays<r.start+inspections):(!r.marks||!date(r.prepared)||r.prepared<r.start+(r.method==='survey'?5:inspections+1)||r.method==='survey'&&r.marks!==3))throw Error('风隙准备次序无效。');
 if(r.stumbled&&life&&life.ageDays<r.prepared+1)throw Error('风隙失步尚未经过时日。');
 if(r.stumbled&&safe(e,r.method,'ledge')&&safe(e,r.method,'channel'))throw Error('风隙失步与已备通路不符。');
 if(r.route===null?(r.arrived!==null||r.anchor!==null):(!r.method||!safe(e,r.method,r.route)||!date(r.arrived)||r.arrived<r.prepared+2+(r.stumbled?1:0)))throw Error('风隙通路尚未走完。');
 if(r.anchor===null?(r.settled!==null||r.returned!==null):(!r.route||!date(r.settled)||r.settled<r.arrived+(r.anchor==='moor'?2:3)))throw Error('风隙尚未定脉。');
 if(r.returned===null?(r.ending!==null):(!r.anchor||!date(r.returned)||r.returned<r.settled+2||life&&realmFor(life).rank<7))throw Error('风隙再访尚未成行。');
 if(r.ending===null?r.finished!==null:(!date(r.finished)||r.finished<r.returned+(r.ending==='renew'?3:4)))throw Error('风隙再访尚未交割。');
 if(e.node==='sky-rift-way'&&(!r.marks||r.method))throw Error('风隙准备页次无效。');
}

export function riftNode(state,menu,choice,historicMenu=null){
 const {events:e,life}=state,r=e.cloudRift;
 const home=menu('train-menu','泊回旧渡口，回山整备或修行','training');
 const book=menu('sky-book','回白脊渡口，安排另一段行程','sky-book');
 const row=(title,lines,choices)=>({title,location:'白脊浮岩下',goal:'辨清逆风来处，亲自选择入隙与定脉之法',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const work=(key,label,target,days,change,rule={})=>choice(key,label,'explore',target,'cautious',{next:'sky-rift',patch:{cloudRift:{...r,...change}},rule:{days,...rule}});
 if(!r)return row('白脊外 · 向上落的石子',[
  '渡口照常发船。你看见船尾洗下的一粒石子没有落进云里，反而贴着一块浮岩向上滚。渡娘将空船系在旧泊位，说这条逆风才露出三日，昨夜还把岩下的水声吞去了一半。',
  e.cloudPassage[0].route===0?'当年留下的传声索没有断，索上的细结却一先一后向岩后偏。风隙在旧航道外，能借旧索找到入口，不能拿旧时的发船时辰径直穿过去。':'当年刻的吃水尺还能认路，尺下今日多了一条向上跑的水痕。它不妨碍原来的渡船，却指向浮岩背后从未走过的一股气流。',
  '你可以带行粮去探两日。没有人被留在隙里等救；若要回山，就把船泊回旧渡口。岛中的事会按已经走到的地方续接，不必拿旁人的性命催你赶路。'],[
  work('rift-launch','备一份行粮，循逆风探到浮岩下','supplies',2,{start:life.ageDays+2,marks:0,method:null,prepared:null,route:null,arrived:null,stumbled:false,anchor:null,settled:null,returned:null,ending:null,finished:null},{items:{supplies:1},spiritCost:2}),book,home]);
 const fixed=e.cloudPassage[0].route===0;
 const evidence=[
  fixed?'旧传声索扣在岩檐的整石上。敲一下，响声沿实心石传到足下；岩檐能借力，岩下的风槽却没有回流可托身。':'岩檐上旧钉的影子在动，钉本身没动。每逢气流倒转，檐石就轻轻错开；没有护住自身气脉的办法，踏上去会被震回。',
  fixed?'空船下的气泡一碰岩影就碎。吃水忽深忽浅，风槽里没有连成一线的回流；听不出流向便不能凭船浮过去。':'沿旧吃水尺量出的白线一路贴住船底。船稍偏离就下沉，回到白线上又浮起；这条风槽已有连续的回流，可沿它入隙。',
 ];
 if(!r.method){
  if(e.node==='sky-rift-way')return row('入隙以前 · 把所学用在身上',[
   '浮岩背后有一处看不见底的空腔。普通办法是在两处之间反复抛试石、架绳，花四日和一份粮认全通路；修为不会因此增长。',
   e.forms?.known==='listen'?'分息听泉可以先把气丝送进风槽，辨出气泡破开后的去向。那样即使旧航线没有留下回流，也能沿自己听出的气流入隙。':e.forms?.known==='ward'?'回脉护身可以把浮岩的错动隔在周天之外。那样即使檐石没有旧索支撑，也能一脚一脚稳住自己的脉息。':'眼下没有练成的专修术式。用试石、绳和几日勘探，一样能沿旧渡法留下的可靠通路进入。',
   '施术准备另用一日、六分灵力。这里只选准备方式，真正踏入哪条路还由你判断。'],[
   work('rift-survey','备一份粮，勘全两处通路（四日）','supplies',4,{marks:3,method:'survey',prepared:life.ageDays+4},{items:{supplies:1}}),
   ...(e.forms?.known?[work('rift-form','用'+formNames[e.forms.known]+'备好入隙气路','iron',1,{method:e.forms.known,prepared:life.ageDays+1},{spiritCost:6})]:[menu('rift-book','回现场，再看已经留下的征象','sky-rift')]),home]);
  const seen=evidence.filter((_,i)=>r.marks&(1<<i));
  const inspect=[work('rift-rope','沿岩檐敲石辨支点（一日）','iron',1,{marks:r.marks|1}),work('rift-keel','随空船量水痕与回流（一日）','stones',1,{marks:r.marks|2})].filter((_,i)=>!(r.marks&(1<<i)));
  return row('浮岩两侧 · 先辨实处',[...seen,...(!r.marks?['石子在岩檐上倒着滚，水滴在船下停成一条线。两个征象来自同一处，你却还不知道身体该借哪一边受力。']:['这些是亲自查过的征象。可以再看另一侧，也可以先准备入隙；没有查看的地方，不会凭空写成已知。'])],r.marks?[...inspect,menu('rift-prepare','衡量勘探或施术，准备入隙','sky-rift-way'),home]:[...inspect,home]);
 }
 if(!r.route){
  const paths=[['ledge','踏岩檐','iron'],['channel','循风槽','stones']];
  return row('白脊风隙 · 亲自踏进去',[
   ...evidence.filter((_,i)=>r.marks&(1<<i)),
   r.method==='listen'?'听泉的气丝绕过了气泡破开的地方，风槽深处第一次有了可追的节拍。你能循这条新听出的路走，不必等它与旧船道重合。':r.method==='ward'?'护身气脉在脚底合成一圈。檐石可以错开，脚下的周天却仍落在自己身上；先前没有支点的一侧，如今也可逐步踏过。':'试石已经走完两侧，哪边能托住重量，已留在石上的白痕里。',
   ...(r.stumbled?['刚才那一脚被岩隙震回，真实受了一层伤。你已退回空船，封住这条试路；剩下的路仍可走，也可以先疗伤。']:[]),
   '可靠通路用两日、两分灵力。不稳的路若仍要试踏，会用一日、两分灵力并增加一层伤势，不能借试错凭空找到宝物。'],[
   ...paths.filter(([route])=>!r.stumbled||safe(e,r.method,route)).map(([route,label,target])=>safe(e,r.method,route)?work('rift-'+route,label+'入隙（两日、两分灵力）',target,2,{route,arrived:life.ageDays+2},{spiritCost:2}):work('rift-'+route,'试'+label+'，承受震回（一日、一层伤势）',target,1,{stumbled:true},{spiritCost:2,injury:1})),home]);
 }
 if(!r.anchor)return row('浮岩之内 · 风有了形状',[
  r.route==='ledge'?'你沿岩檐绕到一枚倒悬的石心背面。它每转一周，四面的薄云就折进同一道缝；脚下的石阶原来只是它甩出的碎片。':'风槽把你送进石心下的一道空环。气流从环中穿出，又被上方的石头拽回，才有了先前向上滚动的石子。',
  '石心没有等人收服的灵智。它只是在旧云层退去之后，找不到能继续流转的出口。若整块取走，浮岩会失去受力的地方；你收起取物袋，留下两种能在现场做完的办法。',
  '可以用两份玄铁把石心系回岩底，留住牢靠的落脚处；也可以疏开风槽，让浮岩随气流换位。前者需要以后清理凝起的寒壳，后者没有固定的停泊点。旧渡船仍走原航道，不替它们决定改道。'],[
  work('rift-moor','以两份玄铁定住岩心（两日、四分灵力）','iron',2,{anchor:'moor',settled:life.ageDays+2},{items:{iron:2},spiritCost:4}),
  work('rift-drift','留一份行粮，疏开风槽（三日、八分灵力）','supplies',3,{anchor:'drift',settled:life.ageDays+3},{items:{supplies:1},spiritCost:8}),home]);
 const changed=r.ending==='change',moored=(r.anchor==='moor')!==changed;
 const oldBeacon=historicMenu==='beacon'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_sky-rift')&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:beacon-book'));
 if(r.ending)return row('白脊再访 · 一条自己走过的路',[
  r.anchor==='moor'?(changed?'你拆下旧桩，把结壳的石心放回流动的空环。第一次留下的落脚处已经撤去，浮岩又能缓缓转身。':'你没有敲碎整块寒壳，只沿内侧剥出让气流穿过的细缝。旧铁桩仍在，石心不必再隔着整层冰呼吸。'):(changed?'两份新铁跨在相离的气流之间，撑起一小片能驻足的岩面。浮岩还在走，脚下却不必一路追着它换步。':'你将两条气流错开半拍，令一条退去时另一条才接入。风槽重新连成路，没有把浮岩钉回原处。'),
  moored?'如今再从旧渡口抬头，能认出岩底那一小片不随云走的落脚处。它不是渡口必须经过的路，却是你亲自入过、也回来改过的地方。':'如今浮岩的影子会顺着云层移过水面。认路要听它当前的节拍，不能照着你第一次画下的位置生搬；你把旧图上那个固定的圆圈擦掉了。',
  '此行没有额外增长修为，也没有把石心收入行囊。用掉的年月、灵力与资材都已经入账，留下的是能再次辨认的通路。'],[book,home,...(!oldBeacon?[menu('beacon-book','查看探路班的新来信与回风孤标','sky-beacon-book')]:[])]);
 if(r.returned===null)return row('风隙归来 · 留待下一次亲见',[
  r.anchor==='moor'?'铁桩落定，岩下第一次有一块能站稳的地方。离开时，你摸到石心外沿正在结起薄薄的寒壳；它暂时不妨碍通路，终有一日要从里面看清怎样化开。':'气流找到出口，浮岩缓缓移开半个身位。离开时，你听见风槽深处有两拍不同的声音；眼下还能接续，往后会怎样分开，要再亲自回来辨认。',
  realmFor(life).rank<7?'合体以后，周天气脉能同时分辨岩心内外，才可再入风隙处理后续。眼下旧渡仍通，可以继续自己的修行。':'如今已到合体，可带一份粮，用两日再入风隙。回来处理的仍是当初亲自留下的那种办法。'],[
  ...(realmFor(life).rank>=7?[work('rift-return','带一份粮，再入当年定下的风隙（两日）','supplies',2,{returned:life.ageDays+2},{items:{supplies:1}})]:[]),book,home]);
 const fixedAnchor=r.anchor==='moor';
 return row('再入风隙 · '+(fixedAnchor?'寒壳之内':'分开的两拍'),[
  fixedAnchor?'旧桩没有松，寒壳却从内侧封住了石心。你把神识一半留在岩外、一半送入壳里，才发觉不是桩坏了，而是固定后的气流只能在里面积冷。':'当年放开的浮岩走得更远，风槽分成了两条气流。你把神识分向两边，一条已开始退，另一条才刚到；沿原来的同一拍迈步，反而会落在两流的空处。',
  fixedAnchor?'保留落脚处，就得用三日、六分灵力从内侧剥出透气缝；愿改成随风的路，则用四日、一份玄铁和八分灵力拆桩换流。':'仍走流动的路，可用三日、六分灵力把两流错拍接续；想留驻足处，则用四日、两份玄铁、四分灵力在两流间架一段岩面。',
  '早年的办法确实留下了能用的东西，也留下了这次才看得见的限度。你可以继续它，也可以亲手改变，不必把当年的自己说成从未做成过事。'],[
  work('rift-renew',fixedAnchor?'保留铁桩，从内侧剥开寒壳':'保留风槽，让两流错拍接续','stones',3,{ending:'renew',finished:life.ageDays+3},{spiritCost:6}),
  work('rift-change',fixedAnchor?'拆桩换流，让浮岩重新行走':'在两流间架设可驻足的岩面','iron',4,{ending:'change',finished:life.ageDays+4},{items:{iron:fixedAnchor?1:2},spiritCost:fixedAnchor?8:4}),home]);
}
