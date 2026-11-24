import {V7_REALMS} from './actor-insight.js';
import {DAYS_PER_YEAR,ITEMS} from './model.js';
import {exactKeys} from './schema.js';
import {councilHearings} from './mountain-council.js';
import {CAMPAIGN_CHAPTERS,DING_CHAPTER} from './campaign-chapters.js';

export const campaignNodes=['campaign-book','campaign-act','campaign-result','campaign-epilogue','campaign-ding','campaign-ending'];

const emptyCampaign=()=>({marks:'',ending:null});
const recordFor=events=>events.campaign??emptyCampaign();
const ready=(life,chapter)=>V7_REALMS[life.realm].rank>=V7_REALMS[chapter.realm].rank&&life.cultivationProfile.worldTier>=chapter.tier;

function chapterEvidence(events,index){
 switch(index){
 case 0:return events.river?.record.length?'你在问川图里摸清过下游水路与世家门道，此刻一眼便看穿了账册里的破绽。':'';
 case 1:return events.expedition?.place==='end'?'三程行旅攒下的勘路经验派上了用场，你很快摸清了古剑冢暗道的灵息走向。':'';
 case 2:return events.council?.length?'你在北山立下的名望早已传到城南，几家散修头领二话不说愿替你暗中递消息。':'';
 case 3:return events.convoy?.chapters.some(chapter=>chapter.loads.length)?'当年海路交割结下的船帮旧谊仍在，他们连夜替你摸清了星阵残墟的暗哨位置。':'';
 case 4:return events.cloudPassage?.some(entry=>entry.route!=null)?'你曾亲身在白脊云渡守过风候，知道罡风何时转向，省去了大片摸索功夫。':'';
 case 5:return events.homebound?.visits.some(visit=>visit.done)?'岑照早已认得你的脚步，见你登船便直接摊开了龙骨深处的旧档。':'';
 case 6:return events.cloudRift?.ending||events.riftBeacon?.ending==='delivered'?'白脊风隙里的暗流与岩檐你早已亲脚踏过，此刻设伏或突围都能快人一步。':'';
 case 7:return events.watch?.record.length?'九次守关练出的神识定力让你一眼辨清了天门雷柱的生门间隙。':'';
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
 const record=recordFor(state.events),chapter=CAMPAIGN_CHAPTERS[record.marks.length];
 const readyForEnding=!chapter&&state.life.realm==='tribulation'&&state.life.cultivationProfile.worldTier===2;
 const title=record.ending?'问鼎苍茫 · 尘埃落定':chapter?.title??'问鼎苍茫 · 终局抉择';
 const goal=record.ending?'此生已于九霄问鼎，余年仍可遍游三界、了结旧缘。':
  chapter?ready(state.life,chapter)?'风波已至，前往'+chapter.location+'亲手破局。':
   '前往'+['下界','中界','上界'][chapter.tier]+'，修至'+V7_REALMS[chapter.realm].name+'后再赴此局。':
   readyForEnding?'登临九霄天门，立于青铜巨鼎前定下三界去向。':'渡过九霄天劫，登临上界问鼎台。';
 return {title,goal,done:record.marks.length+Number(!!record.ending),total:CAMPAIGN_CHAPTERS.length+1};
}

export function validateCampaign(events,life){
 const inCampaign=campaignNodes.includes(events.node);
 if(!Object.hasOwn(events,'campaign')&&!inCampaign)return;
 if(events.version!==2||!events.prologue?.help)throw Error('须完成开篇才能续写三界主线。');
 const record=Object.hasOwn(events,'campaign')?events.campaign:emptyCampaign();
 exactKeys(record,['marks','ending']);
 if(typeof record.marks!=='string'||!/^[01]*$/.test(record.marks)||record.marks.length>CAMPAIGN_CHAPTERS.length||
    ![null,'public','personal'].includes(record.ending)||record.ending&&record.marks.length!==CAMPAIGN_CHAPTERS.length||
    ['campaign-result','campaign-epilogue'].includes(events.node)&&!record.marks||
    events.node==='campaign-ending'&&!record.ending||
    events.node==='campaign-act'&&(record.ending||!CAMPAIGN_CHAPTERS[record.marks.length])||
    events.node==='campaign-ding'&&(record.marks.length!==CAMPAIGN_CHAPTERS.length||record.ending)){
  throw Error('三界主线记录无效。');
 }
 if(life){
  const reached=CAMPAIGN_CHAPTERS[record.marks.length-1];
  if(reached&&!ready(life,reached)||
     events.node==='campaign-act'&&!ready(life,CAMPAIGN_CHAPTERS[record.marks.length])||
     (record.ending||events.node==='campaign-ding')&&(life.realm!=='tribulation'||life.cultivationProfile.worldTier!==2)){
   throw Error('三界主线不能越境交割。');
  }
 }
}

export function campaignScene(state,menu,choice,actor){
 const {events,life}=state,record=recordFor(events),index=record.marks.length,chapter=CAMPAIGN_CHAPTERS[index];
 const away=chapter&&life.cultivationProfile.worldTier>chapter.tier;
 const progress=campaignProgress(state);
 const back=menu('back','合上密卷，回山安排自己的仙路','hub');
 const train=menu('train-menu','静心修炼与整备器物','training');
 const book=menu('campaign-book','返回三界主线卷宗','campaign-book');
 const materialize=list=>list.map(b=>typeof b==='string'?{kind:'narration',text:b}:b.kind==='dialogue'?{kind:'dialogue',speaker:actor(b.speaker),text:b.text}:b);
 const row=(title,goal,blocks,choices,location)=>({
  title,goal,...(location?{location}:{}),blocks:materialize(blocks),choices,
 });
 const paid=(key,label,approach,next,rule,campaign)=>choice(key,label,'practice','self',approach,{
  next,rule,patch:{campaign},optionalGift:true,
 });
 const records=record.marks.replaceAll('0','').length;
 const originNote=events.prologue.water==='canal'
  ?'从石溪山渠保住的那一夜起，你便知道修仙界从没有两全的便宜可占。'
  :'从石溪低岸抢下两间土屋的那一夜起，你便学会了替自己的抉择担起后果。';

 switch(events.node){
 case 'campaign-book': {
  if(record.ending)return row('三界主线 · 问鼎余韵',progress.goal,[
   originNote,
   record.ending==='public'
    ?'重铸后的青铜公鼎高悬九霄，下界寒村与上界云海之间，终于有了不再吞噬道果的堂皇仙路。'
    :'万载青铜巨鼎既碎，三卷素帛手稿流落三界四方，无数不肯向强权低头的散修正在空白处续写新途。',
  ],[menu('read-ending','重温此生问鼎终局','campaign-ending'),back]);
  const going=chapter&&ready(life,chapter);
  const finalReady=!chapter&&life.realm==='tribulation'&&life.cultivationProfile.worldTier===2;
  const side=going&&!away?chapterDetour(events,chapter):null;
  const crossing=chapter&&life.cultivationProfile.worldTier<chapter.tier&&
   V7_REALMS[life.realm].rank>=(life.cultivationProfile.worldTier===0?2:4);
  const summary=index===0
   ?'山雨初歇，青石坊鬼市已经传出栖云门失窃古简与毒丹命案的风声。'
   :'三界风波一环扣着一环，前头留下的恩怨与盟约，正牵引你走向下一处漩涡：第'+(index+1)+'卷「'+(chapter?.title??'问鼎苍茫')+'」。';
  return row('三界主线 · '+progress.title,progress.goal,[
   originNote,
   summary,
   going?(away?'这一卷风波起于旧界，但旧友已借跨界传讯符将实情递到你案前。你可在此界运筹传令，隔界定局。':
    '眼下境界与身位皆已齐备，随时可直入风波中心。若先前已在江湖旧路攒下实证与人脉，破局时必能事半功倍。'):
    crossing?'下一卷风波已燃至更高界域。趁手头阵盘与灵石渐丰，可去界台筹谋跨界。':
    '眼下修为尚不足以硬撼下一重风云。不妨先闭关打磨境界，或去寻访故人、探查三界秘境。',
  ],[
   going?menu('campaign-act','入局 · '+chapter.title,'campaign-act'):
    finalReady?menu('campaign-ding','登临九霄天门，直面青铜巨鼎','campaign-ding'):
    crossing?menu('crossing-ways','前往界台，筹备跨界之路','crossing-ways'):train,
   ...(side?[menu('campaign-detour','先赴江湖旧路 · '+side[1],side[0])]:
    [menu('campaign-affairs','探访故人、查功法与秘境风声','affairs')]),
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
  const statusLine=(assisted?'前番你肯替众人出头，旧友与散修们暗中替你递来眼线，正面破局省了不少周折。':
   '前番你独行取利，眼下无人愿白白替你出面担风险，想堂皇掀桌得多费一倍周章；暗中截胡虽费时日，却能把好处抓在自己手里。')+
   (evidence?' '+evidence+'有此底牌在手，两种手段的耗时皆能折半。':'');
  const lootLine='破局之后，可夺得'+ITEMS[chapter.material]+'两份。'+
   (chapter.passage?'另得校好的护身阵盘一件与'+chapter.passage+'枚灵石，足以支撑跨界。':
    index>=4?'另得上界阵盘与护身法器各一件，可留作高境护阵冲关。':'');
  const blocks=[
   ...(away?[{kind:'narration',text:'跨界传讯符在案上燃起淡青微光，旧界传来的急讯将现场厮杀与算计一五一十映在眼前——'}]:[]),
   ...chapter.blocks,
   {kind:'narration',text:statusLine+' '+lootLine},
  ];
  return row('第'+(index+1)+'卷 · '+chapter.title,'权衡利害与道心，定下破局手段',blocks,[
   paid('campaign-public',away?'以跨界传令遥控旧部，堂皇破局':chapter.work[0],'steady','campaign-result',
    {days:evidence?Math.ceil(publicDays/2):publicDays,spiritCost:8,items:{supplies:1},cultivation,gain},{...record,marks:record.marks+'0'}),
   paid('campaign-personal',away?'暗中递信令旧线人分头截胡，独取筹码':chapter.work[1],'intensive','campaign-result',
    {days:evidence?Math.ceil(personalDays/2):personalDays,spiritCost:12,cultivation,gain},{...record,marks:record.marks+'1'}),
   book,
  ],chapter.location);
 }

 case 'campaign-result': {
  const previous=CAMPAIGN_CHAPTERS[index-1],method=Number(record.marks.at(-1));
  const distant=life.cultivationProfile.worldTier>previous.tier;
  return row(previous.title+' · 尘埃暂落',progress.goal,[
   (distant?'数日后，跨界驿舟捎来旧界的捷报与战利品——':'')+previous.result[method],
   method===0?'这一回你敢在众目睽睽下亮剑，江湖中认得你名号的人又多了一批；可树大招风，暗处盯着你的仇家也把刀磨得更亮了。':
    '这一回你把好处实实在在攥进了自己掌心，少沾了无数扯皮恩怨；只是往后若想号召众人同心，怕是没人肯轻易为你卖命。',
   '风波背后似还藏着更深的隐情。你可以趁热留步深谈，听当事人吐露秘闻，也可先收拢战利品回去闭关。',
  ],[
   menu('campaign-epilogue','留步深谈 · 追查此案背后的暗线','campaign-epilogue'),
   book,
   train,
  ],previous.location);
 }

 case 'campaign-epilogue': {
  const previous=CAMPAIGN_CHAPTERS[index-1];
  return row(previous.epilogueTitle,'听清暗线伏笔，为下一重风云早作筹谋',previous.epilogueBlocks,[
   book,train,back,
  ],previous.location);
 }

 case 'campaign-ding':
  return row(DING_CHAPTER.title,DING_CHAPTER.goal,
   records>=4?DING_CHAPTER.introPublic:DING_CHAPTER.introPersonal,[
   paid('ding-public','以渡劫道果重铸公鼎，斩断吞魂恶法，将仙路公传三界','steady','campaign-ending',
    {days:2*DAYS_PER_YEAR},{...record,ending:'public'}),
   paid('ding-personal','挥剑劈碎万载青铜巨鼎，写三卷手稿私授三界肯走新路之人','intensive','campaign-ending',
    {days:DAYS_PER_YEAR},{...record,ending:'personal'}),
   book,
  ],DING_CHAPTER.location);

 case 'campaign-ending':
  return row('此生问鼎 · '+(record.ending==='public'?'重铸公鼎，薪火长明':'劈鼎破枷，路在脚下'),progress.goal,
   record.ending==='public'?DING_CHAPTER.endingPublic:DING_CHAPTER.endingPersonal,[
   back,train,book,
  ],DING_CHAPTER.location);
 }
 throw Error('未识别的三界主线场景。');
}
