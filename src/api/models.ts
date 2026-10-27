import {
  type CachedModelCode,
  type CachedTtsConfig,
  DEFAULT_LIPSYNC_MODEL_STORAGE_KEY,
  DEFAULT_TTS_MODEL_STORAGE_KEY,
  DEFAULT_VISION_MODEL_STORAGE_KEY,
  getLipsyncInflight,
  getLipsyncMemory,
  getTtsInflight,
  getTtsMemory,
  getVisionInflight,
  getVisionMemory,
  isCapabilityCacheFresh,
  readSessionJson,
  setLipsyncInflight,
  setLipsyncMemory,
  setTtsInflight,
  setTtsMemory,
  setVisionInflight,
  setVisionMemory,
  writeSessionJson,
} from './capability-model-cache'
import {
  getDefaultChatModelInflight,
  getDefaultChatModelMemory,
  isDefaultChatModelCacheFresh,
  readSessionDefaultChatModel,
  setDefaultChatModelInflight,
  setDefaultChatModelMemory,
  writeSessionDefaultChatModel,
} from './default-chat-model-cache'
import { ensureAccessToken } from './client'
import {
  defaultChatModel,
  demoLipsyncModel,
  demoPlatformVoices,
  demoTtsModel,
  demoVisionChatModel,
  isWorkbenchAiDemoMode,
} from './workbench-ai'

export { invalidateDefaultChatModelCache } from './default-chat-model-cache'

export type TtsSynthesisConfig = {
  model: string
  defaultVoice: string
  platformVoices: Array<{ id: string; label: string }>
}

type DefaultChatModelResponse = {
  data?: {
    model_code?: string
  }
}

type DefaultTtsModelResponse = {
  data?: {
    model_code?: string
    default_voice?: string
    platform_voices?: Array<{ id?: string; label?: string }>
  }
}

function resolveFromEnvOverride(): string | undefined {
  const fromEnv = import.meta.env.VITE_CHAT_MODEL
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return undefined
}

async function fetchDefaultChatModelFromApi(): Promise<string> {
  const token = await ensureAccessToken()
  if (!token) return defaultChatModel()

  const res = await fetch('/api/v1/models/default-chat', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    return defaultChatModel()
  }
  const body = (await res.json()) as DefaultChatModelResponse
  const code = body.data?.model_code?.trim()
  if (!code) return defaultChatModel()
  const entry = { model_code: code, fetched_at: Date.now() }
  setDefaultChatModelMemory(entry)
  writeSessionDefaultChatModel(entry)
  return code
}

/**
 * 默认文本聊天模型：登录后从 GET /api/v1/models/default-chat 解析（与后台文本对话链首位一致）。
 * VITE_CHAT_MODEL 可覆盖；演示模式不调接口。
 */
export async function resolveDefaultChatModel(): Promise<string> {
  const envOverride = resolveFromEnvOverride()
  if (envOverride) return envOverride

  if (isWorkbenchAiDemoMode()) {
    return defaultChatModel()
  }

  const memory = getDefaultChatModelMemory()
  if (memory && isDefaultChatModelCacheFresh(memory)) {
    return memory.model_code
  }

  const sessionEntry = readSessionDefaultChatModel()
  if (sessionEntry && isDefaultChatModelCacheFresh(sessionEntry)) {
    setDefaultChatModelMemory(sessionEntry)
    return sessionEntry.model_code
  }

  let inflight = getDefaultChatModelInflight()
  if (!inflight) {
    inflight = fetchDefaultChatModelFromApi().finally(() => {
      setDefaultChatModelInflight(null)
    })
    setDefaultChatModelInflight(inflight)
  }
  return inflight
}

function demoTtsConfig(): TtsSynthesisConfig {
  const voices = demoPlatformVoices()
  return {
    model: demoTtsModel(),
    defaultVoice: voices[0]?.id ?? 'longanlingxin',
    platformVoices: voices,
  }
}

function normalizeTtsConfig(raw: DefaultTtsModelResponse['data']): CachedTtsConfig | null {
  const modelCode = raw?.model_code?.trim()
  if (!modelCode) return null
  const voices = (raw?.platform_voices ?? [])
    .map((row) => {
      const id = row.id?.trim()
      if (!id) return null
      const label = row.label?.trim() || id
      return { id, label }
    })
    .filter((row): row is { id: string; label: string } => Boolean(row))
  const defaultVoice = raw?.default_voice?.trim() || voices[0]?.id || ''
  if (!defaultVoice) return null
  return {
    model_code: modelCode,
    default_voice: defaultVoice,
    platform_voices: voices.length > 0 ? voices : [{ id: defaultVoice, label: defaultVoice }],
    fetched_at: Date.now(),
  }
}

