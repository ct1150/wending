import {exactKeys} from './schema.js';
import {V7_REALMS} from './actor-insight.js';

export const openingNodes = [
 'prologue-departure','prologue-gate','prologue-terms','prologue-work','prologue-road',
 'prologue-flood','prologue-camp','prologue-result','prologue-summary',
];

export function validateCampaignOpening(events,life){
 const p=events.prologue;
 const inOpening=openingNodes.includes(events.node);
 if(events.version!==2){
  if(p!==undefined||inOpening)throw Error('旧人生不能写入重构开篇。');
  return;
 }
 exactKeys(p,['water','help']);
 const {node,entry}=events;
 const hasRoute=entry==='joined'||entry==='declined';
 const beforeRoute=['prologue-departure','prologue-gate','prologue-terms'].includes(node);
 const afterWater=!['prologue-departure','prologue-gate','prologue-terms','prologue-work','prologue-road','prologue-flood'].includes(node);
 if((beforeRoute?entry!=='unresolved':!hasRoute)||
    node==='prologue-work'&&entry!=='joined'||node==='prologue-road'&&entry!=='declined'||
    (afterWater?!['canal','houses'].includes(p.water):p.water!==null)||
    (node==='prologue-summary'||!inOpening?!['accepted','declined'].includes(p.help):p.help!==null)||
    life&&inOpening&&(!['mortal','qi'].includes(life.realm)||
      node==='prologue-summary'&&life.realm!=='qi'||
      !['prologue-result','prologue-summary'].includes(node)&&life.realm!=='mortal')){
  throw Error('重构开篇的章节状态无效。');
 }
}

