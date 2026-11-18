import {eventNode} from './event-content.js';
import {realmFor,nextRealmFor,V7_REALMS} from './cultivation-rules.js';
import {DAYS_PER_YEAR,ITEMS} from './model.js';
import {harvestWindows} from './phenology.js';
import {postWindows} from './lin-post.js';
import {shellTide,ferryForMaterial} from './shell-ferry.js';
import {charterNote} from './harbor-charters.js';
import {nurseryWindow} from './entry-nursery.js';
import {saltWindow} from './salt-field.js';
import {riverCases} from './river-chronicle.js';
import {councilHearings} from './mountain-council.js';
import {canStudyForm} from './technique-forms.js';
import {canVisitRift} from './cloud-rift.js';

// Invitations explain the existing long route without accepting its work or
// putting undiscovered stories into the journal of actual commitments.
export function adventureLeads(state){
 if(state?.phase!=='active'||!state.events||state.events.entry==='unresolved')return [];
 const e=state.events,leads=[],rank=realmFor(state.life).rank,watch=e.watch?.record.length??0;
 const add=(node,title,detail)=>leads.push({node,title,detail});
 if(e.entry==='accepted')add('work','先安顿这一程','三日药圃差事仍未交割。可先回棚看清约定，也可以辞工后另寻修行的路。');
 else if((e.river?.record.length??0)<riverCases)add('river-book','问川 · 从一条河开始','问川图已落款 '+(e.river?.record.length??0)+' / '+riverCases+' 折。沿河访人、辨清线索，自己的选择会带到后面的行旅和北山。');
 else if(e.expedition?.place!=='end')add('voyage-book','行旅 · 亲自走出河图','河上六折已合卷。接着走引灯、观星和雪营三程；路图里选过的苗契，也会改变沿途的处境。');
 else if((e.council?.length??0)<councilHearings)add('council-book','北山 · 把所学用在现世','三程行旅已归来，北山还有 '+(councilHearings-(e.council?.length??0))+' 件事待定。随境界渐进，才能辨清更深的水脉与地势。');
 else if((e.convoy?.chapters.reduce((n,c)=>n+c.loads.length,0)??0)<6){
  const chapters=e.convoy?.chapters??[],last=chapters.at(-1),index=chapters.length-(last&&last.loads.length<2?1:0),tier=state.life.cultivationProfile.worldTier;
  add('convoy-book','海路 · '+['沉钟湾','白汀','照影台'][index],tier<index?'上一港的两潮已交割。下一封信来自另一界，须亲自备妥境界与资用；海图旁有校阵和渡界的去处。':'北山的潮信把你带到这里。两潮一港，所送的人与物会改变后续航程；三界海路等你逐程走完。');
 }
 if(watch<9){
  const needed=Object.values(V7_REALMS)[watch].name;
  add('watch-book','修行 · 九关问鼎','已交割 '+watch+' / 9 关。'+(rank<watch?'下一关须到'+needed+'境再入定。':'下次闭关前，可先与守关人商量关外的事。')+'九关经历与渡劫境齐备后，可到铸坊决定此生怎样问鼎。');
 }else add('watch-ding-book',e.watch.ding?.form?'问鼎 · 此生已有交割':'问鼎 · 三足取自一生',e.watch.ding?.form?'鼎铭已按你的决定留下。仍可回看旧事、继续此生；下一世须等这位人物真正走到生命尽头。':rank<9?'九关已交割。继续修至渡劫，再从三段人生各取一足，亲自决定鼎的去处。':'九关与境界已齐备。到山门铸坊取足、开范，决定哪些经历留给后来的人。');
 if(e.entry==='accepted')return leads;
 const life=state.life,tier=life.cultivationProfile.worldTier,opportunities=[];
 const invite=(node,title,detail)=>opportunities.push({node,title,detail});
 if(!e.post&&tier===0&&life.ageDays<80*DAYS_PER_YEAR){
  const node=e.companion==='unmet'?'companion':['helped','declined'].includes(e.companion)&&rank>=1?'reunion':'post-book';
  invite(node,'林砚 · 此世的同路人',node==='companion'?'先到外院看看林砚的处境，是否相助由你当面决定。以后还可与他试走药路，留下跨越数十年的往来。':node==='reunion'?'林砚在近山有一次采药邀约，同行或各走各路都可亲自答复。之后还能听他讲那只空药匣。':'药路有三次按年到来的交割，二十五年后还有旧匣与后辈的故事。林砚本人的邀约限凡界八十岁前；晚些应约，未必赶得上后段的相聚。');
 }
 if(rank>=2&&!e.forms?.known&&!e.forms?.draft)invite(canStudyForm(life)?'form-book':'mentor','本命术式 · 把修为用在险路',canStudyForm(life)?'可以推演听泉或护身，亲自闭关练成。术式能改变寻材风险，也可用于折山同行与上界风隙；前往法页后再选择怎样练。':'筑基后可以推演专修术式，当前功法还需先验看缺处。到校法页比较自研与求助，完成修补后再决定是否练听泉或护身。');
 const material=nextRealmFor(life)?.material;
 if(rank===3&&!e.well)invite('well-road','回声井 · 随人下井寻印','结丹可随巡井人或绳班探归魂印。学辨铃或绳结会改变后续工期，出井后还有副铃的去处。先看路引，出发才交行粮；未取印就离开此界，将不能亲自接续井路。');
 else if(material&&ferryForMaterial(state,material)&&(!e.ferry||e.ferry.pages.at(-1)?.end))invite('shell-book','浮蚌渡 · 宝物与归路','当前破境所需的宝物可循浮蚌潮纹寻找。蓼的船底和回游的蚌群也依赖这些东西；先到河岸看清情形，决定出发后才开始计算这一潮的期限。');
 if(!e.mountain)invite('mount-book','折山石 · 带着自己的心愿入定','盆架闲下时，可以展开石中六关。选择想回家还是寻源，与小满同行；每次练功照常结算修期与修为，信物与已学术式会改变后来的辨路和分别。');
 if(tier<2&&rank>=(tier?4:2))invite('crossing-ways','界台 · 筹备前往'+(tier?'上界':'中界'),'当前境界已经可以承受古阵，可自行备阵盘与路费；也可查看正途飞升的条件。前往只看路线，不会开阵或接受海路委托。');
 if(tier===2&&rank>=4&&!e.cloudPassage)invite('sky-book','白脊云渡 · 在上界亲历风候','随渡班在岸上或船中闭关，再亲自决定怎样试航。元婴、炼虚、大乘各有一班，旧井铃与先前的渡法会改变后来的办法。');
 if(tier===2&&rank>=5&&!e.homebound)invite('home-book','归航者 · 舟灵与醒来的人','港外残舟里有人开始说话。舟灵岑照想修成归乡船，他们却渐渐有了自己的愿望。从化神至大乘四次同行，承诺会改变往后的合作。先去听听，确认承诺后再自行备粮登船。');
 if(!e.cloudRift&&canVisitRift(state))invite('sky-rift','白脊风隙 · 用所学走进异变','化神后可循已经交接的旧渡路探访浮岩。调查支点与回流，勘路或施术入隙；首次定脉后，到合体再处理自己留下的变化。先看现场，出发才交粮。');
 if(e.cloudRift?.ending&&!e.riftBeacon)invite('sky-beacon-book','回风孤标 · 走一圈有回程的路','探路班想取回外岩标台的观风原纸。调查会耗时，第五日变风；旧定脉能帮你走不同入口，返岸的路仍须亲自决定。读信不算起行。');
 return [...opportunities,...leads];
}

