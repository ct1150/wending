# Story Coherent Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 让具体选项承接当前事件，让下一回合回应所选目的，并兼容已有实时人生。

**Architecture:** 复用现有场景、行动收据和记忆存储，补齐近期正文及具体选择。同一次 CF GLM 请求生成正文、选项文字与受约束动作；服务端继续验证引用及实际结算。新客户端显式协商剧情动作，旧客户端仍获得可读取的动作，旧 pending 先查询恢复。

**Tech Stack:** 原生 JavaScript ESM、Node test、IndexedDB、Cloudflare Worker/SQLite Durable Object、原生 Workers AI JSON Schema SSE。

**Spec:** `docs/superpowers/specs/2026-10-30-story-coherent-choices-design.md`

## Global Constraints

- 每场 2–3 个围绕当前事件的具体选择，允许离开，下一段先回应选择。
- Cloudflare 免费 GLM 单路由；同次生成，流式预览，完整校验保存后开放选项；预加载关闭。
- 原 namespace、已发生历史、失败与 unknown 计量保留；原行动数值和旧收据计算不变。
- 已有实时人生可继续；旧离线保持原规则；在途回合先按原身份恢复。
- 输入继续遵守 context 7000 B（含二次转义）和 provider input 24576 B，上限不提高。
- 所有文件由主代理修改，子代理只读；保留现有未跟踪证据。工作分支 `feat/story-choice-continuity`，基线 main `c00f56781dc120394c7d96785350d2e583c55207`。

## Review Focus

- 旧标签页不能收到其无法识别的新动作；请求能力与缓存身份绑定，GET 恢复不变。
- 升级时已有 pending/ready 回应能恢复，不因新上下文导致重复结算或自动重发。
- 长正文、emoji 和密集旧义务仍受预算约束，优先保留当前事件的结尾和选择目的。
- 零日互动没有物品、修为或关系刷取；援助不能复活死者，离开对话不等于旅行。
- 放弃线索与违背明确承诺按实际含义处理；模型文字不改变规则收据。

---

### Task 1: 当前场景与近期决定进入上下文

**Files:** `src/game/cultivation/live/memory.js`, `tests/live-story-contract.test.js`, `tests/story-coherence.test.js` (new).

**Interfaces:** 保持 `buildStoryContext(state,pending,relatedRecords,options)` 和现有 DTO；新增 `sceneTurnRecord(scene,{runId,turnId,action})` 返回已有 kind=turn 的有界记录。文本至多 500 UTF-16 units，优先保留地点、选择及场景尾部，实体引用沿用原 ID。

- [x] 写失败回归：旧已提交场景的求救声/地点出现在 recent；所选具体 label 在 receipt 中；输入和 state 不被修改；长 emoji 正文及密集记忆不越界。
- [x] 运行 `node --test --test-name-pattern='context|recent|budget' tests/story-coherence.test.js`，确认因缺少场景正文失败。
- [x] 在原 selection 逻辑中优先选入当前场景，按预算缩短正文；按记录 ID 去重，保留 coverage/身份验证。
- [x] 运行新测试及 `tests/live-story-contract.test.js`、`tests/story-glm-wire.test.js`，检查 diff 后提交。

### Task 2: 剧情动作与原规则兼容

**Files:** `src/game/cultivation/live/model.js`, `engine.js`, `schema.js`, `tests/story-coherence.test.js`, `tests/live-engine.test.js`.

**Interfaces:** additive intent `interact`，approach 为 `ask/observe/help/decline/leave`。原动作计算不变。

- [x] 写失败回归：ask/observe/decline/leave 为 0 日、无物品/修为/关系收益；help 为 1 日、消耗 1 行粮、对活人关系 +2，无物品或修为奖励；缺粮或死者禁止援助。
- [x] 运行对应测试，确认因未知行动失败；随后添加明确目标限制与规则。
- [x] 验证新动作不能伪装成移动/交易，重复 attempt 不重复执行；旧固定种子收据、存档及离线测试保持通过。
- [x] 检查 diff 后提交。

### Task 3: 具体选项与客户端能力协商

**Files:** `src/worker/story-glm-wire.js`, `story-provider-core.js`, `story-named-targets.js`, `story-provider.js`, `story-api.js`, `src/ui/story-client.js`, tests.

