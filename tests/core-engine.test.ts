import { describe, expect, it } from 'vitest';
import { getUnlockedRewardCardPool } from '../src/content/cards';
import { ENEMIES, pickEnemyForNode } from '../src/content/enemies';
import { describeStatusTag, extractCardGlossary } from '../src/content/glossary';
import {
  endPlayerTurn,
  getDynamicCardDescription,
  initCombat,
  playCard,
  previewResonance,
  useConsumable,
} from '../src/core/combat-engine';
import { generateActMap, getReachableNodeIds } from '../src/core/map-generator';
import { defaultMetaSave, getUnlockedStartWorlds, settleRunIntoMeta } from '../src/core/meta-save';
import { SeededRng } from '../src/core/rng';
import {
  abodeBrewElixir,
  abodePurgeCard,
  abodeUpgradeOrEnchant,
  auctionAmbushBuyer,
  chooseStartingBlessing,
  claimBreakthroughLaw,
  claimSecondaryMethod,
  claimSupremeLaw,
  claimTrueSpirit,
  createNewRun,
  enterMapNode,
  finishRewardAndAdvance,
  getDailyChallengeConfig,
  resolveCombatVictory,
  rollCardChoices,
} from '../src/core/run-manager';
import type { ActNumber } from '../src/core/types';

describe('凡人三部曲 · 三界九卷地图与敌群完整性', () => {
  it('第 1~9 卷均生成连通仙侠灵脉图且每卷拥有专属普通/精英/镇关强敌', () => {
    const rng = new SeededRng(42);
    const remnant = {
      generation: 1,
      name: '韩立',
      lineage: 'sword' as const,
      act: 5 as const,
      deathCause: '圣岛力战',
      leftTreasureId: 'tr-sword-box',
    };

    for (let a = 1; a <= 9; a++) {
      const act = a as ActNumber;
      const map = generateActMap(act, rng, remnant);
      expect(map.some((n) => n.type === 'boss')).toBe(true);
      if (act === 5) expect(map.some((n) => n.type === 'remnant')).toBe(true);
      for (const node of map) {
        if (node.type !== 'boss') expect(node.nextIds.length).toBeGreaterThan(0);
      }
      expect(getReachableNodeIds(map, null).length).toBeGreaterThanOrEqual(1);

      const boss = pickEnemyForNode(act, 'boss', () => 0.3);
      expect(boss.act).toBe(act);
      const elite = pickEnemyForNode(act, 'elite', () => 0.3);
      expect(elite.act).toBe(act);
    }
  });

  it('开局天命四选一支持重铸绝世神话法宝，且支持灵界篇/仙界篇直通开局', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '韩天尊',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 101,
      ascension: 0,
      meta,
      startWorld: 'immortal',
    });
    expect(run.act).toBe(7);
    expect(run.baseQi).toBe(5);
    expect(run.trueSpirit).toBeTruthy();
    run = chooseStartingBlessing(run, 'gold', meta);
    expect(run.phase).toBe('breakthrough');
    expect(run.reward?.supremeLawChoices?.length).toBe(3);
    run = claimSupremeLaw(run, 'supreme-time');
    run = finishRewardAndAdvance(run, meta);
    expect(run.phase).toBe('map');
    expect(run.supremeLaw).toBe('supreme-time');
  });
});

