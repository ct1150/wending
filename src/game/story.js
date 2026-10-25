import { STORY_SCENES, STORY_SIDE_SCENES, STORY_PEOPLE, STORY_ROUTES, STORY_ARCS, STORY_FLAGS, STORY_OUTCOMES, STORY_RESULTS } from './story-content.js';

const clone = value => structuredClone(value);
const unique = list => [...new Set(list)];
const allScenes = [...STORY_SCENES, ...STORY_SIDE_SCENES];
const sceneById = id => allScenes.find(scene => scene.id === id);
const has = (story, flag) => story.flags.includes(flag);
const fullCount = story => Object.values(story.clues).filter(level => level === 'full').length;
const outcomeById = id => STORY_OUTCOMES.find(outcome => outcome.id === id);
const displayedOutcome = story => story.outcomeId === 'unfinished' && story.arc !== 'old-fire' ? {
  ...outcomeById('unfinished'), title: '后世任务未竟',
  paragraphs: ['此生没能完成新一轮药谷事务。前世已定的谷地归属、灵种存毁和公开证据保持原样；未签成的新约也不会被当作已经兑现。', '后来的人仍能承接这桩具体委托，从医馆配额、药庄契约或迁民药园继续，不会把已死的人或已毁的灵种重新变回来。'],
  worldChange: '后世任务未竟，保留既定谷地与灵种事实；新委托留待后来的人，未执行的选项不发奖励。',
} : outcomeById(story.outcomeId);
const earlyScenes = ['YG01', 'YG02', 'YG03', 'YG04', 'YG05', 'YG06', 'YG07', 'YG08', 'YG09', 'SIDE0', 'SIDE1', 'SIDE2'];
const MAIN_ENTRIES = { testimony: 'YG04', ledger: 'YG06', channel: 'YG08' };
const WORLD_FACT_KEYS = ['valleyOutcome', 'publicTruth', 'survivorLine', 'seedCustodian', 'unpaidPromise', 'evidence', 'supplyDebt', 'graveMoved'];
const worldFacts = world => Object.fromEntries(WORLD_FACT_KEYS.map(key => [key, clone(world[key])]));
const emptyFacts = () => ({ valleyOutcome: null, publicTruth: false, survivorLine: 'unknown', seedCustodian: 'unknown', unpaidPromise: false, evidence: [], supplyDebt: false, graveMoved: false });
const factsEqual = (left, right) => WORLD_FACT_KEYS.every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
function settledFacts(story, before, interrupted) {
  const facts = story.arc === 'old-fire' ? emptyFacts() : clone(before);
  const outcome = outcomeById(story.outcomeId);
  if (story.arc === 'old-fire' || !interrupted) {
    facts.valleyOutcome = outcome.valley;
    facts.seedCustodian = { open_clinic: 'clinic', sect_estate: 'sect', ash_refuge: 'destroyed' }[outcome.valley];
  }
  if (story.arc === 'old-fire') {
    facts.publicTruth = has(story, 'publicTruth');
    facts.evidence = STORY_ROUTES.filter(id => story.clues[id] !== 'none');
    facts.survivorLine = has(story, 'rescued') ? 'safe' : has(story, 'familyInjured') || has(story, 'promiseProtect') ? 'injured' : 'unknown';
    facts.unpaidPromise = has(story, 'promiseProtect') && !has(story, 'rescued');
    facts.graveMoved = has(story, 'graveMoved');
  }
  if (story.outcomeId === 'clinic_sect_debt') facts.supplyDebt = true;
  return facts;
}

const CHAPTERS = ['入谷查旧火', '担责与救援', '灵种与后来人'];
const SUCCESSORS = { shen_zhi: '沈芷的继任医者', lu_huai: '陆槐一脉的继任执事', wen_du: '温家的后人' };
function participantsAt(world, year) {
  return world ? STORY_PEOPLE.filter(person => world.npcDeathYears[person.id] !== null && world.npcDeathYears[person.id] <= year) : [];
}
function participantText(text, world, year) {
  const deceased = participantsAt(world, year);
  let updated = text;
  for (const person of deceased) updated = updated.replaceAll(person.name, SUCCESSORS[person.id]);
  if (deceased.some(person => person.id === 'shen_zhi')) updated = updated.replaceAll('我娘', '沈蘅').replaceAll('她母亲', '前医者母亲');
  return updated;
}


