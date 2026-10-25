# 对话与选项版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把百世问鼎的新人生改为只需阅读对话并选择行动的完整三界冒险，保持真实后果、能力组合、同世界轮回和旧存档。

**Architecture:** 为新规则建立独立 journey 引擎与内容目录，通过纯函数生成可展示模型、校验并结算选择。保留现有引擎服务合法 v1/v2 的当前人生，由统一存储边界区分版本；新人生只用一个阅读流。内容采用作者编写的条件、代价和后果，不引入运行时生成或新框架。

**Tech Stack:** 原生 JavaScript ES modules、CSS、Node.js >=22、node:test、现有零运行时依赖构建器、Cloudflare Worker 单文件发行。

**Spec:** [2026-10-25-dialogue-only-design.md](../specs/2026-10-25-dialogue-only-design.md)

## 实施状态更新 — 2026-10-25（上海）

Task1–7 源码实现、代表公共路线与作者条件矩阵、最终独立审查与修补复核、文档／离线发行及真实远端 PR／CI／合并均已完成。2.0.0 已部署到现有 Worker，实际运行时源码为 `4dadfd046f1e1413e721a5679745272ef22e07fb`，生产 HTTP 的 health／版本／下载 hash 及下列实际桌面路径已核对；精确命令与结果见 [QA](../../QA_REPORT.md)。320px／深色、物理手机、读屏与真人节奏仍未验收，不能称全部体验验收完成。

下方复选表示实际工作；历史失败测试命令依据各任务报告。条件矩阵覆盖作者变体，公共路线有界验证真实后继，不代表所有可达历史已穷举。Task3 最初依“无获准环境如实记录”完成记录；发布后实际桌面路径已有观察，具体范围见 QA。20–30分钟与寿元压力没有真人证据。

## Global Constraints

- 通常展示 2–3 个当前行动；章末交接、死亡结算等确有状态边界时允许 1 个继续动作。
- 主章中的关键承担和完成的经历带来境界变化，并直接开放下一章所需的通行能力。
- 普通冲突一次选择即可结束，重要冲突最多三次。
- 随机发生在承诺之前；界面读取、刷新、打开帮助或回看都不推进随机数。
- 每个大章最多有一次可选学习机会，一世至多三项新能力，再加最多一项转世传承。
- 三界道证、世界事实和累计传承历史跨世保留；第一世可通关，无强制死亡次数。
- 旧存档当前人生继续原规则，到结算时才可进入新规则；坏档不覆盖。
- 沿用原生 JavaScript、零运行时外部依赖、浏览器本地存档与单文件离线发行。
- 触控目标至少 44px，320px 宽度不横向溢出，浅色/深色可读。
- 20–30 分钟一世是待真人验证的目标，不能用场景数量或自动测试当作时长证据。

## Review Focus

- 页面回看、双击、旧 revision 和恢复后重提同一选择：不重复扣费、成长、发奖或抽事件；任务 1、2、3 验证。
- 无药、重伤、失去账页、缺少全部可选能力或余寿不足：仍有真实可执行的后继或明确结算；任务 4、5 验证。
- 同一世先结算药谷再完成幽冥、天界：不会覆盖旧事实，也不会被旧世代递增规则拒绝；任务 5、6 验证。
- 已死人物、已毁灵种、已完成后世任务、已得全部道证：不会复活、复原、重开旧任务或困在空章节；任务 6 验证。
- 导入畸形 v3、恢复旧战斗、写存档失败、旧人生结算迁移：保留原始数据与可导出进度，转换失败不取代有效当前档；任务 2、6 验证。

## 状态与模块边界

以下接口和名称是实施默认，属于本计划确定的工程选择。

### 新模块

| 文件 | 单一职责 |
| --- | --- |
| `src/game/journey/engine.js` | 创建新人生、生成公开视图、验证并结算一次选择、自然结束与转世 |
| `src/game/journey/content.js` | 汇总章内容、能力/传承表，按已保存状态选择作者写好的变体 |
| `src/game/journey/chapters/mortal.js` | 药谷、离谷、人间道证与人间机会 |
| `src/game/journey/chapters/nether.js` | 亡者旧账、幽冥道证与幽冥机会 |
| `src/game/journey/chapters/celestial.js` | 天界立约、天界道证、问鼎与天界机会 |
| `src/game/journey/validation.js` | v3 结构、状态一致性和内容引用检查 |
| `src/game/journey/migration.js` | 仅在合法旧人生结算时迁移；逐项映射历史事实和传承 |
| `src/game/save-format.js` | 各版本存档的序列化/反序列化分发；拒绝未知版本 |
| `src/ui/journey.js` | 安全转义并渲染一个阅读流，不读取引擎内部状态 |

