# Workers AI 实时剧情接入档案

## 新授权：受控四步续验

用户已明确确认12次/900 Neurons、Task1/7/8为4/5/3。原8次/450及每笔失败继续保留，最多新增4次、失败即停；详见[已确认的续验计划](superpowers/plans/2026-10-28-controlled-reacceptance.md)。下方11/800记录属于前一轮历史，新的部署与真实结果另行留证。

## 2026-10-28本轮续办：私有诊断与正式生产准备

本轮仅完成代码、fixture验证和只读核查，没有新模型调用或部署。北京时间14:12:14再次回读原账本为8次/450，Task1/7/8为4/3/1、无S1；11/800及4/5/2原上限不变。[拟议12/900续验方案](superpowers/plans/2026-10-28-controlled-reacceptance.md)尚未授权或应用。

之后的Task8终态可在同一原子结算中保存固定私有observation：provider/API-scene/API-envelope阶段、固定错误/结构类别、实际输入SHA-256/字节数、验证后的usage/stop/non-thinking及延迟。回执验证canonical observation hash；终态不可改写、删除或补写旧诊断。原场景、reasoning、任意异常文字、凭据与cookie不进入该记录，公开响应与玩家缓存保持原封装。旧8笔仍保持原样，上一轮具体拒绝原因仍未知。

提交给模型的schema已加入block/entity/memory条件字段、非空文本与控制字符限制；完整input仍在12,288字节内。跨项唯一性、UTF-16长度、引用、机械事实与后续上下文等仍由原runtime验证。新增本地通过不等于Cloudflare当前模型已遵循schema，真实质量门槛继续待验。

基线登记允许完整保留前面的failed Task8，再登记首个有效成功开场；不能跳过reserved、unknown或已有成功来源。`retryOf:null`的原始开场证明仍必需，后续新验收使用独立测试档案，保留已有失败pending。正式生产路径、默认CI关闭行为及原namespace复用见[部署说明](DEPLOYMENT.md)，本轮全量验证见[QA](QA_REPORT.md)。

## 上一轮实际推理与部署状态（保留历史）

最近核验：2026-10-28 13:30:22.097699（上海时间）。**当前状态：已审74aa私有helper与tester-only stage已部署；获批准四步的首个Task8浏览器开场被严格校验拒绝，按失败即停规则结束本轮推理。** 原账本现为8次、450 Neurons预留，Task1/7/8为4/3/1次，全部 `actualNeurons:null`；原7行与三笔Task7 cases逐值保留。用户确认的Workers Free、11次/800 Neurons及4/5/2上限不变。出生/pending保存与刷新读取同一拒绝结果已实际验证，但没有S1，baseline、两条Task7分支及真实choice均未执行，Task7/Task8完整门槛仍未完成。保留当前V5兼容stage，公开推理关闭、模型未验证、生产白名单为空；proof自然过期后未追加模型调用。没有升级套餐、购买credits或启用付费后备。

## 2026-10-28 继续执行的证据

### 最新实际结果：74aa部署成功，首步拒绝与恢复已验证

13:22:29.490取得新的整账户、当日GraphQL观察：7次、3285输入/2366输出tokens、87.29505348205566聚合Neurons；由该次真实观察构造的受控proof保留原时间，有效期至13:27:29.490。执行器在下载/重建包之后取得观察，未刷新旧模板时间。13:22:32.522完成两份74aa包上传与读回，当时proof年龄3032毫秒；18模块helper及17模块stage全部哈希匹配，本地正常fresh builders也复现全部35个模块哈希。

| 已部署74aa产物 | 实际身份 |
| --- | --- |
| 源码 | `74aa25884c5468d9eb90abb1bbb82ba92752ba0b` |
| Helper deployment / version | `a3cccc55-406e-4785-8a75-90d1f457f080` / `40e56059-5c3f-4d77-9df9-ac5f01e63dcf` |
| Stage deployment / version | `73aedb80-4191-42a7-8ab5-263821acb05d` / `c44a3a9d-b9d6-4d78-95cb-0eae37d8610b` |
| 当前页面 | 74aa内嵌HTML；970046字节；SHA-256 `3c3b09de319e2032c3990867780998d67adcb6af62fc9fe0a78cb35fdf46b5b0`；embedded |
| 持久状态 | 原StoryBudget与实验namespace、固定对象和 `experiment-v1` 全部保留，无迁移或重置 |

