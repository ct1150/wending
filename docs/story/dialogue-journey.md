# 对话旅程作者契约：药谷、三界与同世界轮回

本篇是产品 2.0.0、存档 v3 对话旅程的执行作者稿（2026-10-25，上海）。实现已具备三界与轮回闭环；生产发布和实际视觉／真人节奏验收待完成。人物与固定真相来自 [药谷旧火](valley-fire.md)；旧版自由行动、战斗、八年调查钟不作为新章规则。旧人生仍由旧引擎运行，不能把本篇规则插入其中。

## 真相与人物

归衡宗为疫城救药连续三季超采地火，沿用已经失效的旧图下令开东闸。温渡奉令开闸，火沿被药农改过的药渠倒灌；沈蘅后开药窖救人，却在封谷后独担“引火”罪名。陆槐封存记录，既遮掩判断错误，也保护运药弟子。救疫、超采、改渠与执行错误可以同时成立，没有外来邪魔替所有人负责。

身份映射固定如下，不代表玩家已认识某人：原稿 `shen_zhi` → v3 `shen-zhi`（沈芷）；`lu_huai` → `lu-huai`（陆槐）；`wen_du` → `wen-du`（温渡）。玩家第一次在谷口遇见沈芷，在选路处听陆槐说明旧事；只有实际走证人线才与温渡谈旧案。开局送药只稳伤，不自动取得他的口供或同意。

## 唯一调查期限

**最多深入两条不同调查线。** 第一条必选；完成第一条后，可再选一条或直接进入最后一夜。第二条完成后，只能进入最后一夜，未走的第三条关闭。失败、退回或只取残证仍占一条；已经走过的路线不能再领证物。

这是唯一调查限制。普通对白、页面回看、读帮助、可选学习和明示耗年不另外推进八年封谷钟。学习、认证抄账、完整测渠、普通接力救援、共守修渠各自明确耗一年；这些成本推进人物年龄和世界年份，不能将它们再叠成隐藏期限。余寿不足时不能选该项，但总有无年耗的残证、退让、宗门援手或焚种出口。

调查图使用不同的第一次与第二次节点，不依赖可循环的菜单：首次选路 → 一处调查 → 下一条路/对质 → 第二处调查（可选）→ 最后一夜。第一、二次同类场景共用作者内容，但保存的 scene ID 不同，图中没有剧情循环。

## 药、能力与来源

开局只有一包止血药。给温渡让他能行走；给七户让实际伤者止血；没有药就不写治疗。药既不是调查许可证，也不使温渡自动授权作证。

人间只选入一次可选遭遇，入场时保存结果，阅读不随机：

| 遭遇 | 学习与实际成本 | 后续区别 | 拒绝 |
| --- | --- | --- | --- |
| 伤者接力，沈芷教护人之术 | 耗一年；学 `shelter`，保存 `evacuation-trained` | 救援时可护窄口，免去重新组织的一年，自己负伤 | 不学，普通一年接力仍可做 |
| 书吏核日期，学习识破虚言 | 耗一年；学 `discern`，保存 `dates-crosschecked` | 留认证账页抄本时当场核清，免去额外查档一年 | 不学，普通一年核对仍可做 |

学习至多一次，可直接拒绝。没有能力的第一世可以取得全部人间成果，也可以活着进入下一章。身份、门派或职业不是入口条件。

三类来源相互独立：

| 调查 | 实际证物 | 所能证明与边界 |
| --- | --- | --- |
| 温渡 | `testimony` 或 `witness-notes` | 已治疗且自愿具名可得完整亲历证言，同时答应护家；匿名只得有范围的路线笔录；拒绝开口不生口供 |
| 旧库 | `ledger-page`、`ledger-copy` 或 `ledger-extract` | 唯一原件/陆槐认证抄页证明三季超采和签令日期；日期摘录只能质疑沈蘅首责，不是全卷 |
| 药渠 | `channel-map` 或 `channel-rubbing` | 完整上游测绘证明火路并给出共守修渠办法；刻字拓片是独立残证，不等于整条火路 |

公开追责需要任意两份独立完整来源。它不要求任选能力，不替温渡免开闸责任，也不公开匿名者或无关住址。来源不足时，如实记录缺口仍可进入救援。

