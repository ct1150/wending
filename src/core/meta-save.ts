import type { ActNumber, LineageId, MetaSave, PastLifeRemnant, RunState, WorldId } from './types';

const META_KEY = 'baishi-wending-roguelike-meta-v1';
const RUN_KEY = 'baishi-wending-roguelike-run-v3';

export function defaultMetaSave(): MetaSave {
  return {
    version: 2,
    totalLives: 0,
    karmaPoints: 0,
    unlockedLineages: ['sword', 'demon'],
    unlockedStartWorlds: ['mortal'],
    unlockedRelics: [],
    achievements: [],
    discoveredCards: [],
    discoveredRelics: [],
    discoveredEnemies: [],
    dailyBestScores: {},
    maxAscensionUnlocked: 0,
    bestActReached: 1,
    victories: 0,
    trueVictories: 0,
    rerollCharges: 2,
    pastLifeRemnant: null,
    hallOfFame: [],
  };
}

export function getUnlockedStartWorlds(meta: MetaSave): WorldId[] {
  const set = new Set<WorldId>(['mortal', ...(meta.unlockedStartWorlds ?? [])]);
  if (meta.bestActReached >= 4) set.add('spirit');
  if (meta.bestActReached >= 7) set.add('immortal');
  return Array.from(set);
}

export function recordActMilestoneInMeta(meta: MetaSave, act: ActNumber): MetaSave {
  const nextBest = Math.max(meta.bestActReached, act);
  const worlds = new Set<WorldId>(getUnlockedStartWorlds(meta));
  if (nextBest >= 4) worlds.add('spirit');
  if (nextBest >= 7) worlds.add('immortal');
  const next: MetaSave = {
    ...meta,
    bestActReached: nextBest,
    unlockedStartWorlds: Array.from(worlds),
  };
  saveMetaSave(next);
  return next;
}

export function loadMetaSave(): MetaSave {
  try {
    const raw = globalThis.localStorage?.getItem(META_KEY);
    if (!raw) return defaultMetaSave();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const merged: MetaSave = { ...defaultMetaSave(), ...parsed };
    merged.unlockedStartWorlds = getUnlockedStartWorlds(merged);
    return merged;
  } catch {
    return defaultMetaSave();
  }
}

