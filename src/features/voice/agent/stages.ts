import { defineFlow } from '../../../agent'
import type { AgentStageDef } from '../../../agent'

export const VOICE_ADVANCED_FLOW_ID = 'voice-advanced-dub'

export const VOICE_DUB_STAGES: AgentStageDef[] = [
  {
    id: 'ingest',
    order: 1,
    roleName: '文稿整理',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '规范化长文本，清理异常字符与空行，检查单段长度限制。',
    headline: '正在整理文稿…',
  },
  {
    id: 'segment_planner',
    order: 2,
    roleName: '分段策划',
    roleTag: 'AI 分析',
    kind: 'model',
    profile: 'plan',
    principle: '按口播/宣传逻辑（开场、痛点、卖点、福利、收尾等）拆分段落，并为每段生成自然语言语气指令。',
    headline: 'AI 正在拆解段落并规划语气…',
  },
  {
    id: 'plan_review',
    order: 3,
    roleName: '方案校验',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '校验分段完整性；语气说明超 100 字软截断；段正文超 3500 字在句边界再切，硬顶 10000。',
    headline: '正在校验分段方案…',
  },
  {
    id: 'segment_tts',
    order: 4,
    roleName: '逐段配音',
    roleTag: '语音服务',
    kind: 'tool',
    principle: '严格按确认后的文案与语气参数，分段调用语音模型合成高质音频。',
    headline: '正在逐段合成配音…',
  },
  {
    id: 'merge_audio',
    order: 5,
    roleName: '拼接成片',
    roleTag: '音频处理',
    kind: 'algo',
    principle: '解析多段音频 PCM 数据，在浏览器端顺序拼接为一条高保真 WAV 音频。',
    headline: '正在拼接完整成片…',
  },
  {
    id: 'finalize',
    order: 6,
    roleName: '成片定稿',
    roleTag: '产物归档',
    kind: 'algo',
    principle: '生成成片元数据与分段试听索引，完成任务归档。',
    headline: '高阶配音已就绪！',
  },
]

defineFlow(VOICE_ADVANCED_FLOW_ID, VOICE_DUB_STAGES)
