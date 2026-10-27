import type { PersonaQuestionnaire } from '../../../services/persona/types'

export const QUESTIONNAIRE_PRESETS: Partial<
  Record<keyof PersonaQuestionnaire, readonly string[]>
> = {
  occupation: [
    '短视频运营顾问',
    '知识付费讲师',
    '本地生活探店博主',
    '企业品牌顾问',
    '健身教练',
  ],
  platforms: ['抖音', '小红书', '视频号', 'B站', '公众号', '快手'],
  contentThemes: ['起号避坑', '案例拆解', '方法论', '日常 vlog', '直播预告'],
  products: ['1v1 咨询', '陪跑订阅', '线下课', '线上训练营', '代运营诊断'],
  audiences: ['小微企业主', '职场新人', '本地商家', '宝妈群体', '自由职业者'],
}
