# Proposed shared-opening acceptance continuation

Status: offline implementation and independent review passed; local release gate 646/646 tests, 133 JavaScript syntax checks and build passed. Remote CI is still required for the published preparation. Real calls are paused after the third rejected Task7 opening. A change to this acceptance sequence must be presented to the owner before another live call. The owner has already approved 11 total calls, Task1/7/8 limits of 4/5/2, and an unchanged 800 Neuron ceiling.

## Evidence and reason

The original durable record now contains seven calls and 339 Neurons reserved. Three Task7 openings were rejected; the latest diagnostic is `GENERATED_SCENE_INVALID / ACTION_PAIR_INVALID`. The rejected scene was not retained, so the exact invalid field is unknown. At that point, the generation schema independently enumerated intent and approach, whereas runtime permitted only their defined pairs. The reviewed offline correction binds the 19 legal pairs and rejects 133 other combinations without changing runtime validation, promoting the model, or retrying a failed case. This fixes a reproducible contract gap; it does not establish the exact cause of the third rejection or real Qwen compliance with the new schema.

Repeating the former dedicated opening plus two branches and two browser calls would require five further calls. Only four remain. The proposed sequence shares one real browser opening as the source for the counterfactual comparison. This reuses evidence, not an inference reservation: the opening stays a Task8 call, both independent branches are Task7 calls, and the final browser choice stays a Task8 call.

| Operation | Task | Total calls afterward | Conservative cumulative reservation |
| --- | --- | ---: | ---: |
| Existing immutable record | 1 and 7 | 7 | 339 |
| Actual protected browser opening, accepted and saved as S1 | 8 | 8 | 450 |
| Counterfactual A from S1 | 7 | 9 | 561 |
| Counterfactual B from the same S1 | 7 | 10 | 672 |
| Actual browser choice from its unchanged S1, save and refresh | 8 | 11 | 783 |

Alternatives are to retain the dedicated opening sequence (which needs a further unapproved call and Task7 slot), or stop acceptance and leave generation disabled. The shared-opening sequence is proposed because it can satisfy both real workflows under the current approved caps. It has no spare retry call. Any rejection, unknown outcome, failed durable save, or unusable S1 pauses this sequence and keeps all reservations.

## Trusted handoff

1. Only the trusted player API, after strict ready-result validation, computes `acceptedSceneHash = SHA256(canonicalStringify(scene))`. The existing authenticated experiment settlement persists that hash with the complete Task8 admission and result. Failed/unknown outcomes cannot carry it; terminal status and hash are immutable, and the bridge verifies the settlement acknowledgment.
2. The operator registers one baseline through an authenticated, bounded `/task7/baseline` request containing the original admission ID, exact context and scene, and the browser-observed saved S1. Registration performs no inference or reservation.
3. Registration verifies the original three failed cases, a genuine complete Task8 ledger/admission/result association, context and scene hashes, opening identity/receipt/version, and strict scene validation. It reconstructs the original birth state from the supplied opening facts and checks the original state hash, then uses the existing engine to commit the scene. The recomputed S1 must equal the browser-observed saved state. Memory records are derived with the same acceptance history rules; arbitrary client history is not accepted.
4. The baseline and its source hashes are immutable. Exact registration replays without another write; changed source, context, scene or saved state fails. Missing legacy attestations fail closed rather than being backfilled from client claims. The operator credential remains a trusted administrative boundary; the hash is not a signature against that credential's holder, and browser persistence remains a separately observed acceptance fact.
5. Two new fixed cases, `task7-player-branch-a-v1` and `task7-player-branch-b-v1`, clone the same baseline S1. Both require two meaningfully distinct executable living choices before branch A. Branch B requires completed A, but never adopts A's state. Neither branch changes the browser archive or any original failure tombstone.

## Live gates and evidence

Public inference remains disabled and the candidate remains unvalidated throughout controlled acceptance. The explicit tester package serves its reviewed embedded HTML. The operator helper, original namespaces and object names, source/module hashes, fresh same-account Free observation and original seven rows must be rechecked before the first live browser call.

Use a dedicated real Chromium profile and a separate tester permit added only by the Playwright transport for the exact game origin's `/api/story/` routes. No response substitution, page fetch patching, operator token in the browser, or synthetic result injection is allowed. Record actual HTTPS responses, identity/hash associations, saved state/history and refresh behavior. Review the opening narrative and both valid choices before proceeding. The final browser choice must invoke the API and model afresh, not reuse a private branch response.

The resulting claim, if all gates pass, is one real UI opening, two independent one-step counterfactual generations from that opening, and one real UI choice/save/refresh cycle. It is not a new independent Task7 opening, a deeper continuous story sequence, or proof of unlimited narrative quality. Actual billed Neurons remain unknown unless authoritative billing evidence supplies them; reservations and account analytics are labeled separately.
