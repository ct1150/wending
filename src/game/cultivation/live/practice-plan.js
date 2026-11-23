import {DAYS_PER_YEAR} from './model.js';
import {nextRealmFor,v7ActionRule} from './cultivation-rules.js';
import {harvestWindows} from './phenology.js';
import {postWindows} from './lin-post.js';
import {shellTide} from './shell-ferry.js';
import {nurseryWindow} from './entry-nursery.js';
import {saltWindow} from './salt-field.js';
import {charterNote} from './harbor-charters.js';
import {crossingDeadlines,journeyNotes} from './journey-notes.js';

// Only the repeatable, ordinary steady action is eligible. Story retreats
// consume the same days but have a player decision on the other side.
export function practicePlan(state){
 const e=state?.events;
 if(state?.phase!=='active'||!['training','action-result'].includes(e?.node))return null;
 const key=e.node==='training'?'practice':'practice-again';
 const action=state.currentScene?.choices.find(p=>p.id.endsWith(':c:'+key)&&p.intent==='practice'&&p.approach==='steady');
 const life=state.life,next=nextRealmFor(life);
 if(!action||!next||life.cultivation>=next.threshold)return null;
 const rule=v7ActionRule(state,action);
 if(rule.reason||rule.checkKind||rule.cultivation<=0||rule.days<=0)return null;
 const requested=Math.ceil((next.threshold-life.cultivation)/rule.cultivation);
 const spirit=life.cultivationProfile.spirit,age=life.ageDays;
 let count=requested,stop='达到'+next.name+'的修为门槛',stopNode=null;
 function limit(maximum,reason,node=null){
  if(maximum<count){count=Math.max(0,maximum);stop=reason;stopNode=node;}
 }
 if(rule.spiritCost)limit(Math.floor(spirit/rule.spiritCost),'再练一关前需要调息');
 const breakthrough=v7ActionRule(state,{...action,approach:'breakthrough',targetId:next.id});
 limit(Math.floor((life.lifeLimit*DAYS_PER_YEAR-age-breakthrough.days-1)/rule.days),'为冲关留出所需寿元');

 const times=[...harvestWindows(state).map(t=>({...t,node:'garden-book'})),...postWindows(e.post)];
 const nursery=nurseryWindow(e);if(nursery)times.push({...nursery,node:'work'});
 const salt=saltWindow(e,age);if(salt)times.push({...salt,node:'seed-book'});
 const packet=charterNote(e,age);if(packet?.window)times.push({...packet.window,name:packet.title,node:'packet-book'});
 const ferry=shellTide(e.ferry);if(ferry)times.push({...ferry,node:'shell-book'});
 const trail=e.watch?.trail;
 if(trail&&!trail.outcome&&life.cultivationProfile.worldTier===trail.world)times.push({name:'栗溪同行之约',open:trail.start,close:trail.start+5,node:'watch-trail'});
 if(e.mine&&e.mine.record.length<3)times.push({name:'灯棚交班',open:e.mine.start,close:e.mine.start+19,node:'mine-book'});
 if(life.cultivationProfile.experience?.commitment?.status==='owed')times.push({name:'向顾师叔还粮',open:0,close:100*DAYS_PER_YEAR-1,node:'mentor'});
 if(e.post&&!e.post.ending&&e.post.route!=='pass'&&life.cultivationProfile.worldTier===0)times.push({name:'凡界药路的当面交割',open:0,close:80*DAYS_PER_YEAR-1,node:'post-book'});
 for(const {name,open,close,node} of times){
  if(age>close)continue;
  // If an entire turn would skip the window, stay on the near side.
  limit(Math.floor((close-age)/rule.days),'再闭一关会错过'+name,node);
  if(age<open)limit(Math.ceil((open-age)/rule.days),'出关可处理'+name,node);
 }
 return {choiceId:action.id,requested,count,days:count*rule.days,spirit:count*rule.spiritCost,
  gain:count*rule.cultivation,exposure:Math.min(100-life.cultivationProfile.exposure,count*rule.exposure),exposurePerTurn:rule.exposure,stop,stopNode};
}

export function gatherPlan(state){
 if(state?.phase!=='active'||state.events?.version!==2||state.life.injury>1)return null;
 const action=state.currentScene.choices.find(c=>c.id.endsWith(':c:gather-again')&&c.intent==='explore'&&c.approach==='cautious');
 if(!action)return null;
 const life=state.life,rule=v7ActionRule(state,action);
 if(rule.reason||rule.days<=0||life.cultivationProfile.spirit<rule.spiritCost)return null;
 const remaining=life.lifeLimit*DAYS_PER_YEAR-life.ageDays;
 const notes=journeyNotes(state);
 let count=0;
 while(count<3){
  const days=rule.days*(count+1);
  if(days>=remaining||crossingDeadlines(state,notes,days)||rule.spiritCost*(count+1)>life.cultivationProfile.spirit)break;
  count++;
 }
 return {choiceId:action.id,item:action.targetId,count,days:rule.days*count,stop:'已搜完所选次数'};
}
