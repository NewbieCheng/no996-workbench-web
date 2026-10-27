import type { VoiceCloneRecord } from '../../api/voice-clone'
import i18n from '../../i18n'

function t(key: string): string {
  return i18n.t(`voice:${key}`)
}

export function cloneStatusShort(v: VoiceCloneRecord): string {
  if (v.ready_for_synthesis) return t('cloneStatus.ready')
  if (v.provider_status === 'DEPLOYING') return t('cloneStatus.deploying')
  if (v.provider_status === 'UNDEPLOYED') return t('cloneStatus.failed')
  return t('cloneStatus.processing')
}

export function cloneStatusDetail(v: VoiceCloneRecord): string {
  if (v.ready_for_synthesis) return t('cloneStatus.readyDetail')
  if (v.provider_status === 'DEPLOYING') return t('cloneStatus.deployingDetail')
  if (v.provider_status === 'UNDEPLOYED') return t('cloneStatus.failedDetail')
  return t('cloneStatus.processingDetail')
}
