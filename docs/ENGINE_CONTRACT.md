# Shared implementation contract

Version: 1.1.0. Updated: 2026-10-25 (Shanghai).

All product files are browser-native ES modules, extension `.js`, package `type: module`, with no runtime dependency. `app.js` owns interaction, `ui/story.js` renders the public story view, `engine.js` owns public state transitions and save validation, `story.js` owns narrative state/conditions/views/settlement, and the content modules own authored data. The dependency direction is UI → engine → story runtime → story content; story runtime never imports engine. Keep relative static named imports/exports, no module cycles and no dynamic runtime loading; the offline bundler intentionally supports a bounded module syntax (see [deployment/build documentation](DEPLOYMENT.md)).

## Content exports

Export arrays `REALMS`, `PATHS`, `ORIGINS`, `WORLDS`, `ITEMS`, `LEGACIES`, `EVENTS`, `ENEMIES`, `CHALLENGES` and object `WORLD_FLAGS`.

- REALMS: `{id,name,lifeCap,trainYears,trainGain,need,breakYears,hp,attack,defense}`. Six entries; index 0 炼气 starts lifeCap 100, trainYears 3, trainGain 12, need 36, breakYears 3, hp 100, attack 14, defense 3. Life caps are 100/160/260/380/520/560; training years 3/6/10/16/24/24; breakthrough years 3/6/10/16/24/0. Subsequent need 70/110/160/220/0; final need=0. Content tables are the authoritative numeric values.
- PATHS: IDs `sword`, `body`, `alchemy`. `{id,name,subtitle,description,icon,bonuses:{attack,defense,hp,training},starterArt,starterSkill}`. Attack/defense/hp are additive; training is additive training gain.
- ORIGINS: IDs `village`, `heir`, `herbalist`. `{id,name,description,icon,spirit,herbs,hpBonus}`.
- WORLDS: IDs `mortal`, `nether`, `celestial`. `{id,name,location,subtitle,description,minRealm,accent}`. minRealm 0/2/4.
- ITEMS: `{id,name,kind:'art'|'skill'|'artifact',pathId:'sword'|'body'|'alchemy'|'any',rarity:'common'|'rare'|'epic',description,stats:{attack?,defense?,hp?,training?,burn?,healing?}}`. stats additive, burn/healing integer bonus to specific action. At least 24 unique items; starter IDs in PATHS must exist. Engine supports off-path items (slots still apply).
- LEGACIES: `{id,name,description,source,effects:{spirit?,herbs?,attack?,defense?,hp?,cultivation?,itemId?,flag?}}`. Finite earned entries, including `plain-medicine` from the shared refugee medicine garden. Each selected legacy takes one slot, cap=2. Unlocked IDs are permanent. Event legacyId adds an eligible candidate this life, not instantly unlocks everything.
- WORLD_FLAGS: map ID to `{name,description}`. Required keys `medicine-valley`, `sword-sect`, `old-tomb`, `soul-debt`, `saved-city`. More allowed with follow-up events.
- EVENTS: `{id,worldId,title,tag,body,requires?:{minRealm?,maxRealm?,pathId?,flag?,notFlag?,worldFlag?,notWorldFlag?},choices:[{id,label,description,cost?:{years?,spirit?,herbs?,hp?,lifeDamage?},requires?:{minRealm?,pathId?,flag?,notFlag?,worldFlag?,notWorldFlag?},chance?:number,result:string,effects?:{cultivation?,spirit?,herbs?,hp?,lifeDamage?,merit?,renown?,itemId?,flag?,worldFlag?,removeWorldFlag?,legacyId?},failure?:{text,effects}}]}`. chance in [0,1]; all extra costs visible. No arbitrary code/functions. At least 45 events, include minimum three explicit cross-life follow-up chains. One occurrence per life; fallback repeatable benign exploration when eligible unseen pool empty. Event costs are in addition to exploration time. Every event has an always-available nonlethal leave/free option. Unknown IDs rejected in content tests.
- ENEMIES: `{id,name,description,hp,attack,defense,intent,worldId}`; regular enemies/world and bosses. `valley-sentinel` is an explicit story-only enemy (54HP/13 attack/2 defense), excluded from the random pool. Narrative choices and outcomes live in `story-content.js`, not in `EVENTS`. The old `mortal-seed` / `mortal-valley-heirs` definitions remain import-compatible but cannot override a new story's valley outcome.
- CHALLENGES: `{id,name,description,worldId,minRealm,enemyId,proofId,final?}`. proof IDs `mortal`, `nether`, `celestial`. One per world plus `{id:'finale',final:true,proofId:null,minRealm:5,worldId:'celestial'}`.

## Engine state

`{version:2,rng:number,story:null|Story,phase:'adventure'|'event'|'combat'|'ended'|'victory',run,meta,eventId:null|string,combat:null|Combat,summary:null|Summary,lastMessage:string}`.

