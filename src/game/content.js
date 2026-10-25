// 百世问鼎：原创世界与规则数据。境界寿限不会重置年龄；闭关收益有限。
export const REALMS = [
  { id: 'qi', name: '炼气', lifeCap: 100, trainYears: 3, trainGain: 12, need: 36, breakYears: 3, hp: 100, attack: 14, defense: 3 },
  { id: 'foundation', name: '筑基', lifeCap: 160, trainYears: 6, trainGain: 18, need: 70, breakYears: 6, hp: 155, attack: 24, defense: 7 },
  { id: 'core', name: '金丹', lifeCap: 260, trainYears: 10, trainGain: 25, need: 110, breakYears: 10, hp: 225, attack: 39, defense: 12 },
  { id: 'nascent', name: '元婴', lifeCap: 380, trainYears: 16, trainGain: 32, need: 160, breakYears: 16, hp: 320, attack: 58, defense: 18 },
  { id: 'spirit', name: '化神', lifeCap: 520, trainYears: 24, trainGain: 42, need: 220, breakYears: 24, hp: 450, attack: 80, defense: 26 },
  { id: 'immortal', name: '登仙', lifeCap: 560, trainYears: 24, trainGain: 45, need: 0, breakYears: 0, hp: 620, attack: 108, defense: 36 },
];

export const PATHS = [
  { id: 'sword', name: '剑修', subtitle: '以锋破局', description: '起手凌厉，擅长以攻势缩短战斗。燃寿一击可在险境中定胜负。', icon: '剑', bonuses: { attack: 8, defense: 0, hp: 0, training: 0 }, starterArt: 'reed-sword-art', starterSkill: 'first-ray' },
  { id: 'body', name: '体修', subtitle: '以身载道', description: '筋骨坚实，气血与防御较高。看准敌方强击，守势蓄力后再还击。', icon: '体', bonuses: { attack: 0, defense: 4, hp: 25, training: 0 }, starterArt: 'stone-breath', starterSkill: 'rooted-stance' },
  { id: 'alchemy', name: '丹修', subtitle: '以炉养命', description: '修炼额外获得四点修为，初始神通改善恢复。用药材与灵石换取有限延寿。', icon: '丹', bonuses: { attack: 0, defense: 0, hp: 0, training: 4 }, starterArt: 'ember-canon', starterSkill: 'mending-mist' },
];

export const ORIGINS = [
  { id: 'village', name: '山村孤子', description: '没有显赫门第，却有一副常年走山路的筋骨。起始气血上限增加二十。', icon: '山', spirit: 24, herbs: 3, hpBonus: 20 },
  { id: 'heir', name: '破落世家', description: '家业散尽，旧匣中还留着六十灵石。你可以先用这些积蓄换取机会。', icon: '印', spirit: 60, herbs: 1, hpBonus: 0 },
  { id: 'herbalist', name: '采药学徒', description: '认得山中草木，也知道丹药的代价。随身带有八份药材。', icon: '草', spirit: 30, herbs: 8, hpBonus: 5 },
];

export const WORLDS = [
  { id: 'mortal', name: '人间', location: '青岚洲', subtitle: '烟火与道统', description: '渡口、药谷、荒城。凡人的一场选择，也能在百年之后成为仙家的因果。', minRealm: 0, accent: '#a9c8ac' },
  { id: 'nether', name: '幽冥', location: '忘川九渡', subtitle: '欠债与轮回', description: '金丹可照幽途。亡者不只记恨，也记得尚未兑现的一句承诺。', minRealm: 2, accent: '#aaa0d2' },
  { id: 'celestial', name: '天界', location: '白玉十二阶', subtitle: '天规与问鼎', description: '化神方可叩天门。诸仙守着旧秩序，你须带着三界的道证另立尺度。', minRealm: 4, accent: '#e0bd7a' },
];

export const ITEMS = [
  { id: 'reed-sword-art', name: '芦苇剑诀', kind: 'art', pathId: 'sword', rarity: 'common', description: '苇叶也有刃口。最朴素的剑意先教人站稳。', stats: { attack: 4, training: 1 } },
  { id: 'rain-sword-art', name: '听雨分江诀', kind: 'art', pathId: 'sword', rarity: 'rare', description: '以雨声辨虚实，剑落时不再迟疑。', stats: { attack: 12, defense: 2 } },
  { id: 'star-sword-art', name: '星河截流经', kind: 'art', pathId: 'sword', rarity: 'epic', description: '截取星河一瞬，化作掌中长锋。', stats: { attack: 22, burn: 8 } },
  { id: 'stone-breath', name: '磐石吐纳法', kind: 'art', pathId: 'body', rarity: 'common', description: '呼吸沉入足底，身如山石。', stats: { defense: 3, hp: 12 } },
  { id: 'mountain-body', name: '负山真解', kind: 'art', pathId: 'body', rarity: 'rare', description: '所负之重不只压身，也使筋骨坚韧。', stats: { defense: 6, hp: 40 } },
  { id: 'gold-body', name: '无漏金身录', kind: 'art', pathId: 'body', rarity: 'epic', description: '不求刀枪不入，只求伤处皆能愈合。', stats: { defense: 10, hp: 75, healing: 6 } },
  { id: 'ember-canon', name: '温炉经', kind: 'art', pathId: 'alchemy', rarity: 'common', description: '把修行当作一炉慢火，先守火候。', stats: { training: 3, healing: 3 } },
  { id: 'valley-canon', name: '青谷丹书', kind: 'art', pathId: 'alchemy', rarity: 'rare', description: '每页旁都有药农写下的土名，不炫玄辞。', stats: { training: 6, healing: 8 } },
  { id: 'sun-furnace', name: '九曜炉心法', kind: 'art', pathId: 'alchemy', rarity: 'epic', description: '九种火候相继轮转，丹心与道心同炼。', stats: { training: 9, attack: 10, healing: 12 } },
  { id: 'first-ray', name: '破晓一线', kind: 'skill', pathId: 'sword', rarity: 'common', description: '把全身力道收于剑尖的一线微光。', stats: { attack: 5 } },
  { id: 'returning-edge', name: '回澜剑', kind: 'skill', pathId: 'sword', rarity: 'rare', description: '剑势折返时，仍留三分余力护身。', stats: { attack: 9, defense: 3 } },
  { id: 'burning-star', name: '焚星', kind: 'skill', pathId: 'sword', rarity: 'epic', description: '用不能重来的寿元换取强攻；装备后增加燃寿伤害。', stats: { attack: 9, burn: 15 } },
  { id: 'rooted-stance', name: '落地生根', kind: 'skill', pathId: 'body', rarity: 'common', description: '守住脚下方寸，先不让自己倒下。', stats: { defense: 2, hp: 8 } },
  { id: 'thunder-palm', name: '掌底春雷', kind: 'skill', pathId: 'body', rarity: 'rare', description: '沉默蓄势之后，雷从掌中生出。', stats: { attack: 10, hp: 15 } },
  { id: 'carrying-tide', name: '托海式', kind: 'skill', pathId: 'body', rarity: 'epic', description: '以一身承受来势，再借潮头抬手。', stats: { attack: 8, defense: 6, hp: 35 } },
  { id: 'mending-mist', name: '青雾回春', kind: 'skill', pathId: 'alchemy', rarity: 'common', description: '把微薄药气留在经脉中，休养时恢复更多气血。', stats: { healing: 8, hp: 8 } },
  { id: 'ember-finger', name: '弹指炉火', kind: 'skill', pathId: 'alchemy', rarity: 'rare', description: '丹炉的小火，也足以烧断对手的一次进势。', stats: { attack: 11, healing: 4 } },
  { id: 'rebloom', name: '枯木再荣', kind: 'skill', pathId: 'alchemy', rarity: 'epic', description: '先藏生机，再见枝叶。并不能免除寿尽。', stats: { hp: 45, defense: 5, healing: 12 } },
  { id: 'bamboo-token', name: '旧竹符', kind: 'artifact', pathId: 'any', rarity: 'common', description: '竹上刻着小字：路远，慢走。', stats: { defense: 2, training: 1 } },
  { id: 'copper-bell', name: '缺口铜铃', kind: 'artifact', pathId: 'any', rarity: 'common', description: '铃声不圆，却能定住纷乱心神。', stats: { hp: 20, defense: 2 } },
  { id: 'medicine-basket', name: '百草篓', kind: 'artifact', pathId: 'alchemy', rarity: 'rare', description: '药谷后人把祖辈的收成编入篓底。', stats: { healing: 12, training: 4 } },
  { id: 'sword-token', name: '无名剑令', kind: 'artifact', pathId: 'sword', rarity: 'rare', description: '没有掌门名号，只有弟子们一道道掌纹。', stats: { attack: 11, defense: 3 } },
  { id: 'tomb-lamp', name: '守墓灯', kind: 'artifact', pathId: 'any', rarity: 'rare', description: '不是拘魂的灯。灯亮，是给归人认路。', stats: { hp: 30, defense: 4, healing: 4 } },
  { id: 'ferry-seal', name: '渡魂印', kind: 'artifact', pathId: 'any', rarity: 'rare', description: '忘川留下的印记，沉得像一段未完的往事。', stats: { attack: 8, defense: 4 } },
  { id: 'city-banner', name: '万家灯幡', kind: 'artifact', pathId: 'any', rarity: 'epic', description: '城中每一家添一根线，织成一面不大的幡。', stats: { hp: 65, defense: 6 } },
  { id: 'mirror-of-dew', name: '露华镜', kind: 'artifact', pathId: 'any', rarity: 'rare', description: '照不见前程，只照见当下错漏的一息。', stats: { training: 5, defense: 3 } },
  { id: 'sky-anvil', name: '天工砧', kind: 'artifact', pathId: 'body', rarity: 'epic', description: '天工弃下的砧角，被锻成一枚护心铁。', stats: { attack: 10, defense: 8, hp: 25 } },
  { id: 'star-compass', name: '无极星盘', kind: 'artifact', pathId: 'any', rarity: 'epic', description: '星位不指天命，只供行路人自行取舍。', stats: { attack: 12, training: 6, defense: 4 } },
  { id: 'jade-cup', name: '雨师玉盏', kind: 'artifact', pathId: 'alchemy', rarity: 'epic', description: '盏中一滴雨，足够润开久闭的丹窍。', stats: { attack: 8, hp: 35, healing: 15 } },
  { id: 'ashen-sheath', name: '劫灰剑鞘', kind: 'artifact', pathId: 'sword', rarity: 'epic', description: '鞘中藏着一场已熄的劫火。拔剑者须自己承担代价。', stats: { attack: 17, burn: 10 } },
];

