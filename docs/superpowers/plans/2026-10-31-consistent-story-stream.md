# Continuous story and choice streaming implementation plan

> **For agentic workers:** Use the parallel task owners below with test-driven implementation and one independent final code review.

**Goal:** Keep live narration, dialogue and model-generated choices visually and textually consistent through durable completion.

**Architecture:** Preserve bounded display-only structured previews end to end. Negotiate new indexed SSE rows without changing final result envelopes or archive schemas; use shared rendering and choice composition.

**Tech Stack:** Native JavaScript, node:test, Playwright, Cloudflare Workers AI, SSE, IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-31-consistent-story-stream-design.md`

## Global constraints

- Cloudflare free-only model and existing accounting remain unchanged.
- Final schema validation, idempotency and atomic archive commit remain authoritative.
- Old saves, JSON replay and legacy text-preview clients continue to work.
- No new production dependencies or generic replacement choices.

## Review focus

- A draft choice must never execute before durable commit.
- Reset, interrupted, foreign or late events must not leak across attempts.
- JSON escaping, partial Unicode, HTML and internal IDs must not corrupt display.
- Incremental and committed prose/choice content must match without layout replacement.
- A model that lacks a valid event-specific exit must fail recoverably rather than invent a menu.

## Task 1: Model presentation and choice integrity

Owner: backend agent. Files: `story-preview.js`, GLM provider/wire/named schema, provider core, story API and focused tests.

Produces provider snapshots `{type:'presentation',blocks,choices}` and negotiated SSE `{type:'block',index,kind,text,speaker?,complete}` / `{type:'choice',index,label,complete}`. Indices are zero-based, rows cumulative; reset clears rows. Legacy previews unchanged. Final and draft labels use one composer.

- [x] Add and observe failing structured-stream and option-preservation regressions.
- [x] Implement bounded partial extraction, shared label composition and model guidance.
- [x] Emit coalesced changed rows and retain identity/budget limits.
- [x] Remove synthetic generic modern choices; verify recoverable rejection.
- [x] Run backend regression tests and record results.

## Task 2: Browser transport and transient session

Owner: root. Files: `src/ui/story-client.js`, `src/ui/live-session.js`, `tests/story-stream.test.js`, `tests/live-app.test.js`.

Consumes Task 1 packets. Produces `view.preview={blocks:[{kind,text,speaker?,complete}],choices:[{label,complete}]}` or legacy `{text}`. Draft data remains memory-only.

- [x] Add and run failing tests for negotiated row streaming and transient storage.
- [x] Validate field sets, bounds, row indices and response identities.
- [x] Replace indexed transient rows without full app rerenders; preserve resets and late-event guards.
- [x] Verify commit timing, interruption, reset and backward compatibility.

## Task 3: Unified reading surface

Owner: UI agent. Files: `src/ui/journey.js`, relevant styles, app render hook if needed, renderer/browser tests.

Consumes Task 2 preview arrays. Same live blocks and option buttons render during streaming and after commit; disabled preview choices carry no command IDs.

- [x] Reproduce typography and unnecessary-copy problems in a focused regression.
- [x] Unify rendering/update paths and avoid replacing stable reading nodes on completion.
- [x] Remove redundant messages and zero-cost noise, retain meaningful errors/costs.
- [x] Verify mobile, dialogue punctuation, escaping and final transition.

## Task 4: Verify and release

Owner: root; independent review after integration.

- [x] Run focused tests, required project release gate and inspect rendered page.
- [x] Review integrated diff for protocol, validation, UI and compatibility risks.
- [ ] Update release/progress notes and publish through GitHub.
- [ ] Deploy the verified production backend with embedded frontend using existing Cloudflare bindings and unchanged free-only policy.
- [ ] Check live health/version plus a bounded real model stream, report actual evidence and remaining limitations.

## Progress

- Baseline: `fa19e7d`, version 4.4.0; clean dedicated checkout/branch `fix/consistent-story-choice-stream`.
- Initial protocol/provider unit files pass. Browser-dependent baseline needs a usable Chromium; the pinned Chromium download is unavailable in this environment, so a separate test executable is being provisioned without modifying package dependencies.

- Release gate: 1025/1025, 182 syntax files, 1,048,010-byte HTML. Independent review: no findings; 964 additional prefix boundaries. Final publication and live identity are tracked in the release PR.
