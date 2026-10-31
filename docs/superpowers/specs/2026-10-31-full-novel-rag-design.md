# Full-novel plot knowledge and production integration

## User request and acceptance
The user explicitly requested: “120是否是完整的？我需要完整的，并完成接入和上线”. The 120 authored cards are a curated selection of 110 source sections, not complete coverage. Complete means all 2,454 indexed main/extra sections have traceable source coverage; all eligible narrative paragraphs are covered without truncation. Automatic evidence records are labeled `source_evidence` / `deterministic_extract`, never described as fully authored three-branch cards. The existing 120 adapted cards remain a distinct curated layer. The live generator must use this full knowledge base and generate choices grounded in current game state. Finish implementation, tests, GitHub integration and actual Cloudflare deployment.

## Constraints and decisions
- Current baseline: ct1150/wending main f7633ac, version5.0.0. Preserve concurrent main changes and the existing v7, streaming, saves, and Cloudflare-only GLM route.
- User has authorized deployment. No paid plans, model bulk-processing, embeddings, R2 subscription, or external provider fallback. No artificial life/turn/count cap.
- Public GitHub must not contain the uploaded full novel. Keep complete narrative evidence in a new private Workers KV namespace; commit only compact metadata/index, authored abstract cards, coverage records and reproducible build tooling.
- KV Free allows1GB and1000 key writes/day; use approximately32 evidence records per immutable shard (about252 shards). No runtime writes. Read only selected shard(s), verify hashes, cache a bounded number. Corpus metadata and version are deployed together.
- Backend-only retrieval; no novel text in browser assets, saved scene receipts or public health output.
- One existing AI generation per turn. Add references to the existing server-created user-message JSON after GLM wire conversion. Keep the final selectedPurpose message and streaming transport unchanged.
- Keep24KiB serialized model-input ceiling and7,000-byte public context ceiling. Pack against actual remaining bytes; preserve current state/action over optional references.
- Existing game rules and actions remain authoritative. Unsupported authored custom branches are inspiration only; never executable protocol additions. References do not establish game facts, impose accepted quests, give items, revive entities or force travel. Respect current scope/realm and rejection/leave.

## Architecture and interfaces
### Corpus builder (owner: full_corpus_design)
Files: `scripts/build-story-knowledge.py`, `src/worker/knowledge/catalog.js`, `src/worker/knowledge/curated.js`, `docs/knowledge/fanren-coverage.json`, relevant corpus tests. Private outputs live outside the repo or in `.scratch/`.

`catalog.js` exports:
- `KNOWLEDGE_MANIFEST`: {schemaVersion:1, contentVersion:string, sourceSha256:string, chapterCount:2454, evidenceCount:number, curatedCount:120, storagePrefix:string, shards:{[shardId]:{key:string,sha256:string,bytes:number,count:number}}, ...coverage summary}.
- `EVIDENCE_CATALOG`: array of {id:string, chapterId:string, shardId:string, tags:string[], category:string, ...small retrieval metadata}. No original prose.
- `TERM_POSTINGS`: object mapping deterministic generic lexical/concept terms to arrays of evidence ordinal integers. Corpus builder and retrieval owner may agree on compact representation before committing; preserve exports.
`curated.js` exports `CURATED_CARDS`: runtime120 cards in existing format (id,content_version,retrieval_text,metadata,card); no source quotes/summaries.
Private KV shard JSON: {schemaVersion:1,contentVersion,shardId,records:[{id,chapterId,title,text,startOffset,endOffset,startLine,endLine,sha256,...provenance}]}. Exact bytes hash is pinned in manifest. Source offsets in unicode_code_point units. IDs must be stable and ASCII, <=80characters. Version must be <=80ASCII characters.
Private corpus export includes full chapter coverage, paragraph accounting, exclusions with reasons, scene evidence JSONL and KV upload shards. Ads/author afterword must be excluded from narrative retrieval with explicit coverage accounting. All2454 sections still have their narrative body covered.

