# Remaining Real-Time Completion Implementation Plan

> **For agentic workers:** Use the existing parallel implementation/review workflow. Keep file ownership explicit; the root integrates shared API changes and runs the complete release gate.

**Goal:** Complete all current implementation work and deliver real model/browser acceptance and compatible production release under the confirmed numerical allocation once every actual acceptance gate passes.

**Architecture:** Preserve strict domain/runtime contracts, add generation-side constraints and atomically persisted private observations, complete request/UI robustness, and prepare an explicit validated production composition.

**Tech Stack:** Existing JavaScript ESM, Node test runner, native Chromium/IndexedDB, Cloudflare Workers/SQLite Durable Objects and GitHub CI.

**Spec:** `docs/superpowers/specs/2026-10-28-remaining-completion-design.md`

## Global constraints

- Preserve the original8 calls/450 reserved Neurons, all failed rows/results/cases and existing namespaces.
- The user explicitly confirmed the reviewed12/900 proposal on2026-10-28: Task1/7/8 caps4/5/3, at most four further calls, stop on first failure. Preserve original8/450 and all history; this supersedes only the prior numerical11/800,4/5/2 authorization.
- Keep public inference disabled and the real production profile unvalidated until live acceptance passes.
- Preserve strict scene validation, public API envelopes, V5/IndexedDBv2 reads and request/attempt lineage.
- No paid upgrade, Gateway credits, paid fallback, response substitution or automatic model retry.
- Browser fixtures and native tests are not real inference evidence.

## Review focus

- A never-ending request stream or hanging cancellation must not hold the API forever or reserve an inference.
- Async redraw during modal use must preserve the user's active focus and return target.
- Legacy terminal results must not become invalid, gain invented diagnostics, or change reservations.
- Untrusted provider content must not become diagnostic text, model permission or public response metadata.
- A production build must not accept a candidate profile or bypass account/Free/version gates through a build argument.

## Task A: Bounded request-body reading (M1)

**Files:** Create `src/worker/story-request-body.js`, `tests/story-request-body.test.js`; root integrates `src/worker/story-api.js`.

**Interface:** `readStoryJson(request,{timeoutMs=10000}={}) -> Promise<plain JSON>`; fixed typed errors with HTTP status, content and byte limits unchanged. Trusted tests may choose a shorter positive timeout, capped at10000ms.

- [x] Add failing tests for never-resolving read, slow chunks crossing one absolute deadline, pre/mid abort, hanging cancel, exact byte boundary, invalid UTF-8 and a valid request before deadline.
- [x] Implement bounded read/cancel/timer cleanup; do not await an unbounded cancel operation.
- [x] Integrate into actual API and assert aborted/deadline requests invoke no provider, create no session and reserve no turn.
- [x] Run `node --test tests/story-request-body.test.js tests/story-api.test.js`; review and integrate. Initial 58/58; after observation integration, independent 63/63 including the real ten-second API deadline.

## Task B: Async focus recovery (M2)

**Files:** Modify `src/app.js`, `tests/live-app.test.js` (small helper file only if useful).

**Interface:** Existing render/onChange and modal APIs retain behavior; focus capture resolves semantic controls in the current DOM, with scene-heading fallback for a disappeared choice.

- [x] Reproduce focus loss with delayed local API fixtures in native Chromium.
- [x] Restore the equivalent stable control, preserve modal focus, and resolve dialog return targets after redraw.
- [x] Verify response arrival during controls/modal use and disappearance of a choice without altering state or calls.
- [x] Run `WENDING_BROWSER_EXECUTABLE=<installed Chrome> node --test tests/live-app.test.js`; independent review. Four new cases RED→GREEN, full native 25/25; review found and corrected the old minimal DOM adapter, with 79/79 dependent tests passing.

## Task C: Private generation observation

**Files:** Create a focused server-only diagnostic/observation module and tests; modify `src/worker/operator-task8.js`, `src/worker/story-experiment.js` and their tests. Root integrates provider/API metadata at their actual boundaries.

**Interface:** A validated optional observation on terminal settlement; canonical observation hash in acknowledgment and persisted immutable identity/result association. Legacy no-observation records remain valid.

- [x] Write failing integration tests for provider structure rejection and API revalidation preserving distinct fixed categories privately. Retain the separate defensive `api-envelope` category; the current ≤48,000-byte scene plus bounded identities cannot reach the 65,536-byte envelope guard, so no test-only limit override or false reachability claim was added.
- [x] Define bounded allowlists, nullable validated usage and actual metadata; reject arbitrary strings, unsupported enums, unsafe numbers and extra fields.
- [x] Persist once with the existing atomic terminal transition; verify acknowledgment, replay, conflicting diagnostics and legacy records.
- [x] Assert public/cache responses exclude observations and sentinel content; write failure/restart paths retain reservations and do not call the model again.
- [x] Run admission/API/stage/provider scopes and independent review. Independent observation/bridge/admission 28/28 plus four targeted baseline/native restart cases passed; a 122,879/122,880-byte snapshot capacity counterexample rejected settlement with zero writes and retained reserved/111 after reconstruction.

