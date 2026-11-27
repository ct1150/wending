import { useState } from 'preact/hooks';
import { getRootById, LINEAGE_LIST, REALM_NAMES } from '../content/lineages';
import { activateTreasure, endPlayerTurn, playCard, useConsumable } from '../core/combat-engine';
import {
  buyRerollUpgradeInMeta,
  loadActiveRun,
  loadMetaSave,
  settleRunIntoMeta,
  unlockLineageInMeta,
} from '../core/meta-save';
import {
  abodeBrewElixir,
  abodePurgeCard,
  abodeUpgradeOrEnchant,
  auctionAmbushBuyer,
  auctionBuyLot,
  chooseEncounterOption,
  chooseStartingBlessing,
  claimBreakthroughLaw,
  claimPastLifeRemnant,
  claimRewardCard,
  claimRewardConsumable,
  claimRewardMaterial,
  claimRewardRelic,
  claimRewardTreasure,
  claimSecondaryMethod,
  createNewRun,
  enterMapNode,
  finishRewardAndAdvance,
  getDailyChallengeConfig,
  leaveSubSceneToMap,
  resolveCombatVictory,
  rollRandomRoot,
  shopBuyCard,
  shopBuyConsumable,
  shopBuyElixir,
  shopBuyMaterial,
  shopBuyRelic,
  shopPurgeCard,
} from '../core/run-manager';
import type { LineageId, MetaSave, RunState } from '../core/types';
import { CardView } from './components/CardView';
import { PLAYER_PORTRAITS } from './components/Portraits';
import { TopHud } from './components/TopHud';
import { BattleArena } from './screens/BattleArena';
import { StarMapView } from './screens/StarMapView';
import {
  AbodeView,
  AuctionView,
  BlessingView,
  CodexScreen,
  EventView,
  RemnantView,
  RewardView,
  SettlementView,
  ShopView,
} from './screens/SubViews';
import { isBgmEnabled, isSfxMuted, setBgmEnabled, setSfxMuted, sfx } from './sfx';

type Screen = 'title' | 'setup' | 'run' | 'codex';

