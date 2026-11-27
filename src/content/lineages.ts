import type {
  ActNumber,
  LineageDef,
  LineageId,
  RealmId,
  RootDef,
  SupremeLawDef,
  SupremeLawId,
  TrueSpiritDef,
  TrueSpiritId,
  WorldId,
} from '../core/types';

export const REALM_NAMES: Record<RealmId, string> = {
  qi: '炼气期',
  foundation: '筑基期',
  core: '结丹期',
  nascent: '元婴期',
  deity: '化神期',
  void: '炼虚期',
  integration: '合体期',
  mahayana: '大乘期',
  'true-immortal': '真仙境',
  'golden-immortal': '金仙境',
  taiyi: '太乙境',
  daluo: '大罗境',
  'dao-ancestor': '混沌道祖',
  ascended: '混沌道祖',
};

export const WORLD_INFO: Record<
  WorldId,
  {
    id: WorldId;
    name: string;
    shortName: string;
    badge: string;
    energyName: string;
    powerMult: number;
    startAct: ActNumber;
    unlockDesc: string;
  }
> = {
  mortal: {
    id: 'mortal',
    name: '第一部 · 人界篇（炼气 ➔ 化神）',
    shortName: '人界篇',
    badge: '🌏 人界',
    energyName: '真元',
    powerMult: 1,
    startAct: 1,
    unlockDesc: '从天南炼气期起步，闯血色禁地、乱星海虚天殿与坠魔谷，完整历经三界九卷证道之旅。',
  },
  spirit: {
    id: 'spirit',
    name: '第二部 · 灵界篇（炼虚 ➔ 大乘）',
    shortName: '灵界篇',
    badge: '🌌 灵界',
    energyName: '元气',
    powerMult: 1.32,
    startAct: 4,
    unlockDesc: '曾飞升灵界（抵达第 4 卷）解锁：炼虚期开局，自带全升级功法、精锐神通、2 件古宝并直接觉醒【真灵血脉】！',
  },
  immortal: {
    id: 'immortal',
    name: '第三部 · 仙界篇（真仙 ➔ 道祖）',
    shortName: '仙界篇',
    badge: '☀️ 仙界',
    energyName: '仙灵力',
    powerMult: 1.68,
    startAct: 7,
    unlockDesc: '曾飞升仙界（抵达第 7 卷）解锁：北寒真仙开局，携绝世本命仙器、真灵血脉、天道法则并直接参悟【三大至尊法则】！',
  },
};

export function getWorldByAct(act: ActNumber): WorldId {
  if (act <= 3) return 'mortal';
  if (act <= 6) return 'spirit';
  return 'immortal';
}

export function getWorldPowerMultiplier(act: ActNumber): number {
  return WORLD_INFO[getWorldByAct(act)].powerMult;
}

export const ACT_REALM_MAP: Record<ActNumber, RealmId> = {
  1: 'qi',
  2: 'core',
  3: 'deity',
  4: 'void',
  5: 'integration',
  6: 'mahayana',
  7: 'true-immortal',
  8: 'taiyi',
  9: 'daluo',
};

export const ACT_TITLES: Record<
  ActNumber,
  { world: WorldId; partName: string; name: string; subtitle: string }
