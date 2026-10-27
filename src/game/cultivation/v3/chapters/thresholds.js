import { TALENTS, REALMS } from '../model.js';
import { action, fork, scene, retirement } from './common.js';

const TALENT_EVENTS = {
 'keen-memory':['过目成诵','石桥茶棚','摊主陆伯的旧书被雨浸烂，许多字迹只剩墨痕。你方才翻过一遍，仍记得前后句之间不寻常的停顿。若替他重录，你会错过今晚便宜的客船，却能把散落的呼吸节律连成完整的认知。','陆伯','记得字还不够，错的地方也要指出来。旧书不是因为旧就不能改，人的记忆也不能拿来替别人作主。','抄回旧书，练习辨句', {cultivation:1,skills:['formation']},{days:12}],
 'sensitive-breath':['听息敏锐','桥洞暗流','桥洞里的风忽然分成两股，一股带着水腥，一股却透着干燥的石灰气。守桥人说阵眼渗漏已久，没人敢在夜里钻进去。你能听见普通耳朵分辨不出的息流，但那股杂音也会整夜缠在脑中。','守桥人','我替你牵绳。听不清就退，能听见危险，不等于必须替所有人把危险吞下去。','循着息流找出漏隙',{cultivation:1,skills:['conceal']},{days:9}],
 'iron-bones':['坚韧筋骨','石桥绞盘','载着石料的绞盘卡在半坡，工人们已经撑了大半个时辰。你知道自己的筋骨比常人耐力更足，却也清楚骨头能承重，肩上的皮肉并不会因此不疼。帮他们卸下石车，会让你的行程慢上两旬。','搬石的周嫂','肯帮忙就搭把手，撑不住一定说。别拿不喊疼当本事，我们要的是一起把车放稳。','接住绞索，与工人轮换',{cultivation:1,items:{iron:1}},{days:20}],
 'sword-bone':['天生剑骨','断剑铺','铺子里一柄折剑不停轻鸣，旁人听来刺耳，你却隐约知道怎样握住它才不会伤手。铺主不愿白送，说剑若落入只想证明自己的人手里，断一次也没有用。你可以替他守炉三旬，学会把锋芒收进鞘里。','剑铺主人','先学收剑，再学出剑。你与它相合，不是它欠你；让它伤人之前，你总得想清楚要护谁。','守炉磨剑，练习收势',{cultivation:1,skills:['sword']},{days:30}],
 'flash-wisdom':['刹那慧心','星盘旧摊','一块失灵的星盘偶尔闪出残光，你忽然看见几道阵线可以换个方向相接。念头来得极快，却不能代替耐心验算。若趁记忆鲜明将它画下，往后半月都要放弃赶路；若急着当场尝试，烧坏的也许不止星盘。','摆摊的许娘','灵光一闪是门开了一条缝，走进去还得自己迈脚。纸给你，错一张就再画一张。','把灵光逐步验成可用阵图',{cultivation:1,skills:['formation']},{days:18}],
 'fortune-debt':['福祸相依','摇铃小巷','你捡到一枚落在沟里的信物，巷尾恰有陌生人焦急寻找。运气把他带到你面前，也把他的追债人带到了街口。若归还信物，你会得到一份真实的人情，却要拿出数日替他解释误会；天降的便宜原来总跟着一段难走的路。','失物人谢衡','这是我妹妹出海前留下的。谢礼我给得起，麻烦也确实是我的，你若不愿牵连，我绝不怪你。','归还信物，陪失主解决纠纷',{cultivation:1,items:{favor:2}},{days:25}],
 rootless:['无灵根异相','桥头夜学','夜学里的测灵石对你毫无反应，先生却发现你铺开的沙面会随呼吸形成细纹。传统法门从灵根借力，你或许只能从身外阵势绕一条更长的路。邻座孩子递来一根树枝，愿意陪你反复描线，直到找出第一个能自己合拢的圆。','夜学先生','石头测不出的，不一定不存在。但别把这句话当借口，今夜我们先做成一件能重复的事。','以阵代根，重建行气次序',{cultivation:1,skills:['formation']},{days:40}],
 'void-echo':['前尘回响','桥尾空亭','空亭里忽然响起一声不属于今夜的橹声。你认得那份悲伤，却想不起是谁在撑船。一个陌生老妇来亭里避风，问起早已迁走的渡口。你可以循着残响找回旧河道，却必须陪她亲眼看见如今的河岸，不能把前尘当成她仍有家可回的保证。','避风老妇','你听见了什么，不必急着告诉我。我活在今日，先带我看看今日的路吧。','辨认残响，陪老妇重访旧岸',{cultivation:1,skills:['conceal'],items:{favor:1}},{days:30}],
};

