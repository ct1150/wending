import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalStringify} from '../src/game/cultivation/live/identity.js';
import {knowledgeFixture,referenceContext,syntheticRecords} from './helpers/story-knowledge-fixture.js';

const hash=text=>createHash('sha256').update(text).digest('hex');
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
const queryHash=context=>hash(canonicalStringify(context));
const manualSelection=(f,context,ids)=>({corpusVersion:f.manifest.contentVersion,queryHash:queryHash(context),cardIds:[],evidenceIds:ids,families:[...new Set(ids.map(id=>f.catalog.find(row=>row.id===id).family))]});
const prompt=()=>({messages:[{role:'system',content:'本局规则与已选行动优先。'},{role:'user',content:JSON.stringify({life:{items:{iron:0}},receipt:{action:'询问价格'},selectedPurpose:'只询问报价，未选择交易'})},{role:'user',content:'最终selectedPurpose：只询问报价，禁止代选。'}],max_tokens:1536,response_format:{type:'json_schema',json_schema:{name:'scene',schema:{type:'object'}}}});

test('retrieval gives the current action more weight than repeated historical medicine topics',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext();
  context.memory.recent=[{text:'炼丹 药材 采药 药师 '.repeat(60)}];
  const selection=f.api.selectStoryReferences?.(context);
  assert.deepEqual(selection?.cardIds,['CARD_TRADE']);
  assert.deepEqual([...selection.evidenceIds].sort(),['EV_TRADE_A','EV_TRADE_B']);
  assert.equal(selection.queryHash,queryHash(context));
  assert.deepEqual(f.api.selectStoryReferences(JSON.parse(JSON.stringify(context))),selection);
  assert.deepEqual(f.reads,[],'selection performs no storage work');
});

test('medicine references require a current explicit medicine goal, and refusal suppresses that old goal',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext();
  context.receipt.action={intent:'explore',targetId:'herbs',approach:'search',label:'采集药材，准备炼丹'};
  context.director.currentGoal='寻找药材和炼丹方法';
  const medicine=f.api.selectStoryReferences?.(context);
  assert.deepEqual(medicine?.cardIds,['CARD_MEDICINE']);
  assert.deepEqual([...medicine.evidenceIds].sort(),['EV_MEDICINE_A','EV_MEDICINE_B']);
  context.receipt.action={intent:'interact',targetId:'person:healer',approach:'leave',label:'告辞，不再帮忙采药'};
  const leaving=f.api.selectStoryReferences(context);
  assert.ok(!leaving.cardIds.includes('CARD_MEDICINE'));
  assert.ok(leaving.evidenceIds.every(id=>!id.startsWith('EV_MEDICINE')));
});

test('accepted exposure excludes recent IDs and chapter families while unexposed alternatives exist',async t=>{
  const records=Array.from({length:6},(_,index)=>({id:`EV_TRADE_${index}`,chapterId:`FR-${index+1}`,tags:['交易议价'],category:'交易与利益',text:'访客询问交易条件，双方都没有立刻承诺。'}));
  const f=await knowledgeFixture(t,{records}),context=referenceContext();
  const first=f.api.selectStoryReferences?.(context);
  assert.equal(first?.evidenceIds.length,2);
  context.retrieval={version:1,recentCardIds:first.cardIds,recentEvidenceIds:first.evidenceIds,recentFamilies:first.families};
  const next=f.api.selectStoryReferences(context);
  assert.equal(next.evidenceIds.length,2);
  assert.ok(next.evidenceIds.every(id=>!first.evidenceIds.includes(id)));
  assert.ok(next.families.every(family=>!first.families.includes(family)));
});

