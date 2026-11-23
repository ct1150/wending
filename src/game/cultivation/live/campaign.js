import {V7_REALMS} from './actor-insight.js';
import {DAYS_PER_YEAR,ITEMS} from './model.js';
import {exactKeys} from './schema.js';
import {councilHearings} from './mountain-council.js';

export const campaignNodes=['campaign-book','campaign-act','campaign-result','campaign-ding','campaign-ending'];

const chapters=[
 {
  title:'河册两份',realm:'qi',tier:0,
  scene:'溪口来的人把两只箱子抬到案上。箱里是当年退水后重画的地契。一张写了每处住户，一张只画出涨水也能走的线。此刻要过河的挑夫讨一张能认路的图，住户却担心连他们欠的租一起被抄出去。',
  work:['请两岸各出一人，共写一份只有水线的图','约两户先走一遍，把不能公开的路标交还住户'],
  result:['后来人能从祠堂抄到同一条路。各家的门牌单独收着，管册的人答应交班时当面点清。','你亲自送完最后一户。他们愿意教下一批人认水线，只请你先来敲门。'],
  lead:['river-book','问川图'],material:'crystal',days:20,
 },
 {
  title:'山口的空位',realm:'foundation',tier:0,
  scene:'往清河城的古阵半年才校一次。守阵人说这回多了个空位，山腰等药的人也想把一只药箱送上去。若留一张公开班次，别的挑夫也能赶来。若把空位留给已经等了三日的脚夫，下回再来的就只能看他写的信。',
  work:['出资立候阵木牌，让临时旅人也能排队','帮现有脚夫背药，把空位留到他办完事'],
  result:['木牌被风刮得响，终有人过来抄班次。守阵人留下一套已校过的阵盘和路费，供你自己决定何时开阵。','脚夫把药送到了该去的地方，照护过他的人替你备好了开阵资用。'],
  lead:['river-book','问川图和行旅录'],material:'core',days:36,passage:45,
 },
 {
  title:'合铺与散市',realm:'golden',tier:1,
  scene:'清河城要搬一次夜市。愿意合铺的药贩可以共用一条卸货道，却得让人查他们的账。只肯散卖的会保住自己的秤，还得各凑一盏灯。城南有人问你能不能先摆一摊，给两边都看见。',
  work:['担保试开共用的卸货道，约定两处账各自封存','带独立摊贩画三段夜路，让他们自己轮班点灯'],
  result:['两个摊主把秤分开放，卸货道却一起扫。来访人知道怎样借道，也知道账页不能随手翻。','市没有合起来。最先学会第二条夜路的人把它教给隔壁，隔壁后来也轮到一次守灯。'],
  lead:['council-book','北山公簿'],material:'soulseal',days:68,
 },
 {
  title:'送到半空的信',realm:'nascent',tier:1,
  scene:'中界的阵眼修好一半，掌阵人说可以先送一批路引去上界。有人带来一匣多年无人签收的信，也有人只想寄确定有人等的那一封。不是每封信都需要收信人回来，你要决定怎样保存它们。',
  work:['帮港里建立退信簿，写明谁有权取回旧信','带愿意署名的寄信人分头查收，再逐封交割'],
  result:['第一封退回的信没有被拆，信角添了一个能到的地址。港里把你这一程开阵所需的东西留好了。','船没带走整匣旧信，却有人顺着你给的地址亲自来了。掌阵人答谢你补好了被水泡坏的信托。'],
  lead:['convoy-book','三界海路'],material:'skykey',days:120,passage:90,
 },
 {
  title:'风里该挂什么',realm:'spirit',tier:2,
  scene:'白脊有两处能挂辨风的小旗。一处对多年守风的人最顺手，一处离刚到上界的人的歇脚棚近。立两杆并不难，难的是哪一个人来教下一班辨认真正的风向。',
  work:['把风旗挂在众人都能接手的位置，付一次调换的工期','请各班先认熟自己的落脚处，留下可互认的风记'],
  result:['旗杆换位那日，原先认路的人自己来教了两次。歇脚棚里有人第一次听明白旗声。','两班仍各走各的路，遇到折回的云时已经会互敲一下箭头旁的木板。'],
  lead:['sky-book','白脊云渡'],material:'voidstone',days:240,
 },
 {
  title:'谁替船作主',realm:'void',tier:2,
  scene:'岑照拿着旧归图来问上界的新缆桩该拴在哪里。青年们想把归船停成渡口，醒来的人却怕整艘船就此归一个港。你可以把这件事记成约，也可以让每一舱递自己的去处。',
  work:['让两方各留一个座位，签下以后能修改的泊约','带愿意离舱的人分头试路，保留还想回船的路'],
  result:['泊约第一条就写着可以重新议。岑照把自己那份收进桅下，留一份给后来醒的人。','第一趟有两人回船，一人留下。岑照按他们写出的真实去处改了一行旧图。'],
  lead:['home-book','归航者'],material:'unityjade',days:330,
 },
 {
  title:'绕过缺口的路',realm:'unity',tier:2,
  scene:'山背的浮岩又落了一片，风隙旁的旧刻如今只能照到半边。大队人想拉一道新索，小船想留一条旧回水。要修的是往后的路，哪一处先让出去，会决定这里还能住几种人。',
  work:['跟探路班重画索道，给小船保留回水口','沿旧回水带船走一遍，亲手给索班指出可以落钉的崖'],
  result:['索先架好，回水口留在图上。有人提议日后填平，那一天在场的人把实测水位取出来给他看。','先到的是送粮的小船。索班用了你标的崖，借到一夜泊船处才把另一端钉牢。'],
  lead:['sky-book','白脊风隙旧路'],material:'daofruit',days:450,
 },
 {
  title:'雷印下的一席',realm:'mahayana',tier:2,
  scene:'最后一处界台雷影已经连到三界。放渡的人想轮流上来验刻，守山的人怕住处旁全是来观雷的人。旧名册堆在你脚边，你有能力叫他们听你的，也可以让他们先说清自己愿意付出什么。',
  work:['开一个公开的候台，每班留下一纸亲查的底账','亲访两处不愿开门的旧居，让验刻人改道绕开'],
  result:['候台没有挂掌门的姓名。底账第一纸记着有人提过异议，第二纸是他亲手验过的那一点。','验刻路长了一截，却不再从人的门口穿过。守山的人换着班送来一份雷印和护阵的用度。'],
  lead:['watch-book','守关簿与山门旧路'],material:'thunderseal',days:600,
 },
];

