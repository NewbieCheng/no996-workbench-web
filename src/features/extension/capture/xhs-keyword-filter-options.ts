/** 小红书关键词采集筛选项（扩展页与爆款复刻向导共用，不含采集策略） */

export const XHS_CAPTURE_MIN_COMMENTS_OPTIONS = [
  { value: 'any', label: '不限评论' },
  { value: '10', label: '至少 10 条评论' },
  { value: '50', label: '至少 50 条评论' },
  { value: '100', label: '至少 100 条评论' },
  { value: '500', label: '至少 500 条评论' },
] as const

export const XHS_CAPTURE_NOTE_TYPE_OPTIONS = [
  { value: 'all', label: '不限笔记形式' },
  { value: 'video', label: '仅视频笔记' },
  { value: 'image-text', label: '仅图文笔记' },
] as const

export const XHS_CAPTURE_SEARCH_RANGE_OPTIONS = [
  { value: 'all', label: '不限搜索范围' },
  { value: 'recently-viewed', label: '已看过' },
  { value: 'not-viewed', label: '未看过' },
  { value: 'following', label: '已关注' },
] as const
