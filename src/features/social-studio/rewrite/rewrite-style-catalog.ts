import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'
import type { RewriteStyleId } from './social-studio-rewrite-types'

export type RewriteStyleCatalogItem = {
  id: RewriteStyleId
  i18nKey: string
  promptHint: string
}

const WECHAT_STYLES: RewriteStyleCatalogItem[] = [
  {
    id: 'pain_leads',
    i18nKey: 'rewriteStylePainLeads',
    promptHint: '精准推送相关客群，让用户进入场景，引导咨询或领取资料，获取线索。',
  },
  {
    id: 'contrarian_traffic',
    i18nKey: 'rewriteStyleContrarian',
    promptHint: '用反常识观点吸引点击，适合涨粉、引发讨论与转发，偏早期养号。',
  },
  {
    id: 'pitfall_persona',
    i18nKey: 'rewriteStylePitfall',
    promptHint: '先替读者吐槽痛点，再帮避雷，最后立住专业人设。',
  },
  {
    id: 'trust_persona',
    i18nKey: 'rewriteStyleTrust',
    promptHint: '创始人故事、高客单转化，建立个人 IP 信任感。',
  },
  {
    id: 'tutorial_growth',
    i18nKey: 'rewriteStyleTutorial',
    promptHint: '干货教程方法论，让读者觉得有用、愿意收藏关注。',
  },
  {
    id: 'custom',
    i18nKey: 'rewriteStyleCustom',
    promptHint: '参考用户提供的公众号链接文章的写法与结构，不照搬事实与数据。',
  },
]

const XHS_STYLES: RewriteStyleCatalogItem[] = [
  {
    id: 'pain_leads',
    i18nKey: 'rewriteStyleXhsPainLeads',
    promptHint: '小红书长文：场景化痛点 + 可执行建议，引导收藏与私信咨询。',
  },
  {
    id: 'contrarian_traffic',
    i18nKey: 'rewriteStyleXhsContrarian',
    promptHint: '反常识钩子开场，适合破圈传播，语气真诚不浮夸。',
  },
  {
    id: 'pitfall_persona',
    i18nKey: 'rewriteStyleXhsPitfall',
    promptHint: '避雷清单 + 亲身踩坑口吻，建立可信博主人设。',
  },
  {
    id: 'trust_persona',
    i18nKey: 'rewriteStyleXhsTrust',
    promptHint: '经历型叙事 + 方法论沉淀，适合专栏长文涨粉。',
  },
  {
    id: 'tutorial_growth',
    i18nKey: 'rewriteStyleXhsTutorial',
    promptHint: '步骤化干货 + 小标题分段，强调收藏价值。',
  },
  {
    id: 'custom',
    i18nKey: 'rewriteStyleXhsCustom',
    promptHint: '参考用户提供的笔记链接文风，保留小红书口语与分段习惯。',
  },
]

export function listRewriteStyles(platform: SocialStudioPlatform): RewriteStyleCatalogItem[] {
  return platform === 'xhs' ? XHS_STYLES : WECHAT_STYLES
}

export function findRewriteStyle(
  platform: SocialStudioPlatform,
  id: RewriteStyleId,
): RewriteStyleCatalogItem | undefined {
  return listRewriteStyles(platform).find((item) => item.id === id)
}
