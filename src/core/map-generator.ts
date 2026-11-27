import { SeededRng } from './rng';
import type { MapNode, MapNodeType, PastLifeRemnant } from './types';

const SCENIC_NAMES_BY_ACT: Record<1 | 2 | 3 | 4, Record<Exclude<MapNodeType, 'remnant' | 'boss'>, string[]>> = {
  1: {
    battle: ['迷雾竹海', '断剑古道', '落霞寒涧', '野狐荒岭', '青石古渡', '松风剑坪', '碎玉山坳'],
    elite: ['黑风古刹', '寒潭蛟窟', '古修残塚'],
    'fury-elite': ['赤煞灵脉眼', '血煞荒坛'],
    event: ['青牛古镇', '云游茶肆', '残碑问心', '山神古祠', '桃源石室'],
    abode: ['紫竹丹庐', '清泉静室', '灵眼石窟'],
    shop: ['青云仙集', '散修夜市'],
    auction: ['百宝阁雅集'],
  },
  2: {
    battle: ['坠星荒原', '赤炎峡谷', '阴风古涧', '白骨剑林', '流沙魔径', '寒鸦渡口', '断魂崖'],
    elite: ['万剑残冢', '紫极魔殿', '玄阴尸窟'],
    'fury-elite': ['天魔煞脉眼', '焚天血池'],
    event: ['血月古墟', '诡市盲盒', '古钟仙台', '荒漠残阵', '弈剑石亭'],
    abode: ['紫极丹崖', '地火灵庐', '悟道古洞'],
    shop: ['千机仙坊', '万宝楼船'],
    auction: ['百年仙盟拍场'],
  },
  3: {
    battle: ['雷鸣天堑', '太虚云海', '罡风绝壁', '碎星浮岛', '玄冰古径', '金乌残墟', '登天石阶'],
    elite: ['鲲鹏遗巢', '真凰梧桐岭', '镇狱仙台'],
    'fury-elite': ['太古狂雷眼', '混沌煞渊'],
    event: ['摘星古台', '昆仑仙泉', '天机棋局', '古仙残魂', '浮空道碑'],
    abode: ['混沌灵池', '九天丹阙', '瑶光洞天'],
    shop: ['瑶池仙集', '弥罗奇珍阁'],
    auction: ['九霄压轴盛会'],
  },
  4: {
    battle: ['南天云阶'],
    elite: ['南天门 · 巡界仙卫'],
    'fury-elite': ['太初劫兽 · 狂暴仙灵'],
    event: ['凌霄问道台'],
    abode: ['凌霄洞府 · 最后整备'],
    shop: ['帝乡仙市'],
    auction: ['仙界万宝拍卖'],
  },
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
    const n1: MapNode = { id: 'a4-r0-c1', act: 4, row: 0, col: 1, type: 'elite', label: '南天门 · 巡界仙卫', nextIds: ['a4-r1-c1'], visited: false };
    const n2: MapNode = { id: 'a4-r1-c1', act: 4, row: 1, col: 1, type: 'abode', label: '凌霄洞府 · 最后整备', nextIds: ['a4-r2-c0', 'a4-r2-c2'], visited: false };
    const n3a: MapNode = { id: 'a4-r2-c0', act: 4, row: 2, col: 0, type: 'auction', label: '仙界万宝拍卖', nextIds: ['a4-r3-c1'], visited: false };
    const n3b: MapNode = { id: 'a4-r2-c2', act: 4, row: 2, col: 2, type: 'fury-elite', label: '太初劫兽 · 狂暴仙灵', nextIds: ['a4-r3-c1'], visited: false };
    const boss: MapNode = { id: 'a4-r3-c1', act: 4, row: 3, col: 1, type: 'boss', label: ACT_BOSS_LABELS[4], nextIds: [], visited: false };
    return [n1, n2, n3a, n3b, boss];
  }

  const totalRows = 10;
  const rows: MapNode[][] = [];
  const usedNames = new Set<string>();

  const pickScenicLabel = (type: Exclude<MapNodeType, 'remnant' | 'boss'>, row: number, col: number): string => {
    const list = SCENIC_NAMES_BY_ACT[act][type];
    const unused = list.filter((n) => !usedNames.has(n));
    const chosen = unused.length > 0 ? unused[(row * 3 + col) % unused.length] : list[(row + col) % list.length];
    usedNames.add(chosen);
    return chosen;
  };

  for (let row = 0; row < totalRows; row++) {
    const colCount = row === 0 ? 3 : row === totalRows - 1 ? 2 : rng.int(2, 3);
    const cols = colCount === 3 ? [0, 1, 2] : rng.pick([[0, 2], [0, 1], [1, 2]]);
    const rowNodes: MapNode[] = [];

    for (const col of cols) {
      let type: Exclude<MapNodeType, 'remnant' | 'boss'>;
      if (row === 0) {
        type = 'battle';
      } else if (row === totalRows - 1) {
        type = 'abode';
      } else if (row === 4) {
        type = col === cols[0] ? 'elite' : rng.next() < 0.5 ? 'abode' : 'event';
      } else if (row === 5 && act >= 2 && col === cols[cols.length - 1]) {
        type = 'auction';
      } else if (row === 6 && col === cols[0]) {
        type = 'fury-elite';
      } else if (row === 7) {
        type = col === cols[cols.length - 1] ? 'shop' : 'elite';
      } else {
        type = rng.weightedPick<Exclude<MapNodeType, 'remnant' | 'boss'>>(
          ['battle', 'event', 'elite', 'abode', 'shop'],
          (t) => {
            if (t === 'battle') return 42;
            if (t === 'event') return 26;
            if (t === 'elite') return row >= 2 ? 13 : 0;
            if (t === 'abode') return row >= 2 ? 12 : 4;
            if (t === 'shop') return row >= 2 ? 9 : 0;
            return 0;
          },
        );
      }
      rowNodes.push({
        id: `a${act}-r${row}-c${col}`,
        act,
        row,
        col,
        type,
        label: pickScenicLabel(type, row, col),
        nextIds: [],
        visited: false,
      });
    }
    rows.push(rowNodes);
  }

  if (remnant && remnant.act === act) {
    const targetRow = rng.int(3, 5);
    const candidate = rows[targetRow].find((n) => n.type !== 'auction' && n.type !== 'fury-elite') ?? rows[targetRow][0];
    candidate.type = 'remnant';
    candidate.label = `前世遗蜕 · ${remnant.name}`;
  }

  const bossNode: MapNode = {
    id: `a${act}-r${totalRows}-c1`,
    act,
    row: totalRows,
    col: 1,
    type: 'boss',
    label: ACT_BOSS_LABELS[act],
    nextIds: [],
    visited: false,
  };
  rows.push([bossNode]);

  for (let r = 0; r < rows.length - 1; r++) {
    const curr = rows[r];
    const next = rows[r + 1];
    const incoming = new Set<string>();

    for (const node of curr) {
      const sorted = [...next].sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
      const primary = sorted[0];
      node.nextIds.push(primary.id);
      incoming.add(primary.id);
      if (sorted.length > 1 && Math.abs(sorted[1].col - node.col) <= 1 && rng.next() < 0.58) {
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
