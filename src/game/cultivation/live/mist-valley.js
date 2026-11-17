import {exactKeys} from './schema.js';

const empty=()=>({sample:false,slag:false,remedy:false,sleeve:false,pass:null,settled:null});
export function validateValley(v){
 exactKeys(v,['sample','slag','remedy','sleeve','pass','settled']);
 if(['sample','slag','remedy','sleeve'].some(key=>typeof v[key]!=='boolean')||
    ![null,'medicine','forge','spar'].includes(v.pass)||![null,'infirmary','kiln','spring'].includes(v.settled)||
    v.remedy&&!v.sample||v.sleeve&&!v.slag||v.pass==='medicine'&&!v.remedy||v.pass==='forge'&&!v.sleeve||v.settled&&!v.pass)throw new Error('雾药谷游记无效。');
}
const sites={'field-camp':'谷口茶棚','field-bank':'白砂浅滩','field-grove':'避雾药棚','field-kiln':'旧瓷窑','field-shrine':'守泉石门','field-proof':'守泉石门','field-spar':'守泉石门','field-source':'分泉池','field-banks':'分泉池','field-ending':'分泉池'};
export const valleyLocation=node=>sites[node];
export function valleyPlaces(prefix){
 return ['field-camp','field-bank','field-grove','field-kiln','field-shrine','field-source'].map(key=>({id:prefix+key,name:sites[key],kind:'place'}));
}
const ending={
 infirmary:'药棚窗下砌起一只窄池。要取水的人先把身上的药粉抖净，每日第一瓯仍用来涮洗旧病人的碗。瓷窑那边小了火，改烧薄胎杯。杯底都浅，喝不尽药的人用起来反而省力。',
 kiln:'一股清水接进窑下凉槽。头一窑出的是耐火的分水管，第二窑才准烧自己的货。药棚的水桶改成隔日送一趟；窑工轮班挑水，每只桶都刻了经手人的花押。',
 spring:'守泉会收起旧闸，保留泉眼的原路。药棚把调好的滤层分给谷里各户，窑工在山坡另掘蓄雨池。逢旱大家仍要省水，泉眼到春天却又长出了从前那种细白的水草。',
};
export function valleyNode(state,menu,choice,actor){
 const e=state.events,v=e.valley??empty(),node=e.node,tier=state.life.cultivationProfile.worldTier;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const patch=change=>({valley:{...v,...change}});
 const back=menu('field-back','收起游记，安排自己的行程','hub');
 const stroll=(key,label,next)=>choice(key,label,'travel',actor(next),'road',{next,rule:{days:1}});
 const camp=stroll('field-camp','沿旧路回谷口茶棚','field-camp');
 const home=choice('field-home','沿山路回住处休整','travel',actor(e.location),'road',{next:'hub',rule:{days:1}});
 const job=(key,label,target,next,change,rule)=>choice(key,label,'explore',target,'cautious',{next,optionalGift:true,patch:patch(change),rule});
 if(node==='field-guide'){
  if(v.settled)return row('雾药谷 · 游记合卷','回看当年定下的水路',[ending[v.settled],v.pass==='spar'?'记载里还留着守泉会试手时的规矩。':v.pass==='medicine'?'入泉的凭据是一份由药棚验过的滤方。':'入泉的凭据是一件给旧闸换上的偏心套。'],[menu('train-menu','回去修炼','training'),back]);
  if(tier>0)return row('下界旧游 · 雾药谷','查阅下界留下的游记',['雾药谷在下界的青石坡后，脚下这条路已不通向那座谷口。书页保留了当年亲自核对的线索。',v.sample?'白砂下的红粉会随第一瓢井水浮起。':'水样一栏仍空着。',v.slag?'旧瓷窑的铜套内侧有一道歪斜的磨痕。':'窑裂一栏尚待后来人勘查。'],[menu('train-menu','继续此界的修行','training'),back]);
  return row('青石坡后的雾药谷','查清上游来雾的缘由，替两岸定下一条水路',['守闸人的旧札提过青石坡背后的一眼清泉。谷里的药棚和瓷窑共用它。近年晨起总有红雾，午后水又清了。有人怪药童倒错渣，有人怪窑里换了土；两边仍得一起用这口水。','从这里走一天到茶棚。谷口可问路，也能沿原路回来。已采过的样、做过的工和守泉会给的凭据都留在游记里。'],[stroll('enter-field','用一天走到谷口茶棚','field-camp'),back]);
 }
 if(node==='field-camp')return row('谷口茶棚','选择沿水路验药，或循石阶访窑',['茶棚梁下垂着两只手拉铃。左边的线穿过浅滩通药棚，右边的线翻过坡通旧窑。今早两只都响过，端茶的人把多的一只碗给你，说不急着信先开口的那一边。',v.pass?'守泉会已在簿上给你留名。从旧窑往上可到分泉池。':'守泉会看着上游石门。知道病因、修好闸件，或在他们的规矩下试手，都有机会入内。'],[stroll('to-bank','沿左岸验看白砂浅滩','field-bank'),stroll('to-kiln','循石阶前往旧瓷窑','field-kiln'),home]);
 if(node==='field-bank')return row('白砂浅滩','取一份有来历的水样，再去药棚辨认',['浅滩上有两排倒扣的瓦罐，一排离泉眼近，一排临着窑沟。刚挑水的老人执意不把罐子挪到一处：第一瓢留在哪里，比水眼下是什么颜色更要紧。',v.sample?'你对过两处留样。窑沟罐底很清，近泉的罐壁才粘着红粉。药棚已经收到了标明出处的一份。':'掀开罐口便能看见水，但须守到次日潮头，才能留下同一时刻的两份样。'],[
  v.sample?stroll('to-kiln','带着记录去查窑口','field-kiln'):job('take-sample','守候潮头，取同刻水样','herbs','field-bank',{sample:true},{days:1,spiritCost:1,gain:{herbs:1}}),
  stroll('to-grove','沿河前往避雾药棚','field-grove'),camp]);
 if(node==='field-grove')return row('避雾药棚','用留样判断滤层，再决定是否替谷里做药',['药棚老人把空碗举到窗边。碗壁浮着一圈光，只有从侧面才看得见。药童想拿更浓的药把它压下去，老人让他先把煮过的干草放凉，透过草茎再看一遍。',v.remedy?'成方已经留在药棚。守泉会答应，看过经药棚验明的滤方就为持方人开门。':v.sample?'红粉从泉边出来，清窑沟的样里没有。将灵草作一层疏滤可以截下红粉，须亲自试熬三日。':'桌上还缺同刻的水样。两岸各说各话时，配药容易把清水也滤坏。'],[
  v.sample&&!v.remedy?choice('brew-filter','用一份灵草试熬三日，留下滤方','craft','medicine','alchemy',{next:'field-grove',patch:patch({remedy:true}),optionalGift:true,rule:{days:3,items:{herbs:1},spiritCost:3,art:'alchemy',gain:{medicine:1}}}):stroll('to-bank','回浅滩核对留样','field-bank'),
  stroll('to-shrine','沿水声上行到守泉石门','field-shrine'),camp]);
 if(node==='field-kiln')return row('旧瓷窑','察看旧闸的磨痕，修出合缝的套件',['窑顶最后一块瓦还暖着。窑工不肯把那只烧坏的铜套扔掉，说能在里面找出一道先于裂缝的痕迹，谷里便不用每次起雾都重砌窑墙。',v.sleeve?'新套已经试合过。把尺寸拿去石门，守泉会可以当面验闸。':v.slag?'铜套内侧的磨痕斜向泉眼，水压一直偏在东边。用一份玄铁重打一只偏心套，可以让旧闸坐稳。':'窑工愿意把一块旧铁酬给帮他清膛测缝的人。要等火退两日，才量得准。'],[
  !v.slag?job('measure-kiln','清膛两日，量出闸缝倾角','iron','field-kiln',{slag:true},{days:2,gain:{iron:1}}):
   !v.sleeve?choice('fit-sleeve','锻一只偏心套，校好旧闸','craft','artifact','forge',{next:'field-kiln',patch:patch({sleeve:true}),rule:{days:4,items:{iron:1},spiritCost:4,art:'forging'}}):stroll('to-bank','下坡去验浅滩的水样','field-bank'),
  stroll('to-shrine','登石阶到守泉石门','field-shrine'),camp]);
 if(node==='field-spar'&&!v.pass)return row('石门前的退步','按实得伤势决定是否还要试手',['你没能守住第三声铃响。守泉会收回试手的灵压，门还闭着。你可以离谷疗伤，也可以走药棚或瓷窑那条路。'],[menu('shrine','再看石门上的条件','field-shrine'),home]);
 if(node==='field-proof')return row('石门验据','选择留在门簿上的凭据',['轮值人把门簿摊开。夹进哪一份凭据，往后翻到这一页的人就知道该去哪里找原样。'],[
  ...(v.remedy?[menu('proof-medicine','留下药棚已验的滤方','field-shrine',patch({pass:'medicine'}))]:[]),
  ...(v.sleeve?[menu('proof-forge','留下旧闸的校准尺寸','field-shrine',patch({pass:'forge'}))]:[]),menu('shrine','先收起凭据','field-shrine')]);
 if(node==='field-spar'||node==='field-shrine'){
  if(v.pass)return row('石门留名','入分泉池查清源头',[v.pass==='medicine'?'守泉会把滤方贴在闸边。轮值人验过水样，把你的名字添进过门簿。':v.pass==='forge'?'新打的偏心套跟旧磨痕正合。轮值人收好校过的尺寸，退开石门半步。':'三声铃响过，你仍守在原处。守泉会照约开门，把这一场试手记入石簿。','石门以内的两道水渠仍要有人定去处。'],[stroll('to-source','循两道旧渠入分泉池','field-source'),camp]);
  const offer=v.remedy||v.sleeve;
  return row('守泉石门','选择交出验据、试手或回去准备',['门前的守泉会只借一缕炼气境阵息试人，不争生死。守住三声铃算过，校阵试手共用一天。旧伤太重时，守闸人会请你改日再来。这道门也认药棚的滤方和窑工的校闸尺寸。',offer?'验过的东西已经在你手中。入门凭据与以后怎样分水是两回事。':'两处验据都尚未拿到。谷口茶棚可以返回住处，整备好再来。'],[
   ...(offer?[menu('show-proof','请守泉会当面验据','field-proof')]:[]),
   choice('hold-bell','照约试手，守住三声铃','fight',actor('springward'),'guard',{next:'field-spar',patch:patch({pass:'spar'})}),camp]);
 }
 if(node==='field-ending')return row('泉纹落定','查看真实分水的后果，再决定去留',[ending[v.settled]],[home,camp]);
 if(node==='field-banks')return row('两岸分水','选定哪一边先用水',['药棚需要每日不断的细流，窑槽可以间歇蓄水。渠首只够接一边，另一边往后要靠人轮班送水。'],[
  job('water-clinic','分水给药棚，让窑火减一档','herbs','field-ending',{settled:'infirmary'},{days:6,spiritCost:4,gain:{herbs:3}}),
  job('water-kiln','分水给窑槽，由窑工轮班送水','iron','field-ending',{settled:'kiln'},{days:8,spiritCost:4,gain:{iron:3}}),
  menu('review-pool','回池边看看另一路','field-source')]);
 if(node==='field-source'){
  if(!v.pass)throw new Error('缺少守泉会凭据。');
  if(v.settled)return row('谷口的后来','此处已有分水约',[ending[v.settled]],[home,camp]);
  return row('泉下两眼','亲自定下一条水路',['红粉从一层铁色细砂里起来。清泉被旧闸挤成一道水箭，正打在砂层上。闸可以调向药棚或窑槽，也可撤去闸板，把水还给原来的泉床。三条路都能散去眼前的雾，往后要付出的劳力各不相同。'],[
   menu('compare-banks','查阅两岸用水，再决定接渠','field-banks'),
   job('water-spring','拆掉旧闸，两岸分别取水','stones','field-ending',{settled:'spring'},{days:5,spiritCost:3,gain:{stones:3}}),camp]);
 }
 throw new Error('雾药谷页次无效。');
}
