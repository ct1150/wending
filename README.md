# 百世问鼎 · 三界求仙篇

**4.1.0：保留原有离线人生，加入由选择推动、持续生成的实时人生。** 从山村、城坊、渡口或流亡中启程，为此身取名、掷取双重命格，在修行、历险与结缘中走自己的路。

[线上游戏](https://baishi-wending.ct1150.workers.dev/) · [交付账本](docs/ROADMAP.md) · [验收证据](docs/QA_REPORT.md) · [部署说明](docs/DEPLOYMENT.md) · [4.1.0 发布执行记录](https://github.com/ct1150/wending/pull/14)

## 开始游玩

默认继续原有离线人生。新玩家先取名、选择来处，再查看两道命格与三项资质；准备好后按「就以此身，入世」。已有存档沿原规则继续，切换模式不会自动重置旧人生。

实时人生的入口是 **「更多 → 存档与设置 → 打开实时人生」**。它是单独选择的模式，旧人生独立保留；在实时存档设置中可用「返回旧人生」切回。实时剧情由 Cloudflare Workers AI 的 `@cf/qwen/qwen3.8-27b` 生成，新剧情需要联网，玩家无需提供 API 密钥。当前生产部署和公开复验结果见发布执行记录。

## 选择如何改变人生

规则先结算选择的时间、资源、风险与关系，再将必要的剧情上下文交给模型生成事件、对话和下一组可执行选择。人物、承诺、线索和已发生的后果参与后续剧情；模型不能改写规则收据。旅行目的地、行动含义、角色身份、资源和时间提示都经过校验。

登仙和问鼎都是人生阶段，人物仍活着就可以继续。实时人生不设固定章节终点、回合数或游玩时长，只有寿尽或其他规则判定的实际死亡才结束此生。应用也不另加人为模型调用次数或 Neuron 累计预算上限。

服务保留 **Cloudflare Workers Free** 套餐，没有付费后备。平台的真实免费额度仍然生效：额度耗尽、网络故障或生成超时时保留已保存进度并暂停。条件恢复后可选择「重试续接」，也可「检查已有回应」；恢复不会重复结算同一个选择。等待时仍可阅读历史、导出备份。

完整历史保存在当前设备。生成时仅传输所需上下文；已保存的实时历史可由兼容前端读取和导出，新增剧情需要线上服务。不同浏览器、域名和离线文件的存储相互独立，迁移设备请先导出存档。

## 原有离线游戏

4.0 的固定剧情玩法继续保留：四种常规来处、双命格、修行突破、宗门与散修道路、人间至幽冥和天界的历险，以及结算后的传承。它在浏览器本地运行，不依赖实时剧情服务；下载单文件 HTML 后可离线游玩。

旧模式的 114 个选择场景和曾走通的 68 次选择路线属于它的内容与覆盖记录，不是实时人生的长度限制。完整旧版本验收见[固定历史记录](https://github.com/ct1150/wending/blob/fbb4bbf408f448b745642ed3b81c471e9816bf71/docs/QA_REPORT.md)。

## 存档与恢复

| 模式 | 存储与备份 | 兼容要求 |
| --- | --- | --- |
| 原有离线人生 | v1—v4 存档；4.0 为 `version:4 / contentVersion:3`；使用原 localStorage 键 | 沿原规则继续；旧格式的 1,000,000 字符限制只适用于该旧存档 |
| 实时人生 | `version:5 / contentVersion:4`，IndexedDB 分页档案；导出 `.wending.jsonl` | 不以旧存档总量上限结束人生；受实际设备存储容量约束 |

实时数据库为 `wending-live-v1`、结构版本 2。出生和待续事务先保存；读取、写入或导入失败时保留现有档案。带 `relationshipVersion:1` 的新档保存累计关系，旧的未标记 V5 档保留原历史、pending 和状态哈希，不静默重写身份或历史。

回滚仍须保留数据库 v2、V5/CV4 与关系记录的兼容读取器。存档损坏或空间不足时，请保留原档并先导出可恢复进度。

## 开发与构建

Node.js >=22，项目使用 Node 24。Playwright、Miniflare 与 Acorn 是开发依赖，浏览器发行包不依赖它们运行。

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run dev
npm run release
```

`npm run release` 依次执行测试、语法检查和浏览器构建，并重建 `release/`。后端必须在它之后打包：

```bash
SOURCE_COMMIT=完整40位源码提交 npm run build:gateway
```

| 产物 | 用途 |
| --- | --- |
| `dist/` | 静态站点 |
| `release/baishi-wending-offline.html` | 单文件离线游戏 |
| `release/release.json` | 版本、字节数与摘要 |
| `release/gateway.mjs` | 静态发行网关 |
| `release/backend/` | 完整 ESM 后端与模块清单；默认命令生成关闭推理的包 |

正式 AI 后端需要显式生产策略、已验证模型和实际账户证明。GitHub main 的自动发行只发布 HTML；Cloudflare 后端部署是单独步骤，详见[部署说明](docs/DEPLOYMENT.md)。实际页面版本和来源以 [`/healthz`](https://baishi-wending.ct1150.workers.dev/healthz) 为准。

旧模式的构建前模型创作工具继续可用，见[剧情创作指南](docs/STORY_AUTHORING.md)；它与玩家在实时模式中的联网生成是两条独立流程。

## 代码入口

- `src/game/cultivation/live/`：实时规则、记忆、存档与恢复。
- `src/worker/`：同源剧情 API、模型适配、共享协调存储与生产构建合同。
- `src/game/cultivation/v3/`：原有三界求仙篇；旧版本引擎继续保留。
- `src/app.js`、`src/ui/journey.js`：模式入口、当前剧情与等待恢复。
- `scripts/build-gateway.js`、`scripts/publish-release.js`：后端打包与静态发行。

[4.1.0 完成计划](docs/superpowers/plans/2026-10-28-complete-realtime-release.md) · [实时运行合同](docs/WORKERS_AI_RUNTIME.md) · [4.0 及更早 README](https://github.com/ct1150/wending/blob/fbb4bbf408f448b745642ed3b81c471e9816bf71/README.md)
