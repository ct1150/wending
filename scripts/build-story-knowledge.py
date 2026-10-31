#!/usr/bin/env python3
"""Build traceable private source evidence and a prose-free public search index.

Python standard library only. No network, embeddings, or language-model calls.
The source and index are supplied explicitly: this tool never downloads books.
Keep --private-dir outside public outputs (normally .scratch/full-novel-rag/corpus).
"""
from __future__ import annotations
import argparse
import bisect
import collections
import hashlib
import json
import pathlib
import re
import sys

METHOD = 'paragraph-windows-v1'
MAX_CHARS = 1300
TARGET_CHARS = 1050
SHARD_MAX_BYTES = 1024 * 1024
OFFSET_UNIT = 'unicode_code_point'

# Generic genre concepts are retrieval hints, never inferred game eligibility.
# A source record receives a concept only when one of these literal terms occurs.
# The same mapping also bridges a player's phrasing to the source vocabulary.
CONCEPTS = {
 '入门考核': ('宗门与派系', '入门|考核|招收|招募|选拔|选中|资格|记名弟子|外门弟子|内门弟子|收徒|入选|测试|名额'),
 '师徒传承': ('师徒与控制', '师父|师傅|师徒|徒弟|弟子|传授|传承|指点|教导|授业|拜师|门下|传人'),
 '宗门权力': ('宗门与派系', '宗门|门派|长老|掌门|执事|门主|教主|权力|地位|核心|派系|势力'),
 '交易条件': ('交易与信用', '交易|交换|换取|条件|商量|商议|代价|讨价|买下|购买|出售|店铺|灵石|报酬|酬劳'),
 '信用承诺': ('交易与信用', '承诺|答应|约定|保证|誓言|信誉|信用|守信|契约|担保|毁约|违约|允诺'),
 '强迫控制': ('师徒与控制', '威胁|胁迫|逼迫|逼其|强迫|控制|驱使|要挟|人质|不容拒绝|身不由己|限制|限期'),
 '同盟合作': ('同盟与背叛', '同盟|联盟|联手|合作|联络|联合|协助|相助|同伴|共同|护送|队伍'),
 '暗算背叛': ('同盟与背叛', '背叛|暗算|算计|陷害|陷阱|出卖|圈套|过河拆桥|伏击|偷袭|阴谋|反目'),
 '追踪追杀': ('追逐与藏身', '追杀|追踪|追赶|追来|追上|追击|跟踪|搜寻|踪迹|方位|追兵|通缉|感应'),
 '逃离藏身': ('追逐与藏身', '逃走|逃跑|逃遁|逃离|逃出|退走|撤离|撤退|躲避|隐匿|藏身|脱身|脱困|退路'),
 '身份伪装': ('身份与秘密', '身份|伪装|假扮|冒充|遮掩|化名|暴露|乔装|易容|隐瞒|来历|真实面目'),
 '秘密情报': ('身份与秘密', '秘密|秘闻|线索|情报|消息|打听|告知|打探|探听|真相|探查|搜魂|询问'),
 '亲属故人': ('凡俗与旧情', '父亲|母亲|父母|亲人|亲属|家属|兄长|小妹|家人|三叔|故人|旧识|旧友|亲朋'),
 '凡俗生计': ('凡俗与旧情', '村子|村民|山村|凡人|凡俗|铁匠|学徒|温饱|生计|粮食|铜板|银子|百姓'),
 '救助病伤': ('生存求道', '救助|救援|救命|相救|伤势|受伤|疗伤|伤口|病人|看病|医治|救治|中毒'),
 '夺舍神魂': ('身份与秘密', '夺舍|神魂|魂魄|元神|附身|寄生|寄附|魂飞魄散|吞噬|神识|神念'),
 '探索遗迹': ('探索与禁制', '探索|遗迹|洞府|密室|秘境|古墓|石门|遗址|宝库|禁地|通道|入口'),
 '阵法禁制': ('探索与禁制', '阵法|法阵|禁制|封印|阵盘|破阵|阵眼|结界|屏障|禁锢|封禁'),
 '宝物争夺': ('机缘与代价', '宝物|取宝|争夺|争抢|抢夺|至宝|灵宝|异宝|珍宝|宝藏|财物'),
 '机缘风险': ('机缘与代价', '机缘|机会|机遇|侥幸|运气|冒险|风险|凶险|危险|意外|变故|异变'),
 '修炼突破': ('突破与远行', '修炼|突破|瓶颈|进阶|境界|结丹|元婴|筑基|炼气|闭关|功法|修为'),
 '渡劫寿元': ('突破与远行', '渡劫|天劫|雷劫|劫雷|飞升之劫|寿元|寿命|坐化|寿终|寿限'),
 '远行跨界': ('突破与远行', '远行|跨界|飞升|传送|界面|灵界|仙界|魔界|启程|赶路|出发|返回'),
 '势力战争': ('势力博弈', '大战|战争|征战|交战|侵入|入侵|魔灾|围攻|大军|军队|攻打|攻占|围困'),
 '器物炼制': ('机缘与代价', '炼器|炼制|材料|法器|法宝|打造|锻造|修复|铸造|炼成|祭炼'),
 '傀儡机关': ('探索与禁制', '傀儡|机关|机关兽|灵侍|零件|人偶'),
 '灵兽饲育': ('机缘与代价', '灵兽|妖兽|灵虫|兽卵|灵宠|饲养|孵化|驯服|兽袋|蜘蛛|虫群'),
 '灵药丹药': ('机缘与代价', '灵药|丹药|炼丹|药草|灵草|药园|药方|丹方|灵乳|神乳|灵液'),
 '环境险阻': ('生存求道', '寒气|冰焰|火焰|瘴气|毒雾|风暴|沙漠|深渊|沼泽|大海|空间裂缝'),
 '谋划后手': ('势力博弈', '后手|计划|计策|筹划|安排|准备|谋划|防备|应对|对策|斟酌|权衡'),
 '比试交锋': ('生存求道', '比试|比斗|斗法|切磋|交锋|交手|出手|迎战|攻击|抵挡|击杀|灭杀'),
 '设限拒绝': ('生存求道', '拒绝|不愿|推辞|不肯|退出|放弃|作罢|停手|罢手|离开|退让|让步'),
}
CONCEPT_TERMS = {key: words.split('|') for key, (_, words) in CONCEPTS.items()}
TRANSITION = re.compile(r'^(?:与此同时|同一时间|另一边|另一处|另一面|数[日月年]后|[一二三四五六七八九十两]+(?:天|日|月|年)后|第二天|半(?:日|月|年)后|就在这时|就在此时)')


