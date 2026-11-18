import {exactKeys} from './schema.js';
import {sha256} from './identity.js';
import {realmFor} from './cultivation-rules.js';

const titles=['船还记得回家','她给自己取了名字','两条不能重叠的水道','归航不是归还'];
const choices=[['hull','skiff'],['open','seal'],['harbor','channel'],['moor','sail','release']];
const ranks=['化神','炼虚','合体','大乘'];
export const homeboundPlaces=prefix=>[{id:prefix+'home-ship',name:'归潮残舟',kind:'place'},{id:prefix+'home-shore',name:'上界港外锚地',kind:'place'}];
const stage=h=>h.visits.length-(h.visits.at(-1)?.done===null?1:0);
const open=h=>h.visits[1]?.choice==='open'||h.released;
const broken=h=>h.pledge==='restore'&&open(h);
export function validateHomebound(e,life){
 const h=e.homebound;
 if(life&&(life.cultivationProfile.worldTier!==2||realmFor(life).rank<5))throw Error('归潮舟须在上界化神后探访。');
 if(!h){if(Object.hasOwn(e,'homebound')||e.node!=='home-book')throw Error('尚未与归航者起行。');return;}
 exactKeys(h,['pledge','visits','place','at','released','ending','ended']);
 const date=n=>Number.isSafeInteger(n)&&n>=0&&(!life||n<=life.ageDays);
 if(!['ask','restore'].includes(h.pledge)||!Array.isArray(h.visits)||h.visits.length>4||!['shore','ship'].includes(h.place)||!date(h.at)||typeof h.released!=='boolean'||![null,'moor','sail','release','withdrawn'].includes(h.ending))throw Error('归航约定无效。');
 for(const [i,v] of h.visits.entries()){
  exactKeys(v,['start','seen','choice','decided','done']);
  if(!date(v.start)||v.start>h.at||!Number.isInteger(v.seen)||v.seen<0||v.seen>3||![null,...choices[i]].includes(v.choice)||
   (v.choice===null?v.decided!==null||v.done!==null:!date(v.decided)||v.decided<v.start+[2,2,3,1][i]||v.decided>h.at))throw Error('归航行程无效。');
  if(i&&(!h.visits[i-1].done||v.start<h.visits[i-1].done+2)||life&&realmFor(life).rank<i+5)throw Error('归航不能越过尚未走完的一幕。');
  if(v.done!==null&&(!date(v.done)||v.choice===null||v.done<v.decided+2||v.done>h.at)||i<h.visits.length-1&&v.done===null)throw Error('归航尚未亲自返港。');
 }
 if(h.released&&(h.visits.length!==4||h.visits[1].choice!=='seal'))throw Error('尚无可解开的封舱。');
 if(h.visits.length===4&&h.visits[3].done!==null&&h.ending!==h.visits[3].choice)throw Error('归航完成后不能撤去结局。');
 if(h.visits[3]?.choice==='sail'&&!open(h))throw Error('封舱之舟不能自主启航。');
 if(h.place==='ship'&&(h.ending||!h.visits.length||h.visits.at(-1).done!==null)||!e.node.startsWith('home-')&&h.place!=='shore')throw Error('归航所在地点无效。');
 if(h.ending===null?h.ended!==null:h.place!=='shore'||!date(h.ended)||h.ended!==h.at||h.ending!=='withdrawn'&&(h.visits.length!==4||h.visits[3].done!==h.ended||h.visits[3].choice!==h.ending))throw Error('归航结局尚未完成。');
 if(['home-decide','home-final','home-talk'].includes(e.node)&&(h.place!=='ship'||h.visits.at(-1).choice!==null||h.ending)||e.node==='home-final'&&stage(h)!==3)throw Error('归航页次无效。');
}

