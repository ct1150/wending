# GitHub → Cloudflare 部署

更新日期：2026-10-24。

## 最终方案与当前状态

源代码已上传至独立 GitHub 仓库 [ct1150/wending](https://github.com/ct1150/wending) 的 `main` 分支，最终站点目标为 **Cloudflare Workers Static Assets**。此方案依据用户最新要求，替代早期文档中的 GitHub Pages 最终托管方案。

GitHub 源码上传与首次 CI 验证已完成：[Actions 运行](https://github.com/ct1150/wending/actions/runs/40050257913) 的 `validate` 任务全部成功并生成构建产物。`deploy` 因 `ENABLE_CF_DEPLOY` 未启用而跳过。**Cloudflare 尚未连接、尚未部署，当前没有线上游戏 URL。** 下一步推荐在目标 Cloudflare 账号使用下述原生 GitHub 集成。不得复用或修改无关的既有项目。

| 项目 | 配置 |
| --- | --- |
| Cloudflare 产品 | Workers Static Assets |
| Worker 名称 | `baishi-wending`，首次发布前确认该名称属于本项目 |
| GitHub 仓库 | [ct1150/wending](https://github.com/ct1150/wending) |
| 源码生产分支 | `main` |
| Node.js | 24，见 `.node-version` |
| 验证及构建 | `npm run release` |
| 静态资源目录 | `dist/` |
| 部署命令 | `npx wrangler deploy` |
| 路由 | 静态 HTML 路由；不存在的资源返回 404，不使用 SPA 回退 |
| 后端、数据库、运行密钥 | 本游戏不需要 |

Workers 支持直接部署目录中的静态资源，无须为了托管本游戏额外编写请求处理 Worker。这里选择 Workers 是为了沿用一份 Wrangler 配置和 Cloudflare 当前的静态资源工作流；Cloudflare Pages 也可以托管这类静态站点，但对应的是独立的 Pages 项目与部署命令，不应将两者混用。此选择不构成价格、额度或未来服务条款的保证。参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[静态站点入门](https://developers.cloudflare.com/workers/static-assets/get-started/)、[Pages 与 Workers 迁移说明](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)（查阅：2026-10-24）。

## 方式 A：Cloudflare 原生 GitHub 集成（推荐）

一次性连接步骤：

1. 登录目标 Cloudflare 账号，在 **Workers & Pages → Create application → GitHub** 导入仓库并创建 Worker。
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

## 方式 B：GitHub Actions 发布（备选）

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

## GitHub 验证与实际发布记录

| 证据 | 当前记录 |
| --- | --- |
| GitHub 仓库 URL | [ct1150/wending](https://github.com/ct1150/wending)，公开仓库，生产分支 `main` |
| 首次游戏源码提交 | [`6698dbbca4b452466ad461070250c6ea7deeb87c`](https://github.com/ct1150/wending/commit/6698dbbca4b452466ad461070250c6ea7deeb87c) |
| 游戏源码树 | `ea6040b9d180197af1b7503efc837a8d3be6070d`；与上传时本地 `HEAD^{tree}` 完全一致，30 个远端 blob SHA 逐项匹配 |
| 首次 GitHub Actions 运行 | [40050257913](https://github.com/ct1150/wending/actions/runs/40050257913)：`success` |
| 验证任务 | [120741133981](https://github.com/ct1150/wending/actions/runs/40050257913/job/120741133981)：全部步骤 `success` |
| 构建产物 | [12541989829](https://github.com/ct1150/wending/actions/runs/40050257913/artifacts/12541989829)：已生成，压缩产物 184805 字节，包含静态站点与离线版 |
| 远程验证日志 | 46 个测试全部通过、0 失败；13 个 JavaScript 文件语法检查通过；离线 HTML 185751 字节 |
| GitHub 部署任务 | `skipped`；`ENABLE_CF_DEPLOY` 未启用 |
| Cloudflare Git 连接 | 尚未连接 |
| Cloudflare Build／Wrangler 发布结果 | 尚未实际部署，无成功记录 |
| 真实线上游戏 URL | 尚无 |
| 线上验证结果 | 待 Cloudflare 实际部署后验证 |

维护者应根据实际执行结果更新本表，保留失败或阻塞原因，不填入推测地址。
