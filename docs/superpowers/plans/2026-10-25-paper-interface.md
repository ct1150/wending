# Paper Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the accepted minimalist Paper interface as the complete playable game with direct story onboarding and preserved saves.

**Architecture:** Retain engine and persistence contracts. Add a small testable session bootstrap boundary, simplify the existing app/story renderers, and own the Paper appearance in an additional stylesheet. Use the existing GitHub validation and embedded-HTML Worker release path.

**Tech Stack:** Native JavaScript modules, CSS, node:test, existing custom offline bundler, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-10-25-paper-interface-design.md`

## Global Constraints

- Existing engine, story content, costs, SAVE_KEY and save schema stay unchanged.
- Fresh confirmed-empty storage starts 云归/village/sword at YG01; never auto-select a story choice.
- Valid v1/v2 saves restore exactly; malformed, empty-string and unreadable saves are not automatically overwritten.
- All existing gameplay, settings, import/export, earned rewards and reincarnation remain reachable.
- Single-column Paper layout, contextual costs, readable disabled reasons, explicit return to current story, accessible keyboard focus, system light/dark and 320px support.
- No external runtime dependencies, dynamic imports, CSS @import or copied prototype simulation.
- No local browser, headless browser, raw CDP or alternative browser inspection around the earlier local-file security rejection; record source/Node checks separately from real production UI evidence.
- User has accepted the recommended direction and requested continuation; execute without a repeated design or implementation permission question.

## Review Focus

1. Empty-string corruption and thrown storage reads must not be interpreted as an empty slot; assert zero automatic writes and recovery state in Task1.
2. Valid v1 saves have story:null and may be mid-combat; compare restored state and initial writes in Task1.
3. A first choice followed by reload must charge once and retain its consequence; verify YG02, HP114 and result in Task1.
4. Re-rendering can collapse support panels or lose keyboard focus; review actual app handlers/state across training, equip, event and ending in Task1; Node tests cover extracted UI behavior where practical, production smoke records browser limits.
5. A second stylesheet or new JS module can be missing from offline builds; run the full build/Worker tests and inspect packaging in Task2.

---

### Task 1: Integrate the real Paper game interface

**Files:**
- Create: `src/ui/session.js`, `src/ui/paper.css`, `tests/session.test.js`.
- Modify: `src/app.js`, `src/ui/story.js`, `index.html`.
- Optional focused semantic rendering tests: `tests/paper-ui.test.js`.
- Do not edit: `src/game/*`, `src/ui/prototype-minimal.html`, package/release docs.

**Interfaces:**
- Consumes unchanged `createGame`, `getStoryView`, `chooseStory`, `act`, combat/event/equipment/reincarnation functions and `loadFromStorage`/`saveToStorage`.
- Produces `bootstrapSession(storage, options = {})` in `src/ui/session.js`; `options.seed` permits deterministic tests. Return an explicit load status (`fresh`, `loaded`, `blocked`), state (or null), raw corrupt save (null or original string, including empty string), and error text. Do not derive corruption from string truthiness. This is an app boundary, not a second save validator.
- App consumes this result once, persists a genuinely new state through existing persistence handling, and prevents automatic persistence while load status is blocked. Keep existing action data attributes and focus-target IDs.
- Continue `renderStoryScene(story)` / other story renderers with optional presentation data if needed; engine-derived choices remain authoritative.

**Requirements for this task (binding):**
- First successful empty-storage visit shows actual YG01 immediately using 云归/village/sword/no legacies. No required name/origin/path screen and no automatically selected choice. Existing data wins over automatic onboarding.
- A load failure yields safe recovery with raw backup/import/explicit new game; blocked persistence is explicit even for empty raw data. A write failure on a legitimate new game leaves a playable session plus readable backup guidance.
- Main shell is a centered Paper reading page with game name, actual old-fire deadline (when active) or generation/age, and low-emphasis settings/help access. No permanent sidebars, fixed bottom nav, landscape hero or resource strip in ordinary story mode.
- Current scene has short context, goal, story and equal-weight choices. Hide redundant chapter/route counters from the opening; show route limit when actual investigation selection starts. Put resource balances alongside relevant costs, retaining time/probability/disabled explanations.
- Inline primary feedback is the real last result. Remove duplicate main-area log/sidebar feedback; move journal/people/clues/log into 回看. Status owns resources/progress; 修行 owns existing action controls and links to worlds/equipment/legacies. Expanded utility survives routine redraws; generation change closes old panels.
- Standalone utility views have a clear return to current scene. Event/combat interruptions, old-save free cultivation, ended/victory reward selection, retirement confirmation and full reincarnation setup stay playable.
- First life uses the recommended character. Do not respec an active character by changing origin/path fields. Keep complete next-life name/origin/path/legacy choices.
- Update help copy to actual new locations. Keep #toast, #dialog, #import-file stable. Preserve keyboard result/scene/combat/ending focus and native details/button semantics.
- Link paper.css after styles.css; do not rewrite the minified base stylesheet. Own all old dark literal surfaces used by Paper, including utilities, dialogs, events/combat, errors, disabled buttons and narrow-screen grids. Use serif story prose, restrained separators, neutral equal choices, no decorative hero. Touch targets44px; responsive down to320px. Respect reduced motion and visible focus.
- Keep zero runtime dependencies and static named relative imports compatible with the bundler.

- [ ] **Step 1: Add focused startup regression tests and observe expected failures.** Test fresh missing save against createGame with seed20261025; direct YG01/age16/hp120/spirit24/herbs3/deadline8/no action; loaded v2 in adventure/event/combat/ended/victory unchanged and no automatic overwrite; migrated v1 story:null retained; malformed JSON, raw empty string and denied reads are blocked without writes. Test enter_help then save/reload gives YG02/hp114 and same prior result, not repeated cost. Test blocked writes yield exportable in-memory state via the app persistence boundary. Use real engine/serialization and simple storage fixtures; no mock browser.
- [ ] **Step 2: Implement bootstrapSession and wire the app's first render/recovery/reset/import flow.** Keep initialization distinct from user-confirmed replacement; handle raw empty backup explicitly.
- [ ] **Step 3: Implement Paper shell, progressive utilities and story rendering with the existing renderers/actions.** Keep all gameplay reachability and focus rules in the requirements above. Add focused semantic tests only where they catch a concrete behavior defect; do not write CSS or whole-template snapshot tests.
- [ ] **Step 4: Implement the production Paper stylesheet and metadata.** Use the accepted visual reference at `/workspace/scratch/8212ea3e9390/wending-work/src/ui/prototype-minimal.html` only for appearance, never copy its simulation.
- [ ] **Step 5: Verify and self-review.** Run focused new tests, `npm test`, `npm run check`, `npm run build`, and `git diff --check`. Inspect source handlers for all utility/phase transitions and the offline output for packaged CSS/modules. No browser tool. Record exact commands/results and visual-verification limitation in the task report.
- [ ] **Step 6: Commit only this task's files.** Write the report in the supplied SDD path; return concise status and commit SHA.

### Task 2: Record and package the Paper release

**Files:**
- Modify: `package.json`, `README.md`, `docs/QA_REPORT.md`, `docs/PROGRESS.md`.
- Modify `docs/DEPLOYMENT.md` only after actual publication evidence is available to the controller.

**Interfaces:**
- Consumes Task1's committed production app, source review and Node evidence.
- Produces version1.2.0 build/QA documentation; controller owns GitHub publishing, exact-SHA Worker build, deployment and final production audit.

- [ ] **Step 1: Bump package version to1.2.0 and update current player-facing README flow.** Describe direct first story, default first-life character, 状态/回看/修行, optional next-life choices and save recovery. Preserve historical release evidence.
- [ ] **Step 2: Run `npm run release` and `npm run build:worker -- --source-commit <full current local SHA>` for validation only.** Verify offline CSS/module inclusion, build metadata version1.2.0, Worker health/hash tests. Do not describe this local validation SHA as published production source.
- [ ] **Step 3: Append QA/PROGRESS with exact test counts, known environment warning and actual coverage limits.** Mark browser visual validation pending until there is real evidence. Do not claim usability, physical-device or20–30-minute pacing validation.
- [ ] **Step 4: Commit the metadata/docs and report.** Do not push, open a PR or deploy; controller handles those once reviews are complete.

## Controller completion

After task and whole-branch reviews, publish the reviewed tree through GitHub using actual remote main as parent (local history is a reconstructed snapshot). Require successful validation before merge. Build from the actual merged/source SHA and update the existing embedded-HTML Worker. Capture actual health/source/hash/deployment and permitted production UI evidence; record limitations honestly. User continuation authorizes this established delivery workflow. Do not configure a new hosting service, browser workaround or automatic deployment.
