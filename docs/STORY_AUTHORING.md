# 可选的本地模型剧情创作

**适用范围：当前4.0的构建前创作工具。** 用户最新要求的Cloudflare Workers AI实时生成属于 [下一阶段设计](superpowers/specs/2026-10-27-realtime-workers-ai-design.md)，仍待实现；本工具和下面的本地推理记录不能替代运行时AI接入验收。

这是构建前的作者工具。4.0游戏本身无需 Ollama、Python、模型、网络或 API 密钥。固定场景、选项、判定、时间消耗、境界与结局始终由手写内容和引擎决定；模型只能为明确开放的稳定位置提供可选文字。

## 四步工作流

在项目根目录使用 Node 22 或更新版本：

```bash
# 1. 导出当前真实场景的固定事实和插入位置。
node scripts/story-author.js brief --out /tmp/story-briefs.json

# 2. 通过本地 Ollama 生成一个位置的候选文字。
node scripts/story-author.js generate --id arrival.atmosphere --out /tmp/story-candidate.json

# 3. 阅读来源、模型、简报哈希及全部候选正文。
node scripts/story-author.js preview /tmp/story-candidate.json

# 4. 作者确认文字后，明确执行接受。只有此命令修改游戏文字包。
node scripts/story-author.js accept /tmp/story-candidate.json

# 接受后重新构建离线游戏。
npm run build
```

省略 `--id` 时请求所有可用位置；批量生成可能比单位置更慢，小模型建议逐个生成。`generate` 必须显式提供 `.json` 输出路径，失败时保留已有候选文件。`brief` 和 `generate` 不允许将输出写入 `.js` 文字包。`preview` 只读。`accept` 固定写入 `src/game/cultivation/v3/prose.js`，其格式为 `export const ACCEPTED_PROSE = {"位置ID":"正文"};`。接受合并候选位置，其余已接受文字保留。

接受前逐段确认：只描写当前稳定环境或人物外观；没有声称已取得奖励、学会法门、选择道路、发生战斗或完成突破；没有新增事实或未来结果。自动校验限制结构、长度及安全文本，不能证明自然语言没有事实幻觉。作者可以编辑候选 JSON 的 `passages[].text`，然后重新预览、接受；不要修改位置 ID、简报哈希或来源标记。生成文字插在固定状态相关段落之前，不替代规则或行动。

## 默认 Ollama

工具不安装运行时，不自动下载模型，也不假定任何模型已安装。请先自行安装 Ollama 并启动本地服务，然后按需下载模型：

```bash
ollama pull qwen3:4b
# Ollama 已由桌面应用运行时无需重复启动。
ollama serve
```

默认请求 `http://127.0.0.1:11434/api/generate`，模型 `qwen3:4b`。请求包含 `stream:false`、`think:false` 和 `format` JSON schema。只有 `done:true` 且 `response` 为完整有效 JSON 时才保存候选；若服务返回 `done_reason`，只接受正常的 `stop`，拒绝因长度上限等原因停止的输出。实际所需内存、速度和输出质量取决于硬件与模型；小模型输出可能被校验拒绝，可重试或人工撰写。

```bash
node scripts/story-author.js generate --model qwen3:4b \
  --endpoint http://127.0.0.1:11434/api/generate \
  --timeout-ms 180000 --id arrival.atmosphere --out /tmp/story-candidate.json
```

