# 沉浸式叙事与取名掷骰实施计划

**Goal:** 完成四项用户反馈，并在现有线上版本提供可验证的结果。

**Architecture:** v4 引擎新增显式 CV2 开局状态，纯渲染器负责呈现，应用控制器负责持久化、输入和原生对话框。保留旧引擎与存档协议。

**Tech:** 原生 JavaScript、CSS、Node test、现有单页离线构建与 Cloudflare Worker。

**Spec:** `docs/superpowers/specs/2026-10-26-immersive-onboarding.md`

## Global Constraints

不在读取旧存档时补随机属性，不改变既有随机序列；不修改已有剧情耗时；不隐瞒严重危险；属性不可授予未学本领；转义所有姓名和对话；新建状态与重复点击要经过同一校验和保存边界；保留原始导入失败数据与旧档恢复能力。使用独立分支，合并、部署沿用此前用户已授权的 GitHub / 现有 Cloudflare 流程。

## Task 1 — 开局领域规则

Owner: immersion_engine. Files: `src/game/cultivation/*` and new `tests/cultivation-birth.test.js`.

先添加有意义的失败测试，再实现 CV2 开局、严格校验、取名/重掷/入世、真实属性天赋效果、CV2 轮回开局。公开 creation / attributes / talents / priorTranscript，增加严重风险 warning；确保旧 CV1 确定性测试不变。不得修改控制器或 UI 文件。

## Task 2 — 纯界面与样式

Owner: immersion_ui. Files: `src/ui/journey.js`, new `src/ui/character.js`, `src/ui/paper.css`, new `tests/immersive-renderers.test.js`.

先添加渲染行为测试，再实现当前剧情收拢、历史抽屉正文、紧凑固定状态栏、人物详情、取名掷骰开局和中文对话标点。用 spec 中接口，不修改应用控制器或既有测试文件。

## Task 3 — 应用集成

Owner: root. Files: `src/app.js`, `tests/helpers/app-harness.js`, application/renderer assertions in existing UI tests, new integration tests as needed.

将新开局设为显式新游戏默认；接入输入与重掷/入世动作，保证姓名编辑不反复重绘、不丢焦点；增加只读抽屉、Escape/返回焦点；更新帮助和设置文案；保留原有恢复与旧版引擎路由。用实际应用入口测试新建、保存、导入、重复动作和只读查看。

## Task 4 — 复核与交付

独立检查三个任务的规范符合性和代码质量，修复实际缺陷。运行完整测试/check/release，更新版本 3.1.0 和文档。通过 Git Data API 基于真实远程 main 提交并合并，等待 CI；构建使用真实合并 SHA，部署既有 Worker。实际页面验证取名、掷骰、刷新、入世、人物详情、历史与对话，并记录截图和验证范围。

## Review Focus

CV1 随机序列、CV2 只结算一次、创建中严校验、诞生与轮回时间、输入法/空姓名/刷新恢复、读档不重掷、正文与历史不重复、抽屉焦点、可见危险与可访问性。
