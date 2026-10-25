# 百世问鼎 · 1.1.0 验收记录

实施与验收日期：2026-10-25（上海）。范围：药谷叙事升级、旧规则回归、严格v2存档、桌面／手机宽度UI，以及静态／离线／普通Worker发行路径。**1.1.0已发布；本文分别记录本地完整验证与生产开局烟测，覆盖范围不同。** 最终修复起点为 `d1c19000225d88613d1add05744f6d54eae5485d`；整分支两项Important与三项Minor完成修复和限定复核。实际生产源码为 [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353)，不随后续仅文档审计提交变化。

## 交付范围

| 系统 | 1.1.0实现 |
| --- | --- |
| 连续剧情 | 药谷旧火三章、YG01–YG16核心内容节点，三名固定人物，证词／账册／地脉最多两线 |
| 支线与构筑 | 种子确定两次有限旁支；剑／体／丹专属调查与过门方式；非战斗通路和可选三回合短战 |
| 三种主要结果 | 医谷共守、宗门接管、焚种迁民；分别接入五场景的clinic／estate／refuge后世任务 |
| 持久后果 | 公开证据、谷地与种子、救援／承诺、供药债、墓地、人物出生／死亡年及有限结算记录 |
| 界面 | 目标、正文、成本／禁用原因、常驻结果卡、手记／人物／线索、辅助修行与明确中断回流 |
| 存档 | 新输出v2，保留原storage key；严格验证v1后迁移，当世旧途不补造经历，下一世开篇 |
| 原系统 | 修炼／装备／随机际遇、六境、三流派三出身、三界道证／终局、真实传承和生平继续保留 |

节点数量和模拟世界年不等于真人阅读时长。20–30分钟仍是未完成真人计时验证的设计目标。

## 本轮新鲜自动化证据

以下命令均实际运行，退出0：

| 命令 | 实际结果 |
| --- | --- |
| `node --test --test-isolation=none tests/*.test.js` | **82行为用例，82通过，0失败／跳过／取消** |
| `npm run release` 中的 `npm test` | 默认隔离模式显示8个测试文件，8通过，0失败／跳过／取消；不是只有8项行为 |
| 同一release中的 `npm run check` | `Syntax checked 20 JavaScript files.` |
| 同一release中的 `npm run build` | `dist/` 和 `release/baishi-wending-offline.html` 构建成功，312059字节 |

八个测试文件为build、content、engine、history、simulation、story-save、story、worker。风险覆盖包括模块／打包边界、原有规则、确定RNG、三流派合法三界胜利、九种流派×出身的合法共守路线、三结果及其五节点后世、资源与时间先付、截止、有限旁支、防重复奖励、短战胜／逃／三回合退／气血死／燃寿死／逃跑寿尽、各旧phase迁移、损坏v2、选择轨迹与前世快照一致性、长期NPC死亡和旧记忆保留。

完整命令证据保留在本地 `test-results/final-behavioral.log`、`final-release.log`。npm报环境警告 `Unknown env config "http-proxy". This will stop working in the next major version of npm.`；退出仍为0，属于npm环境配置警告，不是产品失败。

### 本轮静态与离线产物

| 字段 | 本地结果 |
| --- | --- |
| `release/release.json`版本 | `1.1.0` |
| 构建UTC时间 | `2026-10-25T00:36:40.439Z` |
| 离线字节 | `312059` |
| 离线SHA-256 | `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46` |
| 运行依赖 | `0` |
| 静态副本 | `dist/baishi-wending-offline.html`，与release副本相同 |

上表为本地候选构建；实际GitHub源码的发行构建时间与生产证据见下文，HTML字节／哈希保持一致。Worker现有行为测试覆盖HTML逐字保持、导入无网络／写文件副作用、GET／HEAD、下载／图标／healthz、404／405和40位源码提交参数。提交后的本地Worker打包与handler一致性已记录于任务报告；生产health与真实下载另有下文实际证据。

