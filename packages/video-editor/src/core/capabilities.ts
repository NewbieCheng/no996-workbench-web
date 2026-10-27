/**
 * 编辑器能力白名单与面板配置规范（Capabilities & Profiles）
 */

export type PanelId =
  | 'media'
  | 'canvas'
  | 'playback'
  | 'timeline'
  | 'inspector'
  | 'text'
  | 'captions'
  | 'transitions'
  | 'effects'
  | 'keyframes'
  | 'audioMixer'
  | 'template'
  | 'export'

export type PanelProfile = {
  /** 允许挂载或显示的面板白名单 */
  allowedPanels: PanelId[]
  /** 针对特定面板可见的分组/区块 */
  visibleSections?: Partial<Record<PanelId, string[]>>
  /** 针对特定面板只允许展示的字段名列表 */
  fields?: Partial<Record<PanelId, string[]>>
  /** 面板展现变体形态，如 compact / full / script-bound */
  variant?: Partial<Record<PanelId, string>>
  /** 自定义槽位启用开关 */
  slots?: Partial<Record<PanelId, Record<string, boolean>>>
  /** 字段文案重写映射表 */
  labels?: Partial<Record<string, string>>
  /** 针对特定面板开放的预设 ID 列表 */
  presets?: Partial<Record<PanelId, string[]>>
}

export type CommandPolicy = {
  allowedCommands?: string[]
  disallowedCommands?: string[]
}

export function isCommandPermitted(commandType: string, policy?: CommandPolicy): boolean {
  if (!policy) return true
  if (policy.disallowedCommands && policy.disallowedCommands.includes(commandType)) {
    return false
  }
  if (policy.allowedCommands && policy.allowedCommands.length > 0) {
    return policy.allowedCommands.includes(commandType)
  }
  return true
}

export function isPanelPermitted(panelId: PanelId, profile?: PanelProfile): boolean {
  if (!profile) return true
  return profile.allowedPanels.includes(panelId)
}

/**
 * 完整专业剪辑器默认配置（全面板开放）
 */
export const DEFAULT_FULL_PROFILE: PanelProfile = {
  allowedPanels: [
    'media',
    'canvas',
    'playback',
    'timeline',
    'inspector',
    'text',
    'captions',
    'transitions',
    'effects',
    'keyframes',
    'audioMixer',
    'template',
    'export',
  ],
}

/**
 * IP 口播视频专属精简白名单（按需显示，屏蔽复杂混音台、曲线与调色）
 */
export const DEFAULT_IP_PROFILE: PanelProfile = {
  allowedPanels: [
    'media',
    'canvas',
    'playback',
    'timeline',
    'inspector',
    'captions',
    'export',
  ],
  variant: {
    media: 'ip-compact',
    timeline: 'compact',
    captions: 'script-bound',
  },
  visibleSections: {
    inspector: ['layout', 'subtitles', 'background'],
  },
}
