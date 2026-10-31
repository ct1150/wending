import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeV7Presentation} from '../src/worker/story-v7-presentation.js';
import {createLiveGame,prepareOpening} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext} from '../src/game/cultivation/live/memory.js';
import {decodeGlmScene} from '../src/worker/story-glm-wire.js';

const state=createLiveGame({runId:'v7-visible',seed:42,engineVersion:7}),context=()=>structuredClone(buildStoryContext(state,prepareOpening(state,{requestId:'first'})));
const actor={kind:'person',name:'船夫'},row=(action,target,purpose='查看船头的陶罐')=>({action,target,purpose});
const scene=choices=>({blocks:[{kind:'narration',text:'渡船拢岸，载来一只陶罐。'}],choices,title:'河岸',location:'渡口',memoryDeltas:[],story:{pattern:'investigation',beat:'progress',anchors:[0]}});

test('only known interaction mechanics are fixed; no other stake, action or purpose is inferred',()=>{
  const c=context(),choices=['ask','observe','decline','leave','help'].map(a=>row('interact:'+a,actor));
  for(const choice of choices){const result=normalizeV7Presentation(scene([{...choice,stake:'high',anchor:3},row('travel:road',{kind:'place',name:'松桥'})]),c);assert.deepEqual(result.choices[0],{...choice,stake:'low',anchor:0});assert.equal(Object.hasOwn(result.choices[1],'stake'),false);assert.equal(result.choices[1].anchor,0);}
  const other=row('fight:guard',actor),invalid={label:'去问问船夫'};
  assert.deepEqual(normalizeV7Presentation(scene([{...other,stake:'high'},invalid]),c).choices,[{...other,stake:'high',anchor:0},invalid]);
  const injected={...choices[0],stake:{receipt:null}};assert.throws(()=>normalizeV7Presentation(scene([injected,other]),c));
});

test('a uniquely confirmed present or known name keeps the same canonical target and actual dialogue speaker',()=>{
  const c=context();c.entities=[{id:'old:teacher',kind:'person',name:'塾师',status:'alive'}];
  const input=scene([row('interact:ask','船夫'),row('interact:observe',{...actor,description:null,status:'',ref:''}),row('interact:decline','塾师')]);input.blocks=[{kind:'dialogue',speaker:'船夫',text:'陶罐是在河心捞起来的。'}];
  const original=JSON.stringify(input),fixed=normalizeV7Presentation(input,c),stored=decodeGlmScene(fixed,c,{storyActions:true});
  assert.equal(JSON.stringify(input),original);assert.deepEqual(fixed.blocks[0].speaker,actor);assert.deepEqual(fixed.choices[0].target,actor);assert.deepEqual(fixed.choices[1].target,{...actor,ref:''});assert.equal(fixed.choices[2].target,'k1');
  assert.equal(stored.blocks[0].speaker,stored.choices[0].targetId);assert.equal(stored.choices[2].targetId,'old:teacher');
});

test('targetId is only a field synonym for a legal target, and a supplied label is removed only on an exact match',()=>{
  const c=context();c.entities=[{id:'old:boat',kind:'person',name:'船夫',status:'alive'}];
  const p='陶罐从哪里来',a={action:'interact:ask',targetId:'k1',purpose:p,label:'询问船夫：'+p},b={action:'interact:observe',targetId:'self',purpose:'查看河岸',label:'仔细观察：查看河岸'};
  const run=(left,right=b)=>normalizeV7Presentation(scene([left,right]),c).choices;
  assert.deepEqual(run(a),[row('interact:ask','k1',p),row('interact:observe','self','查看河岸')].map(x=>({...x,anchor:0,stake:'low'})));
  assert.deepEqual(run({...a,targetId:{kind:'person',name:'新渡者'},label:'询问新渡者：'+p})[0].target,{kind:'person',name:'新渡者'});
  for(const invalid of ['k9','old:boat','船夫','stones',{kind:'person',name:'假人',ref:'k1'}])assert.equal(Object.hasOwn(run({...a,targetId:invalid})[0],'targetId'),true);
  for(const label of [p,'询问船夫：'+p+' ','启程前往渡口'])assert.equal(run({...a,label})[0].label,label);
  const crossing={action:'travel:smuggle',targetId:{kind:'place',name:'中界云津'},stake:'high',purpose:'进入中界'};assert.equal(Object.hasOwn(run(crossing)[0],'targetId'),true);
});

test('unknown, ambiguous, dead, wrong-kind and explicitly forged references are never rebound',()=>{
  const c=context();c.entities=[{id:'old:a',name:'阿甲',kind:'person',status:'alive'},{id:'old:b',name:'阿甲',kind:'person',status:'alive'},{id:'old:dead',name:'故人',kind:'person',status:'dead'},{id:'old:place',name:'溪口',kind:'place',status:'unknown'}];
  for(const name of ['阿甲','故人','溪口','陌生人','old:a','k99']){
    const wire=scene([row('interact:ask',name),row('interact:decline',actor)]);wire.blocks=[{kind:'dialogue',speaker:name,text:'还有一只陶罐。'}];
    const fixed=normalizeV7Presentation(wire,c);assert.equal(fixed.choices[0].target,name);assert.equal(fixed.blocks[0].speaker,name);
  }
  const death=scene([row('interact:ask','船夫'),row('interact:observe',actor)]);death.memoryDeltas=[{kind:'death',target:actor,anchor:0}];assert.equal(normalizeV7Presentation(death,c).choices[0].target,'船夫');
  for(const bad of [{...actor,life:null},{...actor,receipt:''},{...actor,ref:'k1'},{...actor,id:'r:other:t2:e:actor'}]){
    const fixed=normalizeV7Presentation(scene([row('interact:ask',bad),row('interact:observe','self')]),c);assert.deepEqual(fixed.choices[0].target,bad);assert.throws(()=>decodeGlmScene(fixed,c,{storyActions:true}));
  }
});
