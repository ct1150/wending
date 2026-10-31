import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveGame, prepareOpening, prepareChoice, commitTurn } from '../src/game/cultivation/live/engine.js';
import { buildStoryContext, validateStoryContext, validateGeneratedScene } from '../src/game/cultivation/live/memory.js';
import { validateLiveState } from '../src/game/cultivation/live/validation.js';
import { canonicalStringify, sha256, stateHash } from '../src/game/cultivation/live/identity.js';

function opening(runId='retrieval-legacy') {
  const state=createLiveGame({runId,seed:42});
  const pending=prepareOpening(state,{requestId:'retrieval-old-open'});
  const prefix='r:'+sha256(state.runId).slice(0,16)+':t1:';
  const scene={id:prefix+'s:scene',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你循路前行，望见松影。'}],entities:[],choices:[
    {id:prefix+'c:watch',label:'查看松影',intent:'interact',targetId:'self',stake:'low',approach:'observe'},
    {id:prefix+'c:rest',label:'歇息调养',intent:'rest',targetId:'self',stake:'low',approach:'recover'},
  ],memoryDeltas:[]};
  return {state,pending,scene};
}

const emptyMemory=()=>({version:1,recentCardIds:[],recentEvidenceIds:[],recentFamilies:[]});
function receipt(context,n=1) {
  return {version:1,corpusVersion:'fanren-test-v1',queryHash:sha256(canonicalStringify(context)),cardIds:['WD-FR-'+n],evidenceIds:['FR-E-'+n],families:['investigation_'+n]};
}
function followingScene(state,n) {
  const prefix='r:'+sha256(state.runId).slice(0,16)+':t'+(state.turnId+1)+':';
  return {...opening(state.runId).scene,id:prefix+'s:scene',blocks:[{kind:'narration',text:'你查看第'+n+'处松影，仍在山间。'}],choices:[
    {id:prefix+'c:watch',label:'查看下一处松影',intent:'interact',targetId:'self',stake:'low',approach:'observe'},
    {id:prefix+'c:rest',label:'歇息调养',intent:'rest',targetId:'self',stake:'low',approach:'recover'},
  ]};
}

test('replaying a scene without source metadata preserves pre-retrieval snapshot hashes',()=>{
  const {state,pending,scene}=opening();
  assert.equal(stateHash(state),'9e6eeadb0fe8463d620c0e7256953da753c4a6f0486d6ac4c54dfe9d88c2acd5');
  const next=commitTurn(state,pending,scene);
  assert.equal(stateHash(next),'c6481068084b0c2e09db395cea331a96f8999a1919e656d37d42a8f7cc7c60a1');
  const fixed=prepareChoice(next,{requestId:'retrieval-old-next',choiceId:scene.choices[0].id});
  assert.equal(fixed.identity.stateHash,'c6481068084b0c2e09db395cea331a96f8999a1919e656d37d42a8f7cc7c60a1');
  assert.doesNotThrow(()=>validateLiveState(JSON.parse(JSON.stringify(next))));
});

test('a fresh request advertises compact retrieval support without changing its saved life',()=>{
  const {state,pending}=opening(),before=JSON.stringify(state),context=buildStoryContext(state,pending);
  assert.deepEqual(context.retrieval,emptyMemory());
  assert.equal(JSON.stringify(state),before);
  assert.equal(Object.hasOwn(state,'retrieval'),false);
  const old=structuredClone(context);delete old.retrieval;const frozen=JSON.stringify(old);
  assert.doesNotThrow(()=>validateStoryContext(old));
  assert.equal(JSON.stringify(old),frozen,'validating a frozen pre-feature context must not add capability fields');
});

test('only committing an accepted scene adds source exposure to the life',()=>{
  const {state,pending,scene}=opening(),context=buildStoryContext(state,pending),original=JSON.stringify(state);
  scene.retrieval=receipt(context);
  assert.doesNotThrow(()=>validateGeneratedScene(scene,context));
  assert.equal(JSON.stringify(state),original,'validation and prompt construction do not consume references');
  const next=commitTurn(state,pending,scene);
  assert.deepEqual(next.retrieval,{version:1,recentCardIds:['WD-FR-1'],recentEvidenceIds:['FR-E-1'],recentFamilies:['investigation_1']});
  assert.deepEqual(next.currentScene.retrieval,scene.retrieval);
  assert.equal(JSON.stringify(state),original);
  const nextPending=prepareChoice(next,{requestId:'retrieval-next',choiceId:next.currentScene.choices[0].id});
  assert.deepEqual(buildStoryContext(next,nextPending).retrieval,next.retrieval);
  assert.equal(Object.hasOwn(createLiveGame({runId:'retrieval-next-life',seed:42}),'retrieval'),false);
});

