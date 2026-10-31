export const V7_REALMS=Object.freeze(Object.fromEntries([
  ['mortal','凡人',80,0,null,0,1,30],
  ['qi','炼气',120,2,'manual',2,1,90],
  ['foundation','筑基',240,6,'crystal',3,3,360],
  ['golden','结丹',480,10,'core',8,6,720],
  ['nascent','元婴',1000,16,'soulseal',20,12,1800],
  ['spirit','化神',2000,24,'skykey',50,25,3600],
  ['void','炼虚',4000,36,'voidstone',120,60,7200],
  ['unity','合体',8000,48,'unityjade',300,120,14400],
  ['mahayana','大乘',16000,64,'daofruit',600,250,28800],
  ['tribulation','渡劫',32000,80,'thunderseal',1200,500,57600],
].map(([id,name,lifeLimit,threshold,material,minYears,practiceYears,exploreDays],rank)=>[id,Object.freeze({id,name,rank,lifeLimit,threshold,material,minYears,practiceYears,exploreDays})])));

// Only a grounded, explicit disclosure can establish a permanent realm.
// Tactical observations are local to the current scene. They never grant stats.
const has=(o,k)=>Object.hasOwn(o,k);
const fail=()=>{throw Object.assign(new Error('ENTITY_IDENTITY_CONFLICT'),{code:'ENTITY_IDENTITY_CONFLICT'});};
export function validateActorRank(e){
 const x=e.experience;
 if(!['person','faction'].includes(e.kind)||!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==2||!has(x,'version')||!has(x,'realmId')||x.version!==1||typeof x.realmId!=='string'||!has(V7_REALMS,x.realmId))fail();
}
export function validateInsightShape(note,key,blockCount){
 if(!note||typeof note!=='object'||Array.isArray(note)||!has(note,key)||!Number.isInteger(note.anchor)||note.anchor<0||note.anchor>=blockCount||Object.keys(note).some(k=>![key,'anchor','realmId','purpose','condition'].includes(k)))fail();
 if(has(note,'realmId')&&(typeof note.realmId!=='string'||!has(V7_REALMS,note.realmId)))fail();
 for(const k of ['purpose','condition'])if(has(note,k)&&(typeof note[k]!=='string'||!note[k].trim()||[...note[k]].length>24||/[\x00-\x1f]/u.test(note[k])))fail();
}
// Accept a small, positive observation language. Optional intelligence can be
// omitted without rejecting the scene; a question or disclaimer is not proof.
const uncertain=/[?？“”「」『』"]|没有根据|骗局|欺骗|谎言|谎话|不对|无稽|胡说|未获证实|传闻|传言|谣言|谣传|误传|传说|听说|听闻|据说|据传|未经证实|尚未证实|未必|不实|不属实|并不属实|是假|假的|假称|佯称|假装|伪装|并非|并未|并没有|否认|摇头|说错|口误|才怪|其实不|不是|难道|莫非|是否|或许|可能|猜测|揣测|怀疑|看似|似乎|倘若|假如|如果/u;
const directGoal=['意在','目的是','目的为','只想','想要','打算','为了','正','正在'];
const directCondition=['破绽是','破绽为','弱点是','可趁'];
export function groundedInsight(note,block,actor,{speaker=false,ambiguous=false,others=[],blocks=[block]}={}){
 if(!block||!actor||!['person','faction'].includes(actor.kind)||actor.status==='dead')return null;
 // A later correction in the same short model scene can cancel an earlier
 // confident-looking sentence. Do not persist the provisional observation.
 if(blocks.some(b=>uncertain.test(b.text)))return null;
 const subjects=block.kind==='narration'&&!ambiguous?[actor.name]:speaker?['在下','我']:[];
 if(!subjects.length)return null;
 const row={anchor:note.anchor},realm=note.realmId&&V7_REALMS[note.realmId].name;
 for(const statement of block.text.split(/[。！？.!?\n]/u)){
   // Mixed actors in one sentence are not a safe source of subject attribution.
   if(others.some(name=>name!==actor.name&&statement.includes(name)))continue;
   let owns=false;
   for(const part of statement.split(/[，,；;：:]/u)){
     const clause=part.trim(),subject=subjects.find(s=>clause.startsWith(s));
     if(subject)owns=true;
     if(!owns)continue;
     const text=subject?clause.slice(subject.length):clause;
     const rank=Boolean(subject&&realm&&['已入','已至','已是','境界为','境界是','是'].some(join=>
       ['', '境','期','初期','中期','后期','修为','修士'].some(suffix=>text===join+realm+suffix)));
     if(rank)row.realmId=note.realmId;
     const goal=note.purpose&&directGoal.some(prefix=>text===prefix+note.purpose);
     if(goal)row.purpose=note.purpose;
     const condition=note.condition&&(directCondition.some(prefix=>text===prefix+note.condition)||(subject||/^(?:旧伤|伤口|左臂|右臂|脚步|灵力|气息|阵脚|退路|剑势|护体|经脉)/u.test(text))&&text===note.condition);
     if(condition)row.condition=note.condition;
     // A change of subject without attribution breaks the chain. Never carry
     // ownership across a full stop, or through another person's independent act.
     owns=Boolean(rank||goal||condition);
   }
 }
 return Object.keys(row).length>1?row:null;
}
export function checkActorScene(scene,marked,known=[],strict=true){
 const note=scene.story?.opponent,old=new Map(known.map(e=>[e.id,e]));
 if(!marked&&(note||scene.entities.some(e=>has(e,'experience'))))fail();
 if(!marked)return;
 if(note){
   validateInsightShape(note,'entityId',scene.blocks.length);
   const e=scene.entities.find(x=>x.id===note.entityId),b=scene.blocks[note.anchor];
   const observation=groundedInsight(note,b,e,{speaker:b.kind==='dialogue'&&b.speaker===e?.id,ambiguous:scene.entities.some(x=>x.id!==e?.id&&x.name===e?.name),others:[...known,...scene.entities].map(x=>x.name),blocks:scene.blocks});
   if(!observation||['realmId','purpose','condition'].some(k=>observation[k]!==note[k])||note.realmId&&e?.experience?.realmId!==note.realmId)fail();
 }
 for(const e of scene.entities){
   const rank=e.experience?.realmId,prior=old.get(e.id);
   if(prior?.experience&&prior.experience.realmId!==rank)fail();
   const fresh=e.id.startsWith(scene.id.split(':s:')[0]+':e:');
   if(rank&&!prior?.experience&&(strict||prior||fresh)&&(note?.entityId!==e.id||note.realmId!==rank))fail();
 }
}
