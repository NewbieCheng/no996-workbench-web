import { resolveTtsSynthesisConfig } from './models'
import { demoPlatformVoices } from './workbench-ai'

let catalog: Array<{ id: string; label: string }> | null = null

export function getPlatformVoiceCatalog(): Array<{ id: string; label: string }> {
  return catalog ?? demoPlatformVoices()
}

export function resetPlatformVoiceCatalog(): void {
  catalog = null
}

/** 拉取并缓存平台音色列表（与 default-tts 同源）。 */
export async function ensurePlatformVoiceCatalog(): Promise<Array<{ id: string; label: string }>> {
  const cfg = await resolveTtsSynthesisConfig()
  catalog = cfg.platformVoices
  return catalog
}
