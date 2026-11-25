import { REALM_NAMES } from '../../content/lineages';
import { ENCHANTS, RELICS } from '../../content/treasures';
import type { RunState } from '../../core/types';

interface TopHudProps {
  run: RunState;
  muted: boolean;
  onToggleMute: () => void;
  onOpenDeck: () => void;
  onAbandon: () => void;
}

export function TopHud({ run, muted, onToggleMute, onOpenDeck, onAbandon }: TopHudProps) {
  const lifeLeft = Math.max(0, run.maxLifespan - run.age);
  const lowLife = lifeLeft <= 15;
  const lowHp = run.hp <= run.maxHp * 0.3;

  return (
    <header>
      <div class="top-hud">
        <div class="hud-group">
          <span class="hud-pill gold">
            第 {run.generation} 世 · {run.name} · {REALM_NAMES[run.realm]}
          </span>
          <span class={`hud-pill${lowHp ? ' danger' : ''}`}>
            ❤ 气血 {run.hp}/{run.maxHp}
          </span>
          <span class={`hud-pill${lowLife ? ' danger' : ''}`} title="赶路、洞府闭关与燃寿禁术都会消耗寿元，寿尽则坐化">
            ⏳ 寿元 {run.age}/{run.maxLifespan}岁
          </span>
          <span class="hud-pill gold" title="道基纯度 ≥50 地道破境，≥85 天道破境获金色法则与巨额延寿">
            ☯ 道基 {run.foundation}/100
          </span>
          <span class="hud-pill">💎 {run.gold} 灵石</span>
          {run.daoTokens > 0 && (
            <span class="hud-pill gold" title="集齐 2 枚三界道果信物可在飞升后开启隐藏第四卷【上界问鼎】">
              ✦ 道果 {run.daoTokens}/2
            </span>
          )}
        </div>
        <div class="hud-group">
          <button type="button" class="btn btn-sm" onClick={onOpenDeck}>
            牌库 ({run.deck.length})
          </button>
          <button type="button" class="btn btn-sm" onClick={onToggleMute}>
            {muted ? '🔇 静音' : '🔊 音效'}
          </button>
          <button type="button" class="btn btn-sm btn-danger" onClick={onAbandon}>
            兵解轮回
          </button>
        </div>
      </div>

      {(run.relics.length > 0 || run.materials.length > 0) && (
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
