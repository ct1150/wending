export type ElementTag = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'thunder' | 'sha' | 'none';
export type SealType = Exclude<ElementTag, 'none'>;

export type LineageId = 'sword' | 'demon' | 'alchemy' | 'array';
export type CardType = 'attack' | 'defense' | 'skill' | 'array' | 'forbidden' | 'curse';
export type CardRarity = 'starter' | 'common' | 'rare' | 'mythic' | 'curse';

export type EnchantId =
  | 'swift'
  | 'double-cast'
  | 'leech-life'
  | 'toxic-edge'
  | 'innate'
  | 'spirit-surge'
  | 'shield-echo'
  | 'thunder-mark';

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
  pierce?: boolean;
  block?: number;
  draw?: number;
  gainQi?: number;
  heal?: number;
  selfHpCost?: number;
  lifeCost?: number;
  gainLifespan?: number;
  poison?: number;
  detonatePoison?: number;
  vulnerable?: number;
  weak?: number;
  swordIntent?: number;
  consumeSwordIntent?: boolean;
  damagePerSwordIntent?: number;
  damagePerBlock?: number;
  arrayPower?: {
    id: string;
    name: string;
    damagePerTurn?: number;
    blockPerTurn?: number;
    poisonPerTurn?: number;
  };
  retainBlock?: boolean;
  addCardsToHand?: string[];
  addCurseToDiscard?: string;
  exhaustCursesInHand?: boolean;
  damagePerExhaustedCurse?: number;
  gainFoundation?: number;
  extraSeal?: SealType;
  // v9.0 进阶算子
  xCost?: boolean;               // 倾泻当前全部真元 X，按 X 放大连击/引爆/护盾
  xHitsBase?: number;            // X 费攻击连段 = X + xHitsBase
  xPoisonDetonate?: boolean;     // X 费连续引爆 X 次丹毒并回血
  counterAura?: number;          // 剑罡反击：受击时回敬穿甲伤
  exhaustRandomHand?: number;    // 献祭：随机消耗手牌中 N 张牌
  damagePerExhausted?: number;   // 本场每有一张已消耗牌额外增伤
  detonateAllArrays?: number;    // 引爆场上全部阵盘，每座造成 N 伤害并回 1 真元
}

export interface CardDef {
  id: string;
  name: string;
  lineage: LineageId | 'neutral' | 'curse';
  type: CardType;
  rarity: CardRarity;
  element: ElementTag;
  cost: number; // xCost 卡牌 cost 设为 0 (UI 显示为 X)
  exhaust?: boolean;
  ethereal?: boolean;
  innate?: boolean;
  tokenOnly?: boolean; // 衍生专用牌（不进常规掉落池）
  unlockAchievement?: string;
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
  unlockCost: number;
}

export type SecondaryMethodId =
  | 'method-venom-sword'
  | 'method-blood-blade'
  | 'method-thunder-array'
  | 'method-thorns-poison'
  | 'method-demon-furnace';

export interface SecondaryMethodDef {
  id: SecondaryMethodId;
  name: string;
  unlockLineage: LineageId;
  badge: string;
  description: string;
}

export interface ConsumableDef {
  id: string;
  name: string;
  kind: 'pill' | 'talisman';
  rarity: 'common' | 'rare';
  icon: string;
  price: number;
  passiveRevive?: boolean; // 替死木偶符：致死自动触发
  description: string;
}

export interface TreasureDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'mythic';
  lineage?: LineageId | 'neutral';
  maxCharge: number;
  description: string;
  effect: CardEffect;
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'mythic' | 'law';
  unlockAchievement?: string;
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
    | 'array-echo'
    | 'counter-start'
    | 'exhaust-qi'
    | 'pill-master'
    | 'dying-fury';
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

export type EnemyTraitId =
  | 'anti-skill'
  | 'stone-shell'
  | 'thorns'
  | 'sword-guard'
  | 'seal-lock'
  | 'phoenix-rebirth';

export interface EnemyTrait {
  id: EnemyTraitId;
  name: string;
  description: string;
  value: number;
}

export interface EnemyPhase2 {
  title: string;
  announcement: string;
  shieldGain: number;
  strengthGain: number;
  intents: EnemyIntent[];
}

