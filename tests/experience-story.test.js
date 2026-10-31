import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {validateReceipt,serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {TECHNIQUES} from '../src/game/cultivation/live/cultivation-rules.js';
import {buildStoryInput} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {buildOpeningBrief} from '../src/game/cultivation/live/experience-story.js';
const frozen=JSON.parse(readFileSync(new URL('./fixtures/v540-unmarked-v7.json',import.meta.url)));
const profile={...GLM_PROFILE,storyActions:true};
const life=(seed=42,opt=true)=>createLiveGame({...frozen.options,seed,...(opt?{experienceVersion:1}:{})});
const subject=frozen.scene.entities[0];
const cexp=s=>s.life.cultivationProfile.experience;
const pending=(s,label)=>prepareChoice(s,{choiceId:s.currentScene.choices.find(c=>c.label===label)?.id??'not-offered',requestId:'effect-'+(s.turnId+1)});
const ctx=(s,p)=>buildStoryContext(s,p,[],{selection:'relevance-v1',openTotal:0});
function scene(s,p,{offer=false,other=false,omit=false}={}){
 const next=s.turnId+1,sc=structuredClone(frozen.scene);sc.id=sc.id.replace(':t1:',':t'+next+':');for(const o of sc.choices)o.id=o.id.replace(':t1:',':t'+next+':');
 sc.blocks=[{kind:'narration',text:'陈砚翻过手里的纸页，指着一段断开的口诀说，可以带你校法，等再见时给他带一份行粮。你尚未答应。'}];
 const progress=p.nextLife.cultivationProfile?.experience;
 sc.choices[2].label='观察周围';
 if(progress&&!progress.repaired&&TECHNIQUES[progress.activeTechniqueId].defective){
   const diagnosed=progress.lessons.includes('diagnosed');
   Object.assign(sc.choices[0],{label:diagnosed?'自行推演残法':'验看本命功法',intent:'craft',approach:diagnosed?'restore':'diagnose'});
 }
 if(offer){
   Object.assign(sc.choices[0],{label:'婉拒陈砚',intent:'interact',approach:'decline',targetId:subject.id});
   Object.assign(sc.choices[1],{label:'接受陈砚的校法之约',intent:'craft',approach:'pledge'});
 }
 if(progress?.commitment?.status==='owed'&&!omit){
   Object.assign(sc.choices[0],{label:'帮助陈砚',intent:'interact',approach:'help',targetId:subject.id});
   Object.assign(sc.choices[1],{label:'向陈砚归还行粮',intent:'craft',approach:'repay'});
 }
 if(other)sc.entities.push({id:'r:88d5c5505f1d09bb:t'+next+':e:other',name:'李明',kind:'person'});
 if(omit){sc.entities=[];sc.choices=sc.choices.filter(c=>c.targetId==='self');sc.blocks=[{kind:'narration',text:'雨停了，渡口空无一人。'}];}
 return sc;
}
function step(s,p,opts){const sc=scene(s,p,opts);return commitTurn(s,p,sc);}
function opening(seed,marked=true){const s=life(seed,marked),p=prepareOpening(s,{requestId:'first'});return step(s,p);}
const seeds=Array.from({length:64},(_,i)=>i+1),badSeed=seeds.find(n=>TECHNIQUES[life(n).life.birth.cultivationProfile.techniqueId].defective),goodSeed=seeds.find(n=>!TECHNIQUES[life(n).life.birth.cultivationProfile.techniqueId].defective);
test('four saved openings appear in the actual marked model request; ordinary complete methods are not described as broken',()=>{
 const motives=new Set();for(const n of seeds.slice(0,24)){const s=life(n),p=prepareOpening(s,{requestId:'first'}),c=ctx(s,p),b=buildOpeningBrief(c);
  assert.deepEqual(buildOpeningBrief(structuredClone(c)),b);motives.add(b.kind);const req=buildStoryInput(profile,c);const text=req.messages.at(-1).content;
  assert.ok(text.includes(b.goal));assert.doesNotMatch(text,/在出生地遇见一名能交谈的当地人类/);assert.equal(req.messages[1].content.includes(s.life.name),true);
  if(!TECHNIQUES[cexp(s).activeTechniqueId].defective)assert.doesNotMatch(b.goal,/残法|残缺/);
 }assert.equal(motives.size,4);const s=life(9,false);assert.equal(buildOpeningBrief(ctx(s,prepareOpening(s,{requestId:'old'}))),null);
});
test('a poor character can diagnose and spend time to repair; recovery cannot alter birth or mint resources',()=>{
 let s=opening(badSeed);const birth=structuredClone(s.life.birth);assert.throws(()=>pending(s,'自行推演残法'));
 let p=pending(s,'验看本命功法');assert.equal(p.receipt.elapsedDays,1);s=step(s,p);assert.ok(cexp(s).lessons.includes('diagnosed'));
 p=pending(s,'自行推演残法');assert.deepEqual(p, pending(s,'自行推演残法'));assert.equal(p.receipt.elapsedDays,90);assert.deepEqual(p.receipt.itemChanges,{});
 s=step(s,p);assert.equal(cexp(s).repaired,true);assert.deepEqual(s.life.birth,birth);assert.equal(cexp(s).commitment,undefined);assert.throws(()=>pending(s,'自行推演残法'));assert.deepEqual(deserializeLiveState(serializeLiveState(s)),s);
 assert.throws(()=>pending(opening(goodSeed),'验看本命功法'));assert.throws(()=>pending(opening(badSeed,false),'验看本命功法'));
});
test('only an explicit named offer incurs a real debt; generic help, refusal, paper promises and another person cannot pay it',()=>{
 let s=opening(badSeed),p=pending(s,'验看本命功法');s=step(s,p,{offer:true});
 const original=s,look=pending(s,'观察周围'),rumor=scene(s,look);
 rumor.memoryDeltas=[{entityId:subject.id,kind:'promise',status:'open',text:rumor.blocks[0].text}];
 const unchosen=commitTurn(s,look,rumor);assert.equal(cexp(unchosen).commitment,undefined);assert.equal(unchosen.director.mainQuest,null);
 for(const label of ['婉拒陈砚','观察周围']){const refused=step(s,pending(s,label));assert.equal(cexp(refused).commitment,undefined);assert.equal(cexp(refused).repaired,false);}
 p=pending(s,'接受陈砚的校法之约');assert.equal(p.receipt.elapsedDays,3);assert.equal(p.nextLife.cultivationProfile.experience.repaired,true);const debt=p.nextLife.cultivationProfile.experience.commitment;
 assert.deepEqual(debt,{entityId:subject.id,acceptedActionId:p.receipt.action.id,acceptedTurn:s.turnId+1,condition:'return-supply',status:'owed'});
 const tamper=structuredClone(p.receipt);tamper.after.cultivationProfile.experience.commitment.entityId='other';assert.throws(()=>validateReceipt(tamper));
 s=step(s,p,{other:true});assert.throws(()=>pending(s,'向李明归还行粮'));const offered=step(original,pending(original,'观察周围'));assert.throws(()=>pending(offered,'接受陈砚的校法之约'));
 const twins=structuredClone(s),another=twins.relatedEntities.find(e=>e.id!==subject.id);another.name=subject.name;twins.currentScene.entities.find(e=>e.id===another.id).name=subject.name;
 const mistaken={...p.receipt.action,id:'wrong-creditor',approach:'repay',targetId:another.id};assert.equal(compileChoices(twins,[mistaken])[0].enabled,false);
 const help=pending(s,'帮助陈砚');assert.equal(help.nextLife.cultivationProfile.experience.commitment.status,'owed');
 const paid=pending(s,'向陈砚归还行粮');assert.deepEqual(paid.receipt.itemChanges,{supplies:-1});assert.equal(paid.receipt.elapsedDays,1);assert.equal(paid.nextLife.cultivationProfile.experience.commitment.status,'fulfilled');s=step(s,paid);assert.throws(()=>pending(s,'向陈砚归还行粮'));
});
for(const [risk,actorChars,count,placeChars] of [['block a preflighted turn',59,6,35],['displace the latest turn',48,4,53]])test('an off-scene creditor may not '+risk,()=>{
  let s=life(badSeed),p=prepareOpening(s,{requestId:'birth'});
  const renamed={...subject,name:'溪'.repeat(actorChars)+'客'};
  function introduce(offer){
    const raw=scene(s,p,{offer});raw.entities[0]=renamed;raw.blocks[0].text=raw.blocks[0].text.replace(subject.name,renamed.name);s=commitTurn(s,p,raw);
  }
  introduce(false);p=pending(s,'验看本命功法');introduce(true);p=prepareChoice(s,{requestId:'pledge',choiceId:s.currentScene.choices[1].id});
  const context=ctx(s,p),raw=scene(s,p,{omit:true});
  raw.entities=Array.from({length:count},(_,i)=>({id:context.namespace+':t3:e:place_'+(i+1),kind:'place',name:String.fromCodePoint(0x4e00+i)+'支流'+'洞'.repeat(placeChars)}));
  raw.blocks[0].text='你到了河边，望见石刻记下的几处水道：'+raw.entities.map(e=>e.name).join('、')+'。';
  raw.memoryDeltas=raw.entities.map(e=>({kind:'fact',entityId:e.id,text:e.name}));
  validateGeneratedScene(raw,context,{continuity:true});
  s=commitTurn(s,p,raw);const next=prepareChoice(s,{choiceId:s.currentScene.choices[0].id,requestId:'n'.repeat(36)});
  const opt={selection:'relevance-v1',openTotal:0,continuity:true},base=buildStoryContext(s,next,[],opt);
  const creditor={id:'entity:'+renamed.id,runId:s.runId,turnId:2,kind:'entity',source:'narrative',entity:renamed,status:'alive'};
  const recovered=buildStoryContext(s,next,[creditor],opt);
  assert.ok(base.memory.recent.some(row=>row.turnId===s.turnId));assert.deepEqual(recovered.memory.recent,base.memory.recent);
  assert.ok(!recovered.entities.some(e=>e.id===renamed.id));assert.deepEqual(recovered.entities,base.entities);
  assert.deepEqual(recovered.receipt,base.receipt);assert.deepEqual(recovered.life.cultivationProfile.experience.commitment,base.life.cultivationProfile.experience.commitment);
  assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(recovered)))<=7000);
});
