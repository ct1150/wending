import { useState } from 'preact/hooks';
import { CARDS } from '../../content/cards';
import { CONSUMABLES } from '../../content/consumables';
import { ENEMIES } from '../../content/enemies';
import { getWorldByAct, LINEAGE_LIST, LINEAGES, REALM_NAMES, WORLD_INFO } from '../../content/lineages';
import { ACHIEVEMENTS } from '../../content/methods';
import { ENCHANTS, RELICS, TREASURES } from '../../content/treasures';
import { getCardDef } from '../../core/combat-engine';
import type {
  BlessingOption,
  EnchantId,
  LineageId,
  MetaSave,
  RunState,
  SecondaryMethodId,
  SupremeLawId,
  TrueSpiritId,
} from '../../core/types';
import { CardView } from '../components/CardView';
import { ENEMY_FALLBACK_PORTRAITS, ENEMY_PORTRAITS_BY_ID } from '../components/Portraits';
import { sfx } from '../sfx';

// ==================== 开局：轮回天命赐福四选一 ====================
export function BlessingView({
  run,
  onSelectBlessing,
}: {
  run: RunState;
  onSelectBlessing: (id: BlessingOption['id']) => void;
}) {
  const options = run.blessingOptions ?? [];
  return (
    <main class="panel sub-stage">
      <h2>☯ 天道法旨 · 破壳赐福四选一</h2>
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        第 {run.generation} 世初入凡尘，冥冥之中降下四道天命机缘，择一开启此世仙途：
      </p>
      <div class="choice-list">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            class="btn choice-btn blessing-card"
            onClick={() => {
              sfx.breakthrough();
              onSelectBlessing(opt.id);
            }}
          >
            <strong>✦ {opt.title}</strong>
            <span class="choice-cost">{opt.costText}</span>
            <span class="choice-reward">赐福：{opt.rewardText}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

// ==================== 百年拍卖会：出价竞拍 或 蒙面截胡 ====================
export function AuctionView({
  run,
  onBuyLot,
  onAmbush,
  onLeave,
}: {
  run: RunState;
  onBuyLot: (lotId: string) => void;
  onAmbush: () => void;
  onLeave: () => void;
}) {
  const auction = run.auction!;
  const hasUnclaimed = auction.lots.some((l) => !l.claimed);

  return (
    <main class="panel sub-stage">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h2>🏮 百年仙盟拍卖会 · 压轴珍品</h2>
        <button type="button" class="btn btn-primary" onClick={onLeave}>
          离场赶路 ➔
        </button>
      </div>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
        高台之上数件稀世压轴拍品引得满座元婴老怪侧目。你可凭灵石堂堂正正拍下，亦可暗记买主气息，散场后<strong>黑衣蒙面杀人夺宝</strong>！
      </p>

      <div class="choice-list">
        {auction.lots.map((lot) => (
          <button
            key={lot.id}
            type="button"
            class="btn choice-btn"
            disabled={lot.claimed || run.gold < lot.price}
            onClick={() => {
              sfx.coin();
              onBuyLot(lot.id);
            }}
          >
            <strong>
              {lot.name} {lot.claimed ? '【已拍得】' : `— 竞拍价 ${lot.price} 灵石`}
            </strong>
            <span class="choice-reward">{lot.description}</span>
          </button>
        ))}
      </div>

      {hasUnclaimed && (
        <div class="panel" style={{ padding: '14px', borderColor: 'var(--red)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <strong style={{ color: '#ffada4' }}>🗡️ 灵石不够？散场后蒙面截杀得主！</strong>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              立即免费强夺 1 件未售出的压轴拍品，随后直接迎战【狂暴护宝大修】（击败额外掉三界道果！）
            </div>
          </div>
          <button
            type="button"
            class="btn btn-danger"
            onClick={() => {
              sfx.sha();
              onAmbush();
            }}
          >
            杀人夺宝 ⚔️
          </button>
        </div>
      )}
    </main>
  );
}

// ==================== 战利品 & 破境 / 飞升法则升维结算 ====================
export function RewardView({
  run,
  onPickCard,
  onPickRelic,
  onPickMaterial,
  onPickConsumable,
  onPickTreasure,
  onPickMethod,
  onPickTrueSpirit,
  onPickSupremeLaw,
  onPickLaw,
  onContinue,
}: {
  run: RunState;
  onPickCard: (defId: string) => void;
  onPickRelic: () => void;
  onPickMaterial: () => void;
  onPickConsumable: () => void;
  onPickTreasure: () => void;
  onPickMethod: (methodId: SecondaryMethodId) => void;
  onPickTrueSpirit: (spiritId: TrueSpiritId) => void;
  onPickSupremeLaw: (lawId: SupremeLawId) => void;
  onPickLaw: (lawId: string) => void;
  onContinue: () => void;
}) {
  const rew = run.reward!;
  const gradeTitle =
    rew.breakthroughGrade === 'heaven'
      ? '【天道破境】仙霞贯顶，金色法则降临！'
      : '【地道破境】根基稳固，气血上限大涨！';

  const mustPickLaw = Boolean(rew.lawChoices?.length && !rew.pickedLaw);
  const mustPickSpirit = Boolean(rew.trueSpiritChoices?.length && !rew.pickedTrueSpirit);
  const mustPickSupreme = Boolean(rew.supremeLawChoices?.length && !rew.pickedSupremeLaw);

  return (
    <main class="panel sub-stage">
      <h2>
        {rew.worldAscensionTitle
          ? rew.worldAscensionTitle
          : rew.isBossReward
            ? `破境功成 · ${gradeTitle}`
            : '战利品与机缘收取'}
      </h2>

      {rew.worldAscensionDesc && (
        <div
          class="panel"
          style={{
            padding: '12px 14px',
            borderColor: '#ffd875',
            background: 'rgba(56, 42, 16, 0.55)',
            color: '#fff3cc',
            fontSize: '13.5px',
            lineHeight: 1.6,
          }}
        >
          {rew.worldAscensionDesc}
        </div>
      )}

      {(rew.gold > 0 || rew.maxHpGained || rew.daoTokenGained) && (
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          {rew.gold > 0 ? <>获得 <strong>{rew.gold} 灵石</strong></> : null}
          {rew.maxHpGained ? ` · 气血上限 +${rew.maxHpGained}（已回满全部气血）` : ''}
          {rew.daoTokenGained ? ' · ✦ 斩获【掌天道果信物】×1！' : ''}
        </p>
      )}

      {/* 灵界飞升：真灵血脉三选一 */}
      {rew.trueSpiritChoices && rew.trueSpiritChoices.length > 0 && !rew.pickedTrueSpirit && (
        <div>
          <h3 style={{ color: '#8ff5e2', margin: '0 0 8px' }}>🦅 灵界法则升维：择一觉醒【真灵血脉】（必选）</h3>
          <div class="choice-list">
            {rew.trueSpiritChoices.map((sp) => (
              <button
                key={sp.id}
                type="button"
                class="btn choice-btn"
                style={{ borderColor: '#8ff5e2' }}
                onClick={() => {
                  sfx.breakthrough();
                  onPickTrueSpirit(sp.id);
                }}
              >
                <strong>[{sp.badge}] {sp.name}</strong>
                <span class="choice-reward">{sp.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 仙界飞升：三大至尊法则三选一 */}
      {rew.supremeLawChoices && rew.supremeLawChoices.length > 0 && !rew.pickedSupremeLaw && (
        <div>
          <h3 style={{ color: '#ffe599', margin: '0 0 8px' }}>⏳ 仙界法则升维：参悟【三大至尊法则】（必选）</h3>
          <div class="choice-list">
            {rew.supremeLawChoices.map((sl) => (
              <button
                key={sl.id}
                type="button"
                class="btn choice-btn"
                style={{ borderColor: '#ffd875' }}
                onClick={() => {
                  sfx.breakthrough();
                  onPickSupremeLaw(sl.id);
                }}
              >
                <strong>[{sl.badge}] {sl.name}</strong>
                <span class="choice-reward">{sl.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                  sfx.breakthrough();
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

      {/* 辅修心法三选一（开启跨流派邪道 BD！） */}
      {rew.methodChoices && rew.methodChoices.length > 0 && !rew.pickedMethod && (
        <div>
          <h3 style={{ color: '#9cf5be', margin: '0 0 8px' }}>☯ 兼修异派：择一【辅修心法】开启双修化学反应（可不选保持纯修）</h3>
          <div class="choice-list">
            {rew.methodChoices.map((m) => (
              <button
                key={m.id}
                type="button"
                class="btn choice-btn"
                style={{ borderColor: '#68c98e' }}
                onClick={() => {
                  sfx.resonance();
                  onPickMethod(m.id);
                }}
              >
                <strong>[{m.badge}] {m.name}</strong>
                <span class="choice-reward">{m.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 额外掉落：古宝、附魔材料、乾坤丹符、法宝 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {rew.relicReward && !rew.pickedRelic && (
          <button type="button" class="btn btn-primary" onClick={() => { sfx.coin(); onPickRelic(); }}>
            ◈ 收取古宝：{rew.relicReward.name}（{rew.relicReward.description}）
          </button>
        )}
        {rew.consumableReward && !rew.pickedConsumable && (
          <button type="button" class="btn" onClick={() => { sfx.heal(); onPickConsumable(); }}>
            {rew.consumableReward.icon} 收入丹符袋：{rew.consumableReward.name}（{rew.consumableReward.description}）
          </button>
        )}
        {rew.materialReward && !rew.pickedMaterial && (
          <button type="button" class="btn" onClick={() => { sfx.click(); onPickMaterial(); }}>
            ❖ 收取附魔材：{rew.materialReward.materialName}（{rew.materialReward.description}）
          </button>
        )}
        {rew.treasureReward && !rew.pickedTreasure && (
          <button type="button" class="btn" onClick={() => { sfx.treasure(); onPickTreasure(); }}>
            🏺 收取本命法宝：{rew.treasureReward.name}（{rew.treasureReward.description}）
          </button>
        )}
      </div>

      {/* 神通三选一 */}
      {rew.cardChoices.length > 0 && (
        !rew.pickedCard ? (
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
        )
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          class="btn btn-primary"
          disabled={mustPickLaw || mustPickSpirit || mustPickSupreme}
          onClick={() => {
            sfx.click();
            onContinue();
          }}
        >
          {rew.isBossReward ? '踏入下一卷仙途 ➔' : '进入山海灵脉图 ➔'}
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
              ⚗️ 开炉炼丹（回血/凝奇丹/涨上限）
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
                  sfx.heal();
                  setBrewMsg(onBrew('steady'));
                }}
              >
                <strong>文火稳炼 · 固本培元丹（附赠战中奇丹！）</strong>
                <span class="choice-reward">100% 成功：恢复 40% 最大气血，且若丹符袋未满额外凝出 1 枚战中奇丹</span>
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
                <span class="choice-reward">68% 绝世成丹：最大气血永久 +12、恢复 22 点气血</span>
                <span class="choice-cost">32% 炸炉反噬：扣 10 气血并塞入 1 张【心魔低语】</span>
              </button>
            </div>
          )}

          {tab === 'purge' && (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                点击永久删除一张牌（顺带调息恢复 6 点气血，牌库最少保留 5 张）：
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
  onBuyConsumable,
  onBuyElixir,
  onPurgeCard,
  onLeave,
}: {
  run: RunState;
  onBuyCard: (idx: number) => void;
  onBuyRelic: (idx: number) => void;
  onBuyMaterial: (idx: number) => void;
  onBuyConsumable: (idx: number) => void;
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
          onClick={() => { sfx.coin(); onBuyElixir(); }}
        >
          🍶 购壮魄青灵丹（{shop.elixirPrice} 灵石：最大气血+10、回25血）{shop.elixirBought ? ' [已售罄]' : ''}
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
        <h3 style={{ margin: '0 0 8px', color: 'var(--gold)' }}>乾坤丹符、古宝与天材地宝</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {shop.consumables.map((item, idx) => (
            <button
              key={`${item.def.id}-${idx}`}
              type="button"
              class="btn"
              disabled={item.sold || run.gold < item.price || run.consumables.length >= 3}
              onClick={() => { sfx.coin(); onBuyConsumable(idx); }}
            >
              {item.def.icon} {item.def.name} ({item.price}灵石) — {item.def.description}
              {item.sold ? ' [已购]' : run.consumables.length >= 3 ? ' [袋满]' : ''}
            </button>
          ))}
          {shop.relics.map((item, idx) => (
            <button
              key={item.def.id}
              type="button"
              class="btn"
              disabled={item.sold || run.gold < item.price}
              onClick={() => { sfx.coin(); onBuyRelic(idx); }}
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
              onClick={() => { sfx.coin(); onBuyMaterial(idx); }}
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
              onClick={() => { sfx.coin(); onBuyCard(idx); }}
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
          <span class="choice-reward">最大气血永久 +15，并恢复 30 点气血</span>
        </button>
      </div>
    </main>
  );
}

// ==================== 轮回结算页 ====================
export function SettlementView({
  run,
  karmaEarned,
  newAchievements,
  onReturnTitle,
}: {
  run: RunState;
  karmaEarned: number;
  newAchievements: string[];
  onReturnTitle: () => void;
}) {
  const isWin = run.phase === 'victory';
  return (
    <main class="panel sub-stage" style={{ textAlign: 'center', borderColor: isWin ? 'var(--gold-bright)' : 'var(--red)' }}>
      <h2>{isWin ? `✦ ${run.endingTitle ?? '问道飞升'}` : '⏳ 尘缘已尽 · 步入轮回'}</h2>
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        第 {run.generation} 世 · {run.name} · {LINEAGES[run.lineage].name} · 止步 {REALM_NAMES[run.realm]}（气血上限 {run.maxHp}）
      </p>
      <p style={{ margin: 0 }}>{isWin ? '你的道名已刻入三界碑，并解锁更高重【天道劫数】！' : run.deathCause}</p>

      {newAchievements.length > 0 && (
        <div class="panel" style={{ padding: '12px', borderColor: '#ffd875' }}>
          <div style={{ color: '#ffe599', fontWeight: 700, marginBottom: '6px' }}>🏆 此世达成修仙名场面成就！</div>
          {newAchievements.map((aid) => {
            const def = ACHIEVEMENTS.find((a) => a.id === aid);
            return def ? (
              <div key={aid} style={{ fontSize: '13px', color: 'var(--green)' }}>
                ★ 【{def.name}】— {def.unlockText}
              </div>
            ) : null;
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px' }}>
        <span class="hud-pill gold">☯ 轮回道果 +{karmaEarned}</span>
        <span class="hud-pill">⚔️ 胜场 {run.stats.battlesWon}</span>
        <span class="hud-pill">💥 最高一击 {run.stats.maxSingleHit ?? 0}</span>
        <span class="hud-pill">✦ 共鸣 {run.stats.resonancesTriggered} 次</span>
      </div>
      <p style={{ fontSize: '13px', color: '#d2b8ff', margin: 0 }}>
        🪦 此世最强神通与法宝已化作【前世遗蜕】，将在下一世对应卷的星宿地图中静候重逢。
      </p>
      <div>
        <button type="button" class="btn btn-primary" onClick={onReturnTitle}>
          重回轮回盘 · 开启下一世
        </button>
      </div>
    </main>
  );
}

// ==================== 轮回天书 · 名场面成就 · 万法图鉴总览 ====================
export function CodexScreen({
  meta,
  onUnlockLineage,
  onBuyReroll,
  onBack,
}: {
  meta: MetaSave;
  onUnlockLineage: (id: LineageId, cost: number) => void;
  onBuyReroll: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'unlock' | 'achievements' | 'cards' | 'foes'>('unlock');
  const allCards = Object.values(CARDS).filter((c) => !c.tokenOnly && c.type !== 'curse');
  const allEnemies = Object.values(ENEMIES);

  return (
    <main class="panel sub-stage" style={{ maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h2>📖 轮回天书 · 万法图鉴</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span class="hud-pill gold">可用道果：{meta.karmaPoints}</span>
          <button type="button" class="btn btn-sm" onClick={onBack}>返回首页</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" class={`btn btn-sm${tab === 'unlock' ? ' btn-primary' : ''}`} onClick={() => setTab('unlock')}>
          ☯ 道统与生平碑
        </button>
        <button type="button" class={`btn btn-sm${tab === 'achievements' ? ' btn-primary' : ''}`} onClick={() => setTab('achievements')}>
          🏆 名场面成就 ({meta.achievements.length}/{ACHIEVEMENTS.length})
        </button>
        <button type="button" class={`btn btn-sm${tab === 'cards' ? ' btn-primary' : ''}`} onClick={() => setTab('cards')}>
          🃏 万法神通录 ({allCards.length})
        </button>
        <button type="button" class={`btn btn-sm${tab === 'foes' ? ' btn-primary' : ''}`} onClick={() => setTab('foes')}>
          👹 三界强敌志 ({allEnemies.length})
        </button>
      </div>

      {tab === 'unlock' && (
        <>
          <div class="choice-list">
            {LINEAGE_LIST.filter((l) => l.unlockCost > 0).map((lin) => {
              const owned = meta.unlockedLineages.includes(lin.id);
              return (
                <button
                  key={lin.id}
                  type="button"
                  class="btn choice-btn"
                  disabled={owned || meta.karmaPoints < lin.unlockCost}
                  onClick={() => onUnlockLineage(lin.id, lin.unlockCost)}
                >
                  <strong>解锁新道统：{lin.name}</strong>
                  <span class="choice-reward">{lin.description}</span>
                  <span class="choice-cost">{owned ? '✓ 已解锁' : `消耗 ${lin.unlockCost} 道果`}</span>
                </button>
              );
            })}

            <button
              type="button"
              class="btn choice-btn"
              disabled={meta.rerollCharges >= 6 || meta.karmaPoints < 35 + meta.rerollCharges * 20}
              onClick={onBuyReroll}
            >
              <strong>天机改命 · 开局灵根重掷次数 +1（当前 {meta.rerollCharges}/6）</strong>
              <span class="choice-cost">
                {meta.rerollCharges >= 6 ? '已满级' : `消耗 ${35 + meta.rerollCharges * 20} 道果`}
              </span>
            </button>
          </div>

          {meta.hallOfFame.length > 0 && (
            <div>
              <h3 style={{ color: 'var(--gold)', margin: '8px 0' }}>百世生平碑</h3>
              <div class="choice-list">
                {meta.hallOfFame.slice(0, 8).map((row) => (
                  <div key={`${row.generation}-${row.name}`} class="panel" style={{ padding: '10px 14px', fontSize: '13px' }}>
                    <strong>第 {row.generation} 世 · {row.name}</strong>（{LINEAGES[row.lineage].name} · {REALM_NAMES[row.realm]} · 气血上限 {row.maxHp}）— {row.cause} · 道果 +{row.karmaEarned}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'achievements' && (
        <div class="choice-list">
          {ACHIEVEMENTS.map((ach) => {
            const done = meta.achievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                class="panel"
                style={{
                  padding: '12px 16px',
                  borderColor: done ? '#ffd875' : 'var(--line)',
                  opacity: done ? 1 : 0.78,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: done ? '#ffe599' : 'var(--text)' }}>
                    {done ? '★ ' : '☆ '}
                    {ach.name}
                  </strong>
                  <span style={{ fontSize: '12px', color: done ? 'var(--green)' : 'var(--muted)' }}>
                    {done ? '✓ 已达成并解锁入池' : '未达成'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>条件：{ach.conditionText}</div>
                <div style={{ fontSize: '12px', color: 'var(--gold)', marginTop: '3px' }}>奖励：{ach.unlockText}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'cards' && (
        <>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            包含四大道统、五行通池及暗金禁术；另有 {Object.keys(RELICS).length} 件古宝法则与 {Object.keys(CONSUMABLES).length} 种乾坤丹符。
          </div>
          <div class="hand-grid">
            {allCards.map((def) => (
              <CardView key={def.id} def={def} />
            ))}
          </div>
        </>
      )}

      {tab === 'foes' && (
        <div class="lineage-grid">
          {allEnemies.map((foe) => (
            <div key={foe.id} class="panel" style={{ padding: '12px' }}>
              <div class="lineage-thumb-wrap" style={{ height: '165px' }}>
                <img
                  src={ENEMY_PORTRAITS_BY_ID[foe.id] ?? ENEMY_FALLBACK_PORTRAITS[foe.artStyle]}
                  alt={foe.name}
                  class="lineage-thumb"
                />
              </div>
              <strong style={{ color: 'var(--gold-bright)', fontSize: '15px' }}>{foe.name}</strong>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {WORLD_INFO[getWorldByAct(foe.act)].badge} · 第 {foe.act} 卷 · {foe.title} · 气血 {foe.maxHp}
              </div>
              {foe.trait && (
                <div style={{ fontSize: '12px', color: '#ffb88c', marginTop: '4px' }}>
                  ⚖ 法则【{foe.trait.name}】：{foe.trait.description}
                </div>
              )}
              {foe.phase2 && (
                <div style={{ fontSize: '12px', color: '#e2c6ff', marginTop: '4px' }}>
                  👹 二阶段：{foe.phase2.title}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
