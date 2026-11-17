import {exactKeys} from './schema.js';
import {concertNode,validateConcert} from './resonance-concert.js';

// Each upper-world instrument has two actual configurations. The middle-world
// decision determines which one the player can examine and how it responds.
const instruments=[
 {
  title:'不肯响的门铃',
  scene:'钟荻小时候总比旁人晚一步开门。她娘听不清檐下那只铃，却能从窗棂认出卖豆腐的手劲。如今做了符匠，钟荻想把第一件作品送回家。她把旧铃和一只没有铃舌的新铃并排装进匣里，请后来经手的人先试明白，再决定是教人仿造还是让原件回去。',
  object:'旧铃沿上有三圈磨亮的铜色，铃舌却裹着布。轻叩铃身，桌上的米粒丝毫不动；把铃脚靠到匣沿，米粒才朝同一边滚。',
  letter:'母亲在信里画了自己平时靠窗的位置，又特地写道：「别叫我守着一条悬线。手里拣豆子时，胳膊肘也挨着桌。」她想一边做自己的事，一边知道谁来了。',
  labels:['把铃吊高，将铃舌露出来','让铃脚贴上窗棂的横木'],correct:1,
  miss:'铃在空中响得干脆，桌上的豆子一粒也没动。你看到了两只铃的区别，却还没有把动静送到她平常坐的地方。',
  proof:'铃脚碰到木头，两颗豆子在桌上挨了一下。用指腹盖住铜沿，屋里的声音轻了，豆子却仍然相碰。钟荻原先画在图角的那道横线终于有了用处。',
  copy:'各家木匠领到一份传震符样。钟家窗下也试装了一只；第一年便有三户人家来问，能不能把符样改给自家的矮桌。',
  original:'原铃被送回钟家的窗边。主人在窗棂上系了一段褪色红线，留出每天拣豆的位置。钟荻没有把这把椅子的高度写成天下人的规矩。',
 },
 {
  title:'潮窑里的半句歌',
  scene:'第二只匣子里是一截断陶管。窑工换班时靠它传一段短歌，转过弯的窑洞只传出后半句。钟荻原想补一枚响符，试过后却在信上划掉了「更响」二字。窑口有人要在雾里听见换班，也有人要在旁边安稳睡上一觉。',
  object:'小陶人分站在直管和弯管另一端。吹直管，两张薄纸一起振；吹弯管，弯后那张只在末声才动。把小镜贴近弯处，镜上显出半圈没有烧透的釉。',
  letter:'旧歌的前半句总在拐弯前唱，后半句是在过了弯才接。上一班以为下一班早已接手，才是最让人担心的误会。窑工想收到的是回声。',
  labels:['在弯后嵌一枚回音片，等对面应答','在窑口再添一根共鸣长管'],correct:0,
  miss:'长管让窑口的薄纸振了两回，弯后的纸还是只动一次。喊话的人更容易误认回声是对面的人。',
  proof:'弯后的回音片另带一个发闷的尾音，要等另一端有人按住它才响。窑口终于能分清哪次是自己喊出去的，哪次是别人接了班。',
  copy:'窑工借走可翻印的回音片图样。下一座窑的弯恰好朝相反方向，他们留了一张改过的烧法。',
  original:'校成的陶管落在旧窑两班人手里。匣中留下他们当班时敲的两段声纹，末尾各有一下不在拍内的咳声。',
 },
 {
  title:'不署名的送别曲',
  scene:'匣底还有一张孩子画的渡口。人都画得极小，那条跳板却画得跟船一样长。钟荻当年在渡口听见两岸轮唱，想留下整首；送行的人只许她留下能让晚到者跟上拍子的部分。',
  object:'留声石里，第一响很轻，第二响很重。图上跳板有两道脚印，一道停在岸边，一道拖到船边。把两响叠齐，后半段一团嘈杂。',
  letter:'撑船人说：「岸上的人每回先拍一下，船上的人才唱。一齐唱，那是年节唱戏。」落款的地方只压了一只圆圆的拇指印。',
  labels:['抹去两响之间的空拍，合成齐唱','只标领拍和船上接声的位置'],correct:1,
  miss:'两岸的声纹挤到一处，连谁先开口也分辨不出。把音量压低只能让这团声音变远。',
  proof:'让开一拍，船尾才有迟半步的回声。留下这两个起点，未听过这首曲子的人也能接进去，唱的词仍只属于那天送别的人。',
  copy:'空拍被印成一张无词的接唱谱。新渡口学会了这套手势，谱上没有一个原唱者的名字或声音。',
  original:'船户收回那块留声石。钟荻留给后来人的只是两道落脚印，谁要学接唱，就跟下一趟船走一段。',
 },
];

