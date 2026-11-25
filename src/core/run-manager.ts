import { CARDS, REWARD_CARD_POOL } from '../content/cards';
import { pickEncounter } from '../content/encounters';
import { pickEnemyForNode } from '../content/enemies';
import { getRootById, LINEAGES, ROOTS } from '../content/lineages';
import { ENCHANT_LIST, ENCHANTS, LAW_RELIC_LIST, RELIC_LIST, RELICS, TREASURE_LIST } from '../content/treasures';
import { initCombat } from './combat-engine';
import { generateActMap, getReachableNodeIds } from './map-generator';
import { saveActiveRun } from './meta-save';
import { SeededRng } from './rng';
import type {
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

export function rollRandomRoot(seed: number): string {
  const rng = new SeededRng(seed);
  return rng.pick(ROOTS).id;
}

export function createNewRun(params: {
  name: string;
  lineage: LineageId;
  rootId: string;
  seed: number;
  ascension: number;
  meta: MetaSave;
}): RunState {
  const rng = new SeededRng(params.seed);
  const lin = LINEAGES[params.lineage];
  const root = getRootById(params.rootId);

  let uid = 1;
  const deck: CardInstance[] = lin.starterDeck.map((defId) => ({
    uid: `c-${uid++}`,
    defId,
    upgraded: false,
  }));

  const maxHp = lin.baseHp + (root.bonusMaxHp ?? 0);
  const maxLifespan = lin.baseLifespan + (root.bonusLifespan ?? 0) - params.ascension * 2;
  const map = generateActMap(1, rng, params.meta.pastLifeRemnant);

  const run: RunState = {
    version: 1,
    seed: params.seed,
    rngState: rng.state,
    generation: params.meta.totalLives + 1,
    ascension: params.ascension,
    name: params.name.trim() || '云归',
    lineage: params.lineage,
    rootId: root.id,
    act: 1,
    realm: 'qi',
    age: 16,
    maxLifespan: Math.max(55, maxLifespan),
    hp: maxHp,
    maxHp,
    baseQi: 3,
    gold: 60,
    foundation: 10,
    daoTokens: 0,
    deck,
    treasures: [lin.starterTreasureId],
    relics: [],
    materials: [],
    map,
    currentNodeId: null,
    phase: 'map',
    combat: null,
    reward: null,
    activeEvent: null,
    eventResultText: null,
    shop: null,
    abodeUsed: false,
    stats: {
      battlesWon: 0,
      elitesWon: 0,
      bossesWon: 0,
      cardsPlayed: 0,
      resonancesTriggered: 0,
      lifeBurned: 0,
    },
    uidCounter: uid,
  };

  saveActiveRun(run);
  return run;
}

export function rollCardChoices(run: RunState, rng: SeededRng, count = 3, forcedRarity?: CardDef['rarity']): CardDef[] {
  const root = getRootById(run.rootId);
  const eligible = REWARD_CARD_POOL.filter((c) => {
    if (forcedRarity && c.rarity !== forcedRarity) return false;
    return c.lineage === run.lineage || c.lineage === 'neutral';
  });
  const pool = eligible.length >= count ? eligible : REWARD_CARD_POOL;
  const picked: CardDef[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count && used.size < pool.length; i++) {
    const candidates = pool.filter((c) => !used.has(c.id));
    const card = rng.weightedPick(candidates, (c) => {
      let w = c.lineage === run.lineage ? 30 : 12;
      if (c.element !== 'none' && root.elements.includes(c.element)) w += 12;
      if (c.rarity === 'mythic') w *= run.act >= 2 ? 0.5 : 0.2;
      if (c.rarity === 'rare') w *= run.act >= 2 ? 0.85 : 0.55;
      return w;
    });
    picked.push(card);
    used.add(card.id);
  }
  return picked;
}

function pickNewRelic(run: RunState, rng: SeededRng): RelicDef | undefined {
  const avail = RELIC_LIST.filter((r) => !run.relics.includes(r.id));
  if (avail.length === 0) return undefined;
  return rng.pick(avail);
}

function buildShopStock(run: RunState, rng: SeededRng): ShopStock {
  const cards = rollCardChoices(run, rng, 4).map((def) => ({
    def,
    price: def.rarity === 'mythic' ? 110 : def.rarity === 'rare' ? 75 : 45,
    sold: false,
  }));
  const availRelics = RELIC_LIST.filter((r) => !run.relics.includes(r.id));
  const relics = rng.shuffle(availRelics).slice(0, 2).map((def) => ({
    def,
    price: def.rarity === 'rare' ? 120 : 85,
    sold: false,
  }));
  const materials = rng.shuffle(ENCHANT_LIST).slice(0, 2).map((def) => ({
    def,
    price: 65,
    sold: false,
  }));
  return {
    cards,
    relics,
    materials,
    purgePrice: 55,
    purged: false,
    elixirPrice: 60,
    elixirBought: false,
  };
}

export function enterMapNode(run: RunState, nodeId: string): RunState {
  if (run.phase !== 'map') return run;
  const reachable = getReachableNodeIds(run.map, run.currentNodeId);
  if (!reachable.includes(nodeId)) return run;

  const nextRun: RunState = structuredClone(run);
  const node = nextRun.map.find((n) => n.id === nodeId);
  if (!node) return run;

  const abodeDiscount = node.type === 'abode' ? hasRelicHook(nextRun, 'abode-discount') : 0;
  const ageCost = Math.max(0, node.ageCost - abodeDiscount);
  nextRun.age += ageCost;
  node.visited = true;
  nextRun.currentNodeId = node.id;

  if (nextRun.age >= nextRun.maxLifespan) {
    nextRun.phase = 'gameover';
    nextRun.deathCause = `行至【${node.label}】途中寿尽坐化`;
    saveActiveRun(nextRun);
    return nextRun;
  }

  const rng = new SeededRng(nextRun.rngState);

  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    const tier = node.type === 'battle' ? 'normal' : node.type;
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
    if (abodeDiscount > 0) nextRun.foundation = Math.min(100, nextRun.foundation + 5);
    nextRun.phase = 'abode';
  } else if (node.type === 'shop') {
    nextRun.shop = buildShopStock(nextRun, rng);
    nextRun.phase = 'shop';
  } else if (node.type === 'remnant') {
    nextRun.phase = 'remnant';
  }

  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

export function resolveCombatVictory(run: RunState): RunState {
  if (!run.combat || (run.combat.outcome !== 'victory' && run.combat.outcome !== 'tribulation-survived')) {
    return run;
  }
  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  const rng = new SeededRng(nextRun.rngState);

  nextRun.stats.battlesWon += 1;
  if (combat.nodeType === 'elite') nextRun.stats.elitesWon += 1;
  if (combat.nodeType === 'boss') nextRun.stats.bossesWon += 1;

  // 战后回血遗物
  const postHeal = hasRelicHook(nextRun, 'heal-after-battle');
  if (postHeal > 0) nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + postHeal);

  const goldMult = 1 + hasRelicHook(nextRun, 'gold-magnet') / 100;
  const baseGold = combat.nodeType === 'boss' ? 75 : combat.nodeType === 'elite' ? 45 : 22;
  const gold = Math.round((baseGold + rng.int(0, 12)) * goldMult);
  const baseFoundation =
    (combat.nodeType === 'boss' ? 20 : combat.nodeType === 'elite' ? 18 : 10) +
    hasRelicHook(nextRun, 'foundation-boost') +
    (combat.enemy.tier === 'tribulation' && combat.outcome === 'victory' ? 15 : 0);

  nextRun.gold += gold;
  nextRun.foundation = Math.min(100, nextRun.foundation + baseFoundation);

  // 第四卷 Boss 击败直接真结局通关！
  if (combat.nodeType === 'boss' && nextRun.act === 4) {
    nextRun.combat = null;
    nextRun.realm = 'ascended';
    nextRun.phase = 'victory';
    nextRun.endingTitle = '百世问鼎 · 斩破太初天道（真结局）';
    saveActiveRun(nextRun);
    return nextRun;
  }

  // 第三卷 Boss 击败且未集齐 2 枚道果信物 -> 普通飞升通关！
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
    foundation: baseFoundation,
    cardChoices: rollCardChoices(nextRun, rng, 3),
    pickedCard: false,
    pickedRelic: false,
    pickedTreasure: false,
    pickedMaterial: false,
  };

  if (combat.nodeType === 'elite') {
    reward.relicReward = pickNewRelic(nextRun, rng);
    reward.materialReward = rng.pick(ENCHANT_LIST);
    const unownedTreasures = TREASURE_LIST.filter((t) => !nextRun.treasures.includes(t.id));
    if (nextRun.treasures.length < 2 && unownedTreasures.length > 0 && rng.next() < 0.55) {
      reward.treasureReward = rng.pick(unownedTreasures);
    }
  }

  if (combat.nodeType === 'boss') {
    reward.isBossReward = true;
    const grade: BreakthroughGrade =
      nextRun.foundation >= 85 ? 'heaven' : nextRun.foundation >= 50 ? 'earth' : 'mortal';
    reward.breakthroughGrade = grade;

    const lifeGain = grade === 'heaven' ? 120 : grade === 'earth' ? 85 : 55;
    reward.lifespanGained = lifeGain;
    nextRun.maxLifespan += lifeGain;
    nextRun.maxHp += grade === 'heaven' ? 20 : grade === 'earth' ? 12 : 6;
    nextRun.hp = nextRun.maxHp;

    if (grade === 'heaven') {
      nextRun.baseQi += 1;
      const availLaws = LAW_RELIC_LIST.filter((r) => !nextRun.relics.includes(r.id));
      reward.lawChoices = rng.shuffle(availLaws).slice(0, 3);
      reward.pickedLaw = false;
    } else if (grade === 'mortal') {
      nextRun.uidCounter += 1;
      nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: 'curse-flaw', upgraded: false });
    }
    reward.relicReward = pickNewRelic(nextRun, rng);
    reward.materialReward = rng.pick(ENCHANT_LIST);
    // 劈碎雷劫劫眼额外赐予 1 枚三界道果信物！
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
  nextRun.relics.push(nextRun.reward!.relicReward!.id);
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

