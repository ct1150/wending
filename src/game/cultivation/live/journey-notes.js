import {eventNode} from './event-content.js';
import {realmFor} from './cultivation-rules.js';
import {DAYS_PER_YEAR} from './model.js';
import {harvestWindows} from './phenology.js';
import {postWindows} from './lin-post.js';
import {shellTide} from './shell-ferry.js';
import {charterNote} from './harbor-charters.js';
import {nurseryWindow} from './entry-nursery.js';
import {saltWindow} from './salt-field.js';
import {riverCases} from './river-chronicle.js';
import {councilHearings} from './mountain-council.js';

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
 if(e.mountain&&!e.mountain.ending)add('mount-book','折山石',e.mountain.wind&&!e.mountain.wind.ending?'已陪小满练过一日，等着商量下一步怎样同行。':'已留下'+e.mountain.walk.length+'关入定记录。石里的路从上次留下的地方接续。');
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
  // The letter and shore deadlines already appear in the native choice preview.
  if(n.node==='post-book'||n.node==='post-shore')return false;
  if(n.node==='work'&&here.startsWith('nursery-'))return false;
  if(n.node==='post-stations')return true;
  return !here.startsWith(n.node==='watch-trail'?'watch-trail':n.node.split('-')[0]);
 }).map(n=>n.title);
 return names.length?'此行结束时已过'+names.join('、')+'的期限。':'';
}

// These menu screens can be read on the way to a known entry. A trip, promise,
// reward or quest patch is a player decision even when it happens to cost zero days.
const shelves=new Set(['hub','training','rest','journey','resources','workshop','crossing','affairs','mentor','post-index','post-book','post-history','watch-book','watch-visitors','field-guide','garden-book','garden-history','river-book','voyage-book','council-book']);
export function noteMenuSteps(state){
 return eventNode(state).choices.filter(c=>c.navigation&&c.targetId==='self'&&c.approach==='observe'&&!c.arrival&&!c.rule&&Object.keys(c.patch??{}).every(k=>k==='page'));
}
export function noteRoutes(state,notes){
 const routes=new Map(),wanted=new Set(notes.map(n=>n.node));
 if(!wanted.size)return routes;
 const queue=[{s:state,path:[]}],visited=new Set();
 for(let i=0;i<queue.length&&routes.size<wanted.size;i++){
  const {s,path}=queue[i],e=s.events,key=e.node+'#'+e.page;
  if(visited.has(key))continue;visited.add(key);
  if(wanted.has(e.node)&&!routes.has(e.node))routes.set(e.node,path);
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
