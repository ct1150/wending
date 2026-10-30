# 百世问鼎 · 4.3.0 部署

4.4.0 剧情选项候选尚未发布。当前四回合真实存档可连续读取，但随后告辞四次复制上一段拒绝，被 `REPEATED_SCENE` 拦截；六回合验收未通过，不能据单元测试成功晋升。两次提示词格式实验未改善结果，已撤回。实际请求、原生输出、耗时与清理状态见[发布阻碍记录](evidence/story-coherence-2026-10-30/release-blocked-2026-10-31.json)。原 4.3.0 保持 100%，原 namespace、账本与 unknown 计量保留，没有部署新的正式包。

候选使用 IndexedDB v3，正式上线后若需回滚，必须保留 v3 读取能力，不能直接用只认识 v2 的前端覆盖。临时 0% 入口已移除，测试凭证与浏览器会话快照已清理，不安排重复定时测试。

> 2026-10-30：仅保留 Cloudflare `@cf/zai-org/glm-4.7-flash`，不读取智谱密钥，不接入 Gemini 或付费后备。真实原生开局、选择和保存刷新已通过，见[最终私有验收](evidence/cf-glm-promotion-final-2026-10-30.json)；正式 CI、发布与公开复验以 [PR #16](https://github.com/ct1150/wending/pull/16) 为准。流式正文为临时预览，完整校验和保存后开放选项，unknown 计量保留。正式清单仅有 Cloudflare 主路由、`optionalSecrets:[]`；预加载关闭，原生产 namespace 和回滚版本保留。本次一次复测后删除原自动化，不安排下一轮。下文智谱和 Qwen 发布过程均为历史记录，不代表当前路由。

当前 GLM 使用原生流式 JSON Schema；旁白与对白分别约束，动作按合法目标分组。已知实体引用、旧约定/线索的关闭由服务端恢复原始身份和文本，新实体必须声明；最终身份、机械规则、记忆与所有下一步选项校验仍生效。旧记忆不在 Schema 重复整段原文，实际序列化输入仍受 24 KiB 上限约束。最终实测首段约 3.0–5.2 秒，完整保存约 12 秒；不宣称稳定流畅，预加载需单独设计和验收。

正式地址：[baishi-wending.ct1150.workers.dev](https://baishi-wending.ct1150.workers.dev/)。GitHub 验证并发布静态 HTML，Cloudflare 后端单独用显式生产包部署。[PR #14 发布执行记录](https://github.com/ct1150/wending/pull/14)记录最终 main/CI、静态 manifest、后端 deployment/version、模块读回和公开浏览器结果；本文件提供可复核的操作合同，不预先声明上线完成。

生产模型为经过[实际样本和浏览器验收](evidence/realtime-release-2026-10-28.json)晋升的 `@cf/qwen/qwen3.8-27b`。保持 Workers Free、原存储和公开实时入口；不使用历史人为调用次数、Neuron 累计上限或首错停止规则。实际平台额度耗尽仍保留进度并暂停，不升级套餐或改走付费服务。

## 4.2.0 标题页发布

本次只通过 GitHub → release-channel → 现有 Cloudflare 网关更新前端 HTML。原 4.1.0 的正式实时 AI 后端继续提供相同协议，**不要部署 CI 默认关闭推理的 backend 产物**。最终源码、PR/main 检查、频道清单、生产 health/HTML 与实际浏览器结果统一记录于 [PR #15](https://github.com/ct1150/wending/pull/15)。本地最终候选报告为 [release-candidate.json](evidence/title-screen-4.2.0/release-candidate.json)。

## 构建与启用合同

### 待验收的 GLM 流式接入（2026-10-29）

4.3.0 开发代码按最新授权使用智谱免费 `glm-4.7-flash` 主路由，Cloudflare `@cf/zai-org/glm-4.7-flash` 备用。旧 Qwen 生产 profile 和真实验收记录保留；当前 GLM 仍未晋升。`candidateModelId` 表示下一候选，`activeModelId` 是包内规范化模型标识，实际物理提供方及模型看 `providerRoute`。默认构建仍关闭生成。

在 Cloudflare Dashboard → Workers & Pages → `baishi-wending` → Settings → Variables and Secrets → Add，选择 **Secret**，名称为 `ZHIPU_API_KEY`，值为智谱开放平台标准 API Key，点击 Deploy。使用 [Cloudflare 官方 Secret 流程](https://developers.cloudflare.com/workers/configuration/secrets/)；不要将密钥写入仓库、浏览器、production policy 或聊天。后续代码上传须保留既有 secret binding。清单的 `optionalSecrets` 只声明名称；缺失时只尝试 Cloudflare 备用。

智谱主请求固定发送到 `https://open.bigmodel.cn/api/paas/v4/chat/completions`，模型固定为免费 `glm-4.7-flash`，关闭思考；不接受客户端指定地址或模型。非成功 HTTP 响应、繁忙、网络故障或超时才允许切换一次 Cloudflare binding；错误场景、思考输出、模型身份或结构错误不会自动重新生成。当前主服务等待窗口为 45 秒，主备共享 90 秒总期限，按整个主请求计时。换源不携带智谱密钥。

GLM 内部协议使用短引用与角色分组，正式 ID 由服务端分配；选项文字由实际 action/targetId/stake 生成，避免模型文字与执行目标分离。转回正式场景后仍执行原有身份、记忆、行动及收据校验。此协议仅适用于 GLM，旧 Qwen 和历史正式场景不变。

新客户端通过 POST `Accept: text/event-stream` 读取 `status/reset/preview/result`。预览只提取 `blocks[].text`，在内存中显示并标记生成中；换源清空预览，断流后标记未完成，刷新不恢复半段文字。最终场景通过服务端校验与预算结算，再经客户端校验及本地存档 CAS 成功后才开放选项。结算未确认时流以未完成结束，不发送最终 result；原 attempt 保留供查询恢复。GET 和旧客户端 JSON 路径继续可用。

主服务调用结果未知时，即使备用成功也保留 unknown 计量；不把备用成功等同于主服务零消耗。Cloudflare 返回 `4006` 只证明额度准入被拒绝，不能直接解释为当天已用完。当天 GraphQL 用量为 0 与原生接口 429/4006 的不一致证据保存在 [quota-recheck.json](evidence/stream-speed-2026-10-29/quota-recheck.json)。

历史 Cloudflare 当日 quota 锁保留。只有服务端可信 GLM readiness 能为 reserve 指定独立的智谱主路由，绕过这一条 Cloudflare 锁；认证、单会话在途锁、预算、请求身份、显式重试和历史计量照常执行。浏览器不能提供此字段，不清空或迁移旧账本。

受保护验收和正式生产包固定本次构建内嵌页面，避免旧频道缓存覆盖新前端；静态独立网关继续读取 release-channel。正式更新前端时必须同时重新构建、发布后端，核对同一个 main SHA 的 HTML 摘要和模块清单。

2026-10-29 已确认 `ZHIPU_API_KEY` 加密绑定存在。最初真实调用被智谱 HTTP 429 / 1305 拒绝；[官方错误码](https://docs.bigmodel.cn/cn/api/api-code)将其定义为模型访问量过大。续测已取得有效正文及完整 usage，并完成真实 API/SQLite 的浏览器开局、选择、保存和刷新恢复。成功样本首段正文 1.1–14.5 秒，完整生成/保存 5.9–19.8 秒；仍有平台繁忙和无效场景，不代表稳定延迟。Cloudflare 原生绑定最新复测仍返回 4006，GLM 保持未晋升。完整边界和实测数据见 [续测报告](evidence/stream-speed-2026-10-29/glm-followup-summary.json)。

验收使用原生产版本 100%、临时凭证保护的测试版本 0%；页面由本地当前构建提供，API 和 SQLite 在真实 Worker 执行。它没有验证正式发布入口或成功的 Cloudflare 主服务输出。测试发现并修复 Workers 不支持 `redirect:'error'` 的差异，改为 `manual` 且拒绝 3xx。结束已恢复原生产版本、关闭预览并删除本地测试凭证；用户配置的 secret 保留。

测速使用 `node scripts/story-latency.js <样本.json> [...]`，区分累计 20 字可读正文、片段间最大停顿、完整校验/保存及读完后等选项。每秒 6 字是显式测试假设。当前有效样本的阅读时间覆盖了正文出现后的生成，但首段排队长尾仍不友好，建议评估阅读期间预测单个分支，暂不预生成所有分支。原协调器每会话只允许一个进行中回合，不能直接复用正式 turn 写入预测 pending；缓存身份、跨标签失效、命中率和额外推理量需独立验证，详见[设计](superpowers/specs/2026-10-29-glm-streaming-design.md)。预加载不能解决模型拒绝服务。

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
