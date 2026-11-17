// Each leaf is an echo in the cultivation atlas. Time in an unfinished echo
// stands still when the reader leaves. Rewards come from the seal on the leaf.
const cases=[
 {
  title:'第一折 · 药畦与碾房',
  scene:'你在问川图里听见的第一声，是磨盘空转时两块石头相擦的尖鸣。沿渠往上，一块水尺刚露出第三道刻痕。守闸的小姑娘怀里揣着两个木楔，一红一白。她说爹留下的规矩是水到第三道便下红楔，可爹修这规矩那年，下游还没有药畦。',
  question:'今夜只够给一条渠放水。先找出谁有余地等到明日，再决定把木楔落在哪里。',
  clues:[
   ['进碾房听磨娘说','磨娘掀开蒸笼。最后一屉饭还够夜班吃，明早的稻谷已经在石臼里泡着了。她让你摸自己的虎口，给全村手舂一顿不是做不到，只是这只手往后几日都挑不动担。'],
   ['下到闸脚看泥线','闸脚的青泥裂成小片。药农挖开一窝苗给你看，叶还昂着，贴土的细根已经发白。失了今夜的水，这一茬黄芽要重新育。她没有开口求你，只把土仔细合了回去。'],
  ],
  policies:[
   ['将一夜水送入药畦','你压下白楔，守闸的小姑娘用炭在水尺背面添了一道记号。药畦湿了。天快亮时碾房响起第一声舂米，接着又有一只臼应声，直到整个村子都醒过来。','herbs'],
   ['先开碾渠，保住早饭','磨盘终于咬住湿谷。第二日第一碗饭被送到药畦边，药农吃完，将一半死苗拔起，另一半移到井边的浅盆。她问小姑娘要了一只木楔，说来年要替药圃另掘一口小塘。','supplies'],
  ],
 },
 {
  title:'第二折 · 空签',
  lead:record=>record[0]==='0'?'药畦得水后，湿土留住了药根。村里悄悄多出一本轮流舂米的簿子。':'碾房重新转动，饭锅按时上灶。井台边却挤满了育苗的浅盆。',
  scene:'一张领粮的竹签送到案头。正面有官印，背面刻着一段像鱼骨的符。送签的人穿一件短蓑衣，在廊柱后站了很久才敢问，丈夫在河上，能不能让岸上的人代领。掌柜的指着墙上新刷的四个字：一户一签。',
  question:'渡船上的人算一户，还是每只船才算一户？决定今年第一笔账怎样留下名字。',
  clues:[
   ['翻县里的旧印样','纸边长了霉，印样却清楚。鱼骨原来是渡船号，十年前的粮籍只记船主。船一转手，撑篙的人还在，公文上的这一户却已搬去百里外。'],
   ['去码头数饭碗','一条船上拴着两只炉子。父子用一只，搭船做补网活的寡妇和女儿用另一只。领粮的竹签挂在桅杆上，谁都够得着，谁也没有拿。'],
  ],
  policies:[
   ['按同灶登记，留下具名副册','你让两只炉子各立一户。船主的老父亲一笔一笔替不会写字的人描姓。簿子厚了一倍，送签的女子第一次在落款处找到了自己的名字。消息传开，下一班船也带来了家口。','supplies'],
   ['给船临时公仓，约定逐顿点粮','你把粮锁在码头公仓，一顿一划，两位掌勺的交替领用。第一日谁也没有挨饿。到第三日，一位想趁月色开船的船工仍得等钥匙，误了一趟顺风。','stones'],
  ],
 },
 {
  title:'第三折 · 塌桥的声音',
  lead:record=>record[1]==='0'?'新册上的船民轮流在桥旁值夜，最先发现桥有异样的是一位补网人。':'公仓要搬粮过桥，推车的人最先听见轮下有空响。',
  scene:'桥面的裂缝不宽，恰好能吞下一枚铜钱。桥头卖汤的老头却把灶灭了，说从来没听过这样的回音。药童抱着急送的药匣，桥那端已经点起候药的纸灯。图上的水纹碰到桥心，忽然从石面上消失。',
  question:'桥还能不能负重？即使桥须封，总得想法子把今晚的药送过去。',
  clues:[
   ['潜看桥墩的浪花','背水的一面也在翻白花。你以灵息贴上石壁，只觉一股冷水从墩心穿过。石面虽在，中腹已空。拿木板盖住桥面的缺口，桥下的水仍会继续吃石。'],
   ['问汤摊借细麻绳','老头把捆碗绳递给你。对岸灯号先明两下，隔一会又明一下，是河上挽绳的旧号。两岸都有桩，挂一根空索来回送小件，最重只能抵一只盛满的汤桶。'],
  ],
  policies:[
   ['封桥设绳渡，先送药匣过去','药匣沿绳滑过河心时，桥墩发出像叹气一样的低响。无人再踏上去。头一包药到了，四十袋米却得分成小份送，码头连着几夜都是灯火。','herbs'],
   ['借浅底船绕滩，同时运药和粮','船走芦荡，绕了整整一日。粮和药都过了河，桥也被封起来。等药的人记住了多等的那夜；守仓的人记住了完好无缺的四十袋粮。两句话都被你写进图边。','supplies'],
  ],
 },
 {
  title:'第四折 · 火塘里的契纸',
  lead:record=>record[2]==='0'?'绳渡的麻索磨出了细毛，轮值的人请你算一算，谁来出换索的钱。':'浅底船的底板开始渗水，船家来问，那日借船许下的修补该找谁。',
  scene:'老窑旁有人烧契。火塘边的陶片上，河岸和房基都画得分明，唯独窑口被一块黑影盖住。戴铜指套的窑工拿夹钳去拨，契纸只剩两半。她认得那两个骑缝印，一个是门里的，另一个是她祖母的。',
  question:'修渡口需要硬木。窑里有木，动用它却可能意味着承认一纸没人读全的旧契。',
  clues:[
   ['将两枚印从背面合拢','两半贴近火光，字从焦边透出来：“借木三季，逢丰偿苗。”窑场付的是木，门里应的是活苗。那年洪水后无所谓丰年，这一笔从未到索偿的时候。'],
   ['数一数坡上剩余的树','坡背还有三排细桐，树干薄得能让光穿透。砍一排能暂时补渡；若拿作苗圃，三年后才有真正耐水的硬材。窑工的女儿蹲在树根边，用指套给每株苗铲了半圈草。'],
  ],
  policies:[
   ['用窑中存木补渡，由门里立新苗契','窑工亲手量出够用的木。你把偿苗的年份、苗数和验收人逐字念给她听，剩下的半张旧契由她收回。新一代人还须来照料这三排桐树。','iron'],
   ['留下母树，以薪换工逐段补渡','你在火塘边另开一张工单，不动窑中整木。渡口隔日才开一次，来往的人学会合着日子赶集。窑工保下树苗，也保下了下一炉瓦的柴。','stones'],
  ],
 },
 {
  title:'第五折 · 井底回信',
  lead:record=>record[3]==='0'?'桐苗的第一张验收单送来时，纸上结着一层薄盐。':'隔日一开的渡市上，有人把装淡水的陶罐卖出了酒的价钱。',
  scene:'井栏上系着一只没寄出的信筒。井工的学徒说往下喊，回声从西壁回来；村正坚持往下挖才有甜水，已经把绳梯放好。你伸手摸了摸井砖，一面暖，一面凉。姨婆在旁把孩子端来的水倒掉，罐底留了一圈亮渣。',
  question:'确定盐从哪里来，再决定把有限的人手投在井内还是井外。',
  clues:[
   ['接两处渗水各煮一勺','西壁的冷渗水煮干只剩半粒砂，井底的温水留下一层方晶。淡水脉贴着西壁经过，井底连着咸泉。再深掘三尺，两层水便再也隔不开了。'],
   ['读信筒里的排班条','筒里不是信，是六家人轮流送水的班次。第一家有驴，最后一家只有一根扁担；班次一律相同。若封井走山泉，这六家将承担整条街的脚程。'],
  ],
  policies:[
   ['封住井底，在西壁开侧眼','井工把梯子转了方向。头一桶水仍浑，到第三桶，姨婆才肯舀一口。侧眼很细，往后逢旱必须按时分水，井栏边多了一面报时的小锣。','herbs'],
   ['封井引山泉，重排挑水的班次','你从坡上踏出一条可以并行两人的路。每家按能挑的重量分班。那根扁担终于能歇上一日；坡道结冰的冬天，家家都得留一只备用的水缸。','supplies'],
  ],
 },
 {
  title:'第六折 · 谁来保管水楔',
  lead:record=>record[4]==='0'?'井边的小锣敲了第一百次，有人沿着锣声找回最早的两枚水楔。':'山泉路旁长出第一株嫩桐，挑水的人把旧水楔放在树下歇肩。',
  scene:'图中的小姑娘已经能独自抬起闸梁。秋水退尽，两岸的人来问同一个问题：若明年守闸人不在，谁来落楔？她把红白木楔搁到你面前，说想跟船出去看看，从前总是听旁人讲河那头的事。',
  question:'把几年里做过的决定交回给住在河边的人。交付什么，会决定他们后来怎样记得你。',
  clues:[
   ['听她说为何想离开','她记得每种水深该用哪根楔，也记得哪家人逼父亲先为自己落楔。她不想一辈子靠别人的谢意来判断对错。她愿意教人，也愿意回来，只希望走的时候不用偷偷解船。'],
   ['翻过这些年的河簿','水尺背面密密刻着每一年的选择。没有哪一条线能包办后来所有的事。你第一次摸到的第三道刻痕还在，只是下游的人、树和饭碗，都与那一年不同了。'],
  ],
  policies:[
   ['立两岸共议的水簿，请她做第一位讲述人','她讲完最后一课，两岸各接过一枚木楔。第一场议事吵了整整半夜，第二天水照样到了田里。她在开往下游的船上给你留了一张空纸，说下次要寄她自己见到的河。','manual'],
   ['把守闸技艺编成图谱，交给轮值的学徒','她亲手画下最后一张侧视图。新学徒第一次合闸，把袖子弄得透湿，却没有人再非要找她才敢动手。她坐船走的那天随身只带一支木尺，过一座桥就量一次水。图印里留给你一块刻尺的玄铁。','iron'],
  ],
 },
];