## 最后一夜：最多三次重要决定

1. 对质：公开可证责任、记录缺口，或承诺交种换援手。
2. 救援：自己组织接力、交出原始账页换担架/请宗门援手，或先撤七户。普通接力耗一年且不能让重伤者领队；宗门援手不耗药寿，但真实增加交种承诺。原账交易实际扣除原件，绝不补一张抄页。
3. 灵种：共同守种、宗门接管或焚种迁民。

给温渡药后，完整救援使他安全；未给药而救出则仍依赖长期照料。先撤七户时，能行走的温家自行撤出受伤、拒绝后续陪行；无法行走的温渡死在封锁中。曾答应护家则记失诺。已有自愿证言可按原授权保留，但今后不应再假称温渡愿意陪行。

## 三种结局

| 结局 ID | 真实前置和成本 | 灵种与归属 | 永久留下的问题 |
| --- | --- | --- | --- |
| `open_clinic` | 实际完整地脉图、自己组织完成的救援、非重伤，再耗一年共同修渠 | `rooted`，`valley-households` | 有限取火与轮值看账，第一季只有半片药田发芽；不保证以后药量充足 |
| `sect_estate` | 人人可选；不另扣资源 | `sect-custody`，`guiheng` | 安置快、工钱落地；经营权交宗门，谷民入故乡须验牌 |
| `ash_refuge` | 人人可选；无药、重伤、低余寿均可 | `destroyed`，`none` | 终止余火，灵种永久失去；下游只种普通药，药费与迁居责任仍在 |

实际答应过宗门交种才记录履诺/毁诺；焚种可以反悔，但不能抹去此前的援手和约定。旧案是否公开、原件去向、幸存者、匿名与护家承诺独立保存，不因结局标签自动修正。

承担并完成任一结局确定筑基：`realm: foundation`，寿限至少一百六十年。增长发生于关键经历，开放活人到幽冥渡口的通行。**这一步不发人间道证。**

## 交接与离谷

结局之后仍须处理药簿与现有照料：逐项核名、分清幸存与未归、把实际记录和未尽承诺交给愿意接手的人，完成 `mortal-handoff / recorded`，取得 `mortal` 道证和真实旧名册 `old-names`。没有查全旧案或没能全救并不妨碍对现有事实作诚实交接。也可只移交未核完的药簿，记录 `uncertified`，本次不成证。

交接后两项去向有不同的生命意义：

- `travel-nether`：进入真实 `nether-arrival`，仍为 `playing`，不改年龄、不造死亡、不清除物品、伤势或承诺。
- `keep-watch`：明确守望全部余寿，推进同样数量世界年份后寿终，写入生平。

Task4 的历史交付边界只含实际存卷动作 `shelve-records` → `nether-registered` 与明确守望余寿的终场。Task5 已接入下述幽冥核债、来源核查、有限裁定与道证流程；实际远行仍不强制结束人生。

## 保存给后章的有限因果字段

所有字段名均为连字符格式。结局事实在 `world.facts`，当世调查/学习事实在 `life.facts`，实际随身证物在 `life.items`。

