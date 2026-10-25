# GitHub → Cloudflare 部署

文档更新：2026-10-25（上海）。**2.0.0 为本地发行候选，尚未发布；当前生产仍为 1.2.0。** 下列旧生产证据保留其版本与日期，不用于证明新旅程验收；自动发布配置的只读记录仍为 2026-10-24 观测。

## 2.0.0 候选与控制方发行门禁

本地实现含完整药谷、幽冥、天界、问鼎与轮回／旧档交接。发行准备只完成源码、测试、离线构建与真实文档；精确本地产物见 [QA](QA_REPORT.md)。本轮没有远端修改、浏览器、localhost/headless/CDP 或替代预览。

| 2.0.0 证据 | 当前状态 |
| --- | --- |
| 本地候选与验证 | 见 QA 当前候选记录；不是已上线源码 |
| 独立整分支复核 | 控制方待完成 |
| 真实远端树、PR、CI、合并 SHA | 控制方待取得并记录；不借用旧 PR／CI |
| 实际合并源码构建的 Worker／部署 ID／version ID | 待完成；未生成替代生产标识 |
| 生产 health、源码 SHA、实际版本、下载大小／hash | 待完成；以下 1.2.0 数据仍是生产记录 |
| 新阅读流实际 UI、320px／浅深色、键盘焦点 | 待获准生产观察；Node harness 不作为视觉验收 |
| 真人 20–30 分钟、寿元压力、物理手机、读屏 | 未测 |

控制方发布顺序：

1. 读取当时 GitHub 实际 `main` 与 tree；本地历史是合成快照，**禁止直接 push 本地分支**。已记录的远端基线会过时，发行时必须重新读取。
2. 用 Git Data API 以真实远端父提交重建审阅后的变更，排除 `.superpowers/` 等内部资料，比较精确文件树；走独立 PR、CI 与合并。
3. 从真实合并后的运行时代码 SHA 检出并重新运行 `npm run release`，再执行 `npm run build:worker -- --source-commit ACTUAL_MERGED_40_CHARACTER_SHA`（占位值换为完整真实 SHA）。本地准备产物不冒充此步骤。
4. 通过已有授权更新现有 `baishi-wending` 普通 Worker；沿用账号、tag、兼容日期与发布方式，不配置自动发布或迁移托管。分别记录真实 deployment ID、version ID、流量、UTC 时间及发行版本。
5. 核对生产 health 源码 SHA／HTML hash、实际页面版本与游戏内下载的字节／hash；完成获准环境 UI 验收，再将本文生产表更新为 2.0.0。失败保留候选并报告，不称上线。

部署前控制方已从现有 **1.2.0** 实际生产 UI 导出一次备份；这是保护旧进度的观察，不是 2.0.0 导出／恢复验收。私人原始存档不进入源码树。


## 当前生产：1.2.0 纸页界面

