import { ACT_TITLES } from '../../content/lineages';
import { getReachableNodeIds } from '../../core/map-generator';
import type { MapNode, MapNodeType, RunState } from '../../core/types';

const NODE_ICONS: Record<MapNodeType, string> = {
  battle: '⚔️',
  elite: '👹',
  'fury-elite': '🔥',
  event: '☯',
  abode: '⚗️',
  shop: '💰',
  auction: '🏮',
  remnant: '🪦',
  boss: '⛈️',
};

interface StarMapViewProps {
  run: RunState;
  onSelectNode: (nodeId: string) => void;
}

export function StarMapView({ run, onSelectNode }: StarMapViewProps) {
  const reachable = new Set(getReachableNodeIds(run.map, run.currentNodeId));
  const maxRow = Math.max(...run.map.map((n) => n.row));
  const rows: MapNode[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    rows.push(run.map.filter((n) => n.row === r).sort((a, b) => a.col - b.col));
  }

  // 计算 SVG 星轨连线归一化坐标（col 0..2 -> x 16.6%, 50%, 83.3%；row 从底向上排布）
  const nodeById = new Map(run.map.map((n) => [n.id, n]));
  const xPct = (n: MapNode) => (n.type === 'boss' ? 50 : 16.66 + n.col * 33.33);
  const yPct = (n: MapNode) => ((maxRow - n.row + 0.5) / (maxRow + 1)) * 100;

  const edges: { key: string; x1: number; y1: number; x2: number; y2: number; active: boolean }[] = [];
  for (const node of run.map) {
    for (const targetId of node.nextIds) {
      const target = nodeById.get(targetId);
      if (!target) continue;
      const active =
        (run.currentNodeId === node.id && reachable.has(target.id)) ||
        (node.visited && target.visited);
      edges.push({
        key: `${node.id}->${target.id}`,
        x1: xPct(node),
        y1: yPct(node),
        x2: xPct(target),
        y2: yPct(target),
        active,
      });
    }
  }

  const actInfo = ACT_TITLES[run.act];
  const gradeLabel =
    run.foundation >= 85 ? '天道破境（金色法则）' : run.foundation >= 50 ? '地道破境' : '凡品破境';

  return (
    <main class="map-stage">
      <div class="map-header">
        <h2>{actInfo.name}</h2>
        <p>{actInfo.subtitle}</p>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gold)' }}>
          预估破境品阶：<strong>{gradeLabel}</strong>（道基 {run.foundation}/100）
          {run.ascension > 0 ? ` · 天道劫数 第 ${run.ascension} 重` : ''}
          {run.isDailyChallenge ? ` · ☯ 每日天机 (${run.dailyDate})` : ''}
        </div>
      </div>

      <section class="panel map-canvas">
        {/* 鎏金星轨连线层 */}
        <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map((e) => (
            <line
              key={e.key}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.active ? 'rgba(250, 224, 174, 0.85)' : 'rgba(207, 183, 131, 0.24)'}
              stroke-width={e.active ? '0.65' : '0.32'}
              stroke-dasharray={e.active ? undefined : '1.2 1.2'}
            />
          ))}
        </svg>

        <div class="map-rows">
          {rows.map((rowNodes, rowIdx) => {
            const isBossRow = rowNodes.length === 1 && rowNodes[0].type === 'boss';
            if (isBossRow) {
              const boss = rowNodes[0];
              const canPick = reachable.has(boss.id);
              return (
                <div key={rowIdx} class="map-row">
                  <button
                    type="button"
                    class={`map-node-btn boss${canPick ? ' reachable' : ''}${boss.visited ? ' visited' : ''}`}
                    disabled={!canPick}
                    onClick={() => canPick && onSelectNode(boss.id)}
                  >
                    <span class="node-icon">{NODE_ICONS[boss.type]}</span>
                    <span class="node-title">{boss.label}</span>
                    <span class="node-cost">耗寿 {boss.ageCost} 年 · 卷末渡劫</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={rowIdx} class="map-row">
                {[0, 1, 2].map((col) => {
                  const node = rowNodes.find((n) => n.col === col);
                  if (!node) return <div key={col} />;
                  const canPick = reachable.has(node.id);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      class={`map-node-btn ${node.type}${canPick ? ' reachable' : ''}${node.visited ? ' visited' : ''}`}
                      disabled={!canPick}
                      onClick={() => canPick && onSelectNode(node.id)}
                    >
                      <span class="node-icon">{NODE_ICONS[node.type]}</span>
                      <span class="node-title">{node.label}</span>
                      <span class="node-cost">
                        耗寿 {node.ageCost} 年
                        {node.type === 'fury-elite' ? ' · 必掉道果' : node.type === 'auction' ? ' · 竞拍/截胡' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
