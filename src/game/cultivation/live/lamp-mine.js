import {exactKeys} from './schema.js';

// The second gallery floods when the old drain is opened. Its usable track
// and the last gallery's acoustic clue therefore depend on earlier decisions.
const stages=[
 {
  title:'斜井底的两只手',arrival:'井上人只看见报平安的白布条挂在原处。井下却有两只苍白的手从车底伸出来，一只往外推，一只死死扣着轮缘。车夫阿芒喊你别拉他：轮子一滚，他身后的挡水板便会跟着倒。救他的人得先找个能接这份重量的地方。',
  sights:['循车轴摸到水眼','沿枕木查绳架'],clues:[
   '你用灯底碰一碰挡板，泥皮下有个朝低处开的旧水眼。里面贴着清凉的细流。打通它，水会绕开车夫，但下一层的低轨要先吃进这一股水。',
   '绳架底下挤着一截坏掉的车舌，凹口还扣得住轮缘。它可以替人托住车。这样留下的挡板也会把水继续留在井底。'],
  moves:['捅开旧水眼，把车夫从板后接出来','拆下车舌卡轮，让车夫自己爬出来'],
  results:['水眼开了，阿芒的衣裳仍是干的。低处随即传来几声空木相碰，像有人把一排铺板一块块掀起来。','车舌咬住了。阿芒在泥地上坐了一会儿，问清你拆的是哪一截，才肯松开扣着轮缘的手。后来推车到这里的人得下车步行。'],
 },
 {
  title:'两个方向都有脚印',arrival:'隔层有一间药房，土墙上还贴着孩子画的花。送药人七娘在这里换过湿鞋，之后就没有回到井口。点名簿上写着“往上”，这是她原本要走的路。你把灯伸到门边，发现往上和往下竟都有赤脚印。',
  sights:['把灯贴近上层木梁','沿低轨摸过药篓'],moves:['循梁上的干索寻找七娘','循低轨到拐角寻找七娘'],
 },
 {
  title:'报信人的第三声',arrival:'最后一座小屋用一根铜管同地面相连。学徒以前用它报人数，一声表示旁支有人，两声表示可以起吊。今天响了三声。值井人一听就去握绞盘，阿芒却伸出手，压住他手背。井里已经有人走过，声音未必还循旧路。',
  sights:['贴管分辨声与回响','到绞盘底下听回绳'],moves:['先放下轻篮接在侧壁的人','固定吊篮，让人沿回绳走出'],
 },
];
const binding=['留井','巡教'];
const places={shed:'井口点名棚',stores:'驮队歇脚处',shaft:'三硐斜井',left:'井道第一处标绳',right:'井道第二处标绳'};
export function minePlaces(prefix){
 return Object.entries(places).map(([key,name])=>({id:prefix+'mine-'+key,name,kind:'place'}));
}
function facts(record){
 const wet=record[0]?.move===0;
 const found=record[1]?.move===(wet?0:1);
 return {wet,found};
}
function clues(i,record){
 const {wet,found}=facts(record);
 if(i===0)return stages[0].clues;
 if(i===1)return wet?[
  '高梁上有一小片刚剥落的漆。你拿干纸压住木梁，纸上印出药房鞋底盖章时用的红泥。下面那些脚印曾被水泡开，边沿已经虚了。',
  '从旧水眼下来的水漫过低轨，药篓只挂在一枚齐腰高的钉子上。篓耳勒出一道向上的绳痕。若有人顺低轨走，篓该向外倒才是。',
 ]:[
  '梁头的红泥还在，却盖着一层细细的灰。这个脚印在车夫出事以前就有了。绳头没有新拉动的亮色。',
  '低轨尚干。药篓底下压着一颗刚踩扁的枣核。手拿篓的人腾不出手剥枣，七娘常把枣肉分给咳嗽的病人，核吐在脚边。',
 ];
 return found?[
  '七娘在侧壁小台上敲出三下给你听。她敲的是一长一短，最后一响晚半拍，是空铜罐应出来的。侧台的学徒不会攀绳，但够得着轻篮。',
  '回绳还是松的，学徒显然没有握它。七娘在壁台说：左手举得起，够得到篮沿。值井人终于把绞盘反着松了一齿。',
 ]:[
  '铜管口塞了一小团棉线。贴着管壁还能听出三记等长的敲击，后面跟着有人拖动绳子的一长串摩擦声。这里没有第二处回响。',
  '回绳吃着两个人的重量，每隔片刻才慢慢移一分。远处传来七娘给孩子数步子的声音。此刻松动绞盘，反会让他们失了手边的依靠。',
 ];
}
function consequence(i,record){
 const {wet,found}=facts(record),move=record[i].move;
 if(i===0)return stages[0].results[move];
 if(i===1)return found?'你在转弯处赶上七娘。她已把药交给学徒，正在替他包扎。她答应陪他守在侧台，请你上去找一只不晃的篮。':'你找到了旧脚印的尽头，只有一只空鞋。等你折回，七娘已经牵着学徒往绞盘下方摸去。你听见她说：「别松手，我们一寸一寸走。」';
 if(move===(found?0:1))return found?'轻篮停在侧台，孩子自己跨了进去。七娘坚持坐下一趟。上到天光里时，两人各自能报出自己的名字，点名人终于把代报的两笔划了。':'绞盘钉死，回绳不再乱跳。七娘牵着孩子，一步一步走出铁架。值井人从头到尾没摇一下柄，他头一次知道，握着它也可以只是等。';
 return (wet?'低轨的水还没落尽。':'挡水板后的井壁还湿着。')+'你选的办法没有接上人。值井人听到七娘的喊声，叫停绞盘，从另一个井口招人合力抬出他们。两人回来时裹着毯子，得再歇两日。';
}
function validClues(v){return Number.isInteger(v)&&v>=0&&v<=3;}
export function validateMine(m){
 exactKeys(m,['record','start','lamp','seen','pledge']);
 if(!Number.isSafeInteger(m.start)||m.start<0||!Array.isArray(m.record)||m.record.length>3||!Number.isInteger(m.lamp)||m.lamp<0||m.lamp>5||!validClues(m.seen)||
    m.record.length===3&&m.seen!==0||![null,...binding].includes(m.pledge)||m.pledge&&m.record.length!==3)throw new Error('井下灯簿无效。');
 for(const entry of m.record){
  exactKeys(entry,['seen','move']);
  if(!validClues(entry.seen)||![0,1].includes(entry.move))throw new Error('井下脚程无效。');
 }
}
export function mineNode(state,menu,choice,actor){
 const e=state.events,node=e.node,m=e.mine,i=m?.record.length??0,stage=stages[i];
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const guide=menu('field-guide','回谷口，翻看游记','field-guide');
 const board=menu('mine-book','回到井口点名棚','mine-book');
 const journal=menu('mine-journal','翻读自己验过的井下灯簿','mine-journal',{page:0});
 if(node==='mine-journal'){
  const page=e.page,entry=m.record[page];
  const lines=clues(page,m.record).filter((_,j)=>entry.seen&(1<<j));
  return row('井下灯簿 · '+stages[page].title,'读这一层亲见的凭据与最后采取的办法',[
   ...(lines.length?lines:['这一层没有留下亲手查验的痕迹。']),stages[page].moves[entry.move]+'。'+consequence(page,m.record),
  ],[...(m.record.length>1?[menu('turn-page','翻到'+stages[(page+1)%m.record.length].title,'mine-journal',{page:(page+1)%m.record.length})]:[]),
   ...(state.life.cultivationProfile.worldTier===0?[board]:[menu('train-menu','收簿继续此界修行','training')]),guide]);
 }
 const job=(key,label,next,change,rule,place='shaft')=>choice(key,label,'travel',actor('mine-'+place),'road',{next,patch:{mine:{...m,...change}},rule});
 if(!m)return row('石肺三硐 · 井口点名棚','看清井下要找的人，备灯再走',['坡背后有一口三层斜井。班头把三盏灯倒过来给你看，只有一盏还剩三格油。先前送下去的人有的为挡水，有的为递药，地面却只收到一根早已不会动的白布条。','一格灯油够细查一处，走标过的索道无需耗油。可以用一份行粮向驮队换两格油，也可只拿公灯。自领灯起二十日后外班来接手。撤回修炼也照常过日，回来晚了便只能查自己的手记。'],[
  job('borrow-lamp','执三格公灯下井','mine-gallery',{record:[],start:state.life.ageDays,lamp:3,seen:0,pledge:null},{days:1}),
  job('stock-lamp','用一份行粮备五格灯油下井','mine-gallery',{record:[],start:state.life.ageDays,lamp:5,seen:0,pledge:null},{days:1,items:{supplies:1}},'stores'),guide]);
 if(i<3&&state.life.ageDays-m.start>=20)return row('石肺三硐 · 已经交班','按当年亲历的脚程查阅旧事',['灯棚墙上留了外班的交接帖，第二十日他们已经接手。旧绳随班撤了下来，你不能循今日这条绳去补走当时的斜井。',i?'灯簿留着你亲手处置过的层次。':'你领过灯，还没留下一层处置的回话。'],[...(i?[journal]:[]),guide,menu('train-menu','离开灯棚继续修行','training')]);
 if(node==='mine-report')return row(stages[i-1].title+' · 出井回话','把已经发生的事告诉井口的人',[consequence(i-1,m.record),m.record[i-1].seen?'查过的痕迹仍在灯簿上，后来可以再读。':'这趟是按眼前判断走的，灯簿上没有添进未查过的痕迹。'],[board,journal,guide]);
 if(node==='mine-book'&&i===3){
  const close=m.pledge==='留井'?'班头把灯簿挂在铜管下。从此每班换手时，先拿自己的手法同上一次的事对一遍。':m.pledge==='巡教'?'七娘把三次井下走法编进巡教的行囊。下一座井的孩子先练怎样留信，再去学怎样跑得快。':'井口人要留一份可以照着办的灯簿。留给当班人可以天天核对；交给巡教的班子能让别的井也学得到，只是这里以后要等巡班带抄件回来。';
  return row('石肺三硐 · 出井点名','读三段实情，决定灯簿去向',[...m.record.map((v,n)=>consequence(n,m.record)),close],m.pledge?[journal,guide,menu('train-menu','收起灯簿，安排修行','training')]:[
   job('leave-log','把原簿挂在井口交接','mine-book',{pledge:binding[0]},{days:1},'shed'),
   job('teach-log','跟巡教班誊出第一份教本','mine-book',{pledge:binding[1]},{days:3},'stores'),guide]);
 }
 if(node==='mine-book')return row('石肺三硐 · 接续脚程','到上次止步的那一层',[i?consequence(i-1,m.record):stage.arrival,'留存灯油 '+m.lamp+' 格。柜里没有额外公油。可以花一份行粮向驮队换两格，灯肚至多容五格。'],[
  job('enter-gallery','沿标绳走到'+stage.title,'mine-gallery',{},{days:1}),
  ...(m.lamp<=3?[job('buy-oil','用一份行粮添两格油','mine-book',{lamp:m.lamp+2},{days:1,items:{supplies:1}},'stores')]:[]),guide]);
 const notes=clues(i,m.record),read=notes.filter((_,j)=>m.seen&(1<<j));
 if(node==='mine-inspect'){
  return row(stage.title+' · 灯下','选一处亲自验看，或收灯作决定',['公灯尚余 '+m.lamp+' 格。每验一处耗一格油与一日；已验处可直接回读。',...read],[
   ...stage.sights.flatMap((label,j)=>m.seen&(1<<j)?[menu('inspect-'+j,'回读'+label,'mine-inspect')]:m.lamp?[job('inspect-'+j,label,'mine-inspect',{lamp:m.lamp-1,seen:m.seen|(1<<j)},{days:1},j?'right':'left')]:[]),
   ...(!m.lamp&&!m.seen?[job('withdraw','循标绳撤回点名棚添油','mine-book',{},{days:1},'shed')]:[]),
   menu('gallery','收灯，回到现场','mine-gallery')]);
 }
 if(node==='mine-decide')return row(stage.title+' · 动手','选一条办法，按实留下脚程',[stage.arrival,...read],[
  ...stage.moves.map((label,j)=>{
   const record=[...m.record,{seen:m.seen,move:j}];
   const delayed=i===2&&j!==(facts(record).found?0:1);
   return job('move-'+j,label,'mine-report',{record,seen:0},{days:delayed?3:1},j?'right':'left');
  }),menu('gallery','动手前再看一眼','mine-gallery')]);
 return row(stage.title,'调查痕迹、当场处置，或循标绳撤回',[stage.arrival,'外班将在'+(m.start+20-state.life.ageDays)+'日后接手。',...(i===1?[facts(m.record).wet?'从上一层引下来的水已过低轨。':'车舌仍抵着水板，低轨上浮灰未动。']:[]),...read],[
  menu('inspect','执灯辨认两处痕迹','mine-inspect'),menu('decide','选定自己要走的办法','mine-decide'),
  job('withdraw','循标绳撤回点名棚','mine-book',{},{days:1})]);
}
