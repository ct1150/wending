import {exactKeys} from './schema.js';
import {WORLD_TIERS} from './cultivation-rules.js';
import {tideWorkshop,validateBenches} from './tide-workshop.js';
import {resonanceNode,validateResonance} from './resonance.js';

// Each port has two fair tides. Boat space measures displacement including
// tools and personal effects. People here have already opted to travel.
const ports=[
 {
  name:'沉钟湾',title:'一口没响的钟',days:[3,4],landingHand:0,
  scene:'北山公簿的漆皮下夹着一张水浸的信。沉钟湾的钟楼塌进潮沟，外船听不到退潮信号。来信人附上一截麻绳，绳尾系着四片写有姓名的竹签。双潮过后是闭港季，只有这两条船能在泥滩上靠稳。港上请你通过传影水鉴一同核定舱单。',
  hand:'领桩人若乘头船，能钉牢浮桥，让末船多卸一格。',
  groups:[
   ['领桩人',2,'她把一截斜桩放上秤盘。那是浮桥的骨头，少带它一个人也能过，多带它却能让下一船往里靠半丈。','她在浅滩钉下斜桩，潮退时第一节浮桥没有倒。','她留在旧湾，把桩法教给等下一季的人。'],
   ['夜学的孩子和先生',2,'先生的箱子里只有一块裂掉的字板。孩子们自己点过名，愿意到对岸过冬；留下的人也有村舍收留。','字板在对岸新屋的墙上挂好。头一个字是孩子自己写的“湾”。','夜学搬进高坡上的粮仓，第一堂课改成辨潮。'],
   ['铜铆和绞盘',1,'船工把每颗铜铆塞进旧鞋底的孔。抵岸即可修绞盘，后面的船也能省下一副铁件。','船工在到港簿上按了铜印。下一处修船能凭这枚印借一副铁件。','绞盘留在湾口，旧船还得靠人挽绳。'],
   ['晒干的稻种',1,'种袋里还混着两颗去年收成时的小石头。守仓人坚持把它们带着，因为靠石头压出的凹痕能辨种袋的旧印。','对岸种圃留出第一块试田，木牌沿用种袋上的村名。','种子送回坡仓，等下一季再播。'],
  ],
 },
 {
  name:'中界白汀',title:'停在客籍上的姓氏',days:[5,6],landingHand:2,
  scene:'白汀的旧客籍按船登记。船解体后，簿上的四户仿佛也跟着消失。染匠把一张布浸入水鉴，靛蓝处显出磨掉的姓氏。新街肯给愿意搬来的住户留门，旧街也愿留下等修堤的人。眼下能办两次水上交接，没人肯让一张旧簿代替自己作决定。',
  hand:'若头船先送双刻尺，白汀能校准滩深，末船便能多靠一格。',
  groups:[
   ['两户染匠',2,'他们肯搬的是染槽和自家人，不肯把图样卖给给他们作保的行商。染槽占去的一格已算进舱位。','染槽旁添了两只刻有户名的铜盆，图样仍由织户自己保管。','染匠在旧街染出一条二十丈的蓝布，铺到公所门前，让人记得这两户还在。'],
   ['看桥的药师',2,'药箱底层塞满空瓶。药师要带上它们，回程时好给仍住在旧街的病人捎药。','药师在两岸各留一张方笺，桥上的铃便有了两端都认得的叫法。','旧街夜里仍有人能唤到药师，新街轮流派船来取方。'],
   ['一对双刻尺',1,'老尺按尺头算，新尺按尺尾算，二者差一个船钉。滩底的两列石记恰好能把差值对齐。','尺手把两种刻法一同刻回码头，白汀再不用临时猜水深。','两把尺仍在旧街，船户须逐次手量水线。'],
   ['客籍副页',1,'簿吏愿把副页送走，条件是读到“佚名”二字须留位置，由当事人后来自己补。','新街在副页边装了能添纸的活扣。空着的姓名仍等本人来填。','旧籍封进陶瓮，另在新街立了可补录的白纸名册。'],
  ],
 },
 {
  name:'上界照影台',title:'门开之后谁守灯',days:[7,9],landingHand:1,
  scene:'照影台的星门多年只许凭修为点名。新门开启时，先造门的匠户、后来观星的学徒和守着归路的人各自送来一份名单。众人约定两次试航，留守者也要有自己的回信处。水鉴上先映出来的是一张空凳，给此刻尚未来到堂上的人留着。',
  hand:'若守灯人与旧灯一同先到，末次试航可以照见一处暗泊，多出一格。',
  groups:[
   ['制门的匠户',2,'他们愿试走自己做的门，要求把尺寸留给台上的学徒，不能把手艺一并带走。','匠户在新岸试开第一扇门，台上保留一套能照样做出备件的尺寸。','匠户留台修门，新岸收到他们逐笔描出的样图。'],
   ['守灯人与旧灯',2,'灯里没有魂，灯芯只认风。守灯人招来的晚风能照亮出口下侧那道不入星图的石台。','旧灯照出门底的石台，夜里第一次有人看清自己的归路。','旧灯仍照着来路，门外的人以星影报平安。'],
   ['故乡的空信匣',1,'匣子里故意不装信。识字的与不识字的都可以在新家留下东西，等愿意回乡的人带回。','新岸门口摆着一个谁都能启封的信匣。第一件回信是一粒青梅核。','信匣留台接收来信，远行者各自选熟人捎带口信。'],
   ['能拆开的星盘',1,'学徒把盘拆成几片，发现背面刻着多年前走错的一条路。她想把错路也留在新图上。','新旧星盘同时记下错路的方向，后来者能亲眼辨认危险的那颗星。','学徒在上界原台校星，把未能随船送出的那半张图刻在台壁。'],
  ],
 },
];

