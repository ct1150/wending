import { CARDS } from '../content/cards';
import { CONSUMABLES } from '../content/consumables';
import { ENEMIES } from '../content/enemies';
import { getRootById, getWorldPowerMultiplier } from '../content/lineages';
import { RELICS, TREASURES } from '../content/treasures';
import { SeededRng } from './rng';
import type {
  CardDef,
  CardEffect,
  CardInstance,
  CombatState,
  ElementTag,
  EnemyDef,
  EnemyIntent,
  MapNodeType,
  RunState,
  SealType,
  SecondaryMethodId,
  TreasureDef,
} from './types';

export const HAND_LIMIT = 10;

export const SEAL_LABELS: Record<SealType, string> = {
  metal: '金',
  wood: '木',
  water: '水',
  fire: '火',
  earth: '土',
  thunder: '雷',
  sha: '煞',
};

export function hasSecondaryMethod(run: RunState, methodId: SecondaryMethodId): boolean {
  return run.secondaryMethod === methodId || run.secondSecondaryMethod === methodId;
}

export function getTreasureEffectiveMaxCharge(run: RunState, tDef: TreasureDef): number {
  const reduction = (run.treasureTier ?? 0) >= 2 ? 1 : 0;
  return Math.max(3, tDef.maxCharge - reduction);
}

export function getCardDef(defId: string): CardDef {
  return CARDS[defId] ?? CARDS['sw-slash'];
}

export function getCardCost(inst: CardInstance): number {
  const def = getCardDef(inst.defId);
  if (def.effect.xCost) return 0;
  let cost = inst.upgraded && def.upgradeCost !== undefined ? def.upgradeCost : def.cost;
  if (inst.enchant === 'swift') cost = Math.max(0, cost - 1);
  return cost;
}

export function getCardEffect(inst: CardInstance): CardEffect {
  const def = getCardDef(inst.defId);
  return inst.upgraded && def.upgradeEffect
    ? { ...def.effect, ...def.upgradeEffect }
    : { ...def.effect };
}

export function getCardDisplayName(inst: CardInstance): string {
  const def = getCardDef(inst.defId);
  return inst.upgraded && def.upgradeName ? def.upgradeName : def.name;
}

export function getCardDescription(inst: CardInstance): string {
  const def = getCardDef(inst.defId);
  return inst.upgraded && def.upgradeDescription ? def.upgradeDescription : def.description;
}

function hasRelicHook(run: RunState, hook: string): number {
  let total = 0;
  for (const id of run.relics) {
    const def = RELICS[id];
    if (def && def.hook === hook) total += def.value;
  }
  return total;
}

/**
 * 战斗内实时动态卡面数值预览：根据界域升维倍率、剑意、真灵血脉、仙窍清明、破绽/虚弱等实时计算真实伤害与护盾！
 */
export function getDynamicCardDescription(
  inst?: CardInstance,
  rawDef?: CardDef,
  run?: RunState | null,
): { text: string; boosted: boolean } {
  const def = rawDef ?? getCardDef(inst!.defId);
  const baseText = inst ? getCardDescription(inst) : def.description;
  if (!run || !run.combat) return { text: baseText, boosted: false };

  const combat = run.combat;
  const effect = inst ? getCardEffect(inst) : def.effect;
  const worldMult = getWorldPowerMultiplier(run.act);
  let text = baseText;
  let boosted = false;

  let estBlock = 0;
  if (effect.block) {
    const arrayBonus = run.lineage === 'array' ? combat.arrays.length * 2 : 0;
    estBlock = Math.round(effect.block * worldMult) + arrayBonus;
    if (estBlock !== effect.block) {
      const next = text.replace(new RegExp(`(获得\\s*|获\\s*)${effect.block}(\\s*点)`), `$1${estBlock}$2`);
      if (next !== text) {
        text = next;
        if (estBlock > effect.block) boosted = true;
      }
    }
  }

  if (effect.damage || effect.damagePerBlock) {
    let dmg = Math.round((effect.damage ?? 0) * worldMult);
    if (effect.damagePerBlock) {
      dmg += Math.floor((combat.block + estBlock) * effect.damagePerBlock);
    }
    if (dmg > 0 && (def.element === 'metal' || def.element === 'thunder') && !effect.consumeSwordIntent) {
      dmg += Math.round(combat.swordIntent * worldMult);
    }
    if (run.trueSpirit === 'spirit-roc') dmg = Math.round(dmg * 1.25);
    if (run.act >= 7 && (run.shaCorruption ?? 0) < 50) dmg = Math.round(dmg * 1.1);
    const dyingFury = hasRelicHook(run, 'dying-fury');
    if (dyingFury > 0 && run.hp <= run.maxHp * 0.45) dmg = Math.round(dmg * (1 + dyingFury / 100));
    if (combat.damageBoostPct > 0) dmg = Math.round(dmg * (1 + combat.damageBoostPct / 100));
    if (combat.weak > 0) dmg = Math.floor(dmg * 0.75);
    if (combat.enemy.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
    if (run.supremeLaw === 'supreme-space') dmg += Math.max(2, Math.round(dmg * 0.35));
    if (combat.enemy.phase2WardThisTurn) dmg = Math.max(1, Math.floor(dmg * 0.5));

    if (effect.damage && dmg !== effect.damage) {
      const next = text.replace(
        new RegExp(`(造成\\s*|各\\s*|轰出\\s*|连斩[^\\d]*?)${effect.damage}(\\s*点)`),
        `$1${dmg}$2`,
      );
      if (next !== text) {
        text = next;
        if (dmg > effect.damage) boosted = true;
      }
    } else if (effect.damagePerBlock && dmg > 0) {
      text = `${text}（当前预计 ${dmg} 点！）`;
      boosted = true;
    }
  }

  if (effect.poison) {
    const boost = hasRelicHook(run, 'poison-boost') + (run.relics.includes('rel-shennong-whip') ? 2 : 0);
    const estPoison = Math.round((effect.poison + boost) * worldMult);
    if (estPoison !== effect.poison) {
      const next = text.replace(new RegExp(`(施加\\s*)${effect.poison}(\\s*层)`), `$1${estPoison}$2`);
      if (next !== text) {
        text = next;
        if (estPoison > effect.poison) boosted = true;
      }
    }
  }

  return { text, boosted };
}

const FIVE_ELEMENTS: SealType[] = ['metal', 'wood', 'water', 'fire', 'earth'];

export function previewResonance(
  currentSeals: SealType[],
  incoming: ElementTag,
  mixedFiveBonus: boolean,
): { name: string; detail: string; consumes: SealType[] } | null {
  if (incoming === 'none') return null;
  const has = (s: SealType) => currentSeals.includes(s);

  const nextFive = new Set([...currentSeals, incoming].filter((s): s is SealType => FIVE_ELEMENTS.includes(s)));
  if (mixedFiveBonus && nextFive.size >= 3) {
    return {
      name: '五行混元 · 逆乱阴阳',
      detail: '清空灵印，回 2 真元、抽 2 牌并造成混元真伤',
      consumes: [...currentSeals],
    };
  }
  if (incoming === 'fire' && has('wood')) {
    return { name: '木火相生 · 焚心', detail: '火伤 +50%，并引爆 1 次丹毒', consumes: ['wood'] };
  }
  if (incoming === 'thunder' && has('metal')) {
    return { name: '金雷引煞 · 惊蛰', detail: '降下穿甲落雷，获 1 层剑意', consumes: ['metal'] };
  }
  if (incoming === 'metal' && has('earth')) {
    return { name: '厚土孕剑 · 锋鸣', detail: '获护体罡气并抽 1 张牌', consumes: ['earth'] };
  }
  if (incoming === 'wood' && has('water')) {
    return { name: '寒泉滋荣 · 生息', detail: '恢复气血并获 1 点真元', consumes: ['water'] };
  }
  if (incoming === 'water' && has('earth')) {
    return { name: '山泽通气 · 固本', detail: '获护体罡气，本回合护盾不清空', consumes: ['earth'] };
  }
  if (incoming === 'sha' && has('sha')) {
    return { name: '魔威滔天 · 噬魂', detail: '返还 1 点真元并轰出穿甲煞伤', consumes: ['sha'] };
  }
  return null;
}

function drawCards(run: RunState, combat: CombatState, count: number, rng: SeededRng): void {
  let overflowCount = 0;
  for (let i = 0; i < count; i++) {
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) break;
      combat.drawPile = rng.shuffle(combat.discardPile);
      combat.discardPile = [];
    }
    if (combat.hand.length >= HAND_LIMIT) {
      overflowCount += 1;
      continue;
    }
    const top = combat.drawPile.pop();
    if (top) combat.hand.push(top);
  }
  if (overflowCount > 0) {
    addBlockToPlayer(run, combat, overflowCount * 4);
    combat.combatLog.unshift(`✨ 满手灵气灌体：${overflowCount} 张溢出抽牌自动转化为护体罡气！`);
  }
}