const PAIR_EVENTS = [
  {
    ids: ['keen-memory','sensitive-breath'], title: '听见纸上的暗河', location: '石桥断碑窟',
    goal: '将记住的残文与听见的气路相合，试取古修留下的护符',
    text: '断碑上半篇行气口诀已经磨平，窟内却有一阵阵潮声。寻宝人把它当成涨水的征兆，赶在日落前退走。你记起陆伯旧书里一处倒写的字，又听出潮声总在那个字应当停顿的地方转向。如果同时用上记忆与听息，或许能把早已失传的口诀读给这座石窟听。碑缝里嵌着一枚灰白护符，贸然伸手会触动封窟机关。你可以留下半月慢慢试音，也可以把洞口的位置记好，先去静院完成入门。',
    speaker: '守窟老者', dialogue: '我守了三十年，只听见水。你若真能听出字，就试着读给我听；读不通，今晚还可以一起喝粥。',
    label: '凭记忆补诀，沿息声取出护符', result: '你用了十八日一字一息地试读，封窟机关终于停住。护符落在掌心，残诀也成了你真正理解的一段气路。',
    effects: {cultivation:1,items:{talisman:1}}, costs:{days:18},
    alternative:'记下碑文和窟址，先去静院扎稳根基', alternativeResult:'你把可以辨认的碑文录在纸上，离开前向老者借宿一晚；那枚护符暂且留在原处。',
  },
  {
    ids: ['sword-bone','iron-bones'], title:'剑鸣入骨', location:'石桥试剑台',
    goal:'在骨骼承受剑意之前，决定是否支付不可追回的余寿',
    text:'少年剑客裴纵立在试剑台上，身旁插着一截无人敢碰的玄铁剑胚。他要去北境争一个入门名额，却始终压不住剑胚里的锋意。你的手靠近时，剑骨先发出回应，强韧的筋骨也能承住最初的震颤。裴纵提出与你共试：他守住剑尖，你以自身精血温养剑脊，成功后各分一块可铸器的玄铁。可这不是普通的划伤，哪怕只催动一次，也要折掉整整一年寿元，肩臂还会受内伤。台下有一把可借用的普通木剑，你并非只有这一种结交他的办法。',
    speaker:'裴纵', dialogue:'我缺的是同行的人，不是替我送命的赌注。代价先讲明白；你若不试，我们照样能用木剑过招。',
    label:'燃去一年余寿，以剑骨压住剑胚', result:'剑鸣沿骨骼震过全身。你与裴纵各自退了三步，剑胚终于裂成可用的玄铁；你得到两块玄铁和一次深刻体悟，也留下内伤与一年不可追回的命损。',
    effects:{cultivation:2,injury:2,items:{iron:2}},costs:{days:4,lifeYears:1},
    alternative:'放下剑胚，与裴纵用木剑切磋',alternativeResult:'你与裴纵用木剑拆招，认清彼此出手的习惯。剑胚仍未归谁，切磋本身却已足够让你记住这个对手。',
  },
  {
    ids:['flash-wisdom','fortune-debt'],title:'落星要价',location:'石桥观星坡',
    goal:'选择是否用三年寿元截住一次看得懂、也付得起的机缘',
    text:'谢衡带你登上观星坡，指着一颗每夜都会偏离星轨的暗星。它落下的细砂能换一笔灵石，却总在伸手前熄灭。刹那间，你看懂星砂与掌心气息交换的位置；与此同时，那种福祸相随的直觉也让你知道，拦住它并不靠手快，而是要拿自己的余年添一次火。谢衡找来的星师把价格写得清楚：三年寿元，只换这一匣星砂与一次悟息的机会，不保证往后的仙途。坡下已有愿意收砂的商人，六枚灵石摆在案上。你可以成交，也可以留在坡上看一场不属于自己的流星。',
    speaker:'星师楚夜',dialogue:'三年就是三年，不会因为你今天觉得年轻，明天就能讨回来。想好了再伸手，我等你到天亮。',
    label:'付出三年寿元，截取星砂换六枚灵石',result:'你截住那一瞬的落光，将星砂交给等候的商人，得到六枚灵石。星轨的转折留下一分体悟，三年命损也清清楚楚落在此身。',
    effects:{cultivation:1,items:{stones:6}},costs:{days:1,lifeYears:3},
    alternative:'把手收回，只记住星光如何转折',alternativeResult:'星砂在半空熄灭。你没有得到那六枚灵石，也没有失去三年余寿；临走前，楚夜把今晚的星轨画给你看。',
  },
  {
    ids:['rootless','void-echo'],title:'无根之人照前尘',location:'石桥无影井',
    goal:'辨认前世残响，决定要花多少今生年月重建身外气脉',
    text:'井面照不出你的灵根，却映出一只属于前世的手。那只手曾在幽冥扶住过将散的魂灯，如今只剩掌纹在水底明灭。普通引气法找不到你的起点，前尘回响却能指出灵息从身体以外经过的地方。你可以在井旁住满三年，把这些游离的轨迹编成一条身外气脉；它不会直接赐给你境界，却能留下藏息与驭阵的诀窍。井旁卖茶的阿婆愿意借出空屋，租金由你每日修缮井栏抵付。眼前还有未走完的今生，你也可以只认一认那只旧手，便转身离开。',
    speaker:'井旁阿婆',dialogue:'认得前世的手，也得记得今日是谁在端茶。要住就认真住，要走就好好走，井不会替你把今生过完。',
    label:'用三年重建身外气脉，记住藏息与阵法',result:'三年里你把前尘里的方向逐步变成今生可练的气路，学会藏息与阵法，积下三分入门修为。水中的旧手终于不再牵动你的动作。',
    effects:{cultivation:3,skills:['conceal','formation']},costs:{years:3},
    alternative:'向前尘道别，沿今生的完整功法重新入门',alternativeResult:'你向井面道了声谢，收好行囊走向静院。前世仍是来处，今生的方法留待自己学成。',
  },
];