const has=(mask,i)=>Boolean(mask&(1<<i));
const weight=(port,mask)=>port.groups.reduce((sum,g,i)=>sum+(has(mask,i)?g[1]:0),0);
const capacity=(port,chapter,tide)=>chapter.rig==='barge'?(tide===0?2:4):tide===0?3:2+Number(has(chapter.loads[0],port.landingHand));
const names=(port,mask)=>port.groups.filter((_,i)=>has(mask,i)).map(g=>g[0]).join('、')||'空船';

export function validateConvoy(v){
 exactKeys(v,['chapters','draft'],['benches','resonance']);
 if(!Array.isArray(v.chapters)||v.chapters.length>ports.length||!Number.isInteger(v.draft)||v.draft<0||v.draft>15)throw new Error('海路舱单无效。');
 for(const [i,chapter] of v.chapters.entries()){
  exactKeys(chapter,['rig','loads']);
  if(!['light','barge'].includes(chapter.rig)||!Array.isArray(chapter.loads)||chapter.loads.length>2||i<v.chapters.length-1&&chapter.loads.length!==2)throw new Error('潮期记录无效。');
  let sent=0;
  for(const [tide,load] of chapter.loads.entries()){
   if(!Number.isInteger(load)||load<0||load>15||tide===0&&!load||(load&sent)||weight(ports[i],load)>capacity(ports[i],chapter,tide))throw new Error('落印舱单无效。');
   sent|=load;
  }
  if(i===v.chapters.length-1&&v.draft&&((v.draft&sent)||chapter.loads.length===2||weight(ports[i],v.draft)>capacity(ports[i],chapter,chapter.loads.length)))throw new Error('候船名册无效。');
 }
 if(!v.chapters.length&&v.draft)throw new Error('尚未议定船型。');
 if(Object.hasOwn(v,'benches'))validateBenches(v.benches,v.chapters);
 if(Object.hasOwn(v,'resonance')){
  if(v.chapters[0]?.loads.length!==2)throw new Error('谱匣尚未随港信寄出。');
  validateResonance(v.resonance);
 }
}

