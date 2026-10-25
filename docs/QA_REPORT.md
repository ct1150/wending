# 百世问鼎 · 验收记录

更新：2026-10-25（上海）。**2.0.0 对话与选项版是本地发行候选，尚未上线。当前生产仍为 1.2.0**，运行时源码 `90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`。下文旧版本源码、CI、浏览器和下载证据按版本保留，不证明新旅程的实际布局、焦点或体验。

## 2.0.0 当前候选：范围与证据边界

Task1–6 实现并完成限定审查；Task6 最终修复涵盖旧胜利原始语义、按全记录保留机构后果、普通备份成功／当前写失败的明确恢复，以及临时备份读取重试。Task7 修正药理真实时间成本、增加有界完整性验证、版本与公共文档。独立 Task7／整分支审查、远端 PR／CI／合并、真正运行时 SHA 构建的 Worker、生产 health／下载与实际 UI 均待控制方完成。

### 最终复核修补的定向证据（2026-10-25 20:11，上海）

一轮聚合修补涵盖未知旧谷地的真实终局文本、缺人间道证时只核实当前有限承担、统一存档长度与落子前检查、UTF-8文件选择器恢复边界，以及本文和玩法文档的实际UI描述。完整旧史不截断，旧人生规则不变，没有新增管理面板。缺省灰谷回访改为明确 `ash_refuge` 条件，未知回访保留未知。

| 实际命令／检查 | 修补后实际结果 |
| --- | --- |
| `node tests/journey-migration.test.js` | 17/17通过；真实v1→旧归隐→迁移→公开问鼎路线与超限交接仍保留可恢复旧档 |
| `node tests/journey-save.test.js` | 10/10通过；精确长度边界、真实动作／新生拒绝不扣费不推进RNG、v1规范化后的大小 |
| `node tests/session.test.js` | 14/14通过；不替换当前／备份、真实Node控制器导出→UTF-8文件输入→确认恢复 |
| `node --test tests/journey-migration.test.js tests/journey-save.test.js tests/session.test.js tests/journey-campaign.test.js tests/journey-rebirth.test.js tests/journey-release.test.js tests/story-save.test.js tests/journey-ui.test.js` | exit0，8/8受影响测试文件，0失败／跳过／取消 |
| `node tests/journey-release.test.js` | 2/2通过；50场景／191作者变体／2893有界resolver夹具；168公开前缀／374一步行动，不是所有历史穷举 |
| 对11个新增或改动JS文件执行 `node --check` | 全部exit0；这是定向语法检查，不冒充完整仓库语法计数 |
| `npm run build` | exit0；静态与离线打包包含新的共享save-size模块；npm报告现有http-proxy环境警告 |
| `git diff --check` | exit0 |

修补后构建元数据来自实际 `release/release.json`：UTC `2026-10-25T12:11:19.221Z`（上海20:11:19.221），离线HTML **476983字节**，SHA-256 **`6f1ca22d8703117f9c1683170f4fa265018d8e0b7fd78eeccbd11098af6c4dec`**；重新计算哈希并核对dist副本逐字相同。这是定向修补后的本地打包证据，不是控制方最终完整release、CI或生产证据。

原有1,000,000个JavaScript字符串字符上限不变。若完整候选超过上限，该步不提交，当前有效进度仍可导出和重导入；不能保证在历史容量已满时继续推进。文件预读上限由每代码单元最多三个UTF-8字节推导；测试导出的中文JSON实际超过2MiB，仍可通过真实控制器导入并确认恢复。测试使用Node DOM适配器，不证明实际浏览器文件选择、视觉或焦点。全套release及真实发布验收由控制方接续。

### Task7 历史本地检查点（2026-10-25 19:47，上海）

以下完整门禁、46文件语法计数、473871字节／5b49开头的产物哈希，以及190变体／2892夹具，属于最终复核修补前的 Task7 检查点。此后有下列运行时代码修正；这些历史数值不证明修补后的源码。整分支新鲜完整门禁由控制方另行记录：

