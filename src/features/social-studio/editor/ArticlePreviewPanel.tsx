import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { toast } from 'sonner'
import { ArticleEditorBlockMenu } from './ArticleEditorBlockMenu'
import { ArticleEditorSelectionMenu } from './ArticleEditorSelectionMenu'
import { ImageCropModal } from './ImageCropModal'
import {
  ARTICLE_IMAGE_MAX_MB,
  filesToDataUrls,
  readFileAsDataUrl,
  type CropAreaPixels,
  type CropRatioMode,
} from './editor-image-utils'

export type ArticleEditorHandle = {
  getHTML: () => string
  setHTML: (value: string) => void
  focus: () => void
  insertImage: (src: string, alt?: string) => void
}

type ArticlePreviewPanelProps = {
  html: string
  writeHtmlDraft: (value: string) => void
  onReady?: (handle: ArticleEditorHandle | null) => void
  placeholder?: string
  className?: string
  editable?: boolean
  onDropImageFiles?: (files: FileList) => void
}

const normalizeEditorHtml = (value: string) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${value || ''}</body>`, 'text/html')
  return doc.body.innerHTML.trim()
}

const ArticleImageExtension = Image.extend({
  inline: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute('style'),
        renderHTML: (attributes) => {
          const value = attributes.style
          if (!value) return {}
          return { style: String(value) }
        },
      },
      dataLayoutFit: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-layout-fit'),
        renderHTML: (attributes) => {
          const value = attributes.dataLayoutFit
          if (!value) return {}
          return { 'data-layout-fit': String(value) }
        },
      },
    }
  },
}).configure({ allowBase64: true })

export function ArticlePreviewPanel({
  html,
  writeHtmlDraft,
  onReady,
  placeholder,
  className,
  editable = true,
}: ArticlePreviewPanelProps) {
  const { t } = useTranslation('socialPublish')
  const resolvedPlaceholder = placeholder ?? t('studioImageTextBodyPlaceholder')
  const writeRef = useRef(writeHtmlDraft)
  writeRef.current = writeHtmlDraft
  const lastEmittedHtmlRef = useRef(html)
  const editableRef = useRef(editable)
  editableRef.current = editable
  const containerRef = useRef<HTMLDivElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [selectedImageRect, setSelectedImageRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [selectedImageFitFree, setSelectedImageFitFree] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [cropMode, setCropMode] = useState<CropRatioMode>('free')
  const [cropAreaPixels, setCropAreaPixels] = useState<CropAreaPixels>(null)
  const [resizeDrag, setResizeDrag] = useState<{
    startX: number
    startY: number
    startW: number
    startH: number
    aspect: number
  } | null>(null)

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: false,
        underline: false,
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
        protocols: ['topic'],
      }),
      ArticleImageExtension,
      Underline,
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
    ],
    [resolvedPlaceholder],
  )

  const getEditorImageElements = (current: Editor | null) => {
    if (!current?.view?.dom) return [] as HTMLImageElement[]
    return Array.from(current.view.dom.querySelectorAll('img'))
  }

  const getSelectedImageElement = (current: Editor | null) => {
    if (selectedImageIndex === null) return null
    const images = getEditorImageElements(current)
    return images[selectedImageIndex] || null
  }

  const refreshSelectedImageState = (current: Editor | null) => {
    const index = selectedImageIndex
    if (index === null) {
      setSelectedImageRect(null)
      setSelectedImageFitFree(false)
      return
    }
    const host = containerRef.current
    if (!host) return
    const images = getEditorImageElements(current)
    if (index < 0 || index >= images.length) {
      setSelectedImageIndex(null)
      setSelectedImageRect(null)
      setSelectedImageFitFree(false)
      return
    }
    const target = images[index]
    const hostRect = host.getBoundingClientRect()
    const imageRect = target.getBoundingClientRect()
    setSelectedImageRect({
      left: imageRect.left - hostRect.left,
      top: imageRect.top - hostRect.top,
      width: imageRect.width,
      height: imageRect.height,
    })
    setSelectedImageFitFree(target.getAttribute('data-layout-fit') === 'free')
  }

  const updateSelectedImageInHtml = (current: Editor | null, updater: (image: HTMLImageElement) => void) => {
    if (!current) return false
    if (selectedImageIndex === null) return false
    const parser = new DOMParser()
    const doc = parser.parseFromString(current.getHTML(), 'text/html')
    const images = Array.from(doc.querySelectorAll('img'))
    const target = images[selectedImageIndex]
    if (!target) return false
    updater(target)
    current.commands.setContent(doc.body.innerHTML || '', { emitUpdate: true })
    return true
  }

  const insertImagesFromFiles = async (current: Editor | null, files: FileList | File[]) => {
    if (!current || !editableRef.current) return
    const urls = await filesToDataUrls(files)
    if (urls.length === 0) {
      const tooLarge = Array.from(files).some((f) => f.size > ARTICLE_IMAGE_MAX_MB * 1024 * 1024)
      if (tooLarge) toast.error(t('editorImageTooLarge', { maxMb: ARTICLE_IMAGE_MAX_MB }))
      return
    }
    for (const src of urls) {
      current
        .chain()
        .focus()
        .insertContent([
          { type: 'image', attrs: { src, alt: 'upload-image' } },
          { type: 'paragraph' },
        ])
        .run()
    }
  }

  const editor = useEditor(
    {
      extensions,
      content: html || '',
      editable,
      onUpdate: ({ editor: current }) => {
        if (!editableRef.current) return
        const nextHtml = current.getHTML()
        const normalizedNext = normalizeEditorHtml(nextHtml)
        const normalizedLast = normalizeEditorHtml(lastEmittedHtmlRef.current)
        if (normalizedNext === normalizedLast) return
        lastEmittedHtmlRef.current = nextHtml
        writeRef.current(nextHtml)
      },
      editorProps: {
        attributes: {
          class: 'editor-article-prosemirror',
          'data-placeholder': resolvedPlaceholder,
        },
        handleClick: (view, _pos, event) => {
          const target = event.target as HTMLElement | null
          if (!target) return false
          const image = target.closest('img')
          if (!image) {
            setSelectedImageIndex(null)
            return false
          }
          const images = Array.from(view.dom.querySelectorAll('img'))
          const index = images.findIndex((item) => item === image)
          if (index >= 0) setSelectedImageIndex(index)
          return false
        },
        handlePaste: (_view, event) => {
          if (!editableRef.current) return false
          const items = event.clipboardData?.items
          if (!items?.length) return false
          const imageFiles: File[] = []
          for (const item of Array.from(items)) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) imageFiles.push(file)
            }
          }
          if (imageFiles.length === 0) return false
          event.preventDefault()
          void insertImagesFromFiles(editorRef.current, imageFiles)
          return true
        },
      },
    },
    [resolvedPlaceholder],
  )

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    if (editor.isFocused && editable) return
    const current = normalizeEditorHtml(editor.getHTML())
    const next = normalizeEditorHtml(html || '')
    if (current === next) return
    editor.commands.setContent(html || '', { emitUpdate: false })
    lastEmittedHtmlRef.current = html || ''
  }, [editor, html, editable])

  useEffect(() => {
    if (!editor) {
      onReady?.(null)
      return
    }
    onReady?.({
      getHTML: () => editor.getHTML(),
      setHTML: (value) => {
        editor.commands.setContent(value || '', { emitUpdate: false })
      },
      focus: () => {
        editor.chain().focus('end').run()
      },
      insertImage: (src, alt = 'upload-image') => {
        editor
          .chain()
          .focus()
          .insertContent([
            { type: 'image', attrs: { src, alt } },
            { type: 'paragraph' },
          ])
          .run()
      },
    })
    return () => onReady?.(null)
  }, [editor, onReady])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
    if (!editable && editor.isFocused) editor.commands.blur()
  }, [editor, editable])

  useEffect(() => {
    setSelectedImageIndex(null)
    setSelectedImageRect(null)
    setSelectedImageFitFree(false)
    setImageModalOpen(false)
  }, [editor])

  useEffect(() => {
    if (!editor?.view?.dom) return
    const images = getEditorImageElements(editor)
    images.forEach((item, index) => {
      if (index === selectedImageIndex) {
        item.classList.add('editor-article-image-selected')
      } else {
        item.classList.remove('editor-article-image-selected')
      }
    })
    refreshSelectedImageState(editor)
  }, [editor, html, selectedImageIndex])

  useEffect(() => {
    if (selectedImageIndex === null) return
    const onWindowChange = () => refreshSelectedImageState(editor)
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
    return () => {
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    }
  }, [selectedImageIndex, editor, html])

  useEffect(() => {
    if (!imageModalOpen) return
    setImageZoom(1)
    setCropMode('free')
    setCropAreaPixels(null)
  }, [imageModalOpen, selectedImageIndex])

  useEffect(() => {
    if (!resizeDrag || !editor) return
    const onMouseMove = (event: MouseEvent) => {
      const dx = event.clientX - resizeDrag.startX
      const dy = event.clientY - resizeDrag.startY
      const keepRatio = !event.shiftKey
      const nextW = Math.max(80, resizeDrag.startW + dx)
      let nextH = Math.max(60, resizeDrag.startH + dy)
      if (keepRatio) {
        nextH = Math.max(60, nextW / (resizeDrag.aspect || 1))
      }
      const width = `${Math.round(nextW)}px`
      const height = keepRatio ? 'auto' : `${Math.round(nextH)}px`
      const changed = updateSelectedImageInHtml(editor, (target) => {
        target.setAttribute('data-layout-fit', 'free')
        target.style.maxWidth = 'none'
        target.style.width = width
        target.style.height = height
        target.style.objectFit = 'contain'
      })
      if (changed) refreshSelectedImageState(editor)
    }
    const onMouseUp = () => setResizeDrag(null)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizeDrag, editor, selectedImageIndex])

  const toolbarStyle = useMemo(() => {
    if (!selectedImageRect) return undefined
    return {
      left: `${Math.max(4, selectedImageRect.left)}px`,
      top: `${Math.max(4, selectedImageRect.top - 44)}px`,
    }
  }, [selectedImageRect])

  const onReplaceSelectedImage = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editor) return
    const nextSrc = await readFileAsDataUrl(files[0])
    if (!nextSrc) return
    updateSelectedImageInHtml(editor, (image) => {
      image.setAttribute('src', nextSrc)
    })
  }

  const toggleSelectedImageFit = () => {
    if (!editor) return
    const changed = updateSelectedImageInHtml(editor, (image) => {
      const isFree = image.getAttribute('data-layout-fit') === 'free'
      if (isFree) {
        image.removeAttribute('data-layout-fit')
        image.style.maxWidth = ''
        image.style.width = ''
        image.style.height = ''
        image.style.objectFit = ''
      } else {
        image.setAttribute('data-layout-fit', 'free')
        image.style.maxWidth = 'none'
        image.style.width = 'auto'
        image.style.height = 'auto'
        image.style.objectFit = 'contain'
      }
    })
    if (changed) refreshSelectedImageState(editor)
  }

  const resizeSelectedImageByFactor = (factor: number) => {
    if (!editor) return
    const selected = getSelectedImageElement(editor)
    if (!selected) return
    const box = selected.getBoundingClientRect()
    const currentWidth = Math.max(80, box.width)
    const nextWidth = Math.max(80, Math.round(currentWidth * factor))
    const currentHeight = box.height > 0 ? box.height : Math.round(currentWidth * 0.75)
    const hasFixedHeight = /^\d+/.test((selected.style.height || '').trim())
    const nextHeight = Math.max(60, Math.round(currentHeight * factor))
    const changed = updateSelectedImageInHtml(editor, (target) => {
      target.setAttribute('data-layout-fit', 'free')
      target.style.maxWidth = 'none'
      target.style.width = `${nextWidth}px`
      target.style.height = hasFixedHeight ? `${nextHeight}px` : 'auto'
      target.style.objectFit = 'contain'
    })
    if (changed) refreshSelectedImageState(editor)
  }

  const applyCropMode = (mode: CropRatioMode) => {
    setCropMode(mode)
    setCropAreaPixels(null)
  }

  const cropSelectedImage = async () => {
    if (!editor || selectedImageIndex === null) return
    const currentImage = getEditorImageElements(editor)[selectedImageIndex]
    if (!currentImage) return
    const source = currentImage.getAttribute('src') || ''
    if (!source || !cropAreaPixels) return
    const image = new window.Image()
    image.src = source
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('image load failed'))
    })
    const sx = Math.max(0, Math.floor(cropAreaPixels.x))
    const sy = Math.max(0, Math.floor(cropAreaPixels.y))
    const sw = Math.max(1, Math.floor(cropAreaPixels.width))
    const sh = Math.max(1, Math.floor(cropAreaPixels.height))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
    const nextSrc = canvas.toDataURL('image/png', 0.92)
    const changed = updateSelectedImageInHtml(editor, (target) => {
      target.setAttribute('src', nextSrc)
    })
    if (!changed) return
    setImageModalOpen(false)
  }

  const beginSelectedImageResize = (event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const selected = getSelectedImageElement(editor)
    if (!selected) return
    const box = selected.getBoundingClientRect()
    setResizeDrag({
      startX: event.clientX,
      startY: event.clientY,
      startW: Math.max(80, box.width),
      startH: Math.max(60, box.height),
      aspect: box.height > 0 ? box.width / box.height : 1,
    })
  }

  const rootClass = ['editor-article-panel-wrap', 'editor-rich-content', className].filter(Boolean).join(' ')
  return (
    <div ref={containerRef} className={rootClass}>
      {selectedImageRect && editable ? (
        <div className="editor-article-image-toolbar" style={toolbarStyle}>
          <button type="button" onClick={() => setImageModalOpen(true)}>{t('editorImageCrop')}</button>
          <button type="button" onClick={() => replaceInputRef.current?.click()}>{t('editorImageReplace')}</button>
          <button type="button" onClick={() => resizeSelectedImageByFactor(0.9)}>{t('editorImageShrink')}</button>
          <button type="button" onClick={() => resizeSelectedImageByFactor(1.1)}>{t('editorImageEnlarge')}</button>
          <button type="button" onClick={toggleSelectedImageFit}>
            {selectedImageFitFree ? t('editorImageFitAuto') : t('editorImageFitFree')}
          </button>
        </div>
      ) : null}
      {selectedImageRect && editable ? (
        <span
          className="editor-article-image-resize-handle"
          style={{
            left: `${selectedImageRect.left + selectedImageRect.width - 8}px`,
            top: `${selectedImageRect.top + selectedImageRect.height - 8}px`,
          }}
          onMouseDown={beginSelectedImageResize}
        />
      ) : null}
      <div
        className="editor-article-editor-host"
        onDragOver={(event) => {
          if (!editable) return
          if (!Array.from(event.dataTransfer.types).includes('Files')) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!editable) return
          event.preventDefault()
          if (event.dataTransfer.files.length > 0) {
            void insertImagesFromFiles(editor, event.dataTransfer.files)
          }
        }}
      >
        {editable ? <ArticleEditorBlockMenu editor={editor} /> : null}
        {editable ? <ArticleEditorSelectionMenu editor={editor} /> : null}
        <EditorContent editor={editor} className="editor-preview-body editor-preview-editable" />
      </div>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void onReplaceSelectedImage(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      <ImageCropModal
        isOpen={imageModalOpen && selectedImageIndex !== null}
        imageSrc={
          selectedImageIndex !== null
            ? getEditorImageElements(editor)[selectedImageIndex]?.getAttribute('src') || ''
            : ''
        }
        imageAlt={selectedImageIndex !== null ? `article-image-${selectedImageIndex + 1}` : 'article-image'}
        imageZoom={imageZoom}
        cropMode={cropMode}
        cropAreaPixels={cropAreaPixels}
        onClose={() => setImageModalOpen(false)}
        onCropAreaChange={setCropAreaPixels}
        onApplyCropMode={applyCropMode}
        onZoomChange={setImageZoom}
        onApplyCrop={() => void cropSelectedImage()}
      />
    </div>
  )
}
