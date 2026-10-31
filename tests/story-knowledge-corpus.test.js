import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = new URL('../scripts/build-story-knowledge.py', import.meta.url).pathname;
const digest = text => createHash('sha256').update(text).digest('hex');

async function fixture(t, { badHash = false, long = false, longRepeat = 260, shardSize = 2 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'wending-corpus-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = long ? '　　' + '行者查看石门，发现刻痕仍与旧图一致。'.repeat(longRepeat) + '\n' : '　　村中少年打算拜师，家人担心考核名额不足。\n';
  const second = '　　他问同伴：“这部新书为何失传？”对方只说传承需要另寻弟子。\n';
  const extra = '　　故人拒绝交易，带着已有约定独自离开密室。\n';
  const bodies = [
    '第一章 同题\n' + first,
    '第一章 同题\n' + second + '　　（全书完）\n\n感言\n　　谢谢各位读者。\n　　新书即将上传，敬请支持。\n',
    '外传\n' + extra + '==========================================================\n更多精校小说尽在测试下载：https://example.invalid/\n'
  ];
  const preamble = '本测试的下载页眉。\n';
  let source = preamble, offset = preamble.length;
  const chapters = bodies.map((body, index) => {
    const entry = { seq: index + 1, chapter_id: `FR-${String(index + 1).padStart(4, '0')}`, title: body.split('\n')[0], volume: index === 2 ? '外传' : '第一卷 测试', kind: index === 2 ? 'extra' : 'main', start_offset: offset, end_offset: offset + body.length, char_count: body.length, sha256: badHash && index === 0 ? '0'.repeat(64) : digest(body) };
    source += body; offset += body.length; return entry;
  });
  const card = { id: 'WD-FR-001', title: '试用名额', category: '宗门与派系', tags: ['入门考核'], source: { chapter_ids: ['FR-0001'], summary: '不应进入公开模块的来源摘要', anchors: [{ quote: '不应进入公开模块的原文证据' }] }, situation: '报名者发现名额有限，需要确定是否参加。', conflict: '候补者需要机会，执事必须守住既有名额。', npc_motives: ['执事：希望减少争端。'], preconditions: ['存在组织招录。'], exclusions: ['已经入门。'], choices: [{ label: '询问复试标准', action_hint: 'interact:ask', requires_extension: false }], followups: [], variation_slots: ['考核类型'], dedupe_key: 'conditional_admission', adaptation_notes: '仅适配已有招录制度。', content_version: 'test-1' };
  await writeFile(join(root, 'source.txt'), source);
  await writeFile(join(root, 'index.json'), JSON.stringify(chapters));
  await writeFile(join(root, 'cards.json'), JSON.stringify([card]));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  const pub = join(root, 'public'), priv = join(root, 'private');
  await mkdir(pub); await mkdir(priv);
  const args = [script, '--source', join(root, 'source.txt'), '--chapters', join(root, 'index.json'), '--cards', join(root, 'cards.json'), '--catalog', join(pub, 'catalog.js'), '--curated', join(pub, 'curated.js'), '--coverage', join(pub, 'coverage.json'), '--private-dir', priv, '--shard-size', String(shardSize)];
  const run = () => spawnSync('python3', args, { encoding: 'utf8' });
  const built = run();
  return { root, pub, priv, source, first, second, extra, chapters, built, run };
}

async function readBuilt(f) {
  assert.equal(f.built.status, 0, f.built.stderr || f.built.stdout);
  const catalog = await import(pathToFileURL(join(f.pub, 'catalog.js')).href);
  const curated = await import(pathToFileURL(join(f.pub, 'curated.js')).href);
  const coverage = JSON.parse(await readFile(join(f.pub, 'coverage.json'), 'utf8'));
  const records = [];
  for (const [id, shard] of Object.entries(catalog.KNOWLEDGE_MANIFEST.shards)) {
    const bytes = await readFile(join(f.priv, 'shards', `${id}.json`));
    assert.equal(digest(bytes), shard.sha256);
    assert.equal(bytes.length, shard.bytes);
    const value = JSON.parse(bytes);
    assert.equal(value.sourceSha256, digest(f.source));
    assert.equal(value.contentVersion, catalog.KNOWLEDGE_MANIFEST.contentVersion);
    assert.equal(value.shardId, id);
    assert.equal(value.records.length, shard.count);
    records.push(...value.records);
  }
  return { catalog, curated, coverage, records };
}

test('corpus preserves duplicate printed chapter numbers as distinct source sections', async t => {
  const f = await fixture(t); const b = await readBuilt(f);
  assert.deepEqual([...new Set(b.records.map(r => r.chapterId))], ['FR-0001', 'FR-0002', 'FR-0003']);
  assert.equal(new Set(b.records.map(r => r.id)).size, b.records.length);
  assert.equal(b.coverage.sectionsCovered, 3);
  assert.equal(b.coverage.missingSections, 0);
  assert.equal(b.coverage.bodyCharsCovered, f.first.length + f.second.length + f.extra.length);
  assert.equal(b.coverage.eligibleParagraphs, 3);
  for (const record of b.records) {
    assert.equal(record.text, f.source.slice(record.startOffset, record.endOffset));
    assert.equal(record.sha256, digest(record.text));
    assert.equal(record.chapterSha256, f.chapters.find(c => c.chapter_id === record.chapterId).sha256);
    assert.equal(record.kind, 'source_evidence');
    assert.equal(record.reviewStatus, 'deterministic_extract');
    assert.equal(record.offsetUnit, 'unicode_code_point');
  }
});

test('corpus excludes advertisements and author afterwords without removing fictional talk about a book', async t => {
  const f = await fixture(t); const b = await readBuilt(f);
  const narrative = b.records.map(r => r.text).join('');
  assert.equal(narrative, f.first + f.second + f.extra);
  assert.ok(b.coverage.exclusions.some(x => x.reason === 'author_afterword'));
  assert.ok(b.coverage.exclusions.some(x => x.reason === 'download_site_footer'));
  for (const excluded of b.coverage.exclusions) assert.equal(excluded.characters, excluded.endOffset - excluded.startOffset);
  assert.equal(b.coverage.claims.allNarrativeParagraphsIndexed, true);
  assert.equal(b.coverage.claims.allScenesSemanticallyIdentified, false);
  assert.equal(b.coverage.claims.allExtractsHumanOrModelReviewed, false);
});

test('long narrative paragraphs retain every character once across bounded evidence windows', async t => {
  const f = await fixture(t, { long: true }); const b = await readBuilt(f);
  const first = b.records.filter(r => r.chapterId === 'FR-0001');
  assert.ok(first.length >= 4);
  assert.equal(first.map(r => r.text).join(''), f.first);
  assert.ok(first.every(r => r.text.length <= 1300));
  for (let i = 1; i < first.length; i++) assert.equal(first[i - 1].endOffset, first[i].startOffset);
  assert.equal(b.coverage.eligibleParagraphs, 3);
  assert.equal(b.coverage.bodyCharsCovered, f.first.length + f.second.length + f.extra.length);
});

test('public modules expose only abstract cards, generic search metadata and integrity hashes', async t => {
  const f = await fixture(t); const b = await readBuilt(f);
  const raw = await readFile(join(f.pub, 'catalog.js'), 'utf8') + await readFile(join(f.pub, 'curated.js'), 'utf8');
  for (const forbidden of [f.first.trim(), f.second.trim(), '不应进入公开模块的来源摘要', '不应进入公开模块的原文证据']) assert.ok(!raw.includes(forbidden));
  assert.equal(b.curated.CURATED_CARDS.length, 1);
  assert.equal(b.curated.CURATED_CARDS[0].card.source, undefined);
  assert.ok(b.catalog.CONCEPT_TERMS['师徒传承'].includes('拜师'));
  assert.ok(b.catalog.TERM_POSTINGS['拜师'].length >= 1);
  assert.ok(b.catalog.EVIDENCE_CATALOG.every(row => !Object.hasOwn(row, 'text') && !Object.hasOwn(row, 'title')));
});

test('source fingerprint mismatch refuses generation before publishing any catalog', async t => {
  const f = await fixture(t, { badHash: true });
  assert.notEqual(f.built.status, 0);
  assert.match(f.built.stderr, /SOURCE_CHAPTER_HASH_MISMATCH/);
  await assert.rejects(readFile(join(f.pub, 'catalog.js')));
});

test('the same source and rules reproduce byte-identical immutable shards and manifests', async t => {
  const f = await fixture(t); await readBuilt(f);
  const before = await readFile(join(f.pub, 'catalog.js'));
  const rerun = f.run(); assert.equal(rerun.status, 0, rerun.stderr);
  assert.deepEqual(await readFile(join(f.pub, 'catalog.js')), before);
});

test('private completion marker is hash-pinned without a circular self-hash', async t => {
  const f = await fixture(t); const b = await readBuilt(f);
  const markerBytes = await readFile(join(f.priv, 'manifest.private.json')).catch(() => null);
  assert.ok(markerBytes, 'the private corpus must include a publish-completion marker');
  const marker = JSON.parse(markerBytes);
  assert.equal(b.catalog.KNOWLEDGE_MANIFEST.manifestSha256, digest(markerBytes));
  assert.equal(b.catalog.KNOWLEDGE_MANIFEST.manifestKey, b.catalog.KNOWLEDGE_MANIFEST.storagePrefix + '/manifest');
  assert.equal(marker.chapterCount, 3);
  assert.equal(marker.shardCount, Object.keys(b.catalog.KNOWLEDGE_MANIFEST.shards).length);
  assert.equal(marker.manifestSha256, undefined);
  assert.equal(marker.sourceSha256, digest(f.source));
  assert.match(marker.shardsDigest, /^[a-f0-9]{64}$/);
});

test('CLI refuses shard sizes above the runtime record-count ceiling before publishing outputs',async t=>{
  const f=await fixture(t,{long:true,longRepeat:5000,shardSize:65});
  assert.notEqual(f.built.status,0,'65-record shards cannot be loaded by the production loader');
  assert.match(f.built.stderr,/SHARD_SIZE_INVALID/);
  await assert.rejects(readFile(join(f.pub,'catalog.js')));
  await assert.rejects(readFile(join(f.priv,'manifest.json')));
});

test('the largest supported 64-record shard remains buildable and hash-valid',async t=>{
  const f=await fixture(t,{long:true,longRepeat:5000,shardSize:64});
  const b=await readBuilt(f);
  assert.equal(Math.max(...Object.values(b.catalog.KNOWLEDGE_MANIFEST.shards).map(shard=>shard.count)),64);
});
