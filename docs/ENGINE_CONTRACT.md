# 3.1.0 / v4 cultivation 引擎契约

完整字段与作者格式见 [人间求仙篇设计](superpowers/specs/2026-10-25-cultivation-design.md)。

## 公开边界

createCultivation({seed?})保留 contentVersion 1 兼容语义，创建已经入世的人生。应用显式调用 createCultivation({seed?, characterCreation:true, name?}) 创建 contentVersion 2 的 creating 开局。getCultivationView(state)返回复制视图，不推进随机或时间。chooseCultivation(state,{revision,sceneId,choiceId})返回applied、stale或unavailable及state/message。旧请求不重复执行。

validateCultivation检查已知场景、有限状态、原始值事实、数值边界、历史、时间与阶段一致性。serializeGame / deserializeGame按版本分发。

## 取名、掷骰与入世

CV2 的 life.birth 保存三项 1–6 属性、一个已知 talentId 和 rollCount。初始依旧先抽三次本世机缘，再抽四次天资；birth-reroll 只抽四次天资，不能改变已定机缘。birth-name / birth-start 不抽取随机、不推进岁月。三个命令均需要当前 revision、sceneId；入世只能结算一次起始物资。

姓名归一化前拒绝控制符与换行，首尾普通空白可去除，实际保存姓名为 1–24 个 UTF-16 字符。创建期必须是十六岁凡人、原始伤药/零灵石、没有当世正文或奖励；首次人生也不能假托前世正文。已入世 CV2 必须存在真实 arrival 入场记录。旧 CV1 不要求新增字段且保持原随机序列。

根骨在已有疗伤效果上增加 floor(value/3) 级恢复；悟性在首次成功进入炼气时增加 floor(value/3) 修为；气运在入世时增加 floor(value/3) 灵石。备药、草木缘、心静、善调息分别增加伤药、灵草、首次炼气积累、已有疗伤效果。修为最高 6，伤势最低 0。所有必要功法、耗时、伤势门槛、资源与必死结果照常生效，不免费授予技能或传承。

getCultivationView 提供 creation 和 summary.attributes / talents；CV1 的属性与天赋数组为空。公开 choice.detail 保留兼容，界面只显示 label、不可选 reason 和已知严重风险 warning。当前与前世 transcript 分开提供，阅读与抽屉不改变状态。

## 原子选择

验证状态、修订、场景、条件和物品后，只对副本扣成本、推进历时、应用成果。余寿不足则在取得成果之前寿尽。最终验证与容量检查成功才提交，失败保留原状态、随机和资源。

## 时间与成长

一年360日。ageDays从5760开始，world.day从360000开始。历时同增，燃寿仅增加lifeDamageDays。余寿为lifeLimit*360-ageDays-lifeDamageDays。

完整功法与多年修习约束引气；炼气积累、伤势、灵物或温养约束筑基。寿限从72变为180，不能因普通交接发境界。

## 一世与下一世

真正结束才记录一次生平，摘要含收获和教训。下一世world.day加5760、generation加一，个人重置，最多携一项已得方法。出生确定机会，查看不重抽。CV2 轮回先进入新的 creating 开局，保留所选传承和完整前世记录；CV1 延续原先直接入世的流程。

世界事实作为后果保留，私人关系不自动继承。当前行文与有界生平分开，不复制全部历史。

## 兼容

旧v3合同见 [ENGINE_CONTRACT_V3.md](ENGINE_CONTRACT_V3.md)，v1/v2见 [ENGINE_CONTRACT_V2.md](ENGINE_CONTRACT_V2.md)。旧人生不强制映射成新篇。旧迁移备份的原档与checkpoint只接受v1/v2，prepared只接受其既有v3目标。
