# 回风孤标实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. All edits by the main agent; subagents may only review read-only.

**Goal:** 把风隙再访接成有调查、变风、修路与实际回程的连续探索；仍向完整20小时冒险目标推进，不用回合数替代验收。

**Architecture:** 复用现有规则事件、行动收据与档案重放。新内容和校验放在独立 `rift-beacon.js`；旧风隙记录不变，只增加一个向前的入口。没有新通用剧情引擎或存储层。

**Tech Stack:** JavaScript ESM、Node test、现有规则引擎、Chrome/IndexedDB、现有静态打包器。

**Spec:** `docs/superpowers/specs/2026-11-18-rift-beacon-design.md`（实施前完整阅读）。本文件尚未实施，所有清单保持未勾选。

## 全局约束

- 沿用免费 CF 单路由和显式可选扩写；探索不调用模型，不预加载。
- 旧云渡/风隙/试航记录、资源、修为、RNG和原始存档格式不重写。
- 读图不付费、不变 RNG；位移、调查、修路、回程使用真实日数和代价。至多三个选项。
- 正常旧路线仍可问鼎，不接新章不受罚；成功、撤回、死亡必须区分。
- 保留其他修改与历史证据，可玩包使用新目录；本章未经实际验证不发布。

## 重点审查

预计抵达日跨过变风边界；有效形态是旧 anchor 与 ending 的组合；资源耗尽时可退；新工程没有在旧航次中追溯生效；旧 ready/pending 精确重放。分别纳入下面的规则、原生与兼容测试。

## 1. 路线与规则

**Files:** 新增 `src/game/cultivation/live/rift-beacon.js`、`tests/rift-beacon.test.js`；修改 `events.js`、`cloud-passage.js`、`cloud-rift.js`（均在 `src/game/cultivation/live/`）。

**Interfaces:** 模块提供 `validateRiftBeacon(events,life)` 和 `beaconNode(state,menu,choice)`。只有 `riftBeacon` 持有新章进度；旧 `cloudRift` 只读。节点按 spec 的四个地点、当地调查/路线页和结局分开，先选最少字段，再将精确结构写入测试，勿先引入复杂图引擎。

- [ ] 从真实组合 fixture 走至完成风隙再访，构造起行断言并先运行失败测试。基线不应已有 `beacon-book` 选项。
- [ ] 编写两种有效形态、入口成本、`start+5` 抵达边界、缓慢撤回、两种工程改变实际回程边的失败用例。构造状态仅用于非法输入边界，不用于冒充原生冒险。
- [ ] 实现有始有终的完整篇章，包含实际回程与交割；不是只做菜单入口或未完成第一幕。
- [ ] 新字段加入 `events.js` 白名单与节点列表；在 `cloudPassage` 路由 `sky-beacon-*`；风隙总结增加第三个入口。明确处理不满足前置、日期逆序、到访缺失、重复交割和未知字段。
- [ ] 运行新增规则测试，补原生两条路线：先看单侧早到；双侧调查晚到。原生库存来自实际备办，费用按收据逐项断言。

## 2. 已有人生、日历与保存

**Files:** 修改 `src/game/cultivation/live/journey-notes.js`、`practice-plan.js`（仅若需要变风提醒）、`src/game/live-archive.js`；扩展上述测试，新增前版本真实 fixture。

- [ ] 从固定 `a0ac265` 独立源码生成已经完成风隙再访、停在旧两选项页的原生导出，包含 ready 与真实待续请求；不得手写假旧档。
- [ ] 沿用 live-archive 的完整历史场景比较方式增加必要的 `beacon` 旧页变体。旧选项先恢复，不把新字段塞进旧 pending；修改过正文或选项的旧档仍拒绝。
- [ ] 起行后加入行记与变风提醒；新邀请只读，自动翻页不能替玩家调查、付费移动或收队。返回非岸边时必须真实走回岸边。
- [ ] 在移动 pending、调查后、修路后、交割后导出/新库导入/刷新，验证状态哈希及只结算一次。回山修炼后回来确实进入新风候。
- [ ] 验证寿尽中断不交割、不发收益，轮回不继承私人章节，旧档仍可读。

## 3. 完整可玩验收

**Files:** 必要时扩展 `tests/combined-adventure.test.js` 或新增独立延长路线 fixture；更新 README 与游玩指南，新增本轮证据目录。

- [ ] 原1009回合组合回归保持可通，增加从原生角色进入新章到问鼎的真实连续路线；检查不接章也能继续。
- [ ] 用已有构建命令生成新静态包到新的试玩目录，旧目录不覆盖。实际移动端宽度试玩：探路→回山→恢复→变风→修路/缓退→交割；核对费用与页面内容。
- [ ] 运行与改动对应的规则、场景、档案测试和静态检查；检查 diff，只提交本章相关文件。需要审查时仅派只读代理，主代理复核关键证据。
- [ ] 记录实际运行结果与限制，提供可玩入口和中途档。本章不预先指定“几小时”，不得把脚本耗时、走路日数或新增节点数写成20小时真人验收。

## 当前状态

只有设计与证据已形成，以上实施任务均未完成。不得据本计划宣称新增探索已可玩。当前可玩包仍为 `/combined-life/`，运行时为 `a7ded3d`。
