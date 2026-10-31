# Cinematic Game Interface Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to carry the existing user instruction through implementation, review and release. Independent browser verification is delegated.

**Goal:** Carry the homepage visual style into every game surface while preserving reading, streaming and saved journeys.

**Architecture:** Shared backdrop/control markup and CSS image variables; a persistent `#game-scene` sibling to `#app`; a final `game.css` layer for all game surfaces and overlays. Existing renderers, commands and save formats remain authoritative.

**Tech Stack:** Native JavaScript, CSS, existing WebGL/Canvas renderer, Node tests and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-31-cinematic-game-design.md`

## Global Constraints

- Preserve streaming DOM identity and draft/final visual geometry.
- Preserve stored light/dark/system and text-size preferences.
- Reuse embedded artwork once; offline artifact < 3,000,000 bytes.
- Preserve existing pause, reduced motion, native dialog and save contracts.
- Keep concurrent engine changes intact and preserve production AI bindings.

## Review Focus

- Repeated render/stream notifications must not restart background graphics or audio.
- Returning home must release detached game canvases and never leave two active scenes.
- Drawers, text inputs and pending/disabled choices remain legible in every reading theme.
- Sticky character information and 320px portrait screens must not clip content or create horizontal scrolling.
- Cloudflare health must report the new version actually served; a GitHub static publication alone is insufficient evidence.

## Task 1: Shared scene and reading theme

- [x] Write and run meaningful browser checks for persistent scene lifetime and default theme.
- [x] Extract shared world/control markup in `src/ui/title-screen.js`; add `renderGameScene`.
- [x] Add `#game-scene` in `index.html` and synchronize its lifetime in `src/app.js` without touching story updates.
- [x] Add the cinematic reading preference to `src/ui/navigation.js`; retain previous values.
- [x] Verify existing navigation/scene/streaming tests and new checks.

## Task 2: All game surfaces

- [x] Share artwork variables from `src/ui/title.css`; create `src/ui/game.css` after the existing stylesheets.
- [x] Style persistent backdrop, reading panel, sticky identity, choices, creation, settings, saved journeys, dialogs, notices, custom actions and endings.
- [x] Inspect desktop and mobile screenshots, light/dark reading, reduced motion, large text, overflow and meaningful contrast.
- [x] Keep final and draft choices identical in geometry and typography.

## Task 3: Review and release

- [x] Update package version and concise progress/QA notes using the current main version as the base.
- [x] Run the complete existing release checks and build, plus independent code review.
- [ ] Push a feature branch via GitHub, pass CI, refresh main and merge the reviewed change.
- [ ] Build and publish the exact production artifact with the original bindings/configuration intact.
- [ ] Verify custom-domain health, rendered frontend version and story availability; record evidence.

## Execution record

- Fresh isolated checkout on `feat/cinematic-game-interface`, based on main `e3ee6c2` (5.1.0).
- Initial unrestricted-concurrency baseline could not complete in the sandbox. Run browser tests with the installed Chromium executable and controlled concurrency; GitHub CI uses the project's pinned browser.
- Design details are implementation judgments under the user's explicit request to match the existing homepage; no new product decisions require confirmation.

- Integrated main `dc1e937` (5.1.1 / PR #23) before final validation; the only stash conflicts were package versions, resolved to 5.2.0 with upstream dependencies unchanged.
- Independent review found legacy result headings could scroll behind the fixed masthead. Added a native-browser regression, observed failure, then included all existing focus targets in the new scroll offset; targeted regression passed.
- First complete run on the older base: 1108/1109 passed; one visual-test sampling failure had no visible pixels because Playwright left the select underneath a fixed bar. The test now centers its measurement target, while a separate regression verifies production focus visibility.

### Completed implementation and review — 2026-10-31

- Shared backdrop/control markup, one-time embedded artwork variables and the persistent game scene are implemented. Creation, live/offline stories, choices, custom actions, settings, saved journeys, character/history drawers, notices and ending/legacy surfaces use the same cinematic design. New readers default to `cinematic`; existing light/dark/system and text-size preferences remain valid.
- `tests/game-visual.test.js` contains seven native-browser checks: persistent scene identity through creation/navigation/story redraws; shared pause and disposal on returning home; system reduced-motion changes; 320/390/1440px legibility and overflow; cinematic default; previous reading preferences; and legacy feedback focus below the fixed masthead. Real Noto CJK fonts were installed before the final visual and browser checks. The independent seven-case rerun passed 7/7 with no skips in 35.34 seconds.
- The Important legacy-heading issue was reproduced before the CSS correction: at 320×844, the focused result heading began at 20.796875px while the masthead ended at 66px. The regression now checks retained focus, heading geometry and the actual center-point hit target. It passes after the scroll-offset fix and in the final full suite.
- Contrast sampling measures rendered backgrounds, including artwork/translucent surfaces, with a 4.5:1 threshold. The helper centers its sample and excludes unrelated overlapping elements; it does not change production focus placement. The early screenshot/visibility false positives were diagnosed, not suppressed by weaker assertions.
- Real Chinese screenshots cover desktop/mobile creation and story, desktop character details, mobile history/settings/custom actions and desktop light reading. See the [browser record](../../evidence/cinematic-game-5.2.0/browser.json) and the linked screenshot inventory in [QA](../../QA_REPORT.md). They use local deterministic story fixtures and reduced motion; they are not production or physical-device evidence.

### Final candidate gate — 5.2.0 on main `dc1e937`

- Complete `npm run release`: **1,143/1,143 passed**, zero failed/cancelled/skipped/todo; test duration **168,810.868082ms**. The seven new checks and existing streaming/scene/legacy regressions are included in that single final run.
- JavaScript syntax checks: **204 files passed**. Offline HTML: **1,644,315 bytes**, below 3,000,000 bytes; SHA-256 `bf70a11f29d9d4b41c489de61ab765a39f86a7959d0fd1fa6b1685db91932993`; build time `2026-10-31T00:43:13.168Z`.
- Raw local log: `/tmp/wending-5.2.0-release-final.log`. Progress and QA retain all previous release history and distinguish this candidate from a deployed artifact.
- Browser integration uses locally intercepted AI and native Canvas fallback; existing scene tests retain WebGL lifecycle coverage. No fresh real-model success, physical-phone frame rate/battery claim, comprehensive mobile-browser/native-IME/screen-reader acceptance or production availability is inferred from these fixtures and screenshots.
- **Publication remains pending.** The three unchecked release steps above still require the actual PR/CI, reviewed merge, exact production publication and public-domain verification. Record the final source/CI/deployment identity and observed production behavior in the release PR after those actions occur; preserve original production bindings and configuration.
