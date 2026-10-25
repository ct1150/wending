# Shared implementation contract — dialogue journey

Product target **2.0.0**, save **v3**, content version **1**. Updated 2026-10-25. These versions are independent. This describes the local implementation; production remains 1.2.0 pending publication and actual acceptance. The complete old API and schema remain in [v1/v2 compatibility contract](ENGINE_CONTRACT_V2.md), for valid old current lives. Historical numeric tables in that contract are not v3 configuration.

## Modules and dependency boundary

Browser-native ES modules, `.js`, `type: module`, no runtime dependencies. `src/app.js` dispatches by validated version. `src/ui/journey.js` consumes the public journey view and emits choice identifiers, never internal mutations. `src/game/journey/engine.js` owns pure state transitions; `content.js` and `chapters/{mortal,nether,celestial,later}.js` own finite author data and resolution. `validation.js` owns v3/save/content consistency; `migration.js` bridges a validated terminal old life. `save-format.js` dispatches v1/v2/v3; `persistence.js` and `ui/session.js` own recoverable storage commits.

Old `engine.js`, `story.js`, `content.js` and old renderers remain for v1/v2 current-life compatibility. Journey does not add new HP, cultivation, equipment or generic currency rules. Keep static relative named imports/exports and no cycles; the bounded offline bundler syntax is documented in [DEPLOYMENT](DEPLOYMENT.md).

## Journey state

```js
{
  version: 3, mode: 'dialogue', contentVersion: 1,
  revision, rng, phase: 'playing' | 'ended' | 'victory',
  world: { year, generation, facts, people, proofs, legacies,
           completedTasks, biography, legacyArchive? },
  life: { name, age, lifeLimit, lifeDamage, realm, injury,
          abilities, learnedOpportunities, items, legacyId, facts },
  scene: { chapterId, nodeId, opportunities },
  transcript, summary
}
```

`revision` is a nonnegative command token, monotonically increasing across birth. Saved RNG is a nonzero uint32. Seed is finite numeric or at most 200-character text. First life: 云归, age16, year1000, generation1, mortal lifeLimit80. Realms mortal/foundation/golden/nascent have lifeLimit80/160/240/320. Growth uses `max(oldLimit,newLimit)` and keeps damage. Injury is `well|hurt|severe`; items use finite authored IDs and nonnegative quantities.

`world.facts` retains institutions, losses and completed results; `life.facts` holds current consent, inquiry, learning and duties. World facts are not automatic present inventory or permission. Original people carry real `birthYear/deathYear`; elapsed world time ages them. Dead characters cannot revive, and old unknown death dates are not fabricated. Current source testimony/consent cannot be inferred from inherited proof or a person's historical friendship.

`completedTasks[]` has `{episodeId,outcomeId,generation,sequence}`. Sequence increases; different chapters may settle during the same generation. A stable episode cannot settle again across generations. `world.legacies` is all genuinely earned v3 history, not active equipment: real lessons earn `*-memory`, substantive council/common-garden achievements earn their authored legacy. `life.legacyId` activates at most one method. Ten original old IDs retain distinct names/source even where methods coincide.

Persistent transcript entries have stable IDs, sceneId, kind and text; chosen actions carry choiceId. `life.facts['transcript-start']` is a validated bounded offset identifying this life's prose. Biographies store that life's full prose and facts, not recursive copies of all earlier lives. `legacyArchive` is the fully revalidated old terminal state, preserving old run/meta/story/summary/history schemas. Exact original bytes are stored by the session protocol, not injected into journey state.

## Public gameplay interface