`src/game/engine.js` 保留旧规则，不把新规则强行塞进旧的 HP 战斗与修为接口。`src/ui/session.js` 和 `src/game/persistence.js` 通过统一存储入口工作。`src/app.js` 根据有效状态版本选择新的阅读流或旧人生兼容流程。

### 公开接口

```js
// src/game/journey/engine.js
createJourney({ seed })                      // => JourneyState
getJourneyView(state)                         // => JourneyView
chooseJourney(state, { revision, sceneId, choiceId })
// => { kind: 'applied' | 'stale' | 'unavailable', state, message }

// src/game/journey/validation.js
validateJourney(state)                        // 有效时返回 state，无效时抛出可读错误

// src/game/journey/migration.js
getLegacyBridgeChoices(validLegacyState)      // => 至多三项交接选择；未结算时为空
migrateLegacyLife(validLegacyState, { choiceId, seed }) // => JourneyState

// src/game/save-format.js
serializeGame(state)                          // => string，先验证对应版本
deserializeGame(raw)                          // => 合法旧 state 或 JourneyState

// src/ui/journey.js
renderJourney(view)                           // => 已转义 HTML
```

`JourneyState` 固定使用 `version: 3`、`mode: 'dialogue'`、`contentVersion: 1`、非负 `revision`、保存的随机状态、`phase: 'playing' | 'ended' | 'victory'`。生命周期与转世选择也由 `chooseJourney` 处理，不给 UI 另一套玩法命令。

状态分为 `world`（年份、世代、世界事实、人物、道证、累计传承、已完成任务、生平）、`life`（年龄、寿限、命损、境界、伤势、能力、物品、当前传承、当世事实）、`scene`（章节、节点、已选定机会）、`transcript`（已经发生的文本与选择）。世界结算记录带 `episodeId`、`generation`、单调 `sequence` 和 `outcomeId`；同一世可有多条，完全相同的任务完成记录不可重复奖励。

`JourneyView` 包含 `revision`、`sceneId`、`phase`、`title`、`location`、`blocks`、`choices` 和 `summary`。每项 choice 包含稳定 `id`、`label`、`detail`、`enabled`、必要时的 `reason`。`blocks` 是有稳定 ID 的叙述、对白、已选行动和结果；UI 不从成本倒推故事文本，也不调用随机函数。

`chooseJourney` 不改写输入。旧 revision、错误场景或不可用行动返回原状态，不推进 RNG。应用选择时先验证成本和生命条件，再按作者定义提交一个完整事务；已知会结束人生的选择按明示终场处理，不能先死亡再发普通奖励。

## Task 1: 确定结算的故事引擎与可玩切片

**Files:** 创建 `src/game/journey/engine.js`、`content.js`、`validation.js`、`chapters/mortal.js`、`tests/journey.test.js`、`tests/journey-content.test.js`。

**Interfaces:** 产出上文 `createJourney`、`getJourneyView`、`chooseJourney`、`validateJourney`。content 模块提供具名 `JOURNEY_CHAPTERS`、`JOURNEY_ABILITIES`、`JOURNEY_LEGACIES`、`resolveJourneyScene(state)`；引擎与验证器只读这些表。

- [x] 用公开接口写失败测试：同一种子开局一致；第一次选择产生不同人物回应；资源/证物只能实际取得后使用；旧 revision 不重复扣费；界面读取不推进随机数；一场重要冲突至多三次决定并进入一个明确后继。
- [x] 运行 `node --test tests/journey.test.js tests/journey-content.test.js`，确认失败来自缺失的新行为而非测试环境。
- [x] 实现状态、事务、公开视图与作者场景解析。能力 ID 固定为 `shelter`、`discern`、`burn-life`、`herbalism`、`soul-lamp`、`bind-oath`；伤势固定为 `well`、`hurt`、`severe`。
- [x] 写出规格第 7 节对应的完整切片：谷口入场、药包取舍、一种实际学习机会、温渡/证物冲突与后果回声。切片必须有真实分支，不只渲染同一段后续。
- [x] 内容校验拒绝未知后继、无法解析的条件、同一变体超过三项、没有出口的非结算节点。有限的机会 ID 在进入时写入存档，不按渲染重抽。
- [x] 运行上述测试并执行 `npm run check`。提交可独立验证的引擎和内容切片。

