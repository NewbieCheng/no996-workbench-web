import { useCallback, useEffect, useRef, useState } from 'react'
import { type EditorInstance, type ProjectAsset, mirrorCaptionsOntoTextTrack } from '@no996/video-editor'
import { MediabunnyMediaAdapter } from '@no996/video-editor/media/mediabunny-adapter.ts'
import type { MediaProbeResult } from '@no996/video-editor/media/types.ts'
import type { IndexedDBAssetRepository } from '@no996/video-editor/core/repository/indexeddb.ts'
import { useWorkbenchTaskActions, useWorkbenchTasks, type WorkbenchTaskRecord, type IPVideoAudioPayload, type VoiceTtsPayload, type VoiceDubAdvancedPayload } from '../../../services/workbench-tasks'
import { createIndexedDbWorkbenchTaskRepository } from '../../../services/workbench-tasks/idb-repository'
import { resolveTtsSynthesisConfig } from '../../../api/models'
import { listVoices } from '../../../api/voice-clone'
import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import { apiErrorMessage } from '../../../api/client'
import { toastSuccess } from '../../../lib/toast'
import { retimeTalkDirectorShots } from './talk-director-compiler'
import { parseSrt } from '../lib/subtitles'
import { addAsset, editTalk, estimateCues, retimePhotos, resolveTalkCaptionImport, talkSettings, hasTalkAudio, validateTalkCaptions } from './talk-model'