| Export | Contract |
| --- | --- |
| `createJourney({seed} = {})` | New validated first-life state; no choice, cost or time committed by creation |
| `getJourneyView(state)` | Pure cloned view; no mutation, RNG draw, time or reward |
| `chooseJourney(state,{revision,sceneId,choiceId})` | Validates state; returns `{kind:'applied'|'stale'|'unavailable',state,message}`; never mutates input |
| `validateJourney(state)` | Validates exact schema, bounded values, finite IDs, phase/record/fact consistency; returns state or throws |
| `validateJourneyContent(chapters)` | Validates condition/effect vocabulary, IDs, ≤3 choices and authored successors/terminal exits |
| `resolveJourneyScene(state)` | First matching authored variant, never random selection; content boundary, not a substitute for full state validation |

The view contains `revision,sceneId,phase,title,location,blocks,choices,summary`. Choices expose `{id,label,detail,enabled,reason?}`. Detail includes actual required/held item quantities and remaining life for time/terminal actions. Summary contains name/age/year/generation, remainingLife/lifeLimit/lifeDamage/realm/injury, named abilities/items/active legacy, ending, biography, priorTranscript, legacyArchive and full legacyCollection. UI uses view choices; it does not rebuild affordability or trim long menus. Existing prose and actual results stay in the flow; previous-life text is expandable.

Stale revision or wrong scene returns original state with `stale`. A missing or unaffordable action, or one whose complete resulting save would exceed the shared character limit, returns `unavailable` and original state. Neither draws RNG nor deducts or rewards. After an applied command, repeating the old token is stale, including after save restore and birth.

## Atomic costs, opportunities and content

All costs and life conditions are checked before cloning/commit. Real years increase both age and world year; lifeDamage only reduces personal remaining life. Nonterminal actions require `remainingLife > years + lifeDamage` before any realm growth/reward. Costs are paid once, chronology updated, then authored effects/settlement applied and successor entered. Explicit fatal choices do not carry ordinary effects; burning consumes all remaining life without world time. Retirement advances all remaining real years. There is no hidden roll after a player commits a choice.

At first entry to each chapter's opportunity scene, candidates are filtered against actual inherited/learned methods, drawn once and stored in `scene.opportunities`. Later reads/restores reuse that ID. Each chapter has at most one lesson, each life at most three new methods plus one carry. Refusal is free. Ordinary herbalism lesson costs **one elapsed year**; lesson plus labor-paid actual medicine pack costs **two elapsed years**. There is no extra soul-inquiry-window flag or fictional refusal benefit.

Conditions are serializable finite `proof, ability, item, person, life-fact, world-fact, opportunity, injury-not, remaining-life`. Proof conditions support `held:false`; ability includes the single active inheritance. Effects cover finite item counts, real learning, realm, injury, life/world facts, people, proof and unique settlement; no arbitrary callbacks or runtime prose generation. Full authored costs, combinations, episode/outcome IDs and loss boundaries live in [dialogue author contract](story/dialogue-journey.md).

## Terminal and next-life behavior

`campaign-victory` is living `victory`, summary `{cause:'victory',generation,age,title:'三界问鼎',outcomeId:'bounded-victory'}` with remainingLife>0 and no current-generation biography yet. Its direct birth action explicitly passes remaining real years, records one victory biography and then adds16 world years/new generation. It does not reward the finale twice. Old v2 victory already has its own biography; conversion does not append another.

Real `ended` is `retired|burned`, with age+damage=limit and one biography. Both terminal phases expose one to three direct new-life choices via `chooseJourney`: existing carry plus at most2 real replacements; no carry up to3 true candidates; no candidates one `new-life`. Candidates derive from actual learned/achieved/reawakened sources, not death count or an arbitrary historical collection picker.

Birth resets current body/items/abilities/opportunities/consent/duties, preserves full historical collection/proofs/world/biographies/transcript, adds one generation and16 world years, and activates one chosen legacy. A held original is archived rather than given to the newborn. Matching finite sequel is offered only if incomplete; all11 sequel outcomes have finite onward routes. Existing proofs are honored, current personal agreement remains necessary, native completed finale routes to a truthful recap. Old combat victory retains old provenance and uses its own recap; it never fabricates native `ding-complete` or bounded institutional agreement.