test('the loader reads only selected immutable shards and returns verified records without leaking provenance into receipts',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext(),selection=manualSelection(f,context,['EV_TRADE_A','EV_TRADE_B']);
  const bundle=await f.api.loadStoryReferences(f.store,selection);
  assert.deepEqual(bundle.evidence.map(row=>row.id),selection.evidenceIds);
  assert.equal(bundle.evidence[0].text,syntheticRecords()[0].text);
  assert.equal(f.reads.length,1,'two records from the same shard share one read');
  assert.equal(f.reads[0].key,f.manifest.shards.s0000.key);
  assert.equal(f.reads[0].options.type,'arrayBuffer');
  bundle.evidence[0].text='caller mutation';
  const again=await f.api.loadStoryReferences(f.store,selection);
  assert.equal(again.evidence[0].text,syntheticRecords()[0].text);
  assert.equal(f.reads.length,1,'only validated immutable bytes are cached');
});

test('missing, corrupt, wrong-source and mismatched record shards fail closed with one redacted error code',async t=>{
  const changes=[
    {name:'missing',after:f=>f.values.set(f.manifest.shards.s0000.key,null)},
    {name:'raw digest mismatch',after:f=>f.values.set(f.manifest.shards.s0000.key,'PRIVATE_SOURCE_MUST_NOT_LEAK')},
    {name:'wrong source',alterShard:shard=>{shard.sourceSha256='0'.repeat(64);}},
    {name:'wrong version',alterShard:shard=>{shard.contentVersion='other-version';}},
    {name:'wrong shard',alterShard:shard=>{shard.shardId='unrelated';}},
    {name:'wrong record id',alterShard:shard=>{shard.records[0].id='UNDEPLOYED_RECORD';}},
    {name:'wrong chapter',alterShard:shard=>{shard.records[0].chapterId='FR-9999';}},
    {name:'wrong chapter digest',alterShard:shard=>{shard.records[0].chapterSha256='0'.repeat(64);}},
    {name:'wrong text digest',alterShard:shard=>{shard.records[0].sha256='0'.repeat(64);}},
    {name:'bad source offsets',alterShard:shard=>{shard.records[0].endOffset=shard.records[0].startOffset;}},
  ];
  for(const variant of changes)await t.test(variant.name,async t=>{
    const f=await knowledgeFixture(t,{alterShard:variant.alterShard}),context=referenceContext();variant.after?.(f);
    await assert.rejects(()=>f.api.loadStoryReferences(f.store,manualSelection(f,context,['EV_TRADE_A'])),error=>error.code==='KNOWLEDGE_UNAVAILABLE'&&error.message==='KNOWLEDGE_UNAVAILABLE');
  });
});

test('cache entries never cross KV stores and old shards are evicted from the bounded cache',async t=>{
  const records=Array.from({length:20},(_,index)=>({id:`EV_${index}`,chapterId:`FR-${index}`,tags:['交易议价'],category:'交易与利益',text:'仅供合成测试的交易参考。'}));
  const f=await knowledgeFixture(t,{records,shardSize:1}),context=referenceContext();
  const first=manualSelection(f,context,['EV_0']);
  await f.api.loadStoryReferences(f.store,first);
  await assert.rejects(()=>f.api.loadStoryReferences({get:async()=>null},first),{code:'KNOWLEDGE_UNAVAILABLE'});
  for(let index=1;index<records.length;index++)await f.api.loadStoryReferences(f.store,manualSelection(f,context,[`EV_${index}`]));
  f.values.set(f.manifest.shards.s0000.key,null);
  await assert.rejects(()=>f.api.loadStoryReferences(f.store,first),{code:'KNOWLEDGE_UNAVAILABLE'});
});

test('concurrent misses for one shard preserve a subsequent cache hit within the byte budget',async t=>{
  const records=[{id:'EV_LARGE',chapterId:'FR-0001',tags:['交易议价'],category:'交易与利益',text:'仅供并发缓存验证的合成参考。'.repeat(2400)}];
  const f=await knowledgeFixture(t,{records,shardSize:1}),selection=manualSelection(f,referenceContext(),['EV_LARGE']);
  await Promise.all(Array.from({length:24},()=>f.api.loadStoryReferences(f.store,selection)));
  const readsAfterMisses=f.reads.length;
  assert.ok(readsAfterMisses>=1);
  for(let index=0;index<3;index++){
    const loaded=await f.api.loadStoryReferences(f.store,selection);
    assert.equal(loaded.evidence[0].text,records[0].text);
  }
  assert.equal(f.reads.length,readsAfterMisses,'one cached shard must not be charged once per concurrent completion');
});