export function campaignOpening(state,menu,choice){
 const {events:e,life}=state;
 const apprentice=e.entry==='joined';
 const savedCanal=e.prologue.water==='canal';
 const row=(title,goal,paragraphs,choices)=>({
  title,goal,location:e.node==='prologue-departure'?'石溪村':'栖云山脚',
  blocks:paragraphs.map(text=>({kind:'narration',text})),choices,
 });
 const action=(key,label,intent,target,approach,next,rule,patch)=>choice(key,label,intent,target,approach,{next,rule,patch});
 const hearing='周执事的册子摊开在台阶上。药圃借山腰的石渠引水，昨夜大雨，渠工腾不出手。他愿用一卷完整功法换三日差事。山下的老舟户也识字，渡船底下还有先人留下的吐纳刻痕。';
 switch(e.node){
 case 'prologue-departure':
  return row('石溪村 · 临行','沿石溪走到栖云山脚',[
   '母亲把最后两块干饼分开包好。你原想把一块留回灶边，她把纸重新折紧：「出门的人先带着。等你认得路了，再想怎么还。」',
   '昨夜的雨冲走了村口的小木桥。捞桥的人认出桥板上烧过的记号，说是栖云门往年送下来的。你沿着水边望去，外院的屋脊还在云底，水已漫过半条旧路。',
  ],[
   action('leave-village','背上行囊，沿溪去栖云山','explore','supplies','cautious','prologue-gate',{days:1}),
   action('help-bridge','多留一日帮村人搭便桥，再上山','explore','herbs','cautious','prologue-gate',{days:2,gain:{herbs:1}}),
  ]);
 case 'prologue-gate':
 case 'prologue-terms':
  return row('栖云山脚 · 两条入门路','决定从谁那里学第一口吐纳',[
   ...(state.lastReceipt?.action?.id.endsWith(':c:help-bridge')?['临行前，你帮忙撑住了便桥的第一根桩。村里的采药人从新桥走过，留给你一束刚采的灵草。']:[]),
   hearing,
   e.node==='prologue-terms'?'「只清沟、分苗。」周执事用指头压住空白处。「三日以后，去留由你。雨再大，就先管人。」':'门内的木牌刚换过。你也可以不落名，沿挑夫指给你的路下到渡口。',
  ],[
   menu('join-gate','落名做三日药圃差事','prologue-work',{entry:'joined'}),
   menu('take-road','谢过执事，去渡口自行求道','prologue-road',{entry:'declined',location:'retreat'}),
   ...(e.node==='prologue-gate'?[menu('ask-terms','问清做工与去留的约定','prologue-terms')]:[]),
  ]);
 case 'prologue-work':
  return row('外院药圃 · 雨后的沟','整理药圃，学会第一口运气',[
   '林砚把木桩钉在沟边，叫你一边扶住锹柄，一边听手腕什么时候开始发颤。他来得早，却没笑你使笨力。「手一松，气才过得去。你把锹想成船篙。」',
   '你们可以沿沟慢慢清泥，也可先找出堵死的涵洞。涵洞边的挡板还在，近路省时，搬板时得用刚学会的那口气护住手腕。',
  ],[
   action('work-bank','跟林砚清沟三日，打牢吐纳','practice','self','steady','prologue-flood',{days:3,cultivation:1}),
   action('lift-sluice','抬开涵洞挡板，提早放水','practice','self','intensive','prologue-flood',{days:2,cultivation:1,spiritCost:7}),
  ]);
 case 'prologue-road':
  return row('老渡口 · 看得见的刻痕','寻找渡船下的吐纳刻痕',[
   '舟户梁婶把绳索往掌心一卷。她说水涨了，正缺人往高处搬东西。退潮以前，如果你帮她把船撑到旧桥墩边，便能看见水线下那八个刻字。',
   '另一处刻痕在滩下。你可以沿背水湾步行去查，费些脚程；也能拿出一份行粮，请摆短渡的人送你从高岸过去。',
  ],[
   action('follow-water','沿背水湾步行，自己拓下刻痕','explore','manual','cautious','prologue-flood',{days:4,spiritCost:5}),
   action('buy-passage','付一份行粮，从高岸搭渡','explore','manual','bold','prologue-flood',{days:1,items:{supplies:1}}),
  ]);
 case 'prologue-flood':
  return row('石溪下游 · 先开哪道口','决定洪水先从哪里走',[
   apprentice?'林砚还站在渠沿，下面的人以为他手里有开闸的牌。那牌其实在你这儿，他只是在等你拿定主意。':'梁婶带你认完刻痕，却没收起长篙。雨水在屋脚前打旋，她伸手指了两处，一处是山渠，一处是住着人的低岸。',
   '先稳住山渠，山上的药苗能保下游活水，但低岸得先搬空两间屋。先给民居开溢洪口，屋里的人能留下，大半畦药苗却会被水带走。能救的人都能先撤到高处，田和屋来不及一起保住。',
   apprentice?'林砚说，清沟的工和眼下这趟都记在差事簿上。功法会给你，水退以后也会有人记得是谁开的闸。':'梁婶把最后两行刻字念给你。抄本可以带走，她只请你动手以前先把话讲明白。',
  ],[
   action('save-canal','先稳住山渠，帮低岸人迁物','practice','self','steady','prologue-camp',
    {days:2,spiritCost:4,cultivation:apprentice?1:2,gain:{manual:1}},{prologue:{water:'canal',help:null}}),
   action('save-houses','开溢洪口让水绕过住屋','practice','self','intensive','prologue-camp',
    {days:5,spiritCost:8,cultivation:apprentice?1:2,gain:{manual:1}},{prologue:{water:'houses',help:null}}),
  ]);
 case 'prologue-camp': {
  const rest=choice('prologue-rest','静养调息，再作打算','rest','self','recover',{next:e.node});
  const retry=!life.items.manual
   ?action('restore-copy',apprentice?'回药圃重抄引气页':'循旧拓片补齐引气页','explore','manual','cautious',e.node,
    {days:apprentice?12:24,gain:{manual:1}})
   :null;
  const next=life.cultivation<V7_REALMS.qi.threshold
   ?action('settle-breath','用一季重新理顺吐纳','practice','self','steady',e.node,{days:90,cultivation:1,spiritCost:5})
   :choice('first-breakthrough','依引气页闭关，冲击炼气','practice','qi','breakthrough',{next:'prologue-result'});
  return row('溪边石屋 · 第一次冲关','集齐功法与修为，准备进入炼气',[
   savedCanal?'山渠保住了。你帮低岸的两家把湿木箱挪到祠堂，他们晾衣服的绳子一直挂到石屋窗边。':'低岸的住屋保住了。林砚领人把冲掉的药苗种回去，几天里总能看见他们提着空篮路过。',
   retry?'上一卷引气页已经用尽。练法还记得，但冲关前要补齐写下的次序；抄错一行就得从头核对。':'你把引气页沿水印摊开。第一转时切莫与水争快。若要闭关，石屋外头已经有人接手清渠，你可以把门关上了。',
  ],[...(retry?[retry]:[]),next,rest]);
 }
 case 'prologue-result':
  if(life.realm==='mortal')return row('溪边石屋 · 退关','留住性命，恢复后可以再试',[
   '那股气到了横骨下就散了。你掀开膝头的引气页，墨已浸进纸里。没人替你把这次算作成功；你能下床，下一卷也找得到。',
   '先看伤势和灵力。愿意继续的话，可以重新抄页，调息，再试一次。',
  ],[
   menu('try-again','回石屋查看缺的东西','prologue-camp'),
   choice('recover-first','先静养调息，再回石屋','rest','self','recover',{next:'prologue-camp'}),
  ]);
  return row('溪边石屋 · 炼气出关','决定要不要接下水边人送来的帮助',[
   '闭关这些年，水涨过又退过。出关那日，你听见溪流越过木结的时候顿了一下，从前只听见它响。',
   savedCanal?'药圃用那道闸又熬过两场汛。周执事带来两枚灵石，说修渠人把当年帮过手的名字刻在闸背，还给你留着一笔。':'住屋还立在低岸。那两家各捧来一份行粮，门上没被水吞掉的红刻，后来每到汛期都要补一遍。',
   '你可以收下，也可以告诉来人，暂时只愿带走自己的记忆。',
  ],[
   action('take-help',savedCanal?'收下两枚灵石，记住这道闸':'收下两份行粮，记住门上的红刻','rest','self','recover','prologue-summary',
    {days:1,gain:savedCanal?{stones:2}:{supplies:2}},{prologue:{...e.prologue,help:'accepted'}}),
   menu('go-alone','谢过来人，留物资给水边人','prologue-summary',{prologue:{...e.prologue,help:'declined'}}),
  ]);
 case 'prologue-summary':
  return row('第一章 · 水退以后','带着过往去看下游的问川图',[
   (savedCanal?'闸还立在山渠入口，旧桥下的临时木棚已经搭起了瓦顶。':'门上的红刻年年补，山上重新开出的一畦苗也已经收过好几回。')+
   (e.prologue.help==='accepted'?' 你收下了他们递来的资用，也认得以后该如何寻回这处标记。':' 你把物资留了下来。水退以后，谁也不必假装当初没有受过难。'),
   apprentice?'林砚送你到离开外院的石桥。他留下照看药圃，把一卷问川图的去向告诉你。':'梁婶指着河道拐弯的地方。问川图在那里，循岸走过去，不必拿谁的名帖。',
  ],[
   menu('campaign-book','翻开三界主线，去接下这一程','campaign-book'),
   menu('chapter-river','沿溪去看下游的问川图','river-book'),
   menu('chapter-out','先安顿行囊，再安排下一程','hub'),
  ]);
 }
 throw Error('未识别的开篇场景。');
}
