import { CARDS, getUnlockedRewardCardPool } from '../content/cards';
import { CONSUMABLE_LIST, CONSUMABLES } from '../content/consumables';
import { pickEncounter } from '../content/encounters';
import { pickEnemyForNode } from '../content/enemies';
import { getRootById, LINEAGES, ROOTS } from '../content/lineages';
import { DAILY_MUTATORS, getTodayDateKey, SECONDARY_METHOD_LIST, SECONDARY_METHODS } from '../content/methods';
import {
  ENCHANT_LIST,
  ENCHANTS,
  getMythicTreasures,
  getUnlockedRelicList,
  LAW_RELIC_LIST,
  RELICS,
  TREASURE_LIST,
} from '../content/treasures';
import { initCombat } from './combat-engine';
import { generateActMap, getReachableNodeIds } from './map-generator';
import { saveActiveRun } from './meta-save';
import { hashSeed, SeededRng } from './rng';
import type {
  AuctionLot,
  BlessingOption,
  BreakthroughGrade,
  CardDef,
  CardInstance,
  EnchantId,
  LineageId,
  MetaSave,
  RealmId,
  RelicDef,
  RewardState,
  RunState,
  SecondaryMethodId,
  ShopStock,
} from './types';

function hasRelicHook(run: RunState, hook: string): number {
  let total = 0;
  for (const id of run.relics) {
    const def = RELICS[id];
    if (def && def.hook === hook) total += def.value;
  }
  return total;
}

function grantRelicWithPickupEffect(run: RunState, relicId: string): void {
  if (run.relics.includes(relicId)) return;
  run.relics.push(relicId);
  const def = RELICS[relicId];
  if (def?.hook === 'maxhp-pickup') {
    run.maxHp += def.value;
    run.hp += def.value;
  }
}

export function rollRandomRoot(seed: number): string {
  const rng = new SeededRng(seed);
  return rng.pick(ROOTS).id;
}

export function getDailyChallengeConfig(dateKey = getTodayDateKey()) {
  const seed = hashSeed(`daily-${dateKey}`);
  const rng = new SeededRng(seed);
  const muts = rng.shuffle(DAILY_MUTATORS).slice(0, 2);
  const root = rng.pick(ROOTS);
  return { dateKey, seed, mutators: muts, rootId: root.id };
}

export const STARTING_BLESSINGS: BlessingOption[] = [
  {
    id: 'gold',
    title: '豪门遗泽 · 灵石充盈',
    costText: '无代价',
    rewardText: '立即获得 +85 灵石与 1 枚随机【乾坤丹符】',
  },
  {
    id: 'purge-two',
    title: '涤尘净心 · 剑心纯粹',
    costText: '无代价',
    rewardText: '立即精简删去牌库中 2 张基础牌，永久提升 8 点最大气血',
  },
  {
    id: 'gamble-relic',
    title: '逆天豪赌 · 献祭本源',
    costText: '代价：扣除 14 点最大气血上限',
    rewardText: '立即获得 1 件随机【古宝遗物】+ 1 份【附魔灵材】',
  },
  {
    id: 'mythic-treasure',
    title: '重铸本命 · 绝世仙器',
    costText: '代价：交出初始本命法宝',
    rewardText: '直接换取 1 件【绝世神话本命法宝】（定义整局邪道流派！）',
  },
];

