export type ElementTag = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'thunder' | 'sha' | 'none';
export type SealType = Exclude<ElementTag, 'none'>;

export type LineageId = 'sword' | 'demon' | 'alchemy' | 'array';
export type CardType = 'attack' | 'defense' | 'skill' | 'array' | 'forbidden' | 'curse';
export type CardRarity = 'starter' | 'common' | 'rare' | 'mythic' | 'curse';

export type EnchantId =
  | 'swift'        // 耗灵-1 (最低0)
  | 'double-cast'  // 连击：效果额外触发一次(数值60%)
  | 'leech-life'   // 斩杀回4年寿元，命中回4血
  | 'toxic-edge'   // 附带4层丹毒
  | 'innate'       // 固有：首回合必上手，抽1牌
  | 'spirit-surge' // 打出返还1点真元
  | 'shield-echo'  // 额外获得8点护体罡气
  | 'thunder-mark';// 附加1枚雷印与6点穿甲雷伤

export interface EnchantDef {
  id: EnchantId;
  name: string;
  materialName: string;
  description: string;
  badge: string;
}

export interface CardEffect {
  damage?: number;
  hits?: number;
  pierce?: boolean;           // 无视护盾
  block?: number;
  draw?: number;
  gainQi?: number;
  heal?: number;
  selfHpCost?: number;        // 魔修卖血
  lifeCost?: number;          // 燃寿禁术
  gainLifespan?: number;      // 噬魂/延寿
  poison?: number;            // 丹毒层数
  detonatePoison?: number;    // 引爆丹毒倍率 (如 1 = 立即结算1次, 2 = 2次)
  vulnerable?: number;        // 破绽(易伤)
  weak?: number;              // 虚弱
  swordIntent?: number;       // 剑意层数
  consumeSwordIntent?: boolean; // 消耗全部剑意每层增伤
  damagePerSwordIntent?: number;
  damagePerBlock?: number;    // 以盾代攻倍率
  arrayPower?: {
    id: string;
    name: string;
    damagePerTurn?: number;
    blockPerTurn?: number;
    poisonPerTurn?: number;
  };
  retainBlock?: boolean;      // 本回合护体罡气不清空
  addCardsToHand?: string[];  // 衍生牌入手法(如 0费御剑术)
  addCurseToDiscard?: string; // 塞入心魔牌
  exhaustCursesInHand?: boolean; // 吞噬手牌心魔转化为伤害
  damagePerExhaustedCurse?: number;
  gainFoundation?: number;    // 战后/即时道基纯度
  extraSeal?: SealType;       // 额外附加一枚灵印
}

export interface CardDef {
  id: string;
  name: string;
  lineage: LineageId | 'neutral' | 'curse';
  type: CardType;
  rarity: CardRarity;
  element: ElementTag;
  cost: number;
  exhaust?: boolean;          // 消耗：打出后本场移除
  ethereal?: boolean;         // 虚无：回合末未打出移除
  innate?: boolean;
  description: string;
  effect: CardEffect;
  upgradeName?: string;
  upgradeCost?: number;
  upgradeDescription?: string;
  upgradeEffect?: Partial<CardEffect>;
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
  enchant?: EnchantId;
}

export interface RootDef {
  id: string;
  name: string;
  grade: '天灵根' | '异灵根' | '真灵根' | '伪灵根' | '魔胎';
  elements: SealType[];
  initialSeal: SealType;
  description: string;
  passiveText: string;
  bonusMaxHp?: number;
  bonusLifespan?: number;
  bonusQi?: number;
  mixedFiveBonus?: boolean;
}

export interface LineageDef {
  id: LineageId;
  name: string;
  sect: string;
  title: string;
  description: string;
  primaryElements: SealType[];
  baseHp: number;
  baseLifespan: number;
  starterMethodName: string;
  starterMethodDesc: string;
  starterTreasureId: string;
  starterDeck: string[];
  unlockCost: number; // 0 = 初始解锁
}

export interface TreasureDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'mythic';
  lineage?: LineageId | 'neutral';
  maxCharge: number; // 打出几张牌充满
  description: string;
  effect: CardEffect;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'mythic' | 'law'; // law = 天道破境法则
  description: string;
  hook:
    | 'start-qi'
    | 'start-block'
    | 'start-draw'
    | 'sword-cascade'
    | 'poison-boost'
    | 'life-leech-kill'
    | 'abode-discount'
    | 'resonance-amp'
    | 'block-retain-half'
    | 'curse-power'
    | 'gold-magnet'
    | 'tribulation-ward'
    | 'heal-after-battle'
    | 'foundation-boost'
    | 'array-echo';
  value: number;
}

export type EnemyIntentKind = 'attack' | 'multi-attack' | 'defend' | 'buff' | 'debuff' | 'tribulation-bolt';

export interface EnemyIntent {
  kind: EnemyIntentKind;
  label: string;
  damage?: number;
  hits?: number;
  block?: number;
  poison?: number;
  vulnerable?: number;
  weak?: number;
  strengthGain?: number;
  addCurse?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  tier: 'normal' | 'elite' | 'boss' | 'tribulation';
  maxHp: number;
  tribulationWaves?: number; // 若为渡劫战，撑过 N 回合雷劫亦可破境
  intents: EnemyIntent[];
  artStyle: 'beast' | 'cultivator' | 'demon' | 'thunder' | 'celestial';
}

export interface EnemyInstance {
  uid: string;
  defId: string;
  name: string;
  title: string;
  tier: EnemyDef['tier'];
  artStyle: EnemyDef['artStyle'];
  hp: number;
  maxHp: number;
  block: number;
  poison: number;
  vulnerable: number;
  weak: number;
  strength: number;
  intentIdx: number;
  tribulationWave?: number;
  tribulationMaxWaves?: number;
}

