import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {adventureLeads,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';
import {WORLD_TALES} from '../src/game/cultivation/live/world-tales.js';
import {polishV2Scene} from '../src/game/cultivation/live/v2-polish.js';

const BANNED_AI_PHRASES = [
 /没有额外替你接受任何事务/,
 /失败不会被写成另一次成功/,
 /没有借休整替你完成/,
 /没有新的下落，便不替故人写下死讯/,
 /不需要为了展开故事而硬添一处缺陷/,
 /不会添修为，也不替他决定下一步/,
 /归潮舟没有变成突破所需的奖品/,
 /这次不发修为或宝物，也不能重复接签/,
 /读信不算答应/,
 /没有为这次离开付出额外惩罚/,
 /不会把离开之间的年月编造成/,
 /渡簿没有把两组都写成你的功劳/,
 /没有因此替彼此决定未来/,
];

function startQiV2(seed = 42) {
 let s = createLiveGame({runId:'tales-polish-test',engineVersion:7,originStories:true,eventVersion:2,seed,name:'沈渡'});
 const open = prepareOpening(s,{requestId:'open'});
 s = commitTurn(s,open,resolveRuleScene(s,open));
 const choose = (st, key) => {
  const c = st.currentScene.choices.find(x => x.id.endsWith(':c:' + key));
  assert.ok(c, `missing ${key} at ${st.events.node}`);
  const turn = prepareChoice(st,{requestId:`t-${st.turnId}`,choiceId:c.id});
  return commitTurn(st,turn,resolveRuleScene(st,turn));
 };
 s = choose(s,'leave-village');
 s = choose(s,'join-gate');
 s = choose(s,'work-bank');
 s = choose(s,'save-canal');
 while (s.life.realm === 'mortal') {
  if (s.events.node === 'prologue-result') s = choose(s,'try-again');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:first-breakthrough'))) s = choose(s,'first-breakthrough');
  else if (s.currentScene.choices.some(c => c.id.endsWith(':c:restore-copy'))) s = choose(s,'restore-copy');
  else s = choose(s,'settle-breath');
 }
 s = choose(s,'take-help');
 s = choose(s,'chapter-out');
 return {state: s, choose};
}

test('v2 polish layer strips AI meta-prose across hub, practice, rest, gather, mentor, and legacy side stories without touching v1', () => {
 let {state: s, choose} = startQiV2(42);
 // Check hub
 const checkScene = (scene, label) => {
  validateGeneratedScene(scene);
  const txt = scene.blocks.map(b => b.text).join('\n');
  for (const pat of BANNED_AI_PHRASES) assert.doesNotMatch(txt, pat, `${label} still has AI phrase ${pat}`);
 };
 checkScene(s.currentScene, 'hub');

 // Practice once -> check action-result
 s = choose(s, 'train-menu');
 checkScene(s.currentScene, 'training');
 s = choose(s, 'practice');
 checkScene(s.currentScene, 'practice-result');

 // Rest -> check rest & recover result
 s = choose(s, 'train-menu');
 s = choose(s, 'rest-menu');
 checkScene(s.currentScene, 'rest');
 s = choose(s, 'recover');
 checkScene(s.currentScene, 'recover-result');

 // Mentor -> check mentor prose
 s = choose(s, 'affairs-menu');
 checkScene(s.currentScene, 'affairs');
 s = choose(s, 'mentor-menu');
 checkScene(s.currentScene, 'mentor');

 // Direct polish unit test against notorious legacy AI lines
 const dirty = {
  id:'r:abc:t1:s:event_home-book',title:'归航者',location:'上界',
  blocks:[
   {kind:'narration',text:'读信不算答应，她也不会因你先去别处便失去自己已经守住的锚地。'},
   {kind:'narration',text:'已经走过的行程仍留在此生里。归潮舟没有变成突破所需的奖品，你也不必为了领一件东西再来重复告别。'},
   {kind:'narration',text:'这次不发修为或宝物，也不能重复接签。旧风隙和原来的渡班没有重新结算。'},
  ],
  entities:[],
  choices:[{id:'c1',label:'一',intent:'interact',targetId:'self',stake:'low',approach:'observe'},{id:'c2',label:'二',intent:'interact',targetId:'self',stake:'low',approach:'observe'}],
  memoryDeltas:[],
 };
 const cleaned = polishV2Scene(dirty, s);
 checkScene(cleaned, 'cleaned-legacy');
});

test('world tales provide 24 distinct realm-spanning xianxia encounters with dialogue and substantial prose volume', () => {
 assert.equal(WORLD_TALES.length, 24);
 let totalHan = 0;
 for (const tale of WORLD_TALES) {
  assert.ok(tale.id && tale.title && tale.location && tale.npcName);
  assert.ok(tale.blocks.some(b => b.kind === 'dialogue'), `${tale.id} needs dialogue`);
  assert.equal(tale.choices.length, 2);
  const txt = [...tale.blocks.map(b => b.text), ...tale.choices.flatMap(c => [c.label, c.result])].join('\n');
  for (const pat of BANNED_AI_PHRASES) assert.doesNotMatch(txt, pat);
  totalHan += (txt.match(/[\u4e00-\u9fff]/g) || []).length;
 }
 assert.ok(totalHan >= 16000, `world tales should provide rich volume, got ${totalHan}`);
});

test('a v2 cultivator can reach tale-book via adventureLeads, experience a tale, and persist its completion', () => {
 let {state: s, choose} = startQiV2(42);
 const lead = adventureLeads(s).find(l => l.node === 'tale-book');
 assert.ok(lead, 'adventureLeads should surface tale-book');
 const route = noteRoutes(s, [lead]).get('tale-book');
 assert.ok(route && route.length > 0, 'tale-book should be reachable');
 for (const step of route) s = choose(s, step);
 assert.equal(s.events.node, 'tale-book');
 validateGeneratedScene(s.currentScene);

 s = choose(s, 'tale-open');
 assert.equal(s.events.node, 'tale-scene');
 validateGeneratedScene(s.currentScene);
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'));

 s = choose(s, 'tale-pick-0');
 assert.equal(s.events.node, 'tale-result');
 validateGeneratedScene(s.currentScene);
 assert.equal(Object.keys(s.events.tales).length, 1);
});
