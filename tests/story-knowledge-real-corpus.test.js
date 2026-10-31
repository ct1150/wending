import test from 'node:test';
import assert from 'node:assert/strict';
import {selectStoryReferences} from '../src/worker/story-knowledge.js';
import {CURATED_CARDS} from '../src/worker/knowledge/curated.js';
import {EVIDENCE_CATALOG,CONCEPT_TERMS} from '../src/worker/knowledge/catalog.js';
import {referenceContext} from './helpers/story-knowledge-fixture.js';

const cards=new Map(CURATED_CARDS.map(card=>[card.id,card]));
const evidence=new Map(EVIDENCE_CATALOG.map(row=>[row.id,row]));
const core=card=>[card.card.title,card.card.situation,card.card.conflict,...card.metadata.tags].join(' ');
const matches=(card,concept)=>[concept,...CONCEPT_TERMS[concept]].some(term=>core(card).includes(term));
function contextFor(action,goal){
  const context=referenceContext();context.receipt.action=action;context.director.currentGoal=goal;
  context.memory.recent=[{text:'炼丹 药材 采药 药师 '.repeat(50)}];return context;
}

test('real curated practice affinity comes from the scenario rather than incidental adaptation notes',()=>{
  const context=contextFor({intent:'practice',targetId:'self',approach:'steady',label:'闭关修炼基础功法'},'稳固炼气修为');
  const selection=selectStoryReferences(context);
  assert.ok(selection.cardIds.length,'the curated collection contains cultivation scenarios');
  for(const id of selection.cardIds)assert.ok(matches(cards.get(id),'修炼突破'),id);
  assert.ok(selection.evidenceIds.every(id=>!evidence.get(id).tags.includes('灵药丹药')));
  assert.deepEqual(selectStoryReferences(structuredClone(context)),selection);
});

test('explicit herb collection uses medicine evidence and omits unrelated curated scenarios',()=>{
  const context=contextFor({intent:'explore',targetId:'herbs',approach:'search',label:'采集药材'},'寻找药材炼丹');
  const selection=selectStoryReferences(context);
  assert.equal(selection.evidenceIds.length,2);
  assert.ok(selection.evidenceIds.every(id=>evidence.get(id).tags.includes('灵药丹药')));
  for(const id of selection.cardIds)assert.ok(matches(cards.get(id),'灵药丹药'),id);
});

for(const approach of ['decline','leave'])test(`real ${approach} references respect ending the interaction despite old medicine goals`,()=>{
  const context=contextFor({intent:'interact',targetId:'person:healer',approach,label:approach==='leave'?'告辞，不再采药':'拒绝这项交易'},'寻找药材和炼丹方法');
  const selection=selectStoryReferences(context);
  for(const id of selection.cardIds)assert.ok(matches(cards.get(id),'设限拒绝'),id);
  assert.ok(selection.evidenceIds.every(id=>!evidence.get(id).tags.includes('灵药丹药')));
});

test('low realm practice does not inherit a stale higher-world crossing goal',()=>{
  const context=contextFor({intent:'practice',targetId:'self',approach:'steady',label:'闭关修炼基础功法'},'初入灵界，寻找跨界后的庇护');
  const selection=selectStoryReferences(context);
  for(const id of selection.cardIds){
    assert.ok(matches(cards.get(id),'修炼突破'),id);
    assert.ok(!/跨界|仙界|灵界/u.test(core(cards.get(id))),id);
  }
  const next=structuredClone(context);next.retrieval={version:1,recentCardIds:selection.cardIds,recentEvidenceIds:selection.evidenceIds,recentFamilies:selection.families};
  const later=selectStoryReferences(next);
  assert.ok(later.families.every(family=>!selection.families.includes(family)));
});