## Task 2: 存档边界与兼容恢复

**Files:** 创建 `src/game/save-format.js`、`tests/journey-save.test.js`；修改 `src/game/persistence.js`、`src/ui/session.js`、`tests/session.test.js`。

**Interfaces:** 消费任务 1 的创建和验证接口；产出 `serializeGame`、`deserializeGame`。保留当前 `SAVE_KEY = 'baishi-wending-save-v1'` 和 session 的错误恢复职责。

- [x] 写失败测试：v3 任意选择后序列化往返得到相同下一步和 RNG；v1/v2 继续使用现有严格校验；合法旧 combat/ended/victory 不被当作空档；未知版本、缺失必需字段和非法内容引用拒绝。
- [x] 在 session 测试中增加首次无档创建 v3、读取失败不新建覆盖、无效 JSON 原始文本可导出、保存失败仍能保留和导出当前内存进度的断言。
- [x] 运行 `node --test tests/journey-save.test.js tests/session.test.js`，确认新增断言先失败。
- [x] 实现存档分发；旧 `engine.deserialize` 仍负责验证和已有 v1→v2 路径。取消 app 对所有状态无条件使用旧 serialize/deserialize 的假设，但不在此任务转换旧人生。
- [x] 验证后运行同一命令及 `node --test tests/story-save.test.js tests/history.test.js`，确认原有数据保护有效。提交。

## Task 3: 单一阅读流正式承载切片

**Files:** 创建 `src/ui/journey.js`、`tests/journey-ui.test.js`；修改 `src/app.js`、`src/ui/paper.css`、`tests/paper-ui.test.js`、`tests/build.test.js`。

**Interfaces:** 消费 `JourneyView` 与统一存档接口；产出 `renderJourney(view)`。按钮携带 revision、sceneId 和 choiceId，所有新人生玩法通过同一个选择处理入口。

- [x] 写行为测试：首局直接出现剧情与选择；当前成本包含当前可用值；已选项与后果进入阅读流；文案及道号安全转义；新人生没有修行、装备、三界和身份表入口；合法旧人生仍可继续。
- [x] 运行 `node --test tests/journey-ui.test.js tests/paper-ui.test.js tests/build.test.js`，确认新增行为失败。
- [x] 实现 journey 视图、选择提交、结果焦点和同页历史。全局“更多”只管理帮助与存档。首屏不弹教程；无决策对白合并展示。
- [x] 以纯 CSS 完成纸页阅读宽度、44px 触控、窄屏折行、浅深色和减少动画支持；不写逐字匹配 CSS 或复制实现的测试。
- [x] 更新构建测试以验证新模块能被现有 bundler 打包；遵守它仅支持本地具名 imports/exports 的限制，不引入动态 import、import.meta 或第三方运行时。
- [x] 运行上述测试和 `npm run build`。在获准的实际预览/验收环境走一遍切片；若没有获准环境，如实记录未做视觉试玩。不得绕过此前拒绝的本地原型 URL，也不搭替代浏览器或服务去规避拒绝。
- [x] 记录一次切片评审：玩家是否知道处境、两个选项是否是不同方法、结果是否改变局势。修正具体问题后提交；切片不作为完整改版发布。

## Task 4: 药谷完整三结局与真正的离谷交接

**Files:** 扩展 `src/game/journey/chapters/mortal.js`；创建 `docs/story/dialogue-journey.md`、`tests/journey-mortal.test.js`；按需更新内容表。

**Interfaces:** 继续使用 `resolveJourneyScene(state)`。输出人间章的三种谷地事实、真实证物/救援/承诺、人间道证与离谷节点，禁止依赖旧的自由行动菜单。

