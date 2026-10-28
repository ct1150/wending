# Workers AI 实时剧情接入档案

最近核验：2026-10-28（UTC）。**当前状态：用户已确认 Workers Free；兼容后端、直接 AI binding 和 SQLite 协调存储已实际部署，生产实时推理仍关闭。** 四次真实基础能力样本已执行，但尚未完成完整游戏结构与上线验收；没有升级套餐、购买 credits 或启用付费后备。2026-10-27 的接口权限阻塞保留为历史观察，不再用于否定用户随后提供的套餐确认。

## 2026-10-28 继续执行的证据

当前记录见 [`evidence/workers-ai-rollout-2026-10-28.json`](evidence/workers-ai-rollout-2026-10-28.json)。账户所有者明确回复“是free套餐”，按所有者确认记录 Workers Free，不声称订阅 API 已恢复权限。实际后端部署 `8dd97750-8fd4-40c9-a6c9-c3c61f72a6a2`、版本 `b4fb827d-aa78-4062-9510-299f11f11064` 已接收 100% 流量；回读确认直接 AI binding 与 `use_sqlite:true` 的 StoryBudget namespace。在线能力与会话接口返回 `INFERENCE_DISABLED`；旧版前端仍正常提供。

账户级 GraphQL `aiInferenceAdaptiveGroups` 已成功读取，范围覆盖同一账户当前 UTC 日起点至实际观察时刻，没有按模型、Worker 或成功状态缩小范围。2026-10-27T23:49:50.533Z 的查询未返回用量记录。此结果只表示该观察集中没有记录，不能证明实际用量为零或精确剩余额度为 10,000。跨 UTC 日或超过五分钟须重新观察，保留真实 observedAt，不刷新旧证明的时间戳。

