export const ITEMS = {
  medicine: { id: 'medicine', name: '疗伤药', description: '止血养伤的成药，也常是旅途中救命的东西。' },
  stones: { id: 'stones', name: '灵石', description: '修士之间通用的报酬，可换行装、药材与静室。' },
  herb: { id: 'herb', name: '灵草', description: '经过辨认的药草，可养身、驱兽，也可慢慢温养根基。' },
  manual: { id: 'manual', name: '完整功法', description: '从认脉到入门俱全的抄本。看懂它以后，仍须多年亲自修炼。' },
  essence: { id: 'essence', name: '筑基药引', description: '沼泽、遗址或商路所得的稀少灵物。它能助人冲关，不能代替修为。' },
  talisman: { id: 'talisman', name: '护身符', description: '能挡住一次急袭的薄符，用过便会烧尽。' },
};

export const SKILLS = {
  herbalism: { id: 'herbalism', name: '辨药', source: '亲手采药、试药与救人的经验', description: '认出药性和毒性，遇险时能用草木解决一些问题。' },
  conceal: { id: 'conceal', name: '藏息', source: '守夜、听风与收敛气息的练习', description: '收住呼吸与灵力，绕开自己还打不过的危险。' },
  sword: { id: 'sword', name: '御剑基础', source: '日复一日的持剑、步法与交手', description: '以气催动短剑。可以护身，仍不能硬抗远胜自己的对手。' },
};

export const REALMS = {
  mortal: { id: 'mortal', name: '凡人', lifeLimit: 72, description: '尚未引气入体，病痛与饥寒都是真实的威胁。' },
  qi: { id: 'qi', name: '炼气', lifeLimit: 72, description: '能运用少许灵力，寿数仍与常人相近。' },
  foundation: { id: 'foundation', name: '筑基', lifeLimit: 180, description: '根基已稳，寿限增长。山外仍有远胜自己的修士。' },
};

export const NODES = [
  'arrival', 'valley-gate', 'valley-rescue', 'valley-vault', 'valley-escape', 'valley-aftermath',
  'market-gate', 'market-job', 'market-deal', 'ferry-gate', 'ferry-storm', 'ferry-landing',
  'village-farewell', 'tutor-choice', 'herbal-trial', 'sword-trial', 'quiet-trial', 'first-meditation',
  'qi-awakening', 'apprenticeship-years', 'road-challenge', 'mountain-pass',
  'marsh-entry', 'marsh-camp', 'marsh-pool', 'marsh-return',
  'ruins-entry', 'ruins-map', 'ruins-seal', 'ruins-return',
  'caravan-entry', 'caravan-split', 'caravan-ambush', 'caravan-return',
  'market-crossroad', 'rest-chamber', 'cavern-search', 'foundation-plan', 'last-preparation',
  'medicine-prep', 'pill-breakthrough', 'breath-prep', 'warm-breakthrough',
  'foundation-return', 'foundation-duty', 'foundation-years', 'last-journey', 'late-home',
  'qi-old-age', 'qi-retirement', 'mortal-return', 'mortal-winter', 'ended',
];

const narration = text => ({ kind: 'narration', text });
const dialogue = (speaker, text) => ({ kind: 'dialogue', speaker, text });
const choice = (id, label, detail, to, result, more = {}) => ({ id, label, detail, to, result, ...more });
const scene = (id, title, location, goal, blocks, choices) => ({ id, title, location, goal, blocks, choices });
const item = (s, id) => s.life.items[id] || 0;
const has = (s, id) => s.life.skills.includes(id);
const fact = (s, id) => s.life.facts[id];
const world = (s, id) => s.world.facts[id];
const hurt = (s, amount = 1) => Math.min(amount, 3 - s.life.injury);
const gain = (s, amount = 1) => Math.min(amount, 6 - s.life.cultivation);
const yearsAway = s => Math.floor((s.world.day - s.life.startDay) / 360);
const left = s => Math.max(0, s.life.lifeLimit * 360 - s.life.ageDays - s.life.lifeDamageDays);
const lastWinter = s => Math.max(0, left(s) - 360);
const retirementHealing = s => Math.min(3, Math.floor(lastWinter(s) / 360));
const retirementResult = (s, text) => lastWinter(s) >= 360 ? text : '你在家中安顿下来。余日不多，旧伤仍需照料，但不必再为下一次冲关赶路。';
const needItem = (id, min = 1) => ({ kind: 'item', id, min });
const needSkill = id => ({ kind: 'skill', id });
const needFact = (id, value = true) => ({ kind: 'life-fact', id, value });
const before = days => ({ kind: 'days-left', value: days });
const injuryAtMost = value => ({ kind: 'injury-max', value });
const qi = { kind: 'realm', value: 'qi' };
const ready = [{ kind: 'realm', value: 'qi' }, { kind: 'cultivation', min: 3 }, injuryAtMost(1), needFact('cave-secure')];
const keeper = s => ['沈苓', '程青', '许穗'][(s.world.generation - 1) % 3];
const guide = s => ['岑禾', '阿篱', '白芦'][(s.world.generation - 1) % 3];
const trader = s => ['齐月', '宋遥', '闻溪'][(s.world.generation - 1) % 3];
const mason = s => ['陶生', '林诚', '孟铎'][(s.world.generation - 1) % 3];
const raider = s => ['陆荆', '严绍', '乌峥'][(s.world.generation - 1) % 3];
const methodName = s => fact(s, 'foundation-method') === 'warm' ? '多年温养' : '药引冲关';
const activeSkill = s => s.life.skills.includes(s.life.legacyId) ? s.life.legacyId : s.life.skills.at(-1);
const remembrance = s => activeSkill(s) ? { legacy: activeSkill(s) } : {};
const definitions = {};

definitions.arrival = s => {
  const opening = s.scene.fate.opening;
  const memory = s.world.generation > 1
    ? narration(s.life.legacyId ? `又是一副十六岁的身体。旧生的人与物都不在身边，只有${SKILLS[s.life.legacyId].name}的练法仍记得清楚；真要用得熟，还得靠这一世的手脚。` : '又是一副十六岁的身体。你记得走过的弯路，手里却只有一包寻常伤药。旧日相识未必还在，即使仍在，也不认识眼前这个少年。新的人生要重新谋生。')
    : narration('你叫云归，十六岁，住在山脚的芦村。两年前父亲死于山中落石，母亲的咳嗽每到冬天便重一分。家里能变卖的东西，已经不多了。');
  if (opening === 'market') return scene('arrival', '十六岁的药铺学徒', '青石镇', '挣到一部完整功法，给自己争一个不同的活法', [
    memory,
    narration('这一世，你生在镇外的佃户家。去年旱灾后，你被送来药铺做杂工。掌柜肯给饭吃，却不肯教认药。今日集市上有修士招人：报酬不多，胜在能接触真正的入门书。'),
    narration(world(s, 'village-clinic') ? '街尾有一间前人留下的义药铺。你走进去，才发现旧生做过的事还在，却没有人因此认识眼前的少年。' : '你不指望有人凭空赏你仙缘，只想先找到一份能学本事的活。'),
  ], [
    choice('arrival-market-work', '去药市找肯教人的铺子', '从试工做起，功法要靠自己的工钱来换。', 'market-gate', '你把旧围裙洗净归还，带着那包伤药走进早市。', { costs: { days: 1 } }),
    choice('arrival-market-ferry', '去渡口替行脚人送货', '河上活计辛苦，不过常有远来的修士落脚。', 'ferry-gate', '你沿河而下。码头的招工牌上写着：水涨，缺人。', { costs: { days: 2 } }),
  ]);
  if (opening === 'ferry') return scene('arrival', '渡口的招工牌', '白沙渡', '靠一次送货挣到学法的门路', [
    memory,
    narration('这一世，你在摆渡人家长大。父亲的背已经弯了，姐姐也有了自己的孩子。你能预见自己以后每一个清晨：解缆，撑船，等风。你想试着走得更远。'),
    narration(world(s, 'caravan-refuge') ? '旧商路留下的避雨棚仍有人修缮。你在那里听说，今日有一只载着药箱的客船缺水手。' : '一名带药箱的行客正在找人过江。他愿付船钱，还说自己识得一位肯收穷学徒的修士。'),
  ], [
    choice('arrival-ferry-work', '到客船上问一问', '风暴将至，先看清船况再决定怎么走。', 'ferry-gate', '你接过缆绳，没有急着答应连夜启航。', { costs: { days: 1 } }),
    choice('arrival-ferry-market', '先去青石镇做稳妥的活', '离开熟悉的水面，换一条靠手艺入门的路。', 'market-gate', '你向家里留了口信，带着伤药走向镇上的药市。', { costs: { days: 2 } }),
  ]);
  return scene('arrival', '雨进药谷', '芦村外山路', '在洪水封谷前，带着报酬和活路回来', [
    memory,
    narration(s.world.generation === 1 ? '药谷开出的三日短工，抵得上平地半年的工钱。你听说谷中有人会真正的引气之术，便想带药回家，也想问一句：凡人能不能把命活得长些。' : '这一世，你仍在山下长大。今年药谷的山渠再次塌方，新一批采药人被困在里面。临时招工的报酬，足够你离开贫困的家乡，去学真正的本事。'),
    narration(world(s, 'valley-seed') === 'destroyed' ? '前世毁去的青髓灵种已经不在。如今谷里靠普通药田维生，这次等着救的是人和新采的药，不会再有旧灵种的赏赐。' : '山民说谷底有株年年结露的青髓灵种，但连续几日大雨，已经把栈道冲得只剩半边。再过三天，上游涨水，谁也进不去了。'),
    dialogue('母亲', s.world.generation === 1 ? '药钱可以慢慢挣。你先把自己带回来。' : '有本事是好事，别拿命去换一句好听的话。'),
  ], [
    choice('arrival-valley-direct', '带上伤药，今日就走', '一天能到谷口，留给救人和撤离的时间更多。', 'valley-gate', '天黑时，你在谷口看见了断裂的木桥。山里有人举灯。', { costs: { days: 1 } }),
    choice('arrival-valley-rope', '向山民借齐绳索再进谷', '准备多花一天；绳索能让救人少受伤，但会错过部分时机。', 'valley-gate', '你试过绳结，背着干粮上山。到谷口时，雨已经下了两天。', { costs: { days: 2 }, effects: { lifeFacts: { 'valley-rope': true } } }),
    choice('arrival-valley-town', '不冒这次险，去镇上学手艺', '放弃药谷的高报酬，靠做工寻找功法。', 'market-gate', '你绕开了涨水的山道。青石镇的药铺仍在招学徒。', { costs: { days: 2 } }),
  ]);
};

definitions['valley-gate'] = s => scene('valley-gate', '木桥另一头', '药谷谷口', '在救人和取物之间作出决定', [
  narration(`断桥下，采药人${keeper(s)}的腿被木梁压住。她看见你，先叫你别踩右边那块松石。谷里的主事早已带着钱逃了，留下几个短工各自求生。`),
  narration(world(s, 'valley-seed') === 'destroyed' ? '另一条岔路通往旧药窖。那里只剩本季晒干的药和前人抄下的书。洪水不会因为你记得上辈子的路就退去。' : '另一条岔路通往药窖。青髓灵种、晒干的药材和谷医的书都在那里。救人和搬种都费工夫，你没有本事把两边都照顾周全。'),
  dialogue(keeper(s), '我怀里这册是完整的引气法。你若肯帮一把，就带走。先救命，别再替他们守财了。'),
], [
  choice('gate-rescue', '先去断桥下救人', '须在第二天结束前动手；再晚，涨水就会漫过木梁。药窖只能舍弃。', 'valley-rescue', '你伏低身子，试了试落脚处，朝桥下伸出手。', { requires: [before(2)] }),
  choice('gate-vault', '先去药窖找功法和药物', '往返要占去一天。若耽误救援，桥下的人不会一直等着。', 'valley-vault', '你沿着湿滑的石阶下到药窖，背后的呼喊渐渐被雨声盖住。', { requires: [before(2)], costs: { days: 1 }, effects: { lifeFacts: { 'vault-visited': true } } }),
  choice('gate-withdraw', '记住水势，立刻撤出', '这一趟没有高额报酬，但活着还有别的学法机会。', 'valley-aftermath', '你带回了谷口被冲断的消息。几个后来者因此没有再进山。', { costs: { days: 1 }, effects: { worldFacts: world(s, 'valley-seed') === 'destroyed' ? {} : { 'valley-seed': 'destroyed' }, deed: '在药谷封山前带回险情' } }),
]);

definitions['valley-rescue'] = s => {
  const saved = { items: { manual: 1, herb: 1, stones: 1 }, lifeFacts: { 'valley-rescued': true }, worldFacts: { 'valley-seed': 'destroyed' }, deed: `从断桥下救出${keeper(s)}` };
  return scene('valley-rescue', '先把人拉上来', '断桥下', '趁水还未涨满，救出采药人', [
    narration(`${keeper(s)}把药篓塞进你怀里，自己却已站不起来。木梁每晃一次，她的脸就白一分。你只有凡人的力气，必须找个切实能用的办法。`),
    narration(world(s, 'valley-seed') === 'destroyed' ? '远处药窖传来闷响。你明白，选了这里，就来不及再搬本季的药材。她的手仍紧紧抓着木梁，指节已经发白。' : '远处药窖传来闷响。你明白，选了这里，就来不及再搬灵种。她的手仍紧紧抓着木梁，指节已经发白。'),
  ], [
    choice('rescue-rope', '用借来的绳索卸开木梁', '准备好的绳索能分担重量，保住伤药，也能避免你自己受伤。', 'valley-escape', `你把绳子绕过老树，一寸寸吊起木梁。${keeper(s)}爬上岸，将干燥的功法交给了你。山谷深处，药窖终于塌进水中。`, { requires: [needFact('valley-rope'), before(2)], costs: { days: 1 }, effects: saved }),
    choice('rescue-medicine', '先止住她的血，再一起挪梁', '用掉随身的伤药，换她清醒配合；这是最稳妥的徒手办法。', 'valley-escape', `药粉压住了血。你们趁水流间歇合力移开木梁。${keeper(s)}活着上了岸，药窖却已救不回来。`, { requires: [before(2)], costs: { days: 1, items: { medicine: 1 } }, effects: saved }),
    choice('rescue-barehands', '拿自己的肩背顶住木梁', '一定会受伤。不用绳索、不用伤药，便要拿身体承受木梁的重量。', 'valley-escape', `木刺划开肩背，你仍撑到了她脱身。${keeper(s)}把功法塞进你衣内，说这不是恩赏，是她欠你的报酬。药窖的灯已经灭了。`, { requires: [before(2), injuryAtMost(1)], costs: { days: 1 }, effects: { ...saved, injury: hurt(s) } }),
  ]);
};