function pushSeal(combat: CombatState, seal: SealType): void {
  combat.seals.push(seal);
  while (combat.seals.length > combat.maxSealSlots) {
    combat.seals.shift();
  }
}

function triggerPhoenixBloodlineIfReady(run: RunState, combat: CombatState): void {
  if (run.trueSpirit !== 'spirit-phoenix' || combat.phoenixTriggeredThisTurn) return;
  combat.phoenixTriggeredThisTurn = true;
  const worldMult = getWorldPowerMultiplier(run.act);
  const heal = Math.round(10 * worldMult);
  run.hp = Math.min(run.maxHp, run.hp + heal);
  addPoisonToEnemy(run, combat, 5);
  combat.combatLog.unshift(`🔥【天凤真血】浴血激发：恢复 ${heal} 点气血并染上天凤毒焰！`);
}

function onCardsExhausted(run: RunState, combat: CombatState, count: number): void {
  if (count <= 0) return;
  const worldMult = getWorldPowerMultiplier(run.act);
  if (hasSecondaryMethod(run, 'method-demon-furnace')) {
    const blk = Math.round(7 * count * worldMult);
    combat.block += blk;
    for (const arr of combat.arrays) arr.damagePerTurn += 2 * count;
    combat.combatLog.unshift(`《焚心炼阵功》响应消耗：罡气 +${blk}，全场阵盘伤害提升！`);
  }
  const exQi = hasRelicHook(run, 'exhaust-qi');
  if (exQi > 0) {
    combat.qi += exQi;
  }
  if (run.supremeLaw === 'supreme-samsara') {
    combat.qi += 1;
    combat.block += Math.round(8 * worldMult);
    run.hp = Math.min(run.maxHp, run.hp + Math.round(6 * worldMult));
    combat.combatLog.unshift('☯【轮回法则】化灭为生：仙灵力 +1，并回复气血与护体罡气！');
  }
}

export function initCombat(run: RunState, enemyDef: EnemyDef, nodeType: MapNodeType): RunState {
  const rng = new SeededRng(run.rngState);
  const root = getRootById(run.rootId);
  const muts = run.mutators ?? [];
  const worldMult = getWorldPowerMultiplier(run.act);
  const furyScale = nodeType === 'fury-elite' ? 1.24 : 1;
  const mutHpScale = muts.includes('mut-spirit-tide') ? 1.25 : 1;
  // 若集齐 ≥5 枚掌天道果挑战第九卷古或今，唤醒【混沌吞天终极态】！
  const chaosTrueBoss = enemyDef.id === 'e9-boss-guhuojin' && run.daoTokens >= 5;
  const chaosHpScale = chaosTrueBoss ? 1.2 : 1;
  const ascScale = (1 + run.ascension * 0.09) * furyScale * mutHpScale * chaosHpScale;
  const maxHp = Math.round(enemyDef.maxHp * ascScale);

  const shuffled = rng.shuffle(run.deck.map((c) => ({ ...c })));
  const innateCards: CardInstance[] = [];
  const normalCards: CardInstance[] = [];
  for (const c of shuffled) {
    const def = getCardDef(c.defId);
    if (def.innate || c.enchant === 'innate') innateCards.push(c);
    else normalCards.push(c);
  }
  const drawPile = [...normalCards, ...innateCards];

  const mutQi = muts.includes('mut-spirit-tide') ? 1 : 0;
  const maxQi = run.baseQi + mutQi;
  // 首回合额外资源软上限（防止后期叠满古宝首回合直接 12 费秒天秒地）
  const bonusStartQi = Math.min(3, (root.bonusQi ?? 0) + hasRelicHook(run, 'start-qi'));
  const startQi = maxQi + bonusStartQi;
  const rocBlock = run.trueSpirit === 'spirit-roc' ? Math.round(14 * worldMult) : 0;
  const nirvanaRelicBlock = run.relics.includes('law-nirvana-body') ? 16 : 0;
  const turnStartBlock = Math.round(hasRelicHook(run, 'turn-start-block') * worldMult);
  const startBlock =
    hasRelicHook(run, 'start-block') +
    rocBlock +
    nirvanaRelicBlock +
    turnStartBlock +
    (enemyDef.tier === 'tribulation' || enemyDef.tier === 'boss' ? hasRelicHook(run, 'tribulation-ward') : 0);

  const treasureCharges: Record<string, number> = {};
  for (const tid of run.treasures) treasureCharges[tid] = 0;

  const baseSealSlots = run.trueSpirit === 'spirit-peacock' ? 4 : 3;
  const maxSealSlots = enemyDef.trait?.id === 'seal-lock' ? Math.max(2, baseSealSlots - 1) : baseSealSlots;
  const glassSword = muts.includes('mut-glass-sword');
  const rocSword = run.trueSpirit === 'spirit-roc' ? 4 : 0;

  const combatLog: string[] = [
    chaosTrueBoss
      ? '🌌 掌天道果共鸣！古或今感应绿液本源，觉醒【混沌吞天终极态】！'
      : `遭遇【${enemyDef.name}】${enemyDef.trait ? `（法则：${enemyDef.trait.name}）` : ''}！`,
  ];

  const discardPile: CardInstance[] = [];
  let nextUid = run.uidCounter + 1;
  if (run.act >= 7 && (run.shaCorruption ?? 0) >= 50) {
    nextUid += 1;
    discardPile.push({ uid: `sha-${nextUid}`, defId: 'curse-whisper', upgraded: false });
    combatLog.unshift('☯【仙界煞气反噬】体内煞气 ≥50%，开战滋生 1 张心魔低语！可赴洞府洗煞池淬窍。');
  }

  const combat: CombatState = {
    enemy: {
      uid: `foe-${nextUid}`,
      defId: enemyDef.id,
      name: chaosTrueBoss
        ? '🌌混沌终极·时间道祖古或今'
        : nodeType === 'fury-elite'
          ? `🔥狂暴·${enemyDef.name}`
          : enemyDef.name,
      title: chaosTrueBoss ? '掌天宿敌 · 万古天道吞噬态' : enemyDef.title,
      tier: enemyDef.tier,
      artStyle: enemyDef.artStyle,
      hp: maxHp,
      maxHp,
      block: nodeType === 'fury-elite' ? Math.round(14 * worldMult) : 0,
      poison: 0,
      vulnerable: 0,
      weak: 0,
      strength:
        Math.floor(run.ascension / 3) +
        (nodeType === 'fury-elite' ? 2 : 0) +
        (glassSword ? 2 : 0) +
        (chaosTrueBoss ? 3 : 0),
      intentIdx: 0,
      trait: enemyDef.trait ? { ...enemyDef.trait } : undefined,
      phase2Triggered: false,
      phase2WardThisTurn: false,
      rebirthUsed: false,
      firstHitTakenThisTurn: false,
      tribulationWave: enemyDef.tribulationWaves ? 1 : undefined,
      tribulationMaxWaves: enemyDef.tribulationWaves,
    },
    nodeType,
    turn: 1,
    qi: startQi,
    maxQi,
    block: startBlock,
    retainBlockThisTurn: false,
    swordIntent: (glassSword ? 3 : 0) + rocSword,
    counterAura: hasRelicHook(run, 'counter-start'),
    damageBoostPct: 0,
    nextResonanceDouble: false,
    enemyDmgWeakenPct: 0,
    maxSealSlots,
    vulnerable: 0,
    weak: 0,
    seals: glassSword ? ([root.initialSeal, 'thunder'] as SealType[]).slice(-maxSealSlots) : [root.initialSeal],
    arrays: [],
    drawPile,
    hand: [],
    discardPile,
    exhaustPile: [],
    treasureCharges,
    cardsPlayedThisTurn: 0,
    attacksPlayedThisTurn: 0,
    swordCardsPlayedThisTurn: 0,
    hpSacrificedInCombat: 0,
    phoenixTriggeredThisTurn: false,
    firstNonExhaustEchoDone: false,
    samsaraReviveUsed: false,
    lastResonance: null,
    phase2Banner: null,
    combatLog,
    outcome: 'ongoing',
  };

  const spaceDraw = run.supremeLaw === 'supreme-space' ? 2 : 0;
  const celestialLawDraw = run.relics.includes('law-celestial-qi') ? 2 : 0;
  const rawExtraDraw =
    hasRelicHook(run, 'start-draw') +
    (run.relics.includes('rel-shadowless-tassel') ? 1 : 0) +
    spaceDraw +
    celestialLawDraw;
  const nextRun: RunState = {
    ...run,
    rngState: rng.state,
    uidCounter: nextUid,
    phase: 'combat',
    combat,
  };
  drawCards(nextRun, combat, 5 + Math.min(4, rawExtraDraw), rng);

  const curseBonus = hasRelicHook(nextRun, 'curse-power');
  if (curseBonus > 0 && nextRun.deck.some((c) => getCardDef(c.defId).type === 'curse')) {
    combat.qi += curseBonus;
    combat.block += 6;
  }

  nextRun.rngState = rng.state;
  return nextRun;
}

