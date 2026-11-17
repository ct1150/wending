// The numbered watches belong to the scene in the atlas. Looking at a map,
// reading a note and suspending an expedition never advance that clock.
const voyages=[
 {
  name:'逆潮送灯',limit:9,goal:'在第九刻结束前，将护罩和灯油一起送到雾中的引航塔。若有余力，可接回滞留的抄潮人。',
  brief:'旧河簿的夹层落出一页航图。最早守闸的姑娘后来成了领航人，留下这桩旧案：雾要封河，外面三条船还在等引航火。一盏裸灯顶不住塔顶的风，光有罩子也烧不了一夜。潮刻从你动身时算起。',
  start:'dock',finish:'tower',required:3,bonus:4,reward:'stones',seals:['护罩','灯油','抄潮人'],
  places:{
   dock:['旧埠','篷船系在一根斜木桩上。有人在桩旁刻了“单刻落、双刻涨”，零刻也算涨潮。窑脚有罩，油在仓里。',[['kiln',2],['weir',1]]],
   kiln:['窑脚','余火照亮一排烧裂的灯罩。窑匠留下一只完好的，罩顶开了三道侧孔，风越急，火越稳。',[['store',2],['weir',1]],1],
   weir:['分潮堰','堰上筑着旧堤，可以绕去窑脚。背水的一条小路只在单刻退潮时露出来，尽头是抄潮棚。',[['kiln',1],['hut',1,1]]],
   hut:['抄潮棚','抄潮人没能赶上末班船。他收起连记了二十年的潮纸，只求你把人和纸一起送到能靠岸的地方。',[['store',2],['weir',1]],4],
   store:['桐油仓','最后一瓮灯油埋在冷灰里，封口还贴着去年的纸。你把它提出来时，灰面留下整整一圈圆印。',[['tower',2],['kiln',2]],2],
   tower:['引航塔','上层木梯已让潮气侵坏。你用肩扛开塔扉，盐雾的另一头仍传来船铃。回仓补物和当场点火，现在还来得及权衡。',[['store',2],['hut',2]]],
  },
  ending:['火穿过雾，一次、两次、三次。外河三条船都答了灯号。靠岸的领航人把湿透的灯芯绕在手腕上，以防明年忘记灯该修在哪里。','抄潮人把二十年的潮纸摊在塔下，三张写错的纸也没有抽走。领航人照着它重画了下一季的浅滩。'],
 },
 {
  name:'无星之夜',limit:10,goal:'月落前取得两张互相独立的星影，在山巅对勘方位。可以额外寻找失踪观测者留下的签注。',
  brief:'新的图页没有罗盘，只有一条从右向左读的诗。上一个测星人据此算出要迁村，隔山的同行却说他把天盘看反了。今夜两座石镜只会在不同的潮刻显影，你须亲眼看两次。',
  start:'yard',finish:'peak',required:3,bonus:4,reward:'iron',seals:['东镜星影','西镜星影','原册签注'],
  places:{
   yard:['山下书场','两面镜的刻度不同，东镜只在单刻显影，西镜只在双刻显影。持灯的学生怕你记混，悄悄在你左袖上别了一枚白针。',[['east',1],['shelf',2]]],
   east:['东镜石坪','石上磨着一圈鸟翼似的细纹。单刻月光斜过翼尖，才能把星影拓在纸背。',[['west',1],['shelf',1]],1,1],
   west:['西镜山坳','西边的石镜平贴地面，双刻星芒才从崖口照下。你认出另一幅星图的缺口，竟与东镜呈相反方向。',[['peak',3],['east',1]],2,0],
   shelf:['半崖书龛','破席下藏着观测者的私册。他曾在山火里伤了右眼，习惯从镜后观星。册旁多画的半圈，原来是给自己留的提醒。',[['west',2],['east',1]],4],
   peak:['无灯峰','这里看不见村灯，星却格外近。峰顶旧盘上有一道显眼的刮痕，正好容得下两张拓纸。',[['west',1],['shelf',2]]],
  },
  ending:['两张拓纸对折，险象原来在空山一侧。山下的人在自己的床上睡到天亮。次日你请两位观测者各自署名，将两种刻法并列留在山门。','私册补上了镜后观星的缘故。学生们保留那道反刻，教后来人先问自己站在镜前还是镜后。'],
 },
 {
  name:'雪线上的来客',limit:11,goal:'赶在封山前，把热泉石与通行木牌带到背阴营。还能为走散的邮差带去一封迟到的回信。',
  brief:'图底最后一张邮路图上，有一段路被墨涂成了白色。背阴营来的是避雪的陌生人，他们没有本地的牌子。守隘人答应准其过冬，只要你拿回有印的木牌，再用热泉石融开铁门。',
  start:'inn',finish:'camp',required:3,bonus:4,reward:'herbs',seals:['热泉石','通行木牌','回信'],
  places:{
   inn:['风口驿','驿卒给你指了两条路，先上关楼能先拿牌，先去暖泉则可以趁路面尚未结冰，把关后的窄道走一遍。',[['pass',1],['well',2]]],
   pass:['隘口关楼','木牌上还留着未削干净的姓氏。守隘人把它翻过来，在白的一面按印，说每个来客都该有能写自己名字的一面。',[['well',2],['post',2]],2],
   well:['雪下暖泉','泉眼边几块红石摸着都暖。你选了一块裹在布里，把另一块放回细流中，免得泉面又被冰封。',[['camp',3],['sledge',1]],1],
   sledge:['松林雪橇道','林隙只能容一副窄橇穿过。若从这里上关楼，背风处可以一直滑到关脚；另一头有人在找丢失的邮袋。',[['pass',1],['post',1]]],
   post:['无人邮亭','邮袋藏在一只倒扣的竹筐下。那封回信只写了五个字：“院里梅开了。”邮差曾说，若他在背阴营等到这封信，就知道家里已收容了他带下山的人。',[['camp',2],['well',2]],4],
   camp:['背阴营','铁门上的锁已经冻出白霜。隔着栅栏，有人用家乡话问你山下是什么时辰。营里的人天亮前得有个能升火的地方。',[['post',1],['pass',2]]],
  },
  ending:['印信照过，热石贴上锁孔，冻住的门闩缓缓退开。客人们没有急着赶路，先替原来的守营人修好了被雪压斜的炉筒。','邮差读了三遍那五个字。他说不必再赶回去看，等雪融了，要先带山上的人走一趟梅树下。'],
 },
];

