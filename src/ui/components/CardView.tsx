import { ENCHANTS } from '../../content/treasures';
import {
  getCardCost,
  getCardDef,
  getCardDescription,
  getCardDisplayName,
  SEAL_LABELS,
} from '../../core/combat-engine';
import type { CardDef, CardInstance, ElementTag } from '../../core/types';
import { CardArt } from './CardArt';

export const ELEMENT_COLORS: Record<ElementTag, string> = {
  metal: 'var(--el-metal)',
  wood: 'var(--el-wood)',
  water: 'var(--el-water)',
  fire: 'var(--el-fire)',
  earth: 'var(--el-earth)',
  thunder: 'var(--el-thunder)',
  sha: 'var(--el-sha)',
  none: 'var(--el-none)',
};

const TYPE_LABELS: Record<CardDef['type'], string> = {
  attack: '攻伐',
  defense: '守御',
  skill: '运转',
  array: '阵盘',
  forbidden: '禁术',
  curse: '心魔',
};

interface CardViewProps {
  instance?: CardInstance;
  def?: CardDef;
  disabled?: boolean;
  unplayable?: boolean;
  resonanceHint?: string | null;
  price?: number;
  selected?: boolean;
  fanStyle?: Record<string, string>;
  onClick?: () => void;
}

export function CardView({
  instance,
  def: rawDef,
  disabled,
  unplayable,
  resonanceHint,
  price,
  selected,
  fanStyle,
  onClick,
}: CardViewProps) {
  const def = rawDef ?? getCardDef(instance!.defId);
  const isX = Boolean(def.effect.xCost);
  const cost = instance ? getCardCost(instance) : def.cost;
  const name = instance ? getCardDisplayName(instance) : def.name;
  const desc = instance ? getCardDescription(instance) : def.description;
  const enchant = instance?.enchant ? ENCHANTS[instance.enchant] : null;
  const elColor = ELEMENT_COLORS[def.element];

  return (
    <button
      type="button"
      class={`tcg-card rarity-${def.rarity}${resonanceHint ? ' resonates' : ''}${selected ? ' is-selected' : ''}${unplayable ? ' is-unplayable' : ''}`}
      style={fanStyle}
      disabled={disabled}
      onClick={onClick}
    >
      <span class="tcg-cost-orb" title={isX ? '倾泻当前全部真元 X' : `消耗 ${cost} 点真元`}>
        {isX ? 'X' : cost}
      </span>

      <div class="tcg-header">
        <span class="tcg-name">{name}</span>
        {def.element !== 'none' && (
          <span class="tcg-seal-stamp" style={{ color: elColor, borderColor: elColor }}>
            {SEAL_LABELS[def.element]}
          </span>
        )}
      </div>

      <div class="tcg-art-frame">
        <CardArt type={def.type} element={def.element} />
        {enchant && (
          <span class="tcg-enchant-badge" title={`${enchant.name}：${enchant.description}`}>
            {enchant.badge}
          </span>
        )}
      </div>

      <div class="tcg-ribbon">
        <span>— {TYPE_LABELS[def.type]}{def.element !== 'none' ? ` · ${SEAL_LABELS[def.element]}` : ''} —</span>
      </div>

      <div class="tcg-body">
        <p class="tcg-desc">{desc}</p>
        {enchant && (
          <div class="tcg-enchant-line">
            ❖ {enchant.name}：{enchant.description}
          </div>
        )}
        {resonanceHint && <div class="tcg-res-banner">✦ {resonanceHint}</div>}
      </div>

      {price !== undefined && (
        <div class="tcg-price-bar">💎 {price} 灵石</div>
      )}
    </button>
  );
}
