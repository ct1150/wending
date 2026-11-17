const prefix='wending-playtest-segment-';
const idleMs=120000, maxGapMs=30000;

function point(s){
 return {turn:s.turnId,realm:s.life.realm,phase:s.phase,title:s.currentScene?.title??'此生已尽'};
}
export function duration(ms){
 const seconds=Math.floor(ms/1000);
 return (seconds>=3600?Math.floor(seconds/3600)+'小时':'')+(seconds>=60?Math.floor(seconds/60)%60+'分':'')+seconds%60+'秒';
}

// One checkpoint per segment, separate from all gameplay storage. An interrupted
// segment always comes back as an unconfirmed draft, never as a running clock.
export function createPlaytestDiary({storage,clock=()=>performance.now(),wall=()=>Date.now(),id=()=>crypto.randomUUID()}){
 let current=null,last=0,input=0,written=0;
 const save=r=>storage().setItem(prefix+r.id,JSON.stringify(r));
 function records(){
  const store=storage(),rows=[];
  for(let i=0;i<store.length;i++){
   const key=store.key(i);
   if(key?.startsWith(prefix))rows.push(JSON.parse(store.getItem(key)));
  }
  return rows.sort((a,b)=>b.started-a.started);
 }
 function start(snapshot,version){
  if(current||!snapshot?.state?.events||snapshot.state.phase!=='active'||!snapshot.archiveId)throw Error('需要先进入一段进行中的修行人生。');
  const s=snapshot.state,from=point(s);
  const row={id:id(),archiveId:snapshot.archiveId,runId:s.runId,character:s.life.name,version,started:wall(),ended:wall(),from,to:from,
   foregroundMs:0,sections:[{title:from.title,ms:0}],stop:'上次保存处',review:null};
  save(row);current=row;last=input=written=clock();
 }
 function tick(snapshot,{activity=false,stop=''}={}){
  if(!current)return false;
  const now=clock(),gap=now-last,row=current,s=snapshot?.state;
  const same=snapshot?.archiveId===row.archiveId&&s?.runId===row.runId;
  const before=row.to;
  const ms=gap>=0&&gap<=maxGapMs?Math.max(0,Math.min(now,input+idleMs)-last):0;
  row.foregroundMs+=ms;row.sections.at(-1).ms+=ms;last=now;row.ended=wall();
  if(same){
   row.to=point(s);
   if(row.to.title!==before.title)row.sections.push({title:row.to.title,ms:0});
  }
  const reason=stop||(!same?'已更换人生':s.phase==='dead'?'此生已尽':gap>maxGapMs?'页面挂起':now-input>=idleMs?'两分钟未操作':'');
  if(activity)input=now;
  if(reason||before.turn!==row.to.turn||now-written>=10000){
   if(reason)row.stop=reason;
   try{save(row);}catch(error){current=null;throw error;}
   written=now;
  }
  if(reason)current=null;
  return Boolean(reason);
 }
 function review(key,breakSeconds,chapter,comment){
  const item=storage().getItem(prefix+key),r=item&&JSON.parse(item);
  if(!r||r.review||current?.id===key)throw Error('这一段记录已经改变，请重新打开手记。');
  if(!Number.isSafeInteger(breakSeconds)||breakSeconds<0||breakSeconds>Math.ceil(r.foregroundMs/1000))throw Error('休息秒数须在这段记录的时长以内。');
  if(!r.sections.some(s=>s.title===chapter)||typeof comment!=='string'||comment.length>500)throw Error('请核对章节和感受。');
  r.review={confirmedAt:wall(),breakMs:Math.min(r.foregroundMs,breakSeconds*1000),chapter,comment:comment.trim()};save(r);
 }
 function report(){
  const segments=records(),totals=new Map();
  for(const r of segments){
   if(!r.review)continue;
   totals.set(r.archiveId,(totals.get(r.archiveId)??0)+r.foregroundMs-r.review.breakMs);
  }
  return {format:'wending-playtest-v1',unit:'milliseconds',exportedAt:wall(),confirmedMsByArchive:Object.fromEntries(totals),segments};
 }
 return {get active(){return current!==null;},start,tick,records,review,report};
}
