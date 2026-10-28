import type { ScriptPurpose } from './types.ts'

/**
 * 人设型：让观众觉得「我理解这个人，也愿意相信他」。
 * 方法来自 persona-short-video-script/SKILL.md。
 */
export const PERSONA_PURPOSE: ScriptPurpose = {
  id: 'persona',
  label: '人设型',
  shortLabel: '人设',
  summary: '观众理解并愿意相信这个人',
  method: [
    '【人设型方法】围绕一件真实事件和一个希望呈现的特点写，不写履历，不靠自我夸奖。',
    '1. 先定特点：只选一个表达重点，不把「认真、负责、专业」堆成自我评价。',
    '2. 事件承载：交代背景、难点、当时的选择与动作、实际结果和事后判断。',
    '3. 保留限度：说明当时为何这么判断、实际发生了什么，不把一次经历夸大成普遍规律。',
    '4. 细节来自本人：只用用户确认的动作、物件、步骤、原话；细节不足就省略，不补写「像真的」场景。',
    '5. 自然收束：结尾落在立场、原则、体会或对观众有用的提醒上，不强行销售，不同时要求关注、评论、私信多个行动。',
    '6. 公开边界：严格遵守用户写明的可公开范围，客户与同事信息按用户要求匿名化。',
  ].join('\n'),
  reviewFocus: [
    '【人设型评审重点】',
    '1. 是否围绕一件真实事件，而不是履历或口号；',
    '2. 人物特点是否由动作、选择和处理过程体现；',
    '3. 第一人称事实、原话、结果是否有依据，是否越界公开；',
    '4. 结尾是否自然表达立场，没有强行销售或堆叠行动。',
  ].join('\n'),
  structures: [
    {
      id: 'persona-turning-point',
      name: '经历转折型',
      summary: '创业、转行、认知变化或方法形成',
      segments: [
        { name: '过去的想法', purpose: '交代过去的想法或做法，且由本人确认', share: 0.18 },
        { name: '真实事件', purpose: '说明真实发生的事件或问题', share: 0.22 },
        { name: '关键转折', purpose: '呈现改变判断的那一次具体经历', share: 0.22 },
        { name: '现在的做法', purpose: '说明现在实际怎么做，可执行可验证', share: 0.2 },
        { name: '对观众的意义', purpose: '提炼对观众有启发的一点，不升华成普遍规律', share: 0.18 },
      ],
    },
    {
      id: 'persona-choice-principle',
      name: '选择与原则型',
      summary: '价值观、合作标准与业务取舍',
      segments: [
        { name: '面临的选择', purpose: '提出当时真实面临的一个选择', share: 0.18 },
        { name: '诱惑与代价', purpose: '说明真实存在的诱惑、压力或代价，不虚构高尚动机', share: 0.2 },
        { name: '判断依据', purpose: '讲清作出判断的依据与当时的权衡', share: 0.24 },
        { name: '体现的原则', purpose: '表明这次选择体现的原则', share: 0.2 },
        { name: '对做事的影响', purpose: '说明原则如何影响实际合作或做事方式', share: 0.18 },
      ],
    },
    {
      id: 'persona-behind-scenes',
      name: '工作幕后型',
      summary: '项目交付、备课、方案修改、测试与客服',
      segments: [
        { name: '工作现场', purpose: '展示真实工作现场或正在做的任务', share: 0.2 },
        { name: '具体难点', purpose: '指出一个具体、可描述的难点', share: 0.2 },
        { name: '处理过程', purpose: '展示本人实际采取的处理过程', share: 0.26 },
        { name: '判断标准', purpose: '说明检查细节与判断标准', share: 0.18 },
        { name: '真实体会', purpose: '表达真实工作体会，不总结成鸡汤', share: 0.16 },
      ],
    },
    {
      id: 'persona-pitfall-review',
      name: '踩坑复盘型',
      summary: '真实失败、项目复盘与经验总结',
      segments: [
        { name: '真实错误', purpose: '承认一件真实发生的错误，不编造损失', share: 0.18 },
        { name: '当时判断', purpose: '交代当时的判断与依据', share: 0.2 },
        { name: '实际后果', purpose: '说明有事实依据的实际后果', share: 0.22 },
        { name: '失准分析', purpose: '分析当时判断为何失准', share: 0.22 },
        { name: '改进规则', purpose: '给出后来真正采用的改进规则', share: 0.18 },
      ],
    },
  ],
  materials: [
    {
      key: 'trait',
      label: '想呈现的一个特点',
      placeholder: '希望观众记住的一个特点，例如「做方案会先做减法」',
      required: true,
      maxLength: 60,
    },
    {
      key: 'event',
      label: '一件真实事件',
      placeholder: '背景、当时的选择或动作、实际结果或体会',
      required: true,
      multiline: true,
      maxLength: 600,
    },
    { key: 'quote', label: '本人原话', placeholder: '想直接引用的原话；记不清就留空，改成转述', multiline: true, maxLength: 200 },
    { key: 'publicScope', label: '可公开范围', placeholder: '哪些内容可以公开、哪些不能，例如客户名称需匿名', maxLength: 200 },
  ],
}
