import {exactKeys} from './schema.js';

// Rail pins are captive. Each rail must be opened from its near end, while
// the relative order of the two rails depends on readings taken at this port.
const benches=[
 {
  title:'湾底的双井阵',rails:[['量潮','接井'],['暂蓄','开闸']],days:5,fee:45,
  invitation:'界渡行在沉钟湾收到了两船的到港单，悬赏修复调潮台。台心有一对同铸的阵盘，一盘留港，一盘连同四十五灵石酬给修阵人。工料由行里出，试装先用木销。',
  sight:'你掀开木盖，看见左右各有两根串在一处的铜销。左轨先量潮后接井，右轨先暂蓄后开闸。两轨之间可以穿插。木工用手一拨，水珠就沿槽走了一小截。',
  reading:early=>early?'浮桥头潮便钉牢了。静水刻线可直接读数，应先量潮，再蓄水。':'头潮没有浮桥护住水面。水尺来回跳动，须先让水入蓄槽，再量静水位。',
  second:'两井共用一段细管。先蓄水才能接井，接好两井后方可开闸。这两点用手摸管壁便能验证。',
  earlyBit:0,
 },
 {
  title:'白汀的错星盘',rails:[['定尺','分影'],['上砝','放星']],days:9,fee:90,
  invitation:'白汀工匠要校一面跨界的星盘。盘上两枚星原来只有一个影，分开后才量得出门幅。他们把一面副盘和九十灵石封在工钱匣里，约定校成才领。',
  sight:'工台左侧的尺轨扣着分影镜，须先定尺才能分影。右侧两件则依次是砝码和星灯。四件都要入位，先后不同，就会把镜里那道影认成另一颗星。',
  reading:early=>early?'双刻尺随头潮到岸，原点已经有记号。先定尺再上砝，才能在同一原点读两遍。':'双刻尺没有在头潮到岸。先用砝码压出零位，再定尺，才不会把船板的倾斜算进星位。',
  second:'星灯要在尺身固定之后点亮。分影镜应放在已经看得见的星影上；抢先分影会把灯座自己的影子刻进盘里。',
  earlyBit:2,
 },
];

function positions(pattern){
 let left=0,right=0;
 return [...pattern].map(side=>side==='L'?left++:2+right++);
}
function invalidOrder(tier,early,pattern){
 const order=positions(pattern),before=(a,b)=>order.indexOf(a)<order.indexOf(b);
 if(before(0,2)!==early)return benches[tier].reading(early);
 if(tier===0&&!before(2,1))return '接井时蓄槽仍空着，两口井相互抽水，细管里全是气。';
 if(tier===0&&!before(1,3))return '闸门先开了，两井尚未接通，蓄槽里的水直接流回湾里。';
 if(tier===1&&!before(0,3))return '放星时尺身仍在摇，铜盘上拖出了一条长痕。';
 if(tier===1&&!before(3,1))return '镜中分出两个灯座的轮廓，却没有一颗星。分影镜要等星灯亮起再放。';
 return null;
}
export function validateBenches(rows,chapters){
 if(!Array.isArray(rows)||rows.length!==2)throw new Error('界渡工台记录无效。');
 for(const [i,b] of rows.entries()){
  if(b===null)continue;
  exactKeys(b,['pattern','paid']);
  if(chapters[i]?.loads.length!==2||typeof b.pattern!=='string'||!/^[LR]{0,4}$/.test(b.pattern)||[...b.pattern].filter(x=>x==='L').length>2||[...b.pattern].filter(x=>x==='R').length>2||typeof b.paid!=='boolean')throw new Error('界渡木销排布无效。');
  const early=Boolean(chapters[i].loads[0]&(1<<benches[i].earlyBit));
  if(b.paid&&(b.pattern.length!==4||invalidOrder(i,early,b.pattern)))throw new Error('未校成的阵盘不能领取酬劳。');
 }
}
export function tideWorkshop(state,v,tier,menu,choice,row){
 const bench=benches[tier],rows=v.benches??[null,null],b=rows[tier]??{pattern:'',paid:false},order=positions(b.pattern);
 const early=Boolean(v.chapters[tier].loads[0]&(1<<bench.earlyBit));
 const parts=bench.rails.flat();
 const patch=(pattern,paid=false)=>({convoy:{...v,benches:rows.map((old,i)=>i===tier?{pattern,paid}:old)}});
 const board=menu('work-board','回到工台排销','convoy-board'),gate=menu('convoy-book','收工，查看界渡','convoy-book');
 const drawing='目前次序：'+(order.map(i=>parts[i]).join(' → ')||'两轨均未取销')+'。';
 if(b.paid)return row(bench.title+' · 校成','工钱已经交割',[drawing,'委托人点亮主盘，在匣中留下你收过工钱的印记。副盘与约定的灵石已在结算时交割。'],[menu('cross-menu','携盘前往界渡','convoy-cross'),gate]);
 if(state.events.node==='convoy-board-notes'){
  return row(bench.title+' · 工台笔记','核对实测次序，再调整木销',[bench.sight,bench.reading(early),bench.second,drawing],[...(order.length?[menu('undo-pin','撤下最后一枚木销','convoy-board',patch(b.pattern.slice(0,-1)))]:[]),board,gate]);
 }
 if(order.length===4){
  const defect=invalidOrder(tier,early,b.pattern);
  if(state.events.node==='convoy-test-result'&&defect)return row('空载试阵 · 未合','依试阵留下的读数调校',[drawing,defect,'这一日已用于通水或点灯。原排布还在，你可以撤销末枚木销，也可以重新铺开四件。'],[menu('undo-pin','撤下末枚再排','convoy-board',patch(b.pattern.slice(0,-1))),menu('reset-pins','取出四枚木销重排','convoy-board',patch('')),gate]);
  return row(bench.title+' · 试阵', '将木样送入工台进行实测',[drawing,'校成后验收副盘与工钱。若次序有误，只做一日空载试验，记录出错的位置。'],[
   choice('test-pins','依此次序试阵并验收','craft','array','formation',{next:'convoy-test-result',optionalGift:true,patch:patch(b.pattern,!defect),rule:defect?{days:1,spiritCost:2}:{days:bench.days,spiritCost:8,art:'formations',gain:{stones:bench.fee,array:1}}}),
   menu('work-notes','核对笔记或撤销排布','convoy-board-notes'),gate,
  ]);
 }
 const opts=[];
 for(const [side,code] of ['L','R'].entries()){
  const n=[...b.pattern].filter(x=>x===code).length;
  if(n<2)opts.push(menu('pin-'+code,'取'+(side?'右':'左')+'轨的'+bench.rails[side][n],'convoy-board',patch(b.pattern+code)));
 }
 return row(bench.title,'按两轨可行的次序安放四枚木销',[bench.invitation,bench.sight,bench.reading(early),bench.second,drawing],[...opts,menu('work-notes','翻看笔记、撤销或暂离','convoy-board-notes')]);
}