13:24:56.749，真实浏览器只执行一次Task8 opening，返回 `GENERATED_SCENE_INVALID`。新记录以failed结算，永久保留111 Neurons，累计8次/450、Task1/7/8为4/3/1。provider的细分诊断没有进入公开响应，Task8桥也未保存该诊断；目前不能定位具体非法字段，更不能把旧Task7的 `ACTION_PAIR_INVALID` 归给这次失败。没有accepted场景或S1，因此没有注册baseline、执行分支A/B或进行真实choice；本轮没有自动重试或第二次Task8调用。

出生与opening pending已持久化；刷新只GET同一缓存拒绝结果，未再调用模型。13:29:03.747349只读核对账本仍8/450，原7行和三笔cases保持不变；刷新前后 `runs/pending/history/memory` 四个IndexedDB stores逐值相等。本次实际通过的是单次请求、拒绝留档与刷新恢复这一局部失败路径，不代表ready场景提交、S1、真实选择闭环或Task7质量通过。详见 [浏览器与恢复证据](evidence/shared-opening-browser-2026-10-28.json)。

13:29:11.444后续整账户当日GraphQL观察为8次、4363输入/2812输出tokens、105.87210083007812聚合Neurons。两次GraphQL值均是可能延迟的账户分析观察，不是账单金额或精确余额，不能用聚合差值给单次attempt填写actualNeurons；全部450实验预留继续保留。后续查询没有更新部署证明，proof仍于13:27:29.490自然过期。13:30:22.097699最终只读health确认74aa/embedded/970046；无permit实际返回 `TESTER_PERMIT_REQUIRED`，有permit因proof过期实际返回 `FREE_BOUNDARY_UNVERIFIED`。测试浏览器已关闭，没有延长TTL或追加模型调用。当前保留兼容V5的74aa stage以读取已保存birth/pending，不退回缺少该读取能力的旧HTML；`publicEnabled:false / modelValidated:false` 与空生产白名单保持不变。

