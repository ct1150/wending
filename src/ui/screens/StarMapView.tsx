import { ACT_TITLES } from '../../content/lineages';
import { getReachableNodeIds } from '../../core/map-generator';
import type { MapNode, MapNodeType, RunState } from '../../core/types';

const NODE_ICONS: Record<MapNodeType, string> = {
  battle: '⚔️',
  elite: '👹',
  event: '☯',
  abode: '🔥',
  shop: '💰',
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

  const actInfo = ACT_TITLES[run.act];
  const gradeLabel =
    run.foundation >= 85 ? '天道破境（金色法则）' : run.foundation >= 50 ? '地道破境' : '凡品破境';

  return (
    <main class="map-stage">
      <div class="map-header">
        <h2>{actInfo.name}</h2>
        <p>{actInfo.subtitle}</p>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gold)' }}>
          当前预估破境品阶：<strong>{gradeLabel}</strong>（道基 {run.foundation}/100）
          {run.ascension > 0 ? ` · 天道劫数 第 ${run.ascension} 重` : ''}
        </div>
      </div>

      <section class="panel map-canvas">
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
                      <span class="node-cost">耗寿 {node.ageCost} 年</span>
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