- [x] 同次原生流式 JSON Schema 生成5项场景字段（blocks/choices/title/location/memoryDeltas）；新选项为 action/target/stake/purpose/anchor。target 在引用处写完整 kind/name/ref/status，不再让模型在庞大别名表中挑选对象。已知 ref 必须匹配名称和类型，ref未指定时按本次上下文唯一名称恢复身份，同名歧义拒绝；新生成的status固定null，沿用既有状态，仅明确death记忆推动死亡；空串、null及文本null都表示未指定ref，不能区分同名对象。新对象由服务端分配本回合引用，再复用原8字段 decoder 及全部正式校验。服务端按实际动作和目标生成 label，purpose不超过50字，anchor引用本场段落；新记忆从段落提取原文。旧 label wire 和正式历史仍可回放。
- [x] 完整动作分支明确目标类型与必填字段；目标按人物/地点/势力与资源类型约束，名称与引用在同处核对，避免野兽目的绑定旁边猎户；未知字段、矛盾状态与死亡规则仍拒绝。旧8字段及旧客户端格式继续可回放。新生成必须有两个可执行选择和明确退出，不能重新旅行到当前地点。询问仅实际答复者对白，拒绝/告辞与观察仅一段旁白，避免把NPC反应强行标成主角对白；主动告辞后移除同一对象的后续互动，提供当前环境观察及独立去向；非旅行回合地点不变，旅行地点锁定实际目的地。
- [x] 新生成的已知人物选项须有本场出场或同日近邻依据，旅行不默认带走旧人物；新增本地记忆不能错误挂到未出场的旧人物。自动退出找不到实际对象时用self。既有历史和缓存不增加这些新推理限制。
- [x] 能力由服务端公告、新 POST 的 `X-Story-Actions:1` 与 `storyActions:true` 正文共同协商并绑定请求指纹；旧服务拒绝新正文，旧请求原模式不变。实际输入维持24 KiB，不改冻结上下文，不增加模型请求。
- [x] 原生失败和语义拒绝保留证据，不能用结构ready替代人工审阅。

### Task 4: 近期记忆持久化和旧旅程恢复

**Files:** `src/game/live-archive.js`, `src/ui/live-session.js` (only if recovery needs it), `tests/live-archive.test.js`, `tests/live-app.test.js`, `tests/story-coherence.test.js`.

**Interfaces:** `readStoryRecords({recent:true})` 复用原 history tail 派生最近 2 条 `sceneTurnRecord`（最多读取2个chunk）及必要实体，不复制正文存储；`_derived` 为新剧情行动保存实体相关的 rules fact。`buildMemoryDelta` 原合同不改。新 attempt 在首次 POST 前原子保存不可变 generation context/能力模式，旧 attempt 缺标记时沿用原模式。

- [x] 写并运行失败回归：已提交/导入旧旅程有前文；新旅程存储和读取最近决定；重复提交不新增；引用仍正确。
- [x] 验证 legacy pending 的原 GET 缓存恢复，old ready + 新前端能保存一次；无法确认的 in-flight 不自动重发。
- [x] 实现有界读取，验证断电/事务失败、跨标签 CAS、导出导入和旧离线读取。检查 diff 后提交。

### Task 5: 完整验证及真实六回合剧情验收

2026-10-31 状态：完整测试 1005/1005、178 个 JS 语法检查和构建通过；修复人物在场绑定及保留实际撤退后，四个真实回合已保存。随后告辞四次原样复制前段拒绝，均被拦截，六回合门槛尚未完成。明确当前动作及合并用户消息两项格式实验无效，已撤回；源码和测试恢复到已验证的 `f8610b8` 行为。原生产保持 100%，临时路由和本地测试凭据已清理。见[实际记录](../../evidence/story-coherence-2026-10-30/release-blocked-2026-10-31.json)。拒绝、告辞是否改由规则即时完成仍待新的产品选择，不能假定已经改变设计。

**Files:** 新的 `docs/evidence/story-coherence-2026-10-30/`；必要的发布说明和对应 profile 验收引用。

- [ ] 运行适当完整 release、显式 production 打包与独立只读整支审查；修复发现的问题并保留失败证据。
- [ ] 用鉴权且过期的私有入口验证新请求能力及原生 CF；原生产 100%，候选 0%，存储使用隔离对象、原 namespace，禁止付费/智谱/预加载。
- [ ] 规则与协议定向回归覆盖五类剧情行动、旧义务和恢复；至少完成 6 个真实连续回合，逐项记录正文、选项、选择、后果、记忆、保存刷新和首段/总耗时，人工审阅连续性。
- [ ] 失败不自动循环生成，不删除 rejected/unknown；有阻碍则保存实际状态，不能用接口成功代替剧情验收。

### Task 6: 精确候选 CI、发布和公开复验

- [ ] 原生验收通过后更新晋升证据、README/部署说明及版本；检查最终 diff，推送新 PR 并核对精确候选完整 CI。
- [ ] 按已有授权合并；核对 main CI 和静态 manifest；从 exact main 的 LF 源码显式构建 production 前后端，保留原 namespace、原回滚版本和旧观察时间的 Free proof。
- [ ] 读回模块、绑定和摘要；公开浏览器真实连续选择、保存、刷新恢复及旧档读取；失败按部署合同回滚。
- [ ] 清理临时路由、资源与测试凭据，保留报告；不创建定时重复测试。