// Only events the character has entered belong here. Reading a note never opens an event.
export function journeyNotes(state){
 if(state?.phase!=='active'||!state.events)return [];
 const e=state.events,life=state.life,age=life.ageDays,tier=life.cultivationProfile.worldTier,rank=realmFor(life).rank;
 const notes=[];
 function add(node,title,detail,window,late='约期已过，可查看留下的记录'){
  let timing='',priority=3,date=0;
  if(window){
   if(age<window.open){timing='再过'+(window.open-age)+'日开始';priority=1;date=window.open;}
   else if(age>window.close){timing=late;priority=2;date=window.close;}
   else if(window.close===Infinity){timing='现在可以办理';priority=1;date=age;}
   else{timing=window.close===age?'今天是最后一日':'还剩'+(window.close-age)+'日';priority=0;date=window.close;}
  }
  notes.push({node,title,detail,timing,priority,date,close:window?.close});
 }
 const w=e.well;
 if(e.homebound&&!e.homebound.ending)add('home-book','与岑照的归航约定','已起行 '+e.homebound.visits.length+' / 4 幕。'+(e.homebound.place==='ship'?'人还在船上，须亲自走回港外才能修行或辞别。':'可从港外接着上一幕；尚未具备下一幕境界时，可以先继续自己的修行。'));
 if(e.riftBeacon&&!e.riftBeacon.ending){
  const r=e.riftBeacon;
  add('sky-beacon-book','回风孤标',r.entry?'标台已经去过，回程与原纸交割仍按实际行程接续。':'已到外侧渡岸，调查与移动都会过日；晚到可付出代价继续，不会永远失去通路。',{open:r.start,close:r.start+4},'已经变风，按现在的路线与费用继续');
  notes.at(-1).timing=age<r.start+5?'距变风还有'+(r.start+5-age)+'日':'已经变风，按现在的路线与费用继续';
 }
 if(e.cloudTrials?.at(-1)?.method===null)add('sky-trial','白脊试航船签',e.cloudTrials.at(-1).priority?'已有一组实际到岸，另一组仍待接班安排；可续行，也可交回常班。':'已接下试航，可以回船签桌核对船位和两组人的先后。');
 if(e.cloudRift)add('sky-rift','白脊风隙',e.cloudRift.ending?'再访已经结束，可回看自己留下的通路。':e.cloudRift.returned!==null?'已再入风隙，等你处理旧办法留下的变化。':e.cloudRift.anchor?(rank>=7?'已到合体，可以带粮再访当年的风隙。':'首次定脉已成，到合体可再入风隙。'):'已探到浮岩下，可从原处继续调查或入隙。');
 if(e.forms?.draft)add('form-book','本命术式','已选好要演练的气路，可以回去安排这一关。');
 const ridge=e.ridgeRoad?.at(-1);
 if(ridge&&ridge.ending===null)add('ridge-'+ridge.site,'走山驿的路',ridge.aligned?'试路已经做完，可以决定留下哪种设施。':'去现场的行粮已交，可以回去接着验路。');
 if(e.saltField&&!e.saltField.ending){
  const field=e.saltField;
  const window=saltWindow(e,age);
  add('seed-book','盐埠借种',field.parcel?(tier===2?'递种亭已收到封筒，可以决定去处。':'封筒已离岸，抵达上界可以查收。'):window.name==='盐埠改畦'?'水土不合，若要救苗须留三日动工。':'试畦已下种，可以回去看苗或收签。',window);
 }
 const passage=e.cloudPassage;
 if(passage&&!(passage.length===3&&passage[2].route!==null)){
  const last=passage.at(-1),nextRank=[4,6,8][passage.length];
  add('sky-book','白脊云渡',last.route===null?'这一班已出关，渡工在等你决定怎样试航。':
   rank>=nextRank?'下一班的请托已经到了，可以回上界渡口守风。':'渡路已交班，到'+(passage.length===1?'炼虚':'大乘')+'境可回访。');
 }
 if(w&&!w.reply&&(!w.claim||rank>=4||tier===w.world)){
  const remote=w.world!==tier;
  if(!w.claim&&!remote){
   const stage=w.rig?(w.rig==='sluice'?'已排开侧闸':'已把吊篮架到龛口')+'，待决定怎样起印。':
    w.clue?(w.clue==='chalk'?'已找出石壁的假回声':'已学会井底的绳结信号')+'，待选进龛的路。':'首程行粮已交，还没选跟哪一班辨铃。';
   add('well-book','回声井',stage);
  }else if(!w.claim)add('well-book','隔界的井班回单','你已离开旧井所在的界域，可查当年的行程和回单。');
  else if(rank>=4)add('well-book','井班的副铃',remote?'井班已托驿船寄来副铃，可在此界校音。':'井班等你定下新铃交给谁。');
  else if(w.claim)add('well-book','回声井', '起印已经结束，到元婴境还可以替后来接班的人校铃。');
 }
 const tide=shellTide(e.ferry),last=e.ferry?.pages.at(-1);
 if(tide)add('shell-book','浮蚌渡 · '+tide.name.replace(/退潮$/,''),last.way==='deck'?'已登船探潮，船簿记着上次停下的地方。':'已沿岸查潮，船簿记着上次停下的地方。',tide,'潮已退，可回岸边收下空回单');
 else if(last?.end==='borrow'&&!e.ferry.reply)add('shell-book','向蓼借石之约',rank>=6?'已到炼虚境，可以重定归航的位置。':'借石时应下的回航之约，要到炼虚境才能履行。');
 const windows=harvestWindows(state);
 if(windows.length){
  const next=windows.find(t=>age<=t.close)??windows.at(-1);
  add('garden-book',next.name,'苗盆随身，出关和行路都照常走时。',next,'末候已过，可回盆架收拾散种');
 }
 const trail=e.watch?.trail;
 if(trail&&!trail.outcome){
  if(trail.world===tier)add('watch-trail','栗溪同行','你应下了陪陶禾同行的六日之约。',{open:trail.start,close:trail.start+5},'水已涨，可回驿棚收留字');
  else add('watch-trail','栗溪留字','你已跨界，可回驿棚读到陶禾的留字。');
 }
 if(e.mine&&e.mine.record.length<3&&tier===0)add('mine-book','石肺三硐','已走完'+e.mine.record.length+'硐，灯油尚有'+e.mine.lamp+'格。',{open:e.mine.start,close:e.mine.start+19},'外班已经接手，可查当时的灯簿');
 for(const t of postWindows(e.post)){
  const node=t.node;
  if(node==='post-shore'&&(tier!==0||age>=80*DAYS_PER_YEAR)){add(node,'阿枳的潮约','已经赶不回约好的潮时，可收下留下的纸页。');continue;}
  add(node,t.name,node==='post-book'?'已办理'+e.post.steps.length+'封药路回单。':node==='post-shore'?'阿枳的手记还留着这次看潮的约定。':'查看已派出的站班与交账记录。',t);
 }
 if(life.cultivationProfile.experience?.commitment?.status==='owed')add('mentor','校法还粮','当年校法时答应还一份行粮。',{open:0,close:100*DAYS_PER_YEAR-1},'旧约仍在记录中，可查当年的来路');
 if(e.mountain&&!e.mountain.ending)add('mount-book','折山石',e.mountain.walk[4]?.exit==='echo'?'已施术进入雪脊返照，旧影仍等着你的回应。':e.mountain.wind&&!e.mountain.wind.ending?'已陪小满练过一日，等着商量下一步怎样同行。':'已留下'+e.mountain.walk.length+'关入定记录。石里的路从上次留下的地方接续。');
 if(e.watch?.draft)add('watch-book','守关簿',e.watch.draft.days?'已经出定，待读守关人的回信。':e.watch.draft.marks?'值守条件已写好，可回去核对再入定。':'本次值守委托尚未交割。');
 if(e.entry==='accepted'){
  const r=e.nursery;
  if(r)add('work','药圃工簿',r.care?'已做两个工日，待交付收成。':'已做一个工日，待决定守哪一畦。',nurseryWindow(e),'旧苗过季，可补做余工领卷');
  else add('work','药圃差事','已经应下三日差事，功法尚未到手。');
 }
 if(e.river&&e.river.record.length<riverCases)add('river-book','问川图','已结'+e.river.record.length+'折，'+(e.river.seen?'本折查过的线索还在。':'可从这一折接着走。'));
 if(e.expedition&&e.expedition.place!=='end')add('voyage-book','三程行旅','行旅簿已收下'+e.expedition.volume+'枚图印。');
 if(e.council!==undefined&&e.council.length<councilHearings)add('council-book','北山公簿','已留下'+e.council.length+'处落款，可翻到下一件事。');
 if(e.convoy?.chapters.length){
  const packet=charterNote(e,age);
  if(packet)add('packet-book',packet.title,packet.detail,packet.window,'货期已过，可以回港收簿');
  const loads=e.convoy.chapters.reduce((n,c)=>n+c.loads.length,0);
  if(loads<6)add('convoy-book','三界海路','两潮一港，已经发出'+loads+'班船。'+(e.convoy.draft?'本班候船名单已留存。':''));
 }
 return notes.sort((a,b)=>a.priority-b.priority||a.date-b.date);
}

