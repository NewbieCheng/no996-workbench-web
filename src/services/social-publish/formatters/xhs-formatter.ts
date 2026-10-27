import type { UploadedImage } from '../types'

/**
 * 将 HTML/Markdown 格式化为小红书笔记（图文模式）的描述文本
 * 支持 \n\t\n 换行和话题标签转换
 */
export function formatXhsNoteDesc(html: string, markdown: string): { desc: string; hashTags: any[] } {
  let text = ""
  if (markdown && markdown.trim()) {
    text = markdown
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_>#-]/g, "")
  } else {
    text = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<img[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
  }

  text = decodeHtmlEntities(text)

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n\n")

  const hashTags: any[] = []

  const topicRegex = /#([^#\s@<，。！？：；、,.!?;:()（）【】《》"""'‘’\[\]]{1,50})(?:\[话题\]#)?/g

  const processedDesc = text.replace(topicRegex, (match, tagName) => {
    const name = tagName.trim()
    if (!name) return match

    if (!hashTags.find(t => t.name === name)) {
      hashTags.push({
        id: "",
        name: name,
        link: "",
        type: "topic"
      })
    }

    if (match.includes("[话题]#")) {
      return match
    }

    const xhsTagName = `${name}[话题]`

    return `#${xhsTagName}#`
  })

  const finalDesc = processedDesc
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n\t\n")
    .trim()

  return {
    desc: finalDesc,
    hashTags
  }
}

export function resolveXhsContentLength(input: { html: string; markdown: string; summary: string }): number {
  const { desc } = formatXhsNoteDesc(input.html, input.markdown)
  return desc.length + (input.summary?.length || 0)
}

export function decodeHtmlEntities(input: string) {
  if (!input) return ""
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
}

export function toAbsoluteUrl(value: string, baseUrl?: string): string {
  let src = value.trim()
  if (!src) return ""
  if (src.startsWith("data:")) return src

  // 处理 HTML 实体编码
  src = decodeHtmlEntities(src)

  if (src.startsWith("//")) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:"
    return `${protocol}${src}`
  }

  try {
    const base = baseUrl || (typeof window !== "undefined" ? window.location.href : undefined)
    return new URL(src, base).toString()
  } catch {
    return src
  }
}

export interface XhsDraftInput {
  uid?: string
  title: string
  html: string
  markdown: string
  summary: string
  uploadedImages: UploadedImage[]
  hashTags?: any[]
  materialType: "image_text" | "article"
}

