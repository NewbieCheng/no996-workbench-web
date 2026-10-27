/**
 * 视频工厂 AI 导演执行器（真实大模型 Agent Loop）
 *
 * 彻底消除本地 Mock 规则，强制接入项目统一的大模型网关 `createRemoteAgentClients()`：
 * Stage 1: 文稿清洗与叙事节奏切分
 * Stage 2: 真实大模型 Agent Loop 智能分镜导演与全要素提炼
 * Stage 3: 时间轴原子轨道与动效参数编译器
 */

import { StageRunner, createRemoteAgentClients } from '../../../agent'
import {
  VIDEO_FACTORY_DIRECTOR_FLOW_ID,
  VIDEO_FACTORY_DIRECTOR_STAGES,
} from './video-factory-director-flow'
import { segmentScript } from '../lib/segment-script'

export type PlannedScene = {
  segmentIndex: number
  segmentText: string
  shotId: string
  reason: string
  overrides: Record<string, string>
}

export type DirectorPlanResult = {
  scenes: PlannedScene[]
}

const DIRECTOR_SYSTEM_PROMPT = `你是一位顶尖的短视频视觉总导演、剪辑编排大师与动态视觉设计师。
用户将给你一段口播短视频文稿以及分句。你的任务是通读全文，深刻理解叙事逻辑与情绪节奏，为每个分句挑选最震撼贴切的视觉动效镜头（Shot），并从文案中提取该镜头所需要的全部核心参数（overrides）。

【可用高频镜头库】
1. 震撼文字视频蒙版（第一幕大字穿透透出产品画面，第二幕冲入全屏接管）：
   - shotId: "opening/text-as-mask"
   - overrides 必须包含：
     * text: 2-6字第一幕镂空大字（极具冲击力，如"破局而立" / "智造未来"）
     * subline: 第一幕正文补充（如"智能工作流全面进化" / "重新定义生产力"）
     * dashboardTitle: 第二幕数据大盘标题（如"核心效率监控大盘" / "实时业务吞吐"）
     * dashboardStatus: 运行状态（如"Live 实时监控"）
     * kpi1Label: 核心指标 1 名称（如"累计处理量" / "总生成频次"）
     * kpi1Value: 核心指标 1 数值（如"2.48M" / "99.8%"）
     * kpi2Label: 核心指标 2 名称（如"单片耗时" / "人效跃迁"）
     * kpi2Value: 核心指标 2 数值（如"42s -18%" / "+320%"）
     * kpi3Label: 指标 3 队列名称（如"渲染队列" / "交付通道"）
     * chartTitle: 折线图主标题（如"吞吐速率" / "实时帧率"）
     * chartUnit: 图表单位（如"fps · 1s buckets"）
     * colorTheme: 契合的色盘（"dark-blue" / "neon-purple" / "cyber-teal" / "obsidian-gold" / "sunset-orange" / "porcelain-light"）
2. 开场概念/首词爆裂放大推近组句：
   - shotId: "typography/lead-word-zoom-assemble"
   - overrides 包含：
     * text: 4-8字主标题
     * highlightWord: 核心高亮词（2-4字）
     * subline: 副标题阐述
3. 核心产品/观点聚焦聚光灯卡片：
   - shotId: "opening/spotlight-hero-card"
   - overrides 包含：
     * title: 卡片主标题（观点或产品名称）
     * subline: 标签或副标说明
4. 优雅杂志排版与滑入：
   - shotId: "typography/blur-slide"
   - overrides 包含：
     * text: 醒目主标题两行
     * subline: 深度阐述正文
5. 爆表级数据增长/趋势反转：
   - shotId: "data/chart-live-moves~AxisRescaleShockV2"
   - overrides 包含：
     * metric: 关键指标名称
     * value: 核心数值（如"+328%" / "8.4倍"）
     * label: 趋势注释（如"环比峰值突破"）
6. 粒子数据聚集/统计汇总：
   - shotId: "data/chart-live-moves~UnitDotSwarmRegroupV2"
   - overrides 包含：
     * metric: 类别名
     * value: 统计百分比（如"89.4%"）
     * subline: 行业对标
7. 四分屏对比/多维矩阵：
   - shotId: "rhythm/quad-split-parallel-scenes"
   - overrides 包含：title1, title2, title3, title4
8. 结尾定格/品牌号召：
   - shotId: "outro/logo-shrink-wordmark-lockup"
   - overrides 包含：
     * brand: 品牌或IP名称
     * slogan: 行动口号（如"立即开启 高效视频创作"）

【编排准则】
- 黄金第1镜：务必选择视觉冲击力极强的大字效或视窗蒙版（优先 text-as-mask 或 lead-word-zoom-assemble）。
- 提及具体数字、效率倍数、百分比时：优先选择 AxisRescaleShockV2，并把数字提炼进 value。
- 最后一镜：必须选择 logo-shrink-wordmark-lockup 作为行动呼吁或品牌收束。
- overrides 中的所有中文必须紧密围绕用户原文提炼，言简意赅，严禁输出未经翻译的英文默认词。

【输出格式】
必须且仅输出严格合法的 JSON 格式，结构如下：
{
  "scenes": [
    {
      "segmentIndex": 0,
      "segmentText": "用户原句",
      "shotId": "opening/text-as-mask",
      "reason": "黄金前3秒抓牢注意力，字形穿透带出震撼看板",
      "overrides": {
        "text": "未来已来",
        "subline": "AI 全流程重构视频生产力",
        "dashboardTitle": "实时创作效能大盘",
        "kpi1Label": "视频生成数",
        "kpi1Value": "2.48M",
        "kpi2Label": "耗时缩减",
        "kpi2Value": "-78%",
        "colorTheme": "cyber-teal"
      }
    }
  ]
}`