def digest(value):
    if isinstance(value, str): value = value.encode('utf-8')
    return hashlib.sha256(value).hexdigest()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def fail(code):
    raise ValueError(code)


def validate_source(source, chapters):
    if not isinstance(chapters, list) or not chapters: fail('SOURCE_INDEX_INVALID')
    ids = set(); previous = None
    for ordinal, chapter in enumerate(chapters, 1):
        a, b = chapter.get('start_offset'), chapter.get('end_offset')
        cid = chapter.get('chapter_id')
        if chapter.get('seq') != ordinal or not isinstance(cid, str) or not re.fullmatch(r'FR-[0-9]{4,6}', cid) or cid in ids: fail('SOURCE_INDEX_ID_INVALID')
        if not isinstance(a, int) or not isinstance(b, int) or a < 0 or b <= a or b > len(source) or previous is not None and a != previous: fail('SOURCE_INDEX_RANGE_INVALID')
        raw = source[a:b]
        if digest(raw) != chapter.get('sha256'): fail('SOURCE_CHAPTER_HASH_MISMATCH')
        if raw.splitlines()[0].strip() != chapter.get('title') or chapter.get('kind') not in ('main', 'extra'): fail('SOURCE_INDEX_SECTION_INVALID')
        ids.add(cid); previous = b
    if previous != len(source): fail('SOURCE_INDEX_TRAILING_GAP')