describe('单一气血、真灵血脉、三大至尊法则与白话词条解析', () => {
  it('准确判定七大灵印相生共鸣并自动提取卡牌白话词条注释', () => {
    expect(previewResonance(['wood'], 'fire', false)?.name).toContain('木火相生');
    expect(previewResonance(['metal'], 'thunder', false)?.name).toContain('金雷引煞');
    expect(previewResonance(['earth'], 'metal', false)?.name).toContain('厚土孕剑');
    expect(previewResonance(['water'], 'wood', false)?.name).toContain('寒泉滋荣');
    expect(previewResonance(['earth'], 'water', false)?.name).toContain('山泽通气');
    expect(previewResonance(['sha'], 'sha', false)?.name).toContain('魔威滔天');
    expect(previewResonance(['metal', 'wood'], 'water', true)?.name).toContain('五行混元');

    const gl = extractCardGlossary({ uid: 't1', defId: 'sw-x-zhuxian', upgraded: false });
    expect(gl.entries.some((e) => e.term === 'X费')).toBe(true);
    expect(gl.entries.some((e) => e.term === '剑意')).toBe(true);
    expect(gl.comboTip).toContain('雷印连招');
    expect(describeStatusTag('poison', 6).title).toContain('丹毒');
  });

  it('五色孔雀突破 4 格灵印槽，时间法则触发光阴重影双发，轮回法则逆转必死伤害', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '厉飞雨',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 2027,
      ascension: 0,
      meta,
      startWorld: 'immortal',
      skipBlessing: true,
    });
    run.trueSpirit = 'spirit-peacock';
    run.supremeLaw = 'supreme-time';

    run = initCombat(run, ENEMIES['e7-boss-xiaojinhan'], 'boss');
    // 五色孔雀拥有 4 格灵印槽！
    expect(run.combat!.maxSealSlots).toBe(4);

    // 时间法则：本回合第 1 张非消耗神通自动凝聚【光阴重影】结算 2 次！
    const enemyHpBefore = run.combat!.enemy.hp;
    run.combat!.hand.push({ uid: 't-slash', defId: 'sw-slash', upgraded: true });
    run = playCard(run, 't-slash');
    expect(run.combat!.firstNonExhaustEchoDone).toBe(true);
    expect(run.combat!.enemy.hp).toBeLessThan(enemyHpBefore - 20);

    // 切换轮回法则测试致命一击 50% 气血逆转重生
    run.supremeLaw = 'supreme-samsara';
    run.combat!.enemy.intentIdx = 1;
    run.hp = 1;
    run.combat!.block = 0;
    run = endPlayerTurn(run);
    expect(run.combat!.samsaraReviveUsed).toBe(true);
    expect(run.hp).toBeGreaterThanOrEqual(Math.floor(run.maxHp * 0.45));
    expect(run.combat!.outcome).toBe('ongoing');
  });

  it('支持 X 费诛仙剑、辅修毒剑联动、燃血丹符、Boss 二阶段与替死木偶', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '毒剑仙',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 1001,
      ascension: 0,
      meta,
      skipBlessing: true,
    });
    run.secondaryMethod = 'method-venom-sword';
    run.consumables = ['con-berserk-pill', 'con-revive-doll'];

    run = initCombat(run, ENEMIES['e2-boss-demon'], 'boss');
    expect(run.combat!.maxSealSlots).toBe(2);

    const hpBefore = run.hp;
    const qiBefore = run.combat!.qi;
    run = useConsumable(run, 0);
    expect(run.hp).toBe(hpBefore - 6);
    expect(run.combat!.qi).toBe(qiBefore + 2);

    run.combat!.hand.push({ uid: 'x-sword', defId: 'sw-x-zhuxian', upgraded: true });
    run = playCard(run, 'x-sword');
    expect(run.combat!.qi).toBe(0);
    expect(run.combat!.enemy.poison).toBeGreaterThanOrEqual(8);

    run.combat!.enemy.hp = Math.floor(run.combat!.enemy.maxHp * 0.45);
    run.combat!.qi = 2;
    run.combat!.hand.push({ uid: 'poke', defId: 'sw-slash', upgraded: false });
    run = playCard(run, 'poke');
    expect(run.combat!.enemy.phase2Triggered).toBe(true);

    run.hp = 1;
    run.combat!.block = 0;
    run = endPlayerTurn(run);
    expect(run.hp).toBeGreaterThan(10);
    expect(run.combat!.outcome).toBe('ongoing');
  });

  it('支持涅槃真火复活与渡劫天雷撑过波次成功', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '阵爆师',
      lineage: 'array',
      rootId: 'root-xuanwu',
      seed: 555,
      ascension: 0,
      meta,
      skipBlessing: true,
    });
    run = initCombat(run, ENEMIES['e3-elite-phoenix'], 'elite');
    run.combat!.arrays = [
      { id: 'a1', name: '阵一', damagePerTurn: 5, blockPerTurn: 5, poisonPerTurn: 0 },
      { id: 'a2', name: '阵二', damagePerTurn: 5, blockPerTurn: 5, poisonPerTurn: 0 },
    ];
    run.combat!.enemy.hp = 30;
    run.combat!.hand.push({ uid: 'boom', defId: 'ar-detonate-arrays', upgraded: true });
    run = playCard(run, 'boom');
    expect(run.combat!.enemy.rebirthUsed).toBe(true);
    expect(run.combat!.enemy.hp).toBeGreaterThan(0);

    run = initCombat(run, ENEMIES['e1-boss-tribulation'], 'boss');
    run.hp = 999;
    run.maxHp = 999;
    for (let i = 0; i < 6; i++) {
      run.combat!.block = 100;
      run = endPlayerTurn(run);
    }
    expect(run.combat?.outcome).toBe('tribulation-survived');
  });
});

