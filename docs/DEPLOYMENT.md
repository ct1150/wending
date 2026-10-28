# 百世问鼎 · 4.1.0 部署

正式地址：[baishi-wending.ct1150.workers.dev](https://baishi-wending.ct1150.workers.dev/)。GitHub 验证并发布静态 HTML，Cloudflare 后端单独用显式生产包部署。[PR #14 发布执行记录](https://github.com/ct1150/wending/pull/14)记录最终 main/CI、静态 manifest、后端 deployment/version、模块读回和公开浏览器结果；本文件提供可复核的操作合同，不预先声明上线完成。

生产模型为经过[实际样本和浏览器验收](evidence/realtime-release-2026-10-28.json)晋升的 `@cf/qwen/qwen3.8-27b`。保持 Workers Free、原存储和公开实时入口；不使用历史人为调用次数、Neuron 累计上限或首错停止规则。实际平台额度耗尽仍保留进度并暂停，不升级套餐或改走付费服务。

## 构建与启用合同

先构建浏览器，再打包后端；`npm run release` 或 `npm run build` 会重建 `release/`。

```bash
npm run release
SOURCE_COMMIT=完整40位源码提交 npm run build:gateway
```

| 方式 | 必要配置 | 生成行为 |
| --- | --- | --- |
| 默认 `build:gateway` | 合法仓库版本策略 | 始终生成 disabled 后端，即使仓库 enabled 为 true 也不自动开放 |
| 显式 `acceptance` | 仓库 enabled 为 false、独立 tester permit、原实验桥和新鲜实际 Free 观察 | 受保护验收后端，固定内嵌前端 |
| 显式 `production` | 仓库 enabled 为 true、已验证生产 registry、同账户 Free proof、精确版本 | 公开生产后端，不导入 tester、acceptance、experiment 或 operator 模块 |

正式包通过 `buildGateway({sourceCommit, production})` 生成。生产参数严格包含 `enabled:true`、`mode:'production'`、当前 `modelId`、`bindingAccountId`、`currentPlan`、`freeBoundaryProof`，以及协议/规则/提示/存档/内容版本 **1/1/1/5/4**。模型必须来自同一份已审源码的 registry，不能从外部 policy 注入 profile。源码 root 与构建器 root 必须一致。

Free proof 保留原始 `checkedAt`、来源和账户，不伪造新观察。验收入口要求新鲜证明；正式生产保留同账户 Free 硬边界验证，不以五分钟 probe 余额时效限制玩家游戏时间。账户用量分析是延迟观察，不等于逐笔账单或实时剩余额度。

| 产物 | 用途 |
| --- | --- |
| `release/gateway.mjs` | 单模块静态网关，不包含实时 API |
| `release/backend/entry.mjs` 与 `src/**` | 完整 ESM 后端、生产入口及 StoryBudget 命名导出 |
| `release/backend/deployment.json` | 源码、版本、绑定、模块字节与 SHA-256 清单；不是直接上传的 Cloudflare metadata |
| `wrangler.story.json` | 后端入口与首次部署参考；已有 namespace 更新不重新创建迁移 |
| `wrangler.jsonc` | 旧静态 Assets 配置，不代替实时生产上传合同 |

## 存储与账户身份

| 用途 | 必须保留的身份 |
| --- | --- |
| 生产 StoryBudget | namespace `1de1df3929534a8d8d495d6db6604e99`；类 `StoryBudget`；固定对象 `story-budget-v1-global`；迁移标签 `story-budget-v1` |
| 私有验收账本 | namespace `dfb218f2f29d4ecab2395f8a00b48350`；类 `OperatorProbe`；固定对象 `wending-realtime-acceptance-v1`；键 `experiment-v1` |
| 模型访问 | 同一已确认 Workers Free 账户的直接 `AI` binding；没有 Gateway credits 或付费后备 |

正式上传只更新既有 `baishi-wending` Worker。保留 `AI` 与原 `STORY_BUDGET` binding、既有 secret binding，不发送新 migration；移除公开 Worker 的 `STORY_EXPERIMENT` binding。私有 helper、原账本与全部失败/unknown 记录继续保留，不清空或重建存储。

本轮临时诊断 Worker `wending-diag-0764cde-1618` 已于 2026-10-28 16:28:52 UTC 删除，未绑定 Durable Object；见[清理结果](evidence/realtime-release-2026-10-28/operations/temporary-diagnostic-cleanup.json)。

## 正式发布顺序

1. 归档真实模型输入/响应、当前源码解析与规则提交、受保护浏览器保存恢复，以及失败样本和修复回归。当前覆盖分属 `47c4064` 浏览器与 `b519bf4` 最终模型校验，明确记录组件变化，不宣称整个新提交已经线上跑过。
2. 晋升 Qwen 3.8 profile 并启用仓库生产策略，运行最终源码完整 release、显式生产打包及独立审查。普通 CI 后端产物继续关闭推理。
3. 推送最终 PR #14 分支，观察精确 head 的 CI；合并后记录真实 main SHA 与 main 验证结果。
4. 等待 main publish 完成，核对 `release-channel/manifest.json.sourceCommit` 指向最终 main。生产网关读取该频道，避免旧频道覆盖新内嵌页面。
5. 从最终 main SHA 生成显式生产包，取得当前部署基线并上传原 Worker。上传前比较 deployment/version、settings、旧模块摘要；并发变更或不确定结果先调查，不隐式重复 PUT。
6. 回读全部模块、绑定和版本；无 tester permit 检查 capabilities。核对 `/healthz`、首页与离线下载的源码、版本、字节和摘要，再完成公开浏览器新建人生、实际选择、保存和刷新恢复。

原始 API 上传须上传全部清单模块并转换为 Cloudflare multipart metadata，不能只传 entry 或静态 gateway。正式模块图不包含 tester/operator 入口，玩家生成无需 tester permit 或 operator secret。

## GitHub 自动静态发行

`.github/workflows/validate-deploy.yml` 执行 `npm ci --ignore-scripts`、浏览器依赖安装、`npm run release` 和默认关闭后端打包，保存对应源码的产物。只有 main 的非 PR 工作流继续 publish，用该次验证产物写入不可变 HTML 与 `release-channel` manifest。

`publish-release.js` 发布前复查 main 身份，以普通 fast-forward 更新频道，不覆盖已经前进的 main。网关校验 manifest、字节与 SHA-256 后切换，下载失败时保留已验证页面。活动实例按请求检查，间隔至少 60 秒，不保证全球同时切换。

该工作流不部署 Cloudflare AI 后端，也不证明模型验收或公开浏览器闭环。`/healthz` 报告实际提供的 HTML 身份；后端身份另查真实 deployment 和模块摘要。

## 故障恢复与回滚

模型超时、不可用或平台额度耗尽时保留进度，明确重试续接；历史 unknown 不退款、不删除、不改写。关闭新推理仍须允许读取已保存回应与档案。当前时限为生成 90 秒、客户端 105 秒、在途记录 120 秒，没有自动模型重试。

前端回滚仍须保留 V5/CV4、IndexedDB v2 和 `relationshipVersion:1` 读取器；旧 v1—v4 人生继续原规则。上传结果不确定时先只读核对部署与模块，不自动重传、回滚或恢复旧凭据。真实存储、历史与凭据变更不包含在普通代码发布中。

[4.0 及更早部署、受保护阶段、历史失败和迁移全文](https://github.com/ct1150/wending/blob/fbb4bbf408f448b745642ed3b81c471e9816bf71/docs/DEPLOYMENT.md)按固定提交保留。历史“当前”、预算和停止规则只描述当时状态；本轮结果见[发布执行记录](https://github.com/ct1150/wending/pull/14)和 [QA](QA_REPORT.md)。