## 真实浏览器证据与覆盖边界

### 已完成的引擎／UI任务浏览器验收

任务2使用真实可见按钮及独立context，在1440×1000和390×1000走通丹修／采药学徒的完整共守→医馆后世：

`enter_ask → pledge_truth → ask_permission → route_ledger → official_archive → copy_accountable → route_channel → alchemy_trace → public_hearing → pay_rescue → alchemy_smoke → stabilize_herbs → choose_clinic`，中间两次实际支线均选择离开；YG15仍能阅读，YG16可选择守望或继续修行后真实归隐。选择一项实际候选传承，再轮回为新主角，完成 `accept_patients → triage_urgent → ration_medicine → publish_accounts → settle_clinic`，结果为 `clinic_rationed`。

每次剧情选择核对持久结果、资源、焦点与无横向溢出；普通休养、切页与刷新保持同一剧情结果。验证不足条件的disabled按钮不改保存；YG03路引实际仅扣8灵石一次。真实导出存档，再文件导入／确认恢复相同公开状态。道号`<云&归>`正确转义，三界终局入口仍存在。桌面守望后世1100年显示三人已故及继任者；手机归隐后世1021年显示仍在世的实际年龄。

补充独立390px通路：真实两次炼丹耗尽路引所需灵石，禁用原因与成本可见；自由历练的event中断后回同一YG01；甲傀剧情combat保留原操作与记录，guard→flee回YG13并按真实两年／资源扣费；合法v1通过文件导入保留当世、RNG和旧途说明，刷新后再归隐／轮回进入YG01。任务2证据在本地ignored `test-results/story-*.png/json`，共守全程两种宽度的console/pageerror列表均为空。

### 整分支评审后的最终修复与新鲜证据

五项发现均已修复并通过限定复核：

- 致命行动跨截止时，先同步已经流逝的世界时钟，再检查死亡与结算；选项奖励仍在存活检查之后。未削弱failed-story选择轨迹校验。两个公开API回归均先从serialize/deserialize接受的道历1006、余寿2年的刻意边界夹具开始，分别以休息和两年测绘致命跨到1008；验证末态可往返、没有治疗／证据／奖励、成本只付一次、世界与生平各结算一次，且伪造失败场景仍被拒绝。夹具不宣称是自然游戏路线。RED两例失败，GREEN两例通过；随后剧情／存档34项全通过。
- 手机RED实测普通修炼将焦点送到未变的story-result-title并关闭辅助区。修复后按公开view的结果／场景、phase和地点实际变化选焦点；重复操作保留可用按钮，新的际遇／战斗、截止结果、剧情回流与终局有对应标题。辅助展开状态在普通重绘和切页间保留；固定栏的滚动间距保护焦点。
- 辅助区复用现有当前／所需修为进度展示，手机在主线与已收束剧情后均可查看。零关系改为中性“无本世相处记录”；YG12／YG13的旧火时间改为“当年”，不增加模拟字段，也未修改历史作者稿。

`node test-results/final-focus-check.cjs`：36项真实浏览器焦点／视口／无横溢断言通过，pageerror与console error均0。390px和1440px均实际train→train→rest→rest；首个rest自动触发YG10，新结果聚焦，此后rest保留按钮。390px沿合法剧情进入甲傀短战，两次guard保持按钮与更新战局可用，第三次guard回YG13并聚焦新结果。再经焚种／结局阅读／继续修行，重复训练休息；实际修炼突破至可入幽冥，再旅行及返回人间，核对当前场景标题；真实归隐结算聚焦终局。另一独立context实际外出取得event并解决，使用对应新区域。所有玩法路径均使用可见按钮，无资源注入。

