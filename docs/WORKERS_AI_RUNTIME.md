# Workers AI 实时剧情接入档案

核验日期：2026-10-27。**当前状态：本地准备完成；真实免费边界与模型能力未验收，实时推理关闭。** 没有部署 AI binding，没有执行真实模型调用，也没有升级套餐、购买 credits 或修改远程资源。

## 实际证据与阻塞

只读检查由本次任务控制者执行，脱敏结果见 [`evidence/workers-ai-runtime-2026-10-27.json`](evidence/workers-ai-runtime-2026-10-27.json)。此前规划观察见 [`evidence/2026-10-27-workers-ai-planning-recon.json`](evidence/2026-10-27-workers-ai-planning-recon.json)。

| 项目 | 已观察结果 | 能证明什么 |
| --- | --- | --- |
| 账户 subscriptions | HTTP 403；当前 OAuth 权限不足，需要具有 Billing Read 的 API token | 无法判断实际 Free/Paid 套餐；不能开启推理 |
| workers/account-settings | `standard` | 不是 Free/Paid 订阅证明 |
| 既有 Worker binding | 规划只读检查为 `[]` | 当时没有 AI binding；不是当前临时环境验证 |
| 候选模型目录 | 规划检查 HTTP 200 | 仅证明目录可读，不证明调用权限、JSON Mode 或剩余免费额度 |
| 账户其他项目用量、剩余额度 | 未验证 | 不能把整个免费额度预分配给本游戏 |
| AI/协调存储零付费边界 | 未验证 | 实时上线门禁仍关闭 |
| 中文、结构化输出、停止原因、思考文本、实际用量 | 未执行真实推理 | 没有有效延迟样本；结构通过率为 `null`，不是 0% 或 100% |

如果不能取得相同账户的可信套餐、用量和硬限制证据，则保持关闭并保留待办。`standard`、模型目录成功、应用自己的预算计数、AI Gateway spend limits 均不能替代零付费证明。AI Gateway spend limits 是最终一致和 best-effort 的控制，不是严格的零费用边界。

## 官方政策与候选模型

2026-10-27 查阅 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)：账号每天共用 10,000 Neurons 免费额度，UTC 00:00（北京时间 08:00）重置。Workers Free 耗尽后失败；Workers Paid 超出免费额度会收费。部分模型需要付费套餐或预付 AI Gateway credits。**本项目只允许已确认 Workers Free 的直接 AI binding；不使用 Gateway Unified billing、预付 credits、付费后备或自动升级。**