export function useTalkInputs({ editor, assets, scope, onError }: { editor: EditorInstance; assets: IndexedDBAssetRepository; scope: string; onError: (message: string) => void }) {
  const actions = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks()
  const [busy, setBusy] = useState(false)
  const [voices, setVoices] = useState<Array<{ id: string; label: string }>>([])
  const [voiceError, setVoiceError] = useState('')
  const alive = useRef(true)
  const processing = useRef('')
  const taskRepo = useRef(createIndexedDbWorkbenchTaskRepository()).current
  const [taskVersion, setTaskVersion] = useState(0)
  const demo = isWorkbenchAiDemoMode()
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const loadVoices = useCallback(async () => {
    if (demo) return
    setVoiceError('')
    const [platform, custom] = await Promise.allSettled([resolveTtsSynthesisConfig(), listVoices()])
    if (!alive.current) return
    const options = platform.status === 'fulfilled' ? [...platform.value.platformVoices] : []
    if (custom.status === 'fulfilled') options.push(...custom.value.data.filter(v => v.ready_for_synthesis).map(v => ({ id: v.voice_id, label: v.display_name })))
    setVoices(Array.from(new Map(options.map(v => [v.id, v])).values()))
    if (!options.length) setVoiceError('音色目录暂不可用，可重试或导入已有配音。')
    if (platform.status === 'fulfilled' && !talkSettings(editor.getDocument()).voiceId && options.length) {
      const availableDefault = options.find(option => option.id === platform.value.defaultVoice)?.id ?? options[0].id
      editTalk(editor, 'default-voice', doc => ({ ...doc, ipVideo: { ...talkSettings(doc), voiceId: availableDefault } }))
    }
  }, [demo, editor])

  const persistAsset = useCallback(async (blob: Blob, name: string): Promise<ProjectAsset> => {
    if (!blob.size) throw new Error('素材为空，请重新选择。')
    // Own the adapter per probe; StrictMode may clean up effects and remount them without recreating refs.
    const adapter = new MediabunnyMediaAdapter()
    let result: MediaProbeResult
    try { result = await adapter.probe(blob) } finally { adapter.dispose() }
    if (result.kind !== 'image' && (!Number.isFinite(result.durationUs) || result.durationUs <= 0)) throw new Error('无法读取媒体实际时长，请更换素材格式。')
    if (result.kind !== 'image' && result.durationUs > 300_000_000) throw new Error('首版口播支持 5 分钟以内的音视频。')
    const id = `asset-ip-${crypto.randomUUID()}`
    const blobId = `blob-ip-${crypto.randomUUID()}`
    await assets.saveAssetBlob(blobId, scope, blob)
    return { id, blobId, kind: result.kind, name, mimeType: result.mimeType || blob.type, sizeBytes: blob.size, durationUs: result.kind === 'image' ? undefined : result.durationUs, width: result.width, height: result.height, hasAudio: result.hasAudio, createdAt: Date.now() }
  }, [assets, scope])

  const addFiles = async (files: File[]): Promise<boolean> => {
    if (!files.length || busy) return false
    if (files.length > 12) { onError('一次最多添加 12 个素材。'); return false }
    const id = editor.getDocument().id
    setBusy(true)
    try {
      const prepared: ProjectAsset[] = []
      const subtitleFiles = files.filter(file => /\.srt$/i.test(file.name))
      if (subtitleFiles.length > 1) throw new Error('一次只导入一份 SRT 字幕，避免覆盖。')
      if (subtitleFiles.some(file => file.size > 1_000_000)) throw new Error('字幕文件需小于 1 MB。')
      const importedCues = subtitleFiles.length ? parseSrt(await subtitleFiles[0].text()).map(line => ({ id: crypto.randomUUID(), text: line.text, startUs: Math.round(line.start * 1_000_000), durationUs: Math.round((line.end - line.start) * 1_000_000), timingSource: 'srt' as const })) : undefined
      if (importedCues && !importedCues.length) throw new Error('SRT 没有有效字幕，请检查文件内容。')
      for (const file of files.filter(file => !/\.srt$/i.test(file.name))) {
        if (!/^(image|video|audio)\//.test(file.type)) throw new Error(`不支持「${file.name}」的文件类型。`)
        if (file.size > (file.type.startsWith('image/') ? 10 : 300) * 1024 * 1024) throw new Error('照片需小于 10 MB，音视频需小于 300 MB。')
        prepared.push(await persistAsset(file, file.name))
      }
      if (!alive.current || editor.getDocument().id !== id) return false
      editTalk(editor, 'import-media', current => {
        let doc = current
        for (const asset of prepared) doc = addAsset(doc, asset, asset.kind)
        if (importedCues) {
          const imported = resolveTalkCaptionImport(importedCues, doc.durationUs)
          doc = { ...doc, durationUs: imported.durationUs, captions: imported.captions, ipVideo: { ...talkSettings(doc), script: imported.script, captionReviewScript: undefined, aiProtected: { ...talkSettings(doc).aiProtected, captions: true } } }
          mirrorCaptionsOntoTextTrack(doc)
        }
        if (doc.captions.some(c => c.startUs + c.durationUs > doc.durationUs)) throw new Error('新素材短于已校时字幕，请先调整字幕时间，或新建作品后导入。')
        return retimeTalkDirectorShots(doc)
      })
      return true
    } catch (failure) { if (alive.current) onError(apiErrorMessage(failure)); return false }
    finally { if (alive.current) setBusy(false) }
  }

  const importTask = useCallback(async (task: WorkbenchTaskRecord) => {
    const current = editor.getDocument()
    const documentId = current.id
    if (task.ownerUserId !== Number(scope) || task.status !== 'succeeded') throw new Error('只能使用当前账号已完成的配音。')
    const payload = await actions.getPayload(task.payloadId) as IPVideoAudioPayload | VoiceTtsPayload | VoiceDubAdvancedPayload | null
    if (!payload) throw new Error('配音资料已被清理，请导入已下载的音频。')
    const advanced = task.kind === 'voice_dub_advanced' ? payload as VoiceDubAdvancedPayload : undefined
    const blobId = advanced?.mergedBlobId || task.blobId
    const stored = blobId ? await taskRepo.getBlob(blobId) : null
    let blob: Blob
    if (stored?.data) blob = new Blob([stored.data], { type: stored.mime || 'audio/wav' })
    else {
      const url = await actions.getVoicePlaybackUrl(task)
      if (!url) throw new Error('配音已过期或未缓存，请导入已下载音频。')
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error('配音下载失败，请稍后重试。')
      blob = await response.blob()
    }
    const asset = await persistAsset(blob, '口播配音')
    const script = advanced ? advanced.config.documentText : (payload as IPVideoAudioPayload).text
    if (!alive.current || editor.getDocument().id !== documentId) return
    editTalk(editor, 'bind-audio', doc => {
      const state = talkSettings(doc)
      const changedScript = !!state.script && state.script !== script
      const source = { ...doc, ipVideo: { ...state, script: state.script || script, audioScript: script, appliedTaskId: task.id } }
      let next = addAsset(source, asset, 'audio')
      next.ipVideo = { ...talkSettings(next), audioScript: script }
      if (advanced && !changedScript && !doc.captions.some(c => c.timingSource !== 'estimated') && advanced.segments.length && advanced.segments.every(s => (s.audioDuration ?? 0) > 0)) {
        const total = advanced.segments.reduce((sum, s) => sum + s.audioDuration!, 0)
        let offset = 0
        next.captions = advanced.segments.flatMap((segment, i) => {
          const end = i === advanced.segments.length - 1 ? asset.durationUs! : Math.round((offset / asset.durationUs! + segment.audioDuration! / total) * asset.durationUs!)
          const cues = estimateCues(segment.text, end - offset, offset)
          offset = end
          return cues
        })
      }
      validateTalkCaptions(next.captions, next.durationUs)
      mirrorCaptionsOntoTextTrack(next)
      return retimeTalkDirectorShots(retimePhotos(next))
    })
    toastSuccess('配音、文案和字幕已载入当前作品。')
  }, [actions, assets, editor, persistAsset, scope, taskRepo])

  const generate = async () => {
    const doc = editor.getDocument()
    const state = talkSettings(doc)
    if (demo) throw new Error('演示模式不提交正式配音，请导入已有音频。')
    if (!state.script.trim()) throw new Error('请先输入口播文案。')
    if (!state.voiceId) throw new Error('请先选择一个可用音色。')
    if (doc.captions.some(c => c.timingSource !== 'estimated')) throw new Error('请先在字幕面板明确选择重新估时，再生成新配音，避免覆盖人工校时。')
    const taskId = await actions.enqueueIPVideoAudio({ text: state.script, voiceId: state.voiceId, voiceLabel: voices.find(v => v.id === state.voiceId)?.label ?? '所选音色', speed: state.speed ?? 1, templateId: 'scroll' })
    if (!alive.current || editor.getDocument().id !== doc.id) return
    editTalk(editor, 'bind-task', current => ({ ...current, ipVideo: { ...talkSettings(current), taskId } }))
    setTaskVersion(v => v + 1)
  }
  const state = talkSettings(editor.getDocument())
  const task = tasks.find(t => t.id === state.taskId)
  useEffect(() => {
    const settings = talkSettings(editor.getDocument())
    if (!task || task.status !== 'succeeded' || settings.appliedTaskId === task.id || processing.current === task.id) return
    processing.current = task.id
    void importTask(task).catch(failure => { if (alive.current) onError(apiErrorMessage(failure)) }).finally(() => { /* Retry is explicit, never a new paid submission. */ })
  }, [task, editor, importTask, onError, taskVersion])
  const retryBinding = async () => { if (task?.status === 'succeeded') { await importTask(task); processing.current = '' } }
  const hasAudio = hasTalkAudio(editor.getDocument())
  return { busy, setBusy, voices, voiceError, loadVoices, addFiles, importTask, persistAsset, generate, retryBinding, task, tasks, hasAudio, demo }
}
