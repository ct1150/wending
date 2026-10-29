# 429 / 4006 诊断，2026-10-29

检查时间约新加坡时间 14:35–14:46。当前两个服务均未恢复可用；本次没有修改业务代码或发布新候选。

## 已确认的事实

| 错误 | 本次证据 | 判断与可处理范围 |
| --- | --- | --- |
| 智谱 HTTP 429 / 1302（此前出现） | 用户确认 GLM-4.7-Flash 并发上限为 1，没有其他应用共用；现有服务只有会话级租约 | 同时请求或密集请求可以触发账户限流；尚无证据还原此前那一次请求重叠。多玩家上线前应做账户级并发准入，不能只依赖会话锁。 |
| 智谱 HTTP 429 / 1305 | 停止全剧情探测后，32-token 普通非流式请求和 JSON 非流式请求分别于 14:40:57、14:43:51 返回相同错误；534–543 ms，CF 缓存状态 DYNAMIC | 官方定义为模型服务过载。极小输入、关闭流式、关闭 JSON 模式均未消除。账户限流控制不能保证恢复平台容量。 |
| Cloudflare HTTP 429 / 4006 | GLM、轻量向量模型以及 OpenAI 兼容接口均直接返回每日 10k 配额耗尽；绕过游戏与游戏预算锁 | 是 Cloudflare 服务返回的配额准入拒绝；不是前端自行推断。今日 UTC 统计为 0，与拒绝消息不一致，内部根因尚待 Cloudflare 核查。 |

Cloudflare GraphQL：今天 42 次记录、0 Neurons；昨天 73 次、10711.885996931458 Neurons。统计窗口严格按 UTC 日期；今天 08:00 新加坡时间已过官方每日重置点。不能据此认定今天确实耗尽，也不能认定一定是重置故障：统计延迟、准入状态同步或账户侧策略仍需平台核实。

最后一次新增 stream-json 测试未连接上 Worker，客户端报 UND_ERR_CONNECT_TIMEOUT。没有取得该次智谱响应，不计入 1305 样本，也不据此归因流式模式。之前完整剧情流式调用的失败证据见相邻 release 目录。

## 代码核对与可行处理

- `src/worker/story-glm-provider.js:4` 固定官方通用 API 地址；`createGlmTransport` 使用固定免费模型，429 进入既有一次 Cloudflare 回退，没有立即循环重试。
- `src/worker/story-budget.js:95` 是会话级活动租约，不能约束不同会话共享同一智谱账户的总并发。并发 1 时，后续可增加账户级单并发准入和有界等待；超时后的服务端占用仍需保守处理。
- 1302：账户级串行准入、限制重复点击/密集重试、必要时申请并发额度。只能处理可控请求竞争，不能承诺消除所有账户限流。
- 1305：有间隔重试、短时停止重复探测、切换真正可用的备用。现有 Cloudflare 备用同样失败，因此当前主备不能保证恢复。
- 4006：已排除只在游戏账本、单模型或单 API 路径发生。继续改提示词、重新部署或清除本地预算状态不能解除已观察到的上游拒绝。下一步需要 Cloudflare 核查账户配额准入及重置；未发现可用的公开强制重置 API。
- 当前不启用预加载。它会增加并发和请求量，不能解决平台过载或配额拒绝。取得稳定成功率和当前路由速度样本后再评估。

## 可直接提供给 Cloudflare 的核查材料（草稿，尚未发送）

账户：b266970852cbc371061c94c5b1fe76a9

时间：2026-10-29 06:35–06:38 UTC

问题：今日 UTC 日 Neurons 为 0，跨模型直接 API 调用仍报 429 / 4006，每日 10k 免费额度耗尽。昨日使用约 10711.89。请核查此账户配额准入、00:00 UTC 重置和统计状态是否一致。

请求关联 ID：

- GLM 原生 REST：d7295e5f-05e7-4f7f-9e93-220527cf9e4f
- 轻量向量模型：87f8c7db-20b5-4ac7-bcda-9bee573925ed
- GLM OpenAI 兼容接口：727449d8-e9af-4a65-a5c3-749177aff1b9

详细响应摘要与统计见 [cloudflare.json](cloudflare.json)。没有附带 API Key 或授权头。

## 官方依据

- [智谱速率限制](https://docs.bigmodel.cn/cn/api/rate-limit)：1302 为账户限制，1305 为平台过载。
- [智谱错误码](https://docs.bigmodel.cn/cn/api/api-code)：欠费 1113、鉴权和参数错误均有不同业务码；本次未观察到这些码。
- [账户速率限制页面](https://bigmodel.cn/usercenter/proj-mgmt/rate-limits)。
- [Cloudflare 免费配额与 UTC 重置](https://developers.cloudflare.com/workers-ai/platform/pricing/)。
- [Cloudflare 免费模型说明](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/)：GLM-4.7-Flash 仍允许 Workers Free，无证据表明必须付费才能修复本次异常。
- [Cloudflare 错误码](https://developers.cloudflare.com/workers-ai/platform/errors/)：公开表中每日限额码为 3036；本次实测为 4006，保留实测值，不擅自改写。

## 操作收尾

临时测试版本已从活动部署移除。原正式版本 f17816a1-da95-4095-b13d-406a2610a9c0 为 100%，previews 关闭；AI、原 STORY_BUDGET 和两个 secret 绑定保留。/healthz 实测 HTTP 200，版本 4.2.0。新主备候选仍未发布；这次没有取得可用于速度验收的新成功场景。
