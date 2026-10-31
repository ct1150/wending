# Cinematic Wuxia Title Implementation Plan

> **For agentic workers:** Use the scoped tasks below; root owns integration and release.

**Goal:** Deliver and publish an original cinematic dynamic homepage in the existing wending game.

**Architecture:** Semantic static menu over compressed artwork; optional WebGL/canvas scene is mounted and disposed by the app. CSS assets are embedded by the existing offline build, preserving the gateway pipeline.

**Tech Stack:** Existing native ES modules, HTML/CSS, WebGL, Canvas 2D, optional Web Audio, Node test runner and existing Playwright regressions.

**Spec:** `docs/superpowers/specs/2026-10-31-cinematic-title-design.md`

## Global constraints

Existing actions and save behavior remain compatible. Self-contained HTML below 3,000,000 bytes. No runtime dependencies. Reduced motion, graceful graphics fallback, page visibility pause, scene disposal. Three primary actions fit 320/390/1280 × 740. No home story requests.

## Review focus

- Boot re-render and repeated home navigation release all RAF, graphics and audio resources.
- Failed WebGL/canvas/audio/storage access leaves a fully usable menu.
- Reduced-motion and hidden-tab states halt continuous rendering.
- Artwork/font render in deployed and file:// offline HTML without external fetches.
- Long saved names, narrow screens and keyboard focus remain readable and reachable.

## Tasks

- [x] Create and optimize original cinematic landscape and record asset provenance.
- [x] Implement isolated `mountTitleScene(root)` returning an idempotent cleanup function. Use `[data-title-fog]`, `[data-title-particles]`, `[data-title-motion]`, `[data-title-sound]`; expose motion state through root `data-motion`, runtime state through `data-scene-running`, renderer through `data-scene-renderer`, and pointer coordinates as `--scene-x` / `--scene-y`. Add meaningful lifecycle/fallback tests.
- [x] Implement responsive title markup and styles with preserved data actions. Integrate mount/dispose into app rendering and include the new stylesheet in index.html. Inspect desktop/mobile screenshots.
- [x] Run existing title/navigation/version/offline regressions and new scene tests, then required `npm run release`. Verify bytes and embedded asset behavior. Fix observed issues.
- [ ] Review changes independently. Bump release to 5.1.0, document validation, push feature branch through GitHub, merge passing PR and verify the existing custom domain serves the new release.

## Execution record

- Repository baseline: `aa758e1`, version 4.5.1. Dedicated clone and `feat/cinematic-wuxia-title` branch.
- Ruling: user requested implementation, and prior session authorizes continuing changes and release; routine design choices are made autonomously and documented here.
- Ruling: runtime effects are a bounded parallel implementation; root owns HTML/CSS, app integration and publishing. Existing regression suite is retained rather than adding tests that mirror cosmetic markup.
- Integration: main advanced to `f7633ac` / 5.0.0 (v7 cultivation engine) during implementation. Preserved its full changes and resolved only release-version conflicts to 5.1.0; all verification will run on the combined result.
- Final candidate: 1102/1102 tests, 202 syntax checks, 1,622,703-byte offline HTML. Independent code/layout review and the subsequent shared-fixture reduced-motion review found no material issues. All implementation and review work is complete; publication identity is recorded in the release PR after CI and production verification.
- Concurrent maintenance: integrated main `e9c6e0a` / 5.0.1 native schema compatibility fix before publication; retained both historical documentation sections and 5.1.0 package version. The combined tree is revalidated before release.
