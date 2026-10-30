# 最新指令：仅 Cloudflare GLM，明天一次复测

2026-10-29 用户已明确停止智谱和 Gemini 路由，只保留 Cloudflare `@cf/zai-org/glm-4.7-flash`，等明天再测试。以下历史智谱续测步骤已被取代，禁止继续执行。当前计划见 `docs/superpowers/plans/2026-10-29-cloudflare-glm-only.md`。

## 2026-10-30 08:05 Asia/Singapore 的一次续测

1. 目录 `D:\tmp\wending\wending`，分支 `release/zhipu-admission`。先读最新用户指令、Git 状态、本计划和部署文档，保留全部已有修改和原始证据。候选已改为 CF 单路由；GLM 仍未晋升，生产保持旧版。今天不调用真实模型或发布候选。
2. 本次只执行一次续测任务，结束即暂停原自动化 `automation`，成功或失败都不恢复周期复测。不得读取、导出或使用智谱密钥，不调用智谱、Gemini 或任何付费路径；预加载保持关闭。
3. 读取当前生产部署及活动 version 的绑定，确保原正式 namespace `1de1df3929534a8d8d495d6db6604e99` 保留。原版本基线 `f17816a1-da95-4095-b13d-406a2610a9c0`，不能把最后上传的私有 `/settings` 当活动生产配置。
4. 准备新的受鉴权、具有过期时间的 CF-only 私有 0% Worker 版本；正常流量保留原版 100%。只调用服务器 `AI.run('@cf/zai-org/glm-4.7-flash', ...)`。旧 `.scratch/prepare-glm-probe.mjs` 包含直连智谱入口，不可原样复用。无需建立智谱租约 sidecar；临时完整游戏 API 使用唯一隔离对象，禁止修改、清空正式账本。
5. 先发一次极小 CF 原生请求（限制输出，关闭思考）。若为 4006、限流、超时或其他失败，保存新的不可覆盖记录，清理本轮 0% 路由、本地 token 和临时资源，报告实际错误；不重复轮询或改走其他模型。GraphQL 用量为零不能替代原生接口成功。
6. 极小请求成功后，再对当前源码做真实流式开局、实际选择、完整场景校验、结算和存档刷新，并记录首段正文、总耗时和失败。刷新不应新增推理，完整结果保存前不开放选项。历史智谱成功样本不能代替本次 CF 验收。
7. 若本次真实验收通过，按用户此前已给出的发布授权继续晋升 CF GLM、核验精确候选 CI、沿原 PR #16 合并 main、按 `docs/DEPLOYMENT.md` 显式构建并部署正式前后端，然后公开浏览器验收。默认构建关闭推理，不能直接当正式包。正式包只能声明 CF 路由，不能继承 ADMISSION_BUDGET 或新建生产 namespace/migration。若验收失败则保留原生产；报告尚未发布。
8. 无论结果如何，清理临时资源和本地测试 token，核对活动部署、原 namespace 与健康状态，暂停本次自动化并交付证据。不得在用户未再次要求时安排下一轮。

---

## 以下为已停止执行的历史智谱方案

用户指令：先优化智谱，可用后直接发布线上。继续在本任务完成，已有发布授权，不重复确认。正常玩家尚未切换至候选。

1. 读取当前分支、PR #16、实施计划和本目录状态，核对有无新的人类指令或其他作者提交。先保持只读核验，不覆盖其他修改。
2. 以至少 15 分钟间隔执行一次极小智谱请求。凭据只在生产 Worker 的 ZHIPU_API_KEY 中；不得读取、导出或显示值。每轮使用受保护且有过期时间的临时 0% 入口，正常流量保持原版本 100%。本地 `.scratch/prepare-glm-probe.mjs` 可准备请求，但需核对当轮 API/模块和绑定；不要复用已过期或已删除的 token、版本和 namespace。
3. 若仍为 1305/1302/超时，保存新的不可覆盖记录并清理临时部署和 token；同一状态不重复通知，不高频重试。发现新的需要用户处理的错误时再通知。
4. 如果极小请求恢复，建立当前候选的受保护完整验收。0% 入口会调用旧 DO；可像本轮一样建立无密钥的临时预算 Worker，部署当前 story-budget.js 类、绑定原生 SQLite，再让私有主 Worker 的 ADMISSION_BUDGET 指向该测试类。新建 gate-binding.json 只存 script/namespace 元数据。类源码和预算身份须核对，禁止把测试 namespace 当正式账本。主服务密钥继续只留在原 Worker，通过继承命名 secret 使用。
5. 固定智谱 glm-4.7-flash 为主、CF @cf/zai-org/glm-4.7-flash 为备用，当前 generateScene/transport 必须带 providerGate 和共享 deadline/signal。先通过 acquired/waiting/released，再执行真实开局、实际选择和保存刷新，不可用历史成功或 fixture 替代。`.scratch/run-admission-scene.mjs` 和 `.scratch/zhipu-browser-acceptance.mjs` 可作参考，使用时修正证据目录/源码身份并避免覆盖历史记录。浏览器脚本原先的多次重试为人工驱动模拟，恢复验收应低频、有界地操作。
6. 记录首段正文、整回合完成和失败率，区分临时预览与已保存结果。校验只在完整模型输出及存档成功后开放选项；刷新不产生新推理。保持预加载关闭。
7. 新的真实成功后，写符合 tests/production-promotion.test.js 的 GLM 证据，更新 PRODUCTION_PROFILES 和相关测试；保持历史 Qwen profile。源码提交并等待精确树的完整 CI。沿原 PR #16 合并已授权 main；前端频道由 main CI 发布。
8. 依据 docs/DEPLOYMENT.md，从最终 main SHA 干净源码构建生产包。默认 build:gateway/CI 后端关闭推理，必须显式 buildGateway({sourceCommit,production})。正式 metadata 保留原 AI、原 STORY_BUDGET namespace 1de1df3929534a8d8d495d6db6604e99 及现有 secret 名称，不使用测试 ADMISSION_BUDGET，不读取密钥值，不发新生产 DO migration，不开启付费路径。
9. 上传并核对精确模块/manifest/绑定后切生产；在 100% 后实际核验原 namespace 的新类方法及公开开局、选择、保存刷新。当前原基线 f17816a1-da95-4095-b13d-406a2610a9c0 和前端频道都要纳入回滚；旧网关会读取频道，仅回滚 Worker 不一定回滚 HTML。
10. 仅取得公开线上成功证据后报告发布完成，并停止本任务续测自动化。失败则恢复原生产、清理本轮私有路由、测试 namespace/Worker 和本地 token，保存原因与证据，保持授权范围继续处理。
