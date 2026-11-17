import {exactKeys} from './schema.js';

const openings=[
 ['旧湾有一条浮桥，两头各系着一只绞车钩。夜学的先生想让人先铺过桥的踏板，船工想先把运货的浅船拖上滑道。一班工只能借走一对钩。','一块踏板能摆下两个书箱。先生把板放平，湾里的孩子便能自己提着灯走到船边。另一头的货要等下班再卸。','滑道底下还压着一根弯桩。趁退潮拖起浅船，种袋就能干着送进仓；过桥的人暂且还得等船来接。'],
 ['白汀两条水巷共用一架转臂。染户想把坡岸改成能走手推车的缓坡，量水人想靠转臂把测深船吊回水面。两边都留好了工钱，只等一班人手。','缓坡的最低一级总泛青。把石阶嵌到水印上方，推车的人就能自己进出染坊；测深船还得留在原来的水巷。','船尾的旧铅坠垂到河床。调准转臂再放船，量水人便能回来逐段标出浅滩；染料仍得靠人挑过石阶。'],
];
const results=[
 {shore:'旧湾的踏板已经铺好。晚课散时，提灯的人从浮桥上直接下船。',boat:'旧湾的浅船已经下了滑道。种袋能干着入仓，领桩人仍在桥头摆渡。'},
 {shore:'白汀的染户推着第一车靛布走下新坡，车轮没有陷进泥里。',boat:'白汀的测深船重新入水，两条水巷有了能相互核对的水尺。'},
];
export function yardOutcome(convoy,tier){
 const shift=convoy.shifts?.[tier];
 return shift?results[tier][shift.crew]:null;
}
export function validateYardShifts(convoy){
 const shifts=convoy.shifts;
 if(!Array.isArray(shifts)||shifts.length!==2||shifts.every(s=>s===null))throw Error('港班工签无效。');
 for(const [tier,s] of shifts.entries()){
  if(s===null)continue;
  exactKeys(s,['crew','pay']);
  if(convoy.chapters[tier]?.loads.length!==2||!['shore','boat'].includes(s.crew)||!['stones','iron'].includes(s.pay))throw Error('港班工签与到岸单不符。');
 }
}