def classify_lines(source, chapter, last_main, starts):
    """Classify complete original lines; no classifier emits original text."""
    rows = []; position = chapter['start_offset']; in_afterword = False
    for number, line in enumerate(source[position:chapter['end_offset']].splitlines(keepends=True)):
        stripped = line.strip(); reason = None
        if number == 0: reason = 'chapter_heading'
        elif in_afterword: reason = 'author_afterword'
        elif stripped in ('作者感言', '完本感言') or chapter['chapter_id'] == last_main and stripped == '感言':
            reason = 'author_afterword'; in_afterword = True
        elif not stripped: reason = 'blank_line'
        elif re.fullmatch(r'[=]{8,}', stripped): reason = 'separator'
        elif stripped.startswith('更多精校小说尽在'): reason = 'download_site_footer'
        elif re.match(r'^第[零〇一二两三四五六七八九十百千万0-9]+卷\s', stripped): reason = 'volume_heading'
        elif stripped in ('（全书完）', '(全书完)', '全书完'): reason = 'story_end_marker'
        rows.append({'chapterId': chapter['chapter_id'], 'startOffset': position, 'endOffset': position + len(line), 'startLine': bisect.bisect_right(starts, position), 'endLine': bisect.bisect_right(starts, position + len(line) - 1), 'characters': len(line), 'kind': 'excluded' if reason else 'narrative', **({'reason': reason} if reason else {})})
        position += len(line)
    return rows


def sentence_parts(source, start, end):
    """Split unusually long paragraphs without dropping separators or suffixes."""
    while end - start > MAX_CHARS:
        search_end = min(start + TARGET_CHARS, end)
        stops = list(re.finditer(r'[。！？][”’」』]?\s*', source[start + 650:search_end]))
        cut = start + 650 + stops[-1].end() if stops else search_end
        yield start, cut
        start = cut
    if start < end: yield start, end


def windows(source, narrative):
    result = []; pending = None
    for paragraph in narrative:
        for a, b in sentence_parts(source, paragraph['startOffset'], paragraph['endOffset']):
            if pending:
                size = pending[1] - pending[0]
                should_close = a != pending[1] or b - pending[0] > MAX_CHARS or size >= 650 and b - pending[0] > TARGET_CHARS or size >= 520 and TRANSITION.match(source[a:b].strip())
                if should_close: result.append(pending); pending = None
            pending = (pending[0], b) if pending else (a, b)
    if pending:
        if pending[1] - pending[0] < 260 and result and result[-1][1] == pending[0] and pending[1] - result[-1][0] <= MAX_CHARS:
            result[-1] = (result[-1][0], pending[1])
        else: result.append(pending)
    return result


def merged(ranges):
    result = []
    for a, b in ranges:
        if result and a < result[-1][1]: fail('NARRATIVE_COVERAGE_OVERLAP')
        if result and a == result[-1][1]: result[-1] = (result[-1][0], b)
        else: result.append((a, b))
    return result


def compact_exclusions(rows):
    result = []
    for row in rows:
        if row['kind'] != 'excluded': continue
        item = {key: value for key, value in row.items() if key != 'kind'}
        if result and result[-1]['chapterId'] == item['chapterId'] and result[-1]['reason'] == item['reason'] and result[-1]['endOffset'] == item['startOffset']:
            result[-1]['endOffset'] = item['endOffset']; result[-1]['endLine'] = item['endLine']; result[-1]['characters'] += item['characters']
        else: result.append(item)
    return result


def curate(cards, known_chapters):
    if not isinstance(cards, list): fail('CURATED_CARDS_INVALID')
    allowed = ('id', 'title', 'category', 'tags', 'situation', 'conflict', 'npc_motives', 'preconditions', 'exclusions', 'choices', 'followups', 'variation_slots', 'dedupe_key', 'adaptation_notes')
    result = []; ids = set()
    for source in cards:
        card = {field: source[field] for field in allowed}
        if not re.fullmatch(r'[A-Za-z0-9:_-]{1,80}', card['id']) or card['id'] in ids: fail('CURATED_ID_INVALID')
        chapter_ids = source.get('source', {}).get('chapter_ids', [])
        if not isinstance(chapter_ids, list) or not chapter_ids or any(cid not in known_chapters for cid in chapter_ids): fail('CURATED_SOURCE_INVALID')
        retrieval = '\n'.join([card['title'], card['category'], ' '.join(card['tags']), card['situation'], card['conflict'], *card['npc_motives'], *card['preconditions'], *card['exclusions'], card['adaptation_notes']])
        result.append({'id': card['id'], 'content_version': source.get('content_version') or source.get('contentVersion') or '1', 'retrieval_text': retrieval, 'metadata': {'category': card['category'], 'tags': card['tags'], 'dedupe_key': card['dedupe_key'], 'source_card_id': card['id'], 'source_chapter_ids': chapter_ids}, 'card': card})
        ids.add(card['id'])
    return result


