import { describe, expect, it } from 'vitest';
import { getUnlockedRewardCardPool } from '../src/content/cards';
import { ENEMIES } from '../src/content/enemies';
import {
  activateTreasure,
  endPlayerTurn,
  initCombat,
  playCard,
  previewResonance,
  useConsumable,
} from '../src/core/combat-engine';
import { generateActMap, getReachableNodeIds } from '../src/core/map-generator';
import { defaultMetaSave, settleRunIntoMeta, unlockLineageInMeta } from '../src/core/meta-save';
import { SeededRng } from '../src/core/rng';
import {
  abodeBrewElixir,
  abodePurgeCard,
  abodeUpgradeOrEnchant,
  auctionAmbushBuyer,
  chooseStartingBlessing,
  claimBreakthroughLaw,
  claimPastLifeRemnant,
  claimSecondaryMethod,
  createNewRun,
  enterMapNode,
  finishRewardAndAdvance,
  getDailyChallengeConfig,
  resolveCombatVictory,
  rollCardChoices,
} from '../src/core/run-manager';

describe('星宿路线图、狂暴精英、百年拍卖与前世遗蜕', () => {
  it('生成含狂暴精英、拍卖会与前世遗蜕的连通星宿图', () => {
    const rng = new SeededRng(42);
    const remnant = {
      generation: 1,
      name: '韩立',
      lineage: 'sword' as const,
      act: 2 as const,
      deathCause: '渡劫陨落',
      leftTreasureId: 'tr-sword-box',
    };
    const map2 = generateActMap(2, rng, remnant);
    expect(map2.some((n) => n.type === 'boss')).toBe(true);
    expect(map2.some((n) => n.type === 'fury-elite')).toBe(true);
    expect(map2.some((n) => n.type === 'auction')).toBe(true);
    expect(map2.some((n) => n.type === 'remnant')).toBe(true);

    for (const node of map2) {
      if (node.type !== 'boss') {
        expect(node.nextIds.length).toBeGreaterThan(0);
      }
    }
    expect(getReachableNodeIds(map2, null).length).toBe(3);
  });

  it('开局天命四选一支持重铸绝世神话法宝', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '天命人',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 101,
      ascension: 0,
      meta,
    });
    expect(run.phase).toBe('blessing');
    run = chooseStartingBlessing(run, 'mythic-treasure', meta);
    expect(run.phase).toBe('map');
    expect(['tr-chaos-bell', 'tr-nine-dragon-caluldron', 'tr-zhuxian-blade']).toContain(run.treasures[0]);
  });
});