const opening=[
 ['岑照把一盏没有火的灯挂在船头。灯底的影子却亮着，像有人在水下替她提灯。她说这是归潮舟最后一次离港时留下的航灯，船上每一间舱都朝着同一个方向。',
  '残舟卡在两道相背的潮里。主吊臂还能工作一次：拖住龙骨，载过人的小艇便会顺潮散去；先放小艇，龙骨就会滑进暗流。岑照低头捋平袖口：「我想保住大船。它还认得回家的路。」',
  '你可以先看两处再决定，也可以现在动手。她没有把吊臂交给你，只把自己的手松开了一点。'],
 ['舱门里有人敲了三下。岑照的手停在门环上：「从前每到晚饭，她也这么敲。那时候她还没有我肩膀高。」门后却问，你们为什么总叫她一个不认识的名字。',
  '门开了一指宽，女孩把纸条推出缝外。上面写着青禾。她说这个名字是自己昨夜想的，今天仍然喜欢。岑照把旧乘客簿翻到一张被摩挲得发白的画像，画像里的孩子没有看你。',
  '舱阵能把昨日保存得分毫不差，也会在每天晨钟时抹去后来添上的一句话。放开它，故乡图就会随醒来者的记忆一起变化；继续封着，图还完整，青禾明日可能又不记得这个名字。'],
 ['归潮舟的影子终于离开了海底。船头出现两条水道，一条通向能终年停泊的锚湾，一条越过外海，通向没有画在旧图上的岸。两条路的潮向相反，船只能先把一种舵法练成。',
  '岑照坐在主舵旁，把船长留下的绳结一一解开。她说，若当年有人在离港前问一句要去哪里，也许船上不会有那么多人直到最后才知道自己离了家。',
  '旧部件、舱内是否有人协力、岑照是否愿意掌舵，都会改变这趟工程。你可以亲自补足不足的部分，但补船不能替任何人答应与你同去。'],
 ['锚地那棵枯树长出了新枝，枝上没有岑照记得的那种白花。她把故乡图举到树前，图里是一座城，眼前只有一片被潮水冲平的石地。她没有再转动纸，试图让它们重叠。',
  '青禾把自己的名字写在新枝垂下的影子旁。她问，若船真的能走，是不是也能去一个从来没有人等她的地方。岑照说可以，过了很久，才补上一句：「可我不知道该怎样送你。」',
  '归潮舟可以成为供愿意留下者居住的锚居，也可以交给醒来的人自行远航。还可以熄去强留回声的旧舟核，让已经有了名字的人各自离开。哪一种都不能把失去的故乡原样还给岑照。'],
];
const inquiries=[
 [
  ['沿龙骨查旧裂缝','裂缝里夹着一截红绳，绳头系着幼童换牙时用的小木盒。岑照认得盒子，却说不出是谁交给船长的。她原以为船替她记住了每个人，如今才发现许多东西只留下被放在这里的那一刻。'],
  ['下到悬挂的小艇','小艇里没有人，船桨却被握出了深深的凹痕。岑照说末班客人原本可以用它上岸，船长却把它留给了尚未回来的同伴。如今艇底还有一条通往外海的活潮，它不会等大船决定去留。'],
 ],[
  ['听岑照唱完旧航歌','岑照唱到第三句便停了。原来她只记得末代船长反复想起的那一小段。她并不是那位船长，也不是画像里孩子的亲人；只是被一个未了的归愿叫醒，便把那愿望当作了自己应当过完的一生。'],
  ['听青禾说自己的名字','青禾说她梦见麦田，却从没有在田里走过。她试着给岑照唱另一段歌，第一句错了，便笑着自己改。门外的岑照没有笑，只把手从那幅旧画像上收回来。你现在知道，留住昨日也会拿走她刚刚做成的今天。'],
 ],[
  ['试走锚湾的潮桩','锚湾的石桩能接住大船，每逢退潮却会把舵压在岸边。留下的人可以搭屋、种树，不必再随航期搬动东西；想走的人仍需要小艇。岑照试着在桩上系了一根活结，没有把末端藏起来。'],
  ['随小潮看外海道','海水从船腹一线穿过去，外海道就在最窄处转了弯。会相互应答的掌舵者能接住后半程；只有一幅固定旧图时，就得由你亲自分神守舵。远处亮起的灯与你认识的港口没有一盏相同。'],
 ],[
  ['与岑照把最初的约定说完','岑照问你还记不记得初见时答应了什么。她没有向你索取一座不可能还原的城，却也不肯让一句“都是为你好”替你越过当年的话。你们可以带着分歧分开；它不会因为事情终于做成了，就从两个人心里消失。'],
  ['让青禾说想留下什么','青禾没有要画像，也没有要谁承认她就是当年的孩子。她想带走舱门内侧那道量过身高的刻痕，因为那是她醒来以后自己刻的。岑照找来一把小凿，把那一片木头完整交给她。'],
 ],
];
const outcomes={
 hull:'龙骨缓缓升出黑水。小艇顺着相背的潮滑远，岑照追了两步，又停下来握住你这侧的缆。大船保住了可以落锚的骨架，活潮小艇已经不在。',
 skiff:'你松开末道扣环，小艇先跃出了暗流。龙骨下沉时，岑照没有松开你的手。直到两人站稳，她才说：「我现在还不能说你做得对。可刚才我确实不想让你也掉下去。」',
 open:'晨钟响过，舱门没有重新合上。青禾还记得昨夜的名字，其他舱里也有人试着推开自己的窗。故乡图上的一条街开始分出岔路，那些原本只有归途的线，第一次有了别的去向。',
 seal:'你把晨钟与舱门重新接好，故乡图停止了变化。青禾把纸条递出门缝，请你替她记一晚。门合上以后，岑照仍站在门边，没有把掌心里那张纸当作修好船的凭据收起来。',
 harbor:'锚链落底，船身不再追着潮走。人们可以在舷边放下不必随时打包的东西；外海道仍留在远处，若以后要走，还须再备一程。岑照第一次在舵旁放了一只空凳。',
 channel:'最后一道弯被你们一起驶过。船没有停在旧图里的岸上，舱里的人却从窗边指认出另一片能落脚的坡地。岑照把旧航歌的第三句唱了出来，唱完也没有要求船调头。',
 moor:'舟侧搭起低矮的栈桥，愿意留下的人各自选了一扇窗。岑照守着港灯，却把备用灯芯交给了别人。她仍会想起旧城，屋子里的日子已不必每天照着那张图摆放。',
 sail:'青禾把那块刻着身高的木片嵌进新舵。第一次发船的号令从舱里传来，岑照在岸上慢了半拍才挥手。她没有消失，也没有成为一张功德簿上的名字，只是第一次不知道明天会收到哪一封信。',
 release:'舟核熄下去时，海面没有熄灭。已经醒来的人提着各自的灯离开，没人替他们排成旧乘客簿里的次序。岑照最后下来，把空壳留给潮水。她问你最近的路通向哪里，这一次没有先说回家。',
};