const emptyCampaign=()=>({marks:'',ending:null});
const recordFor=events=>events.campaign??emptyCampaign();
const ready=(life,chapter)=>V7_REALMS[life.realm].rank>=V7_REALMS[chapter.realm].rank&&life.cultivationProfile.worldTier>=chapter.tier;

function chapterEvidence(events,index){
 switch(index){
 case 0:return events.river?.record.length?'你亲手落过问川图的章，可以用河上见过的事作底。':'';
 case 1:return events.expedition?.place==='end'?'行旅录已有你的图印，界台可以核对你真正走过的水路。':'';
 case 2:return events.council?.length?'北山已记下一件双方认过的事，市集的人愿意照这个做法先试一晚。':'';
 case 3:return events.convoy?.chapters.some(chapter=>chapter.loads.length)?'旧海路有你亲自交割的船签，可以用来对读收信地址。':'';
 case 4:return events.cloudPassage?.some(entry=>entry.route!=null)?'你出过一次云渡，能拿当时的风候来校这张图。':'';
 case 5:return events.homebound?.visits.some(visit=>visit.done)?'岑照记得你返过一次港，拿出同一份归航簿让两边对读。':'';
 case 6:return events.cloudRift?.ending||events.riftBeacon?.ending==='delivered'?'你带回过风隙的记录，探路人不必让你重新走一遍同一侧。':'';
 case 7:return events.watch?.record.length?'守关簿里有一次双方交割过的底记，候台不必从整册白纸开写。':'';
 default:return '';
 }
}

function chapterDetour(events,chapter){
 if(!chapter)return null;
 if(chapter.lead[0]==='convoy-book'&&events.council?.length===councilHearings)return chapter.lead;
 if(['council-book','convoy-book'].includes(chapter.lead[0])){
  if(events.expedition?.place==='end')return ['council-book','北山公簿'];
  if(events.river?.record.length===6)return ['voyage-book','三程行旅'];
  return ['river-book','问川图'];
 }
 return chapter.lead;
}

export function campaignProgress(state){
 if(state?.events?.version!==2||!state.events.prologue.help)return null;
 const record=recordFor(state.events),chapter=chapters[record.marks.length];
 const readyForEnding=!chapter&&state.life.realm==='tribulation'&&state.life.cultivationProfile.worldTier===2;
 const title=record.ending?'问鼎已成':chapter?.title??'问鼎 · 所学留给谁';
 const goal=record.ending?'此生已经落下鼎铭，可以继续安排自己的路。':
  chapter?ready(state.life,chapter)?'查看这一次该替谁留路。':
   '前往'+['下界','中界','上界'][chapter.tier]+'，修至'+V7_REALMS[chapter.realm].name+'后接续。':
   readyForEnding?'到鼎前决定所学的归处。':'修至渡劫，再到上界问鼎。';
 return {title,goal,done:record.marks.length+Number(!!record.ending),total:chapters.length+1};
}

