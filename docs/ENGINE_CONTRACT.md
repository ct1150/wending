# 3.0.0 / v4 cultivation 引擎契约

完整字段与作者格式见 [人间求仙篇设计](superpowers/specs/2026-10-25-cultivation-design.md)。

## 公开边界

createCultivation({seed?})创建可验证的新人生。getCultivationView(state)返回复制视图，不推进随机或时间。chooseCultivation(state,{revision,sceneId,choiceId})返回applied、stale或unavailable及state/message。旧请求不重复执行。

validateCultivation检查已知场景、有限状态、原始值事实、数值边界、历史、时间与阶段一致性。serializeGame / deserializeGame按版本分发。

## 原子选择

验证状态、修订、场景、条件和物品后，只对副本扣成本、推进历时、应用成果。余寿不足则在取得成果之前寿尽。最终验证与容量检查成功才提交，失败保留原状态、随机和资源。

## 时间与成长

一年360日。ageDays从5760开始，world.day从360000开始。历时同增，燃寿仅增加lifeDamageDays。余寿为lifeLimit*360-ageDays-lifeDamageDays。

完整功法与多年修习约束引气；炼气积累、伤势、灵物或温养约束筑基。寿限从72变为180，不能因普通交接发境界。

## 一世与下一世

真正结束才记录一次生平，摘要含收获和教训。下一世world.day加5760、generation加一，个人重置，最多携一项已得方法。出生确定机会，查看不重抽。

世界事实作为后果保留，私人关系不自动继承。当前行文与有界生平分开，不复制全部历史。

## 兼容

旧v3合同见 [ENGINE_CONTRACT_V3.md](ENGINE_CONTRACT_V3.md)，v1/v2见 [ENGINE_CONTRACT_V2.md](ENGINE_CONTRACT_V2.md)。旧人生不强制映射成新篇。旧迁移备份的原档与checkpoint只接受v1/v2，prepared只接受其既有v3目标。
