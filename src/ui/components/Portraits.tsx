import playerSwordImg from '../../../assets/portraits/player-sword.jpg';
import playerDemonImg from '../../../assets/portraits/player-demon.jpg';
import playerAlchemyImg from '../../../assets/portraits/player-alchemy.jpg';
import playerArrayImg from '../../../assets/portraits/player-array.jpg';

import e1WolfImg from '../../../assets/portraits/enemy-beast.jpg';
import e1BanditImg from '../../../assets/portraits/enemy-cultivator.jpg';
import e1CentipedeImg from '../../../assets/portraits/e1-centipede.jpg';
import e1StewardImg from '../../../assets/portraits/e1-elite-steward.jpg';
import e1GolemImg from '../../../assets/portraits/e1-elite-golem.jpg';
import e1TribulationImg from '../../../assets/portraits/enemy-thunder.jpg';

import e2CorpseImg from '../../../assets/portraits/e2-corpse.jpg';
import e2SwordDiscipleImg from '../../../assets/portraits/e2-sword-disciple.jpg';
import e2ElderImg from '../../../assets/portraits/e2-elite-elder.jpg';
import e2DemonBossImg from '../../../assets/portraits/enemy-demon.jpg';

import e3DragonImg from '../../../assets/portraits/e3-dragon.jpg';
import e3EnvoyImg from '../../../assets/portraits/e3-immortal-envoy.jpg';
import e3PhoenixImg from '../../../assets/portraits/e3-elite-phoenix.jpg';
import e3AscensionImg from '../../../assets/portraits/e3-boss-ascension.jpg';

import e4GuardImg from '../../../assets/portraits/e4-elite-guard.jpg';
import e4DaoBossImg from '../../../assets/portraits/enemy-celestial.jpg';

import type { EnemyDef, LineageId } from '../../core/types';

export const PLAYER_PORTRAITS: Record<LineageId, string> = {
  sword: playerSwordImg,
  demon: playerDemonImg,
  alchemy: playerAlchemyImg,
  array: playerArrayImg,
};

export const ENEMY_PORTRAITS_BY_ID: Record<string, string> = {
  // 人界篇 (Acts 1~3)
  'e1-wolf': e1WolfImg,
  'e1-bandit': e1BanditImg,
  'e1-centipede': e1CentipedeImg,
  'e1-elite-steward': e1StewardImg,
  'e1-elite-golem': e1GolemImg,
  'e1-boss-tribulation': e1TribulationImg,
  'e2-corpse': e2CorpseImg,
  'e2-sword-disciple': e2SwordDiscipleImg,
  'e2-elite-elder': e2ElderImg,
  'e2-boss-demon': e2DemonBossImg,
  'e3-dragon': e3DragonImg,
  'e3-immortal-envoy': e3EnvoyImg,
  'e3-elite-phoenix': e3PhoenixImg,
  'e3-boss-ascension': e3AscensionImg,
  // 灵界篇 (Acts 4~6)
  'e4-horn-warrior': e2SwordDiscipleImg,
  'e4-thunder-beast': e1WolfImg,
  'e4-elite-guard': e4GuardImg,
  'e4-boss-dao': e2DemonBossImg,
  'e5-demon-lord': e1StewardImg,
  'e5-beetle-king': e1CentipedeImg,
  'e5-elite-baohua': e3PhoenixImg,
  'e5-boss-nirvana': e2DemonBossImg,
  'e6-thunder-dragon': e3DragonImg,
  'e6-corpse-emperor': e2CorpseImg,
  'e6-elite-locust': e1GolemImg,
  'e6-boss-immortal-tribulation': e3AscensionImg,
  // 仙界篇 (Acts 7~9)
  'e7-court-envoy': e3EnvoyImg,
  'e7-corpse-immortal': e2ElderImg,
  'e7-elite-zhulong': e1BanditImg,
  'e7-boss-xiaojinhan': e3EnvoyImg,
  'e8-grey-lord': e1StewardImg,
  'e8-time-soldier': e4GuardImg,
  'e8-boss-corpse-self': e2DemonBossImg,
  'e9-elite-jiuyuan': e4GuardImg,
  'e9-boss-guhuojin': e4DaoBossImg,
};

export const ENEMY_FALLBACK_PORTRAITS: Record<EnemyDef['artStyle'], string> = {
  beast: e1WolfImg,
  cultivator: e1BanditImg,
  demon: e2DemonBossImg,
  thunder: e1TribulationImg,
  celestial: e4DaoBossImg,
};

export function PlayerPortrait({
  lineage,
  hasBlock,
  swordIntent,
  arrayCount,
}: {
  lineage: LineageId;
  hasBlock: boolean;
  swordIntent: number;
  arrayCount: number;
}) {
  return (
    <div class={`portrait-art-frame player-float lineage-${lineage}${hasBlock ? ' has-block' : ''}`}>
      <img src={PLAYER_PORTRAITS[lineage]} alt="我方修士立绘" class="portrait-img" draggable={false} />
      <div class="portrait-vignette" />
      {arrayCount > 0 && <div class="portrait-ring-array" title="场上阵盘运转中" />}
      {swordIntent > 0 && <div class="portrait-aura-sword" title={`剑意 ${swordIntent} 层`} />}
      {hasBlock && <div class="portrait-shield-dome" />}
    </div>
  );
}

export function EnemyPortrait({
  enemyDefId,
  enemyName,
  artStyle,
  hasBlock,
  isPoisoned,
}: {
  enemyDefId: string;
  enemyName: string;
  artStyle: EnemyDef['artStyle'];
  hasBlock: boolean;
  isPoisoned: boolean;
}) {
  const src = ENEMY_PORTRAITS_BY_ID[enemyDefId] ?? ENEMY_FALLBACK_PORTRAITS[artStyle];
  return (
    <div class={`portrait-art-frame enemy-float foe-${artStyle}${hasBlock ? ' has-block' : ''}`}>
      <img src={src} alt={`${enemyName}立绘`} class="portrait-img" draggable={false} />
      <div class="portrait-vignette" />
      {isPoisoned && <div class="portrait-poison-mist" />}
      {hasBlock && <div class="portrait-shield-dome" />}
    </div>
  );
}
