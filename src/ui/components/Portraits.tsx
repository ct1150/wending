import playerSwordImg from '../../../assets/portraits/player-sword.jpg';
import playerDemonImg from '../../../assets/portraits/player-demon.jpg';
import playerAlchemyImg from '../../../assets/portraits/player-alchemy.jpg';
import playerArrayImg from '../../../assets/portraits/player-array.jpg';
import enemyBeastImg from '../../../assets/portraits/enemy-beast.jpg';
import enemyCultivatorImg from '../../../assets/portraits/enemy-cultivator.jpg';
import enemyDemonImg from '../../../assets/portraits/enemy-demon.jpg';
import enemyThunderImg from '../../../assets/portraits/enemy-thunder.jpg';
import enemyCelestialImg from '../../../assets/portraits/enemy-celestial.jpg';
import type { EnemyDef, LineageId } from '../../core/types';

export const PLAYER_PORTRAITS: Record<LineageId, string> = {
  sword: playerSwordImg,
  demon: playerDemonImg,
  alchemy: playerAlchemyImg,
  array: playerArrayImg,
};

export const ENEMY_PORTRAITS: Record<EnemyDef['artStyle'], string> = {
  beast: enemyBeastImg,
  cultivator: enemyCultivatorImg,
  demon: enemyDemonImg,
  thunder: enemyThunderImg,
  celestial: enemyCelestialImg,
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
  artStyle,
  hasBlock,
  isPoisoned,
}: {
  artStyle: EnemyDef['artStyle'];
  hasBlock: boolean;
  isPoisoned: boolean;
}) {
  return (
    <div class={`portrait-art-frame enemy-float foe-${artStyle}${hasBlock ? ' has-block' : ''}`}>
      <img src={ENEMY_PORTRAITS[artStyle]} alt="敌方强敌立绘" class="portrait-img" draggable={false} />
      <div class="portrait-vignette" />
      {isPoisoned && <div class="portrait-poison-mist" />}
      {hasBlock && <div class="portrait-shield-dome" />}
    </div>
  );
}
