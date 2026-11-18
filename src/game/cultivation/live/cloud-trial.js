import {exactKeys} from './schema.js';

const titles=['盐船的两张船签','雾灯下的换班','样船交到谁手里'];
const stages=[
 ['试航那天，盐包已经卸下。岸上等着两名带空筐回村的人，船尾还有两名要学认白脊的新舵手。渡娘没有替你划掉任何名字，只把两张木签推到桌边。',
  '回村人怕湿的筐要占住踏板边，学徒练舵时又必须留出同一块地方。船上的固定老舵手不变，客位只够一组；把名字挤到一张签上，并不会多出落脚处。'],
 ['灯坊把上次的船签送回来了。今晚等渡的两人要到对岸接替守夜人，两个学徒则想亲自走一遍雾里的报声。窗外的灯都亮着，但能出港的练习船仍只有一条。',
  '先送守夜人，旧班就能回去睡一晚；先带学徒，他们能学会接下一趟。岸上没有突然多出来的第二名教习，必须说明另一组后来怎样过渡。'],
 ['公渡或教船已经照你原来的决定造好，旧物也早已交割。这次不再领取谢礼，而要把样船真正交到新班手里。两名候渡者想先回家，两名学徒想先试完独立掌舵。',
  '候渡者不愿被算成练船时的压舱物，学徒也不愿一直等在能看不能摸的舵旁。船厂让你安排第一趟，第二趟则要写清由谁负责。'],
];
export function cloudTrialStage(e){
 let stage=-1;for(const [i,r] of (e.cloudPassage??[]).entries())if(r.route!==null)stage=i;
 return stage;
}
const mode=(e,stage)=>e.cloudPassage[stage===0?0:1].route===0?'shore':'signal';
const refugeOf=e=>e.cloudRift?.ending?((e.cloudRift.anchor==='moor')!==(e.cloudRift.ending==='change')?'moor':'drift'):null;
function ready(e,r,index){return r.priority==='learners'||r.trained!==null||index>0&&e.cloudTrials[index-1].stage===r.stage-1&&e.cloudTrials[index-1].method===mode(e,r.stage);}

export function validateCloudTrials(e,life){
 const trials=e.cloudTrials;
 if(trials!==undefined&&(!Array.isArray(trials)||!trials.length||trials.length>3))throw Error('云渡试航记录无效。');
 const date=n=>Number.isSafeInteger(n)&&n>=0&&(!life||n<=life.ageDays);
 let previous=-1,finished=0;
 for(const [i,r] of (trials??[]).entries()){
  exactKeys(r,['stage','start','marks','priority','sailed','trained','finished','method','refuge']);
  if(!Number.isInteger(r.stage)||r.stage<=previous||r.stage>cloudTrialStage(e)||!date(r.start)||r.start<1||i>0&&r.start<=finished||
   !Number.isInteger(r.marks)||r.marks<0||r.marks>3||![null,'locals','learners'].includes(r.priority)||
   ![null,'return','shore','signal','rift','released'].includes(r.method)||![null,'moor','drift'].includes(r.refuge))throw Error('云渡试航次序无效。');
  if(r.refuge&&(r.stage!==2||r.refuge!==refugeOf(e)||e.cloudRift.finished>r.start))throw Error('试航不能借尚未完成的风隙。');
  if(r.priority===null?(r.sailed!==null||r.trained!==null||r.method!==null||r.finished!==null):r.marks!==3||!date(r.sailed)||r.sailed<r.start+2)throw Error('试航尚未实际载客。');
  if(r.trained!==null&&(!r.priority||!date(r.trained)||r.trained<r.sailed+3))throw Error('试航教班时日无效。');
  const endBase=r.trained??r.sailed;
  if(r.method===null?(r.finished!==null||i<trials.length-1):!r.priority||!date(r.finished)||r.finished<endBase+({released:0,return:2,shore:3,signal:3,rift:2}[r.method]))throw Error('试航尚未交班。');
  if(['shore','signal'].includes(r.method)&&(r.method!==mode(e,r.stage)||!ready(e,r,i)))throw Error('接班人尚未学会渡法。');
  if(r.method==='rift'&&!r.refuge)throw Error('试航没有可借的风隙。');
  previous=r.stage;finished=r.finished;
 }
 if(['sky-trial-arrange','sky-trial-other'].includes(e.node)&&(!trials?.at(-1)?.priority||trials.at(-1).method))throw Error('尚无待安排的第二组。');
 if(e.node==='sky-trial-other'&&!trials?.at(-1)?.refuge)throw Error('试航没有可比较的风隙。');
 if(['sky-trial','sky-trial-arrange','sky-weather'].includes(e.node)&&cloudTrialStage(e)<0)throw Error('云渡尚未交过一班。');
}