describe('破界飞升灵界/仙界、跨界起点解锁与第九卷斩时间道祖结局', () => {
  it('第 3 卷破界飞升灵界自动升级基础牌并觉醒真灵，第 9 卷斩古或今达成超脱真结局', () => {
    let meta = defaultMetaSave();
    let run = createNewRun({
      name: '韩跑跑',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 888,
      ascension: 0,
      meta,
      skipBlessing: true,
    });

    // 模拟第 3 卷破开空间节点飞升灵界！
    run.act = 3;
    run.stats.maxSingleHit = 95;
    run = initCombat(run, ENEMIES['e3-boss-ascension'], 'boss');
    run.combat!.enemy.hp = 0;
    run.combat!.outcome = 'victory';
    run.stats.tribulationsSlain = 1;

    run = resolveCombatVictory(run, meta.achievements);
    expect(run.phase).toBe('breakthrough');
    expect(run.reward?.trueSpiritChoices?.length).toBe(3);
    // 飞升灵界洗礼：基础牌全部自动升级！
    expect(run.deck.filter((c) => c.defId === 'sw-slash').every((c) => c.upgraded)).toBe(true);

    run = claimTrueSpirit(run, 'spirit-roc');
    run = claimSecondaryMethod(run, 'method-venom-sword');
    const rolled = rollCardChoices(run, new SeededRng(7), 20);
    expect(rolled.some((c) => c.lineage === 'alchemy')).toBe(true);
    if (run.reward?.lawChoices?.length) {
      run = claimBreakthroughLaw(run, run.reward.lawChoices[0].id);
    }
    run = finishRewardAndAdvance(run, meta);
    expect(run.act).toBe(4);
    expect(run.realm).toBe('void');

    // 模拟推进至第 9 卷斩杀时间道祖【古或今】并持有 5 枚掌天道果唤醒混沌终极态！
    run.act = 9;
    run.daoTokens = 5;
    run = initCombat(run, ENEMIES['e9-boss-guhuojin'], 'boss');
    expect(run.combat!.enemy.name).toContain('混沌终极');
    // 验证实时动态卡面数值在仙界（1.68x + 雷鹏1.25x）下自动放大并标记 boosted
    const dyn = getDynamicCardDescription({ uid: 'd1', defId: 'sw-slash', upgraded: true }, undefined, run);
    expect(dyn.boosted).toBe(true);
    expect(dyn.text).not.toContain('造成 9 点');

    // 验证 Boss 二阶段破境锁血护道（单次超高伤害不会跳过 50% 二阶段）
    run.combat!.hand.push({ uid: 'nuke', defId: 'dm-xuantian-slash', upgraded: true });
    run.combat!.damageBoostPct = 5000;
    run = playCard(run, 'nuke');
    expect(run.combat!.enemy.phase2Triggered).toBe(true);
    expect(run.combat!.enemy.hp).toBeGreaterThan(0);

    run.combat!.enemy.hp = 0;
    run.combat!.outcome = 'victory';
    run = resolveCombatVictory(run, meta.achievements);
    expect(run.phase).toBe('victory');
    expect(run.realm).toBe('dao-ancestor');

    const settled = settleRunIntoMeta(meta, run, 'true-victory');
    meta = settled.nextMeta;
    expect(getUnlockedStartWorlds(meta)).toEqual(expect.arrayContaining(['mortal', 'spirit', 'immortal']));
    expect(settled.newAchievements).toContain('ach-true-ending');
    const poolAfter = getUnlockedRewardCardPool(meta.achievements);
    expect(poolAfter.some((c) => c.id === 'nu-four-swords-formation')).toBe(true);
  });

  it('百年拍卖截胡、洞府闭关与每日天机稳定运作', () => {
    const d1 = getDailyChallengeConfig('2026-11-27');
    const d2 = getDailyChallengeConfig('2026-11-27');
    expect(d1.seed).toBe(d2.seed);

    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '劫修',
      lineage: 'demon',
      rootId: 'root-demon-fetus',
      seed: 333,
      ascension: 0,
      meta,
      skipBlessing: true,
    });
    run.phase = 'auction';
    run.auction = {
      lots: [
        { id: 'l1', name: '龙血果', description: '测试', price: 90, kind: 'maxhp', refId: '24', claimed: false },
      ],
      settled: false,
    };
    const maxHpBefore = run.maxHp;
    run = auctionAmbushBuyer(run);
    expect(run.maxHp).toBe(maxHpBefore + 24);
    expect(run.phase).toBe('combat');

    run.phase = 'abode';
    run.abodeUsed = false;
    run.materials.push('swift');
    run = abodeUpgradeOrEnchant(run, run.deck[0].uid, 'swift');
    expect(run.deck[0].enchant).toBe('swift');

    run.abodeUsed = false;
    run.consumables = [];
    const brew = abodeBrewElixir(run, 'steady');
    expect(brew.nextRun.consumables.length).toBe(1);

    run = brew.nextRun;
    run.abodeUsed = false;
    const lenBefore = run.deck.length;
    run = abodePurgeCard(run, run.deck[1].uid);
    expect(run.deck.length).toBe(lenBefore - 1);
  });
});
