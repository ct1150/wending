import type { CardType, ElementTag } from '../../core/types';

export function CardArt({ type, element }: { type: CardType; element: ElementTag }) {
  const colorMap: Record<ElementTag, string> = {
    metal: '#ebd08c',
    wood: '#68c98e',
    water: '#69b8eb',
    fire: '#ef7c52',
    earth: '#caa36b',
    thunder: '#b68cff',
    sha: '#e85d79',
    none: '#96a6aa',
  };
  const primary = colorMap[element];

  return (
    <svg viewBox="0 0 160 88" class="card-art-svg" aria-hidden="true">
      <defs>
        <radialGradient id={`art-bg-${type}-${element}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color={primary} stop-opacity="0.32" />
          <stop offset="100%" stop-color="#081218" stop-opacity="0.96" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="160" height="88" fill={`url(#art-bg-${type}-${element})`} />
      {/* 背景祥云水墨弧 */}
      <path d="M0 74 Q42 56 82 70 T160 66 L160 88 L0 88 Z" fill="rgba(0,0,0,0.4)" />

      {type === 'attack' && element === 'thunder' && (
        <g>
          <path d="M96 8 L68 44 L88 44 L62 80" fill="none" stroke="#efe0ff" stroke-width="5" stroke-linejoin="round" />
          <path d="M96 8 L68 44 L88 44 L62 80" fill="none" stroke="#b68cff" stroke-width="2" stroke-linejoin="round" />
          <circle cx="80" cy="44" r="28" fill="none" stroke="#b68cff" stroke-width="1" stroke-dasharray="4 4" opacity="0.65" />
        </g>
      )}

      {type === 'attack' && element === 'sha' && (
        <g>
          <path d="M36 70 Q76 16 126 24 Q96 42 74 74 Z" fill="#e85d79" opacity="0.88" />
          <path d="M46 22 Q94 42 124 72" fill="none" stroke="#ffadc0" stroke-width="3" stroke-linecap="round" />
          <circle cx="102" cy="36" r="14" fill="none" stroke="#e85d79" stroke-width="1.5" opacity="0.7" />
        </g>
      )}

      {type === 'attack' && element !== 'thunder' && element !== 'sha' && (
        <g>
          <path d="M34 72 L116 18 L124 26 L44 78 Z" fill={primary} />
          <path d="M24 62 L52 80" stroke="#fff2d2" stroke-width="3" stroke-linecap="round" />
          <path d="M44 26 Q88 14 130 56" fill="none" stroke="#fff4d6" stroke-width="2" opacity="0.75" />
        </g>
      )}

      {type === 'defense' && (
        <g>
          <path d="M80 12 L118 26 L112 60 Q96 76 80 82 Q64 76 48 60 L42 26 Z" fill="rgba(20,42,54,0.85)" stroke={primary} stroke-width="2.5" />
          <circle cx="80" cy="46" r="15" fill="none" stroke={primary} stroke-width="1.8" />
          <path d="M80 31 L80 61 M65 46 L95 46" stroke={primary} stroke-width="1.4" opacity="0.7" />
        </g>
      )}

      {type === 'skill' && (
        <g>
          <circle cx="80" cy="44" r="24" fill="none" stroke={primary} stroke-width="2.2" />
          <path d="M80 20 A12 12 0 0 1 80 44 A12 12 0 0 0 80 68 A24 24 0 0 1 80 20 Z" fill={primary} opacity="0.8" />
          <circle cx="80" cy="32" r="3.5" fill="#0b1820" />
          <circle cx="80" cy="56" r="3.5" fill={primary} />
        </g>
      )}

      {type === 'array' && (
        <g>
          <polygon points="80,10 116,44 80,78 44,44" fill="none" stroke={primary} stroke-width="2.2" />
          <rect x="58" y="22" width="44" height="44" fill="none" stroke={primary} stroke-width="1.6" opacity="0.8" />
          <circle cx="80" cy="44" r="10" fill={primary} opacity="0.85" />
        </g>
      )}

      {type === 'forbidden' && (
        <g>
          <path d="M80 12 Q108 38 96 68 Q80 80 64 68 Q52 38 80 12 Z" fill="#b81d38" stroke="#ffb3c1" stroke-width="2" />
          <path d="M80 28 Q92 46 80 64 Q68 46 80 28 Z" fill="#ffe0a3" />
          <circle cx="80" cy="44" r="32" fill="none" stroke="#e85d79" stroke-width="1.4" stroke-dasharray="5 5" />
        </g>
      )}

      {type === 'curse' && (
        <g>
          <ellipse cx="80" cy="44" rx="34" ry="18" fill="#1c0810" stroke="#e85d79" stroke-width="2" />
          <circle cx="80" cy="44" r="9" fill="#e85d79" />
          <circle cx="80" cy="44" r="4" fill="#090306" />
        </g>
      )}
    </svg>
  );
}
