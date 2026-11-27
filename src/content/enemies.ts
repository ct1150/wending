import type { ActNumber, EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  // ==================== 第一卷：人界篇 · 天南初修（炼气 ➔ 筑基） ====================
  'e1-wolf': {
    id: 'e1-wolf', name: '血禁墨蛟幼兽', title: '血色禁地顶阶妖兽', act: 1, tier: 'normal', maxHp: 44, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '蛟尾横扫', damage: 9 },
      { kind: 'defend', label: '墨鳞护体', block: 8, strengthGain: 1 },
      { kind: 'multi-attack', label: '腥风双噬', damage: 6, hits: 2 },
    ],
  },
  'e1-bandit': {
    id: 'e1-bandit', name: '黑煞教血侍', title: '越国皇城邪修', act: 1, tier: 'normal', maxHp: 48, artStyle: 'cultivator',
    intents: [
      { kind: 'attack', label: '血煞毒镖', damage: 7, poison: 2 },
      { kind: 'defend', label: '阴风护身障', block: 10 },
      { kind: 'attack', label: '破甲黑爪', damage: 11, vulnerable: 1 },
    ],
  },
  'e1-centipede': {
    id: 'e1-centipede', name: '血色禁地毒蚣', title: '奇虫榜异种', act: 1, tier: 'normal', maxHp: 52, artStyle: 'beast',
    trait: { id: 'thorns', name: '毒甲反刺', description: '每次受到直接攻击时，反震你 2 点气血。', value: 2 },
    intents: [
      { kind: 'debuff', label: '腐骨毒雾', damage: 5, poison: 3, weak: 1 },
      { kind: 'attack', label: '铁颚撕咬', damage: 10 },
      { kind: 'defend', label: '百足盘甲', block: 12 },
    ],
  },
  'e1-elite-steward': {
    id: 'e1-elite-steward', name: '魔道六宗执事', title: '合欢鬼灵截杀精英', act: 1, tier: 'elite', maxHp: 82, artStyle: 'demon',
    trait: { id: 'anti-skill', name: '禁法妖瞳', description: '你每打出 1 张【运转】牌，执事获得 +2 杀意。', value: 2 },
    intents: [
      { kind: 'buff', label: '祭起万魂幡', block: 10, strengthGain: 2 },
      { kind: 'multi-attack', label: '鬼灵双斩', damage: 8, hits: 2 },
      { kind: 'debuff', label: '摄魂魔音', damage: 10, addCurse: 'curse-whisper' },
    ],
  },
  'e1-elite-golem': {
    id: 'e1-elite-golem', name: '千竹教巨剑傀儡', title: '大衍决机关精英', act: 1, tier: 'elite', maxHp: 88, artStyle: 'beast',
    trait: { id: 'stone-shell', name: '铁木重甲', description: '每回合受到的第 1 次攻击伤害减半。', value: 50 },
    intents: [
      { kind: 'defend', label: '玄铁盾阵', block: 16 },
      { kind: 'attack', label: '机关重剑', damage: 16 },
      { kind: 'attack', label: '灵炮轰击', damage: 12, vulnerable: 2 },
    ],
  },
  'e1-boss-tribulation': {
    id: 'e1-boss-tribulation', name: '筑基天劫 · 血禁九霄雷', title: '天南破境大劫（撑过 6 劫或劈碎劫眼）',
    act: 1, tier: 'tribulation', maxHp: 135, tribulationWaves: 6, artStyle: 'thunder',
    phase2: {
      title: '筑基天劫 · 紫霄劫眼怒睁',
      announcement: '⚡ 劫云翻涌，紫霄劫眼怒睁！护体雷障凝结，天威暴涨！',
      shieldGain: 18,
      strengthGain: 2,
      intents: [
        { kind: 'tribulation-bolt', label: '怒劫 · 双生紫雷', damage: 10, hits: 2 },
        { kind: 'tribulation-bolt', label: '怒劫 · 诛心雷狱', damage: 18, vulnerable: 1, addCurse: 'curse-whisper' },
        { kind: 'tribulation-bolt', label: '终劫 · 九霄灭世雷', damage: 26 },
      ],
    },
    intents: [
      { kind: 'tribulation-bolt', label: '初重 · 试道青雷', damage: 11 },
      { kind: 'tribulation-bolt', label: '二重 · 破妄紫雷', damage: 13, addCurse: 'curse-whisper' },
      { kind: 'tribulation-bolt', label: '三重 · 连环落雷', damage: 8, hits: 2 },
      { kind: 'tribulation-bolt', label: '四重 · 罡风雷狱', damage: 15, vulnerable: 1 },
      { kind: 'tribulation-bolt', label: '五重 · 焚心劫火', damage: 18 },
      { kind: 'tribulation-bolt', label: '终劫 · 紫霄神雷', damage: 24 },
    ],
  },

  // ==================== 第二卷：人界篇 · 乱星奇渊（结丹 ➔ 元婴） ====================
  'e2-corpse': {
    id: 'e2-corpse', name: '阴冥之地天尸', title: '鬼雾尸傀', act: 2, tier: 'normal', maxHp: 88, artStyle: 'demon',
    trait: { id: 'thorns', name: '玄阴尸刺', description: '每次受到直接攻击时，反震你 3 点伤害。', value: 3 },
    intents: [
      { kind: 'attack', label: '修罗尸爪', damage: 14, poison: 3 },
      { kind: 'defend', label: '铜甲铁骨', block: 16, strengthGain: 2 },
      { kind: 'attack', label: '阴煞重锤', damage: 18 },
    ],
  },
  'e2-sword-disciple': {
    id: 'e2-sword-disciple', name: '妙音门护法剑修', title: '内星海结丹修士', act: 2, tier: 'normal', maxHp: 84, artStyle: 'cultivator',
    trait: { id: 'sword-guard', name: '剑心识破', description: '你每回合打出的第 4 张牌起，自动获得 6 点护盾。', value: 6 },
    intents: [
      { kind: 'multi-attack', label: '三叠剑光', damage: 6, hits: 3 },
      { kind: 'buff', label: '紫霄剑诀', block: 12, strengthGain: 2 },
      { kind: 'attack', label: '贯日长虹', damage: 20 },
    ],
  },
  'e2-elite-elder': {
    id: 'e2-elite-elder', name: '六道极圣分魂', title: '逆星盟元婴巨头', act: 2, tier: 'elite', maxHp: 138, artStyle: 'demon',
    trait: { id: 'seal-lock', name: '封灵魔瘴', description: '六道天魔气封锁天机，你的灵印槽减少 1 格。', value: 2 },
    intents: [
      { kind: 'debuff', label: '六道缚魂', damage: 14, weak: 2, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '万鬼噬心', damage: 9, hits: 3 },
      { kind: 'defend', label: '真魔阴盾', block: 22, strengthGain: 2 },
    ],
  },
  'e2-boss-demon': {
    id: 'e2-boss-demon', name: '虚天夺鼎 · 极阴玄骨老魔', title: '虚天内殿元婴老怪', act: 2, tier: 'boss', maxHp: 215, artStyle: 'demon',
    trait: { id: 'seal-lock', name: '玄骨蚀印', description: '你的灵印槽上限减少 1 格。', value: 2 },
    phase2: {
      title: '玄骨夺舍 · 天都尸火真魔相',
      announcement: '👹 玄骨反噬极阴，祭出九曲灵参天都尸火！获得 28 点魔盾与 +3 杀意！',
      shieldGain: 28,
      strengthGain: 3,
      intents: [
        { kind: 'multi-attack', label: '天都尸火三连', damage: 10, hits: 3 },
        { kind: 'debuff', label: '玄魂炼妖咒', damage: 22, weak: 2, addCurse: 'curse-whisper' },
        { kind: 'attack', label: '虚天碎婴印', damage: 34 },
      ],
    },
    intents: [
      { kind: 'buff', label: '乌丑天都尸', block: 18, strengthGain: 2, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '极阴寒焰爪', damage: 9, hits: 3 },
      { kind: 'debuff', label: '搜魂魔瞳', damage: 18, vulnerable: 2 },
      { kind: 'attack', label: '修罗圣火击', damage: 28 },
    ],
  },

  // ==================== 第三卷：人界篇 · 坠魔化神（化神 ➔ 飞升灵界） ====================
  'e3-dragon': {
    id: 'e3-dragon', name: '坠魔谷双首古魔', title: '跨界上古魔族残躯', act: 3, tier: 'normal', maxHp: 158, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '古魔裂空爪', damage: 22 },
      { kind: 'defend', label: '魔鳞重障', block: 24, strengthGain: 2 },
      { kind: 'multi-attack', label: '双首魔焰弹', damage: 11, hits: 3 },
    ],
  },
  'e3-immortal-envoy': {
    id: 'e3-immortal-envoy', name: '昆吾山呼老魔', title: '大晋化神初期修士', act: 3, tier: 'normal', maxHp: 150, artStyle: 'celestial',
    trait: { id: 'anti-skill', name: '化神神识压制', description: '你每打出 1 张【运转】牌，敌方获得 +2 杀意。', value: 2 },
    intents: [
      { kind: 'attack', label: '天地元气斩', damage: 20, vulnerable: 2 },
      { kind: 'defend', label: '八灵尺法障', block: 26 },
      { kind: 'multi-attack', label: '万剑归宗雨', damage: 10, hits: 3 },
    ],
  },
  'e3-elite-phoenix': {
    id: 'e3-elite-phoenix', name: '昆吾真灵 · 冰凤之魂', title: '十级顶阶真灵血裔', act: 3, tier: 'elite', maxHp: 235, artStyle: 'celestial',
    trait: { id: 'phoenix-rebirth', name: '涅槃冰焰', description: '首次气血归零时浴火涅槃，恢复 35% 气血并杀意 +3！', value: 35 },
    intents: [
      { kind: 'attack', label: '太阴冰焰焚', damage: 24, poison: 4 },
      { kind: 'buff', label: '凤翎护体', block: 25, strengthGain: 3 },
      { kind: 'multi-attack', label: '冰凰千羽破', damage: 11, hits: 3 },
    ],
  },
  'e3-boss-ascension': {
    id: 'e3-boss-ascension', name: '空间节点 · 破界九重罡雷', title: '偷渡飞升灵界大劫（撑过 7 劫或斩开界壁）',
    act: 3, tier: 'tribulation', maxHp: 380, tribulationWaves: 7, artStyle: 'thunder',
    phase2: {
      title: '空间风暴 · 界面壁障崩裂',
      announcement: '⛈️ 空间节点轰然崩裂，触发破境锁血护道！银色罡雷倾泻而下！',
      shieldGain: 45,
      strengthGain: 3,
      intents: [
        { kind: 'tribulation-bolt', label: '破界 · 阴阳空间刃', damage: 15, hits: 2 },
        { kind: 'tribulation-bolt', label: '破界 · 绝灵罡风暴', damage: 32, vulnerable: 2 },
        { kind: 'tribulation-bolt', label: '终劫 · 飞升裂界神雷', damage: 40 },
      ],
    },
    intents: [
      { kind: 'tribulation-bolt', label: '一重 · 空间乱流', damage: 18 },
      { kind: 'tribulation-bolt', label: '二重 · 蚀魂阴风', damage: 20, addCurse: 'curse-whisper' },
      { kind: 'tribulation-bolt', label: '三重 · 银色界刃', damage: 12, hits: 2 },
      { kind: 'tribulation-bolt', label: '四重 · 虚空坍缩', damage: 24, vulnerable: 2 },
      { kind: 'tribulation-bolt', label: '五重 · 五行绝灭雷', damage: 11, hits: 3 },
      { kind: 'tribulation-bolt', label: '六重 · 界面排斥力', damage: 29, weak: 2 },
      { kind: 'tribulation-bolt', label: '终劫 · 破界飞升雷', damage: 36 },
    ],
  },

  // ==================== 第四卷：灵界篇 · 风元天渊（炼虚 ➔ 合体） ====================
  'e4-horn-warrior': {
    id: 'e4-horn-warrior', name: '角蚩族炼虚战将', title: '天渊城外异族先锋', act: 4, tier: 'normal', maxHp: 265, artStyle: 'cultivator',
    trait: { id: 'stone-shell', name: '灵纹战甲', description: '每回合受到的第 1 次攻击伤害减半。', value: 50 },
    intents: [
      { kind: 'attack', label: '破天巨矛', damage: 26 },
      { kind: 'defend', label: '百族灵阵盾', block: 32, strengthGain: 3 },
      { kind: 'multi-attack', label: '战纹三连刺', damage: 12, hits: 3 },
    ],
  },
  'e4-thunder-beast': {
    id: 'e4-thunder-beast', name: '蛮荒夔牛雷兽', title: '风元荒原炼虚凶兽', act: 4, tier: 'normal', maxHp: 280, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '独足震天雷', damage: 25, vulnerable: 2 },
      { kind: 'multi-attack', label: '狂雷双角撞', damage: 15, hits: 2 },
      { kind: 'buff', label: '吞吐天地元气', block: 30, strengthGain: 3 },
    ],
  },
  'e4-elite-guard': {
    id: 'e4-elite-guard', name: '广寒界镇殿金傀', title: '上古真仙遗迹守卫', act: 4, tier: 'elite', maxHp: 390, artStyle: 'celestial',
    trait: { id: 'stone-shell', name: '广寒仙金甲', description: '每回合受到的第 1 次攻击伤害减半。', value: 50 },
    intents: [
      { kind: 'defend', label: '仙傀圣光', block: 38, strengthGain: 3 },
      { kind: 'multi-attack', label: '金戈三连斩', damage: 14, hits: 3 },
      { kind: 'attack', label: '镇界重戟', damage: 30, vulnerable: 2 },
    ],
  },
  'e4-boss-dao': {
    id: 'e4-boss-dao', name: '地渊血祭 · 血光圣祖化身', title: '跨界魔族合体霸主', act: 4, tier: 'boss', maxHp: 580, artStyle: 'demon',
    trait: { id: 'anti-skill', name: '血光魔瞳', description: '你每打出 1 张【运转】牌，血光化身获得 +2 杀意。', value: 2 },
    phase2: {
      title: '血光圣祖 · 血海魔龙真身',
      announcement: '🩸 血光圣祖锁血护道，化出百丈血海魔龙！护盾 +60，本回合受击减半！',
      shieldGain: 60,
      strengthGain: 4,
      intents: [
        { kind: 'multi-attack', label: '血海狂龙噬', damage: 15, hits: 3 },
        { kind: 'debuff', label: '化血魔刀咒', damage: 30, weak: 2, vulnerable: 2, addCurse: 'curse-whisper' },
        { kind: 'attack', label: '圣祖血河崩', damage: 44 },
      ],
    },
    intents: [
      { kind: 'buff', label: '地渊血祭大阵', block: 35, strengthGain: 3, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '血影三绝斩', damage: 13, hits: 3 },
      { kind: 'debuff', label: '污血蚀灵光', damage: 25, weak: 2 },
      { kind: 'attack', label: '破界魔印', damage: 36 },
    ],
  },

  // ==================== 第五卷：灵界篇 · 魔劫纵横（合体 ➔ 大乘） ====================
  'e5-demon-lord': {
    id: 'e5-demon-lord', name: '魔界圣阶双首统领', title: '浩劫入侵合体后期', act: 5, tier: 'normal', maxHp: 350, artStyle: 'demon',
    trait: { id: 'thorns', name: '魔鳞反震', description: '每次受到直接攻击时，反震你 4 点伤害。', value: 4 },
    intents: [
      { kind: 'multi-attack', label: '紫魔双刃狂斩', damage: 16, hits: 2 },
      { kind: 'buff', label: '吞噬魔核', block: 40, strengthGain: 3 },
      { kind: 'attack', label: '焚天黑炎炮', damage: 32, poison: 5 },
    ],
  },
  'e5-beetle-king': {
    id: 'e5-beetle-king', name: '变异金甲噬金虫王', title: '失控奇虫榜凶物', act: 5, tier: 'normal', maxHp: 370, artStyle: 'beast',
    trait: { id: 'sword-guard', name: '金甲吞灵', description: '你每回合打出的第 4 张牌起，虫王自动获得 12 点护盾。', value: 12 },
    intents: [
      { kind: 'multi-attack', label: '万虫噬灵潮', damage: 12, hits: 3 },
      { kind: 'defend', label: '不灭金甲阵', block: 42 },
      { kind: 'attack', label: '破法毒鳌击', damage: 30, vulnerable: 2 },
    ],
  },
  'e5-elite-baohua': {
    id: 'e5-elite-baohua', name: '魔界始祖 · 宝花魅影', title: '三大始祖之一投影', act: 5, tier: 'elite', maxHp: 520, artStyle: 'celestial',
    trait: { id: 'seal-lock', name: '玄天幻花域', description: '粉色花瓣迷乱阴阳，你的灵印槽上限减少 1 格。', value: 2 },
    intents: [
      { kind: 'debuff', label: '忘忧花海惑心', damage: 24, weak: 2, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '落英神剑雨', damage: 14, hits: 3 },
      { kind: 'buff', label: '始祖魔威', block: 45, strengthGain: 4 },
    ],
  },
  'e5-boss-nirvana': {
    id: 'e5-boss-nirvana', name: '圣岛魔灾 · 涅槃圣祖真身', title: '魔界三大始祖真身跨界', act: 5, tier: 'boss', maxHp: 760, artStyle: 'demon',
    trait: { id: 'phoenix-rebirth', name: '寂灭涅槃体', description: '首次气血归零时施展涅槃三变，恢复 30% 气血并杀意 +4！', value: 30 },
    phase2: {
      title: '涅槃圣祖 · 三头六臂圣魔体',
      announcement: '🔥 涅槃圣祖催动寂灭真血锁血护道，显化三头六臂黄金圣魔体！护盾 +75！',
      shieldGain: 75,
      strengthGain: 4,
      intents: [
        { kind: 'multi-attack', label: '六臂寂灭神拳', damage: 17, hits: 3 },
        { kind: 'debuff', label: '真魔碎界吼', damage: 34, vulnerable: 2, weak: 2 },
        { kind: 'attack', label: '灭仙寂灭一击', damage: 50 },
      ],
    },
    intents: [
      { kind: 'attack', label: '黄金圣魔拳', damage: 34 },
      { kind: 'buff', label: '寂灭金身护体', block: 45, strengthGain: 3 },
      { kind: 'multi-attack', label: '极道拳风连轰', damage: 15, hits: 3 },
      { kind: 'debuff', label: '血海威压', damage: 28, vulnerable: 2, addCurse: 'curse-whisper' },
    ],
  },

  // ==================== 第六卷：灵界篇 · 万族问鼎（大乘 ➔ 飞升仙界） ====================
  'e6-thunder-dragon': {
    id: 'e6-thunder-dragon', name: '摩诃雷海太古孽龙', title: '大乘级真灵遗种', act: 6, tier: 'normal', maxHp: 440, artStyle: 'beast',
    intents: [
      { kind: 'attack', label: '九天狂雷摆尾', damage: 35 },
      { kind: 'defend', label: '雷池龙鳞障', block: 48, strengthGain: 3 },
      { kind: 'multi-attack', label: '万雷轰顶', damage: 15, hits: 3 },
    ],
  },
  'e6-corpse-emperor': {
    id: 'e6-corpse-emperor', name: '冥河之地天尸皇', title: '大乘期阴司霸主', act: 6, tier: 'normal', maxHp: 460, artStyle: 'demon',
    trait: { id: 'thorns', name: '冥河毒瘴', description: '每次受到直接攻击时，反震你 5 点伤害。', value: 5 },
    intents: [
      { kind: 'debuff', label: '黄泉死气侵蚀', damage: 26, poison: 6, weak: 2 },
      { kind: 'attack', label: '尸皇印镇杀', damage: 38 },
      { kind: 'defend', label: '冥河重水幕', block: 50 },
    ],
  },
  'e6-elite-locust': {
    id: 'e6-elite-locust', name: '螟虫之母 · 吞界王眷', title: '灵界第一凶劫大乘虫尊', act: 6, tier: 'elite', maxHp: 660, artStyle: 'beast',
    trait: { id: 'anti-skill', name: '吞噬法则', description: '你每打出 1 张【运转】牌，王眷吞吸元气获得 +3 杀意。', value: 3 },
    intents: [
      { kind: 'multi-attack', label: '亿万螟虫噬天', damage: 16, hits: 3 },
      { kind: 'buff', label: '吞界甲壳再生', block: 55, strengthGain: 4 },
      { kind: 'debuff', label: '虫母神识冲击', damage: 32, vulnerable: 2, addCurse: 'curse-whisper' },
    ],
  },
  'e6-boss-immortal-tribulation': {
    id: 'e6-boss-immortal-tribulation', name: '飞升仙界 · 九九紫霄灭仙雷劫', title: '灵界飞升大劫（撑过 7 劫或一剑劈开仙门）',
    act: 6, tier: 'tribulation', maxHp: 980, tribulationWaves: 7, artStyle: 'thunder',
    phase2: {
      title: '仙界之门洞开 · 混沌仙罡神雷',
      announcement: '☀️ 飞升台仙门洞开，北寒仙域法则锁血护道，降下混沌仙罡雷！',
      shieldGain: 90,
      strengthGain: 4,
      intents: [
        { kind: 'tribulation-bolt', label: '仙劫 · 阴阳混沌雷', damage: 22, hits: 2 },
        { kind: 'tribulation-bolt', label: '仙劫 · 诛仙法则雷', damage: 44, vulnerable: 2 },
        { kind: 'tribulation-bolt', label: '终劫 · 接引开天仙光', damage: 56 },
      ],
    },
    intents: [
      { kind: 'tribulation-bolt', label: '一重 · 紫霄玄雷', damage: 28 },
      { kind: 'tribulation-bolt', label: '二重 · 蚀仙心魔雷', damage: 32, addCurse: 'curse-whisper' },
      { kind: 'tribulation-bolt', label: '三重 · 五行灭绝神雷', damage: 18, hits: 2 },
      { kind: 'tribulation-bolt', label: '四重 · 九天罡煞雷', damage: 36, vulnerable: 2 },
      { kind: 'tribulation-bolt', label: '五重 · 太乙真雷雨', damage: 16, hits: 3 },
      { kind: 'tribulation-bolt', label: '六重 · 万古寂灭雷', damage: 44, weak: 2 },
      { kind: 'tribulation-bolt', label: '终劫 · 飞升北寒仙劫', damage: 52 },
    ],
  },

  // ==================== 第七卷：仙界篇 · 北寒初仙（真仙 ➔ 金仙） ====================
  'e7-court-envoy': {
    id: 'e7-court-envoy', name: '北寒仙宫巡察仙使', title: '天庭真仙后期战将', act: 7, tier: 'normal', maxHp: 620, artStyle: 'celestial',
    trait: { id: 'sword-guard', name: '仙窍罡衣', description: '你每回合打出的第 4 张牌起，自动凝结 16 点仙罡护盾。', value: 16 },
    intents: [
      { kind: 'attack', label: '金阙仙剑斩', damage: 40 },
      { kind: 'defend', label: '仙窍护体金光', block: 60, strengthGain: 4 },
      { kind: 'multi-attack', label: '天庭诛逆三击', damage: 17, hits: 3 },
    ],
  },
  'e7-corpse-immortal': {
    id: 'e7-corpse-immortal', name: '冥寒仙府不灭尸仙', title: '古仙遗蜕通灵', act: 7, tier: 'normal', maxHp: 650, artStyle: 'demon',
    intents: [
      { kind: 'debuff', label: '太阴仙煞侵体', damage: 32, poison: 8, vulnerable: 2 },
      { kind: 'attack', label: '碎窍仙拳', damage: 44 },
      { kind: 'defend', label: '万载寒玉甲', block: 65 },
    ],
  },
  'e7-elite-zhulong': {
    id: 'e7-elite-zhulong', name: '烛龙道叛宗金仙 · 奇摩子', title: '金仙中期灵目大修', act: 7, tier: 'elite', maxHp: 920, artStyle: 'cultivator',
    trait: { id: 'anti-skill', name: '灵目洞察', description: '你每打出 1 张【运转】牌，奇摩子获得 +3 杀意。', value: 3 },
    intents: [
      { kind: 'multi-attack', label: '岁月毒火双斩', damage: 24, hits: 2, poison: 6 },
      { kind: 'buff', label: '点亮百枚仙窍', block: 70, strengthGain: 5 },
      { kind: 'attack', label: '金仙法则灭魂击', damage: 48, addCurse: 'curse-whisper' },
    ],
  },
  'e7-boss-xiaojinhan': {
    id: 'e7-boss-xiaojinhan', name: '冥寒夺道 · 北寒宫主萧晋寒', title: '金仙巅峰 · 空间晶丝法则主', act: 7, tier: 'boss', maxHp: 1380, artStyle: 'celestial',
    trait: { id: 'stone-shell', name: '北寒空间玄冰障', description: '每回合首击伤害减半（若你参悟【空间法则】可直接撕裂无视！）。', value: 50 },
    phase2: {
      title: '萧晋寒 · 玄冰法则仙域全开',
      announcement: '❄️ 萧晋寒锁血引爆冥寒本源，展开百里玄冰仙域！护盾 +120，本回合受击减半！',
      shieldGain: 120,
      strengthGain: 5,
      intents: [
        { kind: 'multi-attack', label: '空间冰晶千刃斩', damage: 22, hits: 3 },
        { kind: 'debuff', label: '仙域冰封万物', damage: 44, weak: 2, vulnerable: 2, addCurse: 'curse-whisper' },
        { kind: 'attack', label: '北寒绝仙一击', damage: 62 },
      ],
    },
    intents: [
      { kind: 'buff', label: '凝结玄冰仙域', block: 75, strengthGain: 4 },
      { kind: 'multi-attack', label: '空间晶丝三绝', damage: 19, hits: 3 },
      { kind: 'debuff', label: '冥寒封脉光', damage: 38, weak: 2 },
      { kind: 'attack', label: '金仙镇世印', damage: 52 },
    ],
  },

  // ==================== 第八卷：仙界篇 · 灰界太乙（太乙 ➔ 大罗） ====================
  'e8-grey-lord': {
    id: 'e8-grey-lord', name: '灰界三目太乙煞主', title: '阴括城煞气霸主', act: 8, tier: 'normal', maxHp: 780, artStyle: 'demon',
    trait: { id: 'thorns', name: '死气煞罡', description: '每次受到直接攻击时，反震你 6 点伤害。', value: 6 },
    intents: [
      { kind: 'attack', label: '灰界灭仙光', damage: 48, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '三目煞雷连轰', damage: 20, hits: 3 },
      { kind: 'defend', label: '九幽洗煞盾', block: 75, strengthGain: 4 },
    ],
  },
  'e8-time-soldier': {
    id: 'e8-time-soldier', name: '真言门护宗岁月道兵', title: '太乙巅峰时间傀儡', act: 8, tier: 'elite', maxHp: 1180, artStyle: 'celestial',
    trait: { id: 'sword-guard', name: '光阴流速凝滞', description: '你每回合打出的第 4 张牌起，道兵自动获得 20 点护盾。', value: 20 },
    intents: [
      { kind: 'debuff', label: '真实之眼迟滞', damage: 42, weak: 2, vulnerable: 2 },
      { kind: 'multi-attack', label: '光阴飞梭三连', damage: 22, hits: 3 },
      { kind: 'buff', label: '倒流岁月金身', block: 85, strengthGain: 5 },
    ],
  },
  'e8-boss-corpse-self': {
    id: 'e8-boss-corpse-self', name: '斩三尸劫 · 大罗恶尸斩道魔君', title: '晋升大罗必渡三尸心魔劫', act: 8, tier: 'boss', maxHp: 1720, artStyle: 'demon',
    trait: { id: 'seal-lock', name: '恶尸乱道', description: '恶尸侵扰本源，你的灵印槽减少 1 格。', value: 2 },
    phase2: {
      title: '恶尸暴走 · 大罗无量真魔仙域',
      announcement: '👹 大罗恶尸锁血展开无量血海仙域！护盾 +150，本回合受击减半！',
      shieldGain: 150,
      strengthGain: 6,
      intents: [
        { kind: 'multi-attack', label: '斩尸灭道三连击', damage: 24, hits: 3 },
        { kind: 'debuff', label: '大罗道果剥夺', damage: 48, weak: 2, vulnerable: 2, addCurse: 'curse-flaw' },
        { kind: 'attack', label: '毁天灭地斩仙剑', damage: 68 },
      ],
    },
    intents: [
      { kind: 'buff', label: '复刻本尊神通', block: 85, strengthGain: 5 },
      { kind: 'multi-attack', label: '三尸魔剑狂袭', damage: 21, hits: 3 },
      { kind: 'debuff', label: '心魔蚀仙窍', damage: 44, vulnerable: 2, addCurse: 'curse-whisper' },
      { kind: 'attack', label: '大罗碎虚掌', damage: 60 },
    ],
  },

  // ==================== 第九卷：仙界篇终章 · 混沌道祖（决战古或今） ====================
  'e9-elite-jiuyuan': {
    id: 'e9-elite-jiuyuan', name: '中土天庭 · 镇狱大罗天尊', title: '天庭七君之一', act: 9, tier: 'elite', maxHp: 1450, artStyle: 'celestial',
    trait: { id: 'stone-shell', name: '混沌天庭仙甲', description: '每回合首击伤害减半（【空间法则】可无视）。', value: 50 },
    intents: [
      { kind: 'defend', label: '诸天星斗护界', block: 95, strengthGain: 5 },
      { kind: 'multi-attack', label: '镇狱神戟三连', damage: 24, hits: 3 },
      { kind: 'attack', label: '大罗敕令抹杀', damage: 58, vulnerable: 2 },
    ],
  },
  'e9-boss-guhuojin': {
    id: 'e9-boss-guhuojin', name: '天庭之主 · 时间道祖古或今', title: '三千大道至尊 · 混沌时间之主', act: 9, tier: 'boss', maxHp: 2350, artStyle: 'celestial',
    trait: { id: 'anti-skill', name: '时间天道威压', description: '你每打出 1 张【运转】牌，时间道祖获得 +4 杀意。', value: 4 },
    phase2: {
      title: '古或今 · 混沌万古时间长河真身',
      announcement: '⏳ 古或今锁血融身混沌时间长河，万古纪元重演！护盾 +200，本回合受击减半！',
      shieldGain: 200,
      strengthGain: 6,
      intents: [
        { kind: 'multi-attack', label: '万古光阴湮灭三斩', damage: 26, hits: 3 },
        { kind: 'debuff', label: '诸天纪元归零敕令', damage: 54, weak: 2, vulnerable: 2, addCurse: 'curse-flaw' },
        { kind: 'attack', label: '混沌道祖 · 终极抹杀', damage: 78 },
      ],
    },
    intents: [
      { kind: 'buff', label: '召唤光阴长河护体', block: 110, strengthGain: 5, addCurse: 'curse-whisper' },
      { kind: 'multi-attack', label: '时间金色法则神链', damage: 23, hits: 3 },
      { kind: 'debuff', label: '剥夺万载岁月', damage: 48, weak: 2, vulnerable: 2 },
      { kind: 'attack', label: '大罗混沌归墟印', damage: 68 },
    ],
  },
};

export function pickEnemyForNode(act: ActNumber, tier: 'normal' | 'elite' | 'boss', rngNext: () => number): EnemyDef {
  const pool = Object.values(ENEMIES).filter(
    (e) => e.act === act && (tier === 'boss' ? e.tier === 'boss' || e.tier === 'tribulation' : e.tier === tier),
  );
  if (pool.length === 0) {
    const fallback = Object.values(ENEMIES).filter((e) => e.act === act);
    return fallback[0] ?? ENEMIES['e1-wolf'];
  }
  return pool[Math.floor(rngNext() * pool.length)];
}
