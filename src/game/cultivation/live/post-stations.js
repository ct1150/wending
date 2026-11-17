import {exactKeys} from './schema.js';

// Each station receives one part of a scarce public asset. Its other users
// carry on in the cultivator's absence, even if nobody comes back to inspect.
const sites=['渡头','石阶'];
const crossings={
 turned:'你顺着人声最响的方向走了半截，手指摸到一圈又一圈光溜溜的旧绳。伸手扶你的卖粥人笑了：「你摸的是我晾碗的架子。坐一坐，船还没走。」',
 found:'你摸到了用到起毛的那截旧索。一只很小的手从你胳膊底下伸过去，认出相同的记号。你放慢脚步，等那孩子先跨上踏板；等他的母亲赶到，他已经自己找到了位子。',
 carried:'你把掌心贴在木柱上，分了一股灵力去听水。对岸一回桨，贴水的木柱先轻轻一颤。你领候船人从这里过去。掌心挪开，振动也随之散去，下一班仍需自己的路标。',
 guided:'卖粥人把手上的热碗搁回笼屉，亲自领你和那孩子上了船。粥凉了一碗，他也少卖了一碗；你替他把碗捎给对岸等早班的女儿。',
};
const seasons=[
 {
  title:'涨水前的一根长梁',days:90,asset:'长梁',jobs:['补渡棚的跳板','给石阶架扶栏'],
  opening:'木排上最后一根通长的栗木被拖上岸。船家把它搁在晃动的跳板旁，石阶上的担夫却拿草绳量了量它的长度。两家已经各锯坏过一根短木，谁都知道分成两截就两边都用不成。三个月后头一场涨水会到。',
  works:['船家拆开舷侧横板，把新梁一头锁进旧桩。石阶上只能把本来捆货的麻绳拆下来，挨家打结充作扶手。','担夫把木梁顺着最陡的九级石阶架好。渡头留下两块短板，载人时须先卸货再靠岸。'],
  reports:[['桩上拴着一只小木鞋，是头一个自己走上船的孩子留下的。船可以连人带货一齐靠岸了。','两块板交替放时，末一船药箱赶上了，人却在隔岸过了一夜。账上只记了箱到。'],['绳结最密的一段全在肩膀高度。矮个的背篓伙计说，上坡只能用额头抵着前一个人的背。','石阶上的老婆婆自己扶着栏杆下了山。她把用了十年的藤杖挂在梁头，说哪天别处有人用得着。']],
  fixes:['把头班渡位留给步行客','让矮担夫先挑每日上坡的时辰','两站各出半班人，合办一班慢渡'],
  after:['下月船头空出一块站人的位置。最早的一批货只好再等下一班。','上坡的时辰跟着矮担夫的步子改了。船家为错开的交接多留了一盏灯。','船要等山上最后一人到齐才解缆。走不快的人有了座位，赶早市的人另寻脚程。'],
 },
 {
  title:'药香里的借宿人',days:120,asset:'一卷油毡',jobs:['搭候船客的风棚','盖山脚共用的晾药架'],
  opening:'连阴天里，船埠的夜客挤在秤屋，山脚的药户则用自己的被面护药。旧油坊拆下一卷好毡，尺寸恰够一处。一个小姑娘问，若药不能干，阿娘还要守几夜；秤屋里的客人也有人惦记着赶回家。',
  works:['码头搭起半面挡风棚。山脚的药户改在各家灶旁轮着烘药，小姑娘每晚得去另一家寻母亲。','油毡钉上晾架，药户终于能一起歇一晚。候船客借秤屋的门板挡风，天亮前必须搬回去。'],
  reports:[['棚柱上有人刻了歇脚人的身高。有个短短的记号刻在最低处，是在这里等到父亲的孩子画的。','秤屋主人留下一本笨账。每借出一扇门，他就少开一边铺，好让夜里醒来的人仍看得见路。'],['药权分属几家，烘干后气味掺在一起，药户挨着灶看了几夜才分清。小姑娘给每家的柴篮都拴了不同颜色的线。','新晾架隔出高低两层。原本够不着架顶的小姑娘在底层留了一个写着自己名字的空位。']],
  fixes:['让值夜客轮收风棚旁的门板','拨出干架底层作无主药的公位','两站互借半间晴天用不到的空屋'],
  after:['有了管门的人，客人夜里可以进屋。愿管门的那一班得比别人晚走一趟。','底层从此能存放无人来认的药。自家的药装不下时，药户仍得腾出灶间。','两把钥匙寄放在对站。晴日房屋各自使用，阴天来借的人须绕一次路取钥匙。'],
 },
 {
  title:'最后一张过站帖',days:180,asset:'刻帖的铜版',jobs:['印给码头的轮渡人','印给山脚轮歇的担夫'],
  opening:'两处打算撤下沿用了半辈子的临时牌。小铸坊只剩一张耐翻印的铜版。船家想刻能随班带走的船次，担夫想刻沿途随时可歇脚的门牌。铸字前各问了一遍，都有人说自己不识字，只认路。',
  works:['铜版刻成从篷口望去的三面船旗。山路上的人用各家的门环传递歇脚暗号。','铜版刻成三段能摸到的门纹。渡头的人把当日船次拴作绳结，来不及教新客时就亲手领他过桥。'],
  reports:[['一个第一次下山的人指着旌旗认出末班。旗没展开的雾天，他仍须问守船人。','值班人掌心留着绳印。结法总有人记反，他开始请刚学会的客人教下一位。'],['敲门有错的时候，屋里人先端凳子，再告诉客人该往哪走。空屋无人应门仍会误事。','门帖边缘先磨亮的恰是给拄杖人摸的粗纹。风雨剥去颜色以后，那一道纹仍在。']],
  fixes:['把改帖权交给当日守船的人','由歇脚户轮换保管母版','留下一张空版，须两站各出一人才可改帖'],
  after:['新帖能在开船前夜改好。山上人要派脚程来打听，才能及时得到变更。','母版每季换一户掌管。山路变动很快能印进门帖，船次则由守船人另外口授。','空版和两把分存的刻刀收进木套。谁都能提出要改的字，却要等另一处的人真正走到桌前才落刀。'],
 },
];
export function validateStations(records,p,life){
 if(!p.steps.length||!Array.isArray(records)||!records.length||records.length>seasons.length)throw new Error('两站合簿无效。');
 let after=p.steps[0].day;
 for(const [i,r] of records.entries()){
  exactKeys(r,['sent','plan','visits','settled','end'],['fog']);
  if(!Number.isSafeInteger(r.sent)||r.sent<after||life&&r.sent>life.ageDays||![0,1].includes(r.plan)||!Array.isArray(r.visits)||r.visits.length>2)throw new Error('两站托付无效。');
  const seen=new Set();let day=r.sent+seasons[i].days;
  for(const v of r.visits){
   exactKeys(v,['site','day']);
   if(![0,1].includes(v.site)||seen.has(v.site)||!Number.isSafeInteger(v.day)||v.day<day+journeyDays(records[i-1],p.route,v.site)||life&&v.day>life.ageDays)throw new Error('两站见闻无效。');
   seen.add(v.site);day=v.day;
  }
  if(Object.hasOwn(r,'fog')&&(i!==2||seen.size!==2||!Object.hasOwn(crossings,r.fog)))throw new Error('雾渡见闻无效。');
  if(r.settled===null){
   if(r.end!==null||i!==records.length-1)throw new Error('两站尚未结案。');
  }else{
   const due=r.sent+seasons[i].days;
   // After the last possible two-day meeting the joint hearing takes six days.
   const lateHearing=r.settled===2&&r.end>due+32;
   const earliest=lateHearing?Math.max(day,due+31)+6:day+2;
   if(![0,1,2].includes(r.settled)||!seen.size||r.settled===2&&seen.size!==2||
      !Number.isSafeInteger(r.end)||r.end<earliest||
      life&&r.end>life.ageDays)throw new Error('两站结案无效。');
  }
  after=r.end;
 }
}
function journeyDays(previous,route,site){
 if(previous?.settled===2)return 2;
 const regular=previous?.settled??(route==='door'?1:0);
 return site===regular?1:3;
}
export function stationNode(state,menu,choice){
 const {post:p,node}=state.events,records=p.stations??[],last=records.at(-1);
 const active=last?.settled===null,i=active?records.length-1:records.length,c=seasons[i],age=state.life.ageDays;
 const remote=state.life.cultivationProfile.worldTier!==0;
 const desk='post-stations',book=menu('to-record','回到药路回单','post-history');
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const data=list=>({post:{...p,stations:list}});
 const update=change=>data([...records.slice(0,-1),{...last,...change}]);
 const work=(key,label,target,days,patch,items={})=>choice(key,label,'explore',target,'cautious',{next:desk,patch,rule:{days,items}});
 const result=(r,n)=>seasons[n].after[r.settled];
 const old=active?records.at(-2):last;
 if(!c)return row('两站合簿 · 拆下临时牌','回看两站实际接过的三份托付',records.flatMap((r,n)=>[seasons[n].works[r.plan],...(r.fog?[crossings[r.fog]]:[]),result(r,n)]),[book,menu('back','离开合簿，回去修行','hub')]);
 if(!active){
  const carry=old?result(old,i-1):p.route==='door'?'山脚来信认得你们当年送到门前的石阶。那户如今愿意给送信人留一盏灯。':'渡头来信还认得当年传匣的篷房。那处如今肯为你留一份过船簿。';
  return row('两站合簿 · '+c.title,'决定这一次两处共用之物托给谁',[carry,c.opening,'物件只有一份。托付之后可以照常闭关，也可以就地帮忙。'+c.days+'日后来看，两站各有自己的过法。'],[
   ...sites.map((site,n)=>menu('trust-'+n,'把'+c.asset+'托给'+site+'，'+c.jobs[n],desk,data([...records,{sent:age,plan:n,visits:[],settled:null,end:null}]))),book]);
 }
 const due=last.sent+c.days;
 if(age<due)return row(c.title+' · 托付已下','趁两站各自做工，自选如何度过这段日子',[c.works[last.plan],'离第一次交账还有'+(due-age)+'日。你能在此核材料、照料往来的货，也可以用本命功法闭一关。迟归仍可问两站，但新痕只留三十日。'],[
  choice('station-retreat','按本命功法稳修一关，回来读信','practice','self','steady',{next:desk}),
  work('station-work',remote?'校验寄来的料单，做到交账日':'跟着班头检料，做到交账日','supplies',due-age,{}),book]);
 const seen=last.visits.map(v=>v.site);
 if(node==='post-fog'){
  const flag=last.plan===0;
  if(last.fog==='turned')return row('粥棚下的回身路','回头再摸原记，或请卖粥人带路',[crossings.turned,flag?'粥棚挂的是小旗。他说挂过船旗的索上有三个并排的豁口。':'卖粥人拿碗底在木上轻轻敲了一下。歇脚处有一宽一窄两道门纹，系船柱只有一道深槽。'],[
   work('find-crossing','回到分岔处，照他说的摸索过去','supplies',1,update({fog:'found'})),
   work('ask-guide','请他领一段，把粥捎给他女儿','herbs',1,update({fog:'guided'})),menu('return-bank','先回班头处，不再赶船',desk)]);
  return row('大雾里走一次新帖','替等船的孩子找出登船的路',[
   '你来到埠头才发现，从纸上看一眼便懂的图，到了雾里连面前的手都伸不出多远。有人摇铃，有人喊粥热了。站你身旁的孩子说，娘亲去取落下的包，只叫他先去占个位子。',
   flag?'守船人教过怎样摸挂船旗的索：三面旗各有一个豁口。左边的索上三处扎手，右边那根缠得圆滑，远处正有人在喊。':'你记得歇脚帖的两道门纹。左手的木柱恰是一宽一窄两道，右边的木槽只深深磨了一道，槽边有擦过船舷的湿痕。',
  ],[...['left','right'].map((side,n)=>work('feel-'+side,n?'沿右手的旧记号试一程':'沿左手的旧记号试一程',n?'herbs':'supplies',1,update({fog:n===last.plan?'found':'turned'}))),
   choice('sense-oar','耗四点灵力贴柱听桨，领等船人过去','explore','stones','cautious',{next:desk,patch:update({fog:'carried'}),rule:{days:1,spiritCost:4}})]);
 }
 if(node==='post-settle'){
  const late=age>due+30;
  const options=c.fixes.map((label,n)=>{
   const days=n===2&&late?6:2;
   return work('settle-'+n,label+(n===2?'（'+days+'日，一份行粮）':'（两日）'),['supplies','herbs','stones'][n],days,update({settled:n,end:age+days}),n===2?{supplies:1}:{});
  });
  if(seen.length===1)options.splice(2,1,menu('hear-other','先去听另一站的人怎么说',desk));
  return row(c.title+' · 怎么收场','决定这份公物今后怎样照料',[...last.visits.map(v=>c.reports[v.site][last.plan]),seen.length===2?(late?'首班已经散去。要两处共议，得用六日访回当事人，再出一份行粮请他们到场。':'两站的经手人都还在。出一份行粮，让来回的人吃上饭，两日就能一起把办法订下。'):'另一站尚未回话。你可以就眼前所见订一处的办法，也可以先听齐两站。'],options);
 }
 const lines=[c.works[last.plan],...last.visits.map(v=>sites[v.site]+'的回话：'+c.reports[v.site][last.plan]+(v.day<=due+30?'这笔是交账当月留下的，当时的班还在。':'这笔是换班后从旧簿核回来的。'))];
 if(last.fog)lines.push(crossings[last.fog]);
 const choices=sites.flatMap((site,n)=>{
  if(seen.includes(n))return [];
  const days=journeyDays(old,p.route,n);
  return [work('visit-'+n,(remote?'寄函请':'到')+site+(remote?'回话':'查访')+'（'+days+'日）',n?'herbs':'supplies',days,update({visits:[...last.visits,{site:n,day:age+days}]}))];
 });
 if(seen.length)choices.push(menu('station-settle','依所见拟定今后的办法','post-settle'));
 if(i===2&&seen.length===2&&!remote&&(!last.fog||last.fog==='turned'))choices.push(menu('walk-fog',last.fog?'回粥棚问渡路':'进一次晨雾，自己照新帖走','post-fog'));
 choices.push(book);
 return row(c.title+' · 两站回话','了解托付之后两边各自付出的代价',lines,choices);
}