export function homeboundNode(state,menu,choice){
 const {events:e,life}=state,h=e.homebound,age=life.ageDays,i=h?stage(h):0,v=h?.visits[i],rank=realmFor(life).rank;
 const row=(title,lines,options)=>({title,location:h?.place==='ship'?'归潮残舟':'上界港外锚地',goal:h?.ending?'归航已有去处，仍可继续自己的修行':'听清彼此的归愿，再决定这艘船的去处',blocks:lines.map(text=>({kind:'narration',text})),choices:options});
 const back=menu('harbor-book','回港外，安排自己的修行','sky-harbor');
 const book=menu('home-book','回到归潮舟的当前行程','home-book');
 const patch=change=>({homebound:{...h,...change,at:age}});
 const paid=(key,label,days,change,rule={})=>{
  const moving=Object.hasOwn(change,'place'),target=moving?'r:'+sha256(state.runId).slice(0,16)+':t1:e:home-'+change.place:['home-hull','home-seal','home-harbor','home-moor','home-see-1'].includes(key)?'iron':'manual';
  return choice(key,label,moving?'travel':'explore',target,moving?'road':'cautious',{next:'home-book',patch:{homebound:{...h,...change,at:age+days}},rule:{days,...rule}});
 };
 const depart=()=>paid('home-depart','备一份粮，登上归潮舟',2,{place:'ship',visits:v?h.visits:[...h.visits,{start:age+2,seen:0,choice:null,decided:null,done:null}]},{items:{supplies:1}});
 const promise=pledge=>menu('home-'+pledge,pledge==='ask'?'答应先听醒来的人说话':'答应替她修成归乡船','home-book',{homebound:{pledge,visits:[],place:'shore',at:age,released:false,ending:null,ended:null}});
 if(!h)return row('归航者 · 港外那盏无火灯',[
  '一艘没有船底的舟停在港外，潮水从它腹中穿过，却没有把它灌沉。一个穿旧船长衣裳的女子站在桅杆上，问你能不能听见船里的人说话。她叫岑照，是这艘船最后一个归愿化成的舟灵。',
  '她要修船，把舱里的回声送回故乡。码头人劝你先问问那些回声想不想回去。岑照听见了，没有与他们争，只说自己已经试过独自驾船；每次转舵，船都会回到这处锚地。',
  '这段同行随化神、炼虚、合体、大乘分四幕展开。幕间可去修行；无人因你暂缓就失去性命。起行两日、一份行粮。先把你愿意答应的事说清楚，备好行装才登船。'],[promise('ask'),promise('restore'),back]);
 if(h.ending)return row('归航者 · '+(h.ending==='withdrawn'?'在这里分别':titles[3]),[
  h.ending==='withdrawn'?'你在港外向岑照辞行，没有把暂缓写成来日一定回来。她带走自己尚未解完的绳结，你也没有取走这段同行尚未做成的结果。':outcomes[h.ending],
  broken(h)?'当初答应修成归乡船，后来却放开了旧图。岑照记得这件事；最终的去处没有抹去你们曾经失去的信任。':'你们并不是每一步都赞同对方。离开时，两个人至少都知道哪些事曾经真正答应过。',
  '已经走过的行程仍留在此生里。归潮舟没有变成突破所需的奖品，你也不必为了领一件东西再来重复告别。'],[back,menu('train-menu','继续自己的修行','training')]);
 if(h.place==='shore'){
  if(e.node==='home-leave')return row('归航者 · 在港外说清楚',['暂歇仍可回来，明确辞行则结束这段同行。已经改变的船和两个人说过的话不会还原，也不会把未做完的一幕补写为成功。'],[book,menu('home-withdraw','向岑照明确辞行，不再续约','home-book',patch({ending:'withdrawn',ended:age})),back]);
  const previous=h.visits.at(-1),waiting=!v&&rank<i+5;
  return row('归航者 · '+titles[i],[...(!previous?[h.pledge==='ask'?'你答应先听醒来的人说话，岑照把登船的索搭到岸边。':'你答应替岑照修成归乡船。她把袖口的旧绳结慢慢解开，给你留了登船的位置。']:previous.done!==null?[outcomes[previous.choice]]:['这一幕尚未做完，已经看过的舱室和付过的代价都还在。重返要重新备粮走过这段水路。']),
   waiting?'下一段须到'+ranks[i]+'境才能承受更深的舟内潮。眼下船停在安全锚地，你可以先过自己的生活。':'这次来访接着上次的决定，不会把离开之间的年月编造成你没有经历过的事。'],[
   ...(!waiting?[depart()]:[]),menu('home-leave','商量暂歇或在这里分别','home-leave'),back]);
 }
 if(e.node==='home-leave')return row('归航者 · 先走回自己的岸',['船上仍有不耗物资的两日回港路。暂退保留已做的事，要明确结束同行，须在港外亲口辞行。'],[paid('home-retreat','沿系岸索回港，两日不耗物资',2,{place:'shore'}),book]);
 if(v.choice!==null){
  const visits=h.visits.map((x,k)=>k===i?{...x,done:age+2}:x);
  return row(titles[i]+' · 做过的事',[outcomes[v.choice],...(i===1&&broken(h)?['岑照把舵柄从你手边挪开：「你当初说的是替我修成归乡船。下趟若还想走，你须自己守舵。」']:[]),'船仍在水上。这一幕要亲自回到港外才算走完。'],[
   paid('home-return','走完回港的两日水路',2,{place:'shore',visits,...(i===3?{ending:v.choice,ended:age+2}:{})}),menu('home-book','暂留船上，再看这次的结果','home-book')]);
 }
 const decide=(key,days,rule={})=>paid('home-'+key,({hull:'托起龙骨，放弃小艇',skiff:'解开小艇，让龙骨沉下',open:'放开舱门，让醒来者留下新的记忆',seal:'暂保封舱，留下完整故乡图',harbor:'修成锚湾，给船一个能停下的地方',channel:'练成外海舵路，让船能够离开',moor:'把船留作锚居，由住下的人接灯',sail:'把船交给醒来的人，让他们自主启航',release:'熄去旧舟核，各自离开'})[key],days,{visits:h.visits.map((x,k)=>k===i?{...x,choice:key,decided:age+days}:x)},rule);
 if(e.node==='home-decide'||e.node==='home-final'){
  let options,explanation;
  if(i===0){explanation='吊臂只能从相背的两道潮里带走一件。查过对应部位用两日，未查用四日；托龙骨另需一份玄铁，两种都用四分灵力。';options=[decide('hull',v.seen&1?2:4,{items:{iron:1},spiritCost:4}),decide('skiff',v.seen&2?2:4,{spiritCost:4}),menu('home-leave','暂不决定，重谈或回港','home-leave')];}
  if(i===1){explanation='两种安排都用两日、四分灵力。开放会失去固定故乡图，封舱会失去能自己应答的同伴。封舱可在最后一幕另付工期解开。';options=[decide('open',2,{spiritCost:4}),decide('seal',2,{spiritCost:4}),menu('home-leave','暂不决定，重谈或回港','home-leave')];}
  if(i===2){
   explanation='用已有对应部件施工三日，另配部件须五日和一份玄铁。锚湾可借完整封舱图，航道可借开放后的同伴，否则须亲付四分灵力。'+(broken(h)?'岑照不再为当初那句失约掌舵，两条路线都另需你付四分灵力。':'岑照仍愿接你的舵，费用不加这一项。');
   options=['harbor','channel'].map(key=>{const fit=h.visits[0].choice===(key==='harbor'?'hull':'skiff'),help=key==='harbor'?!open(h):open(h);return decide(key,fit?3:5,{items:fit?{}:{iron:1},spiritCost:(help?0:4)+(broken(h)?4:0)});});options.push(menu('home-leave','暂不决定，重谈或回港','home-leave'));
  }
  if(i===3){
   explanation='锚居或启航用三日；与先前练成的路线不合时，另用两日一份玄铁。熄核一日，不耗物资。任何去处都须再走两日回港。'+(!open(h)?'封舱尚在，不能让封着的船假称自主启航；可先用两日四分灵力解开。':'舱门已开，醒来的人能接过自己的船。');
   const final=key=>{const fit=h.visits[2].choice===(key==='moor'?'harbor':'channel');return decide(key,fit?3:5,{items:fit?{}:{iron:1}});};
   options=e.node==='home-final'?[decide('release',1),book,menu('home-leave','先看安全回港的路','home-leave')]:[final('moor'),open(h)?final('sail'):paid('home-unseal','解开封舱，让他们留住新的记忆',2,{released:true},{spiritCost:4}),menu('home-final','比较熄核离去，或暂不决定','home-final')];
  }
  return row(titles[i]+' · 亲自决定',[explanation,...(i===3?[broken(h)?'岑照没有假装你从未改过约定，但她也没有拿旧承诺替青禾决定余生。':'岑照问青禾先选哪扇窗。你在旁边，没有替她们把回答说完。']:[])],options);
 }
 return row('归航者 · '+titles[i],[...opening[i],...(i===1?[h.visits[0].choice==='hull'?'龙骨保住，旧舱图还钉在同一排梁上；小艇已经随潮远去。':'醒来的人先住进了保下的小艇。大船旧梁沉了，岑照得凭自己的记忆替她们找路。']:[]),...inquiries[i].filter((_,n)=>v.seen&(1<<n)).map(x=>x[1])],[
  ...[0,1].map(n=>{
   if(v.seen&(1<<n))return menu('home-talk-'+n,'再谈：'+inquiries[i][n][0],'home-talk',{page:n});
   const change={visits:h.visits.map((x,k)=>k===i?{...x,seen:x.seen|(1<<n)}:x)};
   return i%2?menu('home-see-'+n,inquiries[i][n][0],'home-book',patch(change)):paid('home-see-'+n,inquiries[i][n][0]+'（一日）',1,change);
  }),menu('home-decide','看清代价，再决定下一步','home-decide')]);
}
