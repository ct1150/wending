import {realmFor,V7_REALMS} from './cultivation-rules.js';
import {exactKeys} from './schema.js';
import {trailNode,validateTrail} from './deer-trail.js';
import {dingNode,validateDing} from './mountain-ding.js';

// The same nine commissions can follow one cultivator through successive
// retreats. Each entry concerns the watch outside, not the rolls inside.
const watches=[
 {
  title:'第一盏灶灯',object:'灯罩上的水线',publicKeeper:0,
  opening:'第一次借关室，门旁竟有一小方灶台。送饭人说是给守夜者留的。天冷时烟会扑进旧灶，隔壁的药锅也会冒同样的白气。若一见白气就开窗，药锅容易熬坏；若一直不开窗，饭舍又住不得人。你坐进去之前可以把这件事托给一个班。',
  keepers:[
   ['送饭班','从井口到灶边一日走三回，能先闻到扑烟。','送饭人闻到了焦米味，碗底却还是干的。','饭舍开了背风窗。孩子们在窗边吃完热饭，药工另用一绺棉絮护住药锅。','窗子没有动。药锅保住了火候，送饭人把火盆移到屋檐下，抱着碗陪孩子们吃完。'],
   ['看药班','药工能分辨水气走向，顾虑的是学徒总因锅盖抖动被责备。','药工摸到冷锅盖，另一个人取来的湿灯罩也留有水线。','药工循水线把锅移离烟道，学徒不用替一阵倒风写过失帖。','药锅原地留着。等烟向已明，旧灶旁才挂起提醒后来人的湿罩。'],
  ],
  pass:'把点灯的方法留给下一个开窗的人。',seal:'把当夜是谁看锅的那一栏还给药工，只公布烟向。'
 },
 {
  title:'水帘后那只空桶',object:'桶底的砂印',publicKeeper:1,
  opening:'炼气后借到一间水帘后的静室。关外两条水沟轮流给山脚供水，山户只听见空桶撞壁，就以为该放下一沟。其实补桶的孩子也爱拿木片敲同一个音。他怕被赶走，从不敢当着分水人试自己修过的桶。',
  keepers:[
   ['补桶班','肯沿桶壁找刚修过的榫眼，不想让学徒先认错。','木榫在响，桶底却有一圈还没被水冲散的干砂。','补桶人把空桶提上石台，当众让学徒试榫。山户等到另一沟真正来水才下种。','空桶留在原处。分水人先走完一遍沟渠，学徒也有一晚把尚未合拢的木榫补好。'],
   ['分水班','知道上沟哪一段先干，愿按实测水头放水。','分水人摸到上沟底的硬泥；下沟的水仍齐着第一块刻石。','先开的水闸把一小股水送到枯沟，两边的桶都能盛满，不必拿声音当号令。','两沟先按旧时辰轮水。干地晚浇了一遍，守水人顺着慢下来的水头找到一块卡闸的石子。'],
  ],pass:'把砂印摹在桶底的新刻尺上。',seal:'砂印原样归补桶班，分水榜只记水头。'
 },
 {
  title:'隔墙的回春草',object:'叶背冷纹',publicKeeper:0,
  opening:'筑基静室外有一面长草的石墙。墙阴给受伤的脚夫歇腿，墙阳养着回春草。两面同时起霜时，挪走石砖可以护住药苗，却会把睡人的地方吹透。药户和脚夫都想知道这霜到底来自泥里还是来自关室的冷泉。',
  keepers:[
   ['采叶班','愿用留在叶背的纹路辨霜，不肯把病草混给求药的人。','最近泉的一排叶片有横纹，远排的叶尖却先变白。','采叶人收起见霜的外叶，内层幼芽另罩一张竹帘。脚夫把剩下的两块墙砖自己砌回去。','采叶人暂不动砖，把霜纹压进蜡里。晚来的药户看见原样，留下愿供试种的一畦芽。'],
   ['歇脚棚','有人每更换一次茶水，能感到墙缝灌出的风。','同一壶茶放墙边先冷，移出两步却能腾起水汽。','棚里换了坐席方向，茶水离墙两步，旧砖仍护着药苗。脚夫在缝边系了一条辨风的草带。','茶水照旧凉了两壶。有人守住茶摊记录风向，天明才把睡席换到棚的另一头。'],
  ],pass:'将冷纹画在公共试种牌上。',seal:'将原叶归还药户，准他们自己决定谁能取样。'
 },
 {
  title:'炉里那半片月',object:'裂镜的反面',publicKeeper:1,
  opening:'结丹关外的旧炉只照见半边火心。守炉人拿半幅月形铜片作镜，一面亮一面暗，火一旺，铜镜和炉门都会发出裂响。上一次有人听声便把炉泥整个敲掉，丢了一炉应给山村的冬釜。',
  keepers:[
   ['泥范班','认得陶泥收缩的裂口，想保住已经烧出花纹的几只小釜。','泥范裂在脚边，裂缝里的火色却和炉门内侧不同。','泥范班先用新泥托住脚边，细釜晚半炉出窑，原有花纹还在。','泥范班留着裂口供人验火，先把村里借来的铁釜交回去过冬。'],
   ['照炉班','懂得看铜片背面的余辉，宁愿停火一刻也不凭裂响处置。','照炉人旋转铜片，裂影只随镜转，炉壁上的火线仍是一条。','铜片换面，火口照旧。学徒为镜背刻了一角小月，让下班人知道它曾裂过。','照炉人先收了镜，待炉冷再察裂影。村里拿到几只素釜，把精细活计留到来春。'],
  ],pass:'让炉户共拓镜背月纹。',seal:'将裂镜送还原匠，公示只附辨影办法。'
 },
 {
  title:'夜渡不鸣钟',object:'船沿的潮笔',publicKeeper:0,
  opening:'元婴关借在夜渡口上。为了让归船认岸，旧规是见灯便鸣钟；新搬来的驳工有人只看得到水上倒影。岸钟一错，近岸船反倒会冲向深滩。桥头人请求你入定前写下他们可以改挂灯号的条件。',
  keepers:[
   ['驳工班','站在甲板上看灯，知道先被遮住的是哪一盏。','驳工看见船沿的潮笔忽然向内拖长，水上的黄影却没跟着动。','驳工在船首改挂低灯，靠岸的人先见船沿，再见水影。钟手等到船绳抛上岸才敲钟。','船首沿旧路慢行，岸上迟迟没有钟声。一船人看清了滩影，留下次夜可查的吃水线。'],
   ['桥钟班','肯把钟槌放下到桥脚看一次，省得听别人报错灯色。','钟手从桥脚看见真灯被船棚挡过一次，倒影却一直亮着。','钟手先挂出一面窄旗，船棚移开时再击一声。两岸听到的是靠稳的钟。','钟手守住不鸣的约定。驳工轮流传绳，第一班船靠自己的灯摸到了岸。'],
  ],pass:'把潮笔拓页借给别处的夜渡。',seal:'把原页交还驳工，船主的夜路仍由本人说明。'
 },
 {
  title:'写给空席的药方',object:'药碗边沿的记号',publicKeeper:1,
  opening:'化神静室旁是一座给过路人留饭的廊。几张药方被压在空碗底下，后来的饭头以为每个过路人都该照方分食。写方的人早走了，当初只替一位客人换过几味草。现在这张无人的座次表该由谁看？',
  keepers:[
   ['留席班','记得各张凳子从哪家借来，想把空位留给迟到的人。','凳背有两道换手的磨痕，碗沿却只有原来一人的记号。','留席人把有记号的碗分开放，后来的人先自己选座，再说明吃得惯什么。','留席人继续守着旧凳。客人坐了新借的长条椅，第一次用一张桌子吃完一餐。'],
   ['配膳班','手里有多份原方，愿先对清各碗的由来。','配膳人对过两只碗，方子近似，碗沿记号的开口却在相反方向。','公廊撤下挂错的通方，仍为认识碗沿的人保留改膳的门路。','配膳人先供清淡的公餐，等各家带回记号才分别开灶。'],
  ],pass:'留下不记姓名的辨碗抄本。',seal:'原方各还其主，空席永远可以有人另坐。'
 },
 {
  title:'倒着走的影子',object:'坡壁上的影痕',publicKeeper:0,
  opening:'炼虚关的石窗有时把下坡路照成上坡。石级没有移动，挑担人却会被影子绊住。守关班请你决定：外路上的人要不要信石窗里的指示，还是先找一个站在路上的人？',
  keepers:[
   ['挑担班','愿走过每节石级再报坡向，怕同伴看错一步伤了脚。','挑担人把水葫芦平放，水却流向窗里看似更高的一端。','担子改从向水的一侧过，暗处加了手杖可摸的凿痕。','挑担人先把货卸下，等正午的光照回石面才牵人一担一担过坡。'],
   ['擦窗班','能分辨虚影与实景，愿让窗开一道过路人能问话的缝。','擦窗人从窗沿刮下两重尘影，外侧草屑始终指向同一面。','旧窗打开窄缝，来客听到了脚下的人喊坡向，虚影留作教学。','旧窗先挂帘，由坡下的人举白石引路。后来人掀帘时还能亲眼比对两个方向。'],
  ],pass:'让过坡人抄走影痕和水向。',seal:'只留下手杖凿痕，将原景还给窗户主人。'
 },
 {
  title:'两院共用一口井',object:'井绳末端的双结',publicKeeper:1,
  opening:'合体关前，两院因修井合住过一个冬天。春来院墙重新砌起，井绳却只有一根。有人想把两院的修行口令并成一句；有人觉得，肯借对方一桶水，原本就不需要两家人说成同一个声音。',
  keepers:[
   ['绞轮班','听得到另一院提水时的轮声，愿为慢一步的人留一圈余绳。','绞轮只有一圈湿，另一端却拖了半尺，像有人放下重物又重新提起。','绞轮班先留出余绳，两院一先一后提起了各自的水桶。','绞轮班把轮停在半圈，等两院各派一人来摸绳。随后各自在桶沿画了水位线。'],
   ['井底班','认得双结各自的结法，坚持让后来者能解开自己的一结。','井底人摸到两枚绳结都在，同侧磨损的是替换过的那一枚。','井底班换了坏结，留下两家的旧手法。提水的人仍能从手感辨出另一端是谁。','旧结收起，轮班改在地面交接空桶。两家终于有了当面说话的地方。'],
  ],pass:'开放双结的编法，让别井也能留出余绳。',seal:'将结样分归两院，借水的约定不记作同门。'
 },
 {
  title:'交出最后一把门匙',object:'门槛下的素木楔',publicKeeper:0,
  opening:'大乘关前，旧守关簿已厚得能垫起一张桌。新来的人问，你退关之后还要不要亲自决定谁可入门。纸页上有许多早已换了班的人手印；你能安排的，是最后一次闭关期间怎样交接，而非替他们把以后的每一天先过完。',
  keepers:[
   ['启门班','每次换班重试木楔，愿让门内的人也能亲手移开它。','木楔刚从门内推过半寸，外边的灰痕却一直没断。','启门人松开外楔，门内外各有一只伸得到的把手。后来的值班者自己决定何时再试一次。','启门班把楔痕记下，暂留两道门，给下一任一整日亲手试关。'],
   ['收簿班','愿收好已结束的托付，怕有人把很久以前的签名拿来重开旧门。','收簿人把末页迎光照过，只见交班的指印，没有准入的人名。','收簿班将过期帖一一退还。后来的人带着新约入门，说得清是谁在这一刻答应。','收簿班保留原帖供核，另铺白纸记新一轮交接。旧名没有变成旁人的钥匙。'],
  ],pass:'把试门法交给后来值守者。',seal:'封还原簿，由下一关重新商定门约。'
 },
];