export const THRESHOLD_IDS = ['talent-first','talent-second','talent-pair','qi-study','route-crossroad',...['qi','foundation','golden','nascent','spirit','immortal'].flatMap(id=>[`${id}-gate`,`${id}-recovery`])];
const AFTER = {qi:'route-crossroad',foundation:'golden-harbor',golden:'nether-ferry',nascent:'sky-shadow',spirit:'immortal-silent',immortal:'crown-return'};
const NAMES = {qi:'炼气',foundation:'筑基',golden:'金丹',nascent:'元婴',spirit:'化神',immortal:'登仙'};
const GUIDES = {qi:'沈砚',foundation:'闻素',golden:'罗婶',nascent:'白汀',spirit:'观星人孟辞',immortal:'江迟'};

function pairScene(state) {
  const talents=state.life.birth.talentIds;
  const requires=talents.flatMap(id=>[{kind:'talent',id},{kind:'life-fact',id:`used-${id}`,value:true}]);
  const event=PAIR_EVENTS.find(row=>row.ids.every(id=>talents.includes(id)));
  if(event) {
    const combination=action(event.label,'qi-study',event.result,{...event.effects,lifeFacts:{'talent-combination':event.ids.join('+')},deed:event.title},event.costs,'combine',requires);
    combination.detail='须先亲自用过这两项命格；确认本次时间与身体代价后再尝试。';
    const ordinary=action(event.alternative,'qi-study',event.alternativeResult,{lifeFacts:{'pair-declined':true}},{days:2},'continue');
    ordinary.detail='保留自己的余年，沿原先的求仙之路继续。';
    return scene('talent-pair',event.title,event.location,event.goal,event.text,event.speaker,event.dialogue,[combination,ordinary]);
  }
  const [first,second]=talents;
  return scene('talent-pair','两条息流','石桥空仓','判断两项命格能否在同一件事上合作','石桥空仓的横梁正在缓慢下沉，几个孩子躲在梁下取不出藏好的书。仓主愿意拆梁，却找不到合适的支点。你回想刚才两次遭遇，发现自己天生的两处长短并不相同：一处能辨认变化，另一处能支撑行动或引来机会。若把它们同时用在一件事情上，也许可以让这根旧梁得到恰好的托举。但陌生的两股力会彼此牵扯，成功并不等于毫无代价。','仓主','孩子们已经退到墙边了。你若还没摸清自己的长处，咱们一起用木楔也能救这些书。',[
    action(`合用「${TALENTS[first].name}」与「${TALENTS[second].name}」`,'qi-study','两项命格接上了力，你救出书箱并获得新的体悟，肩臂也因此拉伤。',{cultivation:1,injury:1,items:{favor:2},lifeFacts:{'talent-combination':[first,second].sort().join('+')}},{days:10},'combine',requires),
    action('与仓主打木楔，逐寸托稳横梁','qi-study','你与仓主合作救出书箱，收下约好的工钱。',{items:{stones:2},lifeFacts:{'pair-declined':true}},{days:6},'continue'),
  ]);
}