export function createNewRun(params: {
  name: string;
  lineage: LineageId;
  rootId: string;
  seed: number;
  ascension: number;
  meta: MetaSave;
  skipBlessing?: boolean;
  isDailyChallenge?: boolean;
  dailyDate?: string;
  mutators?: string[];
}): RunState {
  const rng = new SeededRng(params.seed);
  const lin = LINEAGES[params.lineage];
  const root = getRootById(params.rootId);
  const muts = params.mutators ?? [];

  let uid = 1;
  const deck: CardInstance[] = lin.starterDeck.map((defId) => ({
    uid: `c-${uid++}`,
    defId,
    upgraded: false,
  }));

  const shortCandleLoss = muts.includes('mut-short-candle') ? 18 : 0;
  const maxHp = Math.max(35, lin.baseHp + (root.bonusMaxHp ?? 0) - params.ascension * 2 - shortCandleLoss);
  const map = generateActMap(1, rng, params.meta.pastLifeRemnant);

  const consumables: string[] = [];
  let gold = 60;

  if (muts.includes('mut-alchemy-boom')) {
    for (let i = 0; i < 3; i++) consumables.push(rng.pick(CONSUMABLE_LIST).id);
  } else {
    consumables.push(rng.pick(['con-heal-pill', 'con-wind-redraw', 'con-frost-talisman']));
  }

  const run: RunState = {
    version: 2,
    seed: params.seed,
    rngState: rng.state,
    generation: params.meta.totalLives + 1,
    ascension: params.ascension,
    name: params.name.trim() || '云归',
    lineage: params.lineage,
    secondaryMethod: null,
    rootId: root.id,
    act: 1,
    realm: 'qi',
    hp: maxHp,
    maxHp,
    baseQi: 3,
    gold,
    daoTokens: 0,
    deck,
    treasures: [lin.starterTreasureId],
    relics: [],
    materials: [],
    consumables: consumables.slice(0, 3),
    blessingOptions: params.skipBlessing ? undefined : STARTING_BLESSINGS,
    isDailyChallenge: params.isDailyChallenge,
    dailyDate: params.dailyDate,
    mutators: muts,
    map,
    currentNodeId: null,
    phase: params.skipBlessing ? 'map' : 'blessing',
    combat: null,
    reward: null,
    activeEvent: null,
    eventResultText: null,
    shop: null,
    auction: null,
    abodeUsed: false,
    stats: {
      battlesWon: 0,
      elitesWon: 0,
      bossesWon: 0,
      cardsPlayed: 0,
      maxCardsInSingleTurn: 0,
      maxSingleHit: 0,
      maxPoisonApplied: 0,
      resonancesTriggered: 0,
      hpSacrificed: 0,
      tribulationsSlain: 0,
    },
    uidCounter: uid,
  };

  if (muts.includes('mut-short-candle')) {
    run.gold += 100;
    const pool = getUnlockedRelicList(params.meta.achievements);
    for (const r of rng.shuffle(pool).slice(0, 2)) grantRelicWithPickupEffect(run, r.id);
  }

  saveActiveRun(run);
  return run;
}

