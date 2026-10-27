/**
 * IP 口播视频专属 EditorProfile 契约与白名单
 * 遵循 S8-02：
 * 默认面板白名单：文稿/配音、精简素材、舞台、字幕、画面/标题、compact 时间轴、精简导出。
 * 完整关键帧/混音/全特效面板默认不挂载，不只是 display:none。
 */

import type { PanelProfile } from '../../../packages/video-editor/src/core/capabilities.ts'

export const IP_VIDEO_CUSTOM_PROFILE: PanelProfile = {
  allowedPanels: [
    'media',
    'canvas',
    'playback',
    'timeline',
    'inspector',
    'captions',
    'template',
    'export',
  ],
  variant: {
    timeline: 'compact',
    media: 'ip-compact',
    captions: 'script-bound',
  },
  visibleSections: {
    inspector: ['layout', 'subtitles', 'background'],
  },
}
