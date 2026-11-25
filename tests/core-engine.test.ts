import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/content/enemies';
import {
  activateTreasure,
  endPlayerTurn,
  initCombat,
  playCard,
  previewResonance,
} from '../src/core/combat-engine';
import { generateActMap, getReachableNodeIds } from '../src/core/map-generator';
import { defaultMetaSave, settleRunIntoMeta, unlockLineageInMeta } from '../src/core/meta-save';
import { SeededRng } from '../src/core/rng';
import {
  abodeBrewElixir,
  abodePurgeCard,
  abodeUpgradeOrEnchant,
  claimBreakthroughLaw,
  claimPastLifeRemnant,
  createNewRun,
  enterMapNode,
  finishRewardAndAdvance,
  resolveCombatVictory,
} from '../src/core/run-manager';

describe('星宿路线图与前世遗蜕注入', () => {
  it('每卷生成连通星宿图并在匹配章节注入前世遗蜕节点', () => {
    const rng = new SeededRng(42);
    const remnant = {
      generation: 1,
      name: '韩立',
      lineage: 'sword' as const,
      act: 1 as const,
      deathCause: '渡劫陨落',
      leftTreasureId: 'tr-sword-box',
    };
    const map = generateActMap(1, rng, remnant);
    expect(map.some((n) => n.type === 'boss')).toBe(true);
    expect(map.some((n) => n.type === 'remnant')).toBe(true);

    // 校验除关底外每个节点都有出边
    for (const node of map) {
      if (node.type !== 'boss') {
        expect(node.nextIds.length).toBeGreaterThan(0);
      }
    }
    const startNodes = getReachableNodeIds(map, null);
    expect(startNodes.length).toBe(3);
  });

  it('隐藏第四卷生成 4 层终局地图', () => {
    const map = generateActMap(4, new SeededRng(99), null);
    expect(map.length).toBe(5);
    expect(map.find((n) => n.type === 'boss')?.act).toBe(4);
  });
});