export function chooseStartingBlessing(run: RunState, optionId: BlessingOption['id'], meta?: MetaSave): RunState {
  if (run.phase !== 'blessing') return run;
  const nextRun: RunState = structuredClone(run);
  const rng = new SeededRng(nextRun.rngState);

  if (optionId === 'gold') {
    nextRun.gold += 85;
    if (nextRun.consumables.length < 3) nextRun.consumables.push(rng.pick(CONSUMABLE_LIST).id);
  } else if (optionId === 'purge-two') {
    let removed = 0;
    nextRun.deck = nextRun.deck.filter((c) => {
      if (removed < 2 && CARDS[c.defId]?.rarity === 'starter') {
        removed += 1;
        return false;
      }
      return true;
    });
    nextRun.maxHp += 8;
    nextRun.hp += 8;
  } else if (optionId === 'gamble-relic') {
    nextRun.maxHp = Math.max(30, nextRun.maxHp - 14);
    nextRun.hp = Math.min(nextRun.hp, nextRun.maxHp);
    const rel = pickNewRelic(nextRun, rng, meta?.achievements);
    if (rel) grantRelicWithPickupEffect(nextRun, rel.id);
    nextRun.materials.push(rng.pick(ENCHANT_LIST).id);
  } else if (optionId === 'mythic-treasure') {
    const mythics = getMythicTreasures();
    nextRun.treasures = [rng.pick(mythics).id];
  }

  nextRun.blessingOptions = undefined;
  nextRun.phase = 'map';
  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

export function rollCardChoices(
  run: RunState,
  rng: SeededRng,
  count = 3,
  forcedRarity?: CardDef['rarity'],
  achievements: string[] = [],
): CardDef[] {
  const root = getRootById(run.rootId);
  const allSchools = run.mutators?.includes('mut-all-schools');
  const unlockedOffLineage = run.secondaryMethod ? SECONDARY_METHODS[run.secondaryMethod]?.unlockLineage : null;

  const basePool = getUnlockedRewardCardPool(achievements);
  const eligible = basePool.filter((c) => {
    if (forcedRarity && c.rarity !== forcedRarity) return false;
    if (allSchools) return true;
    return c.lineage === run.lineage || c.lineage === 'neutral' || (unlockedOffLineage && c.lineage === unlockedOffLineage);
  });
  const pool = eligible.length >= count ? eligible : basePool;
  const picked: CardDef[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count && used.size < pool.length; i++) {
    const candidates = pool.filter((c) => !used.has(c.id));
    const card = rng.weightedPick(candidates, (c) => {
      let w = c.lineage === run.lineage ? 30 : c.lineage === unlockedOffLineage ? 24 : 12;
      if (c.element !== 'none' && root.elements.includes(c.element)) w += 12;
      if (c.rarity === 'mythic') w *= run.act >= 2 ? 0.52 : 0.22;
      if (c.rarity === 'rare') w *= run.act >= 2 ? 0.85 : 0.55;
      return w;
    });
    picked.push(card);
    used.add(card.id);
  }
  return picked;
}

function pickNewRelic(run: RunState, rng: SeededRng, achievements: string[] = []): RelicDef | undefined {
  const avail = getUnlockedRelicList(achievements).filter((r) => !run.relics.includes(r.id));
  if (avail.length === 0) return undefined;
  return rng.pick(avail);
}

function rollSecondaryMethodChoices(run: RunState, rng: SeededRng): typeof SECONDARY_METHOD_LIST {
  const candidates = SECONDARY_METHOD_LIST.filter((m) => m.unlockLineage !== run.lineage);
  return rng.shuffle(candidates).slice(0, 3);
}

function buildShopStock(run: RunState, rng: SeededRng, achievements: string[] = []): ShopStock {
  const discount = run.mutators?.includes('mut-alchemy-boom') ? 0.7 : 1;
  const priceOf = (p: number) => Math.round(p * discount);

  const cards = rollCardChoices(run, rng, 4, undefined, achievements).map((def) => ({
    def,
    price: priceOf(def.rarity === 'mythic' ? 110 : def.rarity === 'rare' ? 75 : 45),
    sold: false,
  }));
  const availRelics = getUnlockedRelicList(achievements).filter((r) => !run.relics.includes(r.id));
  const relics = rng.shuffle(availRelics).slice(0, 2).map((def) => ({
    def,
    price: priceOf(def.rarity === 'mythic' ? 145 : def.rarity === 'rare' ? 115 : 80),
    sold: false,
  }));
  const materials = rng.shuffle(ENCHANT_LIST).slice(0, 2).map((def) => ({
    def,
    price: priceOf(62),
    sold: false,
  }));
  const consumables = rng.shuffle(CONSUMABLE_LIST).slice(0, 2).map((def) => ({
    def,
    price: priceOf(def.price),
    sold: false,
  }));
  return {
    cards,
    relics,
    materials,
    consumables,
    purgePrice: priceOf(55),
    purged: false,
    elixirPrice: priceOf(60),
    elixirBought: false,
  };
}

function buildAuctionLots(run: RunState, rng: SeededRng, achievements: string[] = []): AuctionLot[] {
  const mythicCard = rollCardChoices(run, rng, 1, 'mythic', achievements)[0] ?? rollCardChoices(run, rng, 1)[0];
  const rareRelic = pickNewRelic(run, rng, achievements);
  const lots: AuctionLot[] = [
    {
      id: 'lot-card',
      name: `孤本绝学 · ${mythicCard.name}`,
      description: mythicCard.description,
      price: 85,
      kind: 'card',
      refId: mythicCard.id,
      claimed: false,
    },
    {
      id: 'lot-maxhp',
      name: '压轴宝药 · 千年紫金龙血果',
      description: '永久提升 18 点最大气血上限，并瞬间回满全部气血！',
      price: 90,
      kind: 'maxhp',
      refId: 'maxhp',
      claimed: false,
    },
  ];
  if (rareRelic) {
    lots.push({
      id: 'lot-relic',
      name: `古修遗珍 · ${rareRelic.name}`,
      description: rareRelic.description,
      price: 95,
      kind: 'relic',
      refId: rareRelic.id,
      claimed: false,
    });
  }
  return lots;
}

export function enterMapNode(run: RunState, nodeId: string, achievements: string[] = []): RunState {
  if (run.phase !== 'map') return run;
  const reachable = getReachableNodeIds(run.map, run.currentNodeId);
  if (!reachable.includes(nodeId)) return run;

  const nextRun: RunState = structuredClone(run);
  const node = nextRun.map.find((n) => n.id === nodeId);
  if (!node) return run;

  node.visited = true;
  nextRun.currentNodeId = node.id;

  const rng = new SeededRng(nextRun.rngState);

  if (node.type === 'battle' || node.type === 'elite' || node.type === 'fury-elite' || node.type === 'boss') {
    const tier = node.type === 'battle' ? 'normal' : node.type === 'fury-elite' ? 'elite' : node.type;
    const enemy = pickEnemyForNode(nextRun.act, tier, () => rng.next());
    nextRun.rngState = rng.state;
    const inCombat = initCombat(nextRun, enemy, node.type);
    saveActiveRun(inCombat);
    return inCombat;
  }

  if (node.type === 'event') {
    nextRun.activeEvent = pickEncounter(nextRun.act, () => rng.next());
    nextRun.eventResultText = null;
    nextRun.phase = 'event';
  } else if (node.type === 'abode') {
    nextRun.abodeUsed = false;
    const abodeHeal = hasRelicHook(nextRun, 'abode-heal');
    if (abodeHeal > 0) nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + abodeHeal);
    nextRun.phase = 'abode';
  } else if (node.type === 'shop') {
    nextRun.shop = buildShopStock(nextRun, rng, achievements);
    nextRun.phase = 'shop';
  } else if (node.type === 'auction') {
    nextRun.auction = { lots: buildAuctionLots(nextRun, rng, achievements), settled: false };
    nextRun.phase = 'auction';
  } else if (node.type === 'remnant') {
    nextRun.phase = 'remnant';
  }

  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

export function resolveCombatVictory(run: RunState, achievements: string[] = []): RunState {
  if (!run.combat || (run.combat.outcome !== 'victory' && run.combat.outcome !== 'tribulation-survived')) {
    return run;
  }
  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  const rng = new SeededRng(nextRun.rngState);

  const isEliteLike = combat.nodeType === 'elite' || combat.nodeType === 'fury-elite';
  nextRun.stats.battlesWon += 1;
  if (isEliteLike) nextRun.stats.elitesWon += 1;
  if (combat.nodeType === 'boss') nextRun.stats.bossesWon += 1;

  const postHeal = hasRelicHook(nextRun, 'heal-after-battle');
  if (postHeal > 0) nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + postHeal);

  const goldMult = 1 + hasRelicHook(nextRun, 'gold-magnet') / 100;
  const baseGold =
    combat.nodeType === 'boss' ? 78 : combat.nodeType === 'fury-elite' ? 65 : isEliteLike ? 46 : 24;
  const gold = Math.round((baseGold + rng.int(0, 12)) * goldMult);
  nextRun.gold += gold;

  if (combat.nodeType === 'boss' && nextRun.act === 4) {
    nextRun.combat = null;
    nextRun.realm = 'ascended';
    nextRun.phase = 'victory';
    nextRun.endingTitle = '百世问鼎 · 斩破太初天道（真结局）';
    saveActiveRun(nextRun);
    return nextRun;
  }

  if (combat.nodeType === 'boss' && nextRun.act === 3 && nextRun.daoTokens < 2) {
    nextRun.combat = null;
    nextRun.realm = 'ascended';
    nextRun.phase = 'victory';
    nextRun.endingTitle = '飞升登仙 · 凌霄证道';
    saveActiveRun(nextRun);
    return nextRun;
  }

  const reward: RewardState = {
    gold,
    cardChoices: rollCardChoices(nextRun, rng, 3, undefined, achievements),
    pickedCard: false,
    pickedRelic: false,
    pickedTreasure: false,
    pickedMaterial: false,
    pickedConsumable: false,
  };

  if (isEliteLike || rng.next() < 0.45) {
    reward.consumableReward = rng.pick(CONSUMABLE_LIST);
  }

  if (isEliteLike) {
    reward.relicReward = pickNewRelic(nextRun, rng, achievements);
    reward.materialReward = rng.pick(ENCHANT_LIST);
    if (combat.nodeType === 'fury-elite') {
      nextRun.daoTokens += 1;
      reward.daoTokenGained = true;
    }
    const unownedTreasures = Object.values(TREASURE_LIST).filter((t) => !nextRun.treasures.includes(t.id));
    if (nextRun.treasures.length < 2 && unownedTreasures.length > 0 && rng.next() < 0.55) {
      reward.treasureReward = rng.pick(unownedTreasures);
    }
  }

  if (combat.nodeType === 'boss') {
    reward.isBossReward = true;
    // 直观的天道破境条件：渡劫结束时气血 ≥ 50%，或直接劈碎雷劫劫眼！
    const isHeaven =
      nextRun.hp >= nextRun.maxHp * 0.5 ||
      (combat.enemy.tier === 'tribulation' && combat.outcome === 'victory');
    const grade: BreakthroughGrade = isHeaven ? 'heaven' : 'earth';
    reward.breakthroughGrade = grade;

    const maxHpGain = grade === 'heaven' ? 18 : 10;
    reward.maxHpGained = maxHpGain;
    nextRun.maxHp += maxHpGain;
    nextRun.hp = nextRun.maxHp;

    if (grade === 'heaven') {
      nextRun.baseQi += 1;
      const availLaws = LAW_RELIC_LIST.filter((r) => !nextRun.relics.includes(r.id));
      reward.lawChoices = rng.shuffle(availLaws).slice(0, 3);
      reward.pickedLaw = false;
    }

    if (!nextRun.secondaryMethod) {
      reward.methodChoices = rollSecondaryMethodChoices(nextRun, rng);
      reward.pickedMethod = false;
    }

    reward.relicReward = pickNewRelic(nextRun, rng, achievements);
    reward.materialReward = rng.pick(ENCHANT_LIST);
    reward.consumableReward = rng.pick(CONSUMABLE_LIST);
    if (combat.enemy.tier === 'tribulation' && combat.outcome === 'victory') {
      nextRun.daoTokens += 1;
      reward.daoTokenGained = true;
    }
  }

  nextRun.combat = null;
  nextRun.reward = reward;
  nextRun.phase = combat.nodeType === 'boss' ? 'breakthrough' : 'reward';
  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimRewardCard(run: RunState, cardDefId: string): RunState {
  if (!run.reward || run.reward.pickedCard) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.uidCounter += 1;
  nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: cardDefId, upgraded: false });
  nextRun.reward!.pickedCard = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimRewardRelic(run: RunState): RunState {
  if (!run.reward?.relicReward || run.reward.pickedRelic) return run;
  const nextRun: RunState = structuredClone(run);
  grantRelicWithPickupEffect(nextRun, nextRun.reward!.relicReward!.id);
  nextRun.reward!.pickedRelic = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimRewardMaterial(run: RunState): RunState {
  if (!run.reward?.materialReward || run.reward.pickedMaterial) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.materials.push(nextRun.reward!.materialReward!.id);
  nextRun.reward!.pickedMaterial = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimRewardConsumable(run: RunState): RunState {
  if (!run.reward?.consumableReward || run.reward.pickedConsumable) return run;
  const nextRun: RunState = structuredClone(run);
  const cid = nextRun.reward!.consumableReward!.id;
  if (nextRun.consumables.length < 3) nextRun.consumables.push(cid);
  else nextRun.consumables[2] = cid;
  nextRun.reward!.pickedConsumable = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimRewardTreasure(run: RunState): RunState {
  if (!run.reward?.treasureReward || run.reward.pickedTreasure) return run;
  const nextRun: RunState = structuredClone(run);
  const tid = nextRun.reward!.treasureReward!.id;
  if (nextRun.treasures.length < 2) nextRun.treasures.push(tid);
  else nextRun.treasures[1] = tid;
  nextRun.reward!.pickedTreasure = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimSecondaryMethod(run: RunState, methodId: SecondaryMethodId): RunState {
  if (!run.reward?.methodChoices || run.reward.pickedMethod) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.secondaryMethod = methodId;
  nextRun.reward!.pickedMethod = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimBreakthroughLaw(run: RunState, lawId: string): RunState {
  if (!run.reward?.lawChoices || run.reward.pickedLaw) return run;
  const nextRun: RunState = structuredClone(run);
  grantRelicWithPickupEffect(nextRun, lawId);
  nextRun.reward!.pickedLaw = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function finishRewardAndAdvance(run: RunState, meta: MetaSave): RunState {
  const nextRun: RunState = structuredClone(run);
  const wasBoss = Boolean(nextRun.reward?.isBossReward);
  nextRun.reward = null;

  if (wasBoss && nextRun.act < 4) {
    const nextAct = (nextRun.act + 1) as 2 | 3 | 4;
    const realmMap: Record<2 | 3 | 4, RealmId> = { 2: 'foundation', 3: 'core', 4: 'nascent' };
    nextRun.act = nextAct;
    nextRun.realm = realmMap[nextAct];
    const rng = new SeededRng(nextRun.rngState);
    nextRun.map = generateActMap(nextAct, rng, meta.pastLifeRemnant);
    nextRun.currentNodeId = null;
    nextRun.rngState = rng.state;
  }

  nextRun.phase = 'map';
  saveActiveRun(nextRun);
  return nextRun;
}

export function auctionBuyLot(run: RunState, lotId: string): RunState {
  if (run.phase !== 'auction' || !run.auction) return run;
  const lot = run.auction.lots.find((l) => l.id === lotId);
  if (!lot || lot.claimed || run.gold < lot.price) return run;

  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= lot.price;
  const target = nextRun.auction!.lots.find((l) => l.id === lotId)!;
  target.claimed = true;

  if (target.kind === 'card') {
    nextRun.uidCounter += 1;
    nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: target.refId, upgraded: true });
  } else if (target.kind === 'relic') {
    grantRelicWithPickupEffect(nextRun, target.refId);
  } else if (target.kind === 'maxhp') {
    nextRun.maxHp += 18;
    nextRun.hp = nextRun.maxHp;
  }

  saveActiveRun(nextRun);
  return nextRun;
}

export function auctionAmbushBuyer(run: RunState): RunState {
  if (run.phase !== 'auction' || !run.auction) return run;
  const nextRun: RunState = structuredClone(run);
  const rng = new SeededRng(nextRun.rngState);

  const unclaimed = nextRun.auction!.lots.find((l) => !l.claimed);
  if (unclaimed) {
    unclaimed.claimed = true;
    if (unclaimed.kind === 'card') {
      nextRun.uidCounter += 1;
      nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: unclaimed.refId, upgraded: true });
    } else if (unclaimed.kind === 'relic') {
      grantRelicWithPickupEffect(nextRun, unclaimed.refId);
    } else if (unclaimed.kind === 'maxhp') {
      nextRun.maxHp += 18;
      nextRun.hp = nextRun.maxHp;
    }
  }
  nextRun.auction = null;
  const enemy = pickEnemyForNode(nextRun.act, 'elite', () => rng.next());
  nextRun.rngState = rng.state;
  const inCombat = initCombat(nextRun, enemy, 'fury-elite');
  saveActiveRun(inCombat);
  return inCombat;
}

export function abodeUpgradeOrEnchant(run: RunState, cardUid: string, enchantId?: EnchantId): RunState {
  if (run.phase !== 'abode' || run.abodeUsed) return run;
  const nextRun: RunState = structuredClone(run);
  const card = nextRun.deck.find((c) => c.uid === cardUid);
  if (!card) return run;

  card.upgraded = true;
  if (enchantId) {
    const mIdx = nextRun.materials.indexOf(enchantId);
    if (mIdx >= 0) {
      nextRun.materials.splice(mIdx, 1);
      card.enchant = enchantId;
    }
  }
  nextRun.abodeUsed = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function abodeBrewElixir(run: RunState, mode: 'steady' | 'bold'): { nextRun: RunState; message: string } {
  if (run.phase !== 'abode' || run.abodeUsed) return { nextRun: run, message: '' };
  const nextRun: RunState = structuredClone(run);
  const rng = new SeededRng(nextRun.rngState);
  let message = '';

  if (mode === 'steady') {
    const heal = Math.round(nextRun.maxHp * 0.4);
    nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + heal);
    if (nextRun.consumables.length < 3) {
      const bonusPill = rng.pick(CONSUMABLE_LIST.filter((c) => c.kind === 'pill'));
      nextRun.consumables.push(bonusPill.id);
      message = `文火成丹！恢复 ${heal} 点气血，并随炉凝出 1 枚【${bonusPill.name}】入袋！`;
    } else {
      message = `文火成丹！恢复 ${heal} 点气血。`;
    }
  } else {
    const roll = rng.next();
    if (roll < 0.68) {
      nextRun.maxHp += 12;
      nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 22);
      message = '丹云蔽日，九转金丹成！最大气血永久 +12，并恢复 22 点气血！';
    } else {
      nextRun.hp = Math.max(1, nextRun.hp - 10);
      nextRun.uidCounter += 1;
      nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: 'curse-whisper', upgraded: false });
      message = '猛火炸炉！灼伤 10 点气血，并引来 1 张【心魔低语】。';
    }
  }

  nextRun.abodeUsed = true;
  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return { nextRun, message };
}