definitions['valley-vault'] = s => {
  const destroyed = world(s, 'valley-seed') === 'destroyed';
  return scene('valley-vault', destroyed ? '旧药窖里的新货' : '药窖最后一盏灯', '谷底药窖', '只拿自己能带走的东西', [
    narration(destroyed ? '石台上的根穴早已空了，连当年冲断的沟槽都被泥沙填平。今年寄存在这里的是普通灵草。你找到一只新药工的木箱，箱中压着一部完整功法。' : '石台上的青髓灵种已经露根，根下积着一点乳白药露。旁边是一部裹了油布的入门功法。要救活灵种，得把石盆拖到高处；只取书，转身就能走。'),
    narration('账页记着多年拖欠的工钱，也记着未经辨认便混卖的毒草。你终于明白谷医为什么宁愿冒雨逃走。那些旧事说明这里危险，却不会替你解决眼前的涨水。'),
  ], [
    destroyed
      ? choice('vault-dry-herbs', '背起药箱，带走干药和功法', '没有旧灵种可以再取；这批新药足够你起步。', 'valley-escape', '你从屋梁上拖下药箱，留下搬不动的湿货，爬上了高坡。', { requires: [before(3)], effects: { items: { manual: 1, herb: 2 }, lifeFacts: { 'valley-cargo': true }, injury: hurt(s) } })
      : choice('vault-save-root', '拖走灵种，只取根下现成的药露', '需要尚余一天，也一定会拉伤身体。桥下的人将错过救援。', 'valley-escape', '你把石盆拖上高坡，将灵种托付给逃出来的药工，只留下他们分给你的药露和抄本。断桥方向已没有呼喊。', { requires: [before(2), injuryAtMost(1)], costs: { days: 1 }, effects: { items: { manual: 1, essence: 1, herb: 1 }, injury: hurt(s), lifeFacts: { 'valley-cargo': true }, worldFacts: { 'valley-seed': 'saved' }, deed: '保住青髓灵种，却错过了断桥救援' } }),
    choice('vault-book-only', '只取功法，马上撤出', destroyed ? '不再为财物停留；无人搬走的这批新药会被洪水吞没。' : '不再为财物停留；无人搬走的灵种和药材会被洪水吞没。', 'valley-escape', '你把油布抄本贴身收好。身后石壁裂开，水声盖过了所有旧账。', { effects: { items: { manual: 1 }, worldFacts: { 'valley-seed': 'destroyed' }, lifeFacts: { 'valley-cargo': true } } }),
    choice('vault-go-rescue', '放下药箱，回断桥救人', '只要还在第二天，就仍有救人的余地；药窖里的东西都要舍弃。', 'valley-rescue', '你把木箱放回高架，掉头奔向断桥。', { requires: [before(2)], effects: { worldFacts: { 'valley-seed': 'destroyed' } } }),
  ]);
};

definitions['valley-escape'] = s => scene('valley-escape', '雨里下山', '药谷外坡', '活着离开这三日险地', [
  narration(fact(s, 'valley-rescued') ? `${keeper(s)}扶着你的肩，走几步就要歇一歇。她不是什么能挥手治伤的高人，只是比你早学了几年引气。泥水一样会冻僵她的手。` : '药谷的人已各自散去。背上的书和药都有分量，你第一次明白，拿到机缘以后，还得有命把它带出山。'),
  narration('山脚升起了炊烟。再往前走，就离开这场以天计的危险；往后的修行，却要以年去熬。'),
], [
  choice('escape-long-path', '走山民指过的高坡', '危险的谷道已经在身后。再花一天走山外高坡，伤者和行囊都能保住。', 'valley-aftermath', '你沿着山外高坡又走了一日，终于看见村口的灯。热粥很稀，你却喝得一滴不剩。村医查看过你的身体，另留了一包药以备不时之需。', { costs: { days: 1 }, effects: { items: { medicine: 1 }, lifeFacts: { 'valley-safe-exit': true } } }),
  choice('escape-short-path', s.life.injury >= 2 ? '从急流中抄近道（必死）' : '涉过急流抄近道（会受伤）', s.life.injury >= 2 ? '伤势已让你站不稳；这个水深下去，就没有力气回来。' : '不用再在山中过夜，但石底暗流一定会让你添伤，背上的药也会湿掉。', s.life.injury >= 2 ? 'ended' : 'valley-aftermath', s.life.injury >= 2 ? '水撞在腿上时，你已来不及抓住岸边。油布里的功法没有散，人却再没走出药谷。' : '你拖着湿透的衣衫爬上岸，腿上又添一道口子。捷径确实近，只是并不便宜。', s.life.injury >= 2 ? { ending: 'battle', endingTitle: '急流带走的少年', achievement: '曾摸到入门的机会，却没能带它走出药谷。', lesson: '伤重时，准备好的安全路比抢半日更重要。' } : { effects: { injury: hurt(s) } }),
]);

definitions['valley-aftermath'] = s => scene('valley-aftermath', '报酬与一部薄书', '芦村药棚', '把求仙的念头变成能开始的日子', [
  narration(fact(s, 'valley-rescued') ? `${keeper(s)}伤好一点后，替你看过功法，一页都不缺。她答应引你去见山外的启蒙师傅，但说，收留不是包你成仙。` : item(s, 'manual') ? '避雨的老药工替你翻过抄本：这部书是完整的，写得也很朴实。它没有能一夜成仙的秘诀，只教人认脉、调息、日复一日练习。' : '你没从药谷拿到仙物，但带回险情的人一样有饭吃。药棚的老师傅说，肯做满一年，他愿给你工钱，再抄一部完整功法。'),
  narration('谷主逃往哪里，不再是你眼下能管的事。母亲等着药，你也必须决定，要用多少年去试那条没人保证的路。'),
], [
  item(s, 'manual')
    ? choice('aftermath-take-road', '拿着完整功法，去见师傅', '先安排家中生活，再用几年真正入门。', 'village-farewell', '你把工钱和药分成两份。一份留在家，一份随自己上路。', { costs: { days: 7 }, effects: { items: { stones: 1, herb: 1 } } })
    : choice('aftermath-earn-manual', '做一年药工，换完整功法', '这一年是劳动，不会凭工龄得到修为。', 'village-farewell', '你搬柴、筛药、送病人回家。一年后，老师傅把抄好的全卷和约定的工钱一起交给了你。', { costs: { years: 1 }, effects: { items: { manual: 1, stones: 2, herb: 2 } } }),
  choice('aftermath-go-home', '领工钱回家，先过凡人的日子', '你可以放下这次求仙，不必为已经付出的代价继续冒险。', 'mortal-return', item(s, 'manual') ? '你把薄书包好，收在家中梁上。眼下，先把这个冬天过好。' : '你收好行囊，把工钱交给家里。眼下，先把这个冬天过好。', { effects: { items: { stones: 2 } } }),
]);

definitions['market-gate'] = s => scene('market-gate', '谁肯教一个穷学徒', '青石镇药市', '找到真实的报酬和完整功法', [
  narration('药市上挂着许多“仙家秘本”的招牌，翻开却大多缺页。你问过几家，才在街尾找到一个肯把价钱说清楚的药师：做满一年杂务，给三块灵石和一部完整入门书。'),
  dialogue('药师', '识字不等于会练。你做事若肯问清楚，我就肯把每一页讲清楚。'),
  narration(world(s, 'ruins-school') ? '镇上的蒙学还在教前人留下的草木图。这里的人因此更看重来历清楚的书，不肯只凭“秘传”二字收钱。' : '窗内的炉火很旺。你仍然穷，却终于看见了一条不用押命的门路。'),
], [
  choice('market-try-work', '进去做一天试工', '先看看这位药师是否说话算数。', 'market-job', '你挑出混在止血草里的毒叶。药师没有夸你，只把那一味重新讲了一遍。', { costs: { days: 1 } }),
  choice('market-send-cargo', '去渡口替药师送一趟货', '先做一段短工，再向行客打听学法门路。', 'ferry-gate', '你背起封好的药包，沿石板路走向白沙渡。', { costs: { days: 1 } }),
]);

definitions['market-job'] = s => scene('market-job', '一年工钱的价码', '药铺后院', '换到可以照着练的全卷', [
  narration('试工过后，药师取出真正的书让你逐页看。字不华美，脉图却清楚。他说，也可以用你那包难得的家传伤药换书，只是以后出门就少一份保命的东西。'),
  narration('你不再问有没有更快成仙的办法，而是问，做满一年是否确实给工钱。药师写下数目，你也记在心里。'),
], [
  choice('market-year-work', '做满一年，连本带工钱一起拿', '用时间换足第一趟远行的盘缠。', 'market-deal', '四季过去，你已能认出大半常用药。最后一天，药师逐页核对抄本，把三块灵石放在书上。', { costs: { years: 1 }, effects: { items: { manual: 1, stones: 3, herb: 1 }, heal: 1 } }),
  choice('market-trade-medicine', '用随身伤药换完整功法', '省下一年工期，却失去现成的疗伤药和工钱。', 'market-deal', '药师验过药性，收下药包，把全卷交给了你。你回到街上时，腰间比来时更轻。', { costs: { items: { medicine: 1 } }, effects: { items: { manual: 1 } } }),
]);

definitions['market-deal'] = s => scene('market-deal', '钱袋旁的借条', '药铺门前', '决定带着怎样的负担离开小镇', [
  narration('一个掮客看见你拿了功法，便愿意借四块灵石，还送一张护身符。他说得坦白：以后回来要还三块；他看重的是你有机会替他办事。便宜并非没有缘故。'),
  dialogue('药师', '穷一点可以慢慢走。欠了人情，也未必就坏，只要你别把它忘了。'),
], [
  choice('market-travel-light', '谢过借款，只拿自己挣的', '盘缠少些，往后每一步的去留都由自己决定。', 'village-farewell', '药师塞给你两把灵草，说穷学徒出门，总得有个能换饭的东西。', { costs: { days: 7 }, effects: { items: { herb: 2 } } }),
  choice('market-accept-debt', '借灵石和护身符，记住这笔债', '得到眼下的行装；回到镇上时，须用灵石或劳动偿还。', 'village-farewell', '你收好四块灵石和护身符，也把三块的欠款写在功法封底。', { costs: { days: 7 }, effects: { items: { stones: 4, talisman: 1 }, lifeFacts: { 'market-debt': true } } }),
]);

definitions['ferry-gate'] = s => scene('ferry-gate', '出船以前', '白沙渡船坞', '把一船药货平安送过江', [
  narration('船主说，江东的老修士正等这批药。他答应指点送货的少年，但船主只管船钱，不肯替你保证仙缘。你看见主缆已经起毛，船舱里还进着水。'),
  narration('天边有暗云。现在修船会误一天，直接出发则能省工；到了江心，差别就不是说说而已。'),
], [
  choice('ferry-mend', '留一天换缆、堵漏', '准备能让风浪来时有可用的船，不必靠运气。', 'ferry-storm', '你和老船工换了两道新缆，用木楔封住漏口。翌日启航，船身稳了许多。', { costs: { days: 1 }, effects: { lifeFacts: { 'ferry-rigged': true } } }),
  choice('ferry-hurry', '跟着船主立即出发', '旧缆和漏口都还在；遇浪时，只能用药救人或舍货保命。', 'ferry-storm', '船离开码头时很快。江心的风却比岸上大得多。', {}),
]);

definitions['ferry-storm'] = s => scene('ferry-storm', '浪头打上船舷', '江心', '在风浪里保住人命', [
  narration('半夜，浪头打断了一根篙。掌舵的船工撞在舱壁上，额头流血。药箱向倾斜的一侧滑去，你只能先做一件事。'),
  narration(fact(s, 'ferry-rigged') ? '新缆仍绷得住，补好的船舱也没有进水。你之前做的笨功夫，此时给了你空出手的余地。' : '旧缆正在一股股断开。船舱的漏水已经没过脚踝，强留全部货物会把人也拖下去。'),
], [
  choice('ferry-use-rigging', '借新缆稳住船，救起船工', '只有出发前修过船，才能同时保人和药箱。', 'ferry-landing', '你用新缆固定药箱，和醒来的船工一起撑过最急的浪。天亮后，人和货都上了东岸。', { requires: [needFact('ferry-rigged')], costs: { days: 1 }, effects: { items: { stones: 2 }, lifeFacts: { 'ferry-delivered': true }, deed: '在江心风浪中保住药船' } }),
  choice('ferry-save-pilot', '给船工止血，请他带船入支汊', '消耗伤药换回熟悉水路的人；药箱仍能送到。', 'ferry-landing', '船工醒来后指了一道看似不能通行的芦苇口。药船擦着岸挤进去，终于避开了浪头。', { costs: { days: 1, items: { medicine: 1 } }, effects: { items: { stones: 1 }, lifeFacts: { 'ferry-delivered': true } } }),
  choice('ferry-drop-cargo', '推货减重，先把船上人带回岸边', '放弃报酬，不死守已经保不住的货。搬货时会受伤。', 'ferry-landing', '几个药箱沉进黑水。船终于浮了起来，你手上伤口很深，却听见了同船人的呼吸。', { costs: { days: 2 }, effects: { injury: hurt(s), lifeFacts: { 'ferry-delivered': false }, deed: '舍弃药货，使一船人活着靠岸' } }),
]);

definitions['ferry-landing'] = s => scene('ferry-landing', '东岸的老修士', '江东小院', '用已经做过的事，换一个真正的开始', [
  narration(fact(s, 'ferry-delivered') ? '老修士拆开药箱，闻过药香才松了口气。他的腿受过旧伤，已经不能远行，最怕有人为了求他指点便许下做不到的事。' : '你把落水的经过一五一十讲完。老修士没有追问沉掉的货，只让你先伸手看伤。他说，亏损已是亏损，没必要再赔一条命。'),
  dialogue('老修士', '这部引气法我会抄全。救船有救船的报酬，学法有学法的苦，别把两件事混在一起。'),
], [
  choice('ferry-claim-book', '领送药的报酬，带全卷离开', '只有药货平安送到，才能直接领走这份报酬。', 'village-farewell', '老修士替你讲清最难认的几处脉图，又送了两把灵草。你向他行礼，踏上归路。', { requires: [needFact('ferry-delivered')], costs: { days: 7 }, effects: { items: { manual: 1, herb: 2 }, heal: 1 } }),
  choice('ferry-serve-year', '留下照看小院一年，边做边学', '多用一年劳动，换全卷、盘缠和伤口痊愈。', 'village-farewell', '你修屋、熬药、种菜，听老人把功法讲了三遍。一年后，他把整部抄本和工钱一并交给了你。', { costs: { years: 1 }, effects: { items: { manual: 1, stones: 3, herb: 2 }, heal: 3 } }),
]);

definitions['village-farewell'] = s => scene('village-farewell', '出门前的一顿饭', '故乡', '安顿牵挂的人，然后认真求学', [
  narration(s.world.generation === 1 ? '母亲把你带回的书翻了又翻，她并不识字，只看见书页没有缺。你说想试着修行，她沉默了半晌，给你添了一碗饭。' : '这一世的家人并不认识你记忆中的那些名字。他们只知道你挣到了书，也知道你还年轻。他们为你备了一顿平常的饭，让你自己决定以后往哪里走。'),
  narration('村医说，一把合用的灵草就能让家中病人的冬天好过些，但治不了生老病死。你第一次把这两件事分清：眼前能做的照顾，和仍很遥远的长生。'),
  dialogue('家人', '家里的活有人做。你若要学，就好好学，别总惦记着一夜成名。'),
], [
  choice('farewell-leave-herb', '留一把灵草作药，再去拜师', '照顾好眼前的人；出门时少一份可用的材料。', 'tutor-choice', '村医收好药。你在门槛边坐到饭后，才背起行囊。有人牵挂你，也有人盼你真正走远。', { costs: { days: 14, items: { herb: 1 } }, effects: { lifeFacts: { 'family-helped': true }, deed: '离乡前留下治病的药' } }),
  choice('farewell-keep-herbs', '把盘缠算清，带齐材料上路', '先为往后的学习做准备，家中仍靠普通药方过冬。', 'tutor-choice', '你留下能留下的凡俗工钱，带走修行所需的药草。家人送到村口，没有再问何时成仙。', { costs: { days: 7 } }),
  choice('farewell-stay', '暂且不走，留下撑起这个家', '功法可以保存，眼前的日子也值得认真过。', 'mortal-return', '你把行囊放回床边。第二日天未亮，便与家人一起下地。', {}),
]);

definitions['tutor-choice'] = s => scene('tutor-choice', '先学一件保命的本事', '松风山下', '选择一位师傅，把基本功练到能用', [
  narration('山下有三位肯教穷学生的散修。药师要人耐心，剑客要人肯吃苦，守山人则只问你能否独自熬过长夜。他们都不承诺境界，只教一件真能用的本事。'),
  narration('完整功法仍在你怀里。但贸然盘坐，并不会因为书写得全就练得对。先跟人学会护身和认路，几年以后，你才可能独自离山。'),
], [
  choice('tutor-herbalist', '跟药师学辨药', '以采药和制药谋生，日后也能少挨一些本可避开的毒。', 'herbal-trial', '你在药圃旁搭起小棚，把第一株认错的药连根重新画了一遍。', { costs: { days: 30 } }),
  choice('tutor-sword', '跟剑客学持剑和步法', '真遇上避不开的争斗，至少有保护自己的手段。', 'sword-trial', '剑客给了你一柄木剑，让你先练如何站稳，再练如何出手。', { costs: { days: 30 } }),
  choice('tutor-quiet', '跟守山人学藏息', '学会察觉动静、收住气息，绕过暂时打不过的对手。', 'quiet-trial', '守山人没有给你口诀。他带你坐到山口，直到你听得出风声和脚步声的区别。', { costs: { days: 30 } }),
]);

