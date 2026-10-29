# 恢复后继续验收与发布

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