test('source exposure remains bounded and recent references survive many committed turns',()=>{
  let {state,pending,scene}=opening('retrieval-long');
  for(let n=1;n<=60;n++) {
    const context=buildStoryContext(state,pending);
    scene.retrieval=receipt(context,n);
    assert.doesNotThrow(()=>validateGeneratedScene(scene,context));
    state=commitTurn(state,pending,scene);
    assert.ok(Buffer.byteLength(JSON.stringify(state.retrieval))<=640);
    assert.equal(state.retrieval.recentCardIds.at(-1),'WD-FR-'+n);
    assert.equal(state.retrieval.recentEvidenceIds.at(-1),'FR-E-'+n);
    assert.equal(state.retrieval.recentFamilies.at(-1),'investigation_'+n);
    pending=prepareChoice(state,{requestId:'retrieval-turn-'+n,choiceId:state.currentScene.choices[0].id});
    scene=followingScene(state,n);
  }
  assert.ok(state.retrieval.recentCardIds.length<=8);
  assert.ok(state.retrieval.recentEvidenceIds.length<=16);
  assert.ok(state.retrieval.recentFamilies.length<=8);
  assert.ok(!JSON.stringify(state.retrieval).includes('FR-E-1"'));
  assert.doesNotThrow(()=>validateLiveState(state));
});

test('reusing a reference moves it to the recent end without adding a duplicate',()=>{
  let {state,pending,scene}=opening('retrieval-repeat');
  for(const n of [1,2,1]){
    const context=buildStoryContext(state,pending);scene.retrieval=receipt(context,n);
    assert.doesNotThrow(()=>validateGeneratedScene(scene,context));
    state=commitTurn(state,pending,scene);
    pending=prepareChoice(state,{requestId:'repeat-'+state.turnId,choiceId:state.currentScene.choices[0].id});
    scene=followingScene(state,state.turnId);
  }
  assert.deepEqual(state.retrieval,{version:1,recentCardIds:['WD-FR-2','WD-FR-1'],recentEvidenceIds:['FR-E-2','FR-E-1'],recentFamilies:['investigation_2','investigation_1']});
});

test('retrieval projection yields its oldest identifiers to game context without changing saved exposure',()=>{
  const {state,pending,scene}=opening('retrieval-projection'),prefix=scene.id.slice(0,scene.id.indexOf('s:scene'));
  scene.entities=Array.from({length:19},(_,i)=>({id:prefix+'e:'+i,name:'甲'.repeat(54)+String.fromCharCode(0x4e00+i),kind:'person'}));
  const next=commitTurn(state,pending,scene);
  next.retrieval={version:1,recentCardIds:Array.from({length:8},(_,i)=>'card-0000'+i),recentEvidenceIds:Array.from({length:16},(_,i)=>'evidence-00'+i),recentFamilies:Array.from({length:8},(_,i)=>'family-00'+i)};
  const before=JSON.stringify(next),fixed=prepareChoice(next,{requestId:'r'.repeat(80),choiceId:scene.choices[1].id});
  const context=buildStoryContext(next,fixed,[],{selection:'relevance-v1',openTotal:Number.MAX_SAFE_INTEGER,continuity:false});
  assert.equal(JSON.stringify(next),before);
  assert.deepEqual(context.life,fixed.nextLife);
  assert.deepEqual(context.receipt,fixed.receipt);
  assert.ok(Buffer.byteLength(JSON.stringify(JSON.stringify(context)))<=7000);
  assert.ok(JSON.stringify(context.retrieval).length<JSON.stringify(next.retrieval).length);
  for(const key of ['recentCardIds','recentEvidenceIds','recentFamilies'])assert.equal(context.retrieval[key].at(-1),next.retrieval[key].at(-1));
});

test('source metadata rejects private text, malformed hashes and unbounded identifiers',()=>{
  const {state,pending,scene}=opening(),context=buildStoryContext(state,pending),valid=receipt(context);
  for(const change of [
    value=>{value.text='private source paragraph';},
    value=>{value.queryHash='not-a-hash';},
    value=>{value.cardIds=['a','b'];},
    value=>{value.evidenceIds=['a','b','c'];},
    value=>{value.families=['a','b','c','d'];},
    value=>{value.families=['x'.repeat(65)];},
    value=>{value.evidenceIds=['x'.repeat(81)];},
    value=>{value.evidenceIds=['same','same'];},
  ]) {
    const metadata=structuredClone(valid);change(metadata);
    assert.throws(()=>validateGeneratedScene({...scene,retrieval:metadata},context));
  }
  const bad=structuredClone(context);bad.retrieval={...emptyMemory(),recentEvidenceIds:['private '.repeat(100)]};
  assert.throws(()=>validateStoryContext(bad));
});
