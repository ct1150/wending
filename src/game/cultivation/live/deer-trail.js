import {exactKeys} from './schema.js';
import {DAYS_PER_YEAR} from './model.js';

const places={shed:'草棚',ridge:'倒木岭',reed:'芦湾',ford:'栗溪渡'};
export function trailLocation(state){
 const t=state.events.watch?.trail;
 if(!t)return '行脚驿棚';
 if(!t.outcome&&t.world===state.life.cultivationProfile.worldTier&&state.life.ageDays-t.start<6)return places[t.place];
 return '行脚驿信';
}
const endings={
 herd:'陶禾牵着小鹿走到浅滩边就停了。对岸有只母鹿低下头，把前蹄踏进泥里。小鹿先缩了半步，然后自己跑过去，脚步比陶禾一路想的都稳。陶禾空着两只手回山，第一次觉得这样也算把活做完。',
 meadow:'芦湾的湿地比想象中宽。陶禾把压低的芦茎分开，让小鹿自己试着走进去。它先在浅水里站了一会儿，才在背风坡卧下。陶禾同芦户约好隔岸看看，谁也不去给它系绳。',
 handoff:'陶禾接过背篓，独自去找熟悉栗溪的牧人。后来山口出现一行大小不一的蹄印，她没有去追问哪一枚一定是那只鹿留下的。',
 late:'陶禾按原约带鹿去找芦户。驿棚收起一张压过背篓的席，席角留着三枚栗子。她给来者写了几个字：「不必赶，我们已经走了。」',
 pass:'陶禾谢过你认真听完这一趟的难处，另去找愿意同路的人。她把背篓背好时，小鹿正从篓沿探头看天。',
};
export function validateTrail(t){
 exactKeys(t,['start','world','place','traces','outcome','reply']);
 if(!Number.isSafeInteger(t.start)||t.start<0||![0,1,2].includes(t.world)||!Object.hasOwn(places,t.place)||!Number.isInteger(t.traces)||t.traces<0||t.traces>3||
    ![null,...Object.keys(endings)].includes(t.outcome)||![null,'answer','keep'].includes(t.reply)||
    t.reply&&(!t.outcome||t.outcome==='pass')||t.outcome==='pass'&&(t.place!=='shed'||t.traces!==0)||
    t.outcome==='herd'&&(t.place!=='ford'||!(t.traces&1))||t.outcome==='meadow'&&(t.place!=='ford'||!(t.traces&2)))throw new Error('栗溪行程无效。');
}
export function trailNode(state,menu,choice){
 const w=state.events.watch,t=w.trail,life=state.life;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=trail=>({watch:{...w,trail}});
 const road=menu('deer-trail','回到栗溪行程','watch-trail'),book=menu('watch-book','回读守关簿','watch-book'),home=menu('watch-later','暂别山路，安排修行','training');
 if(!t){
  const begin=outcome=>patch({start:life.ageDays,world:life.cultivationProfile.worldTier,place:'shed',traces:0,outcome,reply:null});
  return row('山路边伸出的一只耳朵','决定是否陪陶禾走一趟栗溪',['第一次守关之后，值夜班会替过路人留一顿饭。你今天来时，一个叫陶禾的牧女正侧坐在草席上。她的背篓在动，原来里头躺着一头腿伤初愈的小鹿。牧场原想留下它拉车，陶禾却只答应照顾到能走路的时候。','栗溪那群鹿每年涨水前过浅滩。还有六日可以同行：上岭能认蹄痕，下湾能辨能过冬的草地。陶禾说：「能找到它来的地方最好。走不了那么远，也得有个不用拴它的地方。你若要闭关，我会自己走。」从应约之日起按此生实际日历计时。'],[
   menu('walk-with-he','应下同行，今天从草棚出发','watch-trail',begin(null)),menu('pass-trail','说明另有修行，送她自行上路','watch-trail',begin('pass')),book]);
 }
 const elapsed=life.ageDays-t.start;
 const finish=(key,label,outcome)=>menu(key,label,'watch-trail',patch({...t,outcome}));
 if(t.outcome){
  const years=Math.floor(elapsed/DAYS_PER_YEAR);
  if(t.outcome==='pass')return row('栗溪路上 · 各有行程','当年的邀请已经作答',[endings.pass],[book,home]);
  if(years<12)return row('栗溪路上 · 分别','回看这一段同行，再去修行',[endings[t.outcome],'草棚帮过路人存信。陶禾想等自己走够十二个年头，再给那时候的同行人写一封。'],[book,home]);
  const news={herd:'这些年我看过好几群鹿，从来没再认出那一只。但我学会了分辨哪一群正在等一个落在后面的伙伴。牧场请我回来，我说我只带路，不领牲口。',meadow:'头几年芦湾连着涨过两次水。我们把芦席架高，只在外围留干地。后来路过的人也能在那儿歇脚。有人问鹿还算不算我的，我听完很高兴，因为它从来不算。',handoff:'那位老牧人没问我有几张凭据，只问我愿意守多久。我们在湾边住了一个月。我后来替背篓换了薄底，谁带受伤的小兽上路都能来借。',late:'你后来回没回来，我没去问。当年我照样得出发。沿溪走了几回才知道，那句「我们已经走了」写给别人，也写给那时不敢自己拿主意的我。'}[t.outcome];
  const archive=years>=60?'这一封是多年以前寄存的旧信。栗溪的递信班仍收题记，信尾没有写陶禾如今的下落。':'十二年满时，草棚收到了陶禾的行脚信。';
  if(t.reply)return row('栗溪旧信 · 草席上的栗子','保存这段相识的结局',[archive,news,t.reply==='answer'?'你的回记已经交给递信班，给后来走这段路的人读。':'原信仍夹在你自己的守关簿里，两人的旧事没有张贴在渡口。'],[book,home]);
  return row('栗溪来信 · 十二年后','决定怎样保存陶禾的回信',[archive,news],[menu('answer-letter','写下同行经过，准驿棚留给后来人读','watch-trail',patch({...t,reply:'answer'})),menu('keep-letter','把信收进自己的簿页','watch-trail',patch({...t,reply:'keep'})),home]);
 }
 if(elapsed>=6||life.cultivationProfile.worldTier!==t.world)return row('栗溪的空草棚','陶禾已经按约自行上路',[life.cultivationProfile.worldTier!==t.world?'你已越过界门。草棚向行脚驿回了一句：陶禾会自己走，毋须等你从另一界赶回来。':'自应约起已有'+elapsed+'日。栗溪已涨水，旧约中的六日已经过去。',endings.late],[finish('accept-late','收好留字，记下分别','late'),home]);
 const stamp='同行第 '+(elapsed+1)+' 日；还有 '+(6-elapsed)+' 日。所在：'+places[t.place]+'。';
 const map=menu('trail-map','摊开山路草图，商量下一步','watch-trail-map');
 const step=(key,label,place,days,target)=>choice(key,label,'explore',target,'cautious',{next:'watch-trail',rule:{days},patch:patch({...t,place})});
 if(state.events.node==='watch-trail-map')return row('陶禾手里的山路草图','估算剩余行程，也可以离开',[stamp,'草棚到倒木岭一日，到芦湾两日。岭湾之间往返一日。岭上到渡口两日，湾里到渡口一日。在一处辨清痕迹另用一日。渡口办妥去向还需留出最后一日。','离队后闭关、采药等行动仍照常计时。若赶不到渡口，陶禾会带鹿另寻照料者。'],[road,finish('return-basket','把背篓交还陶禾，请她另找牧人','handoff'),home]);
 if(t.place==='shed')return row('草棚 · 起程前','选一路跟陶禾出发',[stamp,'陶禾把背篓放低，让小鹿自己试着踏上草地。「抄近路，未必就知道它从哪来。」山口一侧是倒木岭，另一侧低下去通芦湾。'],[step('to-ridge','走一日上倒木岭','ridge',1,'iron'),step('to-reeds','走两日下到芦湾','reed',2,'herbs'),map]);
 if(t.place==='ford'){
  const choices=[];
  if(t.traces&1)choices.push(choice('follow-herd','陪陶禾沿合过的蹄迹送鹿归群','explore','supplies','cautious',{next:'watch-trail',rule:{days:1},patch:patch({...t,outcome:'herd'})}));
  if(t.traces&2)choices.push(choice('shelter-deer','陪陶禾把鹿送到辨过的背风草甸','explore','herbs','cautious',{next:'watch-trail',rule:{days:1},patch:patch({...t,outcome:'meadow'})}));
  if(!choices.length)choices.push(step('to-reeds','沿水线走一日，返回芦湾查草','reed',1,'herbs'));
  return row('栗溪渡 · 自己走的路','按已经查到的情形决定小鹿的去向',[stamp,'水涨过岸石的第一寸。陶禾解下篓绳，小鹿先抖一抖耳朵，伸舌舔了她指上沾着的盐。小鹿愿不愿过水，还得让它自己走到水边。',t.traces&1?'已合过蹄距，能指出鹿群实际下水的地方。':'尚未查到鹿群的蹄距。',t.traces&2?'已验过水纹与芦根，高草甸留有伏身的干地。':'尚未亲自辨过可安置小鹿的草甸。'],[...choices,map]);
 }
 const ridge=t.place==='ridge',bit=ridge?1:2,found=Boolean(t.traces&bit);
 const exam=choice('read-trace',ridge?'用一日对过大小蹄印的步距':'用一日沿水线验芦根与干地','explore',ridge?'iron':'herbs','cautious',{next:'watch-trail',patch:patch({...t,traces:t.traces|bit}),rule:{days:1}});
 const cross=step('cross-slope',ridge?'绕岭脚一日，到芦湾':'沿岭脚一日，到倒木岭',ridge?'reed':'ridge',1,ridge?'herbs':'iron');
 const ford=step('to-ford',ridge?'沿石背两日到栗溪渡':'顺湾一日到栗溪渡','ford',ridge?2:1,'supplies');
 if(state.events.node==='watch-trail-fork')return row('栗溪山路 · 岔口','选择换路、回现场或展图',[stamp,'沿岭脚可以转到另一侧。小鹿还能走多远，陶禾一路都会照看。'],[cross,road,map]);
 return row(ridge?'倒木岭 · 凹处的蹄痕':'芦湾 · 经霜的草根','辨认现场，或赶下一段路',[stamp,ridge?'倒木上方有一排错开的梅花印。陶禾没有马上去量大的那一枚，只把篓放平，等小鹿自己走两步，再看看它跟在大鹿后面时落脚的位置。':'芦根白得像新削的梨。陶禾把旧芦秆折开，里面一层泥线高过眼下的水面。「冬天它趴下去的时候，不能只管今天脚底干不干。」',found?(ridge?'陶禾把大小蹄距都量过，已能在浅滩辨出真路。':'经霜的芦根和石上的水纹对得上，背风坡足够一头小鹿卧倒。'):'辨清这一处的证据需要一日，可以先赶路。'],[found?cross:exam,ford,found?map:menu('trail-fork','商量换路或收起行程','watch-trail-fork')]);
}
