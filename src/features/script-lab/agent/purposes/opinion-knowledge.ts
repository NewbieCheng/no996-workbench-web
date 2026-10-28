import type { ScriptPurpose } from './types.ts'

/**
 * 观点·干货型：让观众觉得「这个人有判断，教的方法能用」。
 * 方法来自 opinion-knowledge-short-video-script/SKILL.md。
 */
export const OPINION_PURPOSE: ScriptPurpose = {
  id: 'opinion',
  label: '观点·干货型',
  shortLabel: '干货',
  summary: '观众认可判断，并且知道方法怎么用',
  method: [
    '【观点·干货型方法】一条视频只讲一个判断或一个可实践的方法。',
    '1. 说清判断：用一句话给出观点、结论或诊断方向，不用「分享几个技巧」开场。',
    '2. 解释为什么：说明成立的原因、条件和适用范围；认可常见做法中合理的部分，不为反差把它说成完全错误。',
    '3. 方法可操作：给出有先后关系的动作、检查项或判断标准，不用「做好定位」这类抽象词。',
    '4. 例子有依据：真实案例与明确标为假设的示例要区分，不把虚构示例包装成客户案例或实测数据。',
    '5. 说明边界：提醒适用前提、容易出错的环节或不适用情况。',
    '6. 留一个可带走的东西：结尾回扣判断或给一个低门槛练习，不硬转咨询或销售。',
  ].join('\n'),
  reviewFocus: [
    '【观点·干货型评审重点】',
    '1. 是否只有一个明确判断或一个可操作方法；',
    '2. 解释是否讲清原因与适用条件，而不是罗列名词；',
    '3. 步骤是否可执行、有先后关系，例子是否有来源或明确标为假设；',
    '4. 是否说明边界，结尾是否给观众一个可带走的判断或方法。',
  ].join('\n'),
  structures: [
    {
      id: 'opinion-counterintuitive',
      name: '反常识论证型',
      summary: '纠正误区、表达专业判断或认知升级',
      segments: [
        { name: '反常识判断', purpose: '提出与常见认知不同的具体判断', share: 0.2 },
        { name: '常见做法的合理处', purpose: '承认常见做法里真实有效的部分', share: 0.18 },
        { name: '适用条件与局限', purpose: '指出它的适用条件与局限', share: 0.2 },
        { name: '有依据的例子', purpose: '用有依据的例子论证，不编造研究或数据', share: 0.24 },
        { name: '更合适的做法', purpose: '给出更合适、可操作的做法', share: 0.18 },
      ],
    },
    {
      id: 'opinion-step-teaching',
      name: '步骤教学型',
      summary: '工具教程、实操教学、SOP 与方法分享',
      segments: [
        { name: '明确任务', purpose: '明确观众要完成的任务与结果', share: 0.16 },
        { name: '输入材料', purpose: '说明开始前需要的输入或材料', share: 0.18 },
        { name: '操作步骤', purpose: '按顺序拆解操作步骤，动词可执行', share: 0.3 },
        { name: '完成结果', purpose: '展示步骤完成后的输出或判断结果', share: 0.2 },
        { name: '边界与常见错误', purpose: '提醒关键边界、常见错误与适用条件', share: 0.16 },
      ],
    },
    {
      id: 'opinion-wrong-right',
      name: '错误与正确对照型',
      summary: '提示词、文案、销售表达或流程改进',
      segments: [
        { name: '常见做法', purpose: '展示一种常见的具体做法', share: 0.18 },
        { name: '具体问题', purpose: '解释它在当前任务中的具体问题', share: 0.22 },
        { name: '改进做法', purpose: '展示改进后的做法，条件可比', share: 0.24 },
        { name: '差异与原因', purpose: '对照两种做法的差异及原因', share: 0.2 },
        { name: '可复用原则', purpose: '总结观众可以复用的原则', share: 0.16 },
      ],
    },
    {
      id: 'opinion-problem-breakdown',
      name: '问题拆解型',
      summary: '经营分析、内容诊断或复杂问题拆解',
      segments: [
        { name: '表象结果', purpose: '描述观众能识别的表象或结果', share: 0.18 },
        { name: '可能原因', purpose: '列出可能原因，不急于定论', share: 0.24 },
        { name: '原因区别', purpose: '说明不同原因之间的区别与识别条件', share: 0.22 },
        { name: '判断顺序', purpose: '给出判断方法或检查顺序', share: 0.2 },
        { name: '第一步行动', purpose: '提供与判断结果对应的第一步行动', share: 0.16 },
      ],
    },
  ],
  materials: [
    {
      key: 'thesis',
      label: '核心判断',
      placeholder: '这一条要讲清的判断或结论，一句话说清',
      required: true,
      multiline: true,
      maxLength: 200,
    },
    {
      key: 'basis',
      label: '依据或步骤',
      placeholder: '判断成立的原因、适用条件，或可执行的操作步骤',
      required: true,
      multiline: true,
      maxLength: 600,
    },
    { key: 'example', label: '真实案例', placeholder: '真实的案例或过程；没有就留空，或用明确标注的假设示例', multiline: true, maxLength: 300 },
    { key: 'boundary', label: '适用边界', placeholder: '方法在什么前提下有效、什么情况下不适用', multiline: true, maxLength: 200 },
  ],
}