| 字段 | 已写入的取值/意义 |
| --- | --- |
| `valley-outcome` | `open_clinic / sect_estate / ash_refuge`，与 `mortal-valley` 完成记录一致 |
| `seed-state / seed-custodian` | 上表中的精确配对；不携带另一枚活种 |
| `public-truth / lu-accountable` | 布尔值；只有实际公开完整来源的对质才成公开追责 |
| `ledger-original` | `held / archive / traded`；预留 `destroyed` 给实际毁损；`held` 必须有唯一原件，其他状态不得持有原件 |
| `ledger-evidence` | `full / partial / lost`；实际交原件而未留副本记 `lost`，不把记忆当认证抄本 |
| `channel-evidence` | `full / partial` |
| `witness-evidence` | `full / partial / none` |
| `witness-consent` | `named / anonymous / refused`；后章不得把匿名稿变具名授权 |
| `witness-cooperation` | 完整自愿证言时为真；温家失护时为假，既有陈述与现在是否愿陪行必须分开 |
| `survivor-line` | `seven-households-and-wen / seven-households-wen-family-hurt / seven-households-wen-lost`；这是当夜历史，幸存不代表以后不会衰老 |
| `evacuation-complete` | 布尔值，记录当夜是否完整安排七户与温家 |
| `wen-family` | 先撤七户时记 `hurt`；不许用父亲活着消除家属受伤 |
| `truth-pledge` | 实际答应才有：`pending / fulfilled / unfulfilled` |
| `evacuation-pledge` | 实际答应才有：`pending / fulfilled / unfulfilled` |
| `protect-pledge / estate-pledge` | 实际答应才有：`pending / fulfilled / broken` |
| `anonymity-pledge / redaction-pledge` | 实际记录分别为 `kept / fulfilled` |
| `sect-aid / lu-guarantee` | 宗门援手、认证抄页担保，布尔值；援手不因后悔交种而消失 |
| `valley-handoff / valley-names-kept` | `recorded / uncertified`；核名完成时后者为真 |
| 当世 `investigations-used` | 整数 0–2，必须等于实际 `visited-witness / visited-ledger / visited-channel` 真值数 |
| 当世 `rescue-mode` | `organized / sect / traded / incomplete`；共守只接受实际自己组织完成者 |
| 其他当世事实 | `entry-help`，`medicine-wen`，`evacuation-medicated`，`evacuation-trained`，`dates-crosschecked`，`left-valley`，最小边界的 `nether-arrival-recorded` |

`completedTasks` 在同一世先写 `mortal-valley` 的实际结局，再写 `mortal-handoff`，sequence 单调增加。后章结算自己的 episode，不能覆盖 valley outcome。界面选择说明从实际 `costs.items` 追加所需和现持数量，从实际寿年成本追加当前余寿，避免仅靠散文猜能否承担。

保存校验拒绝结局与灵种不配、持原件却声称已交走/毁坏、证物与来源记录不配、调查计数不配、当夜温渡失救却又是活人等矛盾。它不伪装为防作弊事件重放，也不能借校验为后章补造授权或原件。

20–30 分钟一世仍待真人计时，不以节点数量或自动测试作时长证据。

## 后半程执行稿：幽冥、天界与第一世问鼎（Task 5）

后半程现在是真实可玩的有限内容，节点定义见 `src/game/journey/chapters/nether.js` 与 `celestial.js`。没有随机胜负，没有死亡次数条件，没有为通关偷偷补能力、账卷、证言或道证。旅程首世可以活着达到 `victory`，并保留正余寿；它不是寿终生平。

### 故事与三种谷地的实际后果

幽冥渡口的薄迟（阿簿）登记来源，沉舟上的药农陈禾只肯说亲见的渠流与救人，不替签令者编供词。谷地记录分别处理不同当下损害：医馆轮值日期撤重复领药债、保有限资格；庄园本人到工条撤死者虚工债、损失虚工收益而保留宗门经营权；迁民交接给无坟者新地代祭资格、故土与灵种不会恢复。封存争议债是实际可选退让：只止追家属，不宣告全案查清。

完整旧案需要两份实际独立完整物品来源：原账/认证抄页＋地脉图，原账/认证抄页＋自愿证言，或地脉图＋自愿证言。原账交走后为零，认证抄页只标认证抄页。匿名笔录与陈禾片段不充完整原卷。被救且自愿陪行的温渡才在能力护送版亲到；已有自愿历史证言可以继续按其原范围使用，不能把拒绝陪行写成到场，更不能复活死者。普通披露始终履行隐名与住址范围。裁定可以是可追责旧案，也可以是三季核名、停止追家属债的有限共担；拒绝仍可结丹赴调停，但不获幽冥证。

天门衡简承认旧赈药令的“足量”是自己的省事，许照的母亲需要实际药，不为催促玩家自动死亡或康复。地方必须明确接受各自有限范围：医馆保种权、最低药额与病家看账；庄园以承认现有宗门经营权换最低额、祭扫与药工副契；迁民只签普通药合作、新地代祭。曾失护或违背交种承诺者不能再代地方担保，本次只能签个人核名申诉职责；旧失信不清除。旱年可保最低额并让天府少收，或明确零新增供药，只保查账申诉。副本必须实际送达且可停，才得天界证；拒签不发证，但仍完成离界成长。