| 实际命令 | 结果 |
| --- | --- |
| `node tests/journey-campaign.test.js` | 16/16 行为用例，0失败（修正后的定向GREEN） |
| `node tests/journey-release.test.js` | 2/2 行为用例，0失败；覆盖计数见下文 |
| `env -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY npm run release > /tmp/task7-release.txt 2>&1` | exit0；`npm test` **20/20测试文件**通过，0失败／跳过／取消；不是20个行为用例 |
| 同一release的 `npm run check` | **46个 JavaScript文件**语法检查通过 |
| 同一release的 `npm run build` | `dist/` 与单文件离线版成功，**473871字节** |
| `git diff --check` | exit0，无空白错误 |

完整套件的隔离 runner 没有报告所有文件内部的行为用例总数，本页不将文件数当用例数。上述定向用例数来自文件独立执行的真实输出。本轮清除了 npm proxy 环境配置再执行 release，未见原环境警告。

| Task7 历史候选产物 | 当时实际值 |
| --- | --- |
| 产品版本／运行依赖 | `2.0.0`／0 |
| 构建时间（上海） | `2026-10-25 19:47:46.304 +08:00` |
| `release.json` 原始 UTC | `2026-10-25T11:47:46.304Z` |
| HTML字节／SHA-256 | `473871`／`5b49bde3dc1841aed0bc065505cc273109053ca49514f1d86dd093e7cd09e7fd` |
| 静态副本 | `dist/baishi-wending-offline.html` 与release文件逐字相同 |
| 新版正式 Worker／生产标识 | 尚未构建部署；须控制方基于真实合并源码另行生成 |

构建后纯文件检查重新计算SHA-256、核对副本及元数据，确认无外部script/stylesheet标签，并核对原始v1/v2契约和1.1.0规格在版本历史中完整保留。没有从浏览器或生产获取上述新版本数据。

### Task7 检查点行为覆盖及明确不能推断的内容

- `journey-campaign` **16 行为用例**：两条公开首世胜利无能力／无注入、真实损失与有限缺证补交、六机会／三组合、个人燃命不推进世界、缺药／重伤／余寿退路。旧辨言＋定契免首季复核在 shortage＋delivery 后保持，已由 Task6 修复并保留断言。
- Herbalism RED：普通学习没有耗年（16 实际 vs17 期望），实际组合服务仅耗一年（19 vs20），两项断言先失败；修正后16/16通过。普通药理一年、学习＋服务两年、拒绝0；实际药包一次、学习一次，余寿1/2/3边界不能借未来寿限，拒绝始终可走。
- `journey-release` **2 行为用例**：50 场景／190 作者条件变体由2892个有界 resolver 条件 fixture 选中；检查至多3项、已定义后继、对应成本条件下有出口。这是 resolver 层的有限适用性检查，**不把这些 fact 组合称为合法／实际可达存档**。
- 另在种子0／1／7上执行两种完整公开胜路：168个公共前缀、374次各可用选择的一步扩展；状态验证、每个观察状态的可执行后继、读／存档往返不变 RNG、旧命令 stale、无重复 episode、输入不变。扩展只做一步，不递归枚举正文历史，不声称所有路径已遍历。
- Task6 定向 checkpoint（历史本轮实施证据）：migration15/15、rebirth15/15行为用例与5/5受影响测试文件通过，详见实现进度；本次完整 release 会将最终代码纳入同一门禁。覆盖三类十一种后世结果、十旧映射、真实旧战斗→胜利→明确奖励→v3、原始v1字节、两类保存边界／刷新恢复、既得权利与今生授权区分。
- Node app／renderer harness 覆盖特定控制与焦点目标请求、导入确认、备份导出等功能。它没有浏览器布局、原生 dialog、真实 DOM 焦点或辅助技术观测，不能据此称视觉或无障碍验收通过。64种救援条件组合及其余未落入公共前缀／一步后继的作者分支仅有resolver适用性检查，未逐条建立完整公共可达证明；完整历史路径仍未穷举。

