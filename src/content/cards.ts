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
    description: '连续斩击 2 次各 5 点伤害，置入 1 张 0 费【御剑术】入手牌。',
    effect: { damage: 5, hits: 2, addCardsToHand: ['sw-flying'] },
    upgradeName: '双燕分波+', upgradeDescription: '连续斩击 2 次各 7 点伤害，置入 1 张【御剑术】。', upgradeEffect: { damage: 7, hits: 2, addCardsToHand: ['sw-flying'] },
  },
  'sw-sword-rain': {
    id: 'sw-sword-rain', name: '青莲剑雨', lineage: 'sword', type: 'attack', rarity: 'rare', element: 'metal', cost: 2,
    description: '连续斩击 3 次各 6 点伤害，获得 2 层【剑意】。',
    effect: { damage: 6, hits: 3, swordIntent: 2 },
    upgradeName: '青莲剑雨+', upgradeDescription: '连续斩击 4 次各 6 点伤害，获得 2 层【剑意】。', upgradeEffect: { damage: 6, hits: 4, swordIntent: 2 },
  },
  'sw-parry-counter': {
    id: 'sw-parry-counter', name: '听泉拆招', lineage: 'sword', type: 'defense', rarity: 'common', element: 'water', cost: 1,
    description: '获得 9 点护体罡气，抽 1 张牌，获得 1 层【剑意】。',
    effect: { block: 9, draw: 1, swordIntent: 1 },
    upgradeName: '听泉拆招+', upgradeDescription: '获得 12 点罡气，抽 2 张牌，获得 1 层【剑意】。', upgradeEffect: { block: 12, draw: 2, swordIntent: 1 },
  },
  'sw-thunder-sheath': {
    id: 'sw-thunder-sheath', name: '雷引归鞘', lineage: 'sword', type: 'skill', rarity: 'rare', element: 'thunder', cost: 1,
    exhaust: true,
    description: '获得 2 点真元，置入 2 张 0 费【御剑术】入手牌。消耗。',
    effect: { gainQi: 2, addCardsToHand: ['sw-flying', 'sw-flying'] },
    upgradeName: '雷引归鞘+', upgradeCost: 0, upgradeDescription: '获得 2 点真元，置入 2 张【御剑术】。消耗。', upgradeEffect: { gainQi: 2, addCardsToHand: ['sw-flying', 'sw-flying'] },
  },
  'sw-myriad-return': {
    id: 'sw-myriad-return', name: '万剑归宗', lineage: 'sword', type: 'attack', rarity: 'mythic', element: 'metal', cost: 2,
    description: '释放全部【剑意】，造成 12 + 每层剑意×6 点穿甲伤害。',
    effect: { damage: 12, pierce: true, consumeSwordIntent: true, damagePerSwordIntent: 6 },
    upgradeName: '万剑归宗+', upgradeDescription: '释放全部【剑意】，造成 16 + 每层剑意×8 点穿甲伤害。', upgradeEffect: { damage: 16, pierce: true, consumeSwordIntent: true, damagePerSwordIntent: 8 },
  },
  'sw-heaven-cleave': {
    id: 'sw-heaven-cleave', name: '斩天拔剑术', lineage: 'sword', type: 'forbidden', rarity: 'mythic', element: 'thunder', cost: 1,
    exhaust: true,
    description: '燃血 8 点：造成 34 点穿甲雷伤并施加 2 层【破绽】。消耗。',
    effect: { selfHpCost: 8, damage: 34, pierce: true, vulnerable: 2 },
    upgradeName: '斩天拔剑术+', upgradeDescription: '燃血 5 点：造成 42 点穿甲雷伤并施加 3 层【破绽】。消耗。', upgradeEffect: { selfHpCost: 5, damage: 42, pierce: true, vulnerable: 3 },
  },
  'sw-sword-formation': {
    id: 'sw-sword-formation', name: '大庚剑阵', lineage: 'sword', type: 'array', rarity: 'rare', element: 'metal', cost: 2,
    description: '布下阵盘：每回合末自动飞射 8 点剑伤。',
    effect: { arrayPower: { id: 'arr-geng-sword', name: '大庚剑阵', damagePerTurn: 8 } },
    upgradeName: '大庚剑阵+', upgradeCost: 1, upgradeDescription: '布下阵盘：每回合末自动飞射 10 点剑伤。', upgradeEffect: { arrayPower: { id: 'arr-geng-sword', name: '大庚剑阵+', damagePerTurn: 10 } },
  },
  'sw-mirror-counter': {
    id: 'sw-mirror-counter', name: '止水剑罡', lineage: 'sword', type: 'defense', rarity: 'common', element: 'water', cost: 1,
    description: '获得 8 点护体罡气与 5 层【剑罡反击】。',
    effect: { block: 8, counterAura: 5 },
    upgradeName: '止水剑罡+', upgradeDescription: '获得 11 点护体罡气与 8 层【剑罡反击】。', upgradeEffect: { block: 11, counterAura: 8 },
  },
  'sw-counter-storm': {
    id: 'sw-counter-storm', name: '逆鳞反剑诀', lineage: 'sword', type: 'skill', rarity: 'rare', element: 'thunder', cost: 1,
    description: '获得 9 层【剑罡反击】、2 层【剑意】，抽 1 张牌。',
    effect: { counterAura: 9, swordIntent: 2, draw: 1 },
    upgradeName: '逆鳞反剑诀+', upgradeDescription: '获得 13 层【剑罡反击】、3 层【剑意】，抽 1 张牌。', upgradeEffect: { counterAura: 13, swordIntent: 3, draw: 1 },
  },
  'sw-x-zhuxian': {
    id: 'sw-x-zhuxian', name: '太白诛仙剑', lineage: 'sword', type: 'attack', rarity: 'mythic', element: 'thunder', cost: 0,
    exhaust: true,
    description: 'X费（倾泻全部真元）：连斩 X+1 剑，每剑 9 点穿甲雷伤并获 2 层【剑意】。消耗。',
    effect: { xCost: true, xHitsBase: 1, damage: 9, pierce: true, swordIntent: 2 },
    upgradeName: '太白诛仙剑+', upgradeDescription: 'X费：连斩 X+2 剑，每剑 11 点穿甲雷伤并获 3 层【剑意】。消耗。', upgradeEffect: { xCost: true, xHitsBase: 2, damage: 11, pierce: true, swordIntent: 3 },
  },
  'sw-flash-draw': {
    id: 'sw-flash-draw', name: '一线天拔剑', lineage: 'sword', type: 'attack', rarity: 'common', element: 'metal', cost: 0,
    exhaust: true,
    description: '造成 5 点穿甲伤，抽 1 张牌。消耗。',
    effect: { damage: 5, pierce: true, draw: 1 },
    upgradeName: '一线天拔剑+', upgradeDescription: '造成 8 点穿甲伤，抽 2 张牌。消耗。', upgradeEffect: { damage: 8, pierce: true, draw: 2 },
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
    id: 'dm-burn-life', name: '燃血魔印', lineage: 'demon', type: 'forbidden', rarity: 'starter', element: 'sha', cost: 0,
    description: '燃血 5 点：立即获得 2 点真元，抽 2 张牌。',
    effect: { selfHpCost: 5, gainQi: 2, draw: 2 },
    upgradeName: '燃血魔印+', upgradeDescription: '燃血 3 点：立即获得 2 点真元，抽 2 张牌。', upgradeEffect: { selfHpCost: 3, gainQi: 2, draw: 2 },
  },
  'dm-devour-heart': {
    id: 'dm-devour-heart', name: '噬心魔火', lineage: 'demon', type: 'attack', rarity: 'common', element: 'fire', cost: 1,
    description: '燃血 4 点：造成 14 点伤害并施加 1 层【破绽】。',
    effect: { selfHpCost: 4, damage: 14, vulnerable: 1 },
    upgradeName: '噬心魔火+', upgradeDescription: '燃血 3 点：造成 19 点伤害并施加 2 层【破绽】。', upgradeEffect: { selfHpCost: 3, damage: 19, vulnerable: 2 },
  },
  'dm-soul-reap': {
    id: 'dm-soul-reap', name: '夺元魔镰', lineage: 'demon', type: 'attack', rarity: 'common', element: 'sha', cost: 1,
    description: '造成 9 点伤害并恢复 4 点气血；若斩杀目标则永久提升 3 点气血上限！',
    effect: { damage: 9, heal: 4, gainMaxHp: 3 },
    upgradeName: '夺元魔镰+', upgradeDescription: '造成 13 点伤害回 6 血；若斩杀则永久提升 4 点气血上限！', upgradeEffect: { damage: 13, heal: 6, gainMaxHp: 4 },
  },
  'dm-blood-sea': {
    id: 'dm-blood-sea', name: '血海滔天', lineage: 'demon', type: 'attack', rarity: 'rare', element: 'sha', cost: 2,
    description: '燃血 6 点：连斩 2 次各 12 伤，往弃牌堆塞入 1 张【心魔低语】。',
    effect: { selfHpCost: 6, damage: 12, hits: 2, addCurseToDiscard: 'curse-whisper' },
    upgradeName: '血海滔天+', upgradeDescription: '燃血 5 点：连斩 2 次各 16 伤，塞入 1 张【心魔低语】。', upgradeEffect: { selfHpCost: 5, damage: 16, hits: 2, addCurseToDiscard: 'curse-whisper' },
  },
  'dm-feast-demon': {
    id: 'dm-feast-demon', name: '炼魔成劫', lineage: 'demon', type: 'attack', rarity: 'rare', element: 'fire', cost: 1,
    description: '消耗手牌中所有心魔牌，造成 10 + 每张×14 点穿甲伤害。',
    effect: { damage: 10, pierce: true, exhaustCursesInHand: true, damagePerExhaustedCurse: 14 },
    upgradeName: '炼魔成劫+', upgradeDescription: '消耗手牌中所有心魔牌，造成 14 + 每张×18 点穿甲伤害。', upgradeEffect: { damage: 14, pierce: true, exhaustCursesInHand: true, damagePerExhaustedCurse: 18 },
  },
  'dm-bone-armor': {
    id: 'dm-bone-armor', name: '白骨魔铠', lineage: 'demon', type: 'defense', rarity: 'common', element: 'sha', cost: 1,
    description: '燃血 3 点：获得 15 点护体罡气并抽 1 张牌。',
    effect: { selfHpCost: 3, block: 15, draw: 1 },
    upgradeName: '白骨魔铠+', upgradeDescription: '燃血 2 点：获得 19 点护体罡气并抽 1 张牌。', upgradeEffect: { selfHpCost: 2, block: 19, draw: 1 },
  },
  'dm-siphon-years': {
    id: 'dm-siphon-years', name: '枯荣吸元诀', lineage: 'demon', type: 'skill', rarity: 'rare', element: 'wood', cost: 2,
    exhaust: true,
    description: '造成 12 点穿甲伤，恢复 10 点气血；若斩杀额外提升 3 点气血上限。消耗。',
    effect: { damage: 12, pierce: true, heal: 10, gainMaxHp: 3 },
    upgradeName: '枯荣吸元诀+', upgradeDescription: '造成 16 点穿甲伤，恢复 14 点气血；若斩杀 +5 气血上限。消耗。', upgradeEffect: { damage: 16, pierce: true, heal: 14, gainMaxHp: 5 },
  },
  'dm-annihilation': {
    id: 'dm-annihilation', name: '太古天魔解体', lineage: 'demon', type: 'forbidden', rarity: 'mythic', element: 'sha', cost: 2,
    exhaust: true,
    description: '献祭 5 点气血上限：造成 46 点穿甲煞伤，施加 3 层【虚弱】与【破绽】。消耗。',
    effect: { maxHpCost: 5, damage: 46, pierce: true, weak: 3, vulnerable: 3 },
    upgradeName: '太古天魔解体+', upgradeDescription: '献祭 3 点气血上限：造成 58 点穿甲煞伤，施加 3 层虚弱与破绽。消耗。', upgradeEffect: { maxHpCost: 3, damage: 58, pierce: true, weak: 3, vulnerable: 3 },
  },
  'dm-hell-furnace': {
    id: 'dm-hell-furnace', name: '九幽煞阵', lineage: 'demon', type: 'array', rarity: 'rare', element: 'fire', cost: 2,
    description: '布下阵盘：每回合末造成 7 点伤害并附加 3 层【丹毒】。',
    effect: { arrayPower: { id: 'arr-hell-sha', name: '九幽煞阵', damagePerTurn: 7, poisonPerTurn: 3 } },
    upgradeName: '九幽煞阵+', upgradeCost: 1, upgradeDescription: '布下阵盘：每回合末造成 9 点伤害并附加 4 层【丹毒】。', upgradeEffect: { arrayPower: { id: 'arr-hell-sha', name: '九幽煞阵+', damagePerTurn: 9, poisonPerTurn: 4 } },
  },
  'dm-blood-sacrifice': {
    id: 'dm-blood-sacrifice', name: '血祭化灵', lineage: 'demon', type: 'skill', rarity: 'common', element: 'sha', cost: 0,
    description: '随机消耗手牌中 1 张牌：获得 2 点真元与 8 点护体罡气。',
    effect: { exhaustRandomHand: 1, gainQi: 2, block: 8 },
    upgradeName: '血祭化灵+', upgradeDescription: '随机消耗 1 张手牌：获 2 真元、11 罡气并抽 1 牌。', upgradeEffect: { exhaustRandomHand: 1, gainQi: 2, block: 11, draw: 1 },
  },
  'dm-ash-strike': {
    id: 'dm-ash-strike', name: '焚骨魔刃', lineage: 'demon', type: 'attack', rarity: 'common', element: 'fire', cost: 1,
    description: '随机消耗 1 张手牌，造成 15 点伤害并恢复 4 点气血。',
    effect: { exhaustRandomHand: 1, damage: 15, heal: 4 },
    upgradeName: '焚骨魔刃+', upgradeDescription: '随机消耗 1 张手牌，造成 21 点伤害并恢复 6 点气血。', upgradeEffect: { exhaustRandomHand: 1, damage: 21, heal: 6 },
  },
  'dm-myriad-demons': {
    id: 'dm-myriad-demons', name: '万魔朝宗', lineage: 'demon', type: 'attack', rarity: 'mythic', element: 'sha', cost: 2,
    description: '造成 14 点穿甲伤；本场消耗堆中每有 1 张牌，伤害额外 +8！',
    effect: { damage: 14, damagePerExhausted: 8, pierce: true },
    upgradeName: '万魔朝宗+', upgradeDescription: '造成 18 点穿甲伤；每有 1 张已消耗牌伤害额外 +11！', upgradeEffect: { damage: 18, damagePerExhausted: 11, pierce: true },
  },
  'dm-life-pact': {
    id: 'dm-life-pact', name: '逆天燃血咒', lineage: 'demon', type: 'forbidden', rarity: 'rare', element: 'sha', cost: 0,
    exhaust: true,
    description: '燃血 6 点：获得 18 点护体罡气、8 层【剑罡反击】与 1 点真元。消耗。',
    effect: { selfHpCost: 6, block: 18, counterAura: 8, gainQi: 1 },
    upgradeName: '逆天燃血咒+', upgradeDescription: '燃血 4 点：获 24 点罡气、12 层反击与 2 真元。消耗。', upgradeEffect: { selfHpCost: 4, block: 24, counterAura: 12, gainQi: 2 },
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
    description: '造成 7 点火伤，并施加 3 层【丹毒】。',
    effect: { damage: 7, poison: 3 },
    upgradeName: '丹火引+', upgradeDescription: '造成 10 点火伤，施加 5 层【丹毒】。', upgradeEffect: { damage: 10, poison: 5 },
  },
  'al-detonate': {
    id: 'al-detonate', name: '红莲爆毒', lineage: 'alchemy', type: 'skill', rarity: 'common', element: 'fire', cost: 1,
    description: '立即引爆敌方身上的【丹毒】结算 1 次无视护盾毒伤。',
    effect: { detonatePoison: 1 },
    upgradeName: '红莲爆毒+', upgradeDescription: '先施加 3 层【丹毒】，再立即引爆结算 1 次毒伤。', upgradeEffect: { poison: 3, detonatePoison: 1 },
  },
  'al-rejuvenate': {
    id: 'al-rejuvenate', name: '青帝长生露', lineage: 'alchemy', type: 'skill', rarity: 'rare', element: 'water', cost: 1,
    exhaust: true,
    description: '恢复 12 点气血，获得 8 点护体罡气，抽 1 张牌。消耗。',
    effect: { heal: 12, block: 8, draw: 1 },
    upgradeName: '青帝长生露+', upgradeDescription: '恢复 18 点气血，获得 10 点罡气，抽 2 张牌。消耗。', upgradeEffect: { heal: 18, block: 10, draw: 2 },
  },
  'al-miasma-array': {
    id: 'al-miasma-array', name: '万毒瘴域', lineage: 'alchemy', type: 'array', rarity: 'rare', element: 'wood', cost: 2,
    description: '布下阵盘：每回合末自动施加 5 层【丹毒】。',
    effect: { arrayPower: { id: 'arr-miasma', name: '万毒瘴域', poisonPerTurn: 5 } },
    upgradeName: '万毒瘴域+', upgradeCost: 1, upgradeDescription: '布下阵盘：每回合末自动施加 6 层【丹毒】。', upgradeEffect: { arrayPower: { id: 'arr-miasma', name: '万毒瘴域+', poisonPerTurn: 6 } },
  },
  'al-double-catalyst': {
    id: 'al-double-catalyst', name: '焚炉九转', lineage: 'alchemy', type: 'skill', rarity: 'mythic', element: 'fire', cost: 2,
    exhaust: true,
    description: '施加 8 层【丹毒】，随后连续引爆【丹毒】结算 2 次！消耗。',
    effect: { poison: 8, detonatePoison: 2 },
    upgradeName: '焚炉九转+', upgradeCost: 1, upgradeDescription: '施加 10 层【丹毒】，连续引爆结算 2 次！消耗。', upgradeEffect: { poison: 10, detonatePoison: 2 },
  },
  'al-longevity-pill': {
    id: 'al-longevity-pill', name: '凝丹固元诀', lineage: 'alchemy', type: 'skill', rarity: 'rare', element: 'wood', cost: 1,
    exhaust: true,
    description: '恢复 10 点气血，永久提升 3 点气血上限。消耗。',
    effect: { heal: 10, gainMaxHp: 3 },
    upgradeName: '凝丹固元诀+', upgradeDescription: '恢复 14 点气血，永久提升 5 点气血上限。消耗。', upgradeEffect: { heal: 14, gainMaxHp: 5 },
  },
  'al-fire-pellet': {
    id: 'al-fire-pellet', name: '赤炎爆丸', lineage: 'alchemy', type: 'attack', rarity: 'common', element: 'fire', cost: 0,
    exhaust: true, tokenOnly: true,
    description: '衍生灵丸：造成 6 点火伤，引爆 1 次【丹毒】。消耗。',
    effect: { damage: 6, detonatePoison: 1 },
    upgradeName: '赤炎爆丸+', upgradeDescription: '造成 9 点火伤，引爆 1 次【丹毒】。消耗。', upgradeEffect: { damage: 9, detonatePoison: 1 },
  },
  'al-wood-pellet': {
    id: 'al-wood-pellet', name: '青木毒丸', lineage: 'alchemy', type: 'skill', rarity: 'common', element: 'wood', cost: 0,
    exhaust: true, tokenOnly: true,
    description: '衍生灵丸：施加 4 层【丹毒】并恢复 3 点气血。消耗。',
    effect: { poison: 4, heal: 3 },
    upgradeName: '青木毒丸+', upgradeDescription: '施加 6 层【丹毒】并恢复 5 点气血。消耗。', upgradeEffect: { poison: 6, heal: 5 },
  },
  'al-pill-rain': {
    id: 'al-pill-rain', name: '乾坤搓丸手', lineage: 'alchemy', type: 'skill', rarity: 'common', element: 'wood', cost: 1,
    description: '现场炼制 0 费【青木毒丸】与【赤炎爆丸】各 1 枚入手牌（直接凑齐木火相生）。',
    effect: { addCardsToHand: ['al-wood-pellet', 'al-fire-pellet'] },
    upgradeName: '乾坤搓丸手+', upgradeCost: 0, upgradeDescription: '0 费炼制【青木毒丸】与【赤炎爆丸】各 1 枚入手牌！', upgradeEffect: { addCardsToHand: ['al-wood-pellet', 'al-fire-pellet'] },
  },
  'al-plague-wind': {
    id: 'al-plague-wind', name: '腐骨春风化雨', lineage: 'alchemy', type: 'defense', rarity: 'rare', element: 'wood', cost: 1,
    description: '获得 11 点护体罡气，施加 6 层【丹毒】与 1 层【虚弱】。',
    effect: { block: 11, poison: 6, weak: 1 },
    upgradeName: '腐骨春风化雨+', upgradeDescription: '获得 15 点罡气，施加 9 层【丹毒】与 2 层【虚弱】。', upgradeEffect: { block: 15, poison: 9, weak: 2 },
  },
  'al-x-furnace': {
    id: 'al-x-furnace', name: '神农焚天炉', lineage: 'alchemy', type: 'skill', rarity: 'mythic', element: 'fire', cost: 0,
    exhaust: true,
    description: 'X费：先施加 6 层【丹毒】，再连续引爆丹毒 X+1 次，每次恢复 4 点气血！消耗。',
    effect: { xCost: true, poison: 6, xPoisonDetonate: true, heal: 4 },
    upgradeName: '神农焚天炉+', upgradeDescription: 'X费：先施加 10 层【丹毒】，连续引爆 X+1 次并每次回 6 血！消耗。', upgradeEffect: { xCost: true, poison: 10, xPoisonDetonate: true, heal: 6 },
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
    description: '获得 10 点护体罡气，本回合护盾保留不清空。',
    effect: { block: 10, retainBlock: true },
    upgradeName: '玄水明镜+', upgradeDescription: '获得 14 点护体罡气，本回合护盾保留不清空。', upgradeEffect: { block: 14, retainBlock: true },
  },
  'ar-shield-slam': {
    id: 'ar-shield-slam', name: '镇岳盾反', lineage: 'array', type: 'attack', rarity: 'common', element: 'earth', cost: 1,
    description: '以盾代攻：造成等同于你当前【护体罡气】数值的伤害。',
    effect: { damagePerBlock: 1.0 },
    upgradeName: '镇岳盾反+', upgradeCost: 0, upgradeDescription: '造成等同于当前护体罡气 120% 的伤害。', upgradeEffect: { damagePerBlock: 1.2 },
  },
  'ar-nine-palace': {
    id: 'ar-nine-palace', name: '九宫诛仙大阵', lineage: 'array', type: 'array', rarity: 'mythic', element: 'metal', cost: 2,
    description: '布下阵盘：每回合末造成 12 点伤害并获得 10 点罡气。',
    effect: { arrayPower: { id: 'arr-nine-palace', name: '九宫诛仙大阵', damagePerTurn: 12, blockPerTurn: 10 } },
    upgradeName: '九宫诛仙大阵+', upgradeDescription: '每回合末造成 16 点伤害并获得 14 点罡气。', upgradeEffect: { arrayPower: { id: 'arr-nine-palace', name: '九宫诛仙大阵+', damagePerTurn: 16, blockPerTurn: 14 } },
  },
  'ar-mountain-seal': {
    id: 'ar-mountain-seal', name: '不动明王印', lineage: 'array', type: 'defense', rarity: 'rare', element: 'earth', cost: 2,
    description: '获得 22 点护体罡气，本回合护盾不清空，施加 2 层【虚弱】。',
    effect: { block: 22, retainBlock: true, weak: 2 },
    upgradeName: '不动明王印+', upgradeDescription: '获得 28 点护体罡气，护盾不清空，施加 3 层【虚弱】。', upgradeEffect: { block: 28, retainBlock: true, weak: 3 },
  },
  'ar-frost-tide': {
    id: 'ar-frost-tide', name: '寒潮锁灵', lineage: 'array', type: 'skill', rarity: 'common', element: 'water', cost: 1,
    description: '获得 7 点护体罡气，施加 2 层【虚弱】，抽 1 张牌。',
    effect: { block: 7, weak: 2, draw: 1 },
    upgradeName: '寒潮锁灵+', upgradeDescription: '获得 10 点罡气，施加 2 层【虚弱】，抽 2 张牌。', upgradeEffect: { block: 10, weak: 2, draw: 2 },
  },
  'ar-thunder-tower': {
    id: 'ar-thunder-tower', name: '紫电锁妖阵', lineage: 'array', type: 'array', rarity: 'common', element: 'thunder', cost: 1,
    description: '布下阵盘：每回合末造成 7 点伤害并获 3 点罡气。',
    effect: { arrayPower: { id: 'arr-thunder-tower', name: '紫电锁妖阵', damagePerTurn: 7, blockPerTurn: 3 } },
    upgradeName: '紫电锁妖阵+', upgradeDescription: '每回合末造成 10 点伤害并获 5 点罡气。', upgradeEffect: { arrayPower: { id: 'arr-thunder-tower', name: '紫电锁妖阵+', damagePerTurn: 10, blockPerTurn: 5 } },
  },
  'ar-venom-swamp': {
    id: 'ar-venom-swamp', name: '玄冥覆水阵', lineage: 'array', type: 'array', rarity: 'rare', element: 'water', cost: 1,
    description: '布下阵盘：每回合末获得 8 点罡气并施加 4 层【丹毒】。',
    effect: { arrayPower: { id: 'arr-venom-swamp', name: '玄冥覆水阵', blockPerTurn: 8, poisonPerTurn: 4 } },
    upgradeName: '玄冥覆水阵+', upgradeDescription: '每回合末获得 11 点罡气并施加 6 层【丹毒】。', upgradeEffect: { arrayPower: { id: 'arr-venom-swamp', name: '玄冥覆水阵+', blockPerTurn: 11, poisonPerTurn: 6 } },
  },
  'ar-detonate-arrays': {
    id: 'ar-detonate-arrays', name: '乾坤万阵爆', lineage: 'array', type: 'attack', rarity: 'mythic', element: 'fire', cost: 1,
    description: '引爆场上所有【阵盘】：基础 10 伤，每引爆 1 座额外轰出 26 点穿甲伤并回 1 真元！',
    effect: { damage: 10, pierce: true, detonateAllArrays: 26 },
    upgradeName: '乾坤万阵爆+', upgradeDescription: '基础 14 伤，每引爆 1 座额外轰出 34 点穿甲伤并回 1 真元！', upgradeEffect: { damage: 14, pierce: true, detonateAllArrays: 34 },
  },
  'ar-x-fortress': {
    id: 'ar-x-fortress', name: '太岳金城汤池', lineage: 'array', type: 'defense', rarity: 'rare', element: 'earth', cost: 0,
    description: 'X费：获得 (X+1)×10 点护体罡气，且本回合护盾保留不清空。',
    effect: { xCost: true, block: 10, retainBlock: true },
    upgradeName: '太岳金城汤池+', upgradeDescription: 'X费：获得 (X+1)×14 点护体罡气并保留。', upgradeEffect: { xCost: true, block: 14, retainBlock: true },
  },

  // ==================== 五行通用奇术 ====================
  'nu-gather-qi': {
    id: 'nu-gather-qi', name: '小周天吐纳', lineage: 'neutral', type: 'skill', rarity: 'common', element: 'water', cost: 0,
    exhaust: true,
    description: '获得 1 点真元并抽 1 张牌。消耗。',
    effect: { gainQi: 1, draw: 1 },
    upgradeName: '小周天吐纳+', upgradeDescription: '获得 2 点真元并抽 1 张牌。消耗。', upgradeEffect: { gainQi: 2, draw: 1 },
  },
  'nu-five-wheel': {
    id: 'nu-five-wheel', name: '五行轮转诀', lineage: 'neutral', type: 'skill', rarity: 'rare', element: 'wood', cost: 1,
    description: '抽 2 张牌，获得 1 点真元，获得 6 点护体罡气。',
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
    description: '造成 10 点火伤，并施加 2 层【丹毒】。',
    effect: { damage: 10, poison: 2 },
    upgradeName: '离火朱雀诀+', upgradeDescription: '造成 14 点火伤并施加 3 层【丹毒】。', upgradeEffect: { damage: 14, poison: 3 },
  },
  'nu-golden-bell': {
    id: 'nu-golden-bell', name: '金刚伏魔钟', lineage: 'neutral', type: 'defense', rarity: 'common', element: 'metal', cost: 1,
    description: '获得 11 点护体罡气。',
    effect: { block: 11 },
    upgradeName: '金刚伏魔钟+', upgradeDescription: '获得 15 点护体罡气。', upgradeEffect: { damage: 0, block: 15 },
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
    description: '抽 3 张牌，恢复 6 点气血。消耗。',
    effect: { draw: 3, heal: 6 },
    upgradeName: '朝闻道+', upgradeCost: 0, upgradeDescription: '0 费抽 3 张牌，恢复 9 点气血。消耗。', upgradeEffect: { draw: 3, heal: 9 },
  },
  'nu-chaos-seal': {
    id: 'nu-chaos-seal', name: '混元一气斩', lineage: 'neutral', type: 'attack', rarity: 'mythic', element: 'fire', cost: 2,
    description: '造成 20 点伤害，获得 12 点罡气，抽 2 张牌，注入【金印】。',
    effect: { damage: 20, block: 12, draw: 2, extraSeal: 'metal' },
    upgradeName: '混元一气斩+', upgradeDescription: '造成 26 点伤害，获 16 点罡气，抽 2 张牌，注入【金印】。', upgradeEffect: { damage: 26, block: 16, draw: 2, extraSeal: 'metal' },
  },
  'nu-spirit-overflow': {
    id: 'nu-spirit-overflow', name: '周天聚元功', lineage: 'neutral', type: 'skill', rarity: 'rare', element: 'metal', cost: 0,
    exhaust: true,
    description: '获得 2 点真元，注入 1 枚【水印】。消耗。',
    effect: { gainQi: 2, extraSeal: 'water' },
    upgradeName: '周天聚元功+', upgradeDescription: '获得 3 点真元，注入【水印】。消耗。', upgradeEffect: { gainQi: 3, extraSeal: 'water' },
  },
  'nu-thorn-cloak': {
    id: 'nu-thorn-cloak', name: '玄金反震罡', lineage: 'neutral', type: 'defense', rarity: 'common', element: 'metal', cost: 1,
    description: '获得 9 点护体罡气与 4 层【剑罡反击】。',
    effect: { block: 9, counterAura: 4 },
    upgradeName: '玄金反震罡+', upgradeDescription: '获得 12 点护体罡气与 7 层【剑罡反击】。', upgradeEffect: { block: 12, counterAura: 7 },
  },
  'nu-four-swords-formation': {
    id: 'nu-four-swords-formation', name: '太古诛仙四剑阵', lineage: 'neutral', type: 'forbidden', rarity: 'mythic', element: 'thunder', cost: 2,
    exhaust: true, unlockAchievement: 'ach-one-strike-80',
    description: '【成就暗金卡】燃血 8 点：连斩 4 剑各 14 点穿甲伤，并布下诛仙剑阵！消耗。',
    effect: {
      selfHpCost: 8, damage: 14, hits: 4, pierce: true,
      arrayPower: { id: 'arr-zhuxian-four', name: '诛仙四剑阵', damagePerTurn: 14, blockPerTurn: 8 },
    },
    upgradeName: '太古诛仙四剑阵+', upgradeDescription: '燃血 5 点：连斩 4 剑各 18 点穿甲伤并布诛仙剑阵！消耗。',
    upgradeEffect: {
      selfHpCost: 5, damage: 18, hits: 4, pierce: true,
      arrayPower: { id: 'arr-zhuxian-four', name: '诛仙四剑阵+', damagePerTurn: 18, blockPerTurn: 10 },
    },
  },

  // ==================== 凡人灵界/仙界名场面绝世神通 ====================
  'sw-dageng-sword-array': {
    id: 'sw-dageng-sword-array', name: '青元 · 大庚剑阵', lineage: 'sword', type: 'array', rarity: 'mythic', element: 'metal', cost: 2,
    description: '获 3 层【剑意】，连斩 3 道 9 点庚金剑芒，并布下永续【大庚剑阵】（每回合 12 伤 + 6 盾）。',
    effect: {
      swordIntent: 3, damage: 9, hits: 3,
      arrayPower: { id: 'arr-dageng-sword', name: '大庚剑阵', damagePerTurn: 12, blockPerTurn: 6 },
    },
    upgradeName: '青元 · 大庚剑阵+',
    upgradeDescription: '获 4 层【剑意】，连斩 3 道 12 点庚金剑芒，并布下【大庚剑阵+】（每回合 16 伤 + 8 盾）。',
    upgradeEffect: {
      swordIntent: 4, damage: 12, hits: 3,
      arrayPower: { id: 'arr-dageng-sword', name: '大庚剑阵+', damagePerTurn: 16, blockPerTurn: 8 },
    },
  },
  'al-gold-devour-swarm': {
    id: 'al-gold-devour-swarm', name: '噬金虫海催熟', lineage: 'alchemy', type: 'skill', rarity: 'mythic', element: 'wood', cost: 2,
    exhaust: true,
    description: '放出成熟体噬金虫群：造成 2 次 11 点穿甲噬咬，施加 10 层【丹毒】并获 14 点护体罡气。消耗。',
    effect: { damage: 11, hits: 2, pierce: true, poison: 10, block: 14 },
    upgradeName: '噬金虫王催熟+',
    upgradeDescription: '造成 2 次 14 点穿甲噬咬，施加 14 层【丹毒】并获 18 点护体罡气。消耗。',
    upgradeEffect: { damage: 14, hits: 2, pierce: true, poison: 14, block: 18 },
  },
  'ar-five-color-light': {
    id: 'ar-five-color-light', name: '五色灭绝神光', lineage: 'array', type: 'attack', rarity: 'mythic', element: 'water', cost: 2,
    description: '获得 18 点【护体罡气】（本回合不清空），并轰出等同当前护体罡气 100% 的穿甲五色神光！',
    effect: { block: 18, retainBlock: true, damagePerBlock: 1, pierce: true },
    upgradeName: '大五行灭绝神光+',
    upgradeDescription: '获得 24 点【护体罡气】（本回合不清空），并轰出等同当前罡气 120% 的穿甲神光！',
    upgradeEffect: { block: 24, retainBlock: true, damagePerBlock: 1.2, pierce: true },
  },
  'dm-xuantian-slash': {
    id: 'dm-xuantian-slash', name: '玄天斩灵血剑', lineage: 'demon', type: 'forbidden', rarity: 'mythic', element: 'sha', cost: 1,
    exhaust: true,
    description: '混沌万灵榜第一：燃血 8 点，造成 38 点穿甲斩击；若斩杀强敌，永久 +4 最大气血上限！消耗。',
    effect: { selfHpCost: 8, damage: 38, pierce: true, gainMaxHp: 4 },
    upgradeName: '玄天斩灵仙剑+',
    upgradeDescription: '燃血 6 点，造成 48 点穿甲斩击；若斩杀强敌，永久 +6 最大气血上限！消耗。',
    upgradeEffect: { selfHpCost: 6, damage: 48, pierce: true, gainMaxHp: 6 },
  },
  'nu-time-lantern': {
    id: 'nu-time-lantern', name: '岁月神灯 · 光阴斩', lineage: 'neutral', type: 'skill', rarity: 'mythic', element: 'fire', cost: 1,
    exhaust: true,
    description: '燃起岁月法则之火：造成 22 点穿甲火伤，施加 2 层【破绽】与 2 层【虚弱】，抽 2 牌并回 1 真元！消耗。',
    effect: { damage: 22, pierce: true, vulnerable: 2, weak: 2, draw: 2, gainQi: 1 },
    upgradeName: '岁月神灯 · 光阴斩+',
    upgradeDescription: '造成 30 点穿甲火伤，施加 3 层【破绽】与 3 层【虚弱】，抽 2 牌并回 1 真元！消耗。',
    upgradeEffect: { damage: 30, pierce: true, vulnerable: 3, weak: 3, draw: 2, gainQi: 1 },
  },
  'nu-samsara-fist': {
    id: 'nu-samsara-fist', name: '六道轮回拳', lineage: 'neutral', type: 'attack', rarity: 'rare', element: 'earth', cost: 2,
    description: '获得 12 点护体罡气，轰出 2 拳各 11 点伤害，恢复 5 点气血。',
    effect: { block: 12, damage: 11, hits: 2, heal: 5 },
    upgradeName: '六道轮回真拳+',
    upgradeDescription: '获得 16 点护体罡气，轰出 2 拳各 14 点伤害，恢复 8 点气血。',
    upgradeEffect: { block: 16, damage: 14, hits: 2, heal: 8 },
  },

  // ==================== 心魔与道伤 ====================
  'curse-whisper': {
    id: 'curse-whisper', name: '心魔低语', lineage: 'curse', type: 'curse', rarity: 'curse', element: 'none', cost: 1,
    ethereal: true, exhaust: true,
    description: '虚无。打出可耗 1 真元驱散，否则回合末自动消失但白占 1 张抽牌位。',
    effect: {},
  },
  'curse-flaw': {
    id: 'curse-flaw', name: '道伤淤血', lineage: 'curse', type: 'curse', rarity: 'curse', element: 'none', cost: 2,
    exhaust: true,
    description: '暗疾隐患。需耗 2 真元才能在本场化开，或去洞府斩念根除。',
    effect: {},
  },
};

export function getUnlockedRewardCardPool(unlockedAchievements: string[] = []): CardDef[] {
  return Object.values(CARDS).filter(
    (c) =>
      c.rarity !== 'starter' &&
      c.rarity !== 'curse' &&
      !c.tokenOnly &&
      (!c.unlockAchievement || unlockedAchievements.includes(c.unlockAchievement)),
  );
}
