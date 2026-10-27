import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { SocialStudioRewriteSession } from './social-studio-rewrite-types'

type RewriteResultDualPaneProps = {
  session: SocialStudioRewriteSession
  selectedTitleIndex: number
  onSelectTitle: (index: number) => void
  onApply: () => void
  onRegenerate: () => void
  onDismiss: () => void
}

export function RewriteResultDualPane({
  session,
  selectedTitleIndex,
  onSelectTitle,
  onApply,
  onRegenerate,
  onDismiss,
}: RewriteResultDualPaneProps) {
  const { t } = useTranslation(['socialPublish', 'common'])

  const pass2Body = session.pass2Payload?.body || ''
  const titles = session.pass2Payload?.titles || []

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('rewriteCopied'))
    } catch {
      toast.error(t('rewriteCopyFailed'))
    }
  }

  return (
    <div className="rewrite-dual-pane">
      <div className="rewrite-dual-pane__columns">
        <section className="rewrite-dual-pane__col">
          <header className="rewrite-dual-pane__col-head">
            <h3>{t('rewritePass1Title')}</h3>
            <p className="ssc-hint">{t('rewritePass1Hint')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyText(session.pass1Body)}>
              <CopyIcon aria-hidden />
              {t('rewriteCopy')}
            </Button>
          </header>
          <div className="rewrite-dual-pane__body">{session.pass1Body}</div>
        </section>

        <section className="rewrite-dual-pane__col">
          <header className="rewrite-dual-pane__col-head">
            <h3>{t('rewritePass2Title')}</h3>
            <p className="ssc-hint">{t('rewritePass2Hint')}</p>
          </header>
          {session.secondPassSkipped ? (
            <p className="ssc-hint">{t('rewritePass2Skipped')}</p>
          ) : titles.length > 0 ? (
            <div className="rewrite-dual-pane__titles">
              <p className="rewrite-dual-pane__titles-label">{t('rewriteTitleCandidates')}</p>
              <ul>
                {titles.map((title, index) => (
                  <li key={`${title}-${index}`}>
                    <button
                      type="button"
                      className={`rewrite-dual-pane__title-option${selectedTitleIndex === index ? ' is-selected' : ''}`}
                      onClick={() => onSelectTitle(index)}
                    >
                      <span>{title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t('rewriteCopy')}
                        onClick={(e) => {
                          e.stopPropagation()
                          void copyText(title)
                        }}
                      >
                        <CopyIcon aria-hidden />
                      </Button>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rewrite-dual-pane__body">
            {pass2Body || (session.secondPassSkipped ? session.pass1Body : '')}
          </div>
          {pass2Body ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void copyText(pass2Body)}>
              <CopyIcon aria-hidden />
              {t('rewriteCopy')}
            </Button>
          ) : null}
        </section>
      </div>
      <div className="rewrite-dual-pane__actions">
        <Button type="button" onClick={onApply}>{t('rewriteApply')}</Button>
        <Button type="button" variant="outline" onClick={onRegenerate}>{t('rewriteRegenerate')}</Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>{t('common:cancel')}</Button>
      </div>
    </div>
  )
}
