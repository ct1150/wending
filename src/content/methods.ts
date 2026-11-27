import type { AchievementDef, DailyMutatorDef, SecondaryMethodDef, SecondaryMethodId } from '../core/types';

export const SECONDARY_METHODS: Record<SecondaryMethodId, SecondaryMethodDef> = {
  'method-venom-sword': {
    id: 'method-venom-sword',
    name: '《万毒淬剑录》',
    unlockLineage: 'alchemy',
    badge: '毒剑',
    description: '你的所有金/雷攻伐每命中 1 段额外附加 2 层【丹毒】；解锁百草丹谷牌池掉落。',
  },
  'method-blood-blade': {
    id: 'method-blood-blade',
    name: '《血神经·拔剑篇》',
    unlockLineage: 'demon',
    badge: '魔剑',
    description: '每次在战斗中消耗气血或燃寿，立即获得 2 层【剑意】并置入 1 张【御剑术】；解锁魔渊牌池掉落。',
  },
  'method-thunder-array': {
    id: 'method-thunder-array',
    name: '《九宫引雷诀》',
    unlockLineage: 'sword',
    badge: '雷阵',
    description: '场上每座【阵盘】回合末触发时，额外降下 6 点穿甲落雷并注入【雷印】；解锁太白剑宗牌池掉落。',
  },
  'method-thorns-poison': {
    id: 'method-thorns-poison',
    name: '《玄冥反毒甲》',
    unlockLineage: 'alchemy',
    badge: '毒甲',
    description: '敌方每次攻击被你的【护体罡气】抵挡时，反染 4 层【丹毒】；解锁百草丹谷牌池掉落。',
  },
  'method-demon-furnace': {
    id: 'method-demon-furnace',
    name: '《焚心炼阵功》',
    unlockLineage: 'array',
    badge: '魔阵',
    description: '每消耗（Exhaust）1 张牌，获得 7 点【护体罡气】并令场上所有阵盘伤害 +2；解锁玄武阵山牌池掉落。',
  },
};

export const SECONDARY_METHOD_LIST = Object.values(SECONDARY_METHODS);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-one-strike-80',
    name: '一剑开天门',
    conditionText: '单张神通在一次出手内造成 ≥ 75 点总伤害',
    unlockText: '解锁暗金禁术《诛仙四剑阵》进入全局掉落池',
  },
  {
    id: 'ach-dying-boss',
    name: '向死而生',
    conditionText: '剩余可用寿元 ≤ 8 年时成功击败任意卷末破境 Boss',
    unlockText: '解锁暗金古宝【逆命天珠】（余寿≤15年时伤害+40%）',
  },
  {
    id: 'ach-poison-50',
    name: '万毒仙尊',
    conditionText: '令单个敌人同时承受 ≥ 40 层【丹毒】',
    unlockText: '解锁暗金古宝【神农百草鞭】（丹药效果提升50%）',
  },
  {
    id: 'ach-eight-cards',
    name: '八步成诗',
    conditionText: '在单个回合内连续打出 ≥ 7 张神通牌',
    unlockText: '解锁暗金古宝【无影剑穗】（每消耗1张牌获1点真元，每回合限2次）',
  },
  {
    id: 'ach-tribulation-slayer',
    name: '逆斩天威',
    conditionText: '不靠硬撑波次，直接将【破境雷劫】气血打空劈碎劫眼',
    unlockText: '解锁暗金古宝【雷帝镇劫印】（开局自带4层剑罡反击）',
  },
  {
    id: 'ach-true-ending',
    name: '百世问鼎',
    conditionText: '集齐三界道果开启第四卷并斩破【太初天道】达成真结局',
    unlockText: '永久纪念道号铭刻生平碑 + 额外赐予 100 轮回道果',
  },
];

export const DAILY_MUTATORS: DailyMutatorDef[] = [
  {
    id: 'mut-spirit-tide',
    name: '灵潮澎湃',
    description: '每回合基础真元 +1，但所有敌方强敌气血提高 25%。',
  },
  {
    id: 'mut-all-schools',
    name: '万法皆通',
    description: '打破门户之见，战利品从第 1 层起直接混入全部四大道统神通！',
  },
  {
    id: 'mut-short-candle',
    name: '残烛逆命',
    description: '初始寿元减少 20 年，但开局自带 2 件随机古宝遗物与 100 灵石。',
  },
  {
    id: 'mut-glass-sword',
    name: '杀伐证道',
    description: '我方每场战斗初始自带 3 层【剑意】与 1 枚【雷印】，敌方初始杀意 +2。',
  },
  {
    id: 'mut-alchemy-boom',
    name: '丹符盛世',
    description: '开局乾坤丹符袋装满 3 件随机丹符，且坊市所有商品价格立减 30%。',
  },
];

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