export function saveMetaSave(meta: MetaSave): void {
  try {
    globalThis.localStorage?.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}

export function loadActiveRun(): RunState | null {
  try {
    const raw = globalThis.localStorage?.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.deck)) return null;
    parsed.consumables = parsed.consumables ?? [];
    parsed.secondaryMethod = parsed.secondaryMethod ?? null;
    parsed.secondSecondaryMethod = parsed.secondSecondaryMethod ?? null;
    parsed.trueSpirit = parsed.trueSpirit ?? null;
    parsed.supremeLaw = parsed.supremeLaw ?? null;
    parsed.treasureTier = parsed.treasureTier ?? 0;
    parsed.maxConsumables = parsed.maxConsumables ?? 3;
    parsed.shaCorruption = parsed.shaCorruption ?? 0;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveRun(run: RunState | null): void {
  try {
    if (!run) {
      globalThis.localStorage?.removeItem(RUN_KEY);
    } else {
      globalThis.localStorage?.setItem(RUN_KEY, JSON.stringify(run));
    }
  } catch {}
}

export function syncDiscoveriesToMeta(meta: MetaSave, run: RunState): MetaSave {
  const cardSet = new Set(meta.discoveredCards);
  for (const c of run.deck) cardSet.add(c.defId);
  const relicSet = new Set(meta.discoveredRelics);
  for (const r of run.relics) relicSet.add(r);
  const enemySet = new Set(meta.discoveredEnemies);
  if (run.combat) enemySet.add(run.combat.enemy.defId);

  const nextBest = Math.max(meta.bestActReached, run.act);
  const worlds = new Set<WorldId>(getUnlockedStartWorlds({ ...meta, bestActReached: nextBest }));

  const next: MetaSave = {
    ...meta,
    bestActReached: nextBest,
    unlockedStartWorlds: Array.from(worlds),
    discoveredCards: [...cardSet],
    discoveredRelics: [...relicSet],
    discoveredEnemies: [...enemySet],
  };
  saveMetaSave(next);
  return next;
}

export function checkNewAchievements(
  meta: MetaSave,
  run: RunState,
  outcome?: 'victory' | 'true-victory' | 'death',
): string[] {
  const owned = new Set(meta.achievements);
  const unlocked: string[] = [];
  const grant = (id: string) => {
    if (!owned.has(id)) {
      owned.add(id);
      unlocked.push(id);
    }
  };

  if ((run.stats.maxSingleHit ?? 0) >= 75) grant('ach-one-strike-80');
  if ((run.stats.maxPoisonApplied ?? 0) >= 40) grant('ach-poison-50');
  if ((run.stats.maxCardsInSingleTurn ?? 0) >= 7) grant('ach-eight-cards');
  if ((run.stats.tribulationsSlain ?? 0) >= 1) grant('ach-tribulation-slayer');
  if (outcome === 'true-victory') grant('ach-true-ending');
  if ((run.stats.bossesWon ?? 0) >= 1 && run.hp > 0 && run.hp <= 18) {
    grant('ach-dying-boss');
  }
  return unlocked;
}

export function calculateKarmaEarned(run: RunState, outcome: 'victory' | 'true-victory' | 'death'): number {
  const base = run.act * 14 + run.stats.battlesWon * 3 + run.stats.elitesWon * 10 + run.stats.bossesWon * 18;
  const bonus = outcome === 'true-victory' ? 160 : outcome === 'victory' ? 90 : 0;
  const ascBonus = Math.round((base + bonus) * (run.ascension * 0.12));
  return base + bonus + ascBonus;
}

export function settleRunIntoMeta(
  meta: MetaSave,
  run: RunState,
  outcome: 'victory' | 'true-victory' | 'death',
): { nextMeta: MetaSave; karmaEarned: number; remnant: PastLifeRemnant; newAchievements: string[] } {
  const synced = syncDiscoveriesToMeta(meta, run);
  const newAchievements = checkNewAchievements(synced, run, outcome);
  const achBonus = newAchievements.includes('ach-true-ending') ? 150 : newAchievements.length * 15;
  const karmaEarned = calculateKarmaEarned(run, outcome) + achBonus;

  const enchantedOrUpgraded =
    run.deck.find((c) => c.enchant) ??
    run.deck.find((c) => c.upgraded && !c.defId.includes('basic')) ??
    run.deck[0];

  const remnant: PastLifeRemnant = {
    generation: run.generation,
    name: run.name,
    lineage: run.lineage,
    act: Math.min(8, run.act) as ActNumber,
    deathCause: run.deathCause ?? (outcome === 'death' ? '力战道消' : '飞升留蜕'),
    leftCard: enchantedOrUpgraded ? { ...enchantedOrUpgraded } : undefined,
    leftTreasureId: run.treasures[0],
  };

  const dailyBestScores = { ...synced.dailyBestScores };
  if (run.isDailyChallenge && run.dailyDate) {
    const score = karmaEarned * 10 + run.gold + run.maxHp * 3;
    dailyBestScores[run.dailyDate] = Math.max(dailyBestScores[run.dailyDate] ?? 0, score);
  }

  const nextBestAct = Math.max(synced.bestActReached, run.act);
  const worlds = getUnlockedStartWorlds({ ...synced, bestActReached: nextBestAct });

  const nextMeta: MetaSave = {
    ...synced,
    totalLives: synced.totalLives + 1,
    karmaPoints: synced.karmaPoints + karmaEarned,
    achievements: [...new Set([...synced.achievements, ...newAchievements])],
    dailyBestScores,
    bestActReached: nextBestAct,
    unlockedStartWorlds: worlds,
    victories: synced.victories + (outcome === 'victory' || outcome === 'true-victory' ? 1 : 0),
    trueVictories: synced.trueVictories + (outcome === 'true-victory' ? 1 : 0),
    maxAscensionUnlocked:
      outcome === 'victory' || outcome === 'true-victory'
        ? Math.min(9, Math.max(synced.maxAscensionUnlocked, run.ascension + 1))
        : synced.maxAscensionUnlocked,
    pastLifeRemnant: remnant,
    hallOfFame: [
      {
        generation: run.generation,
        name: run.name,
        lineage: run.lineage,
        realm: run.realm,
        maxHp: run.maxHp,
        outcome,
        cause: run.deathCause ?? run.endingTitle ?? '问道飞升',
        karmaEarned,
      },
      ...synced.hallOfFame,
    ].slice(0, 30),
  };

  saveMetaSave(nextMeta);
  saveActiveRun(null);
  return { nextMeta, karmaEarned, remnant, newAchievements };
}

export function unlockLineageInMeta(meta: MetaSave, lineage: LineageId, cost: number): MetaSave | null {
  if (meta.unlockedLineages.includes(lineage) || meta.karmaPoints < cost) return null;
  const next: MetaSave = {
    ...meta,
    karmaPoints: meta.karmaPoints - cost,
    unlockedLineages: [...meta.unlockedLineages, lineage],
  };
  saveMetaSave(next);
  return next;
}

export function buyRerollUpgradeInMeta(meta: MetaSave): MetaSave | null {
  const cost = 35 + meta.rerollCharges * 20;
  if (meta.karmaPoints < cost || meta.rerollCharges >= 6) return null;
  const next: MetaSave = {
    ...meta,
    karmaPoints: meta.karmaPoints - cost,
    rerollCharges: meta.rerollCharges + 1,
  };
  saveMetaSave(next);
  return next;
}
