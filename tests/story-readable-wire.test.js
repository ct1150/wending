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

test('authored recovery preserves the complete original menu and long prose inside a single JSON fence or before a short signoff',()=>{
  const long=[{kind:'narration',text:'你沿水面的倒影查看那圈灵纹。'.repeat(56)}];
  const body={blocks:long,choices:choices.slice(0,2)};
  const raw=JSON.stringify(body),recover=s=>readCompleteV7Wire(s,{authoredChoices:true});
  assert.deepEqual(recover('```json\n'+raw+'\n```'),body);
  assert.deepEqual(recover(raw+'\n【本回合完】'),body);
  assert.deepEqual(recover(raw.slice(0,-1)+',"afterword":"请依自己的心意选择'),body);
  for(const s of [raw+'\n'+raw,'```json\n'+raw+'\n```\n'+raw,
    raw+'\n【本回合完】 {"receipt":{}}',JSON.stringify({blocks:long})+'\n【本回合完】',
    raw.slice(0,-1)+',"afterword":{"receipt":'])assert.equal(recover(s),null);
});

test('complete explicit legacy choice fields survive a truncated caption without inferring an action',()=>{
  const pair=[{intent:'interact',approach:'ask',targetId:person,label:'询问船夫铜铃从哪里来'},choices[1]];
  const damaged=rows=>JSON.stringify({blocks,choices:rows}).slice(0,-1)+',"title":"河';
  assert.deepEqual(readCompleteV7Wire(damaged(pair),{authoredChoices:true}),{blocks,choices:pair});
  for(const first of [{target:person,label:'询问船夫铜铃从哪里来'},{intent:'travel',approach:'road',targetId:'k1',label:'动身前往渡口'}]){
    assert.equal(readCompleteV7Wire(damaged([first,choices[1]]),{authoredChoices:true}),null);
  }
});

test('a cut-off decoration does not discard an earlier fully authored memory record',()=>{
  const promise={target:person,kind:'promise',anchor:0,status:'open'};
  const wire=core+',"memoryDeltas":['+JSON.stringify(promise)+',{"target":';
  const recovered=readCompleteV7Wire(wire,{authoredChoices:true});
  assert.deepEqual(recovered.memoryDeltas,[promise]);
  assert.deepEqual(recovered.choices,choices);
  assert.equal(readCompleteV7Wire('```json\n'+core+',}\n```',{authoredChoices:true}),null);
});
