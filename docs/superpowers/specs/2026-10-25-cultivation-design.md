# 人间求仙篇设计与实现契约

日期：2026-10-25（上海）。用户已接受上一轮完整分析并要求“可以，继续”。以下具体值是实施默认，不另开需求访谈。
基础源码：真实远端 4119a9a5780b5d5478f320b69d44670428cab1cb。工作区是逐 blob 校验的隔离快照，本地初始历史为合成快照，远端提交必须使用真实远端 parent。

## 产品范围与授权
- 发行 3.0.0 人间求仙篇。保持原生 JS、Node>=22、无运行时外部依赖、单文件离线、本地存档和现有 Cloudflare Worker。
- 新开局进入 v4 cultivation。旧 v1/v2/v3 验证、继续、导入导出与原有结算兼容；不得无提示覆盖在玩人生。现有重新开始确认流程可明确切入新篇。
- 本轮交付完整可重玩的“凡人入门—炼气历险—筑基取舍—此生归宿—下一世”闭环；不是三界完整重制，UI和文档不得称已完成三界重制或承诺无限新剧情。
- 先建立云归个人求仙动机、低起点和具体短期目标。药谷旧案作为机缘/危险的来源，不继续公共责任审议主线。
- 场景通常2—3选项（真实结算可1项）。普通冲突1—3选择，选择反馈在同一阅读流。
- 突破必须有修为准备、材料与处境条件，不由签约/交接自动升级。经历获得修为，不设重复刷经验按钮。
- 一世目标20—30分钟需真人验证，不用自动动作数量宣称达到。
- 日级危机与年级修炼分开。危险可预见，缺乏准备有真实资源、伤势、寿元或死亡后果，不能隐藏骰子暴毙。
- 随机发生在承诺前、刷新不重抽；不同seed实际改变可走路线/资源/挑战。
- 人物有各自利益、情绪与个性。正文不出现存档、节点、无费用后继、原子提交等实现语言，不使用原作角色和标志性宝物。
- 新世重置个人实力/物品，最多一项已得方法生效，世界事实保留；每世重组目标与冒险，不进入只剩四步旧任务的回顾循环。
- 不为死亡次数发属性。不叠加无限数值。可选择不携传承。

## 模块与归属
- src/game/cultivation/content.js：内容作者负责。导出 ITEMS、SKILLS、REALMS、NODES、resolveCultivationScene(state)。只依赖model.js（可不依赖），不依赖engine。
- src/game/cultivation/model.js：根代理负责常量/条件/时间辅助。内容可复用。
- src/game/cultivation/engine.js：根代理负责公共状态机与真实成本、结算、再世。
- src/game/cultivation/validation.js：独立验证任务负责 validateCultivation(state)。
- src/app.js、src/game/save-format.js、src/ui/session.js、src/ui/journey.js、src/ui/paper.css：UI/兼容任务负责。
- tests/cultivation-engine.test.js：根代理；tests/cultivation-validation.test.js：验证任务；tests/cultivation-ui.test.js：UI任务。
- 文档/版本/build脚本/发布根代理负责。其他人员不提交git，不改以上不归属文件，不创建远端资源。

## v4存档固定结构
```js
{
 version:4, mode:'cultivation', contentVersion:1, revision:0,
 rng: uint32_nonzero, phase:'playing'|'ended',
 world:{
   day:360000, generation:1,
   facts:{}, legacies:[], biography:[]
 },
 life:{
   name:'云归', ageDays:5760, lifeLimit:72, lifeDamageDays:0,
   realm:'mortal', cultivation:0, injury:0,
   skills:[], items:{medicine:1,stones:0}, legacyId:null,
   facts:{}, startDay:360000
 },
 scene:{
   nodeId:'arrival',
   fate:{ opening:'valley'|'market'|'ferry', opportunity:'marsh'|'ruins'|'caravan', pressure:'rival'|'scarcity'|'storm' },
   visited:[]
 },
 transcript:[], summary:null
}
```
- 一年360天，所有时间以整数天保存；开局16岁/72寿限，qi仍72，foundation寿限180。ageDays与world.day每历时一起增加，lifeDamageDays不改变世界日。余寿天=lifeLimit*360-ageDays-lifeDamageDays。
- 第一世opening固定valley，后世可valley/market/ferry；opportunity和pressure每世随机。抽取完成立即入档。世界事实影响相应开场文本/条件（例如valley-seed=destroyed不能复活）。
- 物品键由ITEMS枚举，含medicine,stones,herb,manual,essence,talisman。数量0..9999。技能键由SKILLS枚举，至少herbalism,conceal,sword。realm从REALMS枚举。cultivation整数0..6，injury整数0..3。3为重伤，需真实限制。
- facts为有限数量的plain object键，值只允许boolean、null、有限number、<=200字符string；禁止__proto__/constructor/prototype等危险键；world.facts与life.facts可使用有限自解释标记，不将整个人物记忆冒认为下一世关系。
- visited最多300场景ID，transcript最多30000块，biography最多300段（超界安全拒绝，保留旧档），总量继续受现有1M字符上限约束。
- transcript块：{id:'cultivation-N',sceneId:nodeId,kind:'narration'|'dialogue'|'action'|'result',text,speaker?,choiceId?}。
- summary（ended）：{cause:'battle'|'lifespan'|'retired',title,generation,age,realm,achievement:string,lesson:string}。
- biography记录：{...summary,name,year,legacyId,skills:[...],deeds:[string,...]}。保留每世关键事实描述（至多8），完整当前行文仍保存在transcript；不复制整份历史造成二次膨胀。

