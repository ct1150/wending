# 全书剧情知识的覆盖与私有存储

本目录的 `fanren-coverage.json` 记录用户提供文本的覆盖核算。运行时公开代码只包含章节与证据标识、校验值、通用概念索引和 120 张抽象改编卡；原文证据保留在私有资料包和私有 Workers KV，不应提交公开 Git 仓库或打包进浏览器资源。

## 覆盖含义

当前内容版本为 `fanren-full-v1-b4a4d1c0329acb9f5ec2`：2,454 个来源篇章（2,451 个正文篇章及 3 个外传）、7,936 个连续证据窗口、137,443 个符合条件的叙事段落、7,574,058 个正文字符，分为 248 个不可变 KV 分片。原文中的重复印刷章号不作为唯一键；篇章使用 `FR-0001` 至 `FR-2454` 标识。

完整覆盖指所有符合条件的原始叙事段落均被证据窗口覆盖一次。窗口是确定性的段落和长度切分结果，标记为 `source_evidence` / `deterministic_extract`；不代表已经识别所有语义场景，也不代表逐条经过人工或模型审校，更不代表每段都已经写成三分支卡片。原有 120 张精选改编卡来自 110 个不同源章节，是独立的精选层。

广告、空白、章卷标题、分隔线及作者感言按原因排除并记录在覆盖报告中。末章作者感言和新书宣传的 966 字符，以及 6 字符的完结标记，不进入剧情检索。偏移单位是 Unicode code point。

## 可复现构建

需要用户提供的规范化 UTF-8 原文、对应的 `chapter-index.json` 和 `curated-cards.json`。私有资料包包含章节索引、卡片、构建器、分片、清单和逐段核算，但不附原始规范化文本；精确重建需要另外提供该源文件。源文件 SHA-256 为：

```text
6f57fb63c67179fcb57557459647c28c728f427c88024bcbf30548da69b6992f
```

在仓库根目录运行，替换三个输入文件路径：

```sh
python scripts/build-story-knowledge.py \
  --source /private/normalized-source.txt \
  --chapters /private/chapter-index.json \
  --cards /private/curated-cards.json \
  --catalog src/worker/knowledge/catalog.js \
  --curated src/worker/knowledge/curated.js \
  --coverage docs/knowledge/fanren-coverage.json \
  --private-dir .scratch/full-novel-rag/corpus
```

构建器不调用网络、嵌入模型或语言模型。输入内容、构建器本身和切分参数共同决定内容版本。改变构建器会产生新的版本和新的 KV key，不能覆盖已发布的不可变分片。默认每个分片包含 32 条证据，当前仓库的参数范围为 1–64，与运行时加载器一致。

**精确复现本次冻结版本时，使用私有资料包内的 `tools/build-story-knowledge.py` 和默认 32 条参数。** 包内保留生成 `fanren-full-v1-b4a4d1c0329acb9f5ec2` 时的原构建器。仓库随后收窄了分片参数的支持范围；即使使用相同默认参数，其文件摘要变化也会产生新的内容版本。本次经逐段核验的 catalog、清单和 248 个分片保持原版本，不能将新生成的分片混入旧清单或既有 KV key。

## 私有导入与完成标记

实际导入需要对具体私有存储目的地的授权。`manifest.json` 定义所有分片的完整 KV key、UTF-8 字节数及 SHA-256。将原始分片字节写入对应 key，避免先解析 JSON 再序列化造成字节变化；不得设置到期时间。遇到已存在且校验相同的 key 可以跳过，遇到不同字节应停止并查明原因。

只有全部 248 个分片都已从远端读回并逐个校验后，才可以把 `manifest.private.json` 的原始字节写到完成标记 key。完成标记不是包含原文的大清单，而是简短的版本、数量和分片摘要。当前标记 key 与 SHA-256 为：

```text
fanren/fanren-full-v1-b4a4d1c0329acb9f5ec2/manifest
909c58aa640bd47c87330e90b383ac68bdc9a66e5e4f462ba69784bd3540d861
```

运行时先验证完成标记，再对实际读取的少量证据分片验证固定校验值。缺少绑定、标记、分片或校验不符时，生成应以 `KNOWLEDGE_UNAVAILABLE` 暂停，并在模型推理前返回。

## 只读核验

1. 使用 Cloudflare 的 namespace keys 接口列出全部 key，按 cursor 翻页，核对当前版本的 248 个分片和完成标记。
2. 对每个清单中的 key 调用 values 读取接口，在程序内部对原始 UTF-8 字节计算长度与 SHA-256；只输出 key、长度、校验值和结果，不输出原文。
3. 校验完成标记的固定 SHA-256，再检查其版本、来源哈希、数量及分片摘要。
4. 核对 Worker version 的绑定类型、namespace ID 和代码身份。应保留既有 AI、Durable Object 及秘密绑定，仅增加知识库绑定。
5. 检查 `/api/story/knowledge` 的就绪元数据和实际生成流程。该接口就绪只证明配置与完成标记通过检查；实际选中的分片仍需在每次加载时校验。

本文件描述资料和发布流程，不声明当前私有导入或生产上线已经完成。
