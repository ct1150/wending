# RPG Title Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved title screen and safe switching between preserved journeys.

**Architecture:** Add read-only catalog/explicit activation to the native live archive, preserve displaced offline saves, and put a small title-screen/navigation layer above the existing app. Keep the story engine, backend protocol and release gateway intact.

**Tech Stack:** Existing native JavaScript/CSS, localStorage/sessionStorage, IndexedDB v2, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-title-screen-design.md`

## Global Constraints

- Exact primary labels: 踏入仙途 / 续写此生 / 游戏设置. Death restart: 再入轮回.
- New visits show the title screen; same-tab reload restores the current screen/draft.
- Title rendering, listing and selection must not create a life, reroll, advance time or submit inference.
- New live journeys preserve old live runs and offline saves; selection preserves pending/attempt identity and history.
- No gameplay duration, turn or save-count cap. Pagination limits only the rendered list.
- Retain native JavaScript, no new runtime dependencies, offline single-file build and all existing save readers.
- Frontend-only release: 4.2.0, existing GitHub release-channel/Cloudflare publication.

## Review Focus

- Existing alive live run with pending generation; new run and switching cannot lose its receipt/attempt.
- Stale tabs or stale creation forms; expected activity checks must reject an unintended switch.
- Storage denied/quota/corrupt catalog; preserve active and original save bytes and make recovery usable.
- Old offline character-creation/legacy handoff saves; home must read without creating or silently migrating.
- Reload during draft, settings or paused turn; recover exact UI location without another POST.

---

### Task 1: Preserved journey storage

**Files:** `src/game/live-archive.js`, `src/ui/live-session.js`, `src/ui/session.js`, new `src/game/journey-saves.js`; tests `tests/journey-library.test.js` and `tests/live-journeys.test.js`.

**Interfaces:**
- `bootstrapSession(storage,{createFresh:false})` returns an empty session with null state when no save exists, with no writes; default behavior remains compatible.
- `archive.listJourneys({cursor:null,limit:20})` returns `{entries,cursor}`, entries containing `archiveId,runId,state,active`; no history materialization and only committed/active runs.
- `archive.selectJourney(archiveId,expectedArchiveId)` atomically switches a retained run after validating active pointer; returns the selected loaded row.
- `session.startNew(options,expectedArchiveId)` explicitly creates independent birth while preserving the current live run; refuses stale or busy sessions; default `start` behavior remains compatible.
- `createJourneySaves(storage)` exposes `list()`, `preserve(session)`, `restore(id,currentSession)`. List returns snapshots `{id,state}`; preserve stores the exact offline state and legacy backup and de-duplicates an unchanged snapshot; restore preserves current first, validates the destination, then returns the restored bootstrap session. No active save replacement on failed preservation.

- [ ] Add failing behavior tests for two alive runs, pending/cached-reply restoration, stale selection, import-stage exclusion, no inference on select, null bootstrap, offline preservation and failure recovery.
- [ ] Implement the interfaces using existing validation and storage conventions.
- [ ] Run targeted native browser and unit tests; report exact commands/results.
- [ ] Review the diff for data loss/concurrency, then commit only task-owned files.

### Task 2: Title, navigation and settings integration

**Files:** `src/app.js`, new `src/ui/title-screen.js`, new `src/ui/navigation.js`, `src/ui/paper.css`, `src/ui/journey.js`, `index.html`, browser/controller test helpers and their affected navigation assertions.

**Interfaces:** Consume Task 1 storage operations. Pure title renderer accepts current journey summary, loading/error state and version. Navigation/preferences module validates stored UI state and settings; reload restores session UI while normal navigation starts at home.

- [ ] Add failing browser tests for fresh read-only title, visible primary entries, new live default, new A/B switching and pending identity, offline continue, cold-visit versus reload, settings controls and visible in-game navigation.
- [ ] Implement root screens `home`, `new`, `adventure`, `settings`, `saves`; route all menu and footer controls explicitly.
- [ ] Gate new-character commitment on preservation and a captured activity pointer. Keep draft until durable creation succeeds. Disable conflicting local switch/start during generation.
- [ ] Add paper title styles and accessible summary/list/settings markup; preserve keyboard dialog focus and 320px layout. Theme/font settings take effect without story changes.
- [ ] Update existing test helpers to explicitly enter their intended offline scenario, and native tests to use the new public controls, while retaining their original gameplay assertions.
- [ ] Run focused behavior tests and capture desktop/mobile/dark screenshots for visual inspection.

### Task 3: Review and publish

**Files:** `package.json`, `package-lock.json`, `README.md`, `docs/PROGRESS.md`, `docs/QA_REPORT.md`, release evidence.

- [ ] Bump to 4.2.0 and record what was actually verified.
- [ ] Run `npm run release` plus full native browser coverage. Inspect screenshots and fix concrete defects.
- [ ] Request an independent code review of the full feature and resolve material findings.
- [ ] Push feature branch through the authorized GitHub connection, create PR, observe exact-head validation; merge after checks pass.
- [ ] Observe main validation/publication and exact `release-channel` manifest; check production health and real served HTML, then perform title/new/save-switch/reload acceptance.
- [ ] Record deployment evidence and present live URL, PR and validation summary.
