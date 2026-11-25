import type { LineageId, MetaSave, PastLifeRemnant, RunState } from './types';

const META_KEY = 'baishi-wending-roguelike-meta-v1';
const RUN_KEY = 'baishi-wending-roguelike-run-v1';

export function defaultMetaSave(): MetaSave {
  return {
    version: 1,
    totalLives: 0,
    karmaPoints: 0,
    unlockedLineages: ['sword', 'demon'],
    unlockedRelics: [],
    maxAscensionUnlocked: 0,
    bestActReached: 1,
    victories: 0,
    trueVictories: 0,
    rerollCharges: 2,
    pastLifeRemnant: null,
    hallOfFame: [],
  };
}

export function loadMetaSave(): MetaSave {
  try {
    const raw = globalThis.localStorage?.getItem(META_KEY);
    if (!raw) return defaultMetaSave();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    return { ...defaultMetaSave(), ...parsed };
  } catch {
    return defaultMetaSave();
  }
}

export function saveMetaSave(meta: MetaSave): void {
  try {
    globalThis.localStorage?.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function loadActiveRun(): RunState | null {
  try {
    const raw = globalThis.localStorage?.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.deck)) return null;
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
  } catch {
    // Ignore storage errors
  }
}

export function calculateKarmaEarned(run: RunState, outcome: 'victory' | 'true-victory' | 'death'): number {
  const base = run.act * 18 + run.stats.battlesWon * 3 + run.stats.elitesWon * 10 + run.stats.bossesWon * 20;
  const bonus = outcome === 'true-victory' ? 120 : outcome === 'victory' ? 65 : 0;
  const ascBonus = Math.round((base + bonus) * (run.ascension * 0.12));
  return base + bonus + ascBonus;
}

export function settleRunIntoMeta(
  meta: MetaSave,
  run: RunState,
  outcome: 'victory' | 'true-victory' | 'death',
): { nextMeta: MetaSave; karmaEarned: number; remnant: PastLifeRemnant } {
  const karmaEarned = calculateKarmaEarned(run, outcome);
  const enchantedOrUpgraded =
    run.deck.find((c) => c.enchant) ??
    run.deck.find((c) => c.upgraded && !c.defId.includes('basic')) ??
    run.deck[0];

  const remnant: PastLifeRemnant = {
    generation: run.generation,
    name: run.name,
    lineage: run.lineage,
    act: Math.min(3, run.act) as 1 | 2 | 3,
    deathCause: run.deathCause ?? (outcome === 'death' ? '寿尽坐化' : '飞升留蜕'),
    leftCard: enchantedOrUpgraded ? { ...enchantedOrUpgraded } : undefined,
    leftTreasureId: run.treasures[0],
  };

  const nextMeta: MetaSave = {
    ...meta,
    totalLives: meta.totalLives + 1,
    karmaPoints: meta.karmaPoints + karmaEarned,
    bestActReached: Math.max(meta.bestActReached, run.act),
    victories: meta.victories + (outcome === 'victory' || outcome === 'true-victory' ? 1 : 0),
    trueVictories: meta.trueVictories + (outcome === 'true-victory' ? 1 : 0),
    maxAscensionUnlocked:
      outcome === 'victory' || outcome === 'true-victory'
        ? Math.min(9, Math.max(meta.maxAscensionUnlocked, run.ascension + 1))
        : meta.maxAscensionUnlocked,
    pastLifeRemnant: remnant,
    hallOfFame: [
      {
        generation: run.generation,
        name: run.name,
        lineage: run.lineage,
        realm: run.realm,
        age: Math.round(run.age),
        outcome,
        cause: run.deathCause ?? run.endingTitle ?? '问道飞升',
        karmaEarned,
      },
      ...meta.hallOfFame,
    ].slice(0, 30),
  };

  saveMetaSave(nextMeta);
  saveActiveRun(null);
  return { nextMeta, karmaEarned, remnant };
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