export interface EnemyDef {
  id: string;
  name: string;
  title: string;
  act: 1 | 2 | 3 | 4;
  tier: 'normal' | 'elite' | 'boss' | 'tribulation';
  maxHp: number;
  tribulationWaves?: number;
  trait?: EnemyTrait;
  phase2?: EnemyPhase2;
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
  trait?: EnemyTrait;
  phase2Triggered?: boolean;
  rebirthUsed?: boolean;
  firstHitTakenThisTurn?: boolean;
  tribulationWave?: number;
  tribulationMaxWaves?: number;
}

export type MapNodeType =
  | 'battle'
  | 'elite'
  | 'fury-elite'
  | 'event'
  | 'abode'
  | 'shop'
  | 'auction'
  | 'remnant'
  | 'boss';

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
  counterAura: number;
  damageBoostPct: number;      // 暴血燃魂丹等本回合增伤百分比
  nextResonanceDouble: boolean;// 五行聚印丹下次共鸣翻倍
  enemyDmgWeakenPct: number;   // 玄冰敛息符本回合减伤百分比
  maxSealSlots: number;        // 默认 3，受封灵魔瘴词条降为 2
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
  phase2Banner: string | null;
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
    addConsumable?: boolean;
    offerSecondaryMethod?: boolean;
    removeRandomCard?: boolean;
    gainDaoToken?: boolean;
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
  consumableReward?: ConsumableDef;
  methodChoices?: SecondaryMethodDef[];
  pickedCard: boolean;
  pickedRelic: boolean;
  pickedTreasure: boolean;
  pickedMaterial: boolean;
  pickedConsumable?: boolean;
  pickedMethod?: boolean;
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
  consumables: { def: ConsumableDef; price: number; sold: boolean }[];
  purgePrice: number;
  purged: boolean;
  elixirPrice: number;
  elixirBought: boolean;
}

export interface AuctionLot {
  id: string;
  name: string;
  description: string;
  price: number;
  kind: 'card' | 'relic' | 'consumable' | 'lifespan';
  refId: string;
  claimed: boolean;
}

export interface BlessingOption {
  id: 'gold' | 'lifespan-foundation' | 'purge-two' | 'gamble-relic' | 'mythic-treasure';
  title: string;
  costText: string;
  rewardText: string;
}

export interface DailyMutatorDef {
  id: string;
  name: string;
  description: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  conditionText: string;
  unlockText: string;
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
  secondaryMethod: SecondaryMethodId | null;
  rootId: string;
  act: 1 | 2 | 3 | 4;
  realm: RealmId;
  age: number;
  maxLifespan: number;
  hp: number;
  maxHp: number;
  baseQi: number;
  gold: number;
  foundation: number;
  daoTokens: number;
  deck: CardInstance[];
  treasures: string[];
  relics: string[];
  materials: EnchantId[];
  consumables: string[]; // 至多 3 格乾坤丹符袋
  blessingOptions?: BlessingOption[];
  isDailyChallenge?: boolean;
  dailyDate?: string;
  mutators?: string[];
  map: MapNode[];
  currentNodeId: string | null;
  phase:
    | 'blessing'
    | 'map'
    | 'combat'
    | 'reward'
    | 'event'
    | 'abode'
    | 'shop'
    | 'auction'
    | 'remnant'
    | 'breakthrough'
    | 'gameover'
    | 'victory';
  combat: CombatState | null;
  reward: RewardState | null;
  activeEvent: EncounterDef | null;
  eventResultText: string | null;
  shop: ShopStock | null;
  auction: { lots: AuctionLot[]; settled: boolean } | null;
  abodeUsed: boolean;
  stats: {
    battlesWon: number;
    elitesWon: number;
    bossesWon: number;
    cardsPlayed: number;
    maxCardsInSingleTurn: number;
    maxSingleHit: number;
    maxPoisonApplied: number;
    resonancesTriggered: number;
    lifeBurned: number;
    tribulationsSlain: number;
  };
  newlyUnlockedAchievements?: string[];
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
  achievements: string[];
  discoveredCards: string[];
  discoveredRelics: string[];
  discoveredEnemies: string[];
  dailyBestScores: Record<string, number>;
  maxAscensionUnlocked: number;
  bestActReached: number;
  victories: number;
  trueVictories: number;
  rerollCharges: number;
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
