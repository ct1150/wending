const f = (id, value = true) => ({ kind: 'world-fact', id, value });
const l = (id, value = true) => ({ kind: 'life-fact', id, value });
const a = id => ({ kind: 'ability', id });
const item = id => ({ kind: 'item', id });
const proof = (id, held = true) => ({ kind: 'proof', id, held });
const v = (when, text, choices) => ({ when, blocks: [{ kind: 'narration', text }], choices });
const c = (id, label, detail, to, result, effects = {}, extra = {}) => ({ id, label, detail, to, result, effects, ...extra });
const retire = { id: 'return-watch', label: '回人间守望余生。', detail: '明确经过全部余寿后寿终；保留已得道证与地方成果。', to: 'mortal-ended', ending: 'retired', endingTitle: '带约归来的一生', result: '你回人间履行有限职责；当无法继续时，由当事人停约。余下年月共同流逝，你终于寿终。' };
const self = c('authorize-self', '只签自己的公开核名与申诉职责。', '无费用；地方不担新增供药，旧违诺不被抹去。', 'celestial-opportunity', '衡简删去地方供给栏，只记你自己的职责。无人被你代签。', { worldFacts: { 'celestial-consent': 'personal', 'local-supply': 'none' } });
const local = (scope, text, result) => c('authorize-local', text, '只签实际有限范围；三季后再议，保留退出与申诉。', 'celestial-opportunity', result, { worldFacts: { 'celestial-consent': scope, 'local-supply': 'pending' } });
const limit = c('limit-terms', '逐句限定数额、三季期限与停止方式。', '无即时年耗；普通复核者承担首季亲核，旧核名职责仍在。', 'celestial-scarcity', '“足量”“永负其责”被划去。条款只约束明确同意的范围，不把责任传给后人。', { lifeFacts: { 'bounded-terms': true, 'first-audit': true } });
const small = c('small-terms', '撤回供药诉求，只立查账与停止追家属债的小约。', '无费用；放弃地方新增药额支持。', 'celestial-scarcity', '衡简把零新增药额写清，只留公开核查与停止争议债。', { lifeFacts: { 'bounded-terms': true }, worldFacts: { 'local-supply': 'none', 'celestial-consent': 'personal' } });
const trial = c('trial-appeal', '缩为三季申诉试约，不许诺新增药量。', '无费用；供药目标未成，查账与停止争议债仍可成。', 'celestial-copies', '许照的母亲还得由现世医者照料。试约没有把未到手的药写成疗愈。', { worldFacts: { 'local-supply': 'none' } });
const minimum = c('minimum-share', '先保约内最低份额，暂停向天府额外上缴。', '无即时年耗；首季督核按已立条款执行，共同印约的亲核豁免保留；天府少收。', 'celestial-copies', '旱季页写在最前：按实量保最低份额，天府少收。许照只能领取约内实际有的药，不能保证母亲已痊愈。', { worldFacts: { 'local-supply': 'minimum' }, lifeFacts: { 'first-audit': true } });
const deliver = c('deliver-copies', '交付限定副本，允许当事人在违约时停约。', '得天界道证；无自愿保管人时由你任首季送达人，不能立刻卸责。', 'ding-entry', '衡简交出副本。没有印术也能正式送达，你承担尚无人接手的职责。立约使你入元婴，寿限升至三百二十年；鼎前只许讲真实成果。', { proof: 'celestial', realm: 'nascent', lifeFacts: { 'copies-delivered': true, 'copy-custodian': 'self' }, worldFacts: { 'celestial-terms': 'accepted' }, settle: { episodeId: 'celestial-proof', outcomeId: 'bounded' } });
const decline = c('decline-terms', '不接受仍有争议的条款，带争议副本离开。', '不获天界道证，新增药额支持撤回；仍可见鼎并退回修补。', 'ding-entry', '你把异议交到双方手里，完成交接而入元婴，寿限升至三百二十年。此行并非立约成功，旧证仍保留。', { realm: 'nascent', worldFacts: { 'celestial-terms': 'disputed', 'local-supply': 'none' } });
const withdraw = c('withdraw-ding', '承认今日还不能立鼎，带原有成果退下。', '活着退回；不丢道证。可完成具体修补，或明确守望余生。', 'campaign-return', '鼎没有替你涂平缺口。你带真实的缺证、异议或主动退让回到三界代表面前。');
const shared = c('shared-method', '保留缺口，以已同意的小约立三季共担。', '需三道证与有效有限条款；不宣称旧案全破，原有核名、送达与保管职责仍须履行。', 'ding-fire', '你把未查明的栏留在鼎外。问鼎只保护真实同意的小范围规则，不能借地方未授的供给。', { worldFacts: { 'ding-method': 'shared' } });
const evidence = c('evidence-method', '只以可核实旧案立公开问责。', '需三道证、可追责裁定与保留来源；不能连坐家属或公开匿名身份。', 'ding-fire', '你让签令者承担可证责任。认证抄页标明认证者，未查明处没有被鼎火吞掉。', { worldFacts: { 'ding-method': 'evidence' } });
const separate = c('separate-fire', '撤开证人与原物，用已有记录公开受问。', '无费用；你承担首季复核。无副本者仅口述已知内容并标出处，不造原证。', 'ding-stop', '活人离开鼎火，死者没有复生。记录能说明到哪里便说到哪里，你留下首季复核职责。', { lifeFacts: { 'ding-first-audit': true, 'fire-crossed': true } });
const stop = c('share-stop-right', '把停约权交当事人，只守自己答应的有限期限。', '三道证齐全、有限约已成：确定问鼎。无保管人时自己守首季；不能任职时当事人可停约，不拿寿元作无限担保。', 'ding-home', '鼎火低下。当事人能查原件、能叫停，你也能依法移交而非带走账。鼎位成立，谷地尚欠的药与旧诺没有消失。', { lifeFacts: { 'ding-established': true } });
const fatal = { id: 'burn-all', label: '【必死】燃尽全部余寿，独压鼎火而拒交停约权。', detail: '耗尽当前全部余寿，当场死亡；世界年份不跳过。不能取得问鼎胜利，也不发普通奖励。', to: 'mortal-ended', ending: 'burned', endingTitle: '独压鼎火的未竟', result: '你燃尽余寿，鼎暂息而人当场死去。未经同意的权力没有成立，只有原先已签的有限条款仍有效。' };
const win = c('return-duty', '回到实际接手处，履行自己的有限职责。', '问鼎胜利，仍然活着。职责公开且可停止委托；不暗扣余寿，不保证一切灾损已弥补。', 'campaign-victory', '这一生的问鼎成立于真实来源与可停止的约。你回到人间接下自己那一段；已有的损失、缺口与未竟职责都没有被擦掉。', { settle: { episodeId: 'three-world-ding', outcomeId: 'bounded-victory' }, worldFacts: { 'ding-complete': true } }, { victory: true });
const three = [proof('mortal'), proof('nether'), proof('celestial'), f('celestial-terms', 'accepted')];
export const CELESTIAL_CHAPTER = {
  id: 'celestial', title: '天界立约', location: '天门与问鼎台',
  opportunities: [{ id: 'celestial-oath', abilityId: 'bind-oath', when: [] }, { id: 'celestial-fire', abilityId: 'burn-life', when: [] }],
  scenes: {
    'celestial-arrival': { title: '谷里的人肯签什么', variants: [
      v([proof('celestial')], '旧有天界道证不必重领。当世没有人因你前世的约自动成为代理人；你仍可以自己签一个公开核查、允许退出的小约。', [c('honor-celestial-proof', '承认旧证，只确认自己今生的有限职责。', '不重复学习、发证或结算；地方不新增供药。', 'ding-entry', '当世职责与旧证分开记录，鼎前仍须核对三界凭据。', { lifeFacts: { 'bounded-terms': true, 'copies-delivered': true, 'copy-custodian': 'self' }, worldFacts: { 'celestial-terms': 'accepted' } }), retire]),
      v([f('protect-pledge', 'broken')], '衡简看见旧护家承诺上实际的失信记录。家属不接受凭旧约代理；你仍能陈述事实，不能把一次立约洗成从未失约。', [self, retire]),
      v([f('estate-pledge', 'broken')], '旧卷记载有人答应交种换援手，最后却焚种。援手与失约都在，代表不接受凭旧约替地方担保；自己的申诉职责仍可签。', [self, retire]),
      v([f('valley-outcome', 'open_clinic')], '衡简曾把“足量”抄进百份赈药令，如今不敢再省这两个字。医馆轮值代表只愿公开三季药簿与有限贫户份额，不交灵种。许照把给母亲的空药袋留在值房等交班。', [local('clinic', '经医馆代表同意，签限额供药与病家看账权。', '医馆只认最低份额，种权仍归谷民；扩额须下季再议。'), self]),
      v([f('valley-outcome', 'sect_estate')], '庄园代表带着宗门现有经营契来。药工要最低药额与祭扫权；不能把这些说成已夺回谷地。衡简承认旧令的“足量”没有数目。', [local('estate', '承认现有经营权，换最低药额、祭扫与药工副契。', '宗门签有限供药，药工得到副契；你放弃此次立即收回谷地的诉求。'), self]),
      v([l('unknown-valley')], '谷地旧卷缺失，衡简不让你凭一个传承名字替地方签供药。今生只能签自己的有限核查与申诉职责。', [self, retire]),
      v([], '迁民代表带来新地普通药田的产量：“故谷是灰，别在天书里写灵种会回来。”许照的母亲也只等一份常用药。', [local('refuge', '经迁民代表同意，立普通药合作与新地代祭权。', '约只及普通药与代祭，灵种仍毁，故谷没有返还。'), self]),
    ] },
    'celestial-opportunity': { title: '印与一息门', selectOpportunity: true, variants: [
      v([{ kind: 'opportunity', id: 'celestial-oath' }], '契师替两位搬运人讲停工条件，把自己的名字写在错印申诉处：“若只想钉住别人，别学。”', [c('learn-celestial', '学习定契之印，只固定双方同意的内容。', '放弃本次领取一包救急药的机会；此章只学一项。', 'celestial-terms', '搬运人同意各自工期与退出方式，你学会连自己也约束的印。', { learn: 'bind-oath', lifeFacts: { 'oath-practiced': true } }), c('continue-celestial', '请普通书吏见证，领取已经约定的救急药。', '不学习；一次得到一包止血药，不产生供药额度。', 'celestial-terms', '书吏见证了同意，值房按约交给你一包救急药。', { items: { 'medicine-pack': 1 } })]),
      v([], '许照指着掌心旧痕：“燃的是你往后的年月。别因为我娘等药就赔一辈子。”门只开一息，值守者已准备接手。', [c('learn-celestial', '自损三年寿元撑一息门，学习燃命破局。', '个人命损三年，世界年份不变；余寿必须大于三年。', 'celestial-terms', '短门撑住，值守接手。你学会燃命，往后的寿元少了三年。', { learn: 'burn-life' }, { costs: { lifeDamage: 3 } }), c('continue-celestial', '请值守按次序开门，不燃命。', '无费用，不学习；错过本次借药窗口。', 'celestial-terms', '门依次开启，你没有以自己的寿元抵许照母亲的药。')]),
    ] },
    'celestial-terms': { title: '划掉足量与永远', conflictId: 'celestial-oath', variants: [
      v([a('discern'), a('bind-oath'), l('oath-practiced'), l('nether-arrival-recorded')], '“历任保管人”藏着代际连坐。你识破这句，又以双方同意的印固定三季期限与退出：不能改成无人可改的永久天条。', [{ ...limit, label: '识破代际连坐，以定契印固定真实同意的边界。', detail: '识破＋定契＋实际来源登记；免首季亲核，原有三季核名等旧职责仍在。', effects: { lifeFacts: { 'bounded-terms': true, 'first-audit': false, 'joint-seal': true } }, result: '代际连坐删除，双方同意留下公开违约印；首季亲核可由副本轮值分担，旧诺不免。' }, small]),
      v([a('discern'), l('nether-arrival-recorded')], '你认出“历任保管人”把责任偷塞给后人。衡简承认：“这几个字确是我省事。”', [{ ...limit, label: '指出隐蔽连坐，删除后再由自己亲核首季。', result: '连坐被删除；没有共同印约，首季仍由你复核。' }, small]),
      v([a('bind-oath'), l('oath-practiced')], '印只认双方已经同意的范围。契师提醒你：有印也得逐句读，不能让“永远”绕过退出。', [{ ...limit, label: '逐句复核后，以印固定可停的小约。', effects: { lifeFacts: { 'bounded-terms': true, 'first-audit': true, 'joint-seal': true } }, result: '双方在限定条款上留印；印保留申诉，不制造地方供药同意。' }, small]),
      v([], '衡简递来“谷地足量供药，签者永负其责”，自己停笔：“不写数目，是我省事。”你必须把真实授权、三季期限和退出写回去。', [limit, small]),
    ] },
    'celestial-scarcity': { title: '谁守最坏的一季', conflictId: 'celestial-oath', variants: [
      v([f('celestial-consent', 'personal')], '没有地方同意新增供药，空药袋不能变成药。许照愿把母亲的缺额也如实记录，不把欠缺转嫁给迁民。', [trial, c('minimum-share', '停止额外征收争议债，公开个人申诉职责。', '无费用；不产生地方药量，首季复核按既定分工执行，共同印约的豁免保留。', 'celestial-copies', '争议债暂停，零新增供药写在最前，许照没有带着虚构药量回家。', { worldFacts: { 'local-supply': 'none' }, lifeFacts: { 'first-audit': true } })]),
      v([a('herbalism'), item('medicine-pack')], '地方代表已同意以现有普通药材做验证，医者也在场。你可以用真正的一包药示范替药配方，不能凭药理许诺无限产量。', [{ ...minimum, label: '用一包药与当地普通药材验证有限替药方。', detail: '消耗一包止血药；有限需求下降，天府无需停额外收药；首季核查按既定分工执行。', costs: { items: { 'medicine-pack': 1 } }, effects: { worldFacts: { 'local-supply': 'substitute' }, lifeFacts: { 'first-audit': true, 'herbal-demonstration': true } }, result: '在场医者验证有限替药范围；一包药用尽，额度仍有上限，没有复原灵种。' }, trial]),
      v([a('soul-lamp'), l('chen-fragment'), f('valley-outcome', 'ash_refuge')], '迁民代祭被误列为重复领额。陈禾同意的归途片段与新地代祭记录可以核对，但灯不能增加药材。', [{ ...minimum, label: '用已授权归途片段核代祭名，保最低份额。', result: '代祭与重复领药分开，迁民不再为这项误记受罚；最低份额依真实药材，天府仍少收。' }, trial]),
      v([], '许照倒过药罐，只有三片干叶。代表把旱年页放在最前：“好年景谁都会签。缺药时先停谁？”许照把母亲也写进约内的份额。', [minimum, trial]),
    ] },
    'celestial-copies': { title: '副本交到谁手里', conflictId: 'celestial-oath', variants: [
      v([a('bind-oath'), l('bounded-terms')], '衡简愿交出副本与公开违约印，双方都保留停止权。印可以修订，但不能偷偷改。', [{ ...deliver, label: '以双方同意的印交付可停副本。', result: '副本各交一方，印只约束已接受内容。你不必独守；立约入元婴，寿限三百二十年，天界道证成立。', effects: { ...deliver.effects, lifeFacts: { 'copies-delivered': true, 'copy-custodian': 'joint-seal' } } }, decline]),
      v([f('protect-pledge', 'fulfilled'), f('witness-cooperation')], '温家愿意保存一份副本，只管自己同意的范围。履行过的护家诺成为这次自愿分担的依据，不是世袭担保。', [{ ...deliver, label: '经温家同意，分交有限副本。', effects: { ...deliver.effects, lifeFacts: { 'copies-delivered': true, 'copy-custodian': 'volunteer' } }, result: '温家收下愿保管的那份，另有申诉处。立约入元婴，寿限三百二十年；原有核名职责仍在。' }, decline]),
      v([a('shelter'), { kind: 'injury-not', value: 'severe' }, l('bounded-terms')], '强收之门逼近带副本的人。你能护他们把已签的纸送出去，自己却要受伤；印外无人被强签。', [{ ...deliver, label: '自己负伤，护送实际签约者的副本。', detail: '护人之术；自己负伤，完成真实送达并得道证。无自愿接手者时首季仍自己保管。', effects: { ...deliver.effects, injury: 'hurt' }, result: '副本离开强收之门，你负伤。有限条款完成送达，立约入元婴、寿限三百二十年。' }, decline]),
      v([a('burn-life'), l('bounded-terms')], '副本门将关，值守仍可正式送达。燃命只是一种自愿付代价的短桥，不是立约许可证。', [c('burn-copy-door', '自损五年寿元撑开副本门。', '个人命损五年，不推进世界年份；余寿须大于五年。得天界道证，免本季亲自送达，保管责任仍在。', 'ding-entry', '短桥把实际副本送到双方。你入元婴，寿限三百二十年，失去的五年寿元仍累计在身。', { ...deliver.effects, lifeFacts: { 'copies-delivered': true, 'copy-custodian': 'self', 'delivery-served': true } }, { costs: { lifeDamage: 5 } }), deliver, decline]),
      v([], '衡简：“一张天书若只有我能看见，你们还得来求我。”普通书吏也能送达，没人愿代保管就由你承担有限职责，不能堵死申诉。', [deliver, decline]),
    ] },
    'ding-entry': { title: '鼎里没有别人的名字', variants: [
      v([...three, f('nether-verdict', 'accountable'), l('sources-protected')], '鼎里传出你自己的声音：“把未竟交来，朕替你抹平。”你把可核实旧案与争议附卷分开：抹平会连没回来的人也抹掉。', [evidence, shared, withdraw]),
      v(three, '鼎要收走争议，只留一册善行。你没有全案真相，却有三界承认的有限职责与停止权；这也足以建立可以问责的小范围规则。', [shared, withdraw]),
      v([], '阿簿的附卷浮在鼎沿：有的凭据或当世有限授权还未成立。鼎不会把赴约冒充成证。已有药谷安排与道证仍有效，你可以活着带缺口退回修补。', [withdraw]),
    ] },
    'ding-fire': { title: '活人与亡者，不站同一把火', conflictId: 'ding-confrontation', variants: [
      v([a('shelter'), a('soul-lamp'), l('chen-fragment'), f('witness-cooperation'), item('testimony'), { kind: 'person', id: 'wen-du', status: 'safe' }, { kind: 'injury-not', value: 'severe' }], '温渡握住孩子的短绳：“我来认我的一段，不来替所有人死。”陈禾只愿保留亲见片段。鼎火逼他们同站中心，你可以把两侧分开。', [{ ...separate, label: '护人隔火，以魂灯保存两侧自愿陈述。', detail: '护人＋魂灯，且实际自愿活证人与亡者片段都在；自己负伤，免首季再复核这段证言。', effects: { injury: 'hurt', lifeFacts: { 'fire-crossed': true, 'ding-first-audit': false } }, result: '你负伤护住两侧，原有自愿陈述分别留下，没有人被迫走进中心。' }, withdraw]),
      v([a('herbalism'), a('burn-life'), item('medicine-pack'), f('witness-cooperation'), { kind: 'person', id: 'wen-du', status: 'safe' }], '活证人已同意这段陈述，鼎火却挤住呼吸。药只能护活人，短桥也只能通这一回，不能救回早死者。', [c('herb-fire-passage', '用药护呼吸，再燃三年开短通路。', '药理＋燃命；消耗一包药与三年个人寿元，余寿须大于三年。无新增伤，保留实际授权证言。', 'ding-stop', '一包药护住呼吸，三年命损换来短通路。证人退出火心，证词只及原有许可。', { lifeFacts: { 'fire-crossed': true, 'ding-first-audit': false } }, { costs: { items: { 'medicine-pack': 1 }, lifeDamage: 3 } }), separate, withdraw]),
      v([a('burn-life'), l('copies-delivered')], '你能燃命为已交付记录开路；证人必须先撤。这不能让失去的证言重新完整。', [c('burn-record-path', '自损五年寿元，只护记录通路。', '命损五年，不推进世界年份；余寿须大于五年。仍承担首季复核，不称全保。', 'ding-stop', '记录穿过短桥，证人先撤，不能补问的部分仍有缺口。', { lifeFacts: { 'fire-crossed': true, 'ding-first-audit': true } }, { costs: { lifeDamage: 5 } }), separate, withdraw]),
      v([], '鼎火要证人与原物进中心。你只让实际记录受问，活着拒绝陪行的人没有被召来，亡者也没有复生。没有认证副本时，口述就明写口述。', [separate, withdraw]),
    ] },
    'ding-stop': { title: '谁有权让鼎停下', conflictId: 'ding-confrontation', variants: [
      v([a('burn-life')], '代表说：“让我们有权关门。也让你有权离开，只是不能把账带走。”独压鼎火可以烧尽自己，却立不成别人同意的规则。', [stop, withdraw, fatal]),
      v([], '代表说：“让我们有权关门。也让你有权离开，只是不能把账带走。”无人保管时，你只承担有限首季，无法任职时当事人可以停约。', [stop, withdraw]),
    ] },
    'ding-home': { title: '鼎位之下，回到实际职责', variants: [
      v([f('valley-outcome', 'open_clinic')], '医馆药簿仍有领不到药的空栏。灵种与有限取火权仍由谷民共守，鼎没有让药量无限增长。你要把已同意的范围与停约权带回去。', [win, { ...win, id: 'finish-season', label: '共同经过一年，完成首季送达与复核后交接。', detail: '明确经过一年，年龄与世界年份同增；余寿须大于一年。问鼎胜利，三季核名中剩余职责仍在。', costs: { years: 1 }, effects: { ...win.effects, lifeFacts: { 'first-season-served': true } } }]),
      v([f('valley-outcome', 'sect_estate')], '药工把实际签成的条款抄在祭扫门边。庄园仍由归衡宗经营，入故乡仍有门牌；问鼎没有把经营权偷换为归还。', [win, { ...win, id: 'finish-season', label: '留下完成一年送达与复核，再交接。', detail: '共同经过一年；余寿须大于一年。完成首季不抹去其余旧诺。', costs: { years: 1 }, effects: { ...win.effects, lifeFacts: { 'first-season-served': true } } }]),
      v([f('valley-outcome', 'ash_refuge')], '新地种的是普通药，故谷仍是灰。迁民能使用的是确实签成的条款；若只签个人小约，地方新增药额便仍为零。', [win, { ...win, id: 'finish-season', label: '共同经过一年完成首季，再继续行路。', detail: '年龄与世界年份同增一年，余寿须大于一年；三季核名未完部分仍保留。', costs: { years: 1 }, effects: { ...win.effects, lifeFacts: { 'first-season-served': true } } }]),
      v([], '谷地旧卷仍有缺失，灵种存亡与地方安排仍未知。你带回的只有今生实际签成的有限条款、申诉与停约权，不把未知旧事补写成迁居或复兴。', [win, { ...win, id: 'finish-season', label: '共同经过一年，完成自己答应的首季职责。', detail: '年龄与世界年份同增一年，余寿须大于一年；只履行现有约定，未竟与旧卷缺口仍保留。', costs: { years: 1 }, effects: { ...win.effects, lifeFacts: { 'first-season-served': true } } }]),
    ] },
    'campaign-return': { title: '带缺口回去的人', variants: [
      v([proof('mortal', false)], '接手人愿核对你目前实际承担的核名、申诉与记录保管范围。旧卷有缺口便明写缺口；这次只为现有承担作有限交接，不补写药谷旧史。', [c('repair-mortal', '由实际接手人核对有限交接，公开未竟。', '无年耗；只完成新的交接认证，不改变谷地结局。', 'campaign-return', '接手人核对了现有承担与未竟，承认有限人间道证。已有记录与未知旧事保持原样，不追认从未发生的交接。', { proof: 'mortal', settle: { episodeId: 'mortal-repair', outcomeId: 'limited-handoff' } }), retire]),
      v([proof('nether', false)], '薄迟愿把争议改成明确的三季核名与停止追家属债，而不逼你认全案真相。原来的拒绝仍在记录里，这次共担才是新的实际修补。', [c('repair-nether', '与阿簿完成三季核名、停止追家属债的有限约。', '无即时年耗；你承担三季核名，不宣称全案定罪。取得幽冥道证。', 'campaign-return', '双方签下有限职责，缺口仍存，幽冥道证现在才成立。', { proof: 'nether', worldFacts: { 'nether-verdict': 'limited', 'nether-duty': 'three-seasons' }, settle: { episodeId: 'nether-proof', outcomeId: 'limited' } }), retire]),
      v([proof('celestial', false)], '衡简撤去所有有争议的新增药额，只留下你与申诉处都同意的核查、停止追债与公开副本。旧争议档不销毁。', [c('repair-celestial', '签个人小约并把可停副本交申诉处。', '无年耗；无新增地方供药，自己负首季保管，取得天界道证。', 'campaign-return', '实际有限条款送达，天界道证成立；地方没有被代签。', { proof: 'celestial', lifeFacts: { 'copies-delivered': true, 'bounded-terms': true, 'copy-custodian': 'self' }, worldFacts: { 'celestial-terms': 'accepted' }, settle: { episodeId: 'celestial-proof', outcomeId: 'bounded' } }), retire]),
      v([l('ding-return-used')], '你已用过这次交接后的重新赴鼎。两次退回都留有记录，三界既得成果仍在；眼下不再重开同一场争执。你仍活着，可以明确安排守望余生，之后才结束这一生。', [retire]),
      v([], '你保留已有的三界成果。修补没有重做药谷、没有领第二份旧奖励；还可以据现有授权再问鼎，或明确选择回去守望余生。', [c('reconsider-ding', '携现有道证与实际授权，重新面对鼎。', '只可重新赴鼎一次；不扣资源、不抽事件、不领奖。再退回就安排守望，不重开同一争执。', 'ding-entry', '你携仍有边界的来源与授权再到鼎前，这是此次交接后最后一次赴鼎。', { lifeFacts: { 'ding-return-used': true } }), retire]),
    ] },
    'campaign-victory': { title: '三界问鼎：可查，也可停止', terminal: 'victory', variants: [
      v([f('ding-method', 'evidence')], '这一生做成了按真实来源问责、允许当事人停约的三界规则；为此承担保管与实际未完的旧诺，没有买到所有人的宽恕；三界留下可核查的旧案、有限条款与未被擦掉的缺口。你仍然活着，谷地存亡与权属照旧。', []),
      v([], '这一生做成了三界认可的有限共担与申诉规则；为此承担核名、保管与未转交的职责，旧案仍未全破，缺失的供给也未补足；三界留下真实同意的可停小约，已有的损失没有被抹去。你仍然活着。', []),
    ] },
  },
};