export function thresholdScene(state) {
  const id=state.scene.nodeId;
  const attributes=state.life.birth.attributes??{constitution:4,insight:4,fortune:4};
  if(id==='talent-first'||id==='talent-second') {
    const index=id==='talent-first'?0:1,talent=state.life.birth.talentIds[index];
    const [name,place,text,speaker,dialogue,label,effects,costs]=TALENT_EVENTS[talent];
    const to=index===0?'talent-second':'talent-pair';
    const choices=[action(label,to,`你花去这段时间，将${name}变成一次亲自练过的本事。`,{...effects,lifeFacts:{[`used-${talent}`]:true}},costs,'talent-use',[{kind:'talent',id:talent}]),fork('先做些普通活，留下力气赶路',to,'你暂未尝试这项命格，用普通劳动换得两枚灵石。',{items:{stones:2}},{days:4})];
    let extra='';
    if(index===0&&attributes.fortune>=5) {
      extra='转身时，你又恰好瞥见夜市角落里一张压着旧护符的招工纸：替摊主守八天摊，护符便可作报酬。机会只等这一回，接下便要放过眼前练习命格的邀约。';
      const option=action('凭气运接住夜市机缘，守摊换护符',to,'你守了八天夜摊，拿到约定的护符；原先那次命格练习已经错过。',{items:{talisman:1}},{days:8},'fortune-cache');
      option.detail='气运达到5开启；获得一枚护符，但不算用过眼前命格，可能错过后面的双命格合用。';choices.push(option);
    }
    if(index===1&&attributes.insight>=5) {
      extra='你也能从眼前的变化里推演出另一种练法：不急着参与，而是用十日独自复盘，将呼吸与动作的破绽藏起来。这需要足够悟性，所得会偏向藏息，而非原先的报酬。';
      const option=action('凭悟性复盘变化，另练藏息法',to,'十日推演之后，你认清了这项命格如何改变动作，练得藏息与一分修为，也放下了原先的报酬。',{cultivation:1,skills:['conceal'],lifeFacts:{[`used-${talent}`]:true}},{days:10},'insight-study');
      option.detail='悟性达到5开启；练成藏息并亲试此命格，不领取原邀约的物品或其他法门。';choices.push(option);
    }
    return scene(id,`${name}的用处`,place,'亲手验证一项命格的长处，并选择愿意付出的时间',`${text}你刚从故乡的事情里脱身，行囊里还留着来时的物件。眼前的人等着答复，远处的渡船已开始收起缆绳；停留与赶路会带来不同的收获。${extra}`,speaker,dialogue,choices);
  }
  if(id==='talent-pair')return pairScene(state);
  if(id==='qi-study') {
    const choices=[action('住下练息，养伤一年','qi-gate','一年里你校正气息与身姿，伤势平复，入门修为终于扎实。',{cultivation:2,heal:3},{years:1}),fork('放慢步子，替静院修屋两年','qi-gate','你一面修屋一面练息，打稳根基、恢复身体，还换得一份人情。',{cultivation:2,heal:3,items:{favor:1}},{years:2})];
    let extra='';
    if(attributes.constitution>=5) {
      extra='沈砚看出你的根骨足以走一条更紧凑的路：以负重行气替代长坐，二百四十日便可打稳入门修为。不过这种练法只来得及恢复一分伤势，若带着内伤或重伤，不宜把省下的日子看成白得。';
      const option=action('凭根骨负重行气，用二百四十日入门','qi-gate','你以二百四十日的负重行气打稳两分修为，只恢复了一分伤势，余下的身体状态仍要自己留意。',{cultivation:2,heal:1},{days:240},'body-study');
      option.detail='根骨达到5开启；耗时较短，但只恢复一分伤势，突破仍需功法、修为与足够余寿。';choices.push(option);
    }
    return scene(id,'一息一灯','石桥静院','在突破之前练稳完整功法并准备身体','静院里，沈砚让你把完整功法放在灯下，从第一句重新读起。你曾以为自己已经理解的字，此刻配上呼吸竟又生出不同意味。天地灵气不会因为知道口诀便留在体内；急着提气，胸中反而像压上一块石头。沈砚演示到第三遍，你才终于辨出入息与运息之间那道细小的门。院里有供人长住的静室，也有需要修缮的旧屋。你可以用不同方式安排这段入门岁月，真正的突破仍在准备之后。'+extra,'沈砚','功法齐了，修为还得自己练。选一种身体承受得住的办法；什么时候能稳稳走完一周天，什么时候再来敲静室的门。',choices);
  }
  if(id==='route-crossroad') {
    const route=state.scene.fate.route;
    const rows=[['sect','赴青岑宗，向同门求学试剑','青岑宗'],['wanderer','去荒台，与散修合路寻法','荒台'],['alliance','登白帆船，与流离者结盟','白帆码头']];
    const choices=rows.map(([value,label,destination])=>{
      const favored=value===route;
      const option=action(label,`${value}-1`,`你接下${destination}的邀请，正式踏上这一条修行路。`,{lifeFacts:{route:value},...(favored?{items:{supplies:1}}:{})},{days:favored?3:8},`route-${value}`);
      option.detail=favored?'此世最先到来的邀请，接引尚在，可同行三日并获得一份行粮。':'另寻这条路的接引，须独自赶路八日。';return option;
    });
    return scene(id,'石桥上的三封信','石桥镇','选择宗门、散修或同盟，并承担各自的路费与年月',`引气入体以后，你第一次听见桥下石缝也有自己的呼吸。桌上放着三封邀请：青岑宗有剑术与山门纷争，荒台散修许照正在招人同行寻法，白帆同盟则向无处可去的人开放泊位。此世最早传来的线索是${{sect:'青岑宗',wanderer:'荒台散修',alliance:'白帆同盟'}[route]}，接引人还愿意等你三日并带上一份行粮。其他两条路也能选择，不过须独自花八日找到接引。门外的风已吹起信角，这一次，你要亲自决定向谁学道、与谁同行。`,'送信人','三个地方都有人肯教，也都有人会与你争。信我送到了，下一步你自己走。',choices);
  }
  const realm=id.split('-')[0],record=REALMS[realm];
  if(id.endsWith('-recovery')) {
    const injured=state.life.injury>0;
    const text=injured?'你在静室坐下，旧伤便截断了刚提起的气息。守门人替你把兵刃收在门外，留下一面能照见脸色的铜镜。过去赶路时被压下的疼痛，此刻终于要一处一处认真面对。疗养没有令你立刻复原的奇迹，只能用伸展、停息和反复尝试找回身体原本的节律。外面的局势仍会变化，但突破材料已经收好，这两年花在恢复身体上，至少能让你重新拥有决定是否进关的余地。':'你此刻身体无碍，却还想在突破前多留两年准备。静室的窗朝向山谷，每到清晨都有不同方向的风掠过门檐。你不再急着冲击关隘，而是把已经学会的行气法一遍遍复盘，确认自己何时该提气、何时该收势。守门人只在每日送饭时叩门，不用催促把这段时间填满。材料仍在行囊里，岁月则照常流过；额外的准备不会凭空变成修为，但能让你在再次进关前平静地核对自己的决定。';
    return scene(id,injured?'闭关之前先养伤':'闭关之前再调息',`${NAMES[realm]}关外`,injured?'让身体恢复到能承担突破的程度':'用真实年月复盘气息，再决定是否突破',text,GUIDES[realm],injured?'伤势恢复后再进关。若改变主意，也可以带着已经学会的本领过好余生。':'你身体已经准备好了。若仍想稳固心绪，就安心住下；两年仍会从自己的余寿中经过。',[action(injured?'静养两年，再回突破关口':'再调息两年，回到突破关口',`${realm}-gate`,injured?'两年里你耐心恢复旧伤，重新整理好突破行囊。':'两年的调息结束，你带着平稳的呼吸重新来到关口。',{heal:3},{years:2}),retirement(id)]);
  }
  const choices=[action(`闭关${record.minYears}年，突破${NAMES[realm]}`,AFTER[realm],`你耗尽本次积累的修为与突破材料，在${record.minYears}年闭关后踏入${NAMES[realm]}。`,{realm,lifeFacts:realm==='qi'?{'learned-manual':true}:{},deed:`以真实材料与年月突破${NAMES[realm]}`},{years:record.minYears,items:{[record.material]:1}},'breakthrough',[{kind:'cultivation',min:record.threshold},{kind:'injury-max',value:1}]),action(state.life.injury?'暂缓突破，先去静室养伤':'暂缓突破，再去静室调息',`${realm}-recovery`,'你收起材料，决定先多留一段准备时间。',{}, {days:1},'recover'),retirement(id)];
  return scene(id,`${NAMES[realm]}关`,`${NAMES[realm]}静室`,'确认修为、材料、伤势与寿元都足够，再决定是否突破',`你把这些年真正挣得的东西放在面前。修为是走过险路后仍能守稳的呼吸，材料来自与你相遇的人和亲手探过的地方。迈入${NAMES[realm]}，需要让旧有的行气方式重新排列，这件事不能靠一句决心完成。静室外有人替你守门，门内却只有你能判断身体是否准备好了。你逐一核对行囊，也核对自己还剩多少年。这次闭关若中途耗尽寿元，纵然离那道门只剩一线，也不会提前得到门后的寿命。`,GUIDES[realm],`至少闭关${record.minYears}年，修为须到${record.threshold}，材料也会消耗。伤势超过一分便先恢复；准备齐了，我替你守门。`,choices);
}