export function validateCampaign(events,life){
 const inCampaign=campaignNodes.includes(events.node);
 if(!Object.hasOwn(events,'campaign')&&!inCampaign)return;
 if(events.version!==2||!events.prologue?.help)throw Error('须完成开篇才能续写三界主线。');
 const record=Object.hasOwn(events,'campaign')?events.campaign:emptyCampaign();
 exactKeys(record,['marks','ending']);
 if(typeof record.marks!=='string'||!/^[01]*$/.test(record.marks)||record.marks.length>chapters.length||
    ![null,'public','personal'].includes(record.ending)||record.ending&&record.marks.length!==chapters.length||
    events.node==='campaign-result'&&!record.marks||
    events.node==='campaign-ending'&&!record.ending||
    events.node==='campaign-act'&&(record.ending||!chapters[record.marks.length])||
    events.node==='campaign-ding'&&(record.marks.length!==chapters.length||record.ending)){
  throw Error('三界主线记录无效。');
 }
 if(life){
  const reached=chapters[record.marks.length-1];
  if(reached&&!ready(life,reached)||
     events.node==='campaign-act'&&!ready(life,chapters[record.marks.length])||
     (record.ending||events.node==='campaign-ding')&&(life.realm!=='tribulation'||life.cultivationProfile.worldTier!==2)){
   throw Error('三界主线不能越境交割。');
  }
 }
}

