import { useEffect, useRef, useState } from 'preact/hooks';
import { ACT_TITLES } from '../../content/lineages';
import { getReachableNodeIds } from '../../core/map-generator';
import type { MapNode, MapNodeType, RunState } from '../../core/types';

const NODE_ICONS: Record<MapNodeType, string> = {
  battle: '⚔',
  elite: '👹',
  'fury-elite': '🔥',
  event: '☯',
  abode: '⚗',
  shop: '💰',
  auction: '🏮',
  remnant: '🪦',
  boss: '⛈',
};

const NODE_ROLE_TAGS: Record<MapNodeType, string> = {
  battle: '斗法',
  elite: '精英·古宝',
  'fury-elite': '狂暴·道果',
  event: '红尘奇遇',
  abode: '洞府闭关',
  shop: '仙城坊市',
  auction: '拍卖夺宝',
  remnant: '前世遗蜕',
  boss: '卷末渡劫',
};

interface StarMapViewProps {
  run: RunState;
  onSelectNode: (nodeId: string) => void;
}

interface PositionedNode {
  node: MapNode;
  xPct: number;
  yPx: number;
}

type EdgeStatus = 'traveled' | 'next-active' | 'future' | 'bypassed';

interface MapEdge {
  key: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: EdgeStatus;
}