const empty=()=>({record:[],draft:null});
function checkEntry(x,closed){
 exactKeys(x,['keeper','marks','days','success',...(closed?['shared']:[])]);
 if(![0,1].includes(x.keeper)||![null,1,2].includes(x.marks)||
    (x.days===null?x.success!==null:!Number.isSafeInteger(x.days)||x.days<1||typeof x.success!=='boolean'||x.marks===null)||
    closed&&(x.days===null||typeof x.shared!=='boolean'))throw new Error('守关回执无效。');
}
export function validateWatch(w){
 exactKeys(w,['record','draft'],['trail','ding']);
 if(!Array.isArray(w.record)||w.record.length>watches.length||w.record.length===watches.length&&w.draft!==null)throw new Error('守关簿卷数无效。');
 for(const entry of w.record)checkEntry(entry,true);
 if(w.draft!==null)checkEntry(w.draft,false);
 if(Object.hasOwn(w,'ding')){
  if(w.record.length!==watches.length)throw new Error('守关未毕，山门尚未开范。');
  validateDing(w.ding);
 }
 if(Object.hasOwn(w,'trail')){
  if(!w.record.length)throw new Error('栗溪行程尚未开启。');
  validateTrail(w.trail);
 }
}
function hasSecond(index,record,keeper){
 if(index===0)return keeper===1;
 return record[index-1].shared===(keeper===watches[index].publicKeeper);
}
function report(index,record,draft){
 const c=watches[index],person=c.keepers[draft.keeper],both=hasSecond(index,record,draft.keeper);
 return [person[0]+'照着你留下的字条值守。'+(draft.marks===1?'凭当值见闻即可先办。':'须两道凭据相合才办。'),person[2],both?'另一班用独立的留样核实，两道凭据都已齐全。':'当时只有这一班的见闻，另一道凭据未能核实。',
  draft.marks===1||both?person[3]:person[4]];
}
export function watchNode(state,menu,choice){
 const w=state.events.watch??empty(),d=w.draft,i=w.record.length,c=watches[i],node=state.events.node;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=draft=>({watch:{...w,draft}});
 const book=menu('watch-book','翻回守关簿','watch-book'),train=menu('watch-later','收起守关簿，安排修行','training');
 const mentor=menu('mentor-menu','验看功法与师承','mentor');
 const trail=menu('deer-trail',w.trail?'到驿棚查栗溪的近况':'去驿棚看看背篓里那只小鹿','watch-trail');
 const contacts=w.record.length?menu('watch-visitors','探访驿棚来客，或验看功法','watch-visitors'):mentor;
 if(node.startsWith('watch-trail'))return trailNode(state,menu,choice);
 if(node.startsWith('watch-ding-'))return dingNode(state,watches,menu,choice,row,book,train);
 if(node==='watch-visitors')return row('值夜班的饭棚','找行脚人，或查功法来路',['灶边有给过路人留的矮凳。牧女陶禾的栗溪行程在驿棚留有消息；若想验看自己的修行法门，仍可从这里回去找师承。'],[trail,mentor,book]);
 if(node==='watch-receipt'){
  const last=w.record[i-1],prior=watches[i-1];
  return row(prior.title+' · 交割','读值守人的回执',[...report(i-1,w.record,last),last.shared?prior.pass:prior.seal],[book,trail,train]);
 }
 if(!c)return row('山门长开 · 守关簿合卷','回看此生九次守关的实情',['簿中九道关并非同时关闭。每次翻开，都是当时的人替你照料那些关不到门内的日子。',...w.record.map((v,n)=>watches[n].title+'。'+report(n,w.record,v).at(-1)+(v.shared?watches[n].pass:watches[n].seal))],[menu('ding-book','去山门铸坊，看看问鼎之约','watch-ding-book'),train,contacts]);
 const needed=Object.values(V7_REALMS)[i],rank=realmFor(state.life).rank;
 if(rank<i)return row('山门守关簿 · 待再入定','到'+needed.name+'再接这一关的委托',[w.record.at(-1)?.shared?'上一处留下了可公开比对的底稿。':'上一处已把原样交还当事人。','下一折「'+c.title+'」要在'+needed.name+'的闭关里亲历。'],[train,contacts]);
 if(node==='watch-book'){
  const resume=d?.days?['读闭关时留下的回信','watch-report']:d?.marks?['核对上次留好的守关字条','watch-sit']:d?['接着商量值守条件','watch-orders']:['查看两班人各自能查到什么','watch-people'];
  return row('山门守关簿','第'+(i+1)+'关 · '+c.title,[c.opening,'你亲自决定是否以本命功法闭关一次。守关人仅负责关外事务，何时行动由你预先写定。已入定的年月、灵力和得失都按人物实际功法结算。',...(d?.days?['这一关已经出定。待你读过值守回信，再决定原样的去处。']:[])],[menu('watch-open',...resume),contacts,train]);
 }
 const previous=w.record[i-1];
 const handoff=i===0?'初次设关，看药班另备了湿灯罩，可用来独立复核。':
  previous.shared?'前关公开了「'+watches[i-1].object+'」的验法。'+c.keepers[c.publicKeeper][0]+'依此另备一份同时取下的留样，可以作第二道凭据。':
  '前关只归还原样。当事人同意由'+c.keepers[1-c.publicKeeper][0]+'独立核对私存的样本，具体身份留在原簿。';
 if(node==='watch-people')return row(c.title+' · 值更的两班','把这一次关外事务托给一班',[c.opening,...c.keepers.map(p=>p[0]+'。'+p[1]),handoff],[...c.keepers.map((p,k)=>menu('keeper-'+k,'委托'+p[0],'watch-orders',patch({keeper:k,marks:null,days:null,success:null}))),book]);
 const person=c.keepers[d.keeper];
 if(node==='watch-orders')return row(c.title+' · 留条','决定守关人何时可以先办',['你选的是'+person[0]+'。'+person[1],handoff,'你可以授权当班人凭亲眼所见先办，也可以约定两份独立凭据相合才办。后一种约定遇到凭据不足时，按原安排守候到出关。'],[menu('one-mark','凭当值见闻，准其先行处置','watch-sit',patch({...d,marks:1})),menu('two-marks','须两道凭据相合，再行处置','watch-sit',patch({...d,marks:2})),menu('choose-keeper','回去重选值守班','watch-people')]);
 if(node==='watch-sit')return row(c.title+' · 入定前','核对约定，再决定是否真的闭关',[person[0]+'已收条。'+(d.marks===1?'一班亲眼所见即可先办。':'须两道凭据相合才可先办。'),'尚可改约或去整备。只有按下入定，才会按当前境界真正闭关。'],[choice('sit-watch','依本命功法入定，交值守班照约办事','practice','self','steady',{next:'watch-report'}),menu('change-order','改写值守条件','watch-orders'),train]);
 if(node==='watch-report')return row(c.title+' · 出关来信','依实际后果安排底稿与原样',[d.success?'你按本命功法结束这一关，共过了'+d.days+'日。':'这次修炼检定未成，仍实际经过了'+d.days+'日。关外的值守人照约办了自己的事。',...report(i,w.record,d),c.pass+'也可另行封存。'],[
  ...[true,false].map(shared=>menu(shared?'leave-copy':'seal-original',shared?'留下可复核的公用底稿':'封还原样，留给当事人核对','watch-receipt',{watch:{...w,record:[...w.record,{...d,shared}],draft:null}})),train]);
 throw new Error('守关簿页次无效。');
}

export function inscriptionText(inscription){
 const names=inscription.pieces.map(p=>p.shared?'「'+watches[p.foot].object+'」':'「'+watches[p.foot].title+'」留下的无名榫');
 return '随行的旧物中有一纸鼎铭传拓，三足记着'+names.join('、')+'。'+(inscription.form==='hall'?'前人把三足合在山门的公器上。':'前人令器物分归各地，山门留下空范。');
}