`node test-results/final-migration-check.cjs`：合法v1通过文件导入，原run与RNG保持、刷新正常；键盘train／rest和终局标题焦点通过，再轮回进入YG01。证据为`test-results/final-focus-red.json/png`、`final-focus-results.json`、`final-migration-results.json`、`final-390-cultivation.png`、`final-390-combat-rounds.png`、`final-390-terminal.png`与`final-390-legacy-guidance.png`。截图已查看，中文与按钮焦点清楚，位于固定顶／底栏之间。

### 本轮最终单文件离线浏览器验收

`node test-results/final-offline-check.cjs` 实跑退出0。使用已准备的Chrome-for-Testing `156.0.8078.47`及本地中文fontconfig，在新的隔离context打开构建文件本身的 `file:` URL，viewport为390×1000；未通过开发模块服务器替代单文件运行，也未注入状态跳过流程。

- 新建“离线后来人”（丹修／采药学徒），YG01显示沈芷与当前目标。
- 点击真实 `enter_ask`，到YG02，结果标题“先问封谷令为何下来”常驻。
- 刷新后完整保存对象与结果正文一致，内容版本为2。
- 页面仅记录两次该离线HTML本身的document请求（打开、刷新）；外部运行资源请求0、失败请求0、pageerror／console error0。
- 外部script／stylesheet引用均为0。390px页面scrollWidth=390，无横向溢出。
- 本地截图 `test-results/final-offline-refresh.png` 和机器记录 `final-offline-results.json` 已保存并查看；中文正常、剧情和两项新选择可读。

此检查证明当前单文件发布路径可执行及本浏览器的file存储恢复，不概括为所有浏览器file政策。本轮发行Worker内嵌相同离线HTML，另已完成下述生产开局验收。

## 已知限制与评审后续

1. 浏览器完整走通的是共守及clinic后世；宗门／灰谷和各后世由公开引擎自动测试覆盖，没有声称全部浏览器全通。
2. 浏览器短战覆盖guard／flee及第三回合撤退回流；其余胜负与寿尽分支由引擎测试覆盖。
3. 旧v1浏览器验收一个合法adventure当世至下一世；其他phase依严格迁移自动测试。损坏保存不会自动清除覆盖。
4. 没有真人计时、真实手机设备或辅助读屏软件验收。有限后世任务不等于无限新章；不模拟完整NPC家谱。存档校验不是密码学防篡改。
5. 原辅助details／焦点、手机修为数字及人物关系零值文案观察已在最终修复轮处理；不再作为延期项目。限于本地Chrome自动化宽度验收，未扩大为真实设备或读屏软件结论。
6. 三流派胜利／直冲失败回归继续用新篇开局；固定种子丹修守势对照通过严格迁移旧途保持旧事件池，不能把其结论扩展为所有新故事序列。首版具体动作数与年龄见产品说明中的历史表。

## 1.1.0 GitHub发行与生产验收

