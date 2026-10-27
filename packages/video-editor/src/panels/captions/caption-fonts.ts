/**
 * 字幕字体目录（纯数据）。CSS / FontFace 加载由宿主（IP 口播 / 工厂）调用 loadCaptionFont。
 */

export type CaptionFont = {
  id: string
  label: string
  /** Canvas / CSS 实际 family 名（勿带引号回退栈） */
  family: string
  weight: number
  description: string
}

export const CAPTION_FONTS: CaptionFont[] = [
  { id: 'alibaba-puhuiti', label: '阿里巴巴普惠体', family: 'Alibaba PuHuiTi', weight: 700, description: '清晰厚实的现代黑体，适合日常口播' },
  { id: 'noto-sans-sc', label: '思源黑体', family: 'Noto Sans SC', weight: 400, description: '端正清晰的现代黑体，适合信息讲解与长句字幕' },
  { id: 'noto-serif-sc', label: '思源宋体', family: 'Noto Serif SC', weight: 400, description: '笔画对比鲜明的宋体，适合知识与人文表达' },
  { id: 'zcool-qingke-huangyou', label: '站酷庆科黄油体', family: 'ZCOOL QingKe HuangYou', weight: 400, description: '圆角窄长的设计字，适合醒目短句' },
  { id: 'zcool-kuaile', label: '站酷快乐体', family: 'ZCOOL KuaiLe', weight: 400, description: '活泼不规则的手绘字，适合轻松趣味内容' },
  { id: 'ma-shan-zheng', label: '马善政楷书', family: 'Ma Shan Zheng', weight: 400, description: '有毛笔起收笔的楷书，适合国风与故事' },
  { id: 'zcool-xiaowei', label: '站酷小薇体', family: 'ZCOOL XiaoWei', weight: 400, description: '带衬线与书写感的秀丽字形，适合温柔叙述' },
  { id: 'liu-jian-mao-cao', label: '刘建毛草', family: 'Liu Jian Mao Cao', weight: 400, description: '舒展奔放的手写草书，适合情绪短句与书法表达' },
  { id: 'zhi-mang-xing', label: '志莽行书', family: 'Zhi Mang Xing', weight: 400, description: '自然连贯的毛笔行书，适合国风与随笔叙述' },
  { id: 'long-cang', label: '龙藏体', family: 'Long Cang', weight: 400, description: '细劲洒脱的手写字，适合生活记录与个性短句' },
]

export function captionFontByFamily(family: string): CaptionFont | undefined {
  const normalized = family.trim().replace(/^(['"])(.*)\1$/, '$2')
  return CAPTION_FONTS.find((font) => font.family === normalized)
}

export function captionFontById(id: string): CaptionFont | undefined {
  return CAPTION_FONTS.find((font) => font.id === id)
}
