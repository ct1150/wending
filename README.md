# 百世问鼎 · 三界求仙篇

**4.5.0：正文、对白和选项连续流式展示。** 同一次 AI 请求生成眼前剧情与具体选择；生成过程中和完成后使用相同的段落、人物对白及选项样式，选项随模型逐步补全，完整校验并保存后开放点击。减少重复生成说明和零成本提示，保留有实际影响的成本、风险及恢复入口。

[线上游戏](https://wending.868656.xyz/) · [交付账本](docs/ROADMAP.md) · [验收证据](docs/QA_REPORT.md) · [部署说明](docs/DEPLOYMENT.md)

## 开始游玩

首页固定显示三个入口：**「踏入仙途 / 续写此生 / 游戏设置」**。读取首页不会创建人物、掷骰或请求新剧情。

- **踏入仙途**：为新人物取名并选择来处，默认开启实时人生。已有角色仍活着时也可另开独立旅程；原旅程保留，可在「切换存档」中找回，新开不会替旧角色结算或发放轮回奖励。
- **续写此生**：继续上次选择的旅程，首页展示人物与进度摘要；没有存档时说明原因并禁用。旧离线人生依原规则恢复，已保存的实时旅程也可切换继续。
- **游戏设置**：调整画面主题（跟随系统／纸白／夜读）和正文字号（标准／较大），管理存档的导入、导出与切换。导入需要明确确认，并先保留原有旅程或可恢复的原始数据；保存失败时不会直接覆盖原档。

剧情下方直接显示 **「历史对话 · 游戏设置 · 返回首页」**；顶部保留人物概况与详情入口。重新打开页面先到首页，同一标签页内刷新则恢复所在页面、创建草稿或当前剧情。自然死亡后的「再入轮回」沿用真实结算，再回到人物创建。

本版本继续使用 Cloudflare Workers AI 的 `@cf/zai-org/glm-4.7-flash`，仅通过原 AI binding 调用，不读取智谱密钥，不接入付费后备。新剧情需要联网，玩家无需提供 API 密钥。模型根据当前事件、已发生的决定和规则收据生成不同应对，并提供具体的拒绝、结束互动或脱险路径；后端不会用通用观察/退出菜单替换现代生成场景的选项。无法通过校验的回应保留待续进度并提供重试，不能执行尚未完成的选择。

本轮范围与验证见[连续流式体验方案](docs/superpowers/specs/2026-10-31-consistent-story-stream-design.md)。真实模型仍可能给出不合理的叙事或选择，生成延迟取决于服务；流式选项改善阅读等待，不能保证每轮内容质量或固定完成时间。4.4.0 的[直接发布授权与未完成验收](docs/evidence/story-coherence-2026-10-30/direct-release-2026-10-31.json)、此前[失败记录](docs/evidence/story-coherence-2026-10-30/release-blocked-2026-10-31.json)及[4.3 历史验收](docs/evidence/cf-glm-promotion-final-2026-10-30.json)保留。

## 4.2.0 验证记录 — 2026-10-29（上海）

本轮已实现水墨标题页、显式创建与继续、独立旅程目录、可见剧情导航、阅读设置和存档恢复入口。[确认设计](docs/superpowers/specs/2026-10-29-title-screen-design.md)记录了入口与旧档保护要求。

最终发布候选的 `npm run release` 为 **859/859 测试通过、162 个 JavaScript 文件语法检查通过，单文件离线版构建为 1,025,064 字节**，失败、取消和跳过均为 0。独立审查发现的旧标签续接对象错误、损坏离线目录缺少恢复入口均已通过失败→修复→通过的回归验证；离线双标签测试改为等待真实存储同步，并保留防覆盖断言。详细[候选报告](docs/evidence/title-screen-4.2.0/release-candidate.json)与[完整日志](docs/evidence/title-screen-4.2.0/final-release.log)已归档；精确提交 CI、合并、静态清单与生产现场结果统一记录在 [PR #15](https://github.com/ct1150/wending/pull/15)。

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

实时数据库为 `wending-live-v1`、结构版本 3。旅程目录分页展示已保存人生，切换旅程保留各自的完整历史、待续事务与随机状态；新增剧情进行中不切档，也不会因切档自动重试。首次请求前保存不可变的生成上下文和能力模式；恢复时先查询并沿用原 attempt，只有服务端明确确认缓存已不存在才创建后继 attempt。带生成上下文的备份使用格式 2，原格式 1 仍可读取。出生和待续事务先保存；读取、写入或导入失败时保留现有档案。带 `relationshipVersion:1` 的新档保存累计关系，旧的未标记 V5 档保留原历史、pending 和状态哈希，不静默重写身份或历史。

回滚仍须保留数据库 v3、V5/CV4 与关系记录的兼容读取器。存档损坏或空间不足时，请保留原档并先导出可恢复进度。

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
- `src/app.js`、`src/ui/title-screen.js`、`src/ui/navigation.js`：首页、路由、阅读偏好与旅程接线。
- `src/ui/journey.js`、`src/game/journey-saves.js`：当前剧情、历史与离线旅程保留／恢复。
- `scripts/build-gateway.js`、`scripts/publish-release.js`：后端打包与静态发行。

[4.1.0 完成计划](docs/superpowers/plans/2026-10-28-complete-realtime-release.md) · [实时运行合同](docs/WORKERS_AI_RUNTIME.md) · [4.0 及更早 README](https://github.com/ct1150/wending/blob/fbb4bbf408f448b745642ed3b81c471e9816bf71/README.md)
