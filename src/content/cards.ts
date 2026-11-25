import type { CardDef } from '../core/types';

export const CARDS: Record<string, CardDef> = {
  // ==================== 剑修（太白剑宗 · 金/雷） ====================
  'sw-slash': {
    id: 'sw-slash', name: '青萍剑气', lineage: 'sword', type: 'attack', rarity: 'starter', element: 'metal', cost: 1,
    description: '造成 6 点伤害。',
    effect: { damage: 6 },
    upgradeName: '青萍剑气+', upgradeDescription: '造成 9 点伤害。', upgradeEffect: { damage: 9 },
  },
  'sw-ward': {
    id: 'sw-ward', name: '剑幕护身', lineage: 'sword', type: 'defense', rarity: 'starter', element: 'metal', cost: 1,
    description: '获得 6 点护体罡气。',
    effect: { block: 6 },
    upgradeName: '剑幕护身+', upgradeDescription: '获得 9 点护体罡气。', upgradeEffect: { block: 9 },
  },
  'sw-focus': {
    id: 'sw-focus', name: '养剑意', lineage: 'sword', type: 'skill', rarity: 'starter', element: 'metal', cost: 1,
    description: '获得 2 层【剑意】并抽 1 张牌。',
    effect: { swordIntent: 2, draw: 1 },
    upgradeName: '养剑意+', upgradeCost: 0, upgradeDescription: '获得 2 层【剑意】并抽 1 张牌。', upgradeEffect: { swordIntent: 2, draw: 1 },
  },
  'sw-flying': {
    id: 'sw-flying', name: '御剑术', lineage: 'sword', type: 'attack', rarity: 'common', element: 'metal', cost: 0,
    description: '造成 4 点伤害，获得 1 层【剑意】。',
    effect: { damage: 4, swordIntent: 1 },
    upgradeName: '御剑术+', upgradeDescription: '造成 7 点伤害，获得 1 层【剑意】。', upgradeEffect: { damage: 7, swordIntent: 1 },
  },
  'sw-thunder-pierce': {
    id: 'sw-thunder-pierce', name: '惊雷刺', lineage: 'sword', type: 'attack', rarity: 'common', element: 'thunder', cost: 1,
    description: '造成 8 点穿甲雷伤（无视护盾）。',
    effect: { damage: 8, pierce: true },
    upgradeName: '惊雷刺+', upgradeDescription: '造成 12 点穿甲雷伤（无视护盾）。', upgradeEffect: { damage: 12, pierce: true },
  },
  'sw-twin-swallow': {
    id: 'sw-twin-swallow', name: '双燕分波', lineage: 'sword', type: 'attack', rarity: 'common', element: 'metal', cost: 1,
    description: '连续斩击 2 次，每次造成 5 点伤害，置入 1 张 0 费【御剑术】入手牌。',
    effect: { damage: 5, hits: 2, addCardsToHand: ['sw-flying'] },
    upgradeName: '双燕分波+', upgradeDescription: '连续斩击 2 次，每次造成 7 点伤害，置入 1 张【御剑术】。', upgradeEffect: { damage: 7, hits: 2, addCardsToHand: ['sw-flying'] },
  },
  'sw-sword-rain': {
    id: 'sw-sword-rain', name: '青莲剑雨', lineage: 'sword', type: 'attack', rarity: 'rare', element: 'metal', cost: 2,
    description: '连续斩击 3 次，每次造成 6 点伤害，获得 2 层【剑意】。',
    effect: { damage: 6, hits: 3, swordIntent: 2 },
    upgradeName: '青莲剑雨+', upgradeDescription: '连续斩击 4 次，每次造成 6 点伤害，获得 2 层【剑意】。', upgradeEffect: { damage: 6, hits: 4, swordIntent: 2 },
  },
  'sw-parry-counter': {
    id: 'sw-parry-counter', name: '听泉拆招', lineage: 'sword', type: 'defense', rarity: 'common', element: 'water', cost: 1,
    description: '获得 9 点罡气，抽 1 张牌，获得 1 层【剑意】。',
    effect: { block: 9, draw: 1, swordIntent: 1 },
    upgradeName: '听泉拆招+', upgradeDescription: '获得 12 点罡气，抽 2 张牌，获得 1 层【剑意】。', upgradeEffect: { block: 12, draw: 2, swordIntent: 1 },
  },
  'sw-thunder-sheath': {
    id: 'sw-thunder-sheath', name: '雷引归鞘', lineage: 'sword', type: 'skill', rarity: 'rare', element: 'thunder', cost: 1,
    description: '获得 2 点真元，置入 2 张【御剑术】入手牌。消耗。',
    exhaust: true,
    effect: { gainQi: 2, addCardsToHand: ['sw-flying', 'sw-flying'] },
    upgradeName: '雷引归鞘+', upgradeCost: 0, upgradeDescription: '获得 2 点真元，置入 2 张【御剑术】。消耗。', upgradeEffect: { gainQi: 2, addCardsToHand: ['sw-flying', 'sw-flying'] },
  },
  'sw-myriad-return': {
    id: 'sw-myriad-return', name: '万剑归宗', lineage: 'sword', type: 'attack', rarity: 'mythic', element: 'metal', cost: 2,
    description: '消耗全部【剑意】，造成 12 + 每层剑意×6 点穿甲伤害。',
    effect: { damage: 12, pierce: true, consumeSwordIntent: true, damagePerSwordIntent: 6 },
    upgradeName: '万剑归宗+', upgradeDescription: '消耗全部【剑意】，造成 16 + 每层剑意×8 点穿甲伤害。', upgradeEffect: { damage: 16, pierce: true, consumeSwordIntent: true, damagePerSwordIntent: 8 },
  },
  'sw-heaven-cleave': {
    id: 'sw-heaven-cleave', name: '斩天拔剑术', lineage: 'sword', type: 'forbidden', rarity: 'mythic', element: 'thunder', cost: 1,
    exhaust: true,
    description: '燃烧 3 年寿元：造成 34 点穿甲雷伤并施加 2 层【破绽】。消耗。',
    effect: { lifeCost: 3, damage: 34, pierce: true, vulnerable: 2 },
    upgradeName: '斩天拔剑术+', upgradeDescription: '燃烧 2 年寿元：造成 42 点穿甲雷伤并施加 3 层【破绽】。消耗。', upgradeEffect: { lifeCost: 2, damage: 42, pierce: true, vulnerable: 3 },
  },
  'sw-sword-formation': {
    id: 'sw-sword-formation', name: '大庚剑阵', lineage: 'sword', type: 'array', rarity: 'rare', element: 'metal', cost: 2,
    description: '布下剑阵：每回合末自动飞射 8 点剑伤。',
    effect: { arrayPower: { id: 'arr-geng-sword', name: '大庚剑阵', damagePerTurn: 8 } },
    upgradeName: '大庚剑阵+', upgradeCost: 1, upgradeDescription: '布下剑阵：每回合末自动飞射 10 点剑伤。', upgradeEffect: { arrayPower: { id: 'arr-geng-sword', name: '大庚剑阵+', damagePerTurn: 10 } },
  },

  // ==================== 魔修（幽冥魔渊 · 煞/火） ====================
  'dm-claw': {
    id: 'dm-claw', name: '幽冥煞爪', lineage: 'demon', type: 'attack', rarity: 'starter', element: 'sha', cost: 1,
    description: '造成 7 点伤害。',
    effect: { damage: 7 },
    upgradeName: '幽冥煞爪+', upgradeDescription: '造成 10 点伤害。', upgradeEffect: { damage: 10 },
  },
  'dm-blood-shield': {
    id: 'dm-blood-shield', name: '血煞护体', lineage: 'demon', type: 'defense', rarity: 'starter', element: 'sha', cost: 1,
    description: '获得 6 点护体罡气。',
    effect: { block: 6 },
    upgradeName: '血煞护体+', upgradeDescription: '获得 9 点护体罡气。', upgradeEffect: { block: 9 },
  },
  'dm-burn-life': {
    id: 'dm-burn-life', name: '燃寿魔印', lineage: 'demon', type: 'forbidden', rarity: 'starter', element: 'sha', cost: 0,
    description: '燃烧 2 年寿元：获得 2 点真元，抽 2 张牌。',
    effect: { lifeCost: 2, gainQi: 2, draw: 2 },
    upgradeName: '燃寿魔印+', upgradeDescription: '燃烧 1 年寿元：获得 2 点真元，抽 2 张牌。', upgradeEffect: { lifeCost: 1, gainQi: 2, draw: 2 },
  },
  'dm-devour-heart': {
    id: 'dm-devour-heart', name: '噬心魔火', lineage: 'demon', type: 'attack', rarity: 'common', element: 'fire', cost: 1,
    description: '损耗 4 点气血：造成 14 点伤害并施加 1 层【破绽】。',
    effect: { selfHpCost: 4, damage: 14, vulnerable: 1 },
    upgradeName: '噬心魔火+', upgradeDescription: '损耗 3 点气血：造成 19 点伤害并施加 2 层【破绽】。', upgradeEffect: { selfHpCost: 3, damage: 19, vulnerable: 2 },
  },
  'dm-soul-reap': {
    id: 'dm-soul-reap', name: '夺元魔镰', lineage: 'demon', type: 'attack', rarity: 'common', element: 'sha', cost: 1,
    description: '造成 9 点伤害并恢复 4 点气血；若斩杀目标则寿元上限 +5 年。',
    effect: { damage: 9, heal: 4, gainLifespan: 5 },
    upgradeName: '夺元魔镰+', upgradeDescription: '造成 13 点伤害并恢复 6 点气血；若斩杀目标则寿元上限 +6 年。', upgradeEffect: { damage: 13, heal: 6, gainLifespan: 6 },
  },
  'dm-blood-sea': {
    id: 'dm-blood-sea', name: '血海滔天', lineage: 'demon', type: 'attack', rarity: 'rare', element: 'sha', cost: 2,
    description: '损耗 6 点气血：连斩 2 次各 12 伤，往弃牌堆塞入 1 张【心魔低语】。',
    effect: { selfHpCost: 6, damage: 12, hits: 2, addCurseToDiscard: 'curse-whisper' },
    upgradeName: '血海滔天+', upgradeDescription: '损耗 5 点气血：连斩 2 次各 16 伤，塞入 1 张【心魔低语】。', upgradeEffect: { selfHpCost: 5, damage: 16, hits: 2, addCurseToDiscard: 'curse-whisper' },
  },
  'dm-feast-demon': {
    id: 'dm-feast-demon', name: '炼魔成劫', lineage: 'demon', type: 'attack', rarity: 'rare', element: 'fire', cost: 1,
    description: '消耗手牌中所有【心魔/道伤】牌，造成 10 + 每张消耗×14 点穿甲伤害。',
    effect: { damage: 10, pierce: true, exhaustCursesInHand: true, damagePerExhaustedCurse: 14 },
    upgradeName: '炼魔成劫+', upgradeDescription: '消耗手牌中所有心魔牌，造成 14 + 每张消耗×18 点穿甲伤害。', upgradeEffect: { damage: 14, pierce: true, exhaustCursesInHand: true, damagePerExhaustedCurse: 18 },
  },
  'dm-bone-armor': {
    id: 'dm-bone-armor', name: '白骨魔铠', lineage: 'demon', type: 'defense', rarity: 'common', element: 'sha', cost: 1,
    description: '损耗 3 点气血：获得 15 点护体罡气并抽 1 张牌。',
    effect: { selfHpCost: 3, block: 15, draw: 1 },
    upgradeName: '白骨魔铠+', upgradeDescription: '损耗 2 点气血：获得 19 点护体罡气并抽 1 张牌。', upgradeEffect: { selfHpCost: 2, block: 19, draw: 1 },
  },
  'dm-siphon-years': {
    id: 'dm-siphon-years', name: '枯荣吸寿诀', lineage: 'demon', type: 'skill', rarity: 'rare', element: 'wood', cost: 2,
    exhaust: true,
    description: '造成 12 点穿甲伤，恢复 10 点气血，直接夺取 4 年寿元上限。消耗。',
    effect: { damage: 12, pierce: true, heal: 10, gainLifespan: 4 },
    upgradeName: '枯荣吸寿诀+', upgradeDescription: '造成 16 点穿甲伤，恢复 14 点气血，直接夺取 6 年寿元上限。消耗。', upgradeEffect: { damage: 16, pierce: true, heal: 14, gainLifespan: 6 },
  },
  'dm-annihilation': {
    id: 'dm-annihilation', name: '太古天魔解体', lineage: 'demon', type: 'forbidden', rarity: 'mythic', element: 'sha', cost: 2,
    exhaust: true,
    description: '燃烧 5 年寿元：造成 46 点穿甲煞伤，施加 3 层【虚弱】与【破绽】。消耗。',
    effect: { lifeCost: 5, damage: 46, pierce: true, weak: 3, vulnerable: 3 },
    upgradeName: '太古天魔解体+', upgradeDescription: '燃烧 4 年寿元：造成 58 点穿甲煞伤，施加 3 层虚弱与破绽。消耗。', upgradeEffect: { lifeCost: 4, damage: 58, pierce: true, weak: 3, vulnerable: 3 },
  },
  'dm-hell-furnace': {
    id: 'dm-hell-furnace', name: '九幽煞阵', lineage: 'demon', type: 'array', rarity: 'rare', element: 'fire', cost: 2,
    description: '布下魔阵：每回合末造成 7 点伤害并附加 3 层丹毒。',
    effect: { arrayPower: { id: 'arr-hell-sha', name: '九幽煞阵', damagePerTurn: 7, poisonPerTurn: 3 } },
    upgradeName: '九幽煞阵+', upgradeCost: 1, upgradeDescription: '布下魔阵：每回合末造成 9 点伤害并附加 4 层丹毒。', upgradeEffect: { arrayPower: { id: 'arr-hell-sha', name: '九幽煞阵+', damagePerTurn: 9, poisonPerTurn: 4 } },
  },

  // ==================== 丹修（百草丹谷 · 木/火） ====================
  'al-thorn': {
    id: 'al-thorn', name: '青木毒刺', lineage: 'alchemy', type: 'attack', rarity: 'starter', element: 'wood', cost: 1,
    description: '造成 5 点伤害并施加 2 层【丹毒】。',
    effect: { damage: 5, poison: 2 },
    upgradeName: '青木毒刺+', upgradeDescription: '造成 7 点伤害并施加 3 层【丹毒】。', upgradeEffect: { damage: 7, poison: 3 },
  },
  'al-mist-guard': {
    id: 'al-mist-guard', name: '药雾护身', lineage: 'alchemy', type: 'defense', rarity: 'starter', element: 'wood', cost: 1,
    description: '获得 6 点护体罡气，恢复 2 点气血。',
    effect: { block: 6, heal: 2 },
    upgradeName: '药雾护身+', upgradeDescription: '获得 9 点护体罡气，恢复 3 点气血。', upgradeEffect: { block: 9, heal: 3 },
  },
  'al-brew-toxin': {
    id: 'al-brew-toxin', name: '七步散', lineage: 'alchemy', type: 'skill', rarity: 'starter', element: 'wood', cost: 1,
    description: '施加 6 层【丹毒】。',
    effect: { poison: 6 },
    upgradeName: '七步散+', upgradeDescription: '施加 9 层【丹毒】。', upgradeEffect: { poison: 9 },
  },
  'al-flame-spark': {
    id: 'al-flame-spark', name: '丹火引', lineage: 'alchemy', type: 'attack', rarity: 'common', element: 'fire', cost: 1,
    description: '造成 7 点伤害，若敌方有【丹毒】则额外施加 3 层丹毒。',
    effect: { damage: 7, poison: 3 },
    upgradeName: '丹火引+', upgradeDescription: '造成 10 点伤害，施加 5 层【丹毒】。', upgradeEffect: { damage: 10, poison: 5 },
  },
  'al-detonate': {
    id: 'al-detonate', name: '红莲爆毒', lineage: 'alchemy', type: 'skill', rarity: 'common', element: 'fire', cost: 1,
    description: '立即引爆敌人身上的【丹毒】结算 1 次毒伤。',
    effect: { detonatePoison: 1 },
    upgradeName: '红莲爆毒+', upgradeDescription: '施加 3 层【丹毒】并立即引爆结算 1 次毒伤。', upgradeEffect: { poison: 3, detonatePoison: 1 },
  },
  'al-rejuvenate': {
    id: 'al-rejuvenate', name: '青帝长生露', lineage: 'alchemy', type: 'skill', rarity: 'rare', element: 'water', cost: 1,
    exhaust: true,
    description: '恢复 12 点气血，获得 8 点罡气，抽 1 张牌。消耗。',
    effect: { heal: 12, block: 8, draw: 1 },
    upgradeName: '青帝长生露+', upgradeDescription: '恢复 18 点气血，获得 10 点罡气，抽 2 张牌。消耗。', upgradeEffect: { heal: 18, block: 10, draw: 2 },
  },
  'al-miasma-array': {
    id: 'al-miasma-array', name: '万毒瘴域', lineage: 'alchemy', type: 'array', rarity: 'rare', element: 'wood', cost: 2,
    description: '布下毒域：每回合末自动施加 5 层【丹毒】。',
    effect: { arrayPower: { id: 'arr-miasma', name: '万毒瘴域', poisonPerTurn: 5 } },
    upgradeName: '万毒瘴域+', upgradeCost: 1, upgradeDescription: '布下毒域：每回合末自动施加 6 层【丹毒】。', upgradeEffect: { arrayPower: { id: 'arr-miasma', name: '万毒瘴域+', poisonPerTurn: 6 } },
  },
  'al-double-catalyst': {
    id: 'al-double-catalyst', name: '焚炉九转', lineage: 'alchemy', type: 'skill', rarity: 'mythic', element: 'fire', cost: 2,
    exhaust: true,
    description: '施加 8 层【丹毒】，随后连续引爆【丹毒】结算 2 次！消耗。',
    effect: { poison: 8, detonatePoison: 2 },
    upgradeName: '焚炉九转+', upgradeCost: 1, upgradeDescription: '施加 10 层【丹毒】，连续引爆结算 2 次！消耗。', upgradeEffect: { poison: 10, detonatePoison: 2 },
  },
  'al-longevity-pill': {
    id: 'al-longevity-pill', name: '凝丹驻颜诀', lineage: 'alchemy', type: 'skill', rarity: 'rare', element: 'wood', cost: 1,
    exhaust: true,
    description: '恢复 8 点气血，寿元上限 +3 年，本卷道基纯度 +6。消耗。',
    effect: { heal: 8, gainLifespan: 3, gainFoundation: 6 },
    upgradeName: '凝丹驻颜诀+', upgradeDescription: '恢复 12 点气血，寿元上限 +5 年，道基纯度 +10。消耗。', upgradeEffect: { heal: 12, gainLifespan: 5, gainFoundation: 10 },
  },

  // ==================== 阵修（玄武阵山 · 土/水） ====================
  'ar-stone-strike': {
    id: 'ar-stone-strike', name: '翻山印', lineage: 'array', type: 'attack', rarity: 'starter', element: 'earth', cost: 1,
    description: '造成 6 点伤害，获得 3 点护体罡气。',
    effect: { damage: 6, block: 3 },
    upgradeName: '翻山印+', upgradeDescription: '造成 8 点伤害，获得 5 点护体罡气。', upgradeEffect: { damage: 8, block: 5 },
  },
  'ar-earth-wall': {
    id: 'ar-earth-wall', name: '厚土壁垒', lineage: 'array', type: 'defense', rarity: 'starter', element: 'earth', cost: 1,
    description: '获得 8 点护体罡气。',
    effect: { block: 8 },
    upgradeName: '厚土壁垒+', upgradeDescription: '获得 12 点护体罡气。', upgradeEffect: { block: 12 },
  },
  'ar-turret-setup': {
    id: 'ar-turret-setup', name: '小五行阵盘', lineage: 'array', type: 'array', rarity: 'starter', element: 'earth', cost: 1,
    description: '布下阵盘：每回合末获得 5 点罡气并造成 4 点伤害。',
    effect: { arrayPower: { id: 'arr-small-five', name: '小五行阵盘', blockPerTurn: 5, damagePerTurn: 4 } },
    upgradeName: '小五行阵盘+', upgradeDescription: '布下阵盘：每回合末获得 7 点罡气并造成 6 点伤害。', upgradeEffect: { arrayPower: { id: 'arr-small-five', name: '小五行阵盘+', blockPerTurn: 7, damagePerTurn: 6 } },
  },
  'ar-water-mirror': {
    id: 'ar-water-mirror', name: '玄水明镜', lineage: 'array', type: 'defense', rarity: 'common', element: 'water', cost: 1,
    description: '获得 10 点护体罡气，本回合护体罡气保留不清空。',
    effect: { block: 10, retainBlock: true },
    upgradeName: '玄水明镜+', upgradeDescription: '获得 14 点护体罡气，本回合护体罡气保留不清空。', upgradeEffect: { block: 14, retainBlock: true },
  },
  'ar-shield-slam': {
    id: 'ar-shield-slam', name: '镇岳盾反', lineage: 'array', type: 'attack', rarity: 'common', element: 'earth', cost: 1,
    description: '以盾代攻：造成等同于当前护体罡气 100% 的伤害。',
    effect: { damagePerBlock: 1.0 },
    upgradeName: '镇岳盾反+', upgradeCost: 0, upgradeDescription: '以盾代攻：造成等同于当前护体罡气 120% 的伤害。', upgradeEffect: { damagePerBlock: 1.2 },
  },
  'ar-nine-palace': {
    id: 'ar-nine-palace', name: '九宫诛仙大阵', lineage: 'array', type: 'array', rarity: 'mythic', element: 'metal', cost: 2,
    description: '布下大阵：每回合末造成 12 点伤害并获得 10 点罡气。',
    effect: { arrayPower: { id: 'arr-nine-palace', name: '九宫诛仙大阵', damagePerTurn: 12, blockPerTurn: 10 } },
    upgradeName: '九宫诛仙大阵+', upgradeDescription: '布下大阵：每回合末造成 16 点伤害并获得 14 点罡气。', upgradeEffect: { arrayPower: { id: 'arr-nine-palace', name: '九宫诛仙大阵+', damagePerTurn: 16, blockPerTurn: 14 } },
  },
  'ar-mountain-seal': {
    id: 'ar-mountain-seal', name: '不动明王印', lineage: 'array', type: 'defense', rarity: 'rare', element: 'earth', cost: 2,
    description: '获得 22 点护体罡气，本回合罡气不清空，施加 2 层【虚弱】。',
    effect: { block: 22, retainBlock: true, weak: 2 },
    upgradeName: '不动明王印+', upgradeDescription: '获得 28 点护体罡气，本回合罡气不清空，施加 3 层【虚弱】。', upgradeEffect: { block: 28, retainBlock: true, weak: 3 },
  },
  'ar-frost-tide': {
    id: 'ar-frost-tide', name: '寒潮锁灵', lineage: 'array', type: 'skill', rarity: 'common', element: 'water', cost: 1,
    description: '获得 7 点罡气，施加 2 层【虚弱】，抽 1 张牌。',
    effect: { block: 7, weak: 2, draw: 1 },
    upgradeName: '寒潮锁灵+', upgradeDescription: '获得 10 点罡气，施加 2 层【虚弱】，抽 2 张牌。', upgradeEffect: { block: 10, weak: 2, draw: 2 },
  },

  // ==================== 五行通用奇术（全道统可混搭） ====================
  'nu-gather-qi': {
    id: 'nu-gather-qi', name: '小周天吐纳', lineage: 'neutral', type: 'skill', rarity: 'common', element: 'water', cost: 0,
    description: '获得 1 点真元并抽 1 张牌。消耗。',
    exhaust: true,
    effect: { gainQi: 1, draw: 1 },
    upgradeName: '小周天吐纳+', upgradeDescription: '获得 2 点真元并抽 1 张牌。消耗。', upgradeEffect: { gainQi: 2, draw: 1 },
  },
  'nu-five-wheel': {
    id: 'nu-five-wheel', name: '五行轮转诀', lineage: 'neutral', type: 'skill', rarity: 'rare', element: 'wood', cost: 1,
    description: '抽 2 张牌，获得 1 点真元，获得 6 点罡气。',
    effect: { draw: 2, gainQi: 1, block: 6 },
    upgradeName: '五行轮转诀+', upgradeDescription: '抽 3 张牌，获得 1 点真元，获得 9 点罡气。', upgradeEffect: { draw: 3, gainQi: 1, block: 9 },
  },
  'nu-thunder-talisman': {
    id: 'nu-thunder-talisman', name: '五雷正法符', lineage: 'neutral', type: 'attack', rarity: 'common', element: 'thunder', cost: 1,
    description: '造成 11 点穿甲雷伤并施加 1 层【破绽】。',
    effect: { damage: 11, pierce: true, vulnerable: 1 },
    upgradeName: '五雷正法符+', upgradeDescription: '造成 15 点穿甲雷伤并施加 2 层【破绽】。', upgradeEffect: { damage: 15, pierce: true, vulnerable: 2 },
  },
  'nu-fire-bird': {
    id: 'nu-fire-bird', name: '离火朱雀诀', lineage: 'neutral', type: 'attack', rarity: 'common', element: 'fire', cost: 1,
    description: '造成 10 点火伤，若触发相生额外引燃 3 层丹毒。',
    effect: { damage: 10, poison: 2 },
    upgradeName: '离火朱雀诀+', upgradeDescription: '造成 14 点火伤并施加 3 层丹毒。', upgradeEffect: { damage: 14, poison: 3 },
  },
  'nu-golden-bell': {
    id: 'nu-golden-bell', name: '金刚伏魔钟', lineage: 'neutral', type: 'defense', rarity: 'common', element: 'metal', cost: 1,
    description: '获得 11 点护体罡气。',
    effect: { block: 11 },
    upgradeName: '金刚伏魔钟+', upgradeDescription: '获得 15 点护体罡气。', upgradeEffect: { block: 15 },
  },
  'nu-void-step': {
    id: 'nu-void-step', name: '缩地成寸', lineage: 'neutral', type: 'skill', rarity: 'common', element: 'water', cost: 0,
    description: '获得 5 点护体罡气，抽 1 张牌。',
    effect: { block: 5, draw: 1 },
    upgradeName: '缩地成寸+', upgradeDescription: '获得 8 点护体罡气，抽 2 张牌。', upgradeEffect: { block: 8, draw: 2 },
  },
  'nu-dao-insight': {
    id: 'nu-dao-insight', name: '朝闻道', lineage: 'neutral', type: 'skill', rarity: 'rare', element: 'earth', cost: 1,
    exhaust: true,
    description: '抽 3 张牌，本卷道基纯度 +8。消耗。',
    effect: { draw: 3, gainFoundation: 8 },
    upgradeName: '朝闻道+', upgradeCost: 0, upgradeDescription: '抽 3 张牌，本卷道基纯度 +12。消耗。', upgradeEffect: { draw: 3, gainFoundation: 12 },
  },
  'nu-chaos-seal': {
    id: 'nu-chaos-seal', name: '混元一气斩', lineage: 'neutral', type: 'attack', rarity: 'mythic', element: 'fire', cost: 2,
    description: '造成 20 点伤害，获得 12 点罡气，抽 2 张牌，额外注入【金印】。',
    effect: { damage: 20, block: 12, draw: 2, extraSeal: 'metal' },
    upgradeName: '混元一气斩+', upgradeDescription: '造成 26 点伤害，获得 16 点罡气，抽 2 张牌，注入【金印】。', upgradeEffect: { damage: 26, block: 16, draw: 2, extraSeal: 'metal' },
  },

  // ==================== 心魔与道伤（负面诅咒牌） ====================
  'curse-whisper': {
    id: 'curse-whisper', name: '心魔低语', lineage: 'curse', type: 'curse', rarity: 'curse', element: 'none', cost: 1,
    ethereal: true, exhaust: true,
    description: '虚无。打出可耗 1 真元驱散，否则回合末自动消散但扰乱抽牌。',
    effect: {},
  },
  'curse-flaw': {
    id: 'curse-flaw', name: '道基裂痕', lineage: 'curse', type: 'curse', rarity: 'curse', element: 'none', cost: 2,
    exhaust: true,
    description: '凡品破境留下的隐患。需耗 2 真元才能在本场抚平，或前往洞府斩念根除。',
    effect: {},
  },
};

export const REWARD_CARD_POOL = Object.values(CARDS).filter(
  (c) => c.rarity !== 'starter' && c.rarity !== 'curse',
);