export function claimBreakthroughLaw(run: RunState, lawId: string): RunState {
  if (!run.reward?.lawChoices || run.reward.pickedLaw) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.relics.push(lawId);
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
    nextRun.foundation = 15;
    const rng = new SeededRng(nextRun.rngState);
    nextRun.map = generateActMap(nextAct, rng, meta.pastLifeRemnant);
    nextRun.currentNodeId = null;
    nextRun.rngState = rng.state;
  }

  nextRun.phase = 'map';
  saveActiveRun(nextRun);
  return nextRun;
}

// ==================== 洞府三合一 ====================
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
    const heal = Math.round(nextRun.maxHp * 0.35);
    nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + heal);
    nextRun.foundation = Math.min(100, nextRun.foundation + 14);
    message = `文火成丹！恢复 ${heal} 点气血，本卷道基纯度 +14。`;
  } else {
    const roll = rng.next();
    if (roll < 0.68) {
      nextRun.maxLifespan += 14;
      nextRun.foundation = Math.min(100, nextRun.foundation + 24);
      nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 18);
      message = '丹云蔽日，九转金丹成！寿元上限 +14 年，道基纯度 +24，恢复 18 气血！';
    } else {
      nextRun.hp = Math.max(1, nextRun.hp - 10);
      nextRun.foundation = Math.min(100, nextRun.foundation + 8);
      nextRun.uidCounter += 1;
      nextRun.deck.push({ uid: `c-${nextRun.uidCounter}`, defId: 'curse-whisper', upgraded: false });
      message = '猛火炸炉！灼伤 10 点气血并引来 1 张【心魔低语】，仅得残丹道基 +8。';
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
  nextRun.foundation = Math.min(100, nextRun.foundation + 6);
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
  saveActiveRun(nextRun);
  return nextRun;
}

