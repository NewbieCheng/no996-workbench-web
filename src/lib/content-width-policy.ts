/** 内容列宽策略：改默认宽 / 最大可拖宽时递增 revision，启动时迁移本机记忆。 */

export const CONTENT_WIDTH_POLICY_REVISION = 4

/** 与 `features/digital-human/content-width.ts` 保持同步（迁移时钳制本机记忆）。 */
const DIGITAL_HUMAN_STORED_MIN_WIDTH = 960

const POLICY_REVISION_KEY = 'no996.wb.contentWidth.policyRevision'
const PREFERENCE_KEY_SUFFIX = '.contentWidth'
const PREFERENCE_KEY_PREFIX = 'no996.'

/** 双栏工具页默认内容列宽（人设等窄文档页在 Page 上显式传 720）。 */
export const TOOL_CONTENT_DEFAULT_WIDTH = 1120
export const TOOL_CONTENT_MIN_WIDTH = 720
/** 人设创作区：左预览 + 分隔 + 右问卷，内容列宽把手不可窄于该值（避免双栏叠压）。 */
export const PERSONA_CONTENT_MIN_WIDTH = 880
/** 人设中间分隔条：拖拽时留给问卷列的最小宽度（仅 JS 钳制，CSS 不按此硬撑 flex）。 */
export const PERSONA_MAIN_MIN_WIDTH = 320
/** 列宽减去该值即为可拖最大宽度；0 = 可拖满列宽，与顶栏左右缘对齐（把手叠在列缘）。 */
export const CONTENT_WIDTH_EDGE_BUDGET = 0

function readRevision(): number {
  try {
    const raw = Number(localStorage.getItem(POLICY_REVISION_KEY))
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0
  } catch {
    return 0
  }
}

function writeRevision(revision: number): void {
  try {
    localStorage.setItem(POLICY_REVISION_KEY, String(revision))
  } catch {
    // ignore
  }
}

function clearStoredContentWidths(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFERENCE_KEY_PREFIX) && key.endsWith(PREFERENCE_KEY_SUFFIX)) {
        keys.push(key)
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

/** 在 React 挂载前调用一次即可。 */
export function migrateContentWidthPreferences(): void {
  const current = readRevision()
  if (current >= CONTENT_WIDTH_POLICY_REVISION) return

  if (current < 2) {
    clearStoredContentWidths()
  } else if (current < 3) {
    try {
      const key = 'no996.digital-human.contentWidth'
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        const value = Number(raw)
        if (!Number.isFinite(value) || value < DIGITAL_HUMAN_STORED_MIN_WIDTH) {
          localStorage.removeItem(key)
        }
      }
    } catch {
      // ignore
    }
  }

  if (current < 4) {
    try {
      const key = 'no996.persona.contentWidth'
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        const value = Number(raw)
        if (!Number.isFinite(value) || value < PERSONA_CONTENT_MIN_WIDTH) {
          localStorage.removeItem(key)
        }
      }
    } catch {
      // ignore
    }
  }

  writeRevision(CONTENT_WIDTH_POLICY_REVISION)
}
