import {DAYS_PER_YEAR} from './model.js';
import {exactKeys} from './schema.js';
import {shoreNode,validateShore} from './zhi-shore.js';
import {stationNode,validateStations,stationVisitWindow} from './post-stations.js';

const years=DAYS_PER_YEAR;
const seasons=[
 {open:1,close:4,choices:['ferry','yard','returned']},
 {open:5,close:10,choices:['partner','bell']},
 {open:12,close:20,choices:['witness','anonymous']},
];
const late=['missed','delegated'];
const places=['渡口的篷房','石阶上的晒院'];
const office=p=>p.route==='relay'?0:1;
const reached=p=>p.steps[0]?.decision===(p.route==='relay'?'ferry':'yard');
export function postWindows(p){
 if(!p||p.route==='pass')return [];
 const times=[],station=stationVisitWindow(p);
 if(station)times.push(station);
 if(p.walk&&!p.walk.outcome)times.push({name:'阿枳的潮约',open:p.walk.start,close:p.walk.start+4});
 if(!p.ending){
  const s=seasons[p.steps.length];
  times.push({name:s?'药路第'+(p.steps.length+1)+'封回单':'旧匣交割',open:p.start+(s?.open??25)*years,close:s?p.start+s.close*years-1:Infinity});
 }
 return times;
}
export function postNotice(p,age,days){
 if(!p||p.route==='pass'||p.walk?.outcome)return null;
 const forecast=days!==undefined;
 if(p.walk){
  const left=p.walk.start+4-age;
  if(forecast)return left>=0&&days>left?'这次行动结束时会错过阿枳约定的潮。':null;
  return left<0?'与阿枳的潮约已过，可以回手记收信。':'阿枳的潮约还剩'+left+'日，可从故人手记接续。';
 }
 if(p.ending)return null;
 const i=p.steps.length,elapsed=age-p.start;
 const until=(seasons[i]?.open??25)*years-elapsed;
 const left=(seasons[i]?.close??Infinity)*years-elapsed;
 if(forecast)return left>0&&days>=left?'此行会经过药路换班日，未办的第'+(i+1)+'封回单将逾期。':null;
 if(until>0)return '药路手记再过'+until+'日'+(i===3?'可定旧匣去处。':'开下一封回单。');
 if(i===3)return '旧匣已可交割。林砚留下的手记在故人一页。';
 return left>0?'药路第'+(i+1)+'封回单已到，再过'+left+'日换班。':'药路换过班了，可以读当时留下的第'+(i+1)+'封回单。';
}
function receipt(p,i){
 const decision=p.steps[i].decision;
 if(decision==='missed')return [
  '第一张回单写着「原封退栈」。换班以前没有完成交割，后来人没把缺的一笔补成送达。',
  '第二张回单只有阿枳自己的字。等候已过，她报名做了轮值的脚夫，没拿你的名字充作保人。',
  '第三张回单记着「暂用旧法」。这次议簿已经散席，各处仍自行保管那一叠未认领的封签。',
 ][i];
 if(decision==='delegated')return [
  '你托当班人照当地的退件约定办。药匣还了栈，簿上明记你没有亲手查验。',
  '你写明由阿枳自己选。回函夹着她同脚夫班议定的轮值条，没有把你列作担保人。',
  '你把该由两处自己裁决的事交还了。新簿首页写着「在场者议」，旁边没有代你落款。',
 ][i];
 if(i===0){
  if(decision==='returned')return '你让封口完好的药匣退栈，请原寄者重写地点。两处都晚了一班船，却没有人替陌生人签收。';
  if(reached(p))return '匣子到了'+places[office(p)]+'。领件人没急着开盖，先拿一块缺角的签板同匣底拼了起来。两边合拢，林砚才收起手里的空白回单。';
  return '你送去的人把匣子推回来：「这板角跟我们手里那半块合不上。」林砚重新跑了一趟，误投的一笔照录，谁都没有替第一次交割盖章。';
 }
 if(i===1)return decision==='partner'?'阿枳挑了一个同行人。她先报站，另一个人在回单上复述，两人各能指出对方漏下的一处。从这天起，换班时得多等一个脚程。':'阿枳领了那只小铜铃，一人走完一段就翻转铃舌。第一次独自返栈，她把铃放在门外才进屋：「这趟我自己认，不要让铃替我答。」';
 return decision==='witness'?'两处各留一名当值人，在空签上写下亲眼见到的交割。下一班若有疑问，能找到经手处；当值人也得承担被人当面追问的难处。':'两处都只刻站记，不抄寄件人的姓名。后来有人上门追寻一件旧物，能查到哪一站收过，却须取得本人的同意才可再问下去。';
}
export function validatePost(p,life){
 exactKeys(p,['start','origin','route','trace','steps','ending'],['walk','stations']);
 if(!Number.isSafeInteger(p.start)||p.start<0||p.start>=80*years||life&&p.start>life.ageDays||
    !['helped','declined','unknown'].includes(p.origin)||!['relay','door','pass'].includes(p.route)||
    !Number.isInteger(p.trace)||p.trace<0||p.trace>3||!Array.isArray(p.steps)||p.steps.length>seasons.length||
    ![null,'box','leaves'].includes(p.ending)||p.route==='pass'&&(p.trace||p.steps.length||p.ending)||
    p.ending&&(p.steps.length!==3||life&&life.ageDays<p.start+25*years))throw new Error('林砚药路手记无效。');
 for(const [i,s] of p.steps.entries()){
  exactKeys(s,['decision','day']);const season=seasons[i],elapsed=s.day-p.start;
  if(!Number.isSafeInteger(s.day)||elapsed<season.open*years||life&&s.day>life.ageDays||i&&s.day<p.steps[i-1].day||
     ![...season.choices,...late].includes(s.decision)||
     !late.includes(s.decision)&&s.day>=80*years||
     (s.decision==='missed'?elapsed<season.close*years:elapsed>=season.close*years))throw new Error('林砚药路回单无效。');
 }
 if(Object.hasOwn(p,'walk'))validateShore(p.walk,p,life);
 if(Object.hasOwn(p,'stations'))validateStations(p.stations,p,life);
}
export function postNode(state,menu,choice){
 const {events:e,life}=state,p=e.post,node=e.node;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('back','收起药路手记，自去安排','hub'),book=menu('post-book','回药路手记','post-book');
 const train=menu('train-menu','先去修炼，让药路照常走','training');
 if(node==='post-shore')return shoreNode(state,menu,choice);
 if(['post-stations','post-settle','post-fog'].includes(node))return stationNode(state,menu,choice);
 const job=(key,label,target,next,patch,days)=>choice(key,label,'explore',target,'cautious',{next,patch,rule:{days}});
 if(!p){
  if(life.ageDays>=80*years||life.cultivationProfile.worldTier!==0)return row('旧药匣的消息','回看手记',['你没有同林砚立过试路的约，手记里也没有能让你返回当年同他走路的凭据。'],[train,back]);
  const origin=e.firstMeeting??(['helped','declined'].includes(e.companion)?e.companion:'unknown');
  const init=route=>({post:{start:life.ageDays,origin,route,trace:0,steps:[],ending:null}});
  if(node==='post-offer-later')return row('药匣暂留桌上','决定以后再来，还是把这件事交还林砚',['你还没有应下差事。林砚把匣盖反扣在桌上，说要走哪条路终归可以自己选。'],[menu('decline-post','明确谢绝，请他自己试路','post-book',init('pass')),book,back]);
  return row('林砚的空药匣','决定要不要和林砚试一条送件的路',[
   origin==='helped'?'林砚领你进灶房，指了指头顶一只缝过的布袋：「你那顿饭没法原样还。后来我才想明白，有时候人缺的是下一顿在哪儿能找到，不是这一顿有多少。」':origin==='declined'?'林砚从灶上摘下一枚月牙木戳：「当年找你没借着粮，我去这里换过工。这是我自己挣来的头一枚工戳。」他说得很平，把戳往桌上一放，又去搬一只空匣。':'林砚摆出一只修过好几次的旧药匣。眼下能核对的是这只匣子的去处，两人都没有把记不清的往事编成欠账。',
   '药堂给山口和渡头都送东西，常在收据上只写一个「收」字。林砚想试两种办法。沿渡口设接力点，来人可以当班交割；走石阶送到门前，路慢，行动不便的人却能亲自收件。第一年跑完才有够用的回单，第四年第一批旧匣就要清走。你可以另走自己的路。',
  ],[job('launch-relay','陪林砚走两日，试开渡口接力','supplies','post-book',init('relay'),2),
   job('launch-door','陪林砚走三日，认清石阶各家门口','herbs','post-book',init('door'),3),
   menu('consider','先不立约，暂缓或谢绝','post-offer-later')]);
 }
 if(p.route==='pass')return row('各自的路','这次邀约已有答复',['林砚自己带走了空匣。你们没有为这条药路立约，也没有因为谢绝而欠下新的差事。'],[train,back]);
 const i=p.steps.length,elapsed=life.ageDays-p.start,local=life.ageDays<80*years&&life.cultivationProfile.worldTier===0;
 const patch=change=>({post:{...p,...change}});
 const write=(decision,day=life.ageDays)=>patch({steps:[...p.steps,{day,decision}]});
 const journal=menu('post-history','翻阅当时的回单','post-history');
 if(node==='post-history')return row('三封回单','读当事时真正留下的字',[...p.steps.map((_,n)=>receipt(p,n))],[book,menu('station-book','读渡头与石阶合簿，安排两站托付','post-stations'),back]);
 if(i===3&&elapsed>=25*years){
  const endings={box:'完整的空匣留在轮值站。后来换了好几块盖板，旧签始终能同原先的缺角拼上。想学的人须到站里亲自动手。',leaves:'原匣拆作各站的签板。新人上路时只领走一片，到另一站才见得到同它相合的另一半。以后没有谁能从一只匣子上读尽整条路。'};
  const letter=local?'林砚请你摸摸盖上的签槽。槽口最光的地方，正是无数人犹豫要不要落款时下意识摸过的那一寸。':'手记背后封着一张早年拓下的签槽和一份常设委托。此刻能回看往年的字，也能将对旧匣的处置寄给轮值站。';
  if(p.ending)return row('药路后来 · '+(p.ending==='box'?'匣在站中':'各执一片'),'查看你和药路之间的最后一笔',[endings[p.ending],receipt(p,1),receipt(p,2)],[menu('post-shore',local?'听听阿枳自己想走的路':'看旧匣旁那一页潮线','post-shore'),journal,back]);
  return row('空药匣 · 二十五年后的去处','决定留下一只完整的匣子，还是把手法分给各站',[letter,receipt(p,0),receipt(p,2),'最后要交出去的不是箱中的药。是一条路历经误会以后，怎样承认东西究竟交到了谁手上。'],[
   menu('keep-box','回信将整匣留在轮值站','post-book',patch({ending:'box'})),menu('split-box','回信把签板分交各站','post-book',patch({ending:'leaves'})),journal]);
 }
 const opens=(seasons[i]?.open??25)*years,closes=(seasons[i]?.close??Infinity)*years;
 const finish=(key,label,target,decision,days)=>{
  const day=life.ageDays+days;
  if(day>=p.start+closes){decision='missed';label+='（途中换班，将留逾期回单）';}
  else if(day>=80*years){decision='delegated';label+='（赶不上本人，转当班人）';}
  return job(key,label,target,'post-book',write(decision,day),days);
 };
 if(elapsed<opens){
  const days=opens-elapsed;
  return row('药路仍在走 · '+(i===0?'头一批药匣':i===1?'一个新脚夫':i===2?'签名的代价':'旧匣退役'),'距下次开簿尚有'+days+'日',[
   i?receipt(p,i-1):p.route==='relay'?'你走过的渡口开始接力送件。第一批签板还光溜溜的，眼下没有旧件可查。':'石阶各户把脚边能放药匣的位置腾出来。林砚想先等一季雨，看哪些门檐真能护住来件。',
   (local?'你可以继续修行，也可以承担站里的抄簿轮值。':'你可以在此界继续修行，也可校阅按期寄来的抄本。')+'这份活做到开簿日，会用掉实际寿元，期间没有闭关修为。',
  ],[job('keep-register',(local?'在站里核簿':'就地校阅寄来的抄本')+'，做到'+days+'日后开簿','supplies','post-book',{},days),choice('practice-post','按本命功法稳修一关，出关再看','practice','self','steady',{next:'post-book'}),back]);
 }
 if(elapsed>=closes||!local){
  const missed=elapsed>=closes;
  return row(missed?'换班已经过去':'药路寄来的托函','照实记下这一次是否赶到',[
   missed?'这一批签板已经换手。当年的争议不能靠今天补走一段路重新开办。':'你眼下无法同当年的两个人在路上见面。当班人把能交代的部分写在纸上，请你明确是否由当地自决。',
   i===0?'待查的是一只退到两处之间的封匣。':i===1?'待定的是阿枳愿意以谁的名义接班。':'待定的是下一班还能从旧签上看到谁的名字。',
  ],[menu('file-return',missed?'收下逾期回单':'将这一次交由当地决定','post-book',write(missed?'missed':'delegated')),train,back]);
 }
 if(i===0){
  const mark=p.route==='relay'?'半边船篷的弧痕':'半边晒架的直棱';
  const remembered=p.origin==='helped'?'灶房还认得你当年进门时提的布袋。掌灶人肯先给你看收匣时垫的那张旧纸。':p.origin==='declined'?'林砚把自己做临工时得的木戳带来。只要两处肯让他压一道新印，就可同回单上的缺口比对。':'你们没留过可核对的旧凭据，这次只能靠沿途留下的实物。';
  const clues=[p.trace&1?'你翻过匣底，压痕里藏着'+mark+'。湿过的签纸重新贴平，墨迹指的那一边恰好倒了过来。'+(p.origin==='helped'?'灶房垫纸上附有两处旧样；弧边归篷房，直棱归晒院。':''):'',p.trace&2?'你走完两处。篷房签板削成弧边，晒院那块留着直棱。两处各缺一角，都不肯拿别人家的件硬补自己那一块。'+(p.origin==='declined'?'林砚用临工戳拓下两印，与匣底相合的是'+mark+'。':''):''].filter(Boolean);
  if(node==='post-traces')return row('跑一趟的证据','查匣底或看两处签板，每条实地线索只走一次',[remembered,...clues,'余下'+(closes-elapsed)+'日换班；跨过换班日，便只能收逾期回单。'],[
   ...(p.trace&1?[]:[job('read-box',p.origin==='helped'?'借灶房旧纸，一日核对匣底':'用两日核对匣底和垫纸','herbs','post-traces',patch({trace:p.trace|1}),p.origin==='helped'?1:2)]),
   ...(p.trace&2?[]:[job('walk-stops',p.origin==='declined'?'带工戳走近路，一日比过两站':'花两日比对两处实物','supplies','post-traces',patch({trace:p.trace|2}),p.origin==='declined'?1:2)]),
   ...((p.trace===3)?[menu('deliver','拿着所见决定去向','post-address')]:[]),book]);
  if(node==='post-address')return row('匣上倒过来的字','亲自挑一个收件处，或先退封',[...clues,'两张站签都肯接有把握的那一半，误投会原封退转。你也能请原寄者重写。'],[
   ...places.map((place,j)=>finish('deliver-'+j,'送到'+place,j?'herbs':'supplies',j?'yard':'ferry',1)),
   menu('review-parcel','先不投送，看看退件或复核的办法','post-return')]);
  if(node==='post-return')return row('封匣未动','决定退件、重查或暂时收起手记',['封口仍然完整。可以请原寄者重写，也可以再查一眼匣底和签板。'],[menu('return-parcel','退还封匣，请原寄者重签','post-book',write('returned')),book,back]);
  return row('第一封 · 写反的站名','查明一只药匣该送往哪里',['两处接件人分别认领了签上的一个字。林砚把空手摊给你看：「要是连匣子里是什么都得拆开才知道往哪送，那这条路算白走了。」',remembered,...clues],[menu('investigate','带着林砚去核两份原样','post-traces'),menu('deliver','现在就决定送件去向','post-address'),back]);
 }
 if(i===1)return row('第二封 · 谁能替阿枳报站','决定帮阿枳试哪一种报站办法',[receipt(p,0),
  reached(p)?'当年领件人的女儿阿枳记得缺角签板。她已在这条路上跑了半载，想自己报一次站。她要的是能被人听到，不是请你替她作保。':'年轻脚夫阿枳拿着一张没有两边落款的旧签一路追问。别人告诉她去找林砚。她说：「我就想有个办法，下一个来问的人不必再走这么远。」',
  '你陪她练一次交接。找同伴复述有第二个见证，遇上落单就要等。教她用铃可以独行，交割有争议时也只能由她自己回来作证。',
 ],[finish('two-runners','陪她和另一名脚夫走三天对签','supplies','partner',3),finish('single-bell','陪她独走两天，听铃报站','herbs','bell',2),back]);
 return row('第三封 · 被追问的名字','决定药路以后保留哪种签记',[receipt(p,1),
  p.steps[1].decision==='bell'?'阿枳把铃放回桌上。一位收过私件的人请她涂去名字，另一位却请她留下，好有人能问清那次误投。她亲手签过，明白两个请求各有来处。':p.steps[1].decision==='partner'?'两个脚夫头一回为同一张回单争了起来。一个愿意留下自己的名字，一个只愿意认本班的站记。林砚把墨放下，请他们先把两种做法的代价各说一次。':'当年的托函没有点过一个具体保人。现在站上请两边重新商量，不能拿你的旧名直接填上册。',
  '有人只想让东西送到，有人想在交割出错时找得到人。签记该留多细，这道界线由你同当值班一同划下。',
 ],[finish('named-witness','用两日订下当值见证簿','supplies','witness',2),finish('station-mark','用一日试行只留站记','herbs','anonymous',1),back]);
}
