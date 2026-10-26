# GitHub → Cloudflare 部署

更新：2026-10-26（上海）。**3.1.0 已发布**，仍使用现有普通 Worker。

## 当前生产：3.1.0 取名掷骰与沉浸阅读

[PR #9](https://github.com/ct1150/wending/pull/9) 完成固定人物简栏、人物与历史抽屉、当前剧情收拢、对话标点与 CV2 取名掷骰开局。源代码、独立复核、完整发行门禁、真实远端树与生产页面均已核对。

| 发行证据 | 实际结果 |
| --- | --- |
| 实际运行时源码 | [`ffe37add4d9194566f327667f0a1a9d7b3ee7394`](https://github.com/ct1150/wending/commit/ffe37add4d9194566f327667f0a1a9d7b3ee7394) |
| 精确源码树 | `486a966b6206aa59eb21806e816814a1d1e18a66`，与已审本地 `349dd4417e9ec334e2f63ebc1a492e6b2ccf33f9` 完全相同 |
| 发行门禁 | `npm run release` 成功，26/26 测试文件、59 个 JS 语法检查，离线构建成功 |
| GitHub CI | [PR CI 40254532639](https://github.com/ct1150/wending/actions/runs/40254532639) success；[main CI 40254622457](https://github.com/ct1150/wending/actions/runs/40254622457) success；validate 成功，自动 deploy 跳过 |
| 构建 UTC | `2026-10-26T00:51:56.291Z` |
| 离线 HTML | 667310 字节；SHA-256 `cf0e97a71dc2d5c4a41f00e21fc150415256e5308c4fb46f41b89b7c26942fb0` |
| Worker | 676680 字节；SHA-256 `94ab981445f1830628e4aa3fc9b947a42f1caa3fb9540c4e7bf021be79a89d2d`；标记真实合并源码 |
| 实际部署 | 既有 `baishi-wending` Worker，API HTTP 200；deployment `b441125c-2294-4ad0-a1c1-47d914b537d3` |
| 版本与流量 | `3e52706f-cb79-47b7-9d22-e3adcb5563a8`，100% |
| 部署时间 | UTC `2026-10-26T01:32:24.75492Z`；上海 2026-10-26 09:32:24 |
| 生产身份与下载 | 实际浏览器 `/healthz` 显示上述源码与 HTML 哈希；从游戏内下载的 HTML 与本地产物逐字节相同 |

实际网页走通旧 CV1 继续、明确新开局、空姓名阻止、中文取名、显式重掷、刷新恢复、Enter 入世、人物详情、历史对话、抽屉内部滚动与 Escape 返回入口、开局导出/文件选择器导入，以及恢复后再入世。旧档升级前后导出文件逐字节相同；掷骰档恢复没有重抽；起始灵石与伤药真实结算且没有重复。详细数值与截图见 [QA](QA_REPORT.md)。

本次没有启用自动发布或迁移托管。后续仅文档与截图提交不会替换线上运行时 `ffe37add4d9194566f327667f0a1a9d7b3ee7394`。下方旧版条目中的“当前”仅指其当时发行检查点。

## 历史生产：3.0.0 四处文字修订版

首发浏览器检查后，修正徒手救援的绳索假设、村医结果的受伤假设、一年准备的护商措辞，以及筑基岁月的御剑假设。四处均只修改文字，选择编号、条件、成本、效果和存档结构不变；定向复核无遗留发现，控制方重新完成完整发行门禁。

| 最终发行证据 | 实际结果 |
| --- | --- |
| 真实合并源码 | [PR #7](https://github.com/ct1150/wending/pull/7) 已合并；当前运行时 [`568d53915cde8b25fd742403d3f8d8075dcdc7a8`](https://github.com/ct1150/wending/commit/568d53915cde8b25fd742403d3f8d8075dcdc7a8) |
| 发行时精确树 | `f1ab4b30084b50f74437dff18961ab347e290ccf`，与已审本地 `acb4356` 的树一致 |
| 修订后完整门禁 | 新鲜 `npm run release` 成功；23/23 测试文件、55 个 JavaScript 语法检查通过，离线构建成功 |
| GitHub CI | [main CI 40210351905](https://github.com/ct1150/wending/actions/runs/40210351905) success；[validate 121220054228](https://github.com/ct1150/wending/actions/runs/40210351905/job/121220054228) success；[deploy 121220131018](https://github.com/ct1150/wending/actions/runs/40210351905/job/121220131018) skipped |
| 正式构建 UTC | `2026-10-25T16:07:13.386Z` |
| 正式 HTML | 634455 字节；SHA-256 `045b0248657daee13f73a9d6014809c2daf1e0674d3c5292d84bb9e4c2b4e49f` |
| 实际源码标记 Worker | 643167 字节；SHA-256 `ae781bf7329dca05aba9de54b4212d859dfd56da17299f47ecb5a75229e65b90`；`sourceCommit` 为上述当前运行时 SHA |
| 实际部署 | 现有 `baishi-wending` Worker，API HTTP 200；deployment `0a6db68e-e98c-4e78-8ea3-610fd029df42` |
| 实际 version／流量 | `9e56498f-e322-4e84-b844-433a169ecaa2`／100% |
| 部署 UTC | `2026-10-25T16:10:48.567616Z` |
| 生产身份 | 实际浏览器 [healthz](https://baishi-wending.ct1150.workers.dev/healthz) 核对当前源码 SHA 与正式 HTML 哈希 |
| 最终实际下载 | 游戏内下载 634455 字节，与本地正式 HTML 逐字相同且 SHA-256 一致；文件包含全部四处文字修订 |
| 新部署后的旧进度 | 浏览器重载仍保留第二世、16 岁凡人、道历 1180、已携“辨药”以及前世义药铺事实 |

生产地址：[线上游戏](https://baishi-wending.ct1150.workers.dev/)。实际发布仍由 API 完成，自动部署任务跳过，没有切换托管方式。**后续仅文档提交不改变实际部署源码 `568d53915cde8b25fd742403d3f8d8075dcdc7a8` 或 health 元数据。** 首发完整路线与截图在下方保留；最终文字版的独立观察是 health、实际下载与现有第二世重载。

## 3.0.0 首次发行检查点（UTC 15:59）

源码从真实 GitHub `4119a9a5780b5d5478f320b69d44670428cab1cb` 开始。独立审查与完整发行门禁通过后，通过 Git Data API 在真实远端父提交上建立并合并 PR；发行 tree 与已审树一致，本地合成 git 历史未直接推送。合并后以实际运行时 SHA 打包，再通过 API 更新已有 Worker。

| 3.0.0 首发证据 | 实际结果 |
| --- | --- |
| 独立审查与本地门禁 | 最终审查 READY；`npm run release` 成功，23/23 测试文件、55 个 JavaScript 语法检查通过；定向 v4 用例 50/50，范围见 [QA](QA_REPORT.md) |
| 真实合并源码 | [PR #6](https://github.com/ct1150/wending/pull/6) 已合并；实际运行时 [`526928723f06a00d1f9f6d3be1b80b5987ee26b0`](https://github.com/ct1150/wending/commit/526928723f06a00d1f9f6d3be1b80b5987ee26b0) |
| 发行时精确树 | `6fc2840dbe6c1d74f10b8c4a94f6d8909c7fde2d`，与已审本地快照 `5c81a67` 的树一致 |
| GitHub CI | [main CI 40209419960](https://github.com/ct1150/wending/actions/runs/40209419960) success；[validate 121217269362](https://github.com/ct1150/wending/actions/runs/40209419960/job/121217269362) success；自动 deploy job skipped |
| 正式构建时间 | `2026-10-25T15:58:16.810Z`（UTC） |
| 正式 HTML | 634374 字节；SHA-256 `7955ae64b7e531cbe682bb9ef25e207f2fad1444d7db286a5f9aff08361e0e80` |
| 实际源码标记 Worker | 643086 字节；SHA-256 `3d1e8b318f38e756b15f9c5fa4b2f2c0a6f804bb8981970dc71bb5dc47af8b90`；`sourceCommit` 为上述真实运行时 SHA |
| 实际部署 | 现有 Worker `baishi-wending`，API HTTP 200；deployment `494ff07b-2d8f-41b7-bdec-324496ce7f51` |
| 实际 version／流量 | `358e494c-3bb6-4ab8-8020-50d8805bb84b`／100% |
| 部署 UTC | `2026-10-25T15:59:10.732421Z` |
| 生产地址与身份 | [线上游戏](https://baishi-wending.ct1150.workers.dev/)；实际浏览器访问 [healthz](https://baishi-wending.ct1150.workers.dev/healthz)，已核对运行时源码 SHA 与正式 HTML 哈希 |

本轮 CI 的自动部署任务仍跳过；实际上线由 API 完成，没有启用 GitHub → Cloudflare 自动发布或迁移托管。**本检查点的实际运行时源码为 `526928723f06a00d1f9f6d3be1b80b5987ee26b0`；后续仅文档提交不改写该次部署的源码或 health 元数据。** 后续运行时修订应另记实际构建与部署身份。

### 3.0.0 生产 UI 验收

首发生产浏览器重载后，已有 v3 第二世存档仍可继续；经过明确重新开始确认后，进入 v4 人间求仙篇新开局。键盘 Return 可执行准备绳索的选择；真实 UI 导出 9657 字节 v4 JSON，推进四年后经实际文件选择器导入，恢复到 20 岁／道历 1004／“会一点法术以后”，显示“存档已恢复”。实际游戏下载 634374 字节，SHA-256 与上述首发 HTML 一致。

实际继续护商路线，在 36 岁／道历 1020 筑基，余寿 143 年 176 日。归乡开药铺后，179 岁只留最后一年，180 岁／道历 1164 寿终。选择记住“辨药”，再过 16 个世界年，进入道历 1180 的第二世：16 岁、凡人、余寿 56 年，药铺学徒开场，前世义药铺保留且无人认识新的身体。

桌面视口 1363×936，页面 `clientWidth = scrollWidth = 1348`，该视口未见横向溢出；首屏三项按钮均约 570×89.28 CSS px。[首发开局](evidence/cultivation-3.0.0-opening.jpg)、[筑基](evidence/cultivation-3.0.0-foundation.jpg) 和 [第二世](evidence/cultivation-3.0.0-rebirth.jpg) 截图均为已检查的 JPEG 1348×926，文件字节与哈希见 [QA 的生产 UI 验收](QA_REPORT.md#生产-ui-验收)。四处纯文字修订后的最终身份与独立观察见上方当前生产记录，首发截图继续保留拍摄时的版本归属。

本版未声称完成物理手机、320px 实际布局、深色、读屏或真人每世 20–30 分钟节奏验收。下方旧版的桌面或移动观察不替代本版证据。

## 历史生产：2.0.0 对话与选项版

以下源码、产物、部署与浏览器观察属于 2.0.0；其中“当前”“本次”指该版本当时的发布检查点。

完整药谷、幽冥、天界、问鼎与轮回／旧档交接已通过最终源码审查和完整发行门禁。最终复核修正未知旧谷地终局叙述、共享 1,000,000 字符存档边界／原子提交／UTF-8 文件读取边界，以及非规范近限 v3 在确认前的拒绝；无未处理审查发现。完整命令、历史检查点与覆盖边界见 [QA](QA_REPORT.md)。

| 2.0.0 证据 | 当前状态 |
| --- | --- |
| 最终完整发行门禁 | 控制方新鲜 `npm run release` 成功；20/20 测试文件，48 个 JS 语法检查；不是 20 个行为用例 |
| GitHub 真实审查与合并 | [PR #4](https://github.com/ct1150/wending/pull/4) 已合并；实际源码 [`4dadfd046f1e1413e721a5679745272ef22e07fb`](https://github.com/ct1150/wending/commit/4dadfd046f1e1413e721a5679745272ef22e07fb) |
| 精确树一致性 | tree `6ea0663ce356f677e79615cfdf0aad3ca7ffb2f5` 与已审本地 `bbd6731a5497276c625cb96dba3e9cdfb659cbc5` 相同；合成历史未直接推送 |
| CI | [PR CI 40193041383](https://github.com/ct1150/wending/actions/runs/40193041383)、[分支 CI 40193032923](https://github.com/ct1150/wending/actions/runs/40193032923)、[main CI 40193106687](https://github.com/ct1150/wending/actions/runs/40193106687) 均 success；CI 与 API 部署分开记录 |
| 正式 HTML／构建时间 | 2.0.0，477041 字节；SHA-256 `4d02474e6b6313e845ba995794f0c6e9d2fcce090450393125d6ca101ed7fcd0`；上海 `2026-10-25 20:21:24.209`（元数据 UTC `2026-10-25T12:21:24.209Z`） |
| 实际源码标记 Worker | 484481 字节；SHA-256 `1e9a469fe86d05e8400afc77df29a4f1419503e857db48848c6b07d9b8283716`；sourceCommit 为上述真实运行时 SHA |
| 实际 deployment／version／流量 | `c1d4015f-7731-4c80-b55c-bcee0676787a`／`fd9de880-644b-445a-b9b1-7760730a2111`／100% |
| 部署创建时间 | 上海 `2026-10-25 20:27:38.506985`；UTC `2026-10-25T12:27:38.506985Z` |
| 生产 URL／HTTP 检查 | [线上游戏](https://baishi-wending.ct1150.workers.dev/)；上海 `2026-10-25 20:28:53.265970` 检查 `/healthz`、`/`、`/baishi-wending-offline.html` 均 200；版本与构建 2.0.0 匹配 |
| health／实际响应文件 | health 为 ok、上述源码 SHA 和 HTML hash；主页与离线端点均 477041 字节，SHA-256 与正式 HTML 一致 |
| 新阅读流实际桌面 UI | 原生首局／键盘选择、即时后果、刷新、帮助回流、真实导出／文件选择器导入确认与焦点、医谷共守后寿终／传承／直接新生，以及真实旧档交接均已观察；详细范围见 QA |
| 真人 20–30 分钟、寿元压力、物理手机、读屏 | 未测 |

后续同类发布流程（本次已完成源码、CI、部署与 HTTP 核对）：

1. 读取当时 GitHub 实际 `main` 与 tree；本地历史是合成快照，**禁止直接 push 本地分支**。已记录的远端基线会过时，发行时必须重新读取。
2. 用 Git Data API 以真实远端父提交重建审阅后的变更，排除 `.superpowers/` 等内部资料，比较精确文件树；走独立 PR、CI 与合并。
3. 从真实合并后的运行时代码 SHA 检出并重新运行 `npm run release`，再执行 `npm run build:worker -- --source-commit ACTUAL_MERGED_40_CHARACTER_SHA`（占位值换为完整真实 SHA）。本地准备产物不冒充此步骤。
4. 通过已有授权更新现有 `baishi-wending` 普通 Worker；沿用账号、tag、兼容日期与发布方式，不配置自动发布或迁移托管。分别记录真实 deployment ID、version ID、流量、UTC 时间及发行版本。
5. 核对生产 health 源码 SHA／HTML hash、实际页面版本与下载端点字节／hash；游戏内下载与获准环境 UI 另记实际观察范围。失败保留候选并报告，不称上线。

部署前控制方已从现有 **1.2.0** 实际生产 UI 导出一次备份；这是保护旧进度的观察，不是 2.0.0 导出／恢复验收。私人原始存档不进入源码树。

本次通过 API 更新现有 `baishi-wending` 普通 Worker，未配置自动发布、迁移 Static Assets 或新建托管。生产端点已验证不等于文件实际离线打开。**此后仅文档提交不改变实际部署源码 `4dadfd046f1e1413e721a5679745272ef22e07fb` 或 health 元数据。**

### 2.0.0 实际生产桌面 UI 观察（2026-10-25，上海）

真实旧 v2 存档继续调查，“分出两份药”实际扣药 2；“归隐并结算”到未竟／宗门收谷，再“只携记忆”进入 v3 第二世／1019 年“两把钥匙”，3 项行动，无设置表。旧档没有新的奖励候选，本轮没有实际验证新奖励分支。

明确重开后，原生第一世／1000 年“谷口的雨”恰有 2 项行动，键盘 Enter 可选择且即时后果保留。唯一药包交给温渡，学护人之术推进一年；刷新及“更多→入世须知→继续阅读”保持“灯下选第一条路”／1001 年／相同 3 选择。实际导出 3976 字节 v3/dialogue JSON，推进后经真实文件选择器导回，确认显示云归／第一世／17 岁；确认恢复原场景与年份，成功状态可见，焦点为 `journey-current-title`。

实际继续原始账册＋完整地脉图两线调查，第三条关闭；公开对质，以已得护人能力救下一家；医谷共守用一年并交接取得人间道证。明确守望耗尽 141 年余寿，19→160 岁／世界 1003→1144；“灯下生平”仅一项护人旧忆传承，直接新生再过 16 年到第二世／1160 年“规矩之外的五十七人”，3 项情境行动，医谷世界保留。展开／折叠生平可读真实前世选择和传承，不推进时间。此次浏览器没有走完整三界问鼎胜利。

真实桌面视口 1363×936，`clientWidth = scrollWidth = 1348`，无该视口横向溢出；3 个当前选择目标为 570×89.28125 CSS px。已检查的 224 条 warn/error 全部归属于 chrome-extension content-script metadata，混含旧与当前日志；未见本站归属条目，不宣称绝对无错误。实际开局截图 [dialogue-2.0.0-live.jpg](evidence/dialogue-2.0.0-live.jpg) 与第二世截图 [dialogue-2.0.0-rebirth.jpg](evidence/dialogue-2.0.0-rebirth.jpg) 均已视觉检查，精确大小／SHA-256 与完整控制台范围见 QA。

实际“更多→存档与设置→下载游戏”触发真实下载，477041 字节、SHA-256 `4d02474e6b6313e845ba995794f0c6e9d2fcce090450393125d6ca101ed7fcd0`，与最终发行 HTML 逐字一致；返回同一第二世场景。主要桌面流程完成于上海 22:06:37，含下载的最终事实记录于 22:07:57。

320px 与主题仿真不可用；深色、物理手机、读屏、真人节奏／寿元压力未测。下载的本地离线文件未实际打开。无本地／替代预览绕过。


## 历史生产：1.2.0 纸页界面

以下 1.2.0 段落及其“当前”表述均指该版本检查点，已被上方 2.0.0 发行取代；保留旧源码、产物和 UI 事实，不作为新版证据。

[线上游戏](https://baishi-wending.ct1150.workers.dev/) 已运行 **1.2.0 Paper**。实际发行源码为 [`90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`](https://github.com/ct1150/wending/commit/90bb910840e7c2b22c59e0421f111c4c1a7cb7c8)，[PR #2](https://github.com/ct1150/wending/pull/2) 已合并。发行 tree `ec460fa26506ce0946a0a5edf9f5222ed5e8ab65` 与已评审本地 `0d015eb82554c840a9bbcfd774a07d4f57dc25ba` 的 tree 相同；本地合成 git 历史未直接推送。

[PR CI 40163973639](https://github.com/ct1150/wending/actions/runs/40163973639) 与 [main CI 40164006388](https://github.com/ct1150/wending/actions/runs/40164006388) 均为 success；validate job `121081217915` success，deploy job `121081258031` skipped。实际部署由 API 手动上传现有普通 Worker 完成，GitHub → Cloudflare 自动发布未启用，也没有迁移 Static Assets。最终本地 `npm run release` 已通过 11/11 个测试文件和 25 个 JavaScript 语法检查；该1.2.0历史文档审计未重跑构建或测试；2.0.0候选的新门禁见QA。

| 项目 | 历史 1.2.0 实际结果 |
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

## 历史 2.0.0 发布后的验证范围与未观察矩阵

最终完整 release、实际版本／HTML 字节／hash、真正合并 SHA 标记的 Worker、Cloudflare deployment／version／100% 流量，以及真实 root／下载端点／health 已完成，见上方生产表。公网 HEAD／404／405 没有本轮独立响应证据。功能 harness 和 HTTP 不能证明实际浏览器效果。

获准生产桌面首局、冲突／救援、寿终／直接新生、旧档继续与 v3 交接、刷新、导出／文件选择器导入确认、键盘与导入后焦点、游戏内实际下载已按上文和 QA 的实际路径记录。全部测试不是所有历史／结局穷举，桌面路径不代替 320px／深色、物理手机、读屏和真人时长。旧档新奖励候选分支、浏览器完整三界胜利与离线文件实际打开仍未观察；公网 HEAD／404／405 也无本轮独立响应证据。未经获准的本地或替代预览不用于补齐这些项目。

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
