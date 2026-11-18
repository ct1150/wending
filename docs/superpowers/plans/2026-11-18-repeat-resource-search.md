# 普通备料的连续搜寻

> **For agentic workers:** Use superpowers:executing-plans. Main agent edits only.

**Goal:** 减少长线备料时没有决策意义的返回菜单，保留每次搜寻的实际风险、成本和保存。

**Architecture:** 普通resources的gather进入action-result后，用gather-again替换第一项继续回山；仍留train-menu及原来的备粮/事务入口。沿用explore/cautious规则，不增加循环执行、收益或新存档字段。旧结果页精确匹配后恢复原按钮。

**Tech Stack:** 现有JavaScript、node:test、IndexedDB、Playwright离线包。

## 现场证据与边界

61e74ce离线包Chrome360实际操作，已备中界档313进入灵石搜寻，三次搜寻结束331：首次在物资页一次点击，随后每次均6次（continue→journey-menu→resources-menu→next-resource×2→gather）。灵石50→74；模型请求0。真实旧结果存档为`tests/fixtures/61e74ce-resource-result.jsonl.gz`，原按钮continue/train-menu/ration-book。

只允许上一动作确为gather/gather-again且explore/cautious的同一目标；不把hunt、矿硐、井路、河事等奖励重复化。首次采药进入herb-basket的既有剧情保留。旧结果页仍能按原continue返回；下次普通搜寻出现新按钮。新增按钮每次单独点击、单独随机结算和提交，库存满/缺粮/境界/寿尽等规则不变。缺货、受伤或期限风险仍在行动前显示，可从修行页恢复或退出。

## 验收

- [x] 原包实际记录重复菜单数，保存真实旧结果fixture。
- [x] 先验证同样起点下直搜与原菜单路径的生命状态、资源、随机数、实际天数一致，再实现按钮和历史兼容。
- [x] 验证库存/伤亡等边界、非普通任务排除，真实旧页/待续重复动作只结算一次，存档导入刷新。
- [x] 针对回归、构建新不可覆盖离线包；实测重复点击数，检查diff后提交。

## 实际结果

首次两个定向测试为一失败一通过；实现后均通过。最终event-story为24/24，真实旧档及待续重复动作定向测试1/1。三个相关文件的整批回归为110/111；唯一失败是炼丹测试仍点击新结果页已替换的continue。修正其免费导航路径后，该测试单独重跑1/1通过；没有重新宣称整批111/111。边界测试中的满库存、寿尽和重伤为明确构造的规则输入，不是原生游玩记录。

Chrome 360宽真实操作：旧331回合保留原返回按钮，下一次普通搜寻之后出现重复按钮；四次搜寻点击数为6/1/1/1，共经过360日、获得24灵石，最终340回合。1078384字节导出档重新导入并刷新后状态哈希一致。没有模型调用、页面错误或横向溢出。三次重复操作本地耗时105/97/107ms，仅为本次样本，不是性能保证。

不可覆盖候选：http://127.0.0.1:4176/gather/ ，目录`D:/tmp/wending/试玩版/d987a49/gather`。成品SHA256为`66c1706c0a4129a24cd377d38b64526d1019c5c9b467ec50ca72e9f2e39e2106`。隔离构建、五个修改JS语法检查和diff检查通过，六份打包输入与工作区哈希一致。详细日志保留在本地`.scratch/gather-*.log`及`gather-package-manifest.json`。

此改动不降低备料总成本、不把重复劳动充当20小时内容，也不证明真人游玩时长。仅本地候选。
