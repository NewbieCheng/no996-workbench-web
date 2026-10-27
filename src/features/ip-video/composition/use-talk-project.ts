import { useCallback, useEffect, useRef, useState } from 'react'
import { createEditor, type EditorDocument, type EditorInstance } from '@no996/video-editor'
import { IndexedDBProjectRepository, IndexedDBAssetRepository } from '@no996/video-editor/core/repository/indexeddb.ts'
import { IP_VIDEO_CUSTOM_PROFILE } from '../ip-profile'
import { createTalkDocument, type TalkDocument } from './talk-model'

export function useTalkProject(owner: number) {
  const scope = String(owner)
  const repo = useRef(new IndexedDBProjectRepository('ip-video')).current
  const assets = useRef(new IndexedDBAssetRepository('ip-video')).current
  const [editor, setEditor] = useState<EditorInstance | null>(null)
  const [drafts, setDrafts] = useState<Array<{ id: string; name: string }>>([])
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [error, setError] = useState('')
  const active = useRef<EditorInstance | null>(null)
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const queue = useRef<Promise<void>>(Promise.resolve())

  const persist = useCallback((doc: EditorDocument) => {
    const save = queue.current.catch(() => {}).then(() => repo.saveProject(doc))
    queue.current = save
    return save
  }, [repo])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!active.current) return
    const doc = active.current.getDocument()
    setSaveState('saving')
    try {
      await persist(doc)
      if (mounted.current && active.current?.getDocument().revision === doc.revision) setSaveState('saved')
    } catch (failure) {
      if (mounted.current) { setSaveState('unsaved'); setError(failure instanceof Error ? failure.message : String(failure)) }
      throw failure
    }
  }, [persist])

  const openDocument = useCallback((doc: EditorDocument) => {
    if (doc.scope !== scope) throw new Error('无法打开其他账号的作品。')
    active.current?.setIsPlaying(false)
    active.current?.dispose()
    const instance = createEditor({ document: doc, profile: IP_VIDEO_CUSTOM_PROFILE, onDocumentChange(next) {
      if (!mounted.current) return
      setSaveState('unsaved')
      setDrafts(old => [{ id: next.id, name: next.name }, ...old.filter(d => d.id !== next.id)])
      clearTimeout(timer.current)
      timer.current = setTimeout(() => { void flush().catch(() => {}) }, 600)
    } })
    active.current = instance
    setEditor(instance)
    setSaveState('saved')
    setDrafts(old => [{ id: doc.id, name: doc.name }, ...old.filter(d => d.id !== doc.id)])
  }, [scope, flush])

  useEffect(() => {
    mounted.current = true
    let alive = true
    void (async () => {
      const list = await repo.listProjects(scope)
      if (!alive) return
      setDrafts(list.map(doc => ({ id: doc.id, name: doc.name })))
      const first = list.length ? await repo.getProject(list[0].id, scope) : null
      const initial = first ?? createTalkDocument(scope)
      if (!first) await persist(initial)
      if (alive) openDocument(initial)
    })().catch(failure => { if (alive) setError(failure instanceof Error ? failure.message : String(failure)) })
    return () => {
      alive = false; mounted.current = false; clearTimeout(timer.current)
      const instance = active.current
      if (instance) { instance.setIsPlaying(false); void persist(instance.getDocument()).catch(() => {}); instance.dispose() }
      active.current = null
    }
  }, [repo, scope, openDocument, persist])

  const open = async (id: string) => {
    await flush()
    const doc = await repo.getProject(id, scope)
    if (!doc) throw new Error('本机作品已不存在。')
    if (mounted.current) openDocument(doc)
  }
  const create = async () => {
    await flush()
    const doc = createTalkDocument(scope)
    await persist(doc)
    if (mounted.current) openDocument(doc)
  }
  const remove = async () => {
    const current = active.current
    if (!current) return
    clearTimeout(timer.current)
    await queue.current.catch(() => {})
    await repo.deleteProject(current.getDocument().id, scope)
    const rest = drafts.filter(d => d.id !== current.getDocument().id)
    const next: TalkDocument = rest.length ? (await repo.getProject(rest[0].id, scope)) ?? createTalkDocument(scope) : createTalkDocument(scope)
    await persist(next)
    if (mounted.current) { setDrafts(rest); openDocument(next) }
  }
  return { editor, drafts, saveState, error, setError, scope, repo, assets, flush, open, create, remove, openDocument }
}