run: `{name,originId,pathId,age,realmIndex,worldId,cultivation,hp,spirit,herbs,merit,renown,lifeBonus,lifeDamage,elixirsUsed,turn,attackBonus,defenseBonus,hpBonus,breakthroughFailures,items:string[],loadout:{art:string|null,skills:string[],artifact:string|null},flags:string[],visitedEvents:string[],legacyCandidates:string[],selectedLegacies:string[],deeds:string[],log:[{id:number,year:number,age:number,title:string,text:string,kind:string}]}`.

meta: `{generation:number,worldYear:number,legacyIds:string[],proofs:string[],worldFlags:string[],storyWorld:StoryWorld,history:Array<{generation,name,age,realmIndex,cause,deeds:string[],log:LogEntry[],selectedLegacyId:null|string}>,victories:number}`. First generation 1; first year 1000; initial age16. Histories capped at50, current log200.

`LogEntry` is `{id:number,year:number,age:number,title:string,text:string,kind:string}`, identical to a current-life journal entry. Each completed life retains at most40 recent key entries: birth, events, failures, world consequences, milestones (including elixirs), ending, and legacy selection. Routine training/rest and individual combat rounds are omitted; victories also remain in `deeds`. Historical log entries have strictly increasing IDs and nondecreasing years/ages; fields, bounds and known kinds are validated before UI access. `history[].selectedLegacyId` records the one legacy unlocked at that settlement, or `null`; selecting a legacy updates the matching current history entry and its journal.

### Save version and strict migration

`serialize` emits version 2. The storage adapter keeps key `baishi-wending-save-v1`; the key name is not the JSON version. Import accepts valid v1 and v2 only. Raw input is limited to 1,000,000 JavaScript string characters; object keys, bounded integers/strings/arrays, known IDs and phase dependencies are validated. UI file-size prechecks are not a replacement for the engine bound.