def build(source, chapters, cards, shard_size):
    validate_source(source, chapters)
    source_sha = digest(source)
    starts = [0] + [m.end() for m in re.finditer('\n', source)]
    last_main = next((c['chapter_id'] for c in reversed(chapters) if c['kind'] == 'main'), None)
    records = []; catalog = []; accounting = []; sections = []; postings = collections.defaultdict(list)
    curated = curate(cards, {c['chapter_id'] for c in chapters})
    for chapter in chapters:
        lines = classify_lines(source, chapter, last_main, starts); accounting.extend(lines)
        narrative = [row for row in lines if row['kind'] == 'narrative']
        slices = windows(source, narrative)
        if not slices: fail('SOURCE_SECTION_WITHOUT_NARRATIVE')
        if merged(slices) != merged((row['startOffset'], row['endOffset']) for row in narrative): fail('NARRATIVE_COVERAGE_MISMATCH')
        first = len(records)
        for ordinal, (a, b) in enumerate(slices, 1):
            value = source[a:b]
            signals = {concept: [term for term in terms if term in value] for concept, terms in CONCEPT_TERMS.items()}
            signals = {concept: terms for concept, terms in signals.items() if terms}
            category_counts = collections.Counter()
            for concept, terms in signals.items(): category_counts[CONCEPTS[concept][0]] += len(terms)
            category = sorted(category_counts, key=lambda name: (-category_counts[name], name))[0] if category_counts else '未分类证据'
            identity = f"WD-FRE-{chapter['seq']:04d}-{ordinal:02d}"
            metadata = {'id': identity, 'chapterId': chapter['chapter_id'], 'tags': list(signals), 'category': category, 'family': 'source:' + chapter['chapter_id'], 'kind': 'source_evidence', 'reviewStatus': 'deterministic_extract', 'sectionOrdinal': chapter['seq'], 'segmentOrdinal': ordinal, 'sourceKind': chapter['kind'], 'characters': len(value)}
            record = {'id': identity, 'chapterId': chapter['chapter_id'], 'title': chapter['title'], 'text': value, 'startOffset': a, 'endOffset': b, 'startLine': bisect.bisect_right(starts, a), 'endLine': bisect.bisect_right(starts, b - 1), 'sha256': digest(value), 'chapterSha256': chapter['sha256'], 'kind': 'source_evidence', 'reviewStatus': 'deterministic_extract', 'offsetUnit': OFFSET_UNIT, 'tags': list(signals), 'matchedTerms': signals}
            index = len(records)
            for term in sorted({*signals, *(term for terms in signals.values() for term in terms)}): postings[term].append(index)
            records.append(record); catalog.append(metadata)
        sections.append({'chapterId': chapter['chapter_id'], 'kind': chapter['kind'], 'chapterSha256': chapter['sha256'], 'startOffset': chapter['start_offset'], 'endOffset': chapter['end_offset'], 'eligibleParagraphs': len(narrative), 'bodyCharsCovered': sum(row['characters'] for row in narrative), 'evidenceCount': len(records) - first, 'firstEvidenceId': records[first]['id'], 'lastEvidenceId': records[-1]['id'], 'coverage': 1})
    exclusions = compact_exclusions(accounting)
    if chapters[0]['start_offset']:
        exclusions.insert(0, {'chapterId': None, 'reason': 'source_preamble', 'startOffset': 0, 'endOffset': chapters[0]['start_offset'], 'startLine': 1, 'endLine': bisect.bisect_right(starts, chapters[0]['start_offset'] - 1), 'characters': chapters[0]['start_offset']})
    body_chars = sum(section['bodyCharsCovered'] for section in sections)
    if body_chars + sum(row['characters'] for row in exclusions) != len(source): fail('SOURCE_ACCOUNTING_MISMATCH')
    # The semantic contents and extraction program both contribute to identity.
    # Therefore a changed algorithm cannot silently replace an immutable KV key.
    identity = {'sourceSha256': source_sha, 'builderSha256': digest(pathlib.Path(__file__).read_bytes()), 'method': METHOD, 'maxChars': MAX_CHARS, 'targetChars': TARGET_CHARS, 'shardSize': shard_size, 'records': [[r['id'], r['sha256'], r['startOffset'], r['endOffset']] for r in records], 'curated': curated, 'concepts': CONCEPT_TERMS}
    version = 'fanren-full-v1-' + digest(encode(identity))[:20]
    prefix = 'fanren/' + version
    shards = {}; shard_bodies = {}; current = []
    def flush():
        nonlocal current
        if not current: return
        sid = f's{len(shards):04d}'
        payload = {'schemaVersion': 1, 'contentVersion': version, 'sourceSha256': source_sha, 'shardId': sid, 'records': current}
        blob = encode(payload)
        if len(blob) > SHARD_MAX_BYTES: fail('SOURCE_SHARD_TOO_LARGE')
        shards[sid] = {'key': prefix + '/' + sid, 'sha256': digest(blob), 'bytes': len(blob), 'count': len(current)}
        shard_bodies[sid] = blob
        for r in current: catalog[record_ordinals[r['id']]]['shardId'] = sid
        current = []
    record_ordinals = {r['id']: i for i, r in enumerate(records)}
    for record in records:
        # Header overhead is bounded well below 1KiB. Typical full-source shards
        # are about 120KiB, so the byte cap is an additional input-safety guard.
        if current and (len(current) >= shard_size or sum(len(encode(r)) for r in current) + len(encode(record)) + 1024 > SHARD_MAX_BYTES): flush()
        current.append(record)
    flush()
    omitted = sorted(term for term, ordinals in postings.items() if len(records) >= 20 and len(ordinals) > len(records) * .35)
    postings = {term: ordinals for term, ordinals in sorted(postings.items()) if term not in omitted}
    claims = {'allNarrativeParagraphsIndexed': True, 'allScenesSemanticallyIdentified': False, 'allExtractsHumanOrModelReviewed': False, 'generatedChoicesInEvidence': False}
    manifest = {'schemaVersion': 1, 'contentVersion': version, 'sourceSha256': source_sha, 'method': METHOD, 'offsetUnit': OFFSET_UNIT, 'chapterCount': len(chapters), 'mainChapterCount': sum(c['kind'] == 'main' for c in chapters), 'extraChapterCount': sum(c['kind'] == 'extra' for c in chapters), 'evidenceCount': len(records), 'curatedCount': len(curated), 'curatedChapterCount': len({cid for card in curated for cid in card['metadata']['source_chapter_ids']}), 'bodyCharsCovered': body_chars, 'eligibleParagraphs': sum(s['eligibleParagraphs'] for s in sections), 'sectionsCovered': len(sections), 'storagePrefix': prefix, 'shards': shards, 'chapterHashes': {c['chapter_id']: c['sha256'] for c in chapters}, 'omittedBroadTerms': omitted, 'claims': claims}
    marker = {'schemaVersion': 1, 'contentVersion': version, 'sourceSha256': source_sha, 'chapterCount': len(chapters), 'evidenceCount': len(records), 'curatedCount': len(curated), 'shardCount': len(shards), 'shardsDigest': digest(encode(shards))}
    marker_bytes = encode(marker)
    manifest.update({'shardCount': len(shards), 'manifestKey': prefix + '/manifest', 'manifestSha256': digest(marker_bytes), 'shardsDigest': marker['shardsDigest']})
    coverage = {'schemaVersion': 1, 'contentVersion': version, 'method': METHOD, 'offsetUnit': OFFSET_UNIT, 'sourceSha256': source_sha, 'sourceChars': len(source), 'sourceUtf8Bytes': len(source.encode('utf-8')), 'chapterCount': len(chapters), 'mainChapterCount': manifest['mainChapterCount'], 'extraChapterCount': manifest['extraChapterCount'], 'curatedCount': len(curated), 'curatedChapterCount': manifest['curatedChapterCount'], 'evidenceCount': len(records), 'bodyCharsCovered': body_chars, 'eligibleParagraphs': manifest['eligibleParagraphs'], 'sectionsCovered': len(sections), 'missingSections': 0, 'integrityChecks': len(records), 'narrativeCoverage': 1, 'exclusions': exclusions, 'sections': sections, 'claims': claims, 'segmentChars': {'min': min(len(r['text']) for r in records), 'max': max(len(r['text']) for r in records)}, 'unlabelledEvidence': sum(not r['tags'] for r in records), 'privateStorage': {'shardCount': len(shards), 'bytes': sum(s['bytes'] for s in shards.values()), 'maxShardBytes': max(s['bytes'] for s in shards.values())}, 'retrieval': {'type': 'literal_generic_concepts', 'conceptCount': len(CONCEPT_TERMS), 'postingTerms': len(postings), 'omittedBroadTerms': omitted, 'semanticReview': False}}
    return manifest, catalog, postings, curated, coverage, records, accounting, shard_bodies, marker_bytes