definitions['herbal-trial'] = s => scene('herbal-trial', '药性不会认人情', '松风药圃', '把草木学问练到能救命', [
  narration('第一回上山，你差点把相似的两种草混进一篓。师傅没有骂人，只让你看一只误食后发抖的兔子。你守着它熬过一夜，此后再也不凭眼熟采药。'),
  dialogue('药师', '修士也会中毒。药不因为你有灵根，就原谅你认错。'),
], [
  choice('herbal-practice-own', '拿自己的灵草做一整年练习', '有真药可练，进度快些；材料要实实在在用掉。', 'first-meditation', '一年里，你逐一试过剂量，记下季节和土色。师傅还给你两把成药用料，说你现在可以自己上山了。', { costs: { years: 1, items: { herb: 1 } }, effects: { skills: ['herbalism'], items: { herb: 2, medicine: 1 }, heal: 1 } }),
  choice('herbal-work-study', '做两年药圃杂务，以工换学', '不需要现成灵草，代价是多留一年。', 'first-meditation', '春播秋收走过两轮。你终于能从气味认药，也攒下两包亲手配的伤药。', { costs: { years: 2 }, effects: { skills: ['herbalism'], items: { medicine: 2, herb: 1 }, heal: 1 } }),
]);

definitions['sword-trial'] = s => scene('sword-trial', '先学收剑', '山下空坪', '让手中的剑不先伤到自己', [
  narration('剑客最常教的不是杀招，而是退步。你练到手臂抬不起来，他仍能用树枝点中你的手腕。他说，真正的交手没有谁等你把动作做完。'),
  narration('铁剑、伤药和住处都要花钱。没钱便替山民劈柴、修路，晚些再练；这也能学成，只是不能假装时间没有过去。'),
], [
  choice('sword-buy-training', '买好铁剑，专心练一年', '用两块灵石换专心练习的时间。', 'first-meditation', '一年后，你能在乱步中稳住剑尖。剑客终于允许你把铁剑带出空坪。', { costs: { years: 1, items: { stones: 2 } }, effects: { skills: ['sword'], heal: 1 } }),
  choice('sword-work-training', '白天做工，夜里练剑两年', '用劳动抵学费；受伤的地方也能慢慢养好。', 'first-meditation', '你替村里修完第二座桥时，已经不再把练剑当成一时兴起。师傅送给你旧剑，乡人另凑了一块灵石作盘缠。', { costs: { years: 2 }, effects: { skills: ['sword'], items: { stones: 1 }, heal: 2 } }),
]);

definitions['quiet-trial'] = s => scene('quiet-trial', '长夜里的一口气', '守山小屋', '学会收息和辨险', [
  narration('守山人让你在夜里记下经过小屋的声音。起初你把野猪当成狼，把落枝当成人；后来，你能听出负重的人在哪里停步，也能让自己不惊动树下的兽。'),
  dialogue('守山人', '藏息不是隐身。你会饿，会抖，会被人看见。知道这些，才不会拿它去赌命。'),
], [
  choice('quiet-two-winters', '守过两个冬天，慢慢练熟', '靠规律饮食和反复练习打底，身体不会白白受损。', 'first-meditation', '第二场春雨落下时，你终于能在惊惧里保持呼吸。守山人给你一包伤药，让你去过自己的日子。', { costs: { years: 2 }, effects: { skills: ['conceal'], items: { medicine: 1 }, heal: 1 } }),
  choice('quiet-starve-hurry', '用饥寒逼自己一年速成', '能少耗一年，却一定伤身，还要折去一年寿数。', 'first-meditation', '你确实提前学会了收息，却开始在冷夜里咳血。守山人没有恭喜你，只给你熬了一锅热粥。', { costs: { years: 1, lifeYears: 1 }, effects: { skills: ['conceal'], injury: hurt(s), lifeFacts: { 'forced-early-training': true } } }),
]);

definitions['first-meditation'] = s => scene('first-meditation', '一部功法，几年灯火', '山腰小屋', '把完整功法练到第一次引气入体', [
  narration('认脉、调息、坐定，你已经听过许多遍。真轮到自己练，进展却慢得令人怀疑：有时整月只有指尖一点暖意，有时昨天能做到的，今天又全散了。'),
  narration('师傅说，普通人的资质就是这样。功法没有缺，路也没有错，仍须把吃饭、劳动和修炼排进几年平常的日子。带着重伤硬练，只会让这几年白费。'),
], [
  choice('meditate-steady', '身体无碍，按全卷练满三年', '需要完整功法，且不能带着重伤。三年结束后才可能真正入门。', 'qi-awakening', '第三年冬末，一缕灵气终于能在经脉里完整走过一周。你睁眼时，窗外的雪仍在落，只是这一次，你知道自己真的跨进了门。', { requires: [needItem('manual'), injuryAtMost(1)], costs: { years: 3 }, effects: { realm: 'qi', cultivation: gain(s), heal: 1, deed: '用三年苦修完成引气入体' } }),
  choice('meditate-heal-first', '先把伤养好，再用六年稳稳入门', '不靠伤药也能慢慢恢复，代价是三年额外光阴。', 'qi-awakening', '你先学会不逞强，再学会每天守住那一点进展。六年后，旧伤不再疼，第一周灵气也终于走通。', { requires: [needItem('manual')], costs: { years: 6 }, effects: { realm: 'qi', cultivation: gain(s), heal: 3, deed: '养好旧伤后，以六年工夫踏入炼气' } }),
  choice('meditate-return-home', '把书收好，回家过这一生', '此前学到的手艺仍在，不必把所有余年都押在修炼上。', 'mortal-return', '你吹灭灯，将书包进油布。下山的路并不比上山时轻松，但这次是你自己的选择。', {}),
]);

definitions['qi-awakening'] = s => scene('qi-awakening', '会一点法术以后', '松风山', '挣到下一段修行的资源', [
  narration(`你已经离家${yearsAway(s)}年。现在能借灵气托起一小瓢水，止住细小的伤口，也能觉出夜色里的动静。这些本事足以谋生，却治不了凡人的所有病，更不能把逝者带回来。`),
  narration('师傅没有再免费供你吃住。他给你两条实际的路：留山做几年有报酬的杂务，或者随送货的队伍下山。前者安稳，后者赚得快，却有明确的风险。'),
  dialogue('师傅', '你现在是炼气修士了。可若有人说你已经不怕刀、不怕饿，就离那人远点。'),
], [
  choice('qi-work-mountain', '在山上做四年杂务，边做边练', '慢慢积累修为和盘缠，不必现在就与人拼命。', 'apprenticeship-years', '四年间，你修药圃、守山夜、替附近村子驱兽。灵力逐渐稳下来，报酬也攒成了三块灵石。', { costs: { years: 4 }, effects: { cultivation: gain(s), items: { stones: 3, herb: 1 }, heal: 1 } }),
  choice('qi-courier-work', '接两年山路送货的活', '报酬更高，路上一定会留下伤；最后一趟还要自己过关。', 'road-challenge', '两年里，你在驿棚中打坐，在风雪里赶路。四块灵石攒下了，肩上的刀伤也留下了。最后一趟货，正好赶上山路生变。', { requires: [injuryAtMost(1)], costs: { years: 2 }, effects: { cultivation: gain(s), items: { stones: 4 }, injury: hurt(s) } }),
]);

definitions['apprenticeship-years'] = s => scene('apprenticeship-years', '留山，还是下山', '山门外的石阶', '为一次真正的历练决定准备多少', [
  narration('你已能独自处理寻常杂务，师傅也不再逐句检查功法。山上资源有限，再待下去仍能进步，只是要自己出药钱；山外则有机缘，也有人为同一份机缘争命。'),
  narration('一个当年和你同来的人收拾东西回了故乡。他没有输，也没有成仙，只是不想把余生全留在这条山路上。你送了他一程，然后回来收拾自己的行囊。'),
], [
  choice('apprentice-solid-ground', '再用五年和两块灵石夯实修为', '走得更晚，却让往后的冲关多一份真实积累。', 'mountain-pass', '五年不算短。等你终于下山，体内灵气已经不再时聚时散，旧伤也养好了。', { costs: { years: 5, items: { stones: 2 } }, effects: { cultivation: gain(s), heal: 1 } }),
  choice('apprentice-leave-now', '带着现有本事下山', '把继续成长的机会放在真实历练里。', 'mountain-pass', '你向师傅辞行。他检查了一遍你的行装，没有再问你何时回来。', { costs: { days: 14 } }),
  choice('apprentice-home-career', '不再逐机缘，回乡靠本事谋生', '炼气的能力已经能改变普通生活，你可以就此收住脚步。', 'qi-old-age', '你把未用的行装收起，选了一条通向故乡的路。', {}),
]);

definitions['road-challenge'] = s => {
  const pressure = s.scene.fate.pressure;
  const trouble = pressure === 'storm' ? '连夜暴雨冲断了前桥，河面上只剩两根湿滑的旧梁。' : pressure === 'scarcity' ? '山里断粮，沿途驿站都闭了门。货主却只认交货日期，不肯多付盘缠。' : '一伙拦路的散修守住窄口，专找独行送货的人索钱。';
  const skilled = has(s, 'conceal')
    ? choice('road-use-conceal', '藏住气息，从兽道绕过', '绕行要七天，但学过的藏息能避免惊动山兽，找到稳妥的回路。', 'mountain-pass', pressure === 'rival' ? '你看清守夜人的换班，沿林下绕出山口。货送到时，封条仍然完好。' : pressure === 'storm' ? '你藏住气息穿过山兽出没的高坡，避开了涨水的断桥。七日后送到货，封条仍然完好。' : '你沿山兽走过的林路找到泉眼和野果，再从旧猎道绕往尚未缺粮的驿站。货送到时，封条仍然完好。', { requires: [needSkill('conceal'), injuryAtMost(2)], costs: { days: 7 } })
    : has(s, 'herbalism')
      ? choice('road-use-herbs', '替山民看病，请他们引路', '会辨药的人能换到当地人的信任，也能多攒一点药草。', 'mountain-pass', '你给山民处理好伤口。他们指了一条山脊旧路，临别又送你一把灵草。', { requires: [needSkill('herbalism')], costs: { days: 10 }, effects: { items: { herb: 1 } } })
      : choice('road-use-sword', '提剑护住货，从险口穿过', '能保住货物，却会再添一处伤；伤势重时不能这样走。', 'mountain-pass', '你用学过的步法稳住身形，终于把货带过窄口。衣袖又破了一道，药钱并没有凭空省下。', { requires: [needSkill('sword'), injuryAtMost(1)], costs: { days: 3 }, effects: { injury: hurt(s), items: { stones: 1 } } });
  return scene('road-challenge', '最后一趟货', '北岭山道', '把活人和货一起带过山口', [
    narration(trouble), narration('这不是几句豪言就能过去的地方。你可以用已经学会的本事，也可以承认这一趟赚不到那么多。'),
  ], [
    skilled,
    choice('road-pay-safe-way', '花两块灵石雇熟路的人护送', '把赚来的钱用在避险上，不再独自硬撑。', 'mountain-pass', '熟路的向导带你走过了危险地段。你少赚了两块灵石，却保住了往后继续修行的身体。', { costs: { days: 5, items: { stones: 2 } } }),
    choice('road-turn-back', '退回驿站，以一年劳动抵误期', '放弃这次赶路，用一年把欠下的差事结清，并养好伤。', 'mountain-pass', '你在驿站守了一个冬天，又送完来年的短途货。这件事到此为止，伤也终于轻了。', { costs: { years: 1 }, effects: { heal: 2 } }),
  ]);
};

definitions['mountain-pass'] = s => {
  const routes = {
    marsh: ['雾泽的新药潮', 'marsh-entry', '南边雾泽今年退了水。采苇人发现了一处新露出的石心泉，泉露能作筑基药引，外围灵草也足够用来温养。潭边有毒瘴和守泉的蛇，并非谁先到谁就能拿走。'],
    ruins: ['石城下的旧静室', 'ruins-entry', world(s, 'ruins-core') === 'broken' ? '石城旧静室的中枢早已被前人毁掉。今年山崩露出了侧壁的药石，能否安全取出，要重新摸清塌方和通风。旧日的完整灵池不会回来。' : world(s, 'ruins-cache') === 'taken' ? '石城的旧静室还完整，封存药引却早已被前人取走。这一季采石人发现的是外壁新露的药石脉，需要重新探路、开凿、炼药，才可能做出另一份药引。' : '北边采石人凿穿一段废弃山腹，露出旧门派的静室。内层封存着药引，也有仍能伤人的禁制。外壁残刻或许能让人看懂进去的办法。'],
    caravan: ['西行商队的一份报酬', 'caravan-entry', '一支小商队要把药货送过西岭。领队愿拿筑基药引抵一部分报酬，但要货真正送到才算数。沿路缺粮、坏天气和拦路人，哪个都不是一纸许诺能挡住的。'],
  };
  const [title, target, description] = routes[s.scene.fate.opportunity];
  return scene('mountain-pass', title, '松风山外', '决定是否为这次机缘出发', [
    narration(description),
    narration(s.scene.fate.pressure === 'storm' ? '这一季雨水异常，桥、洞顶和山坡都比平日危险。出发前，消息已经说得很清楚。' : s.scene.fate.pressure === 'scarcity' ? '近来药价很高，路上的人都在省粮。带够普通材料，往往比一句勇敢更有用。' : '附近的散修也听见了消息。有人想合作，有人想独占，你不会是唯一来求机缘的人。'),
  ], [
    choice('pass-go-adventure', '带着现有行装出发', '先看清当地情况，再决定要药引还是只取普通材料。重伤时不宜赶路。', target, '你把消息和自己的本事对照一遍，踏上下一段路。', { requires: [injuryAtMost(2)], costs: { days: 20 } }),
    choice('pass-prepare-adventure', '用一年治伤、换药，再出发', '花一块灵石换伤药和安稳休养；等来年身体养好，再打听新一季的采药、探山或护货机会。', target, '一年里你养好伤，补齐药，又打听过当季的路况。真正出发时，你已经知道自己缺什么。', { costs: { years: 1, items: { stones: 1 } }, effects: { heal: 3, items: { medicine: 1 } } }),
    choice('pass-decline-adventure', '不去争这一次，回乡谋生', '保住现有修为和手艺，将余生用在自己能掌握的事上。', 'qi-old-age', '你把那张路线图送给别人，转身走向有炊烟的地方。', {}),
  ]);
};

definitions['marsh-entry'] = s => scene('marsh-entry', '雾泽里的人家', '南泽芦村', '摸清通向石心泉的路', [
  narration(`采苇人${guide(s)}刚把小船拖上岸。她的弟弟被毒刺划伤，正躺在棚里发热；她想接带路的活，又不敢离开太久。听见你问石心泉，她没有立即开价，先问你会不会认药。`),
  narration(world(s, 'marsh-path') ? '前人立的几块路碑仍在，帮助村子保住了一条出泽的路。但今年水道改向，新露出的泉眼在更深处；旧路只能送你到有人烟的地方。' : '泽里没有笔直的路。水下枯枝、贴地白雾和能陷住人的黑泥，远看都像一片平地。'),
  dialogue(guide(s), '我认得水。你若认得药，我们都能少走一点冤枉路。'),
], [
  choice('marsh-hire-guide', '付两块灵石，请她带到安全营地', '钱能让她先为弟弟请村医。你也得到熟悉水道的向导。', 'marsh-camp', `${guide(s)}把钱交给邻居，撑船绕过三处黑泥。入夜前，你们在一片高地上生起了火。`, { costs: { days: 4, items: { stones: 2 } }, effects: { lifeFacts: { 'marsh-guided': true } } }),
  choice('marsh-read-plants', '辨出毒刺与解药，沿植被摸路', '需要辨药本事。替少年缓过症状，也能认出较干的地面。', 'marsh-camp', `你捣烂岸边的解毒叶。少年终于能喝下水，${guide(s)}将几处水道画给你，还分了一篓可用灵草。`, { requires: [needSkill('herbalism')], costs: { days: 6 }, effects: { items: { herb: 2 }, lifeFacts: { 'marsh-guided': true }, deed: '在雾泽替采苇人救治家人' } }),
  s.life.injury >= 2
    ? choice('marsh-wait-boat', '在村里养伤做轻活，等一班采苇船', '带伤走不了黑泥。留一个月修篓理货，换村民把你送到高地营地。', 'marsh-camp', '你在干燥的棚里养了一个月，也修好几只旧药篓。采苇人出船时腾出位置，将你送到高地，没有让你独自趟泥。', { costs: { days: 30 }, effects: { heal: 1 } })
    : choice('marsh-walk-alone', '省下盘缠，独自踏泥进泽', '没有向导，一定会被暗枝和毒泥伤到；伤重时不能继续这样走。', 'marsh-camp', '你绕了许多远路，终于找到高地。靴子里都是泥，腿上的口子开始发热。', { requires: [injuryAtMost(1)], costs: { days: 8 }, effects: { injury: hurt(s) } }),
]);

