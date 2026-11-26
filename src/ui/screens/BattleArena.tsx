import { useRef, useState } from 'preact/hooks';
import { getRootById, LINEAGES } from '../../content/lineages';
import { TREASURES } from '../../content/treasures';
import {
  getCardCost,
  getCardDef,
  getEnemyCurrentIntent,
  previewResonance,
  SEAL_LABELS,
} from '../../core/combat-engine';
import type { ElementTag, RunState } from '../../core/types';
import { CardView, ELEMENT_COLORS } from '../components/CardView';
import { EnemyPortrait, PlayerPortrait } from '../components/Portraits';
import { sfx } from '../sfx';

interface FloatText {
  id: number;
  side: 'player' | 'enemy';
  text: string;
  tone: 'dmg' | 'shield' | 'heal' | 'poison' | 'life';
}

interface ActiveVfx {
  id: number;
  kind: 'slash' | 'thunder' | 'fire' | 'poison' | 'shield' | 'sha' | 'enemy-hit';
}

interface BattleArenaProps {
  run: RunState;
  onPlayCard: (cardUid: string) => void;
  onActivateTreasure: (treasureId: string) => void;
  onEndTurn: () => void;
  onClaimVictory: () => void;
  onAcceptDefeat: () => void;
}

export function BattleArena({
  run,
  onPlayCard,
  onActivateTreasure,
  onEndTurn,
  onClaimVictory,
  onAcceptDefeat,
}: BattleArenaProps) {
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'lunge' | 'hurt' | 'shield'>('idle');
  const [enemyAnim, setEnemyAnim] = useState<'idle' | 'hit' | 'lunge'>('idle');
  const [stageShake, setStageShake] = useState(false);
  const [vfx, setVfx] = useState<ActiveVfx | null>(null);
  const [resonanceBanner, setResonanceBanner] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [enemyTurnBusy, setEnemyTurnBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const vfxIdRef = useRef(1);

  const combat = run.combat!;
  const enemy = combat.enemy;
  const root = getRootById(run.rootId);
  const lineage = LINEAGES[run.lineage];
  const intent = getEnemyCurrentIntent(enemy.defId, enemy.intentIdx);

  const playerHpPct = Math.max(0, Math.min(100, Math.round((run.hp / run.maxHp) * 100)));
  const enemyHpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
  const intentDamage = intent?.damage
    ? Math.max(
        1,
        Math.floor(
          (intent.damage + enemy.strength + Math.floor(run.ascension / 2)) *
            (enemy.weak > 0 ? 0.75 : 1) *
            (combat.vulnerable > 0 ? 1.5 : 1),
        ),
      )
    : 0;

  const pushFloat = (side: 'player' | 'enemy', text: string, tone: FloatText['tone']) => {
    const id = ++vfxIdRef.current;
    setFloats((prev) => [...prev, { id, side, text, tone }]);
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 950);
  };

  const triggerVfx = (kind: ActiveVfx['kind']) => {
    const id = ++vfxIdRef.current;
    setVfx({ id, kind });
    setTimeout(() => {
      setVfx((prev) => (prev?.id === id ? null : prev));
    }, 500);
  };

  const triggerEffectVisuals = (
    element: ElementTag,
    isAttack: boolean,
    isDefense: boolean,
    isPoison: boolean,
    resName: string | null,
    lifeCost?: number,
  ) => {
    if (resName) {
      sfx.resonance();
      setResonanceBanner(resName);
      setStageShake(true);
      setTimeout(() => setStageShake(false), 300);
      setTimeout(() => setResonanceBanner(null), 1100);
    } else if (isDefense && !isAttack) {
      sfx.shield();
    } else if (element === 'thunder') {
      sfx.thunder();
    } else {
      sfx.slash();
    }

    if (lifeCost) pushFloat('player', `🔥 -${lifeCost}年`, 'life');

    if (isAttack || isPoison) {
      setPlayerAnim('lunge');
      setEnemyAnim('hit');
      setTimeout(() => setPlayerAnim('idle'), 260);
      setTimeout(() => setEnemyAnim('idle'), 300);
      if (element === 'thunder') {
        triggerVfx('thunder');
        setStageShake(true);
        setTimeout(() => setStageShake(false), 240);
      } else if (element === 'sha') {
        triggerVfx('sha');
      } else if (isPoison || element === 'wood') {
        triggerVfx('poison');
      } else if (element === 'fire') {
        triggerVfx('fire');
      } else {
        triggerVfx('slash');
      }
      if (isAttack) pushFloat('enemy', '⚔️ 斩击', 'dmg');
      if (isPoison) pushFloat('enemy', '☠ 丹毒', 'poison');
    } else if (isDefense) {
      setPlayerAnim('shield');
      triggerVfx('shield');
      pushFloat('player', '🛡 罡气', 'shield');
      setTimeout(() => setPlayerAnim('idle'), 320);
    } else {
      setPlayerAnim('shield');
      pushFloat('player', '✦ 运功', 'heal');
      setTimeout(() => setPlayerAnim('idle'), 240);
    }
  };

  const handleCardClick = (uid: string) => {
    if (enemyTurnBusy) return;
    const inst = combat.hand.find((c) => c.uid === uid);
    if (!inst) return;
    const def = getCardDef(inst.defId);
    const res = previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus));
    triggerEffectVisuals(
      def.element,
      def.type === 'attack' || def.type === 'forbidden' || Boolean(def.effect.damage),
      def.type === 'defense' || Boolean(def.effect.block),
      Boolean(def.effect.poison || def.effect.detonatePoison),
      res ? res.name : null,
      def.effect.lifeCost,
    );
    onPlayCard(uid);
  };

  const handleTreasureClick = (tid: string) => {
    if (enemyTurnBusy) return;
    const tDef = TREASURES[tid];
    if (!tDef) return;
    sfx.thunder();
    triggerEffectVisuals(
      tDef.effect.extraSeal ?? 'thunder',
      Boolean(tDef.effect.damage),
      Boolean(tDef.effect.block),
      Boolean(tDef.effect.poison),
      `法宝 · ${tDef.name}`,
    );
    onActivateTreasure(tid);
  };

  const handleEndTurnClick = () => {
    if (enemyTurnBusy || combat.outcome !== 'ongoing') return;
    sfx.click();
    setEnemyTurnBusy(true);
    setEnemyAnim('lunge');
    if (intent?.damage) {
      triggerVfx(enemy.artStyle === 'thunder' ? 'thunder' : 'enemy-hit');
      setPlayerAnim('hurt');
      setStageShake(true);
      const totalIn = intentDamage * (intent.hits ?? 1);
      pushFloat(
        'player',
        combat.block >= totalIn ? `🛡 格挡 ${totalIn}` : `💥 -${totalIn - combat.block}`,
        combat.block >= totalIn ? 'shield' : 'dmg',
      );
      if (enemy.artStyle === 'thunder') sfx.thunder();
      else sfx.slash();
    } else {
      pushFloat('enemy', `✦ ${intent?.label ?? '蓄势'}`, 'shield');
    }

    setTimeout(() => {
      setEnemyAnim('idle');
      setPlayerAnim('idle');
      setStageShake(false);
      onEndTurn();
      setEnemyTurnBusy(false);
    }, 340);
  };

  const handLen = combat.hand.length;

  return (
    <main class={`battle-one-screen${stageShake ? ' stage-shake' : ''}`}>
      {/* ==================== 上半屏：高清立绘对峙舞台 + 中枢真元灵印 ==================== */}
      <section class="panel duel-arena one-screen-arena">
        {/* 特效层 */}
        {vfx && (
          <div key={vfx.id} class={`vfx-layer vfx-${vfx.kind}`} aria-hidden="true">
            {vfx.kind === 'slash' && (
              <svg viewBox="0 0 320 180" class="vfx-svg">
                <path d="M50 150 Q160 20 280 50" fill="none" stroke="#fae0ae" stroke-width="10" stroke-linecap="round" class="vfx-slash-path" />
                <path d="M80 160 Q180 40 290 70" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" class="vfx-slash-path" />
              </svg>
            )}
            {vfx.kind === 'thunder' && (
              <svg viewBox="0 0 320 200" class="vfx-svg">
                <path d="M180 0 L140 72 L186 72 L134 190" fill="none" stroke="#f2e6ff" stroke-width="9" stroke-linejoin="round" />
                <path d="M180 0 L140 72 L186 72 L134 190" fill="none" stroke="#b68cff" stroke-width="4" stroke-linejoin="round" />
              </svg>
            )}
            {(vfx.kind === 'poison' || vfx.kind === 'fire' || vfx.kind === 'sha') && (
              <div class={`vfx-burst burst-${vfx.kind}`} />
            )}
            {vfx.kind === 'shield' && <div class="vfx-shield-ring" />}
            {vfx.kind === 'enemy-hit' && <div class="vfx-enemy-slash" />}
          </div>
        )}

        {resonanceBanner && (
          <div class="resonance-flash-banner">✦ {resonanceBanner} ✦</div>
        )}

        {/* 胜负覆层（不挤占布局高度，直接浮于舞台中央） */}
        {combat.outcome !== 'ongoing' && (
          <div class="outcome-overlay">
            <div class="panel outcome-card">
              {combat.outcome === 'defeat' ? (
                <>
                  <h2 style={{ margin: '0 0 6px', color: 'var(--red)' }}>道消身陨 · 此世终结</h2>
                  <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '13px' }}>{run.deathCause}</p>
                  <button type="button" class="btn btn-danger" onClick={onAcceptDefeat}>
                    步入轮回结算
                  </button>
                </>
              ) : (
                <>
                  <h2 style={{ margin: '0 0 8px', color: 'var(--gold-bright)' }}>
                    {combat.outcome === 'tribulation-survived' ? '九霄雷散 · 渡劫成功！' : '斗法大胜 · 斩获机缘！'}
                  </h2>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      sfx.victory();
                      onClaimVictory();
                    }}
                  >
                    收取战利品与道基
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 左侧：我方高清立绘 */}
        <div class={`combatant player-side anim-${playerAnim}`}>
          <div class="float-layer">
            {floats.filter((f) => f.side === 'player').map((f) => (
              <span key={f.id} class={`float-num tone-${f.tone}`}>{f.text}</span>
            ))}
          </div>

          <div class="portrait-wrap">
            <PlayerPortrait
              lineage={run.lineage}
              hasBlock={combat.block > 0}
              swordIntent={combat.swordIntent}
              arrayCount={combat.arrays.length}
            />
          </div>

          <div class="fighter-plate">
            <div class="fighter-name">
              <strong>{run.name}</strong>
              <small>{lineage.sect}</small>
            </div>
            <div class="bar-track">
              <div class="bar-fill hp" style={{ width: `${playerHpPct}%` }} />
            </div>
            <div class="fighter-hp-line">
              <span>❤ {run.hp}/{run.maxHp}</span>
              <span style={{ color: '#8fd2ff' }}>🛡 {combat.block}{combat.retainBlockThisTurn ? '(留)' : ''}</span>
            </div>
            <div class="status-row">
              {combat.swordIntent > 0 && <span class="status-tag intent">⚔剑{combat.swordIntent}</span>}
              {combat.vulnerable > 0 && <span class="status-tag vuln">💔破{combat.vulnerable}</span>}
              {combat.weak > 0 && <span class="status-tag">🌀虚{combat.weak}</span>}
              {combat.arrays.map((a) => (
                <span key={a.id} class="status-tag intent">✡{a.name.slice(0, 4)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 中枢：真元灵珠 + 五行灵印 + 回合 + 精简战报 */}
        <div class="center-console">
          <div class="center-top-row">
            <span class="turn-badge">第 {combat.turn} 回合</span>
            {enemy.tribulationWave && enemy.tribulationMaxWaves && (
              <span class="trib-pill">⚡ {enemy.tribulationWave}/{enemy.tribulationMaxWaves} 劫</span>
            )}
          </div>

          <div class="qi-and-seals">
            <div class="qi-orb compact-orb" title="每回合恢复的通用真元">
              <span>{combat.qi}/{combat.maxQi}</span>
              <small>真元</small>
            </div>
            <div class="seal-bar">
              {[0, 1, 2].map((idx) => {
                const seal = combat.seals[idx];
                return (
                  <span
                    key={idx}
                    class={`seal-slot compact-seal${seal ? ' filled' : ''}`}
                    style={seal ? { color: ELEMENT_COLORS[seal], borderColor: ELEMENT_COLORS[seal] } : undefined}
                    title={seal ? `${SEAL_LABELS[seal]}印` : '空灵印槽'}
                  >
                    {seal ? SEAL_LABELS[seal] : '·'}
                  </span>
                );
              })}
            </div>
          </div>

          <button type="button" class="log-ticker" onClick={() => setLogOpen(true)} title="点击查看完整战报">
            📜 {combat.combatLog[0] ?? '斗法开始'}
          </button>
        </div>

        {/* 右侧：敌方高清立绘 */}
        <div class={`combatant enemy-side anim-${enemyAnim}`}>
          <div class="float-layer">
            {floats.filter((f) => f.side === 'enemy').map((f) => (
              <span key={f.id} class={`float-num tone-${f.tone}`}>{f.text}</span>
            ))}
          </div>

          {intent && combat.outcome === 'ongoing' && (
            <div class="intent-bubble">
              <span class="intent-b-title">{intent.label}</span>
              <strong class="intent-b-val">
                {intent.damage
                  ? `⚔️${intentDamage}${intent.hits && intent.hits > 1 ? `×${intent.hits}` : ''}`
                  : intent.block
                    ? `🛡+${intent.block}`
                    : '✦蓄势'}
              </strong>
            </div>
          )}

          <div class="portrait-wrap">
            <EnemyPortrait
              artStyle={enemy.artStyle}
              hasBlock={enemy.block > 0}
              isPoisoned={enemy.poison > 0}
            />
          </div>

          <div class="fighter-plate">
            <div class="fighter-name">
              <strong>{enemy.name}</strong>
              <small>{enemy.title.slice(0, 8)}</small>
            </div>
            <div class="bar-track">
              <div class="bar-fill hp" style={{ width: `${enemyHpPct}%` }} />
            </div>
            <div class="fighter-hp-line">
              <span>❤ {enemy.hp}/{enemy.maxHp}</span>
              {enemy.block > 0 && <span style={{ color: '#8fd2ff' }}>🛡 {enemy.block}</span>}
            </div>
            <div class="status-row">
              {enemy.poison > 0 && <span class="status-tag poison">☠毒{enemy.poison}</span>}
              {enemy.vulnerable > 0 && <span class="status-tag vuln">💔破{enemy.vulnerable}</span>}
              {enemy.weak > 0 && <span class="status-tag">🌀虚{enemy.weak}</span>}
              {enemy.strength > 0 && <span class="status-tag vuln">🔥+{enemy.strength}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 下半屏：单排横滑实体卡牌 + 右侧法宝/结束回合操作台 ==================== */}
      <section class="hand-dock">
        <div class="hand-scroll-zone">
          <div class="tcg-hand-fan one-row-hand">
            {combat.hand.map((inst, i) => {
              const def = getCardDef(inst.defId);
              const cost = getCardCost(inst);
              const playable = combat.outcome === 'ongoing' && !enemyTurnBusy && combat.qi >= cost;
              const res = playable ? previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus)) : null;
              const mid = (handLen - 1) / 2;
              const offset = i - mid;
              const deg = Math.max(-7, Math.min(7, offset * 2.1));
              const drop = Math.abs(offset) * 3;
              return (
                <CardView
                  key={inst.uid}
                  instance={inst}
                  disabled={!playable}
                  resonanceHint={res ? res.name : null}
                  fanStyle={{ '--fan-rot': `${deg}deg`, '--fan-y': `${drop}px` }}
                  onClick={() => handleCardClick(inst.uid)}
                />
              );
            })}
          </div>
        </div>

        <aside class="action-dock panel">
          <div class="pile-mini">
            <span>抽 {combat.drawPile.length}</span>
            <span>弃 {combat.discardPile.length}</span>
          </div>
          {run.treasures.map((tid) => {
            const tDef = TREASURES[tid];
            if (!tDef) return null;
            const charge = combat.treasureCharges[tid] ?? 0;
            const ready = charge >= tDef.maxCharge && combat.outcome === 'ongoing' && !enemyTurnBusy;
            return (
              <button
                key={tid}
                type="button"
                class={`treasure-btn compact-treasure${ready ? ' ready' : ''}`}
                disabled={!ready}
                title={tDef.description}
                onClick={() => handleTreasureClick(tid)}
              >
                <div>🏺 {tDef.name.slice(0, 5)}</div>
                <small>{ready ? '✦ 祭出' : `${charge}/${tDef.maxCharge}`}</small>
              </button>
            );
          })}
          <button
            type="button"
            class="btn btn-primary end-turn-btn"
            disabled={combat.outcome !== 'ongoing' || enemyTurnBusy}
            onClick={handleEndTurnClick}
          >
            {enemyTurnBusy ? '敌动中' : '结束回合'}
          </button>
        </aside>
      </section>

      {/* 完整战报弹窗 */}
      {logOpen && (
        <div class="modal-backdrop" onClick={() => setLogOpen(false)}>
          <div class="panel modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--gold-bright)' }}>本场斗法战报</h3>
              <button type="button" class="btn btn-sm" onClick={() => setLogOpen(false)}>关闭</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--muted)' }}>
              {combat.combatLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
