import { useState } from 'preact/hooks';
import { getRootById } from '../../content/lineages';
import { TREASURES } from '../../content/treasures';
import {
  getCardCost,
  getCardDef,
  getEnemyCurrentIntent,
  previewResonance,
  SEAL_LABELS,
} from '../../core/combat-engine';
import type { RunState } from '../../core/types';
import { CardView, ELEMENT_COLORS } from '../components/CardView';
import { sfx } from '../sfx';

const ART_EMOJIS = {
  beast: '🐺',
  cultivator: '🗡️',
  demon: '👹',
  thunder: '⛈️',
  celestial: '☀️',
};

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
  const [hitFlash, setHitFlash] = useState(false);
  const combat = run.combat!;
  const enemy = combat.enemy;
  const root = getRootById(run.rootId);
  const intent = getEnemyCurrentIntent(enemy.defId, enemy.intentIdx);

  const hpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
  const intentDamage = intent?.damage
    ? Math.max(1, Math.floor((intent.damage + enemy.strength + Math.floor(run.ascension / 2)) * (enemy.weak > 0 ? 0.75 : 1) * (combat.vulnerable > 0 ? 1.5 : 1)))
    : 0;

  const handleCardClick = (uid: string) => {
    const inst = combat.hand.find((c) => c.uid === uid);
    if (!inst) return;
    const def = getCardDef(inst.defId);
    const res = previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus));
    if (res) sfx.resonance();
    else if (def.type === 'defense') sfx.shield();
    else sfx.slash();

    if (def.type === 'attack' || def.type === 'forbidden') {
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 260);
    }
    onPlayCard(uid);
  };

  return (
    <main class="battle-stage">
      {/* 上半区：敌方 / 天劫舞台 */}
      <section class={`panel enemy-zone${hitFlash ? ' hit-flash' : ''}`}>
        <div class="enemy-sigil">{ART_EMOJIS[enemy.artStyle]}</div>
        <div class="enemy-info">
          <h2>{enemy.name}</h2>
          <div class="enemy-subtitle">{enemy.title} · 第 {combat.turn} 回合</div>
          <div class="bar-track">
            <div class="bar-fill hp" style={{ width: `${hpPct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
            <span>真元气血：{enemy.hp} / {enemy.maxHp}</span>
            {enemy.block > 0 && <span style={{ color: '#8fd2ff' }}>🛡 护盾 {enemy.block}</span>}
          </div>

          {enemy.tribulationWave && enemy.tribulationMaxWaves && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#d2b8ff', marginBottom: '3px' }}>
                ⚡ 渡劫进度：第 {enemy.tribulationWave} / {enemy.tribulationMaxWaves} 重劫雷（撑过全部劫雷即可破境，劈碎劫眼额外获三界道果！）
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill tribulation"
                  style={{ width: `${Math.round((enemy.tribulationWave / enemy.tribulationMaxWaves) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div class="status-row">
            {enemy.poison > 0 && <span class="status-tag poison">☠ 丹毒 {enemy.poison}</span>}
            {enemy.vulnerable > 0 && <span class="status-tag vuln">💔 破绽 {enemy.vulnerable}</span>}
            {enemy.weak > 0 && <span class="status-tag">🌀 虚弱 {enemy.weak}</span>}
            {enemy.strength > 0 && <span class="status-tag vuln">🔥 杀意 +{enemy.strength}</span>}
          </div>
        </div>

        {intent && combat.outcome === 'ongoing' && (
          <div class="intent-box">
            <div class="intent-label">下回合意图 · {intent.label}</div>
            <div class="intent-val">
              {intent.damage
                ? `⚔️ ${intentDamage}${intent.hits && intent.hits > 1 ? ` × ${intent.hits}` : ''}`
                : intent.block
                  ? `🛡 护盾 +${intent.block}`
                  : '✦ 蓄势'}
            </div>
            {intent.addCurse && <div style={{ fontSize: '11px', color: '#ff9c8a' }}>将塞入【心魔低语】</div>}
          </div>
        )}
      </section>

      {/* 胜负即时结算横幅 */}
      {combat.outcome !== 'ongoing' && (
        <section class="panel" style={{ padding: '18px', textAlign: 'center', borderColor: 'var(--gold-bright)' }}>
          {combat.outcome === 'defeat' ? (
            <>
              <h2 style={{ margin: '0 0 8px', color: 'var(--red)' }}>道消身陨 · 此世终结</h2>
              <p style={{ margin: '0 0 14px', color: 'var(--muted)' }}>{run.deathCause}</p>
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

      {/* 中枢区：真元 + 我方状态 + 灵印槽 + 法宝 */}
      <section class="panel player-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div class="qi-orb" title="每回合恢复的通用真元">
            <span>{combat.qi}/{combat.maxQi}</span>
            <small>真元</small>
          </div>
          <div>
            <div class="status-row" style={{ marginTop: 0 }}>
              <span class="status-tag block">🛡 罡气 {combat.block}{combat.retainBlockThisTurn ? ' (留存)' : ''}</span>
              {combat.swordIntent > 0 && <span class="status-tag intent">⚔ 剑意 {combat.swordIntent}</span>}
              {combat.vulnerable > 0 && <span class="status-tag vuln">💔 破绽 {combat.vulnerable}</span>}
              {combat.weak > 0 && <span class="status-tag">🌀 虚弱 {combat.weak}</span>}
              {combat.arrays.map((a) => (
                <span key={a.id} class="status-tag intent">
                  ✡ {a.name}
                </span>
              ))}
            </div>
            <div class="seal-bar" style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>灵印槽：</span>
              {[0, 1, 2].map((idx) => {
                const seal = combat.seals[idx];
                return (
                  <span
                    key={idx}
                    class={`seal-slot${seal ? ' filled' : ''}`}
                    style={seal ? { color: ELEMENT_COLORS[seal], borderColor: ELEMENT_COLORS[seal] } : undefined}
                    title={seal ? `${SEAL_LABELS[seal]}印（与相生属性出牌触发共鸣）` : '空灵印槽'}
                  >
                    {seal ? SEAL_LABELS[seal] : '·'}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div class="treasure-row">
          {run.treasures.map((tid) => {
            const tDef = TREASURES[tid];
            if (!tDef) return null;
            const charge = combat.treasureCharges[tid] ?? 0;
            const ready = charge >= tDef.maxCharge && combat.outcome === 'ongoing';
            return (
              <button
                key={tid}
                type="button"
                class={`treasure-btn${ready ? ' ready' : ''}`}
                disabled={!ready}
                title={tDef.description}
                onClick={() => {
                  sfx.thunder();
                  onActivateTreasure(tid);
                }}
              >
                <div>🏺 {tDef.name}</div>
                <div style={{ fontSize: '11px', color: ready ? '#ffe59c' : 'var(--muted)' }}>
                  {ready ? '✦ 点击祭出法宝' : `充能 ${charge}/${tDef.maxCharge}`}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            class="btn btn-primary"
            disabled={combat.outcome !== 'ongoing'}
            onClick={() => {
              sfx.click();
              onEndTurn();
            }}
          >
            结束回合 ⏭
          </button>
        </div>
      </section>

      {combat.lastResonance && (
        <div class="resonance-toast">
          ✦ 灵印共鸣 · <strong>{combat.lastResonance.name}</strong>：{combat.lastResonance.detail}
        </div>
      )}

      {/* 下半区：神通手牌 */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          <span>神通手牌（高亮金框代表打出将触发【灵印相生共鸣】）</span>
          <span>抽牌堆 {combat.drawPile.length} · 弃牌堆 {combat.discardPile.length} · 消耗 {combat.exhaustPile.length}</span>
        </div>
        <div class="hand-grid">
          {combat.hand.map((inst) => {
            const def = getCardDef(inst.defId);
            const cost = getCardCost(inst);
            const playable = combat.outcome === 'ongoing' && combat.qi >= cost;
            const res = playable ? previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus)) : null;
            return (
              <CardView
                key={inst.uid}
                instance={inst}
                disabled={!playable}
                resonanceHint={res ? res.name : null}
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
