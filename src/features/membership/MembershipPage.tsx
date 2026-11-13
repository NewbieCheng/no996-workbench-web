import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Coins, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Page } from '../../components/WorkbenchUI'
import { useAuth } from '../../auth/AuthContext'
import { api, getAccessToken, type ApiEnvelope } from '../../api/client'
import { toastSuccess } from '../../lib/toast'

interface AccountBalanceData {
  points_balance: number
  period_points_balance?: number
  period_expires_at?: string | null
  expert_points_balance: number
}

function resolveConsoleBaseUrl(): string {
  const configured = import.meta.env.VITE_CONSOLE_BASE_URL as string | undefined
  if (configured && configured.trim()) return configured.trim().replace(/\/$/, '')
  if (typeof window === 'undefined') return ''
  const { hostname, port } = window.location
  if ((hostname === '127.0.0.1' || hostname === 'localhost') && port === '8897') {
    return 'http://127.0.0.1:5188'
  }
  if (hostname === 'agent.bujiaban.top') return 'https://worker.bujiaban.top'
  if (hostname === 'agent.no996ai.cn') return 'https://worker.no996ai.cn'
  return ''
}

export default function MembershipPage() {
  const { currentSpace } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [balance, setBalance] = useState<AccountBalanceData | null>(null)
  const [loadingBal, setLoadingBal] = useState(false)

  const loadBalance = useCallback(async () => {
    setLoadingBal(true)
    try {
      const res = await api.get<ApiEnvelope<AccountBalanceData>>('/account/balance')
      if (res.data?.data) setBalance(res.data.data)
    } catch {
      // ignore transient error
    } finally {
      setLoadingBal(false)
    }
  }, [])

  useEffect(() => {
    void loadBalance()
  }, [loadBalance, currentSpace?.kind, currentSpace?.id])

  const syncTokenToIframe = useCallback(() => {
    const win = iframeRef.current?.contentWindow
    const token = getAccessToken()
    if (!win || !token) return
    win.postMessage({ type: 'NO996_AUTH_TOKEN', token }, '*')
  }, [])

  useEffect(() => {
    syncTokenToIframe()
  }, [syncTokenToIframe, currentSpace?.kind, currentSpace?.id])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (data && typeof data === 'object' && data.type === 'NO996_PAYMENT_SUCCESS') {
        toastSuccess('充值成功，正在同步最新积分余额')
        void loadBalance()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [loadBalance])

  const embedUrl = useMemo(() => {
    const base = resolveConsoleBaseUrl()
    const params = new URLSearchParams({
      platform: 'workbench',
      embed: '1',
    })
    if (currentSpace?.kind === 'team' && currentSpace.id > 0) {
      params.set('owner_type', '2')
      params.set('owner_id', String(currentSpace.id))
    } else {
      params.set('owner_type', '1')
    }
    return `${base}/console/embed/recharge?${params.toString()}`
  }, [currentSpace?.kind, currentSpace?.id])

  const totalPoints = balance ? balance.points_balance + (balance.period_points_balance ?? 0) : null
  const spaceLabel =
    currentSpace?.kind === 'team'
      ? '企业空间'
      : currentSpace?.kind === 'platform'
        ? '平台空间'
        : '个人空间'

  return (
    <Page
      moduleId="membership"
      title="积分充值与套餐"
      description="统一微信扫码充值与管理员人工充值通道，积分实时到账并在各端同步扣减。"
      actions={
        <Button variant="outline" size="sm" onClick={() => void loadBalance()} disabled={loadingBal}>
          <RefreshCw size={14} className={loadingBal ? 'animate-spin' : ''} />
          <Coins size={14} />
          刷新积分
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-xs shadow-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
          <Sparkles className="size-4" />
          当前空间：{spaceLabel}
        </span>
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span>
            可用总积分：<strong className="text-sm text-foreground tabular-nums">{totalPoints ?? '—'}</strong>
          </span>
          <span>
            临时积分：<strong className="text-sm text-amber-600 dark:text-amber-400 tabular-nums">{balance?.period_points_balance ?? 0}</strong>
          </span>
          <span>
            永久积分：<strong className="text-sm text-foreground tabular-nums">{balance?.points_balance ?? '—'}</strong>
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="工作台统一充值中心"
          onLoad={syncTokenToIframe}
          className="h-[820px] w-full border-0 bg-background"
        />
      </div>
    </Page>
  )
}
