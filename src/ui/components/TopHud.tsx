import { useState } from 'preact/hooks';
import { CONSUMABLES } from '../../content/consumables';
import { ALL_SEAL_RECIPES, KEYWORD_GLOSSARY } from '../../content/glossary';
import {
  getWorldByAct,
  REALM_NAMES,
  SUPREME_LAWS,
  TRUE_SPIRITS,
  WORLD_INFO,
} from '../../content/lineages';
import { SECONDARY_METHODS } from '../../content/methods';
import { ENCHANTS, RELICS } from '../../content/treasures';
import type { RunState } from '../../core/types';
import { sfx } from '../sfx';

interface TopHudProps {
  run: RunState;
  muted: boolean;
  bgmOn: boolean;
  fastPlay?: boolean;
  compact?: boolean;
  onUseConsumable?: (slotIdx: number) => void;
  onToggleFastPlay?: () => void;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onOpenDeck: () => void;
  onAbandon: () => void;
}

export function TopHud({
  run,
  muted,
  bgmOn,
  fastPlay,
  compact,
  onUseConsumable,
  onToggleFastPlay,
  onToggleMute,
  onToggleBgm,
  onOpenDeck,
  onAbandon,
}: TopHudProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [selectedPouchIdx, setSelectedPouchIdx] = useState<number | null>(null);
  const [hudTip, setHudTip] = useState<{ title: string; body: string } | null>(null);

  const lowHp = run.hp <= run.maxHp * 0.3;
  const world = WORLD_INFO[getWorldByAct(run.act)];
  const secMethod = run.secondaryMethod ? SECONDARY_METHODS[run.secondaryMethod] : null;
  const secMethod2 = run.secondSecondaryMethod ? SECONDARY_METHODS[run.secondSecondaryMethod] : null;
  const trueSpirit = run.trueSpirit ? TRUE_SPIRITS[run.trueSpirit] : null;
  const supremeLaw = run.supremeLaw ? SUPREME_LAWS[run.supremeLaw] : null;
  const canUsePouch = run.phase === 'combat' && run.combat?.outcome === 'ongoing';
  const maxPouch = run.maxConsumables ?? 3;
  const shaVal = run.shaCorruption ?? 0;

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

  const selectedPouchId = selectedPouchIdx !== null ? run.consumables[selectedPouchIdx] : undefined;
  const selectedPouchDef = selectedPouchId ? CONSUMABLES[selectedPouchId] : null;

  return (
    <header class={`hud-wrapper${compact ? ' is-compact' : ''}`}>
      <div class="top-hud">
        <div class="hud-group">
          <button
            type="button"
            class="hud-pill gold hud-pill-btn"
            onClick={() => {
              sfx.click();
              setHudTip({
                title: `${world.badge} · 第 ${run.act}/9 卷（${REALM_NAMES[run.realm]}）`,
                body: `当前所处界域能量为【${world.energyName}】，全场神通攻防与丹毒基础威力倍率为 ${world.powerMult}×。`,
              });
            }}
          >
            {world.badge}·{run.name}·{REALM_NAMES[run.realm]}
          </button>
          {trueSpirit && (
            <button
              type="button"
              class="hud-pill gold hud-pill-btn"
              onClick={() => {
                sfx.click();
                setHudTip({ title: `🦅 ${trueSpirit.name}`, body: trueSpirit.description });
              }}
            >
              🦅 {trueSpirit.badge}
            </button>
          )}
          {supremeLaw && (
            <button
              type="button"
              class="hud-pill gold hud-pill-btn"
              onClick={() => {
                sfx.click();
                setHudTip({ title: `⏳ ${supremeLaw.name}`, body: supremeLaw.description });
              }}
            >
              ⏳ {supremeLaw.badge}
            </button>
          )}
          {secMethod && (
            <button
              type="button"
              class="hud-pill gold hud-pill-btn"
              onClick={() => {
                sfx.click();
                setHudTip({ title: `☯ 辅修心法 · ${secMethod.name}`, body: secMethod.description });
              }}
            >
              ☯ {secMethod.badge}
            </button>
          )}
          {secMethod2 && (
            <button
              type="button"
              class="hud-pill gold hud-pill-btn"
              onClick={() => {
                sfx.click();
                setHudTip({ title: `☯ 第二辅修 · ${secMethod2.name}`, body: secMethod2.description });
              }}
            >
              ☯ {secMethod2.badge}
            </button>
          )}
          <button
            type="button"
            class={`hud-pill hud-pill-btn${lowHp ? ' danger' : ''}`}
            onClick={() => {
              sfx.click();
              setHudTip({
                title: `❤ 气血（${run.hp} / ${run.maxHp}）`,
                body: '你的唯一生存数值，归零则道消身陨（除非持有替死木偶符或轮回法则）。击败卷末大劫时若剩余气血 ≥ 50%，可触发【天道破境】金色法则三选一！',
              });
            }}
          >
            ❤ {run.hp}/{run.maxHp}
          </button>
          <span class="hud-pill">💎 {run.gold}</span>
          {run.act >= 7 && (
            <button
              type="button"
              class={`hud-pill hud-pill-btn${shaVal >= 50 ? ' danger' : ' gold'}`}
              onClick={() => {
                sfx.click();
                setHudTip({
                  title: `☀️ 仙界天地煞气（当前 ${shaVal}%）`,
                  body:
                    shaVal < 50
                      ? '当前【仙窍清明】（煞气 <50%）：你的所有直接攻伐神通伤害额外 +10%！每次战斗胜利会积累 18% 煞气，可在洞府【洗煞池】化煞为气血上限。'
                      : '当前【煞气反噬】（煞气 ≥50%）：开战时会被煞气侵体往弃牌堆塞入 1 张心魔！请尽快前往【洞府洗煞池】涤清煞气并转化为永久气血上限！',
                });
              }}
            >
              ☯ 煞{shaVal}%
            </button>
          )}
          {run.daoTokens > 0 && (
            <button
              type="button"
              class="hud-pill gold hud-pill-btn"
              onClick={() => {
                sfx.click();
                setHudTip({
                  title: `✦ 掌天道果信物（${run.daoTokens} / 5）`,
                  body: '集齐 ≥ 5 枚掌天道果信物并在第九卷击败终极态时间道祖【古或今】，可达成完美超脱真结局！多余的道果可在任意【洞府丹庐】中用于催熟神通或兼修第二辅修心法！',
                });
              }}
            >
              ✦ {run.daoTokens}/5
            </button>
          )}

          {/* 随身乾坤丹符袋（默认 3 格，可在坊市扩至 4 格） */}
          <div class="pouch-inline">
            {Array.from({ length: maxPouch }, (_, idx) => {
              const cid = run.consumables[idx];
              const def = cid ? CONSUMABLES[cid] : null;
              if (!def) {
                return (
                  <span key={idx} class="pouch-slot empty">
                    ·
                  </span>
                );
              }
              const usableNow = canUsePouch && !def.passiveRevive;
              return (
                <button
                  key={`${cid}-${idx}`}
                  type="button"
                  class={`pouch-slot filled${usableNow ? ' active' : ''}`}
                  onClick={() => {
                    sfx.click();
                    setSelectedPouchIdx(idx);
                  }}
                >
                  {def.icon}
                </button>
              );
            })}
          </div>
        </div>

        <div class="hud-group">
          {compact && onToggleFastPlay && (
            <button
              type="button"
              class={`btn btn-sm${fastPlay ? ' btn-primary' : ''}`}
              title="切换新手两步预览出牌 / 老手单击极速出牌"
              onClick={() => {
                sfx.click();
                onToggleFastPlay();
              }}
            >
              {fastPlay ? '⚡ 快出' : '👁 预览'}
            </button>
          )}
          <button
            type="button"
            class="btn btn-sm"
            onClick={() => {
              sfx.click();
              setGlossaryOpen(true);
            }}
          >
            ? 词条
          </button>
          <button
            type="button"
            class="btn btn-sm landscape-btn"
            onClick={toggleLandscapeFullscreen}
          >
            {isFullscreen ? '⤢ 退出' : '↻ 横屏'}
          </button>
          <button type="button" class="btn btn-sm" onClick={onOpenDeck}>
            牌库({run.deck.length})
          </button>
          <button type="button" class="btn btn-sm" onClick={onToggleBgm}>
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
              <button
                key={id}
                type="button"
                class={`relic-chip${rel.rarity === 'law' ? ' law' : ''}`}
                onClick={() => {
                  sfx.click();
                  setHudTip({
                    title: `${rel.rarity === 'law' ? '★ 天道法则' : '◈ 随身古宝'} · ${rel.name}`,
                    body: rel.description,
                  });
                }}
              >
                {rel.rarity === 'law' ? '★ ' : '◈ '}
                {rel.name}
              </button>
            );
          })}
          {run.materials.map((m, idx) => {
            const def = ENCHANTS[m];
            return (
              <button
                key={`${m}-${idx}`}
                type="button"
                class="relic-chip"
                style={{ borderColor: '#b68cff', color: '#e2d1ff' }}
                onClick={() => {
                  sfx.click();
                  setHudTip({
                    title: `❖ 附魔灵材 · ${def.materialName}`,
                    body: `可在【洞府丹庐】熔入任意神通牌，赋予永久词条【${def.name}】：${def.description}`,
                  });
                }}
              >
                ❖ {def.materialName}
              </button>
            );
          })}
        </div>
      )}

      {/* 乾坤丹符详情与防误触确认弹窗 */}
      {selectedPouchDef && selectedPouchIdx !== null && (
        <div class="modal-backdrop" onClick={() => setSelectedPouchIdx(null)}>
          <div class="panel modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--gold-bright)' }}>
              {selectedPouchDef.icon} {selectedPouchDef.name}
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: 1.6 }}>{selectedPouchDef.description}</p>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
              {selectedPouchDef.passiveRevive
                ? '💡 被动护身灵符：受到致命伤害时自动替死生效，无需手动使用。'
                : canUsePouch
                  ? '⚡ 战斗中 0 真元瞬发，不占出牌回合！'
                  : '💡 请在进入斗法战斗后点击使用（0 真元瞬发）。'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" class="btn btn-sm" onClick={() => setSelectedPouchIdx(null)}>
                收起
              </button>
              {canUsePouch && !selectedPouchDef.passiveRevive && onUseConsumable && (
                <button
                  type="button"
                  class="btn btn-sm btn-primary confirm-pouch-btn"
                  onClick={() => {
                    const idx = selectedPouchIdx;
                    setSelectedPouchIdx(null);
                    sfx.heal();
                    onUseConsumable(idx);
                  }}
                >
                  ⚡ 立即使用
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 顶部古宝/状态轻触说明弹窗 */}
      {hudTip && (
        <div class="modal-backdrop" onClick={() => setHudTip(null)}>
          <div class="panel modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--gold-bright)' }}>{hudTip.title}</h3>
            <p style={{ margin: '0 0 14px', fontSize: '14px', lineHeight: 1.6, color: 'var(--text)' }}>{hudTip.body}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" class="btn btn-sm btn-primary" onClick={() => setHudTip(null)}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修仙专有名词白话速查 & 五行连招表 */}
      {glossaryOpen && (
        <div class="modal-backdrop" onClick={() => setGlossaryOpen(false)}>
          <div class="panel modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--gold-bright)' }}>📖 修仙词条白话指南 & 五行连招表</h3>
              <button type="button" class="btn btn-sm" onClick={() => setGlossaryOpen(false)}>
                关闭
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: 700, marginBottom: '6px' }}>
              ✦ 七大五行灵印连招（先打前牌留印，再打后牌自动爆发！）
            </div>
            <div class="glossary-grid" style={{ marginBottom: '14px' }}>
              {ALL_SEAL_RECIPES.map((r) => (
                <div key={r.name} class="glossary-item">
                  <strong>
                    {r.combo} · 【{r.name}】
                  </strong>
                  <span>{r.effect}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: 700, marginBottom: '6px' }}>
              ✦ 战斗专有名词白话速查
            </div>
            <div class="glossary-grid">
              {Object.values(KEYWORD_GLOSSARY).map((g) => (
                <div key={g.term} class="glossary-item">
                  <strong>{g.plainTitle}</strong>
                  <span>{g.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
