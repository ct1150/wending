import {exactKeys} from './schema.js';
import {sha256} from './identity.js';

const names={shore:'外侧渡岸',ledge:'上层岩檐',channel:'下层回流',beacon:'背风标台'};
const index=place=>place==='ledge'?0:1;
const oldPath=e=>(e.cloudRift.anchor==='moor')!==(e.cloudRift.ending==='change')?'ledge':'channel';
export const beaconPlaces=prefix=>Object.entries(names).map(([key,name])=>({id:prefix+'beacon-'+key,name,kind:'place'}));

export function validateRiftBeacon(e,life){
 const r=e.riftBeacon;
 if(!e.cloudRift?.ending)throw Error('孤标须在风隙再访之后探寻。');
 if(!r){if(Object.hasOwn(e,'riftBeacon')||e.node!=='sky-beacon-book')throw Error('孤标尚未起行。');return;}
 exactKeys(r,['start','at','place','surveys','entry','arrived','read','work','worked','ending','finished']);
 const date=n=>Number.isSafeInteger(n)&&n>=0&&(!life||n<=life.ageDays);
 if(!date(r.start)||r.start<e.cloudRift.finished+1||!date(r.at)||r.at<r.start||!Object.hasOwn(names,r.place)||
  !Array.isArray(r.surveys)||r.surveys.length!==2||![null,'ledge','channel'].includes(r.entry)||
  ![null,'moor','drift'].includes(r.work)||![null,'delivered','withdrawn'].includes(r.ending))throw Error('孤标行程无效。');
 for(const day of r.surveys)if(day!==null&&(!date(day)||day<r.start+2||day>r.at))throw Error('孤标调查时日无效。');
 if(r.place!=='shore'&&r.at<r.start+1)throw Error('尚未从渡岸走到外岩。');
 for(const [i,day] of r.surveys.entries())if(day!==null&&r.place!==(i?'channel':'ledge')&&r.at<day+1)throw Error('调查之后尚未离开现场。');
 if(r.surveys.every(d=>d!==null)&&Math.abs(r.surveys[0]-r.surveys[1])<2)throw Error('两处调查尚未走完。');
 if(r.entry===null?(r.arrived!==null||r.read!==null||r.work!==null||r.place==='beacon'):
  r.surveys[index(r.entry)]===null||!date(r.arrived)||r.arrived<r.surveys[index(r.entry)]+2+(r.surveys[index(r.entry)]+2>=r.start+5?1:0)||r.arrived>r.at)throw Error('孤标入口尚未实走。');
 if(r.arrived!==null&&r.surveys.some(d=>d!==null&&d>r.arrived-2&&d<r.arrived+2))throw Error('抵台途中不能同时调查外岩。');
 if(r.read!==null&&(!r.entry||!date(r.read)||r.read<r.arrived||r.read>r.at))throw Error('孤标记录尚未取回。');
 if(r.work===null?r.worked!==null:r.read===null||!date(r.worked)||r.worked<r.read+(r.work==='moor'?2:3)||r.worked>r.at)throw Error('孤标回程尚未修成。');
 if(r.ending===null?r.finished!==null:r.place!=='shore'||!date(r.finished)||r.finished!==r.at||r.ending==='delivered'&&r.read===null)throw Error('孤标尚未返岸交割。');
 if(r.place==='shore'&&r.entry&&r.at<r.arrived+2)throw Error('孤标回程时日不足。');
 if(!e.node.startsWith('sky-beacon-')&&r.place!=='shore'||['sky-beacon-works','sky-beacon-exit'].includes(e.node)&&(r.place!=='beacon'||r.ending)||
  e.node==='sky-beacon-works'&&(r.read===null||r.work)||e.node==='sky-beacon-rest'&&r.place!=='shore')throw Error('孤标所在页与行程不符。');
}

