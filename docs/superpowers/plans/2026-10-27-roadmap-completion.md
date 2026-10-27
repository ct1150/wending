# 问鼎剩余规划实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 完成审计中的新开局、不同人生与三界、免费模型创作及自动发布，并以证据回填待办。

**Architecture:** v4/contentVersion 3 独立规则和内容，经现有 cultivation 接口分发；旧版本模块冻结。模型只提供离线文字候选，发布以经过验证的静态发行包为单位。

**Tech Stack:** 原生 JavaScript ES modules、Node >=22、node:test、既有单文件 bundler、GitHub Actions、现有 Cloudflare Worker。

**Spec:** `docs/superpowers/specs/2026-10-27-roadmap-completion-design.md`

## Global Constraints

- 原生 JavaScript、Node.js >=22、零浏览器运行时依赖；浏览器模块只使用相对路径的静态具名 import/export。
- 存档仍使用 `baishi-wending-save-v1`；保留 v1/v2/v3 和 v4 CV1/CV2 的规则、随机序列、导入导出及旧人生。
- 新存档 envelope 仍是 version 4、mode cultivation、contentVersion 3；旧记录不自动升级。
- 所有动作验证 revision 与 sceneId；失败不扣费、不推进时间或随机状态；读取、刷新和查看抽屉不抽随机。
- 完整历史不静默截断，继续使用 1,000,000 JavaScript 字符的存档边界。
- 选项通常 2–3 个；缺条件、伤势、折寿与确定死亡需选择前可见；数值细节放人物抽屉。
- 游戏和离线包不携模型 API key，不要求玩家联网调用模型。

## Review Focus

- 旧档在读写和转世后依然保持原内容版本及随机序列（Task 2）。
- 伪造解锁、错版本字段、非纯 JSON 描述符、负物品与不一致年月被拒绝（Task 2）。
- 随机出身/命格组合不会软锁；危险和寿尽不能先领突破成果（Tasks 2–3）。
- 模型错误、未知场景与状态矛盾不能污染规则或已接受内容（Task 4）。
- 发布竞态、损坏包、GitHub 不可达、旧缓存不会让 health 和实际 HTML 身份不一致（Task 5）。

### Task 1: 将审计整理为 Git 待办

**Files:** `docs/ROADMAP.md`、本计划、本设计。
- [x] 整理最新目标、依赖、验收和历史基线。
- [ ] 提交并同步远端分支，建立本轮 PR；后续更新账本。

### Task 2: CV3 新规则、出身和双命格

**Files:** `src/game/cultivation/{engine,validation,legacy-engine,legacy-validation}.js`；`src/game/cultivation/v3/{model,birth,engine,validation,contract}.js`；`src/ui/character.js`、`src/ui/paper.css`、`src/app.js`；`tests/campaign-birth.test.js`、`tests/campaign-save.test.js`、`tests/campaign-app.test.js`。

**Interfaces:** 保留现有四个 cultivation 公共函数；`createCultivation({contentVersion:3,characterCreation:true,seed,name})` 创建新人生。命令保留 revision/sceneId/choiceId，并新增 originId/talentId。view 保留现有结构，creation 增加 origins/originId/lockedTalentId/attributeBudget，talents 为两项。

- [ ] 先写四出身、总点数12、两项不同命格、锁定一项、失败原子性、持久化及旧 CV 回归测试，并观察失败。
- [ ] 冻结内容契约；旧实现移动为 legacy 模块，仅改变导入路径；新模型/验证/引擎独立实现。
- [ ] UI 展示身份钩子和双命格、锁定动作，资质放次级详情；接入新推荐开局，保留旧人生。
- [ ] 运行定向测试与全套回归，独立审查并提交。

### Task 3: 非药谷主线、不同人生及高阶三界

**Files:** `src/game/cultivation/v3/content.js`、`src/game/cultivation/v3/chapters/*.js`、`tests/campaign-content.test.js`、`tests/campaign-routes.test.js`。

**Interfaces:** 使用 Task 2 目录、条件/效果契约，纯 `resolveCultivationScene(state)`；不能在内容解析中抽随机或修改状态。

- [ ] 先写真实公共路径测试：四开局、八命格机会、组合后果、三条人间发展、逐级突破、三界成就、寿尽及再世，观察失败。
- [ ] 写至少100个有实际选择的可达场景；正常问鼎路线至少55个选择；每个出身有独立人物冲突与两条策略。
- [ ] 覆盖宗门、散修、遗址、异兽、海域、幽冥、天界与个人关系，去除药谷中心；关键前世后果改变后来行动。
- [ ] 模拟多个种子、流派与后世，验证无软锁、可解释风险和路线差异；独立审查并提交。

### Task 4: 免费模型离线剧情创作工具

**Files:** `scripts/story-author.js`、`scripts/story-author/*.js`、`src/game/cultivation/v3/prose.js`、`docs/STORY_AUTHORING.md`、`tests/story-author.test.js`、package scripts。

**Interfaces:** `brief` 导出真实场景简报；`generate` 输出候选；`preview` 输出可读文字；`accept` 在再次校验后更新静态文字包。默认 Ollama；密钥仅来自环境变量。

- [ ] 测试 JSON/字段/ID/长度/超时/截断/失败回退/接受原子写入，观察缺失功能失败。
- [ ] 实现本地 Ollama 和可选兼容传输、严格文字 schema、预览和明确接受；引擎规则字段不可写。
- [ ] 验证真实可用端点（环境允许时）、记录实际模型和结果；没有真实推理就保留明确未验证标记。
- [ ] 构建离线包、确认无密钥/运行时请求；独立审查并提交。

### Task 5: 自动发布

**Files:** `.github/workflows/validate-deploy.yml`、`scripts/publish-release.js`、`scripts/build-worker.js`、`tests/release-channel.test.js`、`tests/worker.test.js`、`docs/DEPLOYMENT.md`。

**Interfaces:** manifest 含 version、sourceCommit、htmlSha256、字节数和同仓库不可变 artifact 路径；Worker `/healthz` 反映实际服务快照。

- [ ] 确认可用授权路径；本轮采用已审方案，不能用不存在的凭据宣布接通。
- [ ] 先测试 manifest/摘要/路径验证、切换原子性、远端不可用回退、health/HTML一致性。
- [ ] 配置 main 检查成功后自动发布发行包；只在发布 job 赋予 contents:write；其他分支/PR不能发布。
- [ ] 更新现有 Worker，真实执行一次 main→发行→线上更新，记录 SHA/摘要/流水线。

### Task 6: 整体发布验收

**Files:** `README.md`、`docs/{ROADMAP,PROGRESS,QA_REPORT,PRODUCT_SPEC,DEPLOYMENT}.md`、package version。

- [ ] 完整 release、旧版回归、独立整分支评审及必要修复。
- [ ] 实际桌面/窄屏/键盘/存档/离线浏览器验证，记录具体范围。
- [ ] 合并并核对 CI、线上 sourceCommit、下载摘要及实际新生/完整路线。
- [ ] 回填每项完成证据；真人计时、物理设备或外部授权仍缺的项目明确标为未验收，不以估算冒充。