const empty=()=>({volume:0,place:voyages[0].start,watch:0,goods:0,results:''});
export function validateExpedition(v){
 if(!v||Object.keys(v).length!==5||typeof v.results!=='string'||!/^[01]*$/.test(v.results)||v.volume!==v.results.length||v.volume>voyages.length||!Number.isInteger(v.watch)||v.watch<0||!Number.isInteger(v.goods)||v.goods<0||v.goods>7)throw new Error('行旅图记录无效。');
 const map=voyages[v.volume];
 if(map?!Object.hasOwn(map.places,v.place)||v.watch>map.limit:v.place!=='end'||v.watch!==0||v.goods!==0)throw new Error('行旅图位置无效。');
}
function enter(map,v,place,watch){
 const [,,,gift,phase]=map.places[place];
 const found=phase===undefined||phase===watch%2?gift??0:0;
 return {...v,place,watch,goods:v.goods|found};
}
export function expeditionNode(state,menu,choice){
 const e=state.events,v=e.expedition??empty(),map=voyages[v.volume];
 const back=menu('river-back','合图休整，下次从这里继续','hub');
 const node=(title,goal,texts,choices)=>({title,goal,blocks:texts.map(text=>({kind:'narration',text})),choices});
 if(!map)return node('行旅录 · 三程归来','将三程所得带回修行',[...voyages.map((row,i)=>row.name+'。'+row.ending[0]+(v.results[i]==='1'?row.ending[1]:''))],[menu('hear-council','合上旧图，查看北山的来信','council-book'),menu('train-menu','带着所得继续修行','training'),back]);
 const [placeName,description,roads]=map.places[v.place];
 // Timber supplied under the first volume's signed agreement built a towpath
 // between the kiln and store. It changes the playable route on this map.
 const towpath=v.volume===0&&e.river.record[3]==='0';
 const legTime=(from,to,cost)=>towpath&&from==='kiln'&&to==='store'?1:cost;
 const goods=map.seals.filter((_,i)=>v.goods&(1<<i)).join('、')||'尚无';
 const stamp='第 '+v.watch+' / '+map.limit+' 刻　'+placeName+'　随身：'+goods;
 const overview=menu('voyage-log','查看整幅路图、歇脚或收卷','voyage-log');
 const go=menu('voyage-go','进入图中现场','voyage-road',{expedition:v});
 if(e.node==='voyage-book')return node('行旅录 · '+map.name,map.goal,[map.brief,...(towpath?['你在火塘旁立下的苗契留下了一段木纤道。窑脚至桐油仓只要一刻。']:[]),'图内按路程推进潮刻。读图与合卷都能保留进度，走不通时可以重走这一程。结印时才将历练计入此生。',stamp],[go,overview,back]);
 if(e.node==='voyage-log'){
  const routeLines=Object.entries(map.places).map(([from,p])=>p[0]+' → '+p[2].map(([to,cost,phase])=>map.places[to][0]+' '+legTime(from,to,cost)+'刻'+(phase===undefined?'':phase?'（单刻启程）':'（双刻启程）')).join(' / '));
  return node('行旅路图 · '+map.name,map.goal,[map.goal,stamp,routeLines.join('；'),...map.seals.map((name,i)=>{const source=Object.values(map.places).find(p=>p[3]===(1<<i));return name+'在'+source[0]+(source[4]===undefined?'。':source[4]?'，须在单刻察看。':'，须在双刻察看。');})],[go,menu('voyage-reset','商量是否重走本程','voyage-reset'),back]);
 }
 if(e.node==='voyage-reset')return node('重整行装',map.name,['从起点重走本程将放下本程的图内物件。先前已结印的各程仍记在册中。',stamp],[menu('voyage-restart','从本程起点重新规划','voyage-road',{expedition:{...v,watch:0,goods:0,place:map.start}}),go,back]);
 if(e.node==='voyage-camp')return node('停步辨时',map.goal,[stamp,'留一刻观察此处，可以等到水位或星影改变。若行期将尽，展图查看其余走法。'],[...(v.watch<map.limit?[menu('voyage-wait','在此留一刻，重新察看','voyage-road',{expedition:enter(map,v,v.place,v.watch+1)})]:[]),overview,go]);
 const canFinish=v.place===map.finish&&(v.goods&map.required)===map.required;
 if(canFinish&&e.node!=='voyage-detour'){
  const extra=(v.goods&map.bonus)!==0,next=voyages[v.volume+1],result={volume:v.volume+1,results:v.results+(extra?'1':'0'),place:next?.start??'end',watch:0,goods:0};
  return node(placeName,map.goal,[description,stamp,'物件已经备齐。你可现在结印，也可再看看路上有没有遗漏的人。'],[choice('voyage-finish','亲手完成'+map.name+'，领取本程图印','explore',map.reward,'cautious',{next:'voyage-result',optionalGift:true,patch:{expedition:result},rule:{days:v.watch||1,items:{},gain:{[map.reward]:2},checkKind:null,spiritCost:0,warnings:[]}}),menu('voyage-on','暂不结印，继续探路','voyage-detour'),overview]);
 }
 return road();

 function road(){
  const options=roads.flatMap(([to,base,phase])=>{
   const cost=legTime(v.place,to,base);
   if(v.watch+cost>map.limit||phase!==undefined&&phase!==v.watch%2)return [];
   return [menu('to-'+to,'去'+map.places[to][0]+'（'+cost+'刻）','voyage-road',{expedition:enter(map,v,to,v.watch+cost)})];
  });
  return node(placeName,map.goal,[description,stamp,...(!options.length?['目前没有赶得及的道路。你可以察看路图或从本程起点重走。']:[])],[...options,menu('voyage-camp','停步辨时，打开路图','voyage-camp'),...(options.length===0?[overview]:[])]);
 }
}

export function expeditionResult(v,menu){
 const i=v.volume-1,map=voyages[i];
 return {title:map.name+' · 图印已成',goal:'读完这段行旅的结局',blocks:[map.ending[0],...(v.results[i]==='1'?[map.ending[1]]:[])].map(text=>({kind:'narration',text})),choices:[menu('voyage-book','翻到行旅录下一页','voyage-book'),menu('river-back','收好图印，回去修行','hub')]};
}
