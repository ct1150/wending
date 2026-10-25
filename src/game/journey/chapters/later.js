const f = (id, value = true) => ({ kind: 'life-fact', id, value });
const w = (id, value = true) => ({ kind: 'world-fact', id, value });
const v = (when, text, choices) => ({ when, blocks: [{ kind: 'narration', text }], choices });
const c = (id, label, detail, to, result, effects = {}, extra = {}) => ({ id, label, detail, to, result, effects, ...extra });
const finish = { id: 'finish-life', label: '守望已有成果，走完此生。', detail: '共同经过全部余寿后寿终；没有死亡奖励。', to: 'mortal-ended', ending: 'retired', endingTitle: '守望旧约的一生', result: '你守住自己答应的一段，无法再任职时依法交接。余年过去，此生寿终，历史没有改写。' };
const onward = c('continue-journey', '携真实结果继续旅程。', '活着前往尚未完成的三界事务；已全部完成则回看成果。', 'later-onward', '今生交接已经记清；无须重演旧火或重领已经取得的道证。', { realm: 'foundation' });
const settle = (arc, outcome, label, result, facts = {}, extra = {}) => c(outcome.replaceAll('_','-'), label, '记录这一项真实结果；不重新安排旧谷地，不补发旧奖励。', 'later-result', result, { worldFacts: facts, settle: { episodeId: `mortal-${arc}`, outcomeId: outcome } }, extra);
export const SEQUEL_ECHOES = {
 clinic_open_council: '公药簿与两村议事仍在，急用、未救者与停采补偿都可问责；当年的取舍并未被洗去。',
 clinic_keeper_rule: '有药的急用规则仍由守簿人签责；依赖一人的局限仍在。',
 clinic_sect_debt: '医馆曾靠宗门供药度过急缺，实际供药债仍在，后续份额受偿付约束。',
 clinic_rationed: '当年的重症留药、转院与未覆盖者如实留档，不能写成五十七人全得救治。',
 estate_shared_supply: '药工仍握副契与第二把药库钥匙，最低药额和祭扫权有效；庄园经营权仍属宗门。',
 estate_grave_access: '清明小门不查工牌，但药价与供药控制未变，未成的药额请求仍在。',
 estate_unchanged: '当年的委托被拒绝，庄园工资、工牌与买药条件仍按原约。',
 refuge_common_medicine: '共管凡药园保留收成、损失与守园人口粮的安排；普通药缓慢有限，重症仍须外购。',
 refuge_family_medicine: '经营户的药园存续，能否买得起仍依赖这户人兑现承诺，并非共同治理。',
 refuge_small_plot: '保住粮地的小药圃只减轻部分家庭药费，不能写成全村供药。',
 refuge_unchanged: '当年的委托未接，迁民仍向外买药，灰谷灵种没有复生。',
};
// A completion marker is not a summary of every later legacy commission.
// Fold only authored outcomes; limited/refused/unfinished commissions contain
// no revocation of previously granted institutional rights.
export function legacySequelEcho(records, arc) {
 const history=records.filter(row=>row.arc===arc);
 if(!history.some(row=>row.outcomeId!=='unfinished'))return null;
 const held=new Set(history.map(row=>row.outcomeId));
 const priorities={clinic:['clinic_open_council','clinic_keeper_rule','clinic_sect_debt','clinic_rationed'],estate:['estate_shared_supply','estate_grave_access','estate_unchanged'],refuge:['refuge_common_medicine','refuge_family_medicine','refuge_small_plot','refuge_unchanged']};
 const outcome=priorities[arc]?.find(id=>held.has(id));
 if(!outcome)return null;
 let text=SEQUEL_ECHOES[outcome];
 if(arc==='clinic' && held.has('clinic_sect_debt') && outcome!=='clinic_sect_debt')text+=' '+SEQUEL_ECHOES.clinic_sect_debt;
 if(history.length>1){
  const names={clinic_open_council:'共议药簿',clinic_keeper_rule:'馆主签责',clinic_sect_debt:'供药债',clinic_rationed:'限量与转院',estate_shared_supply:'最低药额与双钥匙',estate_grave_access:'祭扫小门',estate_unchanged:'未接委托',refuge_common_medicine:'共同凡药园',refuge_family_medicine:'家户药园',refuge_small_plot:'小药圃',refuge_unchanged:'未接委托',unfinished:'未竟'};
  text+=' 历次旧卷依次记着：'+history.map(row=>`第${row.generation}世·${row.year}年：${names[row.outcomeId] ?? '细节未知'}`).join('；')+'。后来的有限、拒绝或未竟只说明那次委托，旧卷没有撤销先前制度权利的记录。';
 }
 return text;
}
const clinicEnd = (outcome,label,result,facts={}) => settle('clinic',outcome,label,result,facts);
const rationed = clinicEnd('clinic_rationed','只留重症份额，转院并公布未覆盖者。',SEQUEL_ECHOES.clinic_rationed);
const estateEnd = (outcome,label) => settle('estate',outcome,label,SEQUEL_ECHOES[outcome]);
const refugeEnd = (outcome,label,extra={}) => settle('refuge',outcome,label,SEQUEL_ECHOES[outcome],{},extra);
export const LATER_CHAPTER = { id:'later', title:'后来的谷地', location:'旧约与新来人', opportunities:[], scenes:{
 'later-clinic':{title:'规矩之外的五十七人',variants:[v([], '当值医者与守簿人迎接今生的新来人。旧人若已故，接任者只依留下的批注行事。火额已经用尽，五十七名外村病人到了；出资户也等自己的药。先按什么排队，不等于药已经够了。',[
 c('triage-severity','按病情轻重排队，公开出资户也须等待。','无费用；尚无新增药。','clinic-supply','病重者排前，出资户的异议记录在册。',{lifeFacts:{'clinic-triage':'severity'}}),
 c('triage-members','先保原出资户，再列外村急症。','无费用；外村的不满不会因后来公开规则而消失。','clinic-supply','出资户先得原份额，外村等待被明确记下。',{lifeFacts:{'clinic-triage':'members'}}),rationed])]},
 'clinic-supply':{title:'规则不能变出药',variants:[v([], '现有药只够少数重症。两村愿在实际补足药材之后议急用权；宗门也提出须偿付的供药契。',[
 c('cover-medicine','服务两年，补足本次药材与停采口粮。','共同经过两年；实际完成劳动后才记药材已补足。','clinic-rule','两年服务按约换成药材与停采口粮，未及时受治者仍在账上。',{lifeFacts:{'clinic-covered':true}},{costs:{years:2}}),
 clinicEnd('clinic_sect_debt','接受宗门供药与后续偿付约。',SEQUEL_ECHOES.clinic_sect_debt,{'supply-debt':true}),rationed])]},
 'clinic-rule':{title:'谁能决定急用',variants:[v([], '药材实际有了，医者要求规则同时写下紧急支出、未救者与停采户补偿。',[
 clinicEnd('clinic_open_council','两村共议并公开支出与补偿。',SEQUEL_ECHOES.clinic_open_council),
 clinicEnd('clinic_keeper_rule','让守簿人签下有限急用权与责任。',SEQUEL_ECHOES.clinic_keeper_rule)])]},
 'later-estate':{title:'两把钥匙',variants:[v([], '现任管事与药工代表各带现行契。宗门工资曾保住生计，工牌却拦住祭扫，种药人也买不起药。今生应先听代表实际委托的范围。',[
 c('mandate-graves','只受托谈祭扫，不替药工承诺其他交换。','无费用；不能越过仅祭扫的委托扩大供药约。','estate-terms','代表只托祭扫。药额要求未获本次授权。',{lifeFacts:{'estate-mandate':'graves'}}),
 c('mandate-supply','请药工代表亲自授权谈祭扫与最低药额。','代表只授权有限药额，保留退出；不转让经营权。','estate-terms','药工代表签自己的授权，宗门承认可以谈这两项。',{lifeFacts:{'estate-mandate':'supply'}}),
 estateEnd('estate_unchanged','不接委托，如实留下原条件。')])]},
 'estate-terms':{title:'能用的门与契',variants:[v([f('estate-mandate','supply')], '代表拒绝“视收成而定”的空话。最低量要有边界，药工须持副契和第二把钥匙，不能任由一方开库。',[
 estateEnd('estate_shared_supply','按授权签最低药额、祭扫与双钥匙副契。'),estateEnd('estate_grave_access','只落实清明小门，供药要求仍未完成。')]),v([], '仅祭扫的授权不允许你额外代表药工许诺供药交换。管事愿开清明小门。',[
 estateEnd('estate_grave_access','落实清明小门，不以工牌拦祭扫。'),estateEnd('estate_unchanged','不接受这项有限安排。')])]},
 'later-refuge':{title:'凡药春天',variants:[v([], '现在的迁民与记账人带来医药账。已故者只有旧记录，后人没有亲历旧火。灰谷灵种永毁；新地凡药园要占粮地、用水，还要熬过第一场歉收。旧有伤害与失诺不能由新来人抹去。',[
 c('acknowledge-loss','承认旧账，只接自己能担的建园事。','无费用；不改写历史救援、失诺与伤亡。','refuge-garden','旧账留在原处，今生只承担随后真实同意的部分。'),
 c('contribute-care','服务一年，补贴现存药费。','共同一年；这是当下补偿，旧保护承诺仍按原结果记录。','refuge-garden','一年服务用于现存家庭药费，故人和旧诺没有被改写。',{lifeFacts:{'refuge-compensated':true}},{costs:{years:1}}),
 refugeEnd('refuge_unchanged','不接建园委托，保留外购药账。')])]},
 'refuge-garden':{title:'先给守园人留饭',variants:[v([w('survivor-line','seven-households-and-wen')], '历史救援记录使保管人愿交旧排水图，只节省施工时间，不赠粮药。图的作者今日是否还活着，另按年代记录。',[
 c('build-garden','按实际旧图服务一年，建普通药园。','共同一年；留出守园口粮，灵种不会恢复。','refuge-risk','一年后排水和冬料落实，普通药园才有了真实底子。',{lifeFacts:{'garden-built':true}},{costs:{years:1}}),
 {...refugeEnd('refuge_small_plot','保粮地，只建小药圃。'),id:'small-plot'}]),v([], '没有实际安全救援地图可托付；工具、排水、冬料与粮食都需要重新筹备。',[
 c('build-garden','服务两年，筹工具冬料并建普通药园。','共同两年；不凭旧名册制造地图或资源。','refuge-risk','两年服务换来施工与冬料，普通药园建成。',{lifeFacts:{'garden-built':true}},{costs:{years:2}}),
 {...refugeEnd('refuge_small_plot','保粮地，只建小药圃。'),id:'small-plot'}])]},
 'refuge-risk':{title:'收成之前先分风险',variants:[v([], '凡药长得慢，第一次歉收仍可能来。先安排谁劳动、谁吃饭、谁担亏损，再许诺药给谁。',[
 refugeEnd('refuge_common_medicine','共同安排收成、损失与守园口粮。'),
 refugeEnd('refuge_family_medicine','再服务一年付冬费，交经营户按明约供药。',{costs:{years:1}}),refugeEnd('refuge_small_plot','缩回小药圃，保住口粮。')])]},
 'later-result':{title:'交接写在当下',variants:[v([], '这项责任已按真正达成的范围结算。你仍活着，后续只走尚未完成的部分。',[onward,finish])]},
 'later-echo':{title:'已经留下的结果',variants:[v([], '旧任务已经结算，不再招来同一批受难者重做。有限成果与未竟都仍有效。',[onward,finish])]},
 'later-unknown':{title:'不补写空白的旧卷',variants:[v([], '旧卷没有足够记录说明谷地经过。你不把传承名字当作目击证词；可以从真实的缺口开始登记，或守望此生。',[onward,finish])]},
 'later-onward':{title:'尚未完成的旅程',variants:[v([], '已有道证、权利与结算不再重领。眼前的下一段按保存的真实记录开启。',[c('go-on','去尚未完成的交接处。','无费用；已完成问鼎则只回看。','nether-arrival','你按真实记录走向下一段。'),finish])]},
 'later-legacy-victory':{title:'旧途问鼎的回声',variants:[v([], '旧人生已经在三界共主之战中获胜，胜利与生平都保留，不再重打一场或重复领奖。旧途战功没有证明今生已建立有限立约、地方药额或共同停约权；没有记载的制度不能补写。你仍活着，可以回看真实经历，再明确走完余生。',[finish])]},
 'later-finished':{title:'三界已有其约',variants:[v([], '问鼎已经完成。旧约、药谷真实结果与缺口仍在；此处没有另一场尚未写成的远征。你仍活着，可以回看生平，再决定何时明确走完余年。',[finish])]},
}};

// The old safe-rescue record authorizes only this archived map, not living companionship.
LATER_CHAPTER.scenes['refuge-garden'].variants.splice(1,0,{...LATER_CHAPTER.scenes['refuge-garden'].variants[0],when:[w('legacy-safe-rescue')]});