describe('灵印相生与斗法引擎', () => {
  it('准确判定五行相生、魔煞共鸣与伪灵根混元共鸣', () => {
    expect(previewResonance(['wood'], 'fire', false)?.name).toContain('木火相生');
    expect(previewResonance(['metal'], 'thunder', false)?.name).toContain('金雷引煞');
    expect(previewResonance(['earth'], 'metal', false)?.name).toContain('厚土孕剑');
    expect(previewResonance(['water'], 'wood', false)?.name).toContain('寒泉滋荣');
    expect(previewResonance(['earth'], 'water', false)?.name).toContain('山泽通气');
    expect(previewResonance(['sha'], 'sha', false)?.name).toContain('魔威滔天');
    expect(previewResonance(['metal', 'wood'], 'water', true)?.name).toContain('五行混元');
  });

  it('剑修出牌触发金雷共鸣、充能本命法宝并可祭出斩敌', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '林动',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 1001,
      ascension: 0,
      meta,
    });
    run = initCombat(run, ENEMIES['e1-wolf'], 'battle');
    expect(run.combat?.seals).toEqual(['metal']);

    // 强行放入一张惊雷刺测试金->雷共鸣
    run.combat!.hand.push({ uid: 'test-thunder', defId: 'sw-thunder-pierce', upgraded: false });
    const foeHpBefore = run.combat!.enemy.hp;
    run = playCard(run, 'test-thunder');
    expect(run.combat!.lastResonance?.name).toContain('金雷引煞');
    expect(run.combat!.enemy.hp).toBeLessThan(foeHpBefore - 12);
    expect(run.combat!.swordIntent).toBeGreaterThanOrEqual(1);

    // 充满剑匣后祭出法宝
    run.combat!.treasureCharges['tr-sword-box'] = 5;
    const hpBeforeTreasure = run.combat!.enemy.hp;
    run = activateTreasure(run, 'tr-sword-box');
    expect(run.combat!.enemy.hp).toBeLessThan(hpBeforeTreasure);
    expect(run.combat!.treasureCharges['tr-sword-box']).toBe(0);
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

describe('寿元、洞府三合一、天道破境与百世轮回', () => {
  it('洞府支持附魔升级、开炉炼丹与斩念删牌', () => {
    const meta = defaultMetaSave();
    let run = createNewRun({
      name: '云归',
      lineage: 'demon',
      rootId: 'root-demon-fetus',
      seed: 777,
      ascension: 0,
      meta,
    });
    run.phase = 'abode';
    run.materials.push('swift');
    const targetCard = run.deck[0];
    run = abodeUpgradeOrEnchant(run, targetCard.uid, 'swift');
    expect(run.deck[0].upgraded).toBe(true);
    expect(run.deck[0].enchant).toBe('swift');
    expect(run.materials.length).toBe(0);

    run.abodeUsed = false;
    const brewRes = abodeBrewElixir(run, 'steady');
    expect(brewRes.nextRun.foundation).toBeGreaterThan(run.foundation);

    brewRes.nextRun.abodeUsed = false;
    const beforeLen = brewRes.nextRun.deck.length;
    const purged = abodePurgeCard(brewRes.nextRun, brewRes.nextRun.deck[1].uid);
    expect(purged.deck.length).toBe(beforeLen - 1);
  });

  it('天道破境触发金色法则三选一，集齐 2 道果进入隐藏第四卷，轮回生成前世遗蜕', () => {
    let meta = defaultMetaSave();
    let run = createNewRun({
      name: '问鼎客',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 888,
      ascension: 0,
      meta,
    });

    // 模拟道基 90 劈碎第一卷雷劫
    run.foundation = 90;
    run = initCombat(run, ENEMIES['e1-boss-tribulation'], 'boss');
    run.combat!.enemy.hp = 0;
    run.combat!.outcome = 'victory';

    run = resolveCombatVictory(run);
    expect(run.phase).toBe('breakthrough');
    expect(run.reward?.breakthroughGrade).toBe('heaven');
    expect(run.reward?.lawChoices?.length).toBe(3);
    expect(run.daoTokens).toBe(1); // 劈碎劫眼额外获道果

    const firstLaw = run.reward!.lawChoices![0].id;
    run = claimBreakthroughLaw(run, firstLaw);
    expect(run.relics).toContain(firstLaw);

    run = finishRewardAndAdvance(run, meta);
    expect(run.act).toBe(2);
    expect(run.realm).toBe('foundation');

    // 测试轮回结算与道统解锁
    const settled = settleRunIntoMeta(meta, { ...run, phase: 'gameover', deathCause: '寿尽坐化' }, 'death');
    meta = settled.nextMeta;
    expect(settled.karmaEarned).toBeGreaterThan(0);
    expect(meta.pastLifeRemnant?.name).toBe('问鼎客');

    meta.karmaPoints = 100;
    const unlocked = unlockLineageInMeta(meta, 'alchemy', 40);
    expect(unlocked?.unlockedLineages).toContain('alchemy');

    // 测试下一世领取前世遗蜕
    let nextRun = createNewRun({
      name: '二世身',
      lineage: 'alchemy',
      rootId: 'root-wood-fire',
      seed: 999,
      ascension: 0,
      meta: unlocked!,
    });
    nextRun.phase = 'remnant';
    const deckBefore = nextRun.deck.length;
    nextRun = claimPastLifeRemnant(nextRun, unlocked!, 'card');
    expect(nextRun.deck.length).toBe(deckBefore + 1);
  });

  it('赶路寿尽直接触发坐化结算', () => {
    const meta = defaultMetaSave();
    const run = createNewRun({
      name: '老朽',
      lineage: 'sword',
      rootId: 'root-heaven-sword',
      seed: 123,
      ascension: 0,
      meta,
    });
    run.age = run.maxLifespan - 1;
    const firstNode = getReachableNodeIds(run.map, null)[0];
    const next = enterMapNode(run, firstNode);
    expect(next.phase).toBe('gameover');
    expect(next.deathCause).toContain('寿尽坐化');
  });
});
