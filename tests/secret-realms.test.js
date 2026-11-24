import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveGame,prepareOpening,prepareChoice,resolveRuleScene,commitTurn} from '../src/game/cultivation/live/engine.js';
import {validateGeneratedScene} from '../src/game/cultivation/live/schema.js';
import {adventureLeads,journeyNotes,noteRoutes} from '../src/game/cultivation/live/journey-notes.js';
import {SECRET_REALMS} from '../src/game/cultivation/live/secret-realms.js';

function startQiV2(seed = 42) {
 let s = createLiveGame({runId:'realms-test',engineVersion:7,originStories:true,eventVersion:2,seed,name:'沈渡'});
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

test('secret realms define 8 multi-room xianxia mysteries across qi to mahayana with hidden true endings and zero AI meta-prose', () => {
 assert.equal(SECRET_REALMS.length, 8);
 let totalHan = 0;
 for (const r of SECRET_REALMS) {
  assert.equal(r.rooms.length, 4, `${r.id} must have 4 interconnected rooms`);
  assert.equal(r.endings.length, 3, `${r.id} must have 3 endings including hidden true ending`);
  assert.ok(r.npc && r.npc.name, `${r.id} must have a local NPC`);
  const allText = [
   r.intro,
   ...r.rooms.flatMap(rm => [rm.title, rm.scene, rm.clueText, ...(rm.record ? [rm.record] : []), ...(rm.dialogue ? [rm.dialogue] : [])]),
   ...r.npc.dialogues,
   ...(r.npc.confront ? [r.npc.confront] : []),
   r.npc.trustResult,
   r.npc.suspectResult,
   ...r.endings.flatMap(en => [en.label, en.title, en.text]),
  ].join('\n');
  assert.doesNotMatch(allText, /不会添修为|没有额外惩罚|读信不算答应|不发修为或宝物|失败不会被写成/);
  totalHan += (allText.match(/[\u4e00-\u9fff]/g) || []).length;
 }
 assert.ok(totalHan >= 20000, `secret realms should have deep investigative prose, got ${totalHan}`);
});

test('a v2 qi cultivator can enter the first secret realm, explore rooms, gather all clues, question the NPC, and unlock the hidden true ending', () => {
 let {state: s, choose} = startQiV2(42);
 const lead = adventureLeads(s).find(l => l.node === 'realm-book');
 assert.ok(lead, 'adventureLeads should surface realm-book for v2 cultivator');
 const route = noteRoutes(s, [lead]).get('realm-book');
 assert.ok(route && route.length > 0, 'realm-book should be reachable via noteRoutes');
 for (const step of route) s = choose(s, step);
 assert.equal(s.events.node, 'realm-book');
 validateGeneratedScene(s.currentScene);

 // Launch first realm
 s = choose(s, 'realm-enter');
 assert.equal(s.events.node, 'realm-room');
 assert.ok(s.events.realms.active, 'realm exploration should be active');
 assert.ok(journeyNotes(s).some(n => n.node === 'realm-room'), 'active realm should appear in journeyNotes');

 // Investigate clue in room 0
 s = choose(s, 'realm-search');
 assert.ok(s.events.realms.active.clues & 1, 'clue 0 should be discovered');
 validateGeneratedScene(s.currentScene);

 // Move via map to room 1, investigate clue 1
 s = choose(s, 'realm-map');
 s = choose(s, 'realm-go-1');
 s = choose(s, 'realm-search');
 assert.ok(s.events.realms.active.clues & 2, 'clue 1 should be discovered');

 // Move to room 2, investigate clue 2 and interrogate NPC
 s = choose(s, 'realm-map');
 s = choose(s, 'realm-go-2');
 s = choose(s, 'realm-search');
 assert.equal(s.events.realms.active.clues, 7, 'all 3 clues should be discovered');
 s = choose(s, 'realm-npc');
 validateGeneratedScene(s.currentScene);
 assert.ok(s.currentScene.blocks.some(b => b.kind === 'dialogue'));
 s = choose(s, 'realm-npc-trust');

 // Move to room 3 (climax) and unlock hidden true ending (index 2)
 s = choose(s, 'realm-map');
 s = choose(s, 'realm-go-3');
 s = choose(s, 'realm-climax');
 validateGeneratedScene(s.currentScene);
 assert.ok(s.currentScene.choices.some(c => c.id.endsWith(':c:realm-end-2')), 'all clues should unlock hidden true ending');
 s = choose(s, 'realm-end-2');
 assert.equal(s.events.node, 'realm-result');
 validateGeneratedScene(s.currentScene);
 assert.equal(s.events.realms.done[SECRET_REALMS[0].id], '2');
 assert.equal(s.events.realms.active, null);
});