export function yardNode(state,menu,choice,row){
 const {events:e,life}=state,v=e.convoy,tier=life.cultivationProfile.worldTier,shift=v.shifts?.[tier];
 const chapter=v.chapters[tier],node=e.node,fee=tier?90:45,stores=life.items;
 const shed=menu('yard-shed','去工棚炼阵或调息','convoy-yard-shed');
 const supplies=menu('yard-stores','沿港自采灵石或铁料','convoy-yard-stores');
 const cross=menu('cross-menu','回界渡台查看过界条件','convoy-cross');
 const exit=menu('river-back','暂离渡口，回去安排仙路','hub');
 const stock='囊中有'+(stores.stones??0)+'枚灵石、'+(stores.iron??0)+'份铁料、'+(stores.array??0)+'只阵盘。';
 const goal='备好下次出行的资用，由你决定何时重试';
 const delivered=(chapter.loads[0]|chapter.loads[1])&4;
 const prior=tier?yardOutcome(v,0):null;
 if(node==='convoy-yard-book')return row('界渡行 · 泊船处',goal,[stock,'重启古阵要用一只阵盘和'+fee+'枚灵石。若要自己再炼一盘，另备六枚灵石、两份铁料。'+(shift?'这港的工钱已交割。':'两潮的舱单已交，岸上另有一班工可以挣渡费。'),...(shift?[yardOutcome(v,tier)]:[])],[
  shift?supplies:menu('yard-duty','看看岸上哪班工需要人手','convoy-yard-duty'),shed,exit]);
 if(node==='convoy-yard-stores'){
  const r=state.lastReceipt,harvest=r.action?.id.endsWith(':c:yard-stones')||r.action?.id.endsWith(':c:yard-iron');
  const report=harvest?(r.cultivationResult.check.success?'这趟收回'+(r.itemChanges[r.action.targetId]??0)+'份'+(r.action.targetId==='iron'?'铁料':'灵石')+'。':'这一趟没寻到材料，时日已记入行程。'):'碎石岭和旧铁滩就在港外，可以从这里往返。';
  return row('界渡行 · 两条料路',goal,[report,stock],[choice('yard-stones','去碎石岭谨慎寻灵石','explore','stones','cautious',{next:node}),choice('yard-iron','去旧铁滩谨慎寻铁料','explore','iron','cautious',{next:node}),shed]);
 }
 if(node==='convoy-yard-shed'){
  const r=state.lastReceipt,forged=r.action?.id.endsWith(':c:yard-forge');
  const line=forged?(r.cultivationResult.check.success?'新盘已经收好，渡费凑齐就能试渡。':'这炉阵盘没成，投进去的铁料和灵石已经耗掉。'):r.action?.id.endsWith(':c:yard-rest')?'你已在工棚调息过一回。':shift?yardOutcome(v,tier)+'工签记的是'+(shift.pay==='stones'?'全数灵石':'灵石和两份铁料')+'。':'炉边放着炼阵的工具，还有一张空榻。';
  const missing=Math.max(0,fee+(stores.array?0:6)-(stores.stones??0)),iron=stores.array?0:Math.max(0,2-(stores.iron??0));
  const forge=choice('yard-forge','自出材料炼一只护身阵盘','craft','array','formation',{next:node});
  const needStores=stores.array?missing>0:(stores.stones??0)<6||iron>0;
  return row('界渡行 · 修阵工棚',goal,[line,stock+'现有灵力'+life.cultivationProfile.spirit+'，伤势'+life.injury+'。'+(missing||iron?'备盘和渡资合计还缺'+[...(missing?[missing+'枚灵石']:[]),...(iron?[iron+'份铁料']:[])].join('、')+'。':'备盘和渡资所需的材料已经够了。')],[needStores?supplies:forge,choice('yard-rest','在棚里静养调息','rest','self','recover',{next:node}),cross]);
 }
 const shore=menu('yard-shore','到岸上查看铺路的活','convoy-yard-shore'),boat=menu('yard-boat','去船边查看下水的活','convoy-yard-boat');
 if(node==='convoy-yard-duty')return row('两张港班工签','选一班做工，也可以自行去备料',[openings[tier][0],...(prior?[prior]:[]),'公所从这两潮的卸船钱里留了工资。两处用的是同一班公具，做完一处，另一处便由本港另排。'],[shore,boat,supplies]);
 const crew=node==='convoy-yard-shore'?'shore':'boat';
 const lighter=crew==='boat'?Boolean(delivered):Boolean(chapter.loads[0]&1);
 const days=(tier?18:12)-(lighter?4:0)-(tier&&v.shifts?.[0]?.crew===crew?2:0);
 const equipment=crew==='boat'?(delivered?'到岸单上有'+(tier?'双刻尺':'绞盘')+'，省得先从别处借来。':'到岸单上没有'+(tier?'双刻尺':'绞盘')+'，须把借具的日子算进去。'):(lighter?'头潮有人先到岸接应，岸基早已踩稳。':'这边得从垫稳岸基做起。');
 const settle=(pay,label,target)=>{
  const shifts=[...(v.shifts??[null,null])];shifts[tier]={crew,pay};
  return choice('yard-pay-'+pay,label,'explore',target,'cautious',{next:'convoy-yard-shed',patch:{convoy:{...v,shifts}},rule:{days,gain:pay==='iron'?{stones:fee,iron:2}:{stones:fee+6}}});
 };
 return row(crew==='shore'?'岸上的工签':'船边的工签','确认工日和报酬，再决定是否接工',[openings[tier][crew==='shore'?1:2],equipment+(tier&&v.shifts?.[0]?.crew===crew?'你在旧湾做过同样的活，领班再匀出两日。':''),'工期'+days+'日。做完才结清，可以领全钱，也可以把六枚灵石折成两份铁料。'],[
  settle('stones','做完这班，领取'+(fee+6)+'枚灵石','stones'),settle('iron','做完这班，领'+fee+'枚灵石和两份铁料','iron'),menu('yard-duty','放下工签，再看另一班','convoy-yard-duty')]);
}
