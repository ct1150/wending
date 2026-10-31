# 问鼎制作人体验改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成顺畅选择、单存档、可感知成长、因果兑现与有意义轮回的连续体验。

**Architecture:** 沿用现有实时规则、流式接口与事务存档。先移除编辑要求造成的阻断，再用显式新人生标记加入可变成长与事件导演；历史规则保留可重放路径。前端通过服务能力启用新玩法。

**Tech Stack:** JavaScript ESM、Node >=22（仓库 Node 24）、node:test、Playwright、IndexedDB v3、Cloudflare Workers AI。

**Spec:** `docs/superpowers/specs/2026-10-31-producer-experience-design.md`

## Global Constraints

- Cloudflare Free、原 GLM 模型、原绑定/账本不变，无付费后备，无新增浏览器运行时依赖。
- 不设固定人生回合、章节、时长或应用调用次数上限；仅实际死亡后结算。
- V5/CV4、IndexedDB v3、rulesVersion=1、promptVersion=1 保持；旧状态与旧回合重放不得静默改变。
- 新状态使用出生 `experienceVersion:1` opt-in；缺少标记沿旧路径；前端等待 capabilities.experienceVersion=1 再创建。
- 保留完整历史、流式 DOM 连续性、幂等请求、跨标签 CAS 与真实成本校验。
- 文档中分开标记代码、验证、合入、静态发行、后端与真实体验状态。

## Review Focus

- 已保存 v7 待续行动或旧 JSONL：重放与随机数完全一致，恢复不新抽人物、不重复扣费。
- 模型正文短而正确、节拍标签不理想：仍能提交；错误人物/虚构资源不能放过。
- 多个旧档与新单存档界面：不切错人物、不丢历史、不通过旧入口额外创建可玩档。
- 前端先于后端更新：旧服务不接受新出生标记，客户端不得先落盘不兼容人生。
- 语料不可用、生成在途、存储失败：分别降级参考、查询原尝试、保留未提交状态。

---

### Task 1: 让短回应与参考资料降级保持可玩

**Files:** Modify `src/game/cultivation/live/story-director.js`, `src/worker/story-glm-wire.js`, `src/worker/story-provider-core.js`, `src/worker/story-provider.js`, `src/worker/story-production.js`; Test `tests/story-director.test.js`, `tests/story-director-wire.test.js`, `tests/story-knowledge-production.test.js`, `tests/story-retrieval-provider.test.js`.

**Interfaces:** 保持 `validateDirectorScene(scene,context,compiledChoices)` 和 provider 结果契约。语料读取失败不产生 retrieval receipt；仍只调用一次模型。无状态格式变化。

- [x] 写回归：短于200字的有效问答、超过编辑建议长度的合法场景、过期 progress/早期 climax 能提交；坏身份/锚点/不可执行动作仍失败。
- [x] 验证这些用例在旧实现失败，再取消纯编辑拒收；提示词改为先回答选中目的、按需要展开、节拍仅为建议。
- [x] 写回归：合法生产配置下缺失/超时/损坏 RAG 不阻断能力与生成，调用一次、不记录伪引用；无效配置/免费边界仍拒绝。
- [x] 实现语料降级并保留原请求/预算/缓存；旧非导演请求指纹保持。
- [x] 运行相关测试、语法检查，提交并独立审查。

### Task 2: 收敛在线单存档与旧数据恢复

**Upstream integration:** 开发期间主线 PR #26 / `e5f3cc2` 已实现大部分单存档与离线入口移除。先集成并复用其代码和验证，再完成下面仍有差异的继续优先、设置中主动重开与只读历史；不恢复多存档选择接口。

**Files:** Modify `src/app.js`, `src/ui/title-screen.js`, `src/ui/navigation.js`, `src/ui/live-session.js`, `src/game/live-archive.js`, `src/game/live-save-format.js`; Test `tests/title-screen.test.js`, `tests/title-navigation.test.js`, `tests/live-app.test.js`, `tests/live-journeys.test.js`; Create `tests/single-life.test.js`.

**Interfaces:** 当前活动档案仍由 Archive 的 `@active` 指针决定；新增单人生策略封装，不改变旧底层记录身份。只读历史/备份不使用 `selectJourney`。

- [x] 写浏览器回归：正常首页/设置没有切档、离线下载和离线模式；存活时开始入口继续当前人生，主动重开在设置中确认。
- [x] 写回归：重开不发轮回奖励，失败不替换当前档；导入保持事务验证，旧原文可备份，旧多档不会被批量删除。
- [x] 实现单存档入口与导航恢复；沿用5.4.0旧 `saves` 路由回首页的恢复策略，旧离线数据只读备份，不再以旧模式创建新人生。
- [x] 轮回后当前指针更新，前世可以只读；验证旧标签无法覆盖新人物。
- [x] 更新受需求变化影响的界面测试，保留底层旧档/导入/CAS 覆盖；提交并审查。

