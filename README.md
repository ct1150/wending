# 百世问鼎 · 三界求仙篇

**4.0.0：四种来处、双重命格，从凡人一步步修行至三界问鼎。** 为此身取名，选择山村、城坊、渡口或流亡中的人生，在学艺、历险与结缘中争取自己的路。

- [线上游戏](https://baishi-wending.ct1150.workers.dev/)
- [待办与交付账本](docs/ROADMAP.md) · [玩法规格](docs/PRODUCT_SPEC.md) · [验收证据](docs/QA_REPORT.md) · [部署记录](docs/DEPLOYMENT.md)
- 当前4.0使用原生 JavaScript，浏览器本地运行，无账号、游戏后端和运行时外部依赖，存档不会上传。

## 下一阶段：选择驱动的实时人生（本地实现，尚未启用）

取消“每世20—30分钟”目标。新模式将根据肉鸽选择，通过 Cloudflare Workers AI 在免费额度内实时生成剧情；登仙、问鼎只是阶段，人物仍活着就继续，实际死亡才结算。不设固定章节数或通关步数。选择的时间、资源、风险与死亡由规则结算，模型生成事件、对话和行动提案。

这轮已实现独立V5/CV4规则、剧情契约、同源API、长期档案与实时界面，并完成受控后端打包和本地workerd/SQLite检查；**真实Workers AI、严格免费账号边界与生产闭环尚未验收，生产推理保持关闭**。1000回合原生档案fixture及本地完整release已通过；整分支审查和最终提交CI仍待完成，详见 [当前路线图](docs/ROADMAP.md) 与 [实施计划](docs/superpowers/plans/2026-10-27-realtime-workers-ai.md)。免费额度耗尽时保存进度、暂停生成，不自动付费；完整历史使用分页档案。新模式需要发送最小剧情上下文到Cloudflare，旧4.0离线玩法继续保留。下文描述当前可玩的4.0。

本地完整验证在 `4e44811` 通过510项测试、117个JS语法检查，构建964968字节离线HTML；这不是最新提交CI或上线证明。[草稿PR #14](https://github.com/ct1150/wending/pull/14) 尚未合并或部署。真实AI调用0，实测Neurons为null（未测），不将fixture的1000回合解释为免费模型容量或叙事质量。

## 开始游玩

新玩家先取名、选择出身，查看随机掷出的两道命格。可以锁定其中一道，再掷另一道与资质；三项资质各 1—6 点，总计 12 点。命签会自动保存，刷新不会重掷。准备好后按「就以此身，入世」。

已有存档继续原来的人生。体验新版前，可在「更多 → 存档与设置」导出备份，再选择「开始三界求仙篇」并确认。之后仍可导入备份，回到原来的故事。

## 修行与取舍

- **不同的来处：** 山村猎户、城坊匠徒、渡口短工、流亡孤儿各有四段开场；亲立幽冥渡约后，下一世还能选择第五种出身「前尘行者」。
- **两道命格：** 六项初始命格与两项前世解锁命格，都有入世后前十次剧情选择内可遇到的专属机会。四组特定组合拥有不同遭遇与收获，也可能耗时、受伤或折寿；三项资质达到条件时另有实际行动。
- **长路有变化：** 114 个可达选择场景，涵盖宗门、散修、同盟，以及遗址、异兽、海域。与谢衡争取金丹灵髓、面对幽冥缚魂者、接受天界剑阵试炼，最后与殷无咎争鼎；关键时刻可退、可担代价，也可能陨落。
- **逐级修行：** 凡人、炼气、筑基、金丹、元婴、化神、登仙，六次突破都要亲自取得材料、积累修为并支付真实年月，伤势也须满足要求。登仙、三项道证与鼎前约战共同构成最后的问鼎条件。
- **专注眼前：** 当前页展示最新后果、眼前剧情和通常 2—3 项选择。固定简栏可展开人物；完整正文与前世往事保存在「历史对话」。
- **再续一世：** 世界记得你做过的事。归宿结算后，最多携一项真正学成的方法重新求仙，下一世不重复上一世完整际遇组合。

4.0正常完整路线的自动实走为68次选择；114个选择场景另加一个结算场景，不把命运组合排列或结算页算作额外剧情。这些是旧模式的覆盖证据；固定20—30分钟目标已取消，新模式按持续因果、真实死亡和可靠恢复验收。

## 开发与离线版

Node.js >=22，项目使用 Node 24。开发依赖固定版本的Playwright、Miniflare与构建解析器Acorn，仅用于构建与验收；浏览器发行包没有这些运行时依赖。

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run dev
npm run release
```

开发地址由终端显示，默认端口 5173，可通过 `PORT=8080 npm run dev` 改变。`npm run release` 顺序执行行为测试、语法检查和构建。

| 输出 | 用途 |
| --- | --- |
| `dist/` | 静态站点 |
| `release/baishi-wending-offline.html` | 含脚本、样式、图片的单文件离线游戏 |
| `release/release.json` | 版本、构建时间、字节数与 SHA-256 |
| `release/gateway.mjs` | 原单模块静态网关；保留旧上传/回退合同，不含实时API |
| `release/backend/` | `build:gateway` 在浏览器构建后生成的完整ESM后端及模块摘要清单；默认关闭推理 |
| `wrangler.story.json` | 单独审查的后端入口、AI与SQLite DO绑定/首次迁移配置；CI不执行部署 |

网页中可下载离线版。在线和离线存储相互独立，迁移进度时请同时导出、导入存档。静态开发服务器、file页面、旧网关、协议不兼容或服务暂停时均不能开始联网生成；保留兼容档案读取器的前端可读取和导出已有实时历史。

`npm run release` 会重建并清空 `release/`，后端须随后执行 `SOURCE_COMMIT=完整40位提交 npm run build:gateway`。它只生成产物，不访问Cloudflare。受控部署顺序与尚未解除的免费门禁见 [部署说明](docs/DEPLOYMENT.md)。

## 存档兼容

实时模式独立使用 `version:5 / mode:cultivation / contentVersion:4`、IndexedDB和流式 `.wending.jsonl` 档案，按128回合或256KiB封块；旧1M总量限制不作为新人生终点。出生与待续事务先保存，失败暂停，明确重试仅创建新的调用attempt，不重复结算选择。

实时档案数据库名仍为 `wending-live-v1`，数据库结构版本已升至2，新增检索索引并保留原有数据。**回滚须保留兼容数据库v2的读取器**；明确打开数据库v1的旧V5前端不能读取已升级的数据库。游戏档案版本仍为V5，旧v1—v4 localStorage存档不受此升级影响。

已上线4.0为 JSON `version:4 / contentVersion:3`，存储键仍是 `baishi-wending-save-v1`。CV1/CV2 与 v1/v2/v3 旧人生继续原规则，只有明确新开局才进入新版。

损坏 JSON、无效存档和读取失败不会被新人生覆盖；保存失败时仍可导出内存进度。总量上限 1,000,000 个 JavaScript 字符，超限行动不提交、不扣费、不推进随机，也不截断已有历史。

## 免费模型辅助创作

模型是作者的可选工具，玩家无需模型、联网或 API 密钥。默认使用本地 Ollama，也支持作者明确配置的本地或外部 OpenAI 兼容服务；外部服务的收费取决于所选提供方。创作流程是：

```bash
npm run story:author -- brief
npm run story:author -- generate --id arrival.atmosphere --out /tmp/candidate.json
npm run story:author -- preview /tmp/candidate.json
npm run story:author -- accept /tmp/candidate.json
npm run build
```

模型仅提供稳定位置的候选文字，不修改规则。实际运行与审核证据、配置说明见 [剧情创作指南](docs/STORY_AUTHORING.md)。

## 自动发行

仓库已配置 main 通过 GitHub Actions 全部验证后，使用仓库自己的 `GITHUB_TOKEN` 发布不可变游戏包与清单到 `release-channel`；只有发行任务获得写权限。现有 Cloudflare 发行网关会校验来源与摘要再切换，下载失败或清单无效时保留已验证版本。活动实例按请求检查，间隔至少 60 秒，不承诺全球同时刷新。

网关程序自身变更需 `SOURCE_COMMIT=真实完整提交SHA npm run build:gateway` 并部署到现有 Worker。之后普通游戏与剧情变更可通过 main 自动发行。本轮已实际验证 main→发行清单→网关读取→4.0 页面切换，最终 GitHub 检查361/361通过；线上完整通关、存档与离线验收已完成。线上实际版本、来源和摘要以 [`/healthz`](https://baishi-wending.ct1150.workers.dev/healthz) 为准；本轮验收记录见 [部署记录](docs/DEPLOYMENT.md)。

## 代码入口

- `src/game/cultivation/v3/`：新版命签、三界内容、时间/突破规则与严格存档校验。
- `src/game/cultivation/legacy-*.js`：CV1/CV2 原规则；旧 v1/v2/v3 模块继续保留。
- `src/ui/character.js`、`journey.js`、`paper.css`：命签、固定身份栏、当前剧情与历史抽屉。
- `scripts/story-author.js`：本地剧情创作；`scripts/publish-release.js`：已验证构建发行。
- `src/worker/release-gateway.js`：发行网关的游戏包验证与回退。

[新版引擎契约](docs/ENGINE_CONTRACT_CV3.md) · [设计与实施计划](docs/superpowers/plans/2026-10-27-roadmap-completion.md)。
