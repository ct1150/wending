import type { LineageDef, LineageId, RealmId, RootDef } from '../core/types';

export const REALM_NAMES: Record<RealmId, string> = {
  qi: '炼气境',
  foundation: '筑基境',
  core: '金丹境',
  nascent: '元婴境',
  ascended: '问鼎飞升',
};

export const ACT_TITLES: Record<1 | 2 | 3 | 4, { name: string; subtitle: string }> = {
  1: { name: '第一卷 · 凡尘筑道', subtitle: '炼气起步，斩妖寻宝；以半血以上或劈碎劫眼迎战筑基天劫可获金色天道法则' },
  2: { name: '第二卷 · 紫府金丹', subtitle: '兼修异派心法，竞拍稀世仙珍，在紫府大劫中证一品金丹' },
  3: { name: '第三卷 · 化神登仙', subtitle: '神通大成，直面飞升九重混沌雷劫；集齐 2 枚道果可破入上界' },
  4: { name: '隐藏终卷 · 上界问鼎', subtitle: '破开南天门，向太初天道问鼎真结局' },
};

export const LINEAGES: Record<LineageId, LineageDef> = {
  sword: {
    id: 'sword',
    name: '太白剑宗 · 剑修',
    sect: '太白剑宗',
    title: '一剑破万法',
    description: '主修金雷剑气。叠【剑意】驱动零费飞剑高频连斩，亦可修【剑罡反击】借敌连击反杀。',
    primaryElements: ['metal', 'thunder'],
    baseHp: 75,
    starterMethodName: '《太白青莲剑典》',
    starterMethodDesc: '每回合第 3 张金/雷系神通额外获得 1 层剑意并抽 1 牌。',
    starterTreasureId: 'tr-sword-box',
    starterDeck: [
      'sw-slash', 'sw-slash', 'sw-slash', 'sw-slash',
      'sw-ward', 'sw-ward', 'sw-ward',
      'sw-focus', 'sw-flying', 'sw-thunder-pierce',
    ],
    unlockCost: 0,
  },
  demon: {
    id: 'demon',
    name: '幽冥魔渊 · 魔修',
    sect: '幽冥魔渊',
    title: '燃血逆天命',
    description: '主修煞火禁术。主动燃血或献祭气血上限换取超模爆发，斩杀敌人吸回气血并永久涨上限！',
    primaryElements: ['sha', 'fire'],
    baseHp: 84,
    starterMethodName: '《长生燃血魔功》',
    starterMethodDesc: '战中每次主动燃血，立即获得 4 点护体罡气；斩杀敌人回 5 血并永久 +1 最大气血。',
    starterTreasureId: 'tr-soul-banner',
    starterDeck: [
      'dm-claw', 'dm-claw', 'dm-claw', 'dm-claw',
      'dm-blood-shield', 'dm-blood-shield', 'dm-blood-shield',
      'dm-burn-life', 'dm-devour-heart', 'dm-soul-reap',
    ],
    unlockCost: 0,
  },
  alchemy: {
    id: 'alchemy',
    name: '百草丹谷 · 丹修',
    sect: '百草丹谷',
    title: '木火炼万物',
    description: '主修木火丹毒。手搓 0 费灵丸凑木火相生，叠高额无视护盾的【丹毒】并连续引爆回血。',
    primaryElements: ['wood', 'fire'],
    baseHp: 78,
    starterMethodName: '《神农百毒归元经》',
    starterMethodDesc: '触发【木火相生】时，额外给敌方施加 3 层丹毒并恢复 3 点气血；丹符药效提升 50%。',
    starterTreasureId: 'tr-pill-furnace',
    starterDeck: [
      'al-thorn', 'al-thorn', 'al-thorn',
      'al-mist-guard', 'al-mist-guard', 'al-mist-guard',
      'al-brew-toxin', 'al-brew-toxin', 'al-flame-spark', 'al-detonate',
    ],
    unlockCost: 40,
  },
  array: {
    id: 'array',
    name: '玄武阵山 · 阵修',
    sect: '玄武阵山',
    title: '九宫镇乾坤',
    description: '主修土水奇阵。铺设永续【阵盘】回合末自动攻防、护盾留存，亦可一键引爆全场大阵斩杀。',
    primaryElements: ['earth', 'water'],
    baseHp: 82,
    starterMethodName: '《玄武九宫镇岳录》',
    starterMethodDesc: '每回合结束时保留至多 12 点未消耗的护体罡气；场上每座阵盘令获盾量 +2。',
    starterTreasureId: 'tr-xuanhuang-tower',
    starterDeck: [
      'ar-stone-strike', 'ar-stone-strike', 'ar-stone-strike',
      'ar-earth-wall', 'ar-earth-wall', 'ar-earth-wall', 'ar-earth-wall',
      'ar-turret-setup', 'ar-water-mirror', 'ar-shield-slam',
    ],
    unlockCost: 60,
  },
};

export const ROOTS: RootDef[] = [
  {
    id: 'root-heaven-sword',
    name: '太白剑骨天灵根',
    grade: '天灵根',
    elements: ['metal', 'thunder'],
    initialSeal: 'metal',
    description: '庚金锐气天成，开战自带一枚【金印】，极易触发金雷惊蛰。',
    passiveText: '每战自带【金印】；战利品更易出现金/雷神通，最大气血 +4。',
    bonusMaxHp: 4,
  },
  {
    id: 'root-wood-fire',
    name: '青木离火真灵根',
    grade: '真灵根',
    elements: ['wood', 'fire'],
    initialSeal: 'wood',
    description: '木火相生，生机绵长，开战自带一枚【木印】。',
    passiveText: '每战自带【木印】；最大气血 +10。',
    bonusMaxHp: 10,
  },
  {
    id: 'root-xuanwu',
    name: '玄水厚土真灵根',
    grade: '真灵根',
    elements: ['earth', 'water'],
    initialSeal: 'earth',
    description: '山泽通气，根基浑厚，开战自带一枚【土印】。',
    passiveText: '每战自带【土印】；最大气血 +12。',
    bonusMaxHp: 12,
  },
  {
    id: 'root-thunder',
    name: '九霄神雷异灵根',
    grade: '异灵根',
    elements: ['thunder', 'metal'],
    initialSeal: 'thunder',
    description: '劫雷亲和之体，开战自带一枚【雷印】，首回合灵气充盈。',
    passiveText: '每战自带【雷印】；每场战斗第 1 回合额外获得 1 点真元。',
    bonusQi: 1,
  },
  {
    id: 'root-demon-fetus',
    name: '九幽噬煞魔胎',
    grade: '魔胎',
    elements: ['sha', 'fire'],
    initialSeal: 'sha',
    description: '天生亲近幽冥煞气，开战自带一枚【煞印】，肉身强横。',
    passiveText: '每战自带【煞印】；最大气血 +10。',
    bonusMaxHp: 10,
  },
  {
    id: 'root-mixed-five',
    name: '混沌五行伪灵根',
    grade: '伪灵根',
    elements: ['metal', 'wood', 'water', 'fire', 'earth'],
    initialSeal: 'water',
    description: '看似驳杂的五灵根，实则暗藏混元之机，集齐三色五行印即可逆乱阴阳。',
    passiveText: '触发任意灵印共鸣时额外抽 1 张牌；集齐 3 种不同五行印即爆【五行混元】！',
    mixedFiveBonus: true,
  },
];

export const LINEAGE_LIST = Object.values(LINEAGES);

export function getRootById(id: string): RootDef {
  return ROOTS.find((r) => r.id === id) ?? ROOTS[0];
}