- [x] 写三条公开引擎路线的失败测试，分别进入共守、接管、焚种迁民；断言真相、灵种、幸存者和承诺按实际经历保存，并在选择远行后得到明确下一章 ID。
- [x] 写无药、失去账页、严重伤势、错过调查期限以及未学任何可选能力的分支测试，至少存在真实可执行的后继，不保证全员获救或完整翻案。
- [x] 运行 `node --test tests/journey-mortal.test.js`，确认缺失路线失败。
- [x] 根据现有作者稿重写具体行动、去除身份门禁并改用实际能力/经历；保留最多深入两条调查线的取舍。旧八年调查期限是否仍适合新文字节奏，由本任务给出唯一的有限规则并写入作者稿和断言，不能同时叠加两套隐藏期限。
- [x] 写药谷之后的人间道证与交接事件；必需成长确定发生，获得道证仍需完成事件。明确区分“交接后远行”与“守望余生”。
- [x] 为人间提供两个有不同后果的有限可选遭遇，每世只选一个；学习至多一次，可拒绝。运行章节测试和引擎测试后提交。

## Task 5: 幽冥、天界与首世问鼎闭环

**Files:** 创建 `src/game/journey/chapters/nether.js`、`celestial.js`、`tests/journey-campaign.test.js`；扩展内容汇总和 `docs/story/dialogue-journey.md`。

**Interfaces:** 消费已存的人间事实与证物；输出幽冥/天界道证、后续成长、问鼎结果。三种人间结果共用章节骨架，引用真实不同的凭据和责任。

- [x] 写失败测试：两条不同方法从 `createJourney` 第一世开始，经所有真实行动到 victory；不可手工注入能力、境界、证物或道证。第三条代表路线验证损失或未竟仍有合理后继。
- [x] 写“无可选能力”主路、局部冲突失败、余寿不足以付某项成本、已持道证跳过重复取证等行为测试；继续路径要真的付得起代价。
- [x] 运行 `node --test tests/journey-campaign.test.js` 确认缺失行为失败。
- [x] 写幽冥亡者旧账、天界立约、三界问鼎的完整文本与结果。每界再写两个可选遭遇；全库至少六个，强制主路不占随机池。
- [x] 写至少两处能力组合解法；六种能力各有至少两个后续相关情境。能力改变方法而非仅减少同一笔费用，条件同时核查证物/人际/曾做过的行动。
- [x] 给每个重要冲突记录次数上限和后继。死亡条件、承诺约束、寿元耗费都在选择前可读；没有“第三次点击自动获胜”的默认规则。
- [x] 选定首版寿限、旅途年份和命损成本并写入作者稿；以完整路线预算核查生命张力。保留个人命损与世界时间的区别，不为制造困难额外加入强制死亡。
- [x] 运行章节、内容和引擎测试。人工阅读三条谷地事实在幽冥、天界、终局的回应，确认不是替换称呼。提交。

## Task 6: 轮回、后世内容和旧人生交接

**Files:** 创建 `src/game/journey/migration.js`、`tests/journey-rebirth.test.js`、`tests/journey-migration.test.js`；更新 engine/content/validation/app 和作者稿。

**Interfaces:** 产出 `getLegacyBridgeChoices` 和 `migrateLegacyLife`。复用 `chooseJourney` 处理新规则的传承、再次入世与胜利后去向；不引入第二张开局表。

- [x] 写失败测试：默认摘要不丢完整历史；一项沿用加至多两项替换，或无候选直接新生；死亡本身没有奖励；新世从尚未完成的相关任务开始。
- [x] 写多章同世结算、重复完成同一任务、已死 NPC、灰谷灵种不复活、已经完成三类后世任务、已经取得三道证等测试；事实稳定且仍有合法去向。
- [x] 写旧人生迁移测试：未结算不能迁移；旧携带两项都能选择；原始收藏、道证、世界事实和生平保留；下一世的年龄推进与人物继任一致；转换失败不覆盖旧有效档。
- [x] 运行 `node --test tests/journey-rebirth.test.js tests/journey-migration.test.js` 确认失败。
- [x] 实现稳定任务完成记录和已完成任务的简短后果回声。移植三类后世任务的实际责任，完成后进入下段旅程，不重复刷取。
- [x] 实现十种旧传承的兼容映射，保留旧 ID、名字和来源：`plain-medicine`/`valley-seed`/`golden-furnace` → `herbalism`；`sword-echo`/`city-oath`/`iron-bone` → `shelter`；`tomb-lantern` → `soul-lamp`；`debt-released` → `bind-oath`；`sword-heart` → `discern`；`realm-memory` → `burn-life`。这是减法后的方法映射，同方法的历史传承仍分别保存，旧名字不能被当作额外叠加收益。
- [x] 为每项映射写一句来源合理的传承文本，并验证被毁灵种、已失盟友或既有魂债不被名字和效果偷偷改写。历史收藏可在适用剧情重新唤起；是否曾携带与是否已赢得分开记录。
- [x] 在旧结算中写明规则变化及备份入口。先保存可恢复的旧原始备份并验证转换，再保存新当前档；任一步失败仍能导出旧档并继续处理。恢复失败的非数据破坏情况不要求重开。
- [x] 运行新增测试及旧 `story-save`、`history`、`session` 测试，复核一个旧战斗→旧结算→新人生的真实接口流程。提交。