鼎想销毁争议、只留“善行簿”。证据法只能及可证责任；共担法只及真实同意的小约。撤开证人与原物、不让活人与亡者站在同一火线，最后把停约权交当事人，才成问鼎。胜利回声分别保留医馆空额、庄园宗门经营与迁居灰谷；`local-supply: none` 始终代表地方新增供药没有成，不能因为问鼎就改称全谷得救。

### 有限冲突与实际后继

| 冲突 | 一次争执中的上限 | 不成功后的真实后继 |
| --- | --- | --- |
| 幽冥核证／护证／裁定 | 三个决定，无重抽／挑战循环 | 缺证赴天门调停；鼎前退回可完成一次明确共担修补 |
| 天界限约／旱季／副本 | 三个决定，无重试发证 | 拒签带异议见鼎；退回可签零新增药额的个人小约、实际送达副本 |
| 鼎前方法／隔火／停约 | 每次至多三个决定；初次与交接后重赴各一次 | 活着退回 `campaign-return`；逐项修补缺证后仅可重赴一次，再退回只能明确安排守望余生 |

普通渡口登记、纠错与每次可选遭遇都是一次选择。`campaign-return` 的修补每完成一项便取得对应缺证，下一变体不会再次出现该项奖励。`reconsider-ding` 保存 `ding-return-used: true`，所以没有无限回头争执、取药、学习或领奖循环。所有守望动作先明示共同经过全部余寿才寿终；退回本身仍为 `playing`。三证齐但拒交停约权仍可失败。

### 六个机会与能力方法

强制主路不在随机池。人间已有护人／辨言两种；幽冥只有引魂灯／药理两种；天界只有定契／燃命两种。每章入机会场景时抽一次并保存，最多学习一项，一生至多三项。拒学始终有无费用后继。保存／读取／回看不抽事件。

| 能力 | 至少两处后续实际方法与限制 |
| --- | --- |
| `shelter` | 幽冥护自愿活证人，自己负伤；天界护副本出强收门，自己负伤；与魂灯在鼎前分隔两侧证言。重伤禁用硬护。 |
| `discern` | 幽冥删去“先救药窖即先起火”的推论，但仍需两份来源；天界发现“历任保管人”的代际连坐；与定契共同固定真实同意条款、免首季亲核。 |
| `soul-lamp` | 幽冥保陈禾已许可片段，不补签令事实；迁居旱季核代祭误记，不增药；与护人保护真实自愿活证人和亡者片段。 |
| `herbalism` | 天界用一包实际药及地方已有普通药材验证有限替药方，不造灵种；鼎前与燃命合用药护实际活证人呼吸。无药不提供耗药方法。 |
| `bind-oath` | 天界限定双方真实同意条款；交副本留下公开可停的印，让共同保管成立。与辨言的组合仍需实际来源登记和学习印的经历。 |
| `burn-life` | 天界五年个人命损开副本短门，有免费正式送达替代；鼎前五年仅护记录通路，或与药理一包药＋三年护自愿活证人；最后可明示必死独压鼎火，绝不得胜。 |

三个组合都能从第一世真实学习选择获得。组合不是额外按钮的无限拼盘：完整变体替换同一位置，每屏至多三项。护人＋魂灯要求温渡活且安全、自愿合作、实际证言与陈禾片段；辨言＋定契要求来源实际登记和印术实际练习；药理＋燃命要求真实药包、自愿合作的活证人。它们分别改变能保的证言、共同约束的方式与通路，而不只是统一费用打折。

**可达性修正：**两项人间给药都会实际用掉唯一药包；天界学燃命又不能同时抽到借药机会。因此药理遭遇有三项：学习药理实际一年；学习一年加医棚服务一年、合计两年换一包救急药；拒绝学习无年耗。真实经过的年数同时推进年龄与世界，药是医者按劳动约定付出的酬劳；同一学习机会只记一次、不可重领。不再声称学习关闭一个额外亡魂问询窗口，也不保存无后继使用的窗口旗标。若已经耗药做替药示范，就没有同一包药再用于鼎火。

### 寿限、年份、命损与首世实走预算

