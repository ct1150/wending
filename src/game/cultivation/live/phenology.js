import {exactKeys} from './schema.js';
import {DAYS_PER_YEAR,ITEMS} from './model.js';
import {V7_REALMS,realmFor,v7ActionRule} from './cultivation-rules.js';

// Each pot travels with the cultivator. Its two harvests are mutually exclusive.
const beds=[
 ['mortal','灯笼豆','灶户总得一只手举灯、一只手翻饼，第三只手去哪里借？他们送来一只打了洞的旧瓢，想装一种夜里自己透光的豆。','青荚的筋还软，拗下来能煮成走夜路的干粮。','熟荚里透出一点青光。把它埋进灯芯灰，灰冷后可以从荚底剥取药衣。','灶上的人把豆饼卷进布里，第一次腾出两只手端汤。','旧瓢里亮起一丛微光，夜间敷药的人终于看得清纱布的边。','supplies','herbs'],
 ['qi','纸背兰','一封山信过溪就会洇字。抄信人把废纸垫在兰盆底下，说叶浆和老根都能救信，手法却不一样。','新叶可捣成浆，和少许药草贴在皲裂的指节上。','干花搓出的粉能填细纸孔，密封药包也不会从纸缝里返潮。','药膏薄得还能透出指尖纹路，抄信人终于能亲手封函。','第一包草药过溪后仍是干的。送信的人把空纸叠好，打算再用。','medicine','herbs'],
 ['foundation','石耳粟','山路崩了一角，石匠拿来两段不同厚的桥石。湿粟穗能试出哪块先晃；熟壳散在缝里，能听出哪里仍空。','一边穗上结着露，另一边已经干了。趁两边分量不同，可以把穗缚在试桥石上。','熟壳薄得近乎透明，轻叩就响。现在取壳可以让补缝的人听出空处。','匠人没有把疑石丢掉，而是把它放在步道边，脚浅的人也有地方歇。试桥班留下了工粮。','桥腹里最后一个空隙响过之后，石工把替换下来的铁件交给你。','supplies','iron'],
 ['golden','抱盐藤','井边两家灶有一条祖传规矩：头卤不可同锅。偏有一条藤能从盐里分出甜水。先截哪一截，决定今年试的是哪一道工。','嫩蔓破口滴下淡水，够熬一小罐治盐裂的油膏。','老蔓把盐结成方晶，人能踩着它去找井壁裂口。','抬卤的肩膀抹过药，不必拿厚布硬磨旧伤。','漏井口补上了，灶户分你一袋随卤析出的灵石。','medicine','stones'],
 ['nascent','沉星苇','船上夜里辨水深要把竹篙插到底，水太急篙就折。造篙班寄来一块旧船板，请试一支能在水下自己沉住的苇。','青苇芯湿，剪下能给渡船换一道活扣。','熟苇穗黑如铁屑，撒在试水盆里会聚向最深的槽。','活扣遇急流自行松开，渡船带上两份干粮给后来接扣的人。','试水槽终于有了可核对的底线，船厂给你留下配重用的玄铁。','supplies','iron'],
 ['spirit','返声蕨','学徒们照同一面铜鼓报汛，却在空谷里听成两种拍子。试圃送来一枚蕨芽，问是先摘叶消回声，还是留到叶底结珠辨回声。','软叶擦过鼓沿，第二声便短了一截。','叶底小珠随两重回声先后跳动，刻下的两圈很容易区分。','守夜房不用再靠喊声盖过鼓音。耳伤用的那份药膏送还给你。','新的听汛尺从珠痕上拓出，制尺余下的灵石归入行囊。','medicine','stones'],
 ['void','缝雾菘','两块悬田漂开，中间留下吃雾的裂隙。旧办法是靠人沿边拔草，试圃想看看能不能用活叶把雾引回来。','嫩叶反面凝出湿线，很适合在裂隙边引出一条能走人的路。','老叶叠成一只小盏，雾沉进去便化成可提药的清露。','巡田人沿湿线走完一圈，把路上省下的一包口粮递过来。','悬田第一次不靠远处运水提药，多的一份药材被分给了种圃人。','supplies','herbs'],
 ['unity','双影榆','一束光经过两座浮山才落到树盆里。山合时嫩枝只投一影，山离时树皮会留下两道痕。修屋的人要你留一种证据。','一影时剪一截新枝，贴着屋梁便能找到暂时不用下钉的位置。','旧皮的两条暗线完整时，能量出屋梁两端一季要移开多远。','临时支梁卡住了斜檩，匠队把省下的钉铁交还。','新梁两端都留出伸缩口，工地按实付了测梁用的灵石。','iron','stones'],
 ['mahayana','归灰稻','几个山门各自带了一把旧灶灰，说稻若能在同一盆灰里结实，后来的人就能知道这些灶都真的烧过饭。有人盼第一次开锅，有人盼留下种。','青穗细软，搓开有新米味。如今收割可以把第一锅饭分给搬灰的人家。','熟谷沉入旧灰，壳一拈就脱。留下的谷衣可配药，谷心也能留作下一代的种样。','灶棚摆了许多小碗，最后还留了一包路粮给没有赶到的人。','谷衣配成了药。灶灰的来处各自写在纸包上，谁也没有被合成一个名字。','supplies','medicine'],
].map(([realm,name,commission,tips,ripe,tipsResult,fruitResult,tipsItem,fruitItem])=>({realm,name,commission,tips,ripe,tipsResult,fruitResult,tipsItem,fruitItem}));
const outcomes=['tips','fruit','root','scatter'];
export function gardenRootForChild(state){
 const g=state.events?.garden;
 if(g?.plot)return undefined;
 const last=g?.record.at(-1);
 return last?(last.take==='root'?last.bed:undefined):state.reincarnation?.gardenRoot;
}
export function gardenRootName(bed){
 if(!Number.isInteger(bed)||!beds[bed])throw new Error('行圃传种无效。');
 return beds[bed].name;
}
function windows(bed,grafted){
 const full=V7_REALMS[beds[bed].realm].practiceYears*DAYS_PER_YEAR;
 return {early:Math.floor(full/2),end:grafted?full+1:Math.floor(full*3/4),full,last:Math.floor(full*5/4)};
}
function available(t,w,elapsed){
 if(t==='tips')return elapsed>=w.early&&elapsed<=w.end;
 if(t==='scatter')return elapsed>w.last;
 return elapsed>=w.full&&elapsed<=w.last;
}
export function harvestWindows(state){
 const g=state.events.garden;
 if(!g?.plot)return [];
 const {bed,sown}=g.plot,last=g.record.at(-1),w=windows(bed,last?last.take==='root':state.reincarnation?.gardenRoot!==undefined);
 return [{name:beds[bed].name+'嫩候',open:sown+w.early,close:sown+w.end},{name:beds[bed].name+'熟候',open:sown+w.full,close:sown+w.last}];
}
export function validateGarden(g,life,root){
 exactKeys(g,['record','plot']);
 if(!Array.isArray(g.record)||g.record.length>beds.length)throw new Error('候物圃册数无效。');
 const seen=new Set();let lastDay=0,grafted=root!==undefined;
 for(const entry of [...g.record,...(g.plot===null?[]:[g.plot])]){
  const growing=entry===g.plot;
  exactKeys(entry,growing?['bed','sown']:['bed','sown','day','take']);
  const {bed,sown,day,take}=entry;
  if(!Number.isInteger(bed)||!beds[bed]||seen.has(bed)||!Number.isSafeInteger(sown)||sown<lastDay||life&&(sown>life.ageDays||bed>realmFor(life).rank))throw new Error('候物圃栽期无效。');
  seen.add(bed);
  if(growing)continue;
  if(!outcomes.includes(take)||!Number.isSafeInteger(day)||day<sown||life&&day>life.ageDays||!available(take,windows(bed,grafted),day-sown))throw new Error('候物圃采期无效。');
  lastDay=day;grafted=take==='root';
 }
}
function harvestText(entry){
 const b=beds[entry.bed];
 return entry.take==='tips'?b.tipsResult:entry.take==='fruit'?b.fruitResult:entry.take==='root'?'你把'+b.name+'连着母土移进小盆。这一株不作收成，用它覆护下一畦，嫩穗可以多留到正熟之后一日。':'盆面只余干壳。错过的收成留给了土里的小虫，当年的东西没有入囊。';
}
export function gardenNode(state,menu,choice){
 const {life,events}=state,g=events.garden??{record:[],plot:null},last=g.record.at(-1);
 const bed=g.plot?.bed??beds.findLastIndex((_,i)=>i<=realmFor(life).rank&&!g.record.some(e=>e.bed===i)),b=beds[bed];
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('train-menu','收好盆架，回去安排修行','training'),book=menu('garden-book','回到行圃看苗','garden-book');
 const reread=menu('garden-history','翻阅已采各畦的圃册','garden-history');
 const mountain=menu('mount-book','展开盆架下的折山石，入定寻路','mount-book');
 if(events.node==='garden-history')return row('行圃旧册','回看此生各畦的去处',g.record.map(e=>beds[e.bed].name+'。'+harvestText(e)),[book,mountain,back]);
 if(!g.plot){
  const lines=[...(last?[harvestText(last)]:state.reincarnation?.gardenRoot!==undefined?['盆底有先人封存的'+gardenRootName(state.reincarnation.gardenRoot)+'母土。第一畦的嫩候会延长。']:[]),...(b?[b.commission,'这一盆跟着你走。入定、寻材和远行都按同一日历生长。试圃按畦给种一次；这季怎样采收，由你亲自决定。']:[g.record.length===beds.length?'九只试种盆都还了回单。从最初的灯笼豆到归灰稻，你随身带回来的这本圃册里能查到每一处的采候。尚未栽入新畦的母土可以传给下一世。':'眼下能领的种已试过。圃册按实际采期留存。'])];
  if(last?.bed===0&&events.nursery?.end==='pot')lines.push('你把这一笔记在外院给的旧瓢背面。'+({tips:'当初灶房肯让出一株，如今干粮里真有你亲手种出的豆。',fruit:'从低畦带来的苗结出了药衣。你记得同一块田上，高处还铺着药棚的晒布。',root:'你把瓢底剩的土包起来。外院的这一株，还能护住下次栽下的苗。',scatter:'当初系瓢的草绳还在。掀起干壳，里头已经空了。'}[last.take]));
  return row(b?'候物行圃 · '+b.name:'候物行圃 · 归册','决定是否照料下一畦',lines,[
   ...(b?[choice('sow','接下'+b.name+'，花一日栽进盆中','explore','herbs','cautious',{next:'garden-book',patch:{garden:{...g,plot:{bed,sown:life.ageDays+1}}},rule:{days:1}})]:[]),
   ...(last?[reread]:[]),...(!b||!last?[mountain]:[]),back]);
 }
 const elapsed=life.ageDays-g.plot.sown,w=windows(bed,last?last.take==='root':state.reincarnation?.gardenRoot!==undefined);
 const tips=available('tips',w,elapsed),ripe=available('fruit',w,elapsed),late=available('scatter',w,elapsed);
 const due=elapsed<w.early?w.early:elapsed<w.full?w.full:null;
 const timing='栽后过了'+elapsed+'日。嫩候为第'+w.early+'至'+w.end+'日，熟候为第'+w.full+'至'+w.last+'日。';
 const signs=[b.commission,timing,...(tips?[b.tips]:[]),...(ripe?[b.ripe]:[]),...(late?['外壳自行裂开，种实已散入盆土，不能追收。']:[])];
 const pick=(take,label,item)=>choice('pick-'+take,label,'explore','herbs',take==='root'?'bold':'cautious',{next:'garden-book',optionalGift:true,
  patch:{garden:{plot:null,record:[...g.record,{...g.plot,day:life.ageDays,take}]}},rule:{days:1,...(item?{gain:{[item]:1}}:{})}});
 if(events.node==='garden-practice'){
  const methods=[choice('garden-steady','在盆旁依本命功法稳修','practice','self','steady',{next:'garden-book'}),
   choice('garden-intensive','备一份行粮，压短这次修期','practice','self','intensive',{next:'garden-book'})];
  const forecasts=methods.map(p=>{
   const rule=v7ActionRule(state,p),day=elapsed+rule.days,name=p.approach==='steady'?'稳修':'苦修';
   if(rule.reason)return name+'眼下不可行：'+rule.reason;
   if(life.ageDays+rule.days>=life.lifeLimit*DAYS_PER_YEAR)return name+'需要'+rule.days+'日，照此安排会在关中寿尽。';
   const tender=available('tips',w,day),mature=available('fruit',w,day);
   const condition=tender&&mature?'嫩收和留熟都来得及':tender?'还可嫩收':mature?'可收熟实或留母土':day>w.last?'已经散种':day<w.early?'尚未到嫩候':'嫩候已过，熟候未到';
   return name+'按本命功法需'+rule.days+'日，届时是栽后第'+day+'日，'+condition+'。';
  });
  if(!life.items.supplies){
   const forage=choice('forage','出山寻一份行粮，再回盆边','explore','supplies','cautious',{next:'garden-practice'});
   const cost=v7ActionRule(state,forage);
   methods[1]=forage;
   forecasts.push('先找行粮会另外经过'+cost.days+'日，归来时是栽后第'+(elapsed+cost.days)+'日。搜寻可能落空。');
  }
  return row(b.name+' · 圃边入定','衡量收成期限、行粮和本命功法的风险',[timing,...forecasts,'苦修另用一份行粮。练功失手时盆中也照样过日。'],[...methods,book]);
 }
 if(events.node==='garden-ripe'&&ripe)return row(b.name+' · 留种还是取用','决定这一季的熟实归何处',[b.ripe,'取用可得到一份'+ITEMS[b.fruitItem]+'。留下母土则可护住下一畦的嫩候；若还有别处要去，现在也能放回盆边。'],[
  pick('fruit','采熟实交付，收下'+ITEMS[b.fruitItem],b.fruitItem),pick('root','留作母土，护住下一畦'),book]);
 if(events.node==='garden-pick')return row(b.name+' · 察候','判断本次采候，或留下照料',signs,[
  ...(tips?[pick('tips','剪嫩穗交付，收下'+ITEMS[b.tipsItem],b.tipsItem)]:[]),
  ...(ripe?[menu('ripe','分辨熟实与留种的去处','garden-ripe')]:[]),
  ...(late?[pick('scatter','将散壳拢回土中，记下错过的这一季')]:[]),
  ...(due!==null?[choice('tend','留圃照料至第'+due+'日，只候物候','craft','manual','study',{next:'garden-book',rule:{days:due-elapsed}})]:[]),book]);
 const a=state.lastReceipt?.action;
 const practice=a?.intent==='practice'?'这一关实际经过'+state.lastReceipt.elapsedDays+'日，'+(state.lastReceipt.cultivationResult?.check?.success===false?'练功未成，伤势按收据留下。':'修为按本命功法结算。'):'';
 return row('候物行圃 · '+b.name,'选择怎样度过这一候',[...signs,...(practice?[practice]:[])],[
  menu('practice-bed','衡量稳修或苦修的时日','garden-practice'),menu('inspect-bed','验看枝叶，决定采收或照料','garden-pick'),back]);
}