definitions['marsh-camp'] = s => {
  const alone = has(s, 'conceal')
    ? choice('marsh-night-conceal', '收息守夜，等白雾自行散开', '藏息让你不惊动夜兽，耐心则给你一条看得清的水路。', 'marsh-pool', '夜里有什么擦着草根游过，你没有起身。第三日雾散时，潭边的石阶终于露了出来。', { requires: [needSkill('conceal'), injuryAtMost(2)], costs: { days: 3 } })
    : has(s, 'herbalism')
      ? choice('marsh-night-smoke', '燃一把灵草，把毒虫挡在营外', '消耗普通药材，保住休息和探路的机会。', 'marsh-pool', '药烟在低处铺开，毒虫绕着火光退去。你睡过一夜，循着泉边的植物找到了石阶。', { requires: [needSkill('herbalism')], costs: { days: 2, items: { herb: 1 } }, effects: { heal: 1 } })
      : choice('marsh-night-sword', '提剑清开兽道，摸到泉边', '剑术能开路，但密林里的毒刺一定会添伤。', 'marsh-pool', '你斩断缠脚的藤，逼退伏在根下的小兽。潭水已经在前面，手腕上的毒刺却也扎得很深。', { requires: [needSkill('sword'), injuryAtMost(1)], costs: { days: 3 }, effects: { injury: hurt(s) } });
  return scene('marsh-camp', '火光外的水声', '泽中高地', '决定是否继续深入守蛇的水潭', [
    narration(`${guide(s)}赶在天黑前寻到营地。她弟弟的热还未退，若有一包成药，就能让邻居接着照看。她愿陪你深入一趟：她知道守泉的墨背蛇怎样追逐热气。`),
    narration(s.scene.fate.pressure === 'storm' ? '这一季水位涨得太快，蛇已经占住唯一的高石。独吞泉露就必须迎着它走，连落脚处都没有。' : s.scene.fate.pressure === 'rival' ? '另一名散修在对岸扎营。他也带着空瓶，见你望过去，便把剑挪到了膝上。' : '外围不少药草已被早来的采药人收走。再往深处仍能找到足够温养的普通灵草，只是卖不出药引的价钱。'),
  ], [
    choice('marsh-help-guide', '给她一包伤药，请她一起看住后路', '救急的药换来真肯帮忙的人。进潭以后，她能配合你引开蛇。', 'marsh-pool', `${guide(s)}把药交给赶来的村童，重新系紧衣袖。她指着一条回旋的水纹，把引蛇的办法仔细说了一遍。`, { costs: { days: 2, items: { medicine: 1 } }, effects: { heal: 1, lifeFacts: { 'marsh-company': true } } }),
    alone,
    choice('marsh-outer-harvest', '放弃深潭，只采够温养用的灵草', '不取药引。靠观察药性和调息劳作积累经验，带普通材料离开。', 'marsh-return', '你沿外泽忙了半个月。没有夺目的宝物，只有一篓辨清药性的灵草。许多从前不懂的运气之法，倒在这些劳作中接上了。', { costs: { days: 14 }, effects: { items: { herb: 4 }, cultivation: gain(s), lifeFacts: { 'marsh-outcome': 'herbs' } } }),
  ]);
};

definitions['marsh-pool'] = s => {
  const reward = { items: { essence: 1 }, cultivation: gain(s), lifeFacts: { 'marsh-outcome': 'essence' }, deed: '从雾泽石心泉取得一份筑基药引' };
  let careful;
  if (fact(s, 'marsh-company')) careful = choice('marsh-pool-partner', '与向导分守两岸，燃药草引开蛇', '消耗一把灵草；她照看热源，你只取够自己用的一份泉露。', 'marsh-return', `${guide(s)}让药烟贴着岸游走。墨背蛇追过去时，你装满一只小瓶，立刻顺着约好的水道退回。`, { requires: [needFact('marsh-company'), injuryAtMost(2)], costs: { days: 2, items: { herb: 1 } }, effects: reward });
  else if (item(s, 'talisman')) careful = choice('marsh-pool-talisman', '燃护身符渡潭，取一瓶便走', '护符会彻底烧尽，但能挡住蛇第一次突袭。', 'marsh-return', '蛇吻撞在符光上。你没有回头抢第二瓶，护符燃尽前，脚已经踏上了岸。', { requires: [injuryAtMost(2)], costs: { days: 1, items: { talisman: 1 } }, effects: reward });
  else if (has(s, 'herbalism') && (item(s, 'herb') >= 2 || !has(s, 'conceal') && !has(s, 'sword'))) careful = choice('marsh-pool-herbs', '配驱蛇药烟，只取浅处泉露', '需要辨药和两把灵草。用自己熟悉的药性制造离开的空隙。', 'marsh-return', '药烟让蛇避向深水。你等它真正退开才下手，瓶中泉露清亮，手也一直没有发抖。', { requires: [needSkill('herbalism'), injuryAtMost(2)], costs: { days: 2, items: { herb: 2 } }, effects: reward });
  else if (has(s, 'conceal')) careful = choice('marsh-pool-conceal', '在落潮时藏息潜过浅滩', '花三天等水位和风向，只拿最近的一瓶。伤重的人无法长久屏息。', 'marsh-return', '你把呼吸收得极缓，沿石缝摸到泉眼。身后传来蛇游动的响声时，你已回到芦苇里。', { requires: [needSkill('conceal'), injuryAtMost(1)], costs: { days: 3 }, effects: reward });
  else careful = choice('marsh-pool-sword', '用短剑牵住蛇头，取一瓶后撤', '需要剑术和轻伤以内的身体；交手仍会添一处伤。', 'marsh-return', '剑光逼偏蛇吻，你趁它折身的一息装满小瓶。毒牙擦伤手臂，你立刻退走，没有再争。', { requires: [needSkill('sword'), injuryAtMost(1)], costs: { days: 1 }, effects: { ...reward, injury: hurt(s) } });
  const canForce = has(s, 'sword') && s.life.injury === 0 && s.scene.fate.pressure !== 'storm';
  return scene('marsh-pool', '泉眼前的一丈水', '石心泉', '决定取多少，以及拿什么承担风险', [
    narration('泉露从石心一滴滴落下。墨背蛇盘在上方，鳞片上还带着别人的血。你估过距离：取浅处一瓶后退有路，想把整眼泉露全拿走，就必须正面缠斗。'),
    narration(canForce ? '你没有旧伤，也练过剑，确实有硬取的本事。但蛇毒必会入体，重伤与三年折寿已经是能算见的代价。' : '眼下的身体、身手或水势，都不支持独占泉眼。硬闯深处会被蛇拖进水里，没有第二次撤退的机会。'),
  ], [
    careful,
    choice('marsh-pool-greed', canForce ? '独取整眼泉露（重伤并折寿三年）' : '独取整眼泉露（必死）', canForce ? '得到两份药引，但伤势会妨碍之后冲关，丢掉的寿数也不会回来。' : '危险已经看清：你撑不过正面缠斗。这不是一次胜负未定的试探。', canForce ? 'marsh-return' : 'ended', canForce ? '你斩伤蛇头，带着两瓶药露逃上高地。毒性仍烧进经脉，发黑的指尖告诉你，往后要先为这一战养伤。' : '你刚越过浅滩，蛇身就从水下缠住双腿。泉露依旧一滴滴落下，这次却没有人带你回岸。', canForce ? { costs: { days: 2, lifeYears: 3 }, effects: { items: { essence: 2 }, injury: hurt(s, 3), cultivation: gain(s), lifeFacts: { 'marsh-outcome': 'poisoned' }, deed: '强取石心泉露，留下蛇毒和折寿' } } : { ending: 'battle', endingTitle: '雾泽深处的空药篓', achievement: '已经走到筑基药引前，却没能给自己留下退路。', lesson: '药引只需一份；不足的身手和伤势不会因贪求更多而消失。' }),
    choice('marsh-pool-retreat', '退到岸边，带普通灵草离开', '放弃药引，仍能凑温养材料；这次见识也让你看清自己的功法。', 'marsh-return', '你在蛇追不到的石坡采够灵草，把空药瓶收进衣里。瓶子可以以后再用，人先离开。', { costs: { days: 3 }, effects: { items: { herb: 3 }, cultivation: gain(s), lifeFacts: { 'marsh-outcome': 'herbs' } } }),
  ]);
};

definitions['marsh-return'] = s => scene('marsh-return', '小船装得下的东西', '南泽芦村', '把所得变成下一段修行的准备', [
  narration(fact(s, 'marsh-outcome') === 'herbs' ? '回村时，你的药瓶还是空的，背篓却满了。有人笑你白走一趟，村医看过草药，却问你愿不愿意卖两把。他知道这些东西能慢慢养出根基。' : `你把药瓶收得很深，没有在人前炫耀。${guide(s)}的弟弟已经能坐起来喝粥，他只问你潭里那条蛇究竟有多大。`),
  narration(`${guide(s)}想把这次探清的浅水路标出来，让村里以后不必总拿孩子试路。她愿从带路钱里分你一点，却不肯许什么来世相报。她只顾得上眼前这家人。`),
], [
  choice('marsh-mark-road', '留一把药，和她一起标出浅水路', '少留一份材料，换两块灵石，也让后来的村民有条可用的路。', 'market-crossroad', '你们沿途立起能看见的木标。临走那天，一船新采的芦苇正顺着标记出泽。', { costs: { days: 20, items: { herb: 1 } }, effects: { items: { stones: 2 }, worldFacts: { 'marsh-path': true }, deed: '为雾泽村民留下安全的出水路' } }),
    choice('marsh-sell-herbs', '卖两把灵草，先补足盘缠', '材料换成四块灵石，之后的温养用料要重新安排。', 'market-crossroad', '村医当面称好药，付足灵石。你没有把所有东西都卖掉，药瓶和功法仍贴身带着。', { costs: { days: 14, items: { herb: 2 } }, effects: { items: { stones: 4 } } }),
    choice('marsh-keep-harvest', '谢过挽留，带齐材料离开', '保留现有灵草和药引，直接去找能养伤、闭关的地方。', 'market-crossroad', '小船把你送到泽边。回头看时，村里的炊烟已藏进芦苇深处。', { costs: { days: 14 } }),
  ]);

definitions['ruins-entry'] = s => scene('ruins-entry', '采石人的洞口', '石城旧山腹', '先看清地下的路，再找可用的灵物', [
  narration(`石匠${mason(s)}在洞口支了个雨棚。他的女儿正在镇上治病，药钱用尽了，所以他宁愿再冒一次塌方的险。他把手绘的图摊给你看：图是真的，没走到的地方也都空着。`),
  narration(world(s, 'ruins-core') === 'broken' ? `前人破坏过的中枢只剩碎石。${mason(s)}这次找到的是侧壁新露的药石脉，必须重新通风、支顶，再把矿物炼成药引。那座完整静室已经永远失去了。` : world(s, 'ruins-cache') === 'taken' ? `旧静室的门还在，里面的药槽却早已空了。${mason(s)}这一季在外壁找到一条新露的药石脉，想取到东西，就得摸清新裂隙，再用一年把矿物炼成可用的药引。` : `门后的旧静室仍封着。缝里有药香，也有烧焦的木味。${mason(s)}的同伴只伸过一只手，半边袖子就成了灰。`),
  ...(world(s, 'ruins-quarry') ? [narration('采石行这些年已铺稳外道。你不用重走那段碎石坡，买图和自行探路都能省下几日。山腹深处仍是另一个世界。')] : world(s, 'ruins-marked') ? [narration('几处旧死路仍留着前人的危险标记。它们省去无谓的试探，却没有替人走完通往内室的路。')] : []),
  dialogue(mason(s), '图我卖两块。你若信不过，就自己慢慢摸。我不拿女儿的药钱赌你会回来。'),
], [
  choice('ruins-buy-map', '买下他亲手走过的地图', '用两块灵石换已知的通路，也让石匠能先回镇里看女儿。', 'ruins-map', `${mason(s)}逐处标明松石和气孔，把未走过的地方留成空白。你照图走进了外室。`, { costs: { days: world(s, 'ruins-quarry') ? 1 : 2, items: { stones: 2 } }, effects: { lifeFacts: { 'ruins-map': true } } }),
  choice('ruins-listen-air', '收住气息，循风声摸出空腔', '藏息的练习让你听清微弱回声，但探路仍需四天。', 'ruins-map', '你在岔口一遍遍停下，用细灰辨风，避开了两处已经封死的洞道。', { requires: [needSkill('conceal'), injuryAtMost(2)], costs: { days: 4 }, effects: { lifeFacts: { 'ruins-map': true } } }),
  choice('ruins-probe-slowly', '用绳结逐段探路，走得慢些', world(s, 'ruins-quarry') ? '采石外道已经铺稳，三天就能摸出一张自己的简图，不必再付灵石。' : world(s, 'ruins-marked') ? '前人的危险标记省去几处死路，用四天换一张自己摸出的简图。' : '不付灵石，也不冒进；用七天换一张自己摸出的简图。', 'ruins-map', '每走一段，你便系一道绳结。终于找到外室时，你已经把来路完整画进自己的简图。', { requires: [injuryAtMost(2)], costs: { days: world(s, 'ruins-quarry') ? 3 : world(s, 'ruins-marked') ? 4 : 7 }, effects: { lifeFacts: { 'ruins-map': true } } }),
]);

definitions['ruins-map'] = s => scene('ruins-map', '墙上的最后一课', '遗址外室', '决定是否花时间读懂旧人的做法', [
  narration(world(s, 'ruins-core') === 'broken' || world(s, 'ruins-cache') === 'taken' ? '旧墙上保留着导气、排水的刻图。把它读懂，可以知道哪些药石仍有用，哪些位置一凿就会塌。矿脉新露出来，旧图不能照搬，却能教你怎么判断。' : '墙上不是失传神通，而是旧学徒留下的调息笔记。最后一行写着：内室封气，循三长一短开侧门。字很淡，要把前面的图都接起来，才知道这句究竟指什么。'),
  narration('石匠的同伴又来催了一次。他们想早点见钱，你却在墙角找到一封没有送出的家书。写信的人也曾相信，自己会很快回来。'),
], [
  choice('ruins-study-wall', '留一个四季，把墙刻试明白', '花一年和一把灵草维持修行，真正弄懂内室的气路。', 'ruins-seal', '你在外室过冬，逐步验证每一道气路。来春再站到石门前，许多从前只会照练的口诀，已经能说出缘由。', { costs: { years: 1, items: { herb: 1 } }, effects: { cultivation: gain(s), lifeFacts: { 'ruins-read': true }, heal: 1 } }),
  choice('ruins-follow-map', '照可靠的地图继续，先不钻研', '已有地图能避开外层危险，但内门的开法仍要另想办法。', 'ruins-seal', '你沿地图找到侧门。门缝里透出的气息，比外室强得多。', { requires: [needFact('ruins-map')], costs: { days: 3 } }),
  choice('ruins-force-passage', '从裂隙掘进，抢在石匠前到内门', '一定会被落石砸伤；省下的时间要拿身体来换。', 'ruins-seal', '碎石擦过肩背，你终于挤到门前。外层捷径走通了，内层的危险却没有因此少一分。', { requires: [injuryAtMost(1)], costs: { days: 10 }, effects: { injury: hurt(s) } }),
]);

