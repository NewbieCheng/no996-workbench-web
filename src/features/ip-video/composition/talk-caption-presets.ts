/** 兼容再导出：预设权威源在 video-editor。相对路径让 Node 单测无需包名别名。 */
export {
  CAPTION_PRESETS as TALK_CAPTION_PRESETS,
  matchingTalkPreset,
  matchingCaptionPreset,
  type CaptionPreset as TalkCaptionPreset,
  type CaptionPreset,
} from '../../../../packages/video-editor/src/panels/captions/caption-presets.ts'
