import type { SocialStudioBrief } from '../../features/social-studio/creative/social-studio-brief-types'
import type { SocialStudioRewriteSettings } from '../../features/social-studio/rewrite/social-studio-rewrite-types'
import type { SocialContentMode, PreviewDevice, WechatLayoutView } from '../../features/social-studio/studio-types'
import type { WechatThemeKey } from '../social-publish/layout/wechat-markdown-preview'
import type { WeixinPublishMode, XhsPublishMode } from '../social-publish/types'

export type SocialStudioDraftKey = 'wechat-article' | 'xiaohongshu'

export type SocialStudioDraftRecord = {
  key: SocialStudioDraftKey
  title: string
  content: string
  contentMode: SocialContentMode
  brief: SocialStudioBrief
  weixinPublishMode?: WeixinPublishMode
  xhsPublishMode?: XhsPublishMode
  layoutView?: WechatLayoutView
  device?: PreviewDevice
  themeKey?: WechatThemeKey
  rewriteSettings?: SocialStudioRewriteSettings
  updatedAt: number
}

const DB_NAME = 'no996-social-studio'
const DB_VERSION = 1
const STORE = 'drafts'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开社交工作室草稿库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('社交工作室草稿事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('社交工作室草稿事务中止'))
  })
}

export async function loadSocialStudioDraft(key: SocialStudioDraftKey): Promise<SocialStudioDraftRecord | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => {
      const value = req.result
      resolve(value && typeof value === 'object' ? (value as SocialStudioDraftRecord) : null)
    }
    req.onerror = () => reject(req.error ?? new Error('读取草稿失败'))
    tx.oncomplete = () => db.close()
  })
}

export async function putSocialStudioDraft(record: SocialStudioDraftRecord): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(record)
  await txDone(tx)
  db.close()
}

export async function clearSocialStudioDraft(key: SocialStudioDraftKey): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(key)
  await txDone(tx)
  db.close()
}

export function isIdbQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /quota|QUOTA_BYTES|kQuotaBytes/i.test(message)
}
