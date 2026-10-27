import { useEffect, useRef, useState } from 'react'
import { extensionClient } from '../../../services/extension/extension-client'
import { isBilibiliCdnMediaUrl, workbenchMediaReferrerPolicy } from './media-referrer'

type Props = {
  src: string
  className?: string
  poster?: string
  onExhausted?: () => void
}

export function WorkbenchMediaVideo({ src, className, poster, onExhausted }: Props) {
  const [playSrc, setPlaySrc] = useState(src)
  const [triedProxy, setTriedProxy] = useState(false)
  const blobUrlRef = useRef<string | undefined>()

  useEffect(() => {
    setPlaySrc(src)
    setTriedProxy(false)
  }, [src])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = undefined
      }
    }
  }, [])

  const referrerPolicy = workbenchMediaReferrerPolicy(playSrc)

  return (
    <video
      key={playSrc}
      className={className}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      src={playSrc}
      {...(referrerPolicy ? { referrerPolicy } : {})}
      onError={() => {
        if (!triedProxy) {
          setTriedProxy(true)
          void extensionClient.fetchAsset(src).then(
            ({ blob }) => {
              if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
              const next = URL.createObjectURL(blob)
              blobUrlRef.current = next
              setPlaySrc(next)
            },
            () => onExhausted?.(),
          )
          return
        }
        if (isBilibiliCdnMediaUrl(src) && !playSrc.startsWith('blob:')) {
          onExhausted?.()
        }
      }}
    />
  )
}