## Task 7: 完整性验证、平衡记录与发行准备

**Files:** 按发现的问题修改对应模块与测试；更新 `docs/PRODUCT_SPEC.md`、`docs/QA_REPORT.md`、`docs/PROGRESS.md`、`docs/DEPLOYMENT.md`、`package.json`。

**Interfaces:** 使用所有公开游戏、存档和构建接口。完整改版目标版本由实施者在发行时确定；不能提前把设计稿标记为已上线。

- [x] 执行有界遍历和代表性场景测试：覆盖内容定义的全部条件变体，检查每个可达非结算状态至少一个可执行后继、选项至多三项、无重复奖励、无未定义节点、无随机重抽。只为行为不变量新增断言，不把界面文案逐字快照当作玩法测试。
- [x] 运行 `npm run release`；所有测试、语法检查和离线构建须成功。记录真实测试文件/用例数量，不能把文件数称为用例数。
- [x] 做独立全改动审查，重点检查世界记录、旧档交接、剧情真假后果和实际终局可达性。修复发现的问题后只复验受影响行为与必需发行门禁。
- [ ] 在获准环境验收首局、一次冲突、一次死亡与新生、有效旧档、刷新恢复、导入导出、键盘焦点、手机宽度与深色。不能用源码检查冒充视觉或真人时长验收。
- [x] 更新产品文档中的旧规则，记录真实验证范围、剩余内容边界与未测事项。先保证全游戏闭环，不能以切片上线代表任务完成。
- [x] 发布时读取 GitHub 实际 main 与树；本地历史是快照重建，禁止直接 push 本地分支。通过 Git Data API 基于真实远端父提交重建变更，比较精确文件树，走独立 PR 和 CI。
- [x] 按本会话已有发布授权与当时有效权限推进；若有必须确认的门禁，在代码、测试、PR 和可审阅结果就绪后处理。Worker 必须以实际合并后的运行时代码 SHA 构建，沿用现有部署，不配置无关的自动发布或托管迁移。
- [x] 生产部署后核对 health、运行时代码 SHA、离线文件 hash 与实际版本；只有完成这些验证才能称已上线。部署失败保留已准备成果并明确报告状态。

上述发布项的完成证据为 PR #4、实际运行时 SHA／精确树、成功的三次 CI、最终 20/20 测试文件／48 个 JS 语法检查、真实 Cloudflare deployment／100% version 和生产 HTTP／游戏内实际下载。实际桌面首局／键盘、冲突救援、寿终／直接新生、有效旧档交接、刷新、真实导出／文件导入确认及焦点、帮助回流已完成观察；两个生产截图与精确路径见 QA。UI 复合验收项仍未勾选，因其还含未观察的手机宽度与深色；320px／主题仿真不可用，不能由桌面观察推断手机／深色／读屏通过。旧档新奖励分支、浏览器完整三界问鼎胜利与离线文件实际打开也未观察。

## 计划自查

规格中的交互、成长、随机和冲突由任务 1/3 承载；完整药谷与三界由任务 4/5 承载；轮回、同世多章和旧档由任务 2/6 承载；体验与发行边界由任务 7 承载。五类 Review Focus 均有归属任务，不再另开玩家管理流程。

执行推荐使用独立实现与审阅的分任务流程。内容编写可以在接口冻结后并行；同一引擎、存储或 app 文件由单一实施者集成，避免同时编辑。用户已要求全部按推荐，不再让用户选择工程执行方式。

本计划的源码实现、独立全分支复核、远端合并、2.0.0 生产发布与实际桌面路径验收已完成；真人节奏／寿元压力、320px／深色、真实手机和读屏仍未验收，其他未观察分支见 QA。原批准设计和任务划分保持不变，具体实际边界以顶部更新及 QA 为准；仅文档提交不改变实际部署运行时 SHA。