function checkEnemySurvivalAndPhase2(combat: CombatState): void {
  const foe = combat.enemy;
  const def = ENEMIES[foe.defId];

  if (foe.hp <= 0 && foe.trait?.id === 'phoenix-rebirth' && !foe.rebirthUsed) {
    foe.rebirthUsed = true;
    foe.hp = Math.max(1, Math.round((foe.maxHp * foe.trait.value) / 100));
    foe.strength += 3;
    combat.phase2Banner = `🔥 【${foe.name}】触发涅槃真火，浴火重生恢复 ${foe.hp} 气血！`;
    combat.combatLog.unshift(combat.phase2Banner);
    return;
  }

  const gateHp = Math.ceil(foe.maxHp * 0.5);
  if (foe.hp > 0 && def?.phase2 && !foe.phase2Triggered && foe.hp <= gateHp) {
    foe.phase2Triggered = true;
    foe.phase2WardThisTurn = true;
    foe.title = def.phase2.title;
    foe.vulnerable = 0;
    foe.weak = 0;
    foe.block += def.phase2.shieldGain;
    foe.strength += def.phase2.strengthGain;
    foe.intentIdx = 0;
    combat.phase2Banner = def.phase2.announcement;
    combat.combatLog.unshift(def.phase2.announcement);
  }
}

