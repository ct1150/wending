# 归航者实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 主代理修改，子代理仅只读审查。

**Goal:** 完成四幕有持续人物冲突和实际后果的故事，推进完整冒险而不宣称20小时已验收。

**Architecture:** 单独 homebound.js 负责本章规则/正文/校验；沿用行动收据、地图实体与完整档案重放。没有新平台或模型依赖。

**Tech Stack:** JavaScript ESM、Node tests、Chrome/IndexedDB、现有静态构建。

**Spec:** docs/superpowers/specs/2026-11-18-homebound-design.md

## 约束与重点

旧存档、原路线及资源/RNG不重写。每页最多三选项。所有费用和移动实际结算，退出不刷取部件，调查不决定唯一正确答案。重点检查高境直接连续做不虚构时间、旧 crossing 历史变体、船上不能免费回训练、解封不能恢复旧图收益、死亡保留未完成。

## 1. 完整故事和规则

- [x] 新 tests/homebound.test.js 用真实组合 fixture 走到上界高境，缺少入口的断言先红。
- [x] 新 src/game/cultivation/live/homebound.js：homeboundNode/validateHomebound/homeboundPlaces，四幕、调查、承诺/合作、路线、解封、退回/重返和三结局。
- [x] events.js 字段与节点，event-content.js 实体/路由/港外菜单，journey-notes.js 邀请及续行；live-archive.js 精确旧 crossing 兼容。
- [x] 原生两条对照路线及非法日期/幕/地点/无资源/寿尽边界测试通过；差异落在实际费用或选项。零资源仅为局部行动规则边界验证。

## 2. 保存与完整验收

- [x] 用固定5a9c838真实 crossing 旧档 ready/pending验证；新幕付费 pending、调查、中途退出、解封和结局重放。
- [x] 原1221回合路线仍可实际执行；新线接入该原生高境人物，浏览器验证自然寿尽与轮回不继承私人约定。另有化神原生人物门槛测试，尚非四境交错的单次完整浏览器路线。
- [x] 最终相关测试、构建、diff与来源哈希检查；独立目录手机操作验收，保存中途档，保留旧包。
- [x] 记录范围、失败及未证实20小时限制，仅提交本次相关文件。

## 结果

规则7/7，最终档案2/2（含重算哈希后的伪造拒绝），相关筛选回归3/3。旧fixture生成1/1；手机四幕流程及中途/最终导入刷新通过。已修正短工期、删除结局、早期seed菜单兼容和承诺生效提示。不发布生产，不声称全项目测试或20小时真人体验已通过。