export function cloudTrialNode(state,choice,menu){
 const {events:e,life}=state,trials=e.cloudTrials??[],last=trials.at(-1),latest=cloudTrialStage(e);
 const active=last&&last.method===null,r=active||last?.stage===latest?last:null;
 const book=menu('sky-book','回渡口看守候、风隙与旧渡簿','sky-book');
 const home=menu('train-menu','泊好船，回山整备或修行','training');
 const row=(title,lines,choices)=>({title,goal:'一条样船，先载一组，再明确另一组的去处',location:'白脊渡口的船签桌',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=change=>({cloudTrials:[...trials.slice(0,-1),{...r,...change}]});
 const work=(key,label,target,days,change,rule={},next='sky-trial')=>choice(key,label,'explore',target,'cautious',{next,patch:patch(change),rule:{days,...rule}});
 if(!r)return row('渡班补验 · '+titles[latest],[stages[latest][0],'这是当下渡班新安排的一次试航，过去已完成的航次、修为与物品不重新结算。花一日核对船签，再亲自看船位与候渡名册。',...(last?['较早一次试航留下的'+({shore:'岸上轮值',signal:'船上报声',return:'亲自返航',released:'交回常班',rift:'借隙接送'}[last.method])+'仍写在簿里；只有紧邻前班练成同法的接班班次能直接续接，跳过中间一班须重新教班。']:[])],[
  choice('trial-accept','留一日核签，接下这一班试航','explore','supplies','cautious',{next:'sky-trial',rule:{days:1},patch:{cloudTrials:[...trials,{stage:latest,start:life.ageDays+1,marks:0,priority:null,sailed:null,trained:null,finished:null,method:null,refuge:latest===2?refugeOf(e):null}]}}),book,home]);
 if(r.method){
  const first=r.priority==='locals'?'候渡者':'学徒',second=r.priority==='locals'?'学徒':'候渡者';
  const ending={return:'你亲自把船驶回，把另一组接到对岸。两组都走过了水路，但接班人没有因此凭空学会隔岸发令。',shore:'岸上轮值班按约接起第二组。你没有站在舵旁；两岸值守者各自报清了交接，下一班可以沿用这种岸上轮值。',signal:'新舵手先报出船位，再等对岸答声才离泊。第二组照这套报声过渡，下一班已有能独立报声接船的人。',rift:r.refuge==='moor'?'你明确借用定下的岩面，带第二组在落脚处转乘。旧船没有被自动改线；这次借道只属于本次签下的安排。':'你循已接续的风槽给空船引航，再将第二组接上旧渡线。这次借隙由你亲自做成，不等于学徒已经学会独行风槽。',released:'你把未服务的'+second+'交回原有常班，告诉他们按常班次序等候。你只亲自完成了'+first+'这一组；渡簿没有把两组都写成你的功劳。'}[r.method];
  return row(titles[r.stage]+' · 船签已收',[ending,'核签、行船和教班的代价已经按实际记录保存。这一班不能再接一次，也不会多发先前云渡已交割的宝物。'],[book,home]);
 }
 if(!r.priority){
  if(r.marks!==3)return row(titles[r.stage]+' · 先看船与人',[stages[r.stage][1],...(r.marks&1?['船位已看过：客舱两席，一组就占满。老舵手占固定船位，不额外占用这两席；不能靠多带行粮多塞一组。']:[]),...(r.marks&2?['两份名册已核对：候渡者先走能早些到家；学徒先走能随老舵手练成这条路，回来便可参与接班。没先走的一组仍留岸上，不会因你点了出发就一同抵达。']:[])],[
   ...(!(r.marks&1)?[menu('trial-boat','上船核对两席与操舵位置','sky-trial',patch({marks:r.marks|1}))]:[]),
   ...(!(r.marks&2)?[menu('trial-shore','向两组人核对先后安排','sky-trial',patch({marks:r.marks|2}))]:[]),home]);
  return row(titles[r.stage]+' · 第一趟载谁',[stages[r.stage][0],'两组各需全部客位。第一趟用两日、一份行粮、两分灵力，船上还有固定老舵手协助。另一组留下等你安排；先带学徒，能把接班的本事留在船上。'],[
   ...['locals','learners'].map(priority=>work('trial-'+priority,priority==='locals'?'先接候渡者，让他们先到对岸':'先带学徒，沿途教认路与交接',priority==='locals'?'supplies':'manual',2,{priority,sailed:life.ageDays+2},{items:{supplies:1},spiritCost:2})),home]);
 }
 const second=r.priority==='locals'?'学徒':'候渡者',method=mode(e,r.stage),qualified=ready(e,r,trials.length-1);
 if(e.node==='sky-trial-other')return row(titles[r.stage]+' · 借道或交回',[
  r.refuge==='moor'?'定岩上的落脚处还在。这次可以明确把第二组带到岩面转乘，不会改写先前的渡船航线。':'风槽的两拍已经接续。这次可以亲自为接人的空船引航，不把这种能力算在普通舵手身上。',
  '借道要两日、四分灵力；也可以明确交回原有常班，自己不再承担第二趟。'],[
  work('trial-refuge','明确借用已完成的风隙接续','iron',2,{method:'rift',finished:life.ageDays+2},{spiritCost:4}),
  menu('trial-release','交回常班，不再承担第二趟','sky-trial',patch({method:'released',finished:life.ageDays})),
  menu('trial-arrange','回去比较渡班接续','sky-trial-arrange')]);
 if(e.node==='sky-trial-arrange')return row(titles[r.stage]+' · 谁来接第二组',[
  '还有'+second+'留在岸上。'+(method==='shore'?'这次沿用岸上轮值：两岸都要有人认得放索与收索的时机。':'这次沿用船上报声：舵手要先报船位，并等到对岸应答。'),
  qualified?(r.trained!==null?'你已另留三日教会这一班人，四分灵力也已付过；现在可以让他们接续，不必再教一次。':r.priority==='learners'?'学徒已经随第一趟学过这条路，现在可以让他们接续候渡者。':'紧邻前班留下了同法接班的人，可以直接让他们接续。'):'现有渡法仍能通船，但还没有能独立接班的人。你可以再教三日、付四分灵力；也可以返回亲自掌舵，或将这份任务交回常班。',
  ...(r.refuge?[r.refuge==='moor'?'试航接签前，你已留下可驻足的定岩。可以明确借它转乘，另用两日、四分灵力。':'试航接签前，你已接续风槽。可以亲自给空船引航，另用两日、四分灵力。']:[])],[
   qualified?work('trial-relay',method==='shore'?'让岸上轮值班接续另一组':'让报声舵手接续另一组','manual',3,{method,finished:life.ageDays+3},{spiritCost:2}):work('trial-teach','留三日教会接班人，再作安排','manual',3,{trained:life.ageDays+3},{spiritCost:4},'sky-trial-arrange'),
   ...(r.refuge?[menu('trial-other','比较借风隙转乘，或交回常班','sky-trial-other')]:[menu('trial-release','交回常班，不再承担第二趟','sky-trial',patch({method:'released',finished:life.ageDays}))]),
   menu('trial-return','再比较亲自返航或回山','sky-trial')]);
 return row(titles[r.stage]+' · 一组已到岸',[
  (r.priority==='locals'?'候渡者踏上了对岸，学徒仍在原岸等船。':'学徒完成第一趟，能照着旧渡法报出交接；候渡者仍在原岸等船。'),
  '第二组并未消失。亲自返航用两日和一份行粮；也可以安排接班，或暂且回山。已经完成的第一趟不再收费。'],[
  work('trial-ferry','亲自返航，把另一组接过来','supplies',2,{method:'return',finished:life.ageDays+2},{items:{supplies:1}}),menu('trial-arrange','看看接班人与可用的通路','sky-trial-arrange'),home]);
}
