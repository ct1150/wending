import {sha256} from './identity.js';
import {DAYS_PER_YEAR,ITEMS} from './model.js';
import {realmFor,nextRealmFor,TECHNIQUES} from './cultivation-rules.js';
import {riverNode} from './river-chronicle.js';
import {expeditionNode,expeditionResult} from './expedition.js';
import {councilHearings,councilNode} from './mountain-council.js';
import {convoyNode} from './sea-convoy.js';
import {valleyLocation,valleyNode,valleyPlaces} from './mist-valley.js';
import {inscriptionText,watchNode} from './retreat-watch.js';
import {trailLocation} from './deer-trail.js';
import {mineNode,minePlaces} from './lamp-mine.js';
import {gardenNode,gardenRootName} from './phenology.js';
import {postNode,postNotice} from './lin-post.js';
import {mountainNode,mountainHistory} from './folded-mountain.js';
import {shellNode,ferryForMaterial} from './shell-ferry.js';
import {materialHunt} from './material-hunt.js';
import {echoWell,wellDepartures} from './echo-well.js';
import {cloudPassage} from './cloud-passage.js';

// Authored situations supply every fact and executable choice. AI never edits
// these definitions. Stable actors belong to a life, not a generated paragraph.
export function eventEntities(state){
 const prefix='r:'+sha256(state.runId).slice(0,16)+':t1:e:';
 return [
  {id:prefix+'steward',name:'周执事',kind:'person',status:'alive'},
  {id:prefix+'companion',name:'林砚',kind:'person',status:'alive'},
  {id:prefix+'mentor',name:'顾师叔',kind:'person',status:'alive'},
  {id:prefix+'gate',name:'栖云门外院',kind:'place'},
  {id:prefix+'retreat',name:'青石山居',kind:'place'},
  {id:prefix+'middle',name:'中界清河城',kind:'place'},
  {id:prefix+'upper',name:'上界观星台',kind:'place'},
  ...(state.events.node.startsWith('shell-')?[{id:prefix+'ferrier',name:'蓼',kind:'person',status:'alive'}]:[]),
  ...(state.events.node.startsWith('field-')?valleyPlaces(prefix):[]),
  ...(state.events.node.startsWith('mine-')?minePlaces(prefix):[]),
  ...(state.events.node==='field-shrine'?[{id:prefix+'springward',name:'守泉会',kind:'faction',experience:{version:1,realmId:'qi'}}]:[]),
 ];
}
export function eventLocation(state){
 if(state.events.node.startsWith('mine-')&&state.events.node!=='mine-journal')return '石肺三硐';
 if(state.events.node.startsWith('watch-trail'))return trailLocation(state);
 if(valleyLocation(state.events.node))return valleyLocation(state.events.node);
 return {gate:'栖云门外院',retreat:'青石山居',middle:'中界清河城',upper:'上界观星台'}[state.events.location];
}
const narration=text=>({kind:'narration',text});
const speech=(speaker,text)=>({kind:'dialogue',speaker,text});
const choice=(key,label,intent='interact',targetId='self',approach='observe',extra={})=>({key,label,intent,targetId,approach,stake:'low',...extra});
const menu=(key,label,next,patch={})=>choice(key,label,'interact','self','observe',{next,patch,navigation:true});
const home=e=>e.entry==='accepted'?'work':e.entry==='unresolved'?'arrival':'hub';

