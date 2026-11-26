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
    }, 520);
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
      setTimeout(() => setStageShake(false), 320);
      setTimeout(() => setResonanceBanner(null), 1200);
    } else if (isDefense && !isAttack) {
      sfx.shield();
    } else if (element === 'thunder') {
      sfx.thunder();
    } else {
      sfx.slash();
    }

    if (lifeCost) pushFloat('player', `🔥 燃寿 -${lifeCost}年`, 'life');

    if (isAttack || isPoison) {
      setPlayerAnim('lunge');
      setEnemyAnim('hit');
      setTimeout(() => setPlayerAnim('idle'), 280);
      setTimeout(() => setEnemyAnim('idle'), 320);
      if (element === 'thunder') {
        triggerVfx('thunder');
        setStageShake(true);
        setTimeout(() => setStageShake(false), 260);
      } else if (element === 'sha') {
        triggerVfx('sha');
      } else if (isPoison || element === 'wood') {
        triggerVfx('poison');
      } else if (element === 'fire') {
        triggerVfx('fire');
      } else {
        triggerVfx('slash');
      }
      if (isAttack) pushFloat('enemy', '⚔️ 斩击！', 'dmg');
      if (isPoison) pushFloat('enemy', '☠ 丹毒', 'poison');
    } else if (isDefense) {
      setPlayerAnim('shield');
      triggerVfx('shield');
      pushFloat('player', '🛡 护体罡气', 'shield');
      setTimeout(() => setPlayerAnim('idle'), 340);
    } else {
      setPlayerAnim('shield');
      pushFloat('player', '✦ 运转真元', 'heal');
      setTimeout(() => setPlayerAnim('idle'), 260);
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
      `祭出法宝 · ${tDef.name}`,
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
      pushFloat('player', combat.block >= totalIn ? `🛡 格挡 ${totalIn}` : `💥 受创 -${totalIn - combat.block}`, combat.block >= totalIn ? 'shield' : 'dmg');
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
    }, 360);
  };

  const handLen = combat.hand.length;

  return (
    <main class={`battle-stage${stageShake ? ' stage-shake' : ''}`}>
      {/* ==================== 仙侠双人对峙舞台 ==================== */}
      <section class="panel duel-arena">
        {/* 舞台中央特效层 */}
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

        {/* 灵印共鸣书法大字横幅 */}
        {resonanceBanner && (
          <div class="resonance-flash-banner">
            ✦ {resonanceBanner} ✦
          </div>
        )}

        {/* 左侧：我方修士 */}
        <div class={`combatant player-side anim-${playerAnim}`}>
          <div class="float-layer">
            {floats
              .filter((f) => f.side === 'player')
              .map((f) => (
                <span key={f.id} class={`float-num tone-${f.tone}`}>
                  {f.text}
                </span>
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
              <span style={{ color: '#8fd2ff' }}>🛡 罡气 {combat.block}{combat.retainBlockThisTurn ? ' (留)' : ''}</span>
            </div>
            <div class="status-row">
              {combat.swordIntent > 0 && <span class="status-tag intent">⚔ 剑意 {combat.swordIntent}</span>}
              {combat.vulnerable > 0 && <span class="status-tag vuln">💔 破绽 {combat.vulnerable}</span>}
              {combat.weak > 0 && <span class="status-tag">🌀 虚弱 {combat.weak}</span>}
              {combat.arrays.map((a) => (
                <span key={a.id} class="status-tag intent">✡ {a.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 中央回合与对峙徽记 */}
        <div class="vs-center">
          <div class="turn-badge">第 {combat.turn} 回合</div>
          <div class="vs-glyph">⚔</div>
          {enemy.tribulationWave && enemy.tribulationMaxWaves && (
            <div class="trib-pill">
              ⚡ 第 {enemy.tribulationWave}/{enemy.tribulationMaxWaves} 劫
            </div>
          )}
        </div>

        {/* 右侧：敌方 / 天劫 */}
        <div class={`combatant enemy-side anim-${enemyAnim}`}>
          <div class="float-layer">
            {floats
              .filter((f) => f.side === 'enemy')
              .map((f) => (
                <span key={f.id} class={`float-num tone-${f.tone}`}>
                  {f.text}
                </span>
              ))}
          </div>

          {intent && combat.outcome === 'ongoing' && (
            <div class="intent-bubble">
              <span class="intent-b-title">{intent.label}</span>
              <strong class="intent-b-val">
                {intent.damage
                  ? `⚔️ ${intentDamage}${intent.hits && intent.hits > 1 ? `×${intent.hits}` : ''}`
                  : intent.block
                    ? `🛡 +${intent.block}`
                    : '✦ 蓄势'}
              </strong>
              {intent.addCurse && <small style={{ color: '#ff9c8a' }}>塞入心魔</small>}
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
              <small>{enemy.title}</small>
            </div>
            <div class="bar-track">
              <div class="bar-fill hp" style={{ width: `${enemyHpPct}%` }} />
            </div>
            <div class="fighter-hp-line">
              <span>❤ {enemy.hp}/{enemy.maxHp}</span>
              {enemy.block > 0 && <span style={{ color: '#8fd2ff' }}>🛡 护盾 {enemy.block}</span>}
            </div>
            <div class="status-row">
              {enemy.poison > 0 && <span class="status-tag poison">☠ 丹毒 {enemy.poison}</span>}
              {enemy.vulnerable > 0 && <span class="status-tag vuln">💔 破绽 {enemy.vulnerable}</span>}
              {enemy.weak > 0 && <span class="status-tag">🌀 虚弱 {enemy.weak}</span>}
              {enemy.strength > 0 && <span class="status-tag vuln">🔥 杀意 +{enemy.strength}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* 胜负结算横幅 */}
      {combat.outcome !== 'ongoing' && (
        <section class="panel" style={{ padding: '16px', textAlign: 'center', borderColor: 'var(--gold-bright)' }}>
          {combat.outcome === 'defeat' ? (
            <>
              <h2 style={{ margin: '0 0 8px', color: 'var(--red)' }}>道消身陨 · 此世终结</h2>
              <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>{run.deathCause}</p>
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
        </section>
      )}

      {/* ==================== 真元 + 灵印槽 + 法宝控制带 ==================== */}
      <section class="panel player-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div class="qi-orb" title="每回合恢复的通用真元">
            <span>{combat.qi}/{combat.maxQi}</span>
            <small>真元</small>
          </div>
          <div class="seal-bar">
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>五行灵印：</span>
            {[0, 1, 2].map((idx) => {
              const seal = combat.seals[idx];
              return (
                <span
                  key={idx}
                  class={`seal-slot${seal ? ' filled' : ''}`}
                  style={seal ? { color: ELEMENT_COLORS[seal], borderColor: ELEMENT_COLORS[seal] } : undefined}
                  title={seal ? `${SEAL_LABELS[seal]}印（与相生属性牌触发共鸣）` : '空灵印槽'}
                >
                  {seal ? SEAL_LABELS[seal] : '·'}
                </span>
              );
            })}
          </div>
        </div>

        <div class="treasure-row">
          {run.treasures.map((tid) => {
            const tDef = TREASURES[tid];
            if (!tDef) return null;
            const charge = combat.treasureCharges[tid] ?? 0;
            const ready = charge >= tDef.maxCharge && combat.outcome === 'ongoing' && !enemyTurnBusy;
            return (
              <button
                key={tid}
                type="button"
                class={`treasure-btn${ready ? ' ready' : ''}`}
                disabled={!ready}
                title={tDef.description}
                onClick={() => handleTreasureClick(tid)}
              >
                <div>🏺 {tDef.name}</div>
                <div style={{ fontSize: '11px', color: ready ? '#ffe59c' : 'var(--muted)' }}>
                  {ready ? '✦ 点击祭出' : `充能 ${charge}/${tDef.maxCharge}`}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            class="btn btn-primary"
            disabled={combat.outcome !== 'ongoing' || enemyTurnBusy}
            onClick={handleEndTurnClick}
          >
            {enemyTurnBusy ? '敌方出手...' : '结束回合 ⏭'}
          </button>
        </div>
      </section>

      {/* ==================== 扇形实体 TCG 手牌区 ==================== */}
      <section class="hand-tray">
        <div class="hand-meta">
          <span>神通手牌（流光金框牌打出将触发【灵印相生共鸣】）</span>
          <span>抽牌堆 {combat.drawPile.length} · 弃牌堆 {combat.discardPile.length} · 消耗 {combat.exhaustPile.length}</span>
        </div>
        <div class="tcg-hand-fan">
          {combat.hand.map((inst, i) => {
            const def = getCardDef(inst.defId);
            const cost = getCardCost(inst);
            const playable = combat.outcome === 'ongoing' && !enemyTurnBusy && combat.qi >= cost;
            const res = playable ? previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus)) : null;
            const mid = (handLen - 1) / 2;
            const offset = i - mid;
            const deg = Math.max(-10, Math.min(10, offset * 2.6));
            const drop = Math.abs(offset) * 4;
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
      </section>

      {/* 战报简录 */}
      <section class="panel battle-log">
        {combat.combatLog.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </section>
    </main>
  );
}