有限境界表：凡人 `mortal` 寿限80、筑基 `foundation`160、结丹 `golden`240、元婴 `nascent`320。境界提升由实际关键交接带来，`lifeLimit = max(旧寿限, 新境界寿限)`；即使未获当界道证，完成交接也可获得通行成长。既有命损不清零。

首版不额外给跨界通行强加整年成本；渡口与天门叙述本身不意味着逝去若干年。实际整年费用为人间学习／测渠／普通救援／共守修渠／普通认证抄账、幽冥普通药理学习各一年，药理学习加医棚服务合计两年，以及自愿终场首季服务一年。世界年份只随这些实际共同时间与明确退休推进。个人命损为学燃命三年、开副本门五年、单燃命护记录五年、药理组合三年；均严格要求当前余寿大于费用，不先升级寿限再借未来寿元支付。必死选项烧尽当前余寿，只增命损，不推进世界时间、不发普通奖励。

下列预算均从 `createJourney({ seed: 0 })` 以公开动作实走，无注入数据，所有可选学习均拒绝：

| 路线 | 动作数 | 结束年龄／世界年 | 命损／寿限／余寿 | 实际代价与范围 |
| --- | --- | --- | --- | --- |
| 医馆、证据问责 | 29 | 19／1003 | 0／320／301 | 测渠一年＋救援一年＋共守修渠一年；原账仍在，药谷公开真相，最低额有限，天府少收，首季复核／保管职责仍在 |
| 焚种迁居、有限共担 | 27 | 16／1000 | 0／320／304 | 温渡失救死亡、灵种毁灭、匿名残证而真相未全破；无新增地方供药，三季核名与首季保管，不能冒称全员救下 |

第一版余寿预算宽裕，生命压力来自自愿燃命、投入服务与有限职责的取舍，并不声称必然逼近寿终。真人对节奏、寿元张力与20–30分钟目标的验证仍待完成；动作数与自动测试不是游玩时长证据。

精确路线（种子均为数字0）：

- 证据：`catch-child → take-medicine → continue-road → pledge-truth → route-ledger → keep-original → route-channel → measure-channel → go-confront → public-hearing → organize-rescue → choose-clinic → handoff-record → travel-nether → shelve-records → correct-record → continue-inquest → verify-sources → protect-sources → judge-accountable → authorize-local → continue-celestial → limit-terms → minimum-share → deliver-copies → evidence-method → separate-fire → share-stop-right → return-duty`。
- 共担：`catch-child → leave-medicine → continue-road → pledge-truth → route-witness → anonymous-record → go-confront → record-limits → evacuate-wounded → choose-ash → handoff-record → travel-nether → shelve-records → freeze-debt → continue-inquest → record-gaps → protect-sources → share-duty → authorize-self → continue-celestial → limit-terms → trial-appeal → deliver-copies → shared-method → separate-fire → share-stop-right → return-duty`。

### Task 6 生命周期与迁移接缝（精确契约）

新增条件仅 `{ kind: 'proof', id: 'mortal'|'nether'|'celestial', held?: boolean }`，省略 `held` 表示持有。新增选择旗标 `victory: true` 只进入 `terminal: 'victory'`。新增明确死亡 `ending: 'burned'` 与既有 `retired` 并列：烧尽余寿只增命损；退休共同经过余寿推进年龄与世界。两者都由引擎原子结算，不附普通 effects/rewards。