function dealDamageToEnemy(
  run: RunState,
  combat: CombatState,
  rawDamage: number,
  pierce = false,
  isDirectHit = false,
): number {
  let dmg = rawDamage;
  if (isDirectHit && run.trueSpirit === 'spirit-roc') {
    dmg = Math.round(dmg * 1.25);
  }
  if (isDirectHit && run.act >= 7 && (run.shaCorruption ?? 0) < 50) {
    dmg = Math.round(dmg * 1.1);
  }
  const dyingFury = hasRelicHook(run, 'dying-fury');
  if (dyingFury > 0 && run.hp <= run.maxHp * 0.45) {
    dmg = Math.round(dmg * (1 + dyingFury / 100));
  }
  if (combat.damageBoostPct > 0) {
    dmg = Math.round(dmg * (1 + combat.damageBoostPct / 100));
  }
  if (combat.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (combat.enemy.vulnerable > 0) dmg = Math.floor(dmg * 1.5);

  if (
    isDirectHit &&
    combat.enemy.trait?.id === 'stone-shell' &&
    !combat.enemy.firstHitTakenThisTurn &&
    run.supremeLaw !== 'supreme-space'
  ) {
    combat.enemy.firstHitTakenThisTurn = true;
    dmg = Math.max(1, Math.floor(dmg * 0.5));
    combat.combatLog.unshift(`【${combat.enemy.trait.name}】抵消了首击一半威力！`);
  }

  // Boss 二阶段破境护道金身：跨阶段当回合后续伤害减半，杜绝一回合无交互灌死二阶段
  if (combat.enemy.phase2WardThisTurn) {
    dmg = Math.max(1, Math.floor(dmg * 0.5));
  }

  dmg = Math.max(1, dmg);

  const spaceBonusPierce =
    isDirectHit && run.supremeLaw === 'supreme-space' ? Math.max(2, Math.round(dmg * 0.35)) : 0;

  if (!pierce && combat.enemy.block > 0) {
    const absorbed = Math.min(combat.enemy.block, dmg);
    combat.enemy.block -= absorbed;
    dmg -= absorbed;
  }

  let totalHpDealt = dmg + spaceBonusPierce;
  const foe = combat.enemy;
  const def = ENEMIES[foe.defId];
  const gateHp = Math.ceil(foe.maxHp * 0.5);

  // 二阶段破境锁血（Phase Gate）：首次打穿 50% 血线时强制锁在 50% 并唤醒二阶段真身！
  if (def?.phase2 && !foe.phase2Triggered && foe.hp > gateHp && foe.hp - totalHpDealt <= gateHp) {
    totalHpDealt = foe.hp - gateHp;
    foe.hp = gateHp;
  } else {
    foe.hp = Math.max(0, foe.hp - totalHpDealt);
  }

  if (isDirectHit && foe.trait?.id === 'thorns') {
    const thorn = foe.trait.value;
    const blocked = Math.min(combat.block, thorn);
    combat.block -= blocked;
    const left = thorn - blocked;
    if (left > 0) {
      run.hp = Math.max(1, run.hp - left);
      triggerPhoenixBloodlineIfReady(run, combat);
    }
  }

  checkEnemySurvivalAndPhase2(combat);
  return totalHpDealt;
}

function addBlockToPlayer(run: RunState, combat: CombatState, amount: number, applyWorldScale = true): void {
  if (amount <= 0) return;
  const worldMult = applyWorldScale ? getWorldPowerMultiplier(run.act) : 1;
  const arrayBonus = run.lineage === 'array' ? combat.arrays.length * 2 : 0;
  combat.block += Math.round(amount * worldMult) + arrayBonus;
}

function addPoisonToEnemy(run: RunState, combat: CombatState, amount: number): void {
  if (amount <= 0) return;
  const worldMult = getWorldPowerMultiplier(run.act);
  const boost =
    hasRelicHook(run, 'poison-boost') + (run.relics.includes('rel-shennong-whip') ? 2 : 0);
  combat.enemy.poison += Math.round((amount + boost) * worldMult);
  run.stats.maxPoisonApplied = Math.max(run.stats.maxPoisonApplied ?? 0, combat.enemy.poison);
}

function tryAutoRevivePlayer(run: RunState, combat: CombatState): boolean {
  if (run.hp > 0) return false;
  if (run.supremeLaw === 'supreme-samsara' && !combat.samsaraReviveUsed) {
    combat.samsaraReviveUsed = true;
    run.hp = Math.max(1, Math.round(run.maxHp * 0.5));
    combat.block += 28;
    combat.combatLog.unshift('☯ 【轮回法则 · 六道逆转】勘破生死，恢复 50% 气血并凝结 28 点仙罡！');
    return true;
  }
  const dollIdx = run.consumables.indexOf('con-revive-doll');
  if (dollIdx >= 0) {
    run.consumables.splice(dollIdx, 1);
    run.hp = Math.max(1, Math.round(run.maxHp * 0.3));
    combat.combatLog.unshift('🪵 【替死木偶符】咔嚓碎裂，替你挡下必死一劫并恢复 30% 气血！');
    return true;
  }
  return false;
}

function applyEffectBundle(
  run: RunState,
  combat: CombatState,
  effect: CardEffect,
  rng: SeededRng,
  sourceElement: ElementTag,
  opts: { isCard?: boolean; xValue?: number; enchant?: CardInstance['enchant']; sourceName: string; isEcho?: boolean },
): void {
  const root = getRootById(run.rootId);
  const worldMult = getWorldPowerMultiplier(run.act);
  let damageMultiplier = 1;
  const xVal = opts.xValue ?? 0;

  const triggerSelfSacrificeHooks = (amount: number) => {
    combat.hpSacrificedInCombat += amount;
    run.stats.hpSacrificed += amount;
    if (run.lineage === 'demon') addBlockToPlayer(run, combat, 4);
    triggerPhoenixBloodlineIfReady(run, combat);
    if (run.supremeLaw === 'supreme-samsara') {
      combat.qi += 1;
      addBlockToPlayer(run, combat, 8);
      run.hp = Math.min(run.maxHp, run.hp + Math.round(6 * worldMult));
    }
    if (hasSecondaryMethod(run, 'method-blood-blade')) {
      combat.swordIntent += 2;
      if (combat.hand.length < HAND_LIMIT) {
        run.uidCounter += 1;
        combat.hand.push({ uid: `gen-${run.uidCounter}`, defId: 'sw-flying', upgraded: run.act >= 4 });
      }
      combat.combatLog.unshift('《血神经·拔剑篇》触发：剑意 +2，拔出 1 道御剑术！');
    }
  };

  if (!opts.isEcho) {
    if (effect.selfHpCost && effect.selfHpCost > 0) {
      run.hp = Math.max(1, run.hp - effect.selfHpCost);
      triggerSelfSacrificeHooks(effect.selfHpCost);
    }
    if (effect.maxHpCost && effect.maxHpCost > 0) {
      run.maxHp = Math.max(15, run.maxHp - effect.maxHpCost);
      run.hp = Math.min(run.hp, run.maxHp);
      triggerSelfSacrificeHooks(effect.maxHpCost);
    }
  }

  if (effect.exhaustRandomHand && effect.exhaustRandomHand > 0 && combat.hand.length > 0) {
    let exhausted = 0;
    for (let i = 0; i < effect.exhaustRandomHand && combat.hand.length > 0; i++) {
      const rIdx = rng.int(0, combat.hand.length - 1);
      const victim = combat.hand.splice(rIdx, 1)[0];
      combat.exhaustPile.push(victim);
      exhausted += 1;
    }
    onCardsExhausted(run, combat, exhausted);
  }

  const sealToInject: ElementTag = sourceElement !== 'none' ? sourceElement : (effect.extraSeal ?? 'none');
  if (sealToInject !== 'none') {
    const res = previewResonance(combat.seals, sealToInject, Boolean(root.mixedFiveBonus));
    if (res) {
      for (const s of res.consumes) {
        const idx = combat.seals.indexOf(s);
        if (idx >= 0) combat.seals.splice(idx, 1);
      }
      combat.lastResonance = { name: res.name, detail: res.detail, seals: [...res.consumes, sealToInject] };
      run.stats.resonancesTriggered += 1;
      combat.combatLog.unshift(`✦ 触发【${res.name}】！${res.detail}`);

      if (combat.nextResonanceDouble) {
        combat.nextResonanceDouble = false;
        dealDamageToEnemy(run, combat, Math.round((run.lineage === 'alchemy' ? 28 : 14) * worldMult), true);
      }

      if (res.name.startsWith('五行混元')) {
        combat.seals = [];
        combat.qi += 2;
        drawCards(run, combat, 2, rng);
        dealDamageToEnemy(run, combat, Math.round(14 * worldMult), true);
      } else if (res.name.startsWith('木火相生')) {
        damageMultiplier = 1.5;
        if (combat.enemy.poison > 0) {
          dealDamageToEnemy(run, combat, combat.enemy.poison, true);
        }
        if (run.lineage === 'alchemy') {
          addPoisonToEnemy(run, combat, 3);
          run.hp = Math.min(run.maxHp, run.hp + Math.round(3 * worldMult));
        }
      } else if (res.name.startsWith('金雷引煞')) {
        dealDamageToEnemy(run, combat, Math.round(10 * worldMult), true);
        combat.swordIntent += 1;
      } else if (res.name.startsWith('厚土孕剑')) {
        addBlockToPlayer(run, combat, 8);
        drawCards(run, combat, 1, rng);
      } else if (res.name.startsWith('寒泉滋荣')) {
        run.hp = Math.min(run.maxHp, run.hp + Math.round(6 * worldMult));
        combat.qi += 1;
      } else if (res.name.startsWith('山泽通气')) {
        addBlockToPlayer(run, combat, 7);
        combat.retainBlockThisTurn = true;
      } else if (res.name.startsWith('魔威滔天')) {
        combat.qi += 1;
        dealDamageToEnemy(run, combat, Math.round(10 * worldMult), true);
      }

      if (run.trueSpirit === 'spirit-peacock' && combat.enemy.hp > 0) {
        combat.qi += 1;
        dealDamageToEnemy(run, combat, Math.round(16 * worldMult), true);
        combat.combatLog.unshift('🦚【五色孔雀法相】响应共鸣：元气 +1，轰出五色神光！');
      }

      if (root.mixedFiveBonus) drawCards(run, combat, 1, rng);
      const resAmp = hasRelicHook(run, 'resonance-amp');
      if (resAmp > 0 && combat.enemy.hp > 0) {
        dealDamageToEnemy(run, combat, Math.round(resAmp * worldMult), true);
        addBlockToPlayer(run, combat, 5);
      }
    } else {
      pushSeal(combat, sealToInject);
    }
  }

  if (effect.extraSeal && effect.extraSeal !== sealToInject) {
    pushSeal(combat, effect.extraSeal);
  }

  if (effect.block) {
    const blockAmt = effect.xCost && !effect.damage ? (xVal + 1) * effect.block : effect.block;
    addBlockToPlayer(run, combat, blockAmt);
    if (opts.enchant === 'double-cast' && !effect.damage && !effect.damagePerBlock) {
      addBlockToPlayer(run, combat, Math.round(blockAmt * 0.6));
    }
  }
  if (effect.retainBlock) combat.retainBlockThisTurn = true;

  let extraDmg = 0;
  if (effect.exhaustCursesInHand) {
    const curses = combat.hand.filter((c) => getCardDef(c.defId).type === 'curse');
    combat.hand = combat.hand.filter((c) => getCardDef(c.defId).type !== 'curse');
    combat.exhaustPile.push(...curses);
    onCardsExhausted(run, combat, curses.length);
    extraDmg += curses.length * (effect.damagePerExhaustedCurse ?? 14);
  }
  if (effect.damagePerExhausted) {
    extraDmg += combat.exhaustPile.length * effect.damagePerExhausted;
  }
  if (effect.detonateAllArrays && combat.arrays.length > 0) {
    const count = combat.arrays.length;
    combat.arrays = [];
    extraDmg += count * effect.detonateAllArrays;
    combat.qi += count;
    combat.combatLog.unshift(`💥 引爆 ${count} 座阵盘，返还 ${count} 点真元！`);
  }

  let baseDmg = Math.round(((effect.damage ?? 0) + extraDmg) * worldMult);
  if (effect.damagePerBlock) {
    baseDmg += Math.floor(combat.block * effect.damagePerBlock);
  }
  if (effect.consumeSwordIntent && combat.swordIntent > 0) {
    baseDmg += Math.round(combat.swordIntent * (effect.damagePerSwordIntent ?? 6) * worldMult);
    combat.swordIntent = 0;
  } else if (baseDmg > 0 && (sourceElement === 'metal' || sourceElement === 'thunder')) {
    baseDmg += Math.round(combat.swordIntent * worldMult);
  }

  const hits = effect.xCost && effect.xHitsBase !== undefined
    ? xVal + effect.xHitsBase
    : (effect.hits ?? (baseDmg > 0 ? 1 : 0));

  if (baseDmg > 0 && hits > 0) {
    const scaled = Math.round(baseDmg * damageMultiplier);
    let totalDealt = 0;
    for (let h = 0; h < hits; h++) {
      if (combat.enemy.hp <= 0) break;
      totalDealt += dealDamageToEnemy(run, combat, scaled, Boolean(effect.pierce), true);
      if (hasSecondaryMethod(run, 'method-venom-sword') && (sourceElement === 'metal' || sourceElement === 'thunder')) {
        addPoisonToEnemy(run, combat, 2);
      }
    }
    if (opts.enchant === 'double-cast' && combat.enemy.hp > 0) {
      totalDealt += dealDamageToEnemy(run, combat, Math.max(2, Math.round(scaled * 0.6)), Boolean(effect.pierce), true);
    }
    run.stats.maxSingleHit = Math.max(run.stats.maxSingleHit ?? 0, totalDealt);
    combat.combatLog.unshift(`【${opts.sourceName}】造成 ${totalDealt} 点伤害。`);
  }

  if (effect.counterAura) combat.counterAura += Math.round(effect.counterAura * worldMult);
  if (effect.heal && !effect.xPoisonDetonate) {
    run.hp = Math.min(run.maxHp, run.hp + Math.round(effect.heal * worldMult));
  }
  if (effect.gainQi) combat.qi += effect.gainQi;
  if (effect.draw) drawCards(run, combat, effect.draw, rng);
  if (effect.swordIntent) combat.swordIntent += effect.swordIntent;

  if (effect.poison) addPoisonToEnemy(run, combat, effect.poison);
  if (effect.xPoisonDetonate) {
    const times = xVal + 1;
    for (let i = 0; i < times && combat.enemy.hp > 0; i++) {
      if (combat.enemy.poison > 0) {
        dealDamageToEnemy(run, combat, combat.enemy.poison, true);
      }
      if (effect.heal) run.hp = Math.min(run.maxHp, run.hp + Math.round(effect.heal * worldMult));
    }
    combat.combatLog.unshift(`🔥 焚天丹炉连爆 ${times} 转！`);
  } else if (effect.detonatePoison && combat.enemy.poison > 0) {
    for (let i = 0; i < effect.detonatePoison && combat.enemy.hp > 0; i++) {
      const pDmg = dealDamageToEnemy(run, combat, combat.enemy.poison, true);
      combat.combatLog.unshift(`丹毒引爆！造成 ${pDmg} 点剧毒穿甲伤。`);
    }
  }

  if (effect.vulnerable) combat.enemy.vulnerable += effect.vulnerable;
  if (effect.weak) combat.enemy.weak += effect.weak;

  if (effect.arrayPower) {
    const dpt = Math.round((effect.arrayPower.damagePerTurn ?? 0) * worldMult);
    const bpt = Math.round((effect.arrayPower.blockPerTurn ?? 0) * worldMult);
    const ppt = effect.arrayPower.poisonPerTurn ?? 0;
    const existing = combat.arrays.find((a) => a.id === effect.arrayPower!.id);
    if (existing) {
      existing.damagePerTurn += dpt;
      existing.blockPerTurn += bpt;
      existing.poisonPerTurn += ppt;
    } else {
      combat.arrays.push({
        id: effect.arrayPower.id,
        name: effect.arrayPower.name,
        damagePerTurn: dpt,
        blockPerTurn: bpt,
        poisonPerTurn: ppt,
      });
    }
    combat.combatLog.unshift(`阵成！【${effect.arrayPower.name}】开始运转。`);
  }

  if (effect.addCardsToHand) {
    for (const defId of effect.addCardsToHand) {
      if (combat.hand.length >= HAND_LIMIT) break;
      run.uidCounter += 1;
      combat.hand.push({ uid: `gen-${run.uidCounter}`, defId, upgraded: run.act >= 4 });
    }
  }
  if (effect.addCurseToDiscard && !opts.isEcho) {
    run.uidCounter += 1;
    combat.discardPile.push({ uid: `cur-${run.uidCounter}`, defId: effect.addCurseToDiscard, upgraded: false });
  }

  if (opts.enchant === 'leech-life') run.hp = Math.min(run.maxHp, run.hp + Math.round(4 * worldMult));
  if (opts.enchant === 'toxic-edge') addPoisonToEnemy(run, combat, 4);
  if (opts.enchant === 'innate') drawCards(run, combat, 1, rng);
  if (opts.enchant === 'spirit-surge') combat.qi += 1;
  if (opts.enchant === 'shield-echo') addBlockToPlayer(run, combat, 8);
  if (opts.enchant === 'thunder-mark') {
    if (combat.enemy.hp > 0) dealDamageToEnemy(run, combat, Math.round(6 * worldMult), true);
    pushSeal(combat, 'thunder');
  }

  if (effect.gainMaxHp && combat.enemy.hp <= 0) {
    run.maxHp += effect.gainMaxHp;
    run.hp = Math.min(run.maxHp, run.hp + effect.gainMaxHp);
    combat.combatLog.unshift(`夺元斩杀！最大气血永久 +${effect.gainMaxHp}。`);
  } else if (effect.gainMaxHp && !baseDmg) {
    run.maxHp += effect.gainMaxHp;
    run.hp = Math.min(run.maxHp, run.hp + effect.gainMaxHp);
  }

  if (combat.enemy.hp <= 0 && !opts.isEcho) {
    if (opts.enchant === 'leech-life') {
      run.maxHp += 2;
      run.hp = Math.min(run.maxHp, run.hp + 2);
    }
    if (run.lineage === 'demon') {
      run.maxHp += 1;
      run.hp = Math.min(run.maxHp, run.hp + 5);
    }
    const beads = hasRelicHook(run, 'maxhp-leech-kill');
    if (beads > 0) {
      run.maxHp += beads;
      run.hp = Math.min(run.maxHp, run.hp + beads);
    }
  }
}

export function playCard(run: RunState, cardUid: string): RunState {
  if (!run.combat || run.combat.outcome !== 'ongoing') return run;
  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  combat.phase2Banner = null;
  const idx = combat.hand.findIndex((c) => c.uid === cardUid);
  if (idx < 0) return run;

  const inst = combat.hand[idx];
  const def = getCardDef(inst.defId);
  const effect = getCardEffect(inst);
  const isX = Boolean(effect.xCost);
  const cost = getCardCost(inst);
  if (!isX && combat.qi < cost) return run;

  const rng = new SeededRng(nextRun.rngState);
  const worldMult = getWorldPowerMultiplier(nextRun.act);
  const xSpent = isX ? combat.qi : 0;
  combat.qi = isX ? 0 : combat.qi - cost;

  combat.hand.splice(idx, 1);
  combat.cardsPlayedThisTurn += 1;
  nextRun.stats.cardsPlayed += 1;
  nextRun.stats.maxCardsInSingleTurn = Math.max(
    nextRun.stats.maxCardsInSingleTurn ?? 0,
    combat.cardsPlayedThisTurn,
  );

  if (combat.enemy.trait?.id === 'anti-skill' && def.type === 'skill') {
    combat.enemy.strength += combat.enemy.trait.value;
    combat.combatLog.unshift(`【${combat.enemy.trait.name}】感应运转术式，杀意 +${combat.enemy.trait.value}！`);
  }
  if (combat.enemy.trait?.id === 'sword-guard' && combat.cardsPlayedThisTurn >= 4) {
    combat.enemy.block += combat.enemy.trait.value;
  }

  for (const tid of nextRun.treasures) {
    const tDef = TREASURES[tid];
    if (tDef) {
      const cap = getTreasureEffectiveMaxCharge(nextRun, tDef);
      combat.treasureCharges[tid] = Math.min(cap, (combat.treasureCharges[tid] ?? 0) + 1);
    }
  }

  applyEffectBundle(nextRun, combat, effect, rng, def.element, {
    isCard: true,
    xValue: xSpent,
    enchant: inst.enchant,
    sourceName: getCardDisplayName(inst),
  });

  if (def.type === 'attack') {
    combat.attacksPlayedThisTurn = (combat.attacksPlayedThisTurn ?? 0) + 1;
    const firstAtkBonus = hasRelicHook(nextRun, 'first-atk-bonus');
    if (combat.attacksPlayedThisTurn === 1 && firstAtkBonus > 0 && combat.enemy.hp > 0) {
      const bonusDmg = Math.round(firstAtkBonus * worldMult);
      dealDamageToEnemy(nextRun, combat, bonusDmg, true);
      combat.combatLog.unshift(`⚡ 灵宝锋芒触发：首击追加 ${bonusDmg} 点穿甲真伤！`);
    }
  }

  if (
    nextRun.supremeLaw === 'supreme-time' &&
    !combat.firstNonExhaustEchoDone &&
    !def.exhaust &&
    def.type !== 'array' &&
    def.type !== 'curse' &&
    combat.enemy.hp > 0
  ) {
    combat.firstNonExhaustEchoDone = true;
    combat.combatLog.unshift(`⏳【时间法则 · 光阴重影】重演「${getCardDisplayName(inst)}」！`);
    applyEffectBundle(nextRun, combat, effect, rng, def.element, {
      isCard: true,
      xValue: xSpent,
      enchant: inst.enchant,
      sourceName: `光阴幻影·${getCardDisplayName(inst)}`,
      isEcho: true,
    });
  }

  if (nextRun.lineage === 'sword' && (def.element === 'metal' || def.element === 'thunder')) {
    combat.swordCardsPlayedThisTurn += 1;
    if (combat.swordCardsPlayedThisTurn % 3 === 0) {
      combat.swordIntent += 1;
      drawCards(nextRun, combat, 1, rng);
      combat.combatLog.unshift('《青元剑诀》感应：剑意 +1，抽 1 牌！');
    }
  }

  const cascade = hasRelicHook(nextRun, 'sword-cascade');
  if (cascade > 0 && def.type === 'attack' && combat.cardsPlayedThisTurn % 3 === 0 && combat.enemy.hp > 0) {
    const casDmg = Math.round(cascade * worldMult);
    dealDamageToEnemy(nextRun, combat, casDmg, true);
    combat.combatLog.unshift(`天道法则【一剑生万法】降下 ${casDmg} 点穿甲飞剑！`);
  }

  if (def.exhaust || def.type === 'array') {
    combat.exhaustPile.push(inst);
    if (def.exhaust) onCardsExhausted(nextRun, combat, 1);
  } else {
    combat.discardPile.push(inst);
  }

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
    if (combat.enemy.tier === 'tribulation') {
      nextRun.stats.tribulationsSlain = (nextRun.stats.tribulationsSlain ?? 0) + 1;
    }
    combat.combatLog.unshift(`斩落【${combat.enemy.name}】！`);
  }

  combat.combatLog = combat.combatLog.slice(0, 14);
  nextRun.rngState = rng.state;
  return nextRun;
}