For v1 only, early history entries genuinely missing `log` receive `[]`, and those missing `selectedLegacyId` receive `null` (the current ended/victorious life's existing summary selection can restore its missing historical selection). Malformed explicit values remain errors. Then the complete old structure is validated with exact v1 keys and old content restrictions, before changing to version 2, adding `story=null` and a canonical `meta.storyWorld`, and validating v2. v1 cannot carry the new story enemy or `plain-medicine` IDs. No missing mandatory resource or phase field is synthesized.

Migration preserves current run, phase, event/combat/summary, RNG, earned items/legacies/proofs and historical facts. That current life keeps `story=null`; only a later reincarnation creates a narrative. A genuine old `medicine-valley` flag establishes an existing clinic valley, with unknown old-case/person/evidence facts left unknown. A migrated life that actually plants the old valley later bridges that real event into the next-life clinic arc. It never invents an old interview or public trial.

v2 must supply both new fields; missing/extra fields, malformed narrative structures and inconsistent trace/world facts are rejected. Migration acts on the parsed copy and does not mutate the source backup. Upgraded v2 saves are not readable by the old program. These checks enforce consistency with retained chronological evidence, not cryptographic authenticity against an author who rewrites an entire mutually consistent history.

### Persisted narrative state

`Story` has exactly:

```js
{
  arc, sceneId, startYear, deadlineYear,
  flags, met, relationships, clues, routes, investigations,
  visited, choices, journal, lastResult, pendingCombat,
  status, outcomeId, settled, sideIds, sideIndex, returnSceneId
}
```

- `arc` is `old-fire`, `clinic`, `estate` or `refuge`. First scenes are YG01 / G2A01 / G2B01 / G2C01. `startYear` is the real world year; persisted `deadlineYear=startYear+8` is active as a deadline only in `old-fire`.
- Flags are finite narrative enums separate from `run.flags` and `meta.worldFlags`. `met` uses `shen_zhi`, `lu_huai`, `wen_du`; `relationships` has those exact keys and integer values −2…2. Real treatment/promise/rescue facts remain distinct from relationship values.
- `clues` has exactly `testimony`, `ledger`, `channel`, each `none|partial|full`. `routes` has at most two distinct route IDs; `investigations` equals its length. Evidence cannot exist for an unvisited route.
- `visited` contains legal current-arc scene IDs. `choices` has at most80 unique `{sceneId,choiceId,year}` entries in nondecreasing year order. `journal` has at most80 `{title,text,year}` entries. `lastResult` is null or `{title,text,changes:string[]}`; it persists through ordinary actions and reload until another narrative choice or actual deadline/settlement changes it.
- `sideIds` has two distinct values from0/1/2, derived from the seed without advancing the old RNG. `sideIndex` is0…2. An active side scene must carry its legal `returnSceneId`; replay validates the actual route-specific continuation.
- `pendingCombat` is null or `{sceneId:'YG12',enemyId:'valley-sentinel'}`. It must match current scene, the recorded `short_fight`, actual combat phase, enemy, null challengeId and round≤3. Ordinary combat cannot impersonate it.
- `status` is `active|resolved|failed`; nonactive states have `settled=true` and a valid outcome. Failures use `unfinished`. An ended/victorious life cannot retain active story state.

`StoryWorld` has exactly:

```js
{
  valleyOutcome, resolvedYear, resolvedGeneration, publicTruth,
  survivorLine, seedCustodian, unpaidPromise, evidence,
  supplyDebt, graveMoved, npcBirthYears, npcDeathYears, records
}
```

`valleyOutcome` is null / `open_clinic` / `sect_estate` / `ash_refuge`; matching seed custody is `unknown|clinic|sect|destroyed`. Survivor line is `unknown|safe|injured`; an unpaid protection promise requires an injured family line. `evidence` holds up to three distinct route IDs; public truth, supply debt and grave movement are booleans. Unsettled worlds cannot inject outcome facts.

NPC birth/death maps use the three fixed IDs. Initial ages32/76/57 and natural lifespans86/160/90 determine death years as world time passes. New scene/choice/result wording resolves living successors using the actual action completion year; genuine earlier journal/result memories retain their original participants. Outcome text uses settlement time, not the later reader's year.

`records` retains at most50 `{generation,year,arc,outcomeId,facts}` snapshots. Generations strictly increase, years never decrease, and the latest facts match current facts. Validation reconstructs current narrative progression and permitted settlement facts from retained choices and the preceding generation's snapshot. A sequel may change only its own permitted facts; it cannot rewrite prior public truth or revive a destroyed seed. The migrated clinic's first sequel is allowed its genuine default historical baseline without invented pre-v1 records. Older snapshots whose original trace is no longer retained form the historical validation boundary.


Combat: `{enemyId,enemyHp,enemyMaxHp,round,focus,challengeId:null|string,log:string[]}`. Enemy heavy intent on every third turn, visible in UI. Summary: `{cause,title,text,age,realmIndex,legacyOptions:string[],selectedLegacyId:null|string,deeds:string[],worldChanges:string[]}`. No unearned death reward.

## Engine public API (stable)

- `createGame({name,originId,pathId,seed,legacyIds=[]}, previousMeta=null)` creates fresh state; if previousMeta supplied generation increments and worldYear advances16; validates selected legacy IDs and max2. Seed string or number, deterministic hash. Valid defaults if arguments omitted.
- `getStats(state)` => `{maxHp,attack,defense,training,remainingLife,lifeLimit,realm,nextRealm,need,breakthroughChance,burnBonus,healingBonus}`. lifeLimit=realm.lifeCap+run.lifeBonus; remainingLife=lifeLimit-age-lifeDamage.
- `getActionInfo(state,type)` => `{type,label,years,enabled,reason,costText}`; types `train`,`explore`,`rest`,`alchemy`,`breakthrough`,`retire`.
- `act(state,{type,worldId?,challengeId?})` => NEW state; above types plus `travel`,`challenge`,`finale`. Illegal operations throw user-friendly Error and never mutate input. Train grants growth, first explore selects unseen eligible event; subsequent explore has 15% chance of a same-world non-boss combat, otherwise event, rest heals, alchemy consumes3herbs/15spirit and raises lifeBonus by 2 current trainYears (max2 per life), breakthrough requires need and time; failure chance public with pity. Retire finishes current life. Challenge validates area+realm+unique proof; finale all3 proofs+realm5+celestial. World travel has visible two-year cost and minRealm check.
- `getEventChoices(state)` => array of content choices spread plus `{enabled,reason}`. Cost affordability checked before mutation. `chooseEvent(state,choiceId)` returns new state; records paid results, item rewards, world changes and eligible legacies. Ordinary events may fail but display chance.
- `combatAction(state,action)` action `strike`,`guard`,`burn`,`flee`; no world years per round; burn adds5命损, not age. Guard reduces incoming damage and adds focus for next attack; flee loses resources and advances2years. Victory grants proof once and ends finale with victory. Combat losses end life. Guard cannot stall indefinitely (rage or finite healing).
- `equipItem(state,itemId,slot=0)` checks ownership+kind; art/artifact replace; skills slot0/1, cannot duplicate. Cannot change equipment in combat/event/ended.
- `selectLegacy(state,legacyId)` only ended/victory, candidate and not already chosen; adds one permanent ID and updates the current completed life's `selectedLegacyId` and bounded journal. If no new eligible candidates selection may be skipped.
- `reincarnate(state,options)` only ended/victory; requires selection if candidates exist; wraps createGame with meta, retains proofs/world/history and resets character.
- `serialize(state)` string; `deserialize(raw)` state or throws descriptive Error. Validate complete state and known content IDs, bounded integers/strings/arrays, active phase dependencies. Preserve deterministic RNG. `src/game/persistence.js` exports `saveToStorage(state,storage)`, `loadFromStorage(storage)` returning null for missing data, throws on corrupt. Key `baishi-wending-save-v1`. UI catches storage errors and does not overwrite corrupt data until explicit user action.

## Narrative public API and UI boundary

- `getStoryView(state)` returns null when `state.story===null`; otherwise returns the model below. Reading is pure and consumes no RNG or time.
- `chooseStory(state, choiceId)` returns a cloned next state. It validates phase, current scene, mortal-world location, path/trace/evidence gates and actual costs before mutation. Errors are readable Chinese. UI must use the supplied choices and cannot write internal narrative fields or recreate availability logic.

```js
{
  id, title, chapter, chapterIndex, chapterCount,
  sceneId, sceneTitle, location, objective, paragraphs: [],
  choices: [{ id, label, description, costText, enabled, reason }],
  journal: [{ title, text, year }],
  people: [{ id, name, role, status, relationship }],
  clues: [{ id, title, text }],
  lastResult: null | { title, text, changes: [] },
  status: 'active' | 'resolved' | 'failed',
  outcome: null | { id, title, paragraphs: [], worldChange },
  progress: { completed, total },
  deadlineYear: number | null, yearsRemaining: number | null,
  investigations: number, maxInvestigations: 2, paused: boolean
}
```

`id` identifies the arc. `chapterIndex` is1-based; there are three chapter headings. Progress totals16 first-arc core nodes or5 sequel nodes and fills at resolution/failure; it is presentation progress, not elapsed minutes. First choices are `enter_help` / `enter_ask`; there is no generic `continue` choice. Always read IDs from the view.

The five global phases remain unchanged. Event/combat/ending controls take priority in UI; event/combat pause narrative choice actions, and a non-mortal location disables them with a return explanation. `paused` expresses this. Story combat uses existing `combatAction`, not `chooseStory`. A resolved first arc can still have valid YG15/YG16 reading and life choices; do not hide them based on status alone. A completed sequel has `choices=[]` and ordinary cultivation/retirement stays available. UI dispatch uses `data-story-choice` separately from event and combat datasets and escapes player-authored text.

### Narrative transaction, battle and settlement

`chooseStory` pays spirit/herbs/HP/life damage, advances elapsed years through the common clock, and checks death before awarding any evidence, relationship, benefit, battle or positive world outcome. The eight-year deadline can interrupt a multi-year investigation: already-paid costs stay paid, unfinished evidence is not granted. Nonlethal HP costs preserve1HP; active stabilizing life-damage costs require survival, while ordinary battle burn remains lethal.

The optional sentinel fight grants no normal loot. Victory and surviving flee return to YG13. Flee keeps ordinary costs: ceil20% spirit, at most one herb and two actual years; survival is checked before continuing. After a third surviving unsuccessful round, retreat costs at most6 spirit. Battle death, burning death and flight lifespan exhaustion clear pending combat and settle unfinished narrative before summary/history capture.

Settlement is once-only: continued reading, refresh, retirement and natural death cannot pay it again. `open_clinic` earns 青谷丹书 and a real 药谷种籽 candidate; `sect_estate` pays20 spirit once; destroyed seed is never awarded. `refuge_common_medicine` earns the new 朴药手记 candidate (next-life3 herbs and6HP), subject to the same one-unlock/two-carried legacy rules. Common-clinic sequel public council can also earn the clinic reward when legitimately reached. Ordinary old-world APIs, equipment slots, proof acquisition and three-realm finale remain intact.

First outcomes: `open_clinic`, `sect_estate`, `ash_refuge`; interruption: `unfinished`. Sequel outcomes:

| Arc | Outcome IDs |
| --- | --- |
| clinic | `clinic_open_council`, `clinic_keeper_rule`, `clinic_sect_debt`, `clinic_rationed` |
| estate | `estate_shared_supply`, `estate_grave_access`, `estate_unchanged` |
| refuge | `refuge_common_medicine`, `refuge_family_medicine`, `refuge_small_plot`, `refuge_unchanged` |

## Core invariants

1. Pure functions; effects do not mutate prior save.
2. Pay elapsed time before effects; if time exhausts life, finish before breakthrough/reward. Fuel use cannot resurrect a dead character.
3. Burn never advances world years. Travel and reincarnation do.
4. No arbitrary rewards for retry/retire. Candidate legacies come from events, meaningful realm/path milestones or world deeds.
5. All resources finite/nonnegative; hp clamped to derived max. Action budget cannot go negative to buy a reward.
6. At least one legal progression path to final victory under normal rules. A seeded simulation may establish this, not fabricated test data.
