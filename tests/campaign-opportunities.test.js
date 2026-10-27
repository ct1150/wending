import test from 'node:test';
import assert from 'node:assert/strict';
import {thresholdScene} from '../src/game/cultivation/v3/chapters/thresholds.js';
import {matchesConditions} from '../src/game/cultivation/v3/model.js';
import {resolveCultivationScene} from '../src/game/cultivation/v3/content.js';
import {ACCEPTED_PROSE} from '../src/game/cultivation/v3/prose.js';

function situation(talents=['keen-memory','sensitive-breath'],nodeId='talent-pair',attributes={constitution:4,insight:4,fortune:4}) {
  return {world:{facts:{},proofs:[]},life:{name:'沈照',birth:{talentIds:talents,attributes},facts:Object.fromEntries(talents.map(id=>['used-'+id,true])),items:{manual:1},skills:[],realm:'mortal',cultivation:3,injury:0},scene:{nodeId,fate:{route:'sect',trial:'ruins',pressure:'storm'}}};
}

test('specific talent pairs create distinct opportunities and costs and require both practiced talents',()=>{
  const cases=[
    {talents:['keen-memory','sensitive-breath'],title:/纸上|暗河|听/,check:c=>{assert.equal(c.effects.items.talisman,1);assert.equal(c.effects.injury??0,0);}},
    {talents:['sword-bone','iron-bones'],title:/剑|骨/,check:c=>{assert.equal(c.effects.injury,2);assert.equal(c.effects.cultivation,2);}},
    {talents:['flash-wisdom','fortune-debt'],title:/星|余年/,check:c=>{assert.equal(c.costs.lifeYears,3);assert.equal(c.effects.items.stones,6);}},
  ];
  const identities=[];
  for(const row of cases){
    const state=situation(row.talents),before=JSON.stringify(state),scene=thresholdScene(state),choice=scene.choices.find(c=>c.id==='combine');
    assert.match(scene.title,row.title);row.check(choice);assert.ok(matchesConditions(state,choice.requires));
    const missing=situation(row.talents);delete missing.life.facts['used-'+row.talents[1]];assert.equal(matchesConditions(missing,choice.requires),false);
    const reversed=thresholdScene(situation([...row.talents].reverse()));assert.equal(reversed.title,scene.title);
    assert.ok(scene.choices.some(c=>c.id==='continue'&&matchesConditions(state,c.requires)));
    identities.push(JSON.stringify({costs:choice.costs,injury:choice.effects.injury,items:choice.effects.items}));assert.equal(JSON.stringify(state),before);
  }
  assert.equal(new Set(identities).size,3);
});

test('each high attribute opens a concrete early choice and leaves the ordinary route available',()=>{
  const cases=[
    {node:'talent-first',id:'fortune-cache',attributes:{constitution:3,insight:4,fortune:5}},
    {node:'talent-second',id:'insight-study',attributes:{constitution:3,insight:5,fortune:4}},
    {node:'qi-study',id:'body-study',attributes:{constitution:5,insight:4,fortune:3}},
  ];
  for(const row of cases){
    assert.ok(!thresholdScene(situation(undefined,row.node)).choices.some(c=>c.id===row.id));
    const scene=thresholdScene(situation(undefined,row.node,row.attributes)),choice=scene.choices.find(c=>c.id===row.id);
    assert.ok(choice,row.id);assert.equal(scene.choices.length,3);assert.ok((choice.costs.days??0)+(choice.costs.years??0)>0);assert.ok(Object.keys(choice.effects).length>0);
  }
});

test('a healthy player choosing to prepare at a recovery scene is not told they carry old wounds',()=>{
  const state=situation(undefined,'qi-recovery'),scene=thresholdScene(state);
  assert.doesNotMatch(scene.blocks.map(b=>b.text).join(''),/旧伤|伤还在|疼痛|养好/);
  assert.match(scene.blocks.map(b=>b.text).join(''),/调息|稳固|准备/);
});

test('the village-only generated atmosphere never contradicts night ferry or dusk past-life openings',()=>{
  const prose=ACCEPTED_PROSE['arrival.atmosphere'];assert.ok(prose);
  for(const origin of ['village','artisan','ferry','exile','wanderer']){
    const state=situation(undefined,'arrival');state.life.birth.originId=origin;
    const opening=resolveCultivationScene(state);
    assert.equal(opening.blocks.some(block=>block.text===prose),origin==='village',origin);
    if(origin==='ferry')assert.match(opening.blocks.map(b=>b.text).join(''),/今夜/);
    if(origin==='wanderer')assert.match(opening.blocks.map(b=>b.text).join(''),/暮色/);
  }
});
