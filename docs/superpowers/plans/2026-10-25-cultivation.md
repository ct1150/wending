# Cultivation Journey Implementation Plan

> **For agentic workers:** Use this spec as the implementation contract. Root coordinates independent content, UI and validation tasks, integrates the state machine, then obtains a whole-branch review.

**Goal:** Ship a coherent human-realm cultivation roguelite with real preparation, costs, danger and replay.
**Architecture:** Add isolated v4 cultivation module; retain v1/v2/v3 public behavior. Reuse reading UI and persistence boundaries.
**Tech Stack:** Native ES modules, Node >=22, node:test, static/offline HTML, existing Cloudflare Worker.
**Spec:** docs/superpowers/specs/2026-10-25-cultivation-design.md

## Global Constraints
All fixed schemas and behavior in the spec bind every task. No runtime dependencies. No copied novel characters or iconic items. No hidden success dice. No existing save deletion. 2–3 choices per normal scene. No claim of full three-world remake.

## Review Focus
- A valid old save continues instead of being overwritten by a fresh v4.
- A malformed v4 cannot introduce executable/unknown scene or impossible cost state.
- Low resources/short lifespan produce visible, explained outcomes instead of empty scenes.
- Refresh, help and double click do not reroll or apply a choice twice.
- Every new life contains a playable adventure consistent with permanent world facts.

### Task 1: State and public commands (root)
Files: create model.js, engine.js; test cultivation-engine.test.js.
- [x] Start with failing public-interface test for coherent mortal opening; implement seeded state.
- [x] Add transactional choice, actual day/year costs, conditions, injury and realm gates.
- [x] Add earned-skill inheritance and real end-of-life summaries.
- [x] Verify first cultivation, preparation-sensitive breakthrough, death/senescence, no RNG on reads, stale requests.

### Task 2: Authored human journey (content agent)
Files: create cultivation/content.js only.
- [x] Read fixed content contract; write full personal-motive opening and original branching scenes.
- [x] Include finite different opportunity arcs, gains linked to costs, visible risk and era-aware rebirth.
- [x] Return route IDs for successful and failed lives; root verifies via public API.

### Task 3: Safe state boundary (validation agent)
Files: create cultivation/validation.js; test cultivation-validation.test.js only.
- [x] Write failing shape/unsafe key/invalid values test, implement strict finite validated state.
- [x] Check save sizes, history shape and safe optional fields without cyclic dependency on engine.
- [x] Test malformed and restored genuine command-produced states.

### Task 4: UI, save dispatch and prior lives (integration agent)
Files: app.js, save-format.js, session.js, ui/journey.js, ui/paper.css; test cultivation-ui.test.js.
- [x] Test absent save selects v4; old v1/v2/v3 still load and continue.
- [x] Dispatch v3/v4 to their public API; show identity/realm/goal and actual costs.
- [x] Make fresh-start confirmation describe new human chapter and preserve export route.
- [x] Verify import/export, failed storage, keyboard choices and old-session recovery behavior.

### Task 5: Integrate, review, release (root)
- [x] Update version/build documentation and source manifests if needed.
- [x] Run relevant tests and whole release gate.
- [x] Obtain independent narrative/spec and code/compatibility review; fix important findings.
- [ ] Use GitHub connector to create reviewed branch/PR against actual remote base, verify CI, merge under existing authorization.
- [ ] Build exact merged source Worker, deploy via existing Cloudflare connector, verify production identity and one live new life.