export function StarMapView({ run, onSelectNode }: StarMapViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const focusNodeRef = useRef<HTMLButtonElement | null>(null);

  const reachableIds = getReachableNodeIds(run.map, run.currentNodeId);
  const reachable = new Set(reachableIds);
  const maxRow = Math.max(...run.map.map((n) => n.row));
  const nodeById = new Map(run.map.map((n) => [n.id, n]));
  const currentNode = run.currentNodeId ? nodeById.get(run.currentNodeId) ?? null : null;

  // 计算从当前位置出发，后续仍可抵达的所有下游节点（已错过的岔路自动归入迷雾，绝不混淆路线！）
  const downstreamSet = new Set<string>();
  const queue = [...reachableIds];
  while (queue.length > 0) {
    const nid = queue.shift()!;
    if (downstreamSet.has(nid)) continue;
    downstreamSet.add(nid);
    const nd = nodeById.get(nid);
    if (nd) {
      for (const nextId of nd.nextIds) {
        if (!downstreamSet.has(nextId)) queue.push(nextId);
      }
    }
  }

  // 画布采用自上而下展开的「山海寻仙灵脉卷」：山门起点在顶，蜿蜒灵脉一路向下直抵渡劫仙台！
  const rowStepPx = 114;
  const originX = 50;
  const originY = 54;
  const firstRowY = 166;
  const totalHeightPx = firstRowY + maxRow * rowStepPx + 96;
  const svgW = 1000;
  const svgH = totalHeightPx;

  // 为每个节点生成自然错落的山海灵窍坐标（告别死板方格，呈现蜿蜒龙脉气韵）
  const rowCounts = new Map<number, number>();
  for (const n of run.map) {
    rowCounts.set(n.row, (rowCounts.get(n.row) ?? 0) + 1);
  }

  const posMap = new Map<string, PositionedNode>();
  for (const n of run.map) {
    const countInRow = rowCounts.get(n.row) ?? 1;
    let xPct = 50;
    let yJitter = 0;
    if (n.type === 'boss' || countInRow === 1) {
      xPct = 50;
    } else {
      const base = n.col === 0 ? 22 : n.col === 1 ? 50 : 78;
      // 确定性山势蜿蜒偏移，兼顾窄屏牌匾完整显示与山水灵动感
      const wave = Math.sin((n.row + 1) * 1.7 + n.col * 2.3) * 3.6;
      xPct = Math.max(19, Math.min(81, base + wave));
      yJitter = n.col === 1 ? -6 : (n.row % 2 === 0 ? 7 : -5);
    }
    const yPx = firstRowY + n.row * rowStepPx + yJitter;
    posMap.set(n.id, { node: n, xPct, yPx });
  }

  // 构建全部灵脉连线（含山门起点 -> 第1重仙缘）
  const edges: MapEdge[] = [];
  const row0Nodes = run.map.filter((n) => n.row === 0);
  for (const r0 of row0Nodes) {
    const p2 = posMap.get(r0.id)!;
    const status: EdgeStatus = r0.visited
      ? 'traveled'
      : currentNode === null
        ? 'next-active'
        : 'bypassed';
    edges.push({
      key: `origin->${r0.id}`,
      fromId: 'origin',
      toId: r0.id,
      x1: (originX / 100) * svgW,
      y1: originY,
      x2: (p2.xPct / 100) * svgW,
      y2: p2.yPx,
      status,
    });
  }

  for (const node of run.map) {
    const p1 = posMap.get(node.id)!;
    for (const targetId of node.nextIds) {
      const p2 = posMap.get(targetId);
      if (!p2) continue;
      let status: EdgeStatus = 'bypassed';
      if (node.visited && p2.node.visited) {
        status = 'traveled';
      } else if (run.currentNodeId === node.id && reachable.has(targetId)) {
        status = 'next-active';
      } else if (downstreamSet.has(node.id) && downstreamSet.has(targetId)) {
        status = 'future';
      }
      edges.push({
        key: `${node.id}->${targetId}`,
        fromId: node.id,
        toId: targetId,
        x1: (p1.xPct / 100) * svgW,
        y1: p1.yPx,
        x2: (p2.xPct / 100) * svgW,
        y2: p2.yPx,
        status,
      });
    }
  }

  // 进入路线图时，若已深入第 2 重以后，自动平滑滚动到当前道躯所在附近
  useEffect(() => {
    if (currentNode && currentNode.row >= 2 && focusNodeRef.current) {
      focusNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [run.currentNodeId]);

  const actInfo = ACT_TITLES[run.act];
  const hpHealthy = run.hp >= run.maxHp * 0.5;
  const stepNum = currentNode ? currentNode.row + 2 : 1;
  const totalSteps = maxRow + 1;

  // 生成水墨远山层峦剪影
  const mountainBands = Array.from({ length: Math.max(2, Math.ceil(svgH / 320)) }, (_, idx) => {
    const baseY = 230 + idx * 310;
    const flip = idx % 2 === 1;
    const d = flip
      ? `M 0 ${baseY + 55} Q 180 ${baseY - 45} 360 ${baseY + 18} T 740 ${baseY - 28} T 1000 ${baseY + 30} L 1000 ${baseY + 110} L 0 ${baseY + 110} Z`
      : `M 0 ${baseY + 25} Q 220 ${baseY - 52} 440 ${baseY + 14} T 820 ${baseY - 36} T 1000 ${baseY + 22} L 1000 ${baseY + 110} L 0 ${baseY + 110} Z`;
    return { key: `mt-${idx}`, d, baseY };
  });

  return (
    <main class="map-stage">
      <div class="map-header">
        {/* 凡人三部曲 · 三界九卷总览横卷 */}
        <div class="world-progress-bar">
          {[
            { label: '🌏 人界篇', acts: [1, 2, 3] },
            { label: '🌌 灵界篇', acts: [4, 5, 6] },
            { label: '☀️ 仙界篇', acts: [7, 8, 9] },
          ].map((grp) => {
            const inWorld = grp.acts.includes(run.act);
            const passedWorld = run.act > grp.acts[grp.acts.length - 1];
            return (
              <div
                key={grp.label}
                class={`world-stage-pill${inWorld ? ' active' : passedWorld ? ' passed' : ''}`}
              >
                <strong>{grp.label}</strong>
                <span class="world-act-dots">
                  {grp.acts.map((a) => (
                    <i
                      key={a}
                      class={`act-dot${a === run.act ? ' current' : a < run.act ? ' done' : ''}`}
                    >
                      {a}
                    </i>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        <h2>{actInfo.name}</h2>
        <p>{actInfo.subtitle}</p>

        {/* 寻仙罗盘指引条：一眼看清当前在哪、下一步点哪 */}
        <div class="map-compass-bar panel">
          <div class="compass-main">
            <span class="compass-loc">
              📍 当前：{currentNode ? `${currentNode.label}（已历 ${currentNode.row + 1}/${totalSteps} 重）` : `初入山门（待选第 ${stepNum}/${totalSteps} 重仙缘）`}
            </span>
            <span class="compass-hint">
              ➔ 点击<strong>金色流光灵脉</strong>指向的<strong>「可前往」</strong>灵窍继续仙途
            </span>
          </div>
          <div class="compass-legend">
            <span><i class="lg-dot next" /> 金色流光：下一步可选</span>
            <span><i class="lg-dot future" /> 青玉虚线：后续可通</span>
            <span><i class="lg-dot traveled" /> 鎏金实线：已历足迹</span>
            <span>
              破境气血：
              <strong style={{ color: hpHealthy ? 'var(--green)' : '#ffada4' }}>
                {Math.round((run.hp / run.maxHp) * 100)}%
              </strong>
              （≥50% 天道破境）
            </span>
          </div>
        </div>
      </div>

      <section class="panel map-canvas xianxia-scroll" style={{ height: `${totalHeightPx}px` }}>
        {/* 水墨山海流云 + 蜿蜒灵脉 SVG 图层 */}
        <svg
          class="map-lines"
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="arrow-next"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8.5 5 L 0 8.5 L 2.2 5 Z" fill="#ffe89c" />
            </marker>
            <linearGradient id="inkMountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(86, 138, 148, 0.13)" />
              <stop offset="100%" stop-color="rgba(12, 24, 31, 0)" />
            </linearGradient>
          </defs>

          {/* 背景八卦星盘水印 */}
          <g opacity="0.08" stroke="#dfc495" fill="none">
            <circle cx="500" cy={svgH * 0.48} r="220" stroke-width="1.5" stroke-dasharray="8 8" />
            <circle cx="500" cy={svgH * 0.48} r="155" stroke-width="1" />
          </g>

          {/* 层叠水墨远山与祥云气韵 */}
          {mountainBands.map((m) => (
            <g key={m.key}>
              <path d={m.d} fill="url(#inkMountain)" />
              <path
                d={`M 90 ${m.baseY - 18} Q 180 ${m.baseY - 34} 270 ${m.baseY - 16} T 430 ${m.baseY - 20}`}
                fill="none"
                stroke="rgba(223, 196, 149, 0.1)"
                stroke-width="2"
                stroke-linecap="round"
              />
            </g>
          ))}

          {/* 灵脉路径：S 型三次贝塞尔曲线，分四层状态清晰指路 */}
          {edges.map((e) => {
            const dy = e.y2 - e.y1;
            const cy1 = e.y1 + dy * 0.46;
            const cy2 = e.y2 - dy * 0.46;
            // 起止点略收进圆印边缘，让箭头精准落在圆环外侧
            const trimStart = e.fromId === 'origin' ? 20 : 28;
            const trimEnd = e.status === 'next-active' ? 38 : 30;
            const sy1 = e.y1 + trimStart;
            const sy2 = e.y2 - trimEnd;
            const d = `M ${e.x1} ${sy1} C ${e.x1} ${cy1}, ${e.x2} ${cy2}, ${e.x2} ${sy2}`;
            const isHoverOut = hoveredNodeId !== null && e.fromId === hoveredNodeId && e.status !== 'bypassed';

            if (e.status === 'next-active') {
              return (
                <g key={e.key} class="edge-group is-next">
                  {/* 外层灵光晕染 */}
                  <path
                    d={d}
                    class="map-edge-glow"
                    fill="none"
                    stroke="rgba(255, 222, 130, 0.34)"
                    stroke-width="12"
                    stroke-linecap="round"
                  />
                  {/* 主干流光飞剑灵脉 */}
                  <path
                    d={d}
                    class="map-edge-path is-next"
                    fill="none"
                    stroke="#ffe89c"
                    stroke-width="3.8"
                    stroke-dasharray="13 8"
                    stroke-linecap="round"
                    marker-end="url(#arrow-next)"
                  />
                </g>
              );
            }

            if (e.status === 'traveled') {
              return (
                <path
                  key={e.key}
                  d={d}
                  class="map-edge-path is-traveled"
                  fill="none"
                  stroke="rgba(229, 191, 118, 0.88)"
                  stroke-width="3.4"
                  stroke-linecap="round"
                />
              );
            }

            if (e.status === 'future') {
              return (
                <path
                  key={e.key}
                  d={d}
                  class={`map-edge-path is-future${isHoverOut ? ' is-hovered' : ''}`}
                  fill="none"
                  stroke={isHoverOut ? '#ffe89c' : 'rgba(138, 218, 206, 0.52)'}
                  stroke-width={isHoverOut ? '3.2' : '2.3'}
                  stroke-dasharray="7 7"
                  stroke-linecap="round"
                />
              );
            }

            return (
              <path
                key={e.key}
                d={d}
                class="map-edge-path is-bypassed"
                fill="none"
                stroke="rgba(150, 170, 175, 0.14)"
                stroke-width="1.5"
                stroke-dasharray="4 7"
              />
            );
          })}
        </svg>

        {/* 顶部山门启程仙台 */}
        <div
          class={`origin-gate${currentNode === null ? ' is-current' : ' is-passed'}`}
          style={{ left: `${originX}%`, top: `${originY}px` }}
        >
          <span class="origin-pill">
            ⛩{' '}
            {run.act === 1
              ? '七玄山门 · 踏入人界仙途'
              : run.act === 4
                ? '飞仙台 · 初临浩瀚灵界'
                : run.act === 7
                  ? '北寒仙域 · 飞升真仙界'
                  : run.act === 9
                    ? '中土南天门 · 决战凌霄天庭'
                    : `${actInfo.partName} · 寻仙起点`}
            {currentNode === null ? '（当前所在）' : ''}
          </span>
        </div>

        {/* 错落仙山灵窍圆印节点 */}
        {Array.from(posMap.values()).map(({ node, xPct, yPx }) => {
          const canPick = reachable.has(node.id);
          const isCurrent = run.currentNodeId === node.id;
          const isFuture = downstreamSet.has(node.id);
          const isBypassed = !node.visited && !isCurrent && !isFuture;

          return (
            <button
              key={node.id}
              ref={isCurrent || (currentNode === null && node.row === 0 && canPick) ? focusNodeRef : undefined}
              type="button"
              class={[
                'map-node-btn',
                'medallion-node',
                node.type,
                canPick ? 'reachable' : '',
                node.visited ? 'visited' : '',
                isCurrent ? 'current' : '',
                isBypassed ? 'bypassed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${xPct}%`, top: `${yPx}px` }}
              aria-disabled={!canPick}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
              onClick={() => {
                if (canPick) onSelectNode(node.id);
                else setHoveredNodeId((prev) => (prev === node.id ? null : node.id));
              }}
            >
              {/* 顶部当前所在 / 可前往悬浮小令旗 */}
              {isCurrent && <span class="node-flag current-flag">📍 当前道躯</span>}
              {canPick && <span class="node-flag next-flag">⚡ 可前往</span>}

              {/* 核心八卦仙印圆盘 */}
              <span class="medallion-disc">
                <span class="medallion-ring" />
                <span class="node-icon">{NODE_ICONS[node.type]}</span>
              </span>

              {/* 水墨书卷地名牌匾 */}
              <span class="medallion-plaque">
                <span class="node-title">{node.label}</span>
                <span class="node-cost">
                  {node.visited && !isCurrent ? '✓ 已历' : NODE_ROLE_TAGS[node.type]}
                </span>
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}