async function fetchDefaultTtsFromApi(): Promise<CachedTtsConfig> {
  const token = await ensureAccessToken()
  if (!token) return toCachedTts(demoTtsConfig())

  const res = await fetch('/api/v1/models/default-tts', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    return toCachedTts(demoTtsConfig())
  }
  const body = (await res.json()) as DefaultTtsModelResponse
  const parsed = normalizeTtsConfig(body.data)
  if (!parsed) return toCachedTts(demoTtsConfig())
  setTtsMemory(parsed)
  writeSessionJson(DEFAULT_TTS_MODEL_STORAGE_KEY, parsed)
  return parsed
}

function toCachedTts(config: TtsSynthesisConfig): CachedTtsConfig {
  return {
    model_code: config.model,
    default_voice: config.defaultVoice,
    platform_voices: config.platformVoices,
    fetched_at: Date.now(),
  }
}

function cachedTtsToConfig(entry: CachedTtsConfig): TtsSynthesisConfig {
  return {
    model: entry.model_code,
    defaultVoice: entry.default_voice,
    platformVoices: entry.platform_voices,
  }
}

/** 默认 TTS 模型、默认音色与平台音色列表（GET /api/v1/models/default-tts）。 */
export async function resolveTtsSynthesisConfig(): Promise<TtsSynthesisConfig> {
  if (isWorkbenchAiDemoMode()) {
    return demoTtsConfig()
  }

  const memory = getTtsMemory()
  if (memory && isCapabilityCacheFresh(memory.fetched_at)) {
    return cachedTtsToConfig(memory)
  }

  const sessionEntry = readSessionJson<CachedTtsConfig>(DEFAULT_TTS_MODEL_STORAGE_KEY)
  if (sessionEntry?.model_code && isCapabilityCacheFresh(sessionEntry.fetched_at)) {
    setTtsMemory(sessionEntry)
    return cachedTtsToConfig(sessionEntry)
  }

  let inflight = getTtsInflight()
  if (!inflight) {
    inflight = fetchDefaultTtsFromApi().finally(() => {
      setTtsInflight(null)
    })
    setTtsInflight(inflight)
  }
  const resolved = await inflight
  return cachedTtsToConfig(resolved)
}

async function fetchDefaultModelCode(path: string, storageKey: string, fallback: () => string): Promise<string> {
  const token = await ensureAccessToken()
  if (!token) return fallback()

  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return fallback()
  const body = (await res.json()) as DefaultChatModelResponse
  const code = body.data?.model_code?.trim()
  if (!code) return fallback()
  const entry: CachedModelCode = { model_code: code, fetched_at: Date.now() }
  writeSessionJson(storageKey, entry)
  return code
}

async function resolveCachedModelCode(options: {
  memory: () => CachedModelCode | null | undefined
  setMemory: (entry: CachedModelCode | null | undefined) => void
  inflight: () => Promise<string> | null
  setInflight: (promise: Promise<string> | null) => void
  storageKey: string
  fetchPath: string
  demoFallback: () => string
  envOverride?: string | undefined
}): Promise<string> {
  if (options.envOverride) return options.envOverride
  if (isWorkbenchAiDemoMode()) return options.demoFallback()

  const memory = options.memory()
  if (memory && isCapabilityCacheFresh(memory.fetched_at)) {
    return memory.model_code
  }

  const sessionEntry = readSessionJson<CachedModelCode>(options.storageKey)
  if (sessionEntry?.model_code && isCapabilityCacheFresh(sessionEntry.fetched_at)) {
    options.setMemory(sessionEntry)
    return sessionEntry.model_code
  }

  let inflight = options.inflight()
  if (!inflight) {
    inflight = fetchDefaultModelCode(options.fetchPath, options.storageKey, options.demoFallback)
      .then((code) => {
        options.setMemory({ model_code: code, fetched_at: Date.now() })
        return code
      })
      .finally(() => {
        options.setInflight(null)
      })
    options.setInflight(inflight)
  }
  return inflight
}

/** 口型替换默认模型（GET /api/v1/models/default-lipsync）。 */
export async function resolveDefaultLipsyncModel(): Promise<string> {
  return resolveCachedModelCode({
    memory: getLipsyncMemory,
    setMemory: setLipsyncMemory,
    inflight: getLipsyncInflight,
    setInflight: setLipsyncInflight,
    storageKey: DEFAULT_LIPSYNC_MODEL_STORAGE_KEY,
    fetchPath: '/api/v1/models/default-lipsync',
    demoFallback: demoLipsyncModel,
  })
}

/**
 * 带图对话默认模型（GET /api/v1/models/default-vision）。
 * 可用 VITE_VISION_CHAT_MODEL 覆盖。
 */
export async function resolveVisionChatModel(): Promise<string> {
  const fromEnv = import.meta.env.VITE_VISION_CHAT_MODEL
  const envOverride = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : undefined
  return resolveCachedModelCode({
    memory: getVisionMemory,
    setMemory: setVisionMemory,
    inflight: getVisionInflight,
    setInflight: setVisionInflight,
    storageKey: DEFAULT_VISION_MODEL_STORAGE_KEY,
    fetchPath: '/api/v1/models/default-vision',
    demoFallback: demoVisionChatModel,
    envOverride,
  })
}
