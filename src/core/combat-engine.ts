import { CARDS } from '../content/cards';
import { CONSUMABLES } from '../content/consumables';
import { ENEMIES } from '../content/enemies';
import { getRootById } from '../content/lineages';
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
} from './types';

export const SEAL_LABELS: Record<SealType, string> = {
  metal: '金',
  wood: '木',
  water: '水',
  fire: '火',
  earth: '土',
  thunder: '雷',
  sha: '煞',
};

export function getCardDef(defId: string): CardDef {
  return CARDS[defId] ?? CARDS['sw-slash'];
}

export function isXCostCard(inst: CardInstance): boolean {
  return Boolean(getCardDef(inst.defId).effect.xCost);
}

export function getCardCost(inst: CardInstance): number {
  const def = getCardDef(inst.defId);
  if (def.effect.xCost) return 0; // X 费牌在真元>=0时均可打出（消耗当前全部真元）
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
      detail: '清空灵印，回 2 真元、抽 2 牌并造成 14 点混元真伤',
      consumes: [...currentSeals],
    };
  }
  if (incoming === 'fire' && has('wood')) {
    return { name: '木火相生 · 焚心', detail: '火伤 +50%，并引爆 1 次丹毒', consumes: ['wood'] };
  }
  if (incoming === 'thunder' && has('metal')) {
    return { name: '金雷引煞 · 惊蛰', detail: '降下 10 点穿甲落雷，获 1 层剑意', consumes: ['metal'] };
  }
  if (incoming === 'metal' && has('earth')) {
    return { name: '厚土孕剑 · 锋鸣', detail: '获 8 点护体罡气并抽 1 张牌', consumes: ['earth'] };
  }
  if (incoming === 'wood' && has('water')) {
    return { name: '寒泉滋荣 · 生息', detail: '恢复 6 点气血并获 1 点真元', consumes: ['water'] };
  }
  if (incoming === 'water' && has('earth')) {
    return { name: '山泽通气 · 固本', detail: '获 7 点护体罡气，本回合罡气不清空', consumes: ['earth'] };
  }
  if (incoming === 'sha' && has('sha')) {
    return { name: '魔威滔天 · 噬魂', detail: '返还 1 点真元并额外造成 10 点穿甲煞伤', consumes: ['sha'] };
  }
  return null;
}

function drawCards(combat: CombatState, count: number, rng: SeededRng): void {
  for (let i = 0; i < count; i++) {
    if (combat.hand.length >= 9) break;
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) break;
      combat.drawPile = rng.shuffle(combat.discardPile);
      combat.discardPile = [];
    }
    const top = combat.drawPile.pop();
    if (top) combat.hand.push(top);
  }
}

function pushSeal(combat: CombatState, seal: SealType): void {
  combat.seals.push(seal);
  while (combat.seals.length > combat.maxSealSlots) {
    combat.seals.shift();
  }
}

function onCardsExhausted(run: RunState, combat: CombatState, count: number): void {
  if (count <= 0) return;
  if (run.secondaryMethod === 'method-demon-furnace') {
    combat.block += 7 * count;
    for (const arr of combat.arrays) arr.damagePerTurn += 2 * count;
    combat.combatLog.unshift(`《焚心炼阵功》响应消耗：罡气 +${7 * count}，全场阵盘伤害提升！`);
  }
  const exQi = hasRelicHook(run, 'exhaust-qi');
  if (exQi > 0) {
    combat.qi += exQi;
  }
}

