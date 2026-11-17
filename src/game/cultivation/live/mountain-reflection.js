import {formNames} from './technique-forms.js';

// A paid intervention in the fifth room. The ordinary clues remain usable;
// entering a reflection never changes the character's birth or earlier life.
export function reflectionNode(state,menu,choice){
 const {events,life}=state,m=events.mountain,last=m.walk[4],echo=last.echo;
 const row=(title,goal,lines,choices)=>({title,goal,blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('train-menu','收起石头，回去安排修行','training');
 const patch=change=>({mountain:{...m,walk:[...m.walk.slice(0,4),{...last,...change}]}});
 if(!echo){
  const form=events.forms.known;
  return row('雪脊返照 · 以所学入山','衡量施术代价，也可回到原来的辨路方式',[
   '你没有立刻去追那双脚印。山脊上一点细响反复落在同一个地方，像一口吐到半途又咽回去的气。小满把泥脚抬起来，确认这回不是自己的声音。',
   form==='listen'?'分息听泉能追到响声停下之后。若把一缕神识从雪壳下送过去，也许能找到是谁在反复借你的步子走。不是多听一遍山里的声音，而是让那东西听见你的回应。':'回脉护身能把气护回自己的经络。你可以跨进那双会重复的足印，让山石来学；只要护住真正的脉息，便不必把身体交给它代行。',
   '施术要用一日、六分灵力，不增长修为，也不取走山里的物件。原来的两条路仍在，你可以收功后再作决定。'],[
   choice('echo-enter','用'+formNames[form]+'进入雪下返照','explore','supplies','cautious',{next:'mount-echo',patch:patch({exit:'echo',echo:{form,day:life.ageDays+1,ending:null}}),rule:{days:1,spiritCost:6}}),menu('mount-book','回到原来的脚印，重新辨路','mount-book'),back]);
 }
 return row('借你脚步的人','让旧影回应，然后决定怎样与它分别',[
  echo.form==='listen'?'回声停下以后，你的气丝仍贴着一截冻根。根后蹲着那个初离石溪村的少年；响的不是他的鞋，而是他每次想换一条路，又被山石拽回原处时的一口气。你第一次把自己的声音送到他之前，足印便停住了。':'护住的并不是幻影，而是你自己还在跳动的脉。你把脚踏进旧印，雪下的力量想把膝盖弯成你少年时的样子；经络里的气将身体稳住。那张相同的脸从你身后走出，终于不用再贴着你迈步。',
  '旧影伸手摸自己的行囊，里面没有你后来得到的任何东西。他不是能被送回旧日的少年，只是这座山记住的一种可能。你走过的失误、受过的伤，都不能塞给他当作已经活过的年月。',
  '「我可以不替你回家了么？」他问。小满在旁边点头，随即又说该由你自己答。旧影想试一条还没有足印的路，也愿留在这里替后来迷路的人认山脊；他第一次有了两个并不重复的去处。'],[
  menu('echo-send','请他先走未走过的雪路，不再替我回家','mount-book',patch({exit:'attuned',echo:{...echo,ending:'send'}})),
  menu('echo-stay','请他留下认路，允许后来的人走不同方向','mount-book',patch({exit:'attuned',echo:{...echo,ending:'stay'}})),back]);
}
