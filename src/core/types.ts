export type ElementTag = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'thunder' | 'sha' | 'none';
export type SealType = Exclude<ElementTag, 'none'>;

export type ActNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type WorldId = 'mortal' | 'spirit' | 'immortal';
export type TrueSpiritId = 'spirit-phoenix' | 'spirit-peacock' | 'spirit-roc';
export type SupremeLawId = 'supreme-time' | 'supreme-space' | 'supreme-samsara';

export interface TrueSpiritDef {
  id: TrueSpiritId;
  name: string;
  badge: string;
  description: string;
}

export interface SupremeLawDef {
  id: SupremeLawId;
  name: string;
  badge: string;
  description: string;
}

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
  selfHpCost?: number;       // 燃血：消耗当前气血
  maxHpCost?: number;        // 禁术献祭：扣除最大气血上限
  gainMaxHp?: number;        // 夺元/驻颜：永久提升最大气血上限
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
  extraSeal?: SealType;
  xCost?: boolean;
  xHitsBase?: number;
  xPoisonDetonate?: boolean;
  counterAura?: number;
  exhaustRandomHand?: number;
  damagePerExhausted?: number;
  detonateAllArrays?: number;
}

export interface CardDef {
  id: string;
  name: string;
  lineage: LineageId | 'neutral' | 'curse';
  type: CardType;
  rarity: CardRarity;
  element: ElementTag;
  cost: number;
  exhaust?: boolean;
  ethereal?: boolean;
  innate?: boolean;
  tokenOnly?: boolean;
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
  passiveRevive?: boolean;
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
    | 'maxhp-leech-kill'
    | 'abode-heal'
    | 'resonance-amp'
    | 'block-retain-half'
    | 'curse-power'
    | 'gold-magnet'
    | 'tribulation-ward'
    | 'heal-after-battle'
    | 'maxhp-pickup'
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
  act: ActNumber;
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
  act: ActNumber;
  row: number;
  col: number;
  type: MapNodeType;
  label: string;
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
  damageBoostPct: number;
  nextResonanceDouble: boolean;
  enemyDmgWeakenPct: number;
  maxSealSlots: number;
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
  hpSacrificedInCombat: number;
  phoenixTriggeredThisTurn?: boolean;
  firstNonExhaustEchoDone?: boolean;
  samsaraReviveUsed?: boolean;
  lastResonance: ResonanceEvent | null;
  phase2Banner: string | null;
  combatLog: string[];
  outcome: 'ongoing' | 'victory' | 'tribulation-survived' | 'defeat';
}

export interface EncounterChoice {
  id: string;
  label: string;
  detail: string;
  goldCost?: number;
  hpCost?: number;
  maxHpCost?: number;
  rewardText: string;
  effect: {
    gold?: number;
    hp?: number;
    maxHp?: number;
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

export type RealmId =
  | 'qi'
  | 'foundation'
  | 'core'
  | 'nascent'
  | 'deity'
  | 'void'
  | 'integration'
  | 'mahayana'
  | 'true-immortal'
  | 'golden-immortal'
  | 'taiyi'
  | 'daluo'
  | 'dao-ancestor'
  | 'ascended';

export type BreakthroughGrade = 'earth' | 'heaven';

export interface RewardState {
  gold: number;
  cardChoices: CardDef[];
  relicReward?: RelicDef;
  treasureReward?: TreasureDef;
  materialReward?: EnchantDef;
  consumableReward?: ConsumableDef;
  methodChoices?: SecondaryMethodDef[];
  trueSpiritChoices?: TrueSpiritDef[];
  supremeLawChoices?: SupremeLawDef[];
  worldAscensionTitle?: string;
  worldAscensionDesc?: string;
  pickedCard: boolean;
  pickedRelic: boolean;
  pickedTreasure: boolean;
  pickedMaterial: boolean;
  pickedConsumable?: boolean;
  pickedMethod?: boolean;
  pickedTrueSpirit?: boolean;
  pickedSupremeLaw?: boolean;
  isBossReward?: boolean;
  breakthroughGrade?: BreakthroughGrade;
  lawChoices?: RelicDef[];
  pickedLaw?: boolean;
  maxHpGained?: number;
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
  kind: 'card' | 'relic' | 'consumable' | 'maxhp';
  refId: string;
  claimed: boolean;
}

export interface BlessingOption {
  id: 'gold' | 'purge-two' | 'gamble-relic' | 'mythic-treasure';
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
  act: ActNumber;
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
  trueSpirit?: TrueSpiritId | null;
  supremeLaw?: SupremeLawId | null;
  startWorld?: WorldId;
  rootId: string;
  act: ActNumber;
  realm: RealmId;
  hp: number;
  maxHp: number;
  baseQi: number;
  gold: number;
  daoTokens: number;
  deck: CardInstance[];
  treasures: string[];
  relics: string[];
  materials: EnchantId[];
  consumables: string[];
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
    hpSacrificed: number;
    tribulationsSlain: number;
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
  unlockedStartWorlds?: WorldId[];
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
    maxHp: number;
    outcome: 'victory' | 'true-victory' | 'death';
    cause: string;
    karmaEarned: number;
  }[];
}