### 平衡与实际未测事项

数字种子0，无可选学习的证据路线29动作，年龄19／世界1003／余寿301；有限共担27动作，年龄16／世界1000／余寿304，两者都在第一世活着胜利。代价是实际工作、死亡、毁种、残证与有限职责，不是保证强寿元压力。**20–30分钟一世、阅读节奏及寿命张力仍待真人测量**，动作数不能换算分钟。

以下均未在2.0.0实际观察：获准生产首局／冲突／死亡与新生、真实旧档交接、刷新、真实UI导出导入与键盘焦点；320px、浅色／深色外观；物理手机、屏幕阅读器；实际2.0.0 health／下载。控制方从现有1.2.0实际UI导出的部署前备份仅是旧进度保护，不算新版验收。没有本地浏览器、文件URL、localhost、headless、原始CDP或替代发布预览，也没有绕过旧原型策略拒绝。

### 待完成发行观察

控制方先独立复核并重读远端 main/tree，基于真实父提交经 Git Data API 重建、精确树比较、PR／CI／合并。仅用真实合并运行时 SHA 重建并更新现有普通 Worker，记录真实 deployment/version ID；核对 health、页面版本、下载字节／hash及获准环境UI后才能称上线。无自动部署／托管迁移。本地源码与离线检查不能替代上述观察。

## 历史1.1.0验收记录

