import type { EncounterDef } from '../core/types';

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'enc-old-cauldron',
    title: '残碑古鼎 · 问剑石溪',
    acts: [1, 2],
    prose: '荒崖下立着半截残缺青铜鼎，鼎腹隐隐透出上古剑修留下的灵犀剑意，四周煞气却在悄然侵蚀肉身。',
    choices: [
      {
        id: 'absorb', label: '以精血强行参悟鼎铭', detail: '损耗 10 点气血', hpCost: 10,
        rewardText: '随机获得 1 张稀有神通 + 气血上限 +6',
        effect: { maxHp: 6, addRandomCard: 'rare' },
      },
      {
        id: 'pry', label: '撬取鼎耳灵材', detail: '损耗 6 点气血', hpCost: 6,
        rewardText: '获得附魔材料【太白剑魄】与 40 灵石',
        effect: { addMaterial: 'double-cast', gold: 40 },
      },
      {
        id: 'leave', label: '吐纳静心后离去', detail: '无代价',
        rewardText: '恢复 12 点气血',
        effect: { hp: 12 },
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
        rewardText: '获得 1 件【古宝遗物】+ 65 灵石，牌库塞入【心魔低语】',
        effect: { addRelic: true, gold: 65, addCurse: 'curse-whisper' },
      },
      {
        id: 'help', label: '赠予灵石助其疗伤', detail: '花费 45 灵石', goldCost: 45,
        rewardText: '获赠 1 枚【三界道果信物】并恢复 12 点气血',
        effect: { gainDaoToken: true, hp: 12 },
      },
      {
        id: 'pass', label: '绕道而行，顺手采摘灵草', detail: '无代价',
        rewardText: '恢复 8 点气血',
        effect: { hp: 8 },
      },
    ],
  },
  {
    id: 'enc-auction-shadow',
    title: '黑市暗拍 · 千年血芝现世',
    acts: [1, 2, 3],
    prose: '沉钟湾夜雾中的地下黑市正压轴竞拍一株罕见的「千年紫金血芝」，台下数道阴冷神识已锁定了出价者。',
    choices: [
      {
        id: 'buy', label: '重金拍下紫金血芝', detail: '花费 70 灵石', goldCost: 70,
        rewardText: '永久提升 14 点最大气血上限，并恢复 20 点气血',
        effect: { maxHp: 14, hp: 20 },
      },
      {
        id: 'steal', label: '以命搏杀暗中截胡', detail: '损耗 14 点气血', hpCost: 14,
        rewardText: '获得附魔材【千年血灵芝】+ 最大气血 +8',
        effect: { addMaterial: 'leech-life', maxHp: 8 },
      },
      {
        id: 'watch', label: '冷眼旁观，顺手捡漏碎银', detail: '无代价',
        rewardText: '获得 35 灵石',
        effect: { gold: 35 },
      },
    ],
  },
  {
    id: 'enc-chess-immortal',
    title: '云巅残局 · 烂柯一梦',
    acts: [1, 2, 3],
    prose: '白脊风隙石亭中摆着一盘未终的黑白星棋，落子之间竟以自身本源精血牵动周天灵气。',
    choices: [
      {
        id: 'play', label: '燃精血落子破局', detail: '扣除 8 点最大气血上限', maxHpCost: 8,
        rewardText: '直接领悟 1 张【绝世神话神通】！',
        effect: { addRandomCard: 'mythic' },
      },
      {
        id: 'swipe', label: '收取棋盘星辰聚灵砂', detail: '无代价',
        rewardText: '获得附魔材料【星辰聚灵砂】（卡牌打出回1真元）',
        effect: { addMaterial: 'spirit-surge' },
      },
    ],
  },
  {
    id: 'enc-blood-altar',
    title: '魔渊血泉 · 逆天洗髓',
    acts: [1, 2, 3],
    prose: '幽谷深处翻涌着滚烫暗红灵泉——跳入其中可洗去凡俗废招、重塑强横肉身，却要忍受烈火噬骨之痛。',
    choices: [
      {
        id: 'bathe', label: '入泉洗髓（精简牌库+锻体）', detail: '损耗 10 点气血', hpCost: 10,
        rewardText: '随机删去 1 张基础牌，永久提升 10 点最大气血',
        effect: { removeRandomCard: true, maxHp: 10 },
      },
      {
        id: 'drink', label: '献祭本源换取古宝', detail: '扣除 10 点最大气血上限', maxHpCost: 10,
        rewardText: '随机获得 1 件【古宝遗物】+ 1 枚战中丹符',
        effect: { addRelic: true, addConsumable: true },
      },
      {
        id: 'refuse', label: '汲取泉边温润灵雾', detail: '无代价',
        rewardText: '恢复 14 点气血',
        effect: { hp: 14 },
      },
    ],
  },
  {
    id: 'enc-celestial-gate',
    title: '古阵残碑 · 三界道果',
    acts: [2, 3],
    prose: '荒废的跨界古传送阵中央悬浮着刻有上界星图的玉简，若以精血激活，便可取得登临隐藏第四卷的信物。',
    choices: [
      {
        id: 'activate', label: '以精血祭阵，收取道果信物', detail: '损耗 12 点气血', hpCost: 12,
        rewardText: '获得 1 枚【三界道果信物】+ 附魔材【天劫雷精】',
        effect: { gainDaoToken: true, addMaterial: 'thunder-mark' },
      },
      {
        id: 'salvage', label: '拆解古阵换取灵石', detail: '无代价',
        rewardText: '获得 80 灵石',
        effect: { gold: 80 },
      },
    ],
  },
  {
    id: 'enc-sutra-pavilion',
    title: '古修藏经阁 · 兼修旁门',
    acts: [1, 2, 3],
    prose: '断崖云海间显出一座残破古阁，书架上仅存数卷异派孤本秘籍，若肯分心兼修，便能走出双修邪道仙途。',
    choices: [
      {
        id: 'study-method',
        label: '兼修异派心法（解锁双修化学反应）',
        detail: '损耗 8 点气血',
        hpCost: 8,
        rewardText: '立即进入【辅修心法】三选一并开放跨系神通掉落！',
        effect: { offerSecondaryMethod: true },
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
];

export function pickEncounter(act: number, rngNext: () => number): EncounterDef {
  const pool = ENCOUNTERS.filter((e) => e.acts.includes(act));
  const list = pool.length ? pool : ENCOUNTERS;
  return list[Math.floor(rngNext() * list.length)];
}
