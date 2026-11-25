import { useState } from 'preact/hooks';
import { LINEAGES, REALM_NAMES } from '../../content/lineages';
import { ENCHANTS, TREASURES } from '../../content/treasures';
import { getCardDef } from '../../core/combat-engine';
import type { EnchantId, MetaSave, RunState } from '../../core/types';
import { CardView } from '../components/CardView';
import { sfx } from '../sfx';

// ==================== 战利品 & 破境结算 ====================
export function RewardView({
  run,
  onPickCard,
  onPickRelic,
  onPickMaterial,
  onPickTreasure,
  onPickLaw,
  onContinue,
}: {
  run: RunState;
  onPickCard: (defId: string) => void;
  onPickRelic: () => void;
  onPickMaterial: () => void;
  onPickTreasure: () => void;
  onPickLaw: (lawId: string) => void;
  onContinue: () => void;
}) {
  const rew = run.reward!;
  const gradeTitle =
    rew.breakthroughGrade === 'heaven'
      ? '【天道破境】金光贯顶，真元上限 +1！'
      : rew.breakthroughGrade === 'earth'
        ? '【地道破境】道基稳固，寿元大涨！'
        : '【凡品破境】勉强冲关，留下一道【道基裂痕】！';

  return (
    <main class="panel sub-stage">
      <h2>{rew.isBossReward ? `破境功成 · ${gradeTitle}` : '战利品与机缘收取'}</h2>
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        获得 <strong>{rew.gold} 灵石</strong>、道基纯度 <strong>+{rew.foundation}</strong>
        {rew.lifespanGained ? `、寿元上限 +${rew.lifespanGained} 年` : ''}
        {rew.daoTokenGained ? '、✦ 劈碎劫眼额外获【三界道果信物】×1！' : ''}
      </p>

      {/* 天道法则三选一 */}
      {rew.lawChoices && rew.lawChoices.length > 0 && !rew.pickedLaw && (
        <div>
          <h3 style={{ color: '#ffe599', margin: '0 0 8px' }}>★ 天道破境赐福：择一金色天道法则</h3>
          <div class="choice-list">
            {rew.lawChoices.map((law) => (
              <button
                key={law.id}
                type="button"
                class="btn choice-btn"
                style={{ borderColor: '#ffd875' }}
                onClick={() => {
                  sfx.resonance();
                  onPickLaw(law.id);
                }}
              >
                <strong>{law.name}</strong>
                <span class="choice-reward">{law.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 额外掉落：古宝、附魔材料、法宝 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {rew.relicReward && !rew.pickedRelic && (
          <button type="button" class="btn btn-primary" onClick={() => { sfx.click(); onPickRelic(); }}>
            ◈ 收取古宝：{rew.relicReward.name}（{rew.relicReward.description}）
          </button>
        )}
        {rew.materialReward && !rew.pickedMaterial && (
          <button type="button" class="btn" onClick={() => { sfx.click(); onPickMaterial(); }}>
            ❖ 收取附魔材：{rew.materialReward.materialName}（{rew.materialReward.description}）
          </button>
        )}
        {rew.treasureReward && !rew.pickedTreasure && (
          <button type="button" class="btn" onClick={() => { sfx.click(); onPickTreasure(); }}>
            🏺 收取本命法宝：{rew.treasureReward.name}（{rew.treasureReward.description}）
          </button>
        )}
      </div>

      {/* 神通三选一 */}
      {!rew.pickedCard ? (
        <div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--gold-bright)' }}>择一神通收入牌库（可跳过保持精简）</h3>
          <div class="hand-grid">
            {rew.cardChoices.map((def) => (
              <CardView
                key={def.id}
                def={def}
                onClick={() => {
                  sfx.click();
                  onPickCard(def.id);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--green)', fontSize: '13px' }}>✓ 已收入新神通。</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          class="btn btn-primary"
          disabled={Boolean(rew.lawChoices?.length && !rew.pickedLaw)}
          onClick={() => {
            sfx.click();
            onContinue();
          }}
        >
          {rew.isBossReward ? '踏入下一大境篇章 ➔' : '重返星宿路线图 ➔'}
        </button>
      </div>
    </main>
  );
}

// ==================== 洞府三合一 ====================
export function AbodeView({
  run,
  onUpgradeEnchant,
  onBrew,
  onPurge,
  onLeave,
}: {
  run: RunState;
  onUpgradeEnchant: (cardUid: string, enchantId?: EnchantId) => void;
  onBrew: (mode: 'steady' | 'bold') => string;
  onPurge: (cardUid: string) => void;
  onLeave: () => void;
}) {
  const [tab, setTab] = useState<'enchant' | 'brew' | 'purge'>('enchant');
  const [selectedMat, setSelectedMat] = useState<EnchantId | undefined>(run.materials[0]);
  const [brewMsg, setBrewMsg] = useState('');

  return (
    <main class="panel sub-stage">
      <h2>🔥 洞府丹庐 · 闭关三择</h2>
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        灵脉静室已开，每次入洞府可在【参悟附魔】【开炉炼丹】【斩念删牌】中择一施行。
      </p>

      {run.abodeUsed ? (
        <div class="panel" style={{ padding: '16px', borderColor: 'var(--gold-bright)' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--gold-bright)' }}>
            {brewMsg || '本次洞府闭关功成，气息已然稳固。'}
          </p>
          <button type="button" class="btn btn-primary" onClick={onLeave}>
            出关重返仙途 ➔
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" class={`btn${tab === 'enchant' ? ' btn-primary' : ''}`} onClick={() => setTab('enchant')}>
              ✨ 参悟升级 / 熔材附魔
            </button>
            <button type="button" class={`btn${tab === 'brew' ? ' btn-primary' : ''}`} onClick={() => setTab('brew')}>
              ⚗️ 开炉炼丹（涨道基/寿元）
            </button>
            <button type="button" class={`btn${tab === 'purge' ? ' btn-primary' : ''}`} onClick={() => setTab('purge')}>
              ✂️ 斩三尸（删废牌/心魔）
            </button>
          </div>

          {tab === 'enchant' && (
            <div>
              {run.materials.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--gold)', marginBottom: '6px' }}>
                    可选熔入天材地宝（升级同时打上永久词条）：
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      class={`btn btn-sm${!selectedMat ? ' btn-primary' : ''}`}
                      onClick={() => setSelectedMat(undefined)}
                    >
                      仅普通升级
                    </button>
                    {Array.from(new Set(run.materials)).map((m) => (
                      <button
                        key={m}
                        type="button"
                        class={`btn btn-sm${selectedMat === m ? ' btn-primary' : ''}`}
                        onClick={() => setSelectedMat(m)}
                      >
                        ❖ {ENCHANTS[m].materialName}（{ENCHANTS[m].description}）
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div class="hand-grid">
                {run.deck
                  .filter((c) => getCardDef(c.defId).type !== 'curse')
                  .map((inst) => (
                    <CardView
                      key={inst.uid}
                      instance={inst}
                      onClick={() => {
                        sfx.resonance();
                        onUpgradeEnchant(inst.uid, selectedMat);
                      }}
                    />
                  ))}
              </div>
            </div>
          )}

          {tab === 'brew' && (
            <div class="choice-list">
              <button
                type="button"
                class="btn choice-btn"
                onClick={() => {
                  sfx.shield();
                  setBrewMsg(onBrew('steady'));
                }}
              >
                <strong>文火稳炼 · 固本培元丹</strong>
                <span class="choice-reward">100% 成功：恢复 35% 气血，本卷道基纯度 +14</span>
              </button>
              <button
                type="button"
                class="btn choice-btn"
                onClick={() => {
                  sfx.resonance();
                  setBrewMsg(onBrew('bold'));
                }}
              >
                <strong>猛火冲品 · 博炼九转金丹</strong>
                <span class="choice-reward">68% 绝世成丹：寿元上限 +14 年、道基纯度 +24、回 18 气血</span>
                <span class="choice-cost">32% 炸炉反噬：扣 10 气血并塞入 1 张【心魔低语】</span>
              </button>
            </div>
          )}

          {tab === 'purge' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                点击永久删除一张牌（顺带道基纯度 +6，牌库最少保留 5 张）：
              </p>
              <div class="hand-grid">
                {run.deck.map((inst) => (
                  <CardView
                    key={inst.uid}
                    instance={inst}
                    disabled={run.deck.length <= 5}
                    onClick={() => {
                      sfx.slash();
                      onPurge(inst.uid);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ==================== 红尘奇遇 ====================
export function EventView({
  run,
  onChoose,
  onLeave,
}: {
  run: RunState;
  onChoose: (choiceId: string) => void;
  onLeave: () => void;
}) {
  const ev = run.activeEvent!;
  return (
    <main class="panel sub-stage">
      <h2>☯ {ev.title}</h2>
      <p style={{ margin: 0, lineHeight: 1.8, fontSize: '15px' }}>{ev.prose}</p>

      {run.eventResultText ? (
        <div class="panel" style={{ padding: '16px', borderColor: 'var(--gold-bright)' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--gold-bright)' }}>{run.eventResultText}</p>
          <button type="button" class="btn btn-primary" onClick={onLeave}>
            继续赶路 ➔
          </button>
        </div>
      ) : (
        <div class="choice-list">
          {ev.choices.map((ch) => {
            const cantAfford = Boolean(ch.goldCost && run.gold < ch.goldCost);
            return (
              <button
                key={ch.id}
                type="button"
                class="btn choice-btn"
                disabled={cantAfford}
                onClick={() => {
                  sfx.click();
                  onChoose(ch.id);
                }}
              >
                <strong>{ch.label}</strong>
                <span class="choice-cost">{ch.detail}{cantAfford ? '（灵石不足）' : ''}</span>
                <span class="choice-reward">可得：{ch.rewardText}</span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ==================== 仙城坊市 ====================
export function ShopView({
  run,
  onBuyCard,
  onBuyRelic,
  onBuyMaterial,
  onBuyElixir,
  onPurgeCard,
  onLeave,
}: {
  run: RunState;
  onBuyCard: (idx: number) => void;
  onBuyRelic: (idx: number) => void;
  onBuyMaterial: (idx: number) => void;
  onBuyElixir: () => void;
  onPurgeCard: (uid: string) => void;
  onLeave: () => void;
}) {
  const [purging, setPurging] = useState(false);
  const shop = run.shop!;

  return (
    <main class="panel sub-stage">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h2>💰 仙城坊市 · 奇珍阁</h2>
        <button type="button" class="btn btn-primary" onClick={onLeave}>
          离开坊市 ➔
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          class="btn"
          disabled={shop.elixirBought || run.gold < shop.elixirPrice}
          onClick={() => { sfx.shield(); onBuyElixir(); }}
        >
          🍶 购延寿青灵丹（{shop.elixirPrice} 灵石：寿元+12年、回20血）{shop.elixirBought ? ' [已售罄]' : ''}
        </button>
        <button
          type="button"
          class="btn"
          disabled={shop.purged || run.gold < shop.purgePrice || run.deck.length <= 5}
          onClick={() => setPurging(!purging)}
        >
          ✂️ 坊市洗髓删牌（{shop.purgePrice} 灵石）{shop.purged ? ' [已用]' : ''}
        </button>
      </div>

      {purging && !shop.purged && (
        <div class="panel" style={{ padding: '12px' }}>
          <div style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--gold)' }}>点击要删去的牌：</div>
          <div class="hand-grid">
            {run.deck.map((inst) => (
              <CardView
                key={inst.uid}
                instance={inst}
                onClick={() => {
                  sfx.slash();
                  onPurgeCard(inst.uid);
                  setPurging(false);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--gold)' }}>古宝与天材地宝</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {shop.relics.map((item, idx) => (
            <button
              key={item.def.id}
              type="button"
              class="btn"
              disabled={item.sold || run.gold < item.price}
              onClick={() => { sfx.click(); onBuyRelic(idx); }}
            >
              ◈ {item.def.name} ({item.price}灵石) — {item.def.description}{item.sold ? ' [已购]' : ''}
            </button>
          ))}
          {shop.materials.map((item, idx) => (
            <button
              key={item.def.id}
              type="button"
              class="btn"
              disabled={item.sold || run.gold < item.price}
              onClick={() => { sfx.click(); onBuyMaterial(idx); }}
            >
              ❖ {item.def.materialName} ({item.price}灵石) — {item.def.description}{item.sold ? ' [已购]' : ''}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--gold)' }}>玉简神通</h3>
        <div class="hand-grid">
          {shop.cards.map((item, idx) => (
            <CardView
              key={item.def.id}
              def={item.def}
              price={item.price}
              disabled={item.sold || run.gold < item.price}
              onClick={() => { sfx.click(); onBuyCard(idx); }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

// ==================== 前世遗蜕 ====================
export function RemnantView({
  meta,
  onClaim,
}: {
  meta: MetaSave;
  onClaim: (mode: 'card' | 'treasure' | 'enlighten') => void;
}) {
  const rem = meta.pastLifeRemnant!;
  const leftTreasure = rem.leftTreasureId ? TREASURES[rem.leftTreasureId] : null;
  const leftCardDef = rem.leftCard ? getCardDef(rem.leftCard.defId) : null;

  return (
    <main class="panel sub-stage" style={{ borderColor: '#b68cff' }}>
      <h2>🪦 前世洞府 · 第 {rem.generation} 世遗蜕</h2>
      <p style={{ margin: 0, lineHeight: 1.7 }}>
        荒藤缠绕的石室里端坐着一具与你容貌隐隐相似的枯骨——正是前世【{rem.name}（{LINEAGES[rem.lineage].name}）】在此留下的衣冠冢（前世因果：{rem.deathCause}）。
      </p>
      <div class="choice-list">
        {rem.leftCard && leftCardDef && (
          <button type="button" class="btn choice-btn" onClick={() => { sfx.resonance(); onClaim('card'); }}>
            <strong>继承前世绝学玉简：{leftCardDef.name}{rem.leftCard.upgraded ? '+' : ''}</strong>
            <span class="choice-reward">直接将前世淬炼过的核心神通（含附魔词条）收入本世牌库</span>
          </button>
        )}
        {leftTreasure && (
          <button type="button" class="btn choice-btn" onClick={() => { sfx.resonance(); onClaim('treasure'); }}>
            <strong>收服前世本命法宝：{leftTreasure.name}</strong>
            <span class="choice-reward">{leftTreasure.description}</span>
          </button>
        )}
        <button type="button" class="btn choice-btn" onClick={() => { sfx.resonance(); onClaim('enlighten'); }}>
          <strong>敛骨拜别，参悟前世道果</strong>
          <span class="choice-reward">本卷道基纯度 +30，寿元上限 +15 年</span>
        </button>
      </div>
    </main>
  );
}

// ==================== 轮回结算页 ====================
export function SettlementView({
  run,
  karmaEarned,
  onReturnTitle,
}: {
  run: RunState;
  karmaEarned: number;
  onReturnTitle: () => void;
}) {
  const isWin = run.phase === 'victory';
  return (
    <main class="panel sub-stage" style={{ textAlign: 'center', borderColor: isWin ? 'var(--gold-bright)' : 'var(--red)' }}>
      <h2>{isWin ? `✦ ${run.endingTitle ?? '问道飞升'}` : '⏳ 尘缘已尽 · 步入轮回'}</h2>
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        第 {run.generation} 世 · {run.name} · {LINEAGES[run.lineage].name} · 止步 {REALM_NAMES[run.realm]}（{run.age} 岁）
      </p>
      <p style={{ margin: 0 }}>{isWin ? '你的道名已刻入三界碑，并解锁更高重【天道劫数】！' : run.deathCause}</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '14px' }}>
        <span class="hud-pill gold">☯ 结算轮回道果 +{karmaEarned}</span>
        <span class="hud-pill">⚔️ 胜场 {run.stats.battlesWon}</span>
        <span class="hud-pill">✦ 灵印共鸣 {run.stats.resonancesTriggered} 次</span>
        <span class="hud-pill">🔥 燃寿 {run.stats.lifeBurned} 年</span>
      </div>
      <p style={{ fontSize: '13px', color: '#d2b8ff', margin: 0 }}>
        🪦 你此世最强的神通与法宝已化作【前世遗蜕】，将在下一世对应卷的星宿地图中静候有缘重逢。
      </p>
      <div>
        <button type="button" class="btn btn-primary" onClick={onReturnTitle}>
          重回轮回盘 · 开启下一世
        </button>
      </div>
    </main>
  );
}