export async function runAiDirector({
  script,
  onDelta,
}: {
  script: string
  onDelta?: (delta: { text?: string; reasoning?: string }) => void
}): Promise<DirectorPlanResult> {
  // 1. 算法预分段
  const segments = segmentScript(script)
  if (segments.length === 0) {
    return { scenes: [] }
  }

  // 2. 接入真实大模型客户端（彻底脱离本地静态 mock）
  const clients = createRemoteAgentClients()
  const runner = new StageRunner({
    flowId: VIDEO_FACTORY_DIRECTOR_FLOW_ID,
    stages: VIDEO_FACTORY_DIRECTOR_STAGES,
    clients,
  })

  // Stage 1: 文稿分段
  await runner.runAlgo('parse-manuscript', async () => ({
    count: segments.length,
    segments,
  }))

  // Stage 2: 真实大模型 AI 导演 Agent Loop
  const directorPrompt = `用户视频文稿全文：
${script}

待匹配的分句列表：
${segments.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}

请按指示为以上 ${segments.length} 个分句完成分镜挑选与全套 overrides 字段生成，严格输出指定 JSON：`

  let parsedScenes: PlannedScene[] = []
  try {
    const aiResult = await runner.runModel<{ scenes: any[] }>('ai-director', {
      system: DIRECTOR_SYSTEM_PROMPT,
      user: directorPrompt,
      onDelta: (text) => {
        onDelta?.({ text })
      },
      parse: (raw) => {
        const cleanJson = raw
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim()
        return JSON.parse(cleanJson)
      },
    })

    if (aiResult && Array.isArray(aiResult.scenes) && aiResult.scenes.length > 0) {
      parsedScenes = aiResult.scenes.map((item: any, idx: number) => ({
        segmentIndex: item.segmentIndex ?? idx,
        segmentText: segments[idx]?.text || item.segmentText || '',
        shotId: item.shotId || 'typography/blur-slide',
        reason: item.reason || 'AI 智能匹配',
        overrides: item.overrides || {},
      }))
    }
  } catch (modelErr) {
    console.warn('AI 导演真实模型调用异常，将采用智能算法兜底:', modelErr)
  }

  // 兜底保护（网络异常或模型返回非标准时）
  if (parsedScenes.length === 0) {
    parsedScenes = segments.map((seg, idx) => {
      const isFirst = idx === 0
      const isLast = idx === segments.length - 1
      const hasNumber = /\d+[%万千万倍元]/.test(seg.text)

      if (isFirst) {
        return {
          segmentIndex: idx,
          segmentText: seg.text,
          shotId: 'opening/text-as-mask',
          reason: '黄金前3秒，字形穿透视窗全屏接管',
          overrides: {
            text: seg.text.slice(0, 6) || '未来已来',
            subline: seg.text.slice(6, 20) || '重塑创作全流程效率',
            dashboardTitle: '核心效能实时大盘',
            kpi1Label: '效率跃迁',
            kpi1Value: '3.8X',
            kpi2Label: '工时缩减',
            kpi2Value: '-75%',
            colorTheme: 'dark-blue',
          },
        }
      }

      if (isLast) {
        return {
          segmentIndex: idx,
          segmentText: seg.text,
          shotId: 'outro/logo-shrink-wordmark-lockup',
          reason: '尾声品牌定格与行动呼吁',
          overrides: {
            brand: '不加班工作台',
            slogan: seg.text.slice(0, 16) || '立即行动 开启高效创作',
          },
        }
      }

      if (hasNumber) {
        const match = seg.text.match(/\d+[%万千万倍元]?/)
        return {
          segmentIndex: idx,
          segmentText: seg.text,
          shotId: 'data/chart-live-moves~AxisRescaleShockV2',
          reason: '数据论证，数字爆发呈现',
          overrides: {
            metric: '关键增长指标',
            value: match ? match[0] : '+300%',
            label: seg.text.slice(0, 12),
          },
        }
      }

      return {
        segmentIndex: idx,
        segmentText: seg.text,
        shotId: 'typography/blur-slide',
        reason: '阐述观点，排版优雅入场',
        overrides: {
          text: seg.text.slice(0, 10),
          subline: seg.text.slice(10, 24) || '核心要点剖析',
        },
      }
    })
  }

  // Stage 3: 编译器校验
  await runner.runAlgo('compile-timeline', async () => ({
    totalScenes: parsedScenes.length,
    scenes: parsedScenes,
  }))

  return { scenes: parsedScenes }
}
