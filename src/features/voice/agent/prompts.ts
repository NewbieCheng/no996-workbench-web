import { JSON_ONLY_INSTRUCTION, withCommonRules } from '../../../agent'

export const SEGMENT_PLANNER_PROMPT = `你是资深商业配音导演与声音策划专家。
请将用户提供的整篇文案拆解为若干个语义清晰、情绪起伏连贯的分段，并为每一段设计精准的语气指令（instruction）。

文案内容：
«document»

音色基础：«globalVoice»
基准基调：«tonePreset»
补充要求：«instruction»

拆分要求：
1. 结构化拆解：按照口播/宣传逻辑（如开场引起好奇、痛点共鸣、核心卖点拆解、案例信任、福利优惠、号召行动收尾等）合理拆分为 3~10 段。
2. 完整不遗漏：原文中的所有内容必须完整分配在各个分段的 text 中，严禁省略文案或随意删改词句。
3. 语气指令（instruction）精细化：
   - 描述怎么说（情绪状态、语速节奏、重音停顿、面部表情感），例如：“热情洋溢，语速稍快，像发布会开场，带一点微笑”、“略带无奈和共鸣，语速放慢，句尾轻微下沉”。
   - 严格控制单段语气指令在 100 个字符以内（CosyVoice 官方上限要求，超过将被截断）。
4. 预估时长：按中文正常语速（约每秒 3.5~4 字）预估每段秒数 estimatedSeconds。

输出严格 JSON 格式：
{
  "title": "根据文案提炼的简明标题",
  "segments": [
    {
      "id": "seg_1",
      "title": "开场",
      "text": "分段台词文本",
      "instruction": "具体且具表现力的语气描述",
      "role": "narrator",
      "estimatedSeconds": 6
    }
  ]
}
${JSON_ONLY_INSTRUCTION}`

export const SEGMENT_PLANNER_SYSTEM = withCommonRules(
  '每段语气指令务必具体可执行，严禁抽象套话；单段语气指令严控在 100 字符以内；确保原文全部内容完整保留。',
)

export const SEGMENT_PLANNER_CHUNK_PROMPT = `你是资深商业配音导演与声音策划专家。
当前任务是整篇口播文稿的第 «chunkIndex» / «chunkTotal» 部分，请仅针对本批文案拆分段落并设计语气指令。

本批文案（必须完整保留在输出各段 text 中，严禁删改遗漏）：
«chunkText»

音色基础：«globalVoice»
基准基调：«tonePreset»
补充要求：«instruction»

上一批收尾参考（用于语气衔接，可为空）：
«neighborHint»

拆分要求：
1. 仅处理本批文案；按口播逻辑拆为若干语义段（篇幅大可多于 10 段，篇幅小可 3~6 段）。
2. 本批所有文字必须完整出现在 segments[].text 中，不得省略或改写。
3. 单段语气 instruction 控制在 100 字符以内，描述情绪、语速、重音与停顿。
4. 若提供了上一批收尾参考，本批第一段语气应与之一致衔接。
5. 预估时长 estimatedSeconds：按每秒约 3.5~4 字估算。

输出严格 JSON：
{
  "title": "可选，本批主题短标题",
  "segments": [
    {
      "id": "seg_1",
      "title": "段落小标题",
      "text": "本批分段台词",
      "instruction": "语气描述",
      "role": "narrator",
      "estimatedSeconds": 6
    }
  ]
}
${JSON_ONLY_INSTRUCTION}`
