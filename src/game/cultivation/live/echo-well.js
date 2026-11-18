import {realmFor,nextRealmFor,v7ActionRule} from './cultivation-rules.js';
import {exactKeys} from './schema.js';
import {DAYS_PER_YEAR} from './model.js';

export function wellDepartures(state,choice){
 return ['cautious','bold'].map(way=>{
  const proposal=choice('well-'+way,way==='cautious'?'随巡井人走石阶，逐站听铃':'赶绳班到井口，走吊篮索道','explore','soulseal',way);
  const total=v7ActionRule(state,proposal).days;
  const well={way,total,start:state.life.ageDays,world:state.life.cultivationProfile.worldTier,clue:null,rig:null,claim:null,found:null,finish:null,reply:null};
  return {...proposal,label:proposal.label+'（首程'+total/4+'日，全程约'+(7*total/8)+'至'+(total+12)+'日）',next:'well-book',patch:{well},rule:{days:total/4,items:{supplies:1}}};
 });
}

function rigDays(w,rig){
 const trained=rig==='sluice'?w.clue==='chalk':w.clue==='knot';
 return trained?w.total/8:w.total/4;
}
export function validateWell(w,life){
 exactKeys(w,['way','total','start','world','clue','rig','claim','found','finish','reply']);
 const budgets=w.way==='cautious'?[576,720]:w.way==='bold'?[288,360]:[];
 if(!budgets.includes(w.total)||![0,1,2].includes(w.world)||!Number.isSafeInteger(w.start)||w.start<0||
    ![null,'chalk','knot'].includes(w.clue)||![null,'sluice','basket'].includes(w.rig)||w.rig&&!w.clue||
    ![null,'share','alone'].includes(w.claim)||w.claim&&!w.rig||
    (w.claim?typeof w.found!=='boolean':w.found!==null)||![null,'up','down'].includes(w.reply)||w.reply&&!w.claim)throw Error('回声井行程无效。');
 const worked=w.total/4+(w.clue?w.total/4:0)+(w.rig?rigDays(w,w.rig):0);
 if(w.claim?(!Number.isSafeInteger(w.finish)||w.finish<w.start+worked+w.total/4+(w.claim==='share'?12:0)):w.finish!==null)throw Error('回声井回程日期无效。');
 if(life&&(w.total!==budgets[life.birth.cultivationProfile.relicId==='rusted-needle'?0:1]||realmFor(life).rank<3||life.cultivationProfile.worldTier<w.world||
    life.ageDays<(w.finish??w.start+worked)+(w.reply?12:0)||w.reply&&realmFor(life).rank<4))throw Error('回声井经历与人生不符。');
}