export const LEGACIES = [
  { id: 'plain-medicine', name: '朴药手记', description: '迁民的凡药经验留下三份药材与六点气血。不会使灰谷灵种复生。', source: '与迁民共建并维护凡药共同园', effects: { herbs: 3, hp: 6 } },
  { id: 'valley-seed', name: '药谷种籽', description: '来世起身时，行囊中多六份药材与一卷青谷丹书。', source: '重续药谷百年之约', effects: { herbs: 6, itemId: 'valley-canon' } },
  { id: 'sword-echo', name: '剑宗回响', description: '后世弟子仍在传剑。来世获得无名剑令。', source: '听过后世剑宗的晨课', effects: { itemId: 'sword-token', spirit: 12 } },
  { id: 'tomb-lantern', name: '归途灯火', description: '守墓人的后人替你留下灯。来世获得守墓灯。', source: '偿清古墓的托付', effects: { itemId: 'tomb-lamp' } },
  { id: 'debt-released', name: '无债一身轻', description: '亲手销去魂债后，来世多二十气血与二十灵石。', source: '在忘川偿清前世魂债', effects: { hp: 20, spirit: 20 } },
  { id: 'city-oath', name: '万家之诺', description: '城民后人将万家灯幡交给来世的你。', source: '归来见证获救之城', effects: { itemId: 'city-banner' } },
  { id: 'sword-heart', name: '澄明剑心', description: '不必记得所有招式。来世攻击增加八点。', source: '剑修证得金丹或赢得道证', effects: { attack: 8 } },
  { id: 'iron-bone', name: '不折之骨', description: '曾经承受的重量留在魂中。来世防御增加四点，气血增加二十五。', source: '体修证得金丹', effects: { defense: 4, hp: 25 } },
  { id: 'golden-furnace', name: '炉火不熄', description: '练过的火候不尽散失。来世增加六份药材、十五灵石。', source: '丹修证得筑基，且本世完成两次延寿炼丹', effects: { herbs: 6, spirit: 15 } },
  { id: 'realm-memory', name: '丹成旧梦', description: '曾经结丹的感悟化为来世十八点初始修为。', source: '真正踏入金丹境', effects: { cultivation: 18 } },
];

export const WORLD_FLAGS = {
  'medicine-valley': { name: '青谷复生', description: '你留下的药种在青谷扎根；后世可拜访种药人的子孙，续接丹书。' },
  'sword-sect': { name: '山门有灯', description: '你帮助荒山立起传剑之所；后世弟子会记得第一位护道人的无名木牌。' },
  'old-tomb': { name: '古墓立碑', description: '无名墓主终于有了姓名。守墓人的后辈仍在等归来的托付者。' },
  'soul-debt': { name: '忘川魂债', description: '你借来的魂火还未归还。来世可在幽冥寻债簿，以时间和灵石偿还，解除此因果。' },
  'saved-city': { name: '长宁灯火', description: '被你护住的长宁城仍有人烟。后世的城民将传述旧日洪灾与救城之恩。' },
};

