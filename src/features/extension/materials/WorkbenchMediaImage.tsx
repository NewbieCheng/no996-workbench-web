import { useEffect, useRef, useState } from 'react'
import { extensionClient } from '../../../services/extension/extension-client'
import { workbenchMediaReferrerPolicy } from './media-referrer'

type WorkbenchMediaImageProps = {
  url?: string
  fallbackDataUrl?: string
  alt?: string
  className?: string
  /** 直链与 asset.fetch、fallback 均失败时展示 */
  expiredMessage?: string
}

export function WorkbenchMediaImage({
  url,
  fallbackDataUrl,
  alt = '',
  className,
  expiredMessage,
}: WorkbenchMediaImageProps) {
  const [src, setSrc] = useState(url ?? '')
  const [loadFailed, setLoadFailed] = useState(false)
  const proxiedRef = useRef(false)
  const triedFallbackRef = useRef(false)
  const blobUrlRef = useRef<string | undefined>()

  useEffect(() => {
    proxiedRef.current = false
    triedFallbackRef.current = false
    setLoadFailed(false)
    setSrc(url ?? '')
  }, [url])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = undefined
      }
    }
  }, [])

  if (!url?.trim() && !fallbackDataUrl?.trim()) return null

  const handleError = () => {
    if (!triedFallbackRef.current && fallbackDataUrl?.startsWith('data:image/')) {
      triedFallbackRef.current = true
      setSrc(fallbackDataUrl)
      return
    }
    if (!url?.trim() || proxiedRef.current) return
    proxiedRef.current = true
    void extensionClient.fetchAsset(url).then(
      ({ blob }) => {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const next = URL.createObjectURL(blob)
        blobUrlRef.current = next
        setSrc(next)
      },
      () => {
        proxiedRef.current = false
        if (fallbackDataUrl?.startsWith('data:image/')) {
          setSrc(fallbackDataUrl)
          return
        }
        setLoadFailed(true)
      },
    )
  }

  if (loadFailed && expiredMessage) {
    return (
      <span className={`text-xs text-muted-foreground text-center px-2 ${className ?? ''}`}>
        {expiredMessage}
      </span>
    )
  }

  const displayUrl = src || url || fallbackDataUrl || ''
  const referrerPolicy = workbenchMediaReferrerPolicy(displayUrl.startsWith('data:') ? url : displayUrl)

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={className}
      {...(referrerPolicy ? { referrerPolicy } : {})}
      loading="lazy"
      onError={() => {
        if (src.startsWith('data:image/') && expiredMessage) {
          setLoadFailed(true)
          return
        }
        handleError()
      }}
    />
  )
}