export function createStoryWorld(meta) {
  const inherited = meta.worldFlags.includes('medicine-valley');
  return {
    valleyOutcome: inherited ? 'open_clinic' : null,
    resolvedYear: inherited ? meta.worldYear : null,
    resolvedGeneration: inherited ? meta.generation : null,
    publicTruth: false, survivorLine: 'unknown', seedCustodian: inherited ? 'clinic' : 'unknown',
    unpaidPromise: false, evidence: [], supplyDebt: false, graveMoved: false,
    npcBirthYears: Object.fromEntries(STORY_PEOPLE.map(person => [person.id, meta.worldYear - person.age])),
    npcDeathYears: Object.fromEntries(STORY_PEOPLE.map(person => [person.id, null])),
    records: [],
  };
}
export function createStory(state) {
  const valley = state.meta.storyWorld.valleyOutcome;
  const arc = valley === 'open_clinic' ? 'clinic' : valley === 'sect_estate' ? 'estate' : valley === 'ash_refuge' ? 'refuge' : 'old-fire';
  const sceneId = { 'old-fire': 'YG01', clinic: 'G2A01', estate: 'G2B01', refuge: 'G2C01' }[arc];
  const side = state.rng % 3;
  return {
    arc, sceneId, startYear: state.meta.worldYear, deadlineYear: state.meta.worldYear + 8,
    flags: [], met: [], relationships: { shen_zhi: 0, lu_huai: 0, wen_du: 0 },
    clues: { testimony: 'none', ledger: 'none', channel: 'none' }, routes: [], investigations: 0,
    visited: [sceneId], choices: [], journal: [], lastResult: null, pendingCombat: null,
    status: 'active', outcomeId: null, settled: false, sideIds: [side, (side + 1) % 3], sideIndex: 0, returnSceneId: null,
  };
}
export function syncStoryClock(story, year) {
  if (!story || story.status !== 'active' || story.arc !== 'old-fire' || year < story.deadlineYear || !earlyScenes.includes(story.sceneId)) return story;
  const next = clone(story);
  next.sceneId = 'YG10'; next.returnSceneId = null;
  next.visited = unique([...next.visited, 'YG10']);
  next.lastResult = { title: '封谷最后一夜', text: '八年期限已经过去，封谷石料到了山口。未走完的调查只能留下现有记录；现在先对质、救人，再决定交种或焚种，不会把谷民困在无法支付的门槛前。', changes: ['停止新调查', '救援改用当夜代价'] };
  next.journal.push({ title: next.lastResult.title, text: next.lastResult.text, year });
  return next;
}
export function ageStoryWorld(world, year) {
  const next = clone(world);
  for (const person of STORY_PEOPLE) {
    const naturalEnd = next.npcBirthYears[person.id] + person.life;
    if (next.npcDeathYears[person.id] === null && year >= naturalEnd) next.npcDeathYears[person.id] = naturalEnd;
  }
  return next;
}
function remainingLife(state) {
  // The engine supplies the authoritative value; callers outside the engine can
  // omit it when only deriving narrative metadata, never when choosing.
  return state.remainingLife;
}
export function storyChoiceCost(state, choice) {
  const story = state.story, cost = { ...(choice.cost ?? {}) }, emergency = state.meta.worldYear >= story.deadlineYear;
  if (choice.id === 'treat_wen' && state.run.pathId === 'alchemy') cost.herbs = 1;
  if (choice.id === 'pay_rescue' && emergency) { cost.spirit = 22; cost.years = 0; }
  if (choice.id === 'carry_rescue') {
    cost.hp = state.run.pathId === 'body' ? 12 : 22;
    if (emergency) { cost.years = 0; cost.lifeDamage = 2; }
  }
  if (choice.id === 'wen_tunnel' && has(story, 'wenMedicine')) cost.herbs = 0;
  if (choice.id === 'stabilize_herbs') cost.herbs = 3 - Number(has(story, 'warmFormula')) + Number(has(story, 'cutRoot'));
  if (choice.clinic) {
    if (has(story, 'sectAid')) cost.spirit = 8;
    if (story.clues.channel !== 'full') cost.lifeDamage = 3;
  }
  if (choice.id === 'buy_medicine') cost.spirit = 18 - (has(story, 'memberPriority') ? 4 : 0) + (state.meta.storyWorld.supplyDebt ? 4 : 0);
  if (story.sceneId === 'G2B02' && has(story, 'workerMandate')) {
    if (cost.spirit) cost.spirit = Math.max(0, cost.spirit - 4);
    if (cost.herbs) cost.herbs = Math.max(0, cost.herbs - 1);
    if (cost.hp) cost.hp = Math.max(0, cost.hp - 4);
  }
  if (story.sceneId === 'G2C02' && choice.id !== 'small_garden') {
    if (has(story, 'keptMap')) cost.years = Math.max(0, (cost.years ?? 0) - 1);
    if (state.meta.storyWorld.unpaidPromise && !has(story, 'debtRepaired')) {
      if (cost.spirit) cost.spirit += 4;
      if (cost.herbs) cost.herbs += 1;
      if (cost.hp) cost.hp += 4;
      if (cost.lifeDamage) cost.lifeDamage += 1;
    }
  }
  if (choice.restOfLife) cost.years = remainingLife(state);
  return cost;
}
function choiceReason(state, choice, cost) {
  const story = state.story, world = state.meta.storyWorld;
  if (state.phase !== 'adventure') return '请先完成当前际遇或战斗。';
  if (state.run.worldId !== 'mortal') return '剧情在药谷所在的人间；返回人间后可继续。';
  if (story.status === 'failed' || (story.status === 'resolved' && !['YG15', 'YG16'].includes(story.sceneId))) return '本世剧情已结算。';
  if (choice.pathId && choice.pathId !== state.run.pathId) return '此解法只适合对应流派。';
  if (choice.route && (story.routes.includes(choice.route) || story.investigations >= 2)) return story.routes.includes(choice.route) ? '此线已访问，不可重复领取。' : '本世最多充分追查两条调查线。';
  if (choice.route && state.meta.worldYear >= story.deadlineYear) return '封谷期限已到，请先处理最后一夜。';
  if (choice.deadlineOnly && state.meta.worldYear < story.deadlineYear) return '封谷尚未到期，请先完成一条调查。';
  if (choice.minInvestigations && story.investigations < choice.minInvestigations) return '至少先走一条调查线。';
  if (choice.requireFlag && !has(story, choice.requireFlag)) return '尚未取得所需经历或承诺。';
  if (choice.fullClues && fullCount(story) < choice.fullClues) return `需要${choice.fullClues}条相互独立的完整证据。`;
  if (choice.anyClue && !Object.values(story.clues).some(level => level !== 'none')) return '尚无可核对的完整或残缺证据。';
  if (choice.luOpen && (!has(story, 'luGuarantee') || has(story, 'brokeLock') || has(story, 'brokePromise'))) return '陆槐尚不愿担保，或你曾闯库、违反遮去无关住址的承诺。';
  if (choice.wenOpen && !['treated', 'promiseProtect', 'rescued'].every(flag => has(story, flag))) return '需治疗温渡、许下保护并实际救出家属。';
  if (choice.clinic) {
    if (has(story, 'sectDeal') || has(story, 'sectStabilized')) return '已依赖接管交易稳种，只可接管或反悔焚种。';
    if (!(fullCount(story) >= 2 || (story.clues.channel === 'full' && story.relationships.shen_zhi >= 1))) return '需两条完整证据，或完整地脉图与沈芷的信任。';
  }
  if (choice.priorPublic && !world.publicTruth) return '前世没有公开足够旧证。';
  if (choice.priorEvidence && (!world.evidence.length || world.publicTruth)) return '此入口只适用于前世留有私存证据、尚未公开的历史。';
  if (choice.priorBroken && !world.unpaidPromise) return '历史中没有这项未兑现的护家承诺。';
  if (choice.priorKept && world.survivorLine !== 'safe') return '历史没有记载温家平安获救的地形图。';
  if (choice.fullNegotiation && (!(has(story, 'negotiationProof') || has(story, 'workerMandate')) || has(story, 'demandGraves'))) return '需完整谈判证据或代表授权，且本次诉求包括供药。';
  if (choice.supplyOnly && has(story, 'demandGraves')) return '本次只承诺祭扫，不能临时替药工扩大诉求。';
  for (const [key, label] of [['spirit', '灵石'], ['herbs', '药材']]) if (state.run[key] < (cost[key] ?? 0)) return `${label}不足，需要${cost[key]}。`;
  if (state.run.hp <= (cost.hp ?? 0)) return `气血不足，须保留至少1点气血；此项需${cost.hp ?? 0}。`;
  if (cost.lifeDamage && remainingLife(state) <= cost.lifeDamage + (cost.years ?? 0)) return '余寿不足以承担命损并活着完成此项。';
  return '';
}
function costText(cost, state, choice) {
  const parts = [cost.years ? `耗时${cost.years}年` : '不耗年'];
  for (const [key, label] of [['spirit', '灵石'], ['herbs', '药材'], ['hp', '气血'], ['lifeDamage', '年余寿（命损）']]) if (cost[key]) parts.push(`${cost[key]}${label}`);
  if (state.story.arc === 'old-fire' && state.story.status === 'active') parts.push(`完成后距封谷${Math.max(0, state.story.deadlineYear - state.meta.worldYear - (cost.years ?? 0))}年`);
  if (choice.combat) parts.push('最多三回合 · 无普通战利品 · 燃寿有致命风险');
  return parts.join(' · ');
}
export function storyChoices(state) {
  if (!state.story) return [];
  const scene = sceneById(state.story.sceneId);
  if (!scene || state.story.pendingCombat || has(state.story, 'free')) return [];
  if (state.story.status !== 'active' && !['YG15', 'YG16'].includes(scene.id)) return [];
  if (scene.id === 'YG16' && state.story.choices.some(row => row.sceneId === 'YG16')) return [];
  return scene.choices.map(choice => {
    const cost = storyChoiceCost(state, choice), reason = choiceReason(state, choice, cost);
    return { ...choice, cost, costText: costText(cost, state, choice), enabled: !reason, reason };
  });
}
function resultText(story, choice, world, year) {
  if (choice.id === 'carry_rescue' && participantsAt(world, year).some(person => person.id === 'wen_du')) return '最窄的山路上，你把背上的人交给接应者，再去接第二个。最后一双湿鞋踏上船板时，温家的后人合起旧掌闸人的记录，低声说：“旧簿记着从前开门时的伤亡；这一次，人都出去了。”';
  if (STORY_RESULTS[choice.id]) return STORY_RESULTS[choice.id];
  if (choice.outcome) return outcomeById(choice.outcome).worldChange;
  if (choice.clue) return `你将${{ testimony: '温渡证词', ledger: '旧库药账', channel: '地脉勘验' }[choice.clue[0]]}按${choice.clue[1] === 'full' ? '完整' : '残缺'}证据留档。${choice.description}所得事实与未能证实的部分分别记录，不会因回到灯下就重新领取。`;
  if (choice.route) return `你选择了${{ testimony: '南坡石屋的证人', ledger: '归衡旧库的药账', channel: '地下药渠的地脉' }[choice.route]}这条路。调查名额已记下，尚未走的地方仍然未知；这不是可以反复重走领取报酬的差事。`;
  return `你决定${choice.label.replace(/^(剑修|体修|丹修)：/, '')}。${choice.description}这一步和它所付的代价已记入本世药簿；接下来的人会依据真正发生过的经历回应你。`;
}
function derivedOutcome(story, kind) {
  if (kind === 'clinic') return has(story, 'sectDebt') ? 'clinic_sect_debt' : has(story, 'rationed') ? 'clinic_rationed' : has(story, 'openAccounts') ? 'clinic_open_council' : 'clinic_keeper_rule';
  if (kind === 'estate') return has(story, 'fixedMinimum') ? 'estate_shared_supply' : 'estate_grave_access';
  return has(story, 'sharedGarden') ? 'refuge_common_medicine' : has(story, 'familyGarden') ? 'refuge_family_medicine' : 'refuge_small_plot';
}
export function advanceStory(story, choice, year, world = null) {
  const next = clone(story), origin = next.sceneId;
  next.choices.push({ sceneId: origin, choiceId: choice.id, year });
  next.met = unique([...next.met, ...(choice.meet ?? [])]);
  for (const [id, amount] of Object.entries(choice.relations ?? {})) next.relationships[id] = Math.max(-2, Math.min(2, next.relationships[id] + amount));
  let flags = choice.flags ?? [];
  if (choice.id === 'seize_original' && !has(next, 'promiseRedact')) flags = [];
  if (['give_medicine', 'pay_doctor'].includes(choice.id) && !next.met.includes('wen_du')) flags = [];
  next.flags = unique([...next.flags, ...flags]);
  if (choice.clue) next.clues[choice.clue[0]] = choice.clue[1];
  if (choice.route) { next.routes.push(choice.route); next.investigations = next.routes.length; }
  if (origin === 'YG04') next.met = unique([...next.met, 'wen_du']);
  const changes = [];
  for (const [key, value] of Object.entries(choice.cost ?? {})) if (value) changes.push(`${{ years: '经过年数', spirit: '灵石', herbs: '药材', hp: '气血', lifeDamage: '命损' }[key]}${key === 'years' || key === 'lifeDamage' ? '+' : '-'}${value}`);
  for (const [key, value] of Object.entries(choice.effects ?? {})) if (value) changes.push(`${{ herbs: '药材', spirit: '灵石', merit: '善名' }[key] ?? key}+${value}`);
  next.lastResult = { title: participantText(choice.label, world, year), text: participantText(resultText(next, choice, world, year), world, year), changes };
  next.journal.push({ title: next.lastResult.title, text: next.lastResult.text, year });
  next.journal = next.journal.slice(-80);
  if (choice.outcome || choice.outcomeFrom) { next.outcomeId = choice.outcome ?? derivedOutcome(next, choice.outcomeFrom); next.status = 'resolved'; }
  if (choice.combat) next.pendingCombat = { sceneId: origin, enemyId: choice.combat };
  else if (origin.startsWith('SIDE')) {
    next.flags = unique([...next.flags, `side${origin.at(-1)}`]);
    next.sceneId = next.returnSceneId; next.returnSceneId = null;
  } else if (choice.next) {
    next.sceneId = choice.next;
    if (choice.route && next.sideIndex < 2) {
      next.returnSceneId = MAIN_ENTRIES[choice.route];
      next.sceneId = `SIDE${next.sideIds[next.sideIndex]}`; next.sideIndex++;
    }
  }
  next.visited = unique([...next.visited, next.sceneId]);
  return next;
}
export function resumeStoryCombat(story, result, year) {
  if (!story?.pendingCombat) return story;
  const next = clone(story);
  next.pendingCombat = null; next.sceneId = 'YG13'; next.visited = unique([...next.visited, 'YG13']);
  next.lastResult = {
    title: result === 'win' ? '炉门已开' : '从塌口入炉',
    text: result === 'win' ? '甲傀的灵火熄下去，炉门开出一道可通过的缝。你没有拿到普通战利品，只让等在阵外的人平安进来；眼前真正要决定的，仍是活种与谷地的未来。' : '你撤出旧阵，雨水冲松的侧壁却露出塌口。众人从塌口进入炉底；证据原件还在，撤退有实际代价，但不会把主线困在必须再次战斗的门前。',
    changes: result === 'win' ? ['无普通战斗掉落'] : ['撤退损失已按战斗规则支付'],
  };
  next.journal.push({ title: next.lastResult.title, text: next.lastResult.text, year });
  return next;
}
export function settleStory(story, world, generation, year, interrupted = false) {
  if (!story || story.settled) return null;
  if (!interrupted && story.status !== 'resolved') return null;
  const next = clone(story), memory = clone(world);
  if (interrupted) {
    next.status = 'failed'; next.outcomeId = 'unfinished'; next.pendingCombat = null; next.returnSceneId = null;
    next.lastResult = { title: '药谷未竟', text: displayedOutcome(next).paragraphs.join(''), changes: ['未竟结果写入世界', '未执行选项不发奖励'] };
    next.journal.push({ title: next.lastResult.title, text: next.lastResult.text, year });
  }
  next.settled = true;
  // Settlement and validation share the same permitted fact transition.
  // Interrupted sequels retain the preceding valley and destroyed/live seed.
  Object.assign(memory, settledFacts(next, worldFacts(world), interrupted));
  memory.resolvedYear = year; memory.resolvedGeneration = generation;
  memory.records.push({ generation, year, arc: next.arc, outcomeId: next.outcomeId, facts: worldFacts(memory) });
  memory.records = memory.records.slice(-50);
  return { story: next, world: memory, outcome: displayedOutcome(next) };
}
export function storyView(state) {
  const story = state.story;
  if (!story) return null;
  const scene = sceneById(story.sceneId), world = state.meta.storyWorld;
  const baseOutcome = displayedOutcome(story);
  const settledYear = world.records.find(row => row.generation === state.meta.generation)?.year ?? state.meta.worldYear;
  const outcome = baseOutcome && story.arc === 'old-fire' ? { ...baseOutcome, paragraphs: baseOutcome.paragraphs.map(text => participantText(text, world, settledYear)) } : baseOutcome;
  let paragraphs = [...scene.paragraphs];
  if (scene.id === 'YG15' && outcome) paragraphs = [...outcome.paragraphs];
  if (scene.id === 'YG09') for (const [id, sentence] of Object.entries({ testimony: '温渡说火先从东闸回来。', ledger: '账册显示药窖启用晚于失火。', channel: '地脉图指出旧图遗漏了改过的药渠。' })) if (story.clues[id] !== 'none') paragraphs.push(`${sentence}${story.clues[id] === 'partial' ? '目前只有残证，尚不能冒称完整。' : '已有完整勘验记录。'}`);
  if (state.meta.worldYear >= story.deadlineYear && story.arc === 'old-fire' && story.status === 'active') paragraphs.unshift('封谷期限已过：这是最后一夜。再不能花多年重查，救援改用当夜代价，交种或焚种仍有退路。');
  const people = STORY_PEOPLE.filter(person => story.met.includes(person.id) || story.arc !== 'old-fire').map(person => {
    const death = world.npcDeathYears[person.id], age = state.meta.worldYear - world.npcBirthYears[person.id];
    return { id: person.id, name: person.name, role: person.role, status: death !== null ? `已故于${death}年；后世由其弟子/后人承接职责` : `${age}岁，在世`, relationship: story.relationships[person.id] };
  });
  if (story.arc !== 'old-fire') {
    const shen = people.find(person => person.id === 'shen_zhi');
    paragraphs = paragraphs.map(text => text.replace('若沈芷仍活着，她让你先看病，不问你为何携着旧叶印；若她已经故去，继任者递来她留下的批注：', shen.status.includes('已故') ? '沈芷已经故去，继任者递来她留下的批注：' : '沈芷仍在，她让你先看病，又指着自己留下的批注：'));
    paragraphs.push('今世的你是后来人；遗书和见证物只传递旧事，不让你成为前世的同一个人。' + (world.unpaidPromise ? '旧护家承诺曾经落空，这一事实不会因为轮回被抹去。' : world.survivorLine === 'safe' ? '旧记录写着温家平安获救，排水图仍在。' : '药簿只记录实际留存的往事，没有凭空补写相识。'));
  }
  if (story.arc === 'old-fire' && story.status === 'active') {
    const deceased = STORY_PEOPLE.filter(person => world.npcDeathYears[person.id] !== null);
    if (deceased.length) {
      paragraphs = paragraphs.map(text => participantText(text, world, state.meta.worldYear));
      paragraphs.unshift(`岁月已过：${deceased.map(person => `${person.name}于${world.npcDeathYears[person.id]}年故去`).join('，')}。如今由继任者按旧药簿承接未竟事务；他们依据旧案记录问责，不是死去的人再次归来。`);
    }
  } else if (story.arc === 'old-fire' && story.settled) paragraphs.unshift(`以下为${world.records.find(row => row.generation === state.meta.generation)?.year ?? world.resolvedYear}年的结局与余生记录；人物现状按眼下年份另列。`);
  const choices = storyChoices(state).map(({ id, label, description, costText, enabled, reason }) => ({ id, label: participantText(label, world, state.meta.worldYear), description: participantText(description, world, state.meta.worldYear), costText, enabled, reason: participantText(reason, world, state.meta.worldYear) }));
  return {
    id: story.arc, title: story.arc === 'old-fire' ? '药谷旧火' : { clinic: '药谷回响 · 规矩之外', estate: '药谷回响 · 两把钥匙', refuge: '药谷回响 · 凡药春天' }[story.arc],
    chapter: CHAPTERS[scene.chapter - 1], chapterIndex: scene.chapter, chapterCount: 3,
    sceneId: scene.id, sceneTitle: scene.title, location: scene.location,
    objective: story.status === 'failed' ? '本世未竟，查看留下的世界后果并准备轮回。' : scene.objective,
    paragraphs, choices, journal: clone(story.journal), people,
    clues: STORY_ROUTES.filter(id => story.clues[id] !== 'none').map(id => ({ id, title: { testimony: '温渡证词', ledger: '旧库药账', channel: '地下药渠图' }[id] + (story.clues[id] === 'full' ? ' · 完整' : ' · 残缺'), text: { testimony: '先开东闸，地火回灌；温渡的供述与护家选择分别记录。', ledger: '救疫属实，超采与旧图下令也属实；沈蘅开窖在失火之后。', channel: '药农改水渠救旱，宗门仍用旧图引火，导致热流倒灌。' }[id] })),
    lastResult: clone(story.lastResult), status: story.status,
    outcome: outcome ? { id: outcome.id, title: outcome.title, paragraphs: [...outcome.paragraphs], worldChange: story.status === 'failed' && story.arc !== 'old-fire' ? '本世后续任务未竟；前世谷地归属与灵种状态保持原样。' : outcome.worldChange } : null,
    progress: { completed: story.status === 'active' ? Math.min(story.arc === 'old-fire' ? 15 : 4, story.visited.filter(id => !id.startsWith('SIDE')).length - 1) : story.arc === 'old-fire' ? 16 : 5, total: story.arc === 'old-fire' ? 16 : 5 },
    deadlineYear: story.arc === 'old-fire' ? story.deadlineYear : null,
    yearsRemaining: story.arc === 'old-fire' && story.status === 'active' ? Math.max(0, story.deadlineYear - state.meta.worldYear) : null,
    investigations: story.investigations, maxInvestigations: 2,
    paused: state.phase !== 'adventure' || state.run.worldId !== 'mortal',
  };
}

