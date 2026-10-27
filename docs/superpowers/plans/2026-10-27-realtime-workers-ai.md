# 问鼎实时剧情生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 去掉固定一世时长和预制终章，让每次肉鸽选择通过Cloudflare Workers AI免费额度内实时推动剧情，人物实际死亡才结算。

**Architecture:** 独立V5/CV4活动快照、纯规则结算、生成回合校验、IndexedDB分段档案；同源Worker AI API与SQLite Durable Object预算/幂等协调。旧引擎、旧档与旧离线版保留。

**Tech Stack:** 现有原生JavaScript/Node24、node:test、浏览器IndexedDB、Cloudflare Workers AI binding、SQLite-backed Durable Objects。

**Spec:** `docs/superpowers/specs/2026-10-27-realtime-workers-ai-design.md`

**Status:** 仅规划已完成。下面全部实现任务尚未开始；不会因4.0已交付而自动勾选。

## Global Constraints

- 新模式 `version:5 / mode:cultivation / contentVersion:4`；旧v1/v2/v3和version4的CV1/CV2/CV3行为、随机与导入导出保持原样。
- 不设置20—30分钟、固定场景数或固定通关步数目标；只有规则确认的死亡结算。登仙/问鼎继续人生。
- 模型只提出事件、对话和行动意图；年龄、境界、物品、伤势、寿命、死亡与奖励由规则控制。
- 请求身份为runId/turnId/baseRevision/stateHash/choiceId/rulesVersion/promptVersion/requestId；失败不提交人物状态，未知调用消耗不能当零。
- opening与choice共用事务；出生事实先落盘，刷新不重掷。过期/丢失会话先暂停，明确重试才创建关联旧请求的新attempt，不重复结算人物行动。
- 免费硬边界不明则关闭实时推理；禁止自动付费升级、预付credits或收费模型回退。北京时间08:00对应当前免费额度重置。
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

- [ ] 先写并观察失败：未知计费状态、付费模型、缺AI绑定、超过实验预算时必须在推理前拒绝。
- [ ] 只读确认实际套餐、账号级其他用量与剩余额度；若不能证明免费硬边界，将具体阻塞记入账本，不启用推理。
- [ ] 首批全流程共用至多10次且保守总预算不超过800 Neurons的实验账本，按本项/Task7/Task8建议分配4/4/2次，先达到任一边界即停；本项在有硬限制的临时环境验证中文、response_format、停止原因、推理文本及实际用量。预算用尽而验证未通过时保留待办。
- [ ] 记录延迟样本和结构通过比例；不使用“免费余额未知”“目录能查到模型”替代推理验证。若模型不满足结构/质量，记录失败并在免费白名单内重新选择，禁止隐式昂贵后备。
- [ ] 运行 `node --test tests/workers-ai-provider.test.js`，核对真实证据与fixture标识分离，独立复核并提交接入档案。

**完成条件：** 可证明零付费路径、可重复的中文结构化调用、明确失败语义。未满足则后续可继续纯本地准备，实时上线仍被门禁阻止。

### Task 2: 新内容版本与死亡才终结的人生规则

**Files:** 新建 `src/game/cultivation/live/{model,engine,validation,schema}.js`、`tests/live-engine.test.js`；修改 `src/game/save-format.js` 的版本分发（旧路径不改规则）。

**Interfaces:** `createLiveGame(options)->LiveState`（出生固定、awaitingOpening）；`prepareOpening(state,{requestId})->PendingTurn|Rejected`；`prepareChoice(state,command)->PendingTurn|Rejected`；`commitTurn(state,pending,scene)->LiveState`；`settleDeath(state,pending)->LiveState`；`compileChoices(state,proposals)->ExecutableChoice[]`。opening的choiceId为null、收据为出生事实，不扣时间/资源；第一幕提交后active，真实死亡后dead。`stateHash`采用规范化JSON的SHA-256；不以对象属性迭代顺序产生不同身份。

- [ ] 写失败测试：登仙/问鼎后仍alive；归隐不能直接ended；实际寿尽/致死战斗才ended，死亡后不生成新回合。
- [ ] 写失败测试：不同策略产生不同资源/风险/关系后果；未知intent、任意奖励、跳级、免费复活和无耗时刷资源被拒绝。
- [ ] 实现独立规则目录与选择编译，保留可解释成本/已知危险；ActionReceipt包含已选行动、时间/资源/随机变化及死亡/存活结果。
- [ ] 验证未提交副本不改原状态；同一pending结果不会在重试时重掷随机；旧版本序列和完整存档保持原样。
- [ ] 验证开场准备不重复创建出生事实、抽资质或付成本；awaitingOpening不能执行普通选择，第一幕也不能由模型改写出生条件。
- [ ] 运行 `node --test tests/live-engine.test.js tests/campaign-birth.test.js tests/campaign-save.test.js`，独立评审后提交。

### Task 3: 选择驱动的剧情协议与连续记忆