export function useConsumable(run: RunState, slotIdx: number): RunState {
  if (!run.combat || run.combat.outcome !== 'ongoing') return run;
  const cid = run.consumables[slotIdx];
  const def = cid ? CONSUMABLES[cid] : undefined;
  if (!def || def.passiveRevive) return run;

  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  const rng = new SeededRng(nextRun.rngState);
  const worldMult = getWorldPowerMultiplier(nextRun.act);
  nextRun.consumables.splice(slotIdx, 1);

  const pillAmp =
    def.kind === 'pill' && (nextRun.lineage === 'alchemy' || hasRelicHook(nextRun, 'pill-master') > 0)
      ? 1.5
      : 1;

  switch (def.id) {
    case 'con-wind-redraw': {
      combat.discardPile.push(...combat.hand);
      combat.hand = [];
      combat.qi += 1;
      drawCards(nextRun, combat, 5, rng);
      combat.combatLog.unshift('🍃 祭出【神行换影符】：换取 5 张新手牌并回 1 真元！');
      break;
    }
    case 'con-seal-pill': {
      pushSeal(combat, 'wood');
      pushSeal(combat, 'metal');
      combat.nextResonanceDouble = true;
      combat.combatLog.unshift('🔮 服下【五行聚印丹】：注入木/金双印，下次相生威力暴涨！');
      break;
    }
    case 'con-berserk-pill': {
      nextRun.hp = Math.max(1, nextRun.hp - 6);
      nextRun.stats.hpSacrificed += 6;
      triggerPhoenixBloodlineIfReady(nextRun, combat);
      combat.qi += 2;
      combat.damageBoostPct += Math.round(50 * pillAmp);
      combat.combatLog.unshift('🔥 服下【暴血燃魂丹】：燃血 6 点，真元 +2，本回合伤害暴涨！');
      break;
    }
    case 'con-frost-talisman': {
      combat.enemyDmgWeakenPct = 45;
      combat.enemy.weak += 2;
      combat.combatLog.unshift('❄️ 祭出【玄冰敛息符】：敌方本回合伤害降低 45%！');
      break;
    }
    case 'con-heal-pill': {
      const heal = Math.round(22 * pillAmp * worldMult);
      nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + heal);
      combat.hand = combat.hand.filter((c) => getCardDef(c.defId).type !== 'curse');
      combat.combatLog.unshift(`💊 服下【百草回春丹】：恢复 ${heal} 点气血并涤净手牌心魔！`);
      break;
    }
    case 'con-venom-powder': {
      const tox = Math.round(10 * pillAmp);
      addPoisonToEnemy(nextRun, combat, tox);
      if (combat.enemy.poison > 0) dealDamageToEnemy(nextRun, combat, combat.enemy.poison, true);
      combat.combatLog.unshift('🧪 撒出【九幽腐骨散】：叠毒并引爆毒伤！');
      break;
    }
    case 'con-sword-pellet': {
      combat.swordIntent += Math.round(3 * pillAmp);
      for (let i = 0; i < 2 && combat.hand.length < HAND_LIMIT; i++) {
        nextRun.uidCounter += 1;
        combat.hand.push({ uid: `gen-${nextRun.uidCounter}`, defId: 'sw-flying', upgraded: true });
      }
      combat.combatLog.unshift('⚔️ 吞吐【太白剑丸】：剑意暴涨并唤出 2 道御剑术+！');
      break;
    }
    case 'con-earth-aegis': {
      addBlockToPlayer(nextRun, combat, 20);
      combat.retainBlockThisTurn = true;
      combat.combatLog.unshift('🛡️ 祭出【戊土金刚符】：获得不灭护体罡气！');
      break;
    }
    case 'con-shatter-spike': {
      combat.enemy.block = 0;
      dealDamageToEnemy(nextRun, combat, Math.round(12 * worldMult), true);
      combat.enemy.vulnerable += 2;
      combat.combatLog.unshift('⚡ 射出【破障碎盾锥】：震碎敌方护盾并造成穿甲重创！');
      break;
    }
  }

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
    if (combat.enemy.tier === 'tribulation') {
      nextRun.stats.tribulationsSlain = (nextRun.stats.tribulationsSlain ?? 0) + 1;
    }
  }

  nextRun.rngState = rng.state;
  return nextRun;
}