// Reuse the engine's exact-key validators so v1 and v2 share the same trust boundary.
export function validateStoryWorld(world, meta, v) {
  const { object, integer, array, invalid } = v;
  object(world, 'meta.storyWorld', ['valleyOutcome', 'resolvedYear', 'resolvedGeneration', 'publicTruth', 'survivorLine', 'seedCustodian', 'unpaidPromise', 'evidence', 'supplyDebt', 'graveMoved', 'npcBirthYears', 'npcDeathYears', 'records']);
  if (![null, 'open_clinic', 'sect_estate', 'ash_refuge'].includes(world.valleyOutcome)) invalid('meta.storyWorld.valleyOutcome', '未知谷地结果');
  for (const key of ['publicTruth', 'unpaidPromise', 'supplyDebt', 'graveMoved']) if (typeof world[key] !== 'boolean') invalid(`meta.storyWorld.${key}`, '应为真假值');
  if (!['unknown', 'safe', 'injured'].includes(world.survivorLine) || !['unknown', 'clinic', 'sect', 'destroyed'].includes(world.seedCustodian)) invalid('meta.storyWorld', '未知人物或灵种事实');
  if (!Array.isArray(world.records)) invalid('meta.storyWorld.records', '应为有限记录列表');
  if (world.valleyOutcome === null) {
    if (world.resolvedYear !== null || world.resolvedGeneration !== null || world.seedCustodian !== 'unknown' || world.records.length || world.publicTruth || world.unpaidPromise || world.supplyDebt || world.graveMoved || world.survivorLine !== 'unknown' || !Array.isArray(world.evidence) || world.evidence.length) invalid('meta.storyWorld', '未结算谷地不能有结果事实');
  } else {
    integer(world.resolvedYear, 'meta.storyWorld.resolvedYear', 1000, meta.worldYear);
    integer(world.resolvedGeneration, 'meta.storyWorld.resolvedGeneration', 1, meta.generation);
    const expected = { open_clinic: 'clinic', sect_estate: 'sect', ash_refuge: 'destroyed' }[world.valleyOutcome];
    if (world.seedCustodian !== expected) invalid('meta.storyWorld.seedCustodian', '灵种归属与谷地结果不一致');
  }
  if (world.unpaidPromise && world.survivorLine !== 'injured') invalid('meta.storyWorld.unpaidPromise', '失约与家属事实不一致');
  array(world.evidence, 'meta.storyWorld.evidence', 3, (id, path) => { if (!STORY_ROUTES.includes(id)) invalid(path, '未知旧证'); }, true);
  object(world.npcBirthYears, 'meta.storyWorld.npcBirthYears', STORY_PEOPLE.map(person => person.id));
  object(world.npcDeathYears, 'meta.storyWorld.npcDeathYears', STORY_PEOPLE.map(person => person.id));
  for (const person of STORY_PEOPLE) {
    integer(world.npcBirthYears[person.id], `meta.storyWorld.npcBirthYears.${person.id}`, 1, meta.worldYear);
    const death = world.npcDeathYears[person.id];
    if (death !== null) {
      integer(death, `meta.storyWorld.npcDeathYears.${person.id}`, world.npcBirthYears[person.id], meta.worldYear);
      if (death !== world.npcBirthYears[person.id] + person.life) invalid('meta.storyWorld.npcDeathYears', '人物死亡年与固定寿年不一致');
    }
    if ((meta.worldYear >= world.npcBirthYears[person.id] + person.life) !== (death !== null)) invalid('meta.storyWorld.npcDeathYears', '人物寿年与死亡事实不一致');
  }
  array(world.records, 'meta.storyWorld.records', 50, (row, path) => {
    object(row, path, ['generation', 'year', 'arc', 'outcomeId', 'facts']);
    integer(row.generation, `${path}.generation`, 1, meta.generation); integer(row.year, `${path}.year`, 1000, meta.worldYear);
    object(row.facts, `${path}.facts`, WORLD_FACT_KEYS);
    if (!['open_clinic', 'sect_estate', 'ash_refuge'].includes(row.facts.valleyOutcome) || !['safe', 'injured', 'unknown'].includes(row.facts.survivorLine)) invalid(`${path}.facts`, '未知谷地或人物事实');
    if (row.facts.seedCustodian !== { open_clinic: 'clinic', sect_estate: 'sect', ash_refuge: 'destroyed' }[row.facts.valleyOutcome]) invalid(`${path}.facts.seedCustodian`, '灵种事实不一致');
    for (const key of ['publicTruth', 'unpaidPromise', 'supplyDebt', 'graveMoved']) if (typeof row.facts[key] !== 'boolean') invalid(`${path}.facts.${key}`, '应为真假值');
    array(row.facts.evidence, `${path}.facts.evidence`, 3, (id, p) => { if (!STORY_ROUTES.includes(id)) invalid(p, '未知旧证'); }, true);
    if (row.facts.unpaidPromise && row.facts.survivorLine !== 'injured') invalid(`${path}.facts`, '失约事实不一致');
    if (!STORY_ARCS.includes(row.arc) || !outcomeById(row.outcomeId)) invalid(path, '未知篇章结果');
    if (row.arc === 'old-fire' && !['open_clinic', 'sect_estate', 'ash_refuge', 'unfinished'].includes(row.outcomeId)) invalid(path, '首篇结果不一致');
    if (row.arc !== 'old-fire' && row.outcomeId !== 'unfinished' && !row.outcomeId.startsWith(row.arc + '_')) invalid(path, '后续结果不一致');
  });
  for (let i = 1; i < world.records.length; i++) if (world.records[i].generation <= world.records[i - 1].generation || world.records[i].year < world.records[i - 1].year) invalid('meta.storyWorld.records', '世界记录顺序错误');
  const last = world.records.at(-1);
  if (last && !factsEqual(last.facts, worldFacts(world))) invalid('meta.storyWorld.records', '世界事实与最近结算不一致');
  if (last && (last.generation !== world.resolvedGeneration || last.year !== world.resolvedYear || (last.outcomeId !== 'unfinished' && outcomeById(last.outcomeId).valley !== world.valleyOutcome))) invalid('meta.storyWorld.records', '最近结果与世界事实不一致');
}
export function validateStory(story, state, v) {
  if (story === null) return;
  const { object, integer, string, array, invalid } = v;
  object(story, 'story', ['arc', 'sceneId', 'startYear', 'deadlineYear', 'flags', 'met', 'relationships', 'clues', 'routes', 'investigations', 'visited', 'choices', 'journal', 'lastResult', 'pendingCombat', 'status', 'outcomeId', 'settled', 'sideIds', 'sideIndex', 'returnSceneId']);
  const scene = sceneById(story.sceneId);
  if (!STORY_ARCS.includes(story.arc) || !scene || scene.arc !== story.arc) invalid('story.sceneId', '未知场景或篇章不一致');
  integer(story.startYear, 'story.startYear', 1000, state.meta.worldYear); integer(story.deadlineYear, 'story.deadlineYear', story.startYear + 8, story.startYear + 8);
  const enums = (values, path, options, max) => array(values, path, max ?? options.length, (id, p) => { if (!options.includes(id)) invalid(p, '未知标记'); }, true);
  enums(story.flags, 'story.flags', STORY_FLAGS); enums(story.met, 'story.met', STORY_PEOPLE.map(person => person.id));
  object(story.relationships, 'story.relationships', STORY_PEOPLE.map(person => person.id));
  for (const person of STORY_PEOPLE) integer(story.relationships[person.id], `story.relationships.${person.id}`, -2, 2);
  object(story.clues, 'story.clues', STORY_ROUTES);
  for (const id of STORY_ROUTES) if (!['none', 'partial', 'full'].includes(story.clues[id])) invalid(`story.clues.${id}`, '未知证据等级');
  enums(story.routes, 'story.routes', STORY_ROUTES, 2); integer(story.investigations, 'story.investigations', 0, 2);
  if (story.investigations !== story.routes.length) invalid('story.investigations', '调查次数与已访路线不一致');
  for (const id of STORY_ROUTES) if (story.clues[id] !== 'none' && !story.routes.includes(id)) invalid('story.clues', '未访问的路线不能有证据');
  enums(story.visited, 'story.visited', allScenes.filter(row => row.arc === story.arc).map(row => row.id));
  if (!story.visited.includes(story.sceneId)) invalid('story.visited', '当前场景尚未访问');
  array(story.choices, 'story.choices', 80, (row, path) => {
    object(row, path, ['sceneId', 'choiceId', 'year']);
    const entry = sceneById(row.sceneId);
    if (!entry || entry.arc !== story.arc || !entry.choices.some(choice => choice.id === row.choiceId)) invalid(path, '未知场景选项');
    integer(row.year, `${path}.year`, story.startYear, state.meta.worldYear);
  });
  const used = story.choices.map(row => `${row.sceneId}:${row.choiceId}`);
  if (new Set(used).size !== used.length) invalid('story.choices', '剧情选项重复结算');
  for (let i = 1; i < story.choices.length; i++) if (story.choices[i].year < story.choices[i - 1].year) invalid('story.choices', '选择年份倒退');
  array(story.journal, 'story.journal', 80, (row, path) => { object(row, path, ['title', 'text', 'year']); string(row.title, `${path}.title`, 120, 1); string(row.text, `${path}.text`, 4096, 1); integer(row.year, `${path}.year`, story.startYear, state.meta.worldYear); });
  if (story.lastResult !== null) { object(story.lastResult, 'story.lastResult', ['title', 'text', 'changes']); string(story.lastResult.title, 'story.lastResult.title', 120, 1); string(story.lastResult.text, 'story.lastResult.text', 4096, 1); array(story.lastResult.changes, 'story.lastResult.changes', 12, (line, path) => string(line, path, 200)); }
  if (!['active', 'resolved', 'failed'].includes(story.status) || typeof story.settled !== 'boolean') invalid('story.status', '未知状态或结算标记');
  if (story.status === 'active' ? story.outcomeId !== null || story.settled : !outcomeById(story.outcomeId) || !story.settled) invalid('story.outcomeId', '结局与状态不一致');
  if (['ended', 'victory'].includes(state.phase) && story.status === 'active') invalid('story.status', '人生结束前必须结算剧情');
  if (story.status === 'failed' && story.outcomeId !== 'unfinished') invalid('story.status', '未竟结果不一致');
  if (story.returnSceneId !== null && (!story.sceneId.startsWith('SIDE') || !Object.values(MAIN_ENTRIES).includes(story.returnSceneId))) invalid('story.returnSceneId', '支线回接不一致');
  if (story.sceneId.startsWith('SIDE') && story.status === 'active' && story.returnSceneId === null) invalid('story.returnSceneId', '支线缺少回接');
  array(story.sideIds, 'story.sideIds', 2, (id, path) => integer(id, path, 0, 2), true);
  if (story.sideIds.length !== 2) invalid('story.sideIds', '每世应有两次有限机会');
  integer(story.sideIndex, 'story.sideIndex', 0, 2);
  if (story.pendingCombat !== null) {
    object(story.pendingCombat, 'story.pendingCombat', ['sceneId', 'enemyId']);
    if (story.pendingCombat.sceneId !== 'YG12' || story.pendingCombat.enemyId !== 'valley-sentinel' || story.sceneId !== 'YG12' || state.phase !== 'combat' || state.combat?.enemyId !== 'valley-sentinel' || state.combat?.challengeId !== null || !story.choices.some(row => row.sceneId === 'YG12' && row.choiceId === 'short_fight')) invalid('story.pendingCombat', '剧情战斗上下文不一致');
    if (state.combat.round > 3) invalid('combat.round', '剧情短战不能超过三回合');
  } else if (state.combat?.enemyId === 'valley-sentinel') invalid('story.pendingCombat', '剧情敌人缺少回接');
  // Reconstruct narrative facts from the finite choice trace. Known enums alone
  // are insufficient: a forged 'luGuarantee' or complete clue would bypass gates.
  const valleyForArc = { 'old-fire': null, clinic: 'open_clinic', estate: 'sect_estate', refuge: 'ash_refuge' }[story.arc];
  const world = state.meta.storyWorld;
  const preceding = world.records.filter(row => row.generation < state.meta.generation).at(-1);
  // The sole snapshot-free sequel source is the strictly migrated old valley.
  // Its old-case, people and promise facts stay unknown, not inferred from later copies.
  const before = story.arc === 'old-fire' ? emptyFacts() : preceding ? clone(preceding.facts) : { ...emptyFacts(), valleyOutcome: 'open_clinic', seedCustodian: 'clinic' };
  if ((story.arc === 'old-fire' && preceding) || before.valleyOutcome !== valleyForArc) invalid('story.arc', '篇章与前世真实谷地结果不一致');

  let replay = createStory({ rng: story.sideIds[0], meta: { ...state.meta, worldYear: story.startYear, storyWorld: { ...state.meta.storyWorld, valleyOutcome: valleyForArc } } });
  replay.sideIds = [...story.sideIds];
  for (const row of story.choices) {
    replay = syncStoryClock(replay, row.year);
    if (replay.pendingCombat && row.sceneId === 'YG13') replay = resumeStoryCombat(replay, 'win', row.year);
    if (replay.sceneId !== row.sceneId || replay.choices.some(prior => prior.sceneId === row.sceneId && prior.choiceId === row.choiceId)) invalid('story.choices', '场景推进与选择记录不一致');
    const choice = sceneById(row.sceneId).choices.find(entry => entry.id === row.choiceId);
    const hypothetical = { ...state, phase: 'adventure', story: replay, remainingLife: 1000000000, run: { ...state.run, worldId: 'mortal', spirit: 1000000000, herbs: 1000000000, hp: 1000000000 }, meta: { ...state.meta, worldYear: row.year, storyWorld: { ...world, ...before } } };
    const cost = storyChoiceCost(hypothetical, choice);
    if (choiceReason(hypothetical, choice, cost)) invalid('story.choices', '选择不符合当时剧情条件');
    replay = advanceStory(replay, choice, row.year, state.meta.storyWorld);
  }
  replay = syncStoryClock(replay, state.meta.worldYear);
  if (replay.pendingCombat && story.pendingCombat === null && story.sceneId === 'YG13') replay = resumeStoryCombat(replay, 'win', state.meta.worldYear);
  if (story.status === 'failed') { replay.returnSceneId = null; replay.pendingCombat = null; }
  for (const key of ['sceneId', 'flags', 'met', 'relationships', 'clues', 'routes', 'investigations', 'sideIndex', 'returnSceneId', 'pendingCombat']) if (JSON.stringify(replay[key]) !== JSON.stringify(story[key])) invalid(`story.${key}`, '与实际选择经历不一致');
  if (story.status !== 'failed' && replay.outcomeId !== story.outcomeId) invalid('story.outcomeId', '与实际结局选择不一致');
  if (story.sideIds[1] !== (story.sideIds[0] + 1) % 3) invalid('story.sideIds', '支线机会顺序错误');
  if (story.settled) {
    const entry = state.meta.storyWorld.records.find(row => row.generation === state.meta.generation);
    if (!entry || entry.arc !== story.arc || entry.outcomeId !== story.outcomeId) invalid('story.settled', '缺少本世世界结算');
    const expectedFacts = settledFacts(story, before, story.status === 'failed');
    if (!factsEqual(entry.facts, expectedFacts) || !factsEqual(world, expectedFacts)) invalid('meta.storyWorld', '本世结算事实与真实选择及前世快照不一致');
  } else {
    if (world.records.some(row => row.generation === state.meta.generation)) invalid('story.settled', '当世世界不应提前结算');
    if (!factsEqual(world, before)) invalid('meta.storyWorld', '当世尚未结算，世界事实应保持前世记录');
  }
}