export function abodePurgeCard(run: RunState, cardUid: string): RunState {
  if (run.phase !== 'abode' || run.abodeUsed || run.deck.length <= 5) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.deck = nextRun.deck.filter((c) => c.uid !== cardUid);
  nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 6);
  nextRun.abodeUsed = true;
  saveActiveRun(nextRun);
  return nextRun;
}

export function leaveSubSceneToMap(run: RunState): RunState {
  const nextRun: RunState = structuredClone(run);
  nextRun.phase = 'map';
  nextRun.activeEvent = null;
  nextRun.eventResultText = null;
  nextRun.shop = null;
  nextRun.auction = null;
  saveActiveRun(nextRun);
  return nextRun;
}

export function chooseEncounterOption(run: RunState, choiceId: string, achievements: string[] = []): RunState {
  if (run.phase !== 'event' || !run.activeEvent) return run;
  const choice = run.activeEvent.choices.find((c) => c.id === choiceId);
  if (!choice) return run;
  if (choice.goldCost && run.gold < choice.goldCost) return run;

  const nextRun: RunState = structuredClone(run);
  const rng = new SeededRng(nextRun.rngState);

  if (choice.goldCost) nextRun.gold -= choice.goldCost;
  if (choice.hpCost) nextRun.hp = Math.max(1, nextRun.hp - choice.hpCost);
  if (choice.maxHpCost) {
    nextRun.maxHp = Math.max(20, nextRun.maxHp - choice.maxHpCost);
    nextRun.hp = Math.min(nextRun.hp, nextRun.maxHp);
  }

  const e = choice.effect;
  if (e.gold) nextRun.gold += e.gold;
  if (e.maxHp) {
    nextRun.maxHp += e.maxHp;
    nextRun.hp += e.maxHp;
  }
  if (e.hp) nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + e.hp);
  if (e.addRandomCard) {
    const picked = rollCardChoices(nextRun, rng, 1, e.addRandomCard, achievements)[0];
    if (picked) {
      nextRun.uidCounter += 1;
      nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: picked.id, upgraded: false });
    }
  }
  if (e.addSpecificCard && CARDS[e.addSpecificCard]) {
    nextRun.uidCounter += 1;
    nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: e.addSpecificCard, upgraded: false });
  }
  if (e.addCurse) {
    nextRun.uidCounter += 1;
    nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: e.addCurse, upgraded: false });
  }
  if (e.addRelic) {
    const rel = pickNewRelic(nextRun, rng, achievements);
    if (rel) grantRelicWithPickupEffect(nextRun, rel.id);
  }
  if (e.addMaterial) {
    nextRun.materials.push(e.addMaterial);
  }
  if (e.addConsumable) {
    const con = rng.pick(CONSUMABLE_LIST);
    if (nextRun.consumables.length < 3) nextRun.consumables.push(con.id);
    else nextRun.consumables[2] = con.id;
  }
  if (e.removeRandomCard && nextRun.deck.length > 5) {
    const starterIdx = nextRun.deck.findIndex((c) => CARDS[c.defId]?.rarity === 'starter');
    nextRun.deck.splice(starterIdx >= 0 ? starterIdx : 0, 1);
  }
  if (e.gainDaoToken) {
    nextRun.daoTokens += 1;
  }

  if (e.offerSecondaryMethod && !nextRun.secondaryMethod) {
    nextRun.activeEvent = null;
    nextRun.reward = {
      gold: 0,
      cardChoices: rollCardChoices(nextRun, rng, 3, undefined, achievements),
      methodChoices: rollSecondaryMethodChoices(nextRun, rng),
      pickedMethod: false,
      pickedCard: false,
      pickedRelic: false,
      pickedTreasure: false,
      pickedMaterial: false,
    };
    nextRun.phase = 'reward';
    nextRun.rngState = rng.state;
    saveActiveRun(nextRun);
    return nextRun;
  }

  nextRun.eventResultText = `已择「${choice.label}」：${choice.rewardText}`;
  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopBuyCard(run: RunState, index: number): RunState {
  if (!run.shop || !run.shop.cards[index] || run.shop.cards[index].sold) return run;
  const item = run.shop.cards[index];
  if (run.gold < item.price) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= item.price;
  nextRun.shop!.cards[index].sold = true;
  nextRun.uidCounter += 1;
  nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: item.def.id, upgraded: false });
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopBuyRelic(run: RunState, index: number): RunState {
  if (!run.shop || !run.shop.relics[index] || run.shop.relics[index].sold) return run;
  const item = run.shop.relics[index];
  if (run.gold < item.price) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= item.price;
  nextRun.shop!.relics[index].sold = true;
  grantRelicWithPickupEffect(nextRun, item.def.id);
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopBuyMaterial(run: RunState, index: number): RunState {
  if (!run.shop || !run.shop.materials[index] || run.shop.materials[index].sold) return run;
  const item = run.shop.materials[index];
  if (run.gold < item.price) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= item.price;
  nextRun.shop!.materials[index].sold = true;
  nextRun.materials.push(item.def.id);
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopBuyConsumable(run: RunState, index: number): RunState {
  if (!run.shop || !run.shop.consumables[index] || run.shop.consumables[index].sold) return run;
  const item = run.shop.consumables[index];
  if (run.gold < item.price || run.consumables.length >= 3) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= item.price;
  nextRun.shop!.consumables[index].sold = true;
  nextRun.consumables.push(item.def.id);
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopBuyElixir(run: RunState): RunState {
  if (!run.shop || run.shop.elixirBought || run.gold < run.shop.elixirPrice) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= nextRun.shop!.elixirPrice;
  nextRun.shop!.elixirBought = true;
  nextRun.maxHp += 10;
  nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 25);
  saveActiveRun(nextRun);
  return nextRun;
}

export function shopPurgeCard(run: RunState, cardUid: string): RunState {
  if (!run.shop || run.shop.purged || run.gold < run.shop.purgePrice || run.deck.length <= 5) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= nextRun.shop!.purgePrice;
  nextRun.shop!.purged = true;
  nextRun.deck = nextRun.deck.filter((c) => c.uid !== cardUid);
  saveActiveRun(nextRun);
  return nextRun;
}

export function claimPastLifeRemnant(run: RunState, meta: MetaSave, mode: 'card' | 'treasure' | 'enlighten'): RunState {
  if (run.phase !== 'remnant' || !meta.pastLifeRemnant) return run;
  const nextRun: RunState = structuredClone(run);
  const rem = meta.pastLifeRemnant;

  if (mode === 'card' && rem.leftCard) {
    nextRun.uidCounter += 1;
    nextRun.deck.push({ ...rem.leftCard, uid: `rem-${nextRun.uidCounter}` });
  } else if (mode === 'treasure' && rem.leftTreasureId) {
    if (!nextRun.treasures.includes(rem.leftTreasureId)) {
      if (nextRun.treasures.length < 2) nextRun.treasures.push(rem.leftTreasureId);
      else nextRun.treasures[1] = rem.leftTreasureId;
    }
  } else {
    nextRun.maxHp += 15;
    nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 30);
  }

  nextRun.phase = 'map';
  saveActiveRun(nextRun);
  return nextRun;
}

export { ENCHANTS, CONSUMABLES };