- `campaign-victory`：真实正生命 `phase: victory`，summary 的 cause 为 `victory`、outcomeId 为 `bounded-victory`、title 为 `三界问鼎`，generation/age 与当世一致。**尚未结束生命，所以没有当世 biography。** 明确结寿／轮回时只补一次实际人生生平，不再发问鼎奖励。区别：旧v2胜利已有其旧引擎生平。
- `mortal-ended`：共享真实 `ended` 终场，cause 为 `retired` 或 `burned`，年龄＋命损等于寿限，且已有本世唯一生平。致命鼎火当前仍落这个共享终场；已保存 result 与 summary 明确其鼎火死因。
- `campaign-return`：活着的有限修补／安排守望场景，不是结算；缺人间证用 `repair-mortal` 做有限交接，缺幽冥证用 `repair-nether` 实签三季共担，缺天界证用 `repair-celestial` 实签个人小约并送达。均无即时年耗。全部修补后仅一次 `reconsider-ding`，`ding-return-used` 阻止无限重开。
- `nether-arrival` 已持幽冥证：`honor-nether-proof` 直赴天门，不重学／重抽／重判／领奖。`celestial-arrival` 已持天界证：`honor-celestial-proof` 只确认当世个人小约并实际交付副本，不新增地方供药且保留既有制度权利，直赴鼎前，不重领奖。已问鼎者导向真实回顾，不重做终局。迁移／重生保留已完成机会、旧 NPC 年代及原件归档，历史事实不作为今生物品或朋友。
- 新结算 episode：`nether-proof` outcome `accountable|limited`；`celestial-proof` outcome `bounded`；`three-world-ding` outcome `bounded-victory`；仅缺人间证修补使用 `mortal-repair` outcome `limited-handoff`。拒绝不伪造成功 episode。与既有 `mortal-valley`、`mortal-handoff` 同世按单调 sequence 共存。常规首世五条，未覆盖任何谷地 outcome。
- 新 world facts：`dead-debt = frozen|corrected`；`nether-local-right = clinic-dates|estate-work|refuge-memorial`；`nether-verdict = accountable|limited|unresolved`；`nether-duty = source-custody|three-seasons`；`celestial-consent = clinic|estate|refuge|personal`；`local-supply = pending|none|minimum|substitute`；`celestial-terms = accepted|disputed`；`ding-method = evidence|shared`；`ding-complete = true`。这些保留历史，不自动构成新生的同意。
- 新 life facts：`nether-arrival-recorded`、`lamp-duty`、`chen-fragment`、`sources-protected`、`paired-testimony`、`oath-practiced`、`bounded-terms`、`first-audit`、`joint-seal`、`herbal-demonstration`、`copies-delivered`、`delivery-served`、`ding-first-audit`、`fire-crossed`、`ding-established`、`first-season-served`、`ding-return-used` 为布尔；`nether-case = accountable|limited`；`copy-custodian = self|joint-seal|volunteer`。重生重置当世授权，不把此前自愿家属变成永久代理。

存档集成测试改为明确代表路线：两条胜路、真实退休、幽冥拒绝后有限修补。每个选中边界校验 state/view 的往返，以及该边界每个可见选择的 next result、RNG与恢复后 stale；不递归枚举所有正文排列，也不声称穷举。

## Task 6 已实现：生命周期、后世责任与旧人生交接

### 人生与历史

- `chooseJourney` 仍是唯一新规则玩法入口。`ended/victory` 的公开选择直接开下一世；有沿用项时是一项沿用加至多两项真实替换，没有沿用项时至多三项真实候选，无候选时只有记忆新生。候选来自实际学会的方法、当世实成的两项后世成果，或在对应方法的亲学中重新唤起的已得旧藏；已得历史不因候选展示上限而删除。候选顺序按真实方法／唤起／后世成果的有限优先表取末项，旧沿用项固定保留。
- `world.legacies` 是新规则的真实已得历史，不等于当前装备。实际学习即记录对应 `*-memory`；共议医馆记录 `valley-seed`，共同凡药园记录 `plain-medicine`。这两个新规则经历不是死后赠礼。旧规则的“候选尚非所有”仍严格适用旧存档：未选旧候选只留在原档，旧结算必须亲自选一项，迁移不会把所有候选改成拥有。
- 新世只用一个 `life.legacyId` 取得一种方法，不叠加旧数值、物品、同方法历史名字的收益。机会在继承确定后选择，排除已继承的方法，保留有用的另一种真实机会。对应旧藏在实际亲学中以 `recalled-旧ID` 记为当世唤起，允许下一世选择原名；不会另发能力或物品。
- `revision` 跨人生单调增加。新生命年龄16，世界年加16，旧人物按真实共同岁月自然老去；个人命损不推进世界年。原始人物出生／死亡年保留。此前合法但未存年代的初代 v3，在下一次实际选择时补入既定原始年代（沈芷968、陆槐924、温渡943）；已死而无确切死亡日期者不编造死亡年。
- 正生命胜利保持活着，下一世选项明确列出先共同走过的余寿；寿终时只补一条详细 `cause: victory` 生平，不重发终局、道证或任务奖励。旧胜利已经有旧生平，迁移不再追加。普通死亡／退休本身不奖励。
- 当世能力、物品、授权、首季职责与机会重置；原始账页若确实仍由上世持有，明确移交档案，`held → archive`，不制造下一世物品。历史证据质量仍是历史事实。当前见证陪行意愿清为false，不能把旧家属当永久代理。永久供药权、种权、接受的旧约与历史违诺保留。
- `transcript` 完整持久保存，`life.facts['transcript-start']` 标明当前行文起点；生平只复制该世自己的实际行文，避免每一世递归复制全部前世。阅读流默认显示今生，在同一页可展开历世生平、前世完整行文与旧档记录。旧历史不同字段保持原样，旧档未知部分不编成新事实。

