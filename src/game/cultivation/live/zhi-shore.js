import {exactKeys} from './schema.js';
import {DAYS_PER_YEAR} from './model.js';

const outcomes={
 alone:'你替阿枳坐了一班。那天来问路的人照旧走进来，问的人却换成了你。收班时她捎回一枚透亮的螺壳，只说海上风大，没有请你替她记一张回单。',
 sketch:'你替她扶住被风掀起的纸。她画了很长一截空滩，只在纸的尽头添一只很小的鸟。回去以后她把画贴在自己床头，没准任何人拿去做药路的招牌。',
 quiet:'你们并肩坐着，谁也不替那些飞过的鸟点数。等海潮漫过第一块石头，阿枳自己站起来说该回了。她带回去的东西不需要另一人复述或盖章。',
 late:'这一回没有在约好的潮时同到。旧班表照原样收存。后来收到一张素纸，上面只有阿枳自己认得的潮线，没有写她当日究竟走了多远。',
 declined:'你说这一趟由她自己安排。阿枳把邀约折进衣袋，转身去收自己的包。没有人因为你拒绝同行就把新差事记在你名下。',
};
export function validateShore(w,p,life){
 exactKeys(w,['start','relief','place','outcome','finished']);
 if(!p.ending||!Number.isSafeInteger(w.start)||w.start<p.start+25*DAYS_PER_YEAR||w.start>=80*DAYS_PER_YEAR||
    life&&w.start>life.ageDays||![null,'roster','partner','trained'].includes(w.relief)||!['desk','ferry','ridge'].includes(w.place)||
    !(w.outcome===null||Object.hasOwn(outcomes,w.outcome))||w.place!=='desk'&&!w.relief||
    (w.outcome===null?w.finished!==null:!Number.isSafeInteger(w.finished)||w.finished<w.start||life&&w.finished>life.ageDays)||
    w.outcome&&w.outcome!=='late'&&w.finished>w.start+4||
    w.relief==='partner'&&p.steps[1].decision!=='partner'||w.relief==='trained'&&p.steps[1].decision!=='bell'||
    w.relief==='roster'&&['bell','partner'].includes(p.steps[1].decision)||
    ['quiet','sketch'].includes(w.outcome)&&w.place==='desk'||['alone','declined'].includes(w.outcome)&&(w.relief||w.place!=='desk'))throw new Error('阿枳看潮行程无效。');
}
export function shoreNode(state,menu,choice){
 const p=state.events.post,w=p.walk,age=state.life.ageDays,local=age<80*DAYS_PER_YEAR&&state.life.cultivationProfile.worldTier===0;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const home=menu('back','各自去忙，改日再看','hub'),book=menu('post-book','回看药路手记','post-book');
 const data=change=>({post:{...p,walk:{...w,...change}}});
 const work=(key,label,next,change,target,days,items={})=>choice(key,label,'explore',target,'cautious',{next,patch:data(change),rule:{days,items}});
 const desk='post-shore',end=outcome=>data({outcome,finished:age});
 if(w?.outcome)return row('潮过以后','查看阿枳这一次自己的去向',[outcomes[w.outcome]],[book,home]);
 if(!w){
  if(!local)return row('夹在旧匣旁的画纸','回看已知的旧事',['早年的值簿里夹着一页潮线。阿枳没有在这张私人的纸上写收件处，也没有留下能让后来人确认她去向的落款。'],[book,home]);
  return row('阿枳想走一次空路','听她说自己的打算，决定是否一起去',['你见过阿枳空手回来，却没见过她空手出门。今天她把肩带挂在门背上，露出衣襟里夹的一角画纸。「我从小就听人说回潮滩很宽。每回走到那儿，要么在追船，要么在点包。我想看一次它究竟宽到哪儿。」',
   p.ending==='box'?'她没有拿走站里的旧匣。那些板角已经有人保管；这回她只想给自己空出一天。':'她也把自己那片签板留在值台。散开的签有各处照料，用不着再为这一次远足找一个收件人。',
   '四天内还有一班合潮的船。应约之后按你的实际日历计时。得先让她这一班有人接手，才来得及一道上路。'],
  [menu('join-shore','应约，陪她安排这四天',desk,data({start:age,relief:null,place:'desk',outcome:null,finished:null})),menu('pass-shore','谢过同行之邀，让她自己安排',desk,data({start:age,relief:null,place:'desk',outcome:'declined',finished:age})),book]);
 }
 const elapsed=age-w.start;
 if(!local||elapsed>4)return row('潮时已过','旧约仍可以照实收下',['间隔的修行与行程按实际日历经过，已经赶不回约好的潮时。'],[menu('file-tide','收好那张素纸',desk,end('late')),book,home]);
 const spare='距约定的潮时还剩'+(4-elapsed)+'日。';
 if(w.place!=='desk'){
  return row('空着肩膀的两个人','陪她留一幅画，或者在潮边安静坐一会儿',[w.place==='ferry'?'从船上下来时，阿枳起初还习惯地伸手接后面人的行囊。那人笑着摇了摇头，她才把两只手插进口袋。':'山脊上的小路拐了三次弯才见到海。阿枳蹲下系鞋带，突然说：「原来一条不必赶到的路，连坡都不一样。」',
   p.steps[1].decision==='bell'?'她这次没带报站铃。滩上恰好有一只鸟叫得像铃响，她侧了侧耳朵，没有回头报站。':p.steps[1].decision==='partner'?'她伸手在肩边比了一下，像在等同伴接一句话。末了却自己笑了，把用来核签的手指张开去试海风。':'她把那张轮值条折成小船，看了一会儿，又仔细展开。纸还有别的用场。'],
   [menu('hold-paper','扶一会儿纸，让她自己落笔',desk,end('sketch')),menu('sit-quiet','在她身边坐坐，等潮自己涨起',desk,end('quiet')),book]);
 }
 if(w.relief){
  const known=p.route==='relay'&&p.steps[0].decision==='ferry';
  const ridge=p.route==='door'?2:3;
  return row('不用交件的岔路','看看还来得及走哪条路',[spare,known?'当年接对药匣的篷房还记着那枚缺角。船班同你们约好在旧泊口相接，走水路一日可到。':'水路得自己去找泊口再等一班船，需两日。',p.route==='door'?'你们认得当年送到门前的石阶。走山脊两日可以到滩。':'山脊要多走一道生路，需三日。', '算上已过的日子，若到得太迟，只能照实收下错过的潮。'],[
   work('take-ferry','循泊口走水路（'+(known?1:2)+'日）',desk,{place:'ferry'},'herbs',known?1:2),
   work('take-ridge','循山脊步行（'+ridge+'日）',desk,{place:'ridge'},'supplies',ridge),home]);
 }
 const pupil=p.steps[1].decision,partner=pupil==='partner',solo=pupil==='bell';
 return row('先替她空出一天','亲自替班，或找一个愿意接手的人',[spare,
  partner?'当年和阿枳对签的人正轮到歇班。他知道这一路的交法，愿用一天同她对好本班的活。':solo?'当年阿枳一直独行。眼下要把铃交给新人，得用两日陪他走熟，还要带上一份行粮。她又想起第一次有人陪她学着报站的时候。':'值台没有约定好的搭档。得把班表送到两处，花两日等一班人接过来。',
  '你也可以自己坐上三日值台。这样她能自己去看潮，你就不能同时陪她走到海边。'],[
  work('cover-desk','亲自坐三日值台，请阿枳独自去',desk,{outcome:elapsed+3<=4?'alone':'late',finished:age+3},'herbs',3),
  work('find-cover',partner?'找原来的同伴接班（一日）':solo?'陪新人练铃，两日和一份行粮':'两处递班表，请轮值班接手（两日）',desk,{relief:partner?'partner':solo?'trained':'roster'},'supplies',partner?1:2,solo?{supplies:1}:{}),home]);
}
