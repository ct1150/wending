# Adventure Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Main agent edits, existing autonomous authorization applies.

**Goal:** Make existing character, ability and cultivation adventures discoverable at the right realm without automatically accepting or charging for them.
**Architecture:** Extend derived adventureLeads with eligible invitations; keep accepted work in journeyNotes. Existing noteRoutes and session fencing remain the only navigation mechanism. No serialized event or AI protocol changes.
**Tech Stack:** JavaScript, node:test, current browser session and immutable local preview.
**Spec:** Design below, grounded in the 2026-11-18 campaign-content audit.

## Design and constraints

After choosing one's entry path, show applicable optional invitations ahead of the two existing long-route directions. While the three-day entry job remains accepted, keep its original directions. Offer local LinYan meeting/post only before80 and before an explicit post decision; lead to the unresolved meeting/reunion when a personal decision is still required. Mention the multi-decade commitment. Offer an unlearned technique from foundation (repair via mentor if needed), the current material's unstarted shell voyage or golden-realm well, unstarted folded mountain, and upper-world cloud passage/rift as eligible. Started work is continued through the existing journal rather than advertised as new.

Every direct link must come from existing safe menu traversal, spending no resources, advancing no time/RNG and recording no promise. Unavailable routes retain explanatory text and no executable link; do not invent actions or silently finish a preliminary conversation. Lists are derived each time, so old saves gain directions without changing historical scenes. Explicit declines must not reappear as invitations. This does not claim twenty hours of content.

## Review focus

- Old or off-world people must not be advertised as currently waiting.
- Known/draft/declined/completed content must not be presented as a new obligation.
- A prerequisite meeting may be visited but not answered automatically.
- UI and session must agree on each eligible endpoint; stale commands stay rejected.
- Increasing the invitation list must not turn a safe menu traversal into a decision.

## Tasks

- [x] Add failing eligibility and safe native navigation tests in event-story/river tests; cover early meetings, foundation form, golden material, and upper cloud/rift boundaries.
- [x] Extend `src/game/cultivation/live/journey-notes.js`, using current form/ferry/rift eligibility and safe traversal through already-decided companion pages only.
- [x] Update `src/ui/journey.js` invitation summary/help to describe the expanded choices and preserve counts and native cost previews.
- [x] Extend mobile session test to visit multiple opportunities with exact life/RNG/commitment invariance, reload and stale command checks where relevant.
- [x] Run scoped tests, inspect diff, build and verify an immutable local preview with existing saves; record actual limits and prepare scoped files for commit.

## Verification

Eligibility/navigation tests failed before implementation. All22 event-story tests, one native earned-realm route test and two scoped archive/UI tests passed (25 distinct tests). The archive tests include interrupted navigation, replacement archives and stale commands, plus real360px visits to a person and folded mountain without acceptance, then explicit acceptance. This turn did not rerun the full three-world campaign; settlement and serialized scenes were not changed.

Five changed JS syntax checks and diff checks passed. Final build and all six changed input hashes matched. Final immutable preview `http://127.0.0.1:4176/discovery-v2/`, SHA256 `17e283ecbb375f7aea56fadf766c53b32d9deea9e6dc4fef7a4b4b044cd5f878`. Earlier `/discovery/` remains an older preview.

Final packaged Chrome360px checks: real historic foundation pending41 -> form offer45, and upper pending585 -> rift offer593; native life, RNG and commitments unchanged. Export/import and refresh preserved exact hashes;154333/1933402-byte backups. Two measured local link transitions256/394ms; not a latency distribution or device guarantee. No horizontal overflow, story requests or page errors. Direction lists visually inspected; final wording says practice settles time/cultivation rather than promising growth on failed practice.

Samples: `功法与险路.wending.jsonl`, `上界风隙.wending.jsonl`. Logs `.scratch/discovery-{red,green,story,native,archive,mobile,build-final,ui-final}.log`. No production deploy and no human-duration claim; discoverability improves access to existing content but does not establish the twenty-hour goal.
