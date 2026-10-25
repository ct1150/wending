# Implementation ledger

Plans: [first release](superpowers/plans/2026-10-24-first-release.md) · [1.1.0 narrative upgrade](superpowers/plans/2026-10-25-narrative-adventure.md)

Current documentation date: 2026-10-25 (Shanghai). The 1.1.0 branch is a local candidate; publication is recorded separately from implementation and CI. Earlier entries below are historical checkpoints.

- 2026-10-24: Approved conversation design captured in PRODUCT_SPEC; no additional design approval required because user explicitly requested implementation and deployment.
- Ruling: use native JS and static hosting — offline single-player requirements need no server or runtime dependency.
- Ruling: use new isolated project folder and feature branch — workspace has no existing code or repository.
- Ruling: engine and content may be implemented concurrently against a frozen contract in disjoint files — avoids shared mutation while saving time.
- Historical checkpoint (superseded): GitHub account ct1150 was verified, but the connector then exposed only weather-v2 and browser creation required sign-in. GitHub publication authentication was pending at that stage; later completion is recorded below.

- User steering: GitHub source -> Cloudflare hosting. Chosen Workers Static Assets; native Cloudflare GitHub integration is the recommended production path, with GitHub Actions retained for validation and optional deployment. GitHub Pages-specific deployment superseded.
- Parallel ownership: game_engine=engine/persistence/tests; game_content=content/tests; build_deploy=scripts/workflows/deploy docs; root=UI/integration/review/publication.

- Implementation delivered: 52 original events, 110 choices, 30 equipment items, 9 legacies, 6 realms, 3 paths, 3 proof challenges and a playable finale.
- Independent standards/spec reviews completed. Fixed mobile cultivation visibility, preview offline-download routing, legacy-condition copy, implausible generation counts, and missing past-life key logs.
- Balance review: tightened high-realm time budgets and final boss; legal prepared first-life victories exist for all three paths; starter-equipment burn-only rush fails for all three paths across three fixed seeds.
- Final local release verification: 5 test files pass (46 registered behavioral cases), 13 JavaScript files pass syntax check; self-contained offline HTML built at 185751 bytes.
- Browser verification: creation, event costs/rewards, equipment, reload, breakthrough success/failure, combat intent, proof reward, settlement, chosen legacy, reincarnation, historical details, JSON export/import and single-file execution passed. Mobile iframe has no horizontal overflow at 375 CSS px usable width. Browser-extension console errors were excluded; no game-source error was observed in the offline smoke test.
- Historical publication checkpoint (superseded for GitHub): both dashboards initially required sign-in. At that time no remote repository, workflow run or production URL existed.

## Historical GitHub upload checkpoint — 2026-10-24

