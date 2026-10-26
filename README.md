# 百世问鼎 · 人间求仙篇

**3.1.0：取名掷骰与沉浸阅读。** 从十六岁的山村少年开始，为一部完整功法走进修仙世界。争取机缘、谨慎历险、准备筑基，携一世所得再入轮回。

本版完成“凡人入门—炼气历险—筑基取舍—此生归宿—下一世”的可重玩闭环。新篇尚未实现更高境界与三界远征，旧三界版本存档仍可继续。实际发布证据见 [部署记录](docs/DEPLOYMENT.md)。

- [线上游戏](https://baishi-wending.ct1150.workers.dev/)
- [玩法与范围](docs/PRODUCT_SPEC.md) · [引擎契约](docs/ENGINE_CONTRACT.md) · [验收证据](docs/QA_REPORT.md)
- 原生JavaScript，浏览器本地运行，无账号、游戏后端和运行时外部依赖，不上传存档。

## 开始游玩

没有存档时先取名、查看随机属性与天赋，可重新掷骰，按「就以此身，入世」开始正文。结果会自动保存，刷新不会重掷。已有存档继续原来的人生；想体验取名掷骰，在「更多 → 存档与设置」导出旧档，再选择「开始人间求仙篇」并确认。导入备份仍可回到原人生。

开发用 Node.js >=22（项目版本24），无需 npm install。运行 npm run dev，打开终端打印的地址；默认端口5173，可用 PORT=8080 或 -- --port 8080 修改。

## 修行与取舍

- **此身自定：** 自定义姓名，掷骰决定根骨、悟性、气运和一项天赋，影响疗伤、首次炼气积累或起始行囊。
- **专注眼前：** 当前页只展示最新后果、当前剧情和选择。顶部固定简栏显示姓名、境界、年龄和余寿，点击展开人物详情；过往正文收进「历史对话」。
- **先求入门：** 主角有自己的求仙动机，药谷的人情和危险与功法目标相连。
- **日与年各有所用：** 药谷危机耗日，离谷后修习与闭关耗年。历时推进年龄与世界，燃寿只损个人寿元。
- **突破需要准备：** 完整功法和多年修习才能引气；筑基需要修为、材料或温养、伤势与安身条件。交接不再直接发境界。
- **机缘改变方法：** 沼泽采药、废墟寻法、护商远行带来不同资源与危险，所学方法改变后续选择。查看和刷新不重抽。
- **危险有迹可循：** 选择保留自然行动描述，缺失条件和已知严重风险会在选择前说明；准备不足、受伤或余寿不足会留下真实后果。
- **下一世有新路：** 结算记录所得与教训，最多携一项已得方法重新修行，前世世界事实持续影响后来。

每世20—30分钟是设计目标，仍需真人试玩测量，不能由动作数或自动测试证明。

## 存档

新篇使用 JSON version 4 / cultivation；新开局使用 contentVersion 2，3.0.0 的 contentVersion 1 人生继续原规则且不会被补掷天资。浏览器存储键仍为 baishi-wending-save-v1。v1/v2/v3仍使用原规则和验证，不会自动改写成新篇；v1/v2原有交接继续进入v3。

损坏、无效JSON和读取失败不会被新人生覆盖。保存失败会提示导出内存进度。总量限制仍为1,000,000个JavaScript字符串字符，超限行动不提交、不扣费、不推进随机。内容与历史有明确边界，不承诺无限新篇或无限存档。

## 检查与发行

npm test、npm run check、npm run build分别执行行为验证、语法检查和构建；npm run release按此顺序全部执行。

| 输出 | 用途 |
| --- | --- |
| dist/ | 静态站点 |
| release/baishi-wending-offline.html | 内嵌脚本、样式与本地图片的单文件离线版 |
| release/release.json | 版本、构建时间、字节与SHA-256 |
| release/worker.mjs | 携真实源码SHA的普通Worker发行 |

Worker打包命令为 npm run build:worker -- --source-commit ACTUAL_MERGED_40_CHARACTER_SHA，须把占位符替换为真实远端完整SHA。发布沿用现有Cloudflare Worker，本轮不改变部署架构或配置自动发布。

上一版 3.0.0 经 [PR #6](https://github.com/ct1150/wending/pull/6) 首次发行，再由 [PR #7](https://github.com/ct1150/wending/pull/7) 修正四处条件叙述。3.0.0 最终运行时源码为 [`568d53915cde8b25fd742403d3f8d8075dcdc7a8`](https://github.com/ct1150/wending/commit/568d53915cde8b25fd742403d3f8d8075dcdc7a8)，[main CI](https://github.com/ct1150/wending/actions/runs/40210351905) 成功，于 UTC `2026-10-25T16:10:48.567616Z` 通过 API 更新现有 Worker。真实浏览器已走通护商筑基、寿终与携辨药的新生，验证旧 v3 继续、存档恢复和实际游戏下载；最终文字修订版的生产身份、下载文件与第二世重载也已核对。精确产物和观察范围见 [部署记录](docs/DEPLOYMENT.md) 与 [验收记录](docs/QA_REPORT.md)。后续文档提交不改变线上实际源码标记。

## 源码

- src/game/cultivation/：v4故事、状态机、时间与存档验证。
- src/ui/journey.js / character.js / paper.css：当前叙事、历史抽屉、人物简栏与取名掷骰。
- src/game/journey/：旧v3人生。
- src/game/engine.js / story.js：旧v1/v2兼容。
- src/game/save-format.js / persistence.js / src/ui/session.js：版本分发、保存与恢复。

历史规则：[2.0.0](docs/PRODUCT_SPEC_2_0_HISTORY.md)、[1.1.0](docs/PRODUCT_SPEC_1_1_HISTORY.md)。新设计与计划见 docs/superpowers/。