> = {
  // ==================== 第一部：人界篇 ====================
  1: {
    world: 'mortal',
    partName: '人界篇 · 卷一',
    name: '第一卷 · 天南初修（炼气 ➔ 筑基）',
    subtitle: '七玄门初踏仙途，闯血色禁地夺筑基灵草，迎战血禁试道雷劫',
  },
  2: {
    world: 'mortal',
    partName: '人界篇 · 卷二',
    name: '第二卷 · 乱星奇渊（结丹 ➔ 元婴）',
    subtitle: '远渡乱星海猎妖取丹，入虚天殿夺宝鼎，智斗玄骨极阴凝结元婴',
  },
  3: {
    world: 'mortal',
    partName: '人界篇 · 卷三',
    name: '第三卷 · 坠魔化神（化神 ➔ 飞升灵界）',
    subtitle: '探坠魔谷与大晋昆吾山，硬闯空间节点九重罡风，破界飞升灵界！',
  },
  // ==================== 第二部：灵界篇 ====================
  4: {
    world: 'spirit',
    partName: '灵界篇 · 卷四',
    name: '第四卷 · 风元天渊（炼虚 ➔ 合体）',
    subtitle: '觉醒真灵血脉，戍守天渊城抗击异族，下地渊破血光圣祖化身',
  },
  5: {
    world: 'spirit',
    partName: '灵界篇 · 卷五',
    name: '第五卷 · 魔劫纵横（合体 ➔ 大乘）',
    subtitle: '魔界入侵风元大陆，纵噬金虫海赴圣岛，力斩涅槃圣祖证道大乘',
  },
  6: {
    world: 'spirit',
    partName: '灵界篇 · 卷六',
    name: '第六卷 · 万族问鼎（大乘 ➔ 飞升仙界）',
    subtitle: '横扫摩诃雷海与螟虫母眷，登飞升台硬撼九九紫霄灭仙雷劫，飞升北寒仙域！',
  },
  // ==================== 第三部：仙界篇 ====================
  7: {
    world: 'immortal',
    partName: '仙界篇 · 卷七',
    name: '第七卷 · 北寒初仙（真仙 ➔ 金仙）',
    subtitle: '参悟时间/空间/轮回至尊法则，闯冥寒仙府，剑斩北寒仙宫萧晋寒',
  },
  8: {
    world: 'immortal',
    partName: '仙界篇 · 卷八',
    name: '第八卷 · 灰界太乙（太乙 ➔ 大罗）',
    subtitle: '陷落灰界与积鳞空境，入真言门悟光阴之秘，渡斩三尸大罗心魔劫',
  },
  9: {
    world: 'immortal',
    partName: '仙界篇 · 终卷',
    name: '第九卷 · 混沌道祖（中土天庭终战）',
    subtitle: '杀上中土仙域凌霄天庭，决战时间道祖【古或今】，问鼎万界混沌道祖！',
  },
};

export const TRUE_SPIRITS: Record<TrueSpiritId, TrueSpiritDef> = {
  'spirit-phoenix': {
    id: 'spirit-phoenix',
    name: '真灵血脉 · 天凤真血',
    badge: '天凤',
    description: '灵界真灵法相：每回合首次燃血或受击损血时，立即恢复 10 点气血并对敌方施加 5 层【丹毒】；每战胜利额外恢复 6 点气血。',
  },
  'spirit-peacock': {
    id: 'spirit-peacock',
    name: '真灵血脉 · 五色孔雀法相',
    badge: '孔雀',
    description: '灵界真灵法相：五行灵印槽上限突破至 4 格！每次触发灵印相生共鸣时，额外回复 1 点元气并轰出 16 点五色神光穿甲真伤！',
  },
  'spirit-roc': {
    id: 'spirit-roc',
    name: '真灵血脉 · 惊蛰雷鹏金身',
    badge: '雷鹏',
    description: '灵界真灵法相：每场战斗开局自带 4 层【剑意】与 14 点【护体罡气】，且你的所有直接攻击伤害永久提高 25%！',
  },
};

export const TRUE_SPIRIT_LIST = Object.values(TRUE_SPIRITS);

export const SUPREME_LAWS: Record<SupremeLawId, SupremeLawDef> = {
  'supreme-time': {
    id: 'supreme-time',
    name: '至尊法则 · 时间法则（大五行幻世诀）',
    badge: '时间法则',
    description: '三大至尊法则之首：每回合你打出的第 1 张非消耗神通牌，会凝聚【光阴幻影】0 费自动再结算 1 次！且每逢第 3 回合令敌方陷入 2 层破绽与虚弱。',
  },
  'supreme-space': {
    id: 'supreme-space',
    name: '至尊法则 · 空间法则（洞天镇界）',
    badge: '空间法则',
    description: '三大至尊法则：空间撕裂无视敌方减伤玄甲！每回合初额外多抽 2 张牌，且每次直接攻击额外附带 35% 穿甲空间真伤！',
  },
  'supreme-samsara': {
    id: 'supreme-samsara',
    name: '至尊法则 · 轮回法则（六道轮回盘）',
    badge: '轮回法则',
    description: '三大至尊法则：每次消耗卡牌或主动燃血，回复 1 点仙灵力、8 点罡气与 6 点气血；每场战斗首次致命伤必定逆转轮回（恢复 50% 气血并获 28 盾）！',
  },
};

