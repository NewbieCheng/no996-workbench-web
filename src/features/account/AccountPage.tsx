import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, ReceiptText, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Page, Panel, Notice } from '../../components/WorkbenchUI'
import { useAuth } from '../../auth/AuthContext'
import { api, type ApiEnvelope } from '../../api/client'
import { getCurrentTenantInfo } from '../../api/tenant'
import { UserAvatar } from '../../components/UserAvatar'

interface AccountBalanceData {
  account_id?: number
  points_balance: number
  expert_points_balance: number
}

interface LedgerItem {
  ledger_id: number
  change_type: number | string
  points_delta: number
  expert_points_delta: number
  owner_label?: string
  created_at?: string
}

export default function AccountPage() {
  const { t } = useTranslation('workbench')
  const { userEmail, userDisplayName, userId, tenantId } = useAuth()
  const [balance, setBalance] = useState<AccountBalanceData | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [ledgers, setLedgers] = useState<LedgerItem[]>([])
  const [loading, setLoading] = useState(false)

  const displayName = userDisplayName || t('accountFallbackName')
  async function fetchAccountData() {
    setLoading(true)
    try {
      const balRes = await api.get<ApiEnvelope<AccountBalanceData>>('/account/balance')
      if (balRes.data?.data) {
        setBalance(balRes.data.data)
      }
    } catch {
      // 容错处理
    }

    try {
      const ledgerRes = await api.get<ApiEnvelope<{ items: LedgerItem[] } | LedgerItem[]>>('/account/ledgers?page=1&page_size=5')
      const items = Array.isArray(ledgerRes.data?.data)
        ? ledgerRes.data.data
        : ledgerRes.data?.data?.items ?? []
      setLedgers(items)
    } catch {
      // 容错处理
    }

    if (tenantId != null && tenantId > 0) {
      try {
        const tenant = await getCurrentTenantInfo()
        setTenantName(tenant.tenant_name)
      } catch {
        setTenantName('')
      }
    } else {
      setTenantName('')
    }

    setLoading(false)
  }

  useEffect(() => {
    void fetchAccountData()
  }, [tenantId])

  return (
    <Page
      moduleId="account"
      title="账号与资产"
      description="管理您的登录账号与可用积分资产。"
      actions={
        <Button variant="outline" size="sm" onClick={fetchAccountData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新资产
        </Button>
      }
    >
      <Panel title="当前登录账户" description="已通过平台安全认证登录。">
        <div className="account-overview">
          <div className="account-identity">
            <UserAvatar className="account-avatar" alt={displayName} />
            <div>
              <strong>{displayName}</strong>
              <p>{userEmail || t('accountSignedIn')}</p>
            </div>
          </div>
          <div>
            <span className="field-hint">用户 UID</span>
            <p>#{userId ?? '—'}</p>
          </div>
          {tenantId != null && tenantId > 0 && (
            <div>
              <span className="field-hint">{t('accountEnterprise')}</span>
              <p>{tenantName || '—'}</p>
            </div>
          )}
          <div>
            <span className="field-hint">可用通用积分</span>
            <p className="font-semibold text-primary">
              {balance ? balance.points_balance : '—'} 点
            </p>
          </div>
          <div>
            <span className="field-hint">专家/高级积分</span>
            <p className="font-semibold">
              {balance ? balance.expert_points_balance : '0'} 点
            </p>
          </div>
        </div>
      </Panel>

      <div className="tool-layout">
        <Panel title="增值服务与资产说明" description="透明清晰的点数消耗与能力计费。">
          <div className="account-detail">
            <Wallet size={22} />
            <div>
              <h3>点数智能扣减</h3>
              <p>文本工具、文案撰写按词量消耗点数，多模态视听合成按生成时长计费。</p>
            </div>
          </div>
          <hr className="section-divider" />
          <div className="account-detail">
            <Gift size={22} />
            <div>
              <h3>声音克隆与数字人定制</h3>
              <p>支持深度还原个人音色与真人形象，专属训练包独立配置生效。</p>
            </div>
          </div>
          <Notice>所有积分划扣均受实时账本监控，操作透明可查。</Notice>
        </Panel>

        <Panel title="近期账本记录" description="账户最新积分变动流水明细。">
          {ledgers.length > 0 ? (
            <div className="space-y-3">
              {ledgers.map((item) => (
                <div
                  key={item.ledger_id}
                  className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{item.owner_label || '系统流水'}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : `流水号 #${item.ledger_id}`}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      item.points_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                    }`}
                  >
                    {item.points_delta >= 0 ? `+${item.points_delta}` : item.points_delta} 点
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="service-result">
              <ReceiptText size={28} />
              <h3>暂无新的账本扣减记录</h3>
              <p>使用各类 AI 创作工具后，变动记录将实时同步至此处。</p>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  )
}