### 后世三条真实责任

`later` 章按实际谷地结局选唯一匹配分支，不再次调查旧火；`mortal-clinic / mortal-estate / mortal-refuge` 为世界稳定任务，拒绝跨世重复奖励。原始谷地安排和后世任务分别记录，不能互相覆盖。旧记录中的 `unfinished` 不计为已完成。

|任务|实际责任|保留的结算 ID|
|---|---|---|
|医馆|病情／出资户排序；实际服务补药、供药债或如实限量；药足后共议或守簿签责|`clinic_open_council / clinic_keeper_rule / clinic_sect_debt / clinic_rationed`|
|庄园|先取得祭扫或祭扫加供药的真实代表授权；限量副契与双钥匙，或只开清明小门|`estate_shared_supply / estate_grave_access / estate_unchanged`|
|迁民|承认旧账、可自愿补当前药费；以实际服务建凡药园或小药圃；先定收成、损失与守园口粮|`refuge_common_medicine / refuge_family_medicine / refuge_small_plot / refuge_unchanged`|

- 这些是替代分支，非三项连续必修。所有有限结果／拒绝也关闭这项委托。再次到来只读对应结局的短回声；全完成导向真实有限回顾，不宣传未实现的新远征。
- 医馆实际补药用两年服务；供药债优先于缺药，缺药不能凭公布账簿变成覆盖。旧供药债不因后来共议而消失。
- 庄园不能超出仅祭扫的授权获取最低药额。工资和经营权仍属原制度；祭扫权不等于迁骨、清魂债。
- 凡药园一般服务两年；确有原安全救援记录（新 `survivor-line` 或旧 `legacy-safe-rescue`）可得真实旧排水图，缩为一年。伤害／未知不授权此图。共同园安排损失和口粮；家户园另服务一年付冬费。小圃和拒绝无需资源，任何路径均不能复生灵种或故人。
- 后世人物称现任／接任人，不冒认沈芷的母亲或温渡的亲见身份。新主角不继承前人个人承诺的行为主体，但历史失诺仍影响现今信任。
- 后世结算后保持活着，直达未完成的幽冥／天界责任。已有幽冥纠债／暂封而未获证者接续核证，不让同一债重新绑住陈禾。已有三证但未问鼎者仍去天门确认今生个人有限职责；不能仅凭旧证跳过当前同意。已经问鼎者进入有限回顾，须显式走完余生才结寿。

### 十种旧传承与来源

保留旧 ID、原名、原 source；`plain-medicine / valley-seed / golden-furnace → herbalism`；`sword-echo / city-oath / iron-bone → shelter`；`tomb-lantern → soul-lamp`；`debt-released → bind-oath`；`sword-heart → discern`；`realm-memory → burn-life`。每项另有一句来源说明，明确不复生毁种、死者、失去的盟友，不凭“无债”旧名清掉后来魂债。原始 `meta`、`run`（含已携带／候选）、`story`、`summary` 和全部旧状态保留在 `world.legacyArchive`，完整旧验证器继续验证它。

### 旧结算与保存协议

