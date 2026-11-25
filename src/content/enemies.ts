import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  // ==================== 第一卷：凡尘筑道 ====================
  'e1-wolf': {
    id: 'e1-wolf', name: '青风妖狼', title: '炼气后期妖兽', act: 1, tier: 'normal', maxHp: 44, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '妖风利爪', damage: 9 },
      { kind: 'defend', label: '妖气护毛', block: 8, strengthGain: 1 },
      { kind: 'multi-attack', label: '嗜血连扑', damage: 6, hits: 2 },
    ],
  },
  'e1-bandit': {
    id: 'e1-bandit', name: '黑风散修', title: '夺宝劫修', act: 1, tier: 'normal', maxHp: 48, artStyle: 'cultivator',
    intents: [
      { kind: 'attack', label: '淬毒飞刀', damage: 7, poison: 2 },
      { kind: 'defend', label: '金光符盾', block: 10 },
      { kind: 'attack', label: '偷袭破甲', damage: 11, vulnerable: 1 },
    ],
  },
  'e1-centipede': {
    id: 'e1-centipede', name: '赤背毒蚣', title: '雾药谷妖虫', act: 1, tier: 'normal', maxHp: 52, artStyle: 'beast',
    intents: [
      { kind: 'debuff', label: '毒雾喷吐', damage: 5, poison: 3, weak: 1 },
      { kind: 'attack', label: '铁颚撕咬', damage: 10 },
      { kind: 'defend', label: '甲壳蜷缩', block: 12 },
    ],
  },
  'e1-elite-steward': {
    id: 'e1-elite-steward', name: '赤煞宗外门执事', title: '秘境截杀精英', act: 1, tier: 'elite', maxHp: 82, artStyle: 'demon',
    intents: [
      { kind: 'buff', label: '祭起血幡', block: 10, strengthGain: 2 },
      { kind: 'multi-attack', label: '血煞双斩', damage: 8, hits: 2 },
      { kind: 'debuff', label: '摄魂低语', damage: 10, addCurse: 'curse-whisper' },
    ],
  },
  'e1-elite-golem': {
    id: 'e1-elite-golem', name: '古修石傀', title: '洞府守卫精英', act: 1, tier: 'elite', maxHp: 88, artStyle: 'beast',
    intents: [
      { kind: 'defend', label: '戊土重甲', block: 16 },
      { kind: 'attack', label: '镇碑重拳', damage: 16 },
      { kind: 'attack', label: '震地裂石', damage: 12, vulnerable: 2 },
    ],
  },
  'e1-boss-tribulation': {
    id: 'e1-boss-tribulation', name: '筑基天劫 · 九霄雷云', title: '破境雷劫（撑过 6 劫或劈碎劫眼）',
    act: 1, tier: 'tribulation', maxHp: 135, tribulationWaves: 6, artStyle: 'thunder',
    intents: [
      { kind: 'tribulation-bolt', label: '初重 · 试道青雷', damage: 11 },
      { kind: 'tribulation-bolt', label: '二重 · 破妄紫雷', damage: 13, addCurse: 'curse-whisper' },
      { kind: 'tribulation-bolt', label: '三重 · 连环落雷', damage: 8, hits: 2 },
      { kind: 'tribulation-bolt', label: '四重 · 罡风雷狱', damage: 15, vulnerable: 1 },
      { kind: 'tribulation-bolt', label: '五重 · 焚心劫火', damage: 18 },
      { kind: 'tribulation-bolt', label: '终劫 · 紫霄神雷', damage: 24 },
    ],
  },

  // ==================== 第二卷：紫府金丹 ====================
  'e2-corpse': {
    id: 'e2-corpse', name: '阴山炼尸', title: '筑基巅峰尸傀', act: 2, tier: 'normal', maxHp: 88, artStyle: 'demon',
    intents: [
      { kind: 'attack', label: '尸毒利爪', damage: 14, poison: 3 },
      { kind: 'defend', label: '铜皮铁骨', block: 16, strengthGain: 2 },
      { kind: 'attack', label: '裂地重锤', damage: 18 },
    ],
  },
  'e2-sword-disciple': {
    id: 'e2-sword-disciple', name: '悬剑阁真传', title: '筑基大圆满剑修', act: 2, tier: 'normal', maxHp: 84, artStyle: 'cultivator',
    intents: [
      { kind: 'multi-attack', label: '三叠剑光', damage: 6, hits: 3 },
      { kind: 'buff', label: '剑心通明', block: 12, strengthGain: 2 },
      { kind: 'attack', label: '贯日长虹', damage: 20 },
    ],
  },
  'e2-elite-elder': {
    id: 'e2-elite-elder', name: '幽泉老怪', title: '假丹期散修精英', act: 2, tier: 'elite', maxHp: 138, artStyle: 'demon',
    intents: [
      { kind: 'debuff', label: '幽泉缚魂', damage: 14, weak: 2, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '万鬼噬心', damage: 9, hits: 3 },
      { kind: 'defend', label: '白骨阴盾', block: 22, strengthGain: 2 },
    ],
  },
  'e2-boss-demon': {
    id: 'e2-boss-demon', name: '紫府心魔尊 · 斩丹宿敌', title: '金丹大劫镇关魔主', act: 2, tier: 'boss', maxHp: 215, artStyle: 'demon',
    intents: [
      { kind: 'buff', label: '心魔化相', block: 18, strengthGain: 2, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '三灾魔刃', damage: 9, hits: 3 },
      { kind: 'debuff', label: '道心拷问', damage: 18, vulnerable: 2 },
      { kind: 'attack', label: '碎丹魔印', damage: 28 },
    ],
  },

  // ==================== 第三卷：化神登仙 ====================
  'e3-dragon': {
    id: 'e3-dragon', name: '覆海孽蛟', title: '元婴级海渊妖王', act: 3, tier: 'normal', maxHp: 135, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '翻江倒海', damage: 22 },
      { kind: 'defend', label: '龙鳞水幕', block: 24, strengthGain: 2 },
      { kind: 'multi-attack', label: '孽雷狂涛', damage: 11, hits: 3 },
    ],
  },
  'e3-immortal-envoy': {
    id: 'e3-immortal-envoy', name: '镇界执法使', title: '化神期巡界修士', act: 3, tier: 'normal', maxHp: 128, artStyle: 'celestial',
    intents: [
      { kind: 'attack', label: '天律裁决', damage: 20, vulnerable: 2 },
      { kind: 'defend', label: '金箓法障', block: 26 },
      { kind: 'multi-attack', label: '诛邪剑雨', damage: 10, hits: 3 },
    ],
  },
  'e3-elite-phoenix': {
    id: 'e3-elite-phoenix', name: '离火古凰残魂', title: '上古秘境精英', act: 3, tier: 'elite', maxHp: 195, artStyle: 'celestial',
    intents: [
      { kind: 'attack', label: '南明焚天', damage: 24, poison: 4 },
      { kind: 'buff', label: '涅槃余烬', block: 25, strengthGain: 3 },
      { kind: 'multi-attack', label: '火羽千重', damage: 11, hits: 3 },
    ],
  },
  'e3-boss-ascension': {
    id: 'e3-boss-ascension', name: '飞升九重混沌雷劫', title: '登仙终极天劫（撑过 7 劫或斩碎天门）',
    act: 3, tier: 'tribulation', maxHp: 310, tribulationWaves: 7, artStyle: 'thunder',
    intents: [
      { kind: 'tribulation-bolt', label: '一重 · 太乙玄雷', damage: 18 },
      { kind: 'tribulation-bolt', label: '二重 · 都天魔雷', damage: 20, addCurse: 'curse-whisper' },
      { kind: 'tribulation-bolt', label: '三重 · 三昧雷火', damage: 12, hits: 2 },
      { kind: 'tribulation-bolt', label: '四重 · 罡煞灭魂', damage: 24, vulnerable: 2 },
      { kind: 'tribulation-bolt', label: '五重 · 五行神雷', damage: 11, hits: 3 },
      { kind: 'tribulation-bolt', label: '六重 · 混沌紫霄', damage: 30, weak: 2 },
      { kind: 'tribulation-bolt', label: '终劫 · 开天辟地雷', damage: 38 },
    ],
  },

  // ==================== 隐藏第四卷：上界问鼎 ====================
  'e4-elite-guard': {
    id: 'e4-elite-guard', name: '南天门 · 巡界仙卫', title: '仙界金甲守将', act: 4, tier: 'elite', maxHp: 230, artStyle: 'celestial',
    intents: [
      { kind: 'defend', label: '仙甲圣光', block: 30, strengthGain: 3 },
      { kind: 'multi-attack', label: '天戟三连', damage: 13, hits: 3 },
      { kind: 'attack', label: '镇界神威', damage: 28, vulnerable: 2 },
    ],
  },
  'e4-boss-dao': {
    id: 'e4-boss-dao', name: '太初天道 · 问鼎古尊', title: '上界终极真身', act: 4, tier: 'boss', maxHp: 420, artStyle: 'celestial',
    intents: [
      { kind: 'buff', label: '天道敕令', block: 28, strengthGain: 3, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '星辰坠落', damage: 14, hits: 3 },
      { kind: 'debuff', label: '岁月剥夺', damage: 26, weak: 2, vulnerable: 2 },
      { kind: 'attack', label: '太初归墟', damage: 42 },
    ],
  },
};

export function pickEnemyForNode(act: 1 | 2 | 3 | 4, tier: 'normal' | 'elite' | 'boss', rngNext: () => number): EnemyDef {
  const pool = Object.values(ENEMIES).filter(
    (e) => e.act === act && (tier === 'boss' ? e.tier === 'boss' || e.tier === 'tribulation' : e.tier === tier),
  );
  if (pool.length === 0) return ENEMIES['e1-wolf'];
  return pool[Math.floor(rngNext() * pool.length)];
}
