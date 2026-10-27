import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { getIngestProfile, type IngestProfileId } from './ingest-profiles'
import { extractDocumentText } from './parse-document'

type Options = {
  profile: IngestProfileId
  onSuccess: (text: string) => void
  /** 解析成功后是否 toast；默认 false */
  showSuccessToast?: boolean
}

export function useLocalDocumentImport({
  profile,
  onSuccess,
  showSuccessToast = false,
}: Options) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importHint, setImportHint] = useState<string | null>(null)

  const ingestProfile = getIngestProfile(profile)

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setImporting(true)
      setImportHint(`正在解析「${file.name}」…`)
      try {
        const content = await extractDocumentText(file, ingestProfile.maxDocBytes)
        onSuccess(content.replace(/^\uFEFF/, '').trim())
        setImportHint(null)
        if (showSuccessToast) {
          toast.success('文稿已导入')
        }
      } catch (err) {
        setImportHint(null)
        toast.error(err instanceof Error ? err.message : '读取文件失败，请换一份文稿重试。')
      } finally {
        setImporting(false)
      }
    },
    [ingestProfile.maxDocBytes, onSuccess, showSuccessToast],
  )

  return {
    fileInputRef,
    importing,
    importHint,
    accept: ingestProfile.accept,
    openFilePicker,
    handleFileChange,
  }
}
