# Single-save online game implementation plan

> **For agentic workers:** Follow the task boundaries below; root integrates and reviews the complete change. Steps use checkbox syntax for tracking.

**Goal:** Remove multi-save and offline gameplay, keeping one current online autosave.

**Architecture:** Keep the existing IndexedDB database and current-save pointer. Remove save enumeration/switching and the offline controller from the shipped application. Retain transactional creation, save backup/restore, history, reincarnation receipts, and cross-tab conflict checks. Ship a web bundle through the existing release-channel contract.

**Tech stack:** Browser ES modules, IndexedDB, Node.js 24 tests, Playwright, Cloudflare Workers, GitHub Actions.

**Spec:** User instruction: “去掉多存档，离线游戏等无用的功能，就一个存档”. This is a directly authorized simplification of the existing game; no new product choices or services are required.

## Global constraints

- Preserve the exact current online save on upgrade; never choose a different legacy journey by timestamp.
- New game explicitly replaces the current save after successful local transaction. Cancelling character creation leaves current progress intact.
- Keep birth/pending persistence before HTTP so refresh does not reroll or duplicate generation.
- Preserve underlying legacy bytes and reincarnation receipts; inaccessible historical records are compatibility data, not save slots.
- No offline game creation, fixed-story continuation, mode selection, save list, or save switching in the application.
- Keep one-save backup/restore and reading preferences; no new account or cloud-save system.
- Keep model/provider, free-plan boundary, domain, and production storage identities unchanged.
- Preserve the seven-field schemaVersion 1 remote release manifest and releases/<sha256>.html path.

## Review focus

- Reload with old offline/saves navigation must enter a valid online screen and leave stored bytes intact.
- Creation cancelled or transaction rejected must preserve the current save.
- A stale tab or late response must not overwrite a replacement save.
- Dead-save continuation must retain settlement until explicit new game or reincarnation.
- Deployed old download route must actually retire; publishing HTML alone cannot change Worker routes.

### Task 1: Single current save

Files: src/game/live-archive.js, src/ui/live-session.js, tests/live-journeys.test.js and relevant session tests.

- [x] Replace multi-save tests with current-save preservation, explicit replacement, dead-save continuation, and conflict recovery tests; observe expected failures.
- [x] Remove listJourneys/selectJourney APIs and make ordinary start preserve any existing current save.
- [x] Preserve transactional create/import/reincarnate and all compare-and-swap checks; run focused storage/session tests.

### Task 2: Online application and menus

Files: src/app.js, src/ui/navigation.js, src/ui/title-screen.js, src/ui/character.js, index.html, current UI tests.

- [x] Add behavioral regressions for absent save/offline controls, replacement/cancel, old navigation, current-save reload, and backup restore.
- [x] Delete offline controller, mode and catalogue branches; retain online story, history, character, reincarnation, keyboard and cinematic scene behavior.
- [x] Keep backup/restore restricted to the current live format; clearly confirm replacement and retain old-format bytes without offline play.
- [x] Retire tests exclusively asserting removed UI; preserve engine, serialization and migration tests that still protect compatibility.
- [x] Run online browser tests, including narrow viewport and reload flows.

### Task 3: Web-only release

Files: build/publish/dev scripts, release-gateway.js, CI labels, release/build tests.

- [x] Test that the offline file is no longer produced and the retired route returns 410 without a download or network refresh.
- [x] Rename local bundle to baishi-wending-web.html and metadata to frontend; update consumers atomically.
- [x] Preserve the remote publication contract, content integrity and backend packaging behavior.
- [x] Run targeted build, publish, gateway and backend regressions.

### Task 4: Integrate and publish

- [x] Update version to 5.4.0 and current README/CONTEXT/deployment guidance.
- [x] Run npm run release, inspect diff, and obtain an independent whole-change review.
- [ ] Commit through GitHub, inspect exact-head CI, merge and verify main publication.
- [ ] Inspect current production identity; deploy only the compatible production Worker preserving existing bindings and provider.
- [ ] Verify production health/version, homepage, retired download endpoint, and single-save browser behavior.

## Integration ruling

During verification main advanced to `26f7789` (RAG 5.3.0). Preserve that entire change and release this simplification as 5.4.0. Only README required manual conflict resolution; retain the RAG status and boundaries while removing obsolete offline/save-list product claims. Current production RAG activation and original-text storage approvals remain outside this task.

The integrated frontend always includes optional retrieval context, which the deployed 5.1.1 reader rejects as REQUEST_INVALID. A direct old/new API probe confirmed the failure before any budget reservation or provider call. Deploy the complete compatible 5.4.0 backend using the exact original production policy; do not deploy the disabled CI package or preserve incompatible old validators. The model registry, budget implementation and original production configuration remain unchanged. Do not add a knowledge policy or KV binding, upload source text, or enable RAG. The current production composition without knowledge accepts both context formats and performs zero knowledge-store reads.
