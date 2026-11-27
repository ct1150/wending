import { useState } from 'preact/hooks';
import { CONSUMABLES } from '../../content/consumables';
import { REALM_NAMES } from '../../content/lineages';
import { SECONDARY_METHODS } from '../../content/methods';
import { ENCHANTS, RELICS } from '../../content/treasures';
import type { RunState } from '../../core/types';
import { sfx } from '../sfx';

interface TopHudProps {
  run: RunState;
  muted: boolean;
  bgmOn: boolean;
  compact?: boolean;
  onUseConsumable?: (slotIdx: number) => void;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onOpenDeck: () => void;
  onAbandon: () => void;
}

export function TopHud({
  run,
  muted,
  bgmOn,
  compact,
  onUseConsumable,
  onToggleMute,
  onToggleBgm,
  onOpenDeck,
  onAbandon,
}: TopHudProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lifeLeft = Math.max(0, run.maxLifespan - run.age);
  const lowLife = lifeLeft <= 15;
  const lowHp = run.hp <= run.maxHp * 0.3;
  const secMethod = run.secondaryMethod ? SECONDARY_METHODS[run.secondaryMethod] : null;
  const canUsePouch = run.phase === 'combat' && run.combat?.outcome === 'ongoing';

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
    } catch {}
  };

  return (
    <header class={`hud-wrapper${compact ? ' is-compact' : ''}`}>
      <div class="top-hud">
        <div class="hud-group">
          <span class="hud-pill gold">
            {run.name}·{REALM_NAMES[run.realm]}
          </span>
          {secMethod && (
            <span class="hud-pill gold" title={`${secMethod.name}：${secMethod.description}`}>
              ☯ {secMethod.badge}
            </span>
          )}
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

          {/* 3 格随身乾坤丹符袋 */}
          <div class="pouch-inline" title="乾坤丹符袋（战中点击 0 真元瞬发）">
            {[0, 1, 2].map((idx) => {
              const cid = run.consumables[idx];
              const def = cid ? CONSUMABLES[cid] : null;
              if (!def) {
                return (
                  <span key={idx} class="pouch-slot empty" title="空丹符格">
                    ·
                  </span>
                );
              }
              const clickable = canUsePouch && !def.passiveRevive;
              return (
                <button
                  key={`${cid}-${idx}`}
                  type="button"
                  class={`pouch-slot filled${clickable ? ' active' : ''}`}
                  disabled={!clickable}
                  title={`${def.name}：${def.description}${clickable ? '（点击瞬发！）' : ''}`}
                  onClick={() => {
                    if (!clickable || !onUseConsumable) return;
                    sfx.heal();
                    onUseConsumable(idx);
                  }}
                >
                  {def.icon}
                </button>
              );
            })}
          </div>
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
          <button type="button" class="btn btn-sm" onClick={onToggleBgm} title="开关山海云风与五声古琴氛围仙乐">
            {bgmOn ? '🎵 仙乐' : '🎵 静'}
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