### Retrieval and private loader (owner: rag_deploy_scout)
Files: `src/worker/story-knowledge.js`, `tests/story-knowledge.test.js` (can split into focused new tests).
Exports:
- `selectStoryReferences(context)` -> `{corpusVersion,queryHash,cardIds,evidenceIds,families}`; deterministic, pure, no IO. queryHash=sha256(canonicalStringify(context)). IDs are selected only from deployed catalogs. Weighted current selected action/director goals/context, then tags/concepts/lexical postings; avoid recent IDs/families from context.retrieval. No current time/attempt/session randomness. Suppress medicine-centric hooks unless the current player goal explicitly asks for them. Prose eligibility is guidance, not claimed machine proof.
- `loadStoryReferences(store,selection,{signal}={})` -> Promise `{selection,curated:[runtime cards],evidence:[source records]}`. At most two selected evidence records. KV store has async `get(key,options)`; read pinned immutable shard(s), verify exact UTF8 SHA256 before JSON parse, validate IDs/version. Bounded cache, no poisoned shared cache across stores/versions. Missing/corrupt data throws a coded `KNOWLEDGE_UNAVAILABLE` error, and never calls AI. No source text in errors.
- `packStoryReferences(input,context,bundle,{maxBytes})` -> `{input,receipt}`; clone input, add short fixed authority/originality instructions and bounded `storyReferences` to messages[1] JSON. Preserve message count and final message. maxBytes is total serialized input ceiling, not extra allowance. receipt only lists references actually packed; null when none fit. Untrusted evidence is data, not instructions. No full authored custom-action payload needed in prompt.
- Receipt: {version:1,corpusVersion,queryHash,cardIds:string[],evidenceIds:string[],families:string[]}. At most1 curated card and2 evidence records. Families may be bounded short strings. If a field length budget needs adjustment, coordinate with shared-metadata owner first.

### Provider and persistent exposure (owner: rag_runtime_scout)
Files: `src/game/cultivation/live/{retrieval-memory.js,schema.js,validation.js,engine.js,memory.js}`, `src/worker/{story-provider-core.js,story-provider.js,story-api.js}`, corresponding new/updated tests.
- Fresh buildStoryContext advertises optional `retrieval:{version:1,...compact recent exposure}`. Metadata module defines exact shape and coordinates it with retrieval owner; <=700bytes desired, always honor7000 context limit.
- Provider runtime receives `knowledgeStore:env.STORY_KNOWLEDGE` only through trusted backend composition. In async generateScene wrapper: select+load once before inference; pass trusted bundle to generateProviderScene. No network in providerInput or prospective next-context validation.
- Core builds baseline input, invokes packer before existing final size checks and obtains receipt. Server adds optional scene.retrieval only for contexts advertising retrieval.version1, after model decoding and before canonical validation. Never ask the model to output it.
- Validate receipt binding to frozen context queryHash, limits and format. Only successful commit derives optional state.retrieval usage. Empty/missing receipt is a no-op; historical scenes/state hashes and frozen pre-feature contexts remain unchanged. New lives start fresh. Keep source text out of state.
- Old clients without the capability get unchanged scene shape. Failed inference, previews and retries do not count as exposure. Accept and preserve receipt during export/import replay.
- KN0WLEDGE_UNAVAILABLE uses actual spelling KNOWLEDGE_UNAVAILABLE; paused, inferencePerformed=false/accountingStatus=complete before model. Root will handle minimal UI error wording if necessary.

### Production packaging and launch (root)
- Add optional production knowledge policy and binding config without weakening current Free proof. Keep original proof timestamp; do not pretend current billing was freshly verified.
- New KV namespace, immutable shard import, manifest readback. No overwrites of existing game state, budget namespace or secrets.
- Tests/build, independent final review, feature PR with expected-head merge. Final main SHA must match embedded frontend/backend. CI publishes frontend channel but production backend is an explicit version upload.
- Preserve AI, STORY_BUDGET namespace, secret names via keep_bindings; add STORY_KNOWLEDGE only. No new Durable Object migration. Recheck main and current deployment before promotion.
- Check actual deployment identity, corpus counts/hashes, public health/capabilities, real generated opening/continuation, save/refresh, no raw-knowledge route. Report exact evidence and any remaining failure honestly.

## Approaches considered
1. More manually authored cards alone: cannot prove full-book coverage and encourages superficial card-count inflation.
2. Full source ESM in public repo: simple synchronous retrieval, but would publish the whole uploaded novel and increase cold-start footprint.
3. Chosen: complete private evidence+public compact index+curated reference layer; deterministic retrieval and on-demand adaptation in the existing generation. Adds a small KV read boundary, keeps ingestion free and auditable.

## Review focus
- Old client/frozen-context/save compatibility and replay hash equality.
- Refusal/leave/failed-crossing continuity and no source facts leaking into actual rules.
- Missing/corrupt KV, optional prompt space and no extra AI calls.
- Index-to-shard/version/hash mismatches, every eligible paragraph accounted for.
- Concurrent main/deployment updates, original secrets/namespace and current free-only route preserved.