def save(path, blob):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(blob)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('source', 'chapters', 'cards', 'catalog', 'curated', 'coverage', 'private-dir'): parser.add_argument('--' + flag, required=True)
    parser.add_argument('--shard-size', type=int, default=32)
    args = parser.parse_args()
    # The production loader accepts at most 64 records in a pinned shard.
    if args.shard_size < 1 or args.shard_size > 64: fail('SHARD_SIZE_INVALID')
    source = pathlib.Path(args.source).read_text(encoding='utf-8')
    chapters = json.loads(pathlib.Path(args.chapters).read_text(encoding='utf-8'))
    cards = json.loads(pathlib.Path(args.cards).read_text(encoding='utf-8'))
    manifest, catalog, postings, curated, coverage, records, accounting, shards, marker_bytes = build(source, chapters, cards, args.shard_size)
    # Complete all validation before touching either public output. Full text is
    # written only under the explicit private directory, never near the modules.
    private = pathlib.Path(args.private_dir)
    for sid, blob in shards.items(): save(private / 'shards' / (sid + '.json'), blob)
    save(private / 'manifest.json', encode(manifest))
    save(private / 'manifest.private.json', marker_bytes)
    save(private / 'coverage.json', encode(coverage))
    save(private / 'evidence.jsonl', b'\n'.join(encode(row) for row in records) + b'\n')
    save(private / 'paragraph-accounting.jsonl', b'\n'.join(encode(row) for row in accounting) + b'\n')
    header = b'// Generated by scripts/build-story-knowledge.py. Backend metadata only; no source prose.\n'
    module = header + b'export const KNOWLEDGE_MANIFEST=' + encode(manifest) + b';\nexport const EVIDENCE_CATALOG=' + encode(catalog) + b';\nexport const TERM_POSTINGS=' + encode(postings) + b';\nexport const CONCEPT_TERMS=' + encode(CONCEPT_TERMS) + b';\n'
    save(args.catalog, module)
    save(args.curated, header + b'export const CURATED_CARDS=' + encode(curated) + b';\n')
    save(args.coverage, json.dumps(coverage, ensure_ascii=False, sort_keys=True, indent=2).encode('utf-8') + b'\n')
    print(json.dumps({'contentVersion': manifest['contentVersion'], 'sourceSha256': manifest['sourceSha256'], 'chapterCount': manifest['chapterCount'], 'evidenceCount': manifest['evidenceCount'], 'bodyCharsCovered': manifest['bodyCharsCovered'], 'eligibleParagraphs': manifest['eligibleParagraphs'], 'curatedCount': manifest['curatedCount'], 'shards': len(shards), 'privateBytes': coverage['privateStorage']['bytes'], 'catalogBytes': len(module), 'postingTerms': len(postings)}, ensure_ascii=False))


if __name__ == '__main__':
    try: main()
    except (ValueError, KeyError, TypeError, UnicodeError) as error:
        # Do not leak source paragraphs, filesystem contents or model material.
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'CORPUS_BUILD_INVALID'
        print(code, file=sys.stderr); sys.exit(1)