export type MapNodeType = 'battle' | 'elite' | 'event' | 'abode' | 'shop' | 'remnant' | 'boss';

export interface MapNode {
  id: string;
  act: 1 | 2 | 3 | 4;
  row: number;
  col: number;
  type: MapNodeType;
  label: string;
  ageCost: number;
  nextIds: string[];
  visited: boolean;
}

export interface ActiveArray {
  id: string;
  name: string;
  damagePerTurn: number;
  blockPerTurn: number;
  poisonPerTurn: number;
}

export interface ResonanceEvent {
  name: string;
  detail: string;
  seals: SealType[];
}

export interface CombatState {
  enemy: EnemyInstance;
  nodeType: MapNodeType;
  turn: number;
  qi: number;
  maxQi: number;
  block: number;
  retainBlockThisTurn: boolean;
  swordIntent: number;
  vulnerable: number;
  weak: number;
  seals: SealType[];
  arrays: ActiveArray[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  treasureCharges: Record<string, number>;
  cardsPlayedThisTurn: number;
  swordCardsPlayedThisTurn: number;
  lifeSpentInCombat: number;
  lastResonance: ResonanceEvent | null;
  combatLog: string[];
  outcome: 'ongoing' | 'victory' | 'tribulation-survived' | 'defeat';
  defeatCause?: 'hp' | 'lifespan';
}

export interface EncounterChoice {
  id: string;
  label: string;
  detail: string;
  ageCost?: number;
  goldCost?: number;
  hpCost?: number;
  rewardText: string;
  effect: {
    gold?: number;
    hp?: number;
    maxHp?: number;
    lifespan?: number;
    foundation?: number;
    addRandomCard?: CardRarity;
    addSpecificCard?: string;
    addCurse?: string;
    addRelic?: boolean;
    addMaterial?: EnchantId;
    removeRandomCard?: boolean;
    gainDaoToken?: boolean; // 集齐三界道果信物开启隐藏第四卷
  };
}

export interface EncounterDef {
  id: string;
  title: string;
  acts: number[];
  prose: string;
  choices: EncounterChoice[];
}

export type RealmId = 'qi' | 'foundation' | 'core' | 'nascent' | 'ascended';
export type BreakthroughGrade = 'mortal' | 'earth' | 'heaven';

export interface RewardState {
  gold: number;
  foundation: number;
  cardChoices: CardDef[];
  relicReward?: RelicDef;
  treasureReward?: TreasureDef;
  materialReward?: EnchantDef;
  pickedCard: boolean;
  pickedRelic: boolean;
  pickedTreasure: boolean;
  pickedMaterial: boolean;
  isBossReward?: boolean;
  breakthroughGrade?: BreakthroughGrade;
  lawChoices?: RelicDef[];
  pickedLaw?: boolean;
  lifespanGained?: number;
  daoTokenGained?: boolean;
}

export interface ShopStock {
  cards: { def: CardDef; price: number; sold: boolean }[];
  relics: { def: RelicDef; price: number; sold: boolean }[];
  materials: { def: EnchantDef; price: number; sold: boolean }[];
  purgePrice: number;
  purged: boolean;
  elixirPrice: number;
  elixirBought: boolean;
}

export interface PastLifeRemnant {
  generation: number;
  name: string;
  lineage: LineageId;
  act: 1 | 2 | 3 | 4;
  deathCause: string;
  leftCard?: CardInstance;
  leftTreasureId?: string;
}

export interface RunState {
  version: number;
  seed: number;
  rngState: number;
  generation: number;
  ascension: number;
  name: string;
  lineage: LineageId;
  rootId: string;
  act: 1 | 2 | 3 | 4;
  realm: RealmId;
  age: number;
  maxLifespan: number;
  hp: number;
  maxHp: number;
  baseQi: number;
  gold: number;
  foundation: number;       // 本卷道基纯度 0~100
  daoTokens: number;        // 集齐 2 枚开启隐藏第四卷【上界问鼎】
  deck: CardInstance[];
  treasures: string[];      // 至多 2 件本命法宝
  relics: string[];
  materials: EnchantId[];   // 天材地宝（附魔材料）
  map: MapNode[];
  currentNodeId: string | null;
  phase:
    | 'map'
    | 'combat'
    | 'reward'
    | 'event'
    | 'abode'
    | 'shop'
    | 'remnant'
    | 'breakthrough'
    | 'gameover'
    | 'victory';
  combat: CombatState | null;
  reward: RewardState | null;
  activeEvent: EncounterDef | null;
  eventResultText: string | null;
  shop: ShopStock | null;
  abodeUsed: boolean;
  stats: {
    battlesWon: number;
    elitesWon: number;
    bossesWon: number;
    cardsPlayed: number;
    resonancesTriggered: number;
    lifeBurned: number;
  };
  deathCause?: string;
  endingTitle?: string;
  uidCounter: number;
}

export interface MetaSave {
  version: number;
  totalLives: number;
  karmaPoints: number;
  unlockedLineages: LineageId[];
  unlockedRelics: string[];
  maxAscensionUnlocked: number;
  bestActReached: number;
  victories: number;
  trueVictories: number;
  rerollCharges: number; // 开局可额外重掷灵根次数
  pastLifeRemnant: PastLifeRemnant | null;
  hallOfFame: {
    generation: number;
    name: string;
    lineage: LineageId;
    realm: RealmId;
    age: number;
    outcome: 'victory' | 'true-victory' | 'death';
    cause: string;
    karmaEarned: number;
  }[];
}
