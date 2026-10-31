# Full-novel RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete all2,454 source-section coverage and ship usable, state-aware retrieval in wending.
**Architecture:** Deterministic full narrative evidence in private versioned KV shards; compact backend-only index plus120 curated cards. A single existing model generation adapts selected references; metadata-only accepted receipts enable per-life anti-repeat.
**Tech Stack:** Existing JavaScript ES modules/Node tests/Cloudflare Workers AI+KV; Python standard-library corpus tooling.
**Spec:** docs/superpowers/specs/2026-10-31-full-novel-rag-design.md

## Global Constraints
- Free-only, Cloudflare-only model, no paid/bulk embedding calls or life/turn cap.
- 24KiB model input;7,000-byte public context; preserve current game rules and frozen contexts.
- Raw novel never committed to public repo/browser output; immutable private KV.
- User authorized implementation, merge and deployment; root coordinates external writes.

## Review Focus
- Legacy archive replay and currently open clients.
- Refusal/leave and failed crossing versus retrieved unrelated plot.
- Incomplete/private storage failure before inference, no extra model calls.
- Exact narrative paragraph coverage and catalog/shard consistency.
- Concurrent changes and preserving existing secrets/budget namespace.

### Task1: Complete source corpus
- [x] Write/run red coverage and source-provenance tests including duplicate chapter numbers, ads/afterword and long paragraphs.
- [x] Implement source builder and generate catalog/curated modules, coverage report and private shards with interfaces from spec.
- [x] Verify2454/2454 section coverage, every eligible paragraph exactly covered, all hashes and ids; inspect representative samples and label extraction quality honestly.

### Task2: Retrieval and packing
- [x] Write/run red tests for determinism, state-weighted matching, anti-repeat, corrupt/missing shard, isolation and total prompt-size limits.
- [x] Implement selectStoryReferences, loadStoryReferences, packStoryReferences per spec.
- [x] Verify corpus-scale lookup performance, no IO during selection/packing and no source exposure in receipt/errors.

### Task3: Provider, memory, compatibility
- [x] Write/run red tests for metadata lifecycle, legacy hash preservation, old-client capability, one model call, frozen retry and current-action authority.
- [x] Implement optional metadata projection and async provider loading once; use sync packing before existing input checks.
- [x] Run integration/archive/provider suites with both old and new contexts, failure and near-budget cases.

### Task4: Production and delivery
- [x] Add optional knowledge production policy/binding and a metadata-only diagnostic endpoint or health field with tests.
- [x] Run full project release, backend packaging and independent review; fix concrete findings.
- [ ] Import private KV corpus, verify remote manifest/shards, publish PR and merge with expected head after CI.
- [ ] Build production from final main, preserve current CF bindings/secrets, upload unactivated version, inspect and promote.
- [ ] Verify real served version, references in generated output metadata, interaction, saved retry/refresh, and private data isolation.
- [ ] Save complete corpus/card package and final coverage/release report; state outcomes with exact counts and evidence.

## Verified continuation checkpoint

- Integrated current 5.2.0 main and all source-level findings. Full release: 1207/1207 tests,217 JS syntax checks,1649851-byte offline build; independent final code review approved.
- Runtime opt-in, old near-limit archives, hung marker and concurrent cache defects have failing-then-passing regressions.
- Private KV import remains blocked by automatic approval review pending explicit destination authorization. Existing4/248 shards and absent marker cannot support activation. Complete PR/merge and exact production package before asking for that final permission.
