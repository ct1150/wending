import {realmFor,TECHNIQUES} from './cultivation-rules.js';
import {exactKeys} from './schema.js';

// The stone unfolds during ordinary retreats. The room, not the engine roll,
// determines what the player can learn from looking or listening.
const rooms=[
 {
  title:'井底朝上的星',rank:0,
  scene:'井绳垂进天里。井底有两扇门，一扇漏出煮米的香气，一扇淌着细沙。井台上只坐着一个指头长的泥人，肚脐眼里插了一管芦哨。他说：「我叫小满。这里所有东西都记得怎么回去。可他们没给我捏脚。」',
  sights:['盯住粥锅上升的热气','侧耳听井筒里漏下的沙'],
  signs:['锅气浮上门楣，凝成水滴，却一路往米香的反方向滚。煮粥的屋是水面上的倒影。','井里每漏下一撮沙，另一侧就响一声锅铲。沙声在先，铲声在后。响亮的屋子在学安静的屋子。'],
  paths:['推开有米香的门','伸手穿过细沙帘'],right:1,
  good:'细沙顺衣袖漏尽，你踩到干燥的井沿。小满还趴在你袖口，顽固地用没长脚的地方蹬了一下。',
  lost:'你在灶边坐了很久，等一锅已经熟了几十次的粥。直到小满伸手往碗底一戳，灶台才从你膝上滑开。',
 },{
  title:'瘸了一条腿的屋子',rank:0,
  scene:'井外只有半间草屋。一根屋柱卷着刨花，另一根柱上有一溜鸟爪印。小满说他记得木匠把他搁在门槛上，也记得门槛会走；这两件事他不肯放弃任何一件。',
  sights:['贴近刨花，看断屑往哪儿飞','把耳朵伏在两根屋柱之间'],
  signs:['新刨下的木屑飘过鸟印，稳稳落在原地。真正挪动的是另一根柱子，连着刨花底下那片地。','啄木鸟叩完三下，石地还有一下迟来的闷响。声从卷着刨花的柱脚传来。'],
  paths:['踏上卷刨花的那只屋脚','攀住留鸟印的柱身'],right:0,
  good:'屋子从脚底下拔起，一步就跨过井壁。你把小满放在窗台上，他第一次自己决定往哪一边看。',
  lost:'等到日影移过鸟印，屋子已经走远。你和一只货真价实的啄木鸟面面相觑，身下只有原来的井台。',
 },{
  title:'松根上的倒行人',rank:2,
  scene:'松林里每棵树的根都朝天。一个披蓑衣的人倒退着走路，每走一步，身前便多出一双不同大小的脚印。小满拱出半截刚捏成形的泥脚比了比，那些脚印里没有一双合他的身。',
  sights:['掸掉脚印边缘的新土','听蓑衣底下两只木屐'],
  signs:['大印旁的苔只在边缘翘起，是木屐盖出来的。小印底下有断开的根尖，新泥从里面往外翻。','木屐落地有两声，第三声更轻，从小印底下传来。蓑衣人正踩着别人的步子倒退。'],
  paths:['追上披蓑衣的大脚印','顺着小印走进树根'],right:1,
  good:'根底下的小东西抬起脸。那是一粒要找土的松子。每逢它挪一下地方，那个倒走的人才有一步能走。',
  lost:'蓑衣转过脸，里面竟然是空的。木屐翻过来时你看清鞋底的阴刻，一整排大脚印都从同一块木头上翻来。',
 },{
  title:'整座林子只借一把风',rank:2,
  scene:'树顶没有风。两根风筝线垂到膝前，一根绷得笔直，一根松得像要掉下去。小满把脸埋进针叶：「原来我也会怕高。以前连能跌下去的地方都没有。」',
  sights:['看松针粘在哪根线上','闭眼听线越过树皮时的声音'],
  signs:['松线上粘着新针，针尖时不时朝上点头。紧线一丝不动，连蛛网都跨过它结牢。','松线每向上抽动一寸，树皮就轻轻嘶一声。紧线上那阵长鸣跟你衣角的颤动合拍，只是回音。'],
  paths:['让松线牵着往上走','沿绷紧的线往外攀'],right:0,
  good:'风筝借了你一阵风。针叶从脚边变成细点，小满终于敢往下看一眼，半晌没说害怕，也没说不怕。',
  lost:'紧线尽头拴着另一棵树。两棵树之间是张无声的蛛网。小满替你解开袖口的蛛丝，自己却打了一个喷嚏。',
 },{
  title:'雪地里空出的一双脚',rank:5,
  scene:'山顶落雪，路上有两列足迹。一列走向石溪村的炊烟，一列朝山脊退去。你用手盖住最后一枚足印，掌心里传来的温度和你离乡那日一样。小满问：「若有人用你的脚走完了，这还算你回去过吗？」',
  sights:['去看足印边的积雪','停下来听雪被踩碎的先后'],
  signs:['朝村里去的足印先有了一个空洞，雪才落进去。山脊那一列有斜裂的雪壳，脚确实曾压在上面。','村里的声音总在印子陷下去之后响起，像有人在学你走路。山脊那头枝条折断，接着才有一步。'],
  paths:['跟着回村的足印走','逆着山脊的足印迎上去'],right:1,
  good:'山脊尽头的人长着你初离村时的脸。他背着一个空行囊，一直等着后来的人告诉他，山外究竟还有什么。',
  lost:'灶火前的你盛好了饭，连筷子停在哪里都记得。你试着把碗往左推半寸，它却每次都回到掌纹正中。这间屋只能重复。',
 },{
  title:'最后一道门没有背面',rank:5,
  scene:'山的折痕压出一道门槛。门旁有一面铜镜，镜背刻着开门用的手势。石缝里却渗出冷风。小满走到镜前，没有照出自己。他笑着摸摸脸，原来先有一张看不见的脸也可以。',
  sights:['把袖角伸进门和镜的缝隙','一面转动镜子，一面听风'],
  signs:['镜面映着袖子高高扬起，你自己的袖口却只被石缝往里吸。真正通气的是未磨平的边。','镜子朝哪儿转，响声都跟你同高。石缝那点风低得贴着脚踝，小满站在旁边，泥衣却真的鼓了起来。'],
  paths:['沿渗风的石边撬开一线','按镜中手势推门'],right:0,
  good:'你从门的侧面出来，身后留下一条能让比你矮的人也走过的缝。等你回头，小满已经自己走到这边。',
  lost:'镜中人替你推开镜中门。他走向又一面更亮的镜，你却还在石头里。小满敲了敲你的真手，叫你回过神。',
 },
];
const items=['芦哨','风筝线'];
const tokenClues=[
 '芦哨贴在小印上会发颤，贴上大印却哑了。',
 '松线抖动时，芦哨的声音跟着忽高忽低。',
 '你把筝线搭过雪壳，它只在朝山脊的那头陷进了裂纹。',
 '筝线贴过镜面一点不动，移到石缝却向里弯了半寸。',
];
const homeDoor={
 title:'家门前多出的一双碗',rank:5,
 scene:'石溪村的灶边坐着当年背行囊的少年。桌上有两只碗。一只补了青瓷片，你记得离家前它就在这里；另一只空碗粗糙得很，连烧过的火色都没有。小满刚好能蹲进去。他问：「家里原先没有我，还能给我留个地方么？」',
 sights:['看两只碗在灶边投下的影子','把碗轻轻倒扣，听桌板的响动'],
 signs:['补过的碗影里，门外的炊烟一点也不动。空碗边却添了一道细细的泥指印；小满刚刚才从那儿爬过去。','旧碗无论扣几回都响三下，是那顿旧饭记住的声音。空碗响得参差，你扶着桌角，才发现桌子少垫了一块石头。'],
 paths:['端起旧碗，照儿时的顺序摆桌','把空碗添到少年与自己之间'],right:1,
 good:'你顺手把折石垫在桌脚下，桌面就平了。少年想了一会儿，把自己的凳子挪开一半。小满得了一个以前根本没有的位置。',
 lost:'最后一只筷子放回旧地方，少年便又要出村了。你看着他背起同一只包，终于明白这一桌只能重摆过往那顿饭。',
};
const roomFor=(m,i)=>i===5&&m.wish==='home'?homeDoor:rooms[i];
const byways={
 0:{title:'不能凉下来的一碗粥',scene:'你绕到灶屋背面。一只没画眼睛的泥猫蹲在锅边，每当粥刚凉到能入口，屋里的人便把它倒回锅里。小满捧起一只空碗，问你有没有一样东西能从山外带进来，吃完就真的没有了。',
  acts:['分一份自己的行粮，和泥猫吃完','借走空碗，让灶屋少盛一回'],keys:['meal','bowl'],
  results:['泥猫第一次把一样东西吃完，又舔了舔空爪。小满也分到一点碎屑，问你山外是不是常常要为下一顿打算。','你把小碗揣进衣服。灶边的人照旧去盛粥，锅边却少一只碗，只好多看了一眼那只泥猫。']},
 2:{title:'一枚没有去处的松子',scene:'你沿着木屐留下的凹处绕了三日，走到林子背阴的一边。雪水浸出一粒松子。它带着浅白的根尖，已经腾不出手再抓住树枝。小满把手伸过去，等你决定要不要带它继续赶路。',
  acts:['松开冻土，把它种在眼前的山坡','托在井底带来的小碗里，带它去雪脊'],keys:['sow','carry'],
  results:['土盖过根尖时，松子便再也拿不起来。小满记住这一小块不再跟着你们移动的山坡。','井底的空碗装了一把泥。根尖长过碗沿，小满换着手托住它，没叫你一个人捧完全程。']},
 4:{title:'出村前没说完的话',scene:'三日绕行把你带到灶屋的后窗。窗里那个还没出村的少年解了又系肩带，一遍遍问，若多年后回来，门外还会不会有人等。你知道他听不清一句完整的回答，但你可以留一点自己的声音。',
  acts:['把这些年的一件小事讲给他听','在他整好行囊以前，一直陪他坐着'],keys:['speak','sit'],
  results:['你说起小满第一次在山顶怕高的模样。少年听见一句零散的笑声，系好行囊，也轻轻地笑了一下。','直到最后一道绳结系好，你都留在窗边。少年走时没有求你许诺一个归期，只把门给你虚掩着。']},
};
const cleared=['found','corrected','around','guided'];
const completed=r=>cleared.includes(r.exit);
export function validateMountain(m,life,node){
 exactKeys(m,['wish','walk','gifts','ending']);
 if(!['home','source'].includes(m.wish)||!Array.isArray(m.walk)||m.walk.length>rooms.length||!Array.isArray(m.gifts)||m.gifts.length>2||
    !m.gifts.every(g=>['keep','give'].includes(g))||![null,'open','send'].includes(m.ending))throw new Error('折山行履无效。');
 let day=0;
 for(const [i,r] of m.walk.entries()){
  exactKeys(r,['sense','method','technique','ok','days','woke','exit'],['turning']);
  if(![0,1].includes(r.sense)||!['steady','intensive'].includes(r.method)||typeof r.ok!=='boolean'||r.method==='steady'&&!r.ok||
     !Number.isSafeInteger(r.days)||r.days<1||!Number.isSafeInteger(r.woke)||r.woke-r.days<day||life&&(r.woke>life.ageDays||realmFor(life).rank<rooms[i].rank)||
     !Object.hasOwn(TECHNIQUES,r.technique)||![null,'lost','reading','bypath',...cleared].includes(r.exit)||r.exit==='guided'&&!m.gifts.slice(0,Math.floor(i/2)).includes('give')||
     !completed(r)&&i!==m.walk.length-1||m.gifts.length<Math.floor(i/2))throw new Error('折山入定记录无效。');
  if(r.exit==='bypath'&&!byways[i]||Object.hasOwn(r,'turning')&&(r.exit!=='around'||!byways[i]?.keys.includes(r.turning))||
     byways[i]&&r.exit==='around'&&!r.turning||r.turning==='carry'&&m.walk[0].turning!=='bowl')throw new Error('折山岔路无效。');
  day=r.woke+(['around','bypath'].includes(r.exit)?3:0)+(r.turning==='meal'?1:0);
  if(life&&day>life.ageDays)throw new Error('折山绕行日数无效。');
 }
 const finished=m.walk.filter(completed).length;
 if(m.gifts.length>Math.floor(finished/2)||m.ending&&finished!==rooms.length)throw new Error('折山信物无效。');
 if(node==='mount-history'&&(!finished||finished!==m.walk.length)||
    ['mount-sight','mount-sound'].includes(node)&&(finished!==m.walk.length||!rooms[finished]||m.gifts.length<Math.floor(finished/2)||life&&realmFor(life).rank<rooms[finished].rank))throw new Error('折山页次无效。');
}
export function recordMountainRetreat(events,receipt){
 const sense=events.node==='mount-sight'?0:1;
 return {...events.mountain,walk:[...events.mountain.walk,{sense,method:receipt.action.approach,technique:receipt.before.cultivationProfile.experience.activeTechniqueId,ok:receipt.cultivationResult?.check?.success!==false,
  days:receipt.elapsedDays,woke:receipt.after.ageDays,exit:null}]};
}
export function mountainNode(state,menu,choice){
 const {events,life}=state,m=events.mountain,node=events.node,desk='mount-book';
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('train-menu','收起石头，回去安排修行','training'),book=menu('mount-book','把石头转回掌心','mount-book');
 const patch=change=>({mountain:{...m,...change}});
 if(!m)return row('一块可以折起的山','决定你为什么想进这座山',['盆架脚下垫着一块薄石头，侧过来却看得见一整条山脊。把它放在膝上，耳边便有井绳滑过的声音。你可以带着一个自己的念头入定。石中走过的景随身留着，每次真正练功仍照本命功法经过年月。'],[
  ...['home','source'].map((wish,i)=>menu('seek-'+wish,i?'想知道那声井水最初从何处来':'想看看自己还认不认得回家的路',desk,{mountain:{wish,walk:[],gifts:[],ending:null}})),back]);
 const {walk,gifts}=m,last=walk.at(-1),inside=last&&!completed(last),i=inside?walk.length-1:walk.length,c=roomFor(m,i);
 const home=m.wish==='home',giftCount=gifts.filter(g=>g==='give').length;
 const prior=last&&completed(last)?walkResult(m,walk.length-1):null;
 if(m.ending)return row('石外的第一步','回想你在这条山路最后留下了什么',[
  m.ending==='send'?'你把折石搁在路边，等那泥人自己走下来。小满回头看了很久，伸手把石头推回你掌心。「你带走吧。是我要走了。」你第一次听到他的脚步落在石外的土地上。':'你把折石的两面撑开，给山里和山外各留一道门。小满没有马上跟出来，一阵细碎的脚步声从里面跑远；那是他头一次走一条你不跟着的路。',
  home?'炊烟散了，你还记得自己出村时真正踩过的那一步。现在有人在另一条路上迈出了自己的第一步。':'井水的声响到了门外微不可闻。你终于听见它从哪里来：石缝里第一滴水撞上另一滴水，没有谁在井底敲钟。',
  giftCount?'小满一路自己收着'+items.filter((_,k)=>gifts[k]==='give').join('和')+'。临分别，他没有把那些东西还给你。':'芦哨和风筝线都还在你手里。小满摊开两只空手，原来他也能空手走出一座山。'],[menu('mount-history','回看实际走过的六关','mount-history'),back]);
 if(!c)return row('石口等一个人','决定让山门常开，还是陪小满走出石头',[prior,'小满把泥脚在石脊上一磕，磕掉薄薄一层干壳。里面长着自己的脚趾。他问你：「这回出去哪儿，要我自己选吗？」'],[
  menu('send-xiaoman','陪到石口，让他自己走入山外',desk,patch({ending:'send'})),menu('open-mountain','给两边留门，让他决定哪天出去',desk,patch({ending:'open'})),back]);
 if(!inside&&i&&i%2===0&&gifts.length<i/2){
  const name=items[i/2-1];
  return row('带走一件东西 · '+name,'决定下一程由谁拿着这件信物',[prior,i===2?'小满把芦哨从肚脐眼拔出来。他吹不出响，只想有一天隔着山叫你一声。若留在你手里，下一程你可以自己拿它辨风。':'风筝断线时，你捉到带着松脂的一端。小满问可不可以拿它当腰带，有人走丢的时候，他也可以抛出一截。'],[
   menu('keep-token','自己保管'+name+'，用它辨认下一程',desk,patch({gifts:[...gifts,'keep']})),
   menu('give-token','把'+name+'交给小满，让他自己用',desk,patch({gifts:[...gifts,'give']})),back]);
 }
 if(realmFor(life).rank<c.rank)return row('折山石合上了一层','在'+(c.rank===2?'筑基':'化神')+'后再展开下一重山',[prior,'眼下的气息托不开折痕。石头仍可随身带走，等自己的境界到了再续前路。'],[menu('mount-history','回顾前面走过的路','mount-history'),back]);
 if(inside){
  const taken=change=>patch({walk:[...walk.slice(0,-1),{...last,...change}]});
  if(last.exit==='bypath'){
   const side=byways[i];
   const options=side.keys.flatMap((turning,k)=>{
    if(turning==='carry'&&walk[0].turning!=='bowl')return [];
    const effect=taken({exit:'around',turning});
    return [turning==='meal'?choice('side-meal',side.acts[k],'explore','supplies','cautious',{next:desk,patch:effect,rule:{days:1,items:{supplies:1}}}):menu('side-'+turning,side.acts[k],desk,effect)];
   });
   return row(side.title,'决定在这条绕远的山路上留下什么',[side.scene,...(i===2?[walk[0].turning==='bowl'?'你衣里那只空碗正好能盛松土。':'你手上装不住这捧松土。种在山坡上的树，往后仍会有自己的去处。']:[])],[...options,back]);
  }
  if(last.exit==='lost')return row(c.title+' · 走岔之后','决定怎样离开眼前这条岔路',[c.lost,giftCount?'远处还有小满。他保管着你交给他的信物，这一次可以请他指路。':'小满还没有一件可以隔着山指路的东西。你可以重读亲眼所见，也可以自己走山路绕到另一侧。'],[
   choice('go-around','自己绕山走三日，看看岔路尽头','explore','supplies','cautious',{next:desk,patch:taken({exit:byways[i]?'bypath':'around'}),rule:{days:3}}),...(giftCount?[menu('call-xiaoman','循小满送来的信物，随他出山',desk,taken({exit:'guided'}))]:[menu('try-again','回想线索，重辨原来的岔口',desk,taken({exit:'reading'}))]),back]);
  const clue=i===5&&home?'绷直的筝线搭在碗沿。新碗添上一个泥手印，线便偏了一根头发的距离。':tokenClues[i-2];
  return row(c.title+' · 入定所见','根据这一关的见闻决定怎样走',[
   '这次以'+TECHNIQUES[last.technique].name+(last.method==='steady'?'稳修':'苦修')+'经过'+last.days+'日。'+(last.ok?'你在收功前留下了一个清楚的印象。':'练功失手，真正的伤势与消耗已经结算。静下来仍能回想入定前留意的细节。'),
   c.signs[last.sense],...(clue&&gifts[Math.floor(i/2)-1]==='keep'?[clue]:[])],[
   ...c.paths.map((label,n)=>menu('path-'+n,label,desk,taken({exit:n===c.right?(last.exit==='reading'?'corrected':'found'):'lost'}))),back]);
 }
 if(node==='mount-sight'||node==='mount-sound')return row(c.title+' · 入定前','选择本次真正要练的功课',[c.scene,'你把注意留在「'+c.sights[node==='mount-sight'?0:1]+'」。稳修和苦修都沿用当前功法，苦修另耗行粮，失手仍留下本次见闻。随时可以收功去做别的事。'],[
  choice('mount-steady','按本命功法稳修，定中寻路','practice','self','steady',{next:desk}),choice('mount-intensive','备粮苦修，缩短这一关','practice','self','intensive',{next:desk}),book]);
 return row('折山行 · '+c.title,'从两个地方挑一个留心，再入定亲自查验',[...(prior?[prior]:[]),c.scene,...(i===4&&walk[2].turning==='carry'?['一根小松针从碗口探出。雪落到针上化开，你蹲下来，用它留下的一点暖水试了试脚印到底结没结冰。']:[]),...(!i?[home?'你是为了找回家的路才来。泥人说他连「回」字是什么意思都不知道。':'你问井水从何处来。小满拍拍肚脐眼，说他只知道空的地方也能响。']:[])],[
  menu('watch-stone',c.sights[0],'mount-sight'),menu('hear-stone',c.sights[1],'mount-sound'),back]);
}
function walkResult(m,i){
 const r=m.walk[i],c=roomFor(m,i);
 if(r.exit==='guided')return m.gifts[0]==='give'?'石后传来破了音的芦哨。小满从来没吹响过，这一次却把那一口气拖到你找到他为止。':'风筝线贴着袖口落下。小满在远处拽了两下，向你指明回去的路。';
 if(r.exit==='around')return r.turning?byways[i].results[byways[i].keys.indexOf(r.turning)]:'你亲自走完三日山路，从那条绕远的岔道也到达了这里。';
 return (r.exit==='corrected'?'走过岔路，你才重新认出那处记号。':'')+c.good;
}
export function mountainHistory(m,menu){
 return {title:'山路留痕',goal:'回看每一关实际练过的功和所走之路',blocks:m.walk.map((r,i)=>({kind:'narration',text:roomFor(m,i).title+'。'+TECHNIQUES[r.technique].name+'，'+r.days+'日'+(r.method==='steady'?'稳修':'苦修')+'。'+walkResult(m,i)})),choices:[menu('mount-book','再展开折山石','mount-book'),menu('train-menu','回去安排修行','training')]};
}
