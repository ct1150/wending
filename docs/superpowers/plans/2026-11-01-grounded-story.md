# Grounded story choices implementation plan

**Goal:** Choices follow the completed current scene, describe their actual rule action, and remain playable across a complete life.

**Architecture:** Production v7 GLM generation writes the scene first, then writes choices against that immutable scene. The menu receives only evidenced present targets and a catalog calculated by the existing rules, including real time and resource costs. Both calls share the original deadline, reservation and commit boundary; all text remains model authored. Older provider contracts and saved games remain compatible.

**Tech stack:** JavaScript modules, Workers AI GLM, existing authoritative rules and Node tests.

## Constraints and review focus

- Never add fallback buttons, custom input, forced death, a life/turn cap, or a paid provider.
- Answer the selected purpose before presenting new decisions. Do not execute an unselected next action.
- A reported or absent person must not become an actionable interlocutor. Travel destinations must first appear in the scene.
- Show the second phase's choices with the first phase's unchanged prose; account for both calls even on failure.
- Preserve pending turns, original receipts, save compatibility, retrieval evidence and single settlement.

## Task 1: Ground generation in the completed scene

- [x] Add failing integration tests in `tests/story-grounded-choices.test.js`: second input contains the exact scene and selected purpose; candidate actors/destinations require current evidence; catalog uses real costs; streaming retains the body; API settles once; phase failure does not commit.
- [x] Add `src/worker/story-grounded-choices.js`: server-only two-phase transport using the existing streaming transport and rules. Keep the canonical decoder/validator as the only acceptance path.
- [x] Enable the path in production composition through API runtime configuration, preserving acceptance/legacy provider paths.
- [ ] Run targeted tests, full suite, check and release build. Correct failures before integration.

## Task 2: Complete-life acceptance and release

- [x] Add an opt-in public API acceptance runner using actual engine prepare/commit, memories and saves, with a reproducible transcript. Select only generated enabled choices, never inject scenes/actions/states.
- [ ] Run candidate isolation with actual free GLM from birth to rule death; check restore, death settlement, archive and reincarnation. Inspect scene/choice causality throughout, and add regression tests for any discovered defect.
- [ ] Obtain branch review, pass CI, merge and deploy. Verify deployed source, health and a real generated turn. Record measured coverage and limitations in repository evidence.

## Findings incorporated during real-model acceptance

- Labels now include a concrete basis copied from the finished scene, while the selected rule reference determines all mechanical fields. Generic rule captions are rejected and corrected by the model.
- Current receipt, location, technique state and translated item deltas override obsolete narrative history.
- At most four model calls share one original provider deadline; unsuccessful uncommitted drafts may be corrected without changing the receipt.
- An explicitly advertised frontend recovery path first looks up interrupted attempts, then persists at most one linked retry before POST. Quota and identity failures cannot trigger another inference.
- Two independent code reviews found departed-actor and observation/practice mismatches; their failing regression tests now pass.
- Complete-life acceptance remains pending until the final report is produced.
