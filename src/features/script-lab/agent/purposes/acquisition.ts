import type { ScriptPurpose } from './types.ts'

/**
 * 获客型：让匹配的观众觉得「说的就是我」「我想再了解一下」。
 * 方法来自 acquisition-short-video-script/SKILL.md。
 */
export const ACQUISITION_PURPOSE: ScriptPurpose = {
  id: 'acquisition',
  label: '获客型',
  shortLabel: '获客',
  summary: '观众认出自己的问题，并愿意进一步了解',
  method: [
    '【获客型方法】只写一类具体人群、一个真实问题、一个能马上用的小方法、一个真实存在的沟通入口。',
    '1. 人群具体：说清身份、业务阶段或使用情境，不用「所有人」「每个家庭」。',
    '2. 问题单一：一条视频只解决一个问题，不承诺一次解决全部。',
    '3. 场景可见：用任务、动作、时间、地点还原处境，不用抽象痛点代替。',
    '4. 先交付一点价值：给出可执行的小方法、检查项或第一步，不把答案全扣到咨询环节。',
    '5. 入口真实：结尾只留一个资料支持、当前确实可用的行动；未提供渠道时只能用平台真实可用的评论或私信，不编造微信、表单、资料包。',
    '6. 事实有边界：不编造客户故事、效果数据、案例、资质或反馈；推断的人群与痛点保留建议语气。',
  ].join('\n'),
  reviewFocus: [
    '【获客型评审重点】',
    '1. 目标人群是否具体到能自我识别；',
    '2. 问题与场景是否匹配，是否只讲一个问题；',
    '3. 是否真的交付了一个可用方法或第一步，而不是全程铺垫；',
    '4. 结尾行动是否唯一、真实、与正文问题相关。',
  ].join('\n'),
  structures: [
    {
      id: 'acq-audience-callout',
      name: '人群点名型',
      summary: '身份、阶段与问题都明确时，直接点名人群',
      segments: [
        { name: '点名人群', purpose: '点名具体人群与所处阶段，让目标观众认出自己', share: 0.18 },
        { name: '具体困境', purpose: '还原一个正在发生的具体困境，不用抽象痛点', share: 0.22 },
        { name: '原因判断', purpose: '解释一个可能原因，区分已知事实与判断', share: 0.2 },
        { name: '可执行办法', purpose: '给出一个观众今天就能执行的小办法', share: 0.22 },
        { name: '沟通入口', purpose: '引导到一个真实、唯一的沟通入口', share: 0.18 },
      ],
    },
    {
      id: 'acq-problem-diagnosis',
      name: '问题诊断型',
      summary: '观众知道结果不理想，但不知道卡在哪一步',
      segments: [
        { name: '症状提问', purpose: '提出观众能对号入座的问题症状', share: 0.16 },
        { name: '检查清单', purpose: '给出具体检查项，数量与正文一致', share: 0.24 },
        { name: '检查原理', purpose: '解释这些检查项为什么与问题有关', share: 0.2 },
        { name: '先做一步', purpose: '提供一个可以立刻先做的动作', share: 0.22 },
        { name: '进一步诊断', purpose: '引导观众继续诊断，只留一个真实入口', share: 0.18 },
      ],
    },
    {
      id: 'acq-result-front',
      name: '结果前置型',
      summary: '确实有可展示的交付物、流程或结果素材',
      segments: [
        { name: '结果展示', purpose: '先展示真实交付物或结果，不伪造', share: 0.22 },
        { name: '针对问题', purpose: '说明它解决的到底是什么具体问题', share: 0.18 },
        { name: '关键步骤', purpose: '拆解形成它的关键步骤，可照着做', share: 0.24 },
        { name: '适用边界', purpose: '交代适用条件与使用边界，不夸大普适', share: 0.18 },
        { name: '了解入口', purpose: '引导观众通过真实入口进一步了解', share: 0.18 },
      ],
    },
    {
      id: 'acq-scene-rescue',
      name: '场景急救型',
      summary: '面对临近任务、直播、汇报等真实紧急情境',
      segments: [
        { name: '紧急场景', purpose: '还原真实紧急场景，不编造截止时间', share: 0.18 },
        { name: '低效代价', purpose: '指出一个低效做法与代价，无依据不虚构损失', share: 0.2 },
        { name: '最小方案', purpose: '给出能立即执行的最小方案', share: 0.26 },
        { name: '简单演示', purpose: '用现有素材或步骤做一次简单演示', share: 0.2 },
        { name: '下一步行动', purpose: '引导一个真实、可执行的下一步', share: 0.16 },
      ],
    },
  ],
  materials: [
    {
      key: 'problem',
      label: '具体问题',
      placeholder: '这类客户最常遇到的一个具体问题，越具体越好',
      required: true,
      multiline: true,
      maxLength: 200,
      presets: [
        '想做短视频获客，但选题没方向，不知道拍什么能吸引对的人',
        '知道要获客，一开口就像推销，评论区没人愿意继续聊',
        '每天都在发，问询很少，说不清卡在内容还是入口',
      ],
    },
    {
      key: 'method',
      label: '真实解决方式',
      placeholder: '你实际会怎么解决，或观众能马上做的第一步',
      required: true,
      multiline: true,
      maxLength: 300,
      presets: [
        '先给一个今天就能做的小检查清单，再说明为什么有效',
        '用一个真实场景演示最小可行做法，并标出适用边界',
        '拆成三步可执行动作，先交付一点价值再留沟通入口',
      ],
    },
    {
      key: 'channel',
      label: '沟通入口',
      placeholder: '真实可用的入口，例如「评论区回复」「私信」「已有的预约方式」',
      required: true,
      multiline: true,
      maxLength: 120,
      presets: [
        '评论区回复关键词，例如「咨询」',
        '私信发送具体需求，方便一对一回复',
        '通过主页已有预约 / 表单入口了解',
      ],
    },
    {
      key: 'case',
      label: '可展示的交付物或案例',
      placeholder: '真实的交付物、流程截图或案例，没有可留空',
      multiline: true,
      maxLength: 300,
      presets: [
        '客户交付前后对比截图（已获授权）',
        '完整服务流程示意（已脱敏）',
        '真实案例结果与关键可复用步骤',
      ],
    },
  ],
}