export function echoWell(state,menu,choice){
 const {life,events:{well:w}}=state,book='well-book';
 const home=menu('train-menu','把井簿留在驿棚，回去安排修行','training');
 const remote=life.cultivationProfile.worldTier!==w.world;
 const newerShift=life.ageDays-w.start>12*DAYS_PER_YEAR;
 const row=(title,lines,choices)=>({title,location:remote?'行粮驿的书案':'回声井',goal:'查明井下两声铃的来处，决定归魂印和井绳的去向',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const work=(key,label,target,days,delta)=>choice(key,label+'（'+days+'日）','explore',target,'cautious',{next:book,patch:{well:{...w,...delta}},rule:{days}});
 if(remote&&!w.claim)return row('隔界的井班回单',['这封回单从旧井所在的界域辗转寄来。你已离开那一界，自己的巡井到这里为止。'+(w.rig?'最后一页还记着你整备的井路。':w.clue?'当年查过的线索仍夹在井簿里。':'发过的行粮仍有签收。')+'井班另请了人下井，当地的印没有随回单寄来。'],[home,menu('resources-menu','循此界的路引再备料','resources',{page:0})]);
 if(!w.clue)return row('井腰的候铃棚',[
  (w.way==='cautious'?'你跟着巡井人翻过几座岭，又在每一级石梯旁标下水痕。':'一路换绳、找桩、等山风，绳班终于把吊篮架到了井腰。')+'从山口到这里，走了'+w.total/4+'日。',
  newerShift?'十二年过去，棚梁上添了好几层刻名。木梭还拴在原来的钉子上，阿穗的旧字在梭背写着：头声铃是落桶，二声得等井底的人回话。新来的班头请你照旧簿教一趟。':'井下是三户人家共用的水眼。守绳的阿穗把半只木梭挂到你腰上：「头声铃是落桶，二声得等井底的人回话。旧铃锈了，水声有时也像回话。我想把夜班交出去，总得教人听得准。」',
  '巡查要经历下一轮涨水和落水。可以跟抄水尺的人辨回声，也可以随绳匠学手势；到下一站时，你亲手学过的办法会快一些。',
 ],[work('well-chalk','跟水尺班描下湿痕，辨石壁的假回声','stones',w.total/4,{clue:'chalk'}),work('well-knot','随绳匠换班，从绳结上辨井底的人','supplies',w.total/4,{clue:'knot'}),home]);
 if(!w.rig)return row('二声之后',[
  w.clue==='chalk'?'你在水尺上留下十几道粉线。水一涨过白石，第二道铃声就响；落水以后，真正的回铃在对壁。这道假声能用一道小闸隔开。':'你跟着绳班轮了几次夜值。井底有人时，绳股先扭半圈才响；空桶碰壁只有铃响。你已经能在黑里给吊篮打出独立的回绳。',
  '水眼后的壁龛压着归魂印。开侧闸能让水桶照走，工夫在排水；借吊篮则要占住打水的位置。学过的那一路能赶在半个工期内就绪。',
 ],[work('well-sluice','沿侧闸排水，给水桶留路','stones',rigDays(w,'sluice'),{rig:'sluice'}),work('well-basket','调吊篮到龛口，暂借汲水的绳','supplies',rigDays(w,'basket'),{rig:'basket'}),home]);
 if(!w.claim){
  const raw=v7ActionRule(state,{intent:'explore',targetId:'soulseal',approach:w.way,stake:'low'});
  const take=(key,label,share)=>choice(key,label,'explore','soulseal',share?'cautious':'bold',{next:book,rule:{
   days:w.total/4+(share?12:0),spiritCost:raw.spiritCost,exposure:raw.exposure,risk:raw.risk,checkKind:raw.checkKind,
   chance:Math.min(99,raw.chance+(share?8:0)),failureInjury:raw.failureInjury,gain:{soulseal:share?1:raw.gain.soulseal},
  }});
  return row('龛口旁的空钩',[
   w.rig==='sluice'?'闸槽里的细泥一层层干了。最后一寸水退出壁龛，打水的人还在隔壁照常落桶。':'绳班终于能把吊篮停在龛口。井户挑着空桶绕了远路，那只原本用来回铃的钩子空着。',
   '最后一程要守到井壁回干才能起印。可以另花十二日教接班人照应回铃，有人托绳你就拿最稳的一枚；也可以独自按来时的路数收取，成败和所得都自己担。若要离开，井簿会记住这里。',
  ],[take('well-share','教值晚班的人托绳，只取一印',true),take('well-alone','自己守到起印，把可取的印带走',false),home]);
 }
 const receipt=w.found?'这次起出的归魂印已经入过你的行囊。':'起印时石皮裂开，这次没有带走归魂印。';
 const aftermath=w.claim==='share'?'井簿后面画了晚班回铃的手势，几个不同的指印摁在旁边。阿穗那一格总算有人接了班。':w.rig==='basket'?'收篮后的头几个夜班，井户要多派一个人提灯照绳。值班簿上，一列名字抄成了两列。':'侧闸给水桶留了路，夜里辨铃却还靠老班口传。有人把听错的那次记在水尺背面。';
 if(realmFor(life).rank>=4&&!w.reply)return row('后来人夹在井簿里的纸条',[receipt,aftermath,
  '后来的一班人把井栏搬高了。下井的人看不到地上的灯，地上的人也摸不到绳结。'+(remote?'井班托过界的驿船带来一只副铃。你可以在此界用十二日校音，请驿船送回去。':'你的元婴能隔石传声，愿留十二日校定一处铃。')+'放在井口教接班人，还是放在井底给最后一人报平安？'],
 [work('well-up','把铃留给井口交班的人','iron',12,{reply:'up'}),work('well-down','把铃交给井底最后出井的人','stones',12,{reply:'down'}),home]);
 const next=nextRealmFor(life);
 return row('回声井 · 两班井簿',[receipt,aftermath,w.reply?(w.reply==='up'?'井口后来按铃交班，换班的人听一遍便能接手。井底仍留着最早的手势。':'最后一人把铃摇响才撤绳。井口的班表因此每天多留一格，写下这一声是谁报的。'):'到了元婴境，还能从行粮路引翻回井簿，看后来接班的人留下了什么。'],
 [...(next?.material==='soulseal'&&life.items.soulseal&&life.cultivation>=next.threshold?[choice('breakthrough','用归魂印尝试突破元婴','practice',next.id,'breakthrough',{next:'action-result'})]:[]),home,menu('resources-menu','去备办修行材料','resources',{page:0})]);
}
