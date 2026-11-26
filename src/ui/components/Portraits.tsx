import type { EnemyDef, LineageId } from '../../core/types';

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
  const palette: Record<LineageId, { robe: string; trim: string; aura: string; weapon: string }> = {
    sword: { robe: '#1a3847', trim: '#ebd08c', aura: '#7bd4ff', weapon: '#f8e6b8' },
    demon: { robe: '#2e131d', trim: '#e85d79', aura: '#ff4f70', weapon: '#ff7b93' },
    alchemy: { robe: '#163529', trim: '#68c98e', aura: '#7ff0a8', weapon: '#ef9952' },
    array: { robe: '#262438', trim: '#caa36b', aura: '#8ec8ff', weapon: '#f0d494' },
  };
  const p = palette[lineage];

  return (
    <svg viewBox="0 0 180 200" class="portrait-svg player-float" aria-hidden="true">
      <defs>
        <radialGradient id={`p-aura-${lineage}`} cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color={p.aura} stop-opacity="0.34" />
          <stop offset="70%" stop-color={p.aura} stop-opacity="0.08" />
          <stop offset="100%" stop-color={p.aura} stop-opacity="0" />
        </radialGradient>
        <linearGradient id={`p-robe-${lineage}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color={p.robe} />
          <stop offset="100%" stop-color="#091217" />
        </linearGradient>
      </defs>

      {/* 周身灵气光环 */}
      <circle cx="90" cy="100" r="78" fill={`url(#p-aura-${lineage})`} />

      {/* 场上阵盘旋转八卦 */}
      {arrayCount > 0 && (
        <g class="spin-slow" style={{ transformOrigin: '90px 108px' }}>
          <circle cx="90" cy="108" r="66" fill="none" stroke={p.trim} stroke-width="1.4" stroke-dasharray="8 6" opacity="0.7" />
          <polygon points="90,46 144,108 90,170 36,108" fill="none" stroke={p.trim} stroke-width="1" opacity="0.55" />
        </g>
      )}

      {/* 剑意环绕飞剑 */}
      {swordIntent > 0 && (
        <g class="sword-orbit">
          <path d="M36 66 L44 38 L49 66 L44 74 Z" fill="#fae0ae" opacity="0.9" />
          <path d="M136 58 L145 32 L149 58 L144 66 Z" fill="#b68cff" opacity="0.85" />
        </g>
      )}

      {/* 背后法器/剑匣/葫芦 */}
      {lineage === 'sword' && (
        <g>
          <path d="M48 34 L126 148" stroke={p.weapon} stroke-width="5" stroke-linecap="round" />
          <path d="M40 44 L58 32" stroke={p.trim} stroke-width="4" stroke-linecap="round" />
          <path d="M126 30 L132 70 L122 74 Z" fill={p.trim} opacity="0.85" />
        </g>
      )}
      {lineage === 'demon' && (
        <g>
          <path d="M32 62 Q90 12 148 62" fill="none" stroke="#e85d79" stroke-width="3" opacity="0.65" />
          <path d="M42 40 L52 146" stroke="#ff6c89" stroke-width="4" stroke-linecap="round" />
          <path d="M42 40 Q18 52 24 88 Q46 72 48 52 Z" fill="#a81d3a" opacity="0.88" />
        </g>
      )}
      {lineage === 'alchemy' && (
        <g>
          <ellipse cx="134" cy="96" rx="16" ry="22" fill="#9a642c" stroke="#ebd08c" stroke-width="2" />
          <ellipse cx="134" cy="74" rx="10" ry="12" fill="#b47838" stroke="#ebd08c" stroke-width="1.6" />
          <path d="M134 58 Q144 42 132 30" fill="none" stroke="#68c98e" stroke-width="2.5" opacity="0.8" />
        </g>
      )}
      {lineage === 'array' && (
        <g>
          <circle cx="90" cy="84" r="46" fill="none" stroke="#ebd08c" stroke-width="2" opacity="0.55" />
          <circle cx="90" cy="84" r="38" fill="none" stroke="#69b8eb" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7" />
        </g>
      )}

      {/* 仙侠人物剪影与宽袖道袍 */}
      <path d="M52 184 L64 114 Q90 98 116 114 L128 184 Z" fill={`url(#p-robe-${lineage})`} stroke={p.trim} stroke-width="1.6" />
      <path d="M64 114 L34 148 L56 156 L72 130 Z" fill={`url(#p-robe-${lineage})`} stroke={p.trim} stroke-width="1.3" />
      <path d="M116 114 L148 142 L130 156 L108 130 Z" fill={`url(#p-robe-${lineage})`} stroke={p.trim} stroke-width="1.3" />
      {/* 衣襟鎏金纹 */}
      <path d="M78 110 L90 144 L102 110" fill="none" stroke={p.trim} stroke-width="2" />
      <path d="M84 142 L96 142 L92 184 L88 184 Z" fill={p.trim} opacity="0.65" />

      {/* 头部、发冠与飘带 */}
      <circle cx="90" cy="82" r="18" fill="#182730" stroke={p.trim} stroke-width="1.5" />
      <path d="M74 74 Q90 54 106 74 Q102 64 90 60 Q78 64 74 74 Z" fill="#0d171c" />
      <rect x="84" y="54" width="12" height="9" rx="2" fill={p.trim} />
      <path d="M78 60 Q54 66 42 86" fill="none" stroke={p.trim} stroke-width="2.2" stroke-linecap="round" opacity="0.85" />
      <path d="M102 60 Q124 68 136 82" fill="none" stroke={p.trim} stroke-width="1.8" stroke-linecap="round" opacity="0.7" />
      {/* 眼神微光 */}
      <circle cx="85" cy="82" r="1.8" fill={lineage === 'demon' ? '#ff5978' : '#fae0ae'} />
      <circle cx="96" cy="82" r="1.8" fill={lineage === 'demon' ? '#ff5978' : '#fae0ae'} />

      {/* 护体罡气金钟罩 */}
      {hasBlock && (
        <ellipse
          cx="90"
          cy="112"
          rx="68"
          ry="74"
          fill="rgba(105,184,235,0.12)"
          stroke="#8fd2ff"
          stroke-width="2.4"
          stroke-dasharray="10 4"
        />
      )}
    </svg>
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
    <svg viewBox="0 0 180 200" class="portrait-svg enemy-float" aria-hidden="true">
      <defs>
        <radialGradient id={`e-aura-${artStyle}`} cx="50%" cy="48%" r="48%">
          <stop
            offset="0%"
            stop-color={
              artStyle === 'thunder'
                ? '#b68cff'
                : artStyle === 'demon'
                  ? '#e85d79'
                  : artStyle === 'celestial'
                    ? '#fae0ae'
                    : '#ef7c52'
            }
            stop-opacity="0.38"
          />
          <stop offset="100%" stop-color="#000" stop-opacity="0" />
        </radialGradient>
      </defs>

      <circle cx="90" cy="96" r="78" fill={`url(#e-aura-${artStyle})`} />

      {artStyle === 'beast' && (
        <g>
          <path d="M40 164 Q44 96 76 74 L68 42 L94 64 L118 42 L112 74 Q142 96 144 164 Z" fill="#1e2a30" stroke="#ef9c6b" stroke-width="2" />
          <path d="M56 120 Q90 142 124 120" fill="none" stroke="#ff7c52" stroke-width="2.4" />
          <polygon points="72,94 84,100 74,104" fill="#ffcf6b" />
          <polygon points="108,94 96,100 106,104" fill="#ffcf6b" />
          <path d="M74 124 L78 138 L84 126 M106 124 L102 138 L96 126" fill="#fff3dc" />
        </g>
      )}

      {artStyle === 'cultivator' && (
        <g>
          <path d="M46 180 L62 108 Q90 92 118 108 L134 180 Z" fill="#231c2c" stroke="#dfc495" stroke-width="1.8" />
          <circle cx="90" cy="76" r="18" fill="#171420" stroke="#dfc495" stroke-width="1.6" />
          <path d="M52 68 Q90 44 128 68 L90 58 Z" fill="#32263e" stroke="#dfc495" stroke-width="1.4" />
          <path d="M132 42 L58 156" stroke="#f0d9a8" stroke-width="4.5" stroke-linecap="round" />
          <circle cx="84" cy="76" r="2" fill="#ff8a73" />
          <circle cx="96" cy="76" r="2" fill="#ff8a73" />
        </g>
      )}

      {artStyle === 'demon' && (
        <g>
          <path d="M54 58 Q36 28 58 22 Q56 44 72 56" fill="#5e172a" stroke="#ff6c89" stroke-width="1.8" />
          <path d="M126 58 Q144 28 122 22 Q124 44 108 56" fill="#5e172a" stroke="#ff6c89" stroke-width="1.8" />
          <path d="M42 184 L58 104 Q90 86 122 104 L138 184 Z" fill="#260f18" stroke="#e85d79" stroke-width="2" />
          <circle cx="90" cy="76" r="20" fill="#1b0a11" stroke="#e85d79" stroke-width="1.8" />
          <path d="M76 74 L86 78 L78 82 Z" fill="#ff4d6d" />
          <path d="M104 74 L94 78 L102 82 Z" fill="#ff4d6d" />
          <path d="M68 122 Q90 144 112 122" fill="none" stroke="#ff5c7c" stroke-width="2.5" />
        </g>
      )}

      {artStyle === 'thunder' && (
        <g>
          <ellipse cx="90" cy="72" rx="64" ry="30" fill="#261c42" stroke="#b68cff" stroke-width="2" />
          <ellipse cx="64" cy="66" rx="34" ry="22" fill="#322457" />
          <ellipse cx="118" cy="68" rx="32" ry="20" fill="#322457" />
          {/* 劫眼 */}
          <ellipse cx="90" cy="72" rx="22" ry="11" fill="#140c29" stroke="#e3ceff" stroke-width="2" />
          <circle cx="90" cy="72" r="6" fill="#d9b8ff" />
          {/* 紫霄落雷 */}
          <path d="M88 92 L72 128 L94 128 L76 174" fill="none" stroke="#e3ceff" stroke-width="4" stroke-linejoin="round" />
          <path d="M114 96 L126 124 L112 128 L124 156" fill="none" stroke="#b68cff" stroke-width="2.5" stroke-linejoin="round" />
        </g>
      )}

      {artStyle === 'celestial' && (
        <g>
          <circle cx="90" cy="76" r="48" fill="none" stroke="#fae0ae" stroke-width="2.2" stroke-dasharray="6 4" />
          <circle cx="90" cy="76" r="34" fill="none" stroke="#ffd875" stroke-width="1.5" />
          <path d="M46 182 L64 106 Q90 90 116 106 L134 182 Z" fill="#2b2419" stroke="#fae0ae" stroke-width="2" />
          <circle cx="90" cy="76" r="18" fill="#1f1910" stroke="#fae0ae" stroke-width="2" />
          <polygon points="90,40 96,56 84,56" fill="#ffe6a3" />
          <circle cx="84" cy="76" r="2.2" fill="#fff4d1" />
          <circle cx="96" cy="76" r="2.2" fill="#fff4d1" />
        </g>
      )}

      {isPoisoned && (
        <g opacity="0.82">
          <circle cx="52" cy="128" r="7" fill="#68c98e" />
          <circle cx="128" cy="116" r="5" fill="#68c98e" />
          <circle cx="70" cy="150" r="4" fill="#9cf5be" />
        </g>
      )}

      {hasBlock && (
        <ellipse
          cx="90"
          cy="108"
          rx="66"
          ry="72"
          fill="rgba(143,210,255,0.1)"
          stroke="#8fd2ff"
          stroke-width="2.2"
          stroke-dasharray="8 4"
        />
      )}
    </svg>
  );
}
