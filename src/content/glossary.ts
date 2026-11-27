import { getCardDef, getCardDescription } from '../core/combat-engine';
import type { CardDef, CardInstance, ElementTag, EnemyTrait } from '../core/types';

export interface GlossaryEntry {
  term: string;
  plainTitle: string;
  desc: string;
}

export const KEYWORD_GLOSSARY: Record<string, GlossaryEntry> = {
  block: {
    term: '护体罡气',
    plainTitle: '🛡 护体罡气（护盾）',
    desc: '替你抵挡敌方伤害；若无“留存”效果，下回合开始时自动归零。',
  },
  pierce: {
    term: '穿甲',
    plainTitle: '⚡ 穿甲伤害（真实伤害）',
    desc: '完全无视敌方的护盾，直接扣减敌方气血！',
  },
  swordIntent: {
    term: '剑意',
    plainTitle: '⚔ 剑意（攻击加成）',
    desc: '每有 1 层剑意，你的所有【金/雷】系攻击每段伤害额外 +1（本场常驻）。',
  },
  counterAura: {
    term: '剑罡反击',
    plainTitle: '🪞 剑罡反击（反伤）',
    desc: '敌方每次攻击你时，自动回敬等同层数的穿甲伤害；回合结束层数减半。',
  },
  poison: {
    term: '丹毒',
    plainTitle: '☠ 丹毒（持续真伤）',
    desc: '无视护盾！敌方行动前直接扣除等同层数的气血，随后毒层 -1。',
  },
  vulnerable: {
    term: '破绽',
    plainTitle: '💔 破绽（易伤 +50%）',
    desc: '身负破绽者受到的攻击伤害增加 50%，每回合自动减少 1 层。',
  },
  weak: {
    term: '虚弱',
    plainTitle: '🌀 虚弱（减攻 -25%）',
    desc: '身负虚弱者造成的攻击伤害降低 25%，每回合自动减少 1 层。',
  },
  array: {
    term: '阵盘',
    plainTitle: '✡ 阵盘（永续自动装置）',
    desc: '打出后常驻战场，每回合结束时自动为你叠盾或攻击敌人。',
  },
  exhaust: {
    term: '消耗',
    plainTitle: '🔥 消耗（单场一次性）',
    desc: '打出后在本场战斗中暂时移出牌库，战斗结束后自动恢复。',
  },
  ethereal: {
    term: '虚无',
    plainTitle: '👻 虚无（过期自毁）',
    desc: '若回合结束时仍留在手牌未打出，会自动消耗移除。',
  },
  xCost: {
    term: 'X费',
    plainTitle: '🔮 X 费（倾泻全部真元）',
    desc: '打出时消耗当前剩余的全部真元 X，投入真元越多段数/威力越强（0 真元也可打出基础效果）。',
  },
  maxHpSacrifice: {
    term: '气血上限',
    plainTitle: '🩸 燃血上限（魔道禁术）',
    desc: '扣减或永久提升你的最大气血上限；高风险换取毁天灭地威力。',
  },
  trueSpirit: {
    term: '真灵血脉',
    plainTitle: '🦅 真灵血脉（灵界篇升维）',
    desc: '飞升灵界（第4卷）时觉醒的永久真灵法相（天凤/五色孔雀/惊蛰雷鹏），大幅强化攻防或突破4格灵印槽！',
  },
  supremeLaw: {
    term: '至尊法则',
    plainTitle: '⏳ 三大至尊法则（仙界篇升维）',
    desc: '飞升仙界（第7卷）时参悟的时间、空间或轮回至尊法则，带来首牌双发、空间穿甲或轮回不死神通！',
  },
};

export const ELEMENT_COMBO_GUIDE: Record<Exclude<ElementTag, 'none'>, string> = {
  metal: '【金印连招】若有「土印」打金牌→获8盾抽1牌；打金牌后接「雷牌」→额外劈10点穿甲落雷！',
  wood: '【木印连招】若有「水印」打木牌→回6血获1真元；打木牌后接「火牌」→火伤+50%并引爆丹毒！',
  water: '【水印连招】若有「土印」打水牌→获7盾且护盾本回合不清空；打水牌后接「木牌」→回6血回1真元！',
  fire: '【火印连招】若有「木印」打火牌→触发【木火焚心】火伤提高50%并立即结算1次丹毒！',
  earth: '【土印连招】打土牌留下土印后：接「金牌」获8盾抽1牌，接「水牌」获7盾且护盾留存下回合！',
  thunder: '【雷印连招】若有「金印」打雷牌→触发【金雷惊蛰】额外劈落10点穿甲雷伤并+1剑意！',
  sha: '【煞印连招】槽内已有「煞印」再打煞牌→触发【魔威噬魂】返还1点真元并轰出10点穿甲煞伤！',
};

