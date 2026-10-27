import { Outlet, useLocation } from 'react-router-dom'

/**
 * 工作台子路由出口：路径变化时播放一次进入过渡，避免侧栏切页时内容硬切。
 * 仅 pathname 变化触发动画（同页内创作/历史 Tab 不切路由，不会重复播放）。
 */
export default function WorkbenchOutlet() {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="wb-page-transition" data-wb-page={pathname}>
      <Outlet />
    </div>
  )
}
