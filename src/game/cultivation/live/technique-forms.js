import {TECHNIQUES,realmFor} from './cultivation-rules.js';
import {exactKeys} from './schema.js';

export const formNames={listen:'分息听泉',ward:'回脉护身'};
export function canStudyForm(life){
 const experience=life.cultivationProfile.experience;
 return realmFor(life).rank>=2&&(!TECHNIQUES[experience.activeTechniqueId].defective||experience.repaired);
}
export function validateForms(events,life){
 const form=events.forms,node=events.node;
 if(life&&!canStudyForm(life))throw Error('须筑基并校好本命功法，才能推演术式。');
 if(Object.hasOwn(events,'forms')){
  exactKeys(form,['known','draft']);
  if(![null,'listen','ward'].includes(form.known)||![null,'listen','ward'].includes(form.draft)||!form.known&&!form.draft)throw Error('术式修习记录无效。');
 }
 if(node==='form-drill'&&!form?.draft||node==='form-result'&&!form||node==='hunt-forms'&&!form?.known)throw Error('术式尚未备好。');
}

export function formNode(state,menu,choice){
 const {events:e,life}=state,form=e.forms??{known:null,draft:null};
 const method=TECHNIQUES[life.cultivationProfile.experience.activeTechniqueId].name;
 const row=(title,lines,choices)=>({title,goal:'以本命功法练成一式，决定怎样应对寻材险路',blocks:lines.map(text=>({kind:'narration',text})),choices});
 const back=menu('back','收好法页，回去安排仙路','hub');
 const book=menu('form-book','重新衡量要专修的术式','form-book');
 const train=menu('train-menu','回去查看修为与破境条件','training');
 if(e.node==='form-book'){
  const start=(mode,label)=>menu('form-'+mode,label,'form-drill',{forms:{known:form.known,draft:mode}});
  return row('本命法诀 · 两种用法',['筑基后，'+method+'的气路已能分出一缕，离身探物或贴脉护持。你把泉石和两片薄瓷摆在关门边，决定下一关练哪一式。',
   '分息听泉要把一缕气送到回声后面，险路寻材的成功机会至多增加十二个百分点，上限九成九。回脉护身把气收回经络，险路失败时少受一层伤。两式使用时都额外耗六分灵力。',
   form.known?'当前专修'+formNames[form.known]+'。重新练成另一式后，往后的险路改用新式。':'实际闭关成功后才算练成。入定仍按本命功法结算时日、修为和风险。'],[
   ...(form.draft?[menu('form-resume','接着练上次选好的'+formNames[form.draft],'form-drill')]:[start('listen','以泉石辨回声，练分息听泉')]),
   start(form.draft==='ward'?'listen':'ward',form.draft==='ward'?'重新改练分息听泉':'以薄瓷试护气，练回脉护身'),back]);
 }
 if(e.node==='form-drill'){
  const listen=form.draft==='listen';
  const description=listen?'泉石有一处空腔，隔纸敲击，两面都有响声。你按吐纳的节律把气分成细丝，寻找回声停止后仍在颤动的那一面。':'两片薄瓷之间隔着湿纸。你要把气沿周天收回，护住里面那片；外面那片可以裂，贴脉的一片须仍能接得住水。';
  const drill=(key,label,approach)=>choice(key,label,'practice','self',approach,{next:'form-result',patch:{forms:{known:form.draft,draft:null}}});
  return row('演练 · '+formNames[form.draft],[description,'稳修用完整一关分辨气路；苦修要开一份行粮，修期更短，也有走岔受伤的可能。功法本身的长处与代价都参与这一关。',...(form.known?['本次练成以前，已经会的'+formNames[form.known]+'仍可使用。']:[])],[
   drill('form-steady','依本命功法稳修一关，练熟气路','steady'),drill('form-intensive','开一份行粮苦修，在短关中试成','intensive'),book]);
 }
 if(form.draft)return row('演练出关 · 气路未成',['这一关没有完成预想的行气。时日、灵力、粮食和伤势已经照实结算。'+(form.known?'原先练成的'+formNames[form.known]+'仍在。':'可以先调息，再回来续练。')],[menu('form-resume','回关前，续练同一式','form-drill'),train,back]);
 return row('演练出关 · '+formNames[form.known],[form.known==='listen'?'石腔里的回声先停，贴着泉眼的气丝又动了一下。你第一次分清了“石头在响”和“水从哪里来”。':'外层瓷片裂开了。你松开指节，贴脉的那片仍托着一汪水，纸边一滴未漏。',
  '这一关的修为已经入账。日后到破境材料的山场，可以在险径页选择用'+formNames[form.known]+'，也可以沿原路走。'],[train,book,back]);
}