export const EVENTS = [
  { id: 'mortal-ferry', worldId: 'mortal', title: '渡口最后一船', tag: '人间 · 抉择', body: '渡夫不问仙凡，只问你愿不愿帮他把翻倒的米袋抬上船。河对岸没有奇遇的保证。', choices: [
    { id: 'help', label: '帮他装船', description: '额外花一年，得十二灵石与一点善名。', cost: { years: 1 }, result: '渡夫把本要付给伙计的工钱递来。你第一次听见有人称你为道友。', effects: { spirit: 12, merit: 1 } },
    { id: 'watch', label: '沿岸步行', description: '不花额外资源，安静离开。', result: '你沿着水声走了一程，记住了河道的方向。' },
  ] },
  { id: 'mortal-seed', worldId: 'mortal', title: '烧过的药谷', tag: '因果 · 起种', body: '谷中火痕未冷。一位老药农从灰里捡出半袋种子，说只要有人守过第一场寒霜，这里还能活。', requires: { notWorldFlag: 'medicine-valley' }, choices: [
    { id: 'plant', label: '留下种药', description: '额外花三年、三份药材；药谷成为永久世界因果，本世记住种药之事。', cost: { years: 3, herbs: 3 }, result: '第一茬嫩芽顶开灰土。你教孩子们分辨药叶，随后把谷交还给他们。', effects: { worldFlag: 'medicine-valley', flag: 'planted-valley', merit: 3, cultivation: 12 } },
    { id: 'leave', label: '祝他来年丰收', description: '不花额外资源，继续自己的路。', result: '老药农点点头，仍蹲下把种子一颗颗埋好。' },
  ] },
  { id: 'mortal-valley-heirs', worldId: 'mortal', title: '青谷旧约', tag: '前世 · 药谷', body: '前世种下的药谷已成一片青绿。药农的后人捧出祖传账簿：第一笔没有姓名，只画着与你旧梦相同的一枚叶印。', requires: { worldFlag: 'medicine-valley', notFlag: 'planted-valley' }, choices: [
    { id: 'teach', label: '续写药簿', description: '额外花二年，获得青谷丹书、五份药材，并留下药谷种籽传承候选。', cost: { years: 2 }, result: '你在旧叶印旁添上新药方。他们没有把你当作先祖，只请你明年再来喝茶。', effects: { itemId: 'valley-canon', herbs: 5, legacyId: 'valley-seed', flag: 'valley-reunion' } },
    { id: 'basket', label: '买下他们编的新药篓', description: '消耗二十四灵石，获得百草篓与三份药材；不解锁本次传承候选。', cost: { spirit: 24 }, result: '年轻药农坚决不肯把生计当报恩礼。你付足工钱，把那枚旧叶印收在篓底。', effects: { itemId: 'medicine-basket', herbs: 3 } },
    { id: 'leave', label: '只看一眼新芽', description: '不花额外资源，保留这份安宁。', result: '孩子问你认不认识画叶印的人。你答：他大概也喜欢这里的风。' },
  ] },
  { id: 'mortal-sect-founder', worldId: 'mortal', title: '空山一间剑舍', tag: '因果 · 山门', body: '几个无师的少年在废寺练木剑。他们求的不是飞升，只是不再让山贼抢去来年的口粮。', requires: { notWorldFlag: 'sword-sect' }, choices: [
    { id: 'found', label: '修剑舍，授守势', description: '额外花四年、二十灵石；建立后世可见的剑宗，获得回澜剑。', cost: { years: 4, spirit: 20 }, result: '山门没有供你的像，只留一块写着“先护人，再出剑”的木牌。', effects: { worldFlag: 'sword-sect', flag: 'founded-sect', itemId: 'returning-edge', renown: 3 } },
    { id: 'leave', label: '把木剑放回架上', description: '不花额外资源，暂别少年们。', result: '木剑敲击的声音沿山路追来，很久没有停。' },
  ] },
  { id: 'mortal-sect-descendants', worldId: 'mortal', title: '无名木牌', tag: '前世 · 剑宗', body: '前世资助的剑舍如今有了山门。掌门早已是当年少年的后辈，晨课仍从“先护人”开始。你的旧名没有被刻在功德碑上。', requires: { worldFlag: 'sword-sect', notFlag: 'founded-sect' }, choices: [
    { id: 'practice', label: '以客卿之礼论剑', description: '额外花二年，得无名剑令，并留下剑宗回响传承候选。', cost: { years: 2 }, result: '掌门请你在木牌旁添一笔。你只添了一个顿号：这句话还可以继续说下去。', effects: { itemId: 'sword-token', cultivation: 16, legacyId: 'sword-echo' } },
    { id: 'leave', label: '在山门听完晨课', description: '不花额外资源，不打扰弟子。', result: '你离开时，年轻弟子的剑已经稳了些。' },
  ] },
  { id: 'mortal-tomb-name', worldId: 'mortal', title: '墓中没有宝藏', tag: '因果 · 古墓', body: '盗洞尽头只有一具抱着军籍的枯骨。纸上写着，他守城三十年，最后想葬在能听见潮声的地方。', requires: { notWorldFlag: 'old-tomb' }, choices: [
    { id: 'bury', label: '迁骨到海边立碑', description: '额外花三年、十二灵石，建立古墓因果；得到缺口铜铃。', cost: { years: 3, spirit: 12 }, result: '你请渔村一户人家照看碑石。军籍上的名字终于被人完整念出。', effects: { worldFlag: 'old-tomb', flag: 'raised-tomb', itemId: 'copper-bell', merit: 2 } },
    { id: 'leave', label: '合上军籍退出', description: '不花额外资源，不动墓中遗物。', result: '你把最后一块碎砖放回洞口，海风仍在很远的地方。' },
  ] },
  { id: 'mortal-tomb-keeper', worldId: 'mortal', title: '潮声里的灯', tag: '前世 · 古墓', body: '前世迁来的墓碑仍面朝海。守墓者的孙辈认出你梦中描述的军籍，说祖父临终前嘱咐：若旧客再来，把这盏灯给他。', requires: { worldFlag: 'old-tomb', notFlag: 'raised-tomb' }, choices: [
    { id: 'keep', label: '陪他守一夜潮汐', description: '额外花一年，得守墓灯，并留下归途灯火传承候选。', cost: { years: 1 }, result: '灯里没有亡魂，只有普通灯油。你却终于能在这一夜安心睡去。', effects: { itemId: 'tomb-lamp', legacyId: 'tomb-lantern', merit: 1 } },
    { id: 'leave', label: '请他继续照看', description: '不花额外资源，向海边的碑行礼。', result: '灯火留在窗内，足够照亮一段归村的路。' },
  ] },
  { id: 'mortal-city-flood', worldId: 'mortal', title: '长宁决堤', tag: '因果 · 救城', body: '河水已漫过城门。县令跪求你守住缺口，直到百姓撤到高处；那不是一场轻松的功德。', requires: { minRealm: 1, notWorldFlag: 'saved-city' }, choices: [
    { id: 'save', label: '以身守住堤口', description: '额外花二年、损失三十五气血；救城因果永久保留，得负山真解。', cost: { years: 2, hp: 35 }, result: '你最后松手时，堤后已经没有人。人们没有看见仙光，只看见你满手泥沙。', effects: { worldFlag: 'saved-city', flag: 'saved-city-now', itemId: 'mountain-body', merit: 5, renown: 3 } },
    { id: 'leave', label: '随撤离的人群上山', description: '不花额外资源，保住自身。', result: '你帮一名老人认清上山的路，随后退到水声之外。' },
  ] },
  { id: 'mortal-city-return', worldId: 'mortal', title: '万家重燃', tag: '前世 · 长宁', body: '前世救过的长宁城仍续着人间烟火。城楼下的戏讲着一名浑身泥水的修士，没有神迹，只是一直没有松手。', requires: { worldFlag: 'saved-city', notFlag: 'saved-city-now' }, choices: [
    { id: 'accept', label: '同城民守一次灯节', description: '额外花一年、十灵石，得万家灯幡，并留下万家之诺传承候选。', cost: { years: 1, spirit: 10 }, result: '一户一线织成的幡递到你手里。他们谢的是传说中的人，你谢的是这满城尚在的生活。', effects: { itemId: 'city-banner', legacyId: 'city-oath', renown: 3 } },
    { id: 'leave', label: '在人群后听完戏', description: '不花额外资源，让传说留在城里。', result: '台上的修士终于放下双手。台下有人笑，也有人擦眼角。' },
  ] },
  { id: 'mortal-market', worldId: 'mortal', title: '不识货的摊主', tag: '人间 · 市集', body: '摊主把一枚旧竹符压在菜篮下。他知道这是修士的东西，开价却只有一季冬粮。', choices: [
    { id: 'buy', label: '照价买下竹符', description: '消耗十八灵石，获得旧竹符。', cost: { spirit: 18 }, result: '摊主收好灵石，又送你两根青葱，说路上煮面可以用。', effects: { itemId: 'bamboo-token' } },
    { id: 'sell-herbs', label: '以三份药材换盘缠', description: '消耗三份药材，获得二十二灵石；不拿竹符。', cost: { herbs: 3 }, result: '摊主验过药材，认真称足灵石。竹符仍压着他的菜篮。', effects: { spirit: 22 } },
    { id: 'leave', label: '祝他早些收摊', description: '不花额外资源，离开市集。', result: '叫卖声重新合拢，这条街没有因为你的离开停下来。' },
  ] },
  { id: 'mortal-cliff-herbs', worldId: 'mortal', title: '雨后的石耳', tag: '人间 · 险采', body: '一线石壁长满新药。岩缝浸水，承重的老根看不出还能撑多久。', choices: [
    { id: 'climb', label: '系绳攀采', description: '额外花一年；成功率七成，得六份药材；失败损失十八气血。', cost: { years: 1 }, chance: 0.7, result: '绳结经住了力，你把药草连根留了一半。', effects: { herbs: 6 }, failure: { text: '老根折断，你护住头脸滑回坡下，药篓空了。', effects: { hp: -18 } } },
    { id: 'hire', label: '请熟路的山民引路', description: '额外花二年、消耗十灵石，稳妥获得四份药材。', cost: { years: 2, spirit: 10 }, result: '山民带你绕到石壁上方。多走的路，换来了脚下结实的土地。', effects: { herbs: 4 } },
    { id: 'leave', label: '等下一次晴天', description: '不花额外资源，绕过石壁。', result: '你在山脚认了几株野草，决定不赌这一场雨。' },
  ] },
  { id: 'mortal-sword-rain', worldId: 'mortal', title: '檐下一夜雨', tag: '剑修 · 悟道', body: '雨点打在破瓦上，快慢错落。你忽然听出那像一场尚未出手的交锋。', requires: { pathId: 'sword' }, choices: [
    { id: 'listen', label: '循雨声演剑', description: '额外花二年，得听雨分江诀。', cost: { years: 2 }, result: '雨停时，剑痕没有更深，却恰好避开每一块完整的瓦。', effects: { itemId: 'rain-sword-art', cultivation: 10 } },
    { id: 'leave', label: '收剑等雨停', description: '不花额外资源，保留眼前平静。', result: '檐水一滴滴落下。你也可以只做一个借宿的人。' },
  ] },
  { id: 'mortal-body-mill', worldId: 'mortal', title: '山下的旧石磨', tag: '体修 · 磨骨', body: '水道断了，村中石磨转不动。磨坊主想借你的力，工钱换成整年的粗粮。', requires: { pathId: 'body' }, choices: [
    { id: 'turn', label: '推磨兼修掌劲', description: '额外花二年、损失十二气血，得掌底春雷与十灵石。', cost: { years: 2, hp: 12 }, result: '转磨的力终于贯穿肩背。春天第一声雷响时，你掌中也多了一点回声。', effects: { itemId: 'thunder-palm', spirit: 10 } },
    { id: 'leave', label: '指给他一条新水道', description: '不花额外资源，继续赶路。', result: '磨坊主拿着木尺去看地势，你也背好自己的行囊。' },
  ] },
  { id: 'mortal-alchemy-fire', worldId: 'mortal', title: '借炉人的规矩', tag: '丹修 · 火候', body: '老丹师愿借炉，但要你先烧完一窑寻常陶碗：“能照顾泥土，再谈仙药。”', requires: { pathId: 'alchemy' }, choices: [
    { id: 'fire', label: '守完一窑陶火', description: '额外花二年、两份药材，得弹指炉火与二十修为。', cost: { years: 2, herbs: 2 }, result: '最后一只碗没有裂。老丹师把控火法抄在碎瓷片背面交给你。', effects: { itemId: 'ember-finger', cultivation: 20 } },
    { id: 'leave', label: '谢绝借炉', description: '不花额外资源，不接这份课业。', result: '老丹师没有挽留，继续把一只歪碗扶正。' },
  ] },
  { id: 'mortal-hidden-spring', worldId: 'mortal', title: '枯井下的泉眼', tag: '人间 · 休憩', body: '废村井下还藏着一线活水。井栏上刻着“取一桶，留一桶”。', choices: [
    { id: 'repair', label: '修井后汲水', description: '额外花一年，恢复三十气血，得两份药材。', cost: { years: 1 }, result: '你修好井栏，把水桶挂回原处。过路人的绳痕又多了一道。', effects: { hp: 30, herbs: 2 } },
    { id: 'leave', label: '留给后来的旅人', description: '不花额外资源，不取井水。', result: '清泉映着一小块天，你把井盖轻轻合上。' },
  ] },
  { id: 'mortal-storm-tablet', worldId: 'mortal', title: '雷劈石上的半卷', tag: '人间 · 残篇', body: '雷劈开旧碑，露出半段行气图。后半段已成石屑，照着补全难免走险。', requires: { minRealm: 1 }, choices: [
    { id: 'study', label: '用三年试解残篇', description: '额外花三年；成功率六成，得四十修为；失败增加三年命损。', cost: { years: 3 }, chance: 0.6, result: '你把断裂处留白，反倒看清原作者舍弃的一条岔路。', effects: { cultivation: 40 }, failure: { text: '逆行的灵气损了根本，你及时止住，却再也找不回那三年生机。', effects: { lifeDamage: 3 } } },
    { id: 'leave', label: '拓下字迹，不冒进', description: '不花额外资源，结束这次寻碑。', result: '看不懂的地方仍然空着，你没有强迫自己给出答案。' },
  ] },
  { id: 'mortal-trader', worldId: 'mortal', title: '沿路药商', tag: '人间 · 交易', body: '药商背着两筐新晒药草。她先让你验成色，再讲沿途涨起的渡船钱。', choices: [
    { id: 'buy', label: '买下五份药材', description: '消耗二十五灵石，得五份药材。', cost: { spirit: 25 }, result: '草药分包扎好。她还告诉你，湿药千万别闷在储物袋里。', effects: { herbs: 5 } },
    { id: 'escort', label: '护送药商绕过险路', description: '额外花三年，得三份药材与十灵石。', cost: { years: 3 }, result: '这一路没有敌人现身。你的报酬是让她安稳走过，而不是非得证明危险存在。', effects: { herbs: 3, spirit: 10 } },
    { id: 'leave', label: '不买，互道平安', description: '不花额外资源，继续行路。', result: '药商把筐换到另一肩，铃声渐远。' },
  ] },
  { id: 'mortal-abandoned-mine', worldId: 'mortal', title: '空矿的最后一脉', tag: '人间 · 探矿', body: '矿工已撤走，支架还在吱响。壁上露出灵石光泽，也许够付一次远行的费用。', choices: [
    { id: 'mine', label: '加固支架再开采', description: '额外花二年；成功率八成，得三十八灵石；失败损失二十气血。', cost: { years: 2 }, chance: 0.8, result: '支架撑到你收锤。你没有再向更深的裂缝追去。', effects: { spirit: 38 }, failure: { text: '碎石先落下，你及时逃出矿口，肩背却挨了重重一下。', effects: { hp: -20 } } },
    { id: 'leave', label: '封住入口', description: '不花额外资源，放弃开采。', result: '你把警示木板立正。光留在黑暗中，也未必是谁的损失。' },
  ] },
  { id: 'mortal-sparrow', worldId: 'mortal', title: '筑巢在剑匣上', tag: '人间 · 小憩', body: '你小憩醒来，麻雀已经在剑匣上搭了两根草。它看着你，像在等一场商量。', choices: [
    { id: 'wait', label: '多留一季护雏', description: '额外花一年，得十二修为与一点善名。', cost: { years: 1 }, result: '雏鸟飞走那天，你发现静坐也能听见自身经脉的潮声。', effects: { cultivation: 12, merit: 1 } },
    { id: 'leave', label: '把草巢移到树杈', description: '不花额外资源，轻轻离开。', result: '麻雀跟着你叫了几声，终于落回新枝。' },
  ] },
  { id: 'mortal-duel', worldId: 'mortal', title: '三招止争', tag: '人间 · 比试', body: '一名游侠拦在茶棚前，说要用三招辨明谁的剑理更对。茶棚主人只希望别打碎桌子。', requires: { minRealm: 1 }, choices: [
    { id: 'duel', label: '以木枝过招', description: '额外花一年；成功率七成，得回澜剑、十五灵石；失败损失二十五气血。', cost: { years: 1 }, chance: 0.7, result: '第三招你先护住了滚落的茶碗。游侠怔了怔，主动认输。', effects: { itemId: 'returning-edge', spirit: 15, renown: 2 }, failure: { text: '木枝折在掌中。你认下这一败，茶桌倒是完好无损。', effects: { hp: -25 } } },
    { id: 'leave', label: '请他喝茶，不争剑理', description: '不花额外资源，不参加比试。', result: '茶棚主人松了口气，给两人都续了水。' },
  ] },
  { id: 'mortal-mirror', worldId: 'mortal', title: '湖中第二个月亮', tag: '人间 · 灵物', body: '湖心有两轮月影，其中一轮始终不随水波动。撑船人说，别去捞天上的那轮。', requires: { minRealm: 2 }, choices: [
    { id: 'dive', label: '入湖寻不动的月', description: '额外花二年、消耗十五灵石，得到露华镜。', cost: { years: 2, spirit: 15 }, result: '你从淤泥中托出一面小镜。湖上终于只剩一轮月亮。', effects: { itemId: 'mirror-of-dew' } },
    { id: 'leave', label: '让月影留在湖里', description: '不花额外资源，乘舟离开。', result: '两轮月一前一后送你到岸边。' },
  ] },
  { id: 'mortal-winter-grain', worldId: 'mortal', title: '门前一斗粮', tag: '人间 · 取舍', body: '山寺的储粮刚好够到开春。门外来了一家避雪的人，住持望着空了一半的米缸没有说话。', choices: [
    { id: 'give', label: '捐灵石换过冬粮', description: '消耗十五灵石，得两份药材与三点善名。', cost: { spirit: 15 }, result: '春天，避雪人把自己找到的草药送回寺中。药并不名贵，却晒得极仔细。', effects: { herbs: 2, merit: 3 } },
    { id: 'leave', label: '为他们指向山下驿站', description: '不花额外资源，不动寺中存粮。', result: '你在地图上画清路程，再把纸递给他们。' },
  ] },
  { id: 'mortal-old-friend', worldId: 'mortal', title: '故人已老', tag: '人间 · 岁月', body: '曾与你同行的行脚人已经弯了背。他还记得当年的山路，只是走不到山口了。', requires: { minRealm: 2 }, choices: [
    { id: 'stay', label: '陪他重讲一遍旧路', description: '额外花二年，得二十二修为；时间属于这一世，不会换回他的青春。', cost: { years: 2 }, result: '他把你当年遗漏的半段笑话讲完。你终于不再急着替这场告别找一个仙法。', effects: { cultivation: 22, merit: 1 } },
    { id: 'leave', label: '留下地址，继续赶路', description: '不花额外资源，就此道别。', result: '他挥手时仍像年轻时候，只是手落得慢了些。' },
  ] },
  { id: 'nether-first-ferry', worldId: 'nether', title: '无人掌舵的渡船', tag: '幽冥 · 渡途', body: '船上坐满不知归处的影子。船桨旁刻着规矩：撑到对岸，船资自取，不得多拿。', choices: [
    { id: 'row', label: '替亡魂撑一程', description: '额外花二年，得二十八灵石与两点善名。', cost: { years: 2 }, result: '最后一个影子下船，向你认真行礼。你取了该取的船资。', effects: { spirit: 28, merit: 2 } },
    { id: 'leave', label: '沿岸另寻渡口', description: '不花额外资源，离开渡船。', result: '无声的水面把船轻轻推回岸边。' },
  ] },
  { id: 'nether-soul-loan', worldId: 'nether', title: '可借不可忘的魂火', tag: '因果 · 借债', body: '摆渡使递来一团温暖魂火：“能助你悟道。它不收今生利息，却会记住下一次轮回。”', requires: { notWorldFlag: 'soul-debt' }, choices: [
    { id: 'borrow', label: '借火，亲记债名', description: '额外花一年，得五十五修为、三十灵石；留下永久魂债，来世可偿还。', cost: { years: 1 }, result: '你在债簿上留下名号。魂火入心很暖，簿页却冷得像一场尚未到来的雪。', effects: { cultivation: 55, spirit: 30, worldFlag: 'soul-debt', flag: 'borrowed-soul' } },
    { id: 'leave', label: '不借未来的火', description: '不花额外资源，不产生魂债。', result: '摆渡使收回火焰，没有劝第二次。' },
  ] },
  { id: 'nether-debt-ledger', worldId: 'nether', title: '债簿上的旧名', tag: '前世 · 魂债', body: '前世借过的魂火在债簿上留下旧名。你此世面目不同，执簿人却把那页翻给你看：“没有惩你生来负债，只等你愿意了结。”', requires: { worldFlag: 'soul-debt', notFlag: 'borrowed-soul' }, choices: [
    { id: 'repay', label: '还清借来的温暖', description: '额外花三年、三十灵石，移除魂债，得到渡魂印与无债一身轻传承候选。', cost: { years: 3, spirit: 30 }, result: '旧名从纸上淡去。执簿人让你带走渡魂印，说自由不是忘记，而是不再被追索。', effects: { removeWorldFlag: 'soul-debt', itemId: 'ferry-seal', legacyId: 'debt-released', merit: 3 } },
    { id: 'leave', label: '记下欠款，稍后再来', description: '不花额外资源，魂债保留，可在下一世偿还。', result: '执簿人夹好那一页。债仍在，门也仍开着。' },
  ] },
  { id: 'nether-forgotten-letter', worldId: 'nether', title: '未寄出的家书', tag: '幽冥 · 托付', body: '亡魂把一封潮湿的信护在胸前。他知道家中人早已不在，仍想让那句话到达一块墓碑。', choices: [
    { id: 'deliver', label: '替他送到旧乡界碑', description: '额外花二年，得三份药材与二十五修为。', cost: { years: 2 }, result: '信在碑前化成轻灰。亡魂没有重逢谁，却终于肯走上下一段路。', effects: { herbs: 3, cultivation: 25, merit: 2 } },
    { id: 'leave', label: '把信交还他手中', description: '不花额外资源，不接下托付。', result: '他把信折好，又坐回那块不冷不热的石头上。' },
  ] },
  { id: 'nether-bone-bridge', worldId: 'nether', title: '白骨桥的缺口', tag: '幽冥 · 承重', body: '桥骨将断，成列游魂停在桥头。修桥不需要一场大战，需要一个愿意一直托着的人。', requires: { pathId: 'body' }, choices: [
    { id: 'hold', label: '托桥让亡魂过河', description: '额外花三年、损失三十气血，得托海式。', cost: { years: 3, hp: 30 }, result: '最后一缕魂影走过时，你才慢慢放低手臂。掌中留下了潮水的重量。', effects: { itemId: 'carrying-tide', merit: 3 } },
    { id: 'leave', label: '寻找另一座桥', description: '不花额外资源，不强撑缺口。', result: '你把断桥的位置标在路牌上，往上游走去。' },
  ] },
  { id: 'nether-sword-pool', worldId: 'nether', title: '沉剑潭', tag: '幽冥 · 剑意', body: '每把沉剑都曾许诺斩尽不平。潭水却很平，像在等人承认一把剑做不到所有的事。', requires: { pathId: 'sword' }, choices: [
    { id: 'draw', label: '拾起一把无主断剑', description: '额外花三年、消耗二十灵石，得焚星；燃寿仍会增加命损。', cost: { years: 3, spirit: 20 }, result: '你没有许诺斩尽一切，只答应每次出剑都知道为何。断剑在掌中化作一点星火。', effects: { itemId: 'burning-star', cultivation: 22 } },
    { id: 'leave', label: '让沉剑继续沉睡', description: '不花额外资源，离开水潭。', result: '你的剑影在潭面一闪，很快又平了。' },
  ] },
  { id: 'nether-dead-tree', worldId: 'nether', title: '不肯枯的树', tag: '幽冥 · 丹意', body: '枯树没有叶，树根却护着一枚还活着的芽。守林鬼说它每百年只肯松一次手。', requires: { pathId: 'alchemy' }, choices: [
    { id: 'nurture', label: '以药气温养根须', description: '额外花三年、五份药材，得枯木再荣。', cost: { years: 3, herbs: 5 }, result: '新芽终于长出一片叶。老根并未复活，但它完成了自己要做的事。', effects: { itemId: 'rebloom', cultivation: 25 } },
    { id: 'leave', label: '不扰这场等待', description: '不花额外资源，退回林外。', result: '一滴露水落在芽尖，亮了很久。' },
  ] },
  { id: 'nether-clock', worldId: 'nether', title: '停在昨日的钟', tag: '幽冥 · 命价', body: '钟匠能替你敲开一层心障，报酬不是灵石，而是你此后不能再用的几年。', choices: [
    { id: 'ring', label: '付四年命损听钟', description: '增加四年命损、不推进世界年份，得四十八修为。', cost: { lifeDamage: 4 }, result: '钟响一声，你看清了自己一直绕开的念头。发梢有四年悄然逝去。', effects: { cultivation: 48 } },
    { id: 'repair', label: '不敲钟，替钟匠修机轴', description: '额外花四年、消耗十二灵石，得三十二修为；这是历时劳作，会推进世界年份。', cost: { years: 4, spirit: 12 }, result: '你没有听见那一声捷径。机轴重新转动时，答案从四年的笨功夫里慢慢显现。', effects: { cultivation: 32 } },
    { id: 'leave', label: '拒绝交换', description: '不花额外资源，不损失寿元。', result: '钟匠把锤放下，昨日仍安静地悬着。' },
  ] },
  { id: 'nether-ghost-market', worldId: 'nether', title: '鬼市只卖旧物', tag: '幽冥 · 市集', body: '摊主戴着半张面具。架上的渡魂印明码标价，没有叫卖，也不接受来历不明的记忆。', choices: [
    { id: 'buy', label: '买下渡魂印', description: '消耗三十六灵石，获得渡魂印。', cost: { spirit: 36 }, result: '摊主在账册上写下两个字：两清。', effects: { itemId: 'ferry-seal' } },
    { id: 'leave', label: '看过便走', description: '不花额外资源，不与鬼市交易。', result: '面具后的眼睛没有追随你。' },
  ] },
  { id: 'nether-ink-river', worldId: 'nether', title: '墨河拾简', tag: '幽冥 · 残经', body: '河里漂着无人署名的竹简。墨水会侵蚀灵识，读得越多，越难分清谁的记忆。', choices: [
    { id: 'read', label: '只读三简便收手', description: '额外花二年；成功率七成，得四十五修为；失败损失二十八气血。', cost: { years: 2 }, chance: 0.7, result: '你把第四简推回河中。三句话已足以解开一处经脉的结。', effects: { cultivation: 45 }, failure: { text: '陌生的记忆猛然涌来，你咬破舌尖才退离河岸。', effects: { hp: -28 } } },
    { id: 'leave', label: '不读他人的旧事', description: '不花额外资源，远离墨河。', result: '竹简向下游去了，每一道字都有自己的重量。' },
  ] },
  { id: 'nether-red-herbs', worldId: 'nether', title: '彼岸药圃', tag: '幽冥 · 收成', body: '药圃主人是个记性极差的鬼，却记得每株草不能连根拔。她请你帮忙收这季的红叶。', choices: [
    { id: 'harvest', label: '按她的方法收叶', description: '额外花二年，得七份药材。', cost: { years: 2 }, result: '她忘记了你的名字，分药时却一点没有少。', effects: { herbs: 7 } },
    { id: 'leave', label: '谢过邀请', description: '不花额外资源，沿田埂离开。', result: '她挥挥手，下一刻又开始数第一畦药草。' },
  ] },
  { id: 'nether-judge', worldId: 'nether', title: '判官请你旁听', tag: '幽冥 · 是非', body: '两个亡魂争执一生的旧账。判官没有问你谁更可怜，而是问：你肯花多久听完两边的话？', requires: { minRealm: 3 }, choices: [
    { id: 'listen', label: '听完整卷证词', description: '额外花四年，得四十修为、二十灵石与两点善名。', cost: { years: 4 }, result: '你撤回了第一日的判断。判官点头：改口并不损伤道心。', effects: { cultivation: 40, spirit: 20, merit: 2 } },
    { id: 'leave', label: '不作仓促裁断', description: '不花额外资源，退出旁听席。', result: '判官没有把你的沉默记作任何一方的证词。' },
  ] },
  { id: 'nether-cold-flame', worldId: 'nether', title: '寒火锻骨', tag: '幽冥 · 炼体', body: '冥炉中的火没有热意，却会烧去每一道虚浮护体灵气。铸炉人说，痛也可以选择不承受。', requires: { minRealm: 3 }, choices: [
    { id: 'forge', label: '在寒炉守足三年', description: '额外花三年、损失四十气血、消耗二十五灵石，得无漏金身录。', cost: { years: 3, hp: 40, spirit: 25 }, result: '你走出炉时仍会受伤，只是知道如何把每一道伤接回身体里。', effects: { itemId: 'gold-body' } },
    { id: 'leave', label: '不入炉中', description: '不花额外资源，向铸炉人告辞。', result: '寒火安静燃烧，未把你的退步当作怯懦。' },
  ] },
  { id: 'nether-boat-bell', worldId: 'nether', title: '忘川雾灯', tag: '幽冥 · 休憩', body: '一间小屋专收迷路的生人。屋主先递一碗热汤，再问你记不记得自己的名字。', choices: [
    { id: 'stay', label: '整理记忆后再行', description: '额外花一年、消耗八灵石，恢复五十五气血。', cost: { years: 1, spirit: 8 }, result: '你把今生与旧梦各写一行。早晨推门，雾已经散开。', effects: { hp: 55 } },
    { id: 'leave', label: '报出姓名就此离开', description: '不花额外资源，继续旅途。', result: '屋主替你指了一条没有岔口的路。' },
  ] },
  { id: 'nether-empty-seat', worldId: 'nether', title: '轮回席上空一人', tag: '幽冥 · 放下', body: '席上空着一个位置，旁边摆着你从未见过却无端熟悉的碗。不是每个疑问都有可追认的前生。', choices: [
    { id: 'sit', label: '坐下喝完一碗茶', description: '额外花一年，得二十四修为。', cost: { years: 1 }, result: '你没有等到谁，却也没有白等。茶凉以后，你知道自己仍愿意回到路上。', effects: { cultivation: 24 } },
    { id: 'leave', label: '把空席留给来人', description: '不花额外资源，走向下一渡。', result: '杯沿热气缓缓升起，没有人喊你回头。' },
  ] },
  { id: 'celestial-gate-toll', worldId: 'celestial', title: '天门不收跪拜', tag: '天界 · 初见', body: '守门小吏把供桌移到一旁：“今日轮你讲一道能让三界都明白的规矩。说不出，也可先进去看看。”', choices: [
    { id: 'speak', label: '花三年辨清一条天规', description: '额外花三年，得五十修为与三点声望。', cost: { years: 3 }, result: '你说，付出的代价应当在选择前被人知道。小吏将这句话写进门榜。', effects: { cultivation: 50, renown: 3 } },
    { id: 'leave', label: '先看，再作判断', description: '不花额外资源，继续前行。', result: '小吏让开门道。天界也并非人人都急着给答案。' },
  ] },
  { id: 'celestial-sword-stars', worldId: 'celestial', title: '星河不肯让路', tag: '剑修 · 大成', body: '星河横在断阶前，一位老剑仙收剑静坐。他说，截流不该为了让所有人看见你的剑。', requires: { pathId: 'sword' }, choices: [
    { id: 'learn', label: '为后来的行人开阶', description: '额外花五年、消耗三十五灵石，得星河截流经。', cost: { years: 5, spirit: 35 }, result: '你截开一线星流，让石阶显出边缘。老剑仙终于起身，去做下一个过路人。', effects: { itemId: 'star-sword-art', renown: 3 } },
    { id: 'leave', label: '绕道完整的天阶', description: '不花额外资源，不强闯星河。', result: '老剑仙指给你另一条路，那条路同样通向山上。' },
  ] },
  { id: 'celestial-body-anvil', worldId: 'celestial', title: '天工落下的锤', tag: '体修 · 大成', body: '天工试锤，要人扶稳未冷的砧座。他先把护具递给你，然后才开口谈报酬。', requires: { pathId: 'body' }, choices: [
    { id: 'brace', label: '承住七锤余势', description: '额外花四年、损失五十气血，得天工砧。', cost: { years: 4, hp: 50 }, result: '七声锤响过去，天工将砧角磨成护心铁。你掌心的麻意很久才消。', effects: { itemId: 'sky-anvil', cultivation: 30 } },
    { id: 'leave', label: '放下护具婉谢', description: '不花额外资源，不承受试锤。', result: '天工把砧重新垫稳，叫来下一位愿意试的人。' },
  ] },
  { id: 'celestial-alchemy-sun', worldId: 'celestial', title: '九曜炉外', tag: '丹修 · 大成', body: '炉火轮转，九位丹师各守一曜。缺的那一席不问门第，只问你是否肯为前人的差错重新试火。', requires: { pathId: 'alchemy' }, choices: [
    { id: 'join', label: '守缺席的一曜火', description: '额外花五年、六份药材、二十五灵石，得九曜炉心法与四十五修为。', cost: { years: 5, herbs: 6, spirit: 25 }, result: '你把一炉坏丹的过程也写入丹谱。九人第一次在失败那页共同落了名字。', effects: { itemId: 'sun-furnace', cultivation: 45, flag: 'nine-suns' } },
    { id: 'leave', label: '先在炉外旁观', description: '不花额外资源，不接守火之任。', result: '丹师把炉谱翻向你，旁观也不必低人一等。' },
  ] },
  { id: 'celestial-rain-cup', worldId: 'celestial', title: '雨师遗盏', tag: '天界 · 药器', body: '雨师的旧盏寄放在无主亭。亭旁的规矩很短：取得它的人，先替下界送完这一场雨。', choices: [
    { id: 'rain', label: '替旱地行雨', description: '额外花三年、消耗三十灵石，得雨师玉盏。', cost: { years: 3, spirit: 30 }, result: '云散后盏底空了。下界田埂上，孩子们正追着泥水跑。', effects: { itemId: 'jade-cup', merit: 3 } },
    { id: 'leave', label: '留盏待有缘人', description: '不花额外资源，离开亭子。', result: '一朵小云还停在盏口，静静等着风。' },
  ] },
  { id: 'celestial-star-map', worldId: 'celestial', title: '没有主星的星盘', tag: '天界 · 灵物', body: '观星官说，这张星盘算不出谁会称王。也因此，多年没有人肯买。', choices: [
    { id: 'buy', label: '买一张只指路的星盘', description: '消耗五十灵石，获得无极星盘。', cost: { spirit: 50 }, result: '你没有问自己的主星在哪里。观星官把最清楚的航路重新描了一遍。', effects: { itemId: 'star-compass' } },
    { id: 'chart', label: '以观测换取一份星盘', description: '额外花六年，获得同一件无极星盘；节省灵石，但耗费更多寿元。', cost: { years: 6 }, result: '你在六次星季里补齐暗星的位置。那份星盘终于也有你亲手画下的航线。', effects: { itemId: 'star-compass' } },
    { id: 'leave', label: '记住今夜星位', description: '不花额外资源，不购星盘。', result: '星光没有因为你不买而变暗。' },
  ] },
  { id: 'celestial-sheath', worldId: 'celestial', title: '劫灰里的一只剑鞘', tag: '天界 · 险取', body: '劫云已散，灰中还有未熄的火。取鞘者必须用自己的生机稳住它，不能借给旁人承受。', choices: [
    { id: 'take', label: '付命损封住劫火', description: '增加六年命损、不推进世界年份，消耗二十灵石，获得劫灰剑鞘。', cost: { lifeDamage: 6, spirit: 20 }, result: '火在鞘中熄成一条暗红细线。那六年生机不再归你，剑鞘则从此安稳。', effects: { itemId: 'ashen-sheath' } },
    { id: 'leave', label: '远离尚热的劫灰', description: '不花额外资源，不承担封火之价。', result: '你在灰堆外立了一块提醒来人的小石。' },
  ] },
  { id: 'celestial-archive', worldId: 'celestial', title: '天书也有涂改', tag: '天界 · 问道', body: '藏书阁最旧的天规上，满是后来的批注。掌书人递来一支笔，说不必假装古人从未犯错。', choices: [
    { id: 'annotate', label: '查证后添一条批注', description: '额外花四年，得六十修为。', cost: { years: 4 }, result: '你引用了人间的井、忘川的桥，没有写自己的尊号。批注因此很短，也很清楚。', effects: { cultivation: 60, renown: 2 } },
    { id: 'leave', label: '合卷，日后再读', description: '不花额外资源，不作未证实的批注。', result: '笔放回原处，旧纸上仍留着后来人的空白。' },
  ] },
  { id: 'celestial-cloud-orchard', worldId: 'celestial', title: '云上果园', tag: '天界 · 收成', body: '仙果不是吃了便能长生。园丁把药性与禁忌都写在篮上，请人帮忙收下这季成熟的果。', choices: [
    { id: 'harvest', label: '照药性分拣果实', description: '额外花二年，得八份药材与二十灵石。', cost: { years: 2 }, result: '园丁把属于你的那篮称足，另外送了一张不会写在仙家传说里的注意事项。', effects: { herbs: 8, spirit: 20 } },
    { id: 'leave', label: '不取果实，走过园边', description: '不花额外资源，继续旅程。', result: '云影掠过果树，没有一颗果实急着坠落。' },
  ] },
  { id: 'celestial-lost-child', worldId: 'celestial', title: '仙童问人间', tag: '天界 · 烟火', body: '生在天界的孩子不懂雨为什么会使人高兴。你知道答案不在一段玄言里。', choices: [
    { id: 'tell', label: '讲完一季耕种的故事', description: '额外花一年，得三十六修为与两点善名。', cost: { years: 1 }, result: '孩子终于问：那下雨前，大家是不是都很担心？你点头，故事才算讲到了人间。', effects: { cultivation: 36, merit: 2 } },
    { id: 'leave', label: '请他有一天亲自去看', description: '不花额外资源，留下一个方向。', result: '孩子望向云下，把“有一天”认真记了下来。' },
  ] },
  { id: 'celestial-empty-throne', worldId: 'celestial', title: '共主座前的影子', tag: '天界 · 试心', body: '空座映出一个已经胜利的你，连众人欢呼都十分真切。守座人问，你肯不肯先付代价，把幻景当成奖赏。', requires: { minRealm: 5 }, choices: [
    { id: 'break', label: '用本心照破幻景', description: '额外花二年；成功率八成，得七十修为、四十灵石；失败损失四十气血。', cost: { years: 2 }, chance: 0.8, result: '你看见座下仍有人没有站起。幻景碎去，真正的路还在前面。', effects: { cultivation: 70, spirit: 40 }, failure: { text: '你迟了一瞬才发现欢呼里没有呼吸。幻景反噬，空座依然沉默。', effects: { hp: -40 } } },
    { id: 'leave', label: '不领取尚未赢得的结局', description: '不花额外资源，转身离开幻景。', result: '欢呼声在身后停下。你的脚步仍是自己的。' },
  ] },
  { id: 'celestial-rest-pavilion', worldId: 'celestial', title: '白云借宿', tag: '天界 · 休憩', body: '云亭主人只收修缮屋檐的工钱。墙上写着：仙人也可以疲惫，不必假装。', choices: [
    { id: 'rest', label: '借宿并修好屋檐', description: '额外花二年、消耗十二灵石，恢复九十气血。', cost: { years: 2, spirit: 12 }, result: '你睡得很沉。醒来时新补的屋檐正好挡住一场小雨。', effects: { hp: 90 } },
    { id: 'leave', label: '谢过主人继续赶路', description: '不花额外资源，不作停留。', result: '主人送你到门外，提醒下一段云阶有些滑。' },
  ] },
  { id: 'celestial-city-record', worldId: 'celestial', title: '天榜没有这座城', tag: '因果 · 见证', body: '功德榜记着征服者的疆域，却漏了前世被你救下的长宁。城民如今的日常，比榜上所有数字都具体。', requires: { worldFlag: 'saved-city', notFlag: 'saved-city-now' }, choices: [
    { id: 'record', label: '把无名城民写进榜中', description: '额外花三年、消耗二十灵石，得四十五修为与五点声望。', cost: { years: 3, spirit: 20 }, result: '你写下摆渡者、补堤者和守灯人的名字。最后才发现，整张榜已经不需要一个领头的尊号。', effects: { cultivation: 45, renown: 5, legacyId: 'city-oath' } },
    { id: 'leave', label: '让城市继续自己的生活', description: '不花额外资源，不与天榜争名。', result: '云下的灯火仍在，榜单并没有资格决定它是否值得。' },
  ] },
  { id: 'celestial-last-letter', worldId: 'celestial', title: '未封口的请战书', tag: '天界 · 临行', body: '三界共主的使者递来空白请战书。没有人能替你填上准备好了这几个字。', requires: { minRealm: 5 }, choices: [
    { id: 'prepare', label: '核对行囊，再抄一次归途', description: '额外花二年，恢复六十气血、得二十灵石；此处不会直接进入终局战斗。', cost: { years: 2 }, result: '你把每件器物放回触手可及之处。请战书仍未封口，最后的决定留给清醒的自己。', effects: { hp: 60, spirit: 20 } },
    { id: 'leave', label: '收好空白请战书', description: '不花额外资源，回到天界道路。', result: '使者没有催促。能走到此处的人，应当知道如何选择自己的时刻。' },
  ] },
];

