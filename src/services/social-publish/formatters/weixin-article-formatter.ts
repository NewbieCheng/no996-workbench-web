import type { SourceArticle } from '../types'

/**
 * 微信文章模式的行内样式配置
 */
const STYLES = {
  root: "font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.8; letter-spacing: 0.5px; padding: 10px;",
  p: "margin: 1.5em 0; line-height: 1.8; font-size: 16px; color: #333; text-align: justify;",
  topic: "color: #576B95 !important; text-decoration: none;",
  imgSection: "text-align: center; margin: 1em 0;",
  img: "max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;"
}

/**
 * 将抓取的文章内容格式化为微信公众号“文学风” HTML
 */
export function buildWeixinArticleHtml(article: SourceArticle): string {
  const { html, markdown } = article
  const isNote = article.materialType === "image_text" || (article.url || "").includes("xiaohongshu.com")

  // 如果是普通文章模式，我们需要保留原始 HTML 的丰富样式（如颜色、加粗、图文交织）
  if (!isNote && html) {
    return wrapInWeixinContainer(applyTopicMarkupToHtml(html))
  }

  // 否则（如小红书笔记），执行“重建结构”逻辑，确保排版整齐
  let sourceText = markdown || stripTags(html)
  
  // 移除 Markdown 中的图片标记，因为我们会统一提取并放在文末（符合笔记类排版）
  sourceText = sourceText.replace(/!\[.*?\]\(.*?\)/g, "")
  
  // 1. 处理话题标签
  const processedText = applyTopicMarkupToText(sourceText)

  // 2. 按换行符切分为段落，并包裹 <p> 标签
  const paragraphs = processedText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p style="${STYLES.p}"><span leaf="">${line}</span></p>`)
    .join("")

  // 3. 处理图片
  const images = extractImagesFromHtml(html)
  const imageHtml = images.map(img => {
    return `<section style="${STYLES.imgSection}" nodeleaf="">
      <img src="${img.src}" class="rich_pages wxw-img" data-ratio="${img.ratio || '1'}" data-w="${img.w || '1080'}" style="${STYLES.img}" />
    </section>`
  }).join("")

  return wrapInWeixinContainer(paragraphs + imageHtml)
}

/**
 * 在 HTML 中安全地替换话题标签（避开标签属性）
 */
function applyTopicMarkupToHtml(html: string): string {
  // 匹配 HTML 标签或已有 A 标签，将其作为整体切分，防止误伤属性
  const segments = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi)
  return segments
    .map((part) => {
      if (part.startsWith("<")) return part // 如果是标签或 A 链接，直接返回
      return applyTopicMarkupToText(part)
    })
    .join("")
}

/**
 * 在纯文本中替换话题标签并加空格
 */
function applyTopicMarkupToText(text: string): string {
  return text.replace(/#([^#@\s<，。！？：；、,.!?;:()（）【】《》"“”'‘’]{1,50})/g, (_m, tag) => {
    // 使用 &nbsp; 确保在 HTML 渲染时强制产生可见空格，防止微信后台标签粘连
    return `<a class="wx_topic_link" style="${STYLES.topic}" data-topic="1">#${tag}</a>&nbsp;`
  })
}

/**
 * 包裹微信标准根容器
 */
function wrapInWeixinContainer(content: string): string {
  return `
<section style="${STYLES.root}">
  ${content}
  <p style="display: none;"><mp-style-type data-value="10000"></mp-style-type></p>
</section>`.trim()
}

function stripTags(input: string) {
  return input.replace(/<[^>]+>/g, "")
}

function extractImagesFromHtml(html: string) {
  const images: Array<{ src: string; ratio?: string; w?: string }> = []
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1]
    const ratioMatch = /data-ratio=["']([^"']+)["']/i.exec(match[0])
    const wMatch = /data-w=["']([^"']+)["']/i.exec(match[0])
    images.push({
      src,
      ratio: ratioMatch?.[1],
      w: wMatch?.[1]
    })
  }
  return images
}
