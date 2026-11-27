import type { EncounterDef } from '../core/types';

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'enc-old-cauldron',
    title: '残碑古鼎 · 问剑石溪',
    acts: [1, 2],
    prose: '荒崖下立着半截残缺青铜鼎，鼎腹隐隐透出上古剑修留下的灵犀残意，四周煞气却在悄然侵蚀生机。',
    choices: [
      {
        id: 'absorb', label: '燃寿参悟鼎铭', detail: '消耗 4 年寿元', ageCost: 4,
        rewardText: '道基纯度 +22，获得 1 张稀有神通',
        effect: { foundation: 22, addRandomCard: 'rare' },
      },
      {
        id: 'pry', label: '撬取鼎耳灵材', detail: '损耗 8 点气血', hpCost: 8,
        rewardText: '获得附魔材料【太白剑魄】与 40 灵石',
        effect: { addMaterial: 'double-cast', gold: 40 },
      },
      {
        id: 'leave', label: '恭敬拜过离去', detail: '无代价',
        rewardText: '恢复 10 点气血',
        effect: { hp: 10 },
      },
    ],
  },
  {
    id: 'enc-wounded-elder',
    title: '重伤老怪 · 夺宝还是结缘',
    acts: [1, 2, 3],
    prose: '山坳雾气里跌坐着一名气息涣散的元婴残修，怀中死死护着一枚泛着金光的储物古宝，见你靠近厉声呵斥。',
    choices: [
      {
        id: 'kill', label: '趁他病要他命（杀人夺宝）', detail: '损耗 12 点气血，招惹心魔', hpCost: 12,
        rewardText: '随机获得 1 件【古宝遗物】+ 65 灵石，塞入【心魔低语】',
        effect: { addRelic: true, gold: 65, addCurse: 'curse-whisper' },
      },
      {
        id: 'help', label: '赠予灵石助其稳住道伤', detail: '花费 45 灵石', goldCost: 45,
        rewardText: '获得 1 枚【三界道果信物】与 道基 +15',
        effect: { gainDaoToken: true, foundation: 15 },
      },
      {
        id: 'pass', label: '绕道而行，不沾因果', detail: '无代价',
        rewardText: '道基纯度 +6',
        effect: { foundation: 6 },
      },
    ],
  },
  {
    id: 'enc-auction-shadow',
    title: '黑市暗拍 · 寿元果现世',
    acts: [1, 2, 3],
    prose: '沉钟湾夜雾中的地下黑市正压轴竞拍一枚百年难遇的「青灵寿元果」，台下数道阴冷神识已锁定了出价者。',
    choices: [
      {
        id: 'buy', label: '重金拍下寿元果', detail: '花费 75 灵石', goldCost: 75,
        rewardText: '寿元上限 +18 年，恢复 15 点气血',
        effect: { lifespan: 18, hp: 15 },
      },
      {
        id: 'steal', label: '以命搏杀暗中截胡', detail: '损耗 14 点气血', hpCost: 14,
        rewardText: '获得【万年寿元果核】附魔材 + 寿元 +10 年',
        effect: { addMaterial: 'leech-life', lifespan: 10 },
      },
      {
        id: 'watch', label: '冷眼旁观，顺手捡漏残丹', detail: '无代价',
        rewardText: '获得 35 灵石',
        effect: { gold: 35 },
      },
    ],
  },
  {
    id: 'enc-chess-immortal',
    title: '云巅残局 · 烂柯一梦',
    acts: [1, 2, 3],
    prose: '白脊风隙石亭中摆着一盘未终的黑白星棋，落子之间竟牵动周天灵气，仿佛一局便是尘世数载春秋。',
    choices: [
      {
        id: 'play', label: '落子破局，窥探天机', detail: '消耗 5 年寿元', ageCost: 5,
        rewardText: '获得 1 张【绝世神话神通】与 道基 +18',
        effect: { addRandomCard: 'mythic', foundation: 18 },
      },
      {
        id: 'swipe', label: '收取棋盘星辰聚灵砂', detail: '无代价',
        rewardText: '获得附魔材料【星辰聚灵砂】',
        effect: { addMaterial: 'spirit-surge' },
      },
    ],
  },
  {
    id: 'enc-blood-altar',
    title: '魔渊血泉 · 逆天洗髓',
    acts: [1, 2, 3],
    prose: '幽谷深处翻涌着暗红灵泉，纵使正道修士也难掩心动——跳入其中可洗去凡俗杂念，却会灼烧根骨寿元。',
    choices: [
      {
        id: 'bathe', label: '入泉洗髓（永久精简卡组）', detail: '损耗 10 点气血', hpCost: 10,
        rewardText: '随机删去 1 张基础废牌，最大气血 +10',
        effect: { removeRandomCard: true, maxHp: 10 },
      },
      {
        id: 'drink', label: '鲸吞血煞，强提修为', detail: '消耗 3 年寿元', ageCost: 3,
        rewardText: '道基纯度 +25，获得 1 件【古宝遗物】',
        effect: { foundation: 25, addRelic: true },
      },
      {
        id: 'refuse', label: '守住道心，拂袖离去', detail: '无代价',
        rewardText: '寿元上限 +5 年',
        effect: { lifespan: 5 },
      },
    ],
  },
  {
    id: 'enc-celestial-gate',
    title: '古阵残碑 · 三界道果',
    acts: [2, 3],
    prose: '荒废的跨界古传送阵中央悬浮着一块刻有上界星图的玉简，若能以鲜血与灵石激活，或可窥见登临上界问鼎的隐秘通道。',
    choices: [
      {
        id: 'activate', label: '以血祭阵，收取道果信物', detail: '损耗 12 点气血', hpCost: 12,
        rewardText: '获得 1 枚【三界道果信物】+ 附魔材【天劫雷精】',
        effect: { gainDaoToken: true, addMaterial: 'thunder-mark' },
      },
      {
        id: 'salvage', label: '拆解古阵换取灵石', detail: '无代价',
        rewardText: '获得 80 灵石与 道基 +10',
        effect: { gold: 80, foundation: 10 },
      },
    ],
  },
  {
    id: 'enc-herb-valley',
    title: '雾药谷 · 千年灵芝',
    acts: [1, 2, 3],
    prose: '雾气缭绕的药谷石缝中生出一株七彩灵芝，旁边盘踞的毒蟒刚刚蜕皮离去，留下一地剧毒鳞粉。',
    choices: [
      {
        id: 'eat', label: '当场炼化灵芝延寿', detail: '无代价',
        rewardText: '寿元上限 +10 年，恢复 18 点气血',
        effect: { lifespan: 10, hp: 18 },
      },
      {
        id: 'collect', label: '采集毒晶用于神通附魔', detail: '损耗 5 点气血', hpCost: 5,
        rewardText: '获得附魔材【九幽毒晶】+ 道基 +14',
        effect: { addMaterial: 'toxic-edge', foundation: 14 },
      },
    ],
  },
  {
    id: 'enc-wandering-smith',
    title: '云游器师 · 免费点化',
    acts: [1, 2, 3],
    prose: '山道凉亭下，一名醉醺醺的白发器师正把玩着几块罕见的风灵玉髓，笑言谁肯陪他饮尽三坛烈酒便赠其机缘。',
    choices: [
      {
        id: 'drink', label: '豪饮三坛，求取风灵玉髓', detail: '消耗 2 年寿元（酒力炼化）', ageCost: 2,
        rewardText: '获得附魔材【风灵玉髓】（卡牌耗灵-1）',
        effect: { addMaterial: 'swift' },
      },
      {
        id: 'pay', label: '以灵石换取通天灵犀角', detail: '花费 50 灵石', goldCost: 50,
        rewardText: '获得附魔材【通天灵犀角】（固有+抽牌）',
        effect: { addMaterial: 'innate' },
      },
      {
        id: 'decline', label: '婉拒美酒，请教护体法门', detail: '无代价',
        rewardText: '获得附魔材【戊土神泥】',
        effect: { addMaterial: 'shield-echo' },
      },
    ],
  },
];

export function pickEncounter(act: number, rngNext: () => number): EncounterDef {
  const pool = ENCOUNTERS.filter((e) => e.acts.includes(act));
  const list = pool.length ? pool : ENCOUNTERS;
  return list[Math.floor(rngNext() * list.length)];
}

ENCOUNTERS.push(
  {
    id: 'enc-sutra-pavilion',
    title: '古修藏经阁 · 兼修旁门',
    acts: [1, 2, 3],
    prose: '断崖云海间显出一座残破古阁，书架上仅存数卷异派孤本秘籍，若肯分心兼修，或能走出前人未见之邪道仙途。',
    choices: [
      {
        id: 'study-method',
        label: '闭关兼修异派心法（解锁双修化学反应）',
        detail: '消耗 3 年寿元',
        ageCost: 3,
        rewardText: '立即进入【辅修心法】三选一并开放跨系神通掉落！',
        effect: { offerSecondaryMethod: true, foundation: 10 },
      },
      {
        id: 'pouch-loot',
        label: '搜刮阁中遗留灵丹符箓',
        detail: '无代价',
        rewardText: '随机获得 1 件战中瞬发【乾坤丹符】+ 35 灵石',
        effect: { addConsumable: true, gold: 35 },
      },
    ],
  },
);
