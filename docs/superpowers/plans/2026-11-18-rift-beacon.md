# 回风孤标实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. All edits by the main agent; subagents may only review read-only.

**Goal:** 把风隙再访接成有调查、变风、修路与实际回程的连续探索；仍向完整20小时冒险目标推进，不用回合数替代验收。

**Architecture:** 复用现有规则事件、行动收据与档案重放。新内容和校验放在独立 `rift-beacon.js`；旧风隙记录不变，只增加一个向前的入口。没有新通用剧情引擎或存储层。

**Tech Stack:** JavaScript ESM、Node test、现有规则引擎、Chrome/IndexedDB、现有静态打包器。

**Spec:** `docs/superpowers/specs/2026-11-18-rift-beacon-design.md`。本章已实施，具体覆盖与限制见文末；总目标仍未验收。

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

- [x] 从真实组合 fixture 走至完成风隙再访，构造起行断言并先运行失败测试。基线没有 `beacon-book` 选项。
- [x] 覆盖两种有效形态、入口成本、`start+5` 抵达边界、缓慢撤回、两种工程改变实际回程边。四组合矩阵和零资源边界是局部规则测试，不冒充原生冒险。
- [x] 实现有始有终的完整篇章，包含实际回程与交割。
- [x] 新字段加入 `events.js` 白名单与节点列表；路由 `sky-beacon-*`；风隙总结增加第三个入口。校验日期、地点、前置与字段。
- [x] 新增规则测试通过；原生单侧早到、双侧晚到均按真实库存和行动收据验证。

## 2. 已有人生、日历与保存

**Files:** 修改 `src/game/cultivation/live/journey-notes.js`、`practice-plan.js`（仅若需要变风提醒）、`src/game/live-archive.js`；扩展上述测试，新增前版本真实 fixture。

- [x] 从固定 `a0ac265` 独立源码生成旧两选项页的原生 ready 与 pending 导出，保存在压缩 fixture。
- [x] 完整场景比较后映射 `beacon` 旧页变体，旧 pending 原样恢复；改写旧正文且重算哈希的伪造仍拒绝。
- [x] 加入行记与软变风提醒；邀请只读；付费行动不能自动导航代做；非岸边须真实返岸。
- [x] 移动 pending、调查后、修路后、交割后档案恢复一致且不重复结算；手机流程另外验证导入刷新与闭关后新风候。
- [x] 局部寿尽中断边界和完整人生自然寿尽分别验证，子代不继承私人章节，保留父代档案可读。

## 3. 完整可玩验收

**Files:** 必要时扩展 `tests/combined-adventure.test.js` 或新增独立延长路线 fixture；更新 README 与游玩指南，新增本轮证据目录。

- [x] 原1009回合路线仍完整；新增1221回合原生路线完成本章、问鼎、自然寿尽与轮回。
- [x] 新目录 `rift-beacon-v3` 保留旧包，360×760 浏览器操作探路→回山→恢复→变风→修路→返岸交割。慢退由规则测试验证。
- [x] 相关规则、场景、档案、构建与静态检查完成；只读审查发现的问题已由主代理复核修正。
- [x] 记录结果和限制，提供可玩包与中途档；不把回合、日历或自动测试时间算作真人时长。

## 当前状态

本章已完成本地实现与验证，尚未部署生产。证据见 `docs/evidence/2026-11-18-rift-beacon/README.md`，新可玩包为 `/rift-beacon-v3/`。最终规则测试10/10；档案和两条完整人生3/3；相关回归15/15；无专修术式新增路线1/1。最后两处提示修正后重跑规则与最终手机包，没有重跑整个项目测试集。

1221回合比旧路线增加的212回合还包含真实资源筹备与突破重试，不等于212次新增剧情决定，更不等于20小时内容。真人体验仍待验证；总目标保持进行中。
