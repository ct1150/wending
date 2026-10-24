# Shared implementation contract

All files are browser-native ES modules, extension `.js`, package `type: module`. No runtime dependency. Root owns UI/build/deployment; engine worker owns `src/game/engine.js`, `src/game/persistence.js`, engine tests; content worker owns `src/game/content.js`, content tests. Do not edit other workers' files.

## Content exports

Export arrays `REALMS`, `PATHS`, `ORIGINS`, `WORLDS`, `ITEMS`, `LEGACIES`, `EVENTS`, `ENEMIES`, `CHALLENGES` and object `WORLD_FLAGS`.

- REALMS: `{id,name,lifeCap,trainYears,trainGain,need,breakYears,hp,attack,defense}`. Six entries; index 0 炼气 starts lifeCap 100, trainYears 3, trainGain 12, need 36, breakYears 3, hp 100, attack 14, defense 3. Life caps are 100/160/260/380/520/560; training years 3/6/10/16/24/24; breakthrough years 3/6/10/16/24/0. Subsequent need 70/110/160/220/0; final need=0. Content tables are the authoritative numeric values.
- PATHS: IDs `sword`, `body`, `alchemy`. `{id,name,subtitle,description,icon,bonuses:{attack,defense,hp,training},starterArt,starterSkill}`. Attack/defense/hp are additive; training is additive training gain.
- ORIGINS: IDs `village`, `heir`, `herbalist`. `{id,name,description,icon,spirit,herbs,hpBonus}`.
- WORLDS: IDs `mortal`, `nether`, `celestial`. `{id,name,location,subtitle,description,minRealm,accent}`. minRealm 0/2/4.
- ITEMS: `{id,name,kind:'art'|'skill'|'artifact',pathId:'sword'|'body'|'alchemy'|'any',rarity:'common'|'rare'|'epic',description,stats:{attack?,defense?,hp?,training?,burn?,healing?}}`. stats additive, burn/healing integer bonus to specific action. At least 24 unique items; starter IDs in PATHS must exist. Engine supports off-path items (slots still apply).
- LEGACIES: `{id,name,description,source,effects:{spirit?,herbs?,attack?,defense?,hp?,cultivation?,itemId?,flag?}}`. ~9 unique meaningful entries. Each selected legacy takes one slot, cap=2. Unlocked IDs are permanent. Event legacyId adds an eligible candidate this life, not instantly unlocks everything.
- WORLD_FLAGS: map ID to `{name,description}`. Required keys `medicine-valley`, `sword-sect`, `old-tomb`, `soul-debt`, `saved-city`. More allowed with follow-up events.
- EVENTS: `{id,worldId,title,tag,body,requires?:{minRealm?,maxRealm?,pathId?,flag?,notFlag?,worldFlag?,notWorldFlag?},choices:[{id,label,description,cost?:{years?,spirit?,herbs?,hp?,lifeDamage?},requires?:{minRealm?,pathId?,flag?,notFlag?,worldFlag?,notWorldFlag?},chance?:number,result:string,effects?:{cultivation?,spirit?,herbs?,hp?,lifeDamage?,merit?,renown?,itemId?,flag?,worldFlag?,removeWorldFlag?,legacyId?},failure?:{text,effects}}]}`. chance in [0,1]; all extra costs visible. No arbitrary code/functions. At least 45 events, include minimum three explicit cross-life follow-up chains. One occurrence per life; fallback repeatable benign exploration when eligible unseen pool empty. Event costs are in addition to exploration time. Every event has an always-available nonlethal leave/free option. Unknown IDs rejected in content tests.
- ENEMIES: `{id,name,description,hp,attack,defense,intent,worldId}`; target two regular enemies/world and bosses.
- CHALLENGES: `{id,name,description,worldId,minRealm,enemyId,proofId,final?}`. proof IDs `mortal`, `nether`, `celestial`. One per world plus `{id:'finale',final:true,proofId:null,minRealm:5,worldId:'celestial'}`.

## Engine state

`{version:1,rng:number,phase:'adventure'|'event'|'combat'|'ended'|'victory',run,meta,eventId:null|string,combat:null|Combat,summary:null|Summary,lastMessage:string}`.

run: `{name,originId,pathId,age,realmIndex,worldId,cultivation,hp,spirit,herbs,merit,renown,lifeBonus,lifeDamage,elixirsUsed,turn,attackBonus,defenseBonus,hpBonus,breakthroughFailures,items:string[],loadout:{art:string|null,skills:string[],artifact:string|null},flags:string[],visitedEvents:string[],legacyCandidates:string[],selectedLegacies:string[],deeds:string[],log:[{id:number,year:number,age:number,title:string,text:string,kind:string}]}`.

meta: `{generation:number,worldYear:number,legacyIds:string[],proofs:string[],worldFlags:string[],history:Array<{generation,name,age,realmIndex,cause,deeds:string[],log:LogEntry[],selectedLegacyId:null|string}>,victories:number}`. First generation 1; first year 1000; initial age16. Histories capped at50, current log200.

`LogEntry` is `{id:number,year:number,age:number,title:string,text:string,kind:string}`, identical to a current-life journal entry. Each completed life retains at most40 recent key entries: birth, events, failures, world consequences, milestones (including elixirs), ending, and legacy selection. Routine training/rest and individual combat rounds are omitted; victories also remain in `deeds`. Historical log entries have strictly increasing IDs and nondecreasing years/ages; fields, bounds and known kinds are validated before UI access. `history[].selectedLegacyId` records the one legacy unlocked at that settlement, or `null`; selecting a legacy updates the matching current history entry and its journal.

Save version remains1. On import, older v1 history entries missing `log` receive `[]`, and entries missing `selectedLegacyId` receive `null`. For the current ended/victorious life only, an existing `summary.selectedLegacyId` restores the missing historical selection. Unknown past events or choices are never invented; explicitly malformed new fields are rejected, not replaced by migration defaults. Migration acts on the parsed copy and does not write or modify the source backup.

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

## Core invariants

1. Pure functions; effects do not mutate prior save.
2. Pay elapsed time before effects; if time exhausts life, finish before breakthrough/reward. Fuel use cannot resurrect a dead character.
3. Burn never advances world years. Travel and reincarnation do.
4. No arbitrary rewards for retry/retire. Candidate legacies come from events, meaningful realm/path milestones or world deeds.
5. All resources finite/nonnegative; hp clamped to derived max. Action budget cannot go negative to buy a reward.
6. At least one legal progression path to final victory under normal rules. A seeded simulation may establish this, not fabricated test data.