- GitHub authorization completed and game source uploaded to [ct1150/wending](https://github.com/ct1150/wending), public repository, `main`.
- First game source commit: [`6698dbbca4b452466ad461070250c6ea7deeb87c`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c); tree `ea6040b9d180197af1b7503efc837a8d3be6070d` exactly matches the local source tree at upload, with all 30 remote blob SHAs compared individually.
- [GitHub Actions run 40050257913](https://github.com/ct1150/wending/actions/runs/40050257913) completed with `success`. [Validate job 120741133981](https://github.com/ct1150/wending/actions/runs/40050257913/job/120741133981) passed every step and generated [artifact 12541989829](https://github.com/ct1150/wending/actions/runs/40050257913/artifacts/12541989829).
- Remote CI logs confirm 46 tests / 46 passed / 0 failed, syntax checks for 13 JavaScript files, and a 185751-byte offline HTML. The uploaded compressed artifact is 184805 bytes.
- Deploy job was `skipped` because `ENABLE_CF_DEPLOY` is not enabled; this successful CI run did not publish a Cloudflare site.
- Historical state at the first GitHub upload: Cloudflare was unconnected and undeployed. Superseded by the MCP publication below.
- Original next step at that checkpoint: connect `ct1150/wending` / `main` in the intended Cloudflare account. Worker `baishi-wending`, repository root left blank, build `npm run release`, deploy `npx wrangler deploy`, Node 24 read automatically from `.node-version`. Keep the GitHub deployment switch disabled when using this native integration. See [deployment instructions](DEPLOYMENT.md).


## Historical first publication / current old-production checkpoint — 2026-10-24

- Cloudflare API MCP authenticated successfully. Native Git setup could not proceed: repository connection returned `404 / 8000008 Git account disconnected`, and no build tokens existed. That failure records the state observed during first publication, not proof that the GitHub App is still uninstalled. Current absence of Worker Builds configuration is recorded below.
- To deliver a working first release, the verified offline HTML was embedded in an ordinary Worker response. This mode counts toward Workers request allowances. The original Static Assets `wrangler.jsonc` is retained for future migration.
- Added `scripts/build-worker.js`, two Worker behavior tests and `build:worker`. CI runs it after the regular build with `SOURCE_COMMIT=github.sha`, preserving `release/worker.mjs` in its artifact. Source commit [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9); [CI 40053805256](https://github.com/ct1150/wending/actions/runs/40053805256) succeeded with 48 tests and 15 JavaScript syntax checks.
- Actual MCP deployment succeeded: Worker `baishi-wending`, tag `d4ceaa79ca7d4ca48954b1117458297f`, deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3`, 100% version `f9dd9fc8-df55-437e-8123-bbca3e119a59`, created `2026-10-24T02:21:43Z` (Shanghai 10:21:43). `workers.dev` enabled; previews disabled.
- Production URL: [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/). HTML SHA-256: `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`; expected health source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9`.
- Actual production browser verification passed: new character 云归 age 16; training reached age 19 / cultivation 13 / remaining life 81 / spirit 29; exploration showed 渡口最后一船 at age 21, and 帮他装船 produced age 22 / remaining life 78 / spirit 41. Reload restored state and logs.
- This executor's direct HTTP verification was network-limited, then returned a 403 non-game body via the approved network path; healthz was not JSON. Retrying stopped. This is a verification-path limitation, not evidence that the whole site is down; the production browser loaded and played successfully.
- Production browser healthz returned status ok, source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9` and the expected HTML hash. The actual in-game download was 185751 bytes with matching SHA-256 `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`. A 390px iframe loaded the real production URL at 375 CSS px usable width: html/body scrollWidth and clientWidth were all 375, with top cultivation progress and all five bottom navigation items visible.
- Public HEAD/404/405 have no independent live-response evidence; local Worker handler tests passed 2/2. Production GET, healthz, download and mobile checks have actual browser evidence.
- Final CI logs confirm 48 tests / 48 passed / 0 failed, 15 JavaScript syntax checks and a 189712-byte Worker. Artifact [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440) is 247611 bytes.


## Read-only publication reconciliation — 2026-10-24

- Observed GitHub main was `e719b569deeb5010d4977c799b434b60d640223a`, with [CI40054261258](https://github.com/ct1150/wending/actions/runs/40054261258) validate success and deploy skipped. This main commit did not replace the old production source `355f7956a4c31d9e3a19f1f567c4b1146942a5e9`.
- Worker API listed deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3` and version `f9dd9fc8-df55-437e-8123-bbca3e119a59`. Earlier docs mislabeled the version as a deployment; corrected here and in QA/DEPLOYMENT.
- Native Builds returned404/code12040 with no configuration, triggers or build history. No connection-mutating request was repeated; current GitHub App installation status cannot be inferred from the old8000008 failure.
- The accepted current release path remains GitHub review/CI → exact-source offline/Worker build → API update to the existing ordinary Worker. Static Assets and native automatic Builds are future migration work.

## Narrative adventure 1.1.0 candidate — 2026-10-25 (Shanghai)

- Approved direction: a continuous authored main story with finite random branches, meaningful choices and playable next-life consequences in one continuing world. Twenty-to-thirty minutes remains a design target without human timing evidence.
- Preserved approved pre-upgrade research in `docs/research/2026-10-24-wending-reference-research.md` and original authored story in `docs/story/valley-fire.md`. Provenance wrappers distinguish dated research/design costs from current implementation. The implementation plan now uses a portable source link.
- Task1 added separate native story data/runtime, strict v2 migration under the original storage key, three outcomes with distinct five-scene sequels, shared time/cost/death transactions, finite side opportunities and once-only settlement. Fix-round review added replayed side continuations, facts derived from retained trace/preceding snapshots, and successor wording at actual chronology. Engine fix re-review approved.
- Task2 added narrative-first desktop/mobile UI, persistent results/records, visible costs, interruption return paths, truthful old-life guidance and sequel-aware life recap. Real browser desktop/390px common-clinic → sequel, refresh/import/export, resource-gate, event/combat-flee and old-save paths passed. Initial UI review passed with observations for whole-branch review; the details/focus and mobile cultivation findings are now addressed in the final fix wave below.
- Task3 base `286314cfb1b29ebb8bd37f3945cabfdaa96cbd04`; only package/docs/source-artifact files changed, version1.1.0. Fresh individual test run80/80; required `npm run release` passed8/8 test files,20JS syntax checks,309314-byte offline build. npm unknown-http-proxy config warning is environmental.
- Final-candidate local offline SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`; 312059 bytes; release metadata version1.1.0. Real Chrome156 opened the rebuilt final file itself at390px, started a new game, chose enter_ask intoYG02 and refreshed with identical save/result; zero external runtime requests, failed requests or page/console errors. Full local evidence and limits are in QA_REPORT.
- Final whole-branch fix wave from `d1c19000225d88613d1add05744f6d54eae5485d`: corrected fatal deadline/settlement ordering without relaxing failed-trace validation; two accepted-save boundary regressions observed RED then GREEN. Restored ordinary/combat focus and supporting disclosure continuity, current/required mobile cultivation, neutral zero-relationship records and stable old-fire wording. New bounded browser checks passed36 transition/focus/visibility assertions plus strict-v1 restored keyboard actions; no errors/overflow. Final individual suite82/82, required release8/8 files,20JS checks and rebuilt offline smoke all passed. Evidence uses final-* filenames; npm environment warning remains unchanged.
- Pending controller gates: scoped final-fix re-review; publish exact source to GitHub and pass CI; rebuild Worker with that actual source SHA; update existing Worker via API; record live health/hash/deployment/version and new-story choice/reload evidence. No1.1.0 production success or future CI IDs are claimed by this candidate.
