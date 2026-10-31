import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLiveGame,prepareOpening,commitTurn,compileChoices,prepareChoice} from '../src/game/cultivation/live/engine.js';
import {v7ActionRule,resolveV7Action,TECHNIQUES,V7_REALMS} from '../src/game/cultivation/live/cultivation-rules.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';
import {buildStoryInput} from '../src/worker/story-provider-core.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/v540-unmarked-v7.json',import.meta.url)));
const birth=(marked=true)=>createLiveGame({...fixture.options,...(marked?{experienceVersion:1}:{})});
const npc=fixture.scene.entities[0];
const fight={...fixture.scene.choices[1],intent:'fight',approach:'assault',stake:'normal',label:'与陈砚交锋'};
const trait=realmId=>({version:1,realmId});
function start(realmId,marked=true){
 const s=birth(marked),p=prepareOpening(s,{requestId:'first'}),sc=structuredClone(fixture.scene);sc.choices[1]=fight;
 sc.blocks=[{kind:'narration',text:realmId?'陈砚已入'+V7_REALMS[realmId].name+'，意在守桥；旧伤未愈。':'陈砚站在桥头，气息未明。'}];
 if(realmId){sc.entities[0].experience=trait(realmId);sc.story.opponent={entityId:npc.id,anchor:0,realmId,purpose:'守桥',condition:'旧伤未愈'};}
 const c=buildStoryContext(s,p,[]);validateGeneratedScene(sc,c);return commitTurn(s,p,sc);
}
test('absolute opponent strength changes the actual fight and a promoted player faces the same opponent on better terms',()=>{
 const unknown=start(),same=start('mortal'),strong=start('foundation');
 const state=structuredClone(strong);state.life.realm='golden';const r0=v7ActionRule(strong,fight),r1=v7ActionRule(state,fight),weak=v7ActionRule(same,fight);
 assert.ok(r1.chance>r0.chance&&r1.injury<r0.injury&&weak.chance>r0.chance&&weak.failureInjury<r0.failureInjury);
 const roll=r0.chance+1,a=resolveV7Action(strong.life,fight,r0,roll),b=resolveV7Action(state.life,fight,r1,roll);
 assert.equal(a.result.check.success,false);assert.equal(b.result.check.success,true);assert.ok(a.nextLife.injury>b.nextLife.injury);
 const menu=compileChoices(strong,[fight])[0],p=prepareChoice(strong,{choiceId:fight.id,requestId:'fight'});assert.deepEqual(menu.outlook,r0.outlook);assert.equal(menu.outlook.purpose,'守桥');assert.equal(menu.outlook.condition,'旧伤未愈');assert.equal(menu.costs.spirit,r0.spiritCost);assert.equal(p.receipt.cultivationResult.check.chance,r0.chance);
 assert.equal(compileChoices(unknown,[fight])[0].outlook.band,'unknown');assert.equal(compileChoices(start(undefined,false),[fight])[0].outlook,undefined);
});
test('repair removes only the active technique penalty across all catalogued defects',()=>{
 const s=birth(),e=s.life.cultivationProfile.experience,p={...fight,intent:'practice',approach:'steady',targetId:'self',stake:'low'},br={...p,approach:'breakthrough',targetId:'qi'};
 for(const t of Object.values(TECHNIQUES).filter(t=>t.defective)){e.activeTechniqueId=t.id;e.repaired=false;const before=v7ActionRule(s,p),oldBreak=v7ActionRule(s,br);e.repaired=true;const after=v7ActionRule(s,p),newBreak=v7ActionRule(s,br);assert.equal(after.cultivation,before.cultivation);assert.ok(after.days<before.days||after.spiritCost<before.spiritCost||after.exposure<before.exposure||after.checkKind!==before.checkKind||oldBreak.chance<newBreak.chance,t.id);}
});
test('named wire only accepts grounded opponent notes and never maps a second actor or a player assumption to a rank',()=>{
 const s=birth(),p=prepareOpening(s,{requestId:'first'}),c=buildStoryContext(s,p,[]),schema=buildStoryInput({...GLM_PROFILE,storyActions:true},c).response_format.json_schema.schema;
 assert.ok(schema.properties.story.properties.opponent);const actor={kind:'person',name:'陈砚',ref:'',status:null};
 const w={title:'桥头',location:'落苇渡',blocks:[{kind:'narration',text:'陈砚已入筑基，正等船归。'}],choices:[{action:'fight:guard',target:actor,stake:'low',purpose:'守住桥头',anchor:0},{action:'rest:recover',target:'self',stake:'low',purpose:'停在岸边',anchor:0}],memoryDeltas:[],story:{pattern:'conflict',beat:'progress',anchors:[0],opponent:{target:actor,anchor:0,realmId:'foundation',purpose:'等船归'}}};
 let sc=decodeGlmScene(w,c,{storyActions:true});assert.deepEqual(sc.entities[0].experience,trait('foundation'));validateGeneratedScene(sc,c);
 for(const text of ['陈砚看见一名筑基客人。','传闻陈砚已入筑基。','陈砚已入筑基丹房。']){w.blocks[0].text=text;sc=decodeGlmScene(w,c,{storyActions:true});assert.equal(sc.entities[0].experience,undefined);}
 const fake=structuredClone(sc);fake.entities[0].experience=trait('foundation');assert.throws(()=>validateGeneratedScene(fake,c));
 assert.throws(()=>start('foundation',false));
});
test('a known actor cannot shed or rewrite a ranked identity, or move a rank onto a place, old life or ungrounded note',()=>{
 const ranked=start('foundation'),p=prepareChoice(ranked,{requestId:'again',choiceId:ranked.currentScene.choices[0].id}),c=buildStoryContext(ranked,p,[]);
 const next=structuredClone(ranked.currentScene);next.id=next.id.replace(':t1:s:',':t2:s:');for(const a of next.choices)a.id=a.id.replace(':t1:c:',':t2:c:');delete next.story.opponent;next.blocks=[{kind:'narration',text:'陈砚还在桥头等船。'}];validateGeneratedScene(next,c);assert.deepEqual(commitTurn(ranked,p,next).relatedEntities[0].experience,trait('foundation'));
 for(const edit of [e=>delete e.experience,e=>e.experience=trait('golden'),e=>e.experience=trait('invented'),e=>e.experience.bonus=2,e=>e.kind='place']){const bad=structuredClone(next);edit(bad.entities[0]);assert.throws(()=>validateGeneratedScene(bad,c));}
});
test('unmarked fight menu and paid action reproduce the independently captured pre-change digests',async()=>{
 const {canonicalStringify,sha256}=await import('../src/game/cultivation/live/identity.js'),s=start(undefined,false),menu=compileChoices(s,[fight])[0],p=prepareChoice(s,{choiceId:fight.id,requestId:'fight'});
 assert.equal(sha256(canonicalStringify(menu)),'a86208727fccfe9eb74d604d985b93025fa043bfa490af4c6e5737bba94a994b');
 assert.equal(sha256(canonicalStringify(p)),'9c565032a418d99525c25abc1f4f08c4009ca4785c0e91bba4f9746e8c9481c9');
});