## 内容场景与选择契约
```js
resolveCultivationScene(state) => {
 id:state.scene.nodeId, title, location, goal,
 blocks:[{kind:'narration'|'dialogue',text,speaker?}],
 choices:[{
  id,label,detail,to,result,
  requires?:[{kind:'item'|'skill'|'realm'|'cultivation'|'injury-max'|'life-fact'|'world-fact'|'days-left',id?,min?,value?}],
  costs?:{years?:int,days?:int,lifeYears?:int,items?:{[itemId]:positiveInt}},
  effects?:{
   items?:{[itemId]:integer}, skills?:[skillId],
   cultivation?:integerDelta, injury?:integerDelta, heal?:nonnegativeInt,
   realm?:'qi'|'foundation',
   lifeFacts?:{},worldFacts?:{},
   legacy?:skillId, deed?:string
  },
  ending?:'battle'|'lifespan'|'retired', endingTitle?:string,
  achievement?:string,lesson?:string
 }]
}
```
- 每个id全场景内唯一。to必须是NODES内ID（NODES导出为字符串数组），包含arrival和ended；ended无普通choice，由engine生成轮回选择。
- 普通选择先检查条件和物品成本；寿元不足但无物品短缺时，该选择仍可明确显示“无法活着完成，将寿尽”，选择后按真实剩余时间结束人生，不发effects，不借未来境界延寿。days-left用于药谷短期危机，阈值按life.startDay的世界已过天数检查（max以value给定，如3）。
- getView自动附实际物品/寿元成本；作者detail写风险和代价的故事意义。危险死亡选择必须在label/detail明显提示；结果按条件确定，不在落子后随机。
- effects.cultivation为增量，injury为增量，heal为减少伤势，所有数值需有边界；skills去重，legacy加入world.legacies但不会当世自动激活。
- 传承会把一项skill放入新世life.skills（legacyId同skillId），不额外给资源。
- 适用内容不要输出占位、TODO、合规长解释。每个过渡都有角色行动与下一步目标。
- 所有内容数据来自作者代码，不接受存档中的可执行脚本/条件。

## 公开API与UI契约
```js
createCultivation({seed?}={}) => valid v4 state
getCultivationView(state) => {
 revision,sceneId,phase,title,location,goal,blocks,choices,
 summary:{
  name,age,ageText,year,generation,remainingLife,remainingLifeText,
  lifeLimit,lifeDamage,realm,realmName,injury,injuryName,
  abilities:[{id,name}],legacy:null|{id,name,source,description},
  items:[{id,name,count}],ending:null|summary,biography,
  priorTranscript:[],legacyArchive:null,legacyCollection:[{id,name,source,description}]
 }
}
chooseCultivation(state,{revision,sceneId,choiceId}) => {kind:'applied'|'stale'|'unavailable',state,message}
validateCultivation(state) => same state or throws
```
- getView不改变state/RNG。blocks仅显示本世，旧世通过biography；内部transcript保留原始事实，life.facts['transcript-start']为索引。
- endedchoices至多三项：最近两项实际已得skill传承（id inherit-SKILL）以及new-life（只携记忆），不靠死亡补奖。
- 旧v1/v2/v3继续原规则；此次不自动做v3→v4人格/世界强行映射。帮助/设置给明确的“开始人间求仙篇”现有确认动作，提示导出旧档；用户明确重新开始才替换。v1/v2既有交接继续v3，避免破坏既有归档。
- app新开局createFresh用createCultivation，getView/choose通过版本分发，isJourney包含3/4，session仅v1/v2使用legacy备份，v3/v4走普通保存。
- renderer在v4显示一行姓名/岁数/境界/余寿和一句当前目标；成本相关资源在选项旁，保持无菜单墙。
- 屏幕阅读/键盘焦点/44px触控/320px无横向溢出仍作为验证目标。

## 内容最低验收
1. 至少25个有意义场景、三类实际不同机缘路线、两种以上可完成筑基的方法与可以失败/退路的因果。
2. 药谷急迫事件只耗天；多年学习放在离谷后。不会16岁元婴。
3. 第一世从凡人到炼气需要获得完整功法并有数年真实修炼；筑基须cultivation>=3与真实essence/替代资源，并处理伤势/洞府条件。
4. 到筑基后的选择写出能力改变、旧人物/利益回应；明确这一篇范围。不把筑基称三界问鼎。
5. 一世可以因寿尽或明示危险陨落；结算说明修行收获、代价、下一次可调整之处。
6. 第二、第三世仍走完整冒险，已毁灵种等事实影响选项，不重复同一个已完成委托的假发奖；使用新年新委托或不同来源。
7. 公开API行为测试覆盖开局、成本、突破前提、死亡/寿尽、三个seed路线差异、轮回一项传承、保存与损坏拒绝、旧版兼容。
