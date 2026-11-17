import {exactKeys} from './schema.js';
import {ITEMS} from './model.js';
import {realmFor} from './cultivation-rules.js';

const reaches=[
 {rank:1,material:'crystal',name:'裂壳滩',window:18,ends:['keel','moult','release','missed']},
 {rank:2,material:'core',name:'满舱小灯',window:30,ends:['lamp','cold','nursery','missed']},
 {rank:5,material:'voidstone',name:'没有回声的河口',window:45,ends:['anchor','borrow','beacon','missed']},
];
const accounts={
 keel:'你取走压舱的地脉灵晶。船趴在滩上，蓼和小蚌挨个把湿泥推到舷底。后来她在船边钉了一道栏，陌生人从岸上叫她，她才出来。',
 moult:'那块灵晶从废壳的内层干干净净地脱落了。蓼第一次把活壳翻给你看。活壳一直在合拢，和你取走的旧壳隔着一层温水。',
 release:'你把活晶按回原处，等船自己浮起。蓼没把别的东西塞到你手里，只把舱门朝你这一侧转了半圈。',
 lamp:'亮灯里的灵髓进了你的行囊。几盏小灯一下子找不到邻居，在水面兜了好几圈。蓼把它们一盏盏带回去，再遇一路来的人，她只在舱外说话。',
 cold:'你收下冷盏里蜕出的金丹灵髓。最小的一盏仍跟着同伴发亮，在水面画了一个慢慢张开的圈。',
 nursery:'你让灵髓留在育舱，把歪斜的灯架扶好。小蚌过了整整一夜才各自找到位置。它们认得你的脚步，下一次会给你留出一条船头的空隙。',
 anchor:'你把裂隙收进凝石带走。归游的小蚌在原先有路的地方挤作一团，蓼领它们散开，改找别的河口。她没替你许下任何归期。',
 borrow:'蓼把凝石借给你修行。凝石用过便不能原样还回。你应下的是另一件事：待自己能辨虚实，就回来给这群小蚌重新量出归航的位置。',
 beacon:'你把凝石留在河口作界标。蓼将它沉在水下，小蚌远远游来，在原本没有回声的地方一个接一个转过身。',
 missed:'这一潮已经退了。船底留下退水时的沙脊，船班自己走了。没人把没有拿到的宝物记到你的行囊里。',
};
const marks=[[0,1],[0,1,3],[0,1,3,4,5,7]];
const finished=r=>r.end!==null;
function nextReach(book,rank){
 const last=book?.pages.at(-1);
 return last&&!finished(last)?last.id:reaches.findLastIndex((c,i)=>c.rank<=rank&&i>(last?.id??-1));
}
export function shellTide(book){
 const last=book?.pages.at(-1);
 return last&&!finished(last)?{name:reaches[last.id].name+'退潮',open:last.start,close:last.start+reaches[last.id].window}:null;
}
export function ferryForMaterial(state,material){
 const i=nextReach(state.events.ferry,realmFor(state.life).rank),reach=reaches[i];
 if(reach?.material!==material)return null;
 const tide=shellTide(state.events.ferry);
 if(tide&&tide.close<=state.life.ageDays)return null;
 return reach.name;
}
export function validateFerry(b,life){
 exactKeys(b,['pages','reply']);
 if(!Array.isArray(b.pages)||!b.pages.length||b.pages.length>3||![null,'chart','quiet'].includes(b.reply))throw new Error('浮蚌渡行程无效。');
 let prev=-1,previousDay=0;
 for(const p of b.pages){
  exactKeys(p,['id','way','start','marks','end','day']);
  const c=reaches[p.id];
  if(!Number.isInteger(p.id)||!c||p.id<=prev||life&&realmFor(life).rank<c.rank||!['deck','bank'].includes(p.way)||
     !Number.isSafeInteger(p.start)||p.start<previousDay||life&&p.start>life.ageDays||
     !marks[p.id].includes(p.marks))throw new Error('浮蚌渡踪迹无效。');
  if(!finished(p)){
   if(p!==b.pages.at(-1)||p.day!==null)throw new Error('浮蚌渡尚未归航。');
  }else if(!c.ends.includes(p.end)||!Number.isSafeInteger(p.day)||p.day<=p.start||life&&p.day>life.ageDays||
   (p.end==='missed'?p.day<=p.start+c.window:p.day>p.start+c.window)||
   ['moult','release'].includes(p.end)&&p.marks!==1||['cold','nursery'].includes(p.end)&&p.marks!==3||
   p.end==='anchor'&&p.marks!==3&&!(p.marks&4)||['borrow','beacon'].includes(p.end)&&!(p.marks&4))throw new Error('浮蚌渡宝物去处无效。');
  prev=p.id;previousDay=p.day;
 }
 if(b.reply&&(b.pages.at(-1).end!=='borrow'||life&&realmFor(life).rank<6))throw new Error('浮蚌渡回航之约无效。');
}
export function shellNode(state,menu,choice,ferrier){
 const {life,events:e}=state,b=e.ferry,p=b?.pages.at(-1),rank=realmFor(life).rank,age=life.ageDays;
 const i=nextReach(b,rank),c=reaches[i],active=p&&!finished(p);
 const book='shell-book',back=menu('resources-menu','回去备料，仍可自行寻材','resources',{page:0}),home=menu('train-menu','回去安排修行','training');
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const journal=menu('shell-journal','看船舷留下的旧潮痕','shell-journal');
 const pages=b?.pages??[],change=delta=>({ferry:{...b,pages:[...pages.slice(0,-1),{...p,...delta}]}});
 const job=(key,label,target,days,patch,rule={})=>choice(key,label,'explore',target,'cautious',{next:book,patch,rule:{days,...rule}});
 const first=pages.find(r=>r.id===0)?.end,second=pages.find(r=>r.id===1)?.end;
 const barred=first==='keel',pilot=second==='cold'||second==='nursery';
 if(e.node==='shell-journal')return row('浮蚌渡 · 舷边潮痕','回看当时实际取走或留下的东西',pages.map(r=>reaches[r.id].name+'。'+(r.end?accounts[r.end]:'船还在此潮中。')),[menu('shell-book','回到现在的河岸',book),home]);
 if(!active){
  if(p?.end==='borrow'&&!b.reply&&rank>=6)return row('借凝石的人回来了','亲自完成答应过的定位',[accounts.borrow,'你已到炼虚，可以从无水处摸出那一线真空。蓼把船交到你手里，只问这条路打算留给谁认。'],[
   menu('chart','把新河口绘给两岸的来船',book,{ferry:{...b,reply:'chart'}}),menu('quiet','只带这一群小蚌走熟回程',book,{ferry:{...b,reply:'quiet'}}),home]);
  if(!c)return row('浮蚌渡 · 此潮过后','查看所取宝物与渡船的去向',[accounts[p.end],...(b.reply?[b.reply==='chart'?'两岸的船后来都拿得到这幅河图。蓼要花更多日子同陌生船家解释，哪一段水要让小蚌先游。':'你一趟一趟领小蚌走过那条缝。外来的船仍须在岸边等蓼引路，她也保住了水下那一点安宁。']:[]),
   p.id<2?'下次能辨出另一道潮纹，要到'+(p.id===0?'筑基':'化神')+'境。先过自己的修行日子，船会沿界脉换岸。':p.end==='borrow'&&!b.reply?'到了炼虚境，可以来赴这次回航之约。':'潮痕留在船上，以后再来仍能翻看。'],[journal,home,back]);
  const openings=[
   '石滩上搁着一只翻过来的巨蚌，壳里竟有一条能坐人的船。守船的蓼是蚌化成的人，她敲敲自己的肋骨：「你要地脉灵晶，我想让船重新浮起来。你若只看得见最亮的那一块，这两件事就只能办成一件。」',
   '黄昏时水面漂来一船小灯。靠近才看出每盏灯都有软足，灯芯是正在成形的金丹灵髓。蓼捞起一只空灯盏给你闻，它有一股凉下来的松香。「有长成的，也有才开始长的。拿哪一盏，你自己认。」',
   '水到了河口便少了一截。上游还在流，下游也满着，中间却没有一滴能打出回声的水。那条空隙能凝成虚空凝石，也是浮蚌群回游的入口。蓼把船篙倒过来递给你：「想拿走它的人，先站到要回来的人那头看看。」',
  ];
  const launch=(way,days,items)=>job('sail-'+way,(way==='deck'?'从船上随蓼探潮':'沿岸自己追查水痕')+'（'+days+'日）',way==='deck'?'herbs':'supplies',days,{ferry:{pages:[...pages,{id:i,way,start:age,marks:0,end:null,day:null}],reply:null}},{items});
  const deckCost=i===1&&barred?{iron:1}:i===0||!pilot?{supplies:1}:{};
  return row('浮蚌渡 · '+c.name,'寻访'+ITEMS[c.material]+'，决定自己与渡船的利害',[...(p?[accounts[p.end]]:[]),openings[i],
   i===1&&barred?'旧船底缺了你取走的晶。蓼要一份玄铁补好船栏才准你上船。沿岸仍可自行探查。':i===2&&pilot?'认得你的小蚌在船头分开两列，这一程它们愿意引船，不必自备船粮。':'船班要一份行粮；沿岸自走能省下口粮，费的日子更长。',
   '应下后按实际日历计时，'+c.window+'日后换潮。退潮赶不上，可以另循普通途径寻材。'],[launch('deck',3,deckCost),launch('bank',6,{}),home]);
 }
 const due=p.start+c.window,remaining=due-age;
 if(remaining<0)return row('退水后的船印','照实记下没有赶上的这一潮',[accounts.missed],[menu('close-tide','收下退潮的空回单',book,change({end:'missed',day:age})),home]);
 const landing=(key,label,target,days,delta,rule={})=>{
  const day=age+days;
  if(day>due)return job(key,label+'（抵达已过潮时）',target,days,change({day,end:'missed'}),{...rule,gain:{}});
  return job(key,label,target,days,change(delta.end?{...delta,day}:delta),rule);
 };
 const settle=(key,label,end,days,claim)=>{
  const day=age+days,late=day>due,force=['keel','lamp','anchor'].includes(end);
  return choice(key,label+(late?'（抵达已过潮时）':''),claim?'negotiate':'interact',ferrier,claim?(force?'pressure':'cooperate'):'help',{
   next:book,patch:change({end:late?'missed':end,day}),rule:{days,spiritCost:claim?5:0,gain:claim&&!late?{[c.material]:1}:{},relationship:late?0:force?-2:claim?1:3},
  });
 };
 const take=(end,label,days)=>settle('take-'+end,label,end,days,true);
 const spare=(end,label)=>settle('leave-'+end,label,end,2,false);
 const note='距换潮还有'+remaining+'日。想中途离开，可以先收船回去安排修行。';
 const parley=menu('ask-ferrier','先听蓼的打算，或暂缓决定','shell-parley');
 if(e.node==='shell-parley'){
  const words=['蓼在船头留了个缺口，专给小蚌钻进钻出。「它们长大了会走。我要的是能走的船，好让我也有一天能选跟不跟。」她没有向你索一块和灵晶一样贵的东西，只问愿不愿意扶一把。',
   '蓼拿黑布把最亮的灯遮了一会儿。三只小蚌原地打转，半晌才分开。「你要带走，我拦不住。至少先看看亮光原是给谁认路的。」',
   '水下的蚌群开始合壳休息，只剩一只慢的还没到。蓼不催。「它要是早到，咱们也许根本想不到水里还得留条路。」你可以把石留下，也可以回头商量带走以后的事。'];
  const answer=i===0?spare('release','扶住活壳，让船带晶起浮'):i===1?take('lamp','仍从亮灯取髓，自己承担后果',2):spare('beacon','留下凝石，系作回游界标');
  return row('蓼把船篙收起来','听她要去哪里，再决定是否出手',[words[i],note],[answer,menu('back-offer','回去衡量宝物的去处',book),home]);
 }
 if(i===0){
  if(p.marks)return row('两层壳之间','决定把哪一块地脉灵晶带走',[p.way==='deck'?'你趴在舷下，听见硬壳有两道声音。靠船的是一声一声合拢的活脉，靠沙的是已脱落的空腔。':'你沿岸挖出一圈沙线。外面那层壳跟退潮的沟一齐弯，里面却始终扣着船身。',
   '废壳里的晶也能用，须花四日挑出。动压舱的活晶两日就够，船却得另找浮力。也可以帮蓼起船，把两处晶都留给她。',note],[take('moult','四日剥取废壳里的晶',4),take('keel','两日取走压舱的活晶',2),parley]);
  return row('搁浅的蚌舟','听清晶在何处，或者径取眼前的亮晶',[p.way==='deck'?'蓼让你把手探到舷下。最亮的一块正顶着船腹，在下面似乎还有一个回音。':'你从岸边望去，船腹压着亮晶，一圈白沙把亮晶和岸隔开；白沙背面有另一道壳缘。',note],[
   landing('trace-shell',p.way==='deck'?'潜到舷下听两层回声':'沿滩绕过白沙，验第二道壳缘','iron',p.way==='deck'?3:5,{marks:1}),take('keel','不拆外壳，直接取压舱晶',2),home]);
 }
 if(i===1){
  if(p.marks===3)return row('小灯自己熄了','留一枚冷髓，或让整窝随船',[ '冷盏翻转时没有一只小蚌追来。蓼把它放到你手上；邻近的暖盏仍会感到你的手心，纷纷朝袖口靠近。',note],[take('cold','收下已蜕出的冷髓',2),spare('nursery','护送整窝小灯回育舱'),home]);
  if(p.marks===1)return row('给最后一盏留火','怎样等灯里的小蚌自己离开',[ '你认出有一盏已空，旁边的幼蚌却靠着它取暖。可以用灵力温着空盏，或架一盆炭慢慢交接。若只管自己的修途，也能取走最亮那一盏。',note],[
   landing('warm-palm','耗六分灵力，用手心替灯三日','herbs',3,{marks:3},{spiritCost:6}),landing('warm-coal','守炭盆七日，等幼蚌转身','iron',7,{marks:3}),parley]);
  return row('一舱会走的灯','跟住一盏小灯，或立即取髓',[first==='release'||first==='moult'?'蓼还记着那条浮起来的船，指给你看第一次逆着水走的小灯。跟住它，两日就能分清空盏。':barred?'修好的船栏还看得见补痕。蓼只把舱外的灯递给你看，哪一盏会走要自己守候。':'河上所有灯都在浮动，可有一盏偶尔逆着水走。要分清空盏，得追着这点微光看过两个弯。',note],[
   landing('follow-lamp','跟着逆水的小灯，找出空盏','supplies',first==='release'||first==='moult'?2:5,{marks:1}),take('lamp','从最亮的盏中取灵髓',2),home]);
 }
 if(p.marks&4)return row('可以带走的河口','决定虚空凝石和回游路的归属',[pilot?'小蚌贴到船尾，凑齐一道弧。凝石一旦带走，它们就得照另外的记号找路。':'你立下的两处记号正好夹住空隙。摘走凝石，路还得有人回来重定。',
  '可以带走后应下一次回航之约，也可以不许诺归期，或听蓼说说留下界标的用处。回航之约要自己到了炼虚境才有能力履行。',note],[take('borrow','带凝石修行，应下日后重定河口',3),take('anchor','收走凝石，不许下归期',2),parley]);
 if(p.marks===3)return row('声响之间的一寸空','把两岸的回音合在一起',[ '上岸留下的线先绷紧，下岸投下的石才有响声。你把船移到两者之间，水从船头钻过去，竟没湿船尾。',note],[landing('mark-gap','停船两日，定下真正的空隙','stones',2,{marks:7}),take('anchor','取走现成的凝石，撤去河锚',2),home]);
 const near=p.marks===0;
 return row('找一段没有水的河','先辨上岸的拉力，再验下岸的回响',[p.way==='deck'?'船篙到了这里碰不着底，反倒是篙上的湿痕比水面高了一指。':'岸石上有两道水线，上游的线绷紧时下游还没听见落水。',
  pilot?'先前同你相熟的小蚌能从另一头游过来，帮你一次标出缺口。':'你可以亲自分两岸定线。也可消耗一枚护符，让符灰沿无水处现出一道边。',note],[
  landing(near?'listen-high':'listen-low',near?'在上岸系线，测回水的拉力':'到下岸投石，对过响声','iron',near?4:5,{marks:near?1:3}),
  landing('pilot-gap',pilot?'请认得你的小蚌引船认口':'耗一枚护符，以符灰辨认缺口','supplies',pilot?2:3,{marks:p.marks|4},pilot?{}:{items:{talisman:1}}),home]);
}