definitions['ruins-seal'] = s => {
  const broken = world(s, 'ruins-core') === 'broken';
  const emptied = world(s, 'ruins-cache') === 'taken';
  const newVein = broken || emptied;
  const understood = fact(s, 'ruins-read') === true;
  const safeReq = understood ? [needFact('ruins-read'), injuryAtMost(2)] : [needSkill('conceal'), injuryAtMost(1)];
  const safeCost = newVein ? { years: 1, items: { herb: 1, stones: understood ? 1 : 2 } } : { days: understood ? 7 : 14, items: { stones: understood ? 1 : 2 } };
  const canForce = !newVein && has(s, 'sword') && s.life.injury === 0 && s.scene.fate.pressure !== 'storm';
  return scene('ruins-seal', newVein ? broken ? '塌方后新露的药石' : '空静室外的新矿脉' : '门内一线药香', newVein ? '遗址侧壁' : '旧静室门前', '用明白的办法拿药，或及时收手', [
    narration(newVein ? `${broken ? '旧室中枢已毁，' : '完整的旧药槽早已空了，'}这次可取的是悬顶下新露的药石。你可以按气路慢慢支顶剥离，再用一年炼去杂质。若蛮力劈凿，整片顶板都会落下。` : '内室石槽里封着一份成药，槽底还凝着能炼成第二份药引的药髓。正门禁制仍在，侧门却随气流时紧时松。读懂墙刻，或真正练过收息的人，才有把握拆开侧门；连槽底也剜走，则会破坏支撑静室的中枢。'),
    narration(s.scene.fate.pressure === 'rival' ? '另一名散修已走到外室，敲着石壁问你要多久。你听出他在试探，却也听出他怕塌方。这里不是谁声音大谁就能活着拿走东西。' : s.scene.fate.pressure === 'storm' ? '雨水顺着石缝滴下。顶板受潮后已经变形，任何强斩都会让退路一起塌掉。' : `${mason(s)}带来的支木只剩几根，想稳妥施工还得自己补钱。药引的价钱，正一点点变成真实的用料。`),
  ], [
    choice('ruins-open-carefully', newVein ? '支住顶板，慢慢炼出一份药引' : understood ? '按墙刻卸开侧门，取一份药引' : '循气流收息拆封，取一份药引', newVein ? '取的是本世新露的矿物。需要读懂墙刻或会藏息，再付用料和一年炼药的时间。' : '消耗灵石维持安全的气路。若没读懂墙刻，就须凭藏息本事多花一倍工夫。', 'ruins-return', newVein ? `你把悬石逐层撑住，取下够用的一块药石。一年后杂质终于炼净，药引澄清。${broken ? '塌掉的旧室仍旧留在山腹里。' : '旧药槽依然是空的，你带走的是这一世亲手炼出的东西。'}` : '侧门打开的一刻，外室的灯全晃了一下。你取出成药便重新封住气口，石门安稳合拢。成药已空，槽底的药髓继续留在承重石中，无法再不伤中枢地取走。', { requires: safeReq, costs: safeCost, effects: { items: { essence: 1, herb: 1 }, cultivation: gain(s), lifeFacts: { 'ruins-outcome': 'essence' }, worldFacts: { 'ruins-cache': 'taken' }, deed: newVein ? '从本世新露的药石脉中炼出筑基药引' : '看懂旧静室的气路，安全取出封存的筑基药引' } }),
    choice('ruins-smash-core', canForce ? '强斩中枢抢药（重伤并折寿五年）' : '强行劈开承重石（必死）', canForce ? '剑术与完好的身体能让你赶在塌陷前带走成药和槽底药髓，但旧静室会永久毁坏。' : newVein ? '旧日封存物已经取走。新矿脉的承重石后没有捷径，强斩只会让山体压下来。' : '现有伤势、身手或湿透的顶板，已经让这条路没有活着出来的余地。', canForce ? 'ruins-return' : 'ended', canForce ? '短剑斩开中枢，药槽旁的石柱一根根折断。你抓走成药与槽底药髓，逃出后炼成两份药引，经脉却被反冲震裂；那座静室再也不会完整。' : '剑锋落下，头顶传来沉重的断裂声。你退了一步，退路却先被封死。石城之外，雨还没有停。', canForce ? { costs: { days: 2, lifeYears: 5 }, effects: { items: { essence: 2 }, cultivation: gain(s), injury: hurt(s, 3), lifeFacts: { 'ruins-outcome': 'broken' }, worldFacts: { 'ruins-core': 'broken', 'ruins-cache': 'taken' }, deed: '毁去旧静室中枢，带着重伤夺出药引' } } : { ending: 'battle', endingTitle: '石门后的最后一声', achievement: '已经找到遗址深处，却没能给山体与自身实力留出余地。', lesson: '读懂气路或放弃内室都能继续修行；已知的塌方不会让蛮力创造生路。' }),
    choice('ruins-take-outskirts', '封回入口，只取外壁灵草', '放弃药引，带走足够温养的普通材料与此次观察所得。', 'ruins-return', `你标出不能再碰的石柱，在外壁采够灵草。走出山腹时，${mason(s)}看见你两手完整，先松了一口气。`, { costs: { days: 7 }, effects: { items: { herb: 4 }, cultivation: gain(s), lifeFacts: { 'ruins-outcome': 'herbs' }, worldFacts: { 'ruins-marked': true } } }),
  ]);
};

definitions['ruins-return'] = s => scene('ruins-return', '山外还有人的日子', '石城小镇', '决定怎样处置遗址的见闻', [
  narration(fact(s, 'ruins-outcome') === 'broken' ? `山腹崩塌的烟尘落了三天。${mason(s)}没再怪你，只把用不上的支木劈成柴，赶着回镇看女儿。你怀里的药引比来时想象的沉得多。` : `${mason(s)}回镇时，女儿已经能坐在门口晒太阳。他问你里面有没有传说中的宝山，你说只找到够自己用的一些材料，和许多不能省略的工夫。他听完，笑了很久。`),
  narration('蒙学先生想抄外壁的草木图，采石行则想买你的通路。两边都肯付钱，往后怎么用这片山，也会因此不同。'),
], [
  choice('ruins-share-reading', '花一月把草木图抄给蒙学', '得到两块灵石，让旧人的知识在镇上有个能继续用的去处。', 'market-crossroad', '你把认得的图画清，不懂的地方留白。孩子们第一次看见山里的药长什么样，先生将那一页挂在窗边。', { costs: { days: 30 }, effects: { items: { stones: 2 }, worldFacts: { 'ruins-school': true }, deed: '将遗址的草木图留给石城蒙学' } }),
    choice('ruins-sell-route', '把通路卖给采石行', '得到四块灵石。采石行会继续开凿，后来的山路也会受它影响。', 'market-crossroad', '采石行付足了钱。你离镇时，一队新石工正背着工具上山；他们要的只是能养家的石头。', { costs: { days: 7 }, effects: { items: { stones: 4 }, worldFacts: { 'ruins-quarry': true } } }),
    choice('ruins-leave-quietly', '只标明危险处，带自己的东西离开', '不卖路线，也不另取报酬。已经失去的中枢不会因此复原。', 'market-crossroad', `你在几处死路留下清楚的记号，随后向${mason(s)}一家道别。`, { costs: { days: 14 }, effects: { worldFacts: { 'ruins-marked': true } } }),
  ]);

definitions['caravan-entry'] = s => scene('caravan-entry', '一车药，几个人的盼头', '西岭商站', '接下一份自己做得完的差事', [
  narration(`领队${trader(s)}正蹲在车边数裂开的车轴。她急着把药送到岭西，既为赚这一季的钱，也为接回在那边养伤的弟弟。她许给护货人一份筑基药引，但药在终点，货到了才有。`),
  narration(world(s, 'caravan-route') ? '前人守过的旧商道仍有几处完好的驿棚。这一趟去的却是更西边的新药市，过了驿棚，仍要自己认路。' : '这是一支只有三辆车的小队。没有高阶修士坐镇，每个人都得在天黑前找到扎营的地方。'),
  dialogue(trader(s), '我先付一点，不会叫你白干。至于大钱，咱们得活着一起走到。'),
], [
  choice('caravan-take-escort', '接护货的活，先领两块灵石', '要在关键时刻出力，药引仍以实际送达为准。', 'caravan-split', `${trader(s)}当面付了两块灵石，又给你看了各处货捆。你认清自己要守的车，才跟队出发。`, { costs: { days: 1 }, effects: { items: { stones: 2 }, lifeFacts: { 'caravan-job': 'escort' } } }),
  choice('caravan-buy-share', '投两块灵石，带一份自己的货同行', '拿自己的本钱换成功后的更多报酬；货失了，本钱也回不来。', 'caravan-split', '你挑了自己认得的药材装车，将那份本钱真的放进了这条商路。', { costs: { days: 1, items: { stones: 2 } }, effects: { lifeFacts: { 'caravan-job': 'share' } } }),
  choice('caravan-take-labor', '先做随队脚夫，领一块灵石', '不押本钱，也照样要面对路途；若真护住了货，仍能分到药引。', 'caravan-split', '你把最重的箱子挪到车心，领到一块实在的工钱。车队启行时，没人再当你是来讨仙缘的闲客。', { costs: { days: 1 }, effects: { items: { stones: 1 }, lifeFacts: { 'caravan-job': 'labor' } } }),
]);

definitions['caravan-split'] = s => {
  const pressure = s.scene.fate.pressure;
  const trouble = pressure === 'storm' ? '前面的木桥被洪水冲走，只剩一条绕山的窄路。' : pressure === 'scarcity' ? '路上两处村子都没有余粮，车队带的干饼只够再撑三天。' : `前车带回消息：${raider(s)}带人在隘口等着，索要的不是过路钱，而是一整车药。`;
  const skilled = has(s, 'conceal')
    ? choice('caravan-scout-quietly', '独自藏息探路，带车队绕过最险处', '用已经练熟的本事换十二天绕行，保住人和货的状态。', 'caravan-ambush', '你先走一趟再回来引车。慢了一些，却在天黑前找到能守住的营地。', { requires: [needSkill('conceal'), injuryAtMost(2)], costs: { days: 12 }, effects: { lifeFacts: { 'caravan-prepared': true } } })
    : has(s, 'herbalism')
      ? choice('caravan-feed-team', '辨野食、煎草药，带大家缓过这段', '用一把灵草撑过饥寒，给车队换一条从容选择路的余地。', 'caravan-ambush', '你把能吃的根茎分好，给冻病的车夫煎了药。队伍终于不必为一顿饭冲进险口。', { requires: [needSkill('herbalism')], costs: { days: 10, items: { herb: 1 } }, effects: { lifeFacts: { 'caravan-prepared': true }, heal: 1 } })
      : choice('caravan-guard-ridge', '执剑护住山脊，先替车队清路', '需要剑术与轻伤以内的身体。警戒辛苦，但能让同伴睡足一夜。', 'caravan-ambush', '你守过最窄的一段山脊，直到最后一辆车驶进背风处。车夫们终于能安心卸下肩带。', { requires: [needSkill('sword'), injuryAtMost(1)], costs: { days: 10 }, effects: { lifeFacts: { 'caravan-prepared': true } } });
  return scene('caravan-split', '路口的一场争执', '西岭半山', '让队伍有余力应付接下来的一关', [
    narration(trouble),
    narration(`${trader(s)}想停下来修整，急着拿工钱的伙计却催她赶路。她没有喝止他们，只把粮袋倒在布上，让每个人看清还剩多少。你可以拿出本事或钱，也可以在这里退出。`),
    dialogue(trader(s), '我想见到弟弟，也想让你们各自回家。两件事我都想要，别叫我为了面子装作不怕。'),
  ], [
    skilled,
    choice('caravan-buy-supplies', world(s, 'caravan-route') ? '借旧驿棚补给，出一块灵石整队' : '出两块灵石，补粮、修车、雇向导', world(s, 'caravan-route') ? '前人留下的驿棚已有木料与粮商，让这次准备省下一块灵石。' : '眼前的报酬要花出去，但车队能带着准备继续走。', 'caravan-ambush', '新粮和木料送来时，争吵终于停了。你们多等了几天，重新上路的人却不再脚下发飘。', { costs: { days: pressure === 'storm' ? 20 : 7, items: { stones: world(s, 'caravan-route') ? 1 : 2 } }, effects: { lifeFacts: { 'caravan-prepared': true }, heal: 1 } }),
    choice('caravan-leave-job', '在有人烟处退出，换成沿途采药', '放弃终点的药引与分账，保留自己，改攒温养材料。', 'caravan-return', `${trader(s)}点过已做的工，没有追回工钱。你留在村边采药，过了一月，听说队伍终于到了岭西。`, { costs: { days: 30 }, effects: { items: { herb: 3 }, cultivation: gain(s), lifeFacts: { 'caravan-outcome': 'left' } } }),
  ]);
};

definitions['caravan-ambush'] = s => {
  const prepared = fact(s, 'caravan-prepared') === true;
  const reward = { items: { essence: 1, herb: fact(s, 'caravan-job') === 'share' ? 2 : 1 }, cultivation: gain(s), lifeFacts: { 'caravan-outcome': 'delivered' }, deed: '护住西岭药车，挣到自己的筑基药引' };
  let method;
  if (item(s, 'talisman')) method = choice('caravan-fight-talisman', '燃护符挡住第一轮急袭，掩护车队', '一张护符换同伴调整位置的时间，货能完整带过隘口。', 'caravan-return', '符光挡住飞来的短刃。车夫按你们约好的次序推车，等光熄灭，车轮已经越过最窄处。', { requires: [injuryAtMost(2)], costs: { days: 2, items: { talisman: 1 } }, effects: reward });
  else if (has(s, 'conceal')) method = choice('caravan-draw-pursuers', '带一辆空车走暗路，引开追兵', '需要藏息，也需要出发前准备好的退路。你必须亲自走险路。', 'caravan-return', '你让空车留下深痕，藏入石坡后看着追兵赶远。真正的药车已经到了下一处营地。', { requires: [needSkill('conceal'), needFact('caravan-prepared'), injuryAtMost(1)], costs: { days: 3 }, effects: reward });
  else if (has(s, 'herbalism')) method = choice('caravan-spread-smoke', '用药烟遮住隘口，带药车退到宽路', '消耗一把灵草。足够的休整让大家能按你的节奏推车。', 'caravan-return', '辛辣药烟堵住了风口。你让车夫用湿布掩面，一车一车撤到能并行的宽路，对方终于不敢再追。', { requires: [needSkill('herbalism'), needFact('caravan-prepared'), injuryAtMost(2)], costs: { days: 2, items: { herb: 1 } }, effects: reward });
  else method = choice('caravan-sword-duel', '以剑拦住领头人，让车队先过', '需要剑术和轻伤以内的身体。药货保得住，自己会添一处伤。', 'caravan-return', `你逼着${raider(s)}后退两步，车轮便抢过了那两步路。最后一辆车驶过时，你的袖子已被血浸透。`, { requires: [needSkill('sword'), injuryAtMost(1)], costs: { days: 2 }, effects: { ...reward, injury: hurt(s) } });
  const canForce = has(s, 'sword') && s.life.injury === 0 && prepared;
  return scene('caravan-ambush', '药车前的剑', '西岭隘口', '护住货，或为人留一条退路', [
    narration(`${raider(s)}站在车前，身后有四个缺粮的修士。他的同伴受着毒伤，急着要药；他本人还想抢走剩下的货，再也不回这片穷山。他没有把两种念头分开。`),
    dialogue(raider(s), '留一半，我让路。你们若非要把东西看得比人重，那就试试。'),
    narration(`${trader(s)}把手放在车辕上，看向你。她珍惜这批货，却没有喊你替她送命。你们${prepared ? '已经休整过，也商量过退路' : '尚未做好准备，队伍乱在窄路上'}，现在要让之前做过的事派上用场。`),
  ], [
    method,
    choice('caravan-yield-half', '让出一半药货，护着众人离开', '药引的约定无法兑现，但你能分到三把普通灵草，所有人都有路走。', 'caravan-return', `${trader(s)}亲手解开一半货绳。${raider(s)}让开路，车队的人一个不少地走过隘口。她将剩下的普通药材分你一份，没有拿未送到的药引哄你。`, { costs: { days: 3 }, effects: { items: { herb: 3 }, cultivation: gain(s), lifeFacts: { 'caravan-outcome': 'ransom' }, deed: '舍半车药，带西岭同伴活着过隘口' } }),
    choice('caravan-all-out', canForce ? '拼着性命击溃整队（重伤并折寿三年）' : '孤身硬挡整队追兵（必死）', canForce ? '成功能多得一份药引，代价是重伤与不可恢复的寿数。' : '现有伤势或本领撑不住连续围攻，车队也来不及把你救回。', canForce ? 'caravan-return' : 'ended', canForce ? `你不顾经脉灼痛，连续催动短剑。${raider(s)}带人退了，药车全在，你却倒在车辕旁。醒来后，${trader(s)}把额外的药引放在枕边，脸上没有赢下一仗的喜色。` : '你挡住第一人，却没能接住侧面来的剑。车轮声渐渐远了，那份尚未到手的药引也随它远去。', canForce ? { costs: { days: 3, lifeYears: 3 }, effects: { ...reward, items: { essence: 2, herb: 1 }, injury: hurt(s, 3), lifeFacts: { 'caravan-outcome': 'wounded' } } } : { ending: 'battle', endingTitle: '没走完的西行路', achievement: '曾靠本事挣到同行人的信任，却在药车前耗尽了自己。', lesson: '护货有许多办法；留下一半货物，也能保住继续求仙的人。' }),
  ]);
};

