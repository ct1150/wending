const fact = (id, value = true) => ({ kind: 'world-fact', id, value });
const ability = id => ({ kind: 'ability', id });
const item = id => ({ kind: 'item', id });
const life = (id, value = true) => ({ kind: 'life-fact', id, value });
const say = text => ({ kind: 'narration', text });
const choice = (id, label, detail, to, result, effects = {}, extra = {}) => ({ id, label, detail, to, result, effects, ...extra });
const variant = (when, text, choices) => ({ when, blocks: [say(text)], choices });
const retire = { id: 'return-watch', label: '回到人间，守望余生。', detail: '明确共同经过全部余寿后寿终；不补发道证。', to: 'mortal-ended', ending: 'retired', endingTitle: '渡口归来的一生', result: '你回到人间照料实际留下的事务。多年过去，终于在灯下寿终。' };
const freeze = choice('freeze-debt', '先封存争议债，解开这一趟渡绳。', '无年耗；停止向家属追债，但不宣告全部旧债已清。', 'nether-opportunity', '薄迟签下暂封令。陈禾踏上核证台，手里仍握着女儿刻反了“禾”字的木屑。', { worldFacts: { 'dead-debt': 'frozen' } });
const correction = (scope, text, result) => choice('correct-record', text, '只纠正现有谷地记录能够证明的当下权利，不据此补全旧火真相。', 'nether-opportunity', result, { worldFacts: { 'dead-debt': 'corrected', 'nether-local-right': scope } });
const gaps = choice('record-gaps', '把缺口写进案首，只处理眼前受损。', '无费用；保留有限争议档，不能全案定罪。', 'nether-witness', '阿簿写明缺卷、未访与无授权的部分。缺口被保留，陈禾不必为渡河编一段签令经过。', { lifeFacts: { 'nether-case': 'limited' } });
const verify = (label, result, extra = {}) => choice('verify-sources', label, '仅核对两种实际完整来源；不补造遗失原卷，不公开匿名身份。', 'nether-witness', result, { lifeFacts: { 'nether-case': 'accountable' } }, extra);
const sources = [
  [item('ledger-page'), item('channel-map')], [item('ledger-copy'), item('channel-map')],
  [item('ledger-page'), item('testimony')], [item('ledger-copy'), item('testimony')], [item('testimony'), item('channel-map')],
];
const protect = choice('protect-sources', '按原来的许可与隐名承诺提交记录。', '无费用；只使用已经自愿授权的范围，不要求温渡或家属再次陪行。', 'nether-judgment', '原件与认证抄页各标来处；匿名笔录不添姓名。已死者只留下实际说过的话，拒绝陪行的人没有被写成在场。', { lifeFacts: { 'sources-protected': true } });
const abandon = choice('withdraw-testimony', '放弃本次证言，让争议档继续。', '不公开证人与家属；本次降为有限共担，不据旧案定全责。', 'nether-judgment', '你撤下证言，保留当下争议。薄迟没有把空页补成供状。', { lifeFacts: { 'nether-case': 'limited', 'sources-protected': true } });
const cross = { realm: 'golden' };
const share = choice('share-duty', '订下三季核名与停止追家属旧债的共担。', '无即时年耗；你承担三季核名，不能宣称旧案全破。职责公开，不能任职时可停止委托。', 'celestial-arrival', '阿簿与实际接手人各签自己能担的范围。陈禾解绳赴木牌处，你带走有限责任成就的幽冥道证。渡河的承担使你结丹，寿限升至二百四十年。', { ...cross, proof: 'nether', worldFacts: { 'nether-verdict': 'limited', 'nether-duty': 'three-seasons' }, settle: { episodeId: 'nether-proof', outcomeId: 'limited' } });
const dispute = choice('leave-dispute', '拒绝替缺失事实作保，留下争议。', '不获幽冥道证；仍可赴天门调停。之后可作有限修补或回人间守望。', 'celestial-arrival', '薄迟把真实争议送往天门。你完成渡口交接而结丹，寿限升至二百四十年；邀约不是判决，也没有补发道证。', { ...cross, worldFacts: { 'nether-verdict': 'unresolved' } });
export const NETHER_CHAPTER = {
  id: 'nether', title: '幽冥旧账', location: '沉舟渡口',
  opportunities: [{ id: 'nether-lamp', abilityId: 'soul-lamp', when: [] }, { id: 'nether-herbalism', abilityId: 'herbalism', when: [] }],
  scenes: {
    'nether-arrival': { title: '渡口不收功劳', variants: [
      variant([{ kind: 'proof', id: 'nether' }], '幽冥旧证仍有效。薄迟的存卷没有因又一次来到渡口而重开；今生的授权须在天门另行确认。', [choice('honor-nether-proof', '持旧证赴天门，只核当世授权。', '不重审、不发重复道证、不抽学习机会。', 'celestial-arrival', '你沿旧证允许的渡路前行，历史裁定保留。'), retire]),
      variant([fact('dead-debt','corrected')], '旧卷中已纠正的债没有重新绑回陈禾。薄迟请今生来人只登记现存来源，继续尚未完成的核证与职责。', [choice('shelve-records','登记现有来源，接续未完核证。','不重办已成的地方权利，不恢复旧债。','nether-opportunity','已成的纠债与地方权利保留，未完核证继续。',{lifeFacts:{'nether-arrival-recorded':true}}),retire]),
      variant([fact('dead-debt','frozen')], '争议债仍按原令封存，陈禾没有重新被同一笔债绑住。今生只续未完核证，不把暂封冒充全案已清。', [choice('shelve-records','登记现有来源，接续未完核证。','不重发暂封令。','nether-opportunity','暂封继续有效，登记只含实际来源。',{lifeFacts:{'nether-arrival-recorded':true}}),retire]),
      variant([], '阿簿薄迟把灯移到你尚有呼吸的手边：“这里不问功劳，先问是谁的名字。缺页也得标出处。”河心的沉船上，一根绳正把药农陈禾拖向黑水。', [choice('shelve-records', '交现有记录，逐项标出不知道的地方。', '只登记实际来源；没有账卷也可登记亲见的损失。', 'nether-registered', '薄迟将记录分为实物、授权口述与缺口三栏，没有添一张原卷。', { lifeFacts: { 'nether-arrival-recorded': true } }), retire]),
    ] },
    'nether-registered': { title: '死去以后，还算欠工么', variants: [
      variant([fact('valley-outcome', 'open_clinic')], '医馆轮值簿记着领药与失踪的不同日期。陈禾攥着木屑：“我女儿刻反了我的名，我只想再看一眼。”薄迟找到同一份药被追讨两次的栏。', [correction('clinic-dates', '用医馆轮值记录剔除重复领药指控。', '重复药债撤去，医馆保留下一季有限供药资格。火因仍须另证。'), freeze, retire]),
      variant([fact('valley-outcome', 'sect_estate')], '宗门接管记录承认谷民为药工，旧条却把死者也列入下季到工数。庄园失去虚工收益之后，活人的药额仍须重议。', [correction('estate-work', '依据本人到工条款，撤去死者的后续欠工。', '陈禾的虚工债撤销。经营权仍在归衡宗手中，活人的最低药额并未因此自动落实。'), freeze, retire]),
      variant([{kind:'life-fact',id:'unknown-valley',value:true}], '旧卷不足以说明谷地安排，薄迟只愿按眼前的争议暂封债，不补写迁民或灵种存亡。', [freeze,retire]),
      variant([], '迁民的实际交接记录没有故谷墓址。陈禾担心迁居以后，再没有人有权为无坟者立木牌；灰谷也不可能重新长出灵种。', [correction('refuge-memorial', '以实际迁民记录申请无坟者代祭名。', '薄迟承认新地代祭资格。故土与灵种没有回来，迁民仍只种普通药。'), freeze, retire]),
    ] },
    'nether-opportunity': { title: '灯与药，各有所限', selectOpportunity: true, variants: [
      variant([{ kind: 'opportunity', id: 'nether-lamp' }], '守灯者请你核对一个失名者的归途：“灯照他站在哪里，不能替他说他没见过的话。”', [choice('learn-nether', '留下核对归途，学习引魂灯诀。', '学一项方法；承担在裁定中保留未核实记录的责任，不获全知证词。', 'nether-evidence', '你学会让灯照住已同意留下的片段；陈禾只愿说亲见的渠流与救人。', { learn: 'soul-lamp', lifeFacts: { 'lamp-duty': true, 'chen-fragment': true } }), choice('continue-inquest', '不学习，按现有来源走。', '无费用，不新增职责。', 'nether-evidence', '你谢过守灯人，走向正在下沉的核证台。')]),
      variant([], '渡口医者把药分给仍活着的摆渡人：“药不能给死人续命。你可以留下学一年辨药；若再服务一年，我按约付一包救急药。”', [choice('learn-nether-service', '学药理一年，再服务一年换一包救急药。', '共同经过两年，年龄与世界年份同增；学本章唯一一项方法，得到实际劳动换来的药一包。', 'nether-evidence', '你学辨药一年，再守医棚一年。医者按约交一包药作为酬劳，药理与药各有来处。', { learn: 'herbalism', items: { 'medicine-pack': 1 } }, { costs: { years: 2 } }), choice('learn-nether', '留下照料摆渡人一年，学习药理通识。', '共同经过一年，年龄与世界年份同增；学本章唯一一项方法，不获赠药物。', 'nether-evidence', '你照料摆渡人一年，学会分辨误熏药烟。医者接手照料，你携原有材料前往核证台。', { learn: 'herbalism' }, { costs: { years: 1 } }), choice('continue-inquest', '交给医者，赶赴核证台。', '无年耗，不学习、不扣药；摆渡人有医者照料。', 'nether-evidence', '医者接住药碗，你携原有材料赶往核证台。')]),
    ] },
    'nether-evidence': { title: '原卷不在这里', conflictId: 'nether-inquest', variants: [
      ...sources.map(when => variant([...when, ability('discern')], '桌角正在没入河水。你从“先救药窖所以先引火”的话中指出时间偷换；无证推论被删掉，留下的两份实际来源才是依据。', [verify('删去无证推论，再逐条核对实际来源。', '薄迟按真实来源记录签令、火路与责任范围；你识破的话术没有变成第三份证据。'), gaps])),
      ...sources.map(when => variant(when, '薄迟钉住袖口挡风：“冥府收人，不替人间收藏丢掉的纸。”你面前有两份独立完整来源；认证抄页也只按实际认证范围使用。', [verify('核对现有两种完整来源。', '核证台留下可追责的旧案。原账在谁手里仍照旧，认证副本不冒充原卷。'), gaps])),
      variant([ability('soul-lamp'), life('chen-fragment')], '灯里陈禾只肯重述渠水倒流与救人的片段：“签令时我不在，别替我添。”这仍不足以凑成完整旧案。', [choice('preserve-fragment', '保留陈禾同意的片段，明确边界。', '形成有限争议档；引魂灯不补签令证据。', 'nether-witness', '渠流片段有了来源，未知签令仍空着。', { lifeFacts: { 'nether-case': 'limited', 'chen-fragment': true } }), gaps]),
      variant([], '桌上的残证或空页不足以定全案。薄迟用袖口挡住河风：“你写少一行，我陪你查；你添一行，我便放不走他。”', [gaps, choice('ask-limits', '请薄迟逐项说明现有记录能证明什么。', '无费用；仍是有限争议档，不凭询问获得完整证据。', 'nether-witness', '薄迟圈出每项材料覆盖的范围，未查明处仍空白。', { lifeFacts: { 'nether-case': 'limited' } })]),
    ] },
    'nether-witness': { title: '让谁站在灯下', conflictId: 'nether-inquest', variants: [
      variant([ability('shelter'), ability('soul-lamp'), life('chen-fragment'), fact('witness-cooperation'), item('testimony'), { kind: 'person', id: 'wen-du', status: 'safe' }, { kind: 'injury-not', value: 'severe' }], '温渡自愿站到活人一侧：“我认开闸，不拿孩子作证。”陈禾同意在另一侧留自己的片段。两边河火逼近，不能让他们站在同一火线。', [{ ...protect, label: '护住活证人，以魂灯分两侧保留自愿陈述。', detail: '护人＋引魂灯；自己负伤，保存两份原有范围的证言，不新增全知事实。', result: '你负伤撑开火线，温渡与陈禾各说自己亲见的部分，证人与家属没有被越权公开。', effects: { injury: 'hurt', lifeFacts: { 'sources-protected': true, 'paired-testimony': true } } }, abandon]),
      variant([ability('shelter'), fact('witness-cooperation'), item('testimony'), { kind: 'person', id: 'wen-du', status: 'safe' }, { kind: 'injury-not', value: 'severe' }], '温渡只同意说自己的开闸经过。沉船绳索又一次勒住台柱，你可以护他离开，但不能把他的家属推到灯下。', [{ ...protect, label: '自己负伤，护温渡按原授权离台。', detail: '护人之术保住实际自愿证言；自己负伤，不新增亡者来源。', result: '温渡离台，你肩上留下一道伤，授权边界没有变。', effects: { injury: 'hurt', lifeFacts: { 'sources-protected': true } } }, abandon]),
      variant([], '薄迟只展开已有授权的记录。活着却不愿陪行的人不必到场，死者没有从空页上回来。匿名笔录仍没有名字，失护的旧诺仍在页边。', [protect, abandon]),
    ] },
    'nether-judgment': { title: '代偿不是买断', conflictId: 'nether-inquest', variants: [
      variant([life('nether-case', 'accountable'), life('sources-protected')], '陈禾：“我不拿一场雨当赔偿。往后若还开闸，至少让住在水边的人先知道。”阿簿愿按可证范围裁定，不让家属承签令者的罪。', [choice('judge-accountable', '公开可证旧案，把签令责任与无关者分开。', '得幽冥道证；公开件保留隐名与住址遮蔽，不追家属旧债。', 'celestial-arrival', '裁定按可核实来源落笔，陈禾解绳赴木牌处。你结丹，寿限升至二百四十年，携辨责道证赴天门。', { ...cross, proof: 'nether', worldFacts: { 'nether-verdict': 'accountable', 'nether-duty': 'source-custody' }, settle: { episodeId: 'nether-proof', outcomeId: 'accountable' } }), share, dispute]),
      variant([], '陈禾不肯用假口供买断自己。薄迟愿签有限的停止追家属债与核名安排，也允许你如实留下未竟。', [share, dispute]),
    ] },
  },
};
