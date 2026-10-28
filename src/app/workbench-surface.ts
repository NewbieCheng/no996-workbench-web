/** 工作台内容区修饰类（与 BrowserRouter 路由 path 对齐，不依赖 data router 的 handle） */
const TOOL_PAGE = 'workbench-tool-page'

const WORKBENCH_SURFACE_BY_SEGMENT: Record<string, string> = {
  persona: `workbench-page--fluid ${TOOL_PAGE} persona-workbench-page`,
  'product-position': `workbench-page--fluid ${TOOL_PAGE} product-position-workbench-page`,
  titles: `workbench-page--fluid ${TOOL_PAGE}`,
  'video-script': `workbench-page--fluid ${TOOL_PAGE} video-script-workbench-page`,
  'live-script': `workbench-page--fluid ${TOOL_PAGE} live-script-workbench-page`,
  xiaohongshu: `workbench-page--fluid ${TOOL_PAGE}`,
  'wechat-article': `workbench-page--fluid ${TOOL_PAGE}`,
  moments: `workbench-page--fluid ${TOOL_PAGE} moments-workbench-page`,
  voice: `workbench-page--fluid ${TOOL_PAGE} voice-workbench-page`,
  'digital-human': `workbench-page--fluid ${TOOL_PAGE}`,
  'ip-video': `workbench-page--fluid ${TOOL_PAGE} ip-video-workbench-page`,
  'video-factory': `workbench-page--fluid ${TOOL_PAGE} video-factory-workbench-page`,
  extension: `workbench-page--fluid ${TOOL_PAGE}`,
  account: 'workbench-page--fluid',
  membership: 'workbench-page--fluid',
  'ui-kit': 'workbench-page--fluid component-catalog-workbench-page',
}

export function workbenchSurfaceClassFromPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  const match = trimmed.match(/\/workbench(?:\/([^/]+))?$/)
  if (!match) return ''
  const segment = match[1]
  if (!segment) return 'wb-home'
  return WORKBENCH_SURFACE_BY_SEGMENT[segment] ?? ''
}