export function initCombat(run: RunState, enemyDef: EnemyDef, nodeType: MapNodeType): RunState {
  const rng = new SeededRng(run.rngState);
  const root = getRootById(run.rootId);
  const muts = run.mutators ?? [];
  const furyScale = nodeType === 'fury-elite' ? 1.25 : 1;
  const mutHpScale = muts.includes('mut-spirit-tide') ? 1.25 : 1;
  const ascScale = (1 + run.ascension * 0.09) * furyScale * mutHpScale;
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
  const startQi = maxQi + (root.bonusQi ?? 0) + hasRelicHook(run, 'start-qi');
  const startBlock =
    hasRelicHook(run, 'start-block') +
    (enemyDef.tier === 'tribulation' || enemyDef.tier === 'boss' ? hasRelicHook(run, 'tribulation-ward') : 0);

  const treasureCharges: Record<string, number> = {};
  for (const tid of run.treasures) treasureCharges[tid] = 0;

  const maxSealSlots = enemyDef.trait?.id === 'seal-lock' ? enemyDef.trait.value : 3;
  const glassSword = muts.includes('mut-glass-sword');

  const combat: CombatState = {
    enemy: {
      uid: `foe-${run.uidCounter + 1}`,
      defId: enemyDef.id,
      name: nodeType === 'fury-elite' ? `🔥狂暴·${enemyDef.name}` : enemyDef.name,
      title: enemyDef.title,
      tier: enemyDef.tier,
      artStyle: enemyDef.artStyle,
      hp: maxHp,
      maxHp,
      block: nodeType === 'fury-elite' ? 14 : 0,
      poison: 0,
      vulnerable: 0,
      weak: 0,
      strength: Math.floor(run.ascension / 3) + (nodeType === 'fury-elite' ? 2 : 0) + (glassSword ? 2 : 0),
      intentIdx: 0,
      trait: enemyDef.trait ? { ...enemyDef.trait } : undefined,
      phase2Triggered: false,
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
    swordIntent: glassSword ? 3 : 0,
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
    discardPile: [],
    exhaustPile: [],
    treasureCharges,
    cardsPlayedThisTurn: 0,
    swordCardsPlayedThisTurn: 0,
    lifeSpentInCombat: 0,
    lastResonance: null,
    phase2Banner: null,
    combatLog: [
      `遭遇【${enemyDef.name}】${enemyDef.trait ? `（法则：${enemyDef.trait.name}）` : ''}！`,
    ],
    outcome: 'ongoing',
  };

  const extraDraw = hasRelicHook(run, 'start-draw') + (run.relics.includes('rel-shadowless-tassel') ? 1 : 0);
  drawCards(combat, 5 + extraDraw, rng);

  const curseBonus = hasRelicHook(run, 'curse-power');
  if (curseBonus > 0 && run.deck.some((c) => getCardDef(c.defId).type === 'curse')) {
    combat.qi += curseBonus;
    combat.block += 6;
  }

  return {
    ...run,
    rngState: rng.state,
    uidCounter: run.uidCounter + 1,
    phase: 'combat',
    combat,
  };
}

function checkEnemySurvivalAndPhase2(combat: CombatState): void {
  const foe = combat.enemy;
  const def = ENEMIES[foe.defId];

  // 涅槃真火复活检查
  if (foe.hp <= 0 && foe.trait?.id === 'phoenix-rebirth' && !foe.rebirthUsed) {
    foe.rebirthUsed = true;
    foe.hp = Math.max(1, Math.round((foe.maxHp * foe.trait.value) / 100));
    foe.strength += 3;
    combat.phase2Banner = `🔥 【${foe.name}】触发涅槃真火，浴火重生恢复 ${foe.hp} 气血！`;
    combat.combatLog.unshift(combat.phase2Banner);
    return;
  }

  // Boss 半血二阶段化相检查
  if (foe.hp > 0 && def?.phase2 && !foe.phase2Triggered && foe.hp <= foe.maxHp * 0.5) {
    foe.phase2Triggered = true;
    foe.title = def.phase2.title;
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
  // 逆命天珠加成
  const dyingFury = hasRelicHook(run, 'dying-fury');
  if (dyingFury > 0 && run.maxLifespan - run.age <= 20) {
    dmg = Math.round(dmg * (1 + dyingFury / 100));
  }
  if (combat.damageBoostPct > 0) {
    dmg = Math.round(dmg * (1 + combat.damageBoostPct / 100));
  }
  if (combat.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (combat.enemy.vulnerable > 0) dmg = Math.floor(dmg * 1.5);

  // 戊土玄甲：每回合首段直接攻击减伤 50%
  if (isDirectHit && combat.enemy.trait?.id === 'stone-shell' && !combat.enemy.firstHitTakenThisTurn) {
    combat.enemy.firstHitTakenThisTurn = true;
    dmg = Math.max(1, Math.floor(dmg * 0.5));
    combat.combatLog.unshift(`【${combat.enemy.trait.name}】抵消了首击一半威力！`);
  }

  dmg = Math.max(1, dmg);

  if (!pierce && combat.enemy.block > 0) {
    const absorbed = Math.min(combat.enemy.block, dmg);
    combat.enemy.block -= absorbed;
    dmg -= absorbed;
  }
  combat.enemy.hp = Math.max(0, combat.enemy.hp - dmg);

  // 骨刺反震
  if (isDirectHit && combat.enemy.trait?.id === 'thorns') {
    const thorn = combat.enemy.trait.value;
    const blocked = Math.min(combat.block, thorn);
    combat.block -= blocked;
    const left = thorn - blocked;
    if (left > 0) run.hp = Math.max(1, run.hp - left);
  }

  checkEnemySurvivalAndPhase2(combat);
  return dmg;
}

function addBlockToPlayer(run: RunState, combat: CombatState, amount: number): void {
  if (amount <= 0) return;
  const arrayBonus = run.lineage === 'array' ? combat.arrays.length * 2 : 0;
  combat.block += amount + arrayBonus;
}

function addPoisonToEnemy(run: RunState, combat: CombatState, amount: number): void {
  if (amount <= 0) return;
  const boost =
    hasRelicHook(run, 'poison-boost') + (run.relics.includes('rel-shennong-whip') ? 2 : 0);
  combat.enemy.poison += amount + boost;
  run.stats.maxPoisonApplied = Math.max(run.stats.maxPoisonApplied ?? 0, combat.enemy.poison);
}

function tryAutoRevivePlayer(run: RunState, combat: CombatState): boolean {
  if (run.hp > 0) return false;
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
  opts: { isCard?: boolean; xValue?: number; enchant?: CardInstance['enchant']; sourceName: string },
): void {
  const root = getRootById(run.rootId);
  let damageMultiplier = 1;
  const xVal = opts.xValue ?? 0;

  // 1. 自身气血 / 燃寿代价 + 辅修《血神经》联动
  const triggerSelfSacrificeHooks = () => {
    if (run.lineage === 'demon') addBlockToPlayer(run, combat, 4);
    if (run.secondaryMethod === 'method-blood-blade') {
      combat.swordIntent += 2;
      if (combat.hand.length < 9) {
        run.uidCounter += 1;
        combat.hand.push({ uid: `gen-${run.uidCounter}`, defId: 'sw-flying', upgraded: false });
      }
      combat.combatLog.unshift('《血神经·拔剑篇》触发：剑意 +2，拔出 1 道御剑术！');
    }
  };

  if (effect.selfHpCost && effect.selfHpCost > 0) {
    run.hp = Math.max(1, run.hp - effect.selfHpCost);
    triggerSelfSacrificeHooks();
  }
  if (effect.lifeCost && effect.lifeCost > 0) {
    run.age += effect.lifeCost;
    combat.lifeSpentInCombat += effect.lifeCost;
    run.stats.lifeBurned += effect.lifeCost;
    triggerSelfSacrificeHooks();
  }

  // 2. 随机献祭手牌消耗
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

  // 3. 灵印相生判定
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
        dealDamageToEnemy(run, combat, run.lineage === 'alchemy' ? 28 : 14, true);
      }

      if (res.name.startsWith('五行混元')) {
        combat.seals = [];
        combat.qi += 2;
        drawCards(combat, 2, rng);
        dealDamageToEnemy(run, combat, 14, true);
      } else if (res.name.startsWith('木火相生')) {
        damageMultiplier = 1.5;
        if (combat.enemy.poison > 0) {
          dealDamageToEnemy(run, combat, combat.enemy.poison, true);
        }
        if (run.lineage === 'alchemy') {
          addPoisonToEnemy(run, combat, 3);
          run.hp = Math.min(run.maxHp, run.hp + 3);
        }
      } else if (res.name.startsWith('金雷引煞')) {
        dealDamageToEnemy(run, combat, 10, true);
        combat.swordIntent += 1;
      } else if (res.name.startsWith('厚土孕剑')) {
        addBlockToPlayer(run, combat, 8);
        drawCards(combat, 1, rng);
      } else if (res.name.startsWith('寒泉滋荣')) {
        run.hp = Math.min(run.maxHp, run.hp + 6);
        combat.qi += 1;
      } else if (res.name.startsWith('山泽通气')) {
        addBlockToPlayer(run, combat, 7);
        combat.retainBlockThisTurn = true;
      } else if (res.name.startsWith('魔威滔天')) {
        combat.qi += 1;
        dealDamageToEnemy(run, combat, 10, true);
      }

      if (root.mixedFiveBonus) drawCards(combat, 1, rng);
      const resAmp = hasRelicHook(run, 'resonance-amp');
      if (resAmp > 0) {
        dealDamageToEnemy(run, combat, resAmp, true);
        addBlockToPlayer(run, combat, 5);
      }
    } else {
      pushSeal(combat, sealToInject);
    }
  }

  if (effect.extraSeal && effect.extraSeal !== sealToInject) {
    pushSeal(combat, effect.extraSeal);
  }

  // 4. 心魔吞噬 + 消耗堆增伤 + 引爆全场阵盘
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

  // 5. 伤害结算
  let baseDmg = (effect.damage ?? 0) + extraDmg;
  if (effect.damagePerBlock) {
    baseDmg += Math.floor(combat.block * effect.damagePerBlock);
  }
  if (effect.consumeSwordIntent && combat.swordIntent > 0) {
    baseDmg += combat.swordIntent * (effect.damagePerSwordIntent ?? 6);
    combat.swordIntent = 0;
  } else if (baseDmg > 0 && (sourceElement === 'metal' || sourceElement === 'thunder')) {
    baseDmg += combat.swordIntent;
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
      if (run.secondaryMethod === 'method-venom-sword' && (sourceElement === 'metal' || sourceElement === 'thunder')) {
        addPoisonToEnemy(run, combat, 2);
      }
    }
    if (opts.enchant === 'double-cast' && combat.enemy.hp > 0) {
      totalDealt += dealDamageToEnemy(run, combat, Math.max(2, Math.round(scaled * 0.6)), Boolean(effect.pierce), true);
    }
    run.stats.maxSingleHit = Math.max(run.stats.maxSingleHit ?? 0, totalDealt);
    combat.combatLog.unshift(`【${opts.sourceName}】造成 ${totalDealt} 点伤害。`);
  }

  // 6. 护盾、回血、剑罡、丹毒与 X 费焚炉
  if (effect.block) {
    const blockAmt = effect.xCost && !baseDmg ? (xVal + 1) * effect.block : effect.block;
    addBlockToPlayer(run, combat, blockAmt);
    if (opts.enchant === 'double-cast' && !baseDmg) {
      addBlockToPlayer(run, combat, Math.round(blockAmt * 0.6));
    }
  }
  if (effect.counterAura) combat.counterAura += effect.counterAura;
  if (effect.retainBlock) combat.retainBlockThisTurn = true;
  if (effect.heal && !effect.xPoisonDetonate) run.hp = Math.min(run.maxHp, run.hp + effect.heal);
  if (effect.gainQi) combat.qi += effect.gainQi;
  if (effect.draw) drawCards(combat, effect.draw, rng);
  if (effect.swordIntent) combat.swordIntent += effect.swordIntent;

  if (effect.poison) addPoisonToEnemy(run, combat, effect.poison);
  if (effect.xPoisonDetonate) {
    const times = xVal + 1;
    for (let i = 0; i < times && combat.enemy.hp > 0; i++) {
      if (combat.enemy.poison > 0) {
        dealDamageToEnemy(run, combat, combat.enemy.poison, true);
      }
      if (effect.heal) run.hp = Math.min(run.maxHp, run.hp + effect.heal);
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
  if (effect.gainFoundation) run.foundation = Math.min(100, run.foundation + effect.gainFoundation);

  // 7. 阵盘永续
  if (effect.arrayPower) {
    const existing = combat.arrays.find((a) => a.id === effect.arrayPower!.id);
    if (existing) {
      existing.damagePerTurn += effect.arrayPower.damagePerTurn ?? 0;
      existing.blockPerTurn += effect.arrayPower.blockPerTurn ?? 0;
      existing.poisonPerTurn += effect.arrayPower.poisonPerTurn ?? 0;
    } else {
      combat.arrays.push({
        id: effect.arrayPower.id,
        name: effect.arrayPower.name,
        damagePerTurn: effect.arrayPower.damagePerTurn ?? 0,
        blockPerTurn: effect.arrayPower.blockPerTurn ?? 0,
        poisonPerTurn: effect.arrayPower.poisonPerTurn ?? 0,
      });
    }
    combat.combatLog.unshift(`阵成！【${effect.arrayPower.name}】开始运转。`);
  }

  // 8. 衍生牌 / 塞入心魔
  if (effect.addCardsToHand) {
    for (const defId of effect.addCardsToHand) {
      if (combat.hand.length >= 9) break;
      run.uidCounter += 1;
      combat.hand.push({ uid: `gen-${run.uidCounter}`, defId, upgraded: false });
    }
  }
  if (effect.addCurseToDiscard) {
    run.uidCounter += 1;
    combat.discardPile.push({ uid: `cur-${run.uidCounter}`, defId: effect.addCurseToDiscard, upgraded: false });
  }

  // 9. 附魔附加效果
  if (opts.enchant === 'leech-life') run.hp = Math.min(run.maxHp, run.hp + 4);
  if (opts.enchant === 'toxic-edge') addPoisonToEnemy(run, combat, 4);
  if (opts.enchant === 'innate') drawCards(combat, 1, rng);
  if (opts.enchant === 'spirit-surge') combat.qi += 1;
  if (opts.enchant === 'shield-echo') addBlockToPlayer(run, combat, 8);
  if (opts.enchant === 'thunder-mark') {
    if (combat.enemy.hp > 0) dealDamageToEnemy(run, combat, 6, true);
    pushSeal(combat, 'thunder');
  }

  // 10. 夺寿与斩杀结算
  if (effect.gainLifespan && combat.enemy.hp <= 0) {
    run.maxLifespan += effect.gainLifespan;
    combat.combatLog.unshift(`夺元斩杀！寿元上限 +${effect.gainLifespan} 年。`);
  } else if (effect.gainLifespan && !baseDmg) {
    run.maxLifespan += effect.gainLifespan;
  }

  if (combat.enemy.hp <= 0) {
    if (opts.enchant === 'leech-life') run.maxLifespan += 4;
    if (run.lineage === 'demon') run.maxLifespan += 4;
    const beads = hasRelicHook(run, 'life-leech-kill');
    if (beads > 0) run.maxLifespan += beads;
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
  const xSpent = isX ? combat.qi : 0;
  combat.qi = isX ? 0 : combat.qi - cost;

  combat.hand.splice(idx, 1);
  combat.cardsPlayedThisTurn += 1;
  nextRun.stats.cardsPlayed += 1;
  nextRun.stats.maxCardsInSingleTurn = Math.max(
    nextRun.stats.maxCardsInSingleTurn ?? 0,
    combat.cardsPlayedThisTurn,
  );

  // 敌方法则触发：禁法妖瞳 / 剑心识破
  if (combat.enemy.trait?.id === 'anti-skill' && def.type === 'skill') {
    combat.enemy.strength += combat.enemy.trait.value;
    combat.combatLog.unshift(`【${combat.enemy.trait.name}】感应运转术式，杀意 +${combat.enemy.trait.value}！`);
  }
  if (combat.enemy.trait?.id === 'sword-guard' && combat.cardsPlayedThisTurn >= 4) {
    combat.enemy.block += combat.enemy.trait.value;
  }

  for (const tid of nextRun.treasures) {
    const tDef = TREASURES[tid];
    if (tDef) combat.treasureCharges[tid] = Math.min(tDef.maxCharge, (combat.treasureCharges[tid] ?? 0) + 1);
  }

  applyEffectBundle(nextRun, combat, effect, rng, def.element, {
    isCard: true,
    xValue: xSpent,
    enchant: inst.enchant,
    sourceName: getCardDisplayName(inst),
  });

  if (nextRun.lineage === 'sword' && (def.element === 'metal' || def.element === 'thunder')) {
    combat.swordCardsPlayedThisTurn += 1;
    if (combat.swordCardsPlayedThisTurn % 3 === 0) {
      combat.swordIntent += 1;
      drawCards(combat, 1, rng);
      combat.combatLog.unshift('《太白青莲剑典》感应：剑意 +1，抽 1 牌！');
    }
  }

  const cascade = hasRelicHook(nextRun, 'sword-cascade');
  if (cascade > 0 && def.type === 'attack' && combat.cardsPlayedThisTurn % 3 === 0 && combat.enemy.hp > 0) {
    dealDamageToEnemy(nextRun, combat, cascade, true);
    combat.combatLog.unshift(`天道法则【一剑生万法】降下 ${cascade} 点穿甲飞剑！`);
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
  } else if (nextRun.age >= nextRun.maxLifespan) {
    combat.outcome = 'defeat';
    combat.defeatCause = 'lifespan';
    nextRun.deathCause = `与${combat.enemy.name}死斗时燃尽寿元坐化`;
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
      drawCards(combat, 5, rng);
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
      nextRun.age += 2;
      nextRun.stats.lifeBurned += 2;
      combat.qi += 2;
      combat.damageBoostPct += Math.round(50 * pillAmp);
      combat.combatLog.unshift('🔥 服下【暴血燃魂丹】：真元 +2，本回合伤害暴涨！');
      break;
    }
    case 'con-frost-talisman': {
      combat.enemyDmgWeakenPct = 45;
      combat.enemy.weak += 2;
      combat.combatLog.unshift('❄️ 祭出【玄冰敛息符】：敌方本回合伤害降低 45%！');
      break;
    }
    case 'con-heal-pill': {
      const heal = Math.round(22 * pillAmp);
      nextRun.hp = Math.min(nextRun.maxHp, nextRun.hp + heal);
      combat.hand = combat.hand.filter((c) => getCardDef(c.defId).type !== 'curse');
      combat.combatLog.unshift(`💊 服下【百草回春丹】：恢复 ${heal} 点气血并涤净手牌心魔！`);
      break;
    }
    case 'con-venom-powder': {
      const tox = Math.round(10 * pillAmp);
      addPoisonToEnemy(nextRun, combat, tox);
      if (combat.enemy.poison > 0) dealDamageToEnemy(nextRun, combat, combat.enemy.poison, true);
      combat.combatLog.unshift(`🧪 撒出【九幽腐骨散】：叠毒 ${tox} 层并引爆毒伤！`);
      break;
    }
    case 'con-sword-pellet': {
      combat.swordIntent += Math.round(3 * pillAmp);
      for (let i = 0; i < 2 && combat.hand.length < 9; i++) {
        nextRun.uidCounter += 1;
        combat.hand.push({ uid: `gen-${nextRun.uidCounter}`, defId: 'sw-flying', upgraded: true });
      }
      combat.combatLog.unshift('⚔️ 吞吐【太白剑丸】：剑意暴涨并唤出 2 道御剑术+！');
      break;
    }
    case 'con-earth-aegis': {
      addBlockToPlayer(nextRun, combat, 20);
      combat.retainBlockThisTurn = true;
      combat.combatLog.unshift('🛡️ 祭出【戊土金刚符】：获得 20 点不灭罡气！');
      break;
    }
    case 'con-shatter-spike': {
      combat.enemy.block = 0;
      dealDamageToEnemy(nextRun, combat, 12, true);
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
  } else if (nextRun.age >= nextRun.maxLifespan) {
    combat.outcome = 'defeat';
    combat.defeatCause = 'lifespan';
    nextRun.deathCause = '服暴血狂丹燃尽寿元坐化';
  }

  nextRun.rngState = rng.state;
  return nextRun;
}

export function activateTreasure(run: RunState, treasureId: string): RunState {
  if (!run.combat || run.combat.outcome !== 'ongoing') return run;
  const tDef = TREASURES[treasureId];
  if (!tDef) return run;
  if ((run.combat.treasureCharges[treasureId] ?? 0) < tDef.maxCharge) return run;

  const nextRun: RunState = structuredClone(run);
  const combat = nextRun.combat!;
  const rng = new SeededRng(nextRun.rngState);

  combat.treasureCharges[treasureId] = 0;
  applyEffectBundle(nextRun, combat, tDef.effect, rng, tDef.effect.extraSeal ?? 'none', {
    sourceName: `法宝·${tDef.name}`,
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

  // 1. 场上阵盘回合末触发（含辅修《九宫引雷诀》）
  const arrayAmp = 1 + hasRelicHook(nextRun, 'array-echo') / 100;
  for (const arr of combat.arrays) {
    if (arr.blockPerTurn > 0) addBlockToPlayer(nextRun, combat, Math.round(arr.blockPerTurn * arrayAmp));
    if (arr.damagePerTurn > 0 && combat.enemy.hp > 0) {
      dealDamageToEnemy(nextRun, combat, Math.round(arr.damagePerTurn * arrayAmp), false);
    }
    if (arr.poisonPerTurn > 0 && combat.enemy.hp > 0) {
      addPoisonToEnemy(nextRun, combat, Math.round(arr.poisonPerTurn * arrayAmp));
    }
    if (nextRun.secondaryMethod === 'method-thunder-array' && combat.enemy.hp > 0) {
      dealDamageToEnemy(nextRun, combat, 6, true);
      pushSeal(combat, 'thunder');
    }
  }

  // 2. 敌方丹毒结算
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

  // 3. 敌方行动（含二阶段招式表 + 剑罡反击 + 玄冥反毒甲 + 替死木偶符）
  combat.enemy.block = 0;
  combat.enemy.firstHitTakenThisTurn = false;

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
        if (blocked > 0 && nextRun.secondaryMethod === 'method-thorns-poison') {
          addPoisonToEnemy(nextRun, combat, 4);
        }

        const hpLoss = incoming - blocked;
        nextRun.hp = Math.max(0, nextRun.hp - hpLoss);
        totalTaken += hpLoss;

        // 剑罡反击回敬穿甲剑伤
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
    combat.defeatCause = 'hp';
    nextRun.deathCause = `陨落于【${combat.enemy.name}】手下`;
    nextRun.rngState = rng.state;
    return nextRun;
  }

  // 4. 渡劫波次推进
  if (combat.enemy.tier === 'tribulation' && combat.enemy.tribulationWave && combat.enemy.tribulationMaxWaves) {
    if (combat.enemy.tribulationWave >= combat.enemy.tribulationMaxWaves) {
      combat.outcome = 'tribulation-survived';
      combat.combatLog.unshift('九霄雷散，金光贯顶！你硬生生扛过了全部破境劫雷！');
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
  combat.swordCardsPlayedThisTurn = 0;
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
      combat.block = Math.min(12, combat.block);
    } else {
      combat.block = 0;
    }
  }
  combat.retainBlockThisTurn = false;

  if (combat.enemy.tier === 'tribulation' || combat.enemy.tier === 'boss') {
    const ward = hasRelicHook(nextRun, 'tribulation-ward');
    if (ward > 0) combat.block += ward;
  }

  const curseBonus = hasRelicHook(nextRun, 'curse-power');
  if (
    curseBonus > 0 &&
    [...combat.hand, ...combat.drawPile, ...combat.discardPile].some((c) => getCardDef(c.defId).type === 'curse')
  ) {
    combat.qi += curseBonus;
    combat.block += 6;
  }

  drawCards(combat, 5, rng);
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
