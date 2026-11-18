import test from 'node:test';
import assert from 'node:assert/strict';
import {charterNode,validateCharters,charterNote} from '../src/game/cultivation/live/harbor-charters.js';

const menu=(key,label,next,patch)=>({key,label,next,patch});
const choice=(key,label,intent,target,approach,extra)=>({key,label,...extra});
function fixture(age){
 return {life:{ageDays:age,cultivationProfile:{worldTier:0}},events:{node:'packet-to-1',
  convoy:{chapters:[{rig:'light',loads:[5,10]}]},charters:[{start:100,steps:[{at:100,kind:'load',n:0}]}]}};
}
test('a tow on the last possible day pays once, arriving one day later delivers without a fee',()=>{
 for(const [age,onTime] of [[106,true],[107,false]]){
  const state=fixture(age),scene=charterNode(state,menu,choice),tow=scene.choices.find(c=>c.key==='packet-tow');
  assert.equal(tow.rule.days,1);assert.deepEqual(tow.rule.items,{});
  assert.deepEqual(tow.rule.gain,onTime?{iron:1}:{});
  assert.match(scene.blocks.map(b=>b.text).join(' '),onTime?/赶得及/:/错过约期/);
  Object.assign(state.events,tow.patch,{node:'packet-book'});state.life.ageDays+=tow.rule.days;
  validateCharters(state.events,state.life);
  assert.match(charterNode(state,menu,choice).blocks.map(b=>b.text).join(' '),onTime?/独木船/:/门扇/);
  state.events.node='packet-to-0';
  const back=charterNode(state,menu,choice).choices.find(c=>c.key==='packet-tow');
  assert.deepEqual(back.rule.gain,{});assert.deepEqual(back.rule.items,{supplies:1});
 }
});
test('journal warns about the next live shipment and the ledger rejects stale dates, overweight loads and closed seasons',()=>{
 const s=fixture(112);assert.equal(charterNote(s.events,112).window.close,112);
 assert.equal(charterNote(s.events,113).window.close,115);
 const append=(...steps)=>({...s.events,node:'packet-book',charters:[{start:100,steps:[...s.events.charters[0].steps,...steps]}]});
 assert.throws(()=>validateCharters(append({at:101,kind:'load',n:1}),s.life));
 assert.throws(()=>validateCharters(append({at:100,kind:'tow',n:1}),s.life));
 assert.throws(()=>validateCharters(append({at:103,kind:'close',n:0},{at:104,kind:'tide',n:1}),s.life));
 assert.throws(()=>validateCharters(append({at:114,kind:'tow',n:1}),s.life));
 assert.throws(()=>validateCharters({...s.events,node:'packet-to-0'},s.life));
});
