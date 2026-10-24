# 百世问鼎

一款围绕寿元、际遇与跨世因果的单机文字修仙游戏。每一世从十六岁启程，在剑修、体修、丹修中选择道路，修炼、历练、突破与迎战；寿尽后将真正挣得的传承与世界因果留给后来者。取得三界道证，再向三界共主之位发起挑战。

游戏在浏览器本地运行，无运行时依赖，不需要账号或后端。源代码由 GitHub 管理，最终托管目标为 **Cloudflare Workers Static Assets**。实际发布结果以 [部署记录](docs/DEPLOYMENT.md) 中的证据为准。

## 本地运行

使用 Node.js 24（最低要求 Node.js 22）。不需要执行 `npm install`。

```sh
npm run dev
```

打开终端显示的地址，默认端口为 `5173`。开发服务器绑定 `0.0.0.0`，支持 `PORT=8080 npm run dev`，也支持 `npm run dev -- --port 8080`。

## 检查与构建

```sh
npm test
npm run check
npm run build
```

`npm run release` 按顺序执行以上三步。

| 输出 | 用途 |
| --- | --- |
| `dist/` | 可部署的静态站点，保留原生 ES 模块与相对资源路径 |
| `release/baishi-wending-offline.html` | 内嵌脚本、样式和本地 SVG 的单文件离线版 |
| `release/release.json` | 版本、构建时间、离线文件大小和 SHA-256 摘要 |

离线文件也复制到 `dist/baishi-wending-offline.html`，可与线上版本一起提供下载。构建不会改写源文件。开发版使用 ES 模块，应通过开发服务器打开；单文件离线版可以直接打开。

## 玩法与存档

寿元是行动预算。修炼、探索、休养、炼丹、突破与跨界游历会推进时间；战斗燃寿增加个人命损，不让世界按回合跨年。行动成本与战斗意图在作出选择前显示。

每次结算只从本世真实经历产生的候选传承中选择一项解锁。已解锁传承、三界道证、世界因果和历代生平跨世保留；新一世最多带入两项传承。一般资源与角色境界重新开始。

自动存档保存在当前浏览器的本地存储中。请使用游戏内导出功能保留自己的存档文件；换浏览器、换域名或使用离线文件时，可通过导入继续。游戏不会上传存档到服务器。浏览器对本地文件存储的行为可能不同，离线使用时也应定期导出备份。

## 项目结构

```text
index.html               页面入口
src/app.js               界面与交互
src/game/content.js      境界、流派、事件、敌人与传承数据
src/game/engine.js       确定性纯函数规则引擎
src/game/persistence.js  版本化本地存档
src/ui/icons.js          本地 SVG 图标
assets/                  原创静态视觉资源
scripts/                 开发服务器、检查与构建
tests/                   内容、规则与构建行为测试
docs/                    产品、接口、进展与部署说明
```

## 发布

GitHub Actions 对每次 push、pull request 和手动运行执行测试、语法检查与构建。Cloudflare 发布仅在 `main` 分支、验证通过、仓库变量 `ENABLE_CF_DEPLOY=true` 且凭据齐全时执行。未启用时会明确记录“未发布”，不会把成功构建当作成功上线。

首版验收和已知边界见 [验收记录](docs/QA_REPORT.md)。完整步骤、Cloudflare 原生 Git 集成的替代方式和官方参考见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。产品规则见 [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)，模块边界见 [docs/ENGINE_CONTRACT.md](docs/ENGINE_CONTRACT.md)。
