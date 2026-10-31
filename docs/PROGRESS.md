# Implementation ledger

Plans: [first release](superpowers/plans/2026-10-24-first-release.md) · [1.1.0 narrative upgrade](superpowers/plans/2026-10-25-narrative-adventure.md)

## 6.0.0 候选：选择、成长与因果 — 2026-10-31

制作人评审已落实为新人生规则：四种开局、两种能完成的修法路径、绑定具体人物的承诺、依据真实实力的交锋、带来源的生平与轮回。首页优先继续当前人物；曾经的物理存档可只读与备份。已有无标记人生和冻结回合维持原有协议。

[体验验收方法与实际范围](PRODUCER_ACCEPTANCE_6.0.0.md) · [任务与修复轨迹](PRODUCER_TODO.md) · [开发 PR #28 / 当前 CI](https://github.com/ct1150/wending/pull/28)。本轮源码、静态发行、后端部署和真人体验分开记录；以下为此前版本的历史证据。

## 5.4.1 从源头生成可执行选项 — 2026-10-31

- 原生候选 #108 在 0% 流量下仍遇到一次已确认的结构拒绝；后续改为只生成真实未了事项的关闭引用、只采纳可证实的导演注释，并合并完全一样的重复按钮。正式发布读回见 [PR #27](https://github.com/ct1150/wending/pull/27)。

- 复现线上 126 字开局被人物全名与字数门槛拒绝，改为 v7 正常叙事直接提交；撤回未发布的自动纠正方案。
- 生成前由实际规则筛选动作、目标与风险组合，named 转换保留约束，短引用和共享 grammar 控制请求大小。
- 保留并发合入的 5.3 全本检索代码及 5.4 单存档在线体验，不恢复旧离线入口或存档选择，不改变知识库启用状态。
- 首个整合候选（原生复验前）合入 main `e5f3cc2` 后完整 `npm run release` **1,206/1,206 通过**（124,300.717771 ms），216 个 JS 语法检查通过，在线网页包为 **869,043 B**。近满续局含参考时完整输入为 24,337/24,576 B。见 [QA](QA_REPORT.md) 和[机器可读证据](evidence/story-choice-5.4.1/local-release.json)。
- 本地验证使用固定模型输出；原生 GLM/XGrammar、0% 候选实玩、生产切换和公开域名读回仍待验证。

## 5.3.0 全本知识检索 — 2026-10-31（代码候选完成，生产启用待授权）

- 在 main `4676d7f` 的界面、v7 规则与旧回放兼容基础上集成 2,454 篇章、7,936 证据窗口及 120 张精选卡；原文分片保持私有，公开索引与引用收据不含原文。
- 使用当前行动和目标检索，真实卡库约束优先于历史噪声；最多一张精选卡、两条证据进入原有一次 GLM 请求，总输入仍为 24 KiB。
- 修复近上限旧 JSONL 回放、挂起 marker、并发缓存记账和残留绑定绕过显式开关等已复现问题；失败重试与未提交预览不消耗引用历史。
- 最终完整 `npm run release` **1,207/1,207 通过**，217 个 JS 语法检查通过，离线 HTML 1,649,851 字节。独立最终审查无未解决问题；详见 [QA](QA_REPORT.md) 和 [固定验证证据](evidence/full-novel-rag-5.3.0.json)。
- 私有 KV 目的地授权被自动审批拦截；当前 4/248 分片、完成标记缺失。完成代码合入和生产包准备后，请求明确目的地授权；此处不将代码完成等同于生产 RAG 启用。

## 5.2.0 游戏内山海墨金界面 — 2026-10-31（上海，候选验收完成，发布待完成）

- 将首页的山水、深蓝墨色、暖白文字与金线延续到角色创建、实时及离线剧情、选项、自定义行动、设置、存档、人物与历史抽屉、结算和旧版存档界面。共用素材通过 CSS 变量内嵌一次，没有增加运行时依赖。
- 游戏场景位于 `#app` 之外，跨页面与流式重绘保持同一 root/canvas，返回首页时释放并清空；动态开关与首页共享偏好，保留系统减少动态效果、后台暂停和点击后才开启环境音的行为。
- 新用户默认使用「山海墨金」`cinematic` 主题；已有 `light`、`dark`、`system` 与较大字号偏好保留。正文、流式草稿与正式选项继续保持原有节点、排版和操作契约。
- 独立审查发现旧版结果标题会被固定顶部栏遮挡。320×844 浏览器回归先复现标题已获焦点但顶部为 20.796875px、低于顶部栏底部 66px；统一既有焦点目标的滚动留白后通过，覆盖焦点、实际位置与中心点无遮挡。
- 保留最新 main `dc1e937`（5.1.1）的引擎与兼容修复。最终 `npm run release` **1,143/1,143 通过，0 失败、取消、跳过或待办**，测试耗时 168,810.868082ms；204 个 JavaScript 文件语法检查通过，离线 HTML 为 **1,644,315 字节**。
- 新增 7 项浏览器回归在真实 Noto CJK 字体下通过，覆盖场景生命周期、动效偏好、320/390/1440px 可读性与溢出、主题兼容及旧版焦点。真实中文[桌面剧情](evidence/cinematic-game-5.2.0/story-desktop.jpg)、[移动剧情](evidence/cinematic-game-5.2.0/story-mobile.jpg)、[移动设置](evidence/cinematic-game-5.2.0/settings-mobile.jpg)与其余截图、早期测试采样误报和验证边界见 [QA](QA_REPORT.md)；[实施计划](superpowers/plans/2026-10-31-cinematic-game.md)已更新完成记录。
- 本轮前端候选验收不等于生产发布完成。PR、精确提交 CI、合并、部署及公开域名读回仍待完成；实际生产证据将在本轮发布 PR 中记录，不以候选截图或本地 fixture 代替。

## 5.1.1 行动契约与跨日验证 — 2026-10-31（上海）

- v7 黑市出售使用实际库存和规则选择的物品，避免被旧版普通交涉的销售禁令误拦；购买、普通交涉和不符合库存的承诺仍拒绝。
- 自定义输入在普通交涉后附加买卖要求时明确拒绝，不把“议价：出售法器”悄悄结算为另一种交涉。
- 生成指令明确需要写出对象全名的场景，消除与笼统“不重复姓名”的冲突，保留旧版请求结构。
- 原生操作员测试使用一致的受控时钟，避免证明生成与 Worker 请求恰好跨 UTC 日时误触过期门禁；生产证明与跨日检查保持严格。
- 实际 v7 流式开局已经返回 ready，235 字正文、三个可执行选项，本地存档往返及每个选项的后续上下文验证通过；具体版本和样本边界见 [QA_REPORT](QA_REPORT.md)。
- 合入并保留同期 main 的 5.1.0 动态首页、内嵌素材与动画降级行为，以 5.1.1 统一发布。

## 5.1.0 电影感武侠动态首页 — 2026-10-31（上海）

- 以原创云海、孤峰与剑客构图重做首页，加入书法题字、逆光、WebGL 云雾、金色微尘、飘叶、鼠标视差与用户主动开启的环境音；保留「踏入仙途 / 续写此生 / 游戏设置」及原有存档行为。
- 首页动画独立挂载与释放，后台暂停，支持减少动态效果和手动关闭；WebGL 不可用时退回 Canvas，图形能力均不可用时仍可操作静态菜单。没有增加运行时依赖。
- 集成同期 main 的完整 5.0.1 修仙引擎与兼容修复。完整 `npm run release` 通过 1102/1102 测试、202 个 JavaScript 语法检查，单文件 HTML 为 1,622,703 字节。首次长线测试超时及测试夹具调整见 [QA](QA_REPORT.md)。
- 独立代码审查无未解决问题；320/390/1280 像素布局及长姓名/摘要检查通过。候选[截图](evidence/cinematic-title-5.1.0-desktop.jpg)与[验证记录](evidence/cinematic-title-5.1.0.json)已保存；正式提交、CI 与生产身份以本轮发布 PR 和线上 `/healthz` 为准。

## 5.0.1 模型结构输出兼容修复 — 2026-10-31（上海）

- 5.0.0 实际开局出现 `paused / PROVIDER_FAILED`。同一上下文可通过本地完整流式链路，但新增 `story.anchors.uniqueItems` 被上游 SGLang 的纯 JSON Schema 校验器拒绝。
- 仅从 GLM 请求的结构定义中移除该不受支持的生成约束；服务端与客户端仍严格拒绝重复锚点，保留原始场景契约和全部数值规则。
- 真实云端后端版本不可见；本次本地复现证明结构兼容问题，实际上线结果另记于发布 PR，不把 fixture 通过当成模型调用成功。

## 5.0.0 凡人流修仙推演引擎 v7 — 2026-10-31（上海）

- 基于用户完整 v7 提示词实现新建实时人生：九境、灵根与体质、伴生遗物、真实材料与风险、四艺、黑市和界域跃迁。
- 年龄与寿元上限分别结算；普通时间不会折寿。新增导演保存有界近期因果、年度摘要、天道存档、主线／谜团和长篇节奏，不自动替玩家站队或突破。
- 三个流式生成选项加自定义行动，无法明确执行的输入不改写、不消耗回合。真实死亡后领取因果点并显式步入轮回，档案事务防止同一死亡重复领取。
- 新档显式启用 v7；旧实时与离线规则保持可重放。新版 JSONL 格式3保存导演、自定义待续输入和轮回领取记录，格式1/2继续读取。
- 当前验证、精确提交 CI 与部署身份见 [QA_REPORT](QA_REPORT.md)；未完成的环境验收不作为已通过证据。

## 4.5.0 连续剧情与选项流式展示 — 2026-10-31（上海）

- 本轮要求：统一生成中与生成完成后的阅读体验，去除无意义提示，选项承接当前剧情并由模型流式生成。设计与任务记录在 [方案](superpowers/specs/2026-10-31-consistent-story-stream-design.md) 和 [实施计划](superpowers/plans/2026-10-31-consistent-story-stream.md)。
- 新客户端协商结构化预览，增量传送正文类型、人物署名和选项文案；最终结果、V5/CV4 存档和 IndexedDB v3 不变。未完成的选项不带执行命令，保存前保持禁用。
- 同一阅读容器从流式到提交保持段落和选项节点，取消重复生成/未保存/空闲说明及零日成本噪音，保留真实成本风险与恢复操作。
- 选项文案的流式预览和最终解码共享组合函数；模型明确回应当前人物、线索或冲突，后端不再以通用观察/退出选择修补现代输出。
- 本轮不重启历史六场 AI 验收流程；`npm run release` 已通过 1025/1025 测试、182 个 JS 语法检查，离线构建 1,048,010 字节。独立审查无 Critical/Important/Minor 问题，另验证 964 个 JSON 前缀边界。详细[候选验证记录](evidence/continuous-stream-4.5.0.json)。正式发布身份和部署核对记录在本轮发布 PR，候选证据不单独代表已上线。

## 4.2.0 开始画面与独立旅程 — 2026-10-29（上海）

- 已确认并实现水墨首页三个入口「踏入仙途 / 续写此生 / 游戏设置」。首页只读取存档，不创建人物、掷骰或生成剧情；新玩家默认实时人生，继续入口恢复上次选择的旅程，旧离线人生继续遵循原规则。
- 活着的角色可另开独立旅程，原角色、历史和待续事务保留，可在「切换存档」中恢复；新开不伪造死亡结算或轮回奖励。剧情下方直接显示「历史对话 · 游戏设置 · 返回首页」，人物概况和详情仍在顶部。
- 阅读设置提供跟随系统／纸白／夜读与标准／较大字号。存档导入需要明确确认，原旅程或损坏原始字节先持久保留；切换旅程不隐式生成或重试。重新打开从首页开始，同标签刷新恢复页面、创建草稿或剧情，单文件离线游戏保留。
- 收尾完整 `npm run release`：859/859、0 失败/取消/跳过，162 个 JS 文件语法检查，1,025,064 字节离线 HTML。原 825 项结果保留为历史阶段证据，最终报告和原始日志见 [QA](QA_REPORT.md)。
- 独立审查的两项 Important 问题均以回归修复：旧页续接必须绑定显示的物理档案，损坏离线目录必须先可导出并持久备份再明确恢复。离线双标签 CI 时序问题也已复现并修复测试同步，覆盖防护未削弱。
- [桌面](evidence/title-screen-4.2.0/desktop.png)、[移动](evidence/title-screen-4.2.0/mobile.png)、[移动暗色](evidence/title-screen-4.2.0/mobile-dark.png)与[暗色设置](evidence/title-screen-4.2.0/settings-dark.png)为本地视觉证据。精确提交 CI、PR 合并、静态频道与生产现场记录集中维护于 [4.2.0 发布 PR #15](https://github.com/ct1150/wending/pull/15)。
- 本次范围不改变模型、后端、协议、套餐、额度或计费。设计见[已确认方案](superpowers/specs/2026-10-29-title-screen-design.md)，当前证据及限制见[验收记录](QA_REPORT.md)。

下列各节保留对应日期、版本和发布观察；其中的“当前”仅指该历史检查点。

Historical documentation checkpoint: 2026-10-27 (Shanghai). The new [roadmap](ROADMAP.md) plans choice-driven, real-time Workers AI stories until actual character death. 4.0.0 remains the delivered runtime; historical publication claims below remain tied to their original versions.

## 实时剧情新规划 — 2026-10-27（北京时间）

- 已将用户方向写入 [设计](superpowers/specs/2026-10-27-realtime-workers-ai-design.md) 与 [实施计划](superpowers/plans/2026-10-27-realtime-workers-ai.md)：取消20—30分钟目标，不设预写终章，登仙/问鼎继续，实际死亡才结算。
- 已按依赖排序8项待办：免费接入核验、人生规则、动态协议/记忆、API/预算、长档案、实时界面、长线验收、部署交付。全部实现项仍未完成。
- 只读核查当前Worker无AI绑定，目录能查到Qwen候选模型；尚未验证套餐、剩余额度、真实推理与零付费条件。没有实际调用Workers AI或修改账号/生产配置。
- 当前设计采用规则事实收据、可恢复回合事务、服务端共享预算、IndexedDB分页档案。免费门禁不成立或额度耗尽时暂停，不静默付费、回退固定主线或终结人物。
- 本次变更限于规划文档与只读证据。下列4.0交付和本地模型创作记录不作为实时生成模式的完成证据。

## 4.0.0 roadmap execution — 2026-10-27

- Initial roadmap/design/plan synced as `cb2f391593d013a5e81b5260c8b1ea4ae8ebe84e`; frozen CV3 interface and evidence checkpoint synced as `e9b1b6d06483f6e24a7c4337a8e06b943a9c1459`, tree `4cf45a9777b92f8341a8e89d377a98a8b0c4025a`, matching local reviewed docs tree.
- New CV3 engine/UI isolated from exact preserved CV1/CV2 implementations. Four origins, dual talents, twelve-point attributes and single-talent lock/reroll persist. First-ever creation cannot invent previous world achievements or legacy.
- Final content has114 playable choice scenes plus ending; all115 nodes are reachable. Final tests cover36 standard origin/path/expedition combinations,6 alternative routes,8 talents,actual gates/materials,death,victory and earned rebirth. Specific pairs and personal rivals replace generic numeric variations.
- Optional local authoring tool implemented; root independent review reproduced/fixed Ollama length termination and corrupted UTF-8 candidate gaps. 18/18 targeted tests pass including actual localhost HTTP. Real llama.cpp/Qwen3-0.6B output was generated, reviewed and accepted as atmosphere only.
- Stable release gateway/publisher/workflow independently reviewed; BOM identity and unbounded cache findings fixed with regressions, 10/10 pass. Real main publication succeeded. A Workers-only redirect:error incompatibility was reproduced, fixed by manual/no-follow in PR #13, independently reviewed and verified in the actual Worker. Final targeted release checks11/11; final main checks361/361.
- Real Chromium birth controls passed1280/390/320px, persisted through refresh and keyboard start, no page errors/overflow. Full actual UI run completed68 choices and earned immortal victory/all3 proofs; real export/import and earned rebirth pass. Independent offline file smoke passes withzero external requests. Final npm run release:360/360,89 JS syntax checks,852849-byte HTML. Independent source review: no open material blockers. PR #12/#13 merged; CI/main publish succeeded. Production repeated the68-choice victory/import/export/rebirth flow and preserves actual old CV2 save bytes. Gateway automatically fetched4.0 while embedding3.1, then the fallback was upgraded to4.0. See DEPLOYMENT and QA for exact sources, hashes, deployments and human/device limits.


## 3.1.0 immersive reading and dice creation — 2026-10-26

- Four requested changes implemented: natural choices with known risk, sticky compact character bar and details drawer, Chinese dialogue punctuation, persistent name/dice creation, and full history in a separate drawer.
- CV2 creation/reroll/start and rebirth are revision-guarded. CV1/v1/v2/v3 lives continue their original random progression. Attribute/talent effects preserve authored costs and death rules.
- Scoped engine review, UI/controller review and whole-branch final review approved. Raw-control, first-life false-history and phase-bypass findings were reproduced and fixed. No parked code findings.
- Final local release passed 26 test files, 59 syntax checks and the 667310-byte offline build. New test files contain 33 behavior cases. Actual PR and main CI succeeded; deployment job skipped as before.
- [PR #9](https://github.com/ct1150/wending/pull/9) merged true source `ffe37add4d9194566f327667f0a1a9d7b3ee7394` / tree `486a966b6206aa59eb21806e816814a1d1e18a66`, identical to reviewed local `349dd4417e9ec334e2f63ebc1a492e6b2ccf33f9`. No synthetic local history was pushed.
- Existing ordinary Worker API deployment `b441125c-2294-4ad0-a1c1-47d914b537d3` routes 100% to version `3e52706f-cb79-47b7-9d22-e3adcb5563a8` at UTC `2026-10-26T01:32:24.75492Z`. Actual health and game download match the source and HTML hash.
- Actual browser verified unchanged CV1 export, custom name 林照, explicit reroll, refresh, Enter, starter medicine/stones, full history/current separation, both drawers, Escape focus return, internal scrolling and sticky header during page scrolling. A real file chooser restored the unstarted dice profile; starting again did not duplicate supplies or reroll. Details, four screenshots and remaining device limits are recorded in [QA](QA_REPORT.md).
- These documentation and screenshot updates do not replace the deployed runtime SHA. Local file navigation was unavailable; actual downloaded file bytes were verified. Narrow viewport/physical phone/native IME/screen-reader evidence is not claimed.

## 3.0.0 human cultivation chapter — 2026-10-25

- Real remote base: `4119a9a5780b5d5478f320b69d44670428cab1cb`; all 79 source blobs verified before editing. Local git history is a synthetic review snapshot and must never be pushed directly.
- Scope: a complete repeatable mortal → qi → foundation → ending → rebirth chapter, with meaningful preparation, explicit risk and elapsed time. The higher-realm remake remains future work.
- Fresh games use v4 cultivation. Existing v1/v2/v3 saves retain their own engines and explicit restart offers the new chapter. No automatic cross-story rewriting.
- Implementation separates authored content, engine/time model, strict save validation and minimal narrative UI. All 53 scenes are complete; three expeditions, two foundation methods, meaningful failure and new-life progression use the actual public state machine.
- Final local `npm run release` passed 23 test files, 55 JavaScript syntax checks and the 634374-byte offline build at UTC 15:26:23.116. Focused v4 run passed 50 behavioral cases. Independent review traversed 240 complete lives / 5606 choices / all 53 scenes and separately checked two-life irreversible ruins plus third-life startup. Explicit red→green regressions cover the discovered dead end, deadline feedback, heavy injury and zero-time healing; details and limits are in QA.
- Initial [PR #6](https://github.com/ct1150/wending/pull/6) merged to actual runtime [`526928723f06a00d1f9f6d3be1b80b5987ee26b0`](https://github.com/ct1150/wending/commit/526928723f06a00d1f9f6d3be1b80b5987ee26b0). Release tree `6fc2840dbe6c1d74f10b8c4a94f6d8909c7fde2d` exactly matches the reviewed local `5c81a67` tree. [Main CI 40209419960](https://github.com/ct1150/wending/actions/runs/40209419960) and [validate 121217269362](https://github.com/ct1150/wending/actions/runs/40209419960/job/121217269362) succeeded; automatic deploy was skipped. Synthetic local history was not directly pushed.
- First-release exact-source packaging metadata UTC `2026-10-25T15:58:16.810Z`: HTML 634374 bytes, SHA-256 `7955ae64b7e531cbe682bb9ef25e207f2fad1444d7db286a5f9aff08361e0e80`; Worker 643086 bytes, SHA-256 `3d1e8b318f38e756b15f9c5fa4b2f2c0a6f804bb8981970dc71bb5dc47af8b90`. The HTML remains identical to the reviewed local artifact; the Worker identifies the actual merged runtime SHA.
- The first release updated existing ordinary Worker `baishi-wending` through the API with HTTP 200 at UTC `2026-10-25T15:59:10.732421Z`. Actual deployment `494ff07b-2d8f-41b7-bdec-324496ce7f51` routes 100% to version `358e494c-3bb6-4ab8-8020-50d8805bb84b`. No automatic publishing or hosting migration occurred.
- Actual production browser `/healthz` verified the first runtime SHA and exact HTML hash. After reload, the existing v3 generation-two life remained playable. Explicit confirmed restart opened the fresh v4 chapter; keyboard Return successfully selected rope preparation. Real UI exported 9657 bytes of v4 JSON (`qi-awakening`, revision 9, world.day 361488, fate valley/caravan/scarcity), then restored age 20 / year 1004 / “会一点法术以后” through a real file chooser after four more years, with a visible success notice. The actual game download was 634374 bytes with the first-release HTML hash.
- Actual caravan progression reached foundation at age 36 / year 1020 with 143 years 176 days remaining. Returning home and opening a clinic led to age 179 with a final year, then a lifespan ending at age 180 / year 1164. Choosing earned herbalism advanced the world 16 years into generation 2 / year 1180, age 16 / mortal / 56 years remaining. The new opening was a pharmacy apprenticeship; the old charity clinic persisted while nobody recognized the new body. These observed milestones are recorded in [QA](QA_REPORT.md#生产-ui-验收).
- Observed desktop viewport 1363×936, document clientWidth=scrollWidth=1348, no horizontal overflow at that width; three opening targets were approximately 570×89.28 CSS px. Inspected [opening](evidence/cultivation-3.0.0-opening.jpg), [foundation](evidence/cultivation-3.0.0-foundation.jpg) and [rebirth](evidence/cultivation-3.0.0-rebirth.jpg) screenshots are 1348×926 JPEGs, respectively 65649 / 75375 / 62928 bytes; exact hashes are in QA.
- Live review found four minor prose assumptions about ropes, an uninjured player's medic visit, a caravan opportunity after a year and sword-specific foundation imagery. Four text-only corrections passed scoped review without changes to IDs, conditions, costs, effects or save structure. A fresh `npm run release` again passed 23/23 test files and 55 syntax checks, producing 634455 bytes; [PR #7](https://github.com/ct1150/wending/pull/7) [CI 40210184893](https://github.com/ct1150/wending/actions/runs/40210184893) succeeded.
- PR #7 merged final runtime [`568d53915cde8b25fd742403d3f8d8075dcdc7a8`](https://github.com/ct1150/wending/commit/568d53915cde8b25fd742403d3f8d8075dcdc7a8), tree `f1ab4b30084b50f74437dff18961ab347e290ccf`, exactly matching reviewed local `acb4356`. [Main CI 40210351905](https://github.com/ct1150/wending/actions/runs/40210351905) and [validate 121220054228](https://github.com/ct1150/wending/actions/runs/40210351905/job/121220054228) succeeded; [deploy 121220131018](https://github.com/ct1150/wending/actions/runs/40210351905/job/121220131018) was skipped.
- Final exact-source build UTC `2026-10-25T16:07:13.386Z`: HTML 634455 bytes, SHA-256 `045b0248657daee13f73a9d6014809c2daf1e0674d3c5292d84bb9e4c2b4e49f`; Worker 643167 bytes, SHA-256 `ae781bf7329dca05aba9de54b4212d859dfd56da17299f47ecb5a75229e65b90`. Existing Worker API update returned HTTP 200, deployment `0a6db68e-e98c-4e78-8ea3-610fd029df42`, version `9e56498f-e322-4e84-b844-433a169ecaa2` at 100%, deployed UTC `2026-10-25T16:10:48.567616Z`.
- Final production browser health matched the new source and HTML hash. The actual game download was 634455 bytes, byte-for-byte equal to the local final HTML and containing all four wording corrections. Reload preserved the existing second life at age 16 / mortal / year 1180, with herbalism and the old charity clinic. All 183 inspected warn/error entries belonged to chrome-extension URLs; none in the observed set came from the game origin, without a claim of complete pageerror capture.
- Physical phones, actual 320px/dark appearance, screen readers and human 20–30 minute pacing remain unverified for 3.0.0. This publication update edits documentation only; later documentation HEAD does not replace current deployed source `568d53915cde8b25fd742403d3f8d8075dcdc7a8` or its health metadata. The initial full browser route and screenshots retain their original source attribution.

## Historical production: Dialogue 2.0.0 publication — 2026-10-25 (Shanghai)

- Final independent review blockers were corrected: unknown legacy valley finale provenance, a shared 1,000,000-character save boundary with atomic action/rebirth rejection and derived UTF-8 file guard, plus preconfirmation rejection of noncanonical near-limit v3 imports. Scoped re-review is clear. Valid complete history is preserved; full capacity may block further history growth rather than truncate it.
- Controller's final fresh `npm run release` passed 20/20 test files and 48 JavaScript syntax checks; offline HTML is 477041 bytes, SHA-256 `4d02474e6b6313e845ba995794f0c6e9d2fcce090450393125d6ca101ed7fcd0`, metadata UTC `2026-10-25T12:21:24.209Z` / Shanghai20:21:24.209. File count is not behavioral-case count.
- [PR #4](https://github.com/ct1150/wending/pull/4) merged to actual runtime [`4dadfd046f1e1413e721a5679745272ef22e07fb`](https://github.com/ct1150/wending/commit/4dadfd046f1e1413e721a5679745272ef22e07fb); tree `6ea0663ce356f677e79615cfdf0aad3ca7ffb2f5` exactly matches reviewed local `bbd6731a5497276c625cb96dba3e9cdfb659cbc5`. [PR CI](https://github.com/ct1150/wending/actions/runs/40193041383), [branch CI](https://github.com/ct1150/wending/actions/runs/40193032923) and [main CI](https://github.com/ct1150/wending/actions/runs/40193106687) all succeeded; local synthetic history was not pushed.
- Actual-source Worker is 484481 bytes, SHA-256 `1e9a469fe86d05e8400afc77df29a4f1419503e857db48848c6b07d9b8283716`. Existing ordinary Worker API deployment `c1d4015f-7731-4c80-b55c-bcee0676787a` routes 100% to version `fd9de880-644b-445a-b9b1-7760730a2111`, created Shanghai20:27:38.506985 / UTC `2026-10-25T12:27:38.506985Z`. No automatic publishing or hosting migration occurred.
- Production HTTP at Shanghai20:28:53.265970 returned200 for health, root and offline download endpoint. Health is ok with the actual runtime SHA and exact HTML hash; both HTML responses are477041 bytes and match that hash/version2.0.0.
- Actual production UI resumed the real v2 save, spent2 medicine on “分出两份药”, and explicitly retired to 未竟/宗门收谷. “只携记忆” opened v3 generation2/year1019“两把钥匙” with3 contextual choices and no setup; this save had no new reward, so the reward branch was not exercised. Explicit confirmed restart then showed native generation1/year1000“谷口的雨” with exactly2 choices. Real [opening screenshot](evidence/dialogue-2.0.0-live.jpg) is included.
- Native desktop observations completed Shanghai22:06:37 / UTC `2026-10-25T14:06:37Z`: keyboard Enter and immediate transcript response; medicine to 温渡; shelter learned with one elapsed year; refresh and More→help→continue preserve year1001/scene/3choices. Real UI exported3976-byte v3/dialogue JSON; after advancing, a real file chooser imported it, confirmation showed云归/gen1/age17, then restored the earlier scene with success status and focus `journey-current-title`.
- Actual original-ledger + complete-channel-map investigation consumed the displayed year and closed the third route; public confrontation and learned shelter saved a family. Clinic cost one year and handoff earned the human seal. Explicit keep-watch consumed141 remaining years, age19→160/world1003→1144; one earned shelter inheritance led directly to generation2/year1160 after16 years, “规矩之外的五十七人” with3choices and retained clinic world. Full first-life choices/inheritance are readable in 生平; collapsing does not advance time. Real [second-life screenshot](evidence/dialogue-2.0.0-rebirth.jpg) is included; both1363×936 images were visually inspected, exact bytes/hashes in QA.
- Read-only desktop DOM: clientWidth=scrollWidth=1348, height936; three choice targets570×89.28125 CSS px, no horizontal overflow at that observed viewport. All224 examined warn/error entries belonged to chrome-extension metadata across old/current logs; no site-attributed entry observed, without an absolute clean-console claim.
- Final real More→存档与设置→下载游戏 produced477041 bytes with SHA-256 `4d02474e6b6313e845ba995794f0c6e9d2fcce090450393125d6ca101ed7fcd0`, byte-identical to release. Returned to the same second-life scene as the deliverable. Downloaded local file was not opened. Remaining limits:320px/dark/physical mobile/screen reader/human pacing and lifespan pressure; actual legacy new-reward branch and browser full three-realm victory. Public API tests cover particular full victory routes.
- This audit edits documentation only; later documentation HEAD does not replace the actual deployed runtime SHA. Historical 1.2.0 and earlier records below remain dated/versioned history.

## 2.0.0 implementation and local release preparation — 2026-10-25 (Shanghai)

| Task | Local implementation / review checkpoint |
| --- | --- |
| 1 | `343ca57`: pure v3 engine, deterministic opening, author/content validation; scoped review complete |
| 2 | `f373fb1`: strict unified saves and non-overwriting recovery; scoped review complete |
| 3 | `81afa6a`: actual default single reading flow, latest response/history/costs and module packaging; scoped review complete; visual acceptance deferred |
| 4 | `a239331`: three real valley outcomes and living departure; two-investigation window replaces old eight-year deadline; scoped review complete |
| 5 | `aec774f`: actual Nether/Celestial/finale, six opportunities, three combinations and two first-life zero-ability victories; scoped review complete with carried corrections |
| 6 | `0e28d12` → `0a44fe1`: lifecycle, all11 sequel outcomes, ten old mappings and recoverable handoff; three Important provenance/recovery findings and adjacent transient-retry Minor addressed, scoped review clean |
| 7 | Packaging/docs, herbalism1/2-year correction, bounded validation, final review/fixes, actual publication and observed desktop acceptance complete; unsupported/unobserved matrix remains explicit above/QA |

- Herbalism lesson takes one elapsed year; lesson plus one service year takes two and pays one actual medicine pack. Refusal free; no fictional soul-inquiry-window cost. Focused campaign16 cases pass, including actual public herbalism+burn combination and insufficient-life fallback.
- Bounded release checks:50 scenes/190 authored variants through2892 resolver fixtures;168 actual public prefixes/374 one-step actions on two complete zero-ability victory methods across seeds0/1/7. Resolver facts are not asserted legal reachable saves, and one-step branches are not a whole-history DFS.
- One accidentally tracked ignored orchestration report was removed from the index while preserving its working evidence. Internal reports/private saves are not publication content.
- Historical local preparation used no new browser or remote mutation. Its1.2.0 pre-deploy backup/export protected old progress only; subsequent actual2.0.0 desktop observations are above. 320px/dark, physical devices, screen reader, human20–30-minute pacing and life-pressure remain unobserved.
- Historical Task7 `env -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY npm run release` exited0:20/20 test files (not cases),46 JS syntax checks,offline473871 bytes, SHA-256 `5b49bde3dc1841aed0bc065505cc273109053ca49514f1d86dd093e7cd09e7fd`, built Shanghai2026-10-25 19:47:46.304 (metadata UTC11:47:46.304Z). No npm proxy warning. This predates final review fixes; final current values are above. The first fix build at20:11 was476983 bytes/hash6f1ca22d..., also superseded; details remain in QA.

## Historical first-release implementation — 2026-10-24


- 2026-10-24: Approved conversation design captured in PRODUCT_SPEC; no additional design approval required because user explicitly requested implementation and deployment.
- Ruling: use native JS and static hosting — offline single-player requirements need no server or runtime dependency.
- Ruling: use new isolated project folder and feature branch — workspace has no existing code or repository.
- Ruling: engine and content may be implemented concurrently against a frozen contract in disjoint files — avoids shared mutation while saving time.
- Historical checkpoint (superseded): GitHub account ct1150 was verified, but the connector then exposed only weather-v2 and browser creation required sign-in. GitHub publication authentication was pending at that stage; later completion is recorded below.

- User steering: GitHub source -> Cloudflare hosting. Chosen Workers Static Assets; native Cloudflare GitHub integration is the recommended production path, with GitHub Actions retained for validation and optional deployment. GitHub Pages-specific deployment superseded.
- Parallel ownership: game_engine=engine/persistence/tests; game_content=content/tests; build_deploy=scripts/workflows/deploy docs; root=UI/integration/review/publication.

- Implementation delivered: 52 original events, 110 choices, 30 equipment items, 9 legacies, 6 realms, 3 paths, 3 proof challenges and a playable finale.
- Independent standards/spec reviews completed. Fixed mobile cultivation visibility, preview offline-download routing, legacy-condition copy, implausible generation counts, and missing past-life key logs.
- Balance review: tightened high-realm time budgets and final boss; legal prepared first-life victories exist for all three paths; starter-equipment burn-only rush fails for all three paths across three fixed seeds.
- Final local release verification: 5 test files pass (46 registered behavioral cases), 13 JavaScript files pass syntax check; self-contained offline HTML built at 185751 bytes.
- Browser verification: creation, event costs/rewards, equipment, reload, breakthrough success/failure, combat intent, proof reward, settlement, chosen legacy, reincarnation, historical details, JSON export/import and single-file execution passed. Mobile iframe has no horizontal overflow at 375 CSS px usable width. Browser-extension console errors were excluded; no game-source error was observed in the offline smoke test.
- Historical publication checkpoint (superseded for GitHub): both dashboards initially required sign-in. At that time no remote repository, workflow run or production URL existed.

## Historical GitHub upload checkpoint — 2026-10-24

- GitHub authorization completed and game source uploaded to [ct1150/wending](https://github.com/ct1150/wending), public repository, `main`.
- First game source commit: [`6698dbbca4b452466ad461070250c6ea7deeb87c`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c); tree `ea6040b9d180197af1b7503efc837a8d3be6070d` exactly matches the local source tree at upload, with all 30 remote blob SHAs compared individually.
- [GitHub Actions run 40050257913](https://github.com/ct1150/wending/actions/runs/40050257913) completed with `success`. [Validate job 120741133981](https://github.com/ct1150/wending/actions/runs/40050257913/job/120741133981) passed every step and generated [artifact 12541989829](https://github.com/ct1150/wending/actions/runs/40050257913/artifacts/12541989829).
- Remote CI logs confirm 46 tests / 46 passed / 0 failed, syntax checks for 13 JavaScript files, and a 185751-byte offline HTML. The uploaded compressed artifact is 184805 bytes.
- Deploy job was `skipped` because `ENABLE_CF_DEPLOY` is not enabled; this successful CI run did not publish a Cloudflare site.
- Historical state at the first GitHub upload: Cloudflare was unconnected and undeployed. Superseded by the MCP publication below.
- Original next step at that checkpoint: connect `ct1150/wending` / `main` in the intended Cloudflare account. Worker `baishi-wending`, repository root left blank, build `npm run release`, deploy `npx wrangler deploy`, Node 24 read automatically from `.node-version`. Keep the GitHub deployment switch disabled when using this native integration. See [deployment instructions](DEPLOYMENT.md).


## Historical first publication checkpoint — 2026-10-24

- Cloudflare API MCP authenticated successfully. Native Git setup could not proceed: repository connection returned `404 / 8000008 Git account disconnected`, and no build tokens existed. That failure records the state observed during first publication, not proof that the GitHub App is still uninstalled. Current absence of Worker Builds configuration is recorded below.
- To deliver a working first release, the verified offline HTML was embedded in an ordinary Worker response. This mode counts toward Workers request allowances. The original Static Assets `wrangler.jsonc` is retained for future migration.
- Added `scripts/build-worker.js`, two Worker behavior tests and `build:worker`. CI runs it after the regular build with `SOURCE_COMMIT=github.sha`, preserving `release/worker.mjs` in its artifact. Source commit [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9); [CI 40053805256](https://github.com/ct1150/wending/actions/runs/40053805256) succeeded with 48 tests and 15 JavaScript syntax checks.
- Actual MCP deployment succeeded: Worker `baishi-wending`, tag `d4ceaa79ca7d4ca48954b1117458297f`, deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3`, 100% version `f9dd9fc8-df55-437e-8123-bbca3e119a59`, created `2026-10-24T02:21:43Z` (Shanghai 10:21:43). `workers.dev` enabled; previews disabled.
- Production URL: [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/). HTML SHA-256: `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`; expected health source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9`.
- Actual production browser verification passed: new character 云归 age 16; training reached age 19 / cultivation 13 / remaining life 81 / spirit 29; exploration showed 渡口最后一船 at age 21, and 帮他装船 produced age 22 / remaining life 78 / spirit 41. Reload restored state and logs.
- This executor's direct HTTP verification was network-limited, then returned a 403 non-game body via the approved network path; healthz was not JSON. Retrying stopped. This is a verification-path limitation, not evidence that the whole site is down; the production browser loaded and played successfully.
- Production browser healthz returned status ok, source commit `355f7956a4c31d9e3a19f1f567c4b1146942a5e9` and the expected HTML hash. The actual in-game download was 185751 bytes with matching SHA-256 `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63`. A 390px iframe loaded the real production URL at 375 CSS px usable width: html/body scrollWidth and clientWidth were all 375, with top cultivation progress and all five bottom navigation items visible.
- Public HEAD/404/405 have no independent live-response evidence; local Worker handler tests passed 2/2. Production GET, healthz, download and mobile checks have actual browser evidence.
- Final CI logs confirm 48 tests / 48 passed / 0 failed, 15 JavaScript syntax checks and a 189712-byte Worker. Artifact [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440) is 247611 bytes.


## Read-only publication reconciliation — 2026-10-24

- Observed GitHub main was `e719b569deeb5010d4977c799b434b60d640223a`, with [CI40054261258](https://github.com/ct1150/wending/actions/runs/40054261258) validate success and deploy skipped. This main commit did not replace the old production source `355f7956a4c31d9e3a19f1f567c4b1146942a5e9`.
- Worker API listed deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3` and version `f9dd9fc8-df55-437e-8123-bbca3e119a59`. Earlier docs mislabeled the version as a deployment; corrected here and in QA/DEPLOYMENT.
- Native Builds returned404/code12040 with no configuration, triggers or build history. No connection-mutating request was repeated; current GitHub App installation status cannot be inferred from the old8000008 failure.
- The accepted current release path remains GitHub review/CI → exact-source offline/Worker build → API update to the existing ordinary Worker. Static Assets and native automatic Builds are future migration work.

## Historical narrative adventure 1.1.0 implementation and local validation — 2026-10-25 (Shanghai)

- Approved direction: a continuous authored main story with finite random branches, meaningful choices and playable next-life consequences in one continuing world. Twenty-to-thirty minutes remains a design target without human timing evidence.
- Preserved approved pre-upgrade research in `docs/research/2026-10-24-wending-reference-research.md` and original authored story in `docs/story/valley-fire.md`. Provenance wrappers distinguish dated research/design costs from current implementation. The implementation plan now uses a portable source link.
- Task1 added separate native story data/runtime, strict v2 migration under the original storage key, three outcomes with distinct five-scene sequels, shared time/cost/death transactions, finite side opportunities and once-only settlement. Fix-round review added replayed side continuations, facts derived from retained trace/preceding snapshots, and successor wording at actual chronology. Engine fix re-review approved.
- Task2 added narrative-first desktop/mobile UI, persistent results/records, visible costs, interruption return paths, truthful old-life guidance and sequel-aware life recap. Real browser desktop/390px common-clinic → sequel, refresh/import/export, resource-gate, event/combat-flee and old-save paths passed. Initial UI review passed with observations for whole-branch review; the details/focus and mobile cultivation findings are now addressed in the final fix wave below.
- Task3 base `286314cfb1b29ebb8bd37f3945cabfdaa96cbd04`; only package/docs/source-artifact files changed, version1.1.0. Fresh individual test run80/80; required `npm run release` passed8/8 test files,20JS syntax checks,309314-byte offline build. npm unknown-http-proxy config warning is environmental.
- Final-candidate local offline SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`; 312059 bytes; release metadata version1.1.0. Real Chrome156 opened the rebuilt final file itself at390px, started a new game, chose enter_ask intoYG02 and refreshed with identical save/result; zero external runtime requests, failed requests or page/console errors. Full local evidence and limits are in QA_REPORT.
- Final whole-branch fix wave from `d1c19000225d88613d1add05744f6d54eae5485d`: corrected fatal deadline/settlement ordering without relaxing failed-trace validation; two accepted-save boundary regressions observed RED then GREEN. Restored ordinary/combat focus and supporting disclosure continuity, current/required mobile cultivation, neutral zero-relationship records and stable old-fire wording. New bounded browser checks passed36 transition/focus/visibility assertions plus strict-v1 restored keyboard actions; no errors/overflow. Final individual suite82/82, required release8/8 files,20JS checks and rebuilt offline smoke all passed. Evidence uses final-* filenames; npm environment warning remains unchanged.
- All five final findings passed the scoped fix re-review before publication. Actual GitHub and production completion is recorded below, separately from these local checks.

## Historical narrative adventure 1.1.0 publication and live acceptance — 2026-10-25

- [PR #1](https://github.com/ct1150/wending/pull/1) merged at `2026-10-25T01:10:05Z`. Actual release source is [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353); tree `42831e16b6832eb3207916a1b2668beec49d5375` matches reviewed local `d7e7b05fa70d830686b14bbcd4789f0adadea514`.
- main [CI 40149561196](https://github.com/ct1150/wending/actions/runs/40149561196) completed with success; validate success, deploy skipped. Automatic GitHub→Cloudflare publishing remains disabled; the following deployment used the existing Worker API path.
- Rebuilt Worker with the actual release SHA at `2026-10-25T01:10:11.898096+00:00`: offline HTML 312059 bytes/SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`, Worker 317795 bytes. API deployment `a79b0351-d05d-4ca4-875b-bd8a5048f91f`, version `ca6bdda3-9739-4a09-a4a9-0f0f39085c45` at 100%, created `2026-10-25T01:10:47.185111Z`.
- Actual production health returned status ok, source `4d3834be1bcd2ffd636c7fe32bde5c111195f353` and the exact HTML hash. Real UI opened “灰里还有人”, chose “先问封谷令为何下来” and reached “不肯烧掉的药簿”; refresh preserved the full main content and settings/back worked. Actual game download 312059 bytes and hash exactly match the tested artifact.
- Live viewport 1363×936, pageWidth 1348, no horizontal overflow; application errors 0. Browser extension emitted 21 metadata messages, recorded separately from game errors. Production smoke covers this opening only; full desktop/mobile clinic-sequel playthrough remains local evidence. No human pacing, physical-device or screen-reader measurement.
- This publication audit changes documentation only. Production source remains `4d3834be1bcd2ffd636c7fe32bde5c111195f353` and must differ from the later documentation-only commit; health metadata must continue naming the source actually built/uploaded. First-release history and future Static Assets/automatic-publishing instructions remain preserved.


## Historical Paper interface 1.2.0 candidate and local packaging — 2026-10-25

- Approved spec: [Paper interface](superpowers/specs/2026-10-25-paper-interface-design.md). Task1 connected the actual game to the single Paper reading view with direct recommended startup (云归 / village / sword), safe save recovery, 状态 / 回看 / 修行, settings/help, and complete next-life customization. No engine/schema/content change or runtime dependency was introduced.
- Task1 fix `bcad3b3245f58854ed18137e051514ba3f230eed` addresses both Important source findings: primary feedback follows the latest actual action, and reward/setup/equipment redraws have surviving focus targets. Scoped source re-review passed. Accepted focused Node evidence is startup8 and renderer9 passing cases; actual DOM focus remains unverified.
- Task2 changes only package.json, README, QA_REPORT and this ledger; package version is1.2.0. README describes actual first-life defaults, full next-life choices, auxiliary controls and recovery. Historical release and browser records above remain intact.
- Fresh `npm run release` passed10 test files (file-level runner results,0 failures/skips/cancellations),23 JavaScript syntax checks and a321678-byte offline build. Environment-only npm unknown-http-proxy warning remains nonfatal. No tests were added or the full suite repeated for these docs/config edits.
- Local build metadata: version1.2.0, UTC `2026-10-25T04:28:13.023Z`, offline SHA-256 `7aa67d0d51e6d41f9e2b29017f6ad786af247e7837fd732d931d50c844aa16d1`, runtime dependencies0. Worker packaging produced327617 bytes using full current local HEAD `bcad3b3245f58854ed18137e051514ba3f230eed` as **validation-only** sourceCommit. Metadata edits were uncommitted at packaging: this is a validation parameter, not an exact release commit or publication claim.
- Node package inspection confirmed inlined Paper CSS/session module, exact static module/CSS copies, matching offline copies, no external script/stylesheet tags, local Worker health/source/hash, identical root/download bodies and HEAD/404/405. An initial inspection used the wrong CSS path and failedENOENT; correcting it to src/ui/paper.css passed. Full details are in QA_REPORT.
- **Historical candidate checkpoint: production then remained the recorded 1.1.0 release.** No GitHub push/PR, Cloudflare deployment or DEPLOYMENT edit occurred. The controller must build from actual merged/source SHA and record publication/health/download evidence.
- No browser/headless/CDP/preview workaround was used. Paper320px layout, light/dark appearance, native keyboard/DOM and dialog focus, screen-reader announcements and visual parity remain pending. No physical-device or human20–30-minute pacing acceptance is claimed; historical1.1.0 browser checks do not validate1.2.0.

## Historical Paper 1.2.0 final candidate review — 2026-10-25

- Whole-branch review found one Important and two Minor issues: missing exact flee costs, tooltip-only burn unavailability, and Help target width. One bounded fix wave added the actual combat action renderer with eight real-engine/markup cases and fixed all three. Scoped independent re-review addressed every finding with no new breakage.
- Fresh controller release after all runtime edits passed11 test files and25 JavaScript syntax checks. Final offlineHTML322726bytes, SHA-256 `709ee3db3d1378f2b954c17de3e513ec56a6648f5ebe0ec1ac63288b751ba3d7`, builtUTC `2026-10-25T04:42:03.769Z`. Earlier321678-byte candidate above is superseded. No engine/content/schema/runtime dependency change.
- Local scratch review reports remain local. Public evidence lives in this ledger and QA_REPORT. Publication must reconstruct the reviewed tree on actual GitHub main, not push the synthetic local snapshot history. At that historical checkpoint, remote main was `05c6351a836e89d84aaeac309b7bc0aed6b035db` and production was 1.1.0; publication and live verification are completed below.

## Historical production: Paper 1.2.0 publication and live acceptance — 2026-10-25

- [PR #2](https://github.com/ct1150/wending/pull/2) merged with actual release source [`90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`](https://github.com/ct1150/wending/commit/90bb910840e7c2b22c59e0421f111c4c1a7cb7c8). Tree `ec460fa26506ce0946a0a5edf9f5222ed5e8ab65` equals reviewed local `0d015eb82554c840a9bbcfd774a07d4f57dc25ba`; synthetic local history was never directly pushed.
- [PR CI 40163973639](https://github.com/ct1150/wending/actions/runs/40163973639) and [main CI 40164006388](https://github.com/ct1150/wending/actions/runs/40164006388) succeeded; validate job `121081217915` succeeded, deploy job `121081258031` was skipped. Final local release passed 11/11 test files and 25 JavaScript syntax checks, with focused startup 8 / renderer 9 / combat 8 cases. These are prior controller results; this documentation audit did not rerun builds or suites.
- Exact-source packaging produced HTML 322726 bytes, SHA-256 `709ee3db3d1378f2b954c17de3e513ec56a6648f5ebe0ec1ac63288b751ba3d7`, and Worker 328691 bytes. Local handler identity was inspected at `2026-10-25T05:01:40.998Z` (inspection time, not build time).
- Existing ordinary Worker was manually updated through the API: actual deployment `e890d80a-dbda-475b-a1c9-c32589b29803`, 100% version `1c5deb80-2930-4a53-9c8c-956fe7c712e3`, created `2026-10-25T05:02:16.128157Z`. Deployment ID comes from the deployments endpoint; the upload response's `deployment_id` was an undashed version ID. Worker tag, compatibility date `2026-10-24`, standard usage and zero bindings were unchanged. No automatic deployment or Static Assets migration occurred.
- Production health actually returned status ok, release source and the exact HTML hash. The actual settings download was 322726 bytes and byte-for-byte matched the built HTML. [Production URL](https://baishi-wending.ct1150.workers.dev/) was verified in the browser.
- A preexisting 1.1.0 YG02 save resumed in Paper with 云归 / sword, age 16, remaining life 84, HP 120/120, spirit 24, herbs 3, deadline 8 and previous choice intact. Enter chose “答应先查真相，再谈灵种” into YG03 with herbs +2; “申请公开查档” reached “灯下选下一条路” with spirit 16 and herbs 5. With 状态 and 修行 open, keyboard Enter on 闭关 advanced three years to age 19 / remaining 81 / cultivation 13/36 / spirit 21 / herbs 5 / deadline 5. Latest result became 闭关修行, focus was `story-result-title`, and both disclosures survived redraw.
- Refresh preserved complete `main-content.textContent`; disclosures naturally collapsed on reload. Settings return focused `story-scene-title`. Native Help dialog focused Close and Escape restored Help focus; Help measured 44×44px. Actual viewport 1363×936, pageWidth 1348, no horizontal overflow in this desktop view; light body background `rgb(250, 248, 242)`. Observed logs contained only chrome-extension metadata errors, with no application warn/error observed; no claim of complete pageerror capture.
- Remaining limits: actual 320px and dark appearance, physical phones, assistive technology, human 20–30 minute pacing and all-endings production playthrough were not tested. No local/prototype browser inspection or workaround occurred. The live check resumed a save rather than resetting a fresh first life; Node startup cases cover first start. Historical 1.1.0 browser evidence does not validate Paper. Controller-held source/smoke screenshots are not committed.
- This audit changes documentation only. Production source remains `90bb910840e7c2b22c59e0421f111c4c1a7cb7c8` despite the later documentation commit; actual health metadata is unchanged.