function upperInstrument(index,copied){
 if(index===3)return {
  title:'云梯上看不见的敲门人',
  scene:'上界的云梯工坊把一份求教信夹进原匣。外面敲门的小工总被高处的风盖过声响，梯上的掌架人只看得到自己的手。钟荻在封套上留了一句话：「我娘从来不觉得她那只窗子能管所有人的门。」',
  object:copied?'中界交出去的符样已被刻在每级云梯上。试叩第二级，五级横木都一起震，掌架人找不到要开哪一道门。':'钟家的原铃还在家里。工坊带来一张旧窗擦痕的拓片和一只自制空铃；拓片上的磨痕只沿着横木，掌架人的手却扶在立柱上。',
  letter:copied?'小工说自己在三级上等过，最先回头的却是五级上的人。每级梯都需要能单独辨认的动静。':'掌架人附了一张手印。换梯时两手总有一手要握立柱，横杆离手背隔着一掌。',
  labels:copied?['逐级隔开横木，各留一处传震面','将五级横木铆在同一铜条上']:['照拓片把铃脚压在梯级横木上','把传震片移到掌架人握住的立柱'],
  correct:copied?0:1,miss:copied?'一敲，五级都在回声。立在最远处的人也转了身，却没有人知道应开哪一道门。':'铃脚把横木震得发麻，立柱上的纸手印一动不动。原窗留下的磨痕不能替梯上的手选择扶手。',
  proof:'第三梯上一叩，纸手印在第三道门内抬起。其余四道安静。掌架人第一次可以自己应门。',
  copy:'工坊分给五道云梯各一幅活页图，注明装好后须让使用者亲自试握。',original:'掌架班收到校过的传震件。更换的人先去梯上同原主人站一班，再接手保管。',
 };
 if(index===4)return {
  title:'星炉的第二个声音',
  scene:'守炉人听见两次应答便想开闸，可对面的工位明明没人。钟荻当年问陶工回音会不会撒谎，窑工在回信上用炭笔画了一扇开着的空门。这张旧信如今跟着声匣一起到了星炉。',
  object:copied?'炉边工匠照翻印图做了两枚一模一样的回音片。星炉壁把第一枚的尾声又送回第二枚，轮值席空着也能连响。':'带来的两段当班声纹末尾都有人咳嗽。炉里的第二声却连咳嗽也一模一样，像是连同整段应答一并照了回来。',
  letter:copied?'图样适合量产，两面同音也最省事。守炉人问，若两端本来要互相认出对方，为何一定要做成同音？':'旧班头在匣底写了一笔：「别问它记住了什么，问它今天能不能另答一句。」',
  labels:copied?['两片都削薄一分，提高响声','把两端的尾音校成一清一浊']:['敲出临时换过的新节拍，再等人接','照录下的节拍重放整段旧声'],
  correct:copied?1:0,miss:copied?'空席还在回答，只有两声都变尖了。':'那声咳嗽第四次落在同一拍。旧声能留住一个人在场时的样子，却不能替今天的人当班。',
  proof:'无人时只余炉壁的反响。等试台另一端接了新声，闸旁的小旗才落下，两份回执终于各有来处。',
  copy:'炉旁刻下验答图样，只记录辨别方法。后来一座无闸小炉把同法用在收火上。',original:'守炉班接下验答器，交接时双方各敲一次。没人应的那一班保持闭闸。',
 };
 return {
  title:'最后一席空拍',
  scene:'谱匣最后一页没有署名，只有钟荻从家信里剪下来的一角。窗边的豆子干了，母亲问：「下次你回来，可不可以只坐一会儿？」上界乐师筹划归航合奏，想让中界听见。他们把开头的一拍留给了你。',
  object:copied?'乐师照无词谱摆了两座拍架。船侧的架子紧贴在回声壁上，一敲，空位便提前有了应声。':'两道落脚印一轻一重，后一枚跟前一枚相隔一段跳板。台上却只有一块大踏板，两人一落脚总是齐响。',
  letter:copied?'谱传得太广，总有人以为沉默就是忘了接。守灯人在排练纸上圈出四字：「容人不唱」。':'船户托人写道，最后一场也该允许有人留在岸上。就算脚步慢了些，也该有一个由自己决定的入拍处。',
  labels:copied?['把回声壁遮住，留给人自己应拍','让回声壁代替空席答唱']:['将踏板连紧，使两岸同落','把踏板分开，让两端自行入拍'],
  correct:copied?0:1,miss:copied?'没有人碰第二座架，它却接了三次。那段等待被墙壁占了去。':'乐师退开一步，另一端仍跟着齐响。合奏已经开始，原来留给迟到者的地方却没了。',
  proof:'领拍落下，台上静了一瞬。有人接，有人没有接，那一瞬也完整地留在曲子里。钟荻的题签终于有了容得下它的位置。',
  copy:'合奏谱留给下一班船。空处只画一只小凳，愿意的人可以把自己的拍子添上去。',original:'两端的拍架分别交回乐师和船户。归航那日，两岸隔着静水各自决定何时开声。',
 };
}