export function eventNode(state,historicMenu=null){
 const e=state.events,life=state.life,actors=eventEntities(state),actor=key=>actors.find(row=>row.id.endsWith(':e:'+key)).id;
 const next=nextRealmFor(life),realm=realmFor(life),method=TECHNIQUES[life.cultivationProfile.experience.activeTechniqueId];
 const young=life.ageDays<80*DAYS_PER_YEAR;
 const row=(title,goal,blocks,choices)=>({title,goal,blocks,choices});
 const leave=menu('back','暂且放下，回去安排修行','hub');
 const terms=()=>[
  choice('accept','接下三日差事，换取完整入门功法','interact',young?actor('steward'):'self',young?'ask':'observe',{next:'work',patch:{entry:'accepted'},navigation:true}),
  menu('companion',young?'问问一旁为难的少年':'翻看旧日同窗的记录',young?'companion':'old-record'),
  choice('decline',young?'谢过周执事，自寻修行之路':'把旧簿交还外院，自行求道','interact',young?actor('steward'):'self',young?'decline':'leave',{next:'hub',patch:{entry:'declined',location:'retreat'},navigation:true}),
 ];
 if(e.node.startsWith('river-'))return riverNode(state,menu,choice);
 if(e.node.startsWith('watch-'))return watchNode(state,menu,choice);
 if(e.node.startsWith('field-'))return valleyNode(state,menu,choice,actor);
 if(e.node.startsWith('mine-'))return mineNode(state,menu,choice,actor);
 if(e.node.startsWith('garden-'))return gardenNode(state,menu,choice);
 if(e.node.startsWith('shell-'))return shellNode(state,menu,choice,actor('ferrier'));
 if(e.node==='hunt-sources'||e.node==='hunt-grounds')return materialHunt(state,next,menu,choice,historicMenu);
 if(e.node==='well-book')return echoWell(state,menu,choice);
 if(e.node.startsWith('sky-'))return cloudPassage(state,choice,menu);
 if(e.node==='well-road'){
  const home=menu('train-menu','收起路引，回去安排修行','training');
  return row('回声井的两班路引','随巡井人去找归魂印，也看井户怎样换班',[
   narration('行粮棚里压着两份与井班同行的路引。走旧石阶可以逐处听铃；搭吊篮走得快，起印时却少一道把握。先交一份行粮，半途回山仍可循井簿续走。'),
  ],life.items.supplies?[...wellDepartures(state,choice),home]:[choice('well-food','沿路备下行粮再来报名','explore','supplies','cautious',{next:'well-road'}),home]);
 }
 if(e.node==='mount-history')return mountainHistory(e.mountain,menu);
 if(e.node.startsWith('mount-'))return mountainNode(state,menu,choice);
 if(e.node==='post-index'){
  const reunion=young&&life.cultivationProfile.worldTier===0&&['helped','declined'].includes(e.companion)&&realm.rank>=1;
  return row('故人留下的两件事','读药路的回单，或回看早年的同路之约',[narration('当年曾怎样相待，和后来愿意替药路做什么，在手记里各有一页。')],[
   menu('post-book','读林砚的药路手记','post-book'),menu('other-visit','看旧日采药之约与分别',reunion?'reunion':young&&life.cultivationProfile.worldTier===0?'companion':'old-record'),leave]);
 }
 if(e.node.startsWith('post-'))return postNode(state,menu,choice);
 if(e.node==='voyage-result')return expeditionResult(e.expedition,menu);
 if(e.node.startsWith('voyage-'))return expeditionNode(state,menu,choice);
 if(e.node.startsWith('council-'))return councilNode(state,menu,choice);
 if(e.node.startsWith('convoy-'))return convoyNode(state,menu,choice,actor);
 switch(!young&&['companion','reunion'].includes(e.node)?'old-record':e.node){
  case 'arrival':return row('外院第一日','问清入门条件，选择留下或独行',[
   narration(young?'栖云门外院里，送炭的板车刚刚停稳。你把母亲缝好的衣袖拉平，站到登记的长桌前。周执事没有问你的灵根，只把一册差事簿推到桌沿。':'外院还存着那册旧簿。门上的墨色换了几回，当值者核对年月，仍认得当年写给试修弟子的条款。'),
   ...(state.reincarnation?.atlas?[narration('你行囊里有一本辗转传下的问川图。前人结过的图印还在，夹住旧页的草绳也在。等安顿下来，便可以从外出历练处接着读。')]:[]),
   ...(state.reincarnation?.inscription?[narration(inscriptionText(state.reincarnation.inscription))]:[]),
   ...(state.reincarnation?.gardenRoot!==undefined?[narration('行囊深处有一包先人封存的'+gardenRootName(state.reincarnation.gardenRoot)+'母土。将来试种第一畦时，它能多护一段嫩候。')]:[]),
   young?speech(actor('steward'),'外院不白收人。帮忙整理三日药圃，我给你一卷完整的入门功法。是否留下，你想清楚再答。'):narration('旧簿上写着：整理药圃三日，以一卷完整功法为酬。'),
  ],[menu('ask','先问清差事与试修条件','terms'),terms()[0],terms()[2]]);
  case 'terms':return row('一卷功法的条件','知道代价后，再决定是否接受',[
   young?speech(actor('steward'),'只清沟、分苗，不让你采药试药。三日做完，功法归你，往后愿不愿留门都由你。'):narration('当值者让你看旧约的附条：差事仅限清沟、分苗，三日做完便可领卷。'),
   narration(young&&e.companion==='unmet'?'旁边的林砚迟迟没有落笔。他捏着空布袋，目光停在药圃的方向。':'你已经听明白条件。是否接受这份差事，由你自己决定。'),
  ],[terms()[0],e.companion==='unmet'?terms()[1]:menu('back','尚未决定，回到登记处','arrival'),terms()[2]]);
  case 'work':return row('三日药圃','完成已接受的差事，取得入门功法',[
   narration((young?'周执事':'当值的管圃人照着旧簿')+'给你指出清沟与分苗的区域。你可以照约完成，也可以说明不做了。做完差事便能领取功法。'),
   ...(young&&e.companion==='unmet'?[narration('林砚蹲在药圃外，把空布袋翻了又翻，像在计算还能撑过多少天。')]:[]),
  ],[
   choice('finish-work','做完三日药圃差事','explore','manual','cautious',{next:'entry-result',patch:{entry:'joined'},rule:{days:3,gain:{manual:1},checkKind:null,spiritCost:0,warnings:[]}}),
   young&&e.companion==='unmet'?menu('companion','先问林砚遇到了什么困难','companion'):menu('pause-work','暂缓差事，先安排自己的修行','hub'),
   choice('abandon-work','说明不再做这份差事，自行离开','interact',young?actor('steward'):'self',young?'decline':'leave',{next:'hub',patch:{entry:'declined',location:'retreat'},navigation:true}),
  ]);
  case 'entry-result':return row('亲手换来的功法','完整功法已到手，下一步积累修为',[
   narration('第三日傍晚，你把最后一条水沟疏通。'+(young?'周执事':'当值的管圃人')+'照着差事簿核验过，将约定的完整入门功法交给你，没有再加条件。'),
   ...(young?[speech(actor('steward'),'这卷是你做事换来的。往后走多远，要看你怎么用它。')]:[]),
  ],[menu('continue','收好功法，安排下一步','hub'),menu('companion',young?'去看看林砚的近况':'翻看药圃旧日的同窗记录',young?'companion':'old-record'),menu('train-menu','先研究自己的修行门槛','training')]);
  case 'companion':{
   if(e.companion!=='unmet')return row('记着的那次选择','旧事已经有了决定，不必反复付出',[
    narration(e.companion==='helped'?'林砚还记得你分出的那份行粮。眼下他正在做自己的差事，不再向你重复求助。':e.companion==='declined'?'当日你没有接下林砚的求助。他另找了生计，那次分别没有变成追着你的责问。':'你与林砚的这一段交往已经落下结果。以后各有各的道路。'),
   ],[menu('continue','继续自己的打算',home(e)),...(young&&life.cultivationProfile.worldTier===0?[menu('post-book','听林砚说那只空药匣','post-book')]:[]),leave]);
   return row('空着的布袋','决定是否分出一份行粮',[
    narration('林砚说自己从渡口来，身上的盘缠用在了路上。他还没有做完差事，今晚却已没有饭食。'),
    speech(actor('companion'),'能借我一份行粮么？我不敢许你仙缘，只能记着这份相助。若你也为难，不必勉强。'),
   ],[
    choice('aid','分出一份行粮，帮林砚安顿下来','interact',actor('companion'),'help',{next:'companion-result',patch:{companion:'helped'}}),
    choice('decline-companion','说明自己也需留粮，婉拒相助','interact',actor('companion'),'decline',{next:'companion-result',patch:{companion:'declined'},navigation:true}),
    menu('leave-companion','先不作答，回去处理自己的事',home(e)),
   ]);
  }
  case 'companion-result':return row('各自记下的一日','这次决定已经保存，继续自己的道路',[
   narration(e.companion==='helped'?'你分出行粮，陪林砚安顿好今晚的住处。他报上自己的名字，郑重记下了你的相助。你们没有因此替彼此决定未来。':'你说明自己的行粮也有限。林砚把布袋收好，道了声明白，转身去问灶房还有没有临时差事。'),
  ],[menu('continue','继续原来的打算',home(e)),menu('train-menu','查看自己的修行门槛','training'),leave]);
  case 'reunion':return row('山路再遇','决定是否与故人合做一次采药差事',[
   narration(e.companion==='helped'?'林砚如今在药堂做事。再遇时，他先问起你当年的行粮，随后才说起一份采药差事。':'山路上，林砚认出了你。他已经在药堂找到了差事，没有拿当年的分别来责怪你，只问你是否愿意合做一次采药。'),
   speech(actor('companion'),'五日走一趟近山，沿旧药道采两份灵草。可以同行，也可以各走各的路。'),
  ],[
   choice('reunion-work','与林砚沿旧药道采药五日','explore','herbs','cautious',{next:'reunion-result',patch:{companion:'completed'},rule:{days:5,gain:{herbs:2},checkKind:null,spiritCost:0,warnings:[]}}),
   choice('part','谢过林砚，这次仍独自前行','interact',actor('companion'),'leave',{next:'reunion-result',patch:{companion:'parted'},navigation:true}),
   leave,
  ]);
  case 'reunion-result':return row('同路与分路','保留已经发生的相助与分别',[
   narration(e.companion==='completed'?'五日里，你们按药堂标记采回两份灵草。林砚在岔路口与你道别：有过相助的人，也各有自己的路。':'你与林砚在岔路口道别。他去交自己的差事，你继续安排修行。你没有为这次离开付出额外惩罚。'),
  ],[menu('continue','带着这一段经历继续修行','hub'),menu('train-menu','查看修行与破境','training'),menu('journey-menu','备办下一段历练','journey')]);
  case 'hub':{
   const appointment=postNotice(e.post,life.ageDays);
   const variants=['风从檐下穿过，书页轻轻翻动。','桌上留着上次修行的笔记，门外的路仍在。','你收拢纷杂的念头，重新衡量手中的时间与资用。'];
   const journey=e.council?.length===councilHearings?'翻阅三界海路与旧簿，或外出备料':e.expedition?.place==='end'?'翻看北山公簿，或外出备料':e.river?.record.length===6?'接续行旅图，或外出备料':'读问川图，或外出备料';
   return row('此后的仙路','修行成长与故人后续，都由你安排',[
    narration(variants[(state.turnId+state.life.birth.attributes.insight)%variants.length]),
    ...(appointment?[narration(appointment)]:[]),
    narration(e.entry==='accepted'?'药圃差事仍可回去做完；未做完时不会发放功法。':e.entry==='declined'?'你选择了独自求道。栖云门那份未接下的差事没有变成必须偿还的债。':'修为、功法与资用各有门槛。已经完成的差事不会再要求你重做。'),
   ],[menu('train-menu','安排修炼与突破','training'),menu('journey-menu',journey,'journey'),menu('affairs-menu','探访故人，处理未完之事','affairs')]);
  }
  case 'training':{
   // A restored pre-garden training screen still contains its disabled breakthrough.
   const oldGate=historicMenu==='training'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_training')&&state.currentScene.choices.some(c=>c.id.endsWith(':c:breakthrough'));
   return row('修行的门槛',next?'积累修为与'+ITEMS[next.material]+'，尝试进入'+next.name:'在当前境界继续修行与历练',[
   narration(next?'你目前是'+realm.name+'。进入'+next.name+'需要修为达到'+next.threshold+'，并备妥'+ITEMS[next.material]+'。闭关的年月、灵力和风险会在行动前列明。':'渡劫之后，此生仍未结束。你可以继续积累、历练或照料旧日因果，直到真实的寿尽或伤重。'),
  ],[
   e.garden?.plot&&(!next||life.cultivation>=next.threshold)?menu('garden-book','验看苗盆，或在盆旁继续修行','garden-book'):choice('practice','按当前功法稳步修炼','practice','self','steady',{next:'action-result'}),
   next&&life.cultivation<next.threshold&&!oldGate?menu('garden-book','随身携一畦苗，选择稳修或苦修','garden-book'):
    next&&!oldGate&&!life.items[next.material]?menu('find-material','修为已足，去寻'+ITEMS[next.material],ferryForMaterial(state,next.material)?'hunt-sources':'hunt-grounds'):
    next?choice('breakthrough','闭关尝试突破'+next.name,'practice',next.id,'breakthrough',{next:'action-result'}):choice('intensive','以行粮支撑一次苦修','practice','self','intensive',{next:'action-result'}),
   menu('rest-menu','调息、安排守关或验看功法','rest'),
  ]);
  }
  case 'rest':{
   const reserve=realm.rank>=1&&next&&life.lifeLimit*DAYS_PER_YEAR-life.ageDays<=(next.minYears+realm.practiceYears)*DAYS_PER_YEAR;
   return row('停下来整备','先照料伤势与灵力，也可回去处理别的事',[
    narration(reserve?'这段余寿已经经不起几次长关。调息过后可在药房查看延寿方，亲自备药，也可以径回山中。':'休整不会替你突破，也不会替你答应任何请求。修行所需的行粮与材料仍要亲自准备。'),
   ],[choice('recover','静养调息，恢复伤势与灵力','rest','self','recover',{next:reserve||life.items.elixir?'apothecary':'action-result'}),menu('watch-book','翻开守关簿，或验看功法','watch-book'),leave]);
  }
  case 'apothecary':{
   const receipt=state.lastReceipt,a=receipt?.action,failed=receipt?.cultivationResult?.check?.success===false;
   const prior=a?.intent==='craft'?(failed?'上一炉没能成丹，投进去的药草和灵石已经用去。':'炉盖掀开，一枚延寿丹已收入行囊。'):
    a?.intent==='explore'?(failed?'上次搜寻无所得。药柜里仍是实际带回的存量。':'带回的材料已入柜。'):
    a?.approach==='extend'?'丹已服下，此次实增寿限'+receipt.cultivationResult.lifespanChange.years+'年。':'你在炉边调匀了气息。';
   const herbs=life.items.herbs??0,stones=life.items.stones??0,elixir=life.items.elixir??0;
   const material=herbs<8?'herbs':'stones';
   const work=elixir?choice('take-elixir','服用一枚延寿丹','rest','self','extend',{next:'apothecary'}):
    herbs<8||stones<12?choice('gather-ingredient','亲自搜寻'+ITEMS[material],'explore',material,'cautious',{next:'apothecary'}):
    choice('brew-elixir','将八份药草和十二枚灵石投入丹炉','craft','elixir','alchemy',{next:'apothecary'});
   return row('山中药房 · 延寿方','按余寿与材料决定是否开炉',[narration(prior),narration('距寿尽尚有'+(life.lifeLimit*DAYS_PER_YEAR-life.ageDays)+'日。药草 '+herbs+' / 8，灵石 '+stones+' / 12，延寿丹 '+elixir+' 枚。这张方子需要十五分灵力；若炼制失败，材料仍会耗去。')],[work,choice('recover','在炉边调息养伤','rest','self','recover',{next:'apothecary'}),menu('train-menu','收起药方，安排修行','training')]);
  }
  case 'journey':return row('路与行囊','接续历练，或备办下一次修行的资用',[
   narration(e.council?.length===councilHearings?'北山九次落款都在册。从河簿翻到北山最后一页，可以查到三界海路的舱单与来信。':e.expedition?.place==='end'?'你的行囊里放着三程图印。北山井户的一纸来信夹在其间，等你回去落款。':e.river?'问川图上夹着一根草绳，再打开仍是上次停下的地方。':'你在山口书摊翻到一卷旧图。卖书人说是好几代守闸人留的传习卷，问你愿不愿试着展开。桌的另一头还摊着采药与打铁的路引。'),
  ],[menu('river-book',e.expedition?.place==='end'?'翻阅河簿、三程行旅与北山公簿':'展开问川图，历练河上人家','river-book'),menu('resources-menu','寻找修行材料与生活物资','resources',{page:0}),menu('workshop-menu','炼制、跨界与其他准备','workshop',{page:0})]);
  case 'resources':{
   const targets=[...new Set([next?.material??'relic','supplies','stones','herbs','iron'])],target=targets[e.page%targets.length];
   const oldSlip=historicMenu==='resources'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_resources')&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:well-road'));
   let original=target==='herbs'&&e.garden?menu('garden-book','查看随身苗盆与采候','garden-book'):e.river?.record.length?menu('field-guide','翻看雾药谷游记与往返路线','field-guide'):leave;
   if(target==='supplies'){
    if(e.well)original=menu('well-book','循行粮路引，回井棚翻井簿','well-book');
    else if(realm.rank===3&&!oldSlip)original=menu('well-road','取一份去回声井的路引','well-road');
   }
   const savedOld=state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_resources')&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:shell-book'));
   const ferry=realm.rank>=1&&e.page===0&&historicMenu!=='resources'&&!savedOld;
   return row('寻找'+ITEMS[target],'只结算本次选定的资源',[
    narration('你把目标定为'+ITEMS[target]+'。谨慎搜寻花费更多时间，仍须承担当前境界与环境下的真实风险；失败也会留下记录。'),
   ],[choice('gather','谨慎搜寻'+ITEMS[target],'explore',target,'cautious',{next:target==='herbs'&&!e.garden?'herb-basket':'action-result'}),menu('next-resource','换看下一种物资','resources',{page:(e.page+1)%targets.length}),ferry?menu('shell-book','循浮蚌渡的潮纹，查访破境宝物','shell-book'):original]);
  }
  case 'herb-basket':return row('山口的试种盆','清点本次采药，决定要不要照料随身苗盆',[
   narration((state.lastReceipt?.cultivationResult?.check?.success===false?'这次寻药落空。':'采回的药草已经收入行囊。')+'山口的空花盆能绑在背篓上，行脚和闭关时都跟着你。领种栽下才会开始计算采候。'),
  ],[menu('garden-book','看看行圃与试种的条件','garden-book'),menu('train-menu','回去安排修行','training'),menu('continue','继续安排此后的仙路','hub')]);
  case 'workshop':{
   const recipes=[['medicine','alchemy'],['artifact','forge'],['talisman','talisman'],['array','formation'],['elixir','alchemy']],recipe=recipes[e.page%recipes.length];
   return row('整备手艺','材料与灵力足够时再动手',[
    narration('当前准备炼制'+ITEMS[recipe[0]]+'。配方消耗与失败风险由规则列明，材料不足时可以先去寻取。'),
   ],[choice('craft','尝试炼制'+ITEMS[recipe[0]],'craft',recipe[0],recipe[1],{next:recipe[0]==='elixir'?'apothecary':'action-result'}),menu('next-recipe','查看下一项手艺','workshop',{page:(e.page+1)%recipes.length}),menu('crossing-menu','查看界域道路或返回','crossing')]);
  }
  case 'crossing':{
   const tier=life.cultivationProfile.worldTier,destination=tier===0?'middle':'upper',name=tier===0?'中界清河城':'上界观星台';
   const oldRoad=historicMenu==='crossing'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_crossing')&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:sky-book'));
   const sky=tier===2&&realm.rank>=4&&!oldRoad;
   return row('天地之间','达到真实门槛后才能跨界',[
    narration(tier<2?'通往'+name+'的道路有自己的境界、材料与风险门槛。未达到时，继续留在当前天地修行便是。':'你已经身在上界，仍可继续修行与历练。'),
   ],[tier<2?choice('cross','循正途飞升前往'+name,'travel',actor(destination),'ascend',{next:'action-result',arrival:destination}):sky?menu('sky-book','去白脊云渡，随渡班闭关守风','sky-book'):menu('train-menu','继续安排修行','training'),menu('resources-menu','回去备办资源','resources',{page:0}),leave]);
  }
  case 'affairs':{
   const companion=young&&['helped','declined'].includes(e.companion)&&realm.rank>=1?'reunion':'companion';
   return row('旧事与来人','只有尚未完成的事情才需要再作决定',[
    narration(young?'回看故人的来处，也回看自己已经说出口的话。问候不等于答应，暂缓也不等于失信。':'闭关跨过了许多年。你能追索旧日记录，却不能假定当年的凡人仍站在原地等你。'),
   ],[menu('mentor-menu','查看功法与校法之约','mentor'),menu('companion-menu',young?'看看林砚与当年的选择':'翻看故人的旧日记录',e.post?'post-index':young?companion:'old-record'),e.entry==='accepted'?menu('resume-work','回去完成三日药圃差事','work'):life.cultivationProfile.worldTier>=1&&e.convoy?.chapters[0]?.loads.length===2?menu('ear-book','读钟荻的信，续校六件音器','convoy-ear-book'):leave]);
  }
  case 'mentor':{
   const experience=life.cultivationProfile.experience,commitment=experience.commitment,young=life.ageDays<100*DAYS_PER_YEAR;
   const canPledge=life.ageDays+3<100*DAYS_PER_YEAR;
   if(commitment?.status==='owed')return row('校法时的约定','记着当初那一份行粮',[
    narration(young?'顾师叔仍在旧廊下校书。你记得接受指点时说好的条件：向他本人归还一份行粮。':'旧廊已换了主人，眼下没有顾师叔的下落。那份未还的约定仍被保留，不能向别的人交粮便算履行。'),
   ],[...(young?[choice('repay','向顾师叔归还约定的一份行粮','craft',actor('mentor'),'repay',{next:'mentor-result',patch:{mentor:'repaid'}})]:[menu('read-debt','记下未还之约，暂不臆测他的去向','old-record')]),menu('resources-menu','先备办行粮','resources',{page:1}),leave]);
   if(!method.defective||experience.repaired)return row('法诀与来路','已有的功法改善继续参与真实结算',[
    narration(experience.repaired?'你已经修补过当前功法。原有长处保留，缺处的代价已按规则改变；不必重复付出校法的代价。':'你现在使用的功法脉路完整，不需要为了展开故事而硬添一处缺陷。'),
   ],[menu('train-menu','亲自修炼，检验功法','training'),menu('companion-menu','回看故人的事情',life.ageDays<80*DAYS_PER_YEAR?'companion':'old-record'),leave]);
   if(!experience.lessons.includes('diagnosed'))return row('先辨明缺处','验法不会自动接受指点或欠下人情',[
    narration('你把'+method.name+'摊在膝上。'+method.defect+'先辨清实际缺处，才谈得上自己推演或求助。'),
   ],[choice('diagnose','验看本命功法的实际缺处','craft','self','diagnose',{next:'mentor'}),menu('train-menu','暂不修法，继续原有修行','training'),leave]);
   return row('两条修法的路','自研或求助，都在选择前说明代价',[
    narration('功法缺处已经验明。你可以独自推演。'+(canPledge?'顾师叔也愿意指点，但要先说清日后还粮的约定。':young?'顾师叔将要远游，临行前已经来不及结下三日校法之约。':'旧日指点者不在眼前。')),
    ...(canPledge?[speech(actor('mentor'),'我可以陪你校法三日，花四分灵力。日后再遇，归还一份行粮便好；不愿欠人情，就自己慢慢推演。')]:[]),
   ],[choice('restore','自行推演并修补功法','craft','self','restore',{next:'mentor-result',patch:{mentor:'self'}}),canPledge?choice('pledge','接受顾师叔指点，约定日后还粮','craft',actor('mentor'),'pledge',{next:'mentor-result',patch:{mentor:'guided'}}):menu('train-menu','先照原功法修行','training'),leave]);
  }
  case 'mentor-result':return row('法诀留下的变化','以真实修法与还约结果继续前行',[
   narration(e.mentor==='repaid'?'你把一份行粮交还顾师叔。他在旧簿上划去那一笔，这次校法之约已经还清，不会再扣第二份。':e.mentor==='guided'?'三日校法之后，当前功法的缺处得到修补。你仍记着与顾师叔的约定：以后向他本人还一份行粮。':'你按自己推演的次序修补功法。花去的时间与灵力已记下，没有为此欠下指点者的行粮。'),
  ],[menu('train-menu','修炼一次，检验改变','training'),menu('mentor-menu','查看仍需处理的校法之约','mentor'),leave]);
  case 'old-record':return row('岁月之后','保留旧事，不编造未确认的重逢',[
   narration('你翻过旧日记录。相助、拒绝、同路与分别仍各有原来的样子。没有新的下落，便不替故人写下死讯，也不假定他们仍在原处。'),
  ],[menu('train-menu','带着旧日经历继续修行','training'),menu('journey-menu','寻找眼前真正可行的道路','journey'),leave]);
  case 'action-result':{
   const receipt=state.lastReceipt,check=receipt?.cultivationResult?.check,action=receipt?.action;
   let text='这次行动已经结束。实际消耗与变化记在下方，你可以继续安排自己的道路。';
   if(action?.intent==='practice')text=action.approach==='breakthrough'?(check?.success?'闭关之后，你确实跨过了这道门槛。新的境界进入真实规则，下一段修行仍需时间与资用。':'这次冲关没有成功。已经消耗的材料、修为和伤势都照实留下；先休整或重新准备，由你决定。'):'你依当前功法完成一次修炼。经过的年月、积累的修为与可能的伤势都已结算，没有额外替你接受任何事务。';
   else if(action?.intent==='explore')text=check&&!check.success?'这次搜寻没有带回预期的资源。付出的时间与代价已经记下，失败不会被写成另一次成功。':'这次搜寻按所选目标结束。只有收据列出的物资进入行囊，其他机缘仍留待亲自选择。';
   else if(action?.intent==='rest')text='你留出时间静养调息。恢复以真实伤势与灵力为准，没有借休整替你完成未接下的事情。';
   else if(action?.intent==='craft')text=check&&!check.success?'这次炼制失败，投入的材料已经消耗，未得到成品。':'你完成了这次炼制，所得与消耗照实记入行囊。';
   else if(action?.intent==='travel')text=check&&!check.success?'这次跨界没有成功，你仍在原来的界域；实际损耗已经记下。':'你抵达所选的界域，旧事仍保留在来路中，眼前的修行条件按新的天地结算。';
   let onward=menu('affairs-menu','看看故人与未完之事','affairs');
   if(e.garden&&next&&life.cultivation<next.threshold&&
     (action?.intent==='practice'&&['steady','intensive'].includes(action.approach)||action?.id.endsWith(':c:forage-again'))){
    const delta=receipt.after.cultivation-receipt.before.cultivation;
    return row('出定再择功课','查看修为差额和余寿，决定下一关怎样练',[
     narration((action.intent==='explore'?'这次备粮用去':'上一关用去')+receipt.elapsedDays+'日，'+(check?.success===false?'检定未成':action.intent==='explore'?'寻粮归来':'修行已毕')+'，修为变动'+delta+'。距离'+next.name+'还差'+(next.threshold-life.cultivation)+'分。行粮还有'+(life.items.supplies??0)+'份，灵力尚余'+life.cultivationProfile.spirit+'。'),
    ],[choice('practice-again','依当前功法再闭关一次','practice','self','steady',{next:'action-result'}),
     life.items.supplies?choice('intensive-again','付行粮苦修，提早出关','practice','self','intensive',{next:'action-result'}):choice('forage-again','亲自出山备粮，归来再择功课','explore','supplies','cautious',{next:'action-result'}),menu('train-menu','收功，回看苗盆或整备','training')]);
   }
   if(action?.intent==='practice'&&action.approach==='steady'&&next&&life.cultivation<next.threshold){
    onward=choice('practice-again','依当前功法再闭关一次','practice','self','steady',{next:'action-result'});
   }
   if(action?.intent==='practice'&&action.approach==='breakthrough'&&check?.success&&e.expedition?.place==='end'){
    onward=e.council?.length===councilHearings?menu('resume-ledger','以新境界再看三界海路','convoy-book'):menu('resume-ledger','以新境界再看北山来信','council-book');
   }
   const resumeMountain=e.mountain&&!e.mountain.ending&&(action?.approach==='breakthrough'&&check?.success||action?.intent==='rest');
   return row('这一回的结果','看清代价，再决定下一步',[narration(text)],[resumeMountain?menu('mount-book','收功，翻开随身折山石','mount-book'):menu('continue','继续安排此后的仙路','hub'),menu('train-menu','查看修行与恢复','training'),onward]);
  }
  default:throw new Error('规则事件节点无效。');
 }
}
