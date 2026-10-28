# Remaining real-time completion design

The owner now requests “完成全部代办”. This continues the existing real-time design and release objective: actual accepted Chinese story generation, independent choice consequences, durable browser save/refresh, and a compatible public release. Existing saves, failed attempts and budget commitments remain intact.

## Current evidence

The reviewed base is `ffcef06b436b1a482925a2ba5613674e3d394054`, whose complete CI passed655 tests. The actual protected deployment is74aa258. The original durable experiment contains8 calls/450 reserved Neurons, with Task1/7/8 counts4/3/1. The first shared Task8 opening rejected `GENERATED_SCENE_INVALID`; no accepted S1 exists. Its raw output and structure diagnostic were not retained. This design does not retrospectively assign a cause to that failure.

The active implementation plan has seven unchecked gates across Tasks1,7,8. M1(request-body deadline) and M2(async focus recovery) are also explicit outstanding improvements. Historical versions, canceled time-per-life targets and unpromised physical-device coverage are not new implementation requirements.

## Approach and engineering decisions

Keep the existing domain model, strict validators, deterministic rules, native archive and same-origin API. Fix reproducible request-schema gaps, and preserve bounded private metadata in the existing atomic experiment settlement. Do not repair rejected model output, weaken validators, invent an accepted scene, import synthetic S1, change request identity, or retry automatically.

Alternatives considered: another blind live attempt gives inadequate evidence; replacing the story protocol/model before gathering diagnostics creates unnecessary migration and revalidation scope. The chosen engineering approach retains the current protocol and candidate while making known structural constraints explicit and failures diagnosable. A passed local schema check remains separate from actual model compliance.

The base submitted schema permits narration with speaker, dialogue without speaker, non-person status, and invalid memory kind/reference/status combinations. Text constraints also differ from runtime whitespace/control-character and UTF-16 length rules. Add conditional fields and nonblank/control-character generation constraints; retain UTF-16 length and cross-item uniqueness in the runtime validator, because JSON Schema counts Unicode code points. Do not narrow existing valid memory text in a way that prevents exact-text closure. Retain runtime rejection of invalid references, impossible actions and inconsistent facts. Recompute the full encoded input ceiling after every schema/prompt edit; the7000-byte context allowance must still fit within12288 input bytes, including worst valid turn IDs and JSON escaping.

## Private generation evidence

A server-only observation is carried by the existing Task8 settlement. It contains fixed failure-stage/error/structure categories and bounded validated metadata such as model identity, input hash/bytes, usage, stop reason, verified absence of substantive thinking, and measured duration where available. It never contains raw scene text, reasoning, arbitrary exception text, unknown property names, credentials or cookies.

The observation is bound to the same session/request/attempt/payload/context identity. It is persisted atomically with the existing result and ledger settlement, acknowledged with its canonical hash, and immutable once terminal. Legacy results without this evidence remain readable and are never backfilled. Settlement failure preserves reservations and the existing conservative unknown outcome. Public envelopes and cached browser responses remain unchanged.

## M1 and M2

M1 uses an absolute10000ms request-body deadline, independent of the existing30000ms provider timeout, and honors client abort. It retains content-type, UTF-8 and32768-byte checks. Cancellation cleanup cannot block indefinitely. Failure occurs before turn reservation, session creation or provider invocation.

M2 restores focus to an equivalent stable control after asynchronous app redraw, does not steal focus from an open modal, and resolves a dialog return target against the new DOM. When the old story choice disappears, focus returns to the current scene heading. State, request identity and commit timing remain unchanged.

## Production packaging

Prepare a separate explicit production policy and build path, with disabled/tester-only/production identities distinguished. It must resolve a validated checked-in production profile, bind the current owner-confirmed Free plan to the same account and original proof, preserve protocol/rules/prompt/save/content versions, and reject unknown fields, mismatched accounts, Paid plans, unvalidated models and mixed tester/production configuration.

The production package uses a small `createStoryProductionWorker` composition of the same `createStoryApi` and `storyBudgetCoordinator`, the original StoryBudget namespace/object, and no experiment bridge or tester permit. Existing production proof semantics remain request-time and do not reuse the five-minute probe balance TTL as a player timer. The production registry and checked-in enable policy remain closed until genuine quality and browser acceptance pass. Positive build/runtime tests use explicitly labeled isolated fixtures; they do not promote the real candidate.

The checked-in enable switch permits an explicitly validated production build; it must never automatically activate an ordinary build. The existing CI command has no private production policy, so its default build remains disabled even after a future checked-in enable change. Explicit production still requires both that switch and the validated registry/proof; tester mode still requires the closed switch. The production build script and uploaded source must share the same real root so one checkout cannot borrow another checkout's registry.

## Live and release gates

After all offline work and independent review, execute only a concretely authorized bounded acceptance sequence. The unchanged numerical limits are11 total calls/800 reserved Neurons and Task1/7/8 caps4/5/2. The current record has no S1 and only three total slots/one Task8 slot, while the original successful sequence needs four further calls/two Task8 slots. A generic completion request must not silently reclassify calls, refund failure reservations or rebuild the ledger. Resolve this numerical conflict before spending the remaining allocation.

The original four-call sequence is a real browser opening saved as S1, independent Task7 A and B from that same S1, then a genuine browser choice, save and refresh. Each result is reviewed before proceeding; failure stops that sequence and preserves its evidence. Only accepted evidence can support a production profile. Actual billed Neurons may remain null; validated tokens, reservations and account analytics retain their distinct meanings.

After all live gates pass: review and pin the production profile, run full release/CI and whole-branch review, merge the authorized delivery, verify the HTML release job, deploy the compatible normal backend, and read back actual module/deployment/frontend/API identities. The current V5/IndexedDBv2 reader and all original budget namespaces remain compatible throughout.