控制者对已有证据入口的解释：`accountUsageVerified:true` 表示已实际核对同账户、整账户、当日的用量观察；`remainingNeurons` 是基于该观察折减后的受控 probe 准入上限，**不是账单余额或有数学保证的即时可用余额**。本轮取 `min(800,max(0,10000-observedAggregateNeurons-额外保留量))`，同时继续扣除全部既有实验预留；额外保留量须在证据中明确记录，不为获得正值反向选择。实际账单 Neurons 与实际余额均保持 `null`。分析数据可能延迟、其他项目也可能并发消耗；这影响请求可用性，由已确认 Free 的平台硬限制拒绝超额，不触发 Paid 计费。Cloudflare 明确说明 [GraphQL Analytics 不是账单计量依据](https://developers.cloudflare.com/analytics/graphql-api/#limitations)。

新操作员 Worker 只承载私有验收：令牌摘要鉴权、固定候选和固定输入、同一 SQLite 对象共享 Tasks1/7/8 实验账本、先持久预留再单次调用。任何证明刷新或 Worker 更新都必须保留同一 namespace/object/账本；没有清空、退还、自动重试或生产启用入口。模型 profile 仍未验证，真实样本须独立验收后才能进入生产白名单。

首个真实样本 `task1-20261028-001` 于 00:03:44 UTC 发起：延迟 3072ms，中文 JSON/结构/stop 通过，usage 为 59 输入、375 输出、434 总 tokens；永久保留 24 Neurons 的实验预留，实际记账 Neurons 未测，仍为 null。响应带非空 reasoning_content，**所以不能通过当前生产验收**。根因调查参照 [Qwen 官方说明](https://github.com/QwenLM/Qwen3/blob/main/docs/source/inference/transformers.md)：默认会思考，支持消息中的 `/no_think` 软开关。只给固定 probe 系统指令追加该开关作为单一假设，真实重复验证通过前不改变生产解析器或 profile。

### 基础能力样本终态（Task1 配额已用完）

同一持久账本已记录四次真实调用，总保守预留96 Neurons，不能重置或归还。所有小 schema 样本中文/JSON/正常stop通过；完整游戏 schema 尚未验收。

| 样本 | 配置 | 输入/输出 tokens | 延迟 | 思考字段诊断 |
| --- | --- | --- | --- | --- |
| 001 | 原中文提示 | 59 / 375 | 3072ms | 非空；未测字符数，不回推是否为空白 |
| 002 | 加 `/no_think` | 63 / 108 | 1064ms | 非空；未测字符数，不回推是否为空白 |
| 003 | 相同 `/no_think` | 63 / 82 | 736ms | 2个字符，无非空白字符 |
| 004 | 相同 `/no_think` | 63 / 86 | 591ms | 2个字符，无非空白字符 |

后两次重复观察确认 Cloudflare 返回空白占位。共享生产解析器原先按 truthiness 拒绝它；下一项实现仅允许缺失/null/空串/纯空白字符串，继续拒绝有实际内容的思考字段和异常非字符串类型，并给完整游戏提示追加同一 `/no_think`。这些修正须专项测试及独立复核，不能自动晋升 profile。原先 reasoningPresent 字段的语义保持“非空字符串”；只有新增诊断支持后两次的空白结论。

2026-10-28T00:12:26.020Z 同账户当日分析查询已返回4次、248输入/651输出tokens和20.985971450805664 Neurons，与这批token计数对应。该值是分析观察，不是实际账单金额或精确余额；`actualNeurons`仍为null，96的实验预留也不退还。剩余实验只能用于Task7最多4次及Task8最多2次，仍受总800预留限制。

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
| `EXPERIMENT_LIMITS` | 共用最多 10 次、800 Neurons；Tasks1/7/8 最多 4/4/2 次 |
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

这是保守的本地估算，**仍需真实 probe 确认模型的 `max_tokens` 覆盖思考与可见输出，以及框架开销没有超过上界**，不能把这个估算视为套餐硬限制。若观察到实际超过预留，账本阻止后续实验。12 KiB 输入、1536 输出、单消息时预留 109 Neurons；因此满上限样本可能最多只能做 7 次，不能为了凑足 10 次越过 800。

实验账本不按日期清零，不在结算后退还预留。超时或异常的实际消耗为 `null`，预留不变。`usage.prompt_tokens` 等 token 计数不等于实际记账 Neurons；probe 仅保存计数，`actualNeurons` 保持 `null`，由可信账户账单核对后再结算。生产侧已实现独立SQLite Durable Object：同一namespace固定 `story-budget-v1-global`，短事务登记预留、结果重放与请求关联；账本独立于结果缓存，未明确结算的预留跨UTC日继续保守占用。迟到结算归原日，清缓存/会话到期不释放未知调用预留。完整请求上限的生产预留为111 Neurons；SQLite中的charge表示保守额度记账，不是货币收费，也不是已知实测Neurons。实际用量未测时保持null；已完成但无实际Neuron证据的调用保留完整预留于原日，超时/真正未知结果才持续跨日占用。包含 `NEXT_CONTEXT_TOO_LARGE` 的确定拒绝通过HTTP保留类型并结算complete，不退还预留、不伪造actual用量。本纯函数实验账本不替代DO；本地workerd/SQLite已验证，实际账号namespace与关闭推理的兼容部署也已回读确认，具体身份见本页最新章节；启用后的生产闭环仍待验收。

受控 probe 的余额检查采用明确的保守方案：**全部现有实验预留 + 新预留不得超过可信余额快照**。例如快照为 40、前一次预留 30 且用量未知，下一次只能再预留最多 10，不能再次预留 30。即使后来刷新快照、先前调用已结算，仍扣除整个实验账本的预留；可能重复扣减、提前停止，但不把该差额声称为真实账户余额。不设置快照 watermark，不通过清空、复制或重建账本释放这部分承诺。该扣减只用于 probe，不给未来生产玩法增加人工每 5 分钟确认的要求。

## 已通过源码复核的服务端合同（最终代码CI通过）

供应商结果新增明确的可信 `accountingStatus` 完成/未知分类，HTTP只向客户端呈现允许的安全错误码。记账不再依据公开错误码是否落在另一份字符串列表中：机械事实、死亡/身份、危险文本、重复场景、引用、编译等确定完成的校验拒绝都保留原UTC日完整预留且actualNeurons=null，不退还预留，也不作为永久unknown；真正超时/传输未知继续保守跨日占用。该分类为服务器内部信息，浏览器无权声明。

同一认证会话的所有requestId共享一个SQLite事务保护的30秒有效调用租约。重复attempt重放不增加调用；不同会话在全局预算内独立申请；完成或超时转换可以释放租约，但超时转unknown的旧预留不能释放。租约限制不宣称超时后的外部推理已经停止，也不提供外部exactly-once保证。本地并发HTTP、重启及多类真实provider校验路径的fixture专项通过；最终源码独立复核已通过，最终539项完整代码CI通过，生产仍关闭。


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

本地测试使用明确的绑定替身，不是真实 Workers AI 样本。`node --test tests/workers-ai-provider.test.js` 和直接 `node tests/workers-ai-provider.test.js` 均通过；源码现有18项行为；在 `4e44811` 完整release日志中已逐项通过（含持久部署证明重建）。该2026-10-27本地检查点为零真实推理，延迟样本为 `[]`、结构通过比例为 `null`；2026-10-28新增真实样本另见本页最新章节，不能混用历史fixture与实际数据。完整上线验收仍未完成。

相关官方说明：[AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) · [错误码](https://developers.cloudflare.com/workers-ai/platform/errors/) · [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)。