definitions['caravan-return'] = s => {
  const departed = fact(s, 'caravan-outcome') === 'left';
  const lost = fact(s, 'caravan-outcome') === 'ransom';
  return scene('caravan-return', departed ? '人和车各有去处' : '终点不只是一笔钱', departed ? '岭西外村' : '岭西药市', '把这一趟的所得带回自己的生活', [
    narration(departed ? `一月后，你在岭西外村见到${trader(s)}。她弟弟已经能扶着门走几步，车队少了一些货，却还有人说笑。她记得你做过的工，也接受你中途离开。` : lost ? `${trader(s)}靠剩下的货付清工钱，自己这一趟几乎白做。见到弟弟走出药铺时，她却先笑了。晚饭时，她给每个人都盛了一碗热汤。` : `${trader(s)}当面领出约好的药引，先分给出过力的人，再去看弟弟。你接过属于自己的那份，终于知道它不是谁的随手恩赐，而是一段路真正走完的报酬。`),
    narration('药市想雇人整修旧驿棚、教新伙计护身。一年工钱不错，也能把伤养好；你若急着回山，分完账就能离开。'),
  ], [
    choice('caravan-stay-year', '留下做一年护路和修棚的活', '用一年换四块灵石、一把灵草和安稳休养，给后人留下能过夜的地方。', 'market-crossroad', '你修过漏雨的屋顶，也教新伙计如何结伴守夜。下一年出发时，商队第一次不用挤在露天等雨停。', { costs: { years: 1 }, effects: { items: { stones: 4, herb: 1 }, heal: 2, worldFacts: { 'caravan-route': true, 'caravan-refuge': true }, deed: '在西岭留下可供商旅避雨的驿棚' } }),
    choice('caravan-take-pay', '结清做过的工，直接回山', '拿两块灵石作盘缠，不再为商队多留一年。', 'market-crossroad', '你收好实际做过的那份工钱，向桌边的人逐一道别。这一程同行到此，也已经足够。', { costs: { days: 14 }, effects: { items: { stones: 2 } } }),
    choice('caravan-leave-medicine', '留一包伤药给后来的人，再走', '少一份随身药，留下一处肯接待伤者的落脚点。', 'market-crossroad', `${trader(s)}把药放进新修的棚里，旁边留了清水和干净布条。你走远时，门仍开着。`, { costs: { days: 14, items: { medicine: 1 } }, effects: { items: { stones: 1 }, worldFacts: { 'caravan-refuge': true } } }),
  ]);
};

definitions['market-crossroad'] = s => {
  if (fact(s, 'market-debt')) return scene('market-crossroad', '功法封底的旧账', '青石药市', '结清出门时的借款，再筹备自己的闭关', [
    narration('你翻开功法，封底仍记着出门时的三块欠款。借来的四块灵石和护身符早已跟你走过许多地方，药铺当初给的宽限，却不是把这笔债忘了。'),
    dialogue('当年的掮客', '按约还三块，便两清。手头紧，就替我做两年配货。往后若有适合你的差事，我再当面问，不拿旧恩逼你答应。'),
  ], [
    choice('crossroad-repay-stones', '付清三块灵石，把欠据收回来', '保留自己的时间；此后是否帮忙，另作决定。', 'rest-chamber', '掮客点清灵石，将欠据交还。你把封底那一行划去，第一次能只为自己的闭关算账。', { costs: { days: 3, items: { stones: 3 } }, effects: { lifeFacts: { 'market-debt': false, 'market-debt-cleared': true }, deed: '结清初入药市时的借款' } }),
    choice('crossroad-repay-work', '做两年配货，以工钱抵清旧债', '不消耗手中的修行材料，确实多花两年；旧伤也能在镇上慢慢养。', 'rest-chamber', '你按季验货、送药，两年工钱一笔笔抵清欠款。离开药铺时，掮客只问你要不要带一包路上的干粮。', { costs: { years: 2 }, effects: { heal: 2, lifeFacts: { 'market-debt': false, 'market-debt-cleared': true }, deed: '以两年劳动还清入门时的旧债' } }),
  ]);
  return scene('market-crossroad', '从历练带回的东西', '青石药市', '把伤势、材料和余年摆在一起，决定是否冲关', [
    narration(item(s, 'essence') ? '药引被你收在衣里最稳妥的位置。一路上它比灵石还令人惦记，可真正回到镇上，你才发现，不能让一瓶东西替自己决定余生。' : '你没有带回稀少的药引，篓里的普通灵草却都认得清楚。药师说，肯用足够多的年月温养，仍有一条慢些的路。'),
    narration(s.life.injury > 1 ? '伤口已经不再流血，运气时的刺痛却还在。带着这样的伤闭关，药材再好也护不住经脉。' : '你试着运气一周，气息已经比出发前稳。接下来缺的，是能住下许多年的地方，以及愿意交给它的时间。'),
  ], [
    choice('crossroad-rest-first', '先住进客院，把身体和功法理顺', '可以用药快些养伤，也可以花几年重整修炼。', 'rest-chamber', '你谢绝了几份新差事，在后院租下一张安静的床。行囊终于不用随时扎紧了。', { costs: { days: 7 } }),
    choice('crossroad-seek-cave', '身体无碍，直接去找闭关处', '轻伤以内可以继续筹备，洞府仍须自己找、自己安置。', 'cavern-search', '你向山民问过水源与冬雪，带着纸笔去看山。', { requires: [injuryAtMost(1)], costs: { days: 10 } }),
    choice('crossroad-go-home', '把这次所得收好，就此回乡', '不再追逐筑基，把炼气和手艺用在自己的日子里。', 'qi-old-age', '你没有把药引卖给第一个出价的人，只将它封好。车马声渐远，回乡的路仍然认得。', { costs: { days: 14 } }),
  ]);
};

definitions['rest-chamber'] = s => scene('rest-chamber', '门外不必留一只鞋', '药市后院', '让经脉能够承受下一次闭关', [
  narration('从前住驿棚，你总把一只鞋放在门外，出了事就能立刻跑。现在院门有人照看，夜里只有煎药的气味，你反倒睡得不惯。'),
  dialogue('坐堂药师', s.life.injury > 1 ? '这伤能养，但你得真的停下来。伤药与时间，你总要舍一样。' : '身上无大碍，也别把静坐当成无事可做。把路上险些走错的气重新练顺，往后才不怕急。'),
], [
  choice('rest-use-medicine', '用一包伤药，安静休养两个月', '用现成伤药换较短的恢复时间，不增加修为。', 'cavern-search', '你按时换药、吃饭，不在半夜偷偷运气。两个月后，再握住剑柄时，肩背终于没有那阵牵痛。', { costs: { days: 60, items: { medicine: 1 } }, effects: { heal: 3 } }),
  choice('rest-relearn-breath', '用三年养伤，把历练中的功法重新练熟', '不需要现成伤药；把真实的年月用在恢复和修行上。', 'cavern-search', '三回冬雨过去，你终于能说清当初为什么会气乱。伤处慢慢养好，那些只会照着做的口诀，也成了自己能运用的本事。', { costs: { years: 3 }, effects: { heal: 3, cultivation: gain(s) } }),
  choice('rest-stop-journey', '养着伤回乡，停止筹备筑基', '回到有人烟的地方谋生，余生不再为冲关筹材料。', 'qi-old-age', '你托人把多余的闭关用具送回铺子，带着书和药慢慢上路。', { costs: { days: 30 }, effects: { heal: 1 } }),
]);

definitions['cavern-search'] = s => {
  const quick = has(s, 'conceal')
    ? choice('cave-follow-quiet-spring', '循地下水声，找出避开兽径的石室', '凭藏息辨风探路，花三个月确认水源、通气与第二条出口。', 'foundation-plan', '你沿泉声找到一间干燥石室，守过雨天，又试过两处出口。最后一夜没有兽迹，你才将铺盖真正搬进去。', { requires: [needSkill('conceal'), injuryAtMost(2)], costs: { days: 90 }, effects: { lifeFacts: { 'cave-secure': true }, deed: '亲自探明水路与退路，安置闭关石室' } })
    : choice('cave-rent-and-mend', '付两块灵石，租下山民指认的旧石室', '租约只是开头；还要用一年补屋顶、验水路，才适合长期住下。', 'foundation-plan', '你没有立刻封门，而是先住过一个雨季。排水沟挖通，松动的洞顶补好，冬天的柴也备齐后，石室才成了自己的住处。', { costs: { years: 1, items: { stones: 2 } }, effects: { lifeFacts: { 'cave-secure': true } } });
  return scene('cavern-search', '闭关先要有屋顶', '松风山背阴坡', '为几年甚至十几年的修炼找到可靠住处', [
    narration('山里并不缺洞口，缺的是雨季不淹、冬天不断水、野兽也不会钻进来的地方。你试住的第一间石窟，半夜便落了满床碎石。'),
    narration('山民愿租一处用过的旧石室，收的是一笔长住的钱。你也能自己找，只是开路、排水和备粮都得花时间，不能把一块能坐的石头就当成洞府。'),
  ], [
    quick,
    choice('cave-build-shelter', '自己花三年开路、排水，修出住处', '不付灵石，把劳动和季节变化都实实在在经历一遍。', 'foundation-plan', '第一年排水，第二年加固，第三年你终于能在连雨里睡个整觉。那扇木门没有仙家气派，却关得住寒风。', { costs: { years: 3 }, effects: { heal: 1, lifeFacts: { 'cave-secure': true }, deed: '亲手修成可供长期闭关的山中住处' } }),
    choice('cave-abandon-plan', '不把余年留在这里，带行囊回乡', '放弃这处洞府与冲关准备，已有本事仍可以谋生。', 'qi-old-age', '你在洞口放下最后一捆木料，背起自己的书。山下正有人收秋粮。', { costs: { days: 20 } }),
  ]);
};

definitions['foundation-plan'] = s => scene('foundation-plan', '两条都要付代价的路', '山中石室', '选定能承担的筑基方法', [
  narration('你把全卷翻到筑基一章。药引可以让灵气在三年闭关中凝稳，但药性须先调清；没有药引，也能用普通灵草与灵石温养十二年，再另用六年冲关。两条路都需要炼气的积累、能承受运转的经脉和可靠的住处。'),
  narration(`你现在有${item(s, 'essence')}份药引、${item(s, 'herb')}把灵草、${item(s, 'stones')}块灵石。屋外的树每年都会再长一圈，凡人的余年却不会等材料自己凑齐。`),
], [
  choice('plan-pill-method', '用药引走三年冲关的路', '先调清药性；真正冲关还须消耗一份药引。修为和伤势都须已经准备好。', 'medicine-prep', '你将药引放到灯下，决定先把它的药性弄清，再碰最后一道关。', { requires: [...ready, needItem('essence')], costs: { days: 3 } }),
  choice('plan-warm-method', '用普通材料，走多年温养的路', '准备需三把灵草、两块灵石与十二年，之后还需六年闭关；先看清自己是否有这些余年。', 'breath-prep', '你把稀少灵物的传闻合在书里，另摊开一页温养的时序。慢路也需要你亲自走完。', { requires: ready, costs: { days: 3 } }),
  fact(s, 'final-preparation')
    ? choice('plan-retire-after-preparation', '已经准备过，仍决定不再冲关', '已花去的光阴不会回来，但往后的年月仍能自己安排。', 'qi-old-age', '你收起两张方子，没有再用已经花掉的年月逼自己继续。', { costs: { days: 14 } })
    : choice('plan-make-last-preparation', '先补齐修为、伤势和普通材料', '只做这一次筹备；可以用六年劳动，或舍掉一份药引换较短的时间。', 'last-preparation', '你列清自己真正缺的东西，关上石门，回镇里找能做完的活。', { costs: { days: 14 } }),
]);

definitions['last-preparation'] = s => scene('last-preparation', '最后一次凑行装', '山下药圃', '补齐冲关所需，或在此收手', [
  narration('药圃正缺肯留下几年的人。主人愿供你吃住，分出普通灵草和灵石，条件是照料完整的几季药田。白日有活，夜里才能慢慢把功法练稳。'),
  narration('另一位药师愿收一份筑基药引，换给你温养所需的全部普通材料。你若答应，便是把先前争来的快路，换成日后更长的静坐。'),
], fact(s, 'final-preparation') ? [
  choice('preparation-already-done', '带着已经攒好的东西回石室', '这一份长工已经做完，不能再领一遍报酬。', 'foundation-plan', '你重新点过药草和灵石，把账目留在桌上，带自己的行囊上山。', { costs: { days: 14 } }),
  choice('preparation-already-retire', '不再筹备，回乡谋生', '将现有东西留给自己的生活。', 'qi-old-age', '你向药圃主人辞行，选了通向故乡的路。', { costs: { days: 14 } }),
] : [
  choice('preparation-six-year-work', '做六年药圃长工，养伤并补齐积累', '获得三把灵草与两块灵石；六年间边劳动边修炼，将缺少的基础补稳。', 'foundation-plan', '药田收过六轮。你把工钱和自己的份额一件件装好，旧伤已经不疼，功法中欠下的工夫也逐日补上。此后再怎样走，要由你自己决定。', { costs: { years: 6 }, effects: { items: { herb: 3, stones: 2 }, cultivation: Math.max(0, 3 - s.life.cultivation), heal: 3, lifeFacts: { 'final-preparation': true } } }),
  choice('preparation-trade-essence', '卖一份药引，换材料并休养两年', '舍掉一份稀少药引，换三把灵草、两块灵石和安稳修炼的条件。', 'foundation-plan', '药师验过药引，当面交齐普通材料。你在他院里养伤、练功两年，直到灵气不再在旧伤处滞住，才重新回山。', { costs: { years: 2, items: { essence: 1 } }, effects: { items: { herb: 3, stones: 2 }, cultivation: Math.max(0, 3 - s.life.cultivation), heal: 3, lifeFacts: { 'final-preparation': true } } }),
  choice('preparation-let-go', '不再用年月换材料，回家', '停止这次筹备；不会因此失去已经学会的本事。', 'qi-old-age', '你退掉尚未开始的长工，把功法包好。回去以后，总还有一顿饭、一块地和真正要过的日子。', { costs: { days: 14 } }),
]);

