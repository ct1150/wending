# Story generation and playable choices — revised implementation plan

## User decision

The user rejected a repair based on stronger editorial validation and automatic retries: prevent unreasonable output at its source and prioritize uninterrupted play. This plan replaces the initial one-correction proposal. The unpublished session/API retry changes have been removed.

## Evidence

Production 5.2.0 streamed a 126-character opening and three plausible choices, then returned `rejected / CHOICE_NOT_COMPILABLE`. A minimized real-provider loop isolated three independent gates: an observation purpose did not repeat a person's full name; prose was shorter than 200 characters; a narrative description used an indirect name. All three original actions already compile under the game rules. The visible stream is preserved as a test fixture; reconstructed wire metadata is not represented as the raw provider response.

## Architecture

1. Project the existing `v7ActionRule` into the generation schema. Filter action/target/stake combinations using the actual life, resources, realm and turn, without copying cost rules. Preserve target restrictions when transforming local aliases into named targets. The model chooses from current capabilities and writes the scene and purposes.
2. Accept valid v7 narrative regardless of length, exact repetition of names, paragraph presentation or pacing preferences. The director still guides future writing; optional unsupported NPC traits are omitted from director memory without rejecting the scene. Quoted prose is not treated as an instruction to change actual character numbers.
3. Keep structural validity, stable entity identity, death facts, memory references, authoritative receipt/rules, at least one executable choice, archive CAS and idempotent attempts. Maintain the original model choices; do not replace them with canned menu entries.
4. Keep existing recovery semantics. No new automatic retry loop or extra inference for ordinary editorial differences. An existing rejected pending turn can use normal manual retry, preserving its original decision and receipt.

## Verification

- [x] Capture and independently reproduce the live failure.
- [x] Test that the exact 126-character prose and original purposes/targets can commit and prepare all three actions.
- [x] Test natural references, a question about past years and quoted speech without changing rule-owned numbers.
- [x] Verify each source-schema action against the real rules for empty, normal and high-resource states; check target restrictions survive named conversion.
- [x] Exercise real provider/API/client/session/archive plumbing and click each original rendered choice from the same starting scene.
- [x] Preserve old-save, identity, death, memory, duplicate settlement, budget and legacy regressions.
- [x] Independent review, full release tests, syntax check and build.
- Release follow-up: GitHub PR/CI, explicit Cloudflare backend/frontend deployment, and actual live opening plus subsequent choices are recorded in the repair PR after this validated source snapshot.

## Release constraints

Keep Workers Free, the validated GLM direct AI binding and existing secret bindings. Never read secret values or change billing. Build from reviewed source using the recorded production policy and inherit bindings. Test an uploaded version before activation when the provider supports preview, then verify the public domain and record the actual observed result.
