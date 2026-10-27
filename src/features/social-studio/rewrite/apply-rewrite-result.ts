import { toast } from 'sonner'
import { hardCheckSummary, runHardCheck } from '../../../agent'
import type { SocialStudioRewriteSession } from './social-studio-rewrite-types'

export function resolveRewriteApplyPayload(
  session: SocialStudioRewriteSession,
  selectedTitleIndex: number,
  fallbackTitle: string,
): { title: string; body: string } {
  const titles = session.pass2Payload?.titles
  const title = titles?.[selectedTitleIndex] || fallbackTitle
  const body = session.pass2Payload?.body || session.pass1Body
  return { title, body }
}

export function notifyRewriteHardCheckIfNeeded(body: string, hardCheckEnabled: boolean): void {
  if (!hardCheckEnabled || !body.trim()) return
  const check = runHardCheck({ text: body, mode: 'video' })
  if (!check.pass) toast.message(hardCheckSummary(check))
}
