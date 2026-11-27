import type { EncounterDef } from '../core/types';

export const ENCOUNTERS: EncounterDef[] = [
  // ==================== 人界篇奇遇 (Acts 1~3) ====================
  {
    id: 'enc-old-cauldron',
    title: '神手谷残瓶 · 神秘绿液',
    acts: [1, 2],
    prose: '七玄门后山草丛中半掩着一只毫无灵气波动的墨绿小瓶，瓶中已凝出一滴夺天地造化的参天绿液。',
    choices: [
      {
        id: 'absorb', label: '滴液催熟灵药炼体', detail: '损耗 8 点气血承受药力', hpCost: 8,
        rewardText: '随机获得 1 张稀有神通 + 气血上限 +10',
        effect: { maxHp: 10, addRandomCard: 'rare' },
      },
      {
        id: 'pry', label: '催熟年份灵草换取灵材', detail: '无代价',
        rewardText: '获得附魔材料【千年血灵芝】与 45 灵石',
        effect: { addMaterial: 'leech-life', gold: 45 },
      },
      {
        id: 'leave', label: '服下百年黄精调息', detail: '无代价',
        rewardText: '恢复 16 点气血',
        effect: { hp: 16 },
      },
    ],
  },
  {
    id: 'enc-xutian-cauldron',
    title: '虚天内殿 · 乾蓝冰焰',
    acts: [2, 3],
    prose: '乱星海虚天殿高台之上，一缕极寒幽蓝冰焰环绕着古宝残片跳动，元婴老怪们正在远处混战无暇他顾。',
    choices: [
      {
        id: 'kill', label: '强行收取虚天古宝（富贵险中求）', detail: '损耗 14 点气血，沾染冰煞心魔', hpCost: 14,
        rewardText: '获得 1 件【古宝遗物】+ 75 灵石，牌库塞入【心魔低语】',
        effect: { addRelic: true, gold: 75, addCurse: 'curse-whisper' },
      },
      {
        id: 'help', label: '以灵石布置隔绝阵收取道果', detail: '花费 45 灵石', goldCost: 45,
        rewardText: '获赠 1 枚【掌天道果信物】并恢复 14 点气血',
        effect: { gainDaoToken: true, hp: 14 },
      },
      {
        id: 'pass', label: '趁乱捡取殿角灵丹遁走', detail: '无代价',
        rewardText: '获得 1 枚战中【乾坤丹符】+ 恢复 10 点气血',
        effect: { addConsumable: true, hp: 10 },
      },
    ],
  },
  {
    id: 'enc-sutra-pavilion',
    title: '大衍神君坐化洞 · 兼修旁门',
    acts: [1, 2, 3, 4],
    prose: '竹海秘洞中端坐着一具面带笑意的古修遗骸，石案上留有《大衍决》与数卷跨流派邪道合修秘术。',
    choices: [
      {
        id: 'study-method',
        label: '分神兼修异派心法（解锁双修化学反应）',
        detail: '损耗 8 点气血',
        hpCost: 8,
        rewardText: '立即进入【辅修心法】三选一并开放跨系神通掉落！',
        effect: { offerSecondaryMethod: true },
      },
      {
        id: 'bathe',
        label: '以大衍神识斩却凡俗芜杂',
        detail: '无代价',
        rewardText: '随机精简删去 1 张基础牌，最大气血 +8',
        effect: { removeRandomCard: true, maxHp: 8 },
      },
    ],
  },

  // ==================== 灵界篇奇遇 (Acts 4~6) ====================
  {
    id: 'enc-guanghan-pool',
    title: '广寒界遗迹 · 仙灵洗髓池',
    acts: [4, 5, 6],
    prose: '云海古殿中央残留着半池乳白色「化仙池水」，浸泡其中可脱胎换骨、涤尽废招，亦可以本源精血祭炼真仙绝学。',
    choices: [
      {
        id: 'play', label: '献祭精血参悟广寒仙碑', detail: '扣除 10 点最大气血上限', maxHpCost: 10,
        rewardText: '直接领悟 1 张【绝世神话神通】！',
        effect: { addRandomCard: 'mythic' },
      },
      {
        id: 'bathe-pool', label: '入化仙池洗髓伐毛', detail: '无代价',
        rewardText: '随机删去 1 张基础牌，最大气血 +16 并恢复 25 点气血',
        effect: { removeRandomCard: true, maxHp: 16, hp: 25 },
      },
      {
        id: 'swipe', label: '刮取池畔星辰聚灵砂', detail: '无代价',
        rewardText: '获得附魔材料【星辰聚灵砂】与 85 灵石',
        effect: { addMaterial: 'spirit-surge', gold: 85 },
      },
    ],
  },
  {
    id: 'enc-qingyuan-master',
    title: '冥河青元宫 · 青元子托孤',
    acts: [4, 5, 6],
    prose: '一代大乘剑尊青元子正在闭死关对抗天人五衰，愿以毕生收藏换取灵石与气血护法，助他渡过此劫。',
    choices: [
      {
        id: 'guard', label: '分出精血全力为青元子护法', detail: '损耗 22 点气血', hpCost: 22,
        rewardText: '获赠绝世神通《青元·大庚剑阵》或随机古宝 + 道果信物×1！',
        effect: { addRelic: true, gainDaoToken: true, maxHp: 12 },
      },
      {
        id: 'trade', label: '以灵石交换灵界奇珍', detail: '花费 80 灵石', goldCost: 80,
        rewardText: '获得附魔材【太白剑魄】+ 1 枚战中丹符 + 恢复 25 气血',
        effect: { addMaterial: 'double-cast', addConsumable: true, hp: 25 },
      },
      {
        id: 'salute', label: '执晚辈礼拜别论道', detail: '无代价',
        rewardText: '恢复 24 点气血，获得 55 灵石',
        effect: { hp: 24, gold: 55 },
      },
    ],
  },

  // ==================== 仙界篇奇遇 (Acts 7~9) ====================
  {
    id: 'enc-zhenyan-pagoda',
    title: '真言门废墟 · 弥罗仙尊残影',
    acts: [7, 8, 9],
    prose: '破碎的岁月宝塔中浮现出时间道祖昔日大敌「弥罗老祖」的一缕讲道残影，光阴晶砂在四周缓缓倒流。',
    choices: [
      {
        id: 'comprehend-time', label: '燃仙躯硬承岁月讲道真言', detail: '损耗 28 点气血', hpCost: 28,
        rewardText: '直接领悟《岁月神灯·光阴斩》+【掌天道果信物】×1！',
        effect: { addSpecificCard: 'nu-time-lantern', gainDaoToken: true },
      },
      {
        id: 'gather-sand', label: '收取风灵玉髓与仙石', detail: '无代价',
        rewardText: '获得减费附魔材【风灵玉髓】+ 120 灵石',
        effect: { addMaterial: 'swift', gold: 120 },
      },
      {
        id: 'heal-time', label: '沐浴倒流光阴抚平道伤', detail: '无代价',
        rewardText: '最大气血永久 +20，并恢复 45 点气血',
        effect: { maxHp: 20, hp: 45 },
      },
    ],
  },
  {
    id: 'enc-jilin-void',
    title: '积鳞空境 · 蟹道人重逢',
    acts: [7, 8, 9],
    prose: '大罗仙器玄天魔器深处，伪装成石牧故友的「蟹道人」认出了你身上的掌天瓶气息，愿以雷源晶石助你淬体。',
    choices: [
      {
        id: 'temper', label: '引太古伪仙雷源入体淬炼', detail: '损耗 24 点气血', hpCost: 24,
        rewardText: '获得 1 件【古宝遗物】+ 附魔材【天劫雷精】+ 最大气血 +18',
        effect: { addRelic: true, addMaterial: 'thunder-mark', maxHp: 18 },
      },
      {
        id: 'refine', label: '请蟹道人斩灭牌库杂质', detail: '无代价',
        rewardText: '精简删去 1 张基础牌，恢复 36 点气血并获 1 枚丹符',
        effect: { removeRandomCard: true, hp: 36, addConsumable: true },
      },
    ],
  },
];

export function pickEncounter(act: number, rngNext: () => number): EncounterDef {
  const pool = ENCOUNTERS.filter((e) => e.acts.includes(act));
  const list = pool.length ? pool : ENCOUNTERS;
  return list[Math.floor(rngNext() * list.length)];
}
