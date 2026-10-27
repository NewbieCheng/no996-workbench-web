/**
 * 镜头可编辑键的唯一提取口径 —— 生成脚本与回归测试共用，防止两套正则漂移。
 *
 * 只认字面量键：`useShotProp('key', fallback)`。动态键（模板串、变量）不计入，
 * 因为静态扫描无法证明它生效；宁可少报也不假报。
 *
 * 另外：`useLook(...)` 调用意味着该镜头消费了配色覆盖层（见 _fixtures/Look.tsx 的 useLook），
 * 它内部用 useShotProp 读取这 6 个配色键。因此扫描到 useLook 时补上这些键，
 * 否则调色盘/拾色器在检查器里会被误判为"不生效"而隐藏。
 *
 * `usePalette(...)` 是同一套配色键的轻量版本（自带色板镜头只开放 4 个槽位），
 * 键集合与 useLook 相同，因此共用 LOOK_COLOR_KEYS。
 */
const USE_SHOT_PROP_CALL = /useShotProp\(\s*['"]([A-Za-z_]\w*)['"]/g
const USE_LOOK_CALL = /useLook\s*\(|usePalette\s*\(/

/** useLook 内部消费的配色键（与 _fixtures/Look.tsx 的 useLook 保持一致） */
export const LOOK_COLOR_KEYS = [
  'colorTheme',
  'customBg',
  'customPrimary',
  'customSecondary',
  'customPanel',
  'customInk',
]

/** @param {string} source @returns {string[]} 去重排序后的可编辑键 */
export function extractEditableKeys(source) {
  const keys = new Set()
  for (const match of source.matchAll(USE_SHOT_PROP_CALL)) keys.add(match[1])
  if (USE_LOOK_CALL.test(source)) {
    for (const key of LOOK_COLOR_KEYS) keys.add(key)
  }
  return [...keys].sort()
}
