# 整备去处实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans；主代理修改。

**Goal:** 玩家直接翻到所需物资或手艺，把后续选择留给实际行动。

**Architecture:** 在既有 journey-notes 中派生允许的整备目的地，noteRoutes 支持明确页码与独立目的地ID。live-session 重新核对目的地并执行原菜单链。journey UI 使用原行记按钮协议，不修改事件引擎或档案。

**Tech Stack:** JavaScript、Node tests、Chrome/IndexedDB、静态试玩包。

**Spec:** `docs/superpowers/specs/2026-11-18-preparation-navigation.md`

## 约束

保留全部旧选择和历史。只导航，不替玩家付费或应约。取消、换档、旧修订、待续均使用现有事务保护。不得越过故事现场。自动时长不证明20小时。

## 任务

- [x] 在 tests/preparation-navigation.test.js 写失败用例，覆盖多个材料/配方页、当前位置与不可达现场；修改 journey-notes.js 完成安全寻路。
- [x] 在 tests/preparation-navigation-browser.test.js 验证 session 允许列表、真实菜单不改变生命/RNG/承诺、实际行动与保存恢复；修改 live-session.js 接入目的地。
- [x] 修改 journey.js 添加折叠目录，核对手机按钮、同页/不可达/忙碌状态与导入刷新；必要时只调整该目录样式。
- [x] 运行相关行记回归、检查diff；提供新独立试玩目录、证据与提交。保留旧目录和其他修改。

结果：新规则3/3、新浏览器2/2、相关行记5/5；旧化神档手机点选16步原菜单，随后真实搜寻、导出、全新上下文恢复及刷新通过。沿用安全暂缓语义；20小时真人体验仍未验证。证据位于 `docs/evidence/2026-11-18-preparation-navigation/`。
