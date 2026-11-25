import { ENCHANTS } from '../../content/treasures';
import {
  getCardCost,
  getCardDef,
  getCardDescription,
  getCardDisplayName,
  SEAL_LABELS,
} from '../../core/combat-engine';
import type { CardDef, CardInstance, ElementTag } from '../../core/types';

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
  resonanceHint?: string | null;
  price?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CardView({
  instance,
  def: rawDef,
  disabled,
  resonanceHint,
  price,
  selected,
  onClick,
}: CardViewProps) {
  const def = rawDef ?? getCardDef(instance!.defId);
  const cost = instance ? getCardCost(instance) : def.cost;
  const name = instance ? getCardDisplayName(instance) : def.name;
  const desc = instance ? getCardDescription(instance) : def.description;
  const enchant = instance?.enchant ? ENCHANTS[instance.enchant] : null;
  const elColor = ELEMENT_COLORS[def.element];

  return (
    <button
      type="button"
      class={`card-tile rarity-${def.rarity}${resonanceHint ? ' resonates' : ''}`}
      style={selected ? { borderColor: 'var(--gold-bright)', boxShadow: '0 0 18px rgba(250,224,174,0.45)' } : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <div>
        <div class="card-top">
          <span class="card-cost">{cost}</span>
          <span class="card-name">{name}</span>
          {def.element !== 'none' && (
            <span class="card-el" style={{ color: elColor }}>
              {SEAL_LABELS[def.element]}
            </span>
          )}
        </div>
        <p class="card-desc">{desc}</p>
        {enchant && (
          <div class="enchant-pill">
            [{enchant.badge}] {enchant.name} · {enchant.description}
          </div>
        )}
        {resonanceHint && <div class="res-tag">✦ {resonanceHint}</div>}
      </div>

      <div class="card-footer">
        <span>{TYPE_LABELS[def.type]}</span>
        {price !== undefined ? <span style={{ color: 'var(--gold-bright)' }}>{price} 灵石</span> : null}
      </div>
    </button>
  );
}