#### 上游接入：从规则源头生成可执行选择（I1）

开发期间，同仓库 PR #27 更新到已整合5.4.0与RAG的5.4.1候选（最初 `68611ec`，实际接入固定在 `babbae9`）。在新成长规则引入以前接入这批代码，保留其来源及回归；本分支的资料库降级和只读存档继续生效。

- [x] 区分已退役的字数/节拍/篇章错误码与当前会产生的错误码。保留旧请求缓存和记账兼容；针对GitHub首轮1190项中唯一失败的断言完成红→绿验证。
- [x] 将规则允许的行动、目标与代价组合传入原生成请求的 schema，减少模型输出不可执行选项的机会。新人物、旧实体别名和真实资源须按各自约束解码。
- [x] 结构要求三个选项，方向、差异及谨慎路径从生成源头引导；若完整回应仍有至少一个合法行动，不因自然称谓、可选人物特征或重复写法丢弃整轮。数值和死亡只由真实规则收据结算，任何叙述不能发放资源。
- [x] 合并阶段验证原126字场景、三个原选择、单次模型调用、真实规则预选、RAG成功和降级路径、旧回放及24KiB请求上限；独立审查。候选接入开发分支不代表其生产上线。

### Task 3: 为新成长和事件时钟建立兼容合同

**Files:** Modify `src/game/cultivation/live/cultivation-rules.js`, `src/game/cultivation/live/engine.js`, `src/game/cultivation/live/validation.js`, `src/game/cultivation/live/memory.js`, `src/game/cultivation/live/story-director.js`, `src/worker/story-api.js`, `src/ui/live-session.js`; Create `src/game/cultivation/live/experience.js`, `tests/experience-compatibility.test.js`.

**Interfaces:** `isExperienceLife(life)`、`createExperienceState(birth)`、`validateExperienceState(life)`；创建选项 `experienceVersion:1` 仅在服务宣告后传入。可变状态位于 `life.cultivationProfile.experience`，出生标记不可变。至少包含 `version:1`、`activeTechniqueId`、`repaired` 与有界成长事实；任务4补齐因果合同，任务5保存实体强度，不能一次初始化尚未使用的空泛状态。

- [ ] 固定旧 v7 出生、行动及导演摘要作为独立历史 fixture；先验证当前基线能回放。
- [ ] 写回归：显式新标记初始化新状态，缺少标记字节/摘要不变；未知版本、字段或标记不匹配被拒绝。
- [ ] 实现最小扩展：当前功法、成长进展、稳定对手资料与有限因果记录；所有字段参与收据和状态摘要，精确结构和容量由测试固定。
- [ ] 新导演事件钟只随有实际后果的行动或真实事项关闭推进；零日追问不推进事件数；存档 turnId/RNG 保持原协议。
- [ ] capabilities 与前端协商，旧服务不落盘新标记人生；冷启动/轮回/恢复/未来上下文编译遵循同一合同。
- [ ] 验证旧 JSONL、待续、长线边界和新状态往返；提交并审查。

### Task 4: 开局与可兑现的功法成长事件

**Files:** Create `src/game/cultivation/live/experience-story.js`, `tests/experience-story.test.js`; Modify `src/game/cultivation/live/story-director.js`, `src/game/cultivation/live/cultivation-rules.js`, `src/game/cultivation/live/custom-actions.js`, `src/worker/story-provider-core.js`, `src/worker/story-glm-wire.js`.

**Interfaces:** `buildOpeningBrief(context)` 从已保存种子/出身选择困境；`advanceExperienceStory(previous,receipt,scene)` 确定性推进玩家已参与的成长与承诺；提示上下文只读投影，不提前结算。

- [ ] 写回归：固定种子重试开局相同，多种种子覆盖至少四种困境；不强制当地人委托，不凭空给资源/自动移动。
- [ ] 加入围绕玩家目标的开局指令与出生优势/代价提示，保持普通动物不可交谈及玩家主动权。
- [ ] 写完整事件回归：识别残法问题后，自行研究或求助均可推进；真实成本不同；拒绝与暂缓不接受义务；达到条件才修补/改修当前功法。
- [ ] 记录承诺主体、接受行动、条件与回响；旧人物再遇到时提供具体未兑现事项，线索不自动标成已接任务。
- [ ] 写新旧人生与重试/序列化回归；提交并审查。

### Task 5: 让境界、对手与当前功法影响真实决策

