import {ITEMS} from './model.js';
import {ferryForMaterial} from './shell-ferry.js';

// The two approaches use the ordinary exploration roll, its price and its actual yield.
const sites={
 manual:['旧经楼','雨水从楼顶漏进来，各房的卷页已经混在一起。墨迹浅的那几张，折痕却能首尾相接。','沿装订孔逐页校经','抢在楼塌前上顶层取经','你依着抄本走完最后一遍吐纳，卷上断开的气路终于接成了一圈。','试到末页，两处折痕仍对不到一起。'],
 crystal:['断层石场','日照不到的崖缝里有一道青光。绕山能看到石层的走向，正面则是一条才裂开的近路。','绕山顺着晶脉凿取','攀入新裂缝取晶','包住晶心的灰皮在掌中剥落，露出一线青光。','石层在凿痕前断掉，只落下几块没有灵脉的碎屑。'],
 core:['冷炉窟','废炉的底釉已结成壳。沿旧烟道下去能辨各炉的火色，直开炉腹则要迎着余热。','循烟道辨出结髓的炉','破开尚热的炉腹','薄釉翻开，凝住的灵髓在冷瓷上轻轻一滚。','炉壁仍有光泽，刮到里面却只剩一层空釉。'],
 soulseal:['回声井','井栏下有两道铃声。井里每响一次，石壁上就浮起半枚印纹；听清两声的间隙，才知道真印落在哪一层。','沿石阶比对两道铃声','悬绳直下追第二声铃','井上的铃终于歇了。你把带着两重印纹的归魂印包进布里。','回到井栏时绳上只有水渍，刚才看见的印纹已经散了。'],
 skykey:['倒悬门','石门倒挂在山腹，风吹过时，锁孔的影子会从岩壁落到地上。等影重合能认出钥齿，赶风的人则可攀上横梁。','守候锁影合齿','乘风攀上倒悬的门梁','落在手上的玉钥有完整的齿。它从最后一线锁影里退出，影子也随之合上。','风停时锁影已经错开，这次没有一齿能从石里脱出。'],
 voidstone:['无水涧','涧底有一段石子落下去全无声响。两岸相望能看清边缘，从中间探手则只得凭指尖的凉意。','循两岸划定空隙','探入无声处取石','指间有了重量。你松开另一只手，水声又从两岸接到了一起。','指尖一暖，那段空隙移到了涧底别处。'],
 unityjade:['双峰合璧处','两峰在云海里投下交叠的影子。山脚的石脉要在影子相遇时才显出玉纹，峰顶的石桥能直接看进裂面。','候两峰同影，寻合缝玉脉','越过云中石桥撬玉','两道玉纹在掌中相合，石面上留下了一处平整的缺口。','云影在你转过石脊前分开，两道纹路没有合成玉。'],
 daofruit:['一枝秋','山谷四面各当一季。果梗只有在四种风都吹过时才肯松开，树顶也有几枚已经被疾风摇动。','沿四面山坡候齐风候','踏上树冠抢收摇落的果','果梗在手指下自行松开，枝头的四种颜色收进了果皮。','风落后枝头还硬着，这次只有几片空叶落到衣袖上。'],
 thunderseal:['引雷坡','坡上旧雷痕一道压一道。贴着冷痕能慢慢摸出雷印的位置，雷眼亮起的片刻则能看清整枚印。','沿冷雷痕逐道寻印','趁雷眼亮起闯入坡心','你托起雷印，石背上一小片银纹慢慢暗了下去。','雷光在下一道坡上亮起，你立足之处只剩焦土。'],
};

export function materialHunt(state,next,menu,choice){
 const {life,lastReceipt:r}=state,id=next.material,name=ITEMS[id];
 const [place,opening,careful,bold,found,missed]=sites[id];
 const row=(title,lines,choices)=>({title,location:state.events.node==='hunt-grounds'?place:undefined,goal:'为'+next.name+'备妥'+name,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const home=menu('train-menu','回去安排修行','training'),grounds='hunt-grounds';
 const ferry=ferryForMaterial(state,id);
 if(state.events.node==='hunt-sources'&&ferry)return row('两处可访的'+name,[
  '修为已经够了，行囊里还缺'+name+'。可以去浮蚌渡的'+ferry+'和蓼商量宝物的归属，也可以自己前往'+place+'。',
 ],[menu('shell-book','到'+ferry+'探访浮蚌渡','shell-book'),menu('hunt-grounds','自行前往'+place,grounds),home]);
 const rest=choice('hunt-rest','就地调息，整备后再决定','rest','self','recover',{next:grounds});
 const lines=[],key=r.action?.id.split(':c:').at(-1);
 if(key==='hunt-careful'||key==='hunt-bold')lines.push(r.itemChanges[id]>0?found+' 这一趟收得'+r.itemChanges[id]+'份'+name+'。':missed);
 if(key==='hunt-food')lines.push(r.itemChanges.supplies>0?'备下的行粮已经装袋，可以起行。':'这次沿路没有寻到行粮。');
 if(key==='hunt-rest')lines.push('你收功起身，当前灵力为'+life.cultivationProfile.spirit+'。');
 if(!lines.length)lines.push(opening);
 if(life.items[id])return row(place+' · 备料归来',lines,[
  choice('breakthrough','用'+name+'尝试突破'+next.name,'practice',next.id,'breakthrough',{next:'action-result'}),rest,home]);
 const needsFood=next.rank>1&&!life.items.supplies;
 if(needsFood||life.cultivationProfile.spirit<5){
  lines.push((needsFood?'进山还缺一份行粮。':'')+(life.cultivationProfile.spirit<5?'寻材至少需要五分灵力。':''));
  return row(place+' · 行前整备',lines,[...(needsFood?[choice('hunt-food','沿路备办一份行粮','explore','supplies','cautious',{next:grounds})]:[]),rest,home]);
 }
 return row(place,lines,[choice('hunt-careful',careful,'explore',id,'cautious',{next:grounds}),choice('hunt-bold',bold,'explore',id,'bold',{next:grounds}),home]);
}