test('an aborted storage load settles without waiting for a stalled KV read',async t=>{
  const f=await knowledgeFixture(t),controller=new AbortController(),selection=manualSelection(f,referenceContext(),['EV_TRADE_A']);
  const loaded=f.api.loadStoryReferences({get:()=>new Promise(()=>{})},selection,{signal:controller.signal});
  controller.abort();
  await assert.rejects(()=>loaded,{code:'KNOWLEDGE_UNAVAILABLE'});
});

test('packing adds bounded data without changing current facts, the last selectedPurpose message, or the caller input',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext(),selection=f.api.selectStoryReferences(context),bundle=await f.api.loadStoryReferences(f.store,selection),input=prompt(),original=structuredClone(input);
  const packed=f.api.packStoryReferences(input,context,bundle,{maxBytes:24576});
  assert.deepEqual(input,original);
  assert.equal(packed.input.messages.length,input.messages.length);
  assert.deepEqual(packed.input.messages.at(-1),input.messages.at(-1));
  const user=JSON.parse(packed.input.messages[1].content),{storyReferences,...facts}=user;
  assert.deepEqual(facts,JSON.parse(input.messages[1].content));
  assert.equal(storyReferences.curated.length,1);
  assert.equal(storyReferences.evidence.length,2);
  assert.deepEqual(packed.receipt.cardIds,storyReferences.curated.map(row=>row.id));
  assert.deepEqual(packed.receipt.evidenceIds,storyReferences.evidence.map(row=>row.id));
  assert.equal(packed.receipt.queryHash,queryHash(context));
  assert.ok(bytes(packed.input)<=24576);
  assert.ok(!JSON.stringify(packed.receipt).includes('货主'));
  assert.ok(!JSON.stringify(storyReferences).includes('unsafe-inspiration-only'),'authored custom actions never become executable prompt payloads');
});

test('packing measures the complete serialized input and omits references before truncating player state',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext(),selection=f.api.selectStoryReferences(context),bundle=await f.api.loadStoryReferences(f.store,selection),input=prompt(),original=structuredClone(input);
  for(const allowance of [0,200,800,1600,3200]){
    const maximum=bytes(input)+allowance,packed=f.api.packStoryReferences(input,context,bundle,{maxBytes:maximum});
    assert.ok(bytes(packed.input)<=maximum);
    assert.deepEqual(packed.input.messages.at(-1),input.messages.at(-1));
    const {storyReferences,...facts}=JSON.parse(packed.input.messages[1].content);
    assert.deepEqual(facts,JSON.parse(original.messages[1].content));
    if(packed.receipt){assert.deepEqual(packed.receipt.cardIds,storyReferences.curated.map(row=>row.id));assert.deepEqual(packed.receipt.evidenceIds,storyReferences.evidence.map(row=>row.id));}
    else assert.deepEqual(packed.input,input);
  }
  assert.equal(f.api.packStoryReferences(input,context,bundle,{maxBytes:bytes(input)}).receipt,null);
  assert.deepEqual(input,original);
});

test('a bundle for another frozen context is rejected instead of silently changing the retry references',async t=>{
  const f=await knowledgeFixture(t),context=referenceContext(),bundle=await f.api.loadStoryReferences(f.store,f.api.selectStoryReferences(context));
  const different=structuredClone(context);different.receipt.action.label='只告辞，不询价';
  assert.throws(()=>f.api.packStoryReferences(prompt(),different,bundle,{maxBytes:24576}),{code:'KNOWLEDGE_UNAVAILABLE'});
});