- `getLegacyBridgeChoices` 只在合法旧 `ended/victory` 且奖励已明确择定时返回。先保留旧结算的一选N奖励，再显示两项实际旧携带＋真实已选奖励（按旧ID去重），最多3项；不是永久收藏任取或无声默认。
- `migrateLegacyLife` 验证旧完整状态，纯构造下一世，只加一次世代和16年，不调用旧死亡、结算或奖励逻辑。原有道证、胜利计数、旧事实／记录、原始生平与人物年代保留；旧证据类别不升级成新实物、完整证言授权或当前陪行。
- 当前保存键保持 `baishi-wending-save-v1`。一个独立 `-legacy-handoff` 记录保存 `originalRaw / previousRaw / currentRaw / checkpointRaw / preparedRaw`。有效旧 load/import 捕获精确源文本；第一次会替换源文本的旧规则 autosave 前先写原档备份并读回核实，之后保持同一条旧人生链的原始字节。
- 交接先构造并验证一次新人生，再把精确原档、当前已结算检查点和准备的新档一起备份并核实，最后写当前键。写失败留在旧结算，可导出三者并重试；刷新从可核实的旧检查点恢复准备状态。同一准备结果重试不会再取种子或加16年。旧备份的检查点、目标归档、世代和年份必须一致。
- 成功的交接 UI 不再调用普通 autosave 覆盖交接状态。准备未完成时普通 persist 不得暗中覆盖旧键。原档／检查点／新档导出在旧结算与「更多」设置中可用；非数据破坏写失败无须重开。
- 导入、重置与迁移使用当前情境焦点；真正的选择仍聚焦本次后果。Node 控制器测试覆盖了导入数步后的现存情境，不主张浏览器视觉验收。

### 本次连带修正与未覆盖边界

识破＋定契共同印约的首季亲核豁免在最低份额、替药与副本交付后保留； shortage 的职责文本说明沿既定分工，不重新要求已豁免的个人亲核。旧证确认保留世界既有最低药额与原同意范围，只另记当世个人职责。

Task6 历史交付时把草药机会的虚构额外问询窗口留给 Task7；Task7 已删除该效果，并落实普通学习一年、连同服务换药共两年的真实成本。20–30分钟真人时长、寿命压力或320px视觉仍未验证。仍是原生JS、零运行依赖、本地保存；未增加账号、服务端或一般事务框架。

### Task 6 复核修正：旧事实与未完成保存

- 旧战斗问鼎只写 `legacy-victories`，不据此写新规则 `ding-complete`。旧胜利者完成相关地方交接后进入「旧途问鼎的回声」，明确胜利不是新有限立约／药额／停约权的证据；不重打旧终局或发奖。只有实际 `three-world-ding` 记录才进入「三界已有其约」。
- 旧引擎可能跨世重复同一后世委托。v3 只保留一个完成标记，但回声读取原始按时序保存的全部对应记录，区别历史委托和现存制度。既得共议、供药债、最低药额／双钥匙或共同药园不会因后来的限量、拒绝、未竟委托而被当作从未达成；回声同时列出这些后来结果，不丢完整来源。
- 普通旧规则 autosave 也可能先成功备份、再失败替换当前键。刷新识别 `previousRaw → currentRaw` 分叉时维持旧当前档，显式标记未保存，提供同页「恢复较新旧人生」及精确导出，恢复前暂停玩法落子与迁移。明确恢复只写已经验证的较新状态，不重放行动／奖励，也不自动迁移。临时备份读取错误可通过同一恢复入口或明确迁移重试重新读取；格式错误的备份不覆盖。重新读取发现的更早原始v1字节继续作为 immutable original 使用。

### 最终复核修正：未知旧史与存档长度

- 旧v1来源没有谷地结局时，直到真实问鼎回访仍明确旧卷缺失、谷地与灵种状态未知；只陈述今生实际签成的有限条款。灰谷与迁民回访只适用于明确 `ash_refuge`。缺人间道证的修补核实现有承担，不再假设曾经留下未认证药谷交接。
- 导入和导出共同遵守1,000,000个JavaScript字符串字符上限；v1升级后的实际v2状态也须在上限内。文件选择器预读上限按每个JavaScript代码单元最多三个UTF-8字节推导，避免合法中文导出被更小的字节限制拒绝；最终仍以字符上限校验。正文与生平不截断。若真实选择或新生会超过上限，整步不提交，原行动令牌、物品、年龄、年份、RNG与历史保持不变；当前有效档仍可导出、重导入。达到这一历史容量边界后不能保证继续推进，新选项不会暗中删史来腾出空间。旧人生的规则不变，控制器也在接纳新状态前检查同一存档边界。