[PR #1](https://github.com/ct1150/wending/pull/1) 于 `2026-10-25T01:10:05Z` 合并，源码 [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353)，tree `42831e16b6832eb3207916a1b2668beec49d5375` 与已评审本地 `d7e7b05fa70d830686b14bbcd4789f0adadea514` 完全一致。main CI [40149561196](https://github.com/ct1150/wending/actions/runs/40149561196) 结论success、validate success、deploy skipped；API上线另行完成，没有启用自动发布。

| 项目 | 2026-10-25实际结果 |
| --- | --- |
| 发行构建UTC | `2026-10-25T01:10:11.898096+00:00`，Worker 317795字节 |
| Deployment ID | `a79b0351-d05d-4ca4-875b-bd8a5048f91f` |
| 100% Worker version ID | `ca6bdda3-9739-4a09-a4a9-0f0f39085c45`，与deployment ID不同 |
| 部署创建UTC | `2026-10-25T01:10:47.185111Z` |
| 生产health | [healthz](https://baishi-wending.ct1150.workers.dev/healthz)：status ok，sourceCommit为 `4d3834be1bcd2ffd636c7fe32bde5c111195f353`，HTML SHA-256为 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46` |
| 真实开局 | start → “灰里还有人” → 选择“先问封谷令为何下来” → “不肯烧掉的药簿” |
| 恢复与导航 | 刷新后完整主内容保留，设置及返回正常 |
| 游戏内实际下载 | 312059字节，SHA-256 `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46`，与已测产物完全一致 |
| 视口与错误 | 1363×936，pageWidth 1348，无横向溢出；应用错误0；另记录21条浏览器扩展metadata消息，不计为游戏错误 |

本轮公网烟测只证明开局路径、刷新、设置回流、health和实际下载。桌面／手机完整共守后世通路仍是本地证据，不扩大为生产全结局、真实手机或读屏软件验证；真人20–30分钟节奏仍未计时。部署／版本／流量证据详见 [部署说明](DEPLOYMENT.md)。**线上health指向实际发行源码 `4d3834be1bcd2ffd636c7fe32bde5c111195f353`，不指向后续仅文档提交。**

## 历史首版生产证据

以下为2026-10-24首版证据，不是1.1.0线上验收：

| 项目 | 2026-10-24首版历史记录 |
| --- | --- |
| 生产URL | [baishi-wending.ct1150.workers.dev](https://baishi-wending.ct1150.workers.dev/) |
| 首版生产源码 | [`355f7956a4c31d9e3a19f1f567c4b1146942a5e9`](https://github.com/ct1150/wending/commit/355f7956a4c31d9e3a19f1f567c4b1146942a5e9) |
| 对应该源码的CI | [40053805256](https://github.com/ct1150/wending/actions/runs/40053805256)，48测试／15JS检查通过 |
| 历史CI产物 | [12544925440](https://github.com/ct1150/wending/actions/runs/40053805256/artifacts/12544925440)，压缩包247611字节；离线185751字节，Worker189712字节 |
| 实际Deployment ID | `48af217d-8b0f-428a-94ab-d868fdf55ca3` |
| 100% Worker version ID | `f9dd9fc8-df55-437e-8123-bbca3e119a59`，不是deployment ID |
| 创建UTC时间 | `2026-10-24T02:21:43.28736Z`，通过API发行普通Worker |
| 首版生产离线SHA-256 | `060befb94513ebd04bd23eac7127e28073b782b1bf02e443627cda5eaddf6e63` |
| 后续main验证 | [`e719b569deeb5010d4977c799b434b60d640223a`](https://github.com/ct1150/wending/commit/e719b569deeb5010d4977c799b434b60d640223a)，[CI40054261258](https://github.com/ct1150/wending/actions/runs/40054261258)成功，deploy跳过；未改变生产源码 |

首版实际公网浏览器曾验证创建“云归”16岁、修炼至19岁／修为13／余寿81／灵石29，探索并完成“渡口最后一船”后22岁／余寿78／灵石41，刷新恢复；healthz返回上述生产提交与哈希，游戏内实际下载的185751字节匹配哈希。390px iframe可用宽375CSS px，scrollWidth=clientWidth=375。原本地首版浏览器还覆盖装备、突破、道证、归隐、传承、重生、历史与导入导出；这些是历史验收，不冒充本轮新剧情证据。

直接脚本公网请求曾受网络限制／得到403非游戏正文；该通路失败不推翻真实浏览器证据，也不能用阻断页哈希替代游戏哈希。公网HEAD／404／405尚无独立live响应证据；本地handler测试不作替代。

2026-10-24的Workers Builds只读查询为无配置404／12040，triggers／builds为空；本轮main CI deploy也跳过。因此自动发布未建立。旧连接曾返回8000008，不能据此推断现在GitHub App从未安装或仍未安装。具体来源与后续发布门槛见 [部署说明](DEPLOYMENT.md)。**1.1.0的实际GitHub、API部署与公网验收已分别记录于上文；CI成功不等同于自动发布。**
