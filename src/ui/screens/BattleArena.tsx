import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ALL_SEAL_RECIPES,
  describeStatusTag,
  extractCardGlossary,
} from '../../content/glossary';
import { getRootById, LINEAGES } from '../../content/lineages';
import { ENCHANTS, TREASURES } from '../../content/treasures';
import {
  getCardCost,
  getCardDef,
  getCardDescription,
  getCardDisplayName,
  getEnemyCurrentIntent,
  previewResonance,
  SEAL_LABELS,
} from '../../core/combat-engine';
import type { ElementTag, RunState } from '../../core/types';
import { CardView, ELEMENT_COLORS } from '../components/CardView';
import { EnemyPortrait, PlayerPortrait } from '../components/Portraits';
import { sfx } from '../sfx';

const TIP_SEEN_KEY = 'baishi-wending-tip-v92';

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

interface ActiveTip {
  title: string;
  body: string;
  recipes?: typeof ALL_SEAL_RECIPES;
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
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState<ActiveTip | null>(null);
  const [showOnboardTip, setShowOnboardTip] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TIP_SEEN_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const vfxIdRef = useRef(1);

  const combat = run.combat!;
  const enemy = combat.enemy;
  const root = getRootById(run.rootId);
  const lineage = LINEAGES[run.lineage];
  const intent = getEnemyCurrentIntent(enemy.defId, enemy.intentIdx, enemy.phase2Triggered);

  useEffect(() => {
    if (combat.outcome !== 'ongoing') {
      setSelectedCardUid(null);
      setActiveTip(null);
    }
  }, [combat.outcome]);

