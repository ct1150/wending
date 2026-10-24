# GitHub → Cloudflare 部署

更新日期：2026-10-24。

## 最终方案与当前状态

源代码存放在独立 GitHub 仓库，最终站点使用 **Cloudflare Workers Static Assets** 托管。此方案依据用户最新要求，替代早期文档中的 GitHub Pages 最终托管方案。

当前仓库提供可执行的构建脚本、离线单文件导出、`wrangler.jsonc` 和 GitHub Actions 工作流。**这些配置本身不证明站点已上线。** 首次发布仍须完成正确 GitHub 仓库与 Cloudflare 账号的授权，并记录成功运行与在线访问证据。不得复用或修改无关的既有项目。

| 项目 | 配置 |
| --- | --- |
| Cloudflare 产品 | Workers Static Assets |
| Worker 名称 | `baishi-wending`，首次发布前确认该名称属于本项目 |
| 源码生产分支 | `main` |
| Node.js | 24，见 `.node-version` |
| 验证及构建 | `npm run release` |
| 静态资源目录 | `dist/` |
| 部署命令 | `npx wrangler deploy` |
| 路由 | 静态 HTML 路由；不存在的资源返回 404，不使用 SPA 回退 |
| 后端、数据库、运行密钥 | 本游戏不需要 |

Workers 支持直接部署目录中的静态资源，无须为了托管本游戏额外编写请求处理 Worker。这里选择 Workers 是为了沿用一份 Wrangler 配置和 Cloudflare 当前的静态资源工作流；Cloudflare Pages 也可以托管这类静态站点，但对应的是独立的 Pages 项目与部署命令，不应将两者混用。此选择不构成价格、额度或未来服务条款的保证。参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[静态站点入门](https://developers.cloudflare.com/workers/static-assets/get-started/)、[Pages 与 Workers 迁移说明](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)（查阅：2026-10-24）。

## 方式 A：GitHub Actions 发布（仓库内默认配置）

工作流文件：`.github/workflows/validate-deploy.yml`。

1. 将本项目推送到已授权的独立 GitHub 仓库，默认分支设为 `main`。
2. 在 Cloudflare 确认目标账号和 Worker 名称，准备该账号的 Account ID 与具备所需 Workers 编辑权限的 API Token。账号范围应限制为实际目标账号；不要将 Token 写入源文件、文档、日志或聊天。
3. 在 GitHub 仓库设置的 Actions secrets 或 `production` environment secrets 中添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
4. 在仓库 Actions variables 中设置 `ENABLE_CF_DEPLOY` 为字符串 `true`。
5. 推送至 `main`，或在 `main` 上手动运行工作流。先验证，再部署。若仓库已有生产环境审批规则，遵循该规则。
6. 查看 GitHub Actions 中 Wrangler 的成功结果和真实 URL，再访问站点验证资源、开局、存档和离线下载，最后填写本页的实际发布记录。

`validate` 任务会运行 `npm run release` 并上传 `dist/` 与 `release/` 作为构建产物。`deploy` 依赖验证成功，仅在 `main` 的非 PR 事件且显式启用时运行；它从同一提交重建静态输出，然后调用官方 `cloudflare/wrangler-action@v4`。开发与验证没有 npm 依赖安装步骤，发布动作会取得 Wrangler 4。工作流使用官方 GitHub `checkout@v6`、`setup-node@v6` 与 `upload-artifact@v7`，自动 npm 缓存关闭。

若 `ENABLE_CF_DEPLOY` 不是 `true`，验证仍照常完成，摘要明确说明没有发布。若已启用但凭据缺失，发布任务在调用 Cloudflare 之前失败并说明缺少配置。若认证、权限或资源上传失败，必须以失败结果报告，不得把 `validate` 的成功称为上线成功。

Cloudflare 的非交互 CI 部署需要 API Token 与 Account ID。官方说明：[GitHub Actions 部署](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)、[Wrangler Action](https://github.com/cloudflare/wrangler-action)。GitHub 动作版本参考：[Checkout](https://github.com/actions/checkout)、[Setup Node v6](https://github.com/actions/setup-node/releases/tag/v6.0.0)、[Upload Artifact v7](https://github.com/actions/upload-artifact/releases/tag/v7.0.0)（查阅：2026-10-24）。

## 方式 B：Cloudflare 原生 GitHub 集成

如果希望由 Cloudflare 接收 GitHub 推送并构建，在 Cloudflare Workers & Pages 中创建或连接对应 Worker，选择正确 GitHub 账号、独立仓库和 `main` 分支：

| 设置 | 值 |
| --- | --- |
| 根目录 | 项目位于仓库根目录时留空；单仓多项目时使用实际项目目录 |
| 构建命令 | `npm run release` |
| 部署命令 | `npx wrangler deploy` |
| Node.js | 24；如构建界面未读取 `.node-version`，在构建设置指定 Node 24 |
| 静态资源 | 由仓库 `wrangler.jsonc` 的 `assets.directory` 指向 `./dist` |

选用此方式时，让 GitHub Actions 保持验证功能，并保持 `ENABLE_CF_DEPLOY` 未启用，避免两个生产发布流程同时部署同一提交。Cloudflare 原生 Git 集成的发布开关与权限独立于仓库变量；上述变量只控制本仓库的 GitHub Actions。Cloudflare 构建必须执行 `npm run release`，这样测试失败就不会继续部署。

官方说明：[Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Workers GitHub 集成](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)（查阅：2026-10-24）。

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

## 实际发布记录

| 证据 | 当前记录 |
| --- | --- |
| GitHub 仓库 URL | 待授权并确认 |
| 发布提交 | 待实际发布 |
| GitHub Actions／Cloudflare Build 运行 URL | 待实际运行 |
| Wrangler 发布结果 | 尚未在本说明中记录成功证据 |
| 真实线上 URL | 待部署并访问验证 |
| 线上验证结果 | 待实际验证 |

维护者应根据实际执行结果更新本表，保留失败或阻塞原因，不填入推测地址。
