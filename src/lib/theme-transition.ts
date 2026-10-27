/** 明暗主题切换：整页统一交叉淡入，避免侧栏/顶栏/内容区各变各的。 */
export function runThemeTransition(apply: () => void): void {
  const root = document.documentElement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const startViewTransition = document.startViewTransition?.bind(document)

  if (!startViewTransition || reduced) {
    apply()
    return
  }

  root.classList.add('wb-theme-transitioning')
  const transition = startViewTransition(() => {
    apply()
  })
  void transition.finished.finally(() => {
    root.classList.remove('wb-theme-transitioning')
  })
}
