import { SeededRng } from './rng';
import type { ActNumber, MapNode, MapNodeType, PastLifeRemnant } from './types';

const SCENIC_NAMES_BY_ACT: Record<ActNumber, Record<Exclude<MapNodeType, 'remnant' | 'boss'>, string[]>> = {
  1: {
    battle: ['七玄门后山', '太南谷林径', '血色禁地外围', '野狼帮荒岭', '燕翎堡古道', '百草园石阶'],
    elite: ['血禁中心祭坛', '千竹教傀儡窟', '合欢宗暗哨'],
    'fury-elite': ['血禁墨蛟寒潭'],
    event: ['神手谷药庐', '太南小会茶棚', '嘉元城古宅', '越国皇城密道'],
    abode: ['黄枫谷百药园', '灵眼之泉静室'],
    shop: ['天星宗坊市', '岳麓殿散修摊'],
    auction: ['燕家堡夺宝会'],
  },
  2: {
    battle: ['外星海妖岛', '奇渊岛虫谷', '阴冥鬼雾涧', '内星海珊瑚礁', '碧灵岛矿脉', '乱星海风暴带'],
    elite: ['虚天殿外殿冰廊', '逆星盟镇守坛', '极阴岛万魂窟'],
    'fury-elite': ['虚天内殿血玉台'],
    event: ['天星城圣山', '绿液催熟秘窟', '妙音门密阁', '阴冥暴风谷'],
    abode: ['天星城洞府第', '伴妖草灵岛'],
    shop: ['天星城奇珍楼', '魁星岛海市'],
    auction: ['天星宗百年大拍'],
  },
  3: {
    battle: ['慕兰草原圣庙', '坠魔谷外瘴林', '大晋北冥冰原', '黄泉鬼道', '天澜草原祭坛', '南海乱礁'],
    elite: ['坠魔谷古魔坑', '昆吾山镇魔塔', '小极宫寒髓殿'],
    'fury-elite': ['坠魔谷空间裂隙'],
    event: ['大衍神君坐化洞', '大晋皇城叶家', '昆吾铸灵殿', '涪陵山灵脉'],
    abode: ['落云宗云梦山', '昆吾灵树仙台'],
    shop: ['大晋晋京仙坊', '天机阁分号'],
    auction: ['大晋天机阁盛会'],
  },
  4: {
    battle: ['飞仙台戈壁', '天渊城外巡防线', '蛮荒雷泽', '落日之墓荒沙', '风元古林', '灰雾海崖'],
    elite: ['广寒界仙殿', '地渊一层冥河', '角蚩族前锋营'],
    'fury-elite': ['地渊妖王血坛'],
    event: ['广寒化仙池', '木族青元宫', '天渊卫戍殿', '灵族圣树下'],
    abode: ['天渊城翠微居', '广寒界药园'],
    shop: ['天渊万族坊市', '风元仙城宝阁'],
    auction: ['天渊万族大拍卖'],
  },
  5: {
    battle: ['魔金山脉裂谷', '血天大陆前线', '小修罗界冰谷', '苦灵岛迷林', '魔斑荒原', '倚天城外海'],
    elite: ['魔界始祖祭坛', '噬金虫变异巢', '天外魔渊关隘'],
    'fury-elite': ['圣岛镇魔煞眼'],
    event: ['冥河青元宫', '镇魔锁神塔', '冰海真灵穴', '万妖谷圣坛'],
    abode: ['苦灵岛韩府洞天', '圣岛灵脉静室'],
    shop: ['倚天城万宝栈', '圣岛备战仙集'],
    auction: ['幻夜城至尊拍场'],
  },
  6: {
    battle: ['摩诃雷海边缘', '冥河黄泉渡', '失落界面断崖', '太古真灵废墟', '九霄罡风层', '万族古战场'],
    elite: ['螟虫之母巢穴', '五光族古圣殿', '修罗蛛母深渊'],
    'fury-elite': ['雷海太古狂雷眼'],
    event: ['真灵山问道碑', '赫连商盟秘库', '青元剑冢', '灵界飞升前哨'],
    abode: ['青元仙府闭关室', '飞升台聚元池'],
    shop: ['万族商盟总阁', '赫连仙船坊'],
    auction: ['灵界万族压轴盛会'],
  },
  7: {
    battle: ['北寒高升客栈外', '烛龙道试炼峰', '黑风海域荒岛', '冥寒仙府外殿', '霜白冰原', '古云大陆仙径'],
    elite: ['冥寒仙府太乙殿', '烛龙道镇宗阁', '天庭北寒监察司'],
    'fury-elite': ['冥寒道果争夺台'],
    event: ['灵寰界掌天瓶醒', '百造山炼器殿', '苍流宫论道席', '蛮荒真灵王庭'],
    abode: ['烛龙道赤霞峰洞府', '仙窍聚灵洞天'],
    shop: ['北寒仙宫仙市', '百造山仙器坊'],
    auction: ['北寒千年仙缘拍场'],
  },
  8: {
    battle: ['灰界阴括城外', '积鳞空境荒原', '洗煞池死气渊', '金源仙域古道', '大墟煞雷谷', '九幽冥河岸'],
    elite: ['真言门岁月宝塔', '积鳞空境大罗殿', '九幽修罗王庭'],
    'fury-elite': ['灰界寂灭煞脉源'],
    event: ['真言门弥罗讲道台', '积鳞空境蟹道人', '金源仙宫秘藏', '岁月神灯残墟'],
    abode: ['花枝空间洞天', '洗煞池金身台'],
    shop: ['金源仙域万仙坊', '黑市轮回殿暗铺'],
    auction: ['仙界金源仙宝大拍'],
  },
  9: {
    battle: ['中土仙域南天阶'],
    elite: ['中土天庭 · 镇狱天尊殿'],
    'fury-elite': ['菩提宴 · 狂暴护道道兵'],
    event: ['弥罗老祖遗泽'],
    abode: ['九元观洞天 · 终战整备'],
    shop: ['中土帝乡仙市'],
    auction: ['凌霄万仙压轴拍场'],
  },
};

