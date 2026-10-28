# 百世问鼎 4.1.0 发布核验

**4.1.0 已发布，公开入口的实际生成与存档恢复闭环通过联合证据核验。** 原浏览器驱动有一次响应体采集失败，原始报告保持 `FAILED`；后续缓存读回与重新启动浏览器的证据独立补足功能验收，没有改写旧结果或重新推理。

[开始游玩](https://baishi-wending.ct1150.workers.dev/) · [发布 PR #14](https://github.com/ct1150/wending/pull/14) · [源码 458816d](https://github.com/ct1150/wending/commit/458816d14a2d48612f0e66a1f28e6f0045f4951b) · [机器可读汇总](release-verification.json)

实时人生入口：**更多 → 存档与设置 → 打开实时人生**。原有离线人生和存档继续保留。

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| PR CI | 805/805 通过；151 个 JS 文件语法检查 | [PR 工作流](https://github.com/ct1150/wending/actions/runs/40732687090)、[摘要](ci-pr.json) |
| main CI 与静态发行 | 805/805 通过；release-channel 指向精确 main 源码 | [main 工作流](https://github.com/ct1150/wending/actions/runs/40733113624)、[摘要](ci-main.json) |
| Cloudflare 正式后端 | 2026-10-28 17:14:04 UTC 完成上传读回，18 个模块摘要全部匹配 | [部署记录](production-deployment.json) |
| 公开页面与 API | 8 项身份检查通过；无需 tester permit，capabilities ready | [公开身份记录](public-identity.json) |
| 实际开场和选择 | 全新公开人生发出 2 次 turn POST，无重试；开场与选择结果均已提交 | [原生成报告](public-generation/evidence.json)、[选择快照](public-generation/02-choice-committed.json) |
| 原回应的独立读回 | 1 次 GET、0 次新推理，6 项检查确认原请求、attempt 和 S2 场景一致 | [缓存读回](public-cache/cached-choice-response.json) |
| 浏览器关闭后重启、导出与刷新 | 12 项检查通过；revision 2、完整状态与显示正文保持一致，0 API 请求 | [实际报告](public-save-refresh/evidence.json)、[完整存档](public-save-refresh/saved-game.wending.jsonl) |
| 独立内容与闭环审阅 | 22 项交叉检查通过；没有实质性叙事或规则矛盾 | [独立审阅](public-narrative-review.json) |
| 原账本保留 | 9 项检查通过；18 行调用、18 份结果、11 项准入与 3 个验收案例全部不变 | [部署后比对](ledger-retention-post-production.json) |

## 浏览器采集失败的处理

原驱动确实完成了开场与一次选择，存档升至 revision 2，但 CDP 未能取得最后一次 choice HTTP 响应体，因此“Choice API response evidence was captured”断言失败。所有原始 `net::ERR_ABORTED` 和响应体采集错误均保留在原报告中，不把它改成一次完整驱动通过。

后续只读 GET 取得已缓存的原回应，精确匹配原请求 ID、attempt 和提交场景；没有新 turn POST 或模型调用。再次启动同一原生浏览器 profile 后，实际导出并刷新成功，12 项检查全部通过，10 秒观察期内没有新 API 请求。独立审阅核对了原快照、缓存回应、重启状态和导出档案的对应关系。

本轮真实选择是向王老伯询问线索。规则提交为 7 日、行粮 -1、灵石 +1、关系 +3；人物仍在青石村，正文与记忆没有把未选择的旅行写成已经发生。开场 3 项选择中有 1 项因境界不足明确禁用，另 2 项可执行；续写的 3 项选择均可执行。有限样本不保证所有未来叙事都没有错误。

导出档案为 10,827 字节、3 行、2 个 turn，SHA-256 为 `a1c641fcaeaecbff6a9861e4d87f7eb35759dacfb9813ef63eb2276036563bcc`。最终完整状态 SHA-256 为 `28984c20b612d64bf79089cdcf77c41bed9f9758a4732027b2a5be1127f2a1dc`。

## 生产身份与免费边界

生产模型为 `@cf/qwen/qwen3.8-27b`，保留 Cloudflare Workers Free，平台真实额度有效，没有付费后备。证明保留 2026-10-28 16:59:05.727 UTC 的原始观察时间，没有把保存或重新打包当成新的余额观察。

部署 ID 为 `05ff07f4-f530-46c9-9ef3-b3459892b32e`，版本 ID 为 `9d7e9fdb-12dc-4710-8283-7f4ca8608b27`，流量 100%。原 StoryBudget namespace 与迁移标签保留；公开 Worker 已移除实验 binding，生产模块图不包含 tester/operator 入口。

公开首页与离线文件均为 971,378 字节，SHA-256 为 `574123926708a59b6dc75da822f6dc0f2ca39dacc4ce4825873856b93270707d`；健康接口报告源码 `458816d14a2d48612f0e66a1f28e6f0045f4951b`，实际 HTML 来源为已校验的远端发行频道。

保留的 operator 账本中有 8 个 complete、7 个 failed、3 个 unknown，所有 `actualNeurons` 仍为 null。14,205 的累计预留数是保守历史，不是实测消费或剩余额度。公开生产请求不向这个保留的实验账本追加记录，账本未变不能被解释为生产没有调用模型。

该核验目录追加到 release-channel 分支，不改动 main、已部署模块或静态 manifest 的源码身份。[证据清单](manifest.json)记录源文件与公开副本的摘要。仅在出现时隐藏临时 sessionRef 和作者邮箱；失败、重试、调用结果与计数保持原状。CI 全量日志保留实际工作流链接及原始摘要，不重复放入本目录。