const blank=()=>({decisions:'',seen:0,trial:'none'});
export function validateResonance(s){
 exactKeys(s,['decisions','seen','trial'],['concert']);
 if(typeof s.decisions!=='string'||!/^[CO]{0,6}$/.test(s.decisions)||!Number.isInteger(s.seen)||s.seen<0||s.seen>3||!['none','miss','proved'].includes(s.trial)||s.decisions.length===6&&(s.seen!==0||s.trial!=='none'))throw new Error('听息谱记录无效。');
 if(Object.hasOwn(s,'concert')){
  if(s.decisions.length!==6)throw new Error('听息谱尚未校完。');
  validateConcert(s.concert);
 }
}
const instrument=(index,decisions)=>index<3?instruments[index]:upperInstrument(index,decisions[index-3]==='C');

export function resonanceNode(state,menu,choice){
 const convoy=state.events.convoy,s=convoy.resonance??blank(),node=state.events.node,index=s.decisions.length,tier=state.life.cultivationProfile.worldTier;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=change=>({convoy:{...convoy,resonance:{...s,...change}}});
 const book=menu('ear-book','翻回钟荻的谱匣','convoy-ear-book');
 const sea=menu('convoy-book','收好谱匣，查看海路','convoy-book');
 const back=menu('river-back','暂且封匣，回去休整','hub');
 if(node==='convoy-ear-receipt'){
  const previous=instrument(index-1,s.decisions);
  return row(previous.title+' · 交收','读当事人留下的回音',[s.decisions.at(-1)==='C'?previous.copy:previous.original],[book,sea]);
 }
 if(index===6){
  if(node.startsWith('convoy-concert-')){
   if(tier<2)return row('照影台的排演单','抵达上界再亲自赴约',['原来的排演单还在照影台寄存。'],[sea,book]);
   return concertNode(state,menu,choice,row,book,sea);
  }
  const lines=Array.from(s.decisions,(decision,i)=>{const item=instrument(i,s.decisions);return item.title+'。'+(decision==='C'?item.copy:item.original);});
  const concert=s.concert?.performed?menu('read-concert','回读归航合奏的回音','convoy-concert-result'):menu('plan-concert',s.concert?'接续归航合奏的排演':'读两张请帖，筹备归航合奏','convoy-concert-plan');
  return row('听息谱 · 空处有人','看见六件音器各自的去向',['你合上匣盖，才发觉铰链底下压着最早的一粒豆子。钟荻把母亲的话写在朝里的那一面，只有收匣的人才读得到：「我听到了。你吃过饭没有？」',...lines],[concert,sea,back]);
 }
 if(tier<(index<3?1:2))return row(index<3?'未到中界的谱匣':'听息谱 · 等候上界','抵达相应界域再接下一批原样',['中界三件留样在白汀寄存，上界三件由照影台收存。界门另一侧的器物须由已经抵达的持匣人核验。已交割的回执继续留在匣中。'],[sea,back]);
 const item=instrument(index,s.decisions),open=menu('ear-open','展开本件音器和所附家书','convoy-ear-open');
 const read=menu('ear-read','对读原物与当事人的信','convoy-ear-read'),table=menu('ear-table','摆好试台，试一种接法','convoy-ear-table');
 if(node==='convoy-ear-book')return row('钟荻的听息谱','第'+(index+1)+'件 · '+item.title,['中界符匠钟荻留下六件音器的试样和原信。她不曾要求后来人拜她为师，只约定每一件都须先验过，再按受托人的意愿留样或归还。头三件的交接方式会改变上界三件送来的实物。',index===0?'匣盖上贴着一张没画完的家谱。钟荻先写了母亲的小名，却把自己的名字忘在了最后一行。':'匣中已有 '+index+' 张交割回执。下一件是'+item.title+'。',...(tier===2&&index<3?['你已到上界，照影台向白汀取来了封好的中界留样和书信。试台设在你现在的住处。']:[])],[s.trial==='proved'?menu('ear-good','回到已经校成的音器','convoy-ear-good'):open,sea,back]);
 if(node==='convoy-ear-open')return row(item.title,'听清委托，再决定怎样验证',[item.scene],[read,table,book]);
 if(node==='convoy-ear-read'){
  const clues=[],options=[];
  if(s.seen&1)clues.push(item.object);
  else options.push(menu('ear-object','验看试样留下的痕迹','convoy-ear-read',patch({seen:s.seen|1})));
  if(s.seen&2)clues.push(item.letter);
  else options.push(menu('ear-letter','展开当事人留下的信','convoy-ear-read',patch({seen:s.seen|2})));
  if(!clues.length)clues.push('匣盖左面夹着器物，右面藏一封信。试台就在案边，可以先猜，也可以查问清楚再下手。');
  return row(item.title+' · 试样和信','取出需要核对的线索',clues,[...options,table,...(s.seen?[book]:[])]);
 }
 if(node==='convoy-ear-miss')return row(item.title+' · 走音','依据实测结果调整接法',[item.miss,'这一日试音已记入修行历。原样仍在，去读信或换接法都来得及。'],[table,read,back]);
 if(node==='convoy-ear-table')return row(item.title+' · 试台','择一接法做一日空载试音',[item.scene,'左案可拆装铜制样件，右案可在木阵盘上重排声路。案上各有一份待验的接法和公料。试一次用一日，原物和旧信都能收好带走。'],[...item.labels.map((label,i)=>choice('try-'+(i?'right':'left'),label,'craft',i?'array':'artifact',i?'formation':'forge',{next:i===item.correct?'convoy-ear-good':'convoy-ear-miss',patch:patch({trial:i===item.correct?'proved':'miss'}),rule:{days:1}})),book]);
 if(node==='convoy-ear-good')return row(item.title+' · 合声','决定把这件手艺交给谁',[item.proof,'委托人同意两种交割。制符留样需三日，原物仍归本主，图样可以再印；亲校原件需两日，原件和覆验尺寸一并交还，只留下往来的信。公料由受托方供给。'],[
  choice('make-copy','花三日制符留样，让他人照样重做','craft','talisman','talisman',{next:'convoy-ear-receipt',patch:patch({...blank(),decisions:s.decisions+'C'}),rule:{days:3,art:'talismans'}}),
  choice('keep-original','花两日校过原件，归还原主','craft','artifact','forge',{next:'convoy-ear-receipt',patch:patch({...blank(),decisions:s.decisions+'O'}),rule:{days:2,art:'forging'}}),back]);
 throw new Error('听息谱页次无效。');
}