实施与验收日期：2026-10-25（上海）。范围：药谷叙事升级、旧规则回归、严格v2存档、桌面／手机宽度UI，以及静态／离线／普通Worker发行路径。**1.1.0已发布；本文分别记录本地完整验证与生产开局烟测，覆盖范围不同。** 最终修复起点为 `d1c19000225d88613d1add05744f6d54eae5485d`；整分支两项Important与三项Minor完成修复和限定复核。实际生产源码为 [`4d3834be1bcd2ffd636c7fe32bde5c111195f353`](https://github.com/ct1150/wending/commit/4d3834be1bcd2ffd636c7fe32bde5c111195f353)，不随后续仅文档审计提交变化。

## 历史 1.1.0 交付范围

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

## 历史 1.1.0 最终自动化证据

以下命令均实际运行，退出0：

| 命令 | 实际结果 |
| --- | --- |
| `node --test --test-isolation=none tests/*.test.js` | **82行为用例，82通过，0失败／跳过／取消** |
| `npm run release` 中的 `npm test` | 默认隔离模式显示8个测试文件，8通过，0失败／跳过／取消；不是只有8项行为 |
| 同一release中的 `npm run check` | `Syntax checked 20 JavaScript files.` |
| 同一release中的 `npm run build` | `dist/` 和 `release/baishi-wending-offline.html` 构建成功，312059字节 |

八个测试文件为build、content、engine、history、simulation、story-save、story、worker。风险覆盖包括模块／打包边界、原有规则、确定RNG、三流派合法三界胜利、九种流派×出身的合法共守路线、三结果及其五节点后世、资源与时间先付、截止、有限旁支、防重复奖励、短战胜／逃／三回合退／气血死／燃寿死／逃跑寿尽、各旧phase迁移、损坏v2、选择轨迹与前世快照一致性、长期NPC死亡和旧记忆保留。

完整命令证据保留在本地 `test-results/final-behavioral.log`、`final-release.log`。npm报环境警告 `Unknown env config "http-proxy". This will stop working in the next major version of npm.`；退出仍为0，属于npm环境配置警告，不是产品失败。

### 历史 1.1.0 静态与离线产物

| 字段 | 本地结果 |
| --- | --- |
| `release/release.json`版本 | `1.1.0` |
| 构建UTC时间 | `2026-10-25T00:36:40.439Z` |
| 离线字节 | `312059` |
| 离线SHA-256 | `379eef692acd6e5b043ed11a364a2ddf4bf761a1b842e482f6037fa32dee0c46` |
| 运行依赖 | `0` |
| 静态副本 | `dist/baishi-wending-offline.html`，与release副本相同 |

上表为本地候选构建；实际GitHub源码的发行构建时间与生产证据见下文，HTML字节／哈希保持一致。Worker现有行为测试覆盖HTML逐字保持、导入无网络／写文件副作用、GET／HEAD、下载／图标／healthz、404／405和40位源码提交参数。提交后的本地Worker打包与handler一致性已记录于任务报告；生产health与真实下载另有下文实际证据。

## 历史 1.1.0 真实浏览器证据与覆盖边界

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

## 历史 1.1.0 已知限制与评审后续

1. 浏览器完整走通的是共守及clinic后世；宗门／灰谷和各后世由公开引擎自动测试覆盖，没有声称全部浏览器全通。
2. 浏览器短战覆盖guard／flee及第三回合撤退回流；其余胜负与寿尽分支由引擎测试覆盖。
3. 旧v1浏览器验收一个合法adventure当世至下一世；其他phase依严格迁移自动测试。损坏保存不会自动清除覆盖。
4. 没有真人计时、真实手机设备或辅助读屏软件验收。有限后世任务不等于无限新章；不模拟完整NPC家谱。存档校验不是密码学防篡改。
5. 原辅助details／焦点、手机修为数字及人物关系零值文案观察已在最终修复轮处理；不再作为延期项目。限于本地Chrome自动化宽度验收，未扩大为真实设备或读屏软件结论。
6. 三流派胜利／直冲失败回归继续用新篇开局；固定种子丹修守势对照通过严格迁移旧途保持旧事件池，不能把其结论扩展为所有新故事序列。首版具体动作数与年龄见产品说明中的历史表。

## 历史 1.1.0 GitHub发行与生产验收

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


## 历史 1.2.0纸页候选：源码、Node与本地发行验证 — 2026-10-25

**候选阶段历史状态（已由文末正式发行记录取代）：当时尚未发布，线上版本仍为上述 1.1.0；**历史浏览器证据不适用于1.2.0。此轮仅改发行元数据与文档，复用已完成源码评审的Paper实现，未新增测试、依赖或运行时外部请求。

范围包括无存档直接以云归／山村／剑修进入YG01、合法旧存档优先恢复、损坏／不可读存档保护、状态／回看／修行辅助入口、完整下一世自定，以及按最新真实行动显示的常驻结果。Task1初审的两项Important（旧结果冒充最新反馈、重绘后焦点目标消失）已由 `bcad3b3245f58854ed18137e051514ba3f230eed` 修复并通过限定源码复核；焦点修复仅有源码证据，不表示实际浏览器键盘验收。

| 证据 | 实际结果与范围 |
| --- | --- |
| Task1启动／存储行为 | 8项通过，真实引擎与存储夹具；不是浏览器交互 |
| Task1修复后语义渲染行为 | 9项通过，最新结果／刷新／中断／剧情短战反馈；不是视觉快照或DOM焦点测试 |
| 本轮 `npm run release` → `npm test` | 10个测试文件通过，0失败／跳过／取消；当前runner显示文件级结果，不能写成仅10个行为用例 |
| 同一release → `npm run check` | `Syntax checked 23 JavaScript files.` |
| 同一release → `npm run build` | 成功，离线HTML 321678字节 |
| `npm run build:worker -- --source-commit bcad3b3245f58854ed18137e051514ba3f230eed` | 成功，Worker 327617字节；仅本地验证 |
| Node产物检查 | Paper CSS原文和session模块／bootstrapSession内嵌；静态CSS／模块与源码逐字相同；离线副本一致；无外部script／stylesheet标签 |
| 本地Worker handler检查 | health状态／SHA／HTML哈希一致；GET首页和下载逐字匹配离线HTML；HEAD无正文、404、405通过。release中的既有Worker测试亦通过 |

npm仍报环境警告 `Unknown env config "http-proxy". This will stop working in the next major version of npm.`；release与Worker打包均退出0。首次产物检查脚本误用 `src/paper.css` 路径而报ENOENT，改为实际 `src/ui/paper.css` 后全项通过；无生产源码修改。

| 本地候选元数据 | 实际值 |
| --- | --- |
| `release/release.json`版本 | `1.2.0` |
| 构建UTC | `2026-10-25T04:28:13.023Z` |
| 离线字节 | `321678` |
| 离线SHA-256 | `7aa67d0d51e6d41f9e2b29017f6ad786af247e7837fd732d931d50c844aa16d1` |
| 运行时依赖 | `0` |
| 本地Worker验证sourceCommit | `bcad3b3245f58854ed18137e051514ba3f230eed`，打包时完整本地HEAD，**validation-only** |

上述SHA来自元数据／文档修改尚未提交时的本地HEAD；构建工作树已包含package版本1.2.0。它只标识本地验证所传的来源参数，不是包含本轮元数据的精确提交，也不是GitHub发行或生产源码证明。控制方完成评审／合并后必须从实际发行源码重新构建并记录真实health、下载哈希和部署证据。

### 1.2.0初次候选时仍待完成的验收

没有使用浏览器、headless、CDP、本地／外部preview或策略绕过。320px实际布局、浅深色外观、实际键盘／DOM焦点、对话框焦点恢复、读屏播报与视觉一致性均待获准环境验证；源码／Node／离线包检查不能证明这些结果。没有1.2.0生产UI、真实设备或20–30分钟真人节奏证据。本轮不推送GitHub、不部署Cloudflare、不改部署说明；控制方负责正式发布与实际生产审计。

## 历史 1.2.0最终候选复核 — 2026-10-25

整分支评审发现撤退提示没有明确药材和灵石损耗、燃寿不可用原因仅在tooltip、帮助按钮宽度不足44px。限定修复后，三项均通过独立源码复核，没有发现修复引入的新问题。引擎、剧情内容和存档格式未改变。

- 战斗按钮现在显示实际撤退损失（灵石向上取整20%、药材最多1份）、两种资源当前余额和2年时间成本。8项新增真实渲染／引擎用例覆盖正余额、零余额、取整，以及燃寿4／5／6年边界；先观察7失败／1通过，再全部通过。
- 原有9项最新结果渲染用例和8项启动／存储用例保留。不可用燃寿有直接可见说明及虚线边框；工具栏按钮最小宽高均44px。这些是源码和Node证据，不冒充浏览器尺寸或读屏验证。
- 控制方在最终运行时提交后的干净HEAD重新执行 `npm run release`：**11个测试文件通过、0失败，25个JavaScript文件语法检查通过**；构建UTC `2026-10-25T04:42:03.769Z`，离线HTML **322726字节**，SHA-256 **`709ee3db3d1378f2b954c17de3e513ec56a6648f5ebe0ec1ac63288b751ba3d7`**。现有npm环境警告仍出现，命令退出0。
- 新增战斗渲染模块通过既有静态named import打包；CSS与模块内嵌、静态副本及离线副本一致，无外部script／stylesheet依赖。上述321678字节是较早候选，不是本次最终产物。

此条目记录正式发布前候选；当时尚待 GitHub 合并、CI 和生产验收，现已由下文正式发行记录完成。

## 1.2.0 正式发行与生产验收 — 2026-10-25

[PR #2](https://github.com/ct1150/wending/pull/2) 已合并，实际生产源码为 [`90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`](https://github.com/ct1150/wending/commit/90bb910840e7c2b22c59e0421f111c4c1a7cb7c8)。发行 tree `ec460fa26506ce0946a0a5edf9f5222ed5e8ab65` 与已评审本地 `0d015eb82554c840a9bbcfd774a07d4f57dc25ba` 的 tree 相同；本地合成历史未直接推送。以下为控制方实际核实的发行证据，本次文档审计没有重跑构建或测试。

| 证据 | 实际结果 |
| --- | --- |
| PR CI | [40163973639](https://github.com/ct1150/wending/actions/runs/40163973639)：success |
| main CI | [40164006388](https://github.com/ct1150/wending/actions/runs/40164006388)：success；validate job `121081217915` success，deploy job `121081258031` skipped |
| 最终本地 release | 11/11 个测试文件通过（不是 11 项独立行为测试），25 个 JavaScript 文件语法检查通过；聚焦行为用例为启动 8、最新结果渲染 9、新增战斗 8 |
| 精确源码产物 | HTML 322726 字节，SHA-256 `709ee3db3d1378f2b954c17de3e513ec56a6648f5ebe0ec1ac63288b751ba3d7`；Worker 328691 字节 |
| 本地精确源码 handler 检查 | `2026-10-25T05:01:40.998Z` 核实身份一致；这是检查时间，不是构建时间 |
| 实际部署 | Deployment `e890d80a-dbda-475b-a1c9-c32589b29803`，100% version `1c5deb80-2930-4a53-9c8c-956fe7c712e3`；创建 `2026-10-25T05:02:16.128157Z` |
| 生产 health | [healthz](https://baishi-wending.ct1150.workers.dev/healthz) 实际返回 status ok、上述发行 sourceCommit 与 HTML SHA-256 |
| 游戏内实际下载 | 经设置下载 322726 字节，与精确源码 HTML 逐字相同，SHA-256 同上 |

此次通过 API 手动上传已有普通 Worker；没有启用自动部署或迁移 Static Assets。实际 deployment ID 取自 deployments endpoint，上传响应的 `deployment_id` 字段是无连字符的 version ID，不能混作 deployment ID。Worker tag `d4ceaa79ca7d4ca48954b1117458297f`、compatibility date `2026-10-24`、usage model `standard`、bindings 0 保持不变。

### 实际生产桌面交互

在 [生产游戏](https://baishi-wending.ct1150.workers.dev/) 使用先前 1.1.0 的 YG02“不肯烧掉的药簿”存档，重载进入 Paper 后仍为云归／剑修、16 岁、余寿 84、气血 120/120、灵石 24、药材 3、距封谷 8 年，上一条选择保留。此检查没有清空存档建立首世；首次启动由上述 8 项 Node 用例覆盖。

- 键盘 Enter 选择“答应先查真相，再谈灵种”进入 YG03，可见实际药材 +2；选择“申请公开查档”到“灯下选下一条路”，灵石实际由 24 降至 16，药材为 5。
- 展开“状态”和“修行”，键盘 Enter 执行闭关：经过 3 年，年龄 19、余寿 81、修为 13/36、灵石 21、药材 5、距封谷 5 年。最新结果为“闭关修行”，焦点在 `story-result-title`；两个辅助区在重绘后保持展开。
- 刷新后完整 `main-content.textContent` 保持一致；辅助区在重新加载后自然折叠。设置返回聚焦 `story-scene-title`。帮助以原生 dialog 打开并聚焦关闭按钮，Escape 关闭后恢复帮助按钮焦点；帮助目标实际测得 44×44px。
- 实际 viewport 为 1363×936，pageWidth 1348，此桌面视口无横向溢出；浅色 body 背景为 `rgb(250, 248, 242)`。已观察日志仅有 chrome-extension metadata 错误，没有观察到应用 warn/error；这不是对所有 pageerror 的完整捕获声明。

### 1.2.0 剩余验收边界

320px 和深色主题的实际外观、真实手机、辅助技术／读屏、真人 20–30 分钟节奏及全部结局的生产全通仍未验证。没有执行本地／原型浏览器检查或绕过方案；历史 1.1.0 浏览器检查不能用于证明 Paper。此次生产 UI 检查覆盖已有存档继续及上述操作，没有覆盖全新首世浏览器开局。源码／烟测截图由控制方保留，不作为仓库文件提交。

**生产源码保持 `90bb910840e7c2b22c59e0421f111c4c1a7cb7c8`，不随此次上线后的文档提交改变；health 应继续标记真正构建并上传的源码。**
