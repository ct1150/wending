# 百世问鼎 4.2.0 发布与现场验收

记录日期：2026-10-29（UTC）。

**静态发布已完成；本次真实 AI 新剧情验收受服务商当日免费额度阻挡，未完成全量上线验收。** 新的真实 AI 开场、实际选择、生成后的历史切换，以及完整实时存档人工导出，均保留为受阻或未通过状态。

[线上游戏](https://baishi-wending.ct1150.workers.dev/) · [已合并 PR #15](https://github.com/ct1150/wending/pull/15) · [main CI 与静态发行](https://github.com/ct1150/wending/actions/runs/40807846811) · [最终发布报告](release-report.json)

## 发布身份

| 项目 | 结果 |
| --- | --- |
| 正式源码 | `1f5b9e18dae06e4b74e6d60403c46964cf45e1f9` |
| 候选源码 | `8f9a8d1f914bdad688b07dc77096f91c8639e00a`；与 main 的源码树相同：`64021cff31e00c0320f92d94580d57585306fade` |
| 完整本地回归 | 859/859 通过，失败、取消、跳过均为 0；162 个 JavaScript 文件语法检查通过 |
| main 工作流 | [validate](https://github.com/ct1150/wending/actions/runs/40807846811/job/123230939159) 和 [publish](https://github.com/ct1150/wending/actions/runs/40807846811/job/123231570988) 均成功 |
| 生产 health | 二次核对为 4.2.0、上述 main、`lastError` 为空；最后记录于 02:59:01 UTC，详见 [production-health.json](production-health.json) |
| HTML 身份 | 1,025,064 字节；SHA-256：`c77371e921886d3d2749af475388dc9108ac59eaf13e6b7d85f08a53bafe1856` |

本轮沿用现有 GitHub → release-channel → Cloudflare 静态网关发布，未修改生产 AI 后端、模型、绑定或计费策略，未升级付费套餐。主证据归档目录为 `release-channel:verification/4.2.0-1f5b9e1/`。

## 实际验收结果

| 范围 | 状态 | 已观察结果与边界 |
| --- | --- | --- |
| 开始画面与入口 | 通过 | 首页清楚显示「踏入仙途 / 续写此生 / 游戏设置」；新标签页从首页进入。见 [首页截图](production-home.jpg)及[浏览器记录](browser-observations.json)。 |
| 旧存档升级保留 | 通过 | 初次升级前后实际导出的旧「云归」存档均为 743 字节，摘要完全一致。该结论只对应这次已取得文件的比较。见 [下载核验](download-verification.json)。 |
| 多旅程、切换与恢复 | 通过，限待续状态 | 实际创建「林照」「沈渡」；旧「云归」和两段实时 pending 旅程并存。切回林照、同标签刷新保留人物、全新标签进入首页、再切回旧云归均已观察。两段实时人生尚未生成开场，不能据此宣称生成历史切换通过。见 [浏览器记录](browser-observations.json)及[林照待续截图](live-A-pending.jpg)。 |
| 真实新 AI 开场、选择与生成历史 | 受阻 | 两名人物的开场请求及林照一次明确重试均未生成故事。三条玩家 attempt 的已保存结果为 `paused / PROVIDER_FAILED`。见[服务诊断](production-service-diagnostic.json)。 |
| 完整实时存档人工导出 | 受阻 | Cloud Browser 中点击完整实时导出后，界面显示“导出未完成”；具体异常未暴露。没有取得完整实时导出文件，不能标记导出字节或摘要通过。本地原生 picker 对照仅保持等待，未复现该错误。 |
| 离线 HTML 与后续下载文件人工核验 | 未完成 | 浏览器返回的下载路径没有实际文件；后续导出同样无法做文件字节核对。独立命令行下载又遇到 DNS `EAI_AGAIN`，见 [HTTP 下载记录](offline-html-http-verification.json)。构建产物和 health 身份正确不替代这项人工下载验收。 |
| 本机原生浏览器模拟 provider 开场 | 通过，限模拟响应 | 精确发布 bundle 与源码模块的 HTTPS 模拟 provider 开局均达到 revision 1、turn 1、pending 0，显示 2 个选项，无异常。这说明对应前端流程能提交有效模拟响应，不是新的真实 AI 生成成功。见 [构建产物对照](built-artifact-diagnostic.json)。 |

旧云归的成功比较摘要为：`d25bccf10e5028317a380684b21693c5af834e3eab9936095a2da067896c0b3d`。后续下载采集失败没有改写这次已成功取得的前后比较结果。

## 服务阻断与证据边界

生产协调器的只读 SQL 查询确认本次窗口内三条玩家 attempt 均为 `PROVIDER_FAILED`，查询 `rows_written = 0`，没有改写账本。随后对同一已确认生产账户、同一 `@cf/qwen/qwen3.8-27b` 模型进行 **一次独立 Cloudflare API 检查**，实际收到 HTTP 429、错误码 4006，内容为当日免费分配的 **10,000 Neurons 已用尽**。因此，本次现场继续验证真实生成受到当时实际免费额度限制；没有自动重试循环或付费后备。

**该独立检查没有重建前三次玩家请求各自的原始异常。** 玩家请求的原始 provider exception 未保留，只能确认其已保存错误为 `PROVIDER_FAILED`；不能把后来的 4006 当作每次早先失败的逐次原始证据。完整范围见 [production-service-diagnostic.json](production-service-diagnostic.json)。

命令行 smoke 是另一个边界：[api-smoke-single-opening.json](api-smoke-single-opening.json) 记录首次 capabilities 请求发生 DNS `EAI_AGAIN`，`generationPosts = 0`。这次执行环境错误不是生产服务的 HTTP 回复，也不是另一次模型生成失败。

## 修复、兼容与未验证范围

本轮收尾修复包括：离线双标签页测试等待真实存储传播并保留防覆盖断言；实时 retry/resume 先核对物理档案，避免旧页面操作另一人物；损坏离线目录先导出与持久保留原文，再经明确确认恢复可读取旅程。原始失败、修复依据和回归结果见 [release-report.json](release-report.json)。

旧离线规则与存档读取器、实时 V5/CV4 档案、待续请求和完整历史的兼容约束、单文件离线构建继续保留。既有回归与本机原生浏览器／CI 视口覆盖不等于实体手机或屏幕阅读器验收；本次没有完成这两项，也没有证明所有浏览器、全球缓存同时更新或无限未来叙事质量。长线确定性 fixture 不算 1000 次真实模型调用。

在实际额度恢复且导出文件能够被取得后，仍需补验真实新开场、实际选择、已生成历史的跨人物切换，以及完整实时导出的文件内容与恢复。上述项目在本记录中保持受阻状态。

官方定价文档说明实际免费额度每日 00:00 UTC 重置，对应北京时间 08:00。本次检查后的下一次重置为 2026-10-30 00:00 UTC（北京时间 10 月 30 日 08:00）；未安排后台自动复验。来源：[Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)。