候选为 `@cf/qwen/qwen3-30b-a3b-fp8`。当前官方定价是每百万输入 tokens 4,625 Neurons、每百万输出 tokens 30,475 Neurons。[模型页](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)列出 32,768 上下文和 `response_format`，但 [JSON Mode 支持列表](https://developers.cloudflare.com/workers-ai/features/json-mode/)没有列出这个 Qwen3 模型。真实结构支持仍为未知；没有生产模型被锁定。

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
| `assertProviderReady(options)` | 校验模型、明确启用、AI binding、可选实验账本、可信新鲜免费证据、剩余额度与用途；通过时返回 profile，否则抛出只有固定 `code` 的错误 |
| `estimateMaxNeurons(input,{modelId})` | 对完整消息、系统指令和 schema 的 JSON UTF-8 大小核算，按最大输出预留整数 Neurons |
| `createExperimentLedger()` | 建立空的可序列化实验账本；不得通过新建账本绕过已用预算 |
| `reserveExperiment(ledger,{task,attemptId,reservedNeurons})` | 在执行前以不可变更新登记上界，拒绝重复 attempt、总额/次数/分任务上限 |
| `settleExperiment(ledger,attemptId,{status,actualNeurons})` | 登记完整/失败/未知；不回收本轮实验预留；已知实际消耗不得被清零或降低 |

`assertProviderReady` 参数为 `{enabled=false, modelId=CANDIDATE_MODEL_ID, env, evidence, purpose='production', ledger, reservationNeurons=0, now=Date.now()}`。`purpose:'probe'` 只允许受控验证候选；其他用途都必须匹配已验证生产 profile，因此当前始终拒绝生产推理。

品牌化证据只避免把普通 JSON 直接误当可信证据，**不代替服务器鉴权**。可信构造器只能接收操作员/账户只读核验的材料，并确认其属于 `env.AI` 对应的同一账户。API 路由不得从浏览器请求构造 evidence、enabled、modelId、profile、账本或套餐信息。浏览器伪造的序列化对象不会通过品牌检查。后续服务器入口应从部署配置/受信任账户验证代码取得材料。

证据必须同时满足 `source:'operator-account-verification'`、`plan:'workers-free'`、`hardLimit:true`、`directBinding:true`、`noGatewayCredits:true`、`accountUsageVerified:true`、`storageFreeVerified:true`、有限且不超过 10,000 的 `remainingNeurons`、未过期的 `checkedAt`。当前没有材料满足这些条件。

5 分钟时效针对 **受控 probe 的当前余额快照**。生产门禁不会把它当作持续游玩的计时器，也不会要求操作员每 5 分钟手工确认。生产目前因白名单为空而始终关闭；后续 Task4 需要区分部署时已证实的 Workers Free 平台硬上限与运行时动态余额，以全局日预算和平台 `3036` 暂停语义处理耗尽。该接续尚未完成；不得通过用当前时间覆盖原始 `checkedAt` 来假造新核验，或凭已有部署证明接受付费升级。可信构造器当前仍要求建立品牌时有新鲜材料，生产部署证据持久化/重建由 Task4 的服务器配置入口接续。

## 预算上界与未知消耗

`estimateMaxNeurons` 统计传给 AI 的完整请求 JSON 字节（包含 schema、系统指令、消息和参数），不只统计中文正文，也不假定一个汉字等于一个 token。每 UTF-8 字节预留一个输入 token，再加 1,024 固定和每条消息 64 tokens 的 chat framing 余量；不使用缓存折扣。输出预留完整 `max_tokens`，并向上取整 Neurons。上下文必须容纳输入上界和输出。

这是保守的本地估算，**仍需真实 probe 确认模型的 `max_tokens` 覆盖思考与可见输出，以及框架开销没有超过上界**，不能把这个估算视为套餐硬限制。若观察到实际超过预留，账本阻止后续实验。12 KiB 输入、1536 输出、单消息时预留 109 Neurons；因此满上限样本可能最多只能做 7 次，不能为了凑足 10 次越过 800。

实验账本不按日期清零，不在结算后退还预留。超时或异常的实际消耗为 `null`，预留不变。`usage.prompt_tokens` 等 token 计数不等于实际记账 Neurons；probe 仅保存计数，`actualNeurons` 保持 `null`，由可信账户账单核对后再结算。生产日预算、跨日未知请求、全局并发与会话幂等仍由后续 Durable Object 实现，不能以本模块的纯函数账本替代。

受控 probe 的余额检查采用明确的保守方案：**全部现有实验预留 + 新预留不得超过可信余额快照**。例如快照为 40、前一次预留 30 且用量未知，下一次只能再预留最多 10，不能再次预留 30。即使后来刷新快照、先前调用已结算，仍扣除整个实验账本的预留；可能重复扣减、提前停止，但不把该差额声称为真实账户余额。不设置快照 watermark，不通过清空、复制或重建账本释放这部分承诺。该扣减只用于 probe，不给未来生产玩法增加人工每 5 分钟确认的要求。

## 受控 probe 操作

`node scripts/workers-ai-probe.js` 只输出脱敏的 blocked 结果，无网络、无推理、无写入。导入脚本也没有自动执行行为。

实际执行需要同时提供 `--execute --operator /absolute/trusted-operator.mjs --ledger /absolute/shared-ledger.json --attempt task1-unique-id`，可选 `--task task1|task7|task8`。该命令只是受控入口说明，**当前免费证据未知，不应执行**。

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

本地测试使用明确的绑定替身，不是真实 Workers AI 样本。`node --test tests/workers-ai-provider.test.js` 和直接 `node tests/workers-ai-provider.test.js` 均通过；直接运行展示 17 项行为断言。零真实推理，延迟样本为 `[]`，结构通过比例为 `null`。上线验收仍阻塞。

相关官方说明：[AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) · [错误码](https://developers.cloudflare.com/workers-ai/platform/errors/) · [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)。