definitions['medicine-prep'] = s => scene('medicine-prep', '先让药性安静下来', '山中石室', '弄清手中药引，准备三年闭关', [
  narration('药引放在掌心，暖意一阵强、一阵弱。若把这种起伏直接引进经脉，伤到的便不只是一只手。你需要先校准辅药与运气的次序，药引本身要留到真正冲关时使用。'),
  dialogue('炼药师', '你会辨药，就自己试。我能替你校准，要收两块灵石。若都不愿舍，也能按书慢慢比对，只是得多花两年。'),
], [
  choice('medicine-use-herbalism', '凭辨药本事，用一把灵草试清辅药', '三个月反复试配，省下请人的灵石。', 'pill-breakthrough', '你把每次冷热变化都记在纸上。三个月后，辅药的分量终于与手中这份药引相合，没有拿别人的方子硬套自己。', { requires: [needSkill('herbalism'), needItem('essence')], costs: { days: 90, items: { herb: 1 } }, effects: { lifeFacts: { 'pill-prepared': true } } }),
  choice('medicine-hire-apothecary', '付两块灵石，请炼药师当面校准', '药引始终留在自己手里；三个月学会这份药的服用次序。', 'pill-breakthrough', '炼药师来过数次，每次都让你亲手操作。他收钱离开时，你已经能独自辨出药气何时该缓、何时该收。', { requires: [needItem('essence')], costs: { days: 90, items: { stones: 2 } }, effects: { lifeFacts: { 'pill-prepared': true } } }),
  choice('medicine-study-two-years', '不请人，用两年按全卷反复校准', '不另耗灵石与灵草，代价是确实多用两年。', 'pill-breakthrough', '两年里，你把药引的气息记过四季，又用温水反复练习服药与运气的次序。最后一页写完时，你才敢把三年闭关的门关上。', { requires: [needItem('manual'), needItem('essence')], costs: { years: 2 }, effects: { lifeFacts: { 'pill-prepared': true } } }),
]);

definitions['pill-breakthrough'] = s => scene('pill-breakthrough', '药引入脉的那一刻', '封门石室', '用准备好的三年稳住根基，或在服药前收手', [
  narration('水、粮、出路和辅药都已备妥。你最后试了一次呼吸，知道自己能承受怎样的药力。完整的运转要经过三个寒暑；把药力一齐催起，眼下的经脉承受不了。'),
  narration('此刻退开，药引仍在。真正服下以后，损失的药、年岁与伤势，都不会因为不甘心而复原。'),
], [
  choice('pill-breakthrough-steady', '服下药引，按次序闭关三年', '需要炼气积累、轻伤以内的身体、可靠洞府和校准后的药性；用完一份药引，三年结束才筑基。', 'foundation-return', '第一年药力沉下，第二年周天渐稳，第三年冬末，灵气终于不再随一口呼吸散开。你伸手托住落下的石屑，它安稳停在掌心。筑基成了，三年也已经过去。', { requires: [...ready, needFact('pill-prepared')], costs: { years: 3, items: { essence: 1 } }, effects: { realm: 'foundation', cultivation: gain(s), heal: 1, lifeFacts: { 'foundation-method': 'pill' }, deed: '备齐药性与洞府，以三年闭关完成筑基' } }),
  choice('pill-breakthrough-force', '强把三年压成一年（必定失败、伤身折寿）', '过量药力会冲坏经脉；损失一份药引，添重伤，并折去六年寿元。', 'qi-old-age', '你把药力催得太急，经脉先于根基裂开。再次醒来，炉已冷透，药引已经耗尽。你仍是炼气修士，只能带着伤离开石室。', { requires: [qi, needItem('essence'), needFact('pill-prepared')], costs: { years: 1, lifeYears: 6, items: { essence: 1 } }, effects: { injury: hurt(s, 3), lifeFacts: { 'foundation-failed': 'pill-rush' }, deed: '强行催动药引，冲关失败并折损寿元' } }),
  choice('pill-breakthrough-withdraw', '封好药引，带着现有本事下山', '尚未服药，可以收手；此前花过的准备时间不会退回。', 'qi-old-age', '你将瓶口重新封严，开门时被日光晃了一下。山下仍有人等着做工的人，也有你可以过的生活。', { costs: { days: 20 } }),
]);

definitions['breath-prep'] = s => scene('breath-prep', '把十二年排进四季', '石室外药畦', '用普通材料温养，承担慢路真正的年月', [
  narration('温养不用稀少药引，却也不是空坐。三把灵草要分季炼用，两块灵石要维持气息平稳；十二年里，作息稍乱便要从当天重新调息。最后还须留出六年冲关。'),
  narration('你把十二枚小木签插在药畦边，想起当年只盼做完三日短工便能回家。时间已经变得很重，你仍可以在此刻换主意。'),
], [
  choice('warm-prepare-twelve-years', '用三把灵草、两块灵石，温养十二年', '材料与十二年会真正用掉；养成之后仍需另用六年完成突破。', 'warm-breakthrough', '每过一年，你就收起一枚木签。第十二年春天，药畦重新翻土，体内灵气终于能在不借药引的情况下长久停驻。慢路最漫长的一段，你已经亲自走过。', { requires: ready, costs: { years: 12, items: { herb: 3, stones: 2 } }, effects: { heal: 1, cultivation: gain(s), lifeFacts: { 'warm-foundation': true }, deed: '以普通灵草和十二年温养备下筑基根底' } }),
  choice('warm-reconsider-method', '还未动用材料，回头重算方法', '只多花七日，把药引、普通材料与余寿重新对照。', 'foundation-plan', '你收起尚未炼用的药材，在书页边重新记下可用的年份。', { costs: { days: 7 } }),
  choice('warm-give-up-preparation', '不再留山，将余生放回人间', '保留尚未使用的材料，停止筹备筑基。', 'qi-old-age', '十二枚木签仍留在泥里。你没有拔走它们，只把门关好，下山去寻自己的日子。', { costs: { days: 20 } }),
]);

definitions['warm-breakthrough'] = s => scene('warm-breakthrough', '十二枚收起的木签', '温养后的石室', '守住已经养成的根底，完成最后六年', [
  narration('你坐下时，气息已经无需强求便能往复。十二年的温养确实改变了身体，却还没有筑基。最后的凝稳要六年，不能因为前面花得久，就把最后一段省掉。'),
  narration('门边放着几封迟到的家信。封皮上的笔迹有熟悉的，也有新学写字的人留下的。你把它们读完，才重新望向面前的蒲团。'),
], [
  choice('warm-breakthrough-steady', '按温养之法，再闭关六年', '须已经付出十二年温养和全部材料，也须保持轻伤以内；六年结束才真正筑基。', 'foundation-return', '你不再催促每日那一点进展。第六年，灵气在体内安稳相接，像细小的水终于汇成能常流的泉。开门那天，你知道自己得到了更长的寿数，也确实错过了门外的六个春天。', { requires: [...ready, needFact('warm-foundation')], costs: { years: 6 }, effects: { realm: 'foundation', cultivation: gain(s), heal: 1, lifeFacts: { 'foundation-method': 'warm' }, deed: '走完十二年温养与六年闭关，以慢法完成筑基' } }),
  choice('warm-breakthrough-force', '只留三年，强催凝气（必定失败、伤身折寿）', '尚未凝稳的根底会被冲散；再添重伤，折去四年寿元，温养准备也随之失效。', 'qi-old-age', '急催的灵力冲散了温养多年的细流。三年后，你只能扶着石壁开门，手里那把木签却仍旧很整齐。它们记得你花过的工夫，不能替你补回最后的耐心。', { requires: [qi, needFact('warm-foundation')], costs: { years: 3, lifeYears: 4 }, effects: { injury: hurt(s, 3), lifeFacts: { 'warm-foundation': false, 'foundation-failed': 'warm-rush' }, deed: '在温养之后强催凝气，未能跨过筑基关' } }),
  choice('warm-breakthrough-withdraw', '开门回乡，不再把年月交给冲关', '温养过的光阴和材料已经用掉；你仍能保住此刻的身体与炼气本事。', 'qi-old-age', '你把信折回原样，揣进贴身的衣袋。出门时没有庆贺声，山路却清清楚楚就在脚下。', { costs: { days: 20 } }),
]);

definitions['foundation-return'] = s => scene('foundation-return', '开门之后的风', '闭关石室外', '适应筑基后的身体，再决定怎样用更长的余生', [
  narration(`你凭${methodName(s)}走到了筑基。往日要双手搬动的石块，如今能借灵力稳稳托起；登上山脊，呼吸也不再很快散乱。寿限增长到一百八十年，身体确实与从前不同了。`),
  narration(`从十六岁离家至今，已经过了${yearsAway(s)}年。更长的命没有把这些年份退回来。你把旧衣穿上，发现袖口磨破的地方仍然磨破，家书里的岁月，也没有因你破关而停下。`),
  narration('山外来过一位行脚修士，隔着几道岭便能御物。他没有替你排好此后的路，只提醒你先练熟新得的力量。眼下能确定的，是自己终于跨过这一关。'),
], [
  choice('foundation-visit-home', '先回故乡，亲眼看看信里的人', '用一个月走完归途，新的本事要从真实的生活里慢慢适应。', 'foundation-duty', '你没有等人来祝贺。石室门锁好后，便沿着当年的山路一步步走回去。', { costs: { days: 30 }, effects: { lifeFacts: { 'foundation-home-first': true } } }),
  choice('foundation-settle-power', '先用三年练稳新境界，再下山', '把御物与护身练到能控制，不急着接超出本领的差事。', 'foundation-duty', '你从托起一块石头练到在山风里收住剑锋。三年后下山，知道自己多了哪些本事，也知道哪些事仍然做不到。', { costs: { years: 3 }, effects: { cultivation: gain(s), heal: 3, lifeFacts: { 'foundation-home-first': false } } }),
]);

definitions['foundation-duty'] = s => {
  const home = s.world.generation === 1
    ? yearsAway(s) < 20
      ? (fact(s, 'family-helped') ? '母亲的头发已经白了许多。她仍认得你走路的声音，见面时先问你吃了没有。村医说，当年留下的药让她少受过几个冬天的罪，却留不住所有的年轻。' : '母亲已经需要扶着门站起来。她听你说起筑基，问的却是山里的饭合不合胃口。你蹲下替她换好鞋，第一次没有急着解释自己还能走多远。')
      : '母亲已经不在了。村里替她留着旧屋的钥匙，也留着她最后托人捎给你的话：外头冷，记得添衣。你在门槛上坐了很久，筑基的灵气没有让那句话再多说一遍。'
    : yearsAway(s) < 25 ? '这一世的家人已经老了些。你们重新讲清彼此这些年怎样过活，他们为你活着回来高兴，也有自己不想离开的田地与人。' : '这一世的旧屋已经由晚辈住着。他们认得家书上的名字，却需要你坐下来，重新讲一讲自己是谁。旧生的关系不会替这一世的人省掉这顿陌生的饭。';
  return scene('foundation-duty', '有本事以后，住在哪里', '故乡与山下小镇', '为自己选一份能长久过下去的生活', [
    narration(home),
    narration('村里缺懂药的人，商队缺护路的人，你自己的石室也还在。有人愿付报酬，有人愿借院子，没有谁能替你决定，这多出来的年月应该住在哪里。'),
  ], [
    choice('foundation-open-clinic', '用辨药手艺，在村里置办自己的药铺', '用五年和两块灵石立住生计，接治自己真懂的病，也给远行的人留一处落脚点。', 'foundation-years', '药铺最初只有两只药柜。五年后，你已经认得谁家的老人怕苦，也知道哪种病该早送去镇上。门口开始有远行的人留下名字，等下次回来取药。', { requires: [needSkill('herbalism')], costs: { years: 5, items: { stones: 2 } }, effects: { items: { medicine: 2 }, worldFacts: { 'village-clinic': true }, lifeFacts: { 'foundation-livelihood': 'clinic' }, deed: '以辨药手艺在故乡立起一间常开的药铺' } }),
    choice('foundation-guard-caravans', '接六年护路的活，攒下安身的本钱', '筑基足以应付寻常山匪，仍只接看清路况的差事；挣三块灵石，修出自己能住的驿舍。', 'foundation-years', '六年里，你护过几次最紧的山口，也拒绝过价钱很高的死路。攒下的钱修起一间驿舍，你住后院，前院留给肯结伴守夜的行客。', { costs: { years: 6 }, effects: { items: { stones: 3 }, worldFacts: { 'caravan-refuge': true }, lifeFacts: { 'foundation-livelihood': 'road' }, deed: '靠六年护路立住生计，留下可供商旅避雨的驿舍' } }),
    choice('foundation-keep-own-mountain', '回自己的山中，用八年种药、练功', '不接长久的雇约；用真实劳动维持住处，慢慢练熟筑基的本领。', 'foundation-years', '你在石室外种下果树和药苗，修过雨后坏掉的路。八年里也曾有人来借火、借水，更多的清晨则只有你自己与一壶热茶。', { costs: { years: 8 }, effects: { cultivation: gain(s), heal: 3, lifeFacts: { 'foundation-livelihood': 'mountain' } } }),
  ]);
};

definitions['foundation-years'] = s => scene('foundation-years', '年岁渐长，山还在远处', '已经住惯的地方', '决定继续远行，还是把余生放在已经拥有的生活里', [
  narration('筑基以后，你能搬动从前搬不动的石块，寿命也更长了。渐渐让你不习惯的，是与你说话的人换得比自己快。曾经同桌的人开始让孩子替自己跑腿，曾经喊你名字的人，也渐渐少了。'),
  narration(world(s, 'ruins-core') === 'broken' ? '石城寄来一摞新拓片。旧中枢仍是废墟，先生们只想弄明白还留在外墙上的草木与运气图，不再等那座静室复原。' : '石城的先生寄来几张旧墙拓片，想请你把认得的草木和运气图说清楚。那些字不会让人一步登天，至少能让后来者少把同一种毒草认错。'),
  narration('另一封信来自更远的外山。写信人说，沿途有新的药地，也有连筑基修士都过不去的封山雷带。你读了两遍，仍然想亲眼看看。'),
], [
  choice('foundation-teach-fifteen-years', '用十五年整理所学，再出去走一程', '把亲手验证过的本事写清，留下能继续教人的书；没有学过的法门不会因此凭空学会。', 'last-journey', '你用十五年逐页重做示范，把不懂的字留白。书放进石城学舍那天，接书的孩子已经换了一批，你终于能带着轻些的行囊再出门。', { costs: { years: 15 }, effects: { ...remembrance(s), worldFacts: { 'ruins-school': true }, deed: '把亲手验证的草木与修行经验留入石城学舍' } }),
  choice('foundation-wander-thirty-years', '独自远行三十年，慢慢走向外山', '旅途会增长见识，也会留下轻伤；三十年是真的三十年，不会直接换来更高境界。', 'last-journey', '你渡过大河，在陌生城里租过小屋，也遇到必须绕开的强者。三十年后走到外山脚下，旧剑又修过两次，你仍是筑基修士，已很少为了称呼与人争辩。', { costs: { years: 30 }, effects: { cultivation: gain(s), injury: hurt(s), items: { stones: 2 }, deed: '以筑基之身独行三十年，亲见山外的辽阔' } }),
  choice('foundation-stay-for-life', '留下过完余年，不再安排下一次远行', '把真正剩下的年月交给安稳生活，直到最后一年再收拾这一生。', 'late-home', lastWinter(s) >= 360 ? '此后的年岁，你都在自己选定的地方过。院门修了又修，果树长高又换苗。等到握剑的手真正慢下来，你已经很久不必为下一次出发收拾行囊。' : '你把行囊放下，按自己想要的样子过完眼前的日子。院里的花快开了。', { costs: { days: lastWinter(s) }, effects: { heal: retirementHealing(s), lifeFacts: { 'foundation-stayed': true }, ...remembrance(s) } }),
]);

