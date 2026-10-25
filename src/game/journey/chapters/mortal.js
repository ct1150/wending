// Complete authored variants keep every visible choice in its actual context.
// Helpers below expand finite tables; no callbacks or executable save content.
const item = id => ({ kind: 'item', id });
const ability = id => ({ kind: 'ability', id });
const fact = (id, value) => ({ kind: 'life-fact', id, value });
const world = (id, value) => ({ kind: 'world-fact', id, value });
const wen = status => ({ kind: 'person', id: 'wen-du', status });
const narration = text => ({ kind: 'narration', text });
const dialogue = (speaker, text) => ({ kind: 'dialogue', speaker, text });
const choice = (id, label, detail, to, result, effects = {}, extra = {}) => ({ id, label, detail, to, result, effects, ...extra });
const variant = (when, blocks, choices) => ({ when, blocks, choices });
const scene = (title, location, variants, extra = {}) => ({ title, location, variants, ...extra });
const healthy = { kind: 'injury-not', value: 'severe' };
const continueRoad = choice('continue-road', '谢过教导，继续查访。', '不学习；调查、救援与离谷都不要求任选能力。', 'mortal-pledge', '你没有留下求教。沈芷把药簿摊在你面前，先问你愿意承担哪一件事。');
const routeLabels = { witness: ['南坡石屋', '温渡的亲历'], ledger: ['归衡旧库', '签印与取火原账'], channel: ['谷底药渠', '地火实际走过的路'] };
function routeChoice(route, used) {
  const [place, evidence] = routeLabels[route];
  return choice(`route-${route}`, `去${place}，查${evidence}。`, `占用第${used + 1}处调查；最多两处，未选的第三处会在最后一夜关闭。`, `mortal-${route}${used ? '-second' : ''}`, `你在路图上圈起${place}。这是一次独立查访，空手而回也会用掉这处机会。`, { lifeFacts: { [`visited-${route}`]: true, 'investigations-used': used + 1 } });
}
const confront = choice('go-confront', '带实际所得去见陆槐，安排最后一夜。', '结束调查窗口；证据不足也可救人，不再补查第三处。', 'mortal-conflict', '沈芷收起没有走过的路引。陆槐来到药棚，封谷石料已运到山口；没有找到的东西不能当作已经找到。');
const hubVariants = [
  variant([fact('investigations-used', 2)], [dialogue('沈芷', '两处已经走过了。第三处来不及再去，封谷的人今晚进山。把留下的证物带来，也把不知道的部分留空。')], [confront]),
  ...Object.keys(routeLabels).map(visited => variant([fact(`visited-${visited}`, true)], [dialogue('沈芷', '这一处的所得已经记下。还能再查一处；也可以现在安排撤离。多找一份证据，不能让病人多等一次没有期限的承诺。')], [...Object.keys(routeLabels).filter(id => id !== visited).map(id => routeChoice(id, 1)), confront])),
  variant([], [dialogue('陆槐', '十八年前归衡宗为疫城赶药，连抽三季地火。我带来的旧图以为东闸能泄火，后来封了谷。你可以查温渡、原账或药渠，但最多赶得及两处。'), dialogue('沈芷', '我娘沈蘅开药窖救人，却被写成引火的罪人。先查一处，别拿我的恨或他的解释当证据。')], Object.keys(routeLabels).map(id => routeChoice(id, 0))),
];
const anonymous = choice('anonymous-record', '只记温渡准许留下的路线，不公开姓名。', '得到有范围的匿名笔录；不是完整具名证言，也不承诺救下所有人。', 'mortal-after-first', '温渡用筷子画出东闸：“先开的是闸，药窖后来才开。”你不记他的姓名。他没有允许别人把这份笔录说成他已愿出庭。', { items: { 'witness-notes': 1 }, worldFacts: { 'witness-consent': 'anonymous', 'witness-evidence': 'partial', 'anonymity-pledge': 'kept' } });
const keepOriginal = choice('keep-original', '带走有签印的原始账页，自行保管。', '取得唯一原件；没有第二张可在丢失后自动补回。陆槐不承诺替你担保。', 'mortal-after-first', '原账记着连续三季超采与陆槐的开闸签印，药窖启用晚于回火。救疫与判断错误同时留下了依据；你带走原件，也承担保存它的责任。', { items: { 'ledger-page': 1 }, worldFacts: { 'ledger-original': 'held', 'ledger-evidence': 'full', 'lu-guarantee': false } });
function copyAccountable(discern = false) {
  return choice('copy-accountable', discern ? '循已学的辨言方法核印，留签令者、遮无关住址。' : '留下决策签印，遮去无关弟子的住址。', discern ? '识破虚言使日期复核当场完成；取得陆槐认证的抄页，原件仍在旧库。' : '耗一年逐册核对；取得陆槐认证的抄页，原件仍在旧库。', 'mortal-after-first', '你只遮住与下令无关的住址，签印、三季取火数和开闸日期一字未删。陆槐在抄页上补印：“签令的人有我。你答应的遮名也确实做了。”', { items: { 'ledger-copy': 1 }, worldFacts: { 'ledger-evidence': 'full', 'ledger-original': 'archive', 'redaction-pledge': 'fulfilled', 'lu-guarantee': true } }, discern ? {} : { costs: { years: 1 } });
}
const partialLedger = choice('take-partial', '只取药窖启用日期，放弃追索签令全卷。', '无费用；足以质疑沈蘅首责，不能据此说已证明整个旧案。', 'mortal-after-first', '你带走日期摘录，原账仍锁在库中。它证明药窖晚开，却不能独自证明谁为何下令。沈芷把这个有限的纠正贴在母亲药簿旁。', { items: { 'ledger-extract': 1 }, worldFacts: { 'ledger-evidence': 'partial', 'ledger-original': 'archive' } });
const acceptSect = choice('accept-sect', '先答应交种接管，换宗门派担架救人。', '陆槐答应出人出炉；谷地经营权将归宗门。最后可反悔焚种，但会留下失诺。', 'mortal-rescue', '陆槐签下担架与安置条：“灵种交来，七户与温家都列进名册。”沈芷没有替你点头，只请你把失去谷地主权也照实写上。', { worldFacts: { 'public-truth': false, 'estate-pledge': 'pending' } });
function confrontationChoices(complete, pledged) {
  const limitEffects = { worldFacts: { 'public-truth': false, ...(pledged ? { 'truth-pledge': 'unfulfilled' } : {}) } };
  const choices = [choice('record-limits', '如实留下所得与缺口，先救活人。', '不宣布全案已破；未调查、未获授权的部分保持未知。', 'mortal-rescue', '沈芷把已知与未知分成两栏。陆槐不必公开全部责任，但也不能抹去你手中已有的记录。你们转向尚未撤出的七户与温家。', limitEffects), { ...acceptSect, effects: { worldFacts: { ...limitEffects.worldFacts, 'estate-pledge': 'pending' } } }];
  if (complete) choices.unshift(choice('public-hearing', '以两份独立完整来源公开追问签令责任。', '只公开能够核实的责任；匿名与遮住址的承诺仍然有效。', 'mortal-rescue', '日期、签印或实测火路彼此对上。陆槐在众人面前承认连续超采与沿用旧图，温渡执行开闸也没有被写成无罪；沈蘅开窖救人不再独担首责。', { worldFacts: { 'public-truth': true, 'lu-accountable': true, ...(pledged ? { 'truth-pledge': 'fulfilled' } : {}) } }));
  return choices;
}
const fullSources = [
  [item('ledger-page'), item('channel-map')], [item('ledger-copy'), item('channel-map')],
  [item('ledger-page'), item('testimony')], [item('ledger-copy'), item('testimony')], [item('channel-map'), item('testimony')],
];
const conflictVariants = [];
for (const conditions of [...fullSources, []]) {
  for (const pledged of [true, false]) conflictVariants.push(variant([...conditions, ...(pledged ? [world('truth-pledge', 'pending')] : [])], [dialogue('沈芷', '你明知我娘不该独担这个罪，为什么封存她的药簿？'), dialogue('陆槐', '救疫是真的，超采也是真的。我怕再死一批人，也怕宗门追到当年运药的弟子，便让死去的人替我们担了话。你手里的来源，能把责任写到哪一步？')], confrontationChoices(conditions.length > 0, pledged)));
}
function rescueChoices({ mobile, protectedWen, shelter, original, evacuationPledged, sectPact }) {
  const savedStatus = mobile ? 'safe' : 'dependent';
  const savedFacts = { 'evacuation-complete': true, 'survivor-line': 'seven-households-and-wen', ...(protectedWen ? { 'protect-pledge': 'fulfilled' } : {}), ...(evacuationPledged ? { 'evacuation-pledge': 'fulfilled' } : {}) };
  const organize = choice('organize-rescue', shelter ? '用护人之术护住窄口，让谷民接力抬担架。' : '留下组织担架接力，逐户送出温家与七户。', shelter ? '护人之术免去一年的重整；你肩头负伤。不是独自硬背，不要求药包。' : '耗一年安置与照料；不耗药、不需能力，重伤者不能亲自领这段接力。', 'mortal-seed', mobile ? '最后一双湿鞋踏上船板，温渡扶着家人走到接应处。药簿上的七户逐一有人应声，你答应保护的人没有被拿来作证据的代价。' : '你和谷民轮流守担架，沈芷安排后续照料。温渡活着出来，却仍不能独立生活；没有给过他的药不会在此时凭空生效。', { people: { 'wen-du': savedStatus }, worldFacts: savedFacts, lifeFacts: { 'rescue-mode': 'organized' }, ...(shelter ? { injury: 'hurt' } : {}) }, { requires: [healthy], ...(shelter ? {} : { costs: { years: 1 } }) });
  const sectRescue = choice('sect-rescue', '认下交种条件，请陆槐兑现担架与安置。', '不需药、健康或余寿成本；七户与温家获救，欠宗门援手并承诺交种。', 'mortal-seed', '陆槐按名单派来帮手，温家和七户一同撤出。宗门的炉与人力都不是白来的：你亲口承诺交种接管，这项条件会跟到最后的决定。', { people: { 'wen-du': savedStatus }, worldFacts: { ...savedFacts, 'sect-aid': true, 'estate-pledge': 'pending' }, lifeFacts: { 'rescue-mode': 'sect' } });
  const tradePage = choice('surrender-page', '交出唯一原始账页，换担架救出温家。', '失去原始账页；未留认证抄页时不能再据原账追责。不会得到虚构副本。', 'mortal-seed', '你把原件交给守库人，两名帮手才抬出温渡。人活着出来，纸则留在封库里；你记得看过原账，不等于仍持有可供核验的原件。', { people: { 'wen-du': savedStatus }, worldFacts: { ...savedFacts, 'ledger-original': 'traded', 'ledger-evidence': 'lost' }, lifeFacts: { 'rescue-mode': 'traded' } }, { costs: { items: { 'ledger-page': 1 } } });
  const evacuate = choice('evacuate-wounded', '先撤七户，把没有接应的温家留在后面。', mobile ? '无费用；温家自行逃出受伤。若曾答应护送，承诺破裂，温渡不再授权陪行。' : '无费用；温家没有担架，温渡会死在封锁中。不能当作全员获救。', 'mortal-seed', mobile ? '七户先到了安全处。温家自行走出山路，孩子摔伤了脚；温渡不肯再与你同行。你若答应过护家，这次失诺不会因他仍活着而被抵消。' : '侧门在最后一户人经过后落锁。你没有等到担架，温渡死在炉房；他的家属受伤撤出，名册上不能写成全员归来。', { people: { 'wen-du': mobile ? 'safe' : 'dead' }, worldFacts: { 'evacuation-complete': false, 'survivor-line': mobile ? 'seven-households-wen-family-hurt' : 'seven-households-wen-lost', 'wen-family': 'hurt', 'witness-cooperation': false, ...(protectedWen ? { 'protect-pledge': 'broken' } : {}), ...(evacuationPledged ? { 'evacuation-pledge': 'unfulfilled' } : {}) }, lifeFacts: { 'rescue-mode': 'incomplete' } });
  // Original trade replaces sect aid here; sect aid remains available by choosing
  // its explicit pact at the previous scene. No variant exceeds three actions.
  return [organize, original && !sectPact ? tradePage : sectRescue, evacuate];
}
const rescueVariants = [];
for (const mobile of [true, false]) for (const protectedWen of [true, false]) for (const shelter of [true, false]) for (const original of [true, false]) for (const evacuationPledged of [true, false]) for (const sectPact of [true, false]) {
  rescueVariants.push(variant([...(mobile ? [wen('mobile')] : []), ...(protectedWen ? [world('protect-pledge', 'pending')] : []), ...(shelter ? [ability('shelter'), healthy] : []), ...(original ? [item('ledger-page')] : []), ...(evacuationPledged ? [world('evacuation-pledge', 'pending')] : []), ...(sectPact ? [world('estate-pledge', 'pending')] : [])], [dialogue('沈芷', '七户已经到侧门，温家还在山里。先前把药给了谁，现在就得按那个人的伤势安排担架。你答应过的话，也请在这里兑现。')], rescueChoices({ mobile, protectedWen, shelter, original, evacuationPledged, sectPact })));
}
function outcomeChoices(estatePledged) {
  const outcomes = [
    ['clinic', 'open_clinic', '共同守种，重开有限供药的医馆。', '需要完整地脉图与自己组织成的救援；再耗一年修渠。众户承担照料，不能保证每季够药。', '你按实测图堵住倒灌的岔渠，与七户订下取火有数、改渠留图、封谷须问谷民的规矩。灵种留在谷土，第一季仍有半片药田没有出苗，往后缺药也必须重新商议。', 'rooted', 'valley-households'],
    ['estate', 'sect_estate', '交种给归衡宗，换稳定安置与药庄。', '不另扣药与寿元；灵种归宗门，药谷经营权交出，往后入故乡要验牌。已有证物仍归你保管。', '归衡宗的稳火炉进谷，工钱与安置先落实下来。沈芷在山外租屋行医，药庄的行医牌收在抽屉里；灵种活着，谷民却不能再自己决定故乡如何开门。', 'sect-custody', 'guiheng'],
    ['ash', 'ash_refuge', '焚种泄去余火，带迁民到下游立居。', '无药、重伤或余寿不足也可选择；永久毁去灵种，故谷不再生，下游只能种普通药。', '最后一缕绿从根部退去，余火随断根泄尽，没有新的大火。沈芷带走药簿。下游没有灵泉，药得另买；新村能活人，却不能把已毁的谷地再说成一座仙药园。', 'destroyed', 'none'],
  ];
  return outcomes.map(([id, outcomeId, label, detail, result, seed, custodian]) => choice(`choose-${id}`, label, detail + ' 承担结局后确定筑基，寿限提高至一百六十年；人间道证须另做交接。', 'mortal-echo', result + ' 你把救人与地火收束为一段完整修行，终于筑基；这份成长使活人也能走入幽冥渡口。', { realm: 'foundation', worldFacts: { 'valley-outcome': outcomeId, 'seed-state': seed, 'seed-custodian': custodian, ...(estatePledged ? { 'estate-pledge': id === 'estate' ? 'fulfilled' : 'broken' } : {}) }, settle: { episodeId: 'mortal-valley', outcomeId } }, id === 'clinic' ? { requires: [item('channel-map'), fact('rescue-mode', 'organized'), healthy], costs: { years: 1 } } : {}));
}
const handoffChoices = [
  choice('handoff-record', '把幸存、死者、药簿和未尽承诺逐项交给实际接手的人。', '完成照料与记录交接，取得人间道证；证据缺口、失诺与亡者照实保留。', 'mortal-outro', '你与沈芷逐项核名，把现有照料分给愿意接手的谷民，缺药和失诺另列。人间道证落在这次有去处的承担上，不替旧案补证，也不替死者回来签名。', { items: { 'old-names': 1 }, proof: 'mortal', worldFacts: { 'valley-handoff': 'recorded', 'valley-names-kept': true }, settle: { episodeId: 'mortal-handoff', outcomeId: 'recorded' } }),
  choice('handoff-with-gaps', '只移交现有药簿，承认自己尚未逐项核完。', '仍有真实接手人，但不领取本次人间道证；可以活着远行，未核职责留在簿中。', 'mortal-outro', '沈芷接过已有药簿，留下未核名的空栏。你交出了实际持有的东西，却没有把这份不完整的交接说成成证；筑基与已经做成的谷地结果仍然保留。', { worldFacts: { 'valley-handoff': 'uncertified' }, settle: { episodeId: 'mortal-handoff', outcomeId: 'uncertified' } }),
];
export const MORTAL_CHAPTER = {
  id: 'mortal', title: '药谷旧火', location: '药谷',
  opportunities: [{ id: 'mortal-shelter', abilityId: 'shelter', when: [] }, { id: 'mortal-discern', abilityId: 'discern', when: [] }],
  scenes: {
    'mortal-entry': scene('谷口的雨', '药谷谷口', [variant([], [narration('谷口的雨打湿了药箱。沈芷抱着一个发抖的孩子，另一只手还压着伤口。'), dialogue('沈芷', '先搭把手。封谷的人就快到了，里面还有七户人。')], [
      choice('catch-child', '接住孩子，腾出她的手。', '先让沈芷处理眼前的伤口。', 'mortal-medicine', '孩子抓住你的衣襟，慢慢止住了抖。沈芷腾出手压好伤口：“多谢，云归。这最后一包药该给谁，得有人担起来。”', { items: { 'medicine-pack': 1 }, lifeFacts: { 'entry-help': 'child', 'investigations-used': 0 } }),
      choice('raise-tarp', '撑起油布，护住伤者和药箱。', '让药箱和伤者先避开雨水。', 'mortal-medicine', '你把油布系在断梁上。沈芷将药箱移到干处：“药没淋坏。云归，这最后一包该给谁，得有人担起来。”', { items: { 'medicine-pack': 1 }, lifeFacts: { 'entry-help': 'tarp', 'investigations-used': 0 } }),
    ])]),
    'mortal-medicine': scene('最后一包止血药', '谷口棚下', [variant([item('medicine-pack')], [dialogue('沈芷', '旧掌闸人温渡伤得很重，南坡石屋里还有家人等他。药可以让他站起来，也可以留给今晚撤离的七户。救他不是换他承认我们想听的话。')], [
      choice('take-medicine', '带药去稳住温渡的伤。', '用掉唯一药包；温渡能够行动，七户没有这包药，不自动获得证言。', 'mortal-learning', '你将药送到南坡石屋。温渡能够坐起，却没立即谈旧火：“我知道你们要问什么。若查到这里来，先听我愿意说哪一段。”撤离的人仍在等自己的照料。', { people: { 'wen-du': 'mobile' }, lifeFacts: { 'medicine-wen': true } }, { costs: { items: { 'medicine-pack': 1 } } }),
      choice('leave-medicine', '把药留给撤离的人。', '七户伤者得到实际药物；温渡仍需担架，不能独自走出封锁。', 'mortal-learning', '沈芷把药分给伤者，几个人的出血止住了。温渡仍在南坡石屋咳嗽，他不会因你先救了别人便自己好起来。', { lifeFacts: { 'evacuation-medicated': true } }, { costs: { items: { 'medicine-pack': 1 } } }),
    ]), variant([], [narration('手中已经没有药。七户与温家仍在，不能把没给出去的药说成已经救了人。')], [
      choice('take-medicine', '带药去稳住温渡的伤。', '需要实际持有一包药；眼下没有。', 'mortal-learning', '你将实际持有的药交给温渡，他终于能够行动。', { people: { 'wen-du': 'mobile' }, lifeFacts: { 'medicine-wen': true } }, { costs: { items: { 'medicine-pack': 1 } } }),
      choice('search-unmedicated', '不再等药，先参与谷中的查访。', '不需药；温渡重伤的事实保留，之后要另找担架。', 'mortal-learning', '你空手回到医棚。沈芷不许诺温渡会自行康复，只把现有的人手重新排开。'),
    ])]),
    'mortal-learning': scene('别人正在做的事', '临时医棚', [
      variant([{ kind: 'opportunity', id: 'mortal-shelter' }], [dialogue('沈芷', '封谷前得把伤者练成能互相接手的队伍。陪我们做一年，我教你怎样承住撞击；要紧时能省去重整接力的时间，但不是人人都能无伤。')], [choice('learn-method', '帮伤者练接力，学护人之术。', '耗一年；人间仅此一次学习。日后可带伤护住窄口，省去救援重整的一年。', 'mortal-pledge', '你学会卸开冲力，也和谷民排出了接力次序。这一年没有添出新药，却留下能够共同救人的队伍。', { learn: 'shelter', lifeFacts: { 'evacuation-trained': true } }, { costs: { years: 1 } }), continueRoad]),
      variant([], [dialogue('老书吏', '陪我核一年封谷文书吧。看出一句话怎样漏掉年份，往后核原账能少花一年；可辨出虚言也不能替你变出证据。')], [choice('learn-method', '帮书吏核日期，学识破虚言。', '耗一年；人间仅此一次学习。以后认证抄账可当场核清日期，不能凭空坐实旧案。', 'mortal-pledge', '你陪书吏找出文书里被略过的年月，学会追问被一句话藏掉的前后。没有原物的洞见，仍只是查证的起点。', { learn: 'discern', lifeFacts: { 'dates-crosschecked': true } }, { costs: { years: 1 } }), continueRoad]),
    ], { selectOpportunity: true }),
    'mortal-pledge': scene('不肯烧掉的药簿', '医棚灯下', [variant([], [dialogue('沈芷', '我娘沈蘅死后，被列作擅开药窖、引火殃众。谷心还有最后一枚灵种，留种就要养谷，交种就由归衡宗作主。你先说愿意承担什么，别拿一句再等等拖住他们。')], [
      choice('pledge-truth', '答应查明能核实的真相，再谈灵种。', '记下查证承诺；证据不够时必须承认没有完成，不能拿救人抵作翻案。', 'mortal-approach', '沈芷把你的话记在药簿边：“查明多少就说多少，不能让死人再背一句好听的假话。”', { worldFacts: { 'truth-pledge': 'pending' } }),
      choice('pledge-people', '只承诺尽力安排活人撤离。', '不保证翻案；全员撤离仍需实际行动，失救会留作未履之诺。', 'mortal-approach', '你把撤离写成自己答应的事。沈芷没有说这就足够，只把七户与温家的名字逐一念给你听。', { worldFacts: { 'evacuation-pledge': 'pending' } }),
    ])]),
    'mortal-approach': scene('灯下选第一条路', '药谷路图前', [hubVariants.at(-1)]),
    'mortal-after-first': scene('灯下选下一条路', '药谷路图前', [...hubVariants.slice(1, -1), variant([], [dialogue('沈芷', '查访的缺口照实留下，眼下先去安排最后一夜。')], [confront])]),
    'mortal-last-night': scene('两条路之后', '药谷路图前', [{ ...hubVariants[0], when: [] }]),
    'mortal-witness': scene('不开门的掌闸人', '南坡石屋', [
      variant([wen('mobile')], [dialogue('温渡', '先开的是东闸，是我的手，陆槐的令。连抽三季地火后仍照旧图泄火，火沿改过的药渠回来，沈蘅后来才开窖救人。药让我能走，不等于我家人就该替这份口供冒险。')], [choice('protect-wen', '征得具名作证，答应护送温家。', '得到完整自愿证言；保护不是赦免，最后一夜必须兑现护家承诺。', 'mortal-after-first', '温渡在自己的陈述末尾摁印：“我来认开闸这一段，不替宗门认完所有事。”你答应护送他的家人，他才同意在安全处回应追问。', { items: { testimony: 1 }, worldFacts: { 'witness-evidence': 'full', 'witness-consent': 'named', 'witness-cooperation': true, 'protect-pledge': 'pending' } }), anonymous]),
      variant([], [dialogue('温渡', '没有药，我说不完那一夜。我只准你记东闸先开这条路，不准拿我孩子的住处换别人的公道。若要救我，得真有担架来。')], [anonymous, choice('respect-silence', '不逼他开口，留一张尚未获证的查访记录。', '没有口供；仍然可以安排救援，不能以沉默替人认罪。', 'mortal-after-first', '你没有强按他的手印，查访页上只写“未得证言”。温渡的伤与害怕都没有消失，但他没有被你变成一件证物。', { worldFacts: { 'witness-evidence': 'none', 'witness-consent': 'refused' } })]),
    ]),
    'mortal-ledger': scene('一张账里两种人命', '归衡旧库', [
      variant([ability('discern')], [dialogue('陆槐', '送疫城的药确实救了人。签令者也确实沿用旧图。我不会把取火的数目藏起来，可无关弟子的住址不该拿去给人寻仇。')], [keepOriginal, copyAccountable(true), partialLedger]),
      variant([], [dialogue('陆槐', '原账在这里。三季超采有印，药窖启用晚于回火也有日期。你要签令人的名字，我不拦；无关弟子的住址，请别当作追责的筹码。')], [keepOriginal, copyAccountable(), partialLedger]),
    ]),
    'mortal-channel': scene('长在旧图之外的根', '谷底药渠', [variant([], [narration('石渠比旧图多出一条岔路，刻字写着“新渠救旱，勿再引火”。根须被烧成白色，灵种却仍用一点新绿拉拢裂土。'), dialogue('沈芷', '药农改渠求活是真的，拿旧图走火的令也是真的。不能因为我娘救过人，就说这里从没人做错。')], [
      choice('measure-channel', '从上游放测绳，逐段画出稳脉图。', '耗一年；不要求身份、药包或能力，得到完整独立地脉图与共守修渠办法。', 'mortal-after-first', '你们从上游慢慢放绳，标出回火岔路与稳脉位置。沈芷在图上写明取样处：图能证明地火如何倒灌，也让留种有了实际修补的方法。', { items: { 'channel-map': 1 }, worldFacts: { 'channel-evidence': 'full' } }, { costs: { years: 1 } }),
      choice('retreat-marks', '带回刻字拓片，承认未完成测绘。', '无成本；保留独立残证，不能凭刻字推定整条地火路线或免费修谷。', 'mortal-after-first', '热浪逼近，你们退回地面。拓片留住了禁火的刻字，没有留下完整火路；谷底未量到的地方仍需在记录中留白。', { items: { 'channel-rubbing': 1 }, worldFacts: { 'channel-evidence': 'partial' } }),
    ])]),
    'mortal-conflict': scene('谁把罪写在死人身上', '药棚公议处', conflictVariants, { conflictId: 'valley-last-night' }),
    'mortal-rescue': scene('最后一双湿鞋', '封谷侧门', rescueVariants, { conflictId: 'valley-last-night' }),
    'mortal-seed': scene('活种不认功过', '谷心旧炉', [variant([world('estate-pledge', 'pending')], [dialogue('沈芷', '陆槐的担架不是一句空话，交种也是你答应的条件。你仍可以焚种泄火，但不能把反悔说成从未许诺。'), narration('灵种缩在焦根里。留种必须有实际修渠与共同照料，宗门能接管它，断根则会永远毁去它。')], outcomeChoices(true)), variant([], [dialogue('沈芷', '留种，要修地脉还要有人照料；交种，他们能养，谷地也归他们作主；焚种能让人离开，药谷却不会再生。三个答案，都有活人要往后承担。')], outcomeChoices(false))], { conflictId: 'valley-last-night' }),
    'mortal-echo': scene('给活人留下的地方', '药谷之后', [
      variant([world('valley-outcome', 'open_clinic')], [narration('医馆第一季只有半片药田发芽。沈芷没有挂你的名字，而把取火限额与看账的轮值写在门边。缺药时能否让病家开口，要由接下来的日子检验。'), dialogue('沈芷', '谷留下了，不等于每一条旧账都查完。照料、原物、谁答应过什么，先交清。')], handoffChoices),
      variant([world('valley-outcome', 'sect_estate')], [narration('药庄发下工钱，新谷门却添了验牌处。沈芷在山外行医，保留药簿；宗门接管没有收走你实际留下的证物，也没有替你补上未得的证言。'), dialogue('沈芷', '安置来得快，有些人却再不能自由进故乡。这两件事都要交给后来接手的人。')], handoffChoices),
      variant([], [narration('下游新村没有灵泉，旧谷只余温灰。沈芷带来的药簿还在，普通药圃得从头种。毁去的灵种不会因你筑基而重新长回。'), dialogue('沈芷', '把活着的、没有回来的分开记。往后药不够，至少还能知道缺口是怎样留下的。')], handoffChoices),
    ]),
    'mortal-outro': scene('此生还剩许多年', '离谷路口', [variant([], [dialogue('沈芷', '药簿有人接手，没做完的也写在里面。你若留下，就是余生一同守着；若还想走，渡口认你已经筑基，不需要先把自己变成亡者。')], [
      choice('travel-nether', '告别药谷，活着走向幽冥渡口。', '进入下一章“幽冥旧账”；保留谷地事实、现有道证、证物、伤势与承诺，此生继续。', 'nether-arrival', '你把交接后的药簿留在实际接手者手中，携自己的记录下山。幽冥渡口在暮色里亮起灯，你带着活人的呼吸走到岸边，没有为换一个章节先死一次。', { lifeFacts: { 'left-valley': true } }),
      { id: 'keep-watch', label: '留在这里，守望余生。', detail: '明确度过全部余寿后寿终，世界年份同步推进，结束此生；不是进入下一章。', to: 'mortal-ended', ending: 'retired', endingTitle: '药谷灯下的一生', result: '你留下来承担交接后属于自己的照料，把缺口和失诺也传给接手的人。共同经过余下岁月，药簿换过许多双手，最后一盏灯下，这一生走到了尽头。' },
    ])]),
    'mortal-ended': scene('灯下生平', '药谷', [variant([], [narration('这一生已经写定。死者、毁种与失去的原件没有被结算抹去，留下的承担各有去处。')], [])], { terminal: 'ended' }),
  },
};

// Second investigations use distinct concrete nodes. The small graph is acyclic,
// so even structural validation can prove an exit without simulating counters.
for (const route of Object.keys(routeLabels)) {
  const second = structuredClone(MORTAL_CHAPTER.scenes[`mortal-${route}`]);
  for (const row of second.variants) for (const action of row.choices) action.to = 'mortal-last-night';
  MORTAL_CHAPTER.scenes[`mortal-${route}-second`] = second;
}
