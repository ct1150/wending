import test from 'node:test';
import assert from 'node:assert/strict';
import {rollLiveBirth,createLiveGame,prepareOpening,prepareChoice,commitTurn,compileChoices} from '../src/game/cultivation/live/engine.js';
import {validateLiveState,validateBirth} from '../src/game/cultivation/live/validation.js';
import {initialItemsForBirth} from '../src/game/cultivation/live/cultivation-rules.js';
import {buildOpeningBrief} from '../src/game/cultivation/live/experience-story.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {renderLiveBirth} from '../src/ui/character.js';
import {generateScene} from '../src/worker/story-provider.js';
import {GLM_PROFILE} from '../src/worker/story-config.js';
import {createLiveSession} from '../src/ui/live-session.js';
import {stateHash,sha256} from '../src/game/cultivation/live/identity.js';
import {buildRebirthOptions} from '../src/game/cultivation/live/reincarnation.js';
import {storyLife} from './helpers/experience-death.js';

const options={engineVersion:7,experienceVersion:1,originStories:true};
const profile={...GLM_PROFILE,validated:true,supportsStructuredOutput:true};
const actor={kind:'person',name:'灰衣管事'};
const wire={blocks:[{kind:'dialogue',speaker:actor,text:'外院今早只剩两处差事：去山路搬炭，或去石房抄录。先问明白，定下差事才领腰牌。'}],choices:[{action:'interact:ask',target:actor,purpose:'问清两处差事如何换取试修机会'},{action:'interact:observe',target:'self',purpose:'看看登记册上被划去名字的少年'}]};
async function complete(context){let input;const ai={async run(model,value){input=value;return new Response('data: '+JSON.stringify({model,choices:[{delta:{content:JSON.stringify(wire)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}})+'\n\ndata: [DONE]\n\n').body;}};const result=await generateScene(ai,profile,context,{}, {storyActions:true});return {result,input};}

test('every new marked birth has one ordinary background while rolls and locked talents still vary',()=>{
 const hands=new Set(),roots=new Set();
 for(let seed=0;seed<80;seed++){
  const roll=rollLiveBirth({seed,...options});assert.equal(roll.birth.originId,'mortal');assert.equal(roll.birth.backgroundId,'mortal-mountain-gate');
  const state=createLiveGame({runId:'ordinary-'+seed,seed,name:'顾行舟',...options});assert.deepEqual(state.life.birth,roll.birth);assert.equal(state.rng,roll.rng);
  assert.deepEqual(initialItemsForBirth(roll.birth),{supplies:2,stones:0});assert.equal(state.life.realm,'mortal');assert.equal(state.life.ageDays,16*360);assert.equal(state.life.cultivation,0);
  assert.equal(state.director.world.location,'栖云门外院');assert.equal(state.director.world.faction,'栖云门');
  const brief=buildOpeningBrief({life:state.life,director:state.director,phase:'opening'});assert.equal(brief.kind,'entry');assert.equal(brief.goal,'在栖云门立足，弄清引气入体的门槛');
  assert.doesNotMatch(state.director.destiny.text,/伴生|旧因果|天命|转世/u);
  const locked=rollLiveBirth({seed:seed+1,lockedTalentId:roll.birth.talentIds[0],...options});assert.ok(locked.birth.talentIds.includes(roll.birth.talentIds[0]));assert.equal(locked.birth.backgroundId,'mortal-mountain-gate');
  hands.add(JSON.stringify([roll.birth.attributes,roll.birth.talentIds]));roots.add(roll.birth.cultivationProfile.rootId);
 }
 assert.ok(hands.size>20);assert.ok(roots.size>1);
});

test('creation shows one fixed background outside the roll without origin controls or old identities',()=>{
 const birth=rollLiveBirth({seed:4,...options}).birth;
 const html=renderLiveBirth({name:'顾行舟',birth,available:true});
 assert.match(html,/寒村少年，离乡入门/u);assert.match(html,/石溪村/u);assert.match(html,/栖云门/u);assert.match(html,/随身带着行粮 × 2/u);
 assert.doesNotMatch(html,/山村猎户|城坊匠徒|渡口短工|流亡孤儿|data-birth-origin|选择出身|<dt>出身<\/dt>/u);
 assert.ok(html.indexOf('id="live-origin-history"')<html.indexOf('id="live-roll-result"'));
 assert.equal((html.match(/id="live-origin-history"/g)??[]).length,1);
});

test('model opening uses the fixed family and gate facts, then follows the selected action without restarting entry',async()=>{
 const state=createLiveGame({runId:'model-ordinary',seed:4,name:'顾行舟',...options}),pending=prepareOpening(state,{requestId:'ordinary-open'}),context=buildStoryContext(state,pending);
 const opened=await complete(context);assert.equal(opened.result.status,'ready',opened.result.errorCode);
 const facts=JSON.parse(opened.input.messages[1].content),last=JSON.parse(opened.input.messages.at(-1).content);
 assert.equal(facts.birthMemory.origin,'寒村少年');assert.match(facts.birthMemory.beforeOpening,/父母健在/u);assert.match(facts.birthMemory.beforeOpening,/石溪村/u);
 assert.match(last.opening,/栖云门外院/u);assert.match(opened.input.messages[0].content,/不是天选/u);assert.match(opened.input.messages[0].content,/入门口诀/u);
 const active=commitTurn(state,pending,opened.result.scene);assert.equal(active.currentScene.location,'栖云门外院');assert.ok(compileChoices(active,active.currentScene.choices).every(c=>c.enabled));
 const next=prepareChoice(active,{requestId:'ordinary-ask',choiceId:active.currentScene.choices[0].id});const follow=await complete(buildStoryContext(active,next,[],{continuity:true}));
 assert.equal(follow.result.status,'ready',follow.result.errorCode);const continuation=JSON.parse(follow.input.messages.at(-1).content);
 assert.equal(continuation.opening,null);assert.equal(continuation.selectedPurpose,wire.choices[0].purpose);assert.equal(continuation.settledLocation,'栖云门外院');
});

test('historical explicit origins remain byte-stable and the new identity cannot omit its background',()=>{
 const baseline={village:'e0dd813427373116343fdf6bfa0ddffd3c8f2c96c7b231ab3efd0c2267b64ad5',artisan:'3d7c276cffa80958648304c279c182ccb06001877891dc9ebc7b26084b601b3c',ferry:'ffc6bfd25f3a457570f7876068740a7df8258a0a5fd9cf7516e53a949cbcc8e1',exile:'45932c0165586c22a8dac9970b566c10f975a18533044011ba6e72f7f5c941a9'};
 for(const originId of ['village','artisan','ferry','exile']){
  const state=createLiveGame({runId:'old-'+originId,seed:4,originId,...options}),bytes=JSON.stringify(state);assert.notEqual(state.life.birth.originId,'mortal');validateLiveState(JSON.parse(bytes));assert.equal(JSON.stringify(state),bytes);
  assert.equal(stateHash(state),baseline[originId],'6.1.1 baseline archive hash must not change');
 }
 const birth=rollLiveBirth({seed:4,...options}).birth;delete birth.backgroundId;assert.throws(()=>validateBirth(birth));
});

test('a reborn character keeps the fixed background and their actually purchased inheritance',()=>{
 const parent=storyLife('ordinary-parent',true).state;
 const inheritance=buildRebirthOptions(parent,['past-memory']),params={...inheritance,originStories:true,seed:4};
 const {reincarnation,...previewOptions}=params;
 const preview=rollLiveBirth(previewOptions),child=createLiveGame({...params,runId:'ordinary-child'});
 assert.deepEqual(child.life.birth,preview.birth);assert.equal(child.life.birth.originId,'mortal');assert.equal(child.life.birth.backgroundId,'mortal-mountain-gate');
 assert.deepEqual(child.life.birth.cultivationProfile.inheritedBenefits,['past-memory']);assert.equal(child.life.cultivation,1);assert.equal(child.reincarnation.generation,2);
 assert.equal(child.director.world.location,'栖云门外院');
});

test('a saved mortal pending turn cannot create an attempt against a rolled-back older service',async()=>{
 const state=createLiveGame({runId:'pending-mortal',seed:4,...options}),pending=prepareOpening(state,{requestId:'kept-pending'}),stored={archiveId:'kept',state,pending,attempt:null};let mutations=0;
 const archive={load:async()=>structuredClone(stored),setAttempt:async()=>{mutations++;throw Error('must not mutate');}};
 const client={capabilities:async()=>({available:true,experienceVersion:1,originStories:true,storyActions:true}),createSession:async()=>{mutations++;throw Error('must not infer');},requestTurn:async()=>{mutations++;throw Error('must not infer');}};
 const session=createLiveSession({archive,client});await session.load();const result=await session.retry();
 assert.equal(mutations,0);assert.equal(result.errorCode,'EXPERIENCE_UNSUPPORTED');assert.deepEqual(result.pending,pending);assert.deepEqual(result.state,state);
});

test('birth-only instructions do not make an advanced character uninitiated again',async()=>{
 let state=createLiveGame({runId:'advanced-ordinary',seed:4,...options});
 function finish(pending){
  const life=pending.nextLife;
  const primary=life.realm!=='mortal'?{intent:'interact',approach:'observe',targetId:'self'}:life.injury>1||life.cultivationProfile.spirit<30?{intent:'rest',approach:'recover',targetId:'self'}:life.cultivation<2?{intent:'practice',approach:'steady',targetId:'self'}:!life.items.manual?{intent:'explore',approach:'cautious',targetId:'manual'}:{intent:'practice',approach:'breakthrough',targetId:'qi'};
  const fallback=primary.intent==='interact'?{intent:'rest',approach:'recover',targetId:'self'}:{intent:'interact',approach:'observe',targetId:'self'},prefix='r:'+sha256(state.runId).slice(0,16)+':t'+pending.identity.turnId+':';
  const scene={id:prefix+'s:scene',title:'外院修行',location:'栖云门外院',entities:[],blocks:[{kind:'narration',text:'外院的灯又换过一盏，石阶上留下新一夜的雨痕。'}],choices:[primary,fallback].map((a,i)=>({...a,id:prefix+'c:'+i,label:i?'看看眼前石阶':'继续修行',stake:'low'})),memoryDeltas:[],story:{pattern:'discovery',beat:'progress',anchors:[0]}};
  state=commitTurn(state,pending,scene);
 }
 finish(prepareOpening(state,{requestId:'advance-open'}));
 for(let i=0;i<20&&state.life.realm==='mortal';i++)finish(prepareChoice(state,{requestId:'advance-'+i,choiceId:state.currentScene.choices[0].id}));
 assert.equal(state.life.realm,'qi');
 const pending=prepareChoice(state,{requestId:'after-qi',choiceId:state.currentScene.choices[0].id}),context=buildStoryContext(state,pending,[],{continuity:true});
 const {input}=await complete(context);
 assert.match(input.messages[0].content,/境界炼气/u);
 assert.doesNotMatch(input.messages[0].content,/尚未引气|当前功法视为此前领到的入门口诀/u);
 assert.match(JSON.parse(input.messages[1].content).birthMemory.beforeOpening,/还没有真正引气/u,'birth-time history remains history');
});

test('an older service cannot replace an existing save with an unsupported new beginning',async()=>{
 const old=createLiveGame({runId:'kept-save',seed:4,originId:'ferry',...options}),stored={archiveId:'kept',state:old,pending:null};let writes=0;
 const archive={load:async()=>structuredClone(stored),create:async()=>{writes++;throw Error('must not replace');}};
 const client={capabilities:async()=>({available:true,experienceVersion:1,originStories:true,storyActions:true})};
 const session=createLiveSession({archive,client}),result=await session.startNew({runId:'unsupported-new',seed:4,...options},'kept');
 assert.equal(writes,0);assert.equal(result.errorCode,'EXPERIENCE_UNSUPPORTED');assert.deepEqual(result.state,old);
});