export const ENEMIES = [
  { id: 'valley-sentinel', name: '旧炉守阵甲傀', worldId: 'mortal', intent: '封禁阵器，最多交锋三回合；第三回合强击，撤退可从塌口入炉，无普通掉落。', hp: 54, attack: 13, defense: 2 },
  { id: 'reed-bandit', name: '苇荡劫修', description: '躲在荒渡的散修，第三回合会以蓄力劈斩压人。', hp: 95, attack: 19, defense: 3, intent: '蓄力劈斩', worldId: 'mortal' },
  { id: 'stone-wolf', name: '石脊妖狼', description: '以石甲护背的妖兽，冲锋前会明显压低身形。', hp: 120, attack: 22, defense: 5, intent: '伏身扑击', worldId: 'mortal' },
  { id: 'mortal-warden', name: '镇岳守道人', description: '他不拦人飞升，只试来者能否守住脚下之土。胜者获人间道证。', hp: 240, attack: 32, defense: 8, intent: '镇岳重掌', worldId: 'mortal' },
  { id: 'paper-ghost', name: '执伞纸魇', description: '借他人恐惧成形的纸影，伞面合拢时将施重击。', hp: 220, attack: 40, defense: 12, intent: '合伞穿心', worldId: 'nether' },
  { id: 'river-beast', name: '忘川伏兽', description: '从沉没的念头中生出的兽，翻身时会掀起暗潮。', hp: 275, attack: 45, defense: 15, intent: '翻身暗潮', worldId: 'nether' },
  { id: 'nether-warden', name: '九渡司命', description: '掌渡者要你证明，活人也能承受亡者的重量。胜者获幽冥道证。', hp: 520, attack: 60, defense: 19, intent: '九渡断流', worldId: 'nether' },
  { id: 'cloud-sentinel', name: '云阶甲士', description: '循旧令巡阶的天兵，起盾后将用长戟重落。', hp: 390, attack: 65, defense: 24, intent: '长戟落星', worldId: 'celestial' },
  { id: 'star-hawk', name: '逐星玄隼', description: '翼端裹着星屑，盘旋两次后的俯冲最为凶险。', hp: 350, attack: 70, defense: 21, intent: '坠星俯冲', worldId: 'celestial' },
  { id: 'celestial-warden', name: '执律天君', description: '天律化身的守证者。越过他，才有资格以自己的尺度问天。', hp: 820, attack: 82, defense: 29, intent: '天衡裁断', worldId: 'celestial' },
  { id: 'three-world-sovereign', name: '三界共主 · 无妄', description: '把三界安稳维系于一人意志的旧主。他承认你的来路，却不会主动让出未来。', hp: 1500, attack: 125, defense: 55, intent: '三界归一', worldId: 'celestial' },
];

export const CHALLENGES = [
  { id: 'mortal-proof', name: '人间道证', description: '筑基可试。战胜镇岳守道人，留下跨世保留的人间道证。', worldId: 'mortal', minRealm: 1, enemyId: 'mortal-warden', proofId: 'mortal' },
  { id: 'nether-proof', name: '幽冥道证', description: '元婴可试。战胜九渡司命，留下跨世保留的幽冥道证。', worldId: 'nether', minRealm: 3, enemyId: 'nether-warden', proofId: 'nether' },
  { id: 'celestial-proof', name: '天界道证', description: '化神可试。战胜执律天君，留下跨世保留的天界道证。', worldId: 'celestial', minRealm: 4, enemyId: 'celestial-warden', proofId: 'celestial' },
  { id: 'finale', name: '百世问鼎', description: '登仙且集齐三界道证后，挑战三界共主。获胜即完成本作终局。', worldId: 'celestial', minRealm: 5, enemyId: 'three-world-sovereign', proofId: null, final: true },
];
