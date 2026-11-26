import { useState } from 'preact/hooks';
import { REALM_NAMES } from '../../content/lineages';
import { ENCHANTS, RELICS } from '../../content/treasures';
import type { RunState } from '../../core/types';

interface TopHudProps {
  run: RunState;
  muted: boolean;
  compact?: boolean;
  onToggleMute: () => void;
  onOpenDeck: () => void;
  onAbandon: () => void;
}

export function TopHud({ run, muted, compact, onToggleMute, onOpenDeck, onAbandon }: TopHudProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lifeLeft = Math.max(0, run.maxLifespan - run.age);
  const lowLife = lifeLeft <= 15;
  const lowHp = run.hp <= run.maxHp * 0.3;

  const toggleLandscapeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        const orient = screen.orientation as unknown as { lock?: (mode: string) => Promise<void> };
        await orient?.lock?.('landscape').catch(() => {});
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback gracefully on iOS Safari where Fullscreen API is restricted
    }
  };

  return (
    <header class={`hud-wrapper${compact ? ' is-compact' : ''}`}>
      <div class="top-hud">
        <div class="hud-group">
          <span class="hud-pill gold">
            {run.name}·{REALM_NAMES[run.realm]}
          </span>
          <span class={`hud-pill${lowHp ? ' danger' : ''}`}>
            ❤ {run.hp}/{run.maxHp}
          </span>
          <span class={`hud-pill${lowLife ? ' danger' : ''}`} title="赶路、洞府与燃寿禁术消耗寿元，寿尽坐化">
            ⏳ {run.age}/{run.maxLifespan}岁
          </span>
          <span class="hud-pill gold" title="道基纯度 ≥50 地道，≥85 天道破境">
            ☯ {run.foundation}
          </span>
          <span class="hud-pill">💎 {run.gold}</span>
          {run.daoTokens > 0 && (
            <span class="hud-pill gold" title="集齐 2 枚道果开启隐藏第四卷">
              ✦ {run.daoTokens}/2
            </span>
          )}
        </div>
        <div class="hud-group">
          <button
            type="button"
            class="btn btn-sm landscape-btn"
            title="切换全屏横屏一屏沉浸模式"
            onClick={toggleLandscapeFullscreen}
          >
            {isFullscreen ? '⤢ 退出' : '↻ 横屏'}
          </button>
          <button type="button" class="btn btn-sm" onClick={onOpenDeck}>
            牌库({run.deck.length})
          </button>
          <button type="button" class="btn btn-sm" onClick={onToggleMute} aria-label="切换音效">
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" class="btn btn-sm btn-danger" onClick={onAbandon}>
            兵解
          </button>
        </div>
      </div>

      {!compact && (run.relics.length > 0 || run.materials.length > 0) && (
        <div class="relic-strip">
          {run.relics.map((id) => {
            const rel = RELICS[id];
            if (!rel) return null;
            return (
              <span key={id} class={`relic-chip${rel.rarity === 'law' ? ' law' : ''}`} title={rel.description}>
                {rel.rarity === 'law' ? '★ ' : '◈ '}
                {rel.name}
              </span>
            );
          })}
          {run.materials.map((m, idx) => {
            const def = ENCHANTS[m];
            return (
              <span
                key={`${m}-${idx}`}
                class="relic-chip"
                style={{ borderColor: '#b68cff', color: '#e2d1ff' }}
                title={`附魔材料（洞府可用）：${def.description}`}
              >
                ❖ {def.materialName}
              </span>
            );
          })}
        </div>
      )}
    </header>
  );
}
