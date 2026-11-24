import {exactKeys} from './schema.js';
import {V7_REALMS} from './actor-insight.js';

export const openingNodes = [
 'prologue-departure','prologue-stele','prologue-gate','prologue-terms',
 'prologue-work','prologue-work-talk','prologue-road','prologue-road-talk',
 'prologue-flood','prologue-camp','prologue-result','prologue-summary',
];

export function openingEntities(prefix){
 return [
  {id:prefix+'mother',name:'母亲',kind:'person',status:'alive'},
  {id:prefix+'liang',name:'梁三娘',kind:'person',status:'alive'},
 ];
}

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
 const beforeRoute=['prologue-departure','prologue-stele','prologue-gate','prologue-terms'].includes(node);
 const afterWater=!['prologue-departure','prologue-stele','prologue-gate','prologue-terms','prologue-work','prologue-work-talk','prologue-road','prologue-road-talk','prologue-flood'].includes(node);
 if((beforeRoute?entry!=='unresolved':!hasRoute)||
    ['prologue-work','prologue-work-talk'].includes(node)&&entry!=='joined'||
    ['prologue-road','prologue-road-talk'].includes(node)&&entry!=='declined'||
    (afterWater?!['canal','houses'].includes(p.water):p.water!==null)||
    (node==='prologue-summary'||!inOpening?!['accepted','declined'].includes(p.help):p.help!==null)||
    life&&inOpening&&(!['mortal','qi'].includes(life.realm)||
      node==='prologue-summary'&&life.realm!=='qi'||
      !['prologue-result','prologue-summary'].includes(node)&&life.realm!=='mortal')){
  throw Error('重构开篇的章节状态无效。');
 }
}