export function convoyNode(state,menu,choice,actor){
 const v=state.events.convoy??{chapters:[],draft:0},chapter=v.chapters.at(-1);
 const complete=chapter?.loads.length===2;
 const index=v.chapters.length-(chapter&&!complete?1:0),port=ports[index],nodeId=state.events.node;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('river-back','收起海路公牍，回去整备','hub');
 const next=menu('convoy-book','查阅下一程海路','convoy-book');
 const training=menu('train-menu','安排修炼与突破','training');
 if(nodeId.startsWith('convoy-ear-')||nodeId.startsWith('convoy-concert-'))return resonanceNode(state,menu,choice);
 const ear=menu('ear-book','查看白汀符匠钟荻的听息谱','convoy-ear-book');
 const hasEar=state.life.cultivationProfile.worldTier>=1&&v.chapters[0]?.loads.length===2;
 if(nodeId==='convoy-result'){
  const p=ports[v.chapters.length-1],i=chapter.loads.length-1,load=chapter.loads[i],sent=chapter.loads.reduce((a,b)=>a|b,0);
  const lines=['第'+(i+1)+'次潮汛落印，历时'+p.days[i]+'日。到岸簿记为：'+names(p,load)+'。'];
  p.groups.forEach((g,j)=>{if(has(load,j))lines.push(g[3]);else if(i===1&&!has(sent,j))lines.push(g[4]);});
  return row(p.name+' · 到岸回信','读完来信，继续下一次交接',lines,[next,...(hasEar?[ear]:[]),back]);
 }
 if(!port){
  const ending=v.chapters.map((c,i)=>{
   const p=ports[i],delivered=c.loads[0]|c.loads[1];
   return p.name+'。头潮载了'+names(p,c.loads[0])+'，末潮载了'+names(p,c.loads[1])+'。'+(delivered===15?'这一港的四份请求都已办妥。':'留在原岸的是'+names(p,15^delivered)+'。');
  });
  return row('问川归航 · 两岸各有灯','三界海路已交还给沿岸的人',['某日清晨，水鉴里有个小孩问，最初的守闸人是哪一位。对岸的人翻出北山公簿，又有人翻出河簿。几处笔迹未必出自同一个人，却能一路找到写在水尺背面的第三道刻痕。',...ending,'你把水鉴放下时，另一岸也有人自去上灯。这一段问川行路到此合卷。'],[training,...(hasEar?[ear]:[]),back]);
 }
 const tier=state.life.cultivationProfile.worldTier;
 const remote=tier>index;
 if(nodeId==='convoy-arrival'){
  const arrived=state.lastReceipt?.cultivationResult?.check?.success;
  return row(arrived?'界外第一封信':'界渡折返','核对本次跨界的实际结果',[arrived?'传送已成。你在'+WORLD_TIERS[tier]+'重新接好水鉴，镜里起了不同的潮纹。':'这次跨界失败，你仍在'+WORLD_TIERS[tier]+'。已经耗去的材料与承受的伤势记在本回收据中，海路公牍保留原来的到港单。',...(arrived&&hasEar?['落脚处还寄存着一只谱匣。白汀符匠钟荻以前写给家人的信，夹在六件音器的图纸里。']:[])],[next,arrived&&hasEar?ear:training,back]);
 }
 if(tier<index){
  const destination=tier===0?'middle':'upper',name=tier===0?'中界清河城':'上界观星台';
  if(['convoy-board','convoy-board-notes','convoy-test-result'].includes(nodeId))return tideWorkshop(state,v,tier,menu,choice,row);
  if(nodeId==='convoy-cross')return row('界渡台', '下一站是'+name,['古阵与飞升均须达到对应境界并亲自支付材料。水鉴显示的是你此刻能尝试的道路，闭关、养伤或备料后仍可回来。'],[
   choice('sea-ascend','循正途飞升至'+name,'travel',actor(destination),'ascend',{next:'convoy-arrival',arrival:destination}),
   choice('sea-array','重启古阵前往'+name,'travel',actor(destination),'ancient-array',{next:'convoy-arrival',arrival:destination}),back,
  ]);
  return row('隔界的海图', '前往'+WORLD_TIERS[index]+'接续'+port.name,['来信署名为'+port.name+'。本界水鉴听不到那片潮声，须到当地核对航线。尚未送出的名单会留在公簿上。','你身在'+WORLD_TIERS[tier]+'，下一站是'+name+'。界渡行有一份校阵委托，验收后支付副盘与古阵渡费。也可以自备材料启程。'],[menu('work-board','查看界渡行的校阵工台','convoy-board'),menu('cross-menu','查看跨界条件与资用','convoy-cross'),back]);
 }
 if(remote&&nodeId==='convoy-book'){
  return row(port.name+' · 旧港来函','决定是否从'+WORLD_TIERS[tier]+'委托港上船工',['回传水鉴亮起，照见'+port.name+'的船埠。你已越过这一重界门。岸上的工头愿意代办装船，把各家竹签逐张映给你看；你在此界听取请托，确认工期和资用后才能发船。','铁件可向本界的界渡行交割，旧港凭单领料。船走几天，回信也要几天。未落印的舱单仍可回来再议。'],[menu('commission','接通回传水鉴，委托本港船工','convoy-remote'),back]);
 }
 if(!chapter||complete){
  const previous=v.chapters.at(-1),toolLoan=index===1&&has(previous.loads[0]|previous.loads[1],2);
  const expert=state.life.cultivationProfile.arts.forging>0;
  const fit=(rig,key,label,target,items,days)=>choice(key,remote?'委托船工'+label:label,'explore',target,'cautious',{next:'convoy-plan',patch:{convoy:{...v,chapters:[...v.chapters,{rig,loads:[]}],draft:0}},rule:{days,items}});
  return row(port.title,'为'+port.name+'选定两次潮汛的船型',[port.scene,port.hand,'轻舟头潮三格、末潮两格；重驳头潮两格、末潮四格。第一潮出港后不能换船。'+(toolLoan?'沉钟湾绞盘已经到岸，船工肯借你装驳的铁件。':expert?'你能用自己的器道手艺整修旧铁件。':'装重驳需自备一份玄铁。')],[
   fit('light','rig-light','用两日备轻舟','supplies',{},2),fit('barge','rig-barge','用四日装重驳','iron',toolLoan||expert?{}:{iron:1},4),back,
  ]);
 }
 const tide=chapter.loads.length,cap=capacity(port,chapter,tide),used=weight(port,v.draft),sent=chapter.loads[0]??0;
 const stamp=(remote?'回传水鉴 · ':'')+port.name+' · '+(tide===0?'头潮':'末潮')+'　已排 '+used+' / '+cap+' 格　'+names(port,v.draft);
 const manifest=menu('manifest','合起签条，回到舱单','convoy-plan');
 const weigh=menu('weigh','核对落印与到港日期','convoy-check');
 if(nodeId==='convoy-crew'||nodeId==='convoy-stores'){
  const start=nodeId==='convoy-crew'?0:2,lines=[stamp],options=[];
  for(let i=start;i<start+2;i++){
   const [name,size,detail]=port.groups[i],aboard=has(v.draft,i),delivered=has(sent,i);
   lines.push(name+'（'+size+'格）。'+detail+(delivered?'头潮已到岸。':aboard?'已经列入本潮。':used+size>cap?'余位不足，可以先撤下别的签。':''));
   if(!delivered&&(aboard||used+size<=cap))options.push(menu('load-'+i,(aboard?'撤下':'列入')+name,nodeId,{convoy:{...v,draft:v.draft^(1<<i)}}));
  }
  return row(start?'货栈的两份寄托':'船埠的两份请托',port.hand,lines,[...options,manifest,...(options.length===0?[weigh]:[])]);
 }
 if(nodeId==='convoy-check'){
  const loads=[...chapter.loads,v.draft],updated={...v,chapters:[...v.chapters.slice(0,-1),{rig:chapter.rig,loads}],draft:0};
  const lines=[stamp,'这一船需'+port.days[tide]+'日。出港即照此单记入公簿，余下位置随这一潮过去。'+(tide===0?'头潮至少要载一份请托。':'没有合适的余位时也可让末船空载收航。')];
  if(tide===1)lines.push('两潮后仍会留在原岸：'+(names(port,15^(sent|v.draft))==='空船'?'无':names(port,15^(sent|v.draft)))+'。');
  return row('船印落下之前','核准所载和留岸的人物资用',lines,[...(v.draft||tide?[choice('sail',remote?'落印委托港工照单发船':'照此舱单发船','explore','stones','cautious',{next:'convoy-result',patch:{convoy:updated},rule:{days:port.days[tide]}})]:[]),manifest,back]);
 }
 return row(port.name+' · 潮前排舱',port.hand,[stamp,port.hand,'可在出港前调整各签。请托者已经同意启程，货和随身工具也占舱位。'],[menu('crew','听人请托，安排同行者','convoy-crew'),menu('stores','查货栈，安排托运','convoy-stores'),weigh]);
}