export function activateTreasure(run: RunState, treasureId: string): RunState {
  if (!run.combat || run.combat.outcome !== 'ongoing') return run;
  const tDef = TREASURES[treasureId];
  if (!tDef) return run;
  const maxChg = getTreasureEffectiveMaxCharge(run, tDef);
  if ((run.combat.treasureCharges[treasureId] ?? 0) < maxChg) return run;

  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  const rng = new SeededRng(nextRun.rngState);

  combat.treasureCharges[treasureId] = 0;
  const tierMult = 1 + (nextRun.treasureTier ?? 0) * 0.35;
  const scaledEffect: CardEffect = {
    ...tDef.effect,
    damage: tDef.effect.damage ? Math.round(tDef.effect.damage * tierMult) : undefined,
    block: tDef.effect.block ? Math.round(tDef.effect.block * tierMult) : undefined,
    poison: tDef.effect.poison ? Math.round(tDef.effect.poison * tierMult) : undefined,
    heal: tDef.effect.heal ? Math.round(tDef.effect.heal * tierMult) : undefined,
  };
  applyEffectBundle(nextRun, combat, scaledEffect, rng, scaledEffect.extraSeal ?? 'none', {
    sourceName: `法宝·${tDef.name}${(nextRun.treasureTier ?? 0) > 0 ? `+${nextRun.treasureTier}` : ''}`,
  });

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
    if (combat.enemy.tier === 'tribulation') {
      nextRun.stats.tribulationsSlain = (nextRun.stats.tribulationsSlain ?? 0) + 1;
    }
    combat.combatLog.unshift(`法宝镇杀【${combat.enemy.name}】！`);
  }

  combat.combatLog = combat.combatLog.slice(0, 14);
  nextRun.rngState = rng.state;
  return nextRun;
}