  useEffect(() => {
    if (combat.phase2Banner) {
      sfx.breakthrough();
      setResonanceBanner(combat.phase2Banner);
      setStageShake(true);
      const t1 = setTimeout(() => setStageShake(false), 360);
      const t2 = setTimeout(() => setResonanceBanner(null), 1500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [combat.phase2Banner]);

  const dismissOnboardTip = () => {
    setShowOnboardTip(false);
    try {
      localStorage.setItem(TIP_SEEN_KEY, '1');
    } catch {}
  };

  const openTip = (tip: ActiveTip) => {
    sfx.click();
    setSelectedCardUid(null);
    setActiveTip(tip);
  };

  const playerHpPct = Math.max(0, Math.min(100, Math.round((run.hp / run.maxHp) * 100)));
  const enemyHpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
  const intentDamage = intent?.damage
    ? Math.max(
        1,
        Math.floor(
          (intent.damage + enemy.strength + Math.floor(run.ascension / 2)) *
            (enemy.weak > 0 ? 0.75 : 1) *
            (combat.enemyDmgWeakenPct > 0 ? 1 - combat.enemyDmgWeakenPct / 100 : 1) *
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
    hpBurnText?: string,
  ) => {
    sfx.playElemental(element, isAttack, isDefense, isPoison);
    if (resName) {
      sfx.resonance();
      setResonanceBanner(resName);
      setStageShake(true);
      setTimeout(() => setStageShake(false), 300);
      setTimeout(() => setResonanceBanner(null), 1100);
    }

    if (hpBurnText) pushFloat('player', hpBurnText, 'life');

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

  const canPlayInstance = (uid: string): boolean => {
    if (enemyTurnBusy || combat.outcome !== 'ongoing') return false;
    const inst = combat.hand.find((c) => c.uid === uid);
    if (!inst) return false;
    const def = getCardDef(inst.defId);
    if (def.type === 'curse') return false;
    const cost = getCardCost(inst);
    return combat.qi >= cost;
  };

  const executePlayCard = (uid: string) => {
    if (!canPlayInstance(uid)) return;
    const inst = combat.hand.find((c) => c.uid === uid);
    if (!inst) return;
    const def = getCardDef(inst.defId);
    const res = previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus));
    const burnText = def.effect.maxHpCost
      ? `🩸 -${def.effect.maxHpCost}上限`
      : def.effect.selfHpCost
        ? `🩸 -${def.effect.selfHpCost}气血`
        : undefined;

    setSelectedCardUid(null);
    setActiveTip(null);
    triggerEffectVisuals(
      def.element,
      def.type === 'attack' || def.type === 'forbidden' || Boolean(def.effect.damage || def.effect.detonateAllArrays),
      def.type === 'defense' || Boolean(def.effect.block),
      Boolean(def.effect.poison || def.effect.detonatePoison || def.effect.xPoisonDetonate),
      res ? res.name : null,
      burnText,
    );
    onPlayCard(uid);
  };

  const handleCardTap = (uid: string) => {
    if (enemyTurnBusy || combat.outcome !== 'ongoing') return;
    setActiveTip(null);
    if (selectedCardUid === uid) {
      if (canPlayInstance(uid)) {
        executePlayCard(uid);
      }
      return;
    }
    sfx.click();
    setSelectedCardUid(uid);
  };

  const handleTreasureClick = (tid: string, ready: boolean, charge: number) => {
    if (enemyTurnBusy) return;
    const tDef = TREASURES[tid];
    if (!tDef) return;
    if (!ready) {
      openTip({
        title: `🏺 本命法宝 · ${tDef.name}（充能 ${charge}/${tDef.maxCharge}）`,
        body: `${tDef.description} —— 每打出 1 张神通牌自动充能 +1，充满后点击即可 0 真元释放！`,
      });
      return;
    }
    setSelectedCardUid(null);
    setActiveTip(null);
    sfx.treasure();
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
    setSelectedCardUid(null);
    setActiveTip(null);
    sfx.click();
    setEnemyTurnBusy(true);
    setEnemyAnim('lunge');
    if (intent?.damage) {
      triggerVfx(enemy.artStyle === 'thunder' ? 'thunder' : 'enemy-hit');
      setPlayerAnim('hurt');
      setStageShake(true);
      const totalIn = intentDamage * (intent.hits ?? 1);
      const fullyBlocked = combat.block >= totalIn;
      pushFloat(
        'player',
        fullyBlocked ? `🛡 格挡 ${totalIn}` : `💥 -${totalIn - combat.block}`,
        fullyBlocked ? 'shield' : 'dmg',
      );
      if (enemy.artStyle === 'thunder') sfx.thunder();
      if (fullyBlocked) sfx.blockHit();
      else sfx.hurt();
    } else {
      sfx.shield();
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
  const selectedInst = selectedCardUid ? combat.hand.find((c) => c.uid === selectedCardUid) ?? null : null;
  const selectedDef = selectedInst ? getCardDef(selectedInst.defId) : null;
  const selectedPlayable = selectedInst ? canPlayInstance(selectedInst.uid) : false;
  const selectedRes =
    selectedInst && selectedDef
      ? previewResonance(combat.seals, selectedDef.element, Boolean(root.mixedFiveBonus))
      : null;
  const selectedGlossary = selectedInst ? extractCardGlossary(selectedInst) : null;
  const selectedEnchant = selectedInst?.enchant ? ENCHANTS[selectedInst.enchant] : null;

  return (
    <main class={`battle-one-screen${stageShake ? ' stage-shake' : ''}`}>
      <section class="panel duel-arena one-screen-arena">
        {/* 首次进战一句话轻提示 */}
        {showOnboardTip && combat.outcome === 'ongoing' && (
          <div class="onboard-banner">
            <span>💡 轻触手牌可预览白话词条，再点一次打出；点任意图标可看说明</span>
            <button type="button" class="btn btn-sm" onClick={dismissOnboardTip}>
              明白
            </button>
          </div>
        )}

        {/* 轻触状态/灵印/敌方意图白话气泡层（绝对定位，绝不撑高页面） */}
        {activeTip && (
          <div class="tip-popover panel" onClick={() => setActiveTip(null)}>
            <div class="tip-popover-head">
              <strong>{activeTip.title}</strong>
              <button type="button" class="btn btn-sm" onClick={() => setActiveTip(null)}>
                关闭
              </button>
            </div>
            <div class="tip-popover-body">{activeTip.body}</div>
            {activeTip.recipes && (
              <div class="tip-recipe-list">
                {activeTip.recipes.map((r) => (
                  <div key={r.name} class="tip-recipe-row">
                    <strong>{r.combo}【{r.name}】</strong>：{r.effect}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 选中手牌：放大详情 + 全词条白话注释 + 确认打出浮层 */}
        {selectedInst && selectedDef && selectedGlossary && combat.outcome === 'ongoing' && (
          <div class="card-preview-overlay panel">
            <div class="preview-top-row">
              <div class="preview-title-group">
                <strong class="preview-card-name">{getCardDisplayName(selectedInst)}</strong>
                <span class="preview-cost-pill">
                  {selectedDef.effect.xCost ? 'X 费' : `${getCardCost(selectedInst)} 真元`}
                </span>
                {selectedRes && <span class="preview-res-pill">✦ 连招：{selectedRes.name}</span>}
              </div>
              <div class="preview-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-primary confirm-play-btn"
                  disabled={!selectedPlayable}
                  onClick={() => executePlayCard(selectedInst.uid)}
                >
                  {selectedDef.type === 'curse' ? '不可打出' : selectedPlayable ? '⚡ 立即打出' : '真元不足'}
                </button>
                <button type="button" class="btn btn-sm" onClick={() => setSelectedCardUid(null)}>
                  ✕
                </button>
              </div>
            </div>

            <div class="preview-desc-line">
              {getCardDescription(selectedInst)}
              {selectedEnchant ? ` ｜ ❖ ${selectedEnchant.name}：${selectedEnchant.description}` : ''}
            </div>

            {(selectedGlossary.entries.length > 0 || selectedGlossary.comboTip) && (
              <div class="preview-glossary-box">
                {selectedGlossary.entries.map((g) => (
                  <div key={g.plainTitle} class="preview-glossary-line">
                    <strong>{g.plainTitle}：</strong>
                    <span>{g.desc}</span>
                  </div>
                ))}
                {selectedGlossary.comboTip && (
                  <div class="preview-glossary-line combo">
                    <span>{selectedGlossary.comboTip}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                    收取战利品与机缘
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 左侧：我方修士 */}
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
              <button
                type="button"
                class="inline-stat-btn"
                style={{ color: '#8fd2ff' }}
                onClick={() => openTip(describeStatusTag('player-block', combat.block))}
              >
                🛡 {combat.block}{combat.retainBlockThisTurn ? '(留)' : ''}
              </button>
            </div>
            <div class="status-row">
              {combat.swordIntent > 0 && (
                <button
                  type="button"
                  class="status-tag intent"
                  onClick={() => openTip(describeStatusTag('sword-intent', combat.swordIntent))}
                >
                  ⚔剑{combat.swordIntent}
                </button>
              )}
              {combat.counterAura > 0 && (
                <button
                  type="button"
                  class="status-tag block"
                  onClick={() => openTip(describeStatusTag('counter-aura', combat.counterAura))}
                >
                  🪞反{combat.counterAura}
                </button>
              )}
              {combat.damageBoostPct > 0 && (
                <button
                  type="button"
                  class="status-tag vuln"
                  onClick={() =>
                    openTip({
                      title: `🔥 伤害激增（+${combat.damageBoostPct}%）`,
                      body: `本回合你的所有攻击伤害额外提升 ${combat.damageBoostPct}%！`,
                    })
                  }
                >
                  🔥+{combat.damageBoostPct}%
                </button>
              )}
              {combat.vulnerable > 0 && (
                <button
                  type="button"
                  class="status-tag vuln"
                  onClick={() => openTip(describeStatusTag('vulnerable', combat.vulnerable))}
                >
                  💔破{combat.vulnerable}
                </button>
              )}
              {combat.weak > 0 && (
                <button
                  type="button"
                  class="status-tag"
                  onClick={() => openTip(describeStatusTag('weak', combat.weak))}
                >
                  🌀虚{combat.weak}
                </button>
              )}
              {combat.arrays.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  class="status-tag intent"
                  onClick={() =>
                    openTip({
                      title: `✡ 常驻阵盘 · ${a.name}`,
                      body: `每回合结束自动发动：${a.blockPerTurn ? `叠盾 +${a.blockPerTurn} ` : ''}${a.damagePerTurn ? `雷击 ${a.damagePerTurn} ` : ''}${a.poisonPerTurn ? `施毒 +${a.poisonPerTurn}` : ''}`,
                    })
                  }
                >
                  ✡{a.name.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 中枢：真元灵珠 + 五行灵印 + 战报 */}
        <div class="center-console">
          <div class="center-top-row">
            <span class="turn-badge">第 {combat.turn} 回合</span>
            {enemy.tribulationWave && enemy.tribulationMaxWaves && (
              <button
                type="button"
                class="trib-pill"
                style={{ cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() =>
                  openTip({
                    title: `⚡ 天劫雷云（第 ${enemy.tribulationWave}/${enemy.tribulationMaxWaves} 波）`,
                    body: `撑过全部 ${enemy.tribulationMaxWaves} 波天雷不死即可渡劫成功！若你能直接把劫眼气血劈归零，更可额外斩获 1 枚【三界道果】并直入【天道破境】！`,
                  })
                }
              >
                ⚡ {enemy.tribulationWave}/{enemy.tribulationMaxWaves} 劫
              </button>
            )}
            {enemy.phase2Triggered && <span class="trib-pill">👹 二阶段真身</span>}
          </div>

          <div class="qi-and-seals">
            <button
              type="button"
              class="qi-orb compact-orb"
              style={{ cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}
              onClick={() => openTip(describeStatusTag('qi'))}
            >
              <span>{combat.qi}/{combat.maxQi}</span>
              <small>真元</small>
            </button>
            <button
              type="button"
              class="seal-bar seal-bar-btn"
              onClick={() =>
                openTip({
                  title: '☯ 五行灵印槽（轻触卡牌看对应连招）',
                  body: '打出带属性的神通牌会留下灵印，凑对前后两枚灵印即可免费爆发强力连招：',
                  recipes: ALL_SEAL_RECIPES,
                })
              }
            >
              {[0, 1, 2].map((idx) => {
                const locked = idx >= combat.maxSealSlots;
                const seal = combat.seals[idx];
                return (
                  <span
                    key={idx}
                    class={`seal-slot compact-seal${seal ? ' filled' : ''}`}
                    style={
                      locked
                        ? { opacity: 0.35, borderColor: 'var(--red)', color: 'var(--red)' }
                        : seal
                          ? { color: ELEMENT_COLORS[seal], borderColor: ELEMENT_COLORS[seal] }
                          : undefined
                    }
                  >
                    {locked ? '封' : seal ? SEAL_LABELS[seal] : '·'}
                  </span>
                );
              })}
            </button>
          </div>

          <button type="button" class="log-ticker" onClick={() => setLogOpen(true)}>
            📜 {combat.combatLog[0] ?? '斗法开始'}
          </button>
        </div>

        {/* 右侧：敌方强敌 */}
        <div class={`combatant enemy-side anim-${enemyAnim}`}>
          <div class="float-layer">
            {floats.filter((f) => f.side === 'enemy').map((f) => (
              <span key={f.id} class={`float-num tone-${f.tone}`}>{f.text}</span>
            ))}
          </div>

          {intent && combat.outcome === 'ongoing' && (
            <button
              type="button"
              class="intent-bubble"
              style={{ cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => {
                const hits = intent.hits ?? 1;
                const parts: string[] = [];
                if (intent.damage) parts.push(`预计对你造成 ${intentDamage}${hits > 1 ? ` × ${hits} 段（共 ${intentDamage * hits} 点）` : ' 点'}伤害`);
                if (intent.block) parts.push(`获得 ${intent.block} 点护盾`);
                if (intent.poison) parts.push(`施加 ${intent.poison} 层毒伤`);
                if (intent.vulnerable) parts.push(`使你暴露 ${intent.vulnerable} 回合破绽（受击+50%）`);
                if (intent.weak) parts.push(`使你虚弱 ${intent.weak} 回合（攻击-25%）`);
                if (intent.strengthGain) parts.push(`永久提升 ${intent.strengthGain} 点杀意攻击力`);
                if (intent.addCurse) parts.push('往你的弃牌堆塞入 1 张负面心魔牌');
                openTip({
                  title: `👁 敌方下回合意图 · ${intent.label}`,
                  body: `点击「结束回合」后，${enemy.name}将立即执行：${parts.join('，') || '蓄势运转'}。请提前叠够罡气或控制斩杀！`,
                });
              }}
            >
              <span class="intent-b-title">{intent.label}</span>
              <strong class="intent-b-val">
                {intent.damage
                  ? `⚔️${intentDamage}${intent.hits && intent.hits > 1 ? `×${intent.hits}` : ''}`
                  : intent.block
                    ? `🛡+${intent.block}`
                    : '✦蓄势'}
              </strong>
            </button>
          )}

          <div class="portrait-wrap">
            <EnemyPortrait
              enemyDefId={enemy.defId}
              enemyName={enemy.name}
              artStyle={enemy.artStyle}
              hasBlock={enemy.block > 0}
              isPoisoned={enemy.poison > 0}
            />
          </div>

          <div class="fighter-plate">
            <div class="fighter-name">
              <strong>{enemy.name}</strong>
              {enemy.trait ? (
                <button
                  type="button"
                  class="inline-stat-btn"
                  style={{ color: '#ffb88c', fontSize: '11px' }}
                  onClick={() => openTip(describeStatusTag('trait', undefined, enemy.trait))}
                >
                  ⚖{enemy.trait.name}
                </button>
              ) : (
                <small>{enemy.title.slice(0, 8)}</small>
              )}
            </div>
            <div class="bar-track">
              <div class="bar-fill hp" style={{ width: `${enemyHpPct}%` }} />
            </div>
            <div class="fighter-hp-line">
              <span>❤ {enemy.hp}/{enemy.maxHp}</span>
              {enemy.block > 0 && (
                <button
                  type="button"
                  class="inline-stat-btn"
                  style={{ color: '#8fd2ff' }}
                  onClick={() => openTip(describeStatusTag('enemy-block', enemy.block))}
                >
                  🛡 {enemy.block}
                </button>
              )}
            </div>
            <div class="status-row">
              {enemy.trait && (
                <button
                  type="button"
                  class="status-tag intent"
                  onClick={() => openTip(describeStatusTag('trait', undefined, enemy.trait))}
                >
                  ⚖{enemy.trait.name}
                </button>
              )}
              {enemy.poison > 0 && (
                <button
                  type="button"
                  class="status-tag poison"
                  onClick={() => openTip(describeStatusTag('poison', enemy.poison))}
                >
                  ☠毒{enemy.poison}
                </button>
              )}
              {enemy.vulnerable > 0 && (
                <button
                  type="button"
                  class="status-tag vuln"
                  onClick={() => openTip(describeStatusTag('vulnerable', enemy.vulnerable))}
                >
                  💔破{enemy.vulnerable}
                </button>
              )}
              {enemy.weak > 0 && (
                <button
                  type="button"
                  class="status-tag"
                  onClick={() => openTip(describeStatusTag('weak', enemy.weak))}
                >
                  🌀虚{enemy.weak}
                </button>
              )}
              {enemy.strength > 0 && (
                <button
                  type="button"
                  class="status-tag vuln"
                  onClick={() => openTip(describeStatusTag('strength', enemy.strength))}
                >
                  🔥+{enemy.strength}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 下半屏：单排横滑实体卡牌（单击预览白话注释，再点一次打出） + 右侧法宝与结束回合操作坞 */}
      <section class="hand-dock">
        <div class="hand-scroll-zone">
          <div class="tcg-hand-fan one-row-hand">
            {combat.hand.map((inst, i) => {
              const def = getCardDef(inst.defId);
              const playable = canPlayInstance(inst.uid);
              const res = playable ? previewResonance(combat.seals, def.element, Boolean(root.mixedFiveBonus)) : null;
              const mid = (handLen - 1) / 2;
              const offset = i - mid;
              const deg = Math.max(-7, Math.min(7, offset * 2.1));
              const drop = Math.abs(offset) * 3;
              return (
                <CardView
                  key={inst.uid}
                  instance={inst}
                  unplayable={!playable}
                  selected={selectedCardUid === inst.uid}
                  resonanceHint={res ? res.name : null}
                  fanStyle={{ '--fan-rot': `${deg}deg`, '--fan-y': `${drop}px` }}
                  onClick={() => handleCardTap(inst.uid)}
                />
              );
            })}
          </div>
        </div>

        <aside class="action-dock panel">
          <div class="pile-mini">
            <span>抽{combat.drawPile.length}</span>
            <span>弃{combat.discardPile.length}</span>
            <span>耗{combat.exhaustPile.length}</span>
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
                class={`treasure-btn compact-treasure${ready ? ' ready' : ' is-charging'}`}
                onClick={() => handleTreasureClick(tid, ready, charge)}
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
