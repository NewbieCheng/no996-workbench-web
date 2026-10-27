import { useCallback, useState } from 'react'
import type { PreviewDevice, WechatLayoutView } from '../studio-types'
import type { SocialStudioPlatform } from '../studio-types'
import {
  readPhoneFrameSize,
  writePhoneFrameSize,
  type PhoneFrameSize,
} from './preview-phone-size'

export function useSocialStudioPreviewPrefs(_platform: SocialStudioPlatform) {
  const [layoutView, setLayoutView] = useState<WechatLayoutView>('wechat')
  const [device, setDevice] = useState<PreviewDevice>('pc')
  const [phoneSize, setPhoneSizeState] = useState<PhoneFrameSize>(() => readPhoneFrameSize())

  const setPhoneSize = useCallback((next: PhoneFrameSize) => {
    setPhoneSizeState(next)
    writePhoneFrameSize(next)
  }, [])

  return {
    layoutView,
    setLayoutView,
    device,
    setDevice,
    phoneSize,
    setPhoneSize,
  }
}