## Unified saves and strict compatibility

`serializeGame(state)` emits v3 JSON after v3 validation and the shared 1,000,000-JavaScript-character size check; v2 uses old serialize, v1 passes through old strict deserialize before v2 output. `deserializeGame(raw)` accepts JSON versions1/2/3, at most1,000,000 JavaScript string characters. v1/v2 use the original complete old validator and established v1→v2 rules; normalized v1 output must also fit the same character boundary; v3 uses journey validation. The file chooser pre-read byte guard is derived as three UTF-8 bytes per permitted JavaScript code unit (3,000,000 bytes), so valid Chinese exports are not rejected by a smaller upload limit; parsed character length remains authoritative. Errors remain readable and corrupt data is not replaced. This validates retained consistency, not cryptographic authenticity against a wholly rewritten internally consistent save.

Key remains `baishi-wending-save-v1` (key name is not JSON version). `saveToStorage/loadFromStorage` use unified formats. Session bootstrap loads before creating; app explicitly supplies `createJourney` for missing saves. Blocked reads/bad JSON stay blocked with readable raw backup where available. Ordinary storage write failure leaves in-memory export available. Native choices, including terminal birth, check the complete candidate size before returning applied; the app also checks unified serialization before adopting an old-life action. A size rejection preserves the original state/token/cost/RNG/history and explains that the action was not committed. Current valid progress remains exportable/importable, but continued play at this finite history capacity is not guaranteed. Direct persistence rejects oversized output before either current or backup writes and reports failure without offering that invalid candidate as an importable export. Historic maximum input/history limits are unchanged; oversized conversions fail before replacement rather than truncate evidence.

### Legacy bridge and recovery transaction

`getLegacyBridgeChoices(validLegacyState)` returns `[]` until old phase ended/victory and any outstanding old reward is explicitly selected. Then it exposes the old selected carries plus the actually chosen reward, deduplicated by original ID, up to3; no candidates gives memory-only birth. Unselected old candidates are not owned history. `migrateLegacyLife(state,{choiceId,seed})` is pure, validates old state/choice, constructs exactly one v3 birth, preserves complete old archive and history, maps only equivalent facts, and calls no old death/reward/finale logic.

`baishi-wending-save-v1-legacy-handoff` contains exact `originalRaw`, `previousRaw`, `currentRaw`, and paired nullable `checkpointRaw/preparedRaw`. Original bytes are captured on valid old load/import before normalization and retained. Normal old progress backs up and verifies before replacing current. Terminal bridge validates target, records current terminal checkpoint and one seeded prepared target, verifies backup readback, then writes current. App adopts the already-saved target without another ordinary persist.

Backup/current failure keeps exportable source/checkpoint/prepared data. Refresh recognizes prepared handoff and reuses exactly that target on retry, with no extra seed, generation or year increment. A newer ordinary `currentRaw` after failed current write exposes `pendingLegacyRaw`: gameplay/migration are blocked until explicit `recoverLegacySession` restores it, without replay. Explicit recovery/bridge retries reread transient backup errors; malformed backups remain unchanged and blocked. More/old ending expose original, newer checkpoint and prepared target separately.

## Compatibility appendix and verification limits

See [complete old engine/story API](ENGINE_CONTRACT_V2.md) for createGame, act, chooseStory, combatAction, selectLegacy, old v2 fields and old migration. Those functions continue a valid old life. The 2.0.0 app uses the terminal bridge instead of launching another old reincarnate flow.

Behavior evidence and exact commands/counts are in [QA](QA_REPORT.md). Finite resolver matrices cover authored applicability; bounded real public actions establish reachable successor/save/stale invariants. They are not exhaustive traversal or human pacing evidence. Node renderer/controller focus checks do not prove native DOM focus, screen-reader behavior or visual layout. Actual 320px/light-dark/device/production acceptance remains pending as documented.
