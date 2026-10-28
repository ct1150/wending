# 问鼎待办与交付账本

更新：2026-10-28，本轮继续完成代码待办；14:28:21（UTC+8）只读核对原账本仍为8次/450，完整status与上一检查点逐值一致。用户最新方向：取消固定一世时长，按肉鸽选择持续生成剧情，直到人物死亡；使用 Cloudflare Workers AI 免费额度实时生成。

## 已确认的真实续验（执行中）

用户在2026-10-28明确回复“确认”，批准[四步续验方案](superpowers/plans/2026-10-28-controlled-reacceptance.md)：总上限12次/900 Neurons，Task1/7/8为4/5/3，保留原8次/450及全部失败，最多新增4次且任一步失败即停。仅修改统一实验额度配置及对应边界回归；生产白名单、公开开关、严格校验和存储身份保持原合同。部署及真实调用结果单独记录，不能以授权或本地测试代替通过。

专项96/96、完整release723/723、142项JavaScript语法与971,109字节HTML已通过，独立审查无阻塞问题；[预检证据](evidence/controlled-reacceptance-preflight-2026-10-28.json)保留旧上限下的预期失败、当前源码指纹和原部署观察。四步真实执行仍待当前提交CI、实际新proof及部署/账本回读。

## 前一轮续办：离线实现与真实验收分别结项

M1请求体绝对10秒deadline/abort与M2异步焦点恢复已实现并交叉审查；生成schema已补旁白/对话、实体状态、记忆状态及非空文本约束，严格runtime校验未放宽。新增私有固定诊断与输入/用量元数据，在原账本终态内一次性保存并核对hash，不进入公开响应或玩家缓存，不补写旧失败信息。基线登记已兼容前序failed Task8，仍不能跳过reserved/unknown/已有成功来源。

恢复后最新完整release已通过**722/722**测试，失败/取消/跳过/todo均0；142项JavaScript语法、17模块默认关闭后端打包通过。HTML971,109字节，摘要、源码指纹和各轮验证记录见[QA](QA_REPORT.md)及[结构化证据](evidence/remaining-completion-2026-10-28.json)。最初721/722的旧提示词断言失败保留；修正后整套重跑，未把专项结果拼成全量通过。

正式生产构建路径也已准备：默认CLI始终输出disabled包；显式production才检查仓库开关、已验证registry、同账户Free证明和版本，使用原StoryBudget namespace且无新迁移。当前真实registry仍为空、仓库开关仍false；线上仍是74aa受保护stage，本轮没有部署或新增模型调用。

完整重验缺少的容量已核算并写成[待确认方案](superpowers/plans/2026-10-28-controlled-reacceptance.md)：原8次/450保留，四步还需4次，拟总上限12次/900、Task1/7/8为4/5/3。**该方案未生效，现有11/800、4/5/2仍执行。** 真实质量、成功选择/保存/刷新与公开发布继续待验收；不把本地通过当成模型通过。[本轮实施记录](superpowers/plans/2026-10-28-remaining-completion.md) · [本轮验证](QA_REPORT.md)

## 当前实施：选择驱动、持续生成、死亡终局