export const SUPREME_LAW_LIST = Object.values(SUPREME_LAWS);

export const LINEAGES: Record<LineageId, LineageDef> = {
  sword: {
    id: 'sword',
    name: '青元剑道 · 剑修',
    sect: '青元剑宗',
    title: '一剑破万法',
    description: '主修青竹蜂云金雷剑气。叠【剑意】驱动零费飞剑高频连斩，后期可布《大庚剑阵》与【剑罡反击】斩仙弑神。',
    primaryElements: ['metal', 'thunder'],
    baseHp: 75,
    starterMethodName: '《青元剑诀》',
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
    name: '玄阴煞道 · 魔修',
    sect: '六道魔宗',
    title: '燃血逆天命',
    description: '主修托天魔功与煞火禁术。主动燃血或献祭气血上限换取超模爆发，斩杀强敌吸回精元并永久涨气血上限！',
    primaryElements: ['sha', 'fire'],
    baseHp: 84,
    starterMethodName: '《梵圣真魔功》',
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
    name: '药园虫谷 · 丹修',
    sect: '黄枫百草谷',
    title: '掌天催百草',
    description: '主修木火丹毒与奇虫催熟。手搓灵丸凑木火相生，叠高额无视护盾的【丹毒】并连续引爆回血。',
    primaryElements: ['wood', 'fire'],
    baseHp: 78,
    starterMethodName: '《百毒噬金真经》',
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
    name: '大衍天星 · 阵修',
    sect: '天星阵山',
    title: '阵镇三千界',
    description: '主修土水奇阵与傀儡神光。铺设永续【阵盘】回合末自动攻防、护盾留存，亦可引爆全场古阵轰杀大罗。',
    primaryElements: ['earth', 'water'],
    baseHp: 82,
    starterMethodName: '《大衍九宫镇岳录》',
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
    name: '庚金剑骨天灵根',
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
    name: '辟邪神雷异灵根',
    grade: '异灵根',
    elements: ['thunder', 'metal'],
    initialSeal: 'thunder',
    description: '辟邪神雷亲和之体，开战自带一枚【雷印】，首回合灵气充盈。',
    passiveText: '每战自带【雷印】；每场战斗第 1 回合额外获得 1 点真元。',
    bonusQi: 1,
  },
  {
    id: 'root-demon-fetus',
    name: '玄阴天煞魔胎',
    grade: '魔胎',
    elements: ['sha', 'fire'],
    initialSeal: 'sha',
    description: '天生亲近幽冥真魔气，开战自带一枚【煞印】，肉身强横。',
    passiveText: '每战自带【煞印】；最大气血 +10。',
    bonusMaxHp: 10,
  },
  {
    id: 'root-mixed-five',
    name: '凡人四属性伪灵根',
    grade: '伪灵根',
    elements: ['metal', 'wood', 'water', 'fire', 'earth'],
    initialSeal: 'water',
    description: '韩老魔同款驳杂伪灵根，实则暗合大五行幻世之机，集齐三色五行印即可逆天改命！',
    passiveText: '触发任意灵印共鸣时额外抽 1 张牌；集齐 3 种不同五行印即爆【五行混元】！',
    mixedFiveBonus: true,
  },
];

export const LINEAGE_LIST = Object.values(LINEAGES);

export function getRootById(id: string): RootDef {
  return ROOTS.find((r) => r.id === id) ?? ROOTS[0];
}
