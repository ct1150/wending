# Cultivation v7 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Turn the supplied v7 novel-engine specification into a playable, persistent live game while preserving old journeys.

**Architecture:** Explicitly marked new lives use deterministic cultivation mechanics and a bounded story director. Existing receipts, archives and one-request streamed story/choices remain the transaction boundary. The UI renders actual receipts and never grants model-written numerical effects.

**Tech Stack:** Existing vanilla JavaScript, IndexedDB, Node test runner, Playwright, Cloudflare Worker/Workers AI.

**Spec:** docs/superpowers/specs/2026-10-31-cultivation-v7-design.md

## Global Constraints

- Preserve V5/CV4 legacy replay and pending generation identities.
- New UI-created lives pass engineVersion:7; legacy createLiveGame callers retain existing behavior.
- Exactly 3 new model choices, at least 1 feasible cautious path, plus custom action 4.
- Age and lifespan maximum are independent. Only rule-backed operations change maximum.
- No automatic player actions, paid fallback, count limit, or new storage namespace.
- Work only in this isolated checkout; do not overwrite the preceding conversation's checkout.

## Review Focus

- Import/replay a legacy or v7 pending custom action without settling twice.
- Crossing a year or volume while refusing an NPC never fabricates travel or death.
- Invalid/ambiguous natural language leaves state and input unchanged.
- Repeated clicks, refreshes, or tabs cannot claim a deceased life's reward twice.
- Empty sections and late preview events do not replace streamed nodes or show stale receipts.

## Task 1: Mechanics and character generation

Files: live/model.js, engine.js, validation.js, cultivation-rules.js and focused mechanics tests.

- [x] Add regression cases for lifespan separation, nine realms, costs, death and legacy replay.
- [x] Implement explicit v7 marker, bounded seeded root/physique/relic traits, intentional material-gated breakthrough and realm time scales.
- [x] Verify focused mechanics tests and expose shared life-summary/initial-items/next-realm helpers.

## Task 2: Persistent story director and model contract

Files: live/story-director.js, memory.js, worker provider/wire/named schema and focused tests.

- [x] Test bounded memory, yearly summaries, 30/50-turn archives and player-agency invariants.
- [x] Implement createStoryDirector, advanceStoryDirector, validateStoryDirector and buildDirectorContext.
- [x] Integrate compact context and actual modern model prompt; validate grounded three-choice outputs and metadata.
- [x] Verify input budget and old generated scene compatibility.

## Task 3: Custom actions and reincarnation transactions

Files: live/custom-actions.js, reincarnation.js, live-archive.js and integration tests.

- [x] Test clear mappings, ambiguous/impossible input rejection and deterministic pending replay.
- [x] Preserve submitted intent in rule receipt and immutable generation input.
- [x] Derive genuine death settlement, affordable rewards and archive-backed single claim.
- [ ] Verify JSONL export/import and competing archive writes.

## Task 4: Continuous game presentation

Files: app.js, ui/journey.js, character.js, live-session.js, paper.css and focused browser tests.

- [x] Apply exact startup copy and current/max lifespan.
- [x] Present feedback, changed stats and actual checks without empty noise; preserve stream DOM.
- [x] Wire numbered choices/custom action, v7 model exits, death settlement and explicit rebirth.
- [ ] Verify invalid-input recovery, mobile layout, stream completion and legacy entry points.

## Task 5: Integration, review and release

- [x] Integrate director hooks and cross-module helpers; review broad changes against the spec.
- [ ] Run relevant regression suite, syntax check and frontend/backend builds; resolve concrete failures.
- [ ] Publish reviewable GitHub branch/PR, verify exact commit checks and merge when passing.
- [ ] Deploy compatible Cloudflare backend on existing bindings; verify public release identity and retain truthful limitations.