Review also found that baseline registration required the very first Task8 row to be accepted. A RED→GREEN regression now permits preceding failed rows while refusing to skip reserved, unknown or earlier complete rows; every old row remains unchanged. The source still requires an original fresh opening with `retryOf:null`. Admission cardinality now reads the unchanged configured Task8 cap, rather than a second hardcoded value.

## Task D: Align submitted generation constraints

**Files:** Modify `src/worker/story-provider-core.js`; focused schema helper/tests if useful; keep runtime `schema.js` and `memory.js` acceptance semantics unchanged.

**Interface:** Existing `buildStoryInput(profile,context)` returns the same bounded input shape; candidate and production submit the same contract.

- [x] Reproduce schema-valid/runtime-invalid block, entity, memory and text fixtures with an independent test-only schema interpreter.
- [x] Encode conditional fields and nonblank/control-character text constraints; preserve legal action pairs, explicit target/scope instructions and all runtime checks. Cross-item uniqueness and UTF-16 limits remain runtime-only checks; JSON Schema counts Unicode code points, and no runtime acceptance rule was relaxed.
- [x] Verify valid positive scenes and the encoded negative cases, schema immutability, contextual IDs and worst-case encoded input fit.
- [x] Add only server-computed input/usage/non-thinking/diagnostic metadata needed by TaskC; no raw output persistence or repair.
- [x] Run provider/acceptance/native stage checks and independent review. Acceptance 22/22, existing provider 19/19. Independently verified maximum full input 12,259/12,288 bytes across all realms, maximum safe turn and 7,000 encoded context bytes; 29 bytes remain. This is not proof of real Cloudflare schema enforcement.

## Task E: Prepare production policy and packaging

**Files:** Add focused production policy module; modify `scripts/build-gateway.js`, backend build/runtime tests and configuration documentation. Do not promote the real registry yet.

**Interface:** Explicit validated production policy passed to the normal worker composition; original versions, account/Free proof, model registry, namespace and budget remain authoritative.

- [x] Add failing tests for normal production composition with isolated validated fixtures, plus unvalidated/Paid/wrong-account/unknown-field/mixed-mode rejection.
- [x] Implement disabled/tester/production package identities and original namespace reuse; production has no experiment bridge, permit or experiment secret.
- [x] Verify actual packaged entry in native workerd, request-time clock, cached lookup when paused and existing budget protections.
- [x] Keep actual checked-in enabled policy false and production registry empty until TaskF supplies real evidence.
- [x] Independent review and full `WENDING_BROWSER_EXECUTABLE=<installed Chrome> npm run release` before committing implementation. Final 722/722, zero failures/cancellations/skips/todo; 89.749s tests and 115.020s total gate. Local syntax check counted 490 JS files including ignored preparation copies; HTML 971,109 bytes, SHA-256 `b2be6d9d1695cc0f46af5ff4bac16c0519a36cd28a284a0b77c4834f0b058e16`. The initial complete run was 721/722 because an old test expected the prior Chinese prompt wording; its updated assertion checks the actual complete unresolved-obligation rule, was independently reviewed, and the whole gate was rerun.

Review found and corrected a future CI blocker: the workflow always invokes the default CLI without production proof. A default build now remains disabled for either legal checked-in boolean value, while explicit production still needs true + validated registry/proof and explicit tester needs false. Two real no-argument CLI regressions went RED→GREEN in isolated unvalidated/promoted trees. Four packaging/native scopes passed 37/37; independent production/build review passed 27/27. No workflow, real registry, quota or deployment changes were made.

## Task F: Actual acceptance and release

Continuation verification: recovered the complete uncommitted changes from `ffcef06`, repeated the full release with permitted local test servers, and obtained722/722 with zero failures/cancellations/skips/todo,142 JavaScript syntax checks and17 default disabled backend modules. Independent Standards and Spec reviews found no blocking code defect; the missing linked evidence artifact was completed with original-run summaries, current source fingerprints and fresh GET-only ledger/health checks. At14:28:21 UTC+8 the original status was identical to the preceding read, still8 calls/450 reserved. No inference, deployment, quota change or production promotion occurred. See `docs/evidence/remaining-completion-2026-10-28.json` and PR14 for source publication and current CI.

- [x] Reconcile the missing call/Task8 allocation into a concrete reviewable proposal, retaining every original row and reservation: [controlled reacceptance](2026-10-28-controlled-reacceptance.md).
- [x] Obtain explicit numerical authorization before new inference. The user replied“确认”to the reviewed12/900 and Task1/7/8 4/5/3 proposal, with four new calls maximum and failure-stop. Budget boundary tests were updated before implementation and failed against the old limits, then passed after the narrow configuration change; deployment/live execution remain separately gated.
- [ ] Deploy only reviewed packages with a new actual same-account proof; read back all module hashes, namespace and original ledger.
- [ ] Obtain a genuine accepted browser opening/S1, perform independent A/B review, and complete actual browser choice/save/refresh under the authorized limits.
- [ ] Pin reviewed real profile evidence; run release, whole-branch review and exact-head CI.
- [ ] Merge, verify HTML publication, deploy normal compatible production backend and verify actual identities and public capabilities.
- [x] Reconcile the todo records to actual evidence: M1/M2 and Tasks A–E implementation are complete locally; the original seven real acceptance/public-release gates remain unchecked. No deployment/model/profile completion is inferred from fixtures.