**Files:** 新建 `src/game/cultivation/live/memory.js`、`src/worker/story-provider.js`、`tests/live-story-contract.test.js`；补充live/schema.js。

**Interfaces:** `buildStoryContext(state,pending,relatedRecords)->StoryContext`；`validateGeneratedScene(raw,context)->GeneratedScene`；`buildMemoryDelta(receipt,scene)->MemoryDelta`；`generateScene(ai,profile,context)->ProviderResult`。ProviderResult保留实际模型、用量、结束原因和attempt，不包含密钥。

- [ ] 写失败测试：同一初始条件的两个不同选择形成不同事实收据与后续上下文，已解线索不当作未解、已死人物不能无依据复活。
- [ ] 写失败测试：输入含伪指令/原型键/HTML/超大文本、输出截断/未知字段/机械事实冲突时拒绝；不同姓名不应改变规则权限。
- [ ] 生成新的事件、关系和2—3项行动提案，接入Task2编译；不得只在固定场景前追加一段环境文字。
- [ ] 由规则事实、相关实体、未解线索、近期回合和派生摘要构建有界提示；全量原文不发送，摘要不得覆盖事实日志。
- [ ] opening上下文消费出生事实收据，choice上下文消费实际行动收据；两者都通过同一结构、机械事实和可编译选项校验。
- [ ] 运行 `node --test tests/live-story-contract.test.js`；保留关键事实跨压缩检索证据，独立评审后提交。

### Task 4: 同源API、免费预算与幂等调用

**Files:** 新建 `src/worker/{index,story-api,story-budget}.js`、`tests/story-api.test.js`、`tests/story-budget.test.js`；修改构建入口以接收env/ctx，保持静态路由测试。

**Interfaces:** `createStoryApi({provider,budget,config})->{fetch(request,env,ctx)}`；`POST /api/story/session`建立受限匿名会话（建议24小时有效，签发凭据及非敏感sessionRef）；`POST /api/story/turn`返回TurnResult；`GET /api/story/turn/:requestId`只查询该会话既有结果；`GET /api/story/capabilities`返回协议/模型可用状态。attempt绑定sessionRef，凭据不得进入导出文件。预算DO提供 `reserve(input)->Reservation|Denied`、`settle(reservation,usage,status)`、`lookup(sessionId,requestId)`，使用SQLite事务与服务端时间。

- [ ] 写失败测试：并发重复请求只预留一次，结果重放不再推理；未知/跨会话requestId不可读取；重启后幂等与预算记录仍存在。
- [ ] 写失败测试：记录在会话有效期内不提前清理；过期会话/已清理记录/跨浏览器丢凭据返回paused而不重新调用；明确重试才建立新attempt并关联原请求。
- [ ] 写失败测试：全球预算不足、其他账号用量无法确认、Paid边界不明、输入/输出超限、429/3036和3040分别进入正确暂停状态。
- [ ] 实现短事务预算预留与结果记录、请求体/会话/IP限制、固定模型白名单；推理等待放在协调对象外，不以浏览器预算/Origin/缓存当作硬门禁。
- [ ] 实现unknown保守记账和用户重试attempt；预算按服务端UTC日期归属，跨日未知上界继续扣新日可用预算，实际核对前不释放，迟到结算不误退其他日期。预算账本独立于短期结果缓存；取消、超时或清缓存不释放未知消耗，不无限自动重试。
- [ ] 运行 `node --test tests/story-api.test.js tests/story-budget.test.js tests/release-channel.test.js`，实际Workers运行环境定向验证后独立评审提交。

### Task 5: 长期历史、归档与恢复事务

**Files:** 新建 `src/game/{live-archive,live-save-format}.js`、`tests/live-archive.test.js`、`tests/live-save-format.test.js`；必要适配 `src/ui/session.js`，保留旧persistence.js。

**Interfaces:** `openLiveArchive()->Archive`；`Archive.create({state,pending})`原子保存出生与开场；`Archive.prepare(pending)`保存后续待提交行动；`Archive.commit({expectedRevision,nextState,scene,memoryDelta})`；`Archive.load(runId)`；`Archive.readHistory(runId,cursor,limit)`；`exportLiveArchive(archive)->ReadableStream`；`importLiveArchive(stream)->ValidatedArchive`。数据库 `wending-live-v1` 的runs/pending/history/memory同事务更新。

- [ ] 写失败测试：超过旧1M大小仍可继续；跨块索引/次序/校验值准确；旧JSON导出逐字保持。
- [ ] 写失败测试：写入中断/磁盘满/权限拒绝/导入半包/缺块/坏哈希时保留原人生和历史，恢复后能读取上次完整提交。
- [ ] 写失败测试：含opening或choice pending的档案导出/跨浏览器导入保持事实收据、随机与原请求关联，不携带服务端凭据；失去会话后能显式续接。
- [ ] 实现每128回合或256KiB分块、有界活动快照、相关记忆索引及分页历史；不要按回合总数或历世总数结束游戏。
- [ ] 实现流式.wending.jsonl导入导出和临时档案切换；新格式单记录有界，不能先全量载入再去掉大小检查。
- [ ] 运行 `node --test tests/live-archive.test.js tests/live-save-format.test.js`，用真实浏览器IndexedDB验证刷新/配额故障，独立评审后提交。

