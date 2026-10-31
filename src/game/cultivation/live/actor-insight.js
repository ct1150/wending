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
export function groundedInsight(note,block,actor,{speaker=false,ambiguous=false}={}){
 if(!block||!actor||!['person','faction'].includes(actor.kind)||actor.status==='dead')return null;
 const name=actor.name,text=block.text,mentions=!ambiguous&&text.includes(name);
 if(!mentions&&!speaker)return null;
 const row={anchor:note.anchor};
 if(note.realmId){
   const realm=V7_REALMS[note.realmId].name,subjects=[...(mentions&&block.kind==='narration'?[name]:[]),...(speaker?['我','在下']:[])];
   // The rank must be predicated of this actor, not a nearby cultivator or a title.
   const statements=text.split(/[。！？；\n]/u).map(s=>s.trim());
   if(subjects.some(subject=>['已入','已至','已是','境界为','境界是','是'].some(join=>statements.some(s=>{
     const claim=subject+join+realm;if(!s.startsWith(claim))return false;
     return /^(?:$|[，、：,. ]|境|期|初期|中期|后期|修为|修士)/u.test(s.slice(claim.length));
   }))))row.realmId=note.realmId;
 }
 for(const k of ['purpose','condition'])if(note[k]&&text.includes(note[k]))row[k]=note[k];
 return Object.keys(row).length>1?row:null;
}
export function checkActorScene(scene,marked,known=[],strict=true){
 const note=scene.story?.opponent,old=new Map(known.map(e=>[e.id,e]));
 if(!marked&&(note||scene.entities.some(e=>has(e,'experience'))))fail();
 if(!marked)return;
 if(note){
   validateInsightShape(note,'entityId',scene.blocks.length);
   const e=scene.entities.find(x=>x.id===note.entityId),b=scene.blocks[note.anchor];
   const observation=groundedInsight(note,b,e,{speaker:b.kind==='dialogue'&&b.speaker===e?.id,ambiguous:scene.entities.some(x=>x.id!==e?.id&&x.name===e?.name)});
   if(!observation||['realmId','purpose','condition'].some(k=>observation[k]!==note[k])||note.realmId&&e?.experience?.realmId!==note.realmId)fail();
 }
 for(const e of scene.entities){
   const rank=e.experience?.realmId,prior=old.get(e.id);
   if(prior?.experience&&prior.experience.realmId!==rank)fail();
   const fresh=e.id.startsWith(scene.id.split(':s:')[0]+':e:');
   if(rank&&!prior?.experience&&(strict||prior||fresh)&&(note?.entityId!==e.id||note.realmId!==rank))fail();
 }
}