const ACT_BOSS_LABELS: Record<ActNumber, string> = {
  1: '筑基天劫 · 血禁九霄雷',
  2: '虚天夺鼎 · 极阴玄骨老魔',
  3: '空间节点 · 破界飞升灵界劫',
  4: '地渊血祭 · 血光圣祖化身',
  5: '圣岛魔灾 · 涅槃圣祖真身',
  6: '飞升仙界 · 九九紫霄灭仙雷劫',
  7: '冥寒夺道 · 北寒宫主萧晋寒',
  8: '斩三尸劫 · 大罗恶尸斩道魔君',
  9: '终极问鼎 · 时间道祖古或今',
};

export function generateActMap(
  act: ActNumber,
  rng: SeededRng,
  remnant: PastLifeRemnant | null,
): MapNode[] {
  // 第九卷：中土天庭终极决战（精炼 5 步登顶长卷）
  if (act === 9) {
    const n1: MapNode = { id: 'a9-r0-c1', act: 9, row: 0, col: 1, type: 'elite', label: '中土天庭 · 镇狱天尊殿', nextIds: ['a9-r1-c1'], visited: false };
    const n2: MapNode = { id: 'a9-r1-c1', act: 9, row: 1, col: 1, type: 'abode', label: '九元观洞天 · 终战整备', nextIds: ['a9-r2-c0', 'a9-r2-c2'], visited: false };
    const n3a: MapNode = { id: 'a9-r2-c0', act: 9, row: 2, col: 0, type: 'auction', label: '凌霄万仙压轴拍场', nextIds: ['a9-r3-c1'], visited: false };
    const n3b: MapNode = { id: 'a9-r2-c2', act: 9, row: 2, col: 2, type: 'fury-elite', label: '菩提宴 · 狂暴护道道兵', nextIds: ['a9-r3-c1'], visited: false };
    const boss: MapNode = { id: 'a9-r3-c1', act: 9, row: 3, col: 1, type: 'boss', label: ACT_BOSS_LABELS[9], nextIds: [], visited: false };
    return [n1, n2, n3a, n3b, boss];
  }

  // 第 1~8 卷：每卷精炼为 7 步高密度仙途（6 层探索 row 0..5 + 第 7 层卷末大劫 row 6）
  const totalRows = 6;
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
        // 第 6 步（Boss 前）：固定双洞府闭关整备
        type = 'abode';
      } else if (row === 2) {
        type = col === cols[0] ? 'elite' : rng.next() < 0.55 ? 'event' : 'abode';
      } else if (row === 3) {
        if (col === cols[0]) type = 'fury-elite';
        else if (act >= 2 && col === cols[cols.length - 1]) type = 'auction';
        else type = 'event';
      } else if (row === 4) {
        type = col === cols[cols.length - 1] ? 'shop' : rng.next() < 0.6 ? 'elite' : 'battle';
      } else {
        // row === 1
        type = rng.weightedPick<Exclude<MapNodeType, 'remnant' | 'boss'>>(
          ['battle', 'event', 'shop', 'abode'],
          (t) => (t === 'battle' ? 44 : t === 'event' ? 34 : t === 'shop' ? 14 : 8),
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
    const targetRow = 2;
    const candidate =
      rows[targetRow].find((n) => n.type !== 'auction' && n.type !== 'fury-elite') ?? rows[targetRow][0];
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
      if (sorted.length > 1 && Math.abs(sorted[1].col - node.col) <= 1 && rng.next() < 0.6) {
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
