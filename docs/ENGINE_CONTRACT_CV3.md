# CV3 实现接口（2026-10-27 固定）

此文是本轮引擎、内容、UI和工具并行实现的共同契约。旧 CV1/CV2 的目录和规则不变。

## 模块

- `src/game/cultivation/v3/model.js` 导出 `ORIGINS,TALENTS,ITEMS,SKILLS,REALMS,DAYS_PER_YEAR`，均为 id→记录的对象，记录含 id/name；境界记录含 rank/lifeLimit/threshold/material/minYears。
- `v3/content.js` 导出 `NODES`（全部场景ID字符串数组）、`resolveCultivationScene(state)`、`AUTHORING_BRIEFS`（可选文字生成位置的固定事实简报）。它只导入 model 和 chapters，无循环依赖。
- `v3/engine.js` 导出 `createCampaign(options),getCampaignView(state),chooseCampaign(state,command)`。
- `v3/validation.js` 导出 `validateCampaign(state)`。
- 外部 cultivation/engine.js 与 validation.js 是具名函数分发器，旧实现移入 legacy-engine.js / legacy-validation.js，仅改内部 validator 导入。

## 新目录

- 出身：village（山村猎户）、artisan（城坊匠徒）、ferry（渡口短工）、exile（流亡孤儿）；wanderer（前尘行者）在 world.facts['nether-pact'] === true 时解锁。
- 命格：keen-memory、sensitive-breath、iron-bones、sword-bone、flash-wisdom、fortune-debt 初始开放；rootless 在 world.facts['rescued-refugees'] === true 时解锁；void-echo 在 world.facts['nether-pact'] === true 时解锁。
- 物品：stones（灵石）、supplies（行粮）、talisman（护符）、manual（完整功法）、crystal（地脉灵晶）、core（金丹灵髓）、soulseal（归魂印）、skykey（天门玉钥）、iron（玄铁）、relic（古修遗物）、favor（人情信物）。
- 法门：sword（御剑）、conceal（藏息）、formation（阵法）、beast（御兽）、bargaining（交涉）、forging（炼器）。
- 境界：mortal(80年/rank0)、qi(120/1)、foundation(240/2)、golden(480/3)、nascent(800/4)、spirit(1500/5)、immortal(3000/6)。突破到 qi/foundation/golden/nascent/spirit/immortal 分别要求修为 2/3/4/4/5/5，至少消耗2/3/5/8/12/20年，以及 manual/crystal/core/soulseal/skykey/relic 各1个。所需物品必须列在本次 costs.items 消耗，伤势不超过1；功法作为突破材料消耗后用 life.facts['learned-manual'] 保留已学事实。
- 人间、幽冥、天界成就的 proof IDs 为 mortal/nether/celestial。只有 immortal 且已有三项 proof 才能 victory。

## State

外壳保持 version4/mode cultivation/contentVersion3/revision/rng/phase/world/life/scene/transcript/summary。

world: `{day,generation,facts,legacies,biography,proofs,recentFates}`。facts 是至多200项、键至多80字、值为null/布尔/有限数字/至多200字字符串。proofs 是不重复已知ID；recentFates 至多3项 `route:trial:pressure` 字符串。解锁由上述 facts 派生，不接受额外随意解锁表。

life: 与旧 v4 同样的 name/ageDays/lifeLimit/lifeDamageDays/realm/cultivation/injury/skills/items/legacyId/facts/startDay，加 birth。修为 0–12，伤势0–3。birth: `{originId,attributes:{constitution,insight,fortune},talentIds:[id,id],lockedTalentId:null|id,rollCount}`；属性每项1–6且总和12；两命格不同且已解锁；锁定项必须在本次两项中。

scene: `{nodeId,visited,fate:{route,trial,pressure}}`。route=sect/wanderer/alliance，trial=ruins/beast/sea，pressure=pursuit/scarcity/storm。创建时固定抽取，下一世避免与最近一世同完整组合，读操作不变。初始 nodeId='arrival'，creating 时不写正文，birth-start 才进入 arrival。

命令 `{revision,sceneId,choiceId,...}`。开局命令 birth-name(name)、birth-origin(originId)、birth-lock(talentId，锁当前项/再点取消)、birth-reroll、birth-start(name可选)。拒绝未知参数值且结果原子；旧命令重复按 stale 处理。

view 保持旧 getCultivationView 的字段。creation 增加 originId/origins（已解锁记录）/origin（当前记录）/lockedTalentId/attributeBudget=12；talents 为两项带id/name/description；attributes 带id/name/value/description。summary 增加 origin 和 unlocks；其余 name/realmName/age/remainingLife/items/abilities/ending/biography/priorTranscript 按旧 UI 约定。

## Content

Scene `{id,title,location,goal,blocks,choices}`；block `{kind:'narration',text}` 或 `{kind:'dialogue',speaker,text}`。

Choice `{id,label,detail,to,result,costs?,effects?,requires?,ending?,endingTitle?,achievement?,lesson?}`。to 必须是 NODES 中的字符串。costs 允许非负 days/years/lifeYears 和 items id→正整数。effects 允许 items id→整数、skills数组、cultivation整数、injury/heal非负整数、realm、lifeFacts、worldFacts、proof、deed。突破逐级、复核修为/材料/年月，突破后修为归零。正文不能借用尚未发生的结果。

requires 为AND条件数组，支持 item(id,min)、skill(id)、talent(id)、origin(id)、realm(value)、cultivation(min)、injury-max(value)、life-fact(id,value)、world-fact(id,value)、proof(id)。内容可按已保存状态生成2–3项 choices，但不能额外抽随机。

ending 支持 battle/lifespan/retired/victory；battle 与命损/伤势在 choiceView 中警告；retired/lifespan推进真实余年，victory在当下结算不强制寿尽。不足寿元的行动在成果前结束人生，不获取 effects。

历史段落ID继续 cultivation-N；每世最早段落索引存 life.facts['transcript-start']；ended保存真实 biography，最多携一项 world.legacies，下一世恢复creating并保留world事实与完整正文。没有无限循环刷资源的无耗时行动。

## UI 与创作工具

开局保持一张命签，姓名、出身及人生钩子、两项命格、锁定按钮、重掷和入世；三项资质放 details。新 birth controls 带当前 revision/sceneId；姓名保存后所有 controls 的revision更新。

作者工具只覆盖作者明确提供的稳定插入位置（例如不会声称已获得物品的环境/人物描写）。`AUTHORING_BRIEFS` 为 `{id,sceneId,title,facts,prompt}` 数组，字符串与ID有限；`prose.js` 只提供经过接受的文字包。内容渲染保留 canonical state-dependent 段落和所有规则/行动，不用生成文字替代事实。