export function campaignOpening(state,menu,choice,actor){
 const {events:e,life}=state;
 const apprentice=e.entry==='joined';
 const savedCanal=e.prologue.water==='canal';
 const n=text=>({kind:'narration',text});
 const d=(who,text)=>({kind:'dialogue',speaker:actor(who),text});
 const row=(title,goal,blocks,choices,loc)=>({
  title,goal,location:loc??(e.node==='prologue-departure'||e.node==='prologue-stele'?'石溪村':'栖云山脚'),
  blocks,choices,
 });
 const action=(key,label,intent,target,approach,next,rule,patch)=>choice(key,label,intent,target,approach,{next,rule,patch});
 const motherId='mother',stewardId='steward',linId='companion',liangId='liang';

 switch(e.node){
 case 'prologue-departure':
  return row('石溪村 · 临行','趁山雨稍歇，动身前往栖云山',[
   n('卯时刚过，石溪村的屋檐还在滴着昨夜的浑水。灶膛里余火将熄，潮湿的松柴冒出一股呛人的青烟。母亲把两块烙得发硬的麦饼撕成四瓣，裹进一层发黄的油纸里，又用麻绳勒了三道死结，才塞进你怀里。'),
   n('你摸到饼还温着，想掰半块留回碗柜，手刚缩回一半，便被她按住手背。她指节粗大，虎口一道前年劈柴留下的老疤泛着白。'),
   d(motherId,'揣紧了。你爹早年去镇上背盐，走到半道饿得发慌，拿命换了半碗冷水喝。外头那些仙师老爷，听着体面，肚子饿起来一样要吃五谷。等你真在山里立住了脚，再说往家捎东西的话。'),
   n('门外传来竹竿戳泥的声响。昨夜一场山洪把村口的老木桥掀了半边，几个壮汉光着膀子在溪滩里捞桥板。有人掀开一块烂松木，惊呼木背上烙着栖云门的云纹铁印——那是十年前山上下来采石时，顺手替村里搭的便桥。'),
   n('抬头往东北望，云雾压得很低，栖云山外院的青瓦檐角在湿气里若隐若现。溪水漫过半截石磴，再磨蹭下去，怕是连山脚的泥道都要断。村口那株老槐树下，还立着一块早年仙师留下的残碑，平日里没人敢凑近细看。'),
  ],[
   action('leave-village','背起包袱，趁水未封路沿溪上山','explore','supplies','cautious','prologue-gate',{days:1}),
   action('help-bridge','留一日帮乡邻打桩抢桥，明日再走','explore','herbs','cautious','prologue-gate',{days:2,gain:{herbs:1}}),
   menu('visit-stele','绕到村口老槐下，细看那块仙门残碑','prologue-stele'),
  ],'石溪村');

 case 'prologue-stele':
  return row('老槐树下 · 仙门残碑','认清山外世界的规矩，再动身上路',[
   n('老槐树被雷劈去半边树冠，剩下的枯枝挂着几缕褪了色的红布条。树根下那方青石碑歪了一角，碑面被雨水冲得发滑，上面凿着七八行早已生了青苔的楷字。你蹲下身，拿袖口擦去泥浆。'),
   n('碑文落款是六十年前的栖云门外院。头两行写着「凡入我栖云者，不论寒门贵胄，唯灵根心性是问」，可往下细看，末尾却另有一行极浅的刻痕，像是后来某个落选的过客拿铁钉硬刮上去的——「灵根下品，杂役十年，寿尽归尘，莫信画饼」。'),
   n('树后忽地传来一声干咳。村里采药的瘸腿老陈背着竹篓走过来，朝碑脚吐了口唾沫，咧开豁了牙的嘴笑了一声。'),
   n('老陈压低嗓子道：「小子，真要去撞那扇山门？前头石溪村出去过三个后生。头一个折在药山瘴气里，第二个给人当了二十年挑水杂役，前年背着一口破箱子回来，没熬过腊月就咽了气。唯独第三个，听说摸到了炼气的门槛，从此连封信也没往村里寄过。」'),
   n('他往你手里塞了一截晒干的避瘴艾草，摆摆手自顾自往坡下去了。山风刮过槐叶，哗啦啦响成一片。碑上那两拨字，一边是仙门高悬的匾，一边是凡人刮出的血槽。你拍了拍膝上的泥，重新把包袱绳系紧。'),
  ],[
   action('leave-village','不再耽搁，背起包袱沿溪上山','explore','supplies','cautious','prologue-gate',{days:1}),
   action('help-bridge','去溪边帮村人打完桥桩，明日启程','explore','herbs','cautious','prologue-gate',{days:2,gain:{herbs:1}}),
  ],'石溪村 · 老槐下');

 case 'prologue-gate':
 case 'prologue-terms':
  return row('栖云山脚 · 两条入门路','决断入外院换取吐纳功法，还是去渡口另寻门径',[
   ...(state.lastReceipt?.action?.id.endsWith(':c:help-bridge')?[n('临走那天你跟着乡邻在冷溪水里泡了半宿，总算把头两根杉木桩砸进河床。清早跨桥进山的采药老汉认出你，二话不说从篓里抓出一把带着露水的青叶灵草塞进你衣襟，说是留着路上救急。')]:[]),
   n('栖云门外院的石阶修得极陡，青石板上苔藓滑脚，两侧木栏被历年挑柴人的扁担磨得发亮。山门牌坊下支着一张缺了角的长案，案后坐着个穿灰布道袍的中年管事。他眼皮耷拉着，手里盘着两颗油黑的核桃，连头也没抬，只拿笔杆敲了敲摊开的杂役簿。'),
   d(stewardId,'石溪村来的？今年山洪冲塌了东坡药圃的石渠，外院正缺手脚麻利的苦力。我周伯衡丑话说在前头：外院不养闲人，也不白发功法。落了名，替药圃清三日泥沟、分好药苗，第三天傍晚我给你一卷完整的《引气吐纳真解》。'),
   n('旁边几个早到的少年听见「完整功法」四字，眼睛顿时亮了，争着往前挤。唯有角落里一个瘦高个少年低着头，把一只干瘪的粗布袋攥得死紧，迟迟不敢往前递名帖。'),
   ...(e.node==='prologue-terms'
    ?[
     d(stewardId,'你倒精明，还敢先问章程？行，我告诉你——三日里只管清沟、搬石、扶苗，不叫你试药，也不克扣你自带的干粮。三日满，功法拿走，想留外院继续熬年头拿月例，还是拍拍屁股滚蛋，随你。至于以后能修成个什么玩意儿，那是你自己的造化，别指望我老周替你兜底。'),
     n('周执事嗤笑一声，把毛笔往砚台里一蘸，目光瞥了你一眼，似乎觉得这寒村小子比旁人多长了个心眼。'),
    ]
    :[
     n('人群外，一个挑炭下山的老脚夫路过你身侧，拿肩膀轻轻碰了你一下，压着嗓子嘀咕：「栖云门外院的杂役房里，三年能摸到炼气门槛的十个里挑不出一个。山下老渡口有个独臂老舟户叫梁三娘，年轻时混过散修坊市，她那条破渡船底下，刻着早年路过的高人留下的吐纳法门。去不去，你自己掂量。」'),
    ]),
  ],[
   menu('join-gate','在杂役簿上落名，接下三日药圃差事','prologue-work',{entry:'joined'}),
   menu('take-road','谢过周执事，转身下山去老渡口寻路','prologue-road',{entry:'declined',location:'retreat'}),
   ...(e.node==='prologue-gate'?[menu('ask-terms','按住性子，先问清差事章程与去留规矩','prologue-terms')]:[]),
  ],'栖云门外院');

 case 'prologue-work':
  return row('外院药圃 · 泥沟里的第一口气','熬过外院杂役，摸到吐纳门径',[
   n('东坡药圃比山下冷得多。山洪退去大半，石渠里却淤着齐膝深的黑泥，混着烂树根和碎药渣，踩进去拔脚都费劲。周执事丢给你一把豁了口的铁锹，指了指泥沟尽头便背着手踱回屋里烤火去了。'),
   n('渠边已经站着一个人，正是刚才在登记处攥着空布袋的瘦高少年。他裤脚卷到大腿根，小腿冻得发紫，正咬着牙往岸上甩泥。见你下来，他抹了把脸上的泥点，把一根削尖的木桩递给你。'),
   d(linId,'我叫林砚，比你早来半个月。别听外院那帮老油条糊弄，拿蛮力挖这黑泥，半个时辰腰就得废。你看我手腕——起锹的时候吸气沉到脐下，甩泥的时候松腕吐气，把铁锹当船篙使，力气才顺得下去。'),
   n('你照他的法子试了两锹，果然觉得胸口那股憋闷散开几分，隐隐有一丝极细的凉意顺着小臂窜回丹田。'),
   n('往上游走了十来步，你发觉泥沟之所以淤得厉害，是因为前头石涵洞被一块塌下来的青石板堵死了一半。老老实实沿着渠壁清三天泥，稳妥却熬人；若是冒险钻进湿滑的涵洞口，咬牙把那块青石挡板抬开泄水，工期能省下一日，可手腕筋骨吃不住劲的话，少不得要伤元气。'),
  ],[
   action('work-bank','照林砚的法子稳扎稳打，清沟三日打牢吐纳','practice','self','steady','prologue-flood',{days:3,cultivation:1}),
   action('lift-sluice','咬牙硬抬涵洞青石板，提前泄洪省工','practice','self','intensive','prologue-flood',{days:2,cultivation:1,spiritCost:7}),
   menu('talk-linyan','趁歇气的空当，向林砚打听外院的底细','prologue-work-talk'),
  ],'外院药圃');

 case 'prologue-work-talk':
  return row('药圃石棚 · 雨歇夜谈','从同病相怜的杂役口中摸清外院真相',[
   n('午后又飘起一阵牛毛细雨，你和林砚躲进药圃边的漏雨茅棚。林砚从怀里摸出半块硬邦邦的杂粮馍，掰了一小角啃着，眼睛却一直盯着山腰云雾里露出的内门飞檐。'),
   d(linId,'别看周执事嘴上刻薄，外院这几个管事里，他反倒算讲究的。前头王管事手底下，上个月有个杂役偷摘了半株赤血草，直接被打断两条腿丢下山，连尸骨都没让人收。'),
   n('他压低了声音，指了指自己空荡荡的布袋，自嘲地扯了扯嘴角。'),
   d(linId,'我测出的是五行伪灵根，灵气吸进去十成漏掉九成半。外院教习连正眼都不瞧我，只说让我老实种地，攒够十年功德换一颗下品聚气丹。可十年……咱俩今年才十六，再过十年，连筑基的边都摸不着吧？'),
   n('棚外雨点砸在芭蕉叶上噼啪作响。林砚揉了揉冻红的手指，低声道：「不过我偷偷瞧过周执事的功法木箱。他答应给的那卷《引气吐纳真解》倒真是正经货，不像坊市地摊上卖的残篇。只要拿到手，咱俩就算真正跨进门缝了。」'),
   n('雨势渐小，渠水又涨了半寸。你们各自抄起铁锹，得决定怎么干完这趟活。'),
  ],[
   action('work-bank','稳扎稳打，跟林砚沿渠清沟三日','practice','self','steady','prologue-flood',{days:3,cultivation:1}),
   action('lift-sluice','趁雨歇钻进涵洞，合力硬抬挡水石板','practice','self','intensive','prologue-flood',{days:2,cultivation:1,spiritCost:7}),
  ],'外院药圃');

 case 'prologue-road':
  return row('石溪老渡口 · 水线下的刻痕','寻访独臂舟户，拓取散修吐纳法门',[
   n('沿着泥泞山径往下走，雾气越来越重，扑面而来的是河滩腥冷的水汽。老渡口只剩一条漆皮剥落的乌篷船拴在烂木桩上。船头坐着个穿靛蓝粗布袄的妇人，左袖空荡荡地别在腰带里，单手把一根丈余长的竹篙盘得飞转，嘴里叼着一杆快灭的旱烟袋。'),
   n('听见脚步声，她斜眼上下扫了你两遍，鼻子里哼出一口白烟。'),
   d(liangId,'栖云门外院没留你，还是你自己嫌那帮牛鼻子势利？我叫梁三娘。你要看这破船底下当年那位怪道人刻的吐纳法，行啊——天底下没有白捡的便宜。山洪下来了，帮我把船撑到旧桥墩背水湾拴牢，退潮时水线露出那八个字，你自己抄去。'),
   n('她拿烟杆往河湾上游一指：「还有半篇引气口诀刻在对岸废滩的石壁上。自己涉水绕背水湾走过去，泥深水急，得耗上四天脚程，还得费神护住心口那点热气；舍得拿出一份行粮，滩头那摆短渡的李瞎子肯撑筏子载你抄近道，一天就能到。」'),
  ],[
   action('follow-water','咬牙省下行粮，沿背水湾徒步四日拓字','explore','manual','cautious','prologue-flood',{days:4,spiritCost:5}),
   action('buy-passage','付一份行粮给摆渡人，趁涨水前抄近道过滩','explore','manual','bold','prologue-flood',{days:1,items:{supplies:1}}),
   menu('talk-liang','不急着上船，先问问梁三娘当年何以断臂退隐','prologue-road-talk'),
  ],'石溪老渡口');

 case 'prologue-road-talk':
  return row('老渡口乌篷下 · 散修旧事','听老舟户讲宗门与散修的残酷底色',[
   n('梁三娘把旱烟袋在船帮上磕了两下，倒出一点火星。她看着自己空荡荡的左袖，眼神冷得像冬天的河水。'),
   d(liangId,'问这个作甚？看我笑话？二十年前我也是炼气七层的散修，在青石坊替人跑腿护镖，攒了整整八年灵石，就差半步摸到筑基的门。后来进一处古修荒冢探宝，同行的两个大宗弟子笑着叫我梁师姐，转头就在石门前拿阵旗阴了我一把。'),
   n('她抬起完好的右手，掌心一道焦黑的雷纹伤疤触目惊心。'),
   d(liangId,'我自断一臂才从那死阵里爬出来，丹田裂了缝，这辈子别想再进半步。小子，我提醒你一句：进了修仙界，宗门弟子讲体面，吃起人来却比山里的豺狼还狠；散修看着自由，可没靠山、没灵脉，连买一瓶正经丹药都要提防是不是黑心货。'),
   n('她把船缆往你怀里一抛，嘴角带了点冷笑：「怕了就趁早滚回石溪村娶媳妇种地。不怕，就赶紧选条路去拓字，别在这儿耽误老娘躲水。」'),
  ],[
   action('follow-water','省下口粮，自己绕背水湾走四日去拓残字','explore','manual','cautious','prologue-flood',{days:4,spiritCost:5}),
   action('buy-passage','交出一份行粮，请摆渡人撑筏抄近道','explore','manual','bold','prologue-flood',{days:1,items:{supplies:1}}),
  ],'石溪老渡口');

 case 'prologue-flood':
  return row('石溪下游 · 山洪压闸','洪水漫堤，必须在山渠药田与低岸民居之间决断',[
   n('入夜后，上游雷声闷响，真正的山洪到底还是砸了下来。浑浊的黄水裹着断木滚过石滩，发出闷雷般的轰鸣，水头眼看就要漫过下游的分水石堰。'),
   ...(apprentice
    ?[
     n('林砚浑身湿透，手里死死拽着绳索站在渠沿。山腰外院的执事们早躲回高处石楼，只派人扔下一块开闸木牌。下面的几个杂役和山户急红了眼，都以为木牌在林砚手里，冲着他破口大骂。可林砚却反手把沉甸甸的木牌按进你掌心，声音发抖。'),
     d(linId,'周执事刚才托人传话了——先保山渠，东坡三百亩药苗能保住，但低岸那两户山民的土屋今夜必淹；若是拉起溢洪口让水绕开民居，低岸的房子能保住，大半畦灵药苗却要全毁。人都能提前喊出来往高处跑，可田和屋，绝来不及一起救！这牌子你拿主意，我听你的！'),
    ]
    :[
     n('你刚把湿漉漉的拓片揣进怀里，梁三娘便拽着你奔到分水石堰前。雨水糊了满脸，她单手撑住一根歪斜的闸杠，朝下游昏暗的灯火扬了扬下巴。'),
     d(liangId,'瞧见没？左边是栖云门外院的引水山渠，右边低滩住着两户靠编篾活命的苦哈哈。人喊得出来，死不了；可山洪不长眼，闸口只够泄一边！保山渠，宗门药田无恙，那两户人家的破屋今夜就得冲塌；泄向山渠保民居，外院执事准得气得跳脚。小子，你不是想修仙吗？先学学怎么背这笔账吧！'),
    ]),
   n('怒涛拍打石堰，木闸嘎吱作响，再迟半刻，整座分水堰都要溃口。手里的闸杠冰冷刺骨，这一拉，就是你踏入仙途后的头一桩因果。'),
  ],[
   action('save-canal','压死溢洪闸先保山渠，冲去帮低岸人家抢搬家当','practice','self','steady','prologue-camp',
    {days:2,spiritCost:4,cultivation:apprentice?1:2,gain:{manual:1}},{prologue:{water:'canal',help:null}}),
   action('save-houses','拼力拉起溢洪口泄洪护住低岸民居，任急水冲垮山渠','practice','self','intensive','prologue-camp',
    {days:5,spiritCost:8,cultivation:apprentice?1:2,gain:{manual:1}},{prologue:{water:'houses',help:null}}),
  ],'石溪分水堰');

 case 'prologue-camp': {
  const rest=choice('prologue-rest','闭目调息，等伤痛与疲惫平复再动','rest','self','recover',{next:e.node});
  const retry=!life.items.manual
   ?action('restore-copy',apprentice?'回外院药圃向林砚借抄残缺的引气页':'按记忆循老渡口旧拓片重补引气口诀','explore','manual','cautious',e.node,
    {days:apprentice?12:24,gain:{manual:1}})
   :null;
  const next=life.cultivation<V7_REALMS.qi.threshold
   ?action('settle-breath','在石屋静坐一季，把散乱真气理顺','practice','self','steady',e.node,{days:90,cultivation:1,spiritCost:5})
   :choice('first-breakthrough','锁紧木门，依引气页正式闭关冲击炼气','practice','qi','breakthrough',{next:'prologue-result'});
  return row('溪边石屋 · 破凡入炼气','调匀气息，跨过凡人到修士的第一道生死槛',[
   savedCanal
    ?n('山渠终究保住了。那夜你在齐腰深的浑水里替低岸两户人家抢出两口湿透的木箱和几袋糙米，把人安顿进高处的破祠堂。雨停后，两家妇人把湿被褥一路晾到了你借宿的石屋窗外，路过时眼神复杂——既有谢意，也有望向废墟时的木然。')
    :n('低岸那两间土坯房硬生生从洪峰口里抢了下来。代价比预想中惨烈：东坡药圃冲垮了半边，周执事黑着脸罚了外院杂役整整半月苦工。林砚领着人每天提着空竹篮补种药苗，路过你石屋窗下时，朝里头扔了两根烤红薯，什么也没说。'),
   retry
    ?n('上回冲关功亏一篑，那页沾满汗渍的引气法诀也在气血逆冲时浸烂了墨迹。口诀虽还记得个大概，但经脉行气差之毫厘便会走火入魔，冲关前必须把残缺的次序补抄齐全。')
    :n('夜深人静，你在石屋桌上点起一豆油灯，把来之不易的引气法页摊平。纸页边缘还留着泥水和汗斑。法诀头一句写得森冷：「凡胎肉体，如漏底破舟；引气入脉，如烈火锻铁。成则跳出百岁枯骨，败则经裂吐血。」屋外虫鸣渐歇，今夜便是你真正叩问长生门槛的时刻。'),
  ],[...(retry?[retry]:[]),next,rest],'溪边石屋');
 }

 case 'prologue-result':
  if(life.realm==='mortal')return row('溪边石屋 · 冲关挫败','稳住逆冲气血，重整旗鼓再叩仙门',[
   n('那股好不容易聚拢的灵气才冲到胸口横骨，便像撞上一堵无形铁壁，骤然炸散！喉头一甜，一口腥热淤血喷在膝头摊开的引气页上，把墨字彻底晕成一团黑污。'),
   n('你在冰冷的石地上蜷了足足半个时辰，浑身冷汗浸透中衣，耳边嗡嗡作响。窗外天光微亮，你还活着。凡人引气入体，十人里头一回便成的不到两三个——只要筋骨未废，调养好伤势、补齐法页，这扇门照样还能再撞一次。'),
  ],[
   menu('try-again','撑起身子回石屋清点所缺，准备再试','prologue-camp'),
   choice('recover-first','先服气静养调息，压下经脉痛楚','rest','self','recover',{next:'prologue-camp'}),
  ],'溪边石屋');
  return row('溪边石屋 · 炼气初成','初入炼气境，了结石溪旧情再赴广阔天地',[
   n('不知过了多少个昼夜，丹田深处忽然“啵”地一声轻响，仿佛冰封百年的冻土裂开了一道细缝。刹那间，石屋外风声、虫声、甚至十丈外溪水流过鹅卵石的每一丝微颤，竟全清清楚楚映入灵台！'),
   n('你推开吱呀作响的木门，晨光照在掌心，皮肤下隐隐流转着一层极淡的灵光。从今日起，你不再是那个只能靠力气刨食的寒村少年——你是炼气一层修士，寿元百二十载，真正踏上了问鼎仙途的第一级台阶。'),
   savedCanal
    ?n('石门外，周执事竟亲自提着个布包等在坡下。他上下打量你一番，难得收起了往日那副刻薄神色，把两枚晶莹微凉的下品灵石抛进你怀里。')
    :n('石门外站着低岸那两户山户的当家人。见你推门而出，两人局促地搓着手，把两只塞得鼓鼓囊囊的粗布粮袋放到石阶上，袋里装着炒熟的干米、腊肉和几张厚油纸。'),
   savedCanal
    ?d(stewardId,'行啊小子，居然真叫你摸进炼气门槛了。山渠保住后，这几年药圃又多熬过两场汛。上头拨了笔修渠赏钱，我没克扣你的那份，两块灵石拿好。以后在外头混，别说是栖云门亏待了你。')
    :n('领头的老汉红着眼眶低声道：「仙师，咱们乡下人拿不出灵石，只有这点耐放的干粮。当年要不是您拉了那道溢洪闸，我们这两家老小早就流落外乡了。门框上那道防汛红刻，往后年年汛前我都替您补新漆。」'),
   n('灵石也好，行粮也罢，都是沉甸甸的人情。收下它们能解你初入江湖的燃眉之急；留给他们，便算两清尘缘，轻装远行。'),
  ],[
   action('take-help',savedCanal?'收下两枚灵石，记下周执事这份人情':'收下两份行粮，记住低岸门上的红刻','rest','self','recover','prologue-summary',
    {days:1,gain:savedCanal?{stones:2}:{supplies:2}},{prologue:{...e.prologue,help:'accepted'}}),
   menu('go-alone','拱手婉拒，将资用留给山脚水边人','prologue-summary',{prologue:{...e.prologue,help:'declined'}}),
  ],'溪边石屋');

 case 'prologue-summary':
  return row('第一章 · 山雨既歇，仙途启程','走出石溪村，踏入风波暗涌的下界修仙界',[
   n((savedCanal?'山渠口的石闸历经几场大汛仍稳稳立着，溪边老桥也架起了新木梁。':'低岸民居门框上的红刻漆了一遍又一遍，东坡冲毁的药畦也重新长出了绿油油的新苗。')+
    (e.prologue.help==='accepted'?'怀里沉甸甸的资用带着故乡最后一丝温热，你回头望了一眼云雾缭绕的石溪村，把这幅山河刻进了心底。':'你把递来的包袱推了回去。走出这片山坳以后，山下的烟火便再也追不上修士的脚步了。')),
   ...(apprentice
    ?[
     n('林砚送你一直走到外院石桥头。几年不见，他眼角已多了几道风霜细纹，袖口沾着洗不掉的药汁，却仍把那股倔劲藏在眉宇间。他塞给你一卷泛黄的《问川图》抄本，又压低声音凑近半步。'),
     d(linId,'外头传消息说，下游青石坊鬼市最近出了桩怪事，竟有人在暗巷里兜售咱外院失窃的古简，还死了两个散修。你如今进了炼气境，手头比我宽裕，若下山历练，千万提防清河谢家的人——他们吃相难看得紧！'),
    ]
    :[
     n('梁三娘依旧坐在那条乌篷船头抽旱烟，听见你的脚步声，头也不回地把一卷用油布裹好的《问川图》甩上岸。'),
     d(liangId,'成了炼气修士，胆子也别太肥。下游青石坊最近不太平，听说鬼市里冒出个叫陆三指的掮客，拿假丹和栖云门旧简钓了不少散修的命。想在三界混出个名堂，顺着水路去闯闯吧——活着回来，请老娘喝一壶好酒。'),
    ]),
   n('长风吹散山腰残雾，前方青石官道直通茫茫江湖。山门主线的暗涌、问川旧图的奇遇、还有属于你自己的百世修仙路，此刻才真正拉开帷幕。'),
  ],[
   menu('campaign-book','循着青石坊风声，翻开「三界主线」','campaign-book'),
   menu('chapter-river','先沿溪下游去，展开《问川图》历练','river-book'),
   menu('chapter-out','先回山居清点行囊，从长计议','hub'),
  ],'栖云山外石桥');
 }
 throw Error('未识别的开篇场景。');
}