export const ALL_SEAL_RECIPES = [
  { combo: '木 ➔ 火', name: '木火焚心', effect: '本次火伤 +50%，若敌方有丹毒立即引爆 1 次' },
  { combo: '金 ➔ 雷', name: '金雷惊蛰', effect: '额外降下 10 点无视护盾落雷，并获 1 层剑意' },
  { combo: '土 ➔ 金', name: '厚土锋鸣', effect: '立即获得 8 点护体罡气，并抽 1 张牌' },
  { combo: '水 ➔ 木', name: '寒泉生息', effect: '立即恢复 6 点气血，并返还 1 点真元' },
  { combo: '土 ➔ 水', name: '山泽固本', effect: '获得 7 点护体罡气，且本回合护盾不清空' },
  { combo: '煞 ➔ 煞', name: '魔威噬魂', effect: '返还 1 点真元，并额外轰出 10 点穿甲煞伤' },
  { combo: '混元三色', name: '五行混元', effect: '（混沌伪灵根专属）集齐3种五行印：回2真元、抽2牌、14真伤' },
];

export function extractCardGlossary(inst?: CardInstance, rawDef?: CardDef): {
  entries: GlossaryEntry[];
  comboTip: string | null;
} {
  const def = rawDef ?? getCardDef(inst!.defId);
  const desc = inst ? getCardDescription(inst) : def.description;
  const entries: GlossaryEntry[] = [];
  const push = (key: string) => {
    const item = KEYWORD_GLOSSARY[key];
    if (item && !entries.some((e) => e.plainTitle === item.plainTitle)) {
      entries.push(item);
    }
  };

  if (def.effect.xCost) push('xCost');
  if (def.type === 'defense' || desc.includes('罡气')) push('block');
  if (def.effect.pierce || desc.includes('穿甲')) push('pierce');
  if (def.effect.swordIntent || def.effect.consumeSwordIntent || desc.includes('剑意')) push('swordIntent');
  if (def.effect.counterAura || desc.includes('剑罡反击') || desc.includes('反击')) push('counterAura');
  if (def.effect.poison || def.effect.detonatePoison || def.effect.xPoisonDetonate || desc.includes('丹毒')) push('poison');
  if (def.effect.vulnerable || desc.includes('破绽')) push('vulnerable');
  if (def.effect.weak || desc.includes('虚弱')) push('weak');
  if (def.type === 'array' || desc.includes('阵')) push('array');
  if (def.exhaust || desc.includes('消耗')) push('exhaust');
  if (def.ethereal || desc.includes('虚无')) push('ethereal');
  if (def.effect.maxHpCost || def.effect.gainMaxHp || desc.includes('上限')) push('maxHpSacrifice');

  const comboTip = def.element !== 'none' ? ELEMENT_COMBO_GUIDE[def.element] : null;
  return { entries, comboTip };
}

export function describeStatusTag(tagKey: string, value?: number, trait?: EnemyTrait): { title: string; body: string } {
  switch (tagKey) {
    case 'qi':
      return { title: '🔮 真元（行动费用）', body: '每回合初自动回满（默认 3 点）。打出神通牌需消耗对应数字的真元；标有 X 的卡牌会倾泻当前全部真元。' };
    case 'player-block':
      return { title: '🛡 护体罡气（我方护盾）', body: `当前可抵挡 ${value ?? 0} 点伤害。除非拥有“留存”效果或阵修功法，否则下回合初会归零。` };
    case 'enemy-block':
      return { title: '🛡 敌方护体灵盾', body: `敌方当前拥有 ${value ?? 0} 点护盾，普通攻击需先击穿护盾，而【穿甲】与【丹毒】可直接无视护盾伤血！` };
    case 'sword-intent':
      return { title: `⚔ 剑意（当前 ${value ?? 0} 层）`, body: `你的所有【金系 / 雷系】神通每次命中都会额外增加 ${value ?? 0} 点伤害，整场战斗不消散。` };
    case 'counter-aura':
      return { title: `🪞 剑罡反击（当前 ${value ?? 0} 层）`, body: `敌方每次攻击命中你时，会自动被剑罡反刺 ${value ?? 0} 点无视护盾的伤害！每回合结束层数减半。` };
    case 'poison':
      return { title: `☠ 丹毒（当前 ${value ?? 0} 层）`, body: `敌方行动前会无视护盾直接扣除 ${value ?? 0} 点气血，随后丹毒减少 1 层。用火系引爆牌可提前触发多次毒伤！` };
    case 'vulnerable':
      return { title: `💔 破绽 / 易伤（剩余 ${value ?? 0} 回合）`, body: '受到的所有攻击伤害提高 50%！是打爆发斩杀的最佳时机。' };
    case 'weak':
      return { title: `🌀 虚弱（剩余 ${value ?? 0} 回合）`, body: '造成的所有攻击伤害降低 25%，能有效削弱敌方蓄力重击。' };
    case 'strength':
      return { title: `🔥 杀意（攻击力 +${value ?? 0}）`, body: `敌方每次攻击的每一段都会额外增加 ${value ?? 0} 点伤害！` };
    case 'trait':
      return {
        title: `⚖ 敌方专属法则 · ${trait?.name ?? ''}`,
        body: trait?.description ?? '此强敌天生具备特殊战斗法则，请针对性调整出牌策略。',
      };
    default:
      return { title: '☯ 修仙法则说明', body: '点击卡牌或状态图标可随时查看详细白话效果。' };
  }
}
