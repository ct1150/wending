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

## Current publication checkpoint — 2026-10-24

- GitHub authorization completed and game source uploaded to [ct1150/wending](https://github.com/ct1150/wending), public repository, `main`.
- First game source commit: [`6698dbbca4b452466ad461070250c6ea7deeb87c`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c); tree `ea6040b9d180197af1b7503efc837a8d3be6070d` exactly matches the local source tree at upload, with all 30 remote blob SHAs compared individually.
- [GitHub Actions run 40050257913](https://github.com/ct1150/wending/actions/runs/40050257913) completed with `success`. [Validate job 120741133981](https://github.com/ct1150/wending/actions/runs/40050257913/job/120741133981) passed every step and generated [artifact 12541989829](https://github.com/ct1150/wending/actions/runs/40050257913/artifacts/12541989829).
- Remote CI logs confirm 46 tests / 46 passed / 0 failed, syntax checks for 13 JavaScript files, and a 185751-byte offline HTML. The uploaded compressed artifact is 184805 bytes.
- Deploy job was `skipped` because `ENABLE_CF_DEPLOY` is not enabled; this successful CI run did not publish a Cloudflare site.
- Cloudflare remains unconnected and undeployed; there is no production game URL.
- Next: connect `ct1150/wending` / `main` in the intended Cloudflare account. Worker `baishi-wending`, repository root left blank, build `npm run release`, deploy `npx wrangler deploy`, Node 24 read automatically from `.node-version`. Keep the GitHub deployment switch disabled when using this native integration. See [deployment instructions](DEPLOYMENT.md).
