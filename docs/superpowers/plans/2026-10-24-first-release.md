# 百世问鼎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the planned playable reincarnation game, planning documents and a verified GitHub-to-Cloudflare deployment when account access permits.

**Architecture:** A pure deterministic game engine consumes static content tables. Browser UI calls the engine through one public boundary, persists a versioned save, and renders responsive panels. Static build supports project-relative paths and a single-file offline export.

**Tech Stack:** Browser-native JavaScript ES modules, HTML, CSS, Node.js 24 built-in test runner and build scripts, GitHub Actions / Cloudflare Workers Static Assets.

**Spec:** docs/PRODUCT_SPEC.md. Shared interface: docs/ENGINE_CONTRACT.md.

## Global Constraints

- User selected GitHub source and Cloudflare hosting; do not alter weather-v2.
- No runtime dependency, remote API, external fonts, trackers, or credential in source.
- Engine and content IDs/properties follow ENGINE_CONTRACT verbatim.
- Complete three-world progression and a final victory, not placeholder buttons.
- Maximum two carried legacies and two life-extension elixirs per life.
- Full save validation and deterministic random state.
- Mobile layout usable at 360 CSS px; visible focus and reduced-motion support.
- GitHub publication requires actual success evidence, not only a workflow file.

## Review Focus

1. Expiring during breakthrough must not gain extra life after death.
2. Unaffordable or forged event selection must not mutate state or duplicate rewards.
3. Save imports with invalid phase/content IDs must be rejected without replacing valid data.
4. Reincarnation must preserve earned world effects but reset finite resources and item levels.
5. GitHub project subdirectory and offline export must load without absolute asset paths.

## Task 1: Content and causal event chains

Files: src/game/content.js, tests/content.test.js. Consumes/produces structures from ENGINE_CONTRACT.

- [x] Write data-integrity behavior test for IDs, choices, valid item references, world flags and always-available exit.
- [x] Implement three paths, origins, six realms, items, legacies, at least45 events, world bosses and finale.
- [x] Test `node --test tests/content.test.js`; ensure every cross-life flag has a follow-up.
- [x] Review story readability and costs against the spec.

## Task 2: Deterministic life, combat and reincarnation engine

Files: src/game/engine.js, src/game/persistence.js, tests/engine.test.js.

- [x] Begin with a failing public-behavior test: a three-year training action advances age16 to19 and year1000 to1003.
- [x] Implement one behavior at a time through createGame/act/getStats, then events, combat, equipment, settlement and reincarnation.
- [x] Test life exhaustion before breakthrough, two-elixir cap, burn-time separation, hidden requirements and illegal action rejection.
- [x] Test earned legacy choice, max two carry slots, retained proofs/world/history and full character reset.
- [x] Test deterministic replay and round-trip serialization; reject bad schemas and invalid active IDs.
- [x] Simulate a legitimate path through all three proofs and final victory.

## Task 3: Mobile-first playable interface

Files: index.html, src/app.js, src/ui/styles.css, assets/*.svg.

- [x] Render original dark ink/jade visual direction, responsive sidebar/topbar and mobile tabs.
- [x] Connect setup, adventure, event choice, combat, inventory, three-world map, legacies and chronicle.
- [x] Show known costs, invalid-action reasons, enemy intent, result notifications and explicit end-of-life choices.
- [x] Add local autosave, import/export, clear-save confirmation, contextual guide and accessible dialogs.
- [x] Verify UI actions in the supported browser preview; inspect mobile layout and browser errors.

## Task 4: Build, release and GitHub deployment

Files: scripts/build.js, scripts/dev.js, package.json, .github/workflows/ci.yml and cloudflare.yml, README.md, docs/DEPLOYMENT.md.

- [x] Build dist with relative assets, release metadata and no development secrets.
- [x] Generate a self-contained offline HTML and source archive.
- [x] Check normal and offline resource references and execute final test suite.
- [x] Review finished code independently; resolve material findings.
- [x] Commit source/docs/tests locally.
- [ ] Create independent GitHub repository after account authorization; configure Cloudflare deployment with Actions; push source and watch deployment.
- [ ] Verify actual deployment URL and game startup. If authentication blocks only publication, finish all code, documents, tests and packages before secure user handoff.

## Release checkpoint — 2026-10-24

Implementation, independent review fixes, browser verification and final release build are complete. GitHub repository creation and Cloudflare publication are blocked on authenticated account access, not source readiness. See docs/QA_REPORT.md for evidence.