源码对应 [CI40636654680](https://github.com/ct1150/wending/actions/runs/40636654680) 通过655/655项测试、134项JavaScript语法和14模块默认后端打包。CI merge `bbce147f11b00de7003340943d2e38f54f5cf3ad` 与74aa源码同树 `e19215b7fec41cfa799aa9db0d60ec175a44dd55`；已部署受控包的18/17模块另行核对，不把代码CI或部署成功记为模型验收通过。

### 2026-10-28 13:17:18历史检查点：受保护首轮部署与上传前暂停

用户已明确批准[共享开场四步](superpowers/plans/2026-10-28-shared-opening-acceptance.md)：Task8真实浏览器开场→同S1的Task7分支A→分支B→Task8真实选择、保存和刷新；不需要再次请求此顺序的授权。Task8每次固定预留111，Task7按实际输入估算、每次上界111；按四次各最多111保守估算，累计至多11次/783 Neurons。任何拒绝、未知、保存失败或不可用S1均暂停，没有额外重试名额。

初次部署采用 `deba31b55bfe3f486cab3365bec6abeb1d18bf0c`：私有helper18模块、stage17模块均已逐模块读回SHA-256核对。原StoryBudget namespace `1de1df3929534a8d8d495d6db6604e99`、原实验namespace `dfb218f2f29d4ecab2395f8a00b48350`、固定对象及账本保持不变。当时首页由stage提供deba内嵌HTML，970046字节、SHA-256 `3c3b09de319e2032c3990867780998d67adcb6af62fc9fe0a78cb35fdf46b5b0`、`releaseSource:embedded`。该检查点浏览器只用正常TLS打开主页，尚未触发API、AI或建立档案；之后的真实首步另记于上节。

生产只读诊断直接观察到模块顶层 `Date.now()=0`，同一原proof在模块初始化时被 `restoreFreeBoundaryEvidence` 拒绝，而在请求上下文可完成重建。原stage factory把初始化错误永久缓存，导致无permit请求也返回 `STORY_STAGE_CONFIGURATION_INVALID`。修复 `74aa25884c5468d9eb90abb1bbb82ba92752ba0b` 将policy验证移至请求内readiness，保留账户、permit、5分钟/UTC日期及全部预算门禁；没有刷新旧proof。原生打包入口与明确标注的生产启动时钟模拟回归均通过，不能将本地workerd的非零顶层时钟描述为生产复现。

该修复的CI在13:17检查点已通过，但当时尚未替换Cloudflare上的deba版本，stage配置错误阻止了推理。13:22后74aa实际部署成功；生产白名单仍为空、模型仍未验证，不能将当时的上传前状态继续当作当前状态。

13:17:18只读账本当时为7次/339，未新增预留或推理。为避免大包传输消耗proof的五分钟窗口，准备了明确不可部署的过期模板；执行器须先下载/重建已审包，再进行新的整账户当日GraphQL观察，仅替换proof、重核全部模块哈希并检查时效。当时刷新命中五分钟限流，停在PUT前，并约定13:22:18后重查；随后已取得上节13:22:29.490的新观察。模板保留原12:41:02.653观察，没有改旧时间充当新证明。

### 2026-10-28早期兼容部署历史

逐次记录见 [`evidence/workers-ai-rollout-2026-10-28.json`](evidence/workers-ai-rollout-2026-10-28.json)。账户所有者明确回复“是free套餐”，按所有者确认记录Workers Free，不声称订阅API已恢复权限。早期后端部署 `8dd97750-8fd4-40c9-a6c9-c3c61f72a6a2`、版本 `b4fb827d-aa78-4062-9510-299f11f11064` 当时接收100%流量；回读确认直接AI binding与 `use_sqlite:true` 的StoryBudget namespace。当时能力与会话接口返回 `INFERENCE_DISABLED`，旧版前端正常提供；该记录不是当前74aa stage的部署身份。

### 2026-10-28 11:42:46历史检查点：v3开场拒绝与离线准备

私有helper已部署源码 `bc7427097f606348351944cb4085942b0fa45905` 的16个模块：version `ce2eb3a2-04fd-48e2-84f5-ff817057a545`、deployment `7556b818-9270-4f0b-a9c7-f5f3bb8440cc`。继续使用原namespace `dfb218f2f29d4ecab2395f8a00b48350`、固定对象 `wending-realtime-acceptance-v1` 和 `experiment-v1`；没有迁移、重置或换账本。对应 [CI40626224045](https://github.com/ct1150/wending/actions/runs/40626224045) 通过618/618项、130项语法和14模块默认后端打包，publish跳过；默认产物与16模块私有helper分别核对身份。

2026-10-28 11:25:22—11:25:28（上海），`task7-20261028-003` / `task7-opening-v3` 被拒绝为 `GENERATED_SCENE_INVALID / ACTION_PAIR_INVALID`。原正文未保存，不能确诊具体非法字段或配对。该次保守预留83 Neurons，原两次失败及Task1四笔均未改写；累计Task1/Task7/Task8为4/3/0次，三笔Task7全部failed，总预留339，实际账单Neurons仍未知。11:42:46只读检查确认原7行、results、cases和既有部署均未变化；公共前端仍为4.0.0、main `e247a875`，生成关闭。

后续仅离线准备并独立复核：生成schema通过oneOf表达19种合法行动配对，并验证133种非法配对不能通过；运行时校验器保持原约束。Task8服务器在严格校验ready场景后计算 `acceptedSceneHash = SHA256(canonicalStringify(scene))`，complete结算持久化该摘要并验证桥返回的确认，failed/unknown不接受摘要；首次终态及摘要不可更改。私有baseline核对该记录与contextHash，再从上下文和场景重算S1并比对浏览器保存状态，两条固定Task7分支各自从同一S1推进。摘要证明服务器接受过场景，实际浏览器提交仍须现场观察。

在该历史检查点，上述新增代码尚未部署或真实调用；此后deba首次部署，74aa修复版又完成一次被拒绝的Task8开场，最新结果单列于上节。本地全量646/646项通过，失败/取消/跳过/todo均0，用时80.4605秒；133项JavaScript语法通过，HTML970046字节，覆盖原生Chromium、workerd/SQLite和1000回合fixture。新增源码 `b780a84` 的 [CI40628818519](https://github.com/ct1150/wending/actions/runs/40628818519) 已通过646/646、133项语法与14模块默认打包，publish跳过，不能用 `bc742709` 的618项CI代替本次代码验证。

该历史检查点形成的[共享开场新顺序](superpowers/plans/2026-10-28-shared-opening-acceptance.md) 当时待批准，此后用户已明确确认，当前执行边界见上节。开场只计Task8一次；这能验证的范围是一幕真实开场、同基准两条单步反事实和一次真实玩家选择闭环，不能声明更深连续叙事已通过。任何拒绝、未知或保存失败均暂停，保留预留且不自动重试。Task7/Task8和公开发布门槛仍未完成。

### 2026-10-28早期接入历史记录（上海时间）

账户级 GraphQL `aiInferenceAdaptiveGroups` 已成功读取，范围覆盖同一账户当时 UTC 日起点至实际观察时刻，没有按模型、Worker 或成功状态缩小范围。2026-10-28 07:49:50.533（上海）的查询未返回用量记录。此结果只表示该观察集中没有记录，不能证明实际用量为零或精确剩余额度为 10,000。跨 UTC 日或超过五分钟须重新观察，保留真实 observedAt，不刷新旧证明的时间戳。

控制者对已有证据入口的解释：`accountUsageVerified:true` 表示已实际核对同账户、整账户、当日的用量观察；`remainingNeurons` 是基于该观察折减后的受控 probe 准入上限，**不是账单余额或有数学保证的即时可用余额**。本轮取 `min(800,max(0,10000-observedAggregateNeurons-额外保留量))`，同时继续扣除全部既有实验预留；额外保留量须在证据中明确记录，不为获得正值反向选择。实际账单 Neurons 与实际余额均保持 `null`。分析数据可能延迟、其他项目也可能并发消耗；这影响请求可用性，由已确认 Free 的平台硬限制拒绝超额，不触发 Paid 计费。Cloudflare 明确说明 [GraphQL Analytics 不是账单计量依据](https://developers.cloudflare.com/analytics/graphql-api/#limitations)。

新操作员 Worker 只承载私有验收：令牌摘要鉴权、固定候选和固定输入、同一 SQLite 对象共享 Tasks1/7/8 实验账本、先持久预留再单次调用。任何证明刷新或 Worker 更新都必须保留同一 namespace/object/账本；没有清空、退还、自动重试或生产启用入口。模型 profile 仍未验证，真实样本须独立验收后才能进入生产白名单。

首个真实样本 `task1-20261028-001` 于2026-10-28 08:03:44（上海）发起：延迟3072ms，中文JSON/结构/stop通过，usage为59输入、375输出、434总tokens；永久保留24 Neurons实验预留，实际记账Neurons未测，仍为null。当时记录响应带非空reasoning_content，未测是否纯空白，不能通过该检查点的生产验收。根因调查参照 [Qwen官方说明](https://github.com/QwenLM/Qwen3/blob/main/docs/source/inference/transformers.md)：默认会思考，支持消息中的 `/no_think` 软开关。当时只给固定probe系统指令追加该开关作为单一假设；后续诊断与解析器适配另见下节。

### 2026-10-28基础能力样本终态（Task1配额已用完）

同一持久账本的Task1分项记录四次真实调用，该分项保守预留96 Neurons，不能重置或归还。所有小schema样本中文/JSON/正常stop通过；当前累计实验次数见本页最新检查点，以下完整游戏样本按历史顺序保留。

| 样本 | 配置 | 输入/输出 tokens | 延迟 | 思考字段诊断 |
| --- | --- | --- | --- | --- |
| 001 | 原中文提示 | 59 / 375 | 3072ms | 非空；未测字符数，不回推是否为空白 |
| 002 | 加 `/no_think` | 63 / 108 | 1064ms | 非空；未测字符数，不回推是否为空白 |
| 003 | 相同 `/no_think` | 63 / 82 | 736ms | 2个字符，无非空白字符 |
| 004 | 相同 `/no_think` | 63 / 86 | 591ms | 2个字符，无非空白字符 |

后两次重复观察确认 Cloudflare 返回空白占位。共享生产解析器原先按 truthiness 拒绝它；已审修正仅允许缺失/null/空串/纯空白字符串，继续拒绝有实际内容的思考字段和异常非字符串类型，并给完整游戏提示追加同一 `/no_think`。共享provider的67项定向及独立复核通过，未自动晋升 profile。原先 reasoningPresent 字段的语义保持“非空字符串”；只有新增诊断支持后两次的空白结论。

2026-10-28 08:12:26.020（上海），同账户当日分析查询返回4次、248输入/651输出tokens和20.985971450805664 Neurons，与这批token计数对应。该值是分析观察，不是实际账单金额或精确余额；`actualNeurons`仍为null，96的实验预留也不退还。当时采用10次/800及4/4/2上限；用户随后批准11次/800及4/5/2，历史已用额度照旧累计。

### 2026-10-28历史检查点：首个完整游戏样本与契约修正

私有完整剧情验收器已独立复核至本地 `7fe621c`，与远端 `cb623939` 同树；[CI40608803737](https://github.com/ct1150/wending/actions/runs/40608803737)通过574项测试、125项语法检查和14模块后端打包。实际CI merge tree已核对。该结果证明对应代码的本地行为，不代替模型质量，也不覆盖后续正在进行的修正。

2026-10-28 08:30:11（上海）发起的 `task7-20261028-001` 使用5314字节完整输入、预留77 Neurons，实际usage为823/563/1386 tokens、正常stop、延迟5888ms，但返回 `GENERATED_SCENE_INVALID`。同一SQLite账本已保存failed状态；截至该检查点，旧四笔记录不变，累计5次调用、173预留。没有推进人物状态或依赖此开场的后续调用，Task8尚未开始。逐次状态以接入证据为准。

被拒绝原文未保留，所以不能断言具体哪个字段出错。本地用同一provider与原结构校验器复现了11类当前schema允许、运行时拒绝的结构，包括speaker条件、intent/approach配对、人物/记忆状态条件和中文ID后缀。本地修正已明确既有契约、给ID加入同一ASCII模式，并只输出固定类别的脱敏诊断；该检查点的70项provider/契约定向与33项新版runner定向通过。当时独立复核尚在进行，范围 `cb623939..6daca6a8` 随后已复核通过，基线CI结果见接入证据。现有运行时校验器逐字节不变，不修补无效正文、不提高输入或实验上限。该次固定输入开销5189字节，加7000字节有界上下文仍在12288字节内，余99字节。

该检查点采用另有版本的固定开场S1、同S1的两条不同选择分支；这符合一次连续推进与同基准反事实取样，但不声称原先S2深度序列通过，也不测试第二层连续记忆。随后实际执行的v2开场也被拒绝，以下保留当时回读与修正记录。

### 2026-10-28历史检查点：原账本回读与ID命名范围修复

2026-10-28 09:08:21.858083（上海）从原操作员对象读取的持久记录确认，`task7-20261028-002` / `task7-opening-v2` 已真实调用：6659字节输入、预留83 Neurons，usage为1085/581/1666 tokens、正常stop、延迟4838ms，结果为 `SCENE_ID_SCOPE_INVALID`。该错误涵盖场景或选项ID前缀；拒绝正文未保存，不能进一步断言是哪一个字段。回读是补齐已存在记录，不是该轮新增推理。当时累计6次/256预留及两笔失败结果已回填接入证据，后续第七笔不改写这六笔历史。

新修正先验证上下文，再将实际人生namespace和回合号写入系统指令及本次schema：场景ID使用单值enum，选项ID必须匹配同一前缀；人物、动作目标与旧记忆引用保留原合同。原运行时校验器不变，不修补被拒正文。新增回归实际经历RED→GREEN，15项验收测试及合并18项既有provider测试共33项通过；独立审查无Critical/Important/Minor发现。最大安全回合号加7000字节编码上下文时输入12240字节，仍低于12288上限，余48字节。此结果不是模型复验或生产profile晋升。

原开场和v2开场的failed记录、固定case墓碑及全部预留永久保留。在该历史检查点，原4次Task7分项只剩2次，而新开场和两条反事实分支需要3次，因此当时暂停推理。其后用户已批准Task7上限5次、总上限11次，且v3开场已失败；当前余量与再次暂停原因见本页最新检查点。所有版本均不重置记录或借用Task8保留的2次，公开生成仍关闭。

## 2026-10-27 历史证据与当时阻塞

只读检查由本次任务控制者执行，脱敏结果见 [`evidence/workers-ai-runtime-2026-10-27.json`](evidence/workers-ai-runtime-2026-10-27.json)。此前规划观察见 [`evidence/2026-10-27-workers-ai-planning-recon.json`](evidence/2026-10-27-workers-ai-planning-recon.json)。

| 项目 | 已观察结果 | 能证明什么 |
| --- | --- | --- |
| 账户 subscriptions | 2026-10-27 17:03:58.150 UTC再次只读查询仍HTTP 403；此接口没有可用OAuth scope，需要Billing Read或Write API token，重连OAuth不能解决 | 无法判断实际 Free/Paid 套餐；不能开启推理 |
| workers/account-settings | `standard` | 不是 Free/Paid 订阅证明 |
| 既有 Worker binding | 规划只读检查为 `[]` | 当时没有 AI binding；不是当前临时环境验证 |
| 候选模型目录 | 规划检查 HTTP 200 | 仅证明目录可读，不证明调用权限、JSON Mode 或剩余免费额度 |
| 账户其他项目用量、剩余额度 | 未验证 | 不能把整个免费额度预分配给本游戏 |
| AI/协调存储零付费边界 | 未验证 | 实时上线门禁仍关闭 |
| 中文、结构化输出、停止原因、思考文本、实际用量 | 未执行真实推理 | 没有有效延迟样本；结构通过率为 `null`，不是 0% 或 100% |

如果不能取得相同账户的可信套餐、用量和硬限制证据，则保持关闭并保留待办。`standard`、模型目录成功、应用自己的预算计数、AI Gateway spend limits 均不能替代零付费证明。[AI Gateway spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) 是最终一致的控制，请求完成后才登记费用，并发请求可能短暂越过限额；不能作为严格零费用边界。

## 官方政策与候选模型

2026-10-27 查阅 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)：账号每天共用 10,000 Neurons 免费额度，UTC 00:00（北京时间 08:00）重置。Workers Free 耗尽后失败；Workers Paid 超出免费额度按 **$0.011 / 1,000 Neurons** 收费。部分模型需要付费套餐或预付 AI Gateway credits。**本项目只允许已确认 Workers Free 的直接 AI binding；不使用 Gateway Unified billing、预付 credits、付费后备或自动升级。**

候选为 `@cf/qwen/qwen3-30b-a3b-fp8`。当前官方定价是每百万输入 tokens 4,625 Neurons、每百万输出 tokens 30,475 Neurons。[模型页](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)列出 32,768 上下文和 `response_format`，但 [JSON Mode 支持列表](https://developers.cloudflare.com/workers-ai/features/json-mode/)没有列出这个 Qwen3 模型。2026-10-28 已有四次小 schema 中文结构通过，两次同配置诊断确认思考字段仅含空白；完整游戏 schema 与叙事质量仍待后续验收，没有生产模型被锁定。

后续若候选不满足要求，记录真实失败，在免费白名单内通过明确变更重新选择；不静默切换模型。这里只维护一个候选，所有其他模型 ID（包含未知和付费模型）一律拒绝。

## 固定本地接口

模块：`src/worker/story-config.js`。纯 ESM，没有导入时 I/O。

| 导出 | 用途 |
| --- | --- |
| `STORY_LIMITS` | 输入 12 KiB、HTTP 请求 32 KiB、响应 64 KiB、输出 1536 tokens、30 秒等待、最多 8 条消息；受控 probe 的余额快照有效期不超过 5 分钟且不得跨 UTC 日 |
| `EXPERIMENT_LIMITS` | 用户已批准共用最多11次、800 Neurons；Tasks1/7/8最多4/5/2次，原历史记录全部累计 |
| `CANDIDATE_MODEL_ID`, `CANDIDATE_PROFILE` | 候选能力档案；`validated:false`、`supportsStructuredOutput:null`、`freeBoundaryEvidence:null` |
| `PRODUCTION_PROFILES` | 当前为空且冻结；真实验证并审核前不能用于生产 |
| `confirmFreeBoundaryEvidence(raw,{now})` | 仅供可信账户验证器/操作员代码调用，校验并生成进程内品牌化、冻结证据 |
| `restoreFreeBoundaryEvidence(persisted,{bindingAccountId,currentPlan,now})` | 可信服务器入口重建已验证的部署证明，要求绑定账号/证明账号/当前Free套餐一致，保留原checkedAt；不是新的余额核验 |
| `assertProviderReady(options)` | 校验模型、明确启用、AI binding、可选实验账本、可信新鲜免费证据、剩余额度与用途；通过时返回 profile，否则抛出只有固定 `code` 的错误 |
| `estimateMaxNeurons(input,{modelId})` | 对完整消息、系统指令和 schema 的 JSON UTF-8 大小核算，按最大输出预留整数 Neurons |
| `createExperimentLedger()` | 建立空的可序列化实验账本；不得通过新建账本绕过已用预算 |
| `reserveExperiment(ledger,{task,attemptId,reservedNeurons})` | 在执行前以不可变更新登记上界，拒绝重复 attempt、总额/次数/分任务上限 |
| `settleExperiment(ledger,attemptId,{status,actualNeurons})` | 登记完整/失败/未知；不回收本轮实验预留；已知实际消耗不得被清零或降低 |

`assertProviderReady` 参数为 `{enabled=false, modelId=CANDIDATE_MODEL_ID, env, evidence, purpose='production', ledger, reservationNeurons=0, now=Date.now()}`。`purpose:'probe'` 只允许受控验证候选；其他用途都必须匹配已验证生产 profile，因此当前始终拒绝生产推理。

品牌化证据只避免把普通 JSON 直接误当可信证据，**不代替服务器鉴权**。可信构造器只能接收操作员/账户只读核验的材料，并确认其属于 `env.AI` 对应的同一账户。API 路由不得从浏览器请求构造 evidence、enabled、modelId、profile、账本或套餐信息。浏览器伪造的序列化对象不会通过品牌检查。现有 `src/worker/index.js` 仅从可信部署配置取得材料，经 `restoreFreeBoundaryEvidence` 再调用生产 `assertProviderReady`；浏览器不能提供配置或绕过此路径。

证据必须同时满足 `source:'operator-account-verification'`、`plan:'workers-free'`、`hardLimit:true`、`directBinding:true`、`noGatewayCredits:true`、`accountUsageVerified:true`、`storageFreeVerified:true`、有限且不超过 10,000 的 `remainingNeurons`、未过期的 `checkedAt`。当前受控验收按上述新增证据解释构造证明；不得把历史观察冒充新鲜余额，也不得由客户端构造。

5 分钟时效针对 **受控 probe 的当前余额快照**。生产门禁不会把它当作持续游玩的计时器，也不要求操作员每5分钟手工确认。现有生产入口已区分可信部署证明与动态余额：`restoreFreeBoundaryEvidence` 要求 `persisted.accountId`、`bindingAccountId` 与可信 `currentPlan.accountId` 一致，且当前方案明确为Workers Free；按原观察时间复核字段并保留原始 `checkedAt`，不会伪造新余额快照或用历史证明接受Paid方案。SQLite DO负责运行时全局日预算和 `3036` 暂停。生产仍因默认关闭、模型白名单为空而不可用；账户所有者确认和实际部署证据见本页最新章节，不将模型尚未验收误记成套餐仍未知。

## 预算上界与未知消耗

`estimateMaxNeurons` 统计传给 AI 的完整请求 JSON 字节（包含 schema、系统指令、消息和参数），不只统计中文正文，也不假定一个汉字等于一个 token。每 UTF-8 字节预留一个输入 token，再加 1,024 固定和每条消息 64 tokens 的 chat framing 余量；不使用缓存折扣。输出预留完整 `max_tokens`，并向上取整 Neurons。上下文必须容纳输入上界和输出。

这是保守的本地估算，**仍需真实 probe 确认模型的 `max_tokens` 覆盖思考与可见输出，以及框架开销没有超过上界**，不能把这个估算视为套餐硬限制。若观察到实际超过预留，账本阻止后续实验。12 KiB输入、1536输出、单消息时预留109 Neurons；因此全部采用这一上界的样本最多只能做7次，不能为了凑足11次越过800。获批四步原按339加四次各最多111得到783的保守上界，依赖原七笔较小预留；首步失败后实际保留450并停止，不能将余量当作自动重试许可，也不能重算或降低已用预留。

实验账本不按日期清零，不在结算后退还预留。超时或异常的实际消耗为 `null`，预留不变。`usage.prompt_tokens` 等 token 计数不等于实际记账 Neurons；probe 仅保存计数，`actualNeurons` 保持 `null`，由可信账户账单核对后再结算。生产侧已实现独立SQLite Durable Object：同一namespace固定 `story-budget-v1-global`，短事务登记预留、结果重放与请求关联；账本独立于结果缓存，未明确结算的预留跨UTC日继续保守占用。迟到结算归原日，清缓存/会话到期不释放未知调用预留。完整请求上限的生产预留为111 Neurons；SQLite中的charge表示保守额度记账，不是货币收费，也不是已知实测Neurons。实际用量未测时保持null；已完成但无实际Neuron证据的调用保留完整预留于原日，超时/真正未知结果才持续跨日占用。包含 `NEXT_CONTEXT_TOO_LARGE` 的确定拒绝通过HTTP保留类型并结算complete，不退还预留、不伪造actual用量。本纯函数实验账本不替代DO；本地workerd/SQLite已验证，实际账号namespace与关闭推理的兼容部署也已回读确认，具体身份见本页最新章节；启用后的生产闭环仍待验收。

受控 probe 的余额检查采用明确的保守方案：**全部现有实验预留 + 新预留不得超过可信余额快照**。例如快照为 40、前一次预留 30 且用量未知，下一次只能再预留最多 10，不能再次预留 30。即使后来刷新快照、先前调用已结算，仍扣除整个实验账本的预留；可能重复扣减、提前停止，但不把该差额声称为真实账户余额。不设置快照 watermark，不通过清空、复制或重建账本释放这部分承诺。该扣减只用于 probe，不给未来生产玩法增加人工每 5 分钟确认的要求。

## 2026-10-27服务端合同基线（该版最终代码CI通过）

供应商结果新增明确的可信 `accountingStatus` 完成/未知分类，HTTP只向客户端呈现允许的安全错误码。记账不再依据公开错误码是否落在另一份字符串列表中：机械事实、死亡/身份、危险文本、重复场景、引用、编译等确定完成的校验拒绝都保留原UTC日完整预留且actualNeurons=null，不退还预留，也不作为永久unknown；真正超时/传输未知继续保守跨日占用。该分类为服务器内部信息，浏览器无权声明。

同一认证会话的所有requestId共享一个SQLite事务保护的30秒有效调用租约。重复attempt重放不增加调用；不同会话在全局预算内独立申请；完成或超时转换可以释放租约，但超时转unknown的旧预留不能释放。租约限制不宣称超时后的外部推理已经停止，也不提供外部exactly-once保证。本地并发HTTP、重启及多类真实provider校验路径的fixture专项通过；该2026-10-27代码检查点独立复核及539项完整CI通过，后续修订的CI身份另见本页最新检查点，公开生产推理仍关闭。


未获准调用使用独立、有界的SQLite `denied_admissions` 证据表，不创建已预留attempt或调用provider。证明绑定已认证session/attempt/request及payload/context hash；只有存在正向证明且没有调用预留承诺时才返回 `ATTEMPT_NOT_ADMITTED`，普通缺缓存、已预留调用墓碑和不存在的祖先不能冒充未调用。浏览器核对三种身份和暂停状态后，仅在用户明确重试时复用同一已持久attempt及原retryOf；刷新只查询，成功预留原子删除证明。每会话证明上限沿用尝试上限、最多120条，保留到会话到期；满额时新证明失败关闭为 `ADMISSION_RECORD_LIMIT`，可暂停至正常会话过期，不自动清身份或已预留调用记录。实际client/session/HTTP/SQLite补充专项60项及最后8项定向检查通过，独立源码复核已通过，最终代码CI通过。

## 受控 probe 操作

`node scripts/workers-ai-probe.js` 只输出脱敏的 blocked 结果，无网络、无推理、无写入。导入脚本也没有自动执行行为。

CLI 实际执行需要同时提供 `--execute --operator /absolute/trusted-operator.mjs --ledger /absolute/shared-ledger.json --attempt task1-unique-id`，可选 `--task task1|task7|task8`。该命令只是接口说明。本次云端验收使用上述私有直接 binding Worker 与同一持久账本，不能另开 CLI 账本重复取得实验预算。

操作员模块的 default 函数须返回 `{env,evidence}`：临时受控环境的直接 `env.AI.run` binding，以及同账户已核验的品牌化证据。不得通过一个接受浏览器输入的公开路由来导出此接口，不得在适配器中换模型或添加 Gateway billing。脚本不提供 REST token、账户 ID 或隐式远程资源创建入口。建立/核对临时环境仍需由控制者完成。

CLI 要求账本已存在，独占创建同目录 `.lock`，从同一文件读取 Task1/7/8 的共享次数；不自动清理旧锁或重置账本。先原子写入并同步预留，才调用一次 AI。并发进程不能抢同一锁。纯 `runProbe` 接口允许注入持久化器，调用者必须自行串行化；它不是分布式锁。所有任务必须使用同一个持久账本，不能复制、删除、重建来增加预算。CLI 不自动重试或自动选择模型。

probe 发送中文场景及 2—3 个选择的 JSON schema，完整响应后校验 JSON/中文/`finish_reason:'stop'`/token 用量；仅记录模型、延迟、结构/中文布尔值、停止类别、是否有思考字段和 token 数。它不输出场景正文、思考文本、原始提供商异常、账户 ID 或凭证。该小 schema 只验证传输能力，不代表完整游戏 schema 或叙事质量已验收。

输出 `passed` 只是一次能力样本；汇总函数永远不自动把生产验证设为 true。完整接入仍要求可重复样本、真实实际用量核对、思考输出限制、叙事质量和临时环境硬边界复核。

## 失败语义与验证

| 情况 | 行为 |
| --- | --- |
| 未明确启用、未知/过期/付费账务、缺 binding、未知模型 | 调用前拒绝，不提交人物状态 |
| 账本无效、次数/预留用尽、预留持久化失败 | 调用前拒绝；没有推理 |
| 超过响应上限、结构无效、截断、模型不符 | 样本失败，保留预留，不自动重试 |
| 超时/提供商异常 | 用量未知，保留预留；迟到响应不触发第二次请求 |
| `429/3036` | `FREE_QUOTA_EXHAUSTED`，停止，不能自动重试 |
| `429/3040` | `PROVIDER_BUSY`，停止；未来仅明确有间隔的用户重试 |
| 调用后账本写入失败 | 报告 `LEDGER_PERSIST_FAILED`；预先写入的 reservation 仍保留 |

本地测试使用明确的绑定替身，不是真实 Workers AI 样本。`node --test tests/workers-ai-provider.test.js` 和直接 `node tests/workers-ai-provider.test.js` 均通过；当时源码18项行为在 `4e44811` 完整release日志中逐项通过（含持久部署证明重建）。该2026-10-27本地检查点为零真实推理，延迟样本为 `[]`、结构通过比例为 `null`；2026-10-28新增真实样本另见本页最新章节，不能混用历史fixture与实际数据。完整上线验收仍未完成。

相关官方说明：[AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) · [错误码](https://developers.cloudflare.com/workers-ai/platform/errors/) · [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)。