### Task 6: 实时选择界面与可恢复等待

**Files:** 新建 `src/ui/{live-session,story-client}.js`、`tests/live-app.test.js`；修改 `src/app.js`、`src/ui/journey.js`、`src/ui/character.js`、`src/ui/paper.css`，仅增补新模式分发。

**Interfaces:** `createLiveSession({archive,client,engine})->{start,choose,resume,retry,view}`；`requestTurn(pending,context)->TurnResult`；共享视图显示当前场景、真实选项和pending/paused状态，完整历史分页读取。

- [ ] 写失败测试：双击、刷新、后退、断线、迟到回应、旧标签页不能重掷或重复结算；等待期间不提前改变角色资源。
- [ ] 写失败测试：创建后第一幕尚未返回就刷新仍续接同一opening；长期暂停后缓存已清理或含pending跨浏览器导入时可恢复，明确重试只换attempt、不重掷或重付行动成本。
- [ ] 写失败测试：额度不足/模型忙/超时/保存失败都能保持待续状态；规则已判死亡时即使AI离线也正确结算。
- [ ] 接入能力协商和完整响应提交；等待文案简短，可重试/读历史/导出，不展示未校验JSON，不暗中切换固定主线。
- [ ] 更新新模式的联网/最小上下文传输说明；旧模式与旧离线继续原行为。回滚或API协议不匹配时能恢复旧人生和备份。
- [ ] 运行 `node --test tests/live-app.test.js`，实际320/390/桌面键盘与焦点/刷新/导入导出验证后独立评审提交。

### Task 7: 长线因果、死亡与真实生成质量

**Files:** 新建 `tests/live-long-run.test.js`、`docs/evidence/live-story-quality-*.json`；更新QA_REPORT中的新模式独立章节。

**Interfaces:** 消费Tasks2—6；记录sampleKind=fixture或workers-ai，inputHash、modelId、用量、接受/拒绝、原因与时延，不把模拟当真实。

- [ ] 先用确定性模拟供应商运行至少1000回合的存活路径，跨越旧篇章终点和旧总量限制；断言活动状态有界、全历史可恢复、运行不依赖固定NODES。
- [ ] 验证短命/长命/寿尽/战死、登仙后继续、死亡后不再生成；测试步数不是产品上限。
- [ ] 使用首批实验账本为本项预留的预算（建议至多4次真实调用），做连续叙事与反事实选择样本，逐条审查人物/年龄/地点/关系/悬念与行动代价；不通过的结果不能直接进存档，也不能耗用Task8预留量后仍声称已验证发布。
- [ ] 记录重复事件、事实冲突、结构成功率、实际延迟和用量；有严重矛盾则修复prompt/契约再复核，不用时间目标凑篇幅。
- [ ] 运行 `node --test tests/live-long-run.test.js`，审查样本来源与实际边界后提交。

### Task 8: 后端部署、前端启用与最终交付

**Files:** 新建受控的Worker部署配置/绑定迁移说明；修改 `scripts/build-gateway.js`、`.github/workflows/validate-deploy.yml`、`README.md`、`docs/{ROADMAP,DEPLOYMENT,PRODUCT_SPEC,QA_REPORT}.md`。

**Interfaces:** 后端发布包含AI/SQLite DO绑定、规则/提示版本和协议版本；前端先检查capabilities才启用新模式。保留现有HTML渠道摘要校验。

- [ ] 为多模块打包、缺绑定、前后端协议不匹配、回滚、静态HTML降级写并观察失败测试。
- [ ] 先部署兼容后端和免费门禁，再发布前端；发布凭据与模型API能力不得进入浏览器或离线包。
- [ ] 完整 `npm run release`、旧版本回归、独立整分支审查通过后，在首批实验预留预算（建议至多2次真实调用）内真实执行开场及一次选择→Workers AI→校验→保存→刷新续接，再验证真实死亡及额度暂停；死亡与人为调低应用额度不额外调用模型，也不得为测试耗尽账号全部免费量。
- [ ] 核对前端SHA/HTML摘要、后端部署版本、模型与规则/提示版本、免费用量证据；模型推理仍未验证或零付费门禁不成立时不得勾选上线。
- [ ] 回填全部任务状态；宣布已验证范围，不宣称无限免费、任意设备支持或已经消除全部叙事幻觉。

## 计划自检

用户三项方向分别由Tasks2/3/7、Task1/4/8覆盖；长期存档和原子恢复由Tasks5/6补足。所有旧版测试继续保留。非功能性的计费/模型实际能力未知作为首项实测关卡，不伪造成功。上述模块名、V5/CV4、请求身份和归档格式在各任务中保持一致。
