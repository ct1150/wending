import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompleteV7Wire} from '../src/worker/story-readable-wire.js';

const blocks=[{kind:'narration',text:'纸上写着「}、]、{」，他又说："先问船夫。"'}],person={kind:'person',name:'船夫'};
const choices=['ask','observe','decline'].map((a,i)=>({action:'interact:'+a,target:person,stake:'low',purpose:['问渡河的时辰','查看陶罐','暂且道别'][i],anchor:0}));
const core='{"blocks":'+JSON.stringify(blocks)+',"choices":'+JSON.stringify(choices);

test('complete compact interactions survive broken JSON without inventing missing non-interaction stakes',()=>{
  const compact=choices.slice(0,2).map(({stake,anchor,...row})=>row),truncated=rows=>'{"blocks":'+JSON.stringify(blocks)+',"choices":'+JSON.stringify(rows);
  assert.deepEqual(readCompleteV7Wire(truncated(compact)),{blocks,choices:compact});
  const travel={action:'travel:road',target:{kind:'place',name:'渡口'},purpose:'去渡口查看'};
  assert.equal(readCompleteV7Wire(truncated([compact[0],travel])),null);
  assert.deepEqual(readCompleteV7Wire(truncated([compact[0],{...travel,stake:'normal'}])).choices[1],{...travel,stake:'normal'});
  assert.equal(readCompleteV7Wire(truncated([compact[0],{...compact[1],unknown:null}])),null);
});

test('only complete original fields survive a malformed JSON ending; escaped prose and choices remain untouched',()=>{
  const source=core+',"title":"渡口","location":"青石桥","memoryDeltas":[],"story":{"pattern":"investigation","beat":"pro';
  assert.deepEqual(readCompleteV7Wire(source),{blocks,choices,title:'渡口',location:'青石桥',memoryDeltas:[]});
  assert.deepEqual(readCompleteV7Wire(core+',}'),{blocks,choices});
  assert.equal(readCompleteV7Wire(core+'}'),null,'valid JSON uses the ordinary parser');
});

test('two closed original choices survive a truncated or syntactically invalid third row',()=>{
  const two='{"blocks":'+JSON.stringify(blocks)+',"choices":'+JSON.stringify(choices.slice(0,2)).slice(0,-1);
  assert.deepEqual(readCompleteV7Wire(two+','+JSON.stringify(choices[2]).slice(0,-5)),{blocks,choices:choices.slice(0,2)});
  assert.deepEqual(readCompleteV7Wire(two+',{ "action": }],"title":"河岸"}'),{blocks,choices:choices.slice(0,2),title:'河岸'});
  assert.deepEqual(readCompleteV7Wire(two),{blocks,choices:choices.slice(0,2)});
  assert.equal(readCompleteV7Wire(two+',{},{}]'),null,'never hide a fourth option');
});

test('incomplete or unusable core, unknown fields and multiple roots never enter the receiver',()=>{
  const one='{"blocks":'+JSON.stringify(blocks)+',"choices":['+JSON.stringify(choices[0]);
  for(const source of [one+',{ "action":',core+'} {}',core+'} trailing',core+',"life":{',core+',"\\u0072etrieval":',core+',"other":',core+',"story":{"receipt":',core+',"blocks":[]',core+',"__proto__":{',core+',"story":{} }\n'+core+'}',core+',"memoryDeltas":[{},', '{"blocks":[],"choices":'+JSON.stringify(choices),'{"blocks":[{"kind":"narration","text":"incomplete',core.replace('"choices":','"choices":null,"choices":')]){
    if(source.endsWith('"memoryDeltas":[{},'))continue; // incomplete optional array is omitted as a whole
    assert.equal(readCompleteV7Wire(source),null,source.slice(-75));
  }
  assert.deepEqual(readCompleteV7Wire(core+',"memoryDeltas":[{},'),{blocks,choices});
  assert.equal(readCompleteV7Wire('{"blocks":[{"kind":"narration"}],"choices":'+JSON.stringify(choices)),null);
  assert.equal(readCompleteV7Wire('{"blocks":'+JSON.stringify(blocks)+',"choices":[{},{}]'),null);
});

test('authority-looking text inside ordinary prose is data, and over-budget or excessively nested drafts are rejected',()=>{
  const quoted=[{kind:'narration',text:'他在纸上写下 "life": 和两个括号 }{。'}];
  assert.deepEqual(readCompleteV7Wire(core.replace(JSON.stringify(blocks),JSON.stringify(quoted))),{blocks:quoted,choices});
  assert.equal(readCompleteV7Wire(core+',"story":'+ '['.repeat(40)),null);
  assert.equal(readCompleteV7Wire(core+',"title":"'+'汉'.repeat(24000)),null);
});
