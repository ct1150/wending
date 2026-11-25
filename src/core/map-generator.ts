import { SeededRng } from './rng';
import type { MapNode, MapNodeType, PastLifeRemnant } from './types';

const NODE_META: Record<MapNodeType, { label: string; ageMin: number; ageMax: number }> = {
  battle: { label: '荒野遇敌', ageMin: 1, ageMax: 2 },
  elite: { label: '秘境夺宝', ageMin: 3, ageMax: 3 },
  event: { label: '红尘奇遇', ageMin: 1, ageMax: 2 },
  abode: { label: '洞府丹庐', ageMin: 2, ageMax: 2 },
  shop: { label: '仙城坊市', ageMin: 1, ageMax: 1 },
  remnant: { label: '前世遗蜕', ageMin: 2, ageMax: 2 },
  boss: { label: '破境大劫', ageMin: 3, ageMax: 3 },
};

const ACT_BOSS_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '筑基天劫 · 九霄雷云',
  2: '金丹大劫 · 紫府斩魔',
  3: '飞升雷劫 · 登仙问鼎',
  4: '上界问鼎 · 太初天道',
};

export function generateActMap(
  act: 1 | 2 | 3 | 4,
  rng: SeededRng,
  remnant: PastLifeRemnant | null,
): MapNode[] {
  if (act === 4) {
    // 隐藏第四卷：4 层高密度终局连战
    const n1: MapNode = { id: 'a4-r0-c1', act: 4, row: 0, col: 1, type: 'elite', label: '南天门 · 巡界仙卫', ageCost: 2, nextIds: ['a4-r1-c1'], visited: false };
    const n2: MapNode = { id: 'a4-r1-c1', act: 4, row: 1, col: 1, type: 'abode', label: '凌霄洞府 · 最后整备', ageCost: 2, nextIds: ['a4-r2-c0', 'a4-r2-c2'], visited: false };
    const n3a: MapNode = { id: 'a4-r2-c0', act: 4, row: 2, col: 0, type: 'shop', label: '太虚珍宝阁', ageCost: 1, nextIds: ['a4-r3-c1'], visited: false };
    const n3b: MapNode = { id: 'a4-r2-c2', act: 4, row: 2, col: 2, type: 'elite', label: '太初劫兽 · 镇鼎古灵', ageCost: 3, nextIds: ['a4-r3-c1'], visited: false };
    const boss: MapNode = { id: 'a4-r3-c1', act: 4, row: 3, col: 1, type: 'boss', label: ACT_BOSS_LABELS[4], ageCost: 3, nextIds: [], visited: false };
    return [n1, n2, n3a, n3b, boss];
  }

  const totalRows = 10; // rows 0..9 + row 10 boss = 11 layers
  const rows: MapNode[][] = [];

  for (let row = 0; row < totalRows; row++) {
    const colCount = row === 0 ? 3 : row === totalRows - 1 ? 2 : rng.int(2, 3);
    const cols = colCount === 3 ? [0, 1, 2] : rng.pick([[0, 2], [0, 1], [1, 2]]);
    const rowNodes: MapNode[] = [];

    for (const col of cols) {
      let type: MapNodeType;
      if (row === 0) {
        type = 'battle';
      } else if (row === totalRows - 1) {
        type = 'abode'; // 渡劫前必定提供整备洞府
      } else if (row === 4) {
        type = col === cols[0] ? 'elite' : rng.next() < 0.5 ? 'abode' : 'event';
      } else if (row === 7) {
        type = col === cols[cols.length - 1] ? 'shop' : 'elite';
      } else {
        type = rng.weightedPick<MapNodeType>(
          ['battle', 'event', 'elite', 'abode', 'shop'],
          (t) => {
            if (t === 'battle') return 42;
            if (t === 'event') return 26;
            if (t === 'elite') return row >= 2 ? 14 : 0;
            if (t === 'abode') return row >= 2 ? 12 : 4;
            if (t === 'shop') return row >= 2 ? 9 : 0;
            return 0;
          },
        );
      }
      const meta = NODE_META[type];
      rowNodes.push({
        id: `a${act}-r${row}-c${col}`,
        act,
        row,
        col,
        type,
        label: meta.label,
        ageCost: rng.int(meta.ageMin, meta.ageMax),
        nextIds: [],
        visited: false,
      });
    }
    rows.push(rowNodes);
  }

  // 若存在对应本卷的前世遗蜕，在第 3~6 层随机注入一个【前世遗蜕】节点
  if (remnant && remnant.act === act) {
    const targetRow = rng.int(3, 6);
    const candidate = rng.pick(rows[targetRow]);
    candidate.type = 'remnant';
    candidate.label = `前世遗蜕 · ${remnant.name}`;
    candidate.ageCost = 2;
  }

  const bossNode: MapNode = {
    id: `a${act}-r${totalRows}-c1`,
    act,
    row: totalRows,
    col: 1,
    type: 'boss',
    label: ACT_BOSS_LABELS[act],
    ageCost: 3,
    nextIds: [],
    visited: false,
  };
  rows.push([bossNode]);

  // 建立星宿连线：保证每个节点至少有 1 条出边且下层每个节点至少有 1 条入边
  for (let r = 0; r < rows.length - 1; r++) {
    const curr = rows[r];
    const next = rows[r + 1];
    const incoming = new Set<string>();

    for (const node of curr) {
      const sorted = [...next].sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
      const primary = sorted[0];
      node.nextIds.push(primary.id);
      incoming.add(primary.id);
      if (sorted.length > 1 && Math.abs(sorted[1].col - node.col) <= 1 && rng.next() < 0.55) {
        node.nextIds.push(sorted[1].id);
        incoming.add(sorted[1].id);
      }
    }

    for (const target of next) {
      if (!incoming.has(target.id)) {
        const nearest = [...curr].sort((a, b) => Math.abs(a.col - target.col) - Math.abs(b.col - target.col))[0];
        if (!nearest.nextIds.includes(target.id)) {
          nearest.nextIds.push(target.id);
        }
      }
    }
  }

  return rows.flat();
}

export function getReachableNodeIds(map: MapNode[], currentNodeId: string | null): string[] {
  if (!currentNodeId) {
    return map.filter((n) => n.row === 0).map((n) => n.id);
  }
  const curr = map.find((n) => n.id === currentNodeId);
  return curr ? curr.nextIds : [];
}
