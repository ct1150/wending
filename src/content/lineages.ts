import type { LineageDef, LineageId, RootDef, RealmId } from '../core/types';

export const REALM_NAMES: Record<RealmId, string> = {
  qi: '炼气境',
  foundation: '筑基境',
  core: '金丹境',
  nascent: '元婴境',
  ascended: '问鼎飞升',
};

export const ACT_TITLES: Record<1 | 2 | 3 | 4, { name: string; subtitle: string }> = {
  1: { name: '第一卷 · 凡尘筑道', subtitle: '炼气起步，斩妖寻宝，以道基纯度冲关天道筑基' },
  2: { name: '第二卷 · 紫府金丹', subtitle: '丹成九品，法宝显威，在宗门与魔道夹缝中证元婴' },
  3: { name: '第三卷 · 化神登仙', subtitle: '法则初成，因果清算，直面飞升九重混沌雷劫' },
  4: { name: '隐藏终卷 · 上界问鼎', subtitle: '集齐三界道果，破开南天门，向太初天道问鼎' },
};

export const LINEAGES: Record<LineageId, LineageDef> = {
  sword: {
    id: 'sword',
    name: '太白剑宗 · 剑修',
    sect: '太白剑宗',
    title: '一剑破万法',
    description: '主修金雷剑气。叠满【剑意】驱动零费飞剑高频连斩，兼具穿甲与爆发，进攻节奏如疾风骤雨。',
    primaryElements: ['metal', 'thunder'],
    baseHp: 72,
    baseLifespan: 82,
    starterMethodName: '《太白青莲剑典》',
    starterMethodDesc: '每回合第 3 张剑系神通额外获得 1 层剑意并抽 1 牌。',
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
    title: '燃寿逆天命',
    description: '主修煞火禁术。主动卖血或燃寿换取超模爆发，吞噬【心魔】转化杀伤，斩敌【夺元】吸回寿元。',
    primaryElements: ['sha', 'fire'],
    baseHp: 80,
    baseLifespan: 86,
    starterMethodName: '《长生燃血魔功》',
    starterMethodDesc: '每次在战斗中消耗自身气血或寿元，立即获得 4 点护体罡气；斩杀敌人恢复 4 年寿元。',
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
    description: '主修木火丹毒。以木生火叠高额【丹毒】并引爆毒伤，兼顾回生续命与高品炼丹，愈战愈强。',
    primaryElements: ['wood', 'fire'],
    baseHp: 74,
    baseLifespan: 90,
    starterMethodName: '《神农百毒归元经》',
    starterMethodDesc: '触发【木火相生】时，额外给敌方施加 3 层丹毒并恢复 3 点气血。',
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
    description: '主修土水奇阵。铺设永续【阵盘】回合末自动攻防，叠加厚重【护体罡气】留存反震，稳如泰山。',
    primaryElements: ['earth', 'water'],
    baseHp: 78,
    baseLifespan: 88,
    starterMethodName: '《玄武九宫镇岳录》',
    starterMethodDesc: '每回合结束时保留至多 12 点未消耗的护体罡气；场上每座阵盘令罡气获取 +2。',
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
    passiveText: '首回合自带【金印】；战利品更易出现金/雷神通。',
    bonusMaxHp: 4,
  },
  {
    id: 'root-wood-fire',
    name: '青木离火真灵根',
    grade: '真灵根',
    elements: ['wood', 'fire'],
    initialSeal: 'wood',
    description: '木火相生，丹道奇才，开战自带一枚【木印】，寿元悠长。',
    passiveText: '首回合自带【木印】；初始寿元 +8 年。',
    bonusLifespan: 8,
  },
  {
    id: 'root-xuanwu',
    name: '玄水厚土真灵根',
    grade: '真灵根',
    elements: ['earth', 'water'],
    initialSeal: 'earth',
    description: '山泽通气，根基沉稳，开战自带一枚【土印】，体魄强横。',
    passiveText: '首回合自带【土印】；最大气血 +10。',
    bonusMaxHp: 10,
  },
  {
    id: 'root-thunder',
    name: '九霄神雷异灵根',
    grade: '异灵根',
    elements: ['thunder', 'metal'],
    initialSeal: 'thunder',
    description: '劫雷亲和之体，开战自带一枚【雷印】，首回合灵气充盈。',
    passiveText: '首回合自带【雷印】；每场战斗首回合额外获得 1 点真元。',
    bonusQi: 1,
  },
  {
    id: 'root-demon-fetus',
    name: '九幽噬煞魔胎',
    grade: '魔胎',
    elements: ['sha', 'fire'],
    initialSeal: 'sha',
    description: '天生亲近幽冥煞气，开战自带一枚【煞印】，嗜血长生。',
    passiveText: '首回合自带【煞印】；初始寿元 +6 年，最大气血 +6。',
    bonusLifespan: 6,
    bonusMaxHp: 6,
  },
  {
    id: 'root-mixed-five',
    name: '混沌五行伪灵根',
    grade: '伪灵根',
    elements: ['metal', 'wood', 'water', 'fire', 'earth'],
    initialSeal: 'water',
    description: '世人嗤笑的杂灵根，却暗藏混沌混元之机，五行齐鸣可逆乱阴阳。',
    passiveText: '触发任意相生共鸣时额外抽 1 张牌；五行混元共鸣门槛降低为 3 种不同五行印。',
    mixedFiveBonus: true,
  },
];

export const LINEAGE_LIST = Object.values(LINEAGES);

export function getRootById(id: string): RootDef {
  return ROOTS.find((r) => r.id === id) ?? ROOTS[0];
}