export function beaconNode(state,menu,choice){
 const {events:e,life}=state,r=e.riftBeacon,age=life.ageDays;
 const row=(title,lines,choices)=>({title,location:r?names[r.place]:'白脊渡口',goal:r?.ending?'回看本次探路与留下的通路，继续自己的修行':'带回观风记录，亲自走完回程；也可明确收队',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const book=menu('beacon-book','回到当前探路地点','sky-beacon-book');
 const home=menu('train-menu','留在渡岸，回山整备或修行','training');
 const patch=change=>({riftBeacon:{...r,...change,at:age}});
 const work=(key,label,days,change,rule={},approach='road')=>{
  const moving=Object.hasOwn(change,'place'),target=moving?'r:'+sha256(state.runId).slice(0,16)+':t1:e:beacon-'+change.place:change.work==='moor'?'iron':change.work==='drift'?'supplies':'manual';
  return choice(key,label,moving?'travel':'explore',target,moving?approach:'cautious',{next:'sky-beacon-book',patch:{riftBeacon:{...r,...change,at:age+days}},rule:{days,...rule}});
 };
 if(!r)return row('回风孤标 · 探路班的新来信',[
  '风隙再访之后，后来的一班探路人在外岩背面安了观风标。今日回传的绳影错开了半格，他们想取回标台里的原纸，查清是标移了，还是路图只记住了一种风。',
  '探路班已经回岸，没有人在里面等救。旧云渡也照常走原航道。你可以接着自己的旧路进去看，也可以不接这封信。',
  '起行用一日和一份行粮。到外侧渡岸后的第五日开始变风；晚到仍可通行，但要多留时间、付出灵力。读信不算答应。'],[
  work('beacon-launch','备一份粮，到外侧渡岸开始探路',1,{start:age+1,place:'shore',surveys:[null,null],entry:null,arrived:null,read:null,work:null,worked:null,ending:null,finished:null},{items:{supplies:1}}),
  menu('rift-book','收起来信，回看已经完成的风隙','sky-rift'),home]);
 const seen=r.surveys.map((d,i)=>d===null?null:(i?'下层回流':'上层岩檐')).filter(Boolean).join('、')||'尚未调查两侧';
 if(r.ending)return row('回风孤标 · '+(r.ending==='delivered'?'原纸已交回':'这次已收队'),[
  r.ending==='delivered'?'你把取回的原纸铺在岸桌上。探路班没有擦去旧图，只在旁边添上调查那日的风候：它曾经成立，却不是每一天都能照走。':'你明确交回了这份探路委托。'+(r.read!==null?'取到的记录没有交作本次成果，簿上没有冒写交割。':'岸上没有把尚未取到的记录写成已经找回。'),
  '亲自调查过：'+seen+'。'+(r.work==='moor'?'外檐留有你修成的回绳。':r.work==='drift'?'浮标下留有你疏通的回流。':'这次没有改动外岩的回程地形。'),
  '行程与实际费用都已入账。这次不发修为或宝物，也不能重复接签。旧风隙和原来的渡班没有重新结算。'],[menu('rift-book','回看风隙与旧路','sky-rift'),home]);
 const weather=age<r.start+5?'距变风还有'+(r.start+5-age)+'日。抵达标台时若已变风，入台路多一日、四分灵力。':'变风已经开始。新的入台或原路回退需多一日、四分灵力；慢退仍不耗物资。';
 const stamp='此刻在'+names[r.place]+'；已调查：'+seen+'。'+weather;
 const retreat=work('beacon-shore','沿外侧旧路走回渡岸（一日）',1,{place:'shore'});
 const slow=work('beacon-slow','沿来时扣点缓退三日，不耗物资',3,{place:r.entry},{},'wilderness');
 const finish=(ending,label)=>menu('beacon-'+(ending==='delivered'?'deliver':'withdraw'),label,'sky-beacon-book',patch({ending,finished:age}));
 if(e.node==='sky-beacon-rest')return row('外侧渡岸 · 收功之前',[stamp,'回山后日历照常向前，变风不会等你。已查的地形和已经付过的费用会保留；也可以明确收队，不再继续。'],[book,home,finish('withdrawn','交回探路签，明确结束这次行程')]);
 if(r.place==='shore'){
  if(r.read!==null)return row('原路到岸 · 这一趟有了回程',[stamp,'原纸仍在你的封筒里，尚未交割。可以把它交给探路班，也可以收起委托；这一次不再入台取第二份。'],[
   finish('delivered','把观风原纸交回，完成这一趟'),finish('withdrawn','如实收队，不按完成交割'),home]);
  return row('外侧渡岸 · 从哪里看风',[stamp,
   '上层岩檐和下层回流离岸各一日，两处之间也可用一日横过。每处调查用一日；查过当地入口，才知道怎样走最后两日到标台。',
   oldPath(e)==='ledge'?'你先前留下的定岩仍托得住上层踏点。从那边进标台不另耗铁件；下层入口需一份玄铁搭扣。':'你先前留下的风槽仍接得上下层节拍。从那边进标台不另耗铁件；上层入口需一份玄铁搭扣。',
   r.entry?'上次到过标台但没有取纸，委托尚未结束。可以沿已查过的入口再入，每趟移动按当下风候重新计价。':'先看一侧，可以早些到；两侧都看，能对照完整地形，却会遇到不同的风候。'],[
   work('beacon-ledge','走到上层岩檐（一日）',1,{place:'ledge'}),work('beacon-channel','走到下层回流（一日）',1,{place:'channel'}),menu('beacon-rest','比较回山、暂歇或收队','sky-beacon-rest')]);
 }
 if(r.place!=='beacon'){
  const i=index(r.place),other=i?'ledge':'channel',known=r.surveys[i]!==null;
  const observations=[
   '岩面旧粉线没有断，悬在外面的绳影却先挪了。风向一转，石缝仍能承重，垂到台边的绳却会兜起；把回绳贴在内壁，才不必追着影子找落脚处。',
   '浮标下的水纹不是一圈同时起伏，而是外环先退、内环才接上。原纸挂在两环之间的背风台。放低回程的小标，可以借内环回到这里，不必再攀那段悬绳。',
  ];
  const late=age+2>=r.start+5,days=late?3:2;
  return row(names[r.place]+' · '+(known?'已经亲见的征象':'未辨的入口'),[stamp,known?observations[i]:i?'水纹把倒影分成两半。岸上图纸只画了一道圆圈，站在这里还不能确定哪一环真正接得住身体。':'绳影挂在石面上，旧粉线却从它旁边绕开。只凭岸图，分不出该把重量交给绳还是石缝。',
   ...(known?[r.read!==null?'原纸已经收好。可以对照另一侧，再沿已知旧路回岸，不再重复入台。':'本处入口已经查过。此刻入台按预计抵达日计价：'+days+'日'+(late?'、四分灵力':'')+(oldPath(e)!==r.place?'、一份玄铁搭扣':'，无需另搭铁扣')+'。']:[])],[
   ...(!known?[work('beacon-survey','留一日，亲自对照绳影与气流',1,{surveys:r.surveys.map((d,j)=>j===i?age+1:d)})]:r.read===null?[work('beacon-enter','沿查明的入口走到背风标台',days,{place:'beacon',entry:r.place,arrived:age+days},{spiritCost:late?4:0,items:oldPath(e)===r.place?{}:{iron:1}})]:[]),
   work('beacon-'+other,'横过外岩，去'+names[other]+'（一日）',1,{place:other}),retreat]);
 }
 if(e.node==='sky-beacon-works')return row('背风标台 · 留下怎样的回程',[stamp,
  '把回绳贴住外檐，能直接走回渡岸，要两日、两份玄铁和六分灵力；疏开浮标回流，能先回下层再返岸，要三日、一份行粮和六分灵力。',
  '两种都只是这圈外岩的回程，不会替原来的渡船改航线。也可不修，循来路或缓慢退回。'],[
   work('beacon-moor','固定外檐回绳，开出直返渡岸的路',2,{work:'moor',worked:age+2},{items:{iron:2},spiritCost:6}),
   work('beacon-drift','疏通浮标回流，开出下层归路',3,{work:'drift',worked:age+3},{items:{supplies:1},spiritCost:6}),book]);
 if(e.node==='sky-beacon-exit'){
  const late=age+2>=r.start+5,days=r.work==='drift'?1:r.work==='moor'?2:late?3:2,destination=r.work==='moor'?'shore':r.work==='drift'?'channel':r.entry;
  return row('标台回程 · 路要亲自走完',[stamp,r.work==='moor'?'贴壁回绳已经扣好，可以两日直返渡岸。':r.work==='drift'?'浮标接上了内环，可以一日回到下层回流，再用一日走到渡岸。':'没有改地形，可照查明的入口退回。按预计抵达日检查变风；也可放慢脚步，三日退到入口，不耗物资。'],[
   work('beacon-return','走'+(r.work?'新修的路':'来时入口')+'回'+names[destination]+'（'+days+'日）',days,{place:destination},{spiritCost:!r.work&&late?4:0}),slow,book]);
 }
 return row('背风标台 · 原纸与当天的风',[stamp,
  r.read===null?'铜夹里压着观风原纸，纸上的绳影还贴着标台右侧。今天真正的绳却转到了左边。你把日期对在一起，才发现两幅图都没有画错：旧图漏写的是适用的那一场风。':'原纸已收进封筒。它记录的是过去的风候，你亲见的'+seen+'征象则属于这趟行程，不能用一张图把另一张擦掉。',
  r.work==='moor'?'外檐回绳已经修成，铁件和工期都付过了，可以亲自沿它返岸。':r.work==='drift'?'浮标回流已经疏通，行粮和工期都付过了，可以沿它回到下层。':'要把它带回岸上，还得决定怎样走回去。修一条路会留下不同地形，原路与不耗物资的慢退也都可选。'],[
   ...(r.read===null?[menu('beacon-read','核对日期，将观风原纸收入封筒','sky-beacon-book',patch({read:age}))]:!r.work?[menu('beacon-works','比较贴壁回绳与浮标回流','sky-beacon-works')]:[]),menu('beacon-exit','查看实际可走的回程','sky-beacon-exit'),slow]);
}
