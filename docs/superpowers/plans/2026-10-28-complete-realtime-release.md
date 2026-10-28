# Complete realtime release implementation plan

> For agentic workers: use the execution, TDD, review and verification workflows. The owner's current request authorizes completing existing TODOs, testing and deploying without artificial attempt or Neuron ceilings.

**Goal:** Finish the remaining realtime-story acceptance and publish the working game at the existing Cloudflare address.

**Architecture:** Preserve the V5/CV4 rule engine, local IndexedDB archives, same-origin Workers AI API and existing Durable Object namespaces. Diagnose actual provider failures, fix acceptance bookkeeping, then promote only a verified provider profile.

**Tech stack:** Native JavaScript, Node 24, node:test, Playwright, Cloudflare Workers AI and SQLite Durable Objects.

**Spec:** `docs/superpowers/specs/2026-10-27-realtime-workers-ai-design.md`, `docs/ROADMAP.md`, and the owner's latest instruction on 2026-10-28.

## Global constraints

- Latest instruction supersedes all earlier 12/900, per-task count ceilings and stop-after-one-failure rules. No arbitrary replacement ceilings.
- Keep the confirmed Workers Free plan, direct AI binding and no paid fallback. Actual platform quota remains a platform constraint.
- Preserve existing saves, namespace IDs, historical ledger rows/results and unknown reservations. Never relabel failed/unknown calls as successes.
- Use measured real generation and actual browser interactions for acceptance. Fixtures remain identified as fixtures.
- Maintain strict application-side scene validation, identity, idempotency and mechanical rule authority.

## Review focus

- Earlier unknown opening must not permanently prevent a separately attested successful opening; it stays unchanged in history.
- Explicit new acceptance attempts must be possible after a terminal failure without erasing the failed attempt or duplicating a successful one.
- Provider schemas must compile on the actual provider while the runtime rejects unsafe or inconsistent generated content.
- Refresh must recover the saved successful scene without issuing another generation or applying a choice twice.
- Deployment must preserve compatible archives and existing storage and report the actual serving source.

### Task 1: Remove obsolete experiment ceilings and historical dead ends

Files: `src/worker/story-config.js`, `operator-task8.js`, `operator-baseline.js`, `operator-story.js` and their focused tests.

- [x] Add regressions for exceeding the former attempt/task/Neuron totals while preserving every historical record and requiring verified Free configuration.
- [x] Make experiment history uncapped; separate history accounting from actual provider quota. Keep request sizing, authentication, strict data checks and active-request deduplication; default production count and reservation ceilings are also removed.
- [x] Permit a new attested accepted opening after historical unknown/failed openings, without altering those records.
- [x] Permit explicit new branch acceptance attempts after failure; preserve old results and make replay idempotent.
- [x] Run focused tests and record the red/green results.

### Task 2: Repair actual provider generation

Files: `src/worker/story-generation-schema.js`, `story-provider-core.js`, relevant provider tests and real evidence.

- [x] Reproduce the complete current provider request and retain the actual upstream error privately.
- [x] Compare a single relevant schema/request change against the failed request.
- [x] Add a focused regression for the proven root cause, implement the smallest fix and verify runtime validation remains strict.
- [x] Obtain real Chinese opening and mechanically distinct continuations; review choice consequences, references, relationships and narrative continuity.

### Task 3: Complete browser acceptance and production composition

Files: production profile/config, existing backend builder, acceptance evidence and version metadata as required.

- [x] Deploy the protected `47c4064` composition while retaining existing namespaces and ledger; stage5/stage6 module readback is archived.
- [x] Observe actual protected browser opening and choice ready, with revision 2 saved; independently restart that profile, export and refresh with 12 checks passed and 0 new API calls. The original generation driver POST-count assertion remains FAILED and is not relabeled.
- [x] Exercise existing long-run/archive/failure tests and review actual narrative samples. The 1000-turn native archive and actual-death cases pass; the sole full-run failure was an isolated stage-fixture configuration dependency, corrected and verified 8/8 before the final CI gate.
- [x] Promote the verified Qwen 3.8 profile and enable the checked-in explicit production policy using the passing current-source A/B2 evidence. Public production composition excludes tester modules; actual public deployment remains Task 4.

### Task 4: Review, merge, deploy and verify

- [ ] Run `npm run release`, production packaging and independent review; fix material findings.
- [x] Update ROADMAP, QA and deployment instructions with current evidence and preserved failures. Exact post-merge deployment and public-browser results are appended to the [PR #14 release execution record](https://github.com/ct1150/wending/pull/14) after they occur.
- [ ] Push the reviewed PR branch, observe current GitHub checks, merge PR #14 and verify main publication.
- [ ] Deploy the final production backend and verify public capabilities, health, serving identity and a fresh browser generation/save/refresh.

## Execution rulings

- Existing approved architecture and latest direct completion/deployment request provide the execution scope; no new design interview or deployment confirmation is needed.
- Historical finite test budgets and stop rules are superseded, not silently carried into the new execution.
- The source clone is isolated in the session workspace on the existing PR branch; main is not edited directly.

## Implementation checkpoint

- Actual provider diagnostics identified unsupported lookaround and ignored union-sibling constraints. Complete closed alternatives and typed current-turn references now compile; existing known IDs retain exact identities.
- Selected `@cf/qwen/qwen3.8-27b` after the older candidate and two alternatives failed semantic/latency checks. A real opening and two mechanically distinct continuations passed the unchanged runtime; the final request builder reproduces the two exact observed continuation inputs. These direct diagnostics do not replace browser acceptance.
- The provider uses the documented strict named schema envelope and explicit non-thinking setting. Both returned reasoning aliases are independently checked. Context input is 24 KiB, provider timeout 90 s, browser/API timeout 105 s, active lease 120 s. These values cover actual valid model responses of 58.852 s and 67.977 s without automatic retries.
- Production and experiment defaults have no artificial call, session-count, or reserved-Neuron ceilings. Actual provider quota errors, credentials, one active request per session and historical accounting remain enforced.
- Independent reviews fixed successful-retry baseline hashing and the ignored reasoning alias; focused configuration/operator/package coverage passed 165 tests, budget/API coverage passed 67 tests, provider/schema coverage passed 33 tests. Full release and public acceptance remain pending below.

## Verified runtime checkpoint before production

- Runtime source `b519bf4fd730133a852b3b6e6d1f5aab90144220` has passing [CI](https://github.com/ct1150/wending/actions/runs/40730466541). Release metadata, checked-in evidence and production promotion are subsequent changes and require their own final gate.
- Current provider inputs exactly reproduce the real `7613dc7` A/B2 request hashes. Captured responses pass the current provider parser, stricter choice guards, canonical commits and all six compiled choices; independent narrative review found no material blockers. Offline replay makes no new model call and is not a native browser run.
- The original B1 continuation and the earlier unsupported purchase choice remain failed narrative evidence. Current guards reject those examples while preserving response accounting.
- The actual `47c4064` opening/choice snapshots and separately passing native restart/export/refresh report establish functional browser persistence; the source distinction is explicit in `docs/evidence/realtime-release-2026-10-28.json`.
- Final complete release, explicit production package review, merge, main publication, production upload/readback and fresh public browser acceptance are closed by their actual results in PR #14. No future deployment is claimed by this checkpoint.
