# 问鼎实时剧情生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 去掉固定一世时长和预制终章，让每次肉鸽选择通过Cloudflare Workers AI免费额度内实时推动剧情，人物实际死亡才结算。

**Architecture:** 独立V5/CV4活动快照、纯规则结算、生成回合校验、IndexedDB分段档案；同源Worker AI API与SQLite Durable Object预算/幂等协调。旧引擎、旧档与旧离线版保留。

**Tech Stack:** 现有原生JavaScript/Node24、node:test、浏览器IndexedDB、Cloudflare Workers AI binding、SQLite-backed Durable Objects。

**Spec:** `docs/superpowers/specs/2026-10-27-realtime-workers-ai-design.md`

**Status（2026-10-28 13:30:22.097699，上海时间）:** 已审74aa请求时校验修复已部署，helper18/stage17模块全哈希读回并由本地fresh builders复现，原namespace和账本保留。用户确认的Free、11次/800及Task1/7/8的4/5/2上限不变；获批四步的唯一Task8浏览器开场于13:24:56.749返回GENERATED_SCENE_INVALID，按首步失败即停规则停止，没有S1或后续baseline/分支A/分支B/choice。当前8次/450预留、Task1/7/8为4/3/1、actualNeurons=null，原7行与三笔cases不变；出生/pending保存及刷新GET同一拒绝已实际通过局部恢复验证。线上保留74aa/970046字节/3c3b摘要/embedded的V5兼容stage，proof自然过期且门禁已实测，publicEnabled=false、modelValidated=false、生产白名单为空。Task7质量、Task8成功闭环和公开发布仍未完成。见 [接入记录](../../evidence/workers-ai-rollout-2026-10-28.json)、[浏览器失败/恢复证据](../../evidence/shared-opening-browser-2026-10-28.json) 与 [QA](../../QA_REPORT.md)。

### 2026-10-28当前执行边界

