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

- [ ] Deploy the tested protected composition while retaining existing namespaces and ledger.
- [ ] Run real browser opening, distinct choice generation, save and refresh; verify saved revision/scene and no duplicate inference.
- [ ] Exercise existing long-run/archive/failure tests and review actual narrative samples.
- [ ] Promote the verified model and enable the explicit production policy; remove tester-only prerequisites from public production composition.

### Task 4: Review, merge, deploy and verify

- [ ] Run `npm run release`, production packaging and independent review; fix material findings.
- [ ] Update ROADMAP, QA and deployment records to current evidence, preserving clearly labeled historical outcomes.
- [ ] Push the reviewed PR branch, observe current GitHub checks, merge PR #14 and verify main publication.
- [ ] Deploy the final production backend and verify public capabilities, health, serving identity and a fresh browser generation/save/refresh.

## Execution rulings

- Existing approved architecture and latest direct completion/deployment request provide the execution scope; no new design interview or deployment confirmation is needed.
- Historical finite test budgets and stop rules are superseded, not silently carried into the new execution.
- The source clone is isolated in the session workspace on the existing PR branch; main is not edited directly.

## Implementation checkpoint

- Actual provider diagnostics identified unsupported lookaround and ignored union-sibling constraints. Complete closed alternatives and typed current-turn references now compile; existing known IDs retain exact identities.
- Selected `@cf/qwen/qwen3.8-27b` after the older candidate and two alternatives failed semantic/latency checks. A real opening and two mechanically distinct continuations passed the unchanged runtime; the final request builder reproduces the two exact observed continuation inputs. These direct diagnostics do not replace browser acceptance.
- The provider uses the documented strict named schema envelope and explicit non-thinking setting. Both returned reasoning aliases are independently checked. Context input is 24 KiB, provider timeout 60 s, browser/API timeout 75 s, active lease 90 s.
- Production and experiment defaults have no artificial call, session-count, or reserved-Neuron ceilings. Actual provider quota errors, credentials, one active request per session and historical accounting remain enforced.
- Independent reviews fixed successful-retry baseline hashing and the ignored reasoning alias; focused configuration/operator/package coverage passed 165 tests, budget/API coverage passed 67 tests, provider/schema coverage passed 33 tests. Full release and public acceptance remain pending below.