**已确认的四步共享开场方案在第一步停止：真实浏览器开场仅执行一次，于北京时间13:24:56.749返回 `GENERATED_SCENE_INVALID`，没有可用S1，步骤2—4未执行，不得继续模型调用。** 最新时钟修复 `74aa258` 已部署；本地全量655/655与 [CI40636654680](https://github.com/ct1150/wending/actions/runs/40636654680) 均通过，干净CI为134项语法、14模块默认后端打包，publish跳过。Task7真实质量、Task8玩家生成/保存/刷新与最终发布仍待完成，PR14保持Draft、main未合并。本地规则、协议、API、存档与界面已实现；所有者已确认Workers Free，实际直接AI/SQLite绑定已核对。

首轮 `deba31b` 受保护包的预检曾暴露生产模块初始化时钟为0，导致策略校验失败被永久缓存为 `STORY_STAGE_CONFIGURATION_INVALID`，当时Free proof也已在stage上传完成前过期。修复将策略验证移到请求阶段；GraphQL限流等待结束并取得新观察后，`74aa258` 的18模块私有helper与17模块受保护stage已于北京时间13:22部署，全部模块摘要匹配、原namespace与账本保留。此后一次Task8开场被拒；出生与pending已保存，刷新只取得同一次缓存拒绝，刷新前后档案四个store逐值一致。13:29:03.747回读仍为8次、450 Neurons保守预留，Task1/Task7/Task8累计4/3/1；原七行与三笔Task7失败保持不变，新失败只归Task8。

“每世20—30分钟”已取消；登仙、问鼎是人生阶段，实际死亡才结算。免费额度或网络不足时保留进度、暂停生成，不算死亡，也不自动转付费。

[新设计](superpowers/specs/2026-10-27-realtime-workers-ai-design.md) · [逐项实施计划](superpowers/plans/2026-10-27-realtime-workers-ai.md) · [已确认的共享开场方案](superpowers/plans/2026-10-28-shared-opening-acceptance.md) · [接入与实验记录](evidence/workers-ai-rollout-2026-10-28.json) · [受保护部署预检与时钟修复](evidence/shared-opening-preflight-2026-10-28.json) · [真实浏览器开场拒绝与刷新证据](evidence/shared-opening-browser-2026-10-28.json)

| 顺序 | 待办 | 核心验收 | 状态 |
| --- | --- | --- | --- |
| 1 | 核验 Workers AI 严格免费接入与模型能力 | 同账户Free硬边界、用量观察、真实中文结构与输出限制 | 所有者确认Free；直接AI/SQLite与账户分析观察已取得；小schema传输/中文/stop与非思考样本已证，完整生产模型验收仍待完成 |
| 2 | 新人生规则与独立内容版本 | 登仙、问鼎后继续；实际寿尽或致死才结算；选择改变资源、时间、风险与关系 | 本地实现、专项、独立复核及2026-10-27代码CI通过 |
| 3 | 动态剧情协议与连续记忆 | 保留人物、承诺、线索与事实收据，模型不能改写规则结算 | 本地有界检索/续接、永久关系和拒绝分类修复通过；真实连续剧情另验 |
| 4 | 同源实时API、共享免费预算与幂等 | 服务端预留、防刷、重放、故障恢复，不泄露密钥 | 本地实现/SQLite及修复复核通过；兼容后端已部署且生成关闭，已核对实际绑定 |
| 5 | 长期存档、历史分页与恢复事务 | 超过旧1M边界仍可继续；完整历史；刷新/导入失败保留人生 | 本地原生IndexedDB、v1→v2保留数据升级及完整恢复通过；自然磁盘满未实测 |
| 6 | 实时选择界面与可恢复等待 | 不重复结算；可续接、读历史、导出；说明最小上下文联网传输 | 本地320/390/1280px及出生预检通过；真实浏览器开场被拒后出生/pending保留，刷新GET重放缓存拒绝，档案四个store不变；成功剧情的选择/保存/恢复仍未验收 |
| 7 | 长线因果、死亡与真实模型质量 | 至少1000回合模拟验证，另审真实连续性与选择后果 | fixture长线/死亡/完整恢复通过；原三次Task7开场失败保持不变，质量未通过；共享开场未产生S1，两条Task7分支均未执行 |
| 8 | 后端部署、前端启用与交付 | 实际绑定、协议、真实选择→生成→保存→恢复闭环 | 时钟修复已通过655项并部署18模块helper与17模块受保护stage；一次真实浏览器开场被拒，记Task8 failed并保留111预留；步骤2—4停止，玩家闭环与发布未完成 |

状态区分本地实现、真实受控实验和面向玩家的启用。当前 `PRODUCTION_PROFILES` 为空，游戏构建策略 `enabled:false`、`modelValidated:false`；操作员辅助环境单独鉴权且不接入玩家路由，所有真实实验共用一个持久账本。未观察的验收不打勾。

Workers Free每日账号合计10,000 Neurons，北京时间08:00重置，耗尽后拒绝继续推理；所有玩家与账户其他项目共享额度。所有者已确认Free，此前订阅API403保留为历史权限记录，不再作为当前套餐未知的阻塞。已核对直接AI与SQLite免费路径；全账户GraphQL分析有延迟且不是账单计量，只作为有来源的保守probe准入观察，不能声称精确剩余额度。没有升级套餐、Gateway credits或付费后备。[官方定价](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [运行合同](WORKERS_AI_RUNTIME.md)

### 当前证据与按顺序剩余事项

最新修复 `74aa25884c5468d9eb90abb1bbb82ba92752ba0b` 的 [CI40636654680](https://github.com/ct1150/wending/actions/runs/40636654680) 为655/655项、0失败/取消/跳过/todo，134项JavaScript语法、970046字节HTML及14模块默认后端通过；实际checkout `bbce147f11b00de7003340943d2e38f54f5cf3ad` 与head同树 `e19215b7fec41cfa799aa9db0d60ec175a44dd55`，publish跳过。HTML SHA-256为 `3c3b09de319e2032c3990867780998d67adcb6af62fc9fe0a78cb35fdf46b5b0`。本地首次因浏览器路径缺失的21项失败已用现有浏览器路径完成整套重跑，最终655/655通过；本地343项语法包含ignored准备副本，不能作为干净CI文件数。真实预检、修复前后回归和最初正常TLS主页观察见 [预检记录](evidence/shared-opening-preflight-2026-10-28.json)；这些检查没有新增AI调用，之后的一次真实Task8开场另记。

历史 `bc742709` 的 [CI40626224045](https://github.com/ct1150/wending/actions/runs/40626224045)：618/618项测试、130项语法和14模块默认后端打包通过，publish跳过。该检查点的私有helper曾部署为16模块，之后已由首轮共享开场18模块helper替换；历史版本/部署ID见 [部署记录](DEPLOYMENT.md)。默认后端产物、私有helper与受保护stage不能混用模块数量或身份。

历史 `b780a84` 完成行动配对oneOf、可信场景摘要和同S1双分支代码及独立复核：当时本地646/646，失败/取消/跳过/todo均0，80.4605秒；133项JavaScript语法及970046字节HTML构建通过，覆盖原生Chromium、workerd/SQLite与1000回合fixture。[CI40628818519](https://github.com/ct1150/wending/actions/runs/40628818519) 同样通过646/646、133项语法与14模块默认打包，publish跳过。随后文档提交 `deba31b` 的首轮受保护包已实际部署，但未新增推理；这些历史结果不归入618项或最新655项，也不证明真实模型质量。

历史检查点（2026-10-28）：[CI40616175153](https://github.com/ct1150/wending/actions/runs/40616175153) 对应 `4992d658`，610项测试、130项语法和14模块后端打包通过，0失败/跳过；实际CI合并树已与已审源码逐树核对。包含ID范围修复、Task8共享准入和3036标记修正，publish跳过。下述539项继续保留其历史归属。

[2026-10-27代码CI](https://github.com/ct1150/wending/actions/runs/40547281694) 对应远端 `1322aa6` / 已审本地同树 `65c3d0f`：539项通过、0失败/跳过，117项语法、970055字节HTML及13个backend模块；1000回合完整导出4,993,731字节并恢复一致。I1—I4、R1及M3修复复核通过。该历史CI不包含后续操作员辅助代码；操作员helper独立复核与后续修订的定向结果单独见 [QA](QA_REPORT.md)，不与历史CI相加。[草稿PR #14](https://github.com/ct1150/wending/pull/14) 未合并；最新源码检查以PR当前提交为准。

历史11:42:46（北京时间）核验时，公开页面仍为4.0.0、main `e247a875`，接口为 `INFERENCE_DISABLED`。其后受保护stage改用970046字节内嵌HTML。第三次Task7开场 `task7-20261028-003` / `task7-opening-v3` 于11:25:22—11:25:28被拒绝为 `GENERATED_SCENE_INVALID / ACTION_PAIR_INVALID`；原正文未保存，不能确诊具体非法字段。13:17:18时原账本仍为7次/339预留；13:24新增的一次Task8失败使累计变为8次/450预留，三笔Task7失败及原results/cases均保留，`actualNeurons:null`。本次浏览器只公开 `GENERATED_SCENE_INVALID`，不能把旧Task7的诊断归给它。部署、原样本与本次浏览器观察分别见 [接入记录](evidence/workers-ai-rollout-2026-10-28.json)、[受保护预检](evidence/shared-opening-preflight-2026-10-28.json) 与 [真实开场及刷新](evidence/shared-opening-browser-2026-10-28.json)。

北京时间13:29:11.444的同UTC日账户GraphQL观察为count=8、input/output tokens=4363/2812、aggregate Neurons=105.87210083007812。这是有延迟的账户分析聚合，不是账单、精确余额或本次attempt的实测用量；450保守预留与逐笔 `actualNeurons:null` 不因此改写。真实浏览器DOM中文完整，但截图缺少中文字形，不能据此宣称中文视觉质量已验收。

北京时间13:30:22.097最终只读检查：health仍为 `74aa258`、970046字节内嵌HTML及上述摘要；无tester permit返回 `TESTER_PERMIT_REQUIRED`，携带permit但Free proof过期后返回 `FREE_BOUNDARY_UNVERIFIED`。该检查没有推理请求，真实浏览器已退出；不为继续调用而刷新proof。

1. 用户批准的总上限11次/800 Neurons、Task1/Task7/Task8上限4/5/2不变；已确认的 [四步共享开场顺序](superpowers/plans/2026-10-28-shared-opening-acceptance.md) 在第一步拒绝后停止。本轮不得继续任何模型调用，不能因账本尚有余量而重试、另造attempt或重建账本；全部历史失败与预留保留。
2. 第一笔Task8开场只执行一次，新增failed与111预留；刷新只GET查询同一缓存结果，13:29回读仍为8/450。保留出生、pending与原四个store，不把拒绝记作可用S1或完成开场；后续只读证据与离线问题分析不得触发推理。
3. 原计划步骤2—4（同S1的Task7分支A、分支B、Task8真实选择/保存/刷新）均未执行。Task7原三笔失败保持原归属，新增Task8失败不作第四笔Task7；完整游戏结构、中文内容、机械事实、反事实叙事及成功选择闭环继续列为未通过。
4. `74aa258` 的helper部署 `a3cccc55-406e-4785-8a75-90d1f457f080`、stage部署 `73aedb80-4191-42a7-8ab5-263821acb05d` 已回读核对；版本及逐模块身份见 [QA](QA_REPORT.md)。原13:17的限流和未部署状态保留为历史，不作为当前等待或追加授权请求。
5. Task7/Task8与发布门槛未通过，保持公开生成关闭、`modelValidated:false`、生产白名单为空，PR14保持Draft、main不动。未来任何验收调整须单独明确范围；回滚保留数据库v2、relationshipVersion:1读取器及原服务端账本。实测账单Neurons未知时保持null，预留与账户分析观察单独记录。

M1请求体读取deadline、M2异步整页重绘焦点恢复已在本轮离线实现并通过专项与独立审查；自然存储耗尽及其他浏览器/设备覆盖保留原未测边界。

## 已完成基线：4.0.0

此前六项技术交付已完成并上线为4.0.0。[线上游戏](https://baishi-wending.ct1150.workers.dev/) · [主实现 PR #12](https://github.com/ct1150/wending/pull/12) · [发行兼容修复 PR #13](https://github.com/ct1150/wending/pull/13)。这些完成状态只属于固定场景与构建前模型创作，不代表新的实时生成模式已完成。

### 4.0按顺序完成的待办

| 顺序 | 待办 | 完成证据 | 状态 |
| --- | --- | --- | --- |
| 1 | 统一方向并同步待办、设计与计划 | 初始 Git 提交 `cb2f391593d013a5e81b5260c8b1ea4ae8ebe84e`，明确非药谷、出身/命格、旧档、模型与发行范围 | 已完成 |
| 2 | 新出身、双命格和存档规则 | 四常规出身、两道不同命格、12点资质、单项锁定重掷；真实后世解锁第五出身/另两命格；旧引擎隔离、实际旧档更新前后逐字一致 | 已完成 |
| 3 | 不同人生与高阶三界 | 114个可达选择场景；四组不同命格组合；宗门/散修/同盟与三类探险；六次真实突破、材料/年月成本、三界道证、具名对手及再世行动 | 已完成 |
| 4 | 免费模型剧情创作 | 生成→校验→预览→明确接受→离线包；真实本地 llama.cpp/Qwen3-0.6B 候选已生成审核；模型只写开放文字位置，不写规则 | 已完成 |
| 5 | GitHub → Cloudflare 自动发行 | main 检查与 publish 都成功；保留3.1内嵌回退时，网关实际从 GitHub 自动获取4.0；health、首页、下载摘要一致；后续回退包更新为4.0 | 已完成 |
| 6 | 整体审查、合并、上线与证据 | 最终 GitHub 361/361、89个 JS语法检查；独立审查；真实线上68步通关/导入导出/后世/窄屏；真正断网file页面；证据已回填 | 已完成 |

接口确定后可并行准备互不冲突的内容，按以上顺序验收。未观察的体验不纳入完成声明。

### 4.0关键证据

- 主实现合并 `f2765e8a394f573f901e5cc8e42762fed74cb852`，树 `b3ada879552bf5a6da72cf0c69dd6d5af92a931a`；发行兼容修复合并 `2f7b97c05ab7f5324176c8148b3c21b0457eba40`，树 `afeb57e883ede2c820a5a7e07a385b24cc72566b`。远端树均与审查的本地树完全相同。
- [主实现 main CI](https://github.com/ct1150/wending/actions/runs/40510114942) 与 [修复后 main CI](https://github.com/ct1150/wending/actions/runs/40511080206) 的 validate、publish 均成功；最终为361项通过、0失败、0跳过。
- 实际完整网页路线68次选择、140岁问鼎；三界道证、传承、前尘行者及前世庇护均由正常行动获得。1280/390/320px无横向溢出，应用错误为0；真实导出/导入和刷新恢复完整状态。
- 离线 HTML 852849字节，SHA-256 `02b1248bd287b3f2ebc89aef6f22ab85d56364feef53d1b40d18f51a40ccf617`；真正 `file://` + `offline:true` 验证0外部请求。
- 线上旧 CV2 档更新前后导出均为2516字节、摘要 `b02ebf1f67424678c7e05541a4def861f63585c14ab4c050e579425ebf2b1f1a`，并能继续旧人生。
- 实际发行阶段发现 Workers 不支持 `redirect:error`；先真实复现，再改为 `manual` 并拒绝全部3xx，新增回归与独立复核通过。没有以 CI 成功替代线上成功。临时诊断 Worker 已删除。
- 旧草稿 PR #11 已关闭并指向 #12/#13，保留历史。

详细记录：[验收](QA_REPORT.md) · [部署](DEPLOYMENT.md) · [实际现场证据](evidence/roadmap-4.0.0-production.json) · [模型创作](STORY_AUTHORING.md)。

### 4.0保留的验证边界

- **固定20—30分钟目标已取消。** 历史记录中没有真人计时证据；68次选择仅记录4.0实际走通的路线，不再是后续内容长度或终局验收目标。
- **物理手机、原生中文 IME、屏幕阅读器：未实测。** 已验证 Chromium/Linux 的键盘、窄屏和焦点行为；控制器 IME 测试不等于平台输入法实测。
- 默认 Ollama `qwen3:4b` 未在本轮安装运行；真实推理证据对应本地 llama.cpp 的 Qwen3-0.6B。外部兼容服务由作者明确配置，不承诺免费。
- 分布式缓存与 GitHub 原始文件缓存会造成传播延迟；不承诺所有地区同时更新。实际服务身份以 `/healthz` 为准。

### 4.0实施前基线与依据

本轮从已通过检查的 main `12a948ed9e17ee39730340b1685b32711ebe0f33` 开始。此前线上3.1运行时为 `ffe37add4d9194566f327667f0a1a9d7b3ee7394`，26个测试文件、59个 JS语法检查；旧草稿#11为305项测试中16项失败。因此未直接合并该失败分支。

保留原生 JavaScript、极简单列阅读、本地存档、单文件离线与完整历史；旧人生继续原规则，只有明确新开局进入三界求仙篇。

[4.0历史设计](superpowers/specs/2026-10-27-roadmap-completion-design.md) · [4.0已完成计划](superpowers/plans/2026-10-27-roadmap-completion.md) · [4.0引擎契约](ENGINE_CONTRACT_CV3.md)。