export const riverCases=cases.length;
export function validateRiver(river){
 if(!river||Object.keys(river).length!==2||typeof river.record!=='string'||!/^[01]*$/.test(river.record)||river.record.length>cases.length||!Number.isInteger(river.seen)||river.seen<0||river.seen>3||river.record.length===cases.length&&river.seen!==0)throw new Error('问川图记录无效。');
}
export function riverNode(state,menu,choice){
 const e=state.events,river=e.river??{record:'',seen:0},index=river.record.length,current=cases[index];
 const block=text=>({kind:'narration',text});
 const node=(title,goal,lines,choices)=>({title,goal,blocks:lines.filter(Boolean).map(block),choices});
 const back=menu('river-back','合起问川图，回去修行','hub');
 const resume=menu('river-open','循图入境，查看这一折','river-site');
 const book=menu('next-case','翻看问川图','river-book');
 if(e.node==='river-result'){
  const prior=cases[index-1],policy=prior.policies[Number(river.record.at(-1))];
  const gift=state.lastReceipt?.itemChanges?.[policy[2]]>0?'图印松开，封在这一折的资用也随之解出。':'图印松开。行囊已经装满，你将这一折的赠礼留在了河边。';
  return node(prior.title,'记下这次处置的代价',[policy[1],gift],[book,back]);
 }
 if(!current)return node('问川图 · 河簿合卷','展开行旅录，或带着所得继续修行',['图面渐暗，河上有人把一条空船撑回上游。最初的水尺和最后的木楔，如今都有了去处。簿底露出领航人珍藏的一册行旅图。',...cases.map((c,i)=>c.title+'　'+c.policies[Number(river.record[i])][0])],[menu('voyage-book','打开领航人留下的行旅录','voyage-book'),menu('train-menu','用历练所得继续修行','training'),back]);
 if(e.node==='river-book')return node('问川图 · 河上人家',current.title,['这卷传习图封着六段前人留下的河上旧境。展开时，你可入境察看水土、听人说话、亲手处置难题。离开时图中年月停住，回来仍接原处。每折结印才解出一份修行资用。','已结 '+index+' 折。眼下翻到'+current.title+'。'],[resume,back]);
 const known=current.clues.flatMap(([label,text],i)=>river.seen&(1<<i)?[label+'。'+text]:[]);
 if(e.node==='river-reading')return node(current.title,'把看到的线索与他人的处境合起来',[...known],[menu('river-return','回到现场，重新权衡','river-site'),back]);
 if(e.node==='river-decision')return node(current.title,current.question,[current.question,...known],[...current.policies.map(([label,,item],i)=>choice('policy-'+i,label,'explore',item,'cautious',{next:'river-result',optionalGift:true,patch:{river:{record:river.record+i,seen:0}},rule:{days:2+i,items:{},gain:{[item]:1},checkKind:null,spiritCost:0,warnings:[]}})),menu('river-return','再看看现场','river-site')]);
 const investigations=current.clues.flatMap(([label],i)=>river.seen&(1<<i)?[]:[menu('clue-'+i,label,'river-reading',{river:{...river,seen:river.seen|(1<<i)}})]);
 const decide=menu('deliberate','权衡两种做法，决定怎样处置','river-decision');
 return node(current.title,current.question,[current.lead?.(river.record),current.scene,...known],[...investigations,decide,...(investigations.length<2?[back]:[])]);
}