describe('灵印相生、敌方法则、Boss二阶段与进阶新算子', () => {
  it('准确判定七大灵印相生共鸣', () => {
    expect(previewResonance(['wood'], 'fire', false)?.name).toContain('木火相生');
    expect(previewResonance(['metal'], 'thunder', false)?.name).toContain('金雷引煞');
    expect(previewResonance(['earth'], 'metal', false)?.name).toContain('厚土孕剑');
    expect(previewResonance(['water'], 'wood', false)?.name).toContain('寒泉滋荣');
    expect(previewResonance(['earth'], 'water', false)?.name).toContain('山泽通气');
    expect(previewResonance(['sha'], 'sha', false)?.name).toContain('魔威滔天');
    expect(previewResonance(['metal', 'wood'], 'water', true)?.name).toContain('五行混元');
  });

  it('支持 X 费诛仙剑、辅修毒剑联动、Boss 半血二阶段化相与乾坤丹符瞬发', () => {
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
    // 封灵魔瘴词条令灵印上限变为 2
    expect(run.combat!.maxSealSlots).toBe(2);

    // 瞬发暴血燃魂丹：真元 +2，伤害 +50%
    const qiBefore = run.combat!.qi;
    run = useConsumable(run, 0);
    expect(run.combat!.qi).toBe(qiBefore + 2);
    expect(run.combat!.damageBoostPct).toBe(50);

    // 打出 X 费《太白诛仙剑》倾泻全部真元，并触发《万毒淬剑录》每剑叠毒！
    run.combat!.hand.push({ uid: 'x-sword', defId: 'sw-x-zhuxian', upgraded: true });
    run = playCard(run, 'x-sword');
    expect(run.combat!.qi).toBe(0);
    expect(run.combat!.enemy.poison).toBeGreaterThanOrEqual(8);

    // 将 Boss 压入半血以下验证二阶段化相触发
    run.combat!.enemy.hp = Math.floor(run.combat!.enemy.maxHp * 0.45);
    run.combat!.qi = 2;
    run.combat!.hand.push({ uid: 'poke', defId: 'sw-slash', upgraded: false });
    run = playCard(run, 'poke');
    expect(run.combat!.enemy.phase2Triggered).toBe(true);
    expect(run.combat!.enemy.block).toBeGreaterThan(0);

    // 验证替死木偶符在致命伤害时自动代死复活
    run.hp = 1;
    run.combat!.block = 0;
    run = endPlayerTurn(run);
    expect(run.hp).toBeGreaterThan(10);
    expect(run.combat!.outcome).toBe('ongoing');
    expect(run.consumables.includes('con-revive-doll')).toBe(false);
  });

  it('支持涅槃真火复活与引爆全场阵盘斩杀', () => {
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
    // 凤凰首次归零触发涅槃真火重生！
    expect(run.combat!.enemy.rebirthUsed).toBe(true);
    expect(run.combat!.enemy.hp).toBeGreaterThan(0);
    expect(run.combat!.arrays.length).toBe(0);
  });

  it('渡劫天雷撑过全部波次即判渡劫成功', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '玄龟子',
      lineage: 'array',
      rootId: 'root-xuanwu',
      seed: 2026,
      ascension: 0,
      meta,
      skipBlessing: true,
    });
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

describe('辅修心法跨系池、百年拍卖截胡、成就解锁与每日天机', () => {
  it('破境解锁辅修心法开放跨系卡池，达成名场面成就解锁暗金禁术', () => {
    let meta = defaultMetaSave();
    let run = createNewRun({
      name: '问鼎客',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 888,
      ascension: 0,
      meta,
      skipBlessing: true,
    });

    run.foundation = 90;
    run.stats.maxSingleHit = 92; // 触发【一剑开天门】成就
    run = initCombat(run, ENEMIES['e1-boss-tribulation'], 'boss');
    run.combat!.enemy.hp = 0;
    run.combat!.outcome = 'victory';
    run.stats.tribulationsSlain = 1;

    run = resolveCombatVictory(run, meta.achievements);
    expect(run.phase).toBe('breakthrough');
    expect(run.reward?.methodChoices?.length).toBe(3);

    // 习得《万毒淬剑录》后，掉落池应包含丹修神通
    run = claimSecondaryMethod(run, 'method-venom-sword');
    expect(run.secondaryMethod).toBe('method-venom-sword');
    const rolled = rollCardChoices(run, new SeededRng(7), 20);
    expect(rolled.some((c) => c.lineage === 'alchemy')).toBe(true);

    const firstLaw = run.reward!.lawChoices![0].id;
    run = claimBreakthroughLaw(run, firstLaw);
    run = finishRewardAndAdvance(run, meta);
    expect(run.act).toBe(2);

    // 轮回结算校验成就解锁暗金卡入池
    const settled = settleRunIntoMeta(meta, { ...run, phase: 'gameover', deathCause: '寿尽坐化' }, 'death');
    meta = settled.nextMeta;
    expect(settled.newAchievements).toContain('ach-one-strike-80');
    expect(settled.newAchievements).toContain('ach-tribulation-slayer');
    const poolAfter = getUnlockedRewardCardPool(meta.achievements);
    expect(poolAfter.some((c) => c.id === 'nu-four-swords-formation')).toBe(true);
  });

  it('百年拍卖会支持杀人夺宝直接进入狂暴精英战，且每日天机生成稳定同种配置', () => {
    const d1 = getDailyChallengeConfig('2026-11-27');
    const d2 = getDailyChallengeConfig('2026-11-27');
    expect(d1.seed).toBe(d2.seed);
    expect(d1.mutators.map((m) => m.id)).toEqual(d2.mutators.map((m) => m.id));

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
        { id: 'l1', name: '孤品', description: '测试', price: 99, kind: 'lifespan', refId: 'lifespan', claimed: false },
      ],
      settled: false,
    };
    const lifeBefore = run.maxLifespan;
    run = auctionAmbushBuyer(run);
    expect(run.maxLifespan).toBe(lifeBefore + 24);
    expect(run.phase).toBe('combat');
    expect(run.combat?.nodeType).toBe('fury-elite');
  });

  it('洞府升级附魔、炼丹凝奇丹、删牌与赶路寿尽正常运作', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '老朽',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 123,
      ascension: 0,
      meta,
      skipBlessing: true,
    });
    run.phase = 'abode';
    run.materials.push('swift');
    run = abodeUpgradeOrEnchant(run, run.deck[0].uid, 'swift');
    expect(run.deck[0].enchant).toBe('swift');

    run.abodeUsed = false;
    run.consumables = [];
    const brew = abodeBrewElixir(run, 'steady');
    expect(brew.nextRun.consumables.length).toBe(1);

    run = brew.nextRun;
    run.abodeUsed = false;
    run = abodePurgeCard(run, run.deck[1].uid);
    run.phase = 'map';
    run.age = run.maxLifespan - 1;
    const dead = enterMapNode(run, getReachableNodeIds(run.map, null)[0]);
    expect(dead.phase).toBe('gameover');
  });
});