export function crossingDeadlines(state,notes,days){
 if(!days)return '';
 const age=state.life.ageDays,here=state.events.node;
 const names=notes.filter(n=>{
  if(!(n.close>=age&&age+days>n.close))return false;
  if(n.node==='sky-beacon-book')return false;
  // The letter and shore deadlines already appear in the native choice preview.
  if(n.node==='post-book'||n.node==='post-shore')return false;
  if(n.node==='work'&&here.startsWith('nursery-'))return false;
  if(n.node==='post-stations')return true;
  return !here.startsWith(n.node==='watch-trail'?'watch-trail':n.node.split('-')[0]);
 }).map(n=>n.title);
 const beacon=state.events.riftBeacon,wind=beacon&&!beacon.ending&&!here.startsWith('sky-beacon-')&&age<beacon.start+5&&age+days>=beacon.start+5;
 return (names.length?'此行结束时已过'+names.join('、')+'的期限。':'')+(wind?'此行结束时回风孤标已经变风，仍可继续探路，通路费用按新的风候结算。':'');
}

export function preparationStops(state){
 if(state?.phase!=='active'||!state.events||state.events.entry==='unresolved')return [];
 const life=state.life,materials=[...new Set([nextRealmFor(life)?.material??'relic','supplies','stones','herbs','iron'])];
 return [
  ...materials.map((item,page)=>({id:'resource-'+item,node:'resources',page,item,title:ITEMS[item]+'去处',detail:'行囊现有 '+(life.items[item]??0)})),
  ...['medicine','artifact','talisman','array','elixir'].map((item,page)=>({id:'recipe-'+item,node:'workshop',page,item,title:ITEMS[item]+'配方',detail:'行囊现有 '+(life.items[item]??0)})),
 ];
}

