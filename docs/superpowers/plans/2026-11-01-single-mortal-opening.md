# Single Mortal Opening Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user delegated the background choice and requested implementation plus publication directly.

**Goal:** Replace all new-game origin variants with one original ordinary-person cultivation beginning.
**Architecture:** Add one immutable opening definition, identify new lives with `originId=mortal`, and keep the four legacy identities only for historical replay. Reuse existing birth markers, model-generated choices and the deployed Worker architecture.
**Tech Stack:** Existing browser JavaScript, Node tests, Cloudflare Worker, GitHub Actions.
**Spec:** `docs/superpowers/specs/2026-11-01-single-mortal-opening-design.md`

## Global Constraints

- Original setting: 石溪村 → 栖云门外院; age sixteen, mortal, no automatic initiation or gifts.
- One new background; random attributes/talents and their lock semantics stay intact.
- Two supplies, zero stones; inherited benefits use existing settlements.
- Preserve old saves and hashes. No local fallback choices or custom input.
- Preserve existing Cloudflare bindings and free provider policy on release.

## Review Focus

- Restored pre-change creation drafts must not reopen an old origin.
- Reincarnation must use the same beginning while retaining earned benefits.
- A reroll must not rewrite background or create a stored life before confirmation.
- Old marked/unmarked lives must retain seeded behavior and valid replay.
- Follow-up model prompts must retain history without restarting the mountain-gate scene.

### Task 1: Birth and world definition

Files: new `src/game/cultivation/live/mortal-opening.js`; update `model.js`, `birth-stories.js`, `engine.js`, `validation.js`, `cultivation-rules.js`, `story-director.js`, `experience-story.js`.

- [x] Write and run failing tests for one marked origin across seeds, preview/commit equality, fixed first brief/world, initial items, and old save compatibility.
- [x] Implement the opening definition and route new marked default births to it; explicit historical origins preserve old rules and RNG.
- [x] Run birth/rules/story tests and record results.

### Task 2: Creation and model context

Files: `src/app.js`, `src/ui/character.js`, `src/ui/game.css`, `src/worker/story-provider-core.js`; new unified-opening tests and related browser expectations.

- [x] Add failing tests for fixed story outside the random card, old draft replacement, generated opening grounding, and subsequent contextual continuation.
- [x] Force current UI births to the new marked beginning; render background separately from the random attributes; provide original background/ordinary-person constraints to the model.
- [ ] Run focused tests, full suite, syntax check and build; update version and README to 6.2.0.

### Task 3: Review and publish

- [x] Run a fresh whole-branch review and address blocking findings with regressions.
- [ ] Push with GitHub plugin, obtain full CI success, and merge.
- [ ] Build the enabled backend using the current authorized production policy, verify all module hashes, upload with existing bindings, then test the version at zero default traffic.
- [ ] Validate real new life and follow-up, switch production, verify `/healthz`, and document concrete release evidence in the PR.