definitions['last-journey'] = s => scene('last-journey', '看得见，也过不去的山', '外山雷带前', '为最后一次远行辨清能走的路', [
  narration('到了外山，你才看见信里所说的雷带。石坡上没有活树，偶尔一线白光落下，连石头里的铁色也烧成了黑。自己的护身灵气刚靠近，便碎得像薄冰。'),
  dialogue('守路老修士', '外坡的药地可以慢慢走。封山那边，近年进去的人没一个回来。你若问我筑基够不够，我已经给你看过那块试石。'),
  narration('你已经走得比十六岁时想象的远。眼前仍有更远的地方，是否跨出去，却还得由眼前这副身体承担。'),
], [
  choice('last-journey-outer-ridge', '避开雷带，用六年走完外坡药地', '只到自己能应付的地方，采药、访人，随后带着所得归乡。', 'late-home', '六年里，你在外坡认出几种未见过的草木，也听过许多求仙人的去处。离开时带着几把合用的药，没有试着从雷光里证明自己。', { costs: { years: 6 }, effects: { items: { herb: 2, medicine: 1 }, heal: 1, ...remembrance(s), deed: '看清外山雷带的边界，完成外坡游历后生还' } }),
  choice('last-journey-cross-lightning', '强闯封山雷带（必死）', '护身灵气已经试过，挡不住这里的雷。继续进入会陨落，没有凭冲动获得的新境界。', 'ended', '第一道雷打碎护身灵气，第二道落下时，你已退不到山口。旧剑留在焦黑的石坡上，再没有主人收它入鞘。', { costs: { days: 1 }, ending: 'battle', endingTitle: '雷带前的一柄旧剑', achievement: '曾从凡人走到筑基，也曾亲眼见过远山，却没能接受身体已经试明的边界。', lesson: '境界带来本事，也仍有边界。外坡与归途都是真实可走的路。' }),
  choice('last-journey-turn-home', '谢过守路人，沿旧路回乡', '不再增加新的旅程；把仍有的余年带回自己的住处。', 'late-home', '你问清归路，和守路人分完一壶茶便起身。雷声留在背后，没有一路追着你。', { costs: { days: 30 }, effects: { heal: 1 } }),
]);

definitions['late-home'] = s => scene('late-home', left(s) <= 360 ? '门前最后一度春风' : '归来时的院门', '此生的住处', '决定怎样走完仍属于自己的年月', [
  narration(`你如今${Math.floor(s.life.ageDays / 360)}岁，仍是筑基修士。${left(s) <= 360 ? '身体已经把最后的日子告诉了你，清晨起身需要比从前更久。' : '修炼得来的余年仍在，你可以不再把它们排成一场场必须赶上的机缘。'}`),
  narration(yearsAway(s) >= 40 ? '院门前的人已换了几辈。你讲起当年的人，他们会认真听，却不会把祖辈的交情当作自己欠下的债。你们从今日的饭食、风雨和病痛开始相识。' : '熟悉的人又老了些。你重新认过邻家的孩子，也重新学着在一顿饭里把自己的远行讲完。有人愿意听，有人只关心明天会不会下雨。'),
  narration(world(s, 'valley-seed') === 'destroyed' ? '从药谷捎来的只是普通药苗。那株被毁的灵种没有再长回来，眼前这些平凡草木，却仍需要有人浇水。' : '药谷又送来一包寻常种子。你在门前翻出一小块土，不必知道它们能不能结成灵物，也知道该何时浇水。'),
], [
  choice('late-home-teach-and-retire', '种药、授艺，在这里走完余生', '实际度过全部剩余时日；只留下自己真正学会的方法与已经做成的事。', 'ended', '此后你按季种药，愿意学的人便坐到门边来。最后一次合上书时，窗外有人正在把药苗移到向阳处。你的手松开了，那件小事仍有人接着做。', { effects: { ...remembrance(s), deed: '筑基之后归居授艺，安稳走完余年' }, ending: 'retired', endingTitle: '一百八十年之内，一盏人间灯', achievement: '用真实的准备跨过筑基，把延长的岁月过成了远行、谋生与归居。', lesson: '稀少药引能省下部分年月，慢法也能走通；得来的余年仍要由自己决定怎样生活。' }),
  choice('late-home-quiet-last-days', '收起远行的书，安静过完自己的日子', '不再接新差事，也不再安排冲关，真实度过余寿后结束此生。', 'ended', '你将路图卷好，留在柜子的最深处。往后的晴日里就出门，雨日里就在窗边坐着。直到最后一个清晨，门外的花照旧开了。', { effects: remembrance(s), ending: 'lifespan', endingTitle: '山河看过，归于一窗春色', achievement: '从凡人修至筑基，亲自作过争取与放下的决定，最后平静走尽余寿。', lesson: '求仙所得不只是一道境界。哪些年月愿意拿来争，哪些愿意留下，也都是这一生的选择。' }),
]);

definitions['qi-old-age'] = s => {
  if (fact(s, 'market-debt')) return scene('qi-old-age', '回乡之前的一笔债', '青石药市', '先结清旧债，再过自己的余生', [
    narration('你已经决定不再追逐筑基，功法封底的欠款却仍在。无论是否继续修行，早年借来的灵石与护身符都曾帮过这一副身体。'),
    dialogue('当年的掮客', '还钱，或照当年的约做两年活。两清之后，你想在哪里过日子，都由你。'),
  ], [
    choice('qi-retreat-repay-stones', '付清三块灵石，再回乡', '偿还借款，不再留下以旧债索取人情的余地。', 'qi-old-age', '掮客把欠据交还。你收进包里的，是一笔真正结清的往事。', { costs: { days: 3, items: { stones: 3 } }, effects: { lifeFacts: { 'market-debt': false, 'market-debt-cleared': true } } }),
    choice('qi-retreat-repay-work', '用两年配货的工钱还清', '不消耗随身材料，花两年做完答应过的事，并慢慢养伤。', 'qi-old-age', '你搬过两年的药箱，也照常练过两年的功。最后一笔欠款划去时，终于可以只想下一顿饭该在哪儿吃。', { costs: { years: 2 }, effects: { heal: 2, lifeFacts: { 'market-debt': false, 'market-debt-cleared': true } } }),
  ]);
  const craft = has(s, 'herbalism') ? '采药、配药' : has(s, 'sword') ? '教人护身、守住山路' : '替行路人辨风探路';
  return scene('qi-old-age', '把行囊放下的那一天', '回乡的路', '为炼气之后的余生选择一种生活', [
    narration(`你此刻${Math.floor(s.life.ageDays / 360)}岁，还没有因为一句归隐就走完后面的年份。炼气让你能做从前做不到的事，寿数却仍与普通人相近。`),
    narration(fact(s, 'foundation-failed') ? '失败留下的伤还会在阴雨里提醒你。回去以后，要找生计、养身体，也要重新习惯不把每一日都当成冲关前的一日。' : '你把求药的路线放在一旁，才发现仍有许多平常事需要亲手做：住处漏雨，邻人缺柴，自己的饭也不会因为会法术便有人送来。'),
  ], [
    choice('qi-retire-practice-craft', `靠${craft}谋生，平稳过到晚年`, '实际度过余下年月，只留最后一年；已经学过的本事，会在日常使用中传给愿意学的人。', 'qi-retirement', retirementResult(s, '此后你靠熟悉的本事吃饭，按季修屋，也慢慢养好旧伤。有人与自己一同变老，有人来得更晚。等到需要把工具交给旁人时，这段日子已经亲自过完。'), { costs: { days: lastWinter(s) }, effects: { heal: retirementHealing(s), ...remembrance(s), lifeFacts: { 'retirement-life': 'craft' }, ...(has(s, 'herbalism') ? { worldFacts: { 'village-clinic': true }, deed: '以炼气与辨药手艺养活自己，留下乡间药铺' } : { deed: '以炼气手艺谋生，在人间安稳度过余年' }) } }),
    choice('qi-retire-home-life', '回家耕种、修屋，把余生过在家乡', '真实度过剩下的年月，直到最后一年；不会因归隐获得新的境界或法门。', 'qi-retirement', retirementResult(s, '你买回锄头，修好门板，把会的法术用在搬水、取物这些小事上。年岁一季一季过去，曾经急着离开的家乡，终于成了亲手住惯的地方。'), { costs: { days: lastWinter(s) }, effects: { heal: retirementHealing(s), ...remembrance(s), lifeFacts: { 'retirement-life': 'home' } } }),
  ]);
};

definitions['qi-retirement'] = s => scene('qi-retirement', '最后一年的灯火', '晚年的住处', '收拾此生留下的手艺与牵挂', [
  narration('手指已经不如从前灵便，早晨运气也比从前慢。余下的日子，你都留在有人能端来一碗热汤的地方，没有再为最后一次机缘收拾包袱。'),
  narration(fact(s, 'retirement-life') === 'craft' ? '旧工具交给了肯反复练习的晚辈。你在一旁看着，偶尔出声提醒，不再因为他们做得慢就抢回自己手里。' : '门口的地已经有人接着耕种。你有时坐着看一下午，想起当年第一次出门时，也是这样的风吹过田埂。'),
], [
  choice('qi-last-teach', '把学过的练法讲完，走完最后时日', '只讲自己真正会的东西，然后在日常陪伴中度完真实余寿。', 'ended', '最后一课讲得很慢。听的人照着练了一遍，你看见他们终于站稳，便点了点头。此后的日子越发安静，灯也终于在某一夜燃尽。', { effects: { ...remembrance(s), deed: '在炼气晚年将亲手练过的法门讲给后人' }, ending: 'retired', endingTitle: '未成仙，也好好过了一生', achievement: '从凡人走进炼气，以已学会的本事谋生，真正走完了选择留下的余年。', lesson: '及时收手能保住可以生活的日子。下一世若仍想筑基，可以更早筹材料、安排伤势与年月。' }),
  choice('qi-last-quiet', '收好功法，安静陪着身边的人', '不再安排修炼或授课，实际度过剩下的时日。', 'ended', '你把书包好，放在床边的木柜上。有人问起当年的山，你便说几句；累了，就听他们讲今天的雨。最后一次睡去前，屋里仍有熟悉的声音。', { effects: remembrance(s), ending: 'lifespan', endingTitle: '山路之外的人间岁月', achievement: '修至炼气，保住自己的本事与生活，把未用于争取的年月真正过完。', lesson: '修为不会替人留住岁月。继续求仙或留下生活，都需要承认自己实际付出的时间。' }),
]);

definitions['mortal-return'] = s => {
  if (fact(s, 'market-debt')) return scene('mortal-return', '留下之前，先把账结清', '青石药市', '不再求仙，也把出门时的约定做完', [
    narration('你决定回去过凡人的日子。掮客听完，没有劝你继续修仙，只翻出当年借款的欠据：四块盘缠和护身符，约好以三块灵石或两年劳动抵清。'),
  ], [
    choice('mortal-repay-stones', '付清三块灵石，带剩下的东西回家', '把借款结清，再开始自己选择的生活。', 'mortal-return', '掮客收钱还据。你将那一页折好，没有因为不再修行就把过去说成没发生。', { costs: { days: 3, items: { stones: 3 } }, effects: { lifeFacts: { 'market-debt': false, 'market-debt-cleared': true } } }),
    choice('mortal-repay-work', '做满两年药铺杂务，以劳动抵债', '多花两年，把确实借过的东西还清。', 'mortal-return', '两年里，你照约验货、搬药、打扫。最后一个月底，掮客在欠据上写了两清，你才带自己的行李回家。', { costs: { years: 2 }, effects: { heal: 2, lifeFacts: { 'market-debt': false, 'market-debt-cleared': true } } }),
  ]);
  return scene('mortal-return', item(s, 'manual') ? '书仍在，日子也在' : '行囊放下，日子还在', '故乡', '选择一条不再求仙的生活路', [
    narration(`你回来时${Math.floor(s.life.ageDays / 360)}岁，尚未引气入体。${item(s, 'manual') ? '书里写着另一条路' : '山里的人曾讲起另一条路'}，你见过那条路的门槛，也知道自己眼下愿意把时间交给什么。`),
    narration(s.world.generation === 1 && yearsAway(s) < 20 ? '母亲没有追问何时再走，只把桌上的碗挪开，让你放下东西。今后的柴米与病痛不会自己消失，至少可以从这一顿饭开始，一件件做。' : '家里为你挪出住处。你重新认过这些年的变化，与眼前的家人商量田地和活计。往后的日子仍要一起过，过去见过仙缘也不能代替谁少做一天工。'),
  ], [
    choice('mortal-stay-with-family', '留下务农、照顾家人，度过余生', '实实在在走过剩下的年月，直到最后一年；不因终老而得到修为。', 'mortal-winter', retirementResult(s, `${item(s, 'manual') ? '你把功法收进木箱' : '你把行囊收进木箱'}，照季下地、修屋、照顾病人。有人先走，也有人新来，一年的愿望渐渐变成一家人的日子。等到手再握不住锄头，这一生已亲自走到晚年。`), { costs: { days: lastWinter(s) }, effects: { heal: retirementHealing(s), ...remembrance(s), lifeFacts: { 'mortal-livelihood': 'family' }, deed: '选择凡人生活，亲自照顾家人与田地直到晚年' } }),
    choice('mortal-make-town-living', '去镇上做工，靠学过的东西养活自己', '真正度过余下的工作与生活，只留最后一年；已有手艺可以使用，没有学过的法门不会凭空出现。', 'mortal-winter', retirementResult(s, '镇上的活计有淡旺季，你慢慢学会留下过冬的钱。年轻时见过的远山，后来仍会在晴日露出轮廓；你没有忘记它，也没有因此耽误眼前该过的日子。'), { costs: { days: lastWinter(s) }, effects: { heal: retirementHealing(s), ...remembrance(s), lifeFacts: { 'mortal-livelihood': 'town' }, deed: '以凡人之身在镇上谋生，安稳走到晚年' } }),
  ]);
};

definitions['mortal-winter'] = s => scene('mortal-winter', '凡人最后的一个冬天', '晚年的屋里', '安静走完自己选择的一生', [
  narration(`窗纸又换过一回，旧木箱还在床边。你已经不需要别人问，便知道这副身体能留下的日子不多了。${item(s, 'manual') ? '年轻时拿回的书仍然完整，书外的生活也确实过满了许多年。' : '年轻时见过的求仙人，后来都走向了远处；你留在这里的生活，也确实过满了许多年。'}`),
  narration(activeSkill(s) ? `偶尔有人来请教${SKILLS[activeSkill(s)].name}，你只讲亲手练过的部分。没有跨进修行门，并没有让这些实在的工夫变成假的。` : '你没有把未曾学会的口诀说成心得。来探望的人听你讲的，是如何熬过难年、如何把答应的活做完，以及哪条回家的路雨后不好走。'),
], [
  choice('mortal-finish-life', '与来探望的人道别，走完最后时日', '实际度过余寿，结束这一世；只记住曾经真正学会与做成的事。', 'ended', '最后一场雪落下时，屋里有人添了柴。你听他们说开春以后要种什么，点头应着。后来火渐渐小了，窗外仍有人沿着熟悉的路走回家。', { effects: remembrance(s), ending: 'retired', endingTitle: item(s, 'manual') ? '一卷未练完的书，一生过完的日子' : '放下行囊，过完一生', achievement: '见过求仙的门槛后选择凡人生活，亲自承担生计与牵挂，安稳走完这一生。', lesson: '不入修行也能认真过日子。若下一世仍想试，先学会护身本事，再为完整功法与几年苦修留出时间。' }),
]);

definitions.ended = s => scene('ended', s.summary?.title || '此生已尽', '来路与归处', '记住真正学过的本事，再决定下一世怎样开始', [
  narration(s.summary?.achievement || '这一生已经走到尽头，发生过的事留在故地。'),
  narration(s.summary?.lesson || '已经做过的选择不会消失，新的生活仍要重新开始。'),
  narration('下一世没有此生的境界、行囊或旧人的信任。你可以只携记忆，也可以记住一门确实学成的方法；留下的药铺、道路与毁去的遗物，会继续影响后来的人。'),
], []);


export function resolveCultivationScene(state) {
  const build = definitions[state.scene.nodeId];
  if (!build) throw new Error(`Unknown cultivation scene: ${state.scene.nodeId}`);
  return build(state);
}
