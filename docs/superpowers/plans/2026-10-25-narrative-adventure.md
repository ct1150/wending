# Narrative Adventure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the approved 药谷旧火 narrative adventure with remembered choices, multiple outcomes and playable next-life consequences in the existing Wending game.

**Architecture:** A separate authored-story data/runtime module integrates with the existing pure engine. Keep the five global phases, strict versioned saves, native-module/offline build and current Cloudflare Worker deployment.

**Tech Stack:** Node.js >=22; native JavaScript, CSS, Node test runner, existing offline bundler; no new runtime dependencies.

**Spec:** docs/superpowers/specs/2026-10-25-narrative-adventure-design.md

## Global Constraints

- 明确主线加随机支线；一世20–30分钟为目标，未经真人试玩不得称已达标。
- 世界与因果跨世继续，三种主要结果必须有可玩的不同后世任务。
- 原生JavaScript、零新增运行时依赖、仅静态named imports、不得产生模块循环。
- 新存档version=2；保留baishi-wending-save-v1存储键；严格迁移旧存档且不捏造旧当世经历。
- 全局phase保留adventure/event/combat/ended/victory；旧玩法和三界目标保留。
- 中文可读剧情与可见成本；剧情后果常驻阅读区；手机可用。
- 只有主代理执行GitHub发布、合并与Cloudflare变更；实现代理不得操作外部资源。

## Review Focus

- Untrusted saves: old event/combat/terminal states preserve their actual history; missing or contradictory v2 fields rejected.
- Interruptions: refresh, auxiliary cultivation/travel, combat victory/flee/death do not strand or duplicate narrative progress.
- Last resource: unaffordable or fatal costs grant no posthumous reward or positive world outcome.
- Repetition: revisiting choice IDs and reloading cannot farm once-only rewards or rewrite an already settled outcome.
- Generations: a later life reads persistent outcomes and time, without resurrecting dead NPCs or replaying the identical first-life crisis.

## Task 1: Story content, deterministic transitions, engine integration and saves

**Files:**
- Create: src/game/story-content.js, src/game/story.js, tests/story.test.js, tests/story-save.test.js.
- Modify: src/game/engine.js; src/game/content.js only for named story combat enemies or earned legacy items if necessary.
- Modify: tests/engine.test.js and tests/history.test.js only where assertions explicitly pin obsolete save-version behavior; keep their original corruption/roundtrip intent.
- Read: [docs/story/valley-fire.md](../../story/valley-fire.md) (the original authored content design; exact implemented costs/state are defined by the engine), current engine contract, existing content and saves.

**Interfaces:**
- Consumes existing state and pure public engine methods; no UI dependency.
- Produces engine.getStoryView(state) and engine.chooseStory(state, choiceId) exactly as specified; retains all existing APIs.
- Produces migrated version=2 state with story and meta.storyWorld; getStoryView(null-story) returns null.
- Internal narrative schema and cost/world effect bridge are implementation choices; document them in the task report for Task 2.

- [ ] Write behavioral tests through the public engine APIs for new-life objective, two distinct investigation paths, three outcomes and their distinct playable next-life scenes.
- [ ] Run focused tests against the baseline and record the expected missing-feature failure.
- [ ] Implement authored scenes and actual choice consequences. Each essential branch remains reachable with normal starting resources; add an affordable fallback. NPC relationships/clues must change later options. Include seed-dependent finite side opportunities and path-specific approaches.
- [ ] Integrate short optional story combat with win/flee/death continuations. Keep cost/aging checks in a single transaction, and settle interrupted stories before life history is recorded.
- [ ] Add tests for save roundtrip mid-scene/mid-combat, old v1 states without new fields, corrupt v2 scene/flag/counter/world facts, and idempotent settlement.
- [ ] Implement strict migration and validators. Missing v2 fields must fail. Legacy current life stays story=null; next reincarnation opts into new content.
- [ ] Exercise legal routes for all three starting paths and origins where resource gates vary; verify no reward farming and no dead ends. Do not equate simulation with fun or measured duration.
- [ ] Run node --test tests/*.test.js, npm run check, npm run build; fix regressions. Record any environment-level npm proxy warning as such.
- [ ] Commit only Task 1 files and report TDD evidence, routes, outcomes, stable view schema and known limits.

## Task 2: Narrative-first desktop and mobile UI

**Files:**
- Modify: src/app.js, src/ui/styles.css.
- Create: src/ui/story.js if useful for the pure story markup; only named exports/imports.
- Modify: index.html only if necessary for accessible story announcements.
- Optional browser smoke harness under scripts/ or ignored test-results; do not add a runtime dependency.

**Interfaces:**
- Consumes engine.getStoryView(state), engine.chooseStory(state, choiceId) and all existing state actions.
- Produces primary scene rendering when adventure has story, retained event/combat/ending handling, safe encoded markup and visible repeatable access to journal/people/clues.
- Buttons use data-story-choice and existing delegated action routing; avoid writing narrative internals directly.

- [ ] Define browser checks: a new game displays main goal and named character; a choice displays lasting consequence; disabled costs cannot be selected; refresh preserves scene; chapter ending/rebirth shows correct successor story.
- [ ] Implement a readable narrative layout with chapter/location/goal, paragraphs, costs and reasons, stateful characters and clues. Display lastResult without relying on toast. Maintain existing app visual language.
- [ ] Place cultivation, rest, equipment and free exploration as supporting actions. Any interruption must provide a clear way back; preserve old-save experience with truthful migration guidance.
- [ ] Add story outcomes to life recap and explain what the next life inherits. Preserve accessible buttons, focus behavior, escaped player text, mobile hit targets and finite scrolling.
- [ ] Update setup and help copy to describe the actual narrative game. Keep the three-realm long goal accessible after the story.
- [ ] Run real browser checks at desktop and 390px width via available Playwright runtime; save evidence in ignored test-results. Check console errors, horizontal overflow, refresh and a complete ending/rebirth path.
- [ ] Run node --test tests/*.test.js, npm run check, npm run build.
- [ ] Commit Task 2 files and report screenshots, exact tested paths and limitations.

## Task 3: Release documentation and packaging verification

**Files:**
- Modify: README.md, docs/PRODUCT_SPEC.md, docs/ENGINE_CONTRACT.md, docs/QA_REPORT.md, docs/PROGRESS.md, package.json.
- Modify docs/DEPLOYMENT.md only with verified current deployment evidence.
- Add research note docs/research/2026-10-24-wending-reference-research.md from the approved report.

**Interfaces:**
- Consumes completed engine/UI, actual command and browser evidence.
- Produces versioned release notes and build artifacts, followed by controller publication.

- [ ] Update version to 1.1.0 and document new story, route/ending scope, v1 migration, existing-world continuity and actual limitations.
- [ ] Record passing test counts and browser checks with a clear separation from unmeasured human play time.
- [ ] Build static/offline/Worker artifacts and validate health/build metadata against the eventual published GitHub SHA.
- [ ] Commit documentation/package change; controller performs whole-branch review.
- [ ] Controller publishes feature branch/PR, checks current main before merging, and deploys the verified release to the already-authorized existing Worker.
- [ ] Controller verifies live health, current story UI, a choice and saved-session reload; record actual release/deployment IDs.

