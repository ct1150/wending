import {exactKeys} from './schema.js';

const seats=[
 {
  name:'云梯掌架人',copy:'云梯来的是带着活页图的学徒。他会照着刻，却不清楚头一声要送到谁的手上。',original:'掌架班只派一个用过原件的人。他肯在自己的立柱上接声，也肯替一道远处的门先试一次。',
  harbor:['掌架人只照看本班的云梯；站在外桥等船的人凭眼睛看旗。','掌架人领你走过外桥，把第一拍一路递到握着湿栏杆的手上。人群最末端也知道船到了。'],
  window:['凳背仍安静。坐在窗边的人从别人抬手的动作看出开场。','第一声从凳背传过去。坐在窗边的人把手里的豆剥完才抬头，正好赶上第二拍。'],
 },
 {
  name:'星炉交班人',copy:'炉上送来验答符样，还有个从未守过夜班的新弟子。他分辨得出自己的回声，不知道什么时候该等。',original:'两个守炉人各执半段陶管。他们只肯亲口接班，怎么歇气、怎么听错，都留在这一班的声音里。',
  harbor:['两只陶管只在炉棚互答。港上听见两响，仍按自己的旧口令交接。','陶管的一清一浊传到两班人脚下。直到后来那人开口，先到的人才松开牵船的手。'],
  window:['门外守炉人隔窗候着。屋里听见一声陶管，另一声留给赶回去换班的人。','两截陶管隔窗应答。里面的人从一声短咳听出接班者累了，主动约好下一次少排一遍。'],
 },
 {
  name:'两岸领唱人',copy:'船上寄来许多张无词的谱。识字的人已经把两处落拍涂黑，等你说那处空白要留多长。',original:'领唱人带来两块单独的踏板。她愿意来，却说若一定得由她唱最后一句，她宁愿现在回去。',
  harbor:['船户留在各自岸边。领拍过去，岸上的人把一小段静默当作送行。','岸上先落一拍，船上的人自己决定何时搭腔。有人哼了半句便停，后面仍有位置给另一个声音。'],
  window:['两岸的领唱人留在渡口。窗内只摆了一块未敲的踏板，后来人可以自己添一句。','屋内屋外各留一拍。领唱人没有开口，反而是替她提踏板的小女孩在没人催的时候唱完了第一句。'],
 },
];

const visited=(plan,i)=>Boolean(plan.visits&(1<<i));
export function validateConcert(plan){
 exactKeys(plan,['venue','visits','performed']);
 if(!['harbor','window'].includes(plan.venue)||!Number.isInteger(plan.visits)||plan.visits<0||plan.visits>=7||typeof plan.performed!=='boolean')throw new Error('归航合奏回执无效。');
}
export function concertNode(state,menu,choice,row,book,sea){
 const convoy=state.events.convoy,score=convoy.resonance,plan=score.concert,node=state.events.node;
 const patch=concert=>({convoy:{...convoy,resonance:{...score,concert}}});
 const hub=menu('river-back','合起排演单，回去休整','hub');
 if(!plan){
  const venue=(code,label)=>menu('play-'+code,label,'convoy-concert-plan',patch({venue:code,visits:0,performed:false}));
  return row('归航合奏 · 择地','选定最后演奏的地方',['谱匣里有两张长年有效的请帖。码头想让等船的人在雾里也能听见交接；临窗的小院只摆得下几把凳子，希望给总被响声淹没的人单独留一场。三班人共用一套器物，衡量过人手，只能认领其中一场。','各班愿意合出两个工日陪持匣人排演，每日一班。合练过的接法会刻在交班牌上；即便换了值守人，后来接手的也能照牌入拍。等持匣人落印才定演期，其余日子仍各做各的事。'],[venue('harbor','应长桥之约，把曲子留给等船的人'),venue('window','应窗下之约，给小院留一场'),book]);
 }
 const harbor=plan.venue==='harbor',venue=harbor?'长桥':'窗下',title=harbor?'一座桥的回声':'一扇窗的回声';
 const notes=seats.map((seat,i)=>seat.name+'。'+(score.decisions[i+3]==='C'?seat.copy:seat.original));
 const planMenu=menu('concert-plan','回到排演单','convoy-concert-plan');
 if(plan.performed)return row(title,'看这场曲子到了哪些人耳中',[harbor?'最后一班船靠岸时没有敲锣。原来雾里的人不必都看见同一面旗，也能知道身边有人在接应。':'窗纸被灯光照得很薄。门外的人听得见人说话，却听不全曲子，恰好可以决定是进来还是继续走自己的路。',...seats.map((seat,i)=>seat[plan.venue][Number(visited(plan,i))]),'匣底的题签添了一句：「这场确实有人来过。」其余的，听到的人各自带走。'],[book,sea,hub]);
 const review=menu('check-concert','核对各班去向，准备开演','convoy-concert-check');
 const count=seats.filter((_,i)=>visited(plan,i)).length;
 if(node==='convoy-concert-visits'||node==='convoy-concert-last'){
  const choices=seats.flatMap((seat,i)=>visited(plan,i)||count===2?[]:[choice('visit-'+i,'用一日陪'+seat.name+'合练','craft',['artifact','array','talisman'][i],['forge','formation','talisman'][i],{next:'convoy-concert-plan',patch:patch({...plan,visits:plan.visits|(1<<i)}),rule:{days:1}})]);
  if(node==='convoy-concert-last')return row(venue+' · 渡口的邀约','决定是否去领唱班合练',[notes[2]],[...choices.filter(c=>c.key==='visit-2'),planMenu,hub]);
  return row(venue+' · 三班的空档','最多陪两班合练，留一班自行决定',notes,choices.length===3?[choices[0],choices[1],menu('last-group','看看领唱班，或回排演单','convoy-concert-last')]:[...choices,planMenu,...(choices.length===0?[review]:[])]);
 }
 if(node==='convoy-concert-check'){
  return row(venue+' · 开演前','确认开演，或返回排演单',[...seats.map((seat,i)=>seat.name+(visited(plan,i)?'已经同你试过此处的接法。':'仍照自己的班次和旧规矩行事。')),'开演需一日。开演后各班按这里的约定行动，合练的日子也不能重排。'],[choice('perform','按此排演单开演','craft','array','formation',{next:'convoy-concert-result',patch:patch({...plan,performed:true}),rule:{days:1}}),planMenu]);
 }
 const mark=seats.filter((_,i)=>visited(plan,i)).map(seat=>seat.name).join('、');
 return row(venue+' · 排演单','安排亲自合练的两日，或直接开演',[harbor?'长桥容得下许多人。和你合练过的班次能把声音传到外桥，没合练的照旧守着自己的内班。':'小院愿给每个人留位置。和你合练过的班次能把声音送到窗下，其余人在门外各守自己的时刻。','已陪 '+count+' / 2 班'+(mark?'，'+mark:'')+'。',...notes],[...(count<2?[menu('visit-groups','看各班所请，选择去处','convoy-concert-visits')]:[]),review,hub]);
}
