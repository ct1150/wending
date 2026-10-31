import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompleteV7Wire} from '../src/worker/story-readable-wire.js';
// The one complete public #119 SSE row. Its private model envelope and the
// reason the following text was malformed are unknown. Each suffix is synthetic.
const block={kind:'narration',text:"晨雾尚未散尽，村口的石碾旁围了几个人，正指指点点。你拨开人群，见一老者正对着一只被压扁的野兔发愁，那兔身虽碎，却隐隐透着股诡异的青色光泽。老者见你走近，浑浊的眼珠转了转，压低声音道：'小友，这兔子不是寻常猎物，是那'青鳞兽'的幼崽，昨夜才在林子里现了踪迹。'"};
const speaker={kind:'person',name:'老周'},dialogue={kind:'dialogue',speaker,text:'你愿意听听它的来历吗？'};
const root='{"blocks":[',s=JSON.stringify(block),d=JSON.stringify(dialogue);

const choices=[
  {action:'interact:ask',target:speaker,purpose:'问老周那层青色光泽从何而来'},
  {action:'interact:observe',target:'self',purpose:'俯身看野兔被石碾压过的地方'},
];

test('a captured native paragraph, complete dialogue and even a partial button never authorize invented actions',()=>{
  assert.equal(Array.from(block.text).length,129);
  const base=root+s+','+d+']',pair=JSON.stringify(choices);
  for(const source of [base,base+',"choices":[]',base+',"choices":['+JSON.stringify(choices[0])+',{"action":"interact:ob',
    root+s+',{"kind":"narration","text":"半句', '{"nested":{'+base.slice(1)+',"choices":'+pair+'}}',"junk "+base]){
    assert.equal(readCompleteV7Wire(source),null);
  }
  assert.deepEqual(readCompleteV7Wire(base+',"choices":'+pair+',"title":"'),{blocks:[block,dialogue],choices});
});
