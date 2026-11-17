import {realmFor} from './cultivation-rules.js';
import {exactKeys} from './schema.js';
import {canVisitRift,riftNode} from './cloud-rift.js';
import {cloudTrialNode,cloudTrialStage} from './cloud-trial.js';

const seasons=[
 {rank:4,title:'盐船过白脊',petition:'云层一低，盐船就搁在白脊。船头只看得见峰，岸上的雇工却说每回都是先听见石滩碎响，才看见峰露出来。渡娘把记风的窄板往你脚下一搁：「请在这里住一关。等真人走了，我们也得认得这条路。」',
  seats:['在石滩听风','随盐船守舵'],signs:['碎响从上游一路跑到脚底，随后盐水才漫到第一枚铁钉。岸上有整整一炷香可以发船。','船身先向右一倾，舵下三根绷索只有最短的一根吃力。舵工摸着那根索便能自己认出白脊。'],
  works:['架传声索，岸上听风发船','刻吃水尺，让舵工自己认路'],targets:['iron','stones'],
  results:['盐船等到岸上松索才开，旧码头第一次能保住整船干盐。守索人每天要比头班早起一更。','舵工能摸着尺独自过白脊。第一趟带新学徒，特地少装了两袋盐，好让她在船尾试舵。']},
 {rank:6,title:'雾中借一晚灯',petition:'上游的灯坊来信，说新船夜里从两座浮岛之间经过，总有一座看不见灯。去年两岸各抄了一份误泊的名册，写的竟是同一夜。你到渡口时，两边都留了铺盖，请你任选一边住下看个明白。',
  seats:['留在灯坊背风的窗边','随收末班的空船出港'],signs:['灯芯很稳。两页错船记录相差半更，恰好是岗亭换油的时候。把灯火交给守更的人能补上这一段。','末班船一过分水线，岸灯就藏到雾背后。船腹敲出的两长一短却能传到两岛，隔雾也能应答。'],
  works:['把灯钥交给两岸轮值','让末船报声，再由对岸应答'],targets:['iron','supplies'],
  results:['轮值簿上终于填了那个空着的半更。灯坊留出一间朝水的小屋，给赶不上回程的人歇脚。','末船在雾里敲了三下，另一座岛接过了回声。有人没赶上末班，留宿的地方要自己寻。']},
 {rank:8,title:'把渡口交还给谁',petition:'多年以后，你又回到了白脊。渡簿已经抄过四回。两个新学徒把最后一张图摊在长桌上。一人想留下能守住两岸的公渡，一人想带着图走更远，把认路的本事教给小船。船厂只够造一条样船。',
  seats:['守在修公渡的船棚','跟小船到航线尽头'],signs:['守更的人在船底刷了两道白漆，交班时用水线对齐吃水。两班脚夫能接手同一条船，也能给不识路的人留位。','舵手把图裁成巴掌大小，贴到三条吃水不同的船上。她们练的是看风的先后，记熟后连图也能留给下一条船。'],
  works:['造公渡，给两岸留下轮值船','造教船，带第一批舵手出远门'],targets:['iron','supplies'],
  results:['第一条公渡靠岸时，掌舵的没有喊你的名字。她把跳板搭给等在岸上的人，下班的旧舵手便跟着他们过了河。','教船开走时，两岸还得用旧船摆渡。学徒把半张海图钉在船棚里，另半张带在怀里：「等我自己把盐送到，再回来画上这一趟。」']}
];
export function validateCloudPassage(events,life){
 const log=events.cloudPassage,rank=life?realmFor(life).rank:Infinity;
 if(life&&(life.cultivationProfile.worldTier!==2||rank<seasons[0].rank))throw Error('云渡位于上界。');
 if(Object.hasOwn(events,'cloudPassage')&&(!Array.isArray(log)||!log.length||log.length>seasons.length))throw Error('云渡守航记录无效。');
 for(const [i,r] of (log??[]).entries()){
  exactKeys(r,['seat','route']);
  if(![0,1].includes(r.seat)||![0,1,null].includes(r.route)||i<log.length-1&&r.route===null||rank<seasons[i].rank)throw Error('云渡守航次序无效。');
 }
 if(events.node==='sky-shore'||events.node==='sky-boat'){
  const next=seasons[log?.length??0];
  if(!next||rank<next.rank||log?.at(-1)?.route===null)throw Error('云渡此班尚不能入关。');
 }
}
export function cloudPassage(state,choice,menu,historicMenu=null){
 const {events,life}=state,log=events.cloudPassage??[],last=log.at(-1);
 if(events.node.startsWith('sky-trial'))return cloudTrialNode(state,choice,menu);
 if(events.node.startsWith('sky-rift'))return riftNode(state,menu,choice);
 const watched=last?.route===null,i=watched?log.length-1:log.length,c=seasons[i];
 const back=menu('train-menu','收起渡簿，回去安排修行','training');
 const row=(title,lines,choices)=>({title,location:'上界白脊云渡',goal:'在上界守一关风候，把能交给凡人的渡路留下',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const rift=menu('rift-book','循浮岩逆风，探访白脊风隙','sky-rift');
 const trial=menu('sky-trial','翻船签，安排当下渡班的试航与接班','sky-trial');
 if(events.node==='sky-book'&&events.cloudTrials?.at(-1)?.method===null)return row('白脊渡口 · 船签尚未交回',['试航已接下，船签上记着已经完成的部分。可以继续安排余下的人，也可先守下一班风候；回山不会自动结清这一班。'],[trial,menu('sky-weather','先看原来的云渡守候与风隙','sky-weather'),back]);
 const old=historicMenu==='rift'||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_sky-book')&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:rift-book'));
 if(['sky-book','sky-weather'].includes(events.node)&&(events.cloudRift||!old&&!watched&&canVisitRift(state)&&c&&realmFor(life).rank>=c.rank))return row('白脊渡口 · 两条仍可走的路',[events.cloudRift?'旧渡班仍按已经交接的办法发船。浮岩下的风隙另有你留下的足迹，两处都可接着走。':'下一班云渡已经可以守候，浮岩外也传来逆风的消息。可先接云渡，或先去看看风隙；读过请托不等于已经答应。'],[rift,menu('sky-lodgings','继续原来的云渡守候与交班','sky-lodgings'),back]);
 const oldTrials=historicMenu||state.currentScene?.id.endsWith(':t'+state.turnId+':s:event_'+events.node)&&!state.currentScene.choices.some(c=>c.id.endsWith(':c:sky-trial'));
 const returnChoices=[back,!oldTrials&&cloudTrialStage(events)>=0?trial:menu('crossing-menu','回到界域道路','crossing'),...(!old&&canVisitRift(state)?[rift]:[])];
 const previous=i?seasons[i-1].results[log[i-1].route]:'';
 if(!c)return row('白脊云渡 · 三次交班',log.map((r,k)=>seasons[k].title+'。'+seasons[k].results[r.route]),returnChoices);
 if(realmFor(life).rank<c.rank)return row('白脊寄来的渡簿',[previous,'下一封请托在'+(i===1?'炼虚':'大乘')+'境开放。你留下的渡法仍在使用，眼下尽管去走自己的路。'],returnChoices);
 const rig=events.well?.reply;
 const oldTool=i===1?(log[0].route===0?'旧码头的传声索还在，改给两岸灯坊交班只需三日。':'船上的吃水尺留着空槽，装上报声的铜片只需三日。'):i===2?(log[1].route===0?'灯坊的两班人已经会交接，公渡能借他们开第一班。':'末船的舵手已经会隔岸应答，教船可以请她们带第一程。'):'';
 if(events.node==='sky-shore'||events.node==='sky-boat'){
  const seat=Number(events.node==='sky-boat'),patch={cloudPassage:[...log,{seat,route:null}]};
  return row(c.title+' · '+c.seats[seat],['值班人在窄板上穿了根绳，把你铺盖的一角也系在上头。每换一班，就在板上刻一道所见的水线。等你出定，哪怕最初那班人已经老去，也有人接得上这句话。','长住可按本命功法稳修；带一份行粮苦修能提早出关，仍有失手受伤的风险。两种守法都能留下这一处风候。'],[
   choice('sky-steady','随这一班按本命功法稳修','practice','self','steady',{next:'sky-book',patch}),
   choice('sky-intensive','备一份行粮，随这一班苦修','practice','self','intensive',{next:'sky-book',patch}),
   menu('sky-book','收好铺盖，重新选守候处','sky-book')]);
 }
 if(watched){
  const fits=(n)=>n===last.seat||i>0&&log[i-1].route===n||i===0&&rig===(n===0?'up':'down');
  return row(c.title+' · 出关后试航',[c.signs[last.seat],...(oldTool?[oldTool]:[]),'用亲自守过的办法，或借用已经备好的旧物，三日能教会接班人。另起一套要花九日试航。两种办法留下的渡口不同。',...(i===2?['船厂给公渡留有一枚旧避劫雷印，修船换下就能带走；教船的药师则愿留一枚延寿丹作师资。']:[])],[
   ...c.works.map((label,n)=>{
    const days=fits(n)?3:9,target=c.targets[n];
    return choice('sky-route-'+n,label+'（'+days+'日）','explore',target,'cautious',{next:'sky-book',optionalGift:true,
     rule:{days,gain:i===2?{[n?'elixir':'thunderseal']:1}:{}},patch:{cloudPassage:[...log.slice(0,-1),{...last,route:n}]}});
   }),back]);
 }
 const bell=i===0&&rig?(rig==='up'?'早年你把副铃留在井口，当年的交班谱能直接接到岸索。':'早年你把副铃留给井底，末人的报声手势如今可交给船上的舵手。'):'';
 return row('白脊云渡 · '+c.title,[...(previous?[previous]:[]),c.petition,...(oldTool?[oldTool]:[]),...(bell?[bell]:[]),'挑一处陪渡班守候，修为、灵力和年月按所选功法照常结算。出关后再决定替谁修渡。'],[
  ...c.seats.map((label,seat)=>menu('sky-watch-'+seat,label,seat?'sky-boat':'sky-shore')),!oldTrials&&cloudTrialStage(events)>=0?trial:back]);
}