export interface XhsDraftResult {
  draftData: any
  draftId: string
  nowTimestamp: number
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function buildXhsImageTextDraft(input: XhsDraftInput): XhsDraftResult {
  const { title, html, markdown, uploadedImages, hashTags = [], uid = "" } = input
  const { desc } = formatXhsNoteDesc(html, markdown)
  const draftId = generateUUID()
  const nowTimestamp = Date.now()

  const imgList = []
  if (uploadedImages && uploadedImages.length > 0) {
    uploadedImages.forEach((uploaded, index) => {
      imgList.push({
        file: {},
        status: 5,
        url: uploaded.localUrl || uploaded.url,
        key: `image_${nowTimestamp}_${index}`,
        progress: 1,
        fileId: uploaded.fileId,
        fileMetadata: {
          width: uploaded.width || 1080,
          height: uploaded.height || 1080,
          ratio: (uploaded.width || 1080) / (uploaded.height || 1080)
        },
        previewUrl: uploaded.url
      })
    })
  }

  const firstImage = uploadedImages?.[0]
  const coverInfo = firstImage ? {
    width: firstImage.width,
    height: firstImage.height,
    fileid: firstImage.fileId || "",
    frame: { ts: 0, isUserSelect: true, userSelect: true, isUpload: true },
    stickers: { version: 2, neptune: [] as unknown[] },
    fonts: [] as unknown[],
    coverTemplateId: "",
    extra_info_json: ""
  } : {
    width: 0,
    height: 0,
    fileid: "",
    frame: { ts: 0, isUserSelect: false, userSelect: false, isUpload: false },
    stickers: { version: 2, neptune: [] as unknown[] },
    fonts: [] as unknown[],
    coverTemplateId: "",
    extra_info_json: ""
  }

  const draftData = {
    content: {
      contextStore: {
        liveContext: { time: 0, title: "" },
        previewAuditContext: {
          status: 0,
          detail: {
            hasLimit: true,
            remainingCalls: 0,
            taskId: "",
            taskType: "1",
            status: 0,
            taskResultInfo: { detectionStatus: 1, optimizationPoints: [] as unknown[] }
          },
          isChange: false
        },
        coverContext: {
          coverUrl: firstImage?.localUrl || firstImage?.url || "",
          cover: coverInfo,
          templateBlob: null,
          rate: 0,
          recommendCoverIdx: -1
        },
        goodsContext: { goodsInfo: {}, goodsPreviewDetail: [] as unknown[] },
        bizRelationContext: { bizRelation: [] as unknown[] },
        recommendCovers: [] as unknown[]
      },
      draftStore: {
        videoRotation: "0",
        video: {
          width: 0, height: 0, fileid: "", fsize: 0, duration: 0, videoId: "",
          videoMarks: [] as unknown[], timelines: [] as unknown[],
          frame: { ts: 0, userSelect: false }, transcodeVideoFileId: "", coverInfo: {}
        },
        videoInfo: null, audioInfo: null, videoMeta: "", audioMeta: "",
        cover: {
          width: coverInfo.width, height: coverInfo.height, fileid: coverInfo.fileid,
          frame: coverInfo.frame, stickers: coverInfo.stickers, fonts: coverInfo.fonts
        },
        chapters: [] as unknown[], markers: [] as unknown[], needTranscode: false,
        imgList,
        colorGroup: null,
        title,
        desc,
        ats: [] as unknown[],
        hashTag: hashTags
      },
      settingStore: {
        privacyInfo: { opType: 1, type: 0, userIds: [] as unknown[] },
        collectionId: "", orderId: "", brandAccountId: "",
        noteSketch: { id: "", name: "" },
        original: false, originalDateStamp: "",
        coProduceBind: { enable: true }, noteCopyBind: { copyable: true },
        coOrderId: "",
        interactionPermissionBind: { commentPermission: 0 },
        fileRelate: { fileId: "", docId: "", docName: "", docShowName: "", docType: "", docSize: 0 }
      },
      articleStore: {
        articleContent: "", summeryContent: "", orderPattern: "",
        richJson: {}, articleTitle: "", articleEditorMode: 0,
        authorAndSummaryTemp: { author: "", summary: "", readingStats: "" },
        selectedThemeId: 6, selectedColorIndexMap: {},
        blob2Map: {}, coverSetting: { styleType: 0, showAuthor: true, showReadingStats: true, showSummery: true },
        editPageSource: "import", schemaCopy: {}, url2FileIdMap: {}
      },
      shortDraftStore: {
        isShort: true, editStatus: 0,
        textCardList: [{ createTime: nowTimestamp, text: "", originText: "", length: 0, image: "", imageFileId: "", isManualInsert: false }],
        coverList: [] as unknown[], currentCoverIdx: 0, cacheData: {}
      },
      publishStore: { publishType: 1, imageNoteOrigin: 0, systemId: "web", step: 1, uploadState: 0, status: 8, codec: "unknown" }
    },
    draftId,
    uid,
    timeStamp: nowTimestamp
  }

  return { draftData, draftId, nowTimestamp }
}

export function buildXhsArticleDraft(input: XhsDraftInput, richJson: any): XhsDraftResult {
  const { title, markdown, summary, uploadedImages, hashTags = [], uid = "" } = input
  const draftId = generateUUID()
  const nowTimestamp = Date.now()

  const firstImage = uploadedImages?.[0]
  const coverInfo = firstImage ? {
    width: firstImage.width,
    height: firstImage.height,
    fileid: firstImage.fileId || "",
    frame: { ts: 0, isUserSelect: true, userSelect: true, isUpload: true },
    stickers: { version: 2, neptune: [] as unknown[] },
    fonts: [] as unknown[],
    coverTemplateId: "",
    extra_info_json: ""
  } : {
    width: 0,
    height: 0,
    fileid: "",
    frame: { ts: 0, isUserSelect: false, userSelect: false, isUpload: false },
    stickers: { version: 2, neptune: [] as unknown[] },
    fonts: [] as unknown[],
    coverTemplateId: "",
    extra_info_json: ""
  }

  const draftData = {
    content: {
      contextStore: {
        liveContext: { time: 0, title: "" },
        previewAuditContext: {
          status: 0,
          detail: {
            hasLimit: true,
            remainingCalls: 0,
            taskId: "",
            taskType: "1",
            status: 0,
            taskResultInfo: { detectionStatus: 1, optimizationPoints: [] as unknown[] }
          },
          isChange: false
        },
        coverContext: {
          coverUrl: firstImage?.localUrl || firstImage?.url || "",
          cover: coverInfo,
          templateBlob: null,
          rate: 0,
          recommendCoverIdx: -1
        },
        goodsContext: { goodsInfo: {}, goodsPreviewDetail: [] as unknown[] },
        bizRelationContext: { bizRelation: [] as unknown[] },
        recommendCovers: [] as unknown[]
      },
      draftStore: {
        videoRotation: "0",
        video: {
          width: 0, height: 0, fileid: "", fsize: 0, duration: 0, videoId: "",
          videoMarks: [] as unknown[], timelines: [] as unknown[],
          frame: { ts: 0, userSelect: false }, transcodeVideoFileId: "", coverInfo: {}
        },
        videoInfo: null, audioInfo: null, videoMeta: "", audioMeta: "",
        cover: {
          width: coverInfo.width, height: coverInfo.height, fileid: coverInfo.fileid,
          frame: coverInfo.frame, stickers: coverInfo.stickers, fonts: coverInfo.fonts
        },
        chapters: [] as unknown[], markers: [] as unknown[], needTranscode: false,
        imgList: [],
        colorGroup: null,
        title,
        desc: "",
        ats: [] as unknown[],
        hashTag: hashTags
      },
      settingStore: {
        privacyInfo: { opType: 1, type: 0, userIds: [] as unknown[] },
        collectionId: "", orderId: "", brandAccountId: "",
        noteSketch: { id: "", name: "" },
        original: false, originalDateStamp: "",
        coProduceBind: { enable: true }, noteCopyBind: { copyable: true },
        coOrderId: "",
        interactionPermissionBind: { commentPermission: 0 },
        fileRelate: { fileId: "", docId: "", docName: "", docShowName: "", docType: "", docSize: 0 }
      },
      articleStore: {
        articleContent: markdown || "",
        summeryContent: summary || "",
        orderPattern: "",
        richJson,
        articleTitle: title,
        articleEditorMode: 0,
        authorAndSummaryTemp: { author: "", summary: summary || "", readingStats: "" },
        selectedThemeId: 6, selectedColorIndexMap: {},
        blob2Map: {}, coverSetting: { styleType: 0, showAuthor: true, showReadingStats: true, showSummery: true },
        editPageSource: "import", schemaCopy: {}, url2FileIdMap: {}
      },
      shortDraftStore: {
        isShort: true, editStatus: 0,
        textCardList: [{ createTime: nowTimestamp, text: "", originText: "", length: 0, image: "", imageFileId: "", isManualInsert: false }],
        coverList: [] as unknown[], currentCoverIdx: 0, cacheData: {}
      },
      publishStore: { publishType: 1, imageNoteOrigin: 0, systemId: "web", step: 0, uploadState: 2, status: 8, codec: "unknown" }
    },
    draftId,
    uid,
    timeStamp: nowTimestamp
  }

  return { draftData, draftId, nowTimestamp }
}