export function campaignScene(state,menu,choice){
 const {events,life}=state,record=recordFor(events),index=record.marks.length,chapter=chapters[index];
 const away=chapter&&life.cultivationProfile.worldTier>chapter.tier;
 const progress=campaignProgress(state);
 const back=menu('back','把册子收好，继续自己的仙路','hub');
 const train=menu('train-menu','安排下一段修炼与整备','training');
 const book=menu('campaign-book','翻回三界主线','campaign-book');
 const row=(title,goal,paragraphs,choices)=>({
  title,goal,blocks:paragraphs.map(text=>({kind:'narration',text})),choices,
 });
 const paid=(key,label,approach,next,rule,campaign)=>choice(key,label,'practice','self',approach,{
  next,rule,patch:{campaign},optionalGift:true,
 });
 const records=record.marks.replaceAll('0','').length;
 const history=events.prologue.water==='canal'
  ?'你展开山渠那年的拓记。最先留下的一线墨，是人们搬着箱子过桥时划歪的。'
  :'你展开低岸门前的拓记。那道红刻留过住屋，又被后来人一遍遍涂亮。';
 switch(events.node){
 case 'campaign-book': {
  if(record.ending)return row('已经写下的鼎铭',progress.goal,[history,
   record.ending==='public'?'公开的副本正在三界各处交接。':'每处手艺仍留在当初愿意收下它的人手里。',
  ],[menu('read-ending','再读一遍此生的问鼎结局','campaign-ending'),back]);
  const going=chapter&&ready(life,chapter);
  const finalReady=!chapter&&life.realm==='tribulation'&&life.cultivationProfile.worldTier===2;
  const side=going&&!away?chapterDetour(events,chapter):null;
  const crossing=chapter&&life.cultivationProfile.worldTier<chapter.tier&&
   V7_REALMS[life.realm].rank>=(life.cultivationProfile.worldTier===0?2:4);
  return row(progress.title,progress.goal,[
   history,progress.goal,
   going?(away?'这一册由驿班从旧界送来。你可以留在本界，写信商定怎样交割。':
    '你可以就此接手眼前的难题。沿旧路亲自做过事的人，可以带那份实证回来，少走一趟。'):
    crossing?'前一次交割可能已备下阵盘与路费。到界台核对时日与风险，再亲自开阵。':
    '还有未看过的路，就留到修行间隙再去。卷中已写明的决定会留在这里。',
  ],[
   going?menu('campaign-act','接续这一章 · '+chapter.title,'campaign-act'):
    finalReady?menu('campaign-ding','走到鼎前，决定所学的归处','campaign-ding'):
    crossing?menu('crossing-ways','到界台比较实际跨界方案','crossing-ways'):train,
   ...(side?[menu('campaign-detour','先去探访'+side[1],side[0])]:
    [menu('campaign-affairs','去处理故人之约与功法','affairs')]),
   back,
  ]);
 }
 case 'campaign-act': {
  const previous=index?record.marks.at(-1):events.prologue.help==='accepted'?'0':'1';
  const assisted=previous==='0';
  const evidence=chapterEvidence(events,index);
  const publicDays=chapter.days*(assisted?1:2);
  const personalDays=chapter.days*3;
  const nextRealm=Object.values(V7_REALMS)[V7_REALMS[chapter.realm].rank+1];
  const cultivation=life.realm===chapter.realm?Math.max(0,Math.ceil((nextRealm.threshold-life.cultivation)/2)):0;
  const gain={[chapter.material]:2,...(chapter.passage?{stones:chapter.passage,array:1}:{}),
   ...(index>=4?{artifact:1,...(!chapter.passage?{array:1}:{})}:{})};
  return row(chapter.title,'选定你愿意承担的做法',[
   away?'驿信把旧界的实情写在纸上。'+chapter.scene:chapter.scene,
   assisted?'前一程有人愿意作证。他们能替你省一次往返，共办也须开一份行粮。':
    '这次无人替你作保。若想邀人共办，须多走一趟；分头实地做也仍有办法。',
   ...(evidence?[evidence+'带着实证，两种走法都能少花一半日数。']:[]),
   '交割可得'+ITEMS[chapter.material]+'两份。'+
    (chapter.passage?'当地另备一件阵盘和'+chapter.passage+'枚灵石，供你准备跨界。':index>=4?'当地另备一件阵盘和一件法器，可用于护阵。':''),
  ],[
   paid('campaign-public',away?'寄回共办的办法，请当地人共同照看':chapter.work[0],'steady','campaign-result',
    {days:evidence?Math.ceil(publicDays/2):publicDays,spiritCost:8,items:{supplies:1},cultivation,gain},{...record,marks:record.marks+'0'}),
   paid('campaign-personal',away?'分头写信，逐人核实后托驿班交割':chapter.work[1],'intensive','campaign-result',
    {days:evidence?Math.ceil(personalDays/2):personalDays,spiritCost:12,cultivation,gain},{...record,marks:record.marks+'1'}),
   book,
  ]);
 }
 case 'campaign-result': {
  const previous=chapters[index-1],method=Number(record.marks.at(-1));
  const distant=life.cultivationProfile.worldTier>previous.tier;
  return row(previous.title+' · 交割',progress.goal,[
   (distant?'驿班带来旧界的回单和资用。来信这样写：':'')+previous.result[method],
   method===0?'同行人各留下一份说得清来路的记录。若后面还能共办，就有人肯替这份底账作证。':
    '私下交付的路标跟着当事人走。下一程若需要多人作证，你得亲自把他们再请来。',
   progress.goal,
  ],[book,train,back]);
 }
 case 'campaign-ding':
  return row('三界鼎前 · 最后一笔','决定谁能使用你留下的路',[
   '鼎前没有人催你写姓名。案上摊着三界的旧纸，从石溪的第一条水线，一直铺到你见过雷影的地方。',
   records>=4?'你经手的事，多半有几份可当面交接的清册。要公传，许多人已经知道怎样读；要私授，也有记得当时难处的人来领。':
    '你经手的事，多半亲自交到人手上。有些路标原来只给愿意出门的人看。要写公开本，就得接受后来有人会走得和你不同。',
   '所学不会在今天既公传又私授。留下的一份归后来人，自己仍可以走出鼎前。',
  ],[
   paid('ding-public','把可用的路写进公鼎，交各界轮值','steady','campaign-ending',
    {days:2*DAYS_PER_YEAR},{...record,ending:'public'}),
   paid('ding-personal','把三份手稿交给愿意接手的人','intensive','campaign-ending',
    {days:DAYS_PER_YEAR},{...record,ending:'personal'}),
   book,
  ]);
 case 'campaign-ending':
  return row('此生问鼎 · '+(record.ending==='public'?'留路给众人':'路在后来人'),progress.goal,[
   history,
   record.ending==='public'?'许多年后，轮值者换过名字。还有人在鼎前抄近山水线，遇到不懂的地方，便沿页上留下的名字去问。':'有人揣着一份手稿，隔很多年才重新回到水边。手稿没有变成门票。那个人把自己真正走通的一段另画在空白处。',
   '从受人引路到亲自留下一条路，这一卷已经合上。此生尚可继续；来日若寿尽，仍由你决定是否步入轮回。',
  ],[back,train,book]);
 }
 throw Error('未识别的三界主线场景。');
}