- [共享开场四步](2026-10-28-shared-opening-acceptance.md) 已获用户明确批准：Task8真实浏览器开场→同S1的Task7分支A→分支B→Task8真实选择、保存和刷新。Task8固定预留111，Task7按实际输入估算、每次上界111；原四步保守上界为11次/783。本次首步失败，新增111预留后停在8次/450；余量不是自动重试许可，后续三次及baseline均未执行。
- `74aa25884c5468d9eb90abb1bbb82ba92752ba0b` 的helper18/stage17模块已部署并全哈希读回，本地正常fresh builders复现全部35模块。helper deployment/version为 `a3cccc55-406e-4785-8a75-90d1f457f080` / `40e56059-5c3f-4d77-9df9-ac5f01e63dcf`；stage为 `73aedb80-4191-42a7-8ab5-263821acb05d` / `c44a3a9d-b9d6-4d78-95cb-0eae37d8610b`。原StoryBudget namespace `1de1df3929534a8d8d495d6db6604e99`、实验namespace `dfb218f2f29d4ecab2395f8a00b48350`、固定对象与experiment-v1不变。当前HTML为74aa/970046字节/SHA-256 `3c3b09de319e2032c3990867780998d67adcb6af62fc9fe0a78cb35fdf46b5b0`/embedded。
- 13:22:29.490实际整账户当日GraphQL观察为7次、3285输入/2366输出tokens、87.29505348205566聚合Neurons；下载/重建后才取得该新观察，13:22:32.522完成上传与读回，proof有效至13:27:29.490。13:29:11.444后续观察为8次、4363输入/2812输出、105.87210083007812聚合Neurons；分析观察不等于账单或精确余额，不能用差值给单次attempt填actualNeurons。
- 唯一Task8 opening被GENERATED_SCENE_INVALID拒绝，failed记录保留111。细分诊断未进入公开响应且Task8桥未保存，具体非法字段未知，不能沿用旧Task7的ACTION_PAIR_INVALID。出生/pending已落盘；刷新只GET同一缓存拒绝，`runs/pending/history/memory` 四stores逐值相等。13:29:03.747349账本仍8/450，原7行与三笔cases完全保留；没有accepted场景或S1，真实成功路径仍pending。
- proof自然过期后未追加模型调用，测试浏览器已关闭。13:30:22.097699最终只读health为74aa/embedded/970046；无permit返回TESTER_PERMIT_REQUIRED，有permit因proof过期返回FREE_BOUNDARY_UNVERIFIED。保留当前V5兼容stage，不回滚到无法读取已保存birth/pending的旧HTML；publicEnabled=false、modelValidated=false、生产白名单为空。
- 已部署修复经过独立审查及 [CI40636654680](https://github.com/ct1150/wending/actions/runs/40636654680)：655/655项测试、134项JavaScript语法、14模块默认打包。CI merge `bbce147f11b00de7003340943d2e38f54f5cf3ad` 与74aa同树 `e19215b7fec41cfa799aa9db0d60ec175a44dd55`；代码与部署通过不代替模型验收。

### 2026-10-28 13:17:18上传前历史检查点

deba的helper18/stage17模块当时已首次部署并全哈希读回，正常TLS仅打开主页，尚未调用API/AI或建立档案，账本7/339。生产只读诊断确认顶层Date.now=0使proof重建失败，被旧stage永久缓存；74aa已通过请求readiness内验证修复与CI，但当时尚未部署。过期模板保留原12:41:02.653观察，GraphQL五分钟限流使流程停在PUT前，约定13:22:18后重查；后续已取得新的真实观察并完成上方部署，没有改旧时间冒充fresh proof。原5分钟/UTC日期、账户、permit和预算门禁未放宽。

### 2026-10-28 11:42:46历史检查点

- 当时已部署私有helper源码 `bc7427097f606348351944cb4085942b0fa45905`，16模块；version `ce2eb3a2-04fd-48e2-84f5-ff817057a545`，deployment `7556b818-9270-4f0b-a9c7-f5f3bb8440cc`。原namespace、固定对象和experiment-v1未改变；11:42:46只读核验原7行/results/cases全部一致。页面当时仍4.0.0/main `e247a875`、INFERENCE_DISABLED，此后由deba stage替换。
- 该提交的 [CI40626224045](https://github.com/ct1150/wending/actions/runs/40626224045) 通过618/618项、130项语法和14模块默认后端打包，publish跳过；默认包与16模块私有helper分别记录。
- 第三次Task7开场 `task7-20261028-003` / `task7-opening-v3` 于11:25:22—11:25:28失败为 `GENERATED_SCENE_INVALID / ACTION_PAIR_INVALID`；原正文未保存，不能确诊具体非法字段，历史failed记录与预留不变。
- 后续oneOf的19种合法/133种非法行动配对覆盖、服务器场景摘要证明和同S1双分支在该检查点仅完成离线实现及独立复核，此后随deba首次部署并保留于74aa；真实Task8首步失败，S1交接与分支仍未执行。本地全量646/646、133项JavaScript语法和970046字节HTML通过，失败/取消/跳过/todo均0，80.4605秒；包含原生Chromium、workerd/SQLite与1000回合fixture。新增源码 `b780a84` 的 [CI40628818519](https://github.com/ct1150/wending/actions/runs/40628818519) 已通过646/646、133项语法与14模块默认打包，publish跳过，不能与最新74aa的655项结果混同或相加。

## 2026-10-27整分支审查修复历史（该版源码复核与最终代码CI通过）

- [x] I1：新出生显式 `relationshipVersion:1`，永久索引保留累计数值关系并按相关人物有界恢复；规则、上下文、提交、哈希、导入重放一致。原生正负关系跨离场/超过30名NPC/刷新/完整导入专项及独立源码复核通过。
- [x] I2：所有确定完成的provider校验拒绝与公开错误码分离分类，原日保守额度记账不退；真正未知仍跨日占用。多类拒绝专项及独立源码复核通过。
- [x] I3：同一认证会话跨requestId的原子有效调用租约，含并发HTTP/重启/完成与超时转换；未知调用预留不释放。另加有界、身份绑定的未获准证明，只在明确重试时复用同一attempt；app/API/budget60项及最后8项定向通过，独立复核通过。
- [x] I4：出生持久化前预检实际opening上下文，无效姓名保留可编辑且不创建档案/推理，修正后开始一次。专项及独立源码复核通过。
- [x] 最终已审源码65c3d0f/远端1322aa6完整CI40547281694通过539项；实际长线数据和构建摘要已回填QA。

M3负向因果检查已补具体错误码；M1请求体读取deadline与M2异步焦点问题继续作为非阻断工作跟踪。未标记的未发布V5档案保持原历史/pending/hash及旧关系语义，不静默修复过去已丢失累计值；旧v1—v4不变。旧无效出生pending也不静默改名或重掷。

## Global Constraints

- 新模式 `version:5 / mode:cultivation / contentVersion:4`；旧v1/v2/v3和version4的CV1/CV2/CV3行为、随机与导入导出保持原样。
- 不设置20—30分钟、固定场景数或固定通关步数目标；只有规则确认的死亡结算。登仙/问鼎继续人生。
- 模型只提出事件、对话和行动意图；年龄、境界、物品、伤势、寿命、死亡与奖励由规则控制。
- 请求身份为runId/turnId/baseRevision/stateHash/choiceId/rulesVersion/promptVersion/requestId；失败不提交人物状态，未知调用消耗不能当零。
- opening与choice共用事务；出生事实先落盘，刷新不重掷。过期/丢失会话先暂停，明确重试才创建关联旧请求的新attempt，不重复结算人物行动。
- 免费硬边界不明则关闭实时推理；禁止自动付费升级、预付credits或收费模型回退。北京时间08:00对应当前免费额度重置。
- 2026-10-28用户已批准共享11次/800 Neurons、Task1/7/8的4/5/2上限及共享开场四步，替代2026-10-27初版10次及4/4/2建议；原记录和预留继续累计，不能重建账本。当前首步Task8失败后按约定停止，8次/450全部保留，不用剩余额度自动重试或推进后续分支。
- 输入12KiB、HTTP请求32KiB、响应64KiB、输出1536tokens、等待30秒为初版建议上限；总提示须包含schema/系统信息核算，实际模型限制更小时取更小值。
- 历史每128回合或256KiB封块；新档不得使用旧1M总量作为一世终点。容量失败可恢复且不截历史。
- 实时JSON首版完整校验后提交，不以动画冒充流式；已缓存内容离线可读，新增剧情需要联网。

## Review Focus

- 多标签页、重复点击、刷新、迟到响应、超时未知和跨日预算：不重复结算或盲目再次消耗模型（Tasks4/5/6）。
- 模型把玩家文本当指令、虚构奖励、复活死者或更改年岁：结构/引用/机械事实均受规则约束（Tasks2/3/7）。
- 活动摘要压缩后丢失承诺，导入半包或磁盘满：完整档案与原人生保持可恢复（Tasks3/5）。
- Paid套餐、其他账号用量、AI/DO免费限额、繁忙与耗尽混淆：不能越过免费约束（Tasks1/4/8）。
- 前端渠道已更新但Worker绑定/协议未部署：先能力协商，不能使旧档或新玩家白屏（Tasks6/8）。

---

## 文件与公共接口

新建 `src/game/cultivation/live/`：`model.js`（V5类型/规则目录）、`engine.js`（准备/提交/死亡）、`validation.js`（快照/回合）、`memory.js`（上下文与事实索引）、`schema.js`（模型提案）。

新建 `src/game/live-archive.js`（IndexedDB事务/分段读写）、`src/game/live-save-format.js`（流式归档导入导出）、`src/ui/live-session.js`（异步会话恢复）、`src/ui/story-client.js`（同源API）。

新建 `src/worker/index.js`（路由与绑定入口）、`story-api.js`、`story-provider.js`、`story-budget.js`（SQLite Durable Object）、`story-config.js`（已验证模型/免费策略）；保留 `release-gateway.js` 职责。

核心类型：`LiveState`为V5已提交快照，phase为awaitingOpening/active/dead；`PendingTurn`含kind=opening或choice、基准身份、确定的ActionReceipt、未提交候选状态；`GeneratedScene`含正文、实体引用、2—3个可编译行动；`TurnResult`为ready/pending/paused/rejected之一，paused携带quota/expired/session-unavailable等原因。

### Task 1: 核验严格免费接入与模型能力

**Files:** 新建 `scripts/workers-ai-probe.js`、`src/worker/story-config.js`、`docs/WORKERS_AI_RUNTIME.md`、`tests/workers-ai-provider.test.js`；结果写入带日期的 `docs/evidence/workers-ai-runtime-*.json`。

**Interfaces:** 产出 `ProviderProfile {modelId,requestFormat,responseFormat,supportsStructuredOutput,maxInput,maxOutput,usageFields,stopFields,freeBoundaryEvidence}`，以及可供后续导入的 `src/worker/story-config.js`。第一候选为 `@cf/qwen/qwen3-30b-a3b-fp8`，未实测不能锁为生产模型。

- [x] 先写并观察失败：未知计费状态、付费模型、缺AI绑定、超过实验预算时必须在推理前拒绝。
- [x] 记录所有者确认Workers Free，读回同账户直接AI/SQLite绑定，并取得全账户当日GraphQL用量观察；保留原observedAt和非账单/可能延迟边界。历史Billing API403不再作为当前套餐未知阻塞，不能把观察估算称为精确余额。
- [x] 部署经鉴权的操作员辅助环境，沿用同一个持久实验账本完成Task1原定四次小schema取样；中文JSON/stop通过，003/004各观察到2个思考字段字符且无非空白内容。001/002缺少诊断，不能回推。Task1次数已用尽，保留全部96预留。
- [x] 2026-10-28早期操作员helper及/no_think、脱敏诊断修订经独立复核，当时辅助源码ef356ba的13项operator与18项provider定向通过；不与旧539项相加，后续源码另记。
- [ ] 全流程沿用原实验账本，按用户已批准的至多11次/800 Neurons及Task1/7/8的4/5/2上限验收，先达到任一边界即停。Task1四次已用尽，完整游戏结构、思考输出上限与实际账单用量证据仍待验收；唯一Task8开场失败后当前8次/450全部保留，按获批失败即停规则停止后续步骤，不把余量当自动重试许可。
- [ ] 记录延迟样本和结构通过比例；不使用“免费余额未知”“目录能查到模型”替代推理验证。若模型不满足结构/质量，记录失败并在免费白名单内重新选择，禁止隐式昂贵后备。
- [x] 运行 `node --test tests/workers-ai-provider.test.js`，核对真实证据与fixture标识分离，独立复核并提交接入档案。

**完成条件：** 可证明零付费路径、可重复的中文结构化调用、明确失败语义。未满足则后续可继续纯本地准备，实时上线仍被门禁阻止。

### Task 2: 新内容版本与死亡才终结的人生规则

**Files:** 新建 `src/game/cultivation/live/{model,engine,validation,schema}.js`、`tests/live-engine.test.js`；修改 `src/game/save-format.js` 的版本分发（旧路径不改规则）。

**Interfaces:** `createLiveGame(options)->LiveState`（出生固定、awaitingOpening）；`prepareOpening(state,{requestId})->PendingTurn|Rejected`；`prepareChoice(state,command)->PendingTurn|Rejected`；`commitTurn(state,pending,scene)->LiveState`；`settleDeath(state,pending)->LiveState`；`compileChoices(state,proposals)->ExecutableChoice[]`。opening的choiceId为null、收据为出生事实，不扣时间/资源；第一幕提交后active，真实死亡后dead。`stateHash`采用规范化JSON的SHA-256；不以对象属性迭代顺序产生不同身份。

- [x] 写失败测试：登仙/问鼎后仍alive；归隐不能直接ended；实际寿尽/致死战斗才ended，死亡后不生成新回合。
- [x] 写失败测试：不同策略产生不同资源/风险/关系后果；未知intent、任意奖励、跳级、免费复活和无耗时刷资源被拒绝。
- [x] 实现独立规则目录与选择编译，保留可解释成本/已知危险；ActionReceipt包含已选行动、时间/资源/随机变化及死亡/存活结果。
- [x] 验证未提交副本不改原状态；同一pending结果不会在重试时重掷随机；旧版本序列和完整存档保持原样。
- [x] 验证开场准备不重复创建出生事实、抽资质或付成本；awaitingOpening不能执行普通选择，第一幕也不能由模型改写出生条件。
- [x] 运行 `node --test tests/live-engine.test.js tests/campaign-birth.test.js tests/campaign-save.test.js`，独立评审后提交。

### Task 3: 选择驱动的剧情协议与连续记忆

**Files:** 新建 `src/game/cultivation/live/memory.js`、`src/worker/story-provider.js`、`tests/live-story-contract.test.js`；补充live/schema.js。

**Interfaces:** `buildStoryContext(state,pending,relatedRecords)->StoryContext`；`validateGeneratedScene(raw,context)->GeneratedScene`；`buildMemoryDelta(receipt,scene)->MemoryDelta`；`generateScene(ai,profile,context)->ProviderResult`。ProviderResult保留实际模型、用量、结束原因和attempt，不包含密钥。

- [x] 写失败测试：同一初始条件的两个不同选择形成不同事实收据与后续上下文，已解线索不当作未解、已死人物不能无依据复活。
- [x] 写失败测试：输入含伪指令/原型键/HTML/超大文本、输出截断/未知字段/机械事实冲突时拒绝；不同姓名不应改变规则权限。
- [x] 生成新的事件、关系和2—3项行动提案，接入Task2编译；不得只在固定场景前追加一段环境文字。
- [x] 由规则事实、相关实体、未解线索、近期回合和派生摘要构建有界提示；全量原文不发送，摘要不得覆盖事实日志。
- [x] opening上下文消费出生事实收据，choice上下文消费实际行动收据；两者都通过同一结构、机械事实和可编译选项校验。
- [x] 运行 `node --test tests/live-story-contract.test.js`；保留关键事实跨压缩检索证据，独立评审后提交。

### Task 4: 同源API、免费预算与幂等调用

**Files:** 新建 `src/worker/{index,story-api,story-budget}.js`、`tests/story-api.test.js`、`tests/story-budget.test.js`；修改构建入口以接收env/ctx，保持静态路由测试。

**Interfaces:** `createStoryApi({provider,budget,config})->{fetch(request,env,ctx)}`；`POST /api/story/session`建立受限匿名会话（建议24小时有效，签发凭据及非敏感sessionRef）；`POST /api/story/turn`返回TurnResult；`GET /api/story/turn/:requestId`只查询该会话既有结果；`GET /api/story/capabilities`返回协议/模型可用状态。attempt绑定sessionRef，凭据不得进入导出文件。预算DO提供 `reserve(input)->Reservation|Denied`、`settle(reservation,usage,status)`、`lookup(sessionId,requestId)`，使用SQLite事务与服务端时间。

- [x] 写失败测试：并发重复请求只预留一次，结果重放不再推理；未知/跨会话requestId不可读取；重启后幂等与预算记录仍存在。
- [x] 写失败测试：记录在会话有效期内不提前清理；过期会话/已清理记录/跨浏览器丢凭据返回paused而不重新调用；明确重试才建立新attempt并关联原请求。
- [x] 写失败测试：全球预算不足、其他账号用量无法确认、Paid边界不明、输入/输出超限、429/3036和3040分别进入正确暂停状态。
- [x] 实现短事务预算预留与结果记录、请求体/会话/IP限制、固定模型白名单；推理等待放在协调对象外，不以浏览器预算/Origin/缓存当作硬门禁。
- [x] 实现unknown保守记账和用户重试attempt；预算按服务端UTC日期归属，跨日未知上界继续扣新日可用预算，实际核对前不释放，迟到结算不误退其他日期。预算账本独立于短期结果缓存；取消、超时或清缓存不释放未知消耗，不无限自动重试。
- [x] 运行 `node --test tests/story-api.test.js tests/story-budget.test.js tests/release-channel.test.js`，实际本地workerd/SQLite定向验证后独立评审提交；关闭生成的Cloudflare兼容后端已核对，启用后的真实玩家闭环尚未验收。

### Task 5: 长期历史、归档与恢复事务

**Files:** 新建 `src/game/{live-archive,live-save-format}.js`、`tests/live-archive.test.js`、`tests/live-save-format.test.js`；必要适配 `src/ui/session.js`，保留旧persistence.js。

**Interfaces:** `openLiveArchive()->Archive`；`Archive.create({state,pending})`原子保存出生与开场；`Archive.prepare(pending)`保存后续待提交行动；`Archive.commit({expectedRevision,nextState,scene,memoryDelta})`；`Archive.load(runId)`；`Archive.readHistory(runId,cursor,limit)`；`exportLiveArchive(archive)->ReadableStream`；`importLiveArchive(stream)->ValidatedArchive`。数据库 `wending-live-v1` 的runs/pending/history/memory同事务更新。

- [x] 写失败测试：超过旧1M大小仍可继续；跨块索引/次序/校验值准确；旧JSON导出逐字保持。
- [x] 写失败测试：原生事务中断、显式注入容量/权限错误、导入半包/缺块/坏哈希时保留原人生和历史，恢复后能读取上次完整提交；自然磁盘满仍未实测。
- [x] 写失败测试：含opening或choice pending的档案导出/跨浏览器导入保持事实收据、随机与原请求关联，不携带服务端凭据；失去会话后能显式续接。此处验证为独立Chromium上下文，非跨浏览器引擎验收。
- [x] 实现每128回合或256KiB分块、有界活动快照、相关记忆索引及分页历史；不要按回合总数或历世总数结束游戏。
- [x] 实现流式.wending.jsonl导入导出和临时档案切换；新格式单记录有界，不能先全量载入再去掉大小检查。
- [x] 运行 `node --test tests/live-archive.test.js tests/live-save-format.test.js`，用真实Chromium IndexedDB验证刷新与事务回滚，配额/权限故障显式注入，独立评审后提交；自然容量耗尽未实测。

### Task 6: 实时选择界面与可恢复等待

**Files:** 新建 `src/ui/{live-session,story-client}.js`、`tests/live-app.test.js`；修改 `src/app.js`、`src/ui/journey.js`、`src/ui/character.js`、`src/ui/paper.css`，仅增补新模式分发。

**Interfaces:** `createLiveSession({archive,client,engine})->{start,choose,resume,retry,view}`；`requestTurn(pending,context)->TurnResult`；共享视图显示当前场景、真实选项和pending/paused状态，完整历史分页读取。

- [x] 写失败测试：双击、刷新、后退、断线、迟到回应、旧标签页不能重掷或重复结算；等待期间不提前改变角色资源。
- [x] 写失败测试：创建后第一幕尚未返回就刷新仍续接同一opening；长期暂停后缓存已清理或含pending跨浏览器导入时可恢复，明确重试只换attempt、不重掷或重付行动成本。
- [x] 写失败测试：额度不足/模型忙/超时/保存失败都能保持待续状态；规则已判死亡时即使AI离线也正确结算。
- [x] 接入能力协商和完整响应提交；等待文案简短，可重试/读历史/导出，不展示未校验JSON，不暗中切换固定主线。
- [x] 更新新模式的联网/最小上下文传输说明；旧模式与旧离线继续原行为。回滚或API协议不匹配时能恢复旧人生和备份。
- [x] 运行 `node --test tests/live-app.test.js`，实际320/390/桌面键盘与焦点/刷新/导入导出验证后独立评审提交。

补充整合验收：DB结构v1→v2索引升级保留原数据；有界相关上下文披露省略而不删除原文；所有可用非死亡下一选择在providerready前检查必需上下文。`NEXT_CONTEXT_TOO_LARGE` 经HTTP保留为确定拒绝，原日预留额度不退、完成结果不跨日按未知占用。上述修复专项与独立复核通过；回滚须保留v2读取器。

### Task 7: 长线因果、死亡与真实生成质量

**Files:** 新建 `tests/live-long-run.test.js`、`docs/evidence/live-story-quality-*.json`；更新QA_REPORT中的新模式独立章节。

**Interfaces:** 消费Tasks2—6；记录sampleKind=fixture或workers-ai，inputHash、modelId、用量、接受/拒绝、原因与时延，不把模拟当真实。

- [x] 先用确定性模拟供应商运行至少1000回合的存活路径，跨越旧篇章终点和旧总量限制；断言活动状态有界、全历史可恢复、运行不依赖固定NODES。
- [x] 验证短命/长命/寿尽/战死、登仙后继续、死亡后不再生成；测试步数不是产品上限。
- [ ] 使用原实验账本与已批准的Task7至多5次上限，完成连续叙事与反事实选择审查；三次Task7开场已经failed。已批准方案要求先获得Task8接受且真实保存的同一S1；本次Task8开场被拒绝，没有S1，baseline和两条独立单步分支均未执行。人物/年龄/地点/关系/悬念与行动代价的真实质量审查仍pending，不将拒绝结果写成已接受场景，不宣称深层连续叙事或公开发布通过。
- [x] 补齐19种合法/133种非法行动配对覆盖，以及服务器场景摘要、原contextHash、重算S1与浏览器保存状态baseline交接的fixture验证；两条固定分支独立使用同一S1。代码与独立复核完成，已部署74aa，原运行时校验未放宽；唯一真实Task8开场失败，没有进入S1交接或分支验收。
- [x] 记录fixture重复/冲突、1000回合完整恢复与死亡结果，所有样本标明来源；最终长线4/4通过。
- [ ] 记录本项真实完整结构、连续/反事实叙事质量、延迟与用量；Task1简单JSON样本不替代Task7验收，actualNeurons未取得账单证据时仍为null，不用fixture或账户分析估算冒充。
- [x] 运行 `node --test tests/live-long-run.test.js`，审查样本来源与实际边界后提交。

### Task 8: 后端部署、前端启用与最终交付

**Files:** 新建受控的Worker部署配置/绑定迁移说明；修改 `scripts/build-gateway.js`、`.github/workflows/validate-deploy.yml`、`README.md`、`docs/{ROADMAP,DEPLOYMENT,PRODUCT_SPEC,QA_REPORT}.md`。

**Interfaces:** 后端发布包含AI/SQLite DO绑定、规则/提示版本和协议版本；前端先检查capabilities才启用新模式。保留现有HTML渠道摘要校验。

- [x] 为多模块打包、缺绑定、前后端协议不匹配、回滚、静态HTML降级写并观察失败测试。
- [x] 2026-10-28早期已将关闭生成的兼容后端部署至现有Worker，读回直接AI、SQLite namespace、首次迁移及100%部署，核对当时INFERENCE_DISABLED响应与旧4.0页面；历史ID见接入记录，随后deba首次部署，当前保留74aa兼容stage。
- [x] 补齐独立tester门禁、原实验账本Task8持久准入/结算及显式受控打包；deba首次部署后，74aa的helper18/stage17模块修复版已部署并全哈希读回，默认公开策略与未验证模型状态保持关闭。单次真实开场拒绝和局部刷新恢复已验证，完整成功闭环仍未完成。
- [x] 验收包固定已审内嵌HTML；严格ready场景的服务器acceptedSceneHash、complete结算与桥确认核对已部署，终态/摘要不可改写，failed/unknown不接受摘要。当前Task8只有一笔failed，没有accepted场景或S1；不接受客户端补填摘要，也不把部署或拒绝重放记为场景通过。
- [ ] 完成模型与启用策略复核后发布兼容前端；发布凭据与模型API能力不得进入浏览器或离线包。
- [x] 2026-10-27已审源码完整发行验证与旧版回归通过：CI40547281694为539项、0失败/跳过，含1000回合重跑、117项语法及13模块打包。
- [x] 2026-10-28源码bc742709的CI40626224045通过618/618项、130项语法及14模块默认打包，publish跳过；私有16模块helper部署身份单列，不视为Task8部署或公开发布。
- [x] 对新增行动配对、场景证明及共享S1双分支代码完成对应提交的CI；本地全量646/646、133项语法、970046字节HTML已通过，独立复核完成，新增源码 `b780a84` 的 [CI40628818519](https://github.com/ct1150/wending/actions/runs/40628818519) 已通过646/646、133项语法与14模块默认打包，publish跳过。不能复用旧618/610/585/539项作为新提交结果。
- [x] 生产只读诊断确认stage模块顶层Date.now=0的永久错误锁定；请求readiness内验证的最小修复74aa经过先红后绿、原生打包入口及明确标注的模拟回归，独立审查和CI40636654680通过655/655项测试、134项语法、14模块默认打包，CI merge bbce147与源码同树。该修复现已部署，真实请求不再被初始化错误阻断。
- [x] 13:22:29.490取得新的整账户GraphQL观察后上传已审74aa，35模块全哈希回读与正常fresh builders一致；HTML身份、原namespace/账本保持。13:30:22实际无permit返回TESTER_PERMIT_REQUIRED，有permit且proof过期返回FREE_BOUNDARY_UNVERIFIED；旧模板时间未改，TTL未延长。
- [x] 唯一Task8真实opening返回GENERATED_SCENE_INVALID，failed/111结算落盘；出生/pending保存，刷新只GET同一拒绝，四个档案stores逐值相等，13:29账本仍8/450且原7行/三cases未变。此项只证明失败与恢复路径，具体非法字段未知。
- [x] 2026-10-27整分支审查及修复复核通过；该次已审代码CI通过。操作员helper首轮另经独立复核；后续修订与最新提交检查以PR14及接入记录为准。
- [ ] 完成获批四步要求的ready开场、同S1两条Task7分支及最终真实选择→Workers AI→校验→保存→刷新续接；本次首步失败即停，没有S1、baseline、分支或choice，因此仍未完成。局部拒绝恢复不能替代成功闭环，不能复用私有分支响应或按剩余配额自动重试；质量通过前不开放公众生成。
- [ ] 前端SHA/HTML、后端部署版本、协议/规则/提示版本及账户观察已记录；模型完整质量与Task7/Task8成功路径仍未通过，生产白名单保持空，不能勾选公开上线。保留已保存V5档案的兼容stage，不以旧HTML回退破坏可读性。
- [x] 回填当前本地完成/真实阻塞/最终审查与CI待办状态；宣布已验证范围，不宣称无限免费、任意设备支持或已经消除全部叙事幻觉。

## 计划自检

用户三项方向分别由Tasks2/3/7、Task1/4/8覆盖；长期存档和原子恢复由Tasks5/6补足。所有旧版测试继续保留。Free已由所有者确认并完成实际绑定核对；模型完整能力与玩家闭环仍按实测关卡验收，不将观察估算或简单JSON样本扩大为完成。上述模块名、V5/CV4、请求身份和归档格式在各任务中保持一致。