[线上游戏](https://baishi-wending.ct1150.workers.dev/) 已运行 **1.2.0 Paper**。实际发行源码为 [`90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`](https://github.com/ct1150/wending/commit/90bb910840e7c2b22c59e0421f111c4c1a7cb7c8)，[PR #2](https://github.com/ct1150/wending/pull/2) 已合并。发行 tree `ec460fa26506ce0946a0a5edf9f5222ed5e8ab65` 与已评审本地 `0d015eb82554c840a9bbcfd774a07d4f57dc25ba` 的 tree 相同；本地合成 git 历史未直接推送。

[PR CI 40163973639](https://github.com/ct1150/wending/actions/runs/40163973639) 与 [main CI 40164006388](https://github.com/ct1150/wending/actions/runs/40164006388) 均为 success；validate job `121081217915` success，deploy job `121081258031` skipped。实际部署由 API 手动上传现有普通 Worker 完成，GitHub → Cloudflare 自动发布未启用，也没有迁移 Static Assets。最终本地 `npm run release` 已通过 11/11 个测试文件和 25 个 JavaScript 语法检查；该1.2.0历史文档审计未重跑构建或测试；2.0.0候选的新门禁见QA。

| 项目 | 当前 1.2.0 实际结果 |
| --- | --- |
| 生产 URL | [baishi-wending.ct1150.workers.dev](https://baishi-wending.ct1150.workers.dev/) |
| 发行方式 | 现有普通 Worker 内嵌离线 HTML，通过 API 手动上传 |
| Worker 名称／tag | `baishi-wending` / `d4ceaa79ca7d4ca48954b1117458297f` |
| 实际 Deployment ID | `e890d80a-dbda-475b-a1c9-c32589b29803` |
| Worker version ID／流量 | `1c5deb80-2930-4a53-9c8c-956fe7c712e3` / 100% |
| 部署创建 UTC | `2026-10-25T05:02:16.128157Z` |
| HTML 大小／SHA-256 | 322726 字节 / `709ee3db3d1378f2b954c17de3e513ec56a6648f5ebe0ec1ac63288b751ba3d7` |
| Worker 模块大小 | 328691 字节 |
| 本地精确源码 handler 检查时间 | `2026-10-25T05:01:40.998Z`；检查时间，不是构建时间 |
| 保持不变的配置 | compatibility date `2026-10-24`，usage model `standard`，bindings 0 |
| 生产 health | [healthz](https://baishi-wending.ct1150.workers.dev/healthz) 实际返回 status ok、上述发行源码与 HTML 哈希 |
| 实际游戏内下载 | 经设置下载 322726 字节，与精确源码 HTML 逐字相同且 SHA-256 一致 |

Deployment ID 以上述 deployments endpoint 的记录为准；上传响应中名为 `deployment_id` 的字段实际上是无连字符的 version ID，不可将两者混用。当前仍由普通 Worker 返回 HTML，计入 Workers 请求额度；`wrangler.jsonc` 的 Static Assets 配置供未来迁移。

### 1.2.0 生产 UI 验收与限制

实际浏览器恢复先前 1.1.0 的 YG02“不肯烧掉的药簿”存档：云归／剑修、16 岁、余寿 84、气血 120/120、灵石 24、药材 3、距封谷 8 年及上次选择均保留。键盘 Enter 选择“答应先查真相，再谈灵种”进入 YG03，药材 +2；再“申请公开查档”到“灯下选下一条路”，灵石 24→16、药材 5。展开状态与修行后，键盘 Enter 闭关经过 3 年，得到年龄 19、余寿 81、修为 13/36、灵石 21、药材 5、距封谷 5 年；最新结果为“闭关修行”，焦点落在 `story-result-title`，两个辅助区在重绘后仍展开。

刷新保留完整 `main-content.textContent`，辅助区在重载后自然折叠；设置返回聚焦 `story-scene-title`。帮助打开原生 dialog 并聚焦关闭，Escape 返回帮助按钮，实际帮助目标为 44×44px。实际 viewport 1363×936，pageWidth 1348，此桌面视口无横向溢出，浅色 body 背景 `rgb(250, 248, 242)`。已观察日志只有 chrome-extension metadata 错误，没有应用 warn/error；不宣称完整捕获所有 pageerror。

未测 320px 与深色实际外观、真实手机、辅助技术／读屏、真人 20–30 分钟节奏、全部结局生产全通。此次未重置全新首世浏览器会话，Node 的 8 项启动用例覆盖首启，生产检查覆盖已有存档继续。没有本地／原型浏览器检查或绕过方案；历史 1.1.0 浏览器验收不证明 1.2.0。完整证据与边界见 [QA 记录](QA_REPORT.md)。

**后续文档提交不改变生产源码 `90bb910840e7c2b22c59e0421f111c4c1a7cb7c8` 或实际 health 元数据；线上始终标记真正构建并上传的源码。**

## 历史 1.1.0：当时的生产源码与发行方式

以下至“Worker 发行模块的打包与发布”前为 1.1.0 历史记录，其中“当前”“本轮”均指当时的检查点，已由上面的 1.2.0 发行取代。

源代码位于 [ct1150/wending](https://github.com/ct1150/wending) 的 `main` 分支。**Cloudflare API MCP 已实际发布 Worker `baishi-wending`**，生产地址为 [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/)。当前是普通 Worker 返回内嵌离线 HTML 的发行方式，尚未使用 `dist/` 的 Static Assets 路由。原有 `wrangler.jsonc` 保留作后续 Static Assets 迁移使用。

当前线上发行源码提交为 [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353)；[PR #1](https://github.com/ct1150/wending/pull/1) 于 `2026-10-25T01:10:05Z` 合并。对应GitHub Actions [40149561196](https://github.com/ct1150/wending/actions/runs/40149561196) 的结论与validate均为 `success`，deploy为 `skipped`。本次实际发布由控制方通过API完成；后续仅修改文档的提交不会改变线上发行源码或health元数据。

**GitHub → Cloudflare 自动发布仍未配置。** 2026-10-24只读核实中，此Worker的原生Builds配置查询为 `404 / 12040`（No build configuration associated with that script tag），triggers为空，builds为空且total_count=0。本轮main CI的deploy仍跳过，CI成功与本次API上线分别记录。

首发时连接仓库曾返回 `404 / 8000008 Git account disconnected`，当时无build token。这是历史失败记录；本轮没有重做会修改连接的PUT，repo autofill的404也不足以证明GitHub App现在仍未安装。当前可证明的是此Worker没有自动构建配置，不能声称App从未安装。成功生产发行来自Cloudflare API MCP。

| 项目 | 当前结果 |
| --- | --- |
| 生产 URL | [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/) |
| Cloudflare 发行方式 | 普通 Worker 内嵌 HTML，由 `fetch` 返回页面 |
| Worker 名称／账号子域 | `baishi-wending` / `ct1150` |
| Worker tag | `d4ceaa79ca7d4ca48954b1117458297f` |
| Deployment ID | `a79b0351-d05d-4ca4-875b-bd8a5048f91f` |
| Worker version ID／流量 | `ca6bdda3-9739-4a09-a4a9-0f0f39085c45`／100% |
| 部署创建时间 | `2026-10-25T01:10:47.185111Z` |
| workers.dev | 已启用；preview URL 未启用 |
| HTML 大小／SHA-256 | 312059 字节 / `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46` |
| Worker 模块大小 | 317795 字节 |
| 游戏运行服务 | 不需要游戏后端、数据库或玩家账号 |

当前页面请求执行普通 Worker，**计入 Workers 请求额度**；具体限额与收费以目标账号套餐为准，不能沿用 Static Assets 免费资源请求的描述。官方参考：[Workers 计费](https://developers.cloudflare.com/workers/platform/pricing/)（查阅：2026-10-24）。

## 历史 1.1.0正式发行与生产验收

本地最终候选的82项行为、8个测试文件、20JS语法检查、离线首选项／刷新及焦点／截止／短战／旅行／旧存档路径已通过；整分支五项发现完成修复及限定复核。详细本地证据与覆盖边界见 [QA记录](QA_REPORT.md)。本轮生产验证如下：

| 证据 | 实际结果 |
| --- | --- |
| GitHub审查与合并 | [PR #1](https://github.com/ct1150/wending/pull/1) 已合并，发行源码为 [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353) |
| 源码一致性 | tree `42831e16b6832eb3207916a1b2668beec49d5375` 与已评审本地 `d7e7b05fa70d830686b14bbcd4789f0adadea514` 的源码树一致 |
| main CI | [40149561196](https://github.com/ct1150/wending/actions/runs/40149561196)：success；validate success，deploy skipped |
| 精确源码打包 | 使用上述实际GitHubSHA；构建UTC `2026-10-25T01:10:11.898096+00:00`；HTML 312059字节，Worker 317795字节 |
| 生产health | [healthz](https://baishi-wending.ct1150.workers.dev/healthz) 返回status ok、上述发行SHA及HTML SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46` |
| 实际开局与刷新 | 创建角色后显示“灰里还有人”，选择“先问封谷令为何下来”进入“不肯烧掉的药簿”；刷新后完整主内容保留；进入设置及返回正常 |
| 实际线上下载 | 游戏内下载312059字节，SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`，与已测离线产物完全一致 |
| 本轮生产视口／错误 | 1363×936，pageWidth 1348，无横向溢出；应用错误0。另有21条浏览器扩展metadata消息，与游戏错误分开记录 |

本次通过标准API更新已有 `baishi-wending` 普通Worker，deployment／100% version与时间见上表；没有切换Static Assets或启用自动发布。本轮生产烟测仅覆盖上述开局选择、刷新及设置回流；完整桌面／手机共守后世通路属于本地验证，没有在生产重跑全部结局、移动设备或读屏软件验收。真人20–30分钟节奏仍未测量。

**生产源码SHA为 `4d3834be1bcd2ffd636c7fe32bde5c111195f353`，与本次上线后仅文档审计提交不同。** 文档HEAD变化不应改写生产health；Worker始终标记真正构建并上传的源码提交。

## Worker 发行模块的打包与发布（历史首发示例）

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

## 另行迁移方案 A：Cloudflare 原生 GitHub 集成（非本轮流程）

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

## 另行迁移方案 B：GitHub Actions 发布（非本轮流程）

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

## 2.0.0 发布后的最小验证（待实际执行）

Node／handler 与离线文件检查：记录完整 release 结果、实际版本和 HTML 字节／hash；使用真正合并 SHA 构建 Worker；核对 root／下载正文一致、health 元数据及 HEAD／404／405。功能 harness 不能证明实际浏览器效果。

获准生产 UI 检查：

- 从真实 HTTPS URL 进入无档首局，选择到一次冲突，观察当前成本、后果与阅读焦点。
- 走一次明确死亡与直接新生，核对世界推进、历史及没有重复奖励；保留既有备份。
- 合法旧档继续旧当世，结算后显式奖励／v3 交接；刷新恢复，并通过真实 UI 导出与导入。
- 键盘选择、帮助／更多返回焦点；320px 不横向溢出、44px 触控、浅色与深色可读。
- 下载实际离线文件并核对字节／hash 与版本。若实际离线打开不在获准环境内，明确保留此项未验收，不能换本地或替代预览绕过。
- 分别记录实际 URL、日期、视口、错误及观察边界。物理手机、读屏与真人时长须独立观察，不能从桌面或 Node 推断。

## 历史首版GitHub验证与生产证据

| 证据 | 2026-10-24首版历史记录 |
| --- | --- |
| 源码仓库 | [ct1150/wending](https://github.com/ct1150/wending)，公开仓库，`main` |
| 首版发行源码提交 | [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9) |
| 首版生产源码对应CI | [40053805256](https://github.com/ct1150/wending/actions/runs/40053805256)：`success`，48 个测试通过、15 个 JS 文件语法检查通过 |
| 首版历史CI产物 | [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440)，压缩包 247611 字节，含静态站点、离线 HTML 与 189712 字节 `release/worker.mjs` |
| 首次游戏源码与历史 CI | [`6698dbb`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c) / [40050257913](https://github.com/ct1150/wending/actions/runs/40050257913)，历史 46 测试通过 |
| Cloudflare 实际发布 | API MCP标准Worker上传成功；deployment `48af217d-8b0f-428a-94ab-d868fdf55ca3`，100% version `f9dd9fc8-df55-437e-8123-bbca3e119a59` |
| 生产 URL | [https://baishi-wending.ct1150.workers.dev/](https://baishi-wending.ct1150.workers.dev/) |
| 真实浏览器已验证 | 开局、修炼、探索事件、选择结果、刷新存档与日志恢复、healthz、离线下载哈希、移动布局 |
| 线上健康接口 | 浏览器返回 `status: ok`、上述源码提交及 HTML SHA-256 |
| 真实下载 | 从游戏设置点“下载游戏”取得 185751 字节文件，SHA-256 与构建产物完全一致 |
| 移动端 | 390px iframe 载入真实公网游戏，可用宽 375 CSS px；html/body 的 scrollWidth = clientWidth = 375，顶部修为和底部五项导航可见 |
| 其余协议边界 | 公网 HEAD／404／405 尚未取得线上响应证据；本地 Worker handler 测试已覆盖且通过 |
| GitHub自动发布 | 此Worker无原生Builds配置404／12040、无triggers／builds；最近观察CI deploy跳过；不推断App安装状态 |

首版真实浏览器验收记录：创建“云归”时 16 岁；修炼后 19 岁、13 修为、81 余寿、29 灵石；探索至 21 岁遇到“渡口最后一船”，选择“帮他装船”后 22 岁、78 余寿、41 灵石。刷新后上述数值和日志恢复。

首版公网页面 GET、healthz、实际下载及移动端均已有当时的真实浏览器证据。本执行环境的脚本请求得到过 403，未反复重试；该通路结果不能代替浏览器成功结果或用于推断全站故障。只有公网 HEAD／404／405 仍缺少独立线上证据，本地测试不作替代。
