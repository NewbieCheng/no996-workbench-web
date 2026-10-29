import type { ScriptPurpose } from './types.ts'

/**
 * 转化型：让观众判断「适不适合我」，并知道下一步怎么做。
 * 方法来自 conversion-short-video-script/SKILL.md。
 */
export const CONVERSION_PURPOSE: ScriptPurpose = {
  id: 'conversion',
  label: '转化型',
  shortLabel: '转化',
  summary: '观众判断适不适合自己，并知道下一步',
  method: [
    '【转化型方法】以真实交付、证据、适配条件和唯一行动为核心，不把愿景写成已交付能力。',
    '1. 从问题进入：说明产品/服务回应的具体问题与现实影响，不放大焦虑。',
    '2. 讲清机制与交付：解释它如何回应问题，以及用户实际能拿到什么（内容、频次、期限、边界），只讲资料支持的。',
    '3. 证据真实：可展示演示、案例、授权反馈或可核验材料；没有证据就省略，不编造数据或故事。',
    '4. 说明适配：什么人、什么阶段适合；资料充分时也说明不适合的情况。',
    '5. 回应一个主要顾虑：直接回答用户提供的主要疑虑，再讲适用条件和真实支持方式。',
    '6. 唯一行动：结尾只保留一个用户确认且真实存在的点击、报名、购买或咨询入口。',
    '价格、优惠、名额、销量、评价、资质、紧迫性，资料没给就一个字都不写。',
  ].join('\n'),
  reviewFocus: [
    '【转化型评审重点】',
    '1. 实际交付与服务边界是否讲清楚；解决机制是否回应了前面的问题；',
    '2. 适配与不适配是否说明，证据是否存在且与主张对应；',
    '3. 主要顾虑是否被正面回应，价格/优惠/名额是否被擅自补写；',
    '4. 结尾是否只有一个真实、可执行的行动入口。',
  ].join('\n'),
  structures: [
    {
      id: 'conv-pain-solution',
      name: '痛点解决型（PAS）',
      summary: '咨询服务、陪跑、问题导向的课程或产品',
      segments: [
        { name: '具体问题', purpose: '提出具体问题，不放大焦虑', share: 0.16 },
        { name: '现实影响', purpose: '说明有资料支持的现实影响', share: 0.18 },
        { name: '解决机制', purpose: '解释产品或服务如何回应这个问题', share: 0.24 },
        { name: '实际交付与边界', purpose: '介绍实际交付内容与服务边界', share: 0.22 },
        { name: '适配与唯一行动', purpose: '说明适配条件并引导唯一行动', share: 0.2 },
      ],
    },
    {
      id: 'conv-delivery-demo',
      name: '交付演示型',
      summary: '工具、模板、课程、工作台或服务方案',
      segments: [
        { name: '真实交付物', purpose: '展示用户最终会拿到的真实交付物', share: 0.24 },
        { name: '可用于什么', purpose: '说明交付物能用于什么任务', share: 0.16 },
        { name: '使用演示', purpose: '演示实际实现过程或使用步骤', share: 0.24 },
        { name: '交付清单与边界', purpose: '列清交付内容、适用条件与边界', share: 0.2 },
        { name: '唯一行动', purpose: '引导一个清楚、可执行的行动', share: 0.16 },
      ],
    },
    {
      id: 'conv-objection-qa',
      name: '疑虑答疑型',
      summary: '价格、难度、时间、效果、售后等真实顾虑',
      segments: [
        { name: '主要顾虑', purpose: '提出用户真实存在的主要顾虑', share: 0.16 },
        { name: '直接回答', purpose: '直接回答，不绕开问题', share: 0.24 },
        { name: '条件与限制', purpose: '解释适用条件和限制', share: 0.22 },
        { name: '已有支持', purpose: '说明已存在的支持方式，不承诺未提供的售后', share: 0.2 },
        { name: '判断建议与下一步', purpose: '给出帮助判断的建议和唯一下一步', share: 0.18 },
      ],
    },
    {
      id: 'conv-value-ladder',
      name: '价值递进型（AIDA）',
      summary: '会员社群、课程介绍、服务招募或产品种草',
      segments: [
        { name: '情境吸引', purpose: '用具体情境吸引注意，不用无法保证的结果', share: 0.18 },
        { name: '与需求关联', purpose: '说明情境与目标用户需求的关联', share: 0.18 },
        { name: '交付价值与证据', purpose: '展开具体交付价值、证据和适配条件', share: 0.28 },
        { name: '适合与不适合', purpose: '说明适合与不适合的情况', share: 0.2 },
        { name: '唯一行动', purpose: '给出唯一行动，与正文问题相连', share: 0.16 },
      ],
    },
  ],
  materials: [
    {
      key: 'delivery',
      label: '实际交付',
      placeholder: '用户实际能拿到什么：内容、频次、期限、服务边界',
      required: true,
      multiline: true,
      maxLength: 400,
    },
    {
      key: 'fitFor',
      label: '适合对象',
      placeholder: '什么人、什么阶段、什么需求适合',
      required: true,
      multiline: true,
      maxLength: 200,
    },
    {
      key: 'action',
      label: '唯一行动入口',
      placeholder: '真实存在的下一步，例如「点购物车」「私信报名」「预约咨询」',
      required: true,
      multiline: true,
      maxLength: 120,
    },
    { key: 'notFor', label: '不适合对象', placeholder: '什么情况不建议买/报名', multiline: true, maxLength: 200 },
    { key: 'proof', label: '可展示证据', placeholder: '演示、案例、授权反馈或可核验材料；没有就留空', multiline: true, maxLength: 300 },
    { key: 'objection', label: '主要顾虑', placeholder: '用户最常问的一个顾虑', multiline: true, maxLength: 200 },
    { key: 'price', label: '价格与购买条件', placeholder: '只填真实信息；没提供就不写', maxLength: 120 },
  ],
}