// ==================== 奇遇结算 ====================
export function chooseEncounterOption(run: RunState, choiceId: string): RunState {
  if (run.phase !== 'event' || !run.activeEvent) return run;
  const choice = run.activeEvent.choices.find((c) => c.id === choiceId);
  if (!choice) return run;
  if (choice.goldCost && run.gold < choice.goldCost) return run;

  const nextRun: RunState = structuredClone(run);
  const rng = new SeededRng(nextRun.rngState);

  if (choice.goldCost) nextRun.gold -= choice.goldCost;
  if (choice.hpCost) nextRun.hp = Math.max(1, nextRun.hp - choice.hpCost);
  if (choice.ageCost) nextRun.age += choice.ageCost;

  if (nextRun.age >= nextRun.maxLifespan) {
    nextRun.phase = 'gameover';
    nextRun.deathCause = `于【${nextRun.activeEvent!.title}】奇遇中寿尽坐化`;
    saveActiveRun(nextRun);
    return nextRun;
  }

  const e = choice.effect;
  if (e.gold) nextRun.gold += e.gold;
  if (e.maxHp) {
    nextRun.maxHp += e.maxHp;
    nextRun.hp += e.maxHp;
  }
  if (e.hp) nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + e.hp);
  if (e.lifespan) nextRun.maxLifespan += e.lifespan;
  if (e.foundation) {
    nextRun.foundation = Math.min(100, nextRun.foundation + e.foundation + hasRelicHook(nextRun, 'foundation-boost'));
  }
  if (e.addRandomCard) {
    const picked = rollCardChoices(nextRun, rng, 1, e.addRandomCard)[0];
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
    const rel = pickNewRelic(nextRun, rng);
    if (rel) nextRun.relics.push(rel.id);
  }
  if (e.addMaterial) {
    nextRun.materials.push(e.addMaterial);
  }
  if (e.removeRandomCard && nextRun.deck.length > 5) {
    const starterIdx = nextRun.deck.findIndex((c) => CARDS[c.defId]?.rarity === 'starter');
    nextRun.deck.splice(starterIdx >= 0 ? starterIdx : 0, 1);
  }
  if (e.gainDaoToken) {
    nextRun.daoTokens += 1;
  }

  nextRun.eventResultText = `已择「${choice.label}」：${choice.rewardText}`;
  nextRun.rngState = rng.state;
  saveActiveRun(nextRun);
  return nextRun;
}

// ==================== 坊市交易 ====================
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
  nextRun.relics.push(item.def.id);
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

export function shopBuyElixir(run: RunState): RunState {
  if (!run.shop || run.shop.elixirBought || run.gold < run.shop.elixirPrice) return run;
  const nextRun: RunState = structuredClone(run);
  nextRun.gold -= nextRun.shop!.elixirPrice;
  nextRun.shop!.elixirBought = true;
  nextRun.maxLifespan += 12;
  nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + 20);
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

// ==================== 前世遗蜕继承 ====================
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
    nextRun.foundation = Math.min(100, nextRun.foundation + 30);
    nextRun.maxLifespan += 15;
  }

  nextRun.phase = 'map';
  saveActiveRun(nextRun);
  return nextRun;
}

export { ENCHANTS };