**Files:** Modify `src/game/cultivation/live/experience.js`, `src/game/cultivation/live/cultivation-rules.js`, `src/game/cultivation/live/engine.js`, `src/game/cultivation/live/story-annotation.js`, `src/game/cultivation/live/schema.js`, `src/game/cultivation/live/memory.js`, `src/game/live-archive.js`, `src/worker/story-glm-wire.js`, `src/worker/story-provider-core.js`; Create `tests/experience-mechanics.test.js`.

**Interfaces:** 稳定对手资料按实体 ID 保存，使用有限元数据 `entity.experience:{version:1,realmId}`；新增资料只从已接受且有正文依据的场景建立，记忆记录、再遇见及备份均保留且不可改写；战斗使用绝对强度与玩家当前境界。`compileChoices` 新玩法附加 `outlook`，旧动作成本/输出不变。

- [ ] 写回归：同一对手、相同策略下境界提高改善胜算/伤势；强弱对手结果不同；缺少可靠情报显示未知，不按名字猜强度。
- [ ] 规则读取当前功法，修补后实际消除对应缺陷；不能因AI说已学成而赠送修为或跳境。
- [ ] 接通稳定强度/目的/条件的有限场景元数据，新增 schema 仅在新体验请求使用，旧请求结构指纹不变。
- [ ] 新选项输出可解释胜算档位、灵力成本及重大代价；仍按已保存 RNG 结算。
- [ ] 验证旧战斗逐项相同、新状态重放和预算；提交并审查。

### Task 6: 生平总结、轮回取舍与前世回响

**Files:** Modify `src/game/cultivation/live/reincarnation.js`, `src/game/cultivation/live/experience.js`, `src/game/cultivation/live/engine.js`, `src/game/live-archive.js`, `src/ui/journey.js`; Create `tests/experience-reincarnation.test.js`.

**Interfaces:** `getReincarnationSettlement` 新人生增加真实关键决定与遗留事项；`buildRebirthOptions` 为新人生生成有界前世回响，旧返回结构不变。现有领取记录继续防止重复消费。

- [ ] 写回归：新人生最多选择两项传承、真实扣点、余额保留；旧购买/导入回放不受新限制影响。
- [ ] 从已发生记录生成死因与关键选择摘要，不使用模型编造遗言；最多保留三条回响及来源身份。
- [ ] 将回响带入新出生与提示上下文，不自动兑现资源；刷新与备份保留。
- [ ] 验证重复领取、旧备份、同 runId 不同物理档案和跨标签事务；提交并审查。

### Task 7: 让玩家读得懂自己的处境

**Files:** Modify `src/ui/character.js`, `src/ui/journey.js`, `src/ui/game.css`, `src/app.js`; Test `tests/cultivation-v7-ui.test.js`, `tests/story-stream-presentation.test.js`; Create `tests/experience-ui.test.js`.

**Interfaces:** 使用前述 `outlook`、当前功法、生平摘要；渲染不改变状态。自定义建议只作为输入范例，玩家明确提交后才执行。

- [ ] 合并重复境界/寿元展示；保留顶部人物栏与抽屉；选择旁显示实际灵力/物资成本、胜算与重大风险。
- [ ] 开局显示人物优势、代价、目标；询问允许短段落且流式/最终使用同一DOM。
- [ ] 自定义输入给当前可用表达示例，错误原话保留且不结算；恢复提示清楚，不暴露内部协议术语。
- [ ] 验证320/390px、较大字号、焦点、流式按钮状态和只读历世；提交并审查。

### Task 8: 整体验证、文档回填与 GitHub 交付

**Files:** Modify `README.md`, `docs/ROADMAP.md`, `docs/PROGRESS.md`, `docs/PRODUCER_TODO.md`, `package.json`, `package-lock.json`; Create `docs/evidence/producer-experience-6.0.0.json` 与体验验收说明。

**Interfaces:** 候选6.0.0；证据含源码提交/树、实际命令与结果、环境限制、未执行项目，不包含会话凭据或小说原文。

- [ ] 跑一次完整测试、语法与前后端构建；仅为具体失败补充验证，记录原始失败，不把环境问题或fixture当真实模型成功。
- [ ] 完成短问答、两种成长路线、承诺兑现、战斗成长、死亡轮回、刷新和旧档导入的集成验收。
- [ ] 完成独立全分支审查，修复阻塞问题；版本与文档统一。
- [ ] 将逐步实现提交同步 GitHub 分支并创建/更新 PR，检查精确提交 CI；真实模型、生产后端和玩家复玩分别列待验证/已验证。
- [ ] 回填 TODO 的实现、验证、交付证据，保留长期玩家验收清单。
