# 智谱单并发优化与上线 Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans；所有修改由主代理完成，子代理仅只读核验。

**Goal:** 消除站内智谱请求主动重叠，平台真实可用后直接完成已授权发布。

**Architecture:** 复用全局 StoryBudget SQLite 的账户租约，transport 有界等待并按上游业务码冷却；API 传入内部 gate，沿原 SSE 和结算边界。

**Tech Stack:** 原生 ESM、node:test/SQLite、Cloudflare Workers/现有 Durable Object，无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-29-glm-streaming-design.md` 的“智谱单并发优化与直接发布”。

## Global Constraints

- 并发 1、等待最多 10 秒、轮询 1 秒、准入 RPC 最多 2 秒、主调用 45 秒、总期限 90 秒。
- 正常完成间隔 1 秒，1302 冷却 5 秒，1305 冷却 15 秒；不明确结果保留 120 秒租约。
- 原 namespace、账本、存档和秘密绑定保留；无自动重试或预加载。
- 复用当前候选分支 `release/zhipu-primary`，保留已有诊断文档，不另建或切换工作区。

## Review Focus

- 旧 owner 迟到释放、新实例重启和两个玩家同时准入。
- 队列超时或预算服务错误不得绕过 gate、重复推理或超出总期限。
- 主服务超时后仍占用上游资源，备用成功不能释放未知主调用租约。
- 业务码解析有界，供应商原文及凭据不进入 SSE/存档。
- 正式包使用新 DO 方法，前后端身份一致，已验证证据才可晋升。

## Task 1: 全局准入、冷却和 SSE 接入

Files: `src/worker/story-budget.js`, `index.js`, `story-glm-provider.js`, `story-provider.js`, `story-api.js`; `src/ui/story-client.js`, `journey.js`；对应 tests。

Interfaces: `acquireProvider({owner})` 返回 acquired/owner/expiresAt 或 waiting/retryAt；`releaseProvider({owner,outcome})` 只接受 complete/rate-limited/overloaded/unknown；transport runtime `providerGate` 使用这两个内部接口，`queueTimeoutMs` 仅测试可注入。

- [x] 写 SQLite 排他/重启/旧 owner/冷却/未知占用测试，运行观察失败。
- [x] 实现最小事务租约；把内部方法接到现有 DO binding。
- [x] 写真实协调器配合 transport 的并发/等待/超时/业务码/总期限测试，运行观察失败。
- [x] 实现有界错误读取、等待及 finally 释放，API 注入 gate，客户端接受并显示 queued。
- [ ] 定点测试、diff 检查及必要完整回归/构建，提交优化代码。

## Task 2: 真实验收与发布

- [x] 独立只读核验关键并发/状态和发布包，主代理定点复核并修复重要问题。
- [ ] 受保护私有版本复测极小请求和完整开局、选择、保存/刷新及速度；失败不算可玩样本。
- [ ] 当前真实成功后更新证据并晋升；提交并核验候选 CI，合并已授权 PR，发布前后端。
- [ ] 回读线上绑定、版本、health/HTML/API；公开浏览器验收并清理临时访问凭证。

## Execution ledger

- 已有候选 f542144 完整 CI 907/907；这不是本次新增优化的验证结果。
- 用户授权主代理在当前任务实现并在验收通过后直接发布，无新增确认步骤。
- 原生 workerd 定点 30/30，当前完整影响范围 171/171；核心回归 70/70。首轮全量 917 项中 915 通过、1 失败、1 超时取消，失败处为浏览器动态导入及千回合超时，两文件隔离重跑 16/16。最终提交仍需当前源码 CI 完整核验。
- Final: fixed RPC 挂起、迟到备用、错误冷却、缺失 gate 和旧 SSE 状态兼容；已观察对应回归先失败后通过。未知状态重放及迟到预留也有回归覆盖。
- Ruling: 使用临时独立 SQLite 验证资源解决 0% 版本调用旧 DO 的事实限制；不改变生产 namespace。原生线上准入取得 acquired/waiting/released，测试后删除资源。风险是隔离环境不能替代发布后原 namespace 的实际类方法验收。
- 当前 15:10、15:15、15:30 智谱极小/流式请求均为 1305；15:35 新准入代码真实开局正确切 Cloudflare 并以 4006 暂停，无剧情成功样本，未晋升或发布。
