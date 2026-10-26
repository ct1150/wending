# 沉浸式叙事与取名掷骰开局

## 用户目标

修仙文字肉鸽应以当前人物处境、对话和选择为中心。根据 2026-10-26 的四项反馈：收起选项的常规数值影响；顶部固定展示基础状态并可展开详情；修复人物对话标点；允许取名、掷骰随机属性与天赋；将已经读过的剧情收进历史对话。

## 产品决定

- 当前页仅保留最新选择的后果、当前场景与选项。完整当世对话与前世记录进入“历史对话”抽屉，不删除记录。
- 选项使用自然行动描述。缺失条件和人物能够预知的严重危险仍明确可见，普通资源、耗时和收益不逐条铺在按钮中。
- 顶部简栏固定显示姓名、境界、年龄和余寿，点击打开人物详情抽屉。详情集中展示伤势、物品、已学本领、传承、属性与天赋。历史、人物抽屉均不改变世界状态。
- 对话以 `人物：“正文。”` 呈现，补齐缺失句末标点，不重复包裹已有引号，所有文本继续转义。
- 新游戏先进入可持久化的开局页，预填“云归”，姓名 1–24 个 UTF-16 字符，不接受控制符。初始已经掷一次，可显式重掷；点击“入世”才开始正文。重复提交、刷新、导入、查看抽屉不重掷也不重复结算。
- 三项属性各为 1–6：根骨在本来就具有疗伤效果的行动中额外恢复 floor(值/3) 伤势；悟性在首次成功进入炼气时额外积累 floor(值/3) 修为；气运在入世时额外给予 floor(值/3) 灵石。额外恢复与修为均受现有上下限约束，不跳过必要物品、时间或境界条件。
- 天赋等概率四选一：备药（起始伤药 +1）、草木缘（起始灵草 +1）、心静（首次炼气修为额外 +1）、善调息（已有疗伤效果额外 +1）。属性与天赋不授予已学本领或轮回传承，不改变剧情写明的耗时、寿限和必死危险。

## 数据与接口

旧 `createCultivation({seed})` 与 contentVersion 1 的状态、随机序列和操作保持兼容。新 `createCultivation({seed, characterCreation:true, name})` 返回 contentVersion 2、phase `creating`。

`life.birth` 包含 `{attributes:{constitution,insight,fortune},talentId,rollCount}`。开局的 `birth-name`、`birth-reroll`、`birth-start` 仍经 `chooseCultivation` 的 revision / sceneId 校验。重掷恰好消耗四次随机抽取；取名和入世不消耗随机数。CV2 下一世进入开局页，保留世界因果和已选传承；CV1 旧人生继续按原规则完成。

视图提供 `creation:{name,attributes:[{id,name,value,description}],talents:[{id,name,description}],rollCount}`，详情使用同形的 `summary.attributes` / `summary.talents`；旧存档返回空数组。`summary.priorTranscript` 必须包含前世正文。

界面导出 `renderJourney(view)`、`renderJourneyHistory(view)`、`renderIdentityBar(summary)`、`renderCharacterDetails(summary)`、`renderBirth(creation)`。控制器负责抽屉、焦点、输入持久化和动作派发。输入 ID 为 `birth-name`，按钮钩子为 `data-birth-reroll` / `data-birth-start`，抽屉入口为 `data-character` / `data-history`。当前结果 ID 和当前标题 ID 保持兼容。

## 验收

新开局可取名、重掷、刷新恢复、导出导入并入世；剧情使用自定义姓名；属性天赋实际影响规则且只结算一次。旧 CV1/v3/v2/v1 保存和恢复不被隐式升级。当前页没有历史正文堆积和常规影响清单，危险提示保留；完整历史仍可阅读。桌面与窄屏样式保持紧凑，抽屉可用键盘关闭并返回入口。发布前运行完整测试、构建和实际页面验证，报告真实证据范围。