export function endPlayerTurn(run: RunState): RunState {
  if (!run.combat || run.combat.outcome !== 'ongoing') return run;
  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  combat.phase2Banner = null;
  const rng = new SeededRng(nextRun.rngState);
  const worldMult = getWorldPowerMultiplier(nextRun.act);

  const arrayAmp = 1 + hasRelicHook(nextRun, 'array-echo') / 100;
  for (const arr of combat.arrays) {
    if (arr.blockPerTurn > 0) addBlockToPlayer(nextRun, combat, Math.round(arr.blockPerTurn * arrayAmp), false);
    if (arr.damagePerTurn > 0 && combat.enemy.hp > 0) {
      dealDamageToEnemy(nextRun, combat, Math.round(arr.damagePerTurn * arrayAmp), false);
    }
    if (arr.poisonPerTurn > 0 && combat.enemy.hp > 0) {
      addPoisonToEnemy(nextRun, combat, Math.round(arr.poisonPerTurn * arrayAmp));
    }
    if (hasSecondaryMethod(nextRun, 'method-thunder-array') && combat.enemy.hp > 0) {
      dealDamageToEnemy(nextRun, combat, Math.round(6 * worldMult), true);
      pushSeal(combat, 'thunder');
    }
  }

  if (combat.enemy.hp > 0 && combat.enemy.poison > 0) {
    const pDmg = dealDamageToEnemy(nextRun, combat, combat.enemy.poison, true);
    combat.enemy.poison = Math.max(0, combat.enemy.poison - 1);
    combat.combatLog.unshift(`【丹毒】发作，蚀去敌方 ${pDmg} 点气血。`);
  }

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
    nextRun.rngState = rng.state;
    return nextRun;
  }

  combat.enemy.block = 0;
  combat.enemy.firstHitTakenThisTurn = false;
  combat.enemy.phase2WardThisTurn = false;

  const intent = getEnemyCurrentIntent(combat.enemy.defId, combat.enemy.intentIdx, combat.enemy.phase2Triggered);
  if (intent) {
    if (intent.block) combat.enemy.block += intent.block;
    if (intent.strengthGain) combat.enemy.strength += intent.strengthGain;
    if (intent.damage) {
      const hits = intent.hits ?? 1;
      let totalTaken = 0;
      for (let h = 0; h < hits; h++) {
        let incoming = intent.damage + combat.enemy.strength + Math.floor(nextRun.ascension / 2);
        if (combat.enemy.weak > 0) incoming = Math.floor(incoming * 0.75);
        if (combat.enemyDmgWeakenPct > 0) {
          incoming = Math.floor(incoming * (1 - combat.enemyDmgWeakenPct / 100));
        }
        if (combat.vulnerable > 0) incoming = Math.floor(incoming * 1.5);
        incoming = Math.max(1, incoming);

        const blocked = Math.min(combat.block, incoming);
        combat.block -= blocked;
        if (blocked > 0 && hasSecondaryMethod(nextRun, 'method-thorns-poison')) {
          addPoisonToEnemy(nextRun, combat, 4);
        }

        const hpLoss = incoming - blocked;
        if (hpLoss > 0) {
          nextRun.hp = Math.max(0, nextRun.hp - hpLoss);
          totalTaken += hpLoss;
          if (nextRun.hp > 0) triggerPhoenixBloodlineIfReady(nextRun, combat);
        }

        if (combat.counterAura > 0 && combat.enemy.hp > 0) {
          dealDamageToEnemy(nextRun, combat, combat.counterAura, true);
        }

        if (nextRun.hp <= 0) {
          tryAutoRevivePlayer(nextRun, combat);
          break;
        }
      }
      combat.combatLog.unshift(
        `【${combat.enemy.name}】施展「${intent.label}」${totalTaken > 0 ? `，造成 ${totalTaken} 点实伤！` : '，被你的护体罡气尽数挡下！'}`,
      );
    } else {
      combat.combatLog.unshift(`【${combat.enemy.name}】施展「${intent.label}」。`);
    }
    if (intent.vulnerable) combat.vulnerable += intent.vulnerable;
    if (intent.weak) combat.weak += intent.weak;
    if (intent.addCurse) {
      nextRun.uidCounter += 1;
      combat.discardPile.push({ uid: `cur-${nextRun.uidCounter}`, defId: intent.addCurse, upgraded: false });
    }
  }

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
    combat.combatLog.unshift(`剑罡反震斩杀【${combat.enemy.name}】！`);
    nextRun.rngState = rng.state;
    return nextRun;
  }

  if (nextRun.hp <= 0 && !tryAutoRevivePlayer(nextRun, combat)) {
    combat.outcome = 'defeat';
    nextRun.deathCause = `陨落于【${combat.enemy.name}】手下`;
    nextRun.rngState = rng.state;
    return nextRun;
  }

  if (combat.enemy.tier === 'tribulation' && combat.enemy.tribulationWave && combat.enemy.tribulationMaxWaves) {
    if (combat.enemy.tribulationWave >= combat.enemy.tribulationMaxWaves) {
      combat.outcome = 'tribulation-survived';
      combat.combatLog.unshift('九霄雷散，仙霞贯顶！你硬生生扛过了全部破境劫雷！');
      nextRun.rngState = rng.state;
      return nextRun;
    }
    combat.enemy.tribulationWave += 1;
  }

  combat.enemy.intentIdx = nextIntentIndex(combat.enemy.defId, combat.enemy.intentIdx, combat.enemy.phase2Triggered);

  for (const c of combat.hand) {
    if (getCardDef(c.defId).ethereal) {
      combat.exhaustPile.push(c);
      onCardsExhausted(nextRun, combat, 1);
    } else {
      combat.discardPile.push(c);
    }
  }
  combat.hand = [];

  combat.turn += 1;
  combat.cardsPlayedThisTurn = 0;
  combat.attacksPlayedThisTurn = 0;
  combat.swordCardsPlayedThisTurn = 0;
  combat.phoenixTriggeredThisTurn = false;
  combat.firstNonExhaustEchoDone = false;
  combat.damageBoostPct = 0;
  combat.enemyDmgWeakenPct = 0;
  combat.counterAura = Math.floor(combat.counterAura * 0.5);
  combat.qi = combat.maxQi;
  combat.vulnerable = Math.max(0, combat.vulnerable - 1);
  combat.weak = Math.max(0, combat.weak - 1);
  combat.enemy.vulnerable = Math.max(0, combat.enemy.vulnerable - 1);
  combat.enemy.weak = Math.max(0, combat.enemy.weak - 1);

  if (!combat.retainBlockThisTurn) {
    const retainHalf = hasRelicHook(nextRun, 'block-retain-half');
    if (retainHalf > 0) {
      combat.block = Math.floor(combat.block * 0.5);
    } else if (nextRun.lineage === 'array') {
      combat.block = Math.min(Math.round(12 * worldMult), combat.block);
    } else {
      combat.block = 0;
    }
  }
  combat.retainBlockThisTurn = false;

  const perTurnBlk = hasRelicHook(nextRun, 'turn-start-block');
  if (perTurnBlk > 0) addBlockToPlayer(nextRun, combat, perTurnBlk);

  if (combat.turn % 2 === 0) {
    const evenQi = hasRelicHook(nextRun, 'even-turn-qi');
    if (evenQi > 0) combat.qi += evenQi;

    // 灵界篇专属环境机制（第 4~6 卷）：双数回合【灵界元气潮汐】！
    if (nextRun.act >= 4 && nextRun.act <= 6) {
      combat.qi += 1;
      for (const tid of nextRun.treasures) {
        const tDef = TREASURES[tid];
        if (tDef) {
          const cap = getTreasureEffectiveMaxCharge(nextRun, tDef);
          combat.treasureCharges[tid] = Math.min(cap, (combat.treasureCharges[tid] ?? 0) + 1);
        }
      }
      combat.enemy.block += Math.round(14 * worldMult);
      combat.combatLog.unshift('🌌【灵界元气潮汐】涌动：我方元气 +1、法宝充能 +1，敌方凝结灵障！');
    }
  }

  if (nextRun.supremeLaw === 'supreme-time' && combat.turn % 3 === 0) {
    combat.enemy.vulnerable += 2;
    combat.enemy.weak += 2;
    combat.combatLog.unshift('⏳【时间法则】光阴迟滞降临：敌方陷入 2 层破绽与虚弱！');
  }

  if (combat.enemy.tier === 'tribulation' || combat.enemy.tier === 'boss') {
    const ward = hasRelicHook(nextRun, 'tribulation-ward');
    if (ward > 0) combat.block += Math.round(ward * worldMult);
  }

  const curseBonus = hasRelicHook(nextRun, 'curse-power');
  if (
    curseBonus > 0 &&
    [...combat.hand, ...combat.drawPile, ...combat.discardPile].some((c) => getCardDef(c.defId).type === 'curse')
  ) {
    combat.qi += curseBonus;
    combat.block += 6;
  }

  const turnDraw = 5 + (nextRun.supremeLaw === 'supreme-space' ? 2 : 0);
  drawCards(nextRun, combat, turnDraw, rng);
  combat.combatLog = combat.combatLog.slice(0, 14);
  nextRun.rngState = rng.state;
  return nextRun;
}

export function getEnemyCurrentIntent(
  enemyDefId: string,
  intentIdx: number,
  phase2Triggered?: boolean,
): EnemyIntent | null {
  const def = ENEMIES[enemyDefId];
  if (!def) return null;
  const list = phase2Triggered && def.phase2 ? def.phase2.intents : def.intents;
  if (list.length === 0) return null;
  return list[intentIdx % list.length];
}

function nextIntentIndex(enemyDefId: string, intentIdx: number, phase2Triggered?: boolean): number {
  const def = ENEMIES[enemyDefId];
  if (!def) return 0;
  const list = phase2Triggered && def.phase2 ? def.phase2.intents : def.intents;
  if (list.length === 0) return 0;
  return (intentIdx + 1) % list.length;
}