协议依据：[Ollama Generate API](https://docs.ollama.com/api/generate)、[Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)。模型选用是可替换的默认配置，工具不会声称该模型在当前电脑已安装或已成功运行。

## 可选 OpenAI 兼容端点

只在作者明确设置 `openai-compatible`、完整端点和模型时启用。可以连接 llama.cpp、其他本地兼容服务，或作者自行选择的外部服务；没有默认付费服务。

```bash
STORY_AUTHOR_PROVIDER=openai-compatible \
STORY_AUTHOR_MODEL=local-model \
STORY_AUTHOR_ENDPOINT=http://127.0.0.1:18080/v1/chat/completions \
node scripts/story-author.js generate --id arrival.atmosphere --out /tmp/story-candidate.json
```

请求使用 `messages`、`stream:false` 和严格 `response_format.json_schema`。只接受唯一一个 `choices`、`finish_reason:"stop"` 且 `message.content` 为有效 JSON 的完整响应。兼容服务必须支持该结构化输出格式；截断的 `length` 结果会被拒绝。推理模型可通过服务端配置关闭思考；工具不会把推理内容当正文。

需要认证时仅通过环境变量 `STORY_AUTHOR_API_KEY` 传入。不要将密钥写进候选、简报、源码、命令行选项或端点 URL。URL 不允许用户信息、查询参数或片段。工具不输出密钥、Authorization、原始错误或服务端响应正文；静态文字包只含已接受正文。若使用远程服务，请自行确认它的成本和数据政策。

| 环境变量 | 含义 | 默认 |
| --- | --- | --- |
| `STORY_AUTHOR_PROVIDER` | `ollama` 或 `openai-compatible` | `ollama` |
| `STORY_AUTHOR_MODEL` | 服务端实际模型名称 | Ollama 为 `qwen3:4b`；兼容服务必须明确指定 |
| `STORY_AUTHOR_ENDPOINT` | 完整 HTTP(S) 请求地址 | Ollama 本地 `/api/generate` 地址；兼容服务必须明确指定 |
| `STORY_AUTHOR_TIMEOUT_MS` | 请求与完整响应共用的时间上限 | `120000`，范围 1–300000 |
| `STORY_AUTHOR_API_KEY` | 可选 Bearer 密钥，仅环境变量 | 无 |

非密钥配置也可以用同名语义的 CLI 选项 `--provider`、`--model`、`--endpoint`、`--timeout-ms` 覆盖。不存在 `--api-key` 选项。

## 候选格式、过期校验与失败保护

候选文件示意（哈希必须来自当前全部简报，以下占位值无法接受）：

```json
{
  "version": 1,
  "briefHash": "当前完整简报目录的SHA256",
  "generation": {
    "provider": "ollama",
    "model": "qwen3:4b",
    "status": "provider-response",
    "createdAt": "2026-10-27T00:00:00.000Z"
  },
  "passages": [
    {"id": "arrival.atmosphere", "text": "松梢托着清晨的薄雾，石阶间的苔痕浸着夜露。"}
  ]
}
```

模型只生成最内层的 `{"passages":[{"id":"…","text":"…"}]}`；来源信息和简报哈希由工具填写。哈希对全部场景简报做规范化处理，事实、提示语、标题、位置或场景变化都会使旧候选过期，即使当次只生成一个位置。预览与接受都会重验当前哈希和全部候选字段。

只允许已知、不重复的位置 ID 和长度 1–1600 的纯文字；请求提示建议每段 30–200 字。拒绝未知字段（包括 `choices`、`effects`、`realm` 等规则）、重复 JSON 键、原型键、非对象根、代码围栏、HTML 尖括号、控制字符、过深嵌套、非 JSON、无效 UTF-8、超过 256 KiB 的响应或候选文件，以及不完整的服务响应。每个候选至少包含一个位置。生成结果必须经过预览和明确接受，不能直接自动替换固定剧情。

写入使用目标目录中的独占临时文件、同步文件内容并原子重命名；验证失败、HTTP 错误、超时、截断或写入失败不会先清空旧文件。接受时读取已有文字包为静态 JSON，不执行 JavaScript。除可选前置单行注释和固定导出语句之外的代码会被拒绝。工具支持可靠的单作者顺序操作；多人同时接受同一文件应通过版本控制协调。

`generation.status:"provider-response"` 表示工具收到并验证了服务协议响应，不能独立证明服务内部运行了哪个模型。测试注入响应和本地 HTTP 模拟服务仅证明传输、解析与保存路径。手工测试夹具必须使用 `provider:"fixture", status:"fixture"`；该标记会显示在预览中，不得作为真实模型推理证据。无真实推理记录时，保持“真实模型未验证”的说明。

## 验证

```bash
node --test tests/story-author.test.js
npm test
npm run build
```

测试覆盖严格 JSON、未知规则字段、未知与重复 ID、长度、原型键、截断、超时（含停滞响应体）、大小限制、凭据不泄露、真实 localhost 模拟 HTTP、预览只读、简报过期、候选失败保留旧文件，以及接受/原子写入。若沙箱禁用本地监听，测试会明确跳过 HTTP 监听项，其他注入传输测试仍运行；该跳过不表示真实传输或模型已验证。

真实模型冒烟应保留命令、实际端点类型、模型名称、候选、预览结果和成功/失败结论。单元测试通过、运行时下载完成或成功启动服务都不能替代成功生成并审核候选的记录。

## 2026-10-27 真实本地推理记录

本轮实际启动了官方 `llama.cpp b11927` CPU 服务，载入官方 `Qwen3-0.6B-Q8_0.gguf`，使用 `openai-compatible` 协议和 `http://127.0.0.1:18080/v1/chat/completions`。运行 `generate --id arrival.atmosphere` 成功；随后实际执行 `preview`、逐句核对事实，并执行 `accept` 写入静态文字包。未调用付费云模型。最终扩大简报目录并修正出身适用范围后，重新生成、预览并接受当前事实对应的候选；此处记录的是最终候选。

- [实际候选及来源记录](evidence/authoring-4.0.0-candidate.json)，生成于 UTC `2026-10-27T13:01:47.713Z`。
- 接受位置为 `arrival.atmosphere`，仅用于山村猎户开场，描写雪地、远山、寒风和日光，没有声称玩家已行动、取得物品、结识人物或突破。其他出身可能在夜间或薄暮，渲染不会给它们添加这段村落日景。
- 小模型生成的文字较短，未达到该位置建议的 60—120 字长度；审核认为其可作为简短环境前缀，保留原文。它不替代手写主线，也不代表整部剧情由模型生成。
- `Qwen3-0.6B` 是本次用于证明完整工作流可运行的小模型。默认 `qwen3:4b` 的 Ollama 安装与真实推理没有在本轮执行，不能据此宣称该默认模型已验收。
- 核验范围包括真实运行时启动、模型载入、HTTP 推理、候选结构校验、预览与明确接受；不承诺其他电脑的速度、内存占用或输出品质。

原始来源：[llama.cpp b11927](https://github.com/ggml-org/llama.cpp/releases/tag/b11927)、[Qwen3-0.6B-GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF)。
