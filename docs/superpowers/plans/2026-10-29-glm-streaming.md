# GLM Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. The main agent implements all tasks; subagents are read-only reviewers.

**Goal:** 接入 Cloudflare GLM 主服务、智谱免费备用及可恢复的流式剧情预览。

**Architecture:** 复用现有完整场景校验、协调器和存档事务；增加服务端主备流式传输及客户端临时预览。保留旧 Qwen 和 JSON 路径，不复用旧模型晋升证据。

**Tech Stack:** 原生 ESM、fetch、ReadableStream、Cloudflare Workers、node:test、Playwright；不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-29-glm-streaming-design.md`

## Global Constraints

- 主代理完成所有文件修改；不覆盖现有测速证据。
- `ZHIPU_API_KEY` 仅在服务端，固定免费备用模型和官方地址。
- 正式状态只在完整验证与原 CAS 成功后推进一次。
- 当前无真实 GLM 验收，不伪造 verified 状态，不切换正常玩家流量。临时 0% 测试版本只供带凭证的测速请求；结束后恢复原生产版本。

## Review Focus

- 半段 UTF-8、转义字符串、思考或工具调用不得污染预览或正式结果。
- 换源和迟到主服务响应不得拼接正文或重复提交。
- 备用与未知主调用计量不能把 unknown 改成已知完成。
- 流中断、旧客户端、缓存重放和跨标签页仍沿原身份和恢复约束。
- 正文更新保持焦点、滚动和已打开的历史面板。

## Task 1: GLM 主备传输与候选配置

- [x] 在 `tests/glm-provider.test.js` 写分片、备用、超时、上限及身份校验测试，实际观察失败。
- [x] 在 `src/worker/story-glm-provider.js` 实现固定主备传输；`src/worker/story-provider-core.js` 复用最终校验并识别 4006；`src/worker/story-config.js` 新增独立 GLM candidate，保留历史 registry。
- [x] 在 `src/game/cultivation/live/story-preview.js` 提取完整业务功能：从部分 JSON 中只读取正文字符串。
- [x] 运行新测试及现有 provider/schema/production 定点回归。

## Task 2: POST SSE 与一次结算

- [x] 在 `tests/story-stream.test.js` 写预留先于推理、预览先于最终结果、重复请求重放和 unknown 计量测试，观察失败。
- [x] 修改 `src/worker/story-api.js` 协商 SSE，保留 JSON 和缓存 GET。最终结果仍经原校验与结算。
- [x] 修改生产组合与构建身份，允许明确选择已验证的 GLM，声明备用 secret 名称而不序列化值。
- [x] 运行 API、预算、生产和构建定点回归。

## Task 3: 浏览器预览与本地开场

- [x] 新增客户端与浏览器行为测试，实际观察失败。
- [x] 修改 `src/ui/story-client.js` 和 `src/ui/live-session.js`，解析有界 SSE 和维护暂态 preview；最终结果沿原提交。
- [x] 修改 `src/ui/journey.js`、`src/app.js` 和必要样式：本地开场、动作回显、纯文本局部更新和失败状态。
- [x] 运行流式、实时存档、首页与浏览器定点回归。

## Task 4: 验证与交付

- [x] 检查 diff、执行直接相关测试、语法检查和构建；改动覆盖前后端后运行完整测试。
- [x] 只读独立审查并定点复核重要结论，修复有证据的问题。
- [x] 检查 secret binding 名称并尝试受限真实验收；遇平台拒绝保留证据，不伪造成功。
- [x] 更新部署说明，报告实际通过项、未配置项和真实运行限制。

## 实际验证与限制

已完成本地代码、回归和真实调用尝试。相关测试 169/169、追加协议回归 49/49 通过；Windows 全量 859/870，通过 WSL 26+58 项定点复验覆盖全部 11 项 Windows 失败。语法检查 166 文件和前后端构建通过。真实智谱响应 429/1305，未取得成功生成和速度样本；GLM 未晋升、未发布新前后端、预加载未启用。临时 0% 测试已撤除，保留用户新配置的密钥绑定。

## Task 5: 续测与协议适配（同日后续结果）

- [x] 归档真实失败场景，按错误证据增加 GLM 短引用、角色分组和服务端选项文字；保留最终业务校验。
- [x] 核验实体/记忆编号碰撞、原文不变和已知身份边界；新增真实开局与续章回放测试。旧 Qwen 回归通过。
- [x] 提供 `scripts/story-latency.js`，区分可读正文、完成、阅读追上流和读完后等选项；失败样本不计为可玩。
- [x] 私有浏览器连接真实 API/SQLite，完成两回合保存与刷新；记录测试脚本的修正和实际平台繁忙。
- [x] 执行当前定点测试、语法与构建；Windows workerd 崩溃项在 WSL 复验。
- [x] 根据成功及长尾样本记录预加载判断，保持未启用；恢复原生产版本、保留密钥并删除本地临时测试凭证。

续测证据见 `docs/evidence/stream-speed-2026-10-29/glm-followup-summary.json`。上节为首次验收的历史结果；当前已取得有效剧情与浏览器闭环，但 Cloudflare 主服务仍拒绝准入，新 GLM 未晋升或切换正式流量。

## Task 6: 智谱主路由与正式发布

用户已授权改变顺序并发布；沿用单次切换、最终校验和存档事务，保留 45 秒主调用窗口及 90 秒总期限。

- [x] 先观察反向路由测试失败，再实现智谱主路由、Cloudflare 备用及失败计量边界。
- [x] 记录 providerRoute；复现并修复生产网关被旧频道 HTML 覆盖，固定同一次构建页面。
- [ ] 保存最新真实模型和浏览器证据，审查可发布状态并晋升已验证主路由。
- [ ] 完整验证、真实源码提交、GitHub 检查和前端频道发布。
- [ ] 从最终 main SHA 显式打包正式后端，先 0% 核验精确包，再切正式流量。
- [ ] 核对模块/绑定/health/HTML/API，公开浏览器完成开局、选择、保存与刷新；保留回滚基线。
