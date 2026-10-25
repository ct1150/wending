# GitHub → Cloudflare 部署

文档更新：2026-10-25（上海）。当前远端配置与部署核实记录日期：2026-10-24。1.1.0仍为本地候选；本页没有将本地构建写成已经上线。

## 当前生产：旧版源码与发行方式

源代码位于 [ct1150/wending](https://github.com/ct1150/wending) 的 `main` 分支。**Cloudflare API MCP 已实际发布 Worker `baishi-wending`**，生产地址为 [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/)。当前是普通 Worker 返回内嵌离线 HTML 的发行方式，尚未使用 `dist/` 的 Static Assets 路由。原有 `wrangler.jsonc` 保留作后续 Static Assets 迁移使用。

当前线上发行源码提交为 [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9)；[对应 GitHub Actions](https://github.com/ct1150/wending/actions/runs/40053805256) 已成功，48 个测试、15 个 JavaScript 文件语法检查和构建全部通过。后续仅修改文档的提交不会改动此线上发行标识。

**GitHub → Cloudflare 自动发布仍未配置。** 最近只读核实中，此Worker的原生Builds配置查询为 `404 / 12040`（No build configuration associated with that script tag），triggers为空，builds为空且total_count=0。最新观察的 [GitHub Actions 40054261258](https://github.com/ct1150/wending/actions/runs/40054261258) 在main提交 `e719b569deeb5010d4977c799b434b60d640223a` 验证成功、deploy跳过，不能据此说main已上线。

首发时连接仓库曾返回 `404 / 8000008 Git account disconnected`，当时无build token。这是历史失败记录；本轮没有重做会修改连接的PUT，repo autofill的404也不足以证明GitHub App现在仍未安装。当前可证明的是此Worker没有自动构建配置，不能声称App从未安装。成功生产发行来自Cloudflare API MCP。

| 项目 | 当前结果 |
| --- | --- |
| 生产 URL | [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/) |
| Cloudflare 发行方式 | 普通 Worker 内嵌 HTML，由 `fetch` 返回页面 |
| Worker 名称／账号子域 | `baishi-wending` / `ct1150` |
| Worker tag | `d4ceaa79ca7d4ca48954b1117458297f` |
| Deployment ID | `48af217d-8b0f-428a-94ab-d868fdf55ca3` |
| Worker version ID／流量 | `f9dd9fc8-df55-437e-8123-bbca3e119a59`／100% |
| 部署创建时间 | `2026-10-24T02:21:43.28736Z`，上海时间 2026-10-24 10:21:43 |
| workers.dev | 已启用；preview URL 未启用 |
| HTML 大小／SHA-256 | 185751 字节 / `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63` |
| 游戏运行服务 | 不需要游戏后端、数据库或玩家账号 |

当前页面请求执行普通 Worker，**计入 Workers 请求额度**；具体限额与收费以目标账号套餐为准，不能沿用 Static Assets 免费资源请求的描述。官方参考：[Workers 计费](https://developers.cloudflare.com/workers/platform/pricing/)（查阅：2026-10-24）。

## 1.1.0候选与本轮正式发行门槛

1.1.0已在本地完成叙事引擎／UI与对应检查，详细本地行为、浏览器和离线证据见 [QA记录](QA_REPORT.md)。候选312059字节离线HTML的SHA-256为 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`，release.json版本1.1.0。它不是上表生产文件的哈希；尚未取得1.1.0实际生产deployment、version或GitHub CI成功证据。

最终修复轮的82项行为、8个测试文件、20JS语法检查、离线文件首选项／刷新，以及本地焦点／截止／短战／旅行／旧存档路径已通过；五项评审发现的具体修复与边界见QA。候选尚待限定复核；提交后本地Worker一致性记录仅证明本地打包，不能替代真实GitHubSHA的重新打包和公网验收。

本轮由控制方完成：

1. 发布可审查GitHub分支／PR，核对当时main并完成整分支评审及CI；本地synthetic snapshot基线不冒充上游提交。
2. 从实际GitHub发行完整SHA执行 `npm run release`，之后 `npm run build:worker -- --source-commit <实际40位SHA>`；核对离线大小／哈希和Worker本地health的sourceCommit。正常build会重建release，所以Worker打包最后执行。
3. 沿用已授权的标准API multipart模块上传，更新**已有** `baishi-wending`，不新建Worker、不执行Wrangler／Static Assets迁移、不更改自动发布设置。
4. 上传后读取实际deployments，分别记录deployment ID与100% version ID；访问生产 `/healthz`，核对实际GitHubSHA及同一离线哈希。
5. 实际公网打开新游戏剧情，完成一个选项、刷新恢复，并核对下载与窄屏；再将观察到的结果写回文档。CI成功、API上传成功和页面可玩是三个不同门槛。

本地打包的sourceCommit只证明指定候选的元数据，不证明该SHA已在GitHub或生产存在。发布后若有仅文档的审计提交，生产health继续指向真正构建／上传的源码SHA，不能随文档HEAD自行改写。

## 当前 Worker 发行模块的打包与发布（首发示例）

常规构建后，将已验收离线 HTML 和 `assets/seal.svg` 打包为 `release/worker.mjs`：

```sh
npm run release
npm run build:worker -- --source-commit 355f7956a4c31d9e3a19f1f567c4b1146942a5e9
```

`SOURCE_COMMIT` 环境变量也受支持，必须是完整 40 位 Git SHA。`build:worker` 应放在常规构建之后，因为正常 `build` 会重建整个 `release/`。CI 自动用 `github.sha` 提供该值，并在 Actions 构建产物中保存 `dist/`、离线 HTML、`release.json` 及 `worker.mjs`。产物保留期限为工作流配置的 14 天。

发行模块内嵌原离线 HTML，正文保持逐字一致。`GET` / `HEAD` 支持 `/`、`/index.html`、`/baishi-wending-offline.html`、`/favicon.svg`、`/favicon.ico` 和 `/healthz`；下载路径提供附件文件名。其他路径为 404，其他方法为 405，HEAD 无响应正文。`/healthz` 返回源码提交和 HTML SHA-256，不包含凭据。

首次已通过 Cloudflare API MCP 的标准 Worker multipart 上传接口实际发布：`PUT /accounts/{account_id}/workers/scripts/baishi-wending`，metadata 指定 ESM 入口与兼容日期，模块正文来自上述构建产物。该步骤使用当前已授权的 Cloudflare 连接；凭据未写入源码。上线结果见本页证据表。此为手动发行，源码继续保留于 GitHub。

## 未来 Static Assets 迁移与自动发布

`wrangler.jsonc` 仍指向 `assets.directory: "./dist"`，`workers_dev: true`，HTML 使用 `auto-trailing-slash`，找不到资源时返回 404。后续执行 Wrangler 或启用下述两条发布路径，将把同名 Worker 迁移为 Static Assets 发行模式，应在完整构建后执行并重新验收。不要将当前内嵌 HTML 发行模块与尚未接通的原生 Git 构建混为一谈。

Workers 支持直接托管静态资源；Cloudflare Pages 使用独立项目与部署命令。本项目保留 Workers Static Assets 迁移配置，不切换至其他服务。官方参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[静态站点入门](https://developers.cloudflare.com/workers/static-assets/get-started/)（查阅：2026-10-24）。

## 未来方式 A：Cloudflare 原生 GitHub 集成（推荐）

一次性连接步骤：

1. 在当前 Cloudflare 账号的 **Workers & Pages** 选择已有 Worker **`baishi-wending`**，进入 **Settings → Builds → Connect → GitHub**；无需另建同名或无关 Worker。
2. 连接 GitHub，选择 **`ct1150/wending`**。首次如需授权，安装 **Cloudflare Workers and Pages** GitHub App，并只选择此仓库；这与 ChatGPT 的 GitHub 插件授权独立。
3. 按下表设置。Worker 名称必须为 **`baishi-wending`**，与仓库 `wrangler.jsonc.name` 一致；不要沿用仓库名 `wending`。然后选择 **Deploy**。
4. 等待 Cloudflare 生产部署成功，复制实际提供的完整 `workers.dev` URL，再执行本页的上线验证。后续 `main` 推送由 Cloudflare 自动构建与发布。

| 设置 | 值 |
| --- | --- |
| Worker 名称 | `baishi-wending` |
| GitHub 仓库 | `ct1150/wending` |
| 生产分支 | `main` |
| 根目录 | 留空／仓库根目录；不要填写 `baishi-wending` |
| 构建命令 | `npm run release` |
| 部署命令 | `npx wrangler deploy` |
| Node.js | 自动读取仓库 `.node-version` 的 `24`；无需额外设置 |
| 构建 Token | 使用 Cloudflare 默认创建的 Token；无需在 GitHub 配置 Cloudflare secrets |
| 静态资源 | 由仓库 `wrangler.jsonc` 的 `assets.directory` 指向 `./dist` |

选用此方式时，让 GitHub Actions 保持验证功能，并保持 `ENABLE_CF_DEPLOY` 未启用，避免两个生产发布流程同时部署同一提交。Cloudflare 原生 Git 集成的发布开关与权限独立于仓库变量；上述变量只控制本仓库的 GitHub Actions。Cloudflare 构建必须执行 `npm run release`，这样测试失败就不会继续部署。

Cloudflare 官方支持读取 `.node-version`，并为 Workers Builds 自动创建构建 Token。参考：[构建镜像与 Node 版本](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)、[Worker 名称要求](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement)。

官方说明：[Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Workers GitHub 集成](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)（查阅：2026-10-24）。

## 未来方式 B：GitHub Actions 发布（备选）

工作流文件：`.github/workflows/validate-deploy.yml`。

1. 本项目已推送到 `ct1150/wending` 的 `main`。只有改用此发布方式时，才继续配置以下凭据和开关。
2. 在 Cloudflare 确认目标账号和 Worker 名称，准备该账号的 Account ID 与具备所需 Workers 编辑权限的 API Token。账号范围应限制为实际目标账号；不要将 Token 写入源文件、文档、日志或聊天。
3. 在 GitHub 仓库设置的 Actions secrets 或 `production` environment secrets 中添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
4. 在仓库 Actions variables 中设置 `ENABLE_CF_DEPLOY` 为字符串 `true`。
5. 推送至 `main`，或在 `main` 上手动运行工作流。先验证，再部署。若仓库已有生产环境审批规则，遵循该规则。
6. 查看 GitHub Actions 中 Wrangler 的成功结果和真实 URL，再访问站点验证资源、开局、存档和离线下载，最后填写本页的实际发布记录。

`validate` 任务会运行 `npm run release` 并上传 `dist/` 与 `release/` 作为构建产物。`deploy` 依赖验证成功，仅在 `main` 的非 PR 事件且显式启用时运行；它从同一提交重建静态输出，然后调用官方 `cloudflare/wrangler-action@v4`。开发与验证没有 npm 依赖安装步骤，发布动作会取得 Wrangler 4。工作流使用官方 GitHub `checkout@v6`、`setup-node@v6` 与 `upload-artifact@v7`，自动 npm 缓存关闭。

若 `ENABLE_CF_DEPLOY` 不是 `true`，验证仍照常完成，摘要明确说明没有发布。若已启用但凭据缺失，发布任务在调用 Cloudflare 之前失败并说明缺少配置。若认证、权限或资源上传失败，必须以失败结果报告，不得把 `validate` 的成功称为上线成功。

Cloudflare 的非交互 CI 部署需要 API Token 与 Account ID。官方说明：[GitHub Actions 部署](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)、[Wrangler Action](https://github.com/cloudflare/wrangler-action)。GitHub 动作版本参考：[Checkout](https://github.com/actions/checkout)、[Setup Node v6](https://github.com/actions/setup-node/releases/tag/v6.0.0)、[Upload Artifact v7](https://github.com/actions/upload-artifact/releases/tag/v7.0.0)（查阅：2026-10-24）。

## 本地构建与单文件离线版

```sh
npm run release
```

`dist/` 只复制 `index.html`、`src/`、`assets/` 与生成的离线 HTML，不上传仓库文档、测试或本地凭据。资源使用相对路径，支持站点根目录或静态子目录托管。`.nojekyll` 是兼容其他静态主机的空文件，不代表使用 GitHub Pages 发布。

离线构建将入口依赖按拓扑顺序封装成相互隔离的函数作用域，内嵌 CSS，并将本地 SVG 与 CSS 资源转为 data URL。它是为本项目设计的小型工具，不是通用 JavaScript 打包器：支持带分号的相对路径静态 named imports、命名 `const`／函数／类导出及命名导出列表；不支持默认、星号、命名空间、仅副作用导入、动态导入、`import.meta`、顶层 `await`、循环依赖或可变 `let`／`var` 导出。所有导入绑定应指向初始化后不重新赋值的导出；对象内部数据可正常使用。引入新语法时应先扩展构建器与测试。缺失导出、受支持边界之外的模块形式和越界本地资源路径会明确报错。

`release/release.json` 记录版本、UTC 构建时间、离线文件字节数和 SHA-256。同一源码重复构建的离线 HTML 应一致；元数据中的构建时间会随构建变化。离线版没有 ES 模块或外部样式请求，可以直接打开；其自动存储受浏览器对本地文件的策略影响，存档导出／导入是跨浏览器、跨域名和线上／离线迁移的方式。

## 发布后的最小验证

- 从真实 HTTPS URL 打开页面，确认图像、样式和全部模块成功加载。
- 新建角色，执行修炼、历练和一个事件选项；刷新后确认进度恢复。
- 在移动宽度验证操作按钮、文本与页面宽度。
- 访问不存在的资源，确认 404 而非返回 HTML。
- 下载并打开 `baishi-wending-offline.html`，确认可开局与操作。
- 记录提交、运行链接、最终 URL、验证日期与结论。自定义域名配置完成前，只报告已经验证的 `workers.dev` URL。

## 首版GitHub验证与当前生产证据

| 证据 | 首版记录／当前生产依据 |
| --- | --- |
| 源码仓库 | [ct1150/wending](https://github.com/ct1150/wending)，公开仓库，`main` |
| 当前发行源码提交 | [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9) |
| 当前生产源码对应CI | [40053805256](https://github.com/ct1150/wending/actions/runs/40053805256)：`success`，48 个测试通过、15 个 JS 文件语法检查通过 |
| 当前生产源码的历史CI产物 | [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440)，压缩包 247611 字节，含静态站点、离线 HTML 与 189712 字节 `release/worker.mjs` |
| 首次游戏源码与历史 CI | [`6698dbb`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c) / [40050257913](https://github.com/ct1150/wending/actions/runs/40050257913)，历史 46 测试通过 |
| Cloudflare 实际发布 | API MCP标准Worker上传成功；deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3`，100% version `f9dd9fc8-df55-437e-8123-bbca3e119a59` |
| 生产 URL | [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/) |
| 真实浏览器已验证 | 开局、修炼、探索事件、选择结果、刷新存档与日志恢复、healthz、离线下载哈希、移动布局 |
| 线上健康接口 | 浏览器返回 `status: ok`、上述源码提交及 HTML SHA-256 |
| 真实下载 | 从游戏设置点“下载游戏”取得 185751 字节文件，SHA-256 与构建产物完全一致 |
| 移动端 | 390px iframe 载入真实公网游戏，可用宽 375 CSS px；html/body 的 scrollWidth = clientWidth = 375，顶部修为和底部五项导航可见 |
| 其余协议边界 | 公网 HEAD／404／405 尚未取得线上响应证据；本地 Worker handler 测试已覆盖且通过 |
| GitHub自动发布 | 此Worker无原生Builds配置404／12040、无triggers／builds；最近观察CI deploy跳过；不推断App安装状态 |

真实浏览器验收记录：创建“云归”时 16 岁；修炼后 19 岁、13 修为、81 余寿、29 灵石；探索至 21 岁遇到“渡口最后一船”，选择“帮他装船”后 22 岁、78 余寿、41 灵石。刷新后上述数值和日志恢复。

公网页面 GET、healthz、实际下载及移动端均已有真实浏览器证据。本执行环境的脚本请求得到过 403，未反复重试；该通路结果不能代替浏览器成功结果或用于推断全站故障。只有公网 HEAD／404／405 仍缺少独立线上证据，本地测试不作替代。
