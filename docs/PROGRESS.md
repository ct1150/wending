# Implementation ledger

Plan: docs/superpowers/plans/2026-10-24-first-release.md

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


## Current Cloudflare publication checkpoint — 2026-10-24

- Cloudflare API MCP authenticated successfully. Native Git setup could not proceed: repository connection returned `404 / 8000008 Git account disconnected`, and no build tokens existed. The Cloudflare GitHub App remains unauthorized; GitHub push-to-Cloudflare deployment is not connected.
- To deliver a working first release, the verified offline HTML was embedded in an ordinary Worker response. This mode counts toward Workers request allowances. The original Static Assets `wrangler.jsonc` is retained for future migration.
- Added `scripts/build-worker.js`, two Worker behavior tests and `build:worker`. CI runs it after the regular build with `SOURCE_COMMIT=github.sha`, preserving `release/worker.mjs` in its artifact. Source commit [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9); [CI 40053805256](https://github.com/ct1150/wending/actions/runs/40053805256) succeeded with 48 tests and 15 JavaScript syntax checks.
- Actual MCP deployment succeeded: Worker `baishi-wending`, tag `d4ceaa79ca7d4ca48954b1117458297f`, deployment `f9dd9fc8df55437e8123bbca3e119a59`, created `2026-10-24T02:21:43Z` (Shanghai 10:21:43). `workers.dev` enabled; previews disabled.
- Production URL: [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/). HTML SHA-256: `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`; expected health source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9`.
- Actual production browser verification passed: new character 云归 age 16; training reached age 19 / cultivation 13 / remaining life 81 / spirit 29; exploration showed 渡口最后一船 at age 21, and 帮他装船 produced age 22 / remaining life 78 / spirit 41. Reload restored state and logs.
- This executor's direct HTTP verification was network-limited, then returned a 403 non-game body via the approved network path; healthz was not JSON. Retrying stopped. This is a verification-path limitation, not evidence that the whole site is down; the production browser loaded and played successfully.
- Production browser healthz returned status ok, source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9` and the expected HTML hash. The actual in-game download was 185751 bytes with matching SHA-256 `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`. A 390px iframe loaded the real production URL at 375 CSS px usable width: html/body scrollWidth and clientWidth were all 375, with top cultivation progress and all five bottom navigation items visible.
- Public HEAD/404/405 have no independent live-response evidence; local Worker handler tests passed 2/2. Production GET, healthz, download and mobile checks have actual browser evidence.
- Final CI logs confirm 48 tests / 48 passed / 0 failed, 15 JavaScript syntax checks and a 189712-byte Worker. Artifact [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440) is 247611 bytes.