export function App() {
  const [meta, setMeta] = useState<MetaSave>(() => loadMetaSave());
  const [run, setRun] = useState<RunState | null>(() => loadActiveRun());
  const [screen, setScreen] = useState<Screen>('title');
  const [muted, setMuted] = useState<boolean>(() => isSfxMuted());
  const [bgmOn, setBgmOn] = useState<boolean>(() => isBgmEnabled());
  const [deckOpen, setDeckOpen] = useState(false);

  const [charName, setCharName] = useState('云归');
  const [selectedLineage, setSelectedLineage] = useState<LineageId>('sword');
  const [seed, setSeed] = useState(() => Date.now() & 0xfffffff);
  const [rootId, setRootId] = useState(() => rollRandomRoot(Date.now() & 0xfffffff));
  const [rerollsLeft, setRerollsLeft] = useState(meta.rerollCharges);
  const [ascension, setAscension] = useState(0);
  const [settledKarma, setSettledKarma] = useState<number | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);

  const root = getRootById(rootId);
  const daily = getDailyChallengeConfig();
  const todayBest = meta.dailyBestScores[daily.dateKey] ?? 0;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSfxMuted(next);
    if (next) setBgmOn(false);
  };

  const toggleBgm = () => {
    const next = !bgmOn;
    if (next && muted) {
      setMuted(false);
      setSfxMuted(false);
    }
    setBgmOn(next);
    setBgmEnabled(next);
  };

  const openSetup = () => {
    sfx.click();
    const s = Date.now() & 0xfffffff;
    setSeed(s);
    setRootId(rollRandomRoot(s));
    setRerollsLeft(meta.rerollCharges);
    setSettledKarma(null);
    setNewAchievements([]);
    setScreen('setup');
  };

  const handleRerollRoot = () => {
    if (rerollsLeft <= 0) return;
    sfx.click();
    const nextSeed = (seed + 7919) & 0xfffffff;
    setSeed(nextSeed);
    setRootId(rollRandomRoot(nextSeed));
    setRerollsLeft((n) => n - 1);
  };

  const startNewRun = () => {
    sfx.resonance();
    const fresh = createNewRun({
      name: charName,
      lineage: selectedLineage,
      rootId,
      seed,
      ascension,
      meta,
    });
    setRun(fresh);
    setSettledKarma(null);
    setNewAchievements([]);
    setScreen('run');
  };

  const startDailyChallenge = () => {
    sfx.breakthrough();
    const fresh = createNewRun({
      name: `${charName}·天机`,
      lineage: selectedLineage,
      rootId: daily.rootId,
      seed: daily.seed,
      ascension: Math.min(2, meta.maxAscensionUnlocked),
      meta,
      isDailyChallenge: true,
      dailyDate: daily.dateKey,
      mutators: daily.mutators.map((m) => m.id),
    });
    setRun(fresh);
    setSettledKarma(null);
    setNewAchievements([]);
    setScreen('run');
  };

  const finalizeRun = (finishedRun: RunState) => {
    const outcome =
      finishedRun.phase === 'victory'
        ? finishedRun.act === 4
          ? 'true-victory'
          : 'victory'
        : 'death';
    if (outcome === 'death') sfx.defeat();
    else sfx.breakthrough();
    const res = settleRunIntoMeta(meta, finishedRun, outcome);
    setMeta(res.nextMeta);
    setSettledKarma(res.karmaEarned);
    setNewAchievements(res.newAchievements);
    setRun({ ...finishedRun, combat: null });
  };

  const handleAbandon = () => {
    if (!run) return;
    const dead: RunState = { ...run, phase: 'gameover', deathCause: '主动兵解重修' };
    finalizeRun(dead);
  };

  const inCombat = screen === 'run' && Boolean(run && run.phase === 'combat');

  return (
    <>
      <div class="backdrop" />
      <div class={`app-shell${inCombat ? ' in-combat' : ''}`}>
        {/* ==================== 标题首页 ==================== */}
        {screen === 'title' && (
          <main class="title-screen">
            <div class="title-emblem">BAISHI WENDING · ROGUELIKE XIANXIA</div>
            <h1 class="title-main">百世问鼎</h1>
            <p class="title-sub">
              寿元为筹，灵印相生，乾坤丹符瞬发破局。<br />
              兼修异派邪道心法、竞拍截胡稀世仙珍、迎战二阶段真魔与九重天劫。
            </p>
            <div class="title-actions">
              {run && run.phase !== 'gameover' && run.phase !== 'victory' && (
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => {
                    sfx.click();
                    setScreen('run');
                  }}
                >
                  续写第 {run.generation} 世（{run.name} · {REALM_NAMES[run.realm]}）
                </button>
              )}
              <button type="button" class="btn btn-primary" onClick={openSetup}>
                踏入新一世仙途
              </button>
              <button type="button" class="btn" onClick={startDailyChallenge} title={daily.mutators.map((m) => `${m.name}：${m.description}`).join(' | ')}>
                ☯ 每日天机试炼（{daily.mutators.map((m) => m.name).join('+')}）
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  sfx.click();
                  setScreen('codex');
                }}
              >
                📖 轮回天书 & 万法图鉴（道果 {meta.karmaPoints}）
              </button>
            </div>
            <div class="title-stats">
              <span>历世：{meta.totalLives} 世</span>
              <span>飞升：{meta.victories} 次（真结局 {meta.trueVictories}）</span>
              <span>名场面成就：{meta.achievements.length}/6</span>
              {todayBest > 0 && <span style={{ color: 'var(--gold-bright)' }}>今日道榜最高：{todayBest} 分</span>}
              {meta.pastLifeRemnant && (
                <span style={{ color: '#d2b8ff' }}>
                  🪦 前世遗蜕：{meta.pastLifeRemnant.name}（第 {meta.pastLifeRemnant.act} 卷待寻）
                </span>
              )}
            </div>
          </main>
        )}

        {/* ==================== 建角与选道统 ==================== */}
        {screen === 'setup' && (
          <main class="setup-screen">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, color: 'var(--gold-bright)' }}>轮回转世 · 第 {meta.totalLives + 1} 世择道</h2>
              <button type="button" class="btn btn-sm" onClick={() => setScreen('title')}>
                返回首页
              </button>
            </div>

            <div class="panel" style={{ padding: '14px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                道号：
                <input
                  type="text"
                  maxLength={12}
                  value={charName}
                  onInput={(e) => setCharName((e.target as HTMLInputElement).value)}
                  style={{
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--line-bright)',
                    color: 'var(--gold-bright)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                  }}
                />
              </label>

              {meta.maxAscensionUnlocked > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  天道劫数：
                  <select
                    value={ascension}
                    onChange={(e) => setAscension(Number((e.target as HTMLSelectElement).value))}
                    style={{
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--line-bright)',
                      color: 'var(--gold-bright)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    {Array.from({ length: meta.maxAscensionUnlocked + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '凡尘常劫 (0重)' : `天道压制 第 ${i} 重`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div class="lineage-grid">
              {LINEAGE_LIST.map((lin) => {
                const unlocked = meta.unlockedLineages.includes(lin.id);
                return (
                  <button
                    key={lin.id}
                    type="button"
                    class={`panel lineage-card${selectedLineage === lin.id ? ' selected' : ''}${!unlocked ? ' locked' : ''}`}
                    onClick={() => {
                      if (!unlocked) return;
                      sfx.click();
                      setSelectedLineage(lin.id);
                    }}
                  >
                    <div class="lineage-thumb-wrap">
                      <img src={PLAYER_PORTRAITS[lin.id]} alt={lin.name} class="lineage-thumb" />
                    </div>
                    <h3>{lin.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--gold)' }}>
                      {lin.title} · 气血 {lin.baseHp} · 寿元 {lin.baseLifespan}年
                    </div>
                    <p>{lin.description}</p>
                    <p style={{ color: '#c8d9d7', fontSize: '12px' }}>
                      本命功法：{lin.starterMethodName} — {lin.starterMethodDesc}
                    </p>
                    {!unlocked && (
                      <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px' }}>
                        🔒 需在【轮回天书】消耗 {lin.unlockCost} 道果解锁
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div class="panel root-box">
              <div>
                <div style={{ color: 'var(--gold-bright)', fontWeight: 700, fontSize: '16px' }}>
                  先天天资：{root.name}（{root.grade}）
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>{root.description}</div>
                <div style={{ color: 'var(--green)', fontSize: '13px', marginTop: '4px' }}>✦ {root.passiveText}</div>
              </div>
              <button type="button" class="btn" disabled={rerollsLeft <= 0} onClick={handleRerollRoot}>
                🎲 重掷灵根（余 {rerollsLeft} 次）
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" class="btn btn-primary" onClick={startNewRun}>
                破壳降生 · 开启仙途 ➔
              </button>
            </div>
          </main>
        )}

        {/* ==================== 轮回天书 & 万法图鉴 ==================== */}
        {screen === 'codex' && (
          <CodexScreen
            meta={meta}
            onUnlockLineage={(id, cost) => {
              const next = unlockLineageInMeta(meta, id, cost);
              if (next) {
                sfx.resonance();
                setMeta(next);
              }
            }}
            onBuyReroll={() => {
              const next = buyRerollUpgradeInMeta(meta);
              if (next) {
                sfx.resonance();
                setMeta(next);
              }
            }}
            onBack={() => setScreen('title')}
          />
        )}

        {/* ==================== 单局游戏主舞台 ==================== */}
        {screen === 'run' && run && (
          <>
            <TopHud
              run={run}
              muted={muted}
              bgmOn={bgmOn}
              compact={run.phase === 'combat'}
              onUseConsumable={(idx) =>
                setRun((prev) => {
                  if (!prev) return prev;
                  const next = useConsumable(prev, idx);
                  return next;
                })
              }
              onToggleMute={toggleMute}
              onToggleBgm={toggleBgm}
              onOpenDeck={() => setDeckOpen(true)}
              onAbandon={handleAbandon}
            />

            {run.phase === 'blessing' && (
              <BlessingView
                run={run}
                onSelectBlessing={(id) => setRun((prev) => (prev ? chooseStartingBlessing(prev, id, meta) : prev))}
              />
            )}

            {run.phase === 'map' && (
              <StarMapView
                run={run}
                onSelectNode={(nodeId) => {
                  sfx.mapStep();
                  const next = enterMapNode(run, nodeId, meta.achievements);
                  if (next.phase === 'gameover') finalizeRun(next);
                  else setRun(next);
                }}
              />
            )}

            {run.phase === 'combat' && run.combat && (
              <BattleArena
                run={run}
                onPlayCard={(uid) => setRun((prev) => (prev ? playCard(prev, uid) : prev))}
                onActivateTreasure={(tid) => setRun((prev) => (prev ? activateTreasure(prev, tid) : prev))}
                onEndTurn={() => setRun((prev) => (prev ? endPlayerTurn(prev) : prev))}
                onClaimVictory={() => {
                  const next = resolveCombatVictory(run, meta.achievements);
                  if (next.phase === 'victory') finalizeRun(next);
                  else setRun(next);
                }}
                onAcceptDefeat={() => finalizeRun({ ...run, phase: 'gameover' })}
              />
            )}

            {(run.phase === 'reward' || run.phase === 'breakthrough') && run.reward && (
              <RewardView
                run={run}
                onPickCard={(defId) => setRun((prev) => (prev ? claimRewardCard(prev, defId) : prev))}
                onPickRelic={() => setRun((prev) => (prev ? claimRewardRelic(prev) : prev))}
                onPickMaterial={() => setRun((prev) => (prev ? claimRewardMaterial(prev) : prev))}
                onPickConsumable={() => setRun((prev) => (prev ? claimRewardConsumable(prev) : prev))}
                onPickTreasure={() => setRun((prev) => (prev ? claimRewardTreasure(prev) : prev))}
                onPickMethod={(mid) => setRun((prev) => (prev ? claimSecondaryMethod(prev, mid) : prev))}
                onPickLaw={(lawId) => setRun((prev) => (prev ? claimBreakthroughLaw(prev, lawId) : prev))}
                onContinue={() => setRun((prev) => (prev ? finishRewardAndAdvance(prev, meta) : prev))}
              />
            )}

            {run.phase === 'abode' && (
              <AbodeView
                run={run}
                onUpgradeEnchant={(uid, mat) => setRun((prev) => (prev ? abodeUpgradeOrEnchant(prev, uid, mat) : prev))}
                onBrew={(mode) => {
                  const res = abodeBrewElixir(run, mode);
                  setRun(res.nextRun);
                  return res.message;
                }}
                onPurge={(uid) => setRun((prev) => (prev ? abodePurgeCard(prev, uid) : prev))}
                onLeave={() => setRun((prev) => (prev ? leaveSubSceneToMap(prev) : prev))}
              />
            )}

            {run.phase === 'event' && run.activeEvent && (
              <EventView
                run={run}
                onChoose={(cid) => {
                  const next = chooseEncounterOption(run, cid, meta.achievements);
                  if (next.phase === 'gameover') finalizeRun(next);
                  else setRun(next);
                }}
                onLeave={() => setRun((prev) => (prev ? leaveSubSceneToMap(prev) : prev))}
              />
            )}

            {run.phase === 'shop' && run.shop && (
              <ShopView
                run={run}
                onBuyCard={(i) => setRun((prev) => (prev ? shopBuyCard(prev, i) : prev))}
                onBuyRelic={(i) => setRun((prev) => (prev ? shopBuyRelic(prev, i) : prev))}
                onBuyMaterial={(i) => setRun((prev) => (prev ? shopBuyMaterial(prev, i) : prev))}
                onBuyConsumable={(i) => setRun((prev) => (prev ? shopBuyConsumable(prev, i) : prev))}
                onBuyElixir={() => setRun((prev) => (prev ? shopBuyElixir(prev) : prev))}
                onPurgeCard={(uid) => setRun((prev) => (prev ? shopPurgeCard(prev, uid) : prev))}
                onLeave={() => setRun((prev) => (prev ? leaveSubSceneToMap(prev) : prev))}
              />
            )}

            {run.phase === 'auction' && run.auction && (
              <AuctionView
                run={run}
                onBuyLot={(lid) => setRun((prev) => (prev ? auctionBuyLot(prev, lid) : prev))}
                onAmbush={() => setRun((prev) => (prev ? auctionAmbushBuyer(prev) : prev))}
                onLeave={() => setRun((prev) => (prev ? leaveSubSceneToMap(prev) : prev))}
              />
            )}

            {run.phase === 'remnant' && meta.pastLifeRemnant && (
              <RemnantView
                meta={meta}
                onClaim={(mode) => setRun((prev) => (prev ? claimPastLifeRemnant(prev, meta, mode) : prev))}
              />
            )}

            {(run.phase === 'gameover' || run.phase === 'victory') && (
              <SettlementView
                run={run}
                karmaEarned={settledKarma ?? 0}
                newAchievements={newAchievements}
                onReturnTitle={() => {
                  setRun(null);
                  setScreen('title');
                }}
              />
            )}
          </>
        )}

        {/* ==================== 牌库总览弹窗 ==================== */}
        {deckOpen && run && (
          <div class="modal-backdrop" onClick={() => setDeckOpen(false)}>
            <div class="panel modal-box" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: 'var(--gold-bright)' }}>当前神通牌库（{run.deck.length} 张）</h3>
                <button type="button" class="btn btn-sm" onClick={() => setDeckOpen(false)}>
                  关闭
                </button>
              </div>
              <div class="hand-grid">
                {run.deck.map((inst) => (
                  <CardView key={inst.uid} instance={inst} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
