# Event-driven Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 主代理负责全部修改，子代理只读核验。

**Goal:** 让新人生通过即时规则事件同时获得修炼成长与人物后续，并把 AI 收窄到可选短文本。

**Architecture:** 新人生保存显式 `events.version:1`；规则先生成完整可玩的场景并原子提交。原 v7 成长、收据和轮回复用，历史 AI 人生保持原合同。可选短文本独立鉴权计量，永不参与游戏状态结算。

**Tech Stack:** 原生 JavaScript ESM、IndexedDB、Node test、Playwright、Cloudflare Workers AI / Durable Objects。

**Spec:** `docs/superpowers/specs/2026-11-13-event-driven-story-design.md`

## Global Constraints

- 基线 main `3b2b734fc5448616da5cf8e9fe9f3f573161adec`，保留其他修改及历史证据。
- V5/CV4、IndexedDB v3，旧 pending/attempt/frozen generation 不改变。
- 原 AI binding / Workers Free / GLM 单路由，原 namespace 与 unknown 计量保留。
- 不新增依赖、付费路径、自动预加载、知识库上传或定时任务。
- 全部写操作由主代理完成；测试先失败再实现，最后审阅 diff。

## Review Focus

- 旧冻结样本重放的状态、收据及 RNG 完全不变。
- 新事件菜单不能刷资源或通过导航重新掷风险骰。
- 物理同档导入、双标签竞争、事务中止不重复结算或写入错误人生。
- 模型迟到回复不得覆盖已选择后的场景；超时不禁用基础选项。
- 资源耗尽、功法完整、先拒绝与数百年闭关后仍有合理可执行路径。

### Task 1: 明确事件合同与可玩内容

**Files:** 新建 `src/game/cultivation/live/events.js`、`event-content.js`、`tests/event-story.test.js`；定点修改 `engine.js`、`validation.js`。

**Interfaces:** `createEventState()`；`validateEventState(events)`；`eventActionRule(state,proposal,baseRule)`；`resolveEventScene(state,pending)`；`advanceEvents(state,receipt)`。不执行 I/O；engine 对新事件场景完整比较。

- [ ] 编写并运行失败用例：固定出生不变、入门三种决定、同伴拒绝与援助后续、修法两路线及本人还粮。
- [ ] 实现显式新人生标记和有界事件状态，确定节点与选项。
- [ ] 加入始终可达的修炼、休整、资源与突破路径；仅新事件合同调整短程代价和导航 RNG。
- [ ] 验证伪造事件场景拒绝、资源不重复领取、完整功法不误入修补、旧冻结样本不变。

### Task 2: 原子存档与会话接线

**Files:** `src/game/live-archive.js`、`src/ui/live-session.js`、新建 `tests/event-archive.test.js`。

**Interfaces:** `archive.commitEvent({expectedArchiveId,expectedRevision,pending})` 使用 pending 快照、物理 CAS 与现有历史块；本地新人生开场/选择/刷新无 AI 请求。

- [ ] 编写原生 IndexedDB 失败用例：无网络开场、连续选择、双标签仅一次提交、事务失败保留原状态。
- [ ] 实现本地事件提交和旧请求隔离；本地出生/轮回不依赖服务能力协商。
- [ ] 导出、导入、刷新逐项比较历史、事件状态、人物关系与 RNG；注入篡改历史应拒绝。
- [ ] 验证旧 pending/attempt 仍查询原请求；新死亡与轮回领取不能重复。

### Task 3: 可选短对白服务

**Files:** 新建 `src/worker/story-prose.js`、`tests/story-prose.test.js`；定点修改 `story-api.js`、`story-production.js`、`src/ui/story-client.js`。

**Interfaces:** `/api/story/prose`、`proseVersion:1`；复用会话、reserve、settle、lookup；仅返回有界文本和来源摘要，不返回事件更新。

- [ ] 编写认证、请求上限、单次模型调用、重复请求回放、timeout/unknown 和原 turn 合同保持的失败用例。
- [ ] 使用已有 GLM transport，实现有限输入与短输出，保留免费策略与既有计量。
- [ ] 增加客户端显式请求；不自动重试或占用规则 pending。
- [ ] 运行最小 API/provider/production 回归。

### Task 4: 默认体验与浏览器交付

**Files:** `src/app.js`、`src/ui/journey.js`、必要的原有样式、版本与 README；新建 `tests/event-ui.test.js`。

**Interfaces:** 新出生传 `eventVersion:1`；旧存档自动走旧会话；可选对白独立状态与 archive/revision/scene 摘要比对。

- [ ] 编写实际浏览器用例：开局与成长无需 API、事件与修行目标同时展示、延迟 AI 回复不影响选项或当前人生。
- [ ] 接线新模式和可选对白；保留现有阅读、历史、备份与轮回入口。
- [ ] 验证手机布局、刷新与恢复；记录实际本地连续选择速度，不冒充线上模型性能。
- [ ] 执行相关测试、完整测试、语法检查及构建；只读独立审查整枝并修复本轮关键问题。
- [ ] 更新文档、版本和实际验证结果，检查 diff 后提交交付；真实模型及生产状态单独报告。

### 长篇冒险的验收范围（11 月 17 日）

用户指定的时长以同一场冒险中玩家实际阅读、权衡及操作的时间计算。允许分次存档接续。游戏内闭关年月、离开页面的时间和模型等待均不计入。多条互斥支线不能相加为一名玩家的游玩时长。

- 第一段从外院入门进入《问川图》。六次河岸处置分别涉及水权、粮籍、渡运、林契、水井和交接。每次可以查看双方处境，选择会改变后文及所得。以六折合卷和能继续修行为验收点。
- 第二段《行旅录》把知情选择推进到路线规划。灯船有潮窗，星镜有观测时刻，雪营需要多方接应。行旅能中断、重走或舍弃额外目标。以三程结印、断线恢复和可达的错路脱困为验收点。
- 接下来将人物的实际功法、灵力、手艺和境界引入跨地域主线。不同境界应解锁新的难题与人物立场，章末须让玩家亲眼看见所作取舍的长期代价。书中旧境的调查与现世人物的行动分别叙述。
- 完整冒险需要一个可达的总收束，并在通关后允许继续此生。跨世只承接确有来源的图卷、已完成的章节与未结调查，人物交情、背包和已经领过的奖励按各自规则结算。
- 每次增加内容均检查一条实际可玩的单线路线，记录独有场景、重复动作、可选探索、境界及资源门槛、失败和恢复点。分别验证操作可达性和阅读节奏。最终用自然游玩的分段计时核验约 20 小时目标；自动快进、想定阅读速度与资源等待不能单独作为达标证据。
