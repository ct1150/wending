import {realmFor,nextRealmFor,v7ActionRule} from './cultivation-rules.js';
import {ITEMS} from './model.js';
import {exactKeys} from './schema.js';

const sites=['unityjade','daofruit','thunderseal'];
const names=['双峰石桥','一枝秋果坞','引雷坡'];
const landings=[
 ['石桥外沿多了一条扶手。背着重担的人也能空出一只手摸路。','两峰间架好了吊索。隔谷的货筐能趁风歇时滑到对岸。'],
 ['果坞把泉水引进浅槽。洗果的水沿坡流下，天干时槽底仍有湿泥。','果坞架起晒果竹棚。每根棚柱上挂了一片薄铜，风起时能听出是哪一架先动。'],
 ['坡上留出一条有接地桩的公道。雷雨过后，赶路人也能沿桩认出安全的落脚处。','驿工把能拆装的引线绕成圈，分给各站。坡顶少了固定桩，下一班却能跟着云脚换道。'],
];

export function ridgeEntrance(state,material){
 if(!sites.includes(material))return false;
 const last=state.events.ridgeRoad?.at(-1);
 return !last||last.site===material&&last.ending===null||last.ending!==null&&sites.indexOf(last.site)<sites.indexOf(material);
}
export function validateRidgeRoad(e,life){
 const road=e.ridgeRoad??[],node=e.node.startsWith('ridge-')?e.node.slice(6):null;
 if(Object.hasOwn(e,'ridgeRoad')&&(!Array.isArray(e.ridgeRoad)||!road.length||road.length>3))throw Error('山路段数无效。');
 let previous=-1;
 for(const [i,r] of road.entries()){
  exactKeys(r,['site','world','missed','aligned','ending']);
  const site=sites.indexOf(r.site);
  if(site<=previous||![0,1,2].includes(r.world)||typeof r.missed!=='boolean'||typeof r.aligned!=='boolean'||
    ![null,0,1].includes(r.ending)||r.ending!==null&&!r.aligned||i<road.length-1&&r.ending===null||
    life&&(realmFor(life).rank<6+site||life.cultivationProfile.worldTier<r.world))throw Error('山路交接与修行经历不符。');
  previous=site;
 }
 if(node&&(!sites.includes(node)||!road.some(r=>r.site===node)&&(life&&nextRealmFor(life)?.material!==node||!ridgeEntrance({events:e},node))))throw Error('未到此段山路。');
}

