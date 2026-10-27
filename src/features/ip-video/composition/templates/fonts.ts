import type { EditorDocument } from '@no996/video-editor'
import { ensureCaptionFonts } from '@no996/video-editor/render/captions.ts'
import { captionFontByFamily, loadCaptionFont } from '../../editor/caption-fonts'
import { TalkTemplateError } from './model'

/** Register the actual global and inherited/per-cue fonts, then wait for the actual caption text. */
export async function prepareTemplateFonts(doc: EditorDocument): Promise<void> {
  const families = new Set([doc.captionStyle.font, ...doc.captions.map(cue => cue.styleOverride?.font).filter((font): font is string => !!font)])
  await Promise.all([...families].map(family => {
    const font = captionFontByFamily(family)
    if (!font) throw new TalkTemplateError('unsupportedFont')
    return loadCaptionFont(font.id)
  }))
  await ensureCaptionFonts(doc, { timeoutMs: 20_000 })
}
