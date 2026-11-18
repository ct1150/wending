# 白脊风隙 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Main agent edits; subagents may only review read-only.

**Goal:** Deliver a connected high-realm investigation and cultivation adventure with earned abilities, real costs and a later playable consequence.
**Architecture:** One authored module owns optional cloudRift state and its scenes. Existing event rules settle costs; existing cloud passage and journal provide entry/resume. Preserve exact historical cloud menus during import.
**Tech Stack:** Native JavaScript, node:test, current IndexedDB archive/session, existing local preview.
**Spec:** `docs/superpowers/specs/2026-11-18-cloud-rift.md`

## Global constraints

- No required model calls, preloading, new dependencies or production deploy.
- Preserve ordinary cloud passage and unrelated working files.
- Exact phase validation, 2–3 choices per scene, native rule costs as specified.
- Actual human duration remains unproven; no turn-to-hour conversion.

## Review focus

- Leaving and training across a realm gate must not lose the unfinished excursion.
- A learned form can be changed after its preparation is already paid.
- Original menu and pending records must replay without rewriting history.
- A failed path must not become free repeatable damage or award progress incorrectly.
- Missing supplies, spirit or iron must disable only the corresponding paid action.

### Task 1: Complete native excursion and later consequence

Files: new `src/game/cultivation/live/cloud-rift.js`; modify `cloud-passage.js`, `event-content.js`, `events.js`, `journey-notes.js` in the same directory; `tests/river-chronicle.test.js`.

Interfaces: `canVisitRift(state)` checks entry; `validateCloudRift(events,life)` validates; `riftNode(state,menu,choice)` renders. Existing event rule/patch machinery settles all actions.

- [x] Add a genuine native route fixture ending after first cloud passage, then a failing native test for entry and the full ordinary route.
- [x] Implement specified state, costs, evidence-based paths, both endings and rank-7 revisit.
- [x] Extend tests for both forms, prior渡法, shortage, mistake recovery, journal and serialize/reload. No arbitrary life edits in full-route tests; focused rule-boundary denial tests may use explicit altered inputs.
- [x] Run focused tests and inspect changes.

### Task 2: Historical replay and player-facing verification

Files: `src/game/live-archive.js`, `tests/event-archive.test.js`, genuine parent pending fixture, README.

- [x] Export a real parent-version sky-book pending archive; verify old menu mismatch before compatibility support.
- [x] Add exact historical cloud-menu mapping, keeping old state hash/history intact.
- [x] Test pending once, paid pending once, subsequent mixed-history reimport and result.
- [x] Run event-story/event-archive/river related suite; syntax-check changed files and build.
- [x] Package a new immutable local preview, play the native mobile flow, export/import and refresh; confirm no story calls or errors.
- [x] Review diff, obtain read-only review of phase correctness, address findings, prepare only scoped files for commit and record verified limits.

## Verified result

- Native entry test first failed because the option did not exist. Historical parent archive first failed exact replay before the compatibility mapping. Read-only review found the eligible-entry and minimum-time gaps; main-agent boundary test reproduced and fixes passed.
- Related suite first passed 103/103. After entry/validation improvements, 103/104 passed: the continuous route exposed an extra gateway after an original cloud retreat. Preserved the original pending trial page; the final six focused tests all passed, including the complete 814-turn three-world campaign, archive replay, death/rebirth, rift branches and phase validation. This is not a claim of a fresh 104/104 suite.
- Eight changed JavaScript files passed syntax checks; build and diff checks passed. Thirteen package-input hashes matched before this documentation-only completion annotation; runtime files did not change afterward.
- Final immutable local preview: `http://127.0.0.1:4176/rift-v2/`; SHA256 `65f6b20e568f13ffc9562071e12fc681128d2412360e168eaf99377154a3e7d8`. The earlier `/rift/` package is not the final candidate.
- Actual Chrome 360px flow imported genuine parent turn585, resumed pending exit once, completed first mooring at599, and reimported/refreshed its 1,953,870-byte export. Genuine native later-visit save at708 completed both outcomes at710; exports2,301,420/2,301,449 bytes reimported and refreshed with exact hashes. Checked costs and no horizontal overflow, story API requests or page errors. Screenshots of preparation, mooring and changed later outcome inspected.
- Logs: `.scratch/rift-{red,matrix,revisit,archive-red,archive,suite,suite-final,final-focused,build-final,ui-final}.log`. Genuine later snapshot was generated by native choices then real browser session replay, not edited state.
- No production deployment and no verified twenty-hour human playtime. This delivers one connected optional ordeal, not the overall duration goal.
