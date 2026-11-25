import { CARDS } from '../content/cards';
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
  MapNodeType,
  ResonanceEvent,
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

export function getCardCost(inst: CardInstance): number {
  const def = getCardDef(inst.defId);
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

  // 五行混元检查（伪灵根只需3种不同五行，普通需含3种+新第4种或齐聚）
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

export function initCombat(run: RunState, enemyDef: EnemyDef, nodeType: MapNodeType): RunState {
  const rng = new SeededRng(run.rngState);
  const root = getRootById(run.rootId);
  const ascScale = 1 + run.ascension * 0.09;
  const maxHp = Math.round(enemyDef.maxHp * ascScale);

  const shuffled = rng.shuffle(run.deck.map((c) => ({ ...c })));
  const innateCards: CardInstance[] = [];
  const normalCards: CardInstance[] = [];
  for (const c of shuffled) {
    const def = getCardDef(c.defId);
    if (def.innate || c.enchant === 'innate') innateCards.push(c);
    else normalCards.push(c);
  }
  const drawPile = [...normalCards, ...innateCards]; // pop() draws from end -> innate first

  const startQi = run.baseQi + (root.bonusQi ?? 0) + hasRelicHook(run, 'start-qi');
  const startBlock = hasRelicHook(run, 'start-block') +
    ((enemyDef.tier === 'tribulation' || enemyDef.tier === 'boss') ? hasRelicHook(run, 'tribulation-ward') : 0);

  const treasureCharges: Record<string, number> = {};
  for (const tid of run.treasures) treasureCharges[tid] = 0;

  const combat: CombatState = {
    enemy: {
      uid: `foe-${run.uidCounter + 1}`,
      defId: enemyDef.id,
      name: enemyDef.name,
      title: enemyDef.title,
      tier: enemyDef.tier,
      artStyle: enemyDef.artStyle,
      hp: maxHp,
      maxHp,
      block: 0,
      poison: 0,
      vulnerable: 0,
      weak: 0,
      strength: Math.floor(run.ascension / 3),
      intentIdx: 0,
      tribulationWave: enemyDef.tribulationWaves ? 1 : undefined,
      tribulationMaxWaves: enemyDef.tribulationWaves,
    },
    nodeType,
    turn: 1,
    qi: startQi,
    maxQi: run.baseQi,
    block: startBlock,
    retainBlockThisTurn: false,
    swordIntent: 0,
    vulnerable: 0,
    weak: 0,
    seals: [root.initialSeal],
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
    combatLog: [`遭遇【${enemyDef.name}】！灵根共鸣注入初始【${SEAL_LABELS[root.initialSeal]}印】。`],
    outcome: 'ongoing',
  };

  drawCards(combat, 5 + hasRelicHook(run, 'start-draw'), rng);

  // 吞魔证道法则检查
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

function dealDamageToEnemy(run: RunState, combat: CombatState, rawDamage: number, pierce = false): number {
  let dmg = rawDamage;
  if (combat.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (combat.enemy.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
  dmg = Math.max(1, dmg);

  if (!pierce && combat.enemy.block > 0) {
    const absorbed = Math.min(combat.enemy.block, dmg);
    combat.enemy.block -= absorbed;
    dmg -= absorbed;
  }
  combat.enemy.hp = Math.max(0, combat.enemy.hp - dmg);
  return dmg;
}

function addBlockToPlayer(run: RunState, combat: CombatState, amount: number): void {
  if (amount <= 0) return;
  const arrayBonus = run.lineage === 'array' ? combat.arrays.length * 2 : 0;
  combat.block += amount + arrayBonus;
}

function applyEffectBundle(
  run: RunState,
  combat: CombatState,
  effect: CardEffect,
  rng: SeededRng,
  sourceElement: ElementTag,
  opts: { isCard?: boolean; enchant?: CardInstance['enchant']; sourceName: string },
): void {
  const root = getRootById(run.rootId);
  let damageMultiplier = 1;

  // 1. 自身气血 / 燃寿代价
  if (effect.selfHpCost && effect.selfHpCost > 0) {
    run.hp = Math.max(1, run.hp - effect.selfHpCost);
    if (run.lineage === 'demon') addBlockToPlayer(run, combat, 4);
  }
  if (effect.lifeCost && effect.lifeCost > 0) {
    run.age += effect.lifeCost;
    combat.lifeSpentInCombat += effect.lifeCost;
    run.stats.lifeBurned += effect.lifeCost;
    if (run.lineage === 'demon') addBlockToPlayer(run, combat, 4);
  }

  // 2. 灵印相生判定
  const sealToInject: ElementTag = sourceElement !== 'none' ? sourceElement : (effect.extraSeal ?? 'none');
  if (sealToInject !== 'none') {
    const res = previewResonance(combat.seals, sealToInject, Boolean(root.mixedFiveBonus));
    if (res) {
      // 消耗触发相生的旧印记
      for (const s of res.consumes) {
        const idx = combat.seals.indexOf(s);
        if (idx >= 0) combat.seals.splice(idx, 1);
      }
      combat.lastResonance = { name: res.name, detail: res.detail, seals: [...res.consumes, sealToInject] };
      run.stats.resonancesTriggered += 1;
      combat.combatLog.unshift(`✦ 触发【${res.name}】！${res.detail}`);

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
          combat.enemy.poison += 3;
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
      combat.seals.push(sealToInject);
      if (combat.seals.length > 3) combat.seals.shift();
    }
  }

  // 额外注入副灵印
  if (effect.extraSeal && effect.extraSeal !== sealToInject) {
    combat.seals.push(effect.extraSeal);
    if (combat.seals.length > 3) combat.seals.shift();
  }

  // 3. 心魔吞噬
  let curseExtraDmg = 0;
  if (effect.exhaustCursesInHand) {
    const curses = combat.hand.filter((c) => getCardDef(c.defId).type === 'curse');
    combat.hand = combat.hand.filter((c) => getCardDef(c.defId).type !== 'curse');
    combat.exhaustPile.push(...curses);
    curseExtraDmg = curses.length * (effect.damagePerExhaustedCurse ?? 14);
  }

  // 4. 伤害计算
  let baseDmg = (effect.damage ?? 0) + curseExtraDmg;
  if (effect.damagePerBlock) {
    baseDmg += Math.floor(combat.block * effect.damagePerBlock);
  }
  if (effect.consumeSwordIntent && combat.swordIntent > 0) {
    baseDmg += combat.swordIntent * (effect.damagePerSwordIntent ?? 6);
    combat.swordIntent = 0;
  } else if (baseDmg > 0 && (sourceElement === 'metal' || sourceElement === 'thunder')) {
    baseDmg += combat.swordIntent;
  }

  const hits = effect.hits ?? (baseDmg > 0 ? 1 : 0);
  if (baseDmg > 0 && hits > 0) {
    const scaled = Math.round(baseDmg * damageMultiplier);
    let totalDealt = 0;
    for (let h = 0; h < hits; h++) {
      totalDealt += dealDamageToEnemy(run, combat, scaled, Boolean(effect.pierce));
    }
    if (opts.enchant === 'double-cast') {
      totalDealt += dealDamageToEnemy(run, combat, Math.max(2, Math.round(scaled * 0.6)), Boolean(effect.pierce));
    }
    combat.combatLog.unshift(`【${opts.sourceName}】造成 ${totalDealt} 点伤害。`);
  }

  // 5. 护盾、回血、真元、抽牌、剑意、丹毒
  if (effect.block) {
    addBlockToPlayer(run, combat, effect.block);
    if (opts.enchant === 'double-cast' && !baseDmg) {
      addBlockToPlayer(run, combat, Math.round(effect.block * 0.6));
    }
  }
  if (effect.retainBlock) combat.retainBlockThisTurn = true;
  if (effect.heal) run.hp = Math.min(run.maxHp, run.hp + effect.heal);
  if (effect.gainQi) combat.qi += effect.gainQi;
  if (effect.draw) drawCards(combat, effect.draw, rng);
  if (effect.swordIntent) combat.swordIntent += effect.swordIntent;

  const poisonBoost = hasRelicHook(run, 'poison-boost');
  if (effect.poison) combat.enemy.poison += effect.poison + poisonBoost;
  if (effect.detonatePoison && combat.enemy.poison > 0) {
    for (let i = 0; i < effect.detonatePoison; i++) {
      const pDmg = dealDamageToEnemy(run, combat, combat.enemy.poison, true);
      combat.combatLog.unshift(`丹毒引爆！造成 ${pDmg} 点剧毒穿甲伤。`);
    }
  }
  if (effect.vulnerable) combat.enemy.vulnerable += effect.vulnerable;
  if (effect.weak) combat.enemy.weak += effect.weak;
  if (effect.gainFoundation) run.foundation = Math.min(100, run.foundation + effect.gainFoundation);

  // 6. 阵盘永续
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

  // 7. 衍生牌 / 塞入心魔
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

  // 8. 附魔附加效果
  if (opts.enchant === 'leech-life') run.hp = Math.min(run.maxHp, run.hp + 4);
  if (opts.enchant === 'toxic-edge') combat.enemy.poison += 4 + poisonBoost;
  if (opts.enchant === 'innate') drawCards(combat, 1, rng);
  if (opts.enchant === 'spirit-surge') combat.qi += 1;
  if (opts.enchant === 'shield-echo') addBlockToPlayer(run, combat, 8);
  if (opts.enchant === 'thunder-mark') {
    dealDamageToEnemy(run, combat, 6, true);
    combat.seals.push('thunder');
    if (combat.seals.length > 3) combat.seals.shift();
  }

  // 9. 直接夺寿 / 斩杀回寿
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
  const idx = combat.hand.findIndex((c) => c.uid === cardUid);
  if (idx < 0) return run;

  const inst = combat.hand[idx];
  const def = getCardDef(inst.defId);
  const cost = getCardCost(inst);
  if (combat.qi < cost) return run;

  const rng = new SeededRng(nextRun.rngState);
  combat.qi -= cost;
  combat.hand.splice(idx, 1);
  combat.cardsPlayedThisTurn += 1;
  nextRun.stats.cardsPlayed += 1;

  // 本命法宝充能
  for (const tid of nextRun.treasures) {
    const tDef = TREASURES[tid];
    if (tDef) combat.treasureCharges[tid] = Math.min(tDef.maxCharge, (combat.treasureCharges[tid] ?? 0) + 1);
  }

  const effect = getCardEffect(inst);
  applyEffectBundle(nextRun, combat, effect, rng, def.element, {
    isCard: true,
    enchant: inst.enchant,
    sourceName: getCardDisplayName(inst),
  });

  // 剑修本命功法：每回合第 3 张金/雷牌 +1 剑意抽 1 牌
  if (nextRun.lineage === 'sword' && (def.element === 'metal' || def.element === 'thunder')) {
    combat.swordCardsPlayedThisTurn += 1;
    if (combat.swordCardsPlayedThisTurn % 3 === 0) {
      combat.swordIntent += 1;
      drawCards(combat, 1, rng);
      combat.combatLog.unshift('《太白青莲剑典》感应：剑意 +1，抽 1 牌！');
    }
  }

  // 一剑生万法法则
  const cascade = hasRelicHook(nextRun, 'sword-cascade');
  if (cascade > 0 && def.type === 'attack' && combat.cardsPlayedThisTurn % 3 === 0 && combat.enemy.hp > 0) {
    dealDamageToEnemy(nextRun, combat, cascade, true);
    combat.combatLog.unshift(`天道法则【一剑生万法】降下 ${cascade} 点穿甲飞剑！`);
  }

  if (def.exhaust || def.type === 'array') {
    combat.exhaustPile.push(inst);
  } else {
    combat.discardPile.push(inst);
  }

  if (combat.enemy.hp <= 0) {
    combat.outcome = 'victory';
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
  const rng = new SeededRng(nextRun.rngState);

  // 1. 场上阵盘回合末自动触发
  const arrayAmp = 1 + hasRelicHook(nextRun, 'array-echo') / 100;
  for (const arr of combat.arrays) {
    if (arr.blockPerTurn > 0) addBlockToPlayer(nextRun, combat, Math.round(arr.blockPerTurn * arrayAmp));
    if (arr.damagePerTurn > 0 && combat.enemy.hp > 0) {
      dealDamageToEnemy(nextRun, combat, Math.round(arr.damagePerTurn * arrayAmp), false);
    }
    if (arr.poisonPerTurn > 0 && combat.enemy.hp > 0) {
      combat.enemy.poison += Math.round(arr.poisonPerTurn * arrayAmp);
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

  // 3. 敌方行动
  const enemyDefId = combat.enemy.defId;
  // 清空敌方上回合残余护盾
  combat.enemy.block = 0;

  // 从 intents 取当前意图
  // 避免循环引用，这里通过 combat.enemy.intentIdx 读取
  const intent = getEnemyCurrentIntent(enemyDefId, combat.enemy.intentIdx);
  if (intent) {
    if (intent.block) combat.enemy.block += intent.block;
    if (intent.strengthGain) combat.enemy.strength += intent.strengthGain;
    if (intent.damage) {
      const hits = intent.hits ?? 1;
      let totalTaken = 0;
      for (let h = 0; h < hits; h++) {
        let incoming = intent.damage + combat.enemy.strength + Math.floor(nextRun.ascension / 2);
        if (combat.enemy.weak > 0) incoming = Math.floor(incoming * 0.75);
        if (combat.vulnerable > 0) incoming = Math.floor(incoming * 1.5);
        incoming = Math.max(1, incoming);
        const blocked = Math.min(combat.block, incoming);
        combat.block -= blocked;
        const hpLoss = incoming - blocked;
        nextRun.hp = Math.max(0, nextRun.hp - hpLoss);
        totalTaken += hpLoss;
      }
      combat.combatLog.unshift(
        `【${combat.enemy.name}】施展「${intent.label}」${totalTaken > 0 ? `，击穿罡气造成 ${totalTaken} 点实伤！` : '，被你的护体罡气尽数挡下！'}`,
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

  if (nextRun.hp <= 0) {
    combat.outcome = 'defeat';
    combat.defeatCause = 'hp';
    nextRun.deathCause = `陨落于【${combat.enemy.name}】手下`;
    nextRun.rngState = rng.state;
    return nextRun;
  }

  // 4. 渡劫波次推进：撑过全部劫雷即渡劫成功！
  if (combat.enemy.tier === 'tribulation' && combat.enemy.tribulationWave && combat.enemy.tribulationMaxWaves) {
    if (combat.enemy.tribulationWave >= combat.enemy.tribulationMaxWaves) {
      combat.outcome = 'tribulation-survived';
      combat.combatLog.unshift('九霄雷散，金光贯顶！你硬生生扛过了全部破境劫雷！');
      nextRun.rngState = rng.state;
      return nextRun;
    }
    combat.enemy.tribulationWave += 1;
  }

  // 5. 推进敌方下回合意图
  combat.enemy.intentIdx = nextIntentIndex(enemyDefId, combat.enemy.intentIdx);

  // 6. 弃置手牌（虚无牌消耗）
  for (const c of combat.hand) {
    if (getCardDef(c.defId).ethereal) combat.exhaustPile.push(c);
    else combat.discardPile.push(c);
  }
  combat.hand = [];

  // 7. 开始我方下一回合
  combat.turn += 1;
  combat.cardsPlayedThisTurn = 0;
  combat.swordCardsPlayedThisTurn = 0;
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
  if (curseBonus > 0 && [...combat.hand, ...combat.drawPile, ...combat.discardPile].some((c) => getCardDef(c.defId).type === 'curse')) {
    combat.qi += curseBonus;
    combat.block += 6;
  }

  drawCards(combat, 5, rng);
  combat.combatLog = combat.combatLog.slice(0, 14);
  nextRun.rngState = rng.state;
  return nextRun;
}

import { ENEMIES } from '../content/enemies';

export function getEnemyCurrentIntent(enemyDefId: string, intentIdx: number) {
  const def = ENEMIES[enemyDefId];
  if (!def || def.intents.length === 0) return null;
  return def.intents[intentIdx % def.intents.length];
}

function nextIntentIndex(enemyDefId: string, intentIdx: number): number {
  const def = ENEMIES[enemyDefId];
  if (!def || def.intents.length === 0) return 0;
  return (intentIdx + 1) % def.intents.length;
}
