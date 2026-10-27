export type MomentsRunKind = 'plan' | 'copy' | 'rewrite'

export type MomentsView =
  | 'overview'
  | 'config'
  | 'running'
  | 'feedback'
  | 'plan'
  | 'material'
  | 'day-content'

export const MOMENTS_ROUTE_PATH = '/workbench/moments'

const VIEWS: readonly MomentsView[] = [
  'overview',
  'config',
  'running',
  'feedback',
  'plan',
  'material',
  'day-content',
]

const NEEDS_TASK: readonly MomentsView[] = ['running']
const KINDS: readonly MomentsRunKind[] = ['plan', 'copy', 'rewrite']

export function isMomentsView(value: unknown): value is MomentsView {
  return typeof value === 'string' && (VIEWS as readonly string[]).includes(value)
}

export interface MomentsRouteState {
  view: MomentsView
  week: string | null
  date: string | null
  taskId: string | null
  kind: MomentsRunKind | null
}

function asRunKind(value: unknown): MomentsRunKind | null {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
    ? (value as MomentsRunKind)
    : null
}

function asDate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseMomentsSearch(search: string): MomentsRouteState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const week = asDate(params.get('week'))
  const date = asDate(params.get('date'))
  const taskId = asDate(params.get('taskId'))
  const kind = asRunKind(params.get('kind'))
  const view = params.get('view')
  if (!isMomentsView(view)) return { view: 'overview', week, date, taskId: null, kind: null }
  if (NEEDS_TASK.includes(view) && !taskId) {
    return { view: 'overview', week, date, taskId: null, kind: null }
  }
  if ((view === 'material' || view === 'day-content') && !date) {
    return { view: 'overview', week, date: null, taskId: null, kind: null }
  }
  return { view, week, date, taskId, kind }
}

export function momentsSearch(state: MomentsRouteState): string {
  const query = new URLSearchParams()
  if (state.week) query.set('week', state.week)
  if (state.view !== 'overview') query.set('view', state.view)
  if (state.date) query.set('date', state.date)
  if (state.taskId) query.set('taskId', state.taskId)
  if (state.kind) query.set('kind', state.kind)
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export function momentsHref(state: MomentsRouteState): string {
  return `${MOMENTS_ROUTE_PATH}${momentsSearch(state)}`
}
