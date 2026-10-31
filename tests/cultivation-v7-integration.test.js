import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,settleDeath} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene} from '../src/game/cultivation/live/memory.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {sha256} from '../src/game/cultivation/live/identity.js';
import {buildRebirthOptions,getReincarnationSettlement} from '../src/game/cultivation/live/reincarnation.js';

function scene(state,{combat=false}={}){
  const prefix='r:'+sha256(state.runId).slice(0,16)+':t'+(state.turnId+1)+':',actor={id:'r:'+sha256(state.runId).slice(0,16)+':t1:e:chen',name:'陈砚',kind:'person'};
  return {id:prefix+'s:scene',title:'渡头旧事',location:'落苇渡',blocks:[{kind:'narration',text:'第'+(state.turnId+1)+'次停步，陈砚仍站在落苇渡的旧桥旁。'+'远处的水声遮住了低语，桥栏的刻痕却留下几处值得分辨的线索。你仍能自行决定是否追问，或在原地观察局势。'.repeat(4)}],entities:[actor],choices:[
    {id:prefix+'c:a',label:combat?'与陈砚拼死一搏':'观察旧桥的刻痕',intent:combat?'fight':'interact',targetId:combat?actor.id:'self',approach:combat?'desperate':'observe',stake:combat?'high':'low'},
    {id:prefix+'c:b',label:'询问陈砚渡头的旧事',intent:'interact',targetId:actor.id,approach:'ask',stake:'low'},
    {id:prefix+'c:c',label:'婉拒陈砚，暂不追索旧事',intent:'interact',targetId:actor.id,approach:'decline',stake:'low'},
  ],memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}};
}
function open(options={}){
 const {combat=false,...birth}=options;
 const state=createLiveGame({runId:'v7-integrated',seed:42,engineVersion:7,...birth}),pending=prepareOpening(state,{requestId:'open'}),opening=scene(state,{combat});
 validateGeneratedScene(opening,buildStoryContext(state,pending));
 return commitTurn(state,pending,opening);
}

test('v7 opening and serialized world state use the same validated context and rules',()=>{
 const state=open();assert.equal(state.director.version,7);assert.equal(state.director.turnId,1);assert.deepEqual(deserializeLiveState(serializeLiveState(state)),state);
 const legacy=createLiveGame({runId:'legacy-still',seed:42});assert.equal(legacy.director,undefined);assert.equal(legacy.life.cultivationProfile,undefined);
});
test('offered action preserves exact intent through pending verification, context and commit',()=>{
 const state=open(),before=JSON.stringify(state),choice=state.currentScene.choices[1],text=choice.label;
 const pending=prepareChoice(state,{requestId:'ask',choiceId:choice.id}),context=buildStoryContext(state,pending);
 assert.equal(context.receipt.action.label,text);assert.equal(context.receipt.elapsedDays,0);
 const next=scene(state);validateGeneratedScene(next,context);const committed=commitTurn(state,pending,next);
 assert.equal(committed.lastReceipt.action.label,text);assert.equal(committed.life.ageDays,state.life.ageDays);assert.equal(committed.director.turnId,2);assert.equal(JSON.stringify(state),before);
});
test('unsupported or unaffordable custom actions cannot advance state or random outcome',()=>{
 const state=open(),before=JSON.stringify(state);
 for(const text of ['询问陈砚：旧桥的刻痕是谁留下的？','休整','2','瞬移到天界','突破炼气','不攻击陈砚，只观察四周'])assert.throws(()=>prepareChoice(state,{requestId:'invalid',customAction:text}),{code:'CUSTOM_ACTION_UNSUPPORTED'});
 assert.equal(JSON.stringify(state),before);
});
test('actual local death creates affordable next-life inheritance without a provider',()=>{
 let state=open({combat:true});
 for(let turn=0;state.phase==='active'&&turn<10;turn++){
   const pending=prepareChoice(state,{requestId:'combat-'+turn,choiceId:state.currentScene.choices[0].id});
   state=pending.receipt.death?settleDeath(state,pending):commitTurn(state,pending,scene(state,{combat:true}));
 }
 assert.equal(state.phase,'dead');assert.equal(state.director.turnId,state.turnId);assert.ok(getReincarnationSettlement(state));
 const inherited=buildRebirthOptions(state,['past-memory']),child=createLiveGame({runId:'v7-descendant',seed:71,...inherited});
 assert.equal(child.reincarnation.parentRunId,state.runId);assert.equal(child.reincarnation.generation,2);assert.ok(child.life.birth.cultivationProfile.inheritedBenefits.includes('past-memory'));
 buildStoryContext(child,prepareOpening(child,{requestId:'reborn'}));
 assert.deepEqual(deserializeLiveState(serializeLiveState(child)),child);
});