export function ridgeNode(state,menu,choice){
 const {events:e,life}=state,site=e.node.slice(6),i=sites.indexOf(site),road=e.ridgeRoad??[];
 const here=road.find(r=>r.site===site),bridge=road.find(r=>r.site==='unityjade')?.ending,orchard=road.find(r=>r.site==='daofruit')?.ending;
 const home=menu('train-menu','收起行具，回山修行','training'),back=menu('back','回去安排别的事','hub');
 const row=(title,lines,choices)=>({title,goal:'接通'+names[i]+'的旧山路，备下'+ITEMS[site],location:names[i],blocks:lines.map(text=>({kind:'narration',text})),choices});
 const step=(key,label,target,days,change,rule={})=>choice(key,label,'explore',target,'cautious',{next:e.node,
  patch:{ridgeRoad:here?road.map(r=>r.site===site?{...r,...change}:r):[...road,change]},rule:{days,...rule}});
 const inherited=i===0?'两峰石桥的旧索磨断了，玉纹在桥脚合拢时才会露出来。':
  i===1?(bridge===0?'从你留过扶手的那一边，脚夫已把挑筐送到果坞坡顶。':bridge===1?'隔谷的吊索还在，空筐已经滑到果坞里。':'果坞还在靠人背筐，坡上没有接过双峰的索。'):
  (orchard===0?'果坞引出的浅槽绕到雷坡脚，干土下面还藏着一条水线。':orchard===1?'果坞晒棚的薄铜在山脚一阵阵响，驿工可以靠声音辨风头。':'坡脚只有一根挂铜片的旧测风杆，驿工得亲自去量雷路。');
 if(!here){
  const trip=v7ActionRule(state,{intent:'explore',targetId:site,approach:'cautious',stake:'low'});
  return row(names[i]+' · 山口',[inherited,'行脚驿愿把开路时取得的一份'+ITEMS[site]+'给出力的人。沿众驿慢慢勘到现场，要备一份行粮，走完一趟寻材的路。驿亭的照山镜通物传声，日后跨界也可接着交工。'],[
   step('ridge-start','带一份行粮，随驿工踏勘到山里','supplies',trip.days,{site,world:life.cultivationProfile.worldTier,missed:false,aligned:false,ending:null},{items:trip.items,spiritCost:trip.spiritCost}),
   menu('hunt-grounds','自行进山，照常选择缓行或险径','hunt-grounds'),home]);
 }
 if(here.ending!==null)return row(names[i]+' · 交工',[landings[i][here.ending],'交割那天驿工已经递给你一份'+ITEMS[site]+'。这段路留下的做法，后来的驿班仍能沿用。'],[
  ...(nextRealmFor(life)?.material===site&&life.items[site]?[choice('breakthrough','用'+ITEMS[site]+'尝试突破','practice',nextRealmFor(life).id,'breakthrough',{next:'action-result'})]:[back]),home]);
 const remote=life.cultivationProfile.worldTier>here.world?'照山镜里传来旧驿班的回音。你指哪一处，山上就验哪一处。':'驿工把山上的征象指给你看。';
 if(!here.aligned){
  const correct=i===0?state.birthReceipt.random.after%2:i===1?(bridge===1?1:0):(orchard===0?1:0);
  const readings=[
   correct?'东孔上的旧索随桥身来回擦，西孔里的粉线却一动不动。':'西孔上的旧索随桥身来回擦，东孔里的粉线却一动不动。',
   correct?'吊筐正压着近枝，近枝的红色是篮底颜料。远枝没有蹭色，果蒂下的薄冰已自行化开。':'近枝的果蒂自己落了一圈白霜。远枝还带着硬冰，枝上的红点只是旧时做的漆记。',
   correct?'旱脊上的两枚试针一齐发亮，浅槽旁的试针却把闪光引进了泥里。':'坡边铜片先响，向谷内的一列试针随即发亮。旱脊背风的石座上，试针一直暗着。',
  ];
  const labels=[['把新索扣进东孔','把新索扣进西孔'],['把接果布张在近枝下','把接果布张在远枝下'],['沿背风旱脊安试桩','沿坡脚浅槽安试桩']][i];
  const instruction=['新索只能扣在不随桥身转动的孔里。','接果布只有一张，要张在今天果蒂自然解冻的那一枝。','试桩必须落在能让闪光消散或完全避开感应的地方。'][i];
  const attempts=labels.flatMap((label,n)=>here.missed&&n!==correct?[]:[step('ridge-test-'+n,label,n?'iron':'stones',n===correct?2:1,n===correct?{aligned:true}:{missed:true})]);
  return row(names[i]+' · 验路',[remote,inherited,readings[i],instruction,...(here.missed?[['刚才所扣的索被桥身拖松，驿工已收回试钩。','刚才张布的那枝一果未落，布上只接到一片硬霜。','刚才那列试桩发了亮，驿工拔掉桩钉，封住了这条试路。'][i]]:[])],[...attempts,home]);
 }
 const labels=[['把索留作扶手，护行人过桥','把索架成吊线，替下游运筐'],['沿坡开浅槽，洗果并引水下山','架起晒果棚，挂铜片听风'],['把接地桩留在坡上，护一条公道','拆装成引线，交给往返各驿']][i];
 const costs=[[4,6],[bridge===0?3:6,bridge===1?3:6],[orchard===0?3:7,orchard===1?3:7]][i];
 const proof=['索眼稳住了，桥脚两片玉纹拼合。','果子落在布里，绒皮完整；树下还堆着给沿路人吃的普通秋果。','试桩已把这一道雷领走，焦石底下现出一枚完整的雷印。'][i];
 return row(names[i]+' · 留路',[proof,inherited,'驿工把'+ITEMS[site]+'封在工囊里。两种收尾都能交工领一份；修成什么样，由这班走山人决定。'],[
  ...labels.map((label,n)=>step('ridge-leave-'+n,label,n?'iron':'stones',costs[n],{ending:n},{gain:{[site]:1}})),home]);
}