// These menu screens can be read on the way to a known entry. A trip, promise,
// reward or quest patch is a player decision even when it happens to cost zero days.
const shelves=new Set(['hub','training','rest','journey','resources','workshop','crossing','affairs','mentor','companion','post-index','post-book','post-history','watch-book','watch-visitors','field-guide','garden-book','garden-history','river-book','voyage-book','council-book','sky-book','sky-weather','sky-lodgings','sky-rift','sky-harbor']);
export function noteMenuSteps(state){
 return eventNode(state).choices.filter(c=>c.navigation&&c.targetId==='self'&&c.approach==='observe'&&!c.arrival&&!c.rule&&Object.keys(c.patch??{}).every(k=>k==='page'));
}
export function noteRoutes(state,notes){
 const routes=new Map(),targets=new Map(notes.map(n=>[n.id??n.node,n])),wanted=new Set(notes.map(n=>n.node));
 if(!wanted.size)return routes;
 const queue=[{s:state,path:[]}],visited=new Set();
 for(let i=0;i<queue.length&&routes.size<targets.size;i++){
  const {s,path}=queue[i],e=s.events,key=e.node+'#'+e.page;
  if(visited.has(key))continue;visited.add(key);
  for(const [id,n] of targets)if(n.node===e.node&&(n.page===undefined||n.page===e.page)&&!routes.has(id))routes.set(id,path);
  if(path.length&&!shelves.has(e.node))continue;
  for(const c of noteMenuSteps(s)){
   if(!shelves.has(c.next)&&!wanted.has(c.next))continue;
   if(!path.length&&!state.currentScene?.choices.some(p=>p.id.endsWith(':c:'+c.key)))continue;
   const events={...e,...c.patch,node:c.next};
   if(!visited.has(events.node+'#'+events.page))queue.push({s:{...s,events,turnId:s.turnId+1,currentScene:null},path:[...path,c.key]});
  }
 }
 return routes;
}
